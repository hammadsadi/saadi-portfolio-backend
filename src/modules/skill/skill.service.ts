import { SkillModel } from './skill.model.js';
import type { ISkillDocument } from './skill.types.js';
import type { CreateSkillInput, UpdateSkillInput } from './skill.validation.js';
import { AppError } from '@/utils/AppError.js';
import { reorderItems } from '@/utils/reorder.js';
import type { ReorderItem } from '@/utils/reorder.js';
import { parsePagination, buildMeta } from '@/utils/pagination.js';
import type { PaginationMeta } from '@/utils/pagination.js';
import type { Request } from 'express';

export async function getPublicSkills(): Promise<ISkillDocument[]> {
  return SkillModel.find({ isVisible: true }).sort({ order: 1 }).limit(500);
}

export async function adminListSkills(
  req: Request,
): Promise<{ items: ISkillDocument[]; meta: PaginationMeta }> {
  const { page, limit, skip, sort, search } = parsePagination(req);
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const rawVisible = req.query.isVisible;
  const isVisible =
    rawVisible === 'true' ? true : rawVisible === 'false' ? false : undefined;

  const filter: Record<string, unknown> = {};
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (category) filter.category = category;
  if (isVisible !== undefined) filter.isVisible = isVisible;

  const [items, total] = await Promise.all([
    SkillModel.find(filter).sort(sort).skip(skip).limit(limit),
    SkillModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function getSkillById(id: string): Promise<ISkillDocument> {
  const skill = await SkillModel.findById(id);
  if (!skill) throw new AppError('Skill not found', 404);
  return skill;
}

export async function createSkill(data: CreateSkillInput): Promise<ISkillDocument> {
  const order = data.order ?? (await SkillModel.countDocuments());
  return SkillModel.create({ ...data, order });
}

export async function updateSkill(id: string, data: UpdateSkillInput): Promise<ISkillDocument> {
  const skill = await SkillModel.findByIdAndUpdate(
    id,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  if (!skill) throw new AppError('Skill not found', 404);
  return skill;
}

export async function deleteSkill(id: string): Promise<void> {
  const result = await SkillModel.findByIdAndDelete(id);
  if (!result) throw new AppError('Skill not found', 404);
}

export async function toggleSkillVisibility(id: string): Promise<ISkillDocument> {
  const skill = await SkillModel.findById(id);
  if (!skill) throw new AppError('Skill not found', 404);
  skill.isVisible = !skill.isVisible;
  return skill.save();
}

export async function reorderSkills(items: ReorderItem[]): Promise<void> {
  await reorderItems(SkillModel, items);
}
