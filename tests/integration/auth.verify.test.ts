import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setEmailProvider } from '@/modules/email/email.service.js';
import { captureEmailProvider, clearSentEmails } from '../helpers/emails.js';
import { seedOtp, TEST_OTP } from '../helpers/otp.js';
import { UserModel } from '@/modules/user/user.model.js';
import { OtpModel } from '@/modules/otp/otp.model.js';

// ---------------------------------------------------------------------------
// Mock email sending before importing app (email.service is a singleton)
// ---------------------------------------------------------------------------
setEmailProvider(captureEmailProvider);

// Import app after wiring the mock — avoids real SMTP connections
const { default: app } = await import('@/app.js');

const request = supertest(app);

// ---------------------------------------------------------------------------
// In-memory DB lifecycle
// ---------------------------------------------------------------------------

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

// afterAll runs after all tests in the file
import { afterAll } from 'vitest';
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function registerUser(overrides: { name?: string; email?: string; password?: string } = {}) {
  return request.post('/api/v1/auth/register').send({
    name: 'Test User',
    email: 'test@example.com',
    password: 'Password1!',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/register', () => {
  it('returns 201 without issuing cookies', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('sends a verification email', async () => {
    await registerUser();

    const { sentEmails } = await import('../helpers/emails.js');
    expect(sentEmails.length).toBeGreaterThan(0);
    expect(sentEmails[0]?.to).toBe('test@example.com');
    expect(sentEmails[0]?.subject).toMatch(/verify/i);
  });

  it('returns 409 for duplicate email', async () => {
    await registerUser();
    clearSentEmails();

    const res = await registerUser();
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/verify-email', () => {
  it('verifies email, issues cookies, and returns user', async () => {
    await registerUser();

    const user = await UserModel.findOne({ email: 'test@example.com' });
    expect(user).toBeTruthy();
    await seedOtp(String(user!._id), 'verify_email');

    const res = await request.post('/api/v1/auth/verify-email').send({
      email: 'test@example.com',
      otp: TEST_OTP,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('test@example.com');
    expect(res.body.data.isEmailVerified).toBe(true);

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(Array.isArray(cookies) ? cookies.some((c: string) => c.startsWith('accessToken=')) : false).toBe(true);
  });

  it('returns 400 for wrong OTP', async () => {
    await registerUser();

    const user = await UserModel.findOne({ email: 'test@example.com' });
    await seedOtp(String(user!._id), 'verify_email');

    const res = await request.post('/api/v1/auth/verify-email').send({
      email: 'test@example.com',
      otp: '000000',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid otp/i);
  });

  it('returns 400 for a non-existent email', async () => {
    const res = await request.post('/api/v1/auth/verify-email').send({
      email: 'nobody@example.com',
      otp: TEST_OTP,
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login — unverified email', () => {
  it('returns 403 with code EMAIL_NOT_VERIFIED', async () => {
    await registerUser();
    clearSentEmails();

    const res = await request.post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'Password1!',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('POST /auth/login — verified email', () => {
  it('issues cookies on success', async () => {
    await registerUser();

    const user = await UserModel.findOne({ email: 'test@example.com' });
    await seedOtp(String(user!._id), 'verify_email');

    await request.post('/api/v1/auth/verify-email').send({
      email: 'test@example.com',
      otp: TEST_OTP,
    });

    clearSentEmails();

    const res = await request.post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'Password1!',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.isEmailVerified).toBe(true);
    const cookies = res.headers['set-cookie'];
    expect(Array.isArray(cookies) ? cookies.some((c: string) => c.startsWith('accessToken=')) : false).toBe(true);
  });
});

describe('POST /auth/resend-otp', () => {
  it('always returns 200 (even for non-existent email)', async () => {
    const res = await request.post('/api/v1/auth/resend-otp').send({
      email: 'nobody@example.com',
      purpose: 'verify_email',
    });

    expect(res.status).toBe(200);
  });

  it('sends a new OTP for an unverified user', async () => {
    await registerUser();
    clearSentEmails();

    const user = await UserModel.findOne({ email: 'test@example.com' });
    // Push lastSentAt back past the 60s cooldown window
    await OtpModel.updateOne(
      { userId: user?._id, purpose: 'verify_email' },
      { $set: { lastSentAt: new Date(Date.now() - 2 * 60_000) } },
    );

    const res = await request.post('/api/v1/auth/resend-otp').send({
      email: 'test@example.com',
      purpose: 'verify_email',
    });

    expect(res.status).toBe(200);
  });
});
