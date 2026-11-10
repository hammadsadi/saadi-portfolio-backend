import { connectDB } from '../src/config/db.js';
import app from '../src/app.js';
import type { Request, Response } from 'express';

// Await DB on every request so cold-start latency doesn't cause the first
// request to hit Mongoose before the connection is ready.
// connectDB() resolves immediately on warm invocations (cached connection).
export default async function handler(req: Request, res: Response): Promise<void> {
  await connectDB();
  app(req, res);
}
