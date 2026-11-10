import { z } from 'zod';

export const createContactSchema = z.object({
  subject: z.string().min(1).max(200).trim(),
  message: z.string().min(1).max(5000).trim(),
});

export const adminReplySchema = z.object({
  reply: z.string().min(1).max(5000).trim(),
});

export const adminUpdateContactStatusSchema = z.object({
  status: z.enum(['new', 'read', 'replied', 'archived']),
});

export const listUserContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const adminListContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['new', 'read', 'replied', 'archived']).optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type AdminReplyInput = z.infer<typeof adminReplySchema>;
export type AdminUpdateContactStatusInput = z.infer<typeof adminUpdateContactStatusSchema>;
