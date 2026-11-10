import { ExperienceModel } from './experience.model.js';
import type { IExperienceDocument } from './experience.types.js';
import type { CreateExperienceInput, UpdateExperienceInput } from './experience.validation.js';
import { AppError } from '@/utils/AppError.js';
import { reorderItems } from '@/utils/reorder.js';
import type { ReorderItem } from '@/utils/reorder.js';
import { parsePagination, buildMeta } from '@/utils/pagination.js';
import type { PaginationMeta } from '@/utils/pagination.js';
import type { Request } from 'express';

export async function getPublicExperiences(): Promise<IExperienceDocument[]> {
  return ExperienceModel.find({}).sort({ order: 1 }).limit(50);
}

export async function adminListExperiences(
  req: Request,
): Promise<{ items: IExperienceDocument[]; meta: PaginationMeta }> {
  const { page, limit, skip, sort, search } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  if (search) filter.$or = [
    { company: { $regex: search, $options: 'i' } },
    { role: { $regex: search, $options: 'i' } },
  ];

  const [items, total] = await Promise.all([
    ExperienceModel.find(filter).sort(sort).skip(skip).limit(limit),
    ExperienceModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function getExperienceById(id: string): Promise<IExperienceDocument> {
  const exp = await ExperienceModel.findById(id);
  if (!exp) throw new AppError('Experience not found', 404);
  return exp;
}

export async function createExperience(data: CreateExperienceInput): Promise<IExperienceDocument> {
  const order = data.order ?? (await ExperienceModel.countDocuments());
  return ExperienceModel.create({ ...data, order });
}

export async function updateExperience(
  id: string,
  data: UpdateExperienceInput,
): Promise<IExperienceDocument> {
  const exp = await ExperienceModel.findByIdAndUpdate(
    id,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  if (!exp) throw new AppError('Experience not found', 404);
  return exp;
}

export async function deleteExperience(id: string): Promise<void> {
  const result = await ExperienceModel.findByIdAndDelete(id);
  if (!result) throw new AppError('Experience not found', 404);
}

export async function reorderExperiences(items: ReorderItem[]): Promise<void> {
  await reorderItems(ExperienceModel, items);
}
