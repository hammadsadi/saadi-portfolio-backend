import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { createProjectSchema, updateProjectSchema } from './project.validation.js';
import { reorderBodySchema } from '@/utils/reorder.js';
import {
  getProjectsPublicHandler,
  getProjectBySlugHandler,
  getProjectsAdminHandler,
  getProjectByIdHandler,
  createProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
  toggleProjectStatusHandler,
  reorderProjectsHandler,
} from './project.controller.js';

const router: IRouter = Router();

// Admin routes registered before /:slug to prevent 'admin' matching the slug param
router.get('/admin', authenticate, authorize('admin'), getProjectsAdminHandler);
router.post('/admin', authenticate, authorize('admin'), validateRequest(createProjectSchema), createProjectHandler);
router.put('/admin/reorder', authenticate, authorize('admin'), validateRequest(reorderBodySchema), reorderProjectsHandler);
router.get('/admin/:id', authenticate, authorize('admin'), getProjectByIdHandler);
router.patch('/admin/:id', authenticate, authorize('admin'), validateRequest(updateProjectSchema), updateProjectHandler);
router.patch('/admin/:id/status', authenticate, authorize('admin'), toggleProjectStatusHandler);
router.delete('/admin/:id', authenticate, authorize('admin'), deleteProjectHandler);

// Public (after admin routes)
router.get('/', getProjectsPublicHandler);
router.get('/:slug', getProjectBySlugHandler);

export default router;
