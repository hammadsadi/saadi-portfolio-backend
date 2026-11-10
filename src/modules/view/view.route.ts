import { Router } from 'express';
import type { IRouter } from 'express';
import { optionalAuth } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { viewRateLimiter } from '@/middlewares/rateLimiter.js';
import { recordViewSchema } from './view.validation.js';
import { recordViewHandler } from './view.controller.js';

const router: IRouter = Router();

router.post('/', optionalAuth, viewRateLimiter, validateRequest(recordViewSchema), recordViewHandler);

export default router;
