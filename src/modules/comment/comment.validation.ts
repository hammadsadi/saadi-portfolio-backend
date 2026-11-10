import { z } from 'zod';

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const createCommentSchema = z.object({
  postId: z.string().regex(objectIdPattern, 'Invalid postId'),
  content: z.string().trim().min(1).max(2000),
  parentId: z.string().regex(objectIdPattern, 'Invalid parentId').optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const listCommentsQuerySchema = z.object({
  postId: z.string().regex(objectIdPattern, 'Invalid postId'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const listRepliesQuerySchema = z.object({
  cursor: z.string().regex(objectIdPattern, 'Invalid cursor').optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
export type ListRepliesQuery = z.infer<typeof listRepliesQuerySchema>;
