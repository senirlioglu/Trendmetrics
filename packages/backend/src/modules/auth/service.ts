'use strict';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { eq } from 'drizzle-orm';
import type { UserProfile } from '@trendmetrics/shared';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../config/logger.js';
import { CreditService } from '../credit/service.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createChildLogger({ module: 'auth-service' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerifiedToken {
  uid: string;
  email: string;
  name: string;
  picture: string;
}

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

export class AuthService {
  private readonly creditService: CreditService;

  constructor(creditService: CreditService) {
    this.creditService = creditService;
    this.initializeFirebase();
  }

  // ---------------------------------------------------------------------------
  // Firebase Initialization
  // ---------------------------------------------------------------------------

  private initializeFirebase(): void {
    if (getApps().length > 0) return;

    try {
      initializeApp({
        credential: cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
      });
      logger.info('Firebase Admin initialized');
    } catch (err: unknown) {
      logger.warn('Firebase Admin initialization failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Token Verification
  // ---------------------------------------------------------------------------

  async verifyToken(token: string): Promise<VerifiedToken> {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email ?? '',
        name: decoded.name ?? decoded.email ?? 'User',
        picture: decoded.picture ?? '',
      };
    } catch (err: unknown) {
      logger.warn('Token verification failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw new Error('Invalid or expired authentication token');
    }
  }

  // ---------------------------------------------------------------------------
  // User Upsert
  // ---------------------------------------------------------------------------

  async ensureUser(
    uid: string,
    email: string,
    name: string,
    picture: string,
  ): Promise<UserProfile> {
    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, uid))
      .limit(1);

    let userId: string;
    let createdAt: Date;

    if (existing.length > 0) {
      const user = existing[0]!;
      userId = user.id;
      createdAt = user.createdAt;

      // Update profile fields on each login
      await db
        .update(users)
        .set({
          displayName: name,
          photoUrl: picture,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      logger.debug('User profile updated on login', { userId, email });
    } else {
      userId = uuidv4();
      createdAt = new Date();

      await db.insert(users).values({
        id: userId,
        firebaseUid: uid,
        email,
        displayName: name,
        photoUrl: picture,
        createdAt,
        updatedAt: createdAt,
      });

      logger.info('New user created', { userId, email });
    }

    // Ensure balance record exists (with signup bonus for new users)
    await this.creditService.ensureUserBalance(userId);

    const balance = await this.creditService.getBalance(userId);

    return {
      uid: userId,
      email,
      display_name: name,
      photo_url: picture,
      balance,
      created_at: createdAt,
      last_login: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Get User Profile
  // ---------------------------------------------------------------------------

  async getUserProfile(firebaseUid: string): Promise<UserProfile | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    if (result.length === 0) return null;

    const user = result[0]!;
    const balance = await this.creditService.getBalance(user.id);

    return {
      uid: user.id,
      email: user.email,
      display_name: user.displayName ?? '',
      photo_url: user.photoUrl ?? '',
      balance,
      created_at: user.createdAt,
      last_login: user.updatedAt,
    };
  }
}
