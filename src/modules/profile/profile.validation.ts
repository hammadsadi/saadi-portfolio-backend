import { z } from 'zod';

const socialLinkSchema = z.object({
  platform: z.string().min(1),
  url: z.string().min(1),
  icon: z.string().min(1),
});

const statSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const upsertProfileSchema = z.object({
  fullName: z.string().min(1).max(100),
  headline: z.string().min(1).max(200),
  shortBio: z.string().min(1).max(500),
  longBio: z.string().optional(),
  avatar: z.string().min(1).optional(),
  heroImage: z.string().min(1).optional(),
  resumeUrl: z.string().min(1).optional(),
  email: z.email(),
  location: z.string().min(1).optional(),
  availabilityStatus: z.enum(['available', 'unavailable', 'open-to-work']).optional(),
  yearsOfExperience: z.number().int().min(0).optional(),
  socialLinks: z.array(socialLinkSchema).optional(),
  typedRoles: z.array(z.string().min(1)).optional(),
  stats: z.array(statSchema).optional(),
});

export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
