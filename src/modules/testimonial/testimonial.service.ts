import { TestimonialModel } from './testimonial.model.js';
import type { ITestimonialDocument } from './testimonial.types.js';
import type { CreateTestimonialInput, UpdateTestimonialInput } from './testimonial.validation.js';
import { AppError } from '@/utils/AppError.js';
import { reorderItems } from '@/utils/reorder.js';
import type { ReorderItem } from '@/utils/reorder.js';
import { parsePagination, buildMeta } from '@/utils/pagination.js';
import type { PaginationMeta } from '@/utils/pagination.js';
import type { Request } from 'express';

export async function getPublicTestimonials(): Promise<ITestimonialDocument[]> {
  return TestimonialModel.find({ isVisible: true }).sort({ order: 1 }).limit(50);
}

export async function adminListTestimonials(
  req: Request,
): Promise<{ items: ITestimonialDocument[]; meta: PaginationMeta }> {
  const { page, limit, skip, sort } = parsePagination(req);
  const rawVisible = req.query.isVisible;
  const isVisible =
    rawVisible === 'true' ? true : rawVisible === 'false' ? false : undefined;

  const filter: Record<string, unknown> = {};
  if (isVisible !== undefined) filter.isVisible = isVisible;

  const [items, total] = await Promise.all([
    TestimonialModel.find(filter).sort(sort).skip(skip).limit(limit),
    TestimonialModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function getTestimonialById(id: string): Promise<ITestimonialDocument> {
  const t = await TestimonialModel.findById(id);
  if (!t) throw new AppError('Testimonial not found', 404);
  return t;
}

export async function createTestimonial(
  data: CreateTestimonialInput,
): Promise<ITestimonialDocument> {
  const order = data.order ?? (await TestimonialModel.countDocuments());
  return TestimonialModel.create({ ...data, order });
}

export async function updateTestimonial(
  id: string,
  data: UpdateTestimonialInput,
): Promise<ITestimonialDocument> {
  const t = await TestimonialModel.findByIdAndUpdate(
    id,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  if (!t) throw new AppError('Testimonial not found', 404);
  return t;
}

export async function deleteTestimonial(id: string): Promise<void> {
  const result = await TestimonialModel.findByIdAndDelete(id);
  if (!result) throw new AppError('Testimonial not found', 404);
}

export async function toggleTestimonialVisibility(id: string): Promise<ITestimonialDocument> {
  const t = await TestimonialModel.findById(id);
  if (!t) throw new AppError('Testimonial not found', 404);
  t.isVisible = !t.isVisible;
  return t.save();
}

export async function reorderTestimonials(items: ReorderItem[]): Promise<void> {
  await reorderItems(TestimonialModel, items);
}
