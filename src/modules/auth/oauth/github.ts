import { GitHub, generateState } from 'arctic';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { env } from '@/config/env.js';
import { AppError } from '@/utils/AppError.js';
import type { OAuthUserInfo } from '../auth.types.js';

const STATE_COOKIE = 'github_oauth_state';
const OAUTH_COOKIE_MAX_AGE = 10 * 60 * 1000; // 10 minutes

const githubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable().optional(),
  avatar_url: z.string().optional(),
});

const githubEmailSchema = z.array(
  z.object({
    email: z.string(),
    primary: z.boolean(),
    verified: z.boolean(),
  }),
);

function getClient(): GitHub {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new AppError('GitHub OAuth is not configured', 503);
  }
  return new GitHub(
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
    `${env.SERVER_URL}/api/v1/auth/github/callback`,
  );
}

export function initiateGitHub(_req: Request, res: Response): void {
  const state = generateState();
  const url = getClient().createAuthorizationURL(state, ['read:user', 'user:email']);

  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    path: '/',
    maxAge: OAUTH_COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
  });
  res.redirect(url.toString());
}

export async function handleGitHubCallback(req: Request): Promise<OAuthUserInfo> {
  const { code, state } = req.query;
  const storedState = req.cookies[STATE_COOKIE] as unknown;

  if (
    typeof code !== 'string' ||
    typeof state !== 'string' ||
    typeof storedState !== 'string' ||
    state !== storedState
  ) {
    throw new AppError('Invalid OAuth state', 400);
  }

  const tokens = await getClient().validateAuthorizationCode(code);
  const accessToken = tokens.accessToken();

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': 'HammadSadiPortfolio/1.0',
    Accept: 'application/vnd.github+json',
  };

  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', { headers }),
    fetch('https://api.github.com/user/emails', { headers }),
  ]);

  if (!userRes.ok || !emailsRes.ok) {
    throw new AppError('Failed to fetch GitHub user info', 502);
  }

  const rawUser: unknown = await userRes.json();
  const rawEmails: unknown = await emailsRes.json();

  const userResult = githubUserSchema.safeParse(rawUser);
  const emailsResult = githubEmailSchema.safeParse(rawEmails);

  if (!userResult.success || !emailsResult.success) {
    throw new AppError('Invalid GitHub user data', 502);
  }

  const primaryEmail = emailsResult.data.find((e) => e.primary && e.verified);
  if (!primaryEmail) throw new AppError('No verified primary email on GitHub account', 400);

  const { id, login, name, avatar_url } = userResult.data;

  return {
    provider: 'github',
    providerId: String(id),
    email: primaryEmail.email,
    name: name ?? login,
    avatar: avatar_url ?? null,
  };
}
