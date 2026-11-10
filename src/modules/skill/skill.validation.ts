import { z } from 'zod';

const categoryEnum = z.enum(['Frontend', 'Backend', 'Database', 'AI/ML', 'DevOps', 'Tools']);

export const createSkillSchema = z.object({
  name: z.string().min(1).max(100),
  category: categoryEnum,
  icon: z.string().min(1).optional(),
  proficiency: z.number().int().min(0).max(100),
  order: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});

export const updateSkillSchema = createSkillSchema.partial();

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

export const skillQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  search: z.string().optional(),
  category: categoryEnum.optional(),
  isVisible: z.enum(['true', 'false']).optional(),
});
