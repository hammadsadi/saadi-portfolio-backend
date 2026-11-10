import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize, optionalAuth } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import {
  updateProfileSchema,
  adminUpdateUserSchema,
  changeRoleSchema,
  changePasswordSchema,
  setPasswordSchema,
  deleteAccountSchema,
} from './user.validation.js';
import { followRateLimiter, sensitiveRateLimiter } from '@/middlewares/rateLimiter.js';
import {
  listUsersHandler,
  getUserByIdentifierHandler,
  getUserPostsHandler,
  adminUpdateUserHandler,
  adminDeleteUserHandler,
  updateProfileHandler,
  deleteAccountHandler,
  blockUserHandler,
  unblockUserHandler,
  changeRoleHandler,
  changePasswordHandler,
  requestSetPasswordHandler,
  setPasswordHandler,
  requestDeleteAccountOtpHandler,
} from './user.controller.js';
import {
  followUserHandler,
  unfollowUserHandler,
  listFollowersHandler,
  listFollowingHandler,
  suggestionsHandler,
} from '@/modules/follow/follow.controller.js';
import { userAnalyticsHandler } from '@/modules/view/view.controller.js';

const router: IRouter = Router();

// ─── /me routes — must come before /:identifier ───────────────────────────────
router.patch('/me', authenticate, validateRequest(updateProfileSchema), updateProfileHandler);
router.delete('/me', authenticate, validateRequest(deleteAccountSchema), deleteAccountHandler);
router.get('/me/analytics', authenticate, userAnalyticsHandler);
router.post('/me/change-password', authenticate, sensitiveRateLimiter, validateRequest(changePasswordSchema), changePasswordHandler);
router.post('/me/set-password/request', authenticate, sensitiveRateLimiter, requestSetPasswordHandler);
router.post('/me/set-password', authenticate, sensitiveRateLimiter, validateRequest(setPasswordSchema), setPasswordHandler);
router.post('/me/delete-account/request-otp', authenticate, sensitiveRateLimiter, requestDeleteAccountOtpHandler);

// ─── Static paths before /:identifier ─────────────────────────────────────────
router.get('/suggestions', optionalAuth, suggestionsHandler);
router.get('/', authenticate, authorize('admin'), listUsersHandler);

// ─── Admin routes with parameterized :id — must use authenticate+authorize ────
// (These come BEFORE the optionalAuth /:identifier route so admin access is handled
// by the correct middleware chain.)
router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validateRequest(adminUpdateUserSchema),
  adminUpdateUserHandler,
);
router.delete('/:id', authenticate, authorize('admin'), adminDeleteUserHandler);
router.patch('/:id/block', authenticate, authorize('admin'), blockUserHandler);
router.patch('/:id/unblock', authenticate, authorize('admin'), unblockUserHandler);
router.patch(
  '/:id/role',
  authenticate,
  authorize('admin'),
  validateRequest(changeRoleSchema),
  changeRoleHandler,
);

// ─── Follow operations ────────────────────────────────────────────────────────
router.post('/:userId/follow', authenticate, followRateLimiter, followUserHandler);
router.delete('/:userId/follow', authenticate, followRateLimiter, unfollowUserHandler);
router.get('/:userId/followers', optionalAuth, listFollowersHandler);
router.get('/:userId/following', optionalAuth, listFollowingHandler);

// ─── Public profile by username (or admin detail by ObjectId) ─────────────────
// NOTE: This comes AFTER all PATCH/DELETE /:id routes (different HTTP methods, no conflict).
// The GET /:id admin route is intentionally merged here: the handler checks for admin+ObjectId.
router.get('/:identifier', optionalAuth, getUserByIdentifierHandler);

// ─── Posts by username ────────────────────────────────────────────────────────
router.get('/:username/posts', optionalAuth, getUserPostsHandler);

export default router;
