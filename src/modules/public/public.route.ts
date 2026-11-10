import { Router } from 'express';
import type { IRouter } from 'express';
import { getHomeHandler } from './public.controller.js';

const router: IRouter = Router();

router.get('/home', getHomeHandler);

export default router;
