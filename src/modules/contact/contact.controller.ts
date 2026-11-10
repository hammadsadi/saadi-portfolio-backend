import type { Request, Response, RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import {
  createContact,
  listUserContacts,
  adminListContacts,
  adminUpdateContactStatus,
  adminReplyToContact,
} from './contact.service.js';
import type { ContactStatus } from './contact.types.js';

// POST /contacts  (authenticated)
export const createContactHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { subject, message } = req.body as { subject: string; message: string };
    const contact = await createContact(req.user._id, req.user.email, req.user.name, {
      subject,
      message,
    });
    sendResponse(res, { statusCode: 201, message: 'Message sent', data: contact });
  },
);

// GET /contacts  (authenticated — own messages)
export const listUserContactsHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const { items, meta } = await listUserContacts(req.user._id, page, limit);
    sendResponse(res, { message: 'Messages retrieved', data: items, meta: { ...meta } });
  },
);

// GET /contacts/admin  (admin)
export const adminListContactsHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const rawStatus = req.query.status;
    const status =
      typeof rawStatus === 'string'
        ? (rawStatus as ContactStatus)
        : undefined;
    const { items, meta } = await adminListContacts(page, limit, status);
    sendResponse(res, { message: 'Messages retrieved', data: items, meta: { ...meta } });
  },
);

// PATCH /contacts/admin/:id/status  (admin)
export const adminUpdateContactStatusHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: ContactStatus };
    const contact = await adminUpdateContactStatus(id, status);
    sendResponse(res, { message: 'Status updated', data: contact });
  },
);

// POST /contacts/admin/:id/reply  (admin)
export const adminReplyHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { reply } = req.body as { reply: string };
    const contact = await adminReplyToContact(id, reply);
    sendResponse(res, { message: 'Reply sent', data: contact });
  },
);
