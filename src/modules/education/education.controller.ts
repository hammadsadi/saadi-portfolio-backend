import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import {
  getPublicEducation,
  adminListEducation,
  getEducationById,
  createEducation,
  updateEducation,
  deleteEducation,
  reorderEducation,
} from './education.service.js';
import type { CreateEducationInput, UpdateEducationInput } from './education.validation.js';
import type { ReorderBody } from '@/utils/reorder.js';

export const getEducationPublicHandler: RequestHandler = catchAsync(async (_req, res) => {
  const education = await getPublicEducation();
  sendResponse(res, { message: 'Education retrieved', data: education });
});

export const getEducationAdminHandler: RequestHandler = catchAsync(async (req, res) => {
  const { items, meta } = await adminListEducation(req);
  sendResponse(res, { message: 'Education retrieved', data: items, meta: { ...meta } });
});

export const getEducationByIdHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const edu = await getEducationById(id);
  sendResponse(res, { message: 'Education retrieved', data: edu });
});

export const createEducationHandler: RequestHandler = catchAsync(async (req, res) => {
  const edu = await createEducation(req.body as CreateEducationInput);
  sendResponse(res, { statusCode: 201, message: 'Education created', data: edu });
});

export const updateEducationHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const edu = await updateEducation(id, req.body as UpdateEducationInput);
  sendResponse(res, { message: 'Education updated', data: edu });
});

export const deleteEducationHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  await deleteEducation(id);
  sendResponse(res, { message: 'Education deleted' });
});

export const reorderEducationHandler: RequestHandler = catchAsync(async (req, res) => {
  await reorderEducation((req.body as ReorderBody).items);
  sendResponse(res, { message: 'Education reordered' });
});
