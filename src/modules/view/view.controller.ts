import { createHash, randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import { recordView, getUserAnalytics, getPostAnalytics, parseDays } from './view.service.js';

const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|lighthouse|headless|puppet|playwrig|selenium|wget|curl|facebookexternalhit|twitterbot/i;

const ANON_COOKIE = 'anon_vid';
const ANON_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashFallback(ip: string, ua: string, day: string): string {
  return createHash('sha256')
    .update(`${ip}|${ua}|${day}`)
    .digest('hex')
    .slice(0, 24);
}

export const recordViewHandler: RequestHandler = catchAsync(async (req, res) => {
  const ua = req.headers['user-agent'] ?? '';
  if (BOT_UA_PATTERN.test(ua)) {
    sendResponse(res, { message: 'View not counted', data: { counted: false } });
    return;
  }

  const { targetType, targetId } = req.body as { targetType: string; targetId: string };
  const day = todayUTC();

  let viewerKey: string;

  if (req.user) {
    viewerKey = `u:${String(req.user._id)}`;
  } else {
    const anonVid = req.cookies[ANON_COOKIE] as string | undefined;
    if (anonVid) {
      viewerKey = `a:${anonVid}`;
    } else {
      // No cookie — use daily-salted hash as the dedup key and set a cookie for future visits
      const ip =
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
        req.socket.remoteAddress ??
        '0.0.0.0';
      viewerKey = `h:${hashFallback(ip, ua, day)}`;
      res.cookie(ANON_COOKIE, randomUUID(), {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: ANON_COOKIE_MAX_AGE,
        secure: process.env.NODE_ENV === 'production',
      });
    }
  }

  const result = await recordView({
    targetType: targetType as 'post' | 'profile',
    targetId,
    viewerKey,
    day,
    viewerId: req.user?._id,
    viewerIsAdmin: req.user?.role === 'admin',
  });

  sendResponse(res, {
    message: result.counted ? 'View recorded' : 'View not counted',
    data: result,
  });
});

export const userAnalyticsHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const days = parseDays(req.query.range);
  const analytics = await getUserAnalytics(req.user._id, days);
  sendResponse(res, { message: 'Analytics retrieved', data: analytics });
});

export const postAnalyticsHandler: RequestHandler = catchAsync(async (req, res) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  const { id } = req.params as { id: string };
  const days = parseDays(req.query.range);
  const analytics = await getPostAnalytics(id, req.user._id, req.user.role, days);
  sendResponse(res, { message: 'Post analytics retrieved', data: analytics });
});
