import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import {
  listCategories,
  upsertCategory,
  updateCategory,
  deleteCategory,
} from './category.service.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.validation.js';

export const listCategoriesHandler: RequestHandler = catchAsync(async (_req, res) => {
  const cats = await listCategories();
  sendResponse(res, { message: 'Categories retrieved', data: cats });
});

export const upsertCategoryHandler: RequestHandler = catchAsync(async (req, res) => {
  const cat = await upsertCategory(req.body as CreateCategoryInput);
  sendResponse(res, { statusCode: 201, message: 'Category upserted', data: cat });
});

export const updateCategoryHandler: RequestHandler = catchAsync(async (req, res) => {
  const { slug } = req.params as { slug: string };
  const cat = await updateCategory(slug, req.body as UpdateCategoryInput);
  sendResponse(res, { message: 'Category updated', data: cat });
});

export const deleteCategoryHandler: RequestHandler = catchAsync(async (req, res) => {
  const { slug } = req.params as { slug: string };
  await deleteCategory(slug);
  sendResponse(res, { message: 'Category deleted' });
});
