import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import {
  createContactSchema,
  adminReplySchema,
  adminUpdateContactStatusSchema,
} from './contact.validation.js';
import { contactRateLimiter } from '@/middlewares/rateLimiter.js';
import {
  createContactHandler,
  listUserContactsHandler,
  adminListContactsHandler,
  adminUpdateContactStatusHandler,
  adminReplyHandler,
} from './contact.controller.js';

const router: IRouter = Router();

// Admin routes BEFORE /:id to avoid ambiguity
router.get('/admin', authenticate, authorize('admin'), adminListContactsHandler);
router.patch(
  '/admin/:id/status',
  authenticate,
  authorize('admin'),
  validateRequest(adminUpdateContactStatusSchema),
  adminUpdateContactStatusHandler,
);
router.post(
  '/admin/:id/reply',
  authenticate,
  authorize('admin'),
  validateRequest(adminReplySchema),
  adminReplyHandler,
);

// User routes (authenticated)
router.get('/', authenticate, listUserContactsHandler);
router.post(
  '/',
  authenticate,
  contactRateLimiter,
  validateRequest(createContactSchema),
  createContactHandler,
);

export default router;
