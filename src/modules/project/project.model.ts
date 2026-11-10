import mongoose, { Schema } from 'mongoose';
import type { IProject } from './project.types.js';

const projectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    summary: { type: String, required: true },
    description: { type: String },
    thumbnail: { type: String },
    gallery: { type: [String], default: [] },
    techStack: { type: [String], default: [] },
    liveUrl: { type: String },
    githubUrl: { type: String },
    category: { type: String },
    featured: { type: Boolean, default: false },
    order: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  { timestamps: true },
);

projectSchema.index({ status: 1, order: 1 });
projectSchema.index({ featured: 1, status: 1, order: 1 });
projectSchema.index({ category: 1, status: 1 });

export const ProjectModel = mongoose.model<IProject>('Project', projectSchema);
