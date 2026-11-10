import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import {
  getPublicSkills,
  adminListSkills,
  getSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
  toggleSkillVisibility,
  reorderSkills,
} from './skill.service.js';
import type { CreateSkillInput, UpdateSkillInput } from './skill.validation.js';
import type { ReorderBody } from '@/utils/reorder.js';

export const getSkillsPublicHandler: RequestHandler = catchAsync(async (_req, res) => {
  const skills = await getPublicSkills();
  sendResponse(res, { message: 'Skills retrieved', data: skills });
});

export const getSkillsAdminHandler: RequestHandler = catchAsync(async (req, res) => {
  const { items, meta } = await adminListSkills(req);
  sendResponse(res, { message: 'Skills retrieved', data: items, meta: { ...meta } });
});

export const getSkillByIdHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const skill = await getSkillById(id);
  sendResponse(res, { message: 'Skill retrieved', data: skill });
});

export const createSkillHandler: RequestHandler = catchAsync(async (req, res) => {
  const skill = await createSkill(req.body as CreateSkillInput);
  sendResponse(res, { statusCode: 201, message: 'Skill created', data: skill });
});

export const updateSkillHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const skill = await updateSkill(id, req.body as UpdateSkillInput);
  sendResponse(res, { message: 'Skill updated', data: skill });
});

export const deleteSkillHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  await deleteSkill(id);
  sendResponse(res, { message: 'Skill deleted' });
});

export const toggleSkillVisibilityHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const skill = await toggleSkillVisibility(id);
  sendResponse(res, { message: 'Visibility toggled', data: skill });
});

export const reorderSkillsHandler: RequestHandler = catchAsync(async (req, res) => {
  await reorderSkills((req.body as ReorderBody).items);
  sendResponse(res, { message: 'Skills reordered' });
});
