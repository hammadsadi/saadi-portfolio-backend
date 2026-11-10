import { Router } from 'express';
import type { IRouter } from 'express';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { adminStatsHandler, userStatsHandler } from './dashboard.controller.js';

const router: IRouter = Router();

router.get('/admin/stats', authenticate, authorize('admin'), adminStatsHandler);
router.get('/user/stats', authenticate, userStatsHandler);

export default router;
