export interface FeedAuthor {
  _id: string;
  name: string;
  avatar: string | null;
}

export interface FeedItem {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  tags: string[];
  category: string | null;
  publishedAt: Date;
  readingTime: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  trendingScore: number;
  author: FeedAuthor;
  likedByMe: boolean;
}

export interface FeedCursorMeta {
  hasMore: boolean;
  nextCursor: string | null;
}

export interface FollowingFeedResult {
  items: FeedItem[];
  meta: FeedCursorMeta;
  followsNobody: boolean;
}

export interface TrendingFeedResult {
  items: FeedItem[];
  meta: FeedCursorMeta;
}

export type TrendingRange = '24h' | '7d' | '30d';
