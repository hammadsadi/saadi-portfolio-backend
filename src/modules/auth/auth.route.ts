import { Router } from 'express';
import type { IRouter } from 'express';
import { authRateLimiter, otpRateLimiter } from '@/middlewares/rateLimiter.js';
import { validateRequest } from '@/middlewares/validateRequest.js';
import { authenticate, optionalAuth } from '@/middlewares/authenticate.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
} from './auth.validation.js';
import {
  registerHandler,
  verifyEmailHandler,
  resendOtpHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  forgotPasswordHandler,
  verifyResetOtpHandler,
  resetPasswordHandler,
  googleInitiate,
  googleCallback,
  githubInitiate,
  githubCallback,
} from './auth.controller.js';

const router: IRouter = Router();

// Registration + verification
router.post('/register', authRateLimiter, validateRequest(registerSchema), registerHandler);
router.post('/verify-email', otpRateLimiter, validateRequest(verifyEmailSchema), verifyEmailHandler);
router.post('/resend-otp', otpRateLimiter, validateRequest(resendOtpSchema), resendOtpHandler);

// Login + token management
router.post('/login', authRateLimiter, validateRequest(loginSchema), loginHandler);
router.post('/refresh', authRateLimiter, refreshHandler);
router.post('/logout', optionalAuth, logoutHandler);

// Current user
router.get('/me', authenticate, meHandler);

// Password reset
router.post('/forgot-password', otpRateLimiter, validateRequest(forgotPasswordSchema), forgotPasswordHandler);
router.post('/verify-reset-otp', otpRateLimiter, validateRequest(verifyResetOtpSchema), verifyResetOtpHandler);
router.post('/reset-password', otpRateLimiter, validateRequest(resetPasswordSchema), resetPasswordHandler);

// Google OAuth
router.get('/google', googleInitiate);
router.get('/google/callback', googleCallback);

// GitHub OAuth
router.get('/github', githubInitiate);
router.get('/github/callback', githubCallback);

export default router;
