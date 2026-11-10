import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { createCategorySchema, updateCategorySchema } from './category.validation.js';
import {
  listCategoriesHandler,
  upsertCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} from './category.controller.js';

const router: IRouter = Router();

// Admin routes BEFORE /:slug to prevent 'admin' matching the slug param
router.post('/admin', authenticate, authorize('admin'), validateRequest(createCategorySchema), upsertCategoryHandler);
router.patch('/admin/:slug', authenticate, authorize('admin'), validateRequest(updateCategorySchema), updateCategoryHandler);
router.delete('/admin/:slug', authenticate, authorize('admin'), deleteCategoryHandler);

// Public
router.get('/', listCategoriesHandler);

export default router;
