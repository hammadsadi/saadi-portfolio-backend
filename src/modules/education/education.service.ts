import { EducationModel } from './education.model.js';
import type { IEducationDocument } from './education.types.js';
import type { CreateEducationInput, UpdateEducationInput } from './education.validation.js';
import { AppError } from '@/utils/AppError.js';
import { reorderItems } from '@/utils/reorder.js';
import type { ReorderItem } from '@/utils/reorder.js';
import { parsePagination, buildMeta } from '@/utils/pagination.js';
import type { PaginationMeta } from '@/utils/pagination.js';
import type { Request } from 'express';

export async function getPublicEducation(): Promise<IEducationDocument[]> {
  return EducationModel.find({}).sort({ order: 1 }).limit(50);
}

export async function adminListEducation(
  req: Request,
): Promise<{ items: IEducationDocument[]; meta: PaginationMeta }> {
  const { page, limit, skip, sort, search } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  if (search) filter.$or = [
    { institution: { $regex: search, $options: 'i' } },
    { degree: { $regex: search, $options: 'i' } },
  ];

  const [items, total] = await Promise.all([
    EducationModel.find(filter).sort(sort).skip(skip).limit(limit),
    EducationModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function getEducationById(id: string): Promise<IEducationDocument> {
  const edu = await EducationModel.findById(id);
  if (!edu) throw new AppError('Education not found', 404);
  return edu;
}

export async function createEducation(data: CreateEducationInput): Promise<IEducationDocument> {
  const order = data.order ?? (await EducationModel.countDocuments());
  return EducationModel.create({ ...data, order });
}

export async function updateEducation(
  id: string,
  data: UpdateEducationInput,
): Promise<IEducationDocument> {
  const edu = await EducationModel.findByIdAndUpdate(
    id,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  if (!edu) throw new AppError('Education not found', 404);
  return edu;
}

export async function deleteEducation(id: string): Promise<void> {
  const result = await EducationModel.findByIdAndDelete(id);
  if (!result) throw new AppError('Education not found', 404);
}

export async function reorderEducation(items: ReorderItem[]): Promise<void> {
  await reorderItems(EducationModel, items);
}
