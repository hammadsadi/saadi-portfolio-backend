import type { HydratedDocument, Types } from 'mongoose';

export type PostStatus = 'draft' | 'published' | 'scheduled' | 'pending';

export interface IPostSeo {
  title?: string;
  description?: string;
  ogImage?: string;
}

export interface IPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  tags: string[];
  category?: string;
  status: PostStatus;
  publishedAt?: Date;
  scheduledAt?: Date;
  readingTime: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  trendingScore: number;
  author: Types.ObjectId;
  seo: IPostSeo;
}

export type IPostDocument = HydratedDocument<IPost>;
