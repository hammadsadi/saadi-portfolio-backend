import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { getPublicProfile, getAdminProfile, upsertProfile } from './profile.service.js';
import type { UpsertProfileInput } from './profile.validation.js';

export const getProfilePublicHandler: RequestHandler = catchAsync(async (_req, res) => {
  const profile = await getPublicProfile();
  sendResponse(res, { message: 'Profile retrieved', data: profile });
});

export const getProfileAdminHandler: RequestHandler = catchAsync(async (_req, res) => {
  const profile = await getAdminProfile();
  sendResponse(res, { message: 'Profile retrieved', data: profile });
});

export const upsertProfileHandler: RequestHandler = catchAsync(async (req, res) => {
  const profile = await upsertProfile(req.body as UpsertProfileInput);
  sendResponse(res, { message: 'Profile saved', data: profile });
});
