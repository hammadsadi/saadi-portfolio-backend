import type { HydratedDocument } from 'mongoose';

export type AvailabilityStatus = 'available' | 'unavailable' | 'open-to-work';

export interface ISocialLink {
  platform: string;
  url: string;
  icon: string;
}

export interface IStat {
  label: string;
  value: string;
}

export interface IProfile {
  fullName: string;
  headline: string;
  shortBio: string;
  longBio?: string;
  avatar?: string;
  heroImage?: string;
  resumeUrl?: string;
  email: string;
  location?: string;
  availabilityStatus: AvailabilityStatus;
  yearsOfExperience: number;
  socialLinks: ISocialLink[];
  typedRoles: string[];
  stats: IStat[];
  viewCount: number;
}

export type IProfileDocument = HydratedDocument<IProfile>;
