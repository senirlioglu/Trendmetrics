import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { eq, desc } from "drizzle-orm";
import type { ApiResponse, CreditTransaction } from "@trendmetrics/shared";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { topUpRequestSchema, paginationSchema } from "../../utils/validation.js";
import { generateId } from "../../utils/helpers.js";
import { logger } from "../../config/logger.js";

const router = Router();

// ---------------------------------------------------------------------------
// Auth guard helper -- reads x-user-id injected by upstream middleware
// ---------------------------------------------------------------------------

function requireUser(req: Request, res: Response): string | null {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) {
    const body: ApiResponse<null> = {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing authentication" },
    };
    res.status(401).json(body);
    return null;
  }
  return userId;
}

// ---------------------------------------------------------------------------
// GET /api/credits/balance
// ---------------------------------------------------------------------------

router.get(
  "/balance",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUser(req, res);
      if (!userId) return;

      const [row] = await db
        .select()
        .from(schema.userBalances)
        .where(eq(schema.userBalances.userId, userId))
        .limit(1);

      const balance = row ? Number(row.balance) : 0;

      const body: ApiResponse<{ balance: number }> = {
        success: true,
        data: { balance },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/credits/topup
// Body: { amount, payment_token }
// ---------------------------------------------------------------------------

router.post(
  "/topup",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUser(req, res);
      if (!userId) return;

      const parsed = topUpRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        const body: ApiResponse<null> = {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        };
        res.status(400).json(body);
        return;
      }

      const { amount, payment_token } = parsed.data;

      // --- simulate payment verification ---
      logger.info("Simulated payment verification", {
        userId,
        amount,
        payment_token,
      });

      // Fetch or create balance
      let [balanceRow] = await db
        .select()
        .from(schema.userBalances)
        .where(eq(schema.userBalances.userId, userId))
        .limit(1);

      if (!balanceRow) {
        const [created] = await db
          .insert(schema.userBalances)
          .values({ userId, balance: "0" })
          .returning();
        balanceRow = created!;
      }

      const newBalance = Number(balanceRow.balance) + amount;

      await db
        .update(schema.userBalances)
        .set({ balance: String(newBalance), updatedAt: new Date() })
        .where(eq(schema.userBalances.userId, userId));

      // Record transaction
      const txnId = generateId();
      await db.insert(schema.creditTransactions).values({
        id: txnId,
        userId,
        type: "purchase",
        amount: String(amount),
        balanceAfter: String(newBalance),
        description: "Credit top-up",
        idempotencyKey: `topup_${userId}_${Date.now()}`,
        status: "completed",
        metadata: { payment_token },
      });

      logger.info("Credit top-up completed", { userId, amount, newBalance });

      // Audit
      await db.insert(schema.auditLogs).values({
        userId,
        action: "credit_topup",
        resourceType: "credit_transaction",
        resourceId: txnId,
        details: { amount, newBalance },
        ipAddress: req.ip ?? null,
      });

      const body: ApiResponse<{ balance: number; transaction_id: string }> = {
        success: true,
        data: { balance: newBalance, transaction_id: txnId },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/credits/history
// Query: limit, offset
// ---------------------------------------------------------------------------

router.get(
  "/history",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUser(req, res);
      if (!userId) return;

      const pagination = paginationSchema.safeParse(req.query);
      if (!pagination.success) {
        const body: ApiResponse<null> = {
          success: false,
          error: { code: "VALIDATION_ERROR", message: pagination.error.message },
        };
        res.status(400).json(body);
        return;
      }

      const { limit, offset } = pagination.data;

      const rows = await db
        .select()
        .from(schema.creditTransactions)
        .where(eq(schema.creditTransactions.userId, userId))
        .orderBy(desc(schema.creditTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      const transactions: CreditTransaction[] = rows.map((r) => ({
        id: r.id,
        user_id: r.userId,
        type: r.type as CreditTransaction["type"],
        amount: Number(r.amount),
        balance_after: Number(r.balanceAfter),
        description: (r.description as string) ?? "",
        idempotency_key: r.idempotencyKey ?? "",
        status: r.status as CreditTransaction["status"],
        created_at: r.createdAt,
      }));

      const body: ApiResponse<CreditTransaction[]> = {
        success: true,
        data: transactions,
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
