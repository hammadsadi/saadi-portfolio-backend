import type { Types, HydratedDocument } from 'mongoose';

export interface IFollow {
  follower: Types.ObjectId;
  following: Types.ObjectId;
  createdAt: Date;
}

export type IFollowDocument = HydratedDocument<IFollow>;

export interface FollowUserResult {
  _id: string;
  name: string;
  avatar: string | null;
  followerCount: number;
  isFollowedByMe: boolean;
}

export interface SuggestionResult {
  _id: string;
  name: string;
  avatar: string | null;
  followerCount: number;
  mutualCount: number;
}

export interface FollowCursorMeta {
  hasMore: boolean;
  nextCursor: string | null;
}
