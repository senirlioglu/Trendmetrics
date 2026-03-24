import type { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { AppError } from "./errorHandler.js";

// Initialize Firebase Admin SDK (idempotent)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    }),
  });
}

export interface AuthUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
}

/**
 * Optional auth middleware: extracts and verifies Firebase token if present.
 * Attaches user to req.user but does not reject unauthenticated requests.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      displayName: decoded.name,
      photoUrl: decoded.picture,
    };
  } catch (err) {
    logger.warn("Invalid Firebase token", {
      error: (err as Error).message,
      ip: req.ip,
    });
  }

  next();
}

/**
 * Strict auth middleware: rejects unauthenticated requests with 401.
 * Must be used after authMiddleware or on its own.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    return;
  }

  if (!req.user) {
    const token = authHeader.slice(7);
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        displayName: decoded.name,
        photoUrl: decoded.picture,
      };
    } catch (err) {
      next(
        new AppError(401, "INVALID_TOKEN", `Invalid or expired authentication token: ${(err as Error).message}`),
      );
      return;
    }
  }

  next();
}
