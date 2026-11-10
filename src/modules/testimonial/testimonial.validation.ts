import { z } from 'zod';

export const createTestimonialSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  avatar: z.string().min(1).optional(),
  message: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5),
  isVisible: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

export const updateTestimonialSchema = createTestimonialSchema.partial();

export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;
export type UpdateTestimonialInput = z.infer<typeof updateTestimonialSchema>;
