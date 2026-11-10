import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { UserModel } from '../user/user.model.js';
import { OtpModel } from '../otp/otp.model.js';
import { issueOtp, verifyOtp, consumeOtp, markResetUsed } from '../otp/otp.service.js';
import {
  sendVerifyEmailTemplate,
  sendWelcomeEmailTemplate,
  sendResetPasswordEmailTemplate,
  sendPasswordChangedEmailTemplate,
} from '../email/email.templates.js';
import { AppError } from '@/utils/AppError.js';
import { env } from '@/config/env.js';
import type { TokenPair, AccessTokenPayload, OAuthUserInfo, AuthResult } from './auth.types.js';
import type { UserRole, IUserDocument } from '../user/user.types.js';
import type { OtpPurpose } from '../otp/otp.types.js';

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 7 * 86_400_000;
  const num = match[1];
  const unit = match[2];
  if (!num || !unit) return 7 * 86_400_000;
  const ms: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return parseInt(num, 10) * (ms[unit] ?? 86_400_000);
}

function refreshTokenExpiry(): Date {
  return new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));
}

// ---------------------------------------------------------------------------
// Token primitives
// ---------------------------------------------------------------------------

export function signAccessToken(userId: string, role: UserRole): string {
  return jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const raw = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof raw !== 'object') throw new AppError('Invalid token', 401);
  const payload = raw as Record<string, unknown>;
  if (typeof payload.userId !== 'string' || typeof payload.role !== 'string') {
    throw new AppError('Invalid token payload', 401);
  }
  return { userId: payload.userId, role: payload.role as UserRole };
}

export function signResetToken(userId: string, otpId: string): string {
  return jwt.sign({ userId, otpId, purpose: 'password_reset' }, env.JWT_ACCESS_SECRET, {
    expiresIn: '10m',
  });
}

export function verifyResetToken(token: string): { userId: string; otpId: string } {
  let raw: jwt.JwtPayload | string;
  try {
    raw = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new AppError('Invalid or expired reset token', 401);
  }
  if (typeof raw !== 'object') throw new AppError('Invalid reset token', 401);
  const payload = raw as Record<string, unknown>;
  if (
    typeof payload.userId !== 'string' ||
    typeof payload.otpId !== 'string' ||
    payload.purpose !== 'password_reset'
  ) {
    throw new AppError('Invalid reset token', 401);
  }
  return { userId: payload.userId, otpId: payload.otpId };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateTokens(userId: string, role: UserRole): TokenPair {
  const accessToken = signAccessToken(userId, role);
  const refreshToken = crypto.randomBytes(64).toString('hex');
  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function setAuthCookies(res: Response, tokens: TokenPair): void {
  const secure = env.NODE_ENV === 'production';
  // 'lax' is safe because the client proxies all /api/* requests — cookies are
  // always same-origin from the browser's perspective. For OAuth flows, register
  // the callback URL on CLIENT_URL (e.g. https://hammadsadi.com/api/v1/auth/*/callback)
  // so the OAuth round-trip also passes through the proxy.
  const sameSite = 'lax' as const;

  res.cookie('accessToken', tokens.accessToken, {
    httpOnly: true, secure, sameSite,
    maxAge: parseDurationMs(env.JWT_ACCESS_EXPIRES_IN),
    path: '/',
  });

  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true, secure, sameSite,
    maxAge: parseDurationMs(env.JWT_REFRESH_EXPIRES_IN),
    path: REFRESH_COOKIE_PATH,
  });
}

export function clearAuthCookies(res: Response): void {
  const secure = env.NODE_ENV === 'production';
  const sameSite = 'lax' as const;
  res.clearCookie('accessToken', { httpOnly: true, secure, sameSite, path: '/' });
  res.clearCookie('refreshToken', { httpOnly: true, secure, sameSite, path: REFRESH_COOKIE_PATH });
}

// ---------------------------------------------------------------------------
// Store / rotate refresh tokens in DB
// ---------------------------------------------------------------------------

async function storeRefreshToken(userId: string, rawToken: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    {
      $push: { refreshTokens: { tokenHash: hashToken(rawToken), expiresAt: refreshTokenExpiry() } },
      lastLoginAt: new Date(),
    },
  );
}

async function rotateRefreshToken(userId: string, oldRaw: string, newRaw: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    {
      $pull: { refreshTokens: { tokenHash: hashToken(oldRaw) } },
      $push: { refreshTokens: { tokenHash: hashToken(newRaw), expiresAt: refreshTokenExpiry() } },
      lastLoginAt: new Date(),
    },
  );
}

// ---------------------------------------------------------------------------
// Auth operations
// ---------------------------------------------------------------------------

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<IUserDocument> {
  const existing = await UserModel.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError('Email already registered', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await UserModel.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    isEmailVerified: false,
  });

  const code = await issueOtp(String(user._id), 'verify_email');
  await sendVerifyEmailTemplate({ to: user.email, name: user.name, otp: code });

  return user;
}

export async function verifyEmail(email: string, code: string): Promise<AuthResult> {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError('Invalid email or OTP', 400);
  if (user.isEmailVerified) throw new AppError('Email is already verified', 400);

  const otpDoc = await verifyOtp(String(user._id), 'verify_email', code);
  await consumeOtp(String(otpDoc._id));

  user.isEmailVerified = true;
  await user.save();

  const tokens = generateTokens(String(user._id), user.role);
  await storeRefreshToken(String(user._id), tokens.refreshToken);

  await sendWelcomeEmailTemplate({ to: user.email, name: user.name });

  return { user, tokens };
}

export async function resendOtp(email: string, purpose: OtpPurpose): Promise<void> {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) return; // silent — prevent enumeration

  if (purpose === 'verify_email' && user.isEmailVerified) return;
  if (purpose === 'reset_password' && !user.passwordHash) return;

  try {
    const code = await issueOtp(String(user._id), purpose);
    if (purpose === 'verify_email') {
      await sendVerifyEmailTemplate({ to: user.email, name: user.name, otp: code });
    } else {
      await sendResetPasswordEmailTemplate({ to: user.email, name: user.name, otp: code });
    }
  } catch {
    // Swallow cooldown/limit errors — always return 200
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  if (!user) throw new AppError('Invalid email or password', 401);
  if (!user.passwordHash) throw new AppError('Please sign in with your OAuth provider', 401);

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new AppError('Invalid email or password', 401);

  if (!user.isEmailVerified) {
    // Trigger a fresh OTP (silent on cooldown)
    try {
      const code = await issueOtp(String(user._id), 'verify_email');
      await sendVerifyEmailTemplate({ to: user.email, name: user.name, otp: code });
    } catch {
      // Cooldown hit — that's fine
    }
    throw new AppError('Email not verified', 403, 'EMAIL_NOT_VERIFIED');
  }

  if (user.isBlocked) throw new AppError('Account is blocked', 403);

  const tokens = generateTokens(String(user._id), user.role);
  await storeRefreshToken(String(user._id), tokens.refreshToken);
  return { user, tokens };
}

export async function refresh(rawToken: string): Promise<AuthResult> {
  const tokenHash = hashToken(rawToken);

  const user = await UserModel.findOne({
    refreshTokens: { $elemMatch: { tokenHash, expiresAt: { $gt: new Date() } } },
  });

  if (!user) throw new AppError('Invalid or expired refresh token', 401);
  if (user.isBlocked) throw new AppError('Account is blocked', 403);

  const tokens = generateTokens(String(user._id), user.role);
  await rotateRefreshToken(String(user._id), rawToken, tokens.refreshToken);
  return { user, tokens };
}

export async function logout(userId: string, rawToken: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    { $pull: { refreshTokens: { tokenHash: hashToken(rawToken) } } },
  );
}

export async function logoutAll(userId: string): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user?.passwordHash) return; // silent — prevent enumeration

  try {
    const code = await issueOtp(String(user._id), 'reset_password');
    await sendResetPasswordEmailTemplate({ to: user.email, name: user.name, otp: code });
  } catch {
    // Swallow cooldown/limit errors
  }
}

export async function verifyResetOtp(email: string, code: string): Promise<string> {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError('Invalid email or OTP', 400);

  const otpDoc = await verifyOtp(String(user._id), 'reset_password', code);

  // Consume and extend the expiry to give 10 minutes for the reset
  await consumeOtp(String(otpDoc._id), true);

  return signResetToken(String(user._id), String(otpDoc._id));
}

export async function resetPassword(resetToken: string, newPassword: string): Promise<void> {
  const { userId, otpId } = verifyResetToken(resetToken);

  const otpDoc = await OtpModel.findById(otpId);
  if (!otpDoc?.consumedAt || otpDoc.resetUsed) {
    throw new AppError('Invalid or expired reset token', 401);
  }

  // Single-use: mark before update to prevent concurrent use
  await markResetUsed(otpId);

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const user = await UserModel.findByIdAndUpdate(userId, {
    $set: { passwordHash, refreshTokens: [] },
  });
  if (!user) throw new AppError('User not found', 404);

  await sendPasswordChangedEmailTemplate({ to: user.email, name: user.name });
}

export async function oauthLogin(info: OAuthUserInfo): Promise<AuthResult> {
  let user = await UserModel.findOne({
    authProviders: {
      $elemMatch: { provider: info.provider, providerId: info.providerId },
    },
  });

  if (!user) {
    const byEmail = await UserModel.findOne({ email: info.email.toLowerCase() });

    if (byEmail) {
      byEmail.authProviders.push({ provider: info.provider, providerId: info.providerId });
      byEmail.isEmailVerified = true;
      if (info.avatar && !byEmail.avatar) byEmail.avatar = info.avatar;
      await byEmail.save();
      user = byEmail;
    } else {
      user = await UserModel.create({
        name: info.name,
        email: info.email.toLowerCase(),
        avatar: info.avatar,
        authProviders: [{ provider: info.provider, providerId: info.providerId }],
        isEmailVerified: true,
      });
    }
  }

  if (user.isBlocked) throw new AppError('Account is blocked', 403);

  const tokens = generateTokens(String(user._id), user.role);
  await storeRefreshToken(String(user._id), tokens.refreshToken);
  return { user, tokens };
}
