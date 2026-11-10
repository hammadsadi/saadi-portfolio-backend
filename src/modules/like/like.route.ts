import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, optionalAuth } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { toggleLikeSchema, likeStatusQuerySchema } from './like.validation.js';
import { toggleLikeHandler, getLikeStatusHandler } from './like.controller.js';

const router: IRouter = Router();

router.post('/toggle', authenticate, validateRequest(toggleLikeSchema), toggleLikeHandler);
router.get('/status', optionalAuth, validateRequest(likeStatusQuerySchema, 'query'), getLikeStatusHandler);

export default router;
