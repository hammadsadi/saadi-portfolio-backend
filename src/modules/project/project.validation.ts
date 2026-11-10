import { z } from 'zod';

const statusEnum = z.enum(['draft', 'published']);

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  summary: z.string().min(1).max(500),
  description: z.string().optional(),
  thumbnail: z.string().min(1).optional(),
  gallery: z.array(z.string().min(1)).optional(),
  techStack: z.array(z.string().min(1)).optional(),
  liveUrl: z.string().min(1).optional(),
  githubUrl: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  featured: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  status: statusEnum.optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  search: z.string().optional(),
  status: statusEnum.optional(),
  featured: z.enum(['true', 'false']).optional(),
  category: z.string().optional(),
});
