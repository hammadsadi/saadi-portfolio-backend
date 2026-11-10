import { Types } from 'mongoose';
import type { Request, Response, RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getSuggestions,
} from './follow.service.js';

function parseUserId(raw: string): Types.ObjectId {
  return new Types.ObjectId(raw);
}

function parseLimit(raw: unknown, max: number, def: number): number {
  return Math.min(max, Math.max(1, Number(raw) || def));
}

// POST /users/:userId/follow  (authenticated)
export const followUserHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { userId } = req.params as { userId: string };
    const data = await followUser(req.user._id, parseUserId(userId));
    sendResponse(res, { message: 'Followed', data });
  },
);

// DELETE /users/:userId/follow  (authenticated)
export const unfollowUserHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { userId } = req.params as { userId: string };
    const data = await unfollowUser(req.user._id, parseUserId(userId));
    sendResponse(res, { message: 'Unfollowed', data });
  },
);

// GET /users/:userId/followers  (optionalAuth)
export const listFollowersHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params as { userId: string };
    const limit = parseLimit(req.query.limit, 50, 20);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const { items, meta } = await getFollowers(parseUserId(userId), cursor, limit, req.user?._id);
    sendResponse(res, { message: 'Followers retrieved', data: items, meta: { ...meta } });
  },
);

// GET /users/:userId/following  (optionalAuth)
export const listFollowingHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params as { userId: string };
    const limit = parseLimit(req.query.limit, 50, 20);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const { items, meta } = await getFollowing(parseUserId(userId), cursor, limit, req.user?._id);
    sendResponse(res, { message: 'Following retrieved', data: items, meta: { ...meta } });
  },
);

// GET /users/suggestions  (optionalAuth)
export const suggestionsHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      sendResponse(res, { message: 'Suggestions retrieved', data: [] });
      return;
    }
    const limit = parseLimit(req.query.limit, 20, 10);
    const suggestions = await getSuggestions(req.user._id, limit);
    sendResponse(res, { message: 'Suggestions retrieved', data: suggestions });
  },
);
