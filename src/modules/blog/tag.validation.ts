import { z } from 'zod';

const slugPattern = /^[a-z0-9-]+$/;

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50).regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens'),
});

export const updateTagSchema = createTagSchema.partial();

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
