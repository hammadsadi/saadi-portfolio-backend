import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, optionalAuth } from '@/middlewares/authenticate.js';
import { followingFeedHandler, trendingFeedHandler } from './feed.controller.js';

const router: IRouter = Router();

router.get('/following', authenticate, followingFeedHandler);
router.get('/trending', optionalAuth, trendingFeedHandler);

export default router;
