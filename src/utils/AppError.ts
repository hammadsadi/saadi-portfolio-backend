export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational = true;
  public readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (code) this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}
