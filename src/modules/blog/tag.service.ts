import { TagModel } from './tag.model.js';
import type { ITagDocument } from './tag.types.js';
import type { CreateTagInput, UpdateTagInput } from './tag.validation.js';
import { AppError } from '@/utils/AppError.js';

export async function listTags(): Promise<ITagDocument[]> {
  return TagModel.find({}).sort({ name: 1 });
}

export async function upsertTag(data: CreateTagInput): Promise<ITagDocument> {
  return TagModel.findOneAndUpdate(
    { slug: data.slug },
    { $setOnInsert: data },
    { upsert: true, returnDocument: 'after' },
  );
}

export async function updateTag(slug: string, data: UpdateTagInput): Promise<ITagDocument> {
  const tag = await TagModel.findOneAndUpdate(
    { slug },
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  if (!tag) throw new AppError('Tag not found', 404);
  return tag;
}

export async function deleteTag(slug: string): Promise<void> {
  const result = await TagModel.findOneAndDelete({ slug });
  if (!result) throw new AppError('Tag not found', 404);
}
