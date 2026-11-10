import type { HydratedDocument } from 'mongoose';

export interface ITestimonial {
  name: string;
  role?: string;
  company?: string;
  avatar?: string;
  message: string;
  rating: number;
  isVisible: boolean;
  order: number;
}

export type ITestimonialDocument = HydratedDocument<ITestimonial>;
