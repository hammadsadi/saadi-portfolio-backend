import mongoose from 'mongoose';
import { env } from './env.js';

// Module-level cache — survives Vercel warm invocations within the same function instance
let cachedConn: typeof mongoose | null = null;
let cachedPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (cachedConn !== null) return cachedConn;

  if (!cachedPromise) {
    mongoose.set('strictQuery', true);

    cachedPromise = mongoose
      .connect(env.MONGODB_URI, {
        bufferCommands: false,     // Fail fast instead of buffering when disconnected
        maxPoolSize: 10,           // Modest pool: serverless instances are short-lived
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      })
      .then((m) => {
        cachedConn = m;
        console.info('MongoDB connected');
        return m;
      })
      .catch((err: unknown) => {
        cachedPromise = null; // Allow retry on next invocation
        throw err;
      });
  }

  return cachedPromise;
}
