import mongoose, { Schema } from 'mongoose';
import type { IPost } from './post.types.js';

const postSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    excerpt: { type: String, required: true, trim: true, maxlength: 500 },
    content: { type: String, required: true },
    coverImage: { type: String },
    tags: [{ type: String }],
    category: { type: String },
    status: {
      type: String,
      enum: ['draft', 'published', 'scheduled', 'pending'],
      required: true,
      default: 'draft',
    },
    publishedAt: { type: Date },
    scheduledAt: { type: Date },
    readingTime: { type: Number, required: true, default: 1 },
    viewCount: { type: Number, required: true, default: 0 },
    likeCount: { type: Number, required: true, default: 0 },
    commentCount: { type: Number, required: true, default: 0 },
    trendingScore: { type: Number, required: true, default: 0 },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    seo: {
      title: { type: String },
      description: { type: String },
      ogImage: { type: String },
    },
  },
  { timestamps: true },
);

postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ tags: 1, status: 1 });
postSchema.index({ category: 1, status: 1 });
postSchema.index({ author: 1 });
postSchema.index({ status: 1, scheduledAt: 1 });
postSchema.index({ title: 'text', excerpt: 'text', content: 'text' });
postSchema.index({ author: 1, status: 1, publishedAt: -1 }); // following feed
postSchema.index({ status: 1, trendingScore: -1 }); // trending feed
// Cursor-pagination needs _id as tiebreaker
postSchema.index({ status: 1, publishedAt: -1, _id: -1 });
postSchema.index({ status: 1, trendingScore: -1, _id: -1 });
// Analytics: top posts by engagement metric per author
postSchema.index({ author: 1, status: 1, viewCount: -1 });
postSchema.index({ author: 1, status: 1, likeCount: -1 });
postSchema.index({ author: 1, status: 1, commentCount: -1 });

export const PostModel = mongoose.model<IPost>('Post', postSchema);
