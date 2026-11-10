import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import {
  getPublicSiteSettings,
  getAdminSiteSettings,
  upsertSiteSettings,
  patchSiteSettings,
} from './siteSettings.service.js';
import type { UpsertSiteSettingsInput, PatchSiteSettingsInput } from './siteSettings.validation.js';

export const getSiteSettingsPublicHandler: RequestHandler = catchAsync(async (_req, res) => {
  const settings = await getPublicSiteSettings();
  sendResponse(res, { message: 'Site settings retrieved', data: settings });
});

export const getSiteSettingsAdminHandler: RequestHandler = catchAsync(async (_req, res) => {
  const settings = await getAdminSiteSettings();
  sendResponse(res, { message: 'Site settings retrieved', data: settings });
});

export const upsertSiteSettingsHandler: RequestHandler = catchAsync(async (req, res) => {
  const settings = await upsertSiteSettings(req.body as UpsertSiteSettingsInput);
  sendResponse(res, { message: 'Site settings saved', data: settings });
});

export const patchSiteSettingsHandler: RequestHandler = catchAsync(async (req, res) => {
  const settings = await patchSiteSettings(req.body as PatchSiteSettingsInput);
  sendResponse(res, { message: 'Site settings updated', data: settings });
});
