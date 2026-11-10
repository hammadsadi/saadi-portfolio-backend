import mongoose, { Schema } from 'mongoose';
import type { ISiteSettings } from './siteSettings.types.js';

const seoDefaultsSchema = new Schema(
  {
    titleTemplate: { type: String, required: true },
    description: { type: String, required: true },
    ogImage: { type: String },
  },
  { _id: false },
);

const navItemSchema = new Schema(
  {
    label: { type: String, required: true },
    href: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const featureFlagsSchema = new Schema(
  {
    blogEnabled: { type: Boolean, default: true },
    contactEnabled: { type: Boolean, default: true },
    userPostsModeration: { type: Boolean, default: false },
  },
  { _id: false },
);

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    siteTitle: { type: String, required: true, trim: true },
    seoDefaults: { type: seoDefaultsSchema, required: true },
    themeAccentColor: { type: String, default: '#0d9488' },
    navItems: { type: [navItemSchema], default: [] },
    footerText: { type: String, default: '' },
    featureFlags: { type: featureFlagsSchema, required: true },
  },
  { timestamps: true },
);

export const SiteSettingsModel = mongoose.model<ISiteSettings>('SiteSettings', siteSettingsSchema);
