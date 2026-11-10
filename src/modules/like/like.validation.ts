import { z } from 'zod';

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const toggleLikeSchema = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.string().regex(objectIdPattern, 'Invalid ObjectId'),
});

export const likeStatusQuerySchema = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.string().regex(objectIdPattern, 'Invalid ObjectId'),
});

export type ToggleLikeInput = z.infer<typeof toggleLikeSchema>;
export type LikeStatusQuery = z.infer<typeof likeStatusQuerySchema>;
