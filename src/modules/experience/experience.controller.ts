import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import {
  getPublicExperiences,
  adminListExperiences,
  getExperienceById,
  createExperience,
  updateExperience,
  deleteExperience,
  reorderExperiences,
} from './experience.service.js';
import type { CreateExperienceInput, UpdateExperienceInput } from './experience.validation.js';
import type { ReorderBody } from '@/utils/reorder.js';

export const getExperiencesPublicHandler: RequestHandler = catchAsync(async (_req, res) => {
  const experiences = await getPublicExperiences();
  sendResponse(res, { message: 'Experiences retrieved', data: experiences });
});

export const getExperiencesAdminHandler: RequestHandler = catchAsync(async (req, res) => {
  const { items, meta } = await adminListExperiences(req);
  sendResponse(res, { message: 'Experiences retrieved', data: items, meta: { ...meta } });
});

export const getExperienceByIdHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const exp = await getExperienceById(id);
  sendResponse(res, { message: 'Experience retrieved', data: exp });
});

export const createExperienceHandler: RequestHandler = catchAsync(async (req, res) => {
  const exp = await createExperience(req.body as CreateExperienceInput);
  sendResponse(res, { statusCode: 201, message: 'Experience created', data: exp });
});

export const updateExperienceHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const exp = await updateExperience(id, req.body as UpdateExperienceInput);
  sendResponse(res, { message: 'Experience updated', data: exp });
});

export const deleteExperienceHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  await deleteExperience(id);
  sendResponse(res, { message: 'Experience deleted' });
});

export const reorderExperiencesHandler: RequestHandler = catchAsync(async (req, res) => {
  await reorderExperiences((req.body as ReorderBody).items);
  sendResponse(res, { message: 'Experiences reordered' });
});
