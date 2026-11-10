import mongoose, { Schema } from 'mongoose';
import type { ITag } from './tag.types.js';

const tagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  },
  { timestamps: true },
);

export const TagModel = mongoose.model<ITag>('Tag', tagSchema);
