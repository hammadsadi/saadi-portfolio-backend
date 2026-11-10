import mongoose, { Schema } from 'mongoose';
import type { IEducation } from './education.types.js';

const educationSchema = new Schema<IEducation>(
  {
    institution: { type: String, required: true, trim: true },
    degree: { type: String, required: true, trim: true },
    field: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    description: { type: String },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

educationSchema.index({ order: 1 });

export const EducationModel = mongoose.model<IEducation>('Education', educationSchema);
