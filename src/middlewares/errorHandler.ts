import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import multer from 'multer';
import { AppError } from '@/utils/AppError.js';
import { env } from '@/config/env.js';

interface MongoServerError {
  code: number;
  keyValue?: Record<string, unknown>;
}

function isMongoServerError(err: unknown): err is MongoServerError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as MongoServerError).code === 'number'
  );
}

// Type predicate — after this guard passes, err is narrowed to { name: string }
function isJwtError(err: unknown): err is { name: string } {
  if (typeof err !== 'object' || err === null || !('name' in err)) return false;
  const name = String(err.name);
  return name === 'JsonWebTokenError' || name === 'TokenExpiredError' || name === 'NotBeforeError';
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code && { code: err.code }),
    });
    return;
  }

  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.length > 0 ? issue.path.join('.') : '_errors';
      (errors[key] ??= []).push(issue.message);
    }
    res.status(400).json({ success: false, message: 'Validation failed', errors });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    res.status(400).json({ success: false, message });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ success: false, message: `Invalid value for field '${err.path}'` });
    return;
  }

  if (isMongoServerError(err) && err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    res.status(409).json({ success: false, message: `'${field}' already exists` });
    return;
  }

  if (isJwtError(err)) {
    // err is narrowed to { name: string } by the type predicate above
    const message = err.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token';
    res.status(401).json({ success: false, message });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    res.status(400).json({ success: false, message });
    return;
  }

  console.error('Unhandled error:', err);
  const message =
    env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Unknown error';

  res.status(500).json({ success: false, message });
}
