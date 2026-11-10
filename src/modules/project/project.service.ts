import { ProjectModel } from './project.model.js';
import type { IProjectDocument } from './project.types.js';
import type { CreateProjectInput, UpdateProjectInput } from './project.validation.js';
import { AppError } from '@/utils/AppError.js';
import { reorderItems } from '@/utils/reorder.js';
import type { ReorderItem } from '@/utils/reorder.js';
import { parsePagination, buildMeta } from '@/utils/pagination.js';
import type { PaginationMeta } from '@/utils/pagination.js';
import { slugify } from '@/utils/slugify.js';
import type { Request } from 'express';

export async function getPublicProjects(req: Request): Promise<IProjectDocument[]> {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const featured = req.query.featured === 'true' ? true : undefined;
  const filter: Record<string, unknown> = { status: 'published' };
  if (category) filter.category = category;
  if (featured !== undefined) filter.featured = featured;
  return ProjectModel.find(filter).sort({ order: 1 }).limit(100);
}

export async function getPublicProjectBySlug(slug: string): Promise<IProjectDocument> {
  const project = await ProjectModel.findOne({ slug, status: 'published' });
  if (!project) throw new AppError('Project not found', 404);
  return project;
}

export async function adminListProjects(
  req: Request,
): Promise<{ items: IProjectDocument[]; meta: PaginationMeta }> {
  const { page, limit, skip, sort, search } = parsePagination(req);
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const featured =
    req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined;

  const filter: Record<string, unknown> = {};
  if (search) filter.$or = [
    { title: { $regex: search, $options: 'i' } },
    { summary: { $regex: search, $options: 'i' } },
  ];
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (featured !== undefined) filter.featured = featured;

  const [items, total] = await Promise.all([
    ProjectModel.find(filter).sort(sort).skip(skip).limit(limit),
    ProjectModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function getProjectById(id: string): Promise<IProjectDocument> {
  const project = await ProjectModel.findById(id);
  if (!project) throw new AppError('Project not found', 404);
  return project;
}

export async function createProject(data: CreateProjectInput): Promise<IProjectDocument> {
  const slug = data.slug ?? slugify(data.title);
  const order = data.order ?? (await ProjectModel.countDocuments());
  return ProjectModel.create({ ...data, slug, order });
}

export async function updateProject(id: string, data: UpdateProjectInput): Promise<IProjectDocument> {
  if (data.title && !data.slug) {
    data.slug = slugify(data.title);
  }
  const project = await ProjectModel.findByIdAndUpdate(
    id,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  if (!project) throw new AppError('Project not found', 404);
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  const result = await ProjectModel.findByIdAndDelete(id);
  if (!result) throw new AppError('Project not found', 404);
}

export async function toggleProjectStatus(id: string): Promise<IProjectDocument> {
  const project = await ProjectModel.findById(id);
  if (!project) throw new AppError('Project not found', 404);
  project.status = project.status === 'published' ? 'draft' : 'published';
  return project.save();
}

export async function reorderProjects(items: ReorderItem[]): Promise<void> {
  await reorderItems(ProjectModel, items);
}
