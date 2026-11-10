import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize, optionalAuth, requireVerifiedEmail } from '@/middlewares/authenticate.js';
import { postAnalyticsHandler } from '@/modules/view/view.controller.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import {
  createPostSchema,
  updatePostSchema,
  publishPostSchema,
  schedulePostSchema,
  userCreatePostSchema,
  userUpdatePostSchema,
  rejectPostSchema,
} from './post.validation.js';
import {
  listPostsPublicHandler,
  listPostsAdminHandler,
  getPostBySlugHandler,
  getRelatedPostsHandler,
  getPostByIdAdminHandler,
  createPostHandler,
  updatePostHandler,
  deletePostHandler,
  publishPostHandler,
  unpublishPostHandler,
  schedulePostHandler,
  getRssFeedHandler,
  listOwnPostsHandler,
  createOwnPostHandler,
  updateOwnPostHandler,
  deleteOwnPostHandler,
  approvePostHandler,
  rejectPostHandler,
} from './post.controller.js';

const router: IRouter = Router();

// User authoring routes — BEFORE /admin and /:slug to avoid shadowing
router.get('/my', authenticate, requireVerifiedEmail, listOwnPostsHandler);
router.post('/my', authenticate, requireVerifiedEmail, validateRequest(userCreatePostSchema), createOwnPostHandler);
router.patch('/my/:id', authenticate, requireVerifiedEmail, validateRequest(userUpdatePostSchema), updateOwnPostHandler);
router.delete('/my/:id', authenticate, requireVerifiedEmail, deleteOwnPostHandler);

// Admin static routes BEFORE parameterized routes
router.get('/admin', authenticate, authorize('admin'), listPostsAdminHandler);
router.post('/admin', authenticate, authorize('admin'), validateRequest(createPostSchema), createPostHandler);
router.get('/admin/:id', authenticate, authorize('admin'), getPostByIdAdminHandler);
router.patch('/admin/:id', authenticate, authorize('admin'), validateRequest(updatePostSchema), updatePostHandler);
router.delete('/admin/:id', authenticate, authorize('admin'), deletePostHandler);
router.patch('/admin/:id/publish', authenticate, authorize('admin'), validateRequest(publishPostSchema), publishPostHandler);
router.patch('/admin/:id/unpublish', authenticate, authorize('admin'), unpublishPostHandler);
router.patch('/admin/:id/schedule', authenticate, authorize('admin'), validateRequest(schedulePostSchema), schedulePostHandler);
router.patch('/admin/:id/approve', authenticate, authorize('admin'), approvePostHandler);
router.patch('/admin/:id/reject', authenticate, authorize('admin'), validateRequest(rejectPostSchema), rejectPostHandler);

// Public static routes BEFORE /:slug
router.get('/feed', getRssFeedHandler);

// Authenticated: post analytics (owner or admin)
router.get('/:id/analytics', authenticate, postAnalyticsHandler);

// Public
router.get('/', optionalAuth, listPostsPublicHandler);
router.get('/:slug', optionalAuth, getPostBySlugHandler);
router.get('/:slug/related', getRelatedPostsHandler);

export default router;
