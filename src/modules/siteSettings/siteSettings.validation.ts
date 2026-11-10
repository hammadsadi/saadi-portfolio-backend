import { z } from 'zod';

const seoDefaultsSchema = z.object({
  titleTemplate: z.string().min(1),
  description: z.string().min(1),
  ogImage: z.string().min(1).optional(),
});

const navItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  order: z.number().int().min(0),
});

const featureFlagsSchema = z.object({
  blogEnabled: z.boolean(),
  contactEnabled: z.boolean(),
  userPostsModeration: z.boolean().default(false),
});

export const upsertSiteSettingsSchema = z.object({
  siteTitle: z.string().min(1).max(100),
  seoDefaults: seoDefaultsSchema,
  themeAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  navItems: z.array(navItemSchema),
  footerText: z.string(),
  featureFlags: featureFlagsSchema,
});

export const patchSiteSettingsSchema = upsertSiteSettingsSchema.partial().extend({
  seoDefaults: seoDefaultsSchema.partial().optional(),
  featureFlags: featureFlagsSchema.partial().optional(),
});

export type UpsertSiteSettingsInput = z.infer<typeof upsertSiteSettingsSchema>;
export type PatchSiteSettingsInput = z.infer<typeof patchSiteSettingsSchema>;
