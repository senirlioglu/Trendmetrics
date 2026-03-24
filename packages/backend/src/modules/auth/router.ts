import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import type { ApiResponse, UserProfile } from "@trendmetrics/shared";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { sessionRequestSchema } from "../../utils/validation.js";
import { config } from "../../config/index.js";
import { logger } from "../../config/logger.js";
import { generateId } from "../../utils/helpers.js";

// ---------------------------------------------------------------------------
// Lightweight Firebase token verifier stub.
// In production this calls firebase-admin; here we keep the import lazy so
// the rest of the app can start even if credentials are missing.
// ---------------------------------------------------------------------------

async function verifyFirebaseToken(
  token: string,
): Promise<{ uid: string; email: string; name?: string; picture?: string }> {
  // Dynamic import so we don't blow up if firebase-admin is not initialised yet.
  const admin = await import("firebase-admin");

  if (admin.default.apps.length === 0) {
    admin.default.initializeApp({
      credential: admin.default.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
    });
  }

  const decoded = await admin.default.auth().verifyIdToken(token);

  return {
    uid: decoded.uid,
    email: decoded.email ?? "",
    name: decoded.name as string | undefined,
    picture: decoded.picture as string | undefined,
  };
}

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/auth/session
// Body: { firebase_token }
// Verifies Firebase token, ensures user in DB, returns profile + balance
// ---------------------------------------------------------------------------

router.post(
  "/session",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = sessionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        const body: ApiResponse<null> = {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        };
        res.status(400).json(body);
        return;
      }

      const { firebase_token } = parsed.data;

      const fbUser = await verifyFirebaseToken(firebase_token);

      // Upsert user
      let [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.firebaseUid, fbUser.uid))
        .limit(1);

      if (!user) {
        const userId = generateId();
        const [inserted] = await db
          .insert(schema.users)
          .values({
            id: userId,
            firebaseUid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.name ?? null,
            photoUrl: fbUser.picture ?? null,
          })
          .returning();

        user = inserted!;

        // Create balance record with signup bonus
        await db.insert(schema.userBalances).values({
          userId,
          balance: String(config.credits.signupBonus),
        });

        // Record signup bonus transaction
        await db.insert(schema.creditTransactions).values({
          userId,
          type: "signup_bonus",
          amount: String(config.credits.signupBonus),
          balanceAfter: String(config.credits.signupBonus),
          description: "Welcome bonus",
          status: "completed",
        });

        logger.info("New user created", { userId, firebaseUid: fbUser.uid });
      } else {
        // Bump updated_at
        await db
          .update(schema.users)
          .set({ updatedAt: new Date() })
          .where(eq(schema.users.id, user.id));
      }

      // Fetch balance
      const [balanceRow] = await db
        .select()
        .from(schema.userBalances)
        .where(eq(schema.userBalances.userId, user.id))
        .limit(1);

      const profile: UserProfile = {
        uid: user.id,
        email: user.email,
        display_name: user.displayName ?? "",
        photo_url: user.photoUrl ?? "",
        balance: balanceRow ? Number(balanceRow.balance) : 0,
        created_at: user.createdAt,
        last_login: user.updatedAt,
      };

      const body: ApiResponse<UserProfile> = { success: true, data: profile };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/auth/me
// Requires x-user-id header (set by upstream auth middleware).
// ---------------------------------------------------------------------------

router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!userId) {
      const body: ApiResponse<null> = {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing authentication" },
      };
      res.status(401).json(body);
      return;
    }

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      const body: ApiResponse<null> = {
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      };
      res.status(404).json(body);
      return;
    }

    const [balanceRow] = await db
      .select()
      .from(schema.userBalances)
      .where(eq(schema.userBalances.userId, user.id))
      .limit(1);

    const profile: UserProfile = {
      uid: user.id,
      email: user.email,
      display_name: user.displayName ?? "",
      photo_url: user.photoUrl ?? "",
      balance: balanceRow ? Number(balanceRow.balance) : 0,
      created_at: user.createdAt,
      last_login: user.updatedAt,
    };

    const body: ApiResponse<UserProfile> = { success: true, data: profile };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

export default router;
