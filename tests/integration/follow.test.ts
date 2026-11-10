import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setEmailProvider } from '@/modules/email/email.service.js';
import { captureEmailProvider } from '../helpers/emails.js';
import { seedOtp, TEST_OTP } from '../helpers/otp.js';
import { UserModel } from '@/modules/user/user.model.js';
import { FollowModel } from '@/modules/follow/follow.model.js';

setEmailProvider(captureEmailProvider);

const { default: app } = await import('@/app.js');
const request = supertest(app);

// ─── DB lifecycle ────────────────────────────────────────────────────────────

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
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface TestUser {
  id: string;
  cookie: string;
}

async function createVerifiedUser(email: string, name: string): Promise<TestUser> {
  await request.post('/api/v1/auth/register').send({
    name,
    email,
    password: 'Password1!',
  });

  const user = await UserModel.findOne({ email });
  if (!user) throw new Error(`User not created: ${email}`);
  await seedOtp(String(user._id), 'verify_email');

  const verifyRes = await request
    .post('/api/v1/auth/verify-email')
    .send({ email, otp: TEST_OTP });

  const setCookie = verifyRes.headers['set-cookie'] as string[] | undefined;
  const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : '';

  return { id: String(user._id), cookie };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /users/:userId/follow', () => {
  it('follows a user successfully and returns isFollowing + followerCount', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');

    const res = await request
      .post(`/api/v1/users/${user2.id}/follow`)
      .set('Cookie', user1.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.isFollowing).toBe(true);
    expect(res.body.data.followerCount).toBe(1);
  });

  it('increments followerCount and followingCount atomically', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');

    await request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie);

    const [u1, u2] = await Promise.all([
      UserModel.findById(user1.id).select('followingCount').lean(),
      UserModel.findById(user2.id).select('followerCount').lean(),
    ]);
    expect(u1?.followingCount).toBe(1);
    expect(u2?.followerCount).toBe(1);
  });

  it('is idempotent — double follow returns the same result', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');

    await request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie);
    const res = await request
      .post(`/api/v1/users/${user2.id}/follow`)
      .set('Cookie', user1.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.isFollowing).toBe(true);
    // Only 1 follow document should exist
    const count = await FollowModel.countDocuments();
    expect(count).toBe(1);
    // Counters should still be 1, not 2
    const u2 = await UserModel.findById(user2.id).select('followerCount').lean();
    expect(u2?.followerCount).toBe(1);
  });

  it('rejects self-follow with 400', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');

    const res = await request
      .post(`/api/v1/users/${user1.id}/follow`)
      .set('Cookie', user1.cookie);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot follow yourself/i);
  });

  it('requires authentication', async () => {
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');
    const res = await request.post(`/api/v1/users/${user2.id}/follow`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent user', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request
      .post(`/api/v1/users/${fakeId}/follow`)
      .set('Cookie', user1.cookie);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /users/:userId/follow', () => {
  it('unfollows and decrements counters', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');

    await request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie);
    const res = await request
      .delete(`/api/v1/users/${user2.id}/follow`)
      .set('Cookie', user1.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.isFollowing).toBe(false);
    expect(res.body.data.followerCount).toBe(0);

    const [u1, u2] = await Promise.all([
      UserModel.findById(user1.id).select('followingCount').lean(),
      UserModel.findById(user2.id).select('followerCount').lean(),
    ]);
    expect(u1?.followingCount).toBe(0);
    expect(u2?.followerCount).toBe(0);
  });

  it('is idempotent — double unfollow does not go negative', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');

    await request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie);
    await request.delete(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie);
    const res = await request
      .delete(`/api/v1/users/${user2.id}/follow`)
      .set('Cookie', user1.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.isFollowing).toBe(false);
    const u2 = await UserModel.findById(user2.id).select('followerCount').lean();
    expect(u2?.followerCount).toBe(0);
  });

  it('rejects self-unfollow with 400', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const res = await request
      .delete(`/api/v1/users/${user1.id}/follow`)
      .set('Cookie', user1.cookie);
    expect(res.status).toBe(400);
  });
});

describe('Counter consistency under concurrent requests', () => {
  it('handles 10 concurrent follow requests — exactly 1 follow, counters correct', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');

    // Fire 10 concurrent follow requests from user1 → user2
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie),
      ),
    );

    // All requests should succeed (200 OK)
    for (const r of results) {
      expect(r.status).toBe(200);
    }

    // Exactly one Follow document
    const followCount = await FollowModel.countDocuments();
    expect(followCount).toBe(1);

    // Counters are correct — not inflated by duplicate increments
    const [u1, u2] = await Promise.all([
      UserModel.findById(user1.id).select('followingCount').lean(),
      UserModel.findById(user2.id).select('followerCount').lean(),
    ]);
    expect(u1?.followingCount).toBe(1);
    expect(u2?.followerCount).toBe(1);
  });

  it('handles mixed concurrent follow/unfollow — final state is consistent', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');

    // Follow first to have something to unfollow
    await request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie);

    // 5 concurrent unfollows
    await Promise.all(
      Array.from({ length: 5 }, () =>
        request.delete(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie),
      ),
    );

    const followCount = await FollowModel.countDocuments();
    expect(followCount).toBe(0);

    const u2 = await UserModel.findById(user2.id).select('followerCount').lean();
    expect(u2?.followerCount).toBe(0);
  });
});

describe('GET /users/:userId/followers', () => {
  it('lists followers with correct data shape', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');

    await request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie);

    const res = await request.get(`/api/v1/users/${user2.id}/followers`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const follower = res.body.data[0] as { _id: string; name: string; isFollowedByMe: boolean };
    expect(follower._id).toBe(user1.id);
    expect(follower.name).toBe('User One');
    expect(follower.isFollowedByMe).toBe(false); // no viewer
  });

  it('sets isFollowedByMe correctly when viewer is provided', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');
    const user3 = await createVerifiedUser('user3@example.com', 'User Three');

    // user1 and user3 both follow user2
    await Promise.all([
      request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie),
      request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user3.cookie),
    ]);
    // user1 follows user3
    await request.post(`/api/v1/users/${user3.id}/follow`).set('Cookie', user1.cookie);

    // Viewer = user1: get user2's followers. user3 is in the list; user1 follows user3 → isFollowedByMe=true
    const res = await request
      .get(`/api/v1/users/${user2.id}/followers`)
      .set('Cookie', user1.cookie);

    expect(res.status).toBe(200);
    const user3Entry = (res.body.data as { _id: string; isFollowedByMe: boolean }[]).find(
      (u) => u._id === user3.id,
    );
    expect(user3Entry?.isFollowedByMe).toBe(true);
  });

  it('supports cursor pagination', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');
    const user3 = await createVerifiedUser('user3@example.com', 'User Three');
    const user4 = await createVerifiedUser('user4@example.com', 'User Four');

    await Promise.all([
      request.post(`/api/v1/users/${user4.id}/follow`).set('Cookie', user1.cookie),
      request.post(`/api/v1/users/${user4.id}/follow`).set('Cookie', user2.cookie),
      request.post(`/api/v1/users/${user4.id}/follow`).set('Cookie', user3.cookie),
    ]);

    const page1 = await request.get(`/api/v1/users/${user4.id}/followers?limit=2`);
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta.hasMore).toBe(true);
    expect(page1.body.meta.nextCursor).toBeTruthy();

    const page2 = await request.get(
      `/api/v1/users/${user4.id}/followers?limit=2&cursor=${String(page1.body.meta.nextCursor)}`,
    );
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.meta.hasMore).toBe(false);
  });
});

describe('GET /users/:userId/following', () => {
  it('lists following users', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');
    const user3 = await createVerifiedUser('user3@example.com', 'User Three');

    await Promise.all([
      request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie),
      request.post(`/api/v1/users/${user3.id}/follow`).set('Cookie', user1.cookie),
    ]);

    const res = await request.get(`/api/v1/users/${user1.id}/following`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('GET /users/suggestions', () => {
  it('returns empty array for unauthenticated users', async () => {
    const res = await request.get('/api/v1/users/suggestions');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns popular users, excluding self and already-followed', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');
    const user3 = await createVerifiedUser('user3@example.com', 'User Three');

    // user1 already follows user2
    await request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie);

    const res = await request
      .get('/api/v1/users/suggestions')
      .set('Cookie', user1.cookie);

    expect(res.status).toBe(200);
    const ids = (res.body.data as { _id: string }[]).map((u) => u._id);
    // Should not include user1 (self) or user2 (already following)
    expect(ids).not.toContain(user1.id);
    expect(ids).not.toContain(user2.id);
    // Should include user3
    expect(ids).toContain(user3.id);
  });

  it('prioritises friends-of-friends with mutualCount', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');
    const user3 = await createVerifiedUser('user3@example.com', 'User Three');
    const user4 = await createVerifiedUser('user4@example.com', 'User Four');

    // user1 follows user2; user2 follows user3 — user3 is a FoF for user1
    await request.post(`/api/v1/users/${user2.id}/follow`).set('Cookie', user1.cookie);
    await request.post(`/api/v1/users/${user3.id}/follow`).set('Cookie', user2.cookie);

    const res = await request
      .get('/api/v1/users/suggestions')
      .set('Cookie', user1.cookie);

    expect(res.status).toBe(200);
    const user3Entry = (res.body.data as { _id: string; mutualCount: number }[]).find(
      (u) => u._id === user3.id,
    );
    expect(user3Entry).toBeDefined();
    expect(user3Entry?.mutualCount).toBe(1);
    // user4 (no mutual) should be below user3 in the list
    const user3Idx = res.body.data.findIndex((u: { _id: string }) => u._id === user3.id);
    const user4Idx = res.body.data.findIndex((u: { _id: string }) => u._id === user4.id);
    if (user4Idx !== -1) {
      expect(user3Idx).toBeLessThan(user4Idx);
    }
  });
});
