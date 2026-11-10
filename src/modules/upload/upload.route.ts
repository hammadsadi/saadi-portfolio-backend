import { Router } from 'express';
import type { IRouter } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '@/middlewares/authenticate.js';
import { uploadFileHandler, uploadAvatarHandler, deleteFileHandler } from './upload.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router: IRouter = Router();

router.post('/', authenticate, authorize('admin'), upload.single('file'), uploadFileHandler);
router.post('/avatar', authenticate, upload.single('avatar'), uploadAvatarHandler);
router.delete('/', authenticate, authorize('admin'), deleteFileHandler);

export default router;
