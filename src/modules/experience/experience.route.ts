import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { createExperienceSchema, updateExperienceSchema } from './experience.validation.js';
import { reorderBodySchema } from '@/utils/reorder.js';
import {
  getExperiencesPublicHandler,
  getExperiencesAdminHandler,
  getExperienceByIdHandler,
  createExperienceHandler,
  updateExperienceHandler,
  deleteExperienceHandler,
  reorderExperiencesHandler,
} from './experience.controller.js';

const router: IRouter = Router();

router.get('/', getExperiencesPublicHandler);

router.get('/admin', authenticate, authorize('admin'), getExperiencesAdminHandler);
router.post('/admin', authenticate, authorize('admin'), validateRequest(createExperienceSchema), createExperienceHandler);
router.put('/admin/reorder', authenticate, authorize('admin'), validateRequest(reorderBodySchema), reorderExperiencesHandler);
router.get('/admin/:id', authenticate, authorize('admin'), getExperienceByIdHandler);
router.patch('/admin/:id', authenticate, authorize('admin'), validateRequest(updateExperienceSchema), updateExperienceHandler);
router.delete('/admin/:id', authenticate, authorize('admin'), deleteExperienceHandler);

export default router;
