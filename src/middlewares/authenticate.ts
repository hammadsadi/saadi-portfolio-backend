import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { UserModel } from '@/modules/user/user.model.js';
import { AppError } from '@/utils/AppError.js';
import { verifyAccessToken } from '@/modules/auth/auth.service.js';
import type { UserRole } from '@/modules/user/user.types.js';

/** Requires a valid access-token cookie. Populates `req.user`. */
export const authenticate: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = req.cookies.accessToken as unknown;
    if (typeof token !== 'string') throw new AppError('Authentication required', 401);

    const { userId } = verifyAccessToken(token);
    const user = await UserModel.findById(userId);

    if (!user) throw new AppError('Authentication required', 401);
    if (user.isBlocked) throw new AppError('Account is blocked', 403);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/** Gate on one or more roles. Must be used after `authenticate`. */
export function authorize(...roles: UserRole[]): RequestHandler {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    if (!_req.user || !roles.includes(_req.user.role)) {
      next(new AppError('You do not have permission to perform this action', 403));
      return;
    }
    next();
  };
}

/** Rejects if the authenticated user has not verified their email. Must follow `authenticate`. */
export const requireVerifiedEmail: RequestHandler = (_req, _res, next): void => {
  if (!_req.user?.isEmailVerified) {
    next(new AppError('Email verification required', 403));
    return;
  }
  next();
};

/** Populates `req.user` when a valid token is present, but never rejects. */
export const optionalAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = req.cookies.accessToken as unknown;
    if (typeof token !== 'string') {
      next();
      return;
    }

    const { userId } = verifyAccessToken(token);
    const user = await UserModel.findById(userId);
    if (user && !user.isBlocked) req.user = user;
  } catch {
    // Invalid or expired token is fine for optional auth — just skip
  }
  next();
};
