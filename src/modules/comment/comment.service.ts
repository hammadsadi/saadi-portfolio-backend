import { Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { CommentModel } from './comment.model.js';
import { PostModel } from '@/modules/blog/post.model.js';
import type { IComment, ICommentAuthor, CommentResult, CursorPaginationMeta } from './comment.types.js';
import type { CreateCommentInput, UpdateCommentInput } from './comment.validation.js';
import { AppError } from '@/utils/AppError.js';
import { buildMeta } from '@/utils/pagination.js';
import type { PaginationMeta } from '@/utils/pagination.js';
import { getLikedSet } from '@/modules/like/like.service.js';
import { sanitizeMarkdown } from '@/modules/blog/blog.utils.js';

type PopulatedCommentDoc = HydratedDocument<Omit<IComment, 'user'> & { user: ICommentAuthor }>;

function toResult(doc: PopulatedCommentDoc, likedSet: Set<string>): CommentResult {
  return {
    _id: doc._id,
    post: doc.post,
    user: doc.isDeleted ? null : doc.user,
    parent: doc.parent,
    content: doc.isDeleted ? '[deleted]' : doc.content,
    likeCount: doc.likeCount,
    replyCount: doc.replyCount,
    isEdited: doc.isEdited,
    isDeleted: doc.isDeleted,
    likedByMe: likedSet.has(doc._id.toString()),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function fetchAndEnrich(
  filter: Record<string, unknown>,
  sort: Record<string, 1 | -1>,
  skip: number,
  limit: number,
): Promise<PopulatedCommentDoc[]> {
  return CommentModel.find(filter)
    .populate<{ user: ICommentAuthor }>('user', 'name avatar')
    .sort(sort)
    .skip(skip)
    .limit(limit) as unknown as Promise<PopulatedCommentDoc[]>;
}

export async function listTopLevelComments(
  postId: string,
  page: number,
  limit: number,
  userId?: Types.ObjectId,
): Promise<{ items: CommentResult[]; meta: PaginationMeta }> {
  const postObjectId = new Types.ObjectId(postId);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    post: postObjectId,
    parent: null,
    $or: [{ isDeleted: false }, { isDeleted: true, replyCount: { $gt: 0 } }],
  };

  const [docs, total] = await Promise.all([
    fetchAndEnrich(filter, { createdAt: -1 }, skip, limit),
    CommentModel.countDocuments(filter),
  ]);

  const likedSet = userId ? await getLikedSet(userId, 'comment', docs.map((d) => d._id)) : new Set<string>();
  const items = docs.map((doc) => toResult(doc, likedSet));

  return { items, meta: buildMeta(total, page, limit) };
}

export async function listReplies(
  commentId: string,
  cursor: string | undefined,
  limit: number,
  userId?: Types.ObjectId,
): Promise<{ items: CommentResult[]; meta: CursorPaginationMeta }> {
  const parentObjectId = new Types.ObjectId(commentId);

  const filter: Record<string, unknown> = {
    parent: parentObjectId,
    $or: [{ isDeleted: false }, { isDeleted: true, replyCount: { $gt: 0 } }],
  };
  if (cursor) filter._id = { $gt: new Types.ObjectId(cursor) };

  const docs = await fetchAndEnrich(filter, { _id: 1 }, 0, limit + 1);

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? (page.at(-1)?._id.toString() ?? null) : null;

  const likedSet = userId ? await getLikedSet(userId, 'comment', page.map((d) => d._id)) : new Set<string>();
  const items = page.map((doc) => toResult(doc, likedSet));

  return { items, meta: { hasMore, nextCursor } };
}

export async function createComment(
  data: CreateCommentInput,
  userId: Types.ObjectId,
): Promise<CommentResult> {
  const postObjectId = new Types.ObjectId(data.postId);
  const parentObjectId = data.parentId ? new Types.ObjectId(data.parentId) : null;

  const post = await PostModel.findOne({ _id: postObjectId, status: 'published' });
  if (!post) throw new AppError('Post not found', 404);

  if (parentObjectId) {
    const parent = await CommentModel.findOne({ _id: parentObjectId, post: postObjectId, isDeleted: false });
    if (!parent) throw new AppError('Parent comment not found', 404);
  }

  const recentDuplicate = await CommentModel.findOne({
    post: postObjectId,
    user: userId,
    content: data.content,
    createdAt: { $gte: new Date(Date.now() - 60_000) },
  });
  if (recentDuplicate) throw new AppError('Duplicate comment detected. Please wait before posting again.', 429);

  const comment = await CommentModel.create({
    post: postObjectId,
    user: userId,
    parent: parentObjectId,
    content: sanitizeMarkdown(data.content),
  });

  await PostModel.updateOne({ _id: postObjectId }, { $inc: { commentCount: 1 } });
  if (parentObjectId) {
    await CommentModel.updateOne({ _id: parentObjectId }, { $inc: { replyCount: 1 } });
  }

  const populated = await CommentModel.findById(comment._id)
    .populate<{ user: ICommentAuthor }>('user', 'name avatar') as unknown as PopulatedCommentDoc;

  return toResult(populated, new Set<string>());
}

export async function updateComment(
  commentId: string,
  userId: Types.ObjectId,
  data: UpdateCommentInput,
): Promise<CommentResult> {
  const comment = await CommentModel.findById(commentId)
    .populate<{ user: ICommentAuthor }>('user', 'name avatar') as unknown as PopulatedCommentDoc | null;

  if (!comment) throw new AppError('Comment not found', 404);
  if (comment.isDeleted) throw new AppError('Cannot edit a deleted comment', 400);
  if (comment.user._id.toString() !== userId.toString()) {
    throw new AppError('You can only edit your own comments', 403);
  }

  comment.content = sanitizeMarkdown(data.content);
  comment.isEdited = true;
  await (comment as unknown as { save: () => Promise<void> }).save();

  return toResult(comment, new Set<string>());
}

export async function deleteComment(
  commentId: string,
  userId: Types.ObjectId,
  role: string,
): Promise<void> {
  const comment = await CommentModel.findById(commentId);
  if (!comment) throw new AppError('Comment not found', 404);
  if (comment.isDeleted) throw new AppError('Comment already deleted', 400);

  const isOwner = comment.user.toString() === userId.toString();
  if (!isOwner && role !== 'admin') {
    throw new AppError('You can only delete your own comments', 403);
  }

  await CommentModel.updateOne({ _id: comment._id }, { $set: { isDeleted: true } });
  await PostModel.updateOne({ _id: comment.post }, { $inc: { commentCount: -1 } });
  if (comment.parent) {
    await CommentModel.updateOne({ _id: comment.parent }, { $inc: { replyCount: -1 } });
  }
}

export async function adminListComments(
  postId: string,
  page: number,
  limit: number,
): Promise<{ items: CommentResult[]; meta: PaginationMeta }> {
  const postObjectId = new Types.ObjectId(postId);
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = { post: postObjectId };

  const [docs, total] = await Promise.all([
    fetchAndEnrich(filter, { createdAt: -1 }, skip, limit),
    CommentModel.countDocuments(filter),
  ]);

  const items = docs.map((doc) => toResult(doc, new Set<string>()));
  return { items, meta: buildMeta(total, page, limit) };
}

export async function adminHardDeleteComment(commentId: string): Promise<void> {
  const comment = await CommentModel.findByIdAndDelete(commentId);
  if (!comment) throw new AppError('Comment not found', 404);

  if (!comment.isDeleted) {
    await PostModel.updateOne({ _id: comment.post }, { $inc: { commentCount: -1 } });
    if (comment.parent) {
      await CommentModel.updateOne({ _id: comment.parent }, { $inc: { replyCount: -1 } });
    }
  }
}
