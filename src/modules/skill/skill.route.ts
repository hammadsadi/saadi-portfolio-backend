import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { createSkillSchema, updateSkillSchema } from './skill.validation.js';
import { reorderBodySchema } from '@/utils/reorder.js';
import {
  getSkillsPublicHandler,
  getSkillsAdminHandler,
  getSkillByIdHandler,
  createSkillHandler,
  updateSkillHandler,
  deleteSkillHandler,
  toggleSkillVisibilityHandler,
  reorderSkillsHandler,
} from './skill.controller.js';

const router: IRouter = Router();

// Public
router.get('/', getSkillsPublicHandler);

// Admin — specific paths before parameterised routes
router.get('/admin', authenticate, authorize('admin'), getSkillsAdminHandler);
router.post('/admin', authenticate, authorize('admin'), validateRequest(createSkillSchema), createSkillHandler);
router.put('/admin/reorder', authenticate, authorize('admin'), validateRequest(reorderBodySchema), reorderSkillsHandler);
router.get('/admin/:id', authenticate, authorize('admin'), getSkillByIdHandler);
router.patch('/admin/:id', authenticate, authorize('admin'), validateRequest(updateSkillSchema), updateSkillHandler);
router.patch('/admin/:id/visibility', authenticate, authorize('admin'), toggleSkillVisibilityHandler);
router.delete('/admin/:id', authenticate, authorize('admin'), deleteSkillHandler);

export default router;
