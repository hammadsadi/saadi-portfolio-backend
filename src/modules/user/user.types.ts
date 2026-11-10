import type { HydratedDocument } from 'mongoose';

export type UserRole = 'user' | 'admin';
export type OAuthProvider = 'google' | 'github';
export type ProfileVisibility = 'public' | 'private-stats';

export interface IAuthProvider {
  provider: OAuthProvider;
  providerId: string;
}

export interface IRefreshToken {
  tokenHash: string;
  expiresAt: Date;
}

export interface IUserSocialLink {
  platform: string;
  url: string;
}

export interface INotificationPreferences {
  newFollower: boolean;
  comments: boolean;
  replies: boolean;
  productUpdates: boolean;
}

export interface IUser {
  name: string;
  email: string;
  username?: string | null;
  passwordHash?: string;
  avatar?: string | null;
  coverImage?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  socialLinks: IUserSocialLink[];
  profileVisibility: ProfileVisibility;
  showProfileViews: boolean;
  role: UserRole;
  authProviders: IAuthProvider[];
  refreshTokens: IRefreshToken[];
  isEmailVerified: boolean;
  isBlocked: boolean;
  lastLoginAt?: Date | null;
  followerCount: number;
  followingCount: number;
  notificationPreferences: INotificationPreferences;
  followerEmailThrottle?: {
    date: string;
    count: number;
  };
  usernameChangedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IUserDocument = HydratedDocument<IUser>;

/** Safe shape returned to authenticated owner — no password hash, no token hashes. */
export interface UserPublic {
  _id: string;
  name: string;
  email: string;
  username: string | null;
  avatar: string | null;
  coverImage: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  socialLinks: IUserSocialLink[];
  profileVisibility: ProfileVisibility;
  showProfileViews: boolean;
  role: UserRole;
  providers: OAuthProvider[];
  isEmailVerified: boolean;
  isBlocked: boolean;
  lastLoginAt: Date | null;
  followerCount: number;
  followingCount: number;
  notificationPreferences: INotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

/** Public profile shape returned to any visitor for GET /users/:username. */
export interface UserPublicProfile {
  _id: string;
  name: string;
  username: string | null;
  avatar: string | null;
  coverImage: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  socialLinks: IUserSocialLink[];
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowedByMe: boolean;
  viewCount?: number;
  createdAt: Date;
}
