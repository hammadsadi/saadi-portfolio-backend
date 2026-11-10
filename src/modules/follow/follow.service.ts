import { Types } from 'mongoose';
import { FollowModel } from './follow.model.js';
import { UserModel } from '@/modules/user/user.model.js';
import { AppError } from '@/utils/AppError.js';
import { isDuplicateKeyError } from '@/utils/db.js';
import { sendNewFollowerEmailTemplate } from '@/modules/email/email.templates.js';
import { env } from '@/config/env.js';
import type { FollowUserResult, SuggestionResult, FollowCursorMeta } from './follow.types.js';

const DAILY_EMAIL_CAP = 10;

async function getFollowerCount(userId: Types.ObjectId): Promise<number> {
  const doc = (await UserModel.findById(userId)
    .select('followerCount')
    .lean()) as { followerCount: number } | null;
  return doc?.followerCount ?? 0;
}

async function maybeNotifyNewFollower(
  targetUserId: Types.ObjectId,
  followerName: string,
  followerUserId: Types.ObjectId,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const target = (await UserModel.findById(targetUserId)
    .select('email name notificationPreferences followerEmailThrottle')
    .lean()) as {
    email: string;
    name: string;
    notificationPreferences?: { newFollower?: boolean };
    followerEmailThrottle?: { date: string; count: number };
  } | null;

  if (!target) return;
  if (!target.notificationPreferences?.newFollower) return;

  const throttle = target.followerEmailThrottle;
  let todayCount = 0;
  if (throttle?.date === today) {
    todayCount = throttle.count;
  }
  if (todayCount >= DAILY_EMAIL_CAP) return;

  await UserModel.updateOne(
    { _id: targetUserId },
    {
      $set: {
        'followerEmailThrottle.date': today,
        'followerEmailThrottle.count': todayCount + 1,
      },
    },
  );

  void sendNewFollowerEmailTemplate({
    to: target.email,
    recipientName: target.name,
    followerName,
    profileUrl: `${env.CLIENT_URL}/users/${String(followerUserId)}`,
    unsubscribeUrl: `${env.CLIENT_URL}/settings/notifications`,
  }).catch((err: unknown) => {
    console.error('Failed to send new follower email:', err);
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function followUser(
  followerId: Types.ObjectId,
  targetUserId: Types.ObjectId,
): Promise<{ isFollowing: boolean; followerCount: number }> {
  if (followerId.equals(targetUserId)) {
    throw new AppError('You cannot follow yourself', 400);
  }

  const target = (await UserModel.findById(targetUserId)
    .select('isBlocked isEmailVerified name followerCount')
    .lean()) as {
    isBlocked: boolean;
    isEmailVerified: boolean;
    name: string;
    followerCount: number;
  } | null;
  if (!target) throw new AppError('User not found', 404);
  if (target.isBlocked || !target.isEmailVerified) throw new AppError('User not found', 404);

  try {
    await FollowModel.create({ follower: followerId, following: targetUserId });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { isFollowing: true, followerCount: target.followerCount };
    }
    throw err;
  }

  await Promise.all([
    UserModel.updateOne({ _id: targetUserId }, { $inc: { followerCount: 1 } }),
    UserModel.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }),
  ]);

  const follower = (await UserModel.findById(followerId)
    .select('name')
    .lean()) as { name: string } | null;
  if (follower) {
    void maybeNotifyNewFollower(targetUserId, follower.name, followerId);
  }

  return { isFollowing: true, followerCount: target.followerCount + 1 };
}

export async function unfollowUser(
  followerId: Types.ObjectId,
  targetUserId: Types.ObjectId,
): Promise<{ isFollowing: boolean; followerCount: number }> {
  if (followerId.equals(targetUserId)) {
    throw new AppError('You cannot unfollow yourself', 400);
  }

  const deleted = await FollowModel.findOneAndDelete({
    follower: followerId,
    following: targetUserId,
  });

  const followerCount = await getFollowerCount(targetUserId);

  if (!deleted) {
    return { isFollowing: false, followerCount };
  }

  await Promise.all([
    UserModel.updateOne({ _id: targetUserId }, { $inc: { followerCount: -1 } }),
    UserModel.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } }),
  ]);

  return { isFollowing: false, followerCount: Math.max(0, followerCount - 1) };
}

export async function getFollowStatus(
  followerId: Types.ObjectId,
  targetUserId: Types.ObjectId,
): Promise<{ isFollowing: boolean; followerCount: number }> {
  const [followDoc, followerCount] = await Promise.all([
    FollowModel.findOne({ follower: followerId, following: targetUserId }).lean(),
    getFollowerCount(targetUserId),
  ]);
  return { isFollowing: followDoc !== null, followerCount };
}

interface PopulatedFollowUser {
  _id: Types.ObjectId;
  name: string;
  avatar: string | null;
  followerCount: number;
}

interface PopulatedFollowDoc {
  _id: Types.ObjectId;
  follower: PopulatedFollowUser;
  following: PopulatedFollowUser;
}

interface LeanFollowRef {
  following: Types.ObjectId;
}

export async function getFollowers(
  userId: Types.ObjectId,
  cursor: string | undefined,
  limit: number,
  viewerId?: Types.ObjectId,
): Promise<{ items: FollowUserResult[]; meta: FollowCursorMeta }> {
  const filter: Record<string, unknown> = { following: userId };
  if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

  const docs = (await FollowModel.find(filter)
    .populate('follower', 'name avatar followerCount')
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean()) as unknown as PopulatedFollowDoc[];

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? (page.at(-1)?._id.toString() ?? null) : null;

  const followerIds = page.map((d) => d.follower._id);
  const followingSet =
    viewerId !== undefined && followerIds.length > 0
      ? new Set(
          (
            (await FollowModel.find({ follower: viewerId, following: { $in: followerIds } })
              .select('following')
              .lean()) as unknown as LeanFollowRef[]
          ).map((f) => f.following.toString()),
        )
      : new Set<string>();

  return {
    items: page.map((d) => ({
      _id: d.follower._id.toString(),
      name: d.follower.name,
      avatar: d.follower.avatar,
      followerCount: d.follower.followerCount,
      isFollowedByMe: followingSet.has(d.follower._id.toString()),
    })),
    meta: { hasMore, nextCursor },
  };
}

export async function getFollowing(
  userId: Types.ObjectId,
  cursor: string | undefined,
  limit: number,
  viewerId?: Types.ObjectId,
): Promise<{ items: FollowUserResult[]; meta: FollowCursorMeta }> {
  const filter: Record<string, unknown> = { follower: userId };
  if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

  const docs = (await FollowModel.find(filter)
    .populate('following', 'name avatar followerCount')
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean()) as unknown as PopulatedFollowDoc[];

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? (page.at(-1)?._id.toString() ?? null) : null;

  const followingIds = page.map((d) => d.following._id);
  const followingSet =
    viewerId !== undefined && followingIds.length > 0
      ? new Set(
          (
            (await FollowModel.find({ follower: viewerId, following: { $in: followingIds } })
              .select('following')
              .lean()) as unknown as LeanFollowRef[]
          ).map((f) => f.following.toString()),
        )
      : new Set<string>();

  return {
    items: page.map((d) => ({
      _id: d.following._id.toString(),
      name: d.following.name,
      avatar: d.following.avatar,
      followerCount: d.following.followerCount,
      isFollowedByMe: followingSet.has(d.following._id.toString()),
    })),
    meta: { hasMore, nextCursor },
  };
}

interface FofAggResult {
  _id: { toString(): string };
  mutualCount: number;
  user: { name: string; avatar: string | null; followerCount: number };
}

interface PopularUser {
  _id: { toString(): string };
  name: string;
  avatar: string | null;
  followerCount: number;
}

export async function getSuggestions(
  userId: Types.ObjectId,
  limit: number,
): Promise<SuggestionResult[]> {
  const myFollows = await FollowModel.find({ follower: userId }).select('following').lean();
  const myFollowingIds = myFollows.map((f) => f.following);
  const excludeIds = [userId, ...myFollowingIds];

  const fofResults = await FollowModel.aggregate<FofAggResult>([
    { $match: { follower: { $in: myFollowingIds } } },
    { $match: { following: { $nin: excludeIds } } },
    { $group: { _id: '$following', mutualCount: { $sum: 1 } } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userDocs',
        pipeline: [
          { $match: { isBlocked: false, isEmailVerified: true } },
          { $project: { name: 1, avatar: 1, followerCount: 1 } },
        ],
      },
    },
    { $unwind: '$userDocs' },
    { $sort: { mutualCount: -1, 'userDocs.followerCount': -1 } },
    { $limit: limit },
    { $project: { _id: 1, mutualCount: 1, user: '$userDocs' } },
  ]);

  const suggestions: SuggestionResult[] = fofResults.map((r) => ({
    _id: r._id.toString(),
    name: r.user.name,
    avatar: r.user.avatar ?? null,
    followerCount: r.user.followerCount,
    mutualCount: r.mutualCount,
  }));

  if (suggestions.length < limit) {
    const fofObjectIds = fofResults.map((r) => r._id);
    const popular = (await UserModel.find({
      _id: { $nin: [...excludeIds, ...fofObjectIds] },
      isBlocked: false,
      isEmailVerified: true,
    })
      .sort({ followerCount: -1 })
      .limit(limit - suggestions.length)
      .select('name avatar followerCount')
      .lean()) as unknown as PopularUser[];

    for (const u of popular) {
      suggestions.push({
        _id: u._id.toString(),
        name: u.name,
        avatar: u.avatar ?? null,
        followerCount: u.followerCount,
        mutualCount: 0,
      });
    }
  }

  return suggestions;
}
