import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import { getLikedSet } from '@/modules/like/like.service.js';
import {
  listPublicPosts,
  adminListPosts,
  getPostBySlug,
  getRelatedPosts,
  getPostByIdAdmin,
  createPost,
  updatePost,
  deletePost,
  publishPost,
  unpublishPost,
  schedulePost,
  publishScheduledPosts,
  getPostsForRss,
  buildRssFeed,
  createUserPost,
  listOwnPosts,
  updateOwnPost,
  deleteOwnPost,
  approvePost,
  rejectPost,
  recomputeTrendingScores,
} from './post.service.js';
import type {
  CreatePostInput,
  UpdatePostInput,
  PublishPostInput,
  SchedulePostInput,
  UserCreatePostInput,
  UserUpdatePostInput,
  RejectPostInput,
} from './post.validation.js';

export const listPostsPublicHandler: RequestHandler = catchAsync(async (req, res) => {
  const { items, meta } = await listPublicPosts(req);
  const likedSet = req.user
    ? await getLikedSet(req.user._id, 'post', items.map((p) => p._id))
    : new Set<string>();
  const data = items.map((p) => ({ ...p.toObject(), likedByMe: likedSet.has(p._id.toString()) }));
  sendResponse(res, { message: 'Posts retrieved', data, meta: { ...meta } });
});

export const listPostsAdminHandler: RequestHandler = catchAsync(async (req, res) => {
  const { items, meta } = await adminListPosts(req);
  sendResponse(res, { message: 'Posts retrieved', data: items, meta: { ...meta } });
});

export const getPostBySlugHandler: RequestHandler = catchAsync(async (req, res) => {
  const { slug } = req.params as { slug: string };
  const post = await getPostBySlug(slug);
  const likedSet = req.user ? await getLikedSet(req.user._id, 'post', [post._id]) : new Set<string>();
  sendResponse(res, { message: 'Post retrieved', data: { ...post.toObject(), likedByMe: likedSet.has(post._id.toString()) } });
});

export const getRelatedPostsHandler: RequestHandler = catchAsync(async (req, res) => {
  const { slug } = req.params as { slug: string };
  const posts = await getRelatedPosts(slug);
  sendResponse(res, { message: 'Related posts retrieved', data: posts });
});

export const getPostByIdAdminHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const post = await getPostByIdAdmin(id);
  sendResponse(res, { message: 'Post retrieved', data: post });
});

export const createPostHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const post = await createPost(req.body as CreatePostInput, req.user._id);
  sendResponse(res, { statusCode: 201, message: 'Post created', data: post });
});

export const updatePostHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const post = await updatePost(id, req.body as UpdatePostInput);
  sendResponse(res, { message: 'Post updated', data: post });
});

export const deletePostHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  await deletePost(id);
  sendResponse(res, { message: 'Post deleted' });
});

export const publishPostHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const post = await publishPost(id, req.body as PublishPostInput);
  sendResponse(res, { message: 'Post published', data: post });
});

export const unpublishPostHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const post = await unpublishPost(id);
  sendResponse(res, { message: 'Post unpublished', data: post });
});

export const schedulePostHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const post = await schedulePost(id, req.body as SchedulePostInput);
  sendResponse(res, { message: 'Post scheduled', data: post });
});

export const publishScheduledPostsHandler: RequestHandler = catchAsync(async (_req, res) => {
  const count = await publishScheduledPosts();
  sendResponse(res, { message: `Published ${String(count)} scheduled post(s)`, data: { count } });
});

export const getRssFeedHandler: RequestHandler = catchAsync(async (_req, res) => {
  const posts = await getPostsForRss();
  const rss = buildRssFeed(posts);
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(rss);
});

// ─── User authoring handlers ──────────────────────────────────────────────────

export const listOwnPostsHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const { items, meta } = await listOwnPosts(req.user._id, req);
  sendResponse(res, { message: 'Your posts retrieved', data: items, meta: { ...meta } });
});

export const createOwnPostHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const post = await createUserPost(
    req.body as UserCreatePostInput,
    req.user._id,
    req.user.role === 'admin',
  );
  sendResponse(res, { statusCode: 201, message: 'Post created', data: post });
});

export const updateOwnPostHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const { id } = req.params as { id: string };
  const post = await updateOwnPost(id, req.user._id, req.body as UserUpdatePostInput);
  sendResponse(res, { message: 'Post updated', data: post });
});

export const deleteOwnPostHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const { id } = req.params as { id: string };
  await deleteOwnPost(id, req.user._id);
  sendResponse(res, { message: 'Post deleted' });
});

// ─── Admin moderation handlers ────────────────────────────────────────────────

export const approvePostHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const post = await approvePost(id);
  sendResponse(res, { message: 'Post approved and published', data: post });
});

export const rejectPostHandler: RequestHandler = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const post = await rejectPost(id, req.body as RejectPostInput);
  sendResponse(res, { message: 'Post rejected and returned to drafts', data: post });
});

// ─── Cron handler ─────────────────────────────────────────────────────────────

export const recomputeTrendingScoresHandler: RequestHandler = catchAsync(async (_req, res) => {
  const count = await recomputeTrendingScores();
  sendResponse(res, { message: `Recomputed trending scores for ${String(count)} post(s)`, data: { count } });
});
