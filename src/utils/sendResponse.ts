import type { Response } from 'express';

interface ApiResponseOptions<T> {
  statusCode?: number;
  success?: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export function sendResponse<T>(res: Response, options: ApiResponseOptions<T>): void {
  const { statusCode = 200, success = true, message, data, meta } = options;
  res.status(statusCode).json({
    success,
    message,
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
  });
}
