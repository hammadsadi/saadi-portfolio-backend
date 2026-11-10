import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

// Express 5 catches async errors automatically, but this wrapper makes the
// intent explicit and keeps handlers typed as returning Promise<void>.
export function catchAsync(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
