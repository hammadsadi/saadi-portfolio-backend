import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock env before any module loads (vi.mock is hoisted)
// ---------------------------------------------------------------------------
vi.mock('@/config/env.js', () => ({
  env: { OTP_HMAC_SECRET: 'test-otp-hmac-secret-xxxxxxxxxxxxxxxxxxxxxxxxx' },
}));

// Mock the OTP model — replace with controllable spies
vi.mock('@/modules/otp/otp.model.js', () => ({
  OtpModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import { issueOtp, verifyOtp } from '@/modules/otp/otp.service.js';
import { OtpModel } from '@/modules/otp/otp.model.js';
import crypto from 'node:crypto';

const SECRET = 'test-otp-hmac-secret-xxxxxxxxxxxxxxxxxxxxxxxxx';

function hashCode(code: string): string {
  return crypto.createHmac('sha256', SECRET).update(code).digest('hex');
}

function makeOtpDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'otp-id-1',
    userId: 'user-id-1',
    purpose: 'verify_email',
    codeHash: hashCode('123456'),
    expiresAt: new Date(Date.now() + 10 * 60_000),
    attempts: 0,
    maxAttempts: 5,
    lastSentAt: new Date(Date.now() - 2 * 60_000), // 2 min ago — past cooldown
    hourlySentCount: 1,
    hourlyWindowStart: new Date(),
    consumedAt: null,
    resetUsed: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// issueOtp
// ---------------------------------------------------------------------------

describe('issueOtp', () => {
  it('creates a new OTP when none exists', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(null);
    (OtpModel.findOneAndUpdate as Mock).mockResolvedValueOnce({});

    const code = await issueOtp('user-1', 'verify_email');

    expect(code).toMatch(/^\d{6}$/);
    expect(OtpModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', purpose: 'verify_email' },
      expect.objectContaining({ $set: expect.objectContaining({ hourlySentCount: 1 }) }),
      { upsert: true, returnDocument: 'after' },
    );
  });

  it('enforces 60-second resend cooldown', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(
      makeOtpDoc({ lastSentAt: new Date(Date.now() - 30_000) }), // 30s ago
    );

    await expect(issueOtp('user-1', 'verify_email')).rejects.toThrow(/wait \d+ seconds/i);
  });

  it('allows re-issue after cooldown has passed', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(
      makeOtpDoc({ lastSentAt: new Date(Date.now() - 61_000) }), // 61s ago
    );
    (OtpModel.findOneAndUpdate as Mock).mockResolvedValueOnce({});

    await expect(issueOtp('user-1', 'verify_email')).resolves.toMatch(/^\d{6}$/);
  });

  it('enforces hourly limit of 5 sends', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(
      makeOtpDoc({
        lastSentAt: new Date(Date.now() - 61_000),
        hourlySentCount: 5,
        hourlyWindowStart: new Date(), // within the window
      }),
    );

    await expect(issueOtp('user-1', 'verify_email')).rejects.toThrow(/too many OTP requests/i);
  });

  it('resets hourly count after the window expires', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(
      makeOtpDoc({
        lastSentAt: new Date(Date.now() - 61_000),
        hourlySentCount: 5,
        hourlyWindowStart: new Date(Date.now() - 61 * 60_000), // > 1 hour ago
      }),
    );
    (OtpModel.findOneAndUpdate as Mock).mockResolvedValueOnce({});

    const code = await issueOtp('user-1', 'verify_email');
    expect(code).toMatch(/^\d{6}$/);

    expect(OtpModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ hourlySentCount: 1 }) }),
      { upsert: true, returnDocument: 'after' },
    );
  });
});

// ---------------------------------------------------------------------------
// verifyOtp
// ---------------------------------------------------------------------------

describe('verifyOtp', () => {
  it('succeeds with the correct code', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(makeOtpDoc());

    const result = await verifyOtp('user-1', 'verify_email', '123456');
    expect(result).toBeDefined();
    expect(result.codeHash).toBe(hashCode('123456'));
  });

  it('rejects an incorrect code with a generic invalid message', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(makeOtpDoc({ attempts: 0 }));
    (OtpModel.findByIdAndUpdate as Mock).mockResolvedValueOnce(makeOtpDoc({ attempts: 1 }));

    await expect(verifyOtp('user-1', 'verify_email', '000000')).rejects.toThrow(/invalid otp/i);
  });

  it('rejects an expired OTP', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(
      makeOtpDoc({ expiresAt: new Date(Date.now() - 1_000) }),
    );

    await expect(verifyOtp('user-1', 'verify_email', '123456')).rejects.toThrow(/expired/i);
  });

  it('rejects when attempts are exhausted', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(
      makeOtpDoc({ attempts: 5, maxAttempts: 5 }),
    );

    await expect(verifyOtp('user-1', 'verify_email', '123456')).rejects.toThrow(/too many failed attempts/i);
  });

  it('rejects a consumed OTP', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(
      makeOtpDoc({ consumedAt: new Date() }),
    );

    await expect(verifyOtp('user-1', 'verify_email', '123456')).rejects.toThrow(/already been used/i);
  });

  it('locks OTP after the last wrong attempt', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(
      makeOtpDoc({ attempts: 4, maxAttempts: 5 }),
    );
    (OtpModel.findByIdAndUpdate as Mock).mockResolvedValueOnce(
      makeOtpDoc({ attempts: 5 }),
    );

    await expect(verifyOtp('user-1', 'verify_email', '000000')).rejects.toThrow(/too many failed attempts/i);
  });

  it('returns no document when no OTP exists for user+purpose', async () => {
    (OtpModel.findOne as Mock).mockResolvedValueOnce(null);

    await expect(verifyOtp('user-1', 'verify_email', '123456')).rejects.toThrow(/expired/i);
  });
});
