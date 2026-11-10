import { Router } from 'express';
import type { IRouter, Request, Response, NextFunction } from 'express';
import { env } from '@/config/env.js';
import { AppError } from '@/utils/AppError.js';
import {
  recomputeTrendingScoresHandler,
  publishScheduledPostsHandler,
} from '@/modules/blog/post.controller.js';

const router: IRouter = Router();

// Vercel Cron Jobs attach `Authorization: Bearer {CRON_SECRET}` automatically
// when CRON_SECRET is set in the project environment variables.
function cronGuard(req: Request, _res: Response, next: NextFunction): void {
  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    next(new AppError('Unauthorized', 401));
    return;
  }
  next();
}

// Vercel Cron Jobs send GET requests.
router.get('/cron/trending', cronGuard, recomputeTrendingScoresHandler);

// Triggered manually (not a Vercel cron) — publish posts whose scheduledAt has passed.
// Call via: POST /api/v1/internal/cron/publish-scheduled  Authorization: Bearer {CRON_SECRET}
router.post('/cron/publish-scheduled', cronGuard, publishScheduledPostsHandler);

export default router;
