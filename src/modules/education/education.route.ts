import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { createEducationSchema, updateEducationSchema } from './education.validation.js';
import { reorderBodySchema } from '@/utils/reorder.js';
import {
  getEducationPublicHandler,
  getEducationAdminHandler,
  getEducationByIdHandler,
  createEducationHandler,
  updateEducationHandler,
  deleteEducationHandler,
  reorderEducationHandler,
} from './education.controller.js';

const router: IRouter = Router();

router.get('/', getEducationPublicHandler);

router.get('/admin', authenticate, authorize('admin'), getEducationAdminHandler);
router.post('/admin', authenticate, authorize('admin'), validateRequest(createEducationSchema), createEducationHandler);
router.put('/admin/reorder', authenticate, authorize('admin'), validateRequest(reorderBodySchema), reorderEducationHandler);
router.get('/admin/:id', authenticate, authorize('admin'), getEducationByIdHandler);
router.patch('/admin/:id', authenticate, authorize('admin'), validateRequest(updateEducationSchema), updateEducationHandler);
router.delete('/admin/:id', authenticate, authorize('admin'), deleteEducationHandler);

export default router;
