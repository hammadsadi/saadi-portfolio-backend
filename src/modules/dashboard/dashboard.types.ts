export interface DailyViewStat {
  date: string;
  views: number;
  uniqueViews?: number;
}

export interface TopPost {
  _id: string;
  title: string;
  slug: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface RecentUser {
  _id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface RecentComment {
  _id: string;
  content: string;
  post: { _id: string; title: string; slug: string } | null;
  user: { _id: string; name: string } | null;
  createdAt: Date;
}

export interface AdminStats {
  counts: {
    users: number;
    posts: number;
    comments: number;
    likes: number;
    messages: number;
    unreadMessages: number;
  };
  viewsTimeSeries: DailyViewStat[];
  topPosts: TopPost[];
  recentUsers: RecentUser[];
  recentComments: RecentComment[];
}

export interface UserStats {
  commentCount: number;
  likesGiven: number;
  messagesSent: number;
}
