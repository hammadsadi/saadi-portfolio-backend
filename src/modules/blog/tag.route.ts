import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { createTagSchema, updateTagSchema } from './tag.validation.js';
import {
  listTagsHandler,
  upsertTagHandler,
  updateTagHandler,
  deleteTagHandler,
} from './tag.controller.js';

const router: IRouter = Router();

// Admin routes BEFORE /:slug to prevent 'admin' matching the slug param
router.post('/admin', authenticate, authorize('admin'), validateRequest(createTagSchema), upsertTagHandler);
router.patch('/admin/:slug', authenticate, authorize('admin'), validateRequest(updateTagSchema), updateTagHandler);
router.delete('/admin/:slug', authenticate, authorize('admin'), deleteTagHandler);

// Public
router.get('/', listTagsHandler);

export default router;
