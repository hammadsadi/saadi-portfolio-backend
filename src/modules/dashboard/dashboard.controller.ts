import type { Request, Response, RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import { getAdminStats, getUserStats } from './dashboard.service.js';

// GET /dashboard/admin/stats  (admin)
export const adminStatsHandler: RequestHandler = catchAsync(
  async (_req: Request, res: Response): Promise<void> => {
    const stats = await getAdminStats();
    sendResponse(res, { message: 'Admin stats retrieved', data: stats });
  },
);

// GET /dashboard/user/stats  (authenticated)
export const userStatsHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const stats = await getUserStats(req.user._id);
    sendResponse(res, { message: 'User stats retrieved', data: stats });
  },
);
