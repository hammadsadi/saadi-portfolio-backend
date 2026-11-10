import mongoose, { Schema } from 'mongoose';
import type { ITestimonial } from './testimonial.types.js';

const testimonialSchema = new Schema<ITestimonial>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String },
    company: { type: String },
    avatar: { type: String },
    message: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    isVisible: { type: Boolean, default: true },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

testimonialSchema.index({ isVisible: 1, order: 1 });

export const TestimonialModel = mongoose.model<ITestimonial>('Testimonial', testimonialSchema);
