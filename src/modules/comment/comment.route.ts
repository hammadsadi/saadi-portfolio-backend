import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize, optionalAuth } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { commentRateLimiter } from '@/middlewares/rateLimiter.js';
import {
  createCommentSchema,
  updateCommentSchema,
  listCommentsQuerySchema,
  listRepliesQuerySchema,
} from './comment.validation.js';
import {
  listCommentsHandler,
  listRepliesHandler,
  createCommentHandler,
  updateCommentHandler,
  deleteCommentHandler,
  adminListCommentsHandler,
  adminHardDeleteCommentHandler,
} from './comment.controller.js';

const router: IRouter = Router();

// Admin routes BEFORE /:commentId to prevent 'admin' matching the param
router.get('/admin', authenticate, authorize('admin'), adminListCommentsHandler);
router.delete('/admin/:commentId', authenticate, authorize('admin'), adminHardDeleteCommentHandler);

// Public read + optionalAuth for likedByMe
router.get('/', optionalAuth, validateRequest(listCommentsQuerySchema, 'query'), listCommentsHandler);
router.get('/:commentId/replies', optionalAuth, validateRequest(listRepliesQuerySchema, 'query'), listRepliesHandler);

// Authenticated write operations
router.post('/', authenticate, commentRateLimiter, validateRequest(createCommentSchema), createCommentHandler);
router.patch('/:commentId', authenticate, validateRequest(updateCommentSchema), updateCommentHandler);
router.delete('/:commentId', authenticate, deleteCommentHandler);

export default router;
