import { z } from 'zod';

const slugPattern = /^[a-z0-9-]+$/;

const seoSchema = z
  .object({
    title: z.string().max(300).optional(),
    description: z.string().max(500).optional(),
    ogImage: z.string().optional(),
  })
  .default({});

export const createPostSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(300).regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  excerpt: z.string().min(1).max(500),
  content: z.string().min(1),
  coverImage: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).default([]),
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'scheduled']).default('draft'),
  scheduledAt: z.iso.datetime().optional(),
  seo: seoSchema,
});

export const updatePostSchema = createPostSchema.partial();

export const publishPostSchema = z.object({
  publishedAt: z.iso.datetime().optional(),
});

export const schedulePostSchema = z.object({
  scheduledAt: z.iso.datetime(),
});

// User-facing schemas: no slug, status, or scheduledAt — set by the system
export const userCreatePostSchema = z.object({
  title: z.string().min(1).max(300),
  excerpt: z.string().min(1).max(500),
  content: z.string().min(1),
  coverImage: z.string().optional(),
  tags: z.array(z.string().min(1).max(50)).default([]),
  category: z.string().optional(),
  seo: seoSchema,
});

export const userUpdatePostSchema = userCreatePostSchema.partial();

export const rejectPostSchema = z.object({
  reason: z.string().min(1).max(1000).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PublishPostInput = z.infer<typeof publishPostSchema>;
export type SchedulePostInput = z.infer<typeof schedulePostSchema>;
export type UserCreatePostInput = z.infer<typeof userCreatePostSchema>;
export type UserUpdatePostInput = z.infer<typeof userUpdatePostSchema>;
export type RejectPostInput = z.infer<typeof rejectPostSchema>;
