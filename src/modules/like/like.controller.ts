import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import { toggleLike, getLikeStatus, validateTarget } from './like.service.js';
import type { ToggleLikeInput, LikeStatusQuery } from './like.validation.js';

export const toggleLikeHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const { targetType, targetId } = req.body as ToggleLikeInput;
  await validateTarget(targetType, targetId);
  const result = await toggleLike(req.user._id, targetType, targetId);
  sendResponse(res, { message: result.liked ? 'Liked' : 'Unliked', data: result });
});

export const getLikeStatusHandler: RequestHandler = catchAsync(async (req, res) => {
  const { targetType, targetId } = req.query as unknown as LikeStatusQuery;
  const result = await getLikeStatus(req.user?._id, targetType, targetId);
  sendResponse(res, { message: 'Like status retrieved', data: result });
});
