import type { HydratedDocument, Types } from 'mongoose';

export type LikeTargetType = 'post' | 'comment';

export interface ILike {
  user: Types.ObjectId;
  targetType: LikeTargetType;
  targetId: Types.ObjectId;
}

export type ILikeDocument = HydratedDocument<ILike>;
