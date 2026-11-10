import type { Types } from 'mongoose';
import { UserModel } from '@/modules/user/user.model.js';
import { PostModel } from '@/modules/blog/post.model.js';
import { CommentModel } from '@/modules/comment/comment.model.js';
import { LikeModel } from '@/modules/like/like.model.js';
import { ContactModel } from '@/modules/contact/contact.model.js';
import { getDailyViewStats } from '@/modules/view/view.service.js';
import type { AdminStats, UserStats, TopPost, RecentUser, RecentComment } from './dashboard.types.js';

interface TopPostAggResult {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

interface RecentCommentAggResult {
  _id: Types.ObjectId;
  content: string;
  post: { _id: Types.ObjectId; title: string; slug: string } | null;
  user: { _id: Types.ObjectId; name: string } | null;
  createdAt: Date;
  isDeleted: boolean;
}

export async function getAdminStats(): Promise<AdminStats> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const [
    userCount,
    postCount,
    commentCount,
    likeCount,
    messageCount,
    unreadCount,
    viewsTimeSeries,
    topPostsAgg,
    recentUsersRaw,
    recentCommentsAgg,
  ] = await Promise.all([
    UserModel.countDocuments(),
    PostModel.countDocuments({ status: 'published' }),
    CommentModel.countDocuments({ isDeleted: false }),
    LikeModel.countDocuments(),
    ContactModel.countDocuments(),
    ContactModel.countDocuments({ status: 'new' }),

    getDailyViewStats({ startDate: startStr, endDate: todayStr }),

    // Top 5 posts by view count
    PostModel.aggregate<TopPostAggResult>([
      { $match: { status: 'published' } },
      { $sort: { viewCount: -1 } },
      { $limit: 5 },
      { $project: { title: 1, slug: 1, viewCount: 1, likeCount: 1, commentCount: 1 } },
    ]),

    // 5 most recent users
    UserModel.find().sort({ createdAt: -1 }).limit(5).select('name email createdAt').lean(),

    // 10 most recent non-deleted comments with post and user populated
    CommentModel.aggregate<RecentCommentAggResult>([
      { $match: { isDeleted: false } },
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'posts',
          localField: 'post',
          foreignField: '_id',
          as: 'postDoc',
          pipeline: [{ $project: { title: 1, slug: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $project: {
          content: 1,
          createdAt: 1,
          post: { $arrayElemAt: ['$postDoc', 0] },
          user: { $arrayElemAt: ['$userDoc', 0] },
        },
      },
    ]),
  ]);

  const topPosts: TopPost[] = topPostsAgg.map((p) => ({
    _id: String(p._id),
    title: p.title,
    slug: p.slug,
    viewCount: p.viewCount,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
  }));

  const recentUsers: RecentUser[] = (recentUsersRaw as {
    _id: Types.ObjectId;
    name: string;
    email: string;
    createdAt: Date;
  }[]).map((u) => ({
    _id: String(u._id),
    name: u.name,
    email: u.email,
    createdAt: u.createdAt,
  }));

  const recentComments: RecentComment[] = recentCommentsAgg.map((c) => ({
    _id: String(c._id),
    content: c.content,
    post: c.post
      ? { _id: String(c.post._id), title: c.post.title, slug: c.post.slug }
      : null,
    user: c.user ? { _id: String(c.user._id), name: c.user.name } : null,
    createdAt: c.createdAt,
  }));

  return {
    counts: {
      users: userCount,
      posts: postCount,
      comments: commentCount,
      likes: likeCount,
      messages: messageCount,
      unreadMessages: unreadCount,
    },
    viewsTimeSeries,
    topPosts,
    recentUsers,
    recentComments,
  };
}

export async function getUserStats(userId: Types.ObjectId): Promise<UserStats> {
  const [commentCount, likesGiven, messagesSent] = await Promise.all([
    CommentModel.countDocuments({ user: userId, isDeleted: false }),
    LikeModel.countDocuments({ user: userId }),
    ContactModel.countDocuments({ user: userId }),
  ]);

  return { commentCount, likesGiven, messagesSent };
}
