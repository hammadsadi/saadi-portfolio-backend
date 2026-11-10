import crypto from 'node:crypto';
import { OtpModel } from '@/modules/otp/otp.model.js';
import type { OtpPurpose } from '@/modules/otp/otp.types.js';

// Fixed code used in tests — always use a known code that matches the hash
// seeded by this helper.
export const TEST_OTP = '123456';

/**
 * Seeds an OTP in the test DB with a known code so tests can submit it
 * without having to intercept the real issueOtp return value.
 */
export async function seedOtp(userId: string, purpose: OtpPurpose): Promise<string> {
  const secret = process.env['OTP_HMAC_SECRET'] ?? '';
  const codeHash = crypto.createHmac('sha256', secret).update(TEST_OTP).digest('hex');

  await OtpModel.findOneAndUpdate(
    { userId, purpose },
    {
      $set: {
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60_000),
        attempts: 0,
        maxAttempts: 5,
        // 2 minutes ago — cooldown (60 s) is already past
        lastSentAt: new Date(Date.now() - 2 * 60_000),
        hourlySentCount: 1,
        hourlyWindowStart: new Date(),
        consumedAt: null,
        resetUsed: null,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  return TEST_OTP;
}
