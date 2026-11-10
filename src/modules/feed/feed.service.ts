import { Types } from 'mongoose';
import { PostModel } from '@/modules/blog/post.model.js';
import { FollowModel } from '@/modules/follow/follow.model.js';
import { LikeModel } from '@/modules/like/like.model.js';
import type {
  FeedItem,
  FeedCursorMeta,
  FollowingFeedResult,
  TrendingFeedResult,
  TrendingRange,
} from './feed.types.js';

// ─── Internal types ───────────────────────────────────────────────────────────

interface FeedAggResult {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: string;
  tags: string[];
  category?: string;
  publishedAt: Date;
  readingTime: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  trendingScore: number;
  author: {
    _id: Types.ObjectId;
    name: string;
    avatar?: string;
  };
}

interface FollowingCursorData { p: string; i: string; }
interface TrendingCursorData { s: number; i: string; }

function isFollowingCursorData(val: unknown): val is FollowingCursorData {
  return typeof val === 'object' && val !== null && 'p' in val && 'i' in val;
}

function isTrendingCursorData(val: unknown): val is TrendingCursorData {
  return typeof val === 'object' && val !== null && 's' in val && 'i' in val;
}

function encodeFollowingCursor(doc: FeedAggResult): string {
  const data: FollowingCursorData = { p: doc.publishedAt.toISOString(), i: doc._id.toString() };
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeFollowingCursor(cursor: string): { publishedAt: Date; _id: Types.ObjectId } | null {
  try {
    const raw: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!isFollowingCursorData(raw)) return null;
    return { publishedAt: new Date(raw.p), _id: new Types.ObjectId(raw.i) };
  } catch {
    return null;
  }
}

function encodeTrendingCursor(doc: FeedAggResult): string {
  const data: TrendingCursorData = { s: doc.trendingScore, i: doc._id.toString() };
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeTrendingCursor(cursor: string): { trendingScore: number; _id: Types.ObjectId } | null {
  try {
    const raw: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!isTrendingCursorData(raw)) return null;
    return { trendingScore: raw.s, _id: new Types.ObjectId(raw.i) };
  } catch {
    return null;
  }
}

function getRangeStart(range: TrendingRange): Date {
  const ms: Record<TrendingRange, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() - ms[range]);
}

// Shared $lookup + $project pipeline stages appended after $match/$sort/$limit
const lookupAndProjectStages = [
  {
    $lookup: {
      from: 'users',
      localField: 'author',
      foreignField: '_id',
      as: 'authorDoc',
      pipeline: [{ $project: { _id: 1, name: 1, avatar: 1 } }],
    },
  },
  { $unwind: '$authorDoc' },
  {
    $project: {
      _id: 1,
      title: 1,
      slug: 1,
      excerpt: 1,
      coverImage: 1,
      tags: 1,
      category: 1,
      publishedAt: 1,
      readingTime: 1,
      viewCount: 1,
      likeCount: 1,
      commentCount: 1,
      trendingScore: 1,
      author: '$authorDoc',
    },
  },
];

async function buildLikedSet(
  viewerId: Types.ObjectId | undefined,
  postIds: Types.ObjectId[],
): Promise<Set<string>> {
  if (!viewerId || postIds.length === 0) return new Set<string>();
  const liked = (await LikeModel.find({
    user: viewerId,
    targetType: 'post',
    targetId: { $in: postIds },
  })
    .select('targetId')
    .lean()) as { targetId: Types.ObjectId }[];
  return new Set(liked.map((l) => l.targetId.toString()));
}

function toFeedItem(doc: FeedAggResult, likedSet: Set<string>): FeedItem {
  return {
    _id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    coverImage: doc.coverImage ?? null,
    tags: doc.tags,
    category: doc.category ?? null,
    publishedAt: doc.publishedAt,
    readingTime: doc.readingTime,
    viewCount: doc.viewCount,
    likeCount: doc.likeCount,
    commentCount: doc.commentCount,
    trendingScore: doc.trendingScore,
    author: {
      _id: doc.author._id.toString(),
      name: doc.author.name,
      avatar: doc.author.avatar ?? null,
    },
    likedByMe: likedSet.has(doc._id.toString()),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getFollowingFeed(
  userId: Types.ObjectId,
  cursor: string | undefined,
  limit: number,
): Promise<FollowingFeedResult> {
  const followDocs = (await FollowModel.find({ follower: userId })
    .select('following')
    .lean()) as { following: Types.ObjectId }[];
  const followedIds = followDocs.map((d) => d.following);
  const followsNobody = followedIds.length === 0;

  const baseCondition: Record<string, unknown> = {
    $or: [{ author: { $in: followedIds } }, { author: userId }],
    status: 'published',
    publishedAt: { $lte: new Date() },
  };

  const matchConditions: Record<string, unknown>[] = [baseCondition];

  if (cursor) {
    const decoded = decodeFollowingCursor(cursor);
    if (decoded) {
      matchConditions.push({
        $or: [
          { publishedAt: { $lt: decoded.publishedAt } },
          { publishedAt: decoded.publishedAt, _id: { $lt: decoded._id } },
        ],
      });
    }
  }

  const docs = await PostModel.aggregate<FeedAggResult>([
    { $match: { $and: matchConditions } },
    { $sort: { publishedAt: -1, _id: -1 } },
    { $limit: limit + 1 },
    ...lookupAndProjectStages,
  ]);

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const lastDoc = page.at(-1);
  const nextCursor = hasMore && lastDoc ? encodeFollowingCursor(lastDoc) : null;

  const likedSet = await buildLikedSet(userId, page.map((d) => d._id));

  return {
    items: page.map((d) => toFeedItem(d, likedSet)),
    meta: { hasMore, nextCursor } satisfies FeedCursorMeta,
    followsNobody,
  };
}

export async function getTrendingFeed(
  cursor: string | undefined,
  limit: number,
  range: TrendingRange | undefined,
  viewerId: Types.ObjectId | undefined,
): Promise<TrendingFeedResult> {
  const matchConditions: Record<string, unknown>[] = [
    { status: 'published', publishedAt: { $lte: new Date() } },
  ];

  if (range) {
    matchConditions.push({ publishedAt: { $gte: getRangeStart(range) } });
  }

  if (cursor) {
    const decoded = decodeTrendingCursor(cursor);
    if (decoded) {
      matchConditions.push({
        $or: [
          { trendingScore: { $lt: decoded.trendingScore } },
          { trendingScore: decoded.trendingScore, _id: { $lt: decoded._id } },
        ],
      });
    }
  }

  const docs = await PostModel.aggregate<FeedAggResult>([
    { $match: { $and: matchConditions } },
    { $sort: { trendingScore: -1, _id: -1 } },
    { $limit: limit + 1 },
    ...lookupAndProjectStages,
  ]);

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const lastDoc = page.at(-1);
  const nextCursor = hasMore && lastDoc ? encodeTrendingCursor(lastDoc) : null;

  const likedSet = await buildLikedSet(viewerId, page.map((d) => d._id));

  return {
    items: page.map((d) => toFeedItem(d, likedSet)),
    meta: { hasMore, nextCursor } satisfies FeedCursorMeta,
  };
}
