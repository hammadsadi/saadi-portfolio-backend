import { z } from 'zod';

export const recordViewSchema = z.object({
  targetType: z.enum(['post', 'profile']),
  targetId: z.string().min(1),
});

export type RecordViewInput = z.infer<typeof recordViewSchema>;
