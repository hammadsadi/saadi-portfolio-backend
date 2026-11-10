import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setEmailProvider } from '@/modules/email/email.service.js';
import { captureEmailProvider, clearSentEmails } from '../helpers/emails.js';
import { seedOtp, TEST_OTP } from '../helpers/otp.js';
import { UserModel } from '@/modules/user/user.model.js';
import bcrypt from 'bcryptjs';

// Wire mock email before app import
setEmailProvider(captureEmailProvider);

const { default: app } = await import('@/app.js');
const request = supertest(app);

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const cols = mongoose.connection.collections;
  for (const key of Object.keys(cols)) {
    await cols[key]?.deleteMany({});
  }
  clearSentEmails();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createVerifiedUser(email = 'user@example.com', password = 'Password1!') {
  const passwordHash = await bcrypt.hash(password, 12);
  return UserModel.create({
    name: 'Test User',
    email,
    passwordHash,
    isEmailVerified: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/forgot-password', () => {
  it('always returns 200 — does not expose user existence', async () => {
    const res = await request.post('/api/v1/auth/forgot-password').send({
      email: 'nobody@example.com',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('sends a reset OTP for a valid local account', async () => {
    await createVerifiedUser();

    const res = await request.post('/api/v1/auth/forgot-password').send({
      email: 'user@example.com',
    });

    expect(res.status).toBe(200);
    const { sentEmails } = await import('../helpers/emails.js');
    expect(sentEmails.length).toBeGreaterThan(0);
    expect(sentEmails[0]?.subject).toMatch(/reset/i);
  });
});

describe('POST /auth/verify-reset-otp', () => {
  it('returns a resetToken for valid OTP', async () => {
    const user = await createVerifiedUser();
    await seedOtp(String(user._id), 'reset_password');

    const res = await request.post('/api/v1/auth/verify-reset-otp').send({
      email: 'user@example.com',
      otp: TEST_OTP,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.resetToken).toBeTruthy();
    expect(typeof res.body.data.resetToken).toBe('string');
  });

  it('returns 400 for wrong OTP', async () => {
    const user = await createVerifiedUser();
    await seedOtp(String(user._id), 'reset_password');

    const res = await request.post('/api/v1/auth/verify-reset-otp').send({
      email: 'user@example.com',
      otp: '000000',
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-existent email', async () => {
    const res = await request.post('/api/v1/auth/verify-reset-otp').send({
      email: 'nobody@example.com',
      otp: TEST_OTP,
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/reset-password', () => {
  async function getResetToken(): Promise<string> {
    const user = await createVerifiedUser();
    await seedOtp(String(user._id), 'reset_password');

    const res = await request.post('/api/v1/auth/verify-reset-otp').send({
      email: 'user@example.com',
      otp: TEST_OTP,
    });

    return res.body.data.resetToken as string;
  }

  it('resets the password and returns 200', async () => {
    const resetToken = await getResetToken();

    const res = await request.post('/api/v1/auth/reset-password').send({
      resetToken,
      newPassword: 'NewPassword2!',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password has been reset/i);
  });

  it('allows login with new password after reset', async () => {
    const resetToken = await getResetToken();
    await request.post('/api/v1/auth/reset-password').send({
      resetToken,
      newPassword: 'NewPassword2!',
    });

    const loginRes = await request.post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'NewPassword2!',
    });

    expect(loginRes.status).toBe(200);
  });

  it('rejects old password after reset', async () => {
    const resetToken = await getResetToken();
    await request.post('/api/v1/auth/reset-password').send({
      resetToken,
      newPassword: 'NewPassword2!',
    });

    const loginRes = await request.post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'Password1!',
    });

    expect(loginRes.status).toBe(401);
  });

  it('returns 401 for a reused reset token (single-use)', async () => {
    const resetToken = await getResetToken();
    await request.post('/api/v1/auth/reset-password').send({
      resetToken,
      newPassword: 'NewPassword2!',
    });

    const res = await request.post('/api/v1/auth/reset-password').send({
      resetToken,
      newPassword: 'AnotherPass3!',
    });

    expect(res.status).toBe(401);
  });

  it('rejects a weak password', async () => {
    const resetToken = await getResetToken();

    const res = await request.post('/api/v1/auth/reset-password').send({
      resetToken,
      newPassword: 'weak',
    });

    expect(res.status).toBe(400);
  });

  it('sends a password-changed notification email', async () => {
    const resetToken = await getResetToken();
    clearSentEmails();

    await request.post('/api/v1/auth/reset-password').send({
      resetToken,
      newPassword: 'NewPassword2!',
    });

    const { sentEmails } = await import('../helpers/emails.js');
    expect(sentEmails.length).toBeGreaterThan(0);
    expect(sentEmails[0]?.subject).toMatch(/password/i);
  });
});
