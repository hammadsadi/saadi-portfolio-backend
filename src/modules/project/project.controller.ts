import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import {
  getPublicProjects,
  getPublicProjectBySlug,
  adminListProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  toggleProjectStatus,
  reorderProjects,
} from './project.service.js';
import type { CreateProjectInput, UpdateProjectInput } from './project.validation.js';
import type { ReorderBody } from '@/utils/reorder.js';

export const getProjectsPublicHandler: RequestHandler = catchAsync(async (req, res) => {
  const projects = await getPublicProjects(req);
  sendResponse(res, { message: 'Projects retrieved', data: projects });
});

export const getProjectBySlugHandler: RequestHandler = catchAsync(async (req, res) => {
  const { slug } = req.params as { slug: string };
  const project = await getPublicProjectBySlug(slug);
  sendResponse(res, { message: 'Project retrieved', data: project });
});

export const getProjectsAdminHandler: RequestHandler = catchAsync(async (req, res) => {
  const { items, meta } = await adminListProjects(req);
  sendResponse(res, { message: 'Projects retrieved', data: items, meta: { ...meta } });
});

export const getProjectByIdHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const project = await getProjectById(id);
  sendResponse(res, { message: 'Project retrieved', data: project });
});

export const createProjectHandler: RequestHandler = catchAsync(async (req, res) => {
  const project = await createProject(req.body as CreateProjectInput);
  sendResponse(res, { statusCode: 201, message: 'Project created', data: project });
});

export const updateProjectHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const project = await updateProject(id, req.body as UpdateProjectInput);
  sendResponse(res, { message: 'Project updated', data: project });
});

export const deleteProjectHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  await deleteProject(id);
  sendResponse(res, { message: 'Project deleted' });
});

export const toggleProjectStatusHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const project = await toggleProjectStatus(id);
  sendResponse(res, { message: 'Status toggled', data: project });
});

export const reorderProjectsHandler: RequestHandler = catchAsync(async (req, res) => {
  await reorderProjects((req.body as ReorderBody).items);
  sendResponse(res, { message: 'Projects reordered' });
});
