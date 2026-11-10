import { Schema, model } from 'mongoose';
import type { IFollow } from './follow.types.js';

const followSchema = new Schema<IFollow>(
  {
    follower: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    following: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1, createdAt: -1 });
followSchema.index({ follower: 1, createdAt: -1 });
// Cursor-pagination sort by _id for getFollowers / getFollowing
followSchema.index({ following: 1, _id: -1 });
followSchema.index({ follower: 1, _id: -1 });

export const FollowModel = model<IFollow>('Follow', followSchema);
