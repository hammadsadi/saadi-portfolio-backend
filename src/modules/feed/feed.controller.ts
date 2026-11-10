import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import { getFollowingFeed, getTrendingFeed } from './feed.service.js';
import type { TrendingRange } from './feed.types.js';

function parseCursorParams(req: { query: Record<string, unknown> }): {
  cursor: string | undefined;
  limit: number;
} {
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const raw = typeof req.query.limit === 'string' ? Number(req.query.limit) : NaN;
  const limit = isNaN(raw) ? 20 : Math.min(50, Math.max(1, raw));
  return { cursor, limit };
}

const VALID_RANGES = new Set<TrendingRange>(['24h', '7d', '30d']);

function parseTrendingRange(raw: unknown): TrendingRange | undefined {
  if (typeof raw === 'string' && VALID_RANGES.has(raw as TrendingRange)) {
    return raw as TrendingRange;
  }
  return undefined;
}

export const followingFeedHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const { cursor, limit } = parseCursorParams(req);
  const result = await getFollowingFeed(req.user._id, cursor, limit);
  sendResponse(res, {
    message: 'Following feed retrieved',
    data: result.items,
    meta: { ...result.meta, followsNobody: result.followsNobody },
  });
});

export const trendingFeedHandler: RequestHandler = catchAsync(async (req, res) => {
  const { cursor, limit } = parseCursorParams(req);
  const range = parseTrendingRange(req.query.range);
  const result = await getTrendingFeed(cursor, limit, range, req.user?._id);
  sendResponse(res, {
    message: 'Trending feed retrieved',
    data: result.items,
    meta: { ...result.meta },
  });
});
