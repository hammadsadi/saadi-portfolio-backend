import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import { env } from '@/config/env.js';
import {
  register,
  verifyEmail,
  resendOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  oauthLogin,
  setAuthCookies,
  clearAuthCookies,
} from './auth.service.js';
import { toPublicUser } from '../user/user.service.js';
import { initiateGoogle, handleGoogleCallback } from './oauth/google.js';
import { initiateGitHub, handleGitHubCallback } from './oauth/github.js';
import type { OtpPurpose } from '../otp/otp.types.js';

// POST /auth/register
export const registerHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };
  await register(name, email, password);
  sendResponse(res, {
    statusCode: 201,
    message: 'Registration successful. Please check your email to verify your account.',
  });
});

// POST /auth/verify-email
export const verifyEmailHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body as { email: string; otp: string };
  const { user, tokens } = await verifyEmail(email, otp);
  setAuthCookies(res, tokens);
  sendResponse(res, { message: 'Email verified successfully', data: toPublicUser(user) });
});

// POST /auth/resend-otp
export const resendOtpHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { email, purpose } = req.body as { email: string; purpose: OtpPurpose };
  await resendOtp(email, purpose);
  sendResponse(res, { message: 'If this email is registered, a new code has been sent.' });
});

// POST /auth/login
export const loginHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const { user, tokens } = await login(email, password);
  setAuthCookies(res, tokens);
  sendResponse(res, { message: 'Logged in successfully', data: toPublicUser(user) });
});

// POST /auth/refresh
export const refreshHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const rawToken = req.cookies.refreshToken as unknown;
  if (typeof rawToken !== 'string') throw new AppError('Refresh token required', 401);
  const { user, tokens } = await refresh(rawToken);
  setAuthCookies(res, tokens);
  sendResponse(res, { message: 'Token refreshed', data: toPublicUser(user) });
});

// POST /auth/logout
export const logoutHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const rawToken = req.cookies.refreshToken as unknown;
  if (req.user && typeof rawToken === 'string') {
    await logout(String(req.user._id), rawToken);
  }
  clearAuthCookies(res);
  sendResponse(res, { message: 'Logged out successfully' });
});

// GET /auth/me
export const meHandler: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) { next(new AppError('Not authenticated', 401)); return; }
  sendResponse(res, { message: 'User retrieved', data: toPublicUser(req.user) });
};

// POST /auth/forgot-password
export const forgotPasswordHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email: string };
  await forgotPassword(email);
  sendResponse(res, { message: 'If this email is registered, a password reset code has been sent.' });
});

// POST /auth/verify-reset-otp
export const verifyResetOtpHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body as { email: string; otp: string };
  const resetToken = await verifyResetOtp(email, otp);
  sendResponse(res, { message: 'OTP verified', data: { resetToken } });
});

// POST /auth/reset-password
export const resetPasswordHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { resetToken, newPassword } = req.body as { resetToken: string; newPassword: string };
  await resetPassword(resetToken, newPassword);
  clearAuthCookies(res);
  sendResponse(res, { message: 'Password has been reset. Please sign in with your new password.' });
});

// GET /auth/google
export const googleInitiate = (_req: Request, res: Response): void => {
  initiateGoogle(_req, res);
};

// GET /auth/google/callback
export const googleCallback: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  try {
    const info = await handleGoogleCallback(req);
    const { tokens } = await oauthLogin(info);
    setAuthCookies(res, tokens);
    res.redirect(`${env.CLIENT_URL}/auth/callback`);
  } catch (err: unknown) {
    const message = err instanceof Error ? encodeURIComponent(err.message) : 'oauth_error';
    res.redirect(`${env.CLIENT_URL}/auth/callback?error=${message}`);
  }
});

// GET /auth/github
export const githubInitiate = (_req: Request, res: Response): void => {
  initiateGitHub(_req, res);
};

// GET /auth/github/callback
export const githubCallback: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  try {
    const info = await handleGitHubCallback(req);
    const { tokens } = await oauthLogin(info);
    setAuthCookies(res, tokens);
    res.redirect(`${env.CLIENT_URL}/auth/callback`);
  } catch (err: unknown) {
    const message = err instanceof Error ? encodeURIComponent(err.message) : 'oauth_error';
    res.redirect(`${env.CLIENT_URL}/auth/callback?error=${message}`);
  }
});
