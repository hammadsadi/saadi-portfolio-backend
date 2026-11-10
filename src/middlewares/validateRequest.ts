import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodType } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

export function validateRequest(schema: ZodType, part: RequestPart = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(result.error);
      return;
    }
    // Replace with the coerced/stripped data from Zod.
    // Express 5 defines req.query as a getter-only on the prototype; we must
    // shadow it with an own property to avoid a TypeError in strict mode.
    if (part === 'query') {
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      (req as unknown as Record<string, unknown>)[part] = result.data;
    }
    next();
  };
}
