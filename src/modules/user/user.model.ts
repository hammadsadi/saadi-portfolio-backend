import { Schema, model } from 'mongoose';
import type { Model } from 'mongoose';
import type { IUser, IAuthProvider, IRefreshToken, IUserSocialLink } from './user.types.js';

const authProviderSchema = new Schema<IAuthProvider>(
  {
    provider: { type: String, enum: ['google', 'github'], required: true },
    providerId: { type: String, required: true },
  },
  { _id: false },
);

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false },
);

const socialLinkSchema = new Schema<IUserSocialLink>(
  {
    platform: { type: String, required: true, trim: true, maxlength: 50 },
    url: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: {
      type: String,
      unique: true,
      sparse: true, // allows multiple null values alongside the unique constraint
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    passwordHash: { type: String, select: false },
    avatar: { type: String, default: null },
    coverImage: { type: String, default: null },
    bio: { type: String, maxlength: 300, default: null },
    location: { type: String, maxlength: 100, default: null },
    website: { type: String, default: null },
    socialLinks: { type: [socialLinkSchema], default: [] },
    profileVisibility: {
      type: String,
      enum: ['public', 'private-stats'],
      default: 'public',
    },
    showProfileViews: { type: Boolean, default: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    authProviders: { type: [authProviderSchema], default: [] },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
    isEmailVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    followerCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    notificationPreferences: {
      newFollower: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      replies: { type: Boolean, default: true },
      productUpdates: { type: Boolean, default: false },
    },
    followerEmailThrottle: {
      date: { type: String },
      count: { type: Number, default: 0, min: 0 },
    },
    usernameChangedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Indexes for every query pattern used in services
userSchema.index({ 'authProviders.provider': 1, 'authProviders.providerId': 1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ isBlocked: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ followerCount: -1 });
// Admin listUsers — name regex search (case-insensitive COLLATION index preferred;
// a plain B-tree index on {name} is enough to narrow the scan for small result sets)
userSchema.index({ name: 1 });

export const UserModel: Model<IUser> = model<IUser>('User', userSchema);
