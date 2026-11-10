import { CategoryModel } from './category.model.js';
import type { ICategoryDocument } from './category.types.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.validation.js';
import { AppError } from '@/utils/AppError.js';

export async function listCategories(): Promise<ICategoryDocument[]> {
  return CategoryModel.find({}).sort({ name: 1 });
}

export async function upsertCategory(data: CreateCategoryInput): Promise<ICategoryDocument> {
  return CategoryModel.findOneAndUpdate(
    { slug: data.slug },
    { $setOnInsert: data },
    { upsert: true, returnDocument: 'after' },
  );
}

export async function updateCategory(
  slug: string,
  data: UpdateCategoryInput,
): Promise<ICategoryDocument> {
  const cat = await CategoryModel.findOneAndUpdate(
    { slug },
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  if (!cat) throw new AppError('Category not found', 404);
  return cat;
}

export async function deleteCategory(slug: string): Promise<void> {
  const result = await CategoryModel.findOneAndDelete({ slug });
  if (!result) throw new AppError('Category not found', 404);
}
