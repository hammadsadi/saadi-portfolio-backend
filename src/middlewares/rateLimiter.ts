import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Tighter limit for auth endpoints (login, register, OTP)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Strictest limit for OTP delivery endpoints (verify, resend, forgot, reset)
export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  // Skip in test environment — the in-memory store doesn't reset between tests
  skip: () => process.env.NODE_ENV === 'test',
});

// Comment creation — 10 per 15 min per IP as basic spam gate
export const commentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many comments. Please slow down.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Follow/unfollow — 60 actions per hour per authenticated user to prevent spam
export const followRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) =>
    `follow:${req.user ? String(req.user._id) : ipKeyGenerator(req.ip ?? '127.0.0.1')}`,
  message: { success: false, message: 'Too many follow actions. Please slow down.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// View recording — 10 per minute per IP, bot-heavy traffic handled upstream
export const viewRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many view events. Please slow down.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Sensitive account operations — 10 per hour per authenticated user (change-password, set-password, delete-account)
export const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) =>
    `sensitive:${req.user ? String(req.user._id) : ipKeyGenerator(req.ip ?? '127.0.0.1')}`,
  message: { success: false, message: 'Too many requests. Please try again in an hour.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Contact messages — 5 per hour per authenticated user
export const contactRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) =>
    `contact:${req.user ? String(req.user._id) : ipKeyGenerator(req.ip ?? '127.0.0.1')}`,
  message: { success: false, message: 'You have reached the message limit. Please try again in an hour.' },
  skip: () => process.env.NODE_ENV === 'test',
});
