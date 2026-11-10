import type { IUserDocument } from '../modules/user/user.types.js';

// Extend Express.Request globally so req.user is typed across all modules.
// This file is imported as a side effect in app.ts.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: IUserDocument;
    }
  }
}

export type {};
