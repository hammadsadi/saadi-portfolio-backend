import mongoose, { Schema } from 'mongoose';
import type { ICategory } from './category.types.js';

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
  },
  { timestamps: true },
);

export const CategoryModel = mongoose.model<ICategory>('Category', categorySchema);
