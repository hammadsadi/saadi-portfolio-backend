import crypto from 'node:crypto';
import { OtpModel } from './otp.model.js';
import { AppError } from '@/utils/AppError.js';
import { env } from '@/config/env.js';
import type { OtpPurpose, IOtpDocument } from './otp.types.js';

const OTP_EXPIRY_MS = 10 * 60_000;        // 10 minutes
const RESEND_COOLDOWN_MS = 60_000;         // 60 seconds
const HOURLY_LIMIT = 5;
const HOURLY_WINDOW_MS = 60 * 60_000;     // 1 hour

function hashCode(plainCode: string): string {
  return crypto.createHmac('sha256', env.OTP_HMAC_SECRET).update(plainCode).digest('hex');
}

// ---------------------------------------------------------------------------
// Issue — generates, hashes, and persists a new OTP for the user+purpose.
// Returns the plain-text code (for the caller to include in email).
// ---------------------------------------------------------------------------

export async function issueOtp(userId: string, purpose: OtpPurpose): Promise<string> {
  const now = new Date();
  const existing = await OtpModel.findOne({ userId, purpose });

  // Resend cooldown (60 s)
  if (existing?.lastSentAt) {
    const msSince = now.getTime() - existing.lastSentAt.getTime();
    if (msSince < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - msSince) / 1_000);
      throw new AppError(`Please wait ${String(waitSec)} seconds before requesting another code.`, 429);
    }
  }

  // Hourly rate limit
  let hourlySentCount = 1;
  let hourlyWindowStart = now;
  if (existing) {
    const windowAge = now.getTime() - existing.hourlyWindowStart.getTime();
    if (windowAge < HOURLY_WINDOW_MS) {
      if (existing.hourlySentCount >= HOURLY_LIMIT) {
        throw new AppError('Too many OTP requests. Please try again in an hour.', 429);
      }
      hourlySentCount = existing.hourlySentCount + 1;
      hourlyWindowStart = existing.hourlyWindowStart;
    }
  }

  const code = String(crypto.randomInt(100_000, 999_999));
  const codeHash = hashCode(code);

  await OtpModel.findOneAndUpdate(
    { userId, purpose },
    {
      $set: {
        codeHash,
        expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
        attempts: 0,
        lastSentAt: now,
        hourlySentCount,
        hourlyWindowStart,
        consumedAt: null,
        resetUsed: null,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  return code;
}

// ---------------------------------------------------------------------------
// Verify — checks the plain-text code against the stored hash.
// Increments attempts on failure. Returns the OTP document on success.
// ---------------------------------------------------------------------------

export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  plainCode: string,
): Promise<IOtpDocument> {
  const now = new Date();
  const otpDoc = await OtpModel.findOne({ userId, purpose });

  if (!otpDoc || otpDoc.expiresAt < now) {
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  if (otpDoc.consumedAt) {
    throw new AppError('This OTP has already been used.', 400);
  }

  if (otpDoc.attempts >= otpDoc.maxAttempts) {
    throw new AppError('Too many failed attempts. Please request a new OTP.', 400);
  }

  const computedHash = hashCode(plainCode);
  const storedBuf = Buffer.from(otpDoc.codeHash, 'hex');
  const computedBuf = Buffer.from(computedHash, 'hex');

  // Guard against buffer-length mismatch before timingSafeEqual
  const isValid =
    storedBuf.length === computedBuf.length &&
    crypto.timingSafeEqual(storedBuf, computedBuf);

  if (!isValid) {
    const updated = await OtpModel.findByIdAndUpdate(
      otpDoc._id,
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    );
    const newAttempts = updated?.attempts ?? otpDoc.attempts + 1;

    if (newAttempts >= otpDoc.maxAttempts) {
      throw new AppError('Too many failed attempts. Please request a new OTP.', 400);
    }
    throw new AppError('Invalid OTP. Please check the code and try again.', 400);
  }

  return otpDoc;
}

// ---------------------------------------------------------------------------
// Consume — marks OTP used and extends expiry for the reset-password window.
// ---------------------------------------------------------------------------

export async function consumeOtp(otpId: string, extendExpiry = false): Promise<void> {
  const update: Record<string, unknown> = { consumedAt: new Date() };
  if (extendExpiry) {
    update.expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  }
  await OtpModel.findByIdAndUpdate(otpId, { $set: update });
}

// ---------------------------------------------------------------------------
// Mark reset used — single-use guarantee for password reset tokens.
// ---------------------------------------------------------------------------

export async function markResetUsed(otpId: string): Promise<void> {
  await OtpModel.findByIdAndUpdate(otpId, { $set: { resetUsed: true } });
}
