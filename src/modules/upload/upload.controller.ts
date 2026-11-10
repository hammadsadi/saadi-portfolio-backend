import type { Request, Response, RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import { uploadFile, deleteFile } from './upload.service.js';

const ALLOWED_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2 MB

// POST /upload  (admin)
export const uploadFileHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) throw new AppError('No file uploaded', 400);
    if (!ALLOWED_MIMETYPES.has(req.file.mimetype)) {
      throw new AppError('File type not allowed. Use JPEG, PNG, WebP, GIF, or SVG.', 400);
    }
    if (req.file.size > MAX_SIZE) {
      throw new AppError('File too large. Maximum 5 MB.', 400);
    }

    const result = await uploadFile(req.file.buffer, { folder: 'portfolio' });
    sendResponse(res, { statusCode: 201, message: 'File uploaded', data: result });
  },
);

// POST /upload/avatar  (authenticated)
export const uploadAvatarHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    if (!req.file) throw new AppError('No file uploaded', 400);

    const avatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!avatarTypes.has(req.file.mimetype)) {
      throw new AppError('File type not allowed. Use JPEG, PNG, or WebP.', 400);
    }
    if (req.file.size > AVATAR_MAX_SIZE) {
      throw new AppError('File too large. Maximum 2 MB.', 400);
    }

    const result = await uploadFile(req.file.buffer, {
      folder: 'portfolio/avatars',
      publicId: `avatar_${String(req.user._id)}`,
    });
    sendResponse(res, { statusCode: 201, message: 'Avatar uploaded', data: result });
  },
);

// DELETE /upload  (admin)
export const deleteFileHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { publicId } = req.body as { publicId?: unknown };
    if (typeof publicId !== 'string' || !publicId) {
      throw new AppError('publicId is required', 400);
    }
    await deleteFile(publicId);
    sendResponse(res, { message: 'File deleted' });
  },
);
