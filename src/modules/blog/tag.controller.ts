import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { listTags, upsertTag, updateTag, deleteTag } from './tag.service.js';
import type { CreateTagInput, UpdateTagInput } from './tag.validation.js';

export const listTagsHandler: RequestHandler = catchAsync(async (_req, res) => {
  const tags = await listTags();
  sendResponse(res, { message: 'Tags retrieved', data: tags });
});

export const upsertTagHandler: RequestHandler = catchAsync(async (req, res) => {
  const tag = await upsertTag(req.body as CreateTagInput);
  sendResponse(res, { statusCode: 201, message: 'Tag upserted', data: tag });
});

export const updateTagHandler: RequestHandler = catchAsync(async (req, res) => {
  const { slug } = req.params as { slug: string };
  const tag = await updateTag(slug, req.body as UpdateTagInput);
  sendResponse(res, { message: 'Tag updated', data: tag });
});

export const deleteTagHandler: RequestHandler = catchAsync(async (req, res) => {
  const { slug } = req.params as { slug: string };
  await deleteTag(slug);
  sendResponse(res, { message: 'Tag deleted' });
});
