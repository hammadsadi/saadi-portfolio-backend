import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { upsertSiteSettingsSchema, patchSiteSettingsSchema } from './siteSettings.validation.js';
import {
  getSiteSettingsPublicHandler,
  getSiteSettingsAdminHandler,
  upsertSiteSettingsHandler,
  patchSiteSettingsHandler,
} from './siteSettings.controller.js';

const router: IRouter = Router();

router.get('/', getSiteSettingsPublicHandler);
router.get('/admin', authenticate, authorize('admin'), getSiteSettingsAdminHandler);
router.put('/admin', authenticate, authorize('admin'), validateRequest(upsertSiteSettingsSchema), upsertSiteSettingsHandler);
router.patch('/admin', authenticate, authorize('admin'), validateRequest(patchSiteSettingsSchema), patchSiteSettingsHandler);

export default router;
