import type { HydratedDocument } from 'mongoose';

export interface ISeoDefaults {
  titleTemplate: string;
  description: string;
  ogImage?: string;
}

export interface INavItem {
  label: string;
  href: string;
  order: number;
}

export interface IFeatureFlags {
  blogEnabled: boolean;
  contactEnabled: boolean;
  userPostsModeration: boolean;
}

export interface ISiteSettings {
  siteTitle: string;
  seoDefaults: ISeoDefaults;
  themeAccentColor: string;
  navItems: INavItem[];
  footerText: string;
  featureFlags: IFeatureFlags;
}

export type ISiteSettingsDocument = HydratedDocument<ISiteSettings>;
