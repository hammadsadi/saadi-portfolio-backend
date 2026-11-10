import '@/types/express-augment.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { env } from '@/config/env.js';
import { globalRateLimiter, requestLogger, notFound, errorHandler } from '@/middlewares/index.js';
import router from '@/routes/index.js';
import type { Application } from 'express';

const app: Application = express();

// Trust the first proxy hop — required for rate-limiter IP detection behind Vercel/nginx
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS — credentials mode for cookie-based auth
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Global rate limiter
app.use(globalRateLimiter);

// Request logging
app.use(requestLogger);

// Body parsing — 10 kb limit guards against oversized payloads
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parsing
app.use(cookieParser());

// Compress responses
app.use(compression());

// Health check — available without auth or rate-limit overhead
app.get('/api/v1/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Hammad Sadi Portfolio API is running',
    env: env.NODE_ENV,
  });
});

// All feature routes
app.use('/api/v1', router);

// 404 handler — must come after all routes
app.use(notFound);

// Global error handler — must be last
app.use(errorHandler);

export default app;
