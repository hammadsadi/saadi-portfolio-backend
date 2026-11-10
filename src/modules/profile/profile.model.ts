import mongoose, { Schema } from 'mongoose';
import type { IProfile } from './profile.types.js';

const socialLinkSchema = new Schema(
  { platform: { type: String, required: true }, url: { type: String, required: true }, icon: { type: String, required: true } },
  { _id: false },
);

const statSchema = new Schema(
  { label: { type: String, required: true }, value: { type: String, required: true } },
  { _id: false },
);

const profileSchema = new Schema<IProfile>(
  {
    fullName: { type: String, required: true, trim: true },
    headline: { type: String, required: true, trim: true },
    shortBio: { type: String, required: true },
    longBio: { type: String },
    avatar: { type: String },
    heroImage: { type: String },
    resumeUrl: { type: String },
    email: { type: String, required: true },
    location: { type: String },
    availabilityStatus: {
      type: String,
      enum: ['available', 'unavailable', 'open-to-work'],
      default: 'available',
    },
    yearsOfExperience: { type: Number, min: 0, default: 0 },
    socialLinks: { type: [socialLinkSchema], default: [] },
    typedRoles: { type: [String], default: [] },
    stats: { type: [statSchema], default: [] },
    viewCount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const ProfileModel = mongoose.model<IProfile>('Profile', profileSchema);
