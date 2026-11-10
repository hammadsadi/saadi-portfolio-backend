import { Google, generateState, generateCodeVerifier, decodeIdToken } from 'arctic';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { env } from '@/config/env.js';
import { AppError } from '@/utils/AppError.js';
import type { OAuthUserInfo } from '../auth.types.js';

const STATE_COOKIE = 'google_oauth_state';
const VERIFIER_COOKIE = 'google_code_verifier';
const OAUTH_COOKIE_MAX_AGE = 10 * 60 * 1000; // 10 minutes

const googleClaimsSchema = z.object({
  sub: z.string(),
  email: z.email(),
  name: z.string(),
  picture: z.string().optional(),
  email_verified: z.boolean().optional(),
});

function getClient(): Google {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError('Google OAuth is not configured', 503);
  }
  return new Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `${env.SERVER_URL}/api/v1/auth/google/callback`,
  );
}

export function initiateGoogle(_req: Request, res: Response): void {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = getClient().createAuthorizationURL(state, codeVerifier, [
    'openid',
    'profile',
    'email',
  ]);

  const opts = {
    httpOnly: true,
    path: '/',
    maxAge: OAUTH_COOKIE_MAX_AGE,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
  };
  res.cookie(STATE_COOKIE, state, opts);
  res.cookie(VERIFIER_COOKIE, codeVerifier, opts);
  res.redirect(url.toString());
}

export async function handleGoogleCallback(req: Request): Promise<OAuthUserInfo> {
  const { code, state } = req.query;
  const storedState = req.cookies[STATE_COOKIE] as unknown;
  const codeVerifier = req.cookies[VERIFIER_COOKIE] as unknown;

  if (
    typeof code !== 'string' ||
    typeof state !== 'string' ||
    typeof storedState !== 'string' ||
    typeof codeVerifier !== 'string' ||
    state !== storedState
  ) {
    throw new AppError('Invalid OAuth state', 400);
  }

  const tokens = await getClient().validateAuthorizationCode(code, codeVerifier);
  const rawClaims: unknown = decodeIdToken(tokens.idToken());
  const result = googleClaimsSchema.safeParse(rawClaims);

  if (!result.success) throw new AppError('Failed to decode Google ID token', 502);

  return {
    provider: 'google',
    providerId: result.data.sub,
    email: result.data.email,
    name: result.data.name,
    avatar: result.data.picture ?? null,
  };
}
