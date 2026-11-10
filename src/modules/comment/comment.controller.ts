import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import {
  listTopLevelComments,
  listReplies,
  createComment,
  updateComment,
  deleteComment,
  adminListComments,
  adminHardDeleteComment,
} from './comment.service.js';
import type {
  CreateCommentInput,
  UpdateCommentInput,
  ListCommentsQuery,
  ListRepliesQuery,
} from './comment.validation.js';

export const listCommentsHandler: RequestHandler = catchAsync(async (req, res) => {
  const { postId, page, limit } = req.query as unknown as ListCommentsQuery;
  const { items, meta } = await listTopLevelComments(postId, page, limit, req.user?._id);
  sendResponse(res, { message: 'Comments retrieved', data: items, meta: { ...meta } });
});

export const listRepliesHandler: RequestHandler = catchAsync(async (req, res) => {
  const { commentId } = req.params as { commentId: string };
  const { cursor, limit } = req.query as unknown as ListRepliesQuery;
  const { items, meta } = await listReplies(commentId, cursor, limit, req.user?._id);
  sendResponse(res, { message: 'Replies retrieved', data: items, meta: { ...meta } });
});

export const createCommentHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const comment = await createComment(req.body as CreateCommentInput, req.user._id);
  sendResponse(res, { statusCode: 201, message: 'Comment created', data: comment });
});

export const updateCommentHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const { commentId } = req.params as { commentId: string };
  const comment = await updateComment(commentId, req.user._id, req.body as UpdateCommentInput);
  sendResponse(res, { message: 'Comment updated', data: comment });
});

export const deleteCommentHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const { commentId } = req.params as { commentId: string };
  await deleteComment(commentId, req.user._id, req.user.role);
  sendResponse(res, { message: 'Comment deleted' });
});

export const adminListCommentsHandler: RequestHandler = catchAsync(async (req, res) => {
  const postId = typeof req.query.postId === 'string' ? req.query.postId : '';
  if (!postId) throw new AppError('postId is required', 400);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const { items, meta } = await adminListComments(postId, page, limit);
  sendResponse(res, { message: 'Comments retrieved', data: items, meta: { ...meta } });
});

export const adminHardDeleteCommentHandler: RequestHandler = catchAsync(async (req, res) => {
  const { commentId } = req.params as { commentId: string };
  await adminHardDeleteComment(commentId);
  sendResponse(res, { message: 'Comment permanently deleted' });
});
