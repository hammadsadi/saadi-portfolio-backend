import mongoose, { Schema } from 'mongoose';
import type { IExperience } from './experience.types.js';

const experienceSchema = new Schema<IExperience>(
  {
    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    location: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
    description: { type: String },
    techStack: { type: [String], default: [] },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

experienceSchema.index({ order: 1 });

export const ExperienceModel = mongoose.model<IExperience>('Experience', experienceSchema);
