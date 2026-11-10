import type { HydratedDocument, Types } from 'mongoose';

export type ViewTargetType = 'post' | 'profile';

export interface IViewDedupe {
  targetType: ViewTargetType;
  targetId: Types.ObjectId;
  viewerKey: string;
  day: string;
  createdAt: Date;
}

export type IViewDedupeDocument = HydratedDocument<IViewDedupe>;

export interface IDailyViewStat {
  targetType: ViewTargetType;
  targetId: Types.ObjectId;
  ownerId: Types.ObjectId;
  date: string;
  views: number;
  uniqueViews: number;
}

export type IDailyViewStatDocument = HydratedDocument<IDailyViewStat>;

// ─── Analytics response shapes ────────────────────────────────────────────────

export interface ViewTimePoint {
  date: string;
  views: number;
  uniqueViews: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface PeriodMetric {
  total: number;
  delta: number;
  timeSeries: ViewTimePoint[];
}

export interface FollowersMetric {
  total: number;
  delta: number;
  perDay: DailyCount[];
}

export interface TopPostStat {
  _id: string;
  title: string;
  slug: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface UserAnalytics {
  range: string;
  profileViews: PeriodMetric;
  postViews: PeriodMetric;
  followers: FollowersMetric;
  topPosts: {
    byViews: TopPostStat[];
    byLikes: TopPostStat[];
    byComments: TopPostStat[];
  };
}

export interface PostAnalytics {
  postId: string;
  total: number;
  timeSeries: ViewTimePoint[];
}

export interface ViewStatsFilter {
  targetType?: ViewTargetType;
  ownerId?: Types.ObjectId;
  targetId?: Types.ObjectId;
  startDate: string;
  endDate: string;
}
