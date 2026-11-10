import mongoose, { Schema } from 'mongoose';
import type { IComment } from './comment.types.js';

const commentSchema = new Schema<IComment>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    likeCount: { type: Number, required: true, default: 0 },
    replyCount: { type: Number, required: true, default: 0 },
    isEdited: { type: Boolean, required: true, default: false },
    isDeleted: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, parent: 1, createdAt: -1 });
commentSchema.index({ post: 1, parent: 1, _id: 1 });
commentSchema.index({ user: 1, createdAt: -1 });
commentSchema.index({ parent: 1 });

export const CommentModel = mongoose.model<IComment>('Comment', commentSchema);
