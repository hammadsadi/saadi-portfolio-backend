import { Types } from 'mongoose';
import { ViewDedupeModel, DailyViewStatModel } from './view.model.js';
import { PostModel } from '@/modules/blog/post.model.js';
import { ProfileModel } from '@/modules/profile/profile.model.js';
import { UserModel } from '@/modules/user/user.model.js';
import { FollowModel } from '@/modules/follow/follow.model.js';
import { AppError } from '@/utils/AppError.js';
import { isDuplicateKeyError } from '@/utils/db.js';
import type {
  ViewTargetType,
  ViewStatsFilter,
  ViewTimePoint,
  UserAnalytics,
  PostAnalytics,
  TopPostStat,
} from './view.types.js';

interface TopPostLean {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

function toTopPostStat(p: TopPostLean): TopPostStat {
  return {
    _id: p._id.toString(),
    title: p.title,
    slug: p.slug,
    viewCount: p.viewCount,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
  };
}

// ─── Shared aggregation helper (used by dashboard.service) ───────────────────

export async function getDailyViewStats(
  filter: ViewStatsFilter,
): Promise<ViewTimePoint[]> {
  const match: Record<string, unknown> = {
    date: { $gte: filter.startDate, $lte: filter.endDate },
  };
  if (filter.targetType) match.targetType = filter.targetType;
  if (filter.ownerId) match.ownerId = filter.ownerId;
  if (filter.targetId) match.targetId = filter.targetId;

  const results = await DailyViewStatModel.aggregate<{
    _id: string;
    views: number;
    uniqueViews: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: '$date',
        views: { $sum: '$views' },
        uniqueViews: { $sum: '$uniqueViews' },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', views: 1, uniqueViews: 1 } },
  ]);

  return results.map((r) => ({ date: r._id, views: r.views, uniqueViews: r.uniqueViews }));
}

// ─── View recording ───────────────────────────────────────────────────────────

export async function recordView(input: {
  targetType: ViewTargetType;
  targetId: string;
  viewerKey: string;
  day: string;
  viewerId?: Types.ObjectId;
  viewerIsAdmin: boolean;
}): Promise<{ counted: boolean }> {
  let ownerId: Types.ObjectId;
  const targetObjectId = new Types.ObjectId(input.targetId);

  if (input.targetType === 'post') {
    const post = (await PostModel.findById(targetObjectId)
      .select('author status')
      .lean()) as { _id: Types.ObjectId; author: Types.ObjectId; status: string } | null;

    if (post?.status !== 'published') return { counted: false };

    // Skip: owner viewing their own post
    if (input.viewerId?.equals(post.author)) return { counted: false };

    ownerId = post.author;
  } else {
    const profile = (await ProfileModel.findById(targetObjectId)
      .select('_id')
      .lean()) as { _id: Types.ObjectId } | null;

    if (!profile) return { counted: false };

    // Skip: admin/owner viewing own profile
    if (input.viewerIsAdmin) return { counted: false };

    // Profile owner = site admin user
    const admin = (await UserModel.findOne({ role: 'admin' })
      .select('_id')
      .lean()) as { _id: Types.ObjectId } | null;
    ownerId = admin?._id ?? profile._id;
  }

  // Deduplication: one counted view per viewer per target per calendar day
  try {
    await ViewDedupeModel.create({
      targetType: input.targetType,
      targetId: targetObjectId,
      viewerKey: input.viewerKey,
      day: input.day,
    });
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) return { counted: false };
    throw err;
  }

  // Atomically increment viewCount on target and upsert DailyViewStat
  await Promise.all([
    input.targetType === 'post'
      ? PostModel.updateOne({ _id: targetObjectId }, { $inc: { viewCount: 1 } })
      : ProfileModel.updateOne({ _id: targetObjectId }, { $inc: { viewCount: 1 } }),
    DailyViewStatModel.updateOne(
      {
        targetType: input.targetType,
        targetId: targetObjectId,
        ownerId,
        date: input.day,
      },
      { $inc: { views: 1, uniqueViews: 1 } },
      { upsert: true },
    ),
  ]);

  return { counted: true };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDays(raw: unknown): number {
  const map: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
  const str = typeof raw === 'string' ? raw : '30d';
  return map[str] ?? 30;
}

export { parseDays };

export async function getUserAnalytics(
  userId: Types.ObjectId,
  days: number,
): Promise<UserAnalytics> {
  const today = new Date();
  const todayStr = dateStr(today);
  const startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  const startStr = dateStr(startDate);
  const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
  const prevStartStr = dateStr(prevStartDate);
  const prevEndStr = dateStr(new Date(startDate.getTime() - 86400000));

  const [
    profileSeries,
    postSeries,
    prevProfileSeries,
    prevPostSeries,
    followersPerDayRaw,
    prevFollowerCount,
    topByViews,
    topByLikes,
    topByComments,
  ] = await Promise.all([
    getDailyViewStats({ ownerId: userId, targetType: 'profile', startDate: startStr, endDate: todayStr }),
    getDailyViewStats({ ownerId: userId, targetType: 'post', startDate: startStr, endDate: todayStr }),
    getDailyViewStats({ ownerId: userId, targetType: 'profile', startDate: prevStartStr, endDate: prevEndStr }),
    getDailyViewStats({ ownerId: userId, targetType: 'post', startDate: prevStartStr, endDate: prevEndStr }),
    FollowModel.aggregate<{ _id: string; count: number }>([
      { $match: { following: userId, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    FollowModel.countDocuments({
      following: userId,
      createdAt: { $gte: prevStartDate, $lt: startDate },
    }),
    PostModel.find({ author: userId, status: 'published' })
      .sort({ viewCount: -1 })
      .limit(5)
      .select('_id title slug viewCount likeCount commentCount')
      .lean() as Promise<TopPostLean[]>,
    PostModel.find({ author: userId, status: 'published' })
      .sort({ likeCount: -1 })
      .limit(5)
      .select('_id title slug viewCount likeCount commentCount')
      .lean() as Promise<TopPostLean[]>,
    PostModel.find({ author: userId, status: 'published' })
      .sort({ commentCount: -1 })
      .limit(5)
      .select('_id title slug viewCount likeCount commentCount')
      .lean() as Promise<TopPostLean[]>,
  ]);

  const profileTotal = profileSeries.reduce((s, d) => s + d.views, 0);
  const postTotal = postSeries.reduce((s, d) => s + d.views, 0);
  const prevProfileTotal = prevProfileSeries.reduce((s, d) => s + d.views, 0);
  const prevPostTotal = prevPostSeries.reduce((s, d) => s + d.views, 0);
  const followersTotal = followersPerDayRaw.reduce((s, d) => s + d.count, 0);

  return {
    range: `${String(days)}d`,
    profileViews: {
      total: profileTotal,
      delta: profileTotal - prevProfileTotal,
      timeSeries: profileSeries,
    },
    postViews: {
      total: postTotal,
      delta: postTotal - prevPostTotal,
      timeSeries: postSeries,
    },
    followers: {
      total: followersTotal,
      delta: followersTotal - prevFollowerCount,
      perDay: followersPerDayRaw.map((d) => ({ date: d._id, count: d.count })),
    },
    topPosts: {
      byViews: topByViews.map(toTopPostStat),
      byLikes: topByLikes.map(toTopPostStat),
      byComments: topByComments.map(toTopPostStat),
    },
  };
}

export async function getPostAnalytics(
  postId: string,
  requesterId: Types.ObjectId,
  requesterRole: string,
  days: number,
): Promise<PostAnalytics> {
  const post = (await PostModel.findById(postId)
    .select('author')
    .lean()) as { _id: Types.ObjectId; author: Types.ObjectId } | null;

  if (!post) throw new AppError('Post not found', 404);
  if (!post.author.equals(requesterId) && requesterRole !== 'admin') {
    throw new AppError('You do not have permission to view this post\'s analytics', 403);
  }

  const today = new Date();
  const todayStr = dateStr(today);
  const startStr = dateStr(new Date(today.getTime() - days * 24 * 60 * 60 * 1000));

  const timeSeries = await getDailyViewStats({
    targetType: 'post',
    targetId: new Types.ObjectId(postId),
    startDate: startStr,
    endDate: todayStr,
  });

  return {
    postId,
    total: timeSeries.reduce((s, d) => s + d.views, 0),
    timeSeries,
  };
}
