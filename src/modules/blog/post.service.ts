import type { Types } from 'mongoose';
import type { Request } from 'express';
import { PostModel } from './post.model.js';
import type { IPostDocument } from './post.types.js';
import type {
  CreatePostInput,
  UpdatePostInput,
  PublishPostInput,
  SchedulePostInput,
  UserCreatePostInput,
  UserUpdatePostInput,
  RejectPostInput,
} from './post.validation.js';
import { AppError } from '@/utils/AppError.js';
import { parsePagination, buildMeta } from '@/utils/pagination.js';
import type { PaginationMeta } from '@/utils/pagination.js';
import { sanitizeMarkdown, calculateReadingTime } from './blog.utils.js';
import { env } from '@/config/env.js';
import { SiteSettingsModel } from '@/modules/siteSettings/siteSettings.model.js';
import { UserModel } from '@/modules/user/user.model.js';
import {
  sendPostApprovedEmailTemplate,
  sendPostRejectedEmailTemplate,
} from '@/modules/email/email.templates.js';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let counter = 0;
  let exists: { _id: unknown } | null;

  do {
    if (counter > 0) candidate = `${base}-${String(counter)}`;
    const filter: Record<string, unknown> = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    exists = await PostModel.exists(filter);
    counter++;
  } while (exists !== null);

  return candidate;
}

export async function listPublicPosts(
  req: Request,
): Promise<{ items: IPostDocument[]; meta: PaginationMeta }> {
  const { page, limit, skip, search } = parsePagination(req);
  const rawSort = typeof req.query.sort === 'string' ? req.query.sort : 'latest';
  const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;

  const filter: Record<string, unknown> = {
    status: 'published',
    publishedAt: { $lte: new Date() },
  };
  if (search) filter.$text = { $search: search };
  if (tag) filter.tags = tag;
  if (category) filter.category = category;

  type SortSpec = Record<string, 1 | -1 | { $meta: 'textScore' }>;
  let sortArg: string | SortSpec;
  if (search) {
    sortArg = { score: { $meta: 'textScore' } };
  } else {
    sortArg = rawSort === 'popular' ? '-viewCount' : '-publishedAt';
  }

  const [items, total] = await Promise.all([
    PostModel.find(filter).sort(sortArg).skip(skip).limit(limit),
    PostModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function adminListPosts(
  req: Request,
): Promise<{ items: IPostDocument[]; meta: PaginationMeta }> {
  const { page, limit, skip, sort, search } = parsePagination(req);
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;

  const filter: Record<string, unknown> = {};
  if (search) filter.$text = { $search: search };
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (tag) filter.tags = tag;

  const [items, total] = await Promise.all([
    PostModel.find(filter).sort(sort).skip(skip).limit(limit),
    PostModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function getPostBySlug(slug: string): Promise<IPostDocument> {
  const post = await PostModel.findOne({
    slug,
    status: 'published',
    publishedAt: { $lte: new Date() },
  });
  if (!post) throw new AppError('Post not found', 404);
  return post;
}

export async function getRelatedPosts(slug: string): Promise<IPostDocument[]> {
  const post = await PostModel.findOne({ slug, status: 'published' });
  if (!post) throw new AppError('Post not found', 404);

  const filter: Record<string, unknown> = {
    _id: { $ne: post._id },
    status: 'published',
    publishedAt: { $lte: new Date() },
  };

  const orClauses: Record<string, unknown>[] = [];
  if (post.category) orClauses.push({ category: post.category });
  if (post.tags.length > 0) orClauses.push({ tags: { $in: post.tags } });
  if (orClauses.length > 0) filter.$or = orClauses;

  return PostModel.find(filter).sort({ publishedAt: -1 }).limit(3);
}

export async function getPostByIdAdmin(id: string): Promise<IPostDocument> {
  const post = await PostModel.findById(id);
  if (!post) throw new AppError('Post not found', 404);
  return post;
}

export async function createPost(
  data: CreatePostInput,
  authorId: Types.ObjectId,
): Promise<IPostDocument> {
  const sanitized = sanitizeMarkdown(data.content);
  const readingTime = calculateReadingTime(sanitized);
  const baseSlug = data.slug ?? slugify(data.title);
  const slug = await ensureUniqueSlug(baseSlug);

  const publishedAt =
    data.status === 'published' ? (data.scheduledAt ? new Date(data.scheduledAt) : new Date()) : undefined;

  return PostModel.create({
    ...data,
    slug,
    content: sanitized,
    readingTime,
    author: authorId,
    publishedAt,
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
  });
}

export async function updatePost(id: string, data: UpdatePostInput): Promise<IPostDocument> {
  const patch: Record<string, unknown> = { ...data };

  if (data.content) {
    patch.content = sanitizeMarkdown(data.content);
    patch.readingTime = calculateReadingTime(patch.content as string);
  }

  if (data.slug) {
    patch.slug = await ensureUniqueSlug(data.slug, id);
  } else if (data.title) {
    const existing = await PostModel.findById(id).select('slug title');
    if (existing && existing.title !== data.title) {
      patch.slug = await ensureUniqueSlug(slugify(data.title), id);
    }
  }

  if (data.scheduledAt) patch.scheduledAt = new Date(data.scheduledAt);

  const post = await PostModel.findByIdAndUpdate(
    id,
    { $set: patch },
    { returnDocument: 'after', runValidators: true },
  );
  if (!post) throw new AppError('Post not found', 404);
  return post;
}

export async function deletePost(id: string): Promise<void> {
  const result = await PostModel.findByIdAndDelete(id);
  if (!result) throw new AppError('Post not found', 404);
}

export async function publishPost(id: string, data: PublishPostInput): Promise<IPostDocument> {
  const publishedAt = data.publishedAt ? new Date(data.publishedAt) : new Date();
  const post = await PostModel.findByIdAndUpdate(
    id,
    { $set: { status: 'published', publishedAt, scheduledAt: undefined } },
    { returnDocument: 'after' },
  );
  if (!post) throw new AppError('Post not found', 404);
  return post;
}

export async function unpublishPost(id: string): Promise<IPostDocument> {
  const post = await PostModel.findByIdAndUpdate(
    id,
    { $set: { status: 'draft' }, $unset: { publishedAt: '', scheduledAt: '' } },
    { returnDocument: 'after' },
  );
  if (!post) throw new AppError('Post not found', 404);
  return post;
}

export async function schedulePost(id: string, data: SchedulePostInput): Promise<IPostDocument> {
  const post = await PostModel.findByIdAndUpdate(
    id,
    { $set: { status: 'scheduled', scheduledAt: new Date(data.scheduledAt) } },
    { returnDocument: 'after' },
  );
  if (!post) throw new AppError('Post not found', 404);
  return post;
}

export async function publishScheduledPosts(): Promise<number> {
  const now = new Date();
  const posts = (await PostModel.find(
    { status: 'scheduled', scheduledAt: { $lte: now } },
  ).select('_id scheduledAt').lean()) as { _id: Types.ObjectId; scheduledAt?: Date }[];

  if (posts.length === 0) return 0;

  await PostModel.bulkWrite(
    posts.map((post) => ({
      updateOne: {
        filter: { _id: post._id },
        update: { $set: { status: 'published', publishedAt: post.scheduledAt ?? now } },
      },
    })),
  );

  return posts.length;
}

export async function getPostsForRss(): Promise<IPostDocument[]> {
  return PostModel.find({ status: 'published', publishedAt: { $lte: new Date() } })
    .sort({ publishedAt: -1 })
    .limit(20)
    .select('title slug excerpt publishedAt');
}

// ─── User authoring ──────────────────────────────────────────────────────────

export async function createUserPost(
  data: UserCreatePostInput,
  authorId: Types.ObjectId,
  isAdmin: boolean,
): Promise<IPostDocument> {
  const sanitized = sanitizeMarkdown(data.content);
  const readingTime = calculateReadingTime(sanitized);
  const baseSlug = slugify(data.title);
  const slug = await ensureUniqueSlug(baseSlug);

  let status: 'published' | 'pending';
  let publishedAt: Date | undefined;

  if (isAdmin) {
    status = 'published';
    publishedAt = new Date();
  } else {
    const settings = (await SiteSettingsModel.findOne({})
      .select('featureFlags')
      .lean()) as { featureFlags?: { userPostsModeration?: boolean } } | null;
    const moderation = settings?.featureFlags?.userPostsModeration ?? false;
    status = moderation ? 'pending' : 'published';
    publishedAt = status === 'published' ? new Date() : undefined;
  }

  return PostModel.create({
    ...data,
    slug,
    content: sanitized,
    readingTime,
    author: authorId,
    status,
    publishedAt,
  });
}

export async function listOwnPosts(
  userId: Types.ObjectId,
  req: Request,
): Promise<{ items: IPostDocument[]; meta: PaginationMeta }> {
  const { page, limit, skip, sort } = parsePagination(req);
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  const filter: Record<string, unknown> = { author: userId };
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    PostModel.find(filter).sort(sort).skip(skip).limit(limit),
    PostModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function updateOwnPost(
  id: string,
  userId: Types.ObjectId,
  data: UserUpdatePostInput,
): Promise<IPostDocument> {
  const post = await PostModel.findById(id).select('author');
  if (!post) throw new AppError('Post not found', 404);
  if (!post.author.equals(userId)) throw new AppError('You do not have permission to perform this action', 403);
  return updatePost(id, data);
}

export async function deleteOwnPost(id: string, userId: Types.ObjectId): Promise<void> {
  const post = await PostModel.findById(id).select('author');
  if (!post) throw new AppError('Post not found', 404);
  if (!post.author.equals(userId)) throw new AppError('You do not have permission to perform this action', 403);
  await PostModel.findByIdAndDelete(post._id);
}

// ─── Admin moderation ─────────────────────────────────────────────────────────

export async function approvePost(id: string): Promise<IPostDocument> {
  const post = await PostModel.findById(id);
  if (!post) throw new AppError('Post not found', 404);
  if (post.status !== 'pending') throw new AppError('Post is not pending approval', 400);

  const updated = await PostModel.findByIdAndUpdate(
    id,
    { $set: { status: 'published', publishedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new AppError('Post not found', 404);

  const author = (await UserModel.findById(updated.author)
    .select('email name')
    .lean()) as { email: string; name: string } | null;
  if (author) {
    void sendPostApprovedEmailTemplate({
      to: author.email,
      authorName: author.name,
      postTitle: updated.title,
      postUrl: `${env.CLIENT_URL}/blog/${updated.slug}`,
    }).catch((err: unknown) => {
      console.error('Failed to send post approved email:', err);
    });
  }

  return updated;
}

export async function rejectPost(id: string, data: RejectPostInput): Promise<IPostDocument> {
  const post = await PostModel.findById(id);
  if (!post) throw new AppError('Post not found', 404);
  if (post.status !== 'pending') throw new AppError('Post is not pending approval', 400);

  const updated = await PostModel.findByIdAndUpdate(
    id,
    { $set: { status: 'draft' } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new AppError('Post not found', 404);

  const author = (await UserModel.findById(updated.author)
    .select('email name')
    .lean()) as { email: string; name: string } | null;
  if (author) {
    void sendPostRejectedEmailTemplate({
      to: author.email,
      authorName: author.name,
      postTitle: updated.title,
      reason: data.reason ?? 'No specific reason provided.',
    }).catch((err: unknown) => {
      console.error('Failed to send post rejected email:', err);
    });
  }

  return updated;
}

// ─── Trending score recomputation ─────────────────────────────────────────────
//
// Trending score formula (documented here for reference):
//   score = (likeCount * 2 + commentCount * 3 + viewCount * 0.5) / (ageInHours + 2)^1.5
//
// Weights: comments > likes > views (comments signal deeper engagement).
// Denominator: power decay — posts drop faster than linear. +2 prevents
// division-by-zero for posts published in the last two hours.

export async function recomputeTrendingScores(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const posts = (await PostModel.find({
    status: 'published',
    publishedAt: { $gte: thirtyDaysAgo },
  })
    .select('_id likeCount commentCount viewCount publishedAt')
    .lean()) as {
    _id: Types.ObjectId;
    likeCount: number;
    commentCount: number;
    viewCount: number;
    publishedAt?: Date;
  }[];

  if (posts.length === 0) return 0;

  const now = Date.now();
  const ops = posts.map((post) => {
    const ageInHours = (now - (post.publishedAt?.getTime() ?? now)) / (1000 * 60 * 60);
    const score =
      (post.likeCount * 2 + post.commentCount * 3 + post.viewCount * 0.5) /
      Math.pow(ageInHours + 2, 1.5);
    return {
      updateOne: {
        filter: { _id: post._id },
        update: { $set: { trendingScore: score } },
      },
    };
  });

  await PostModel.bulkWrite(ops);
  return posts.length;
}

export function buildRssFeed(posts: IPostDocument[]): string {
  const { SERVER_URL, CLIENT_URL } = env;

  const items = posts
    .map((post) => {
      const pubDate = post.publishedAt ? post.publishedAt.toUTCString() : new Date().toUTCString();
      return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${CLIENT_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${CLIENT_URL}/blog/${post.slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${post.excerpt}]]></description>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[Hammad Sadi — Blog]]></title>
    <link>${CLIENT_URL}/blog</link>
    <description><![CDATA[Articles on web development, AI engineering, and software craftsmanship by Hammad Sadi]]></description>
    <language>en-us</language>
    <atom:link href="${SERVER_URL}/api/v1/posts/feed" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
