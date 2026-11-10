import mongoose, { Schema } from 'mongoose';
import type { ISkill } from './skill.types.js';

const skillSchema = new Schema<ISkill>(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Frontend', 'Backend', 'Database', 'AI/ML', 'DevOps', 'Tools'],
    },
    icon: { type: String },
    proficiency: { type: Number, required: true, min: 0, max: 100 },
    order: { type: Number, required: true, default: 0 },
    isVisible: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

skillSchema.index({ isVisible: 1, order: 1 });
skillSchema.index({ category: 1, isVisible: 1, order: 1 });
skillSchema.index({ name: 1 }, { unique: true });

export const SkillModel = mongoose.model<ISkill>('Skill', skillSchema);
