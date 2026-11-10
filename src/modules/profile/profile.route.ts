import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { upsertProfileSchema } from './profile.validation.js';
import {
  getProfilePublicHandler,
  getProfileAdminHandler,
  upsertProfileHandler,
} from './profile.controller.js';

const router: IRouter = Router();

router.get('/', getProfilePublicHandler);
router.get('/admin', authenticate, authorize('admin'), getProfileAdminHandler);
router.put('/admin', authenticate, authorize('admin'), validateRequest(upsertProfileSchema), upsertProfileHandler);

export default router;
