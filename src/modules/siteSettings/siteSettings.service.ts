import { SiteSettingsModel } from './siteSettings.model.js';
import type { ISiteSettingsDocument } from './siteSettings.types.js';
import type { UpsertSiteSettingsInput, PatchSiteSettingsInput } from './siteSettings.validation.js';
import { AppError } from '@/utils/AppError.js';

export async function getPublicSiteSettings(): Promise<ISiteSettingsDocument | null> {
  return SiteSettingsModel.findOne({});
}

export async function getAdminSiteSettings(): Promise<ISiteSettingsDocument | null> {
  return SiteSettingsModel.findOne({});
}

export async function upsertSiteSettings(
  data: UpsertSiteSettingsInput,
): Promise<ISiteSettingsDocument> {
  return SiteSettingsModel.findOneAndUpdate(
    {},
    { $set: data },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

export async function patchSiteSettings(
  data: PatchSiteSettingsInput,
): Promise<ISiteSettingsDocument> {
  const updateDoc: Record<string, unknown> = {};

  if (data.siteTitle !== undefined) updateDoc.siteTitle = data.siteTitle;
  if (data.themeAccentColor !== undefined) updateDoc.themeAccentColor = data.themeAccentColor;
  if (data.footerText !== undefined) updateDoc.footerText = data.footerText;
  if (data.navItems !== undefined) updateDoc.navItems = data.navItems;

  if (data.seoDefaults) {
    const { titleTemplate, description, ogImage } = data.seoDefaults;
    if (titleTemplate !== undefined) updateDoc['seoDefaults.titleTemplate'] = titleTemplate;
    if (description !== undefined) updateDoc['seoDefaults.description'] = description;
    if (ogImage !== undefined) updateDoc['seoDefaults.ogImage'] = ogImage;
  }

  if (data.featureFlags) {
    const { blogEnabled, contactEnabled, userPostsModeration } = data.featureFlags;
    if (blogEnabled !== undefined) updateDoc['featureFlags.blogEnabled'] = blogEnabled;
    if (contactEnabled !== undefined) updateDoc['featureFlags.contactEnabled'] = contactEnabled;
    if (userPostsModeration !== undefined) updateDoc['featureFlags.userPostsModeration'] = userPostsModeration;
  }

  const doc = await SiteSettingsModel.findOneAndUpdate(
    {},
    { $set: updateDoc },
    { returnDocument: 'after', runValidators: true },
  );
  if (!doc) throw new AppError('SiteSettings not found — run the seed script first', 404);
  return doc;
}
