import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message);
    this.details = details;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(404, "NOT_FOUND", msg);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(required: number, available: number) {
    super(
      402,
      "INSUFFICIENT_CREDITS",
      `Insufficient credits: ${available} available, ${required} required`,
    );
    Object.setPrototypeOf(this, InsufficientCreditsError.prototype);
  }
}

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: ErrorResponseBody = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (err instanceof ValidationError && err.details) {
      body.error.details = err.details;
    }

    if (err.statusCode >= 500) {
      logger.error("Operational server error", {
        code: err.code,
        message: err.message,
        path: req.path,
        method: req.method,
        stack: err.stack,
      });
    } else {
      logger.warn("Client error", {
        code: err.code,
        statusCode: err.statusCode,
        message: err.message,
        path: req.path,
        method: req.method,
      });
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // Unexpected error - do not leak internal details
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
}

/**
 * Catch-all for routes that don't match any handler.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
}
