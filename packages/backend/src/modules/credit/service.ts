'use strict';

import { eq, desc } from 'drizzle-orm';
import type { CreditTransaction } from '@trendmetrics/shared';
import { db, pool } from '../../db/index.js';
import { userBalances, creditTransactions } from '../../db/schema.js';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../config/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createChildLogger({ module: 'credit-service' });

// ---------------------------------------------------------------------------
// CreditService
// ---------------------------------------------------------------------------

export class CreditService {
  /**
   * Get the current balance for a user.
   */
  async getBalance(userId: string): Promise<number> {
    const result = await db
      .select()
      .from(userBalances)
      .where(eq(userBalances.userId, userId))
      .limit(1);

    if (result.length === 0) return 0;
    return Number(result[0]!.balance);
  }

  /**
   * Ensure a user has a balance record. Creates one with signup bonus if missing.
   */
  async ensureUserBalance(userId: string, signupBonus?: number): Promise<void> {
    const bonus = signupBonus ?? config.credits.signupBonus;

    const existing = await db
      .select()
      .from(userBalances)
      .where(eq(userBalances.userId, userId))
      .limit(1);

    if (existing.length > 0) return;

    const balanceId = uuidv4();
    const txId = uuidv4();

    await db.insert(userBalances).values({
      id: balanceId,
      userId,
      balance: String(bonus),
      updatedAt: new Date(),
    });

    await db.insert(creditTransactions).values({
      id: txId,
      userId,
      type: 'signup_bonus',
      amount: String(bonus),
      balanceAfter: String(bonus),
      description: 'Welcome bonus',
      idempotencyKey: `signup_bonus_${userId}`,
      status: 'completed',
      createdAt: new Date(),
    });

    logger.info('Created balance with signup bonus', { userId, bonus });
  }

  /**
   * Deduct credits with idempotency and balance check.
   * Uses a PostgreSQL transaction for atomicity.
   */
  async deduct(
    userId: string,
    amount: number,
    type: string,
    description: string,
    idempotencyKey: string,
  ): Promise<CreditTransaction> {
    // Check idempotency first
    const existing = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing.length > 0) {
      logger.info('Idempotent deduction request detected', { idempotencyKey });
      const tx = existing[0]!;
      return this.mapTransaction(tx);
    }

    // Use raw pool for atomic transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the balance row for update
      const balanceResult = await client.query(
        'SELECT id, balance FROM user_balances WHERE user_id = $1 FOR UPDATE',
        [userId],
      );

      if (balanceResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new AppError(400, 'NO_BALANCE', 'User has no balance record');
      }

      const currentBalance = Number(balanceResult.rows[0].balance);
      if (currentBalance < amount) {
        await client.query('ROLLBACK');
        throw new AppError(
          402,
          'INSUFFICIENT_BALANCE',
          `Insufficient balance. Required: $${amount.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`,
        );
      }

      const newBalance = currentBalance - amount;
      const txId = uuidv4();

      // Update balance
      await client.query(
        'UPDATE user_balances SET balance = $1, updated_at = NOW() WHERE user_id = $2',
        [String(newBalance), userId],
      );

      // Insert transaction record
      await client.query(
        `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, idempotency_key, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())`,
        [txId, userId, type, String(-amount), String(newBalance), description, idempotencyKey],
      );

      await client.query('COMMIT');

      logger.info('Credit deduction completed', {
        userId,
        amount: -amount,
        newBalance,
        type,
        txId,
      });

      return {
        id: txId,
        user_id: userId,
        type: type as CreditTransaction['type'],
        amount: -amount,
        balance_after: newBalance,
        description,
        idempotency_key: idempotencyKey,
        status: 'completed',
        created_at: new Date(),
      };
    } catch (err: unknown) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Refund a previously completed transaction.
   */
  async refund(transactionId: string): Promise<CreditTransaction> {
    const original = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.id, transactionId))
      .limit(1);

    if (original.length === 0) {
      throw new AppError(404, 'TX_NOT_FOUND', 'Transaction not found');
    }

    const tx = original[0]!;
    if (tx.status === 'reversed') {
      throw new AppError(400, 'ALREADY_REFUNDED', 'Transaction already refunded');
    }

    const refundAmount = Math.abs(Number(tx.amount));
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Lock and update balance
      const balanceResult = await client.query(
        'SELECT balance FROM user_balances WHERE user_id = $1 FOR UPDATE',
        [tx.userId],
      );

      const currentBalance = balanceResult.rows.length > 0 ? Number(balanceResult.rows[0].balance) : 0;
      const newBalance = currentBalance + refundAmount;
      const refundTxId = uuidv4();

      await client.query(
        'UPDATE user_balances SET balance = $1, updated_at = NOW() WHERE user_id = $2',
        [String(newBalance), tx.userId],
      );

      // Mark original as reversed
      await client.query(
        "UPDATE credit_transactions SET status = 'reversed' WHERE id = $1",
        [transactionId],
      );

      // Insert refund transaction
      await client.query(
        `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, idempotency_key, status, created_at)
         VALUES ($1, $2, 'refund', $3, $4, $5, $6, 'completed', NOW())`,
        [refundTxId, tx.userId, String(refundAmount), String(newBalance), `Refund for: ${tx.description ?? ''}`, `refund_${transactionId}`],
      );

      await client.query('COMMIT');

      logger.info('Credit refund completed', {
        userId: tx.userId,
        refundAmount,
        newBalance,
        originalTxId: transactionId,
      });

      return {
        id: refundTxId,
        user_id: tx.userId,
        type: 'refund',
        amount: refundAmount,
        balance_after: newBalance,
        description: `Refund for: ${tx.description ?? ''}`,
        idempotency_key: `refund_${transactionId}`,
        status: 'completed',
        created_at: new Date(),
      };
    } catch (err: unknown) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Add credits to a user's balance.
   */
  async topUp(userId: string, amount: number, idempotencyKey: string): Promise<CreditTransaction> {
    // Check idempotency
    const existing = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing.length > 0) {
      return this.mapTransaction(existing[0]!);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const balanceResult = await client.query(
        'SELECT balance FROM user_balances WHERE user_id = $1 FOR UPDATE',
        [userId],
      );

      const currentBalance = balanceResult.rows.length > 0 ? Number(balanceResult.rows[0].balance) : 0;
      const newBalance = currentBalance + amount;
      const txId = uuidv4();

      if (balanceResult.rows.length > 0) {
        await client.query(
          'UPDATE user_balances SET balance = $1, updated_at = NOW() WHERE user_id = $2',
          [String(newBalance), userId],
        );
      } else {
        await client.query(
          'INSERT INTO user_balances (id, user_id, balance, updated_at) VALUES ($1, $2, $3, NOW())',
          [uuidv4(), userId, String(newBalance)],
        );
      }

      await client.query(
        `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, idempotency_key, status, created_at)
         VALUES ($1, $2, 'purchase', $3, $4, $5, $6, 'completed', NOW())`,
        [txId, userId, String(amount), String(newBalance), `Credit top-up: $${amount.toFixed(2)}`, idempotencyKey],
      );

      await client.query('COMMIT');

      logger.info('Credit top-up completed', { userId, amount, newBalance });

      return {
        id: txId,
        user_id: userId,
        type: 'topup',
        amount,
        balance_after: newBalance,
        description: `Credit top-up: $${amount.toFixed(2)}`,
        idempotency_key: idempotencyKey,
        status: 'completed',
        created_at: new Date(),
      };
    } catch (err: unknown) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get transaction history for a user.
   */
  async getHistory(userId: string, limit: number = 20, offset: number = 0): Promise<CreditTransaction[]> {
    const result = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map((r) => this.mapTransaction(r));
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private mapTransaction(row: typeof creditTransactions.$inferSelect): CreditTransaction {
    return {
      id: row.id,
      user_id: row.userId,
      type: row.type as CreditTransaction['type'],
      amount: Number(row.amount),
      balance_after: Number(row.balanceAfter),
      description: row.description ?? '',
      idempotency_key: row.idempotencyKey ?? '',
      status: row.status as CreditTransaction['status'],
      created_at: row.createdAt,
    };
  }
}
