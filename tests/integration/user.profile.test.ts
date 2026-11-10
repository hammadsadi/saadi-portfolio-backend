import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setEmailProvider } from '@/modules/email/email.service.js';
import { captureEmailProvider } from '../helpers/emails.js';
import { seedOtp, TEST_OTP } from '../helpers/otp.js';
import { UserModel } from '@/modules/user/user.model.js';
import { CommentModel } from '@/modules/comment/comment.model.js';
import { LikeModel } from '@/modules/like/like.model.js';
import { FollowModel } from '@/modules/follow/follow.model.js';
import { PostModel } from '@/modules/blog/post.model.js';

setEmailProvider(captureEmailProvider);

const { default: app } = await import('@/app.js');
const request = supertest(app);

// ─── DB lifecycle ─────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TestUser {
  id: string;
  cookie: string;
  email: string;
}

async function createVerifiedUser(email: string, name: string): Promise<TestUser> {
  await request.post('/api/v1/auth/register').send({ name, email, password: 'Password1!' });
  const user = await UserModel.findOne({ email });
  if (!user) throw new Error(`User not created: ${email}`);
  await seedOtp(String(user._id), 'verify_email');
  const verifyRes = await request
    .post('/api/v1/auth/verify-email')
    .send({ email, otp: TEST_OTP });
  const setCookie = verifyRes.headers['set-cookie'] as string[] | undefined;
  const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : '';
  return { id: String(user._id), cookie, email };
}

// ─── PATCH /users/me — email immutability ─────────────────────────────────────

describe('PATCH /users/me — strict schema', () => {
  it('returns 400 when email is included in the request body', async () => {
    const user = await createVerifiedUser('strict@example.com', 'Strict User');
    const res = await request
      .patch('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ name: 'New Name', email: 'hacker@example.com' });

    expect(res.status).toBe(400);
    // Email must NOT be updated
    const dbUser = await UserModel.findById(user.id).lean();
    expect(dbUser?.email).toBe('strict@example.com');
  });

  it('allows updating name without touching email', async () => {
    const user = await createVerifiedUser('nameupdate@example.com', 'Original Name');
    const res = await request
      .patch('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
    expect(res.body.data.email).toBe('nameupdate@example.com');
  });

  it('allows updating username, bio, and notification preferences', async () => {
    const user = await createVerifiedUser('prefs@example.com', 'Prefs User');
    const res = await request
      .patch('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({
        username: 'prefs_user',
        bio: 'Hello world',
        notificationPreferences: { newFollower: false, comments: true, replies: false, productUpdates: false },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('prefs_user');
    expect(res.body.data.bio).toBe('Hello world');
    expect(res.body.data.notificationPreferences.newFollower).toBe(false);
  });

  it('returns 400 for unknown keys', async () => {
    const user = await createVerifiedUser('unknown@example.com', 'Unknown Keys');
    const res = await request
      .patch('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ role: 'admin' });

    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request.patch('/api/v1/users/me').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

// ─── Username cooldown ────────────────────────────────────────────────────────

describe('PATCH /users/me — username cooldown', () => {
  it('allows setting a username for the first time', async () => {
    const user = await createVerifiedUser('firstusername@example.com', 'FirstUser');
    const res = await request
      .patch('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ username: 'firstuser123' });

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('firstuser123');
  });

  it('blocks a second username change within 30 days', async () => {
    const user = await createVerifiedUser('cooldown@example.com', 'CooldownUser');

    // First change — succeeds
    await request
      .patch('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ username: 'cooldown_first' });

    // Second change immediately — should fail with 409
    const second = await request
      .patch('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ username: 'cooldown_second' });

    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/30 day/i);
  });

  it('allows changing username after the 30-day cooldown has passed', async () => {
    const user = await createVerifiedUser('cooldown2@example.com', 'CooldownUser2');

    // Set an old usernameChangedAt directly in DB (31 days ago)
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await UserModel.updateOne(
      { _id: user.id },
      { $set: { username: 'old_username', usernameChangedAt: thirtyOneDaysAgo } },
    );

    const res = await request
      .patch('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ username: 'new_username_after_cooldown' });

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('new_username_after_cooldown');
  });

  it('returns 409 when username is already taken', async () => {
    const user1 = await createVerifiedUser('taken1@example.com', 'Taken1');
    const user2 = await createVerifiedUser('taken2@example.com', 'Taken2');

    await request
      .patch('/api/v1/users/me')
      .set('Cookie', user1.cookie)
      .send({ username: 'takenuser' });

    const res = await request
      .patch('/api/v1/users/me')
      .set('Cookie', user2.cookie)
      .send({ username: 'takenuser' });

    expect(res.status).toBe(409);
  });

  it('rejects reserved usernames', async () => {
    const user = await createVerifiedUser('reserved@example.com', 'Reserved');
    const res = await request
      .patch('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ username: 'admin' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /users/:username — public profile ───────────────────────────────────

describe('GET /users/:username', () => {
  it('returns public profile for a user with a username', async () => {
    const user = await createVerifiedUser('publicprofile@example.com', 'Public User');
    await UserModel.updateOne({ _id: user.id }, { $set: { username: 'public_user_123' } });

    const res = await request.get('/api/v1/users/public_user_123');
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('public_user_123');
    expect(res.body.data.name).toBe('Public User');
    expect(res.body.data.email).toBeUndefined();
    expect(res.body.data.isFollowedByMe).toBe(false);
  });

  it('returns 404 for non-existent username', async () => {
    const res = await request.get('/api/v1/users/doesnotexist999');
    expect(res.status).toBe(404);
  });

  it('returns isFollowedByMe=true when viewer follows the user', async () => {
    const target = await createVerifiedUser('targetuser@example.com', 'Target');
    await UserModel.updateOne({ _id: target.id }, { $set: { username: 'target_user_x' } });

    const viewer = await createVerifiedUser('vieweruser@example.com', 'Viewer');
    await request
      .post(`/api/v1/users/${target.id}/follow`)
      .set('Cookie', viewer.cookie);

    const res = await request
      .get('/api/v1/users/target_user_x')
      .set('Cookie', viewer.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.isFollowedByMe).toBe(true);
  });
});

// ─── GET /users/:username/posts ───────────────────────────────────────────────

describe('GET /users/:username/posts', () => {
  it('returns published posts for a user', async () => {
    const user = await createVerifiedUser('postauthor@example.com', 'Post Author');
    await UserModel.updateOne({ _id: user.id }, { $set: { username: 'postauthor_x' } });

    // Seed a published post directly
    await PostModel.create({
      title: 'My Post',
      slug: 'my-post',
      content: '# Hello',
      excerpt: 'Hello',
      author: user.id,
      status: 'published',
      publishedAt: new Date(),
      readingTime: 1,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      trendingScore: 0,
    });

    const res = await request.get('/api/v1/users/postauthor_x/posts');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('My Post');
  });

  it('returns 404 for non-existent username', async () => {
    const res = await request.get('/api/v1/users/ghostuser99/posts');
    expect(res.status).toBe(404);
  });
});

// ─── POST /users/me/change-password ──────────────────────────────────────────

describe('POST /users/me/change-password', () => {
  it('changes password, revokes all sessions, and clears cookies', async () => {
    const user = await createVerifiedUser('changepw@example.com', 'ChangePW');

    const res = await request
      .post('/api/v1/users/me/change-password')
      .set('Cookie', user.cookie)
      .send({ currentPassword: 'Password1!', newPassword: 'NewPassword2!' });

    expect(res.status).toBe(200);
    // Cookie should be cleared
    const setCookieHeader = res.headers['set-cookie'] as string[] | undefined;
    const clearedCookies = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : '';
    expect(clearedCookies).toMatch(/accessToken=;|accessToken=/);

    // Old password should no longer work
    const loginOld = await request
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@example.com', password: 'Password1!' });
    expect(loginOld.status).toBe(401);

    // New password should work
    const loginNew = await request
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@example.com', password: 'NewPassword2!' });
    expect(loginNew.status).toBe(200);
  });

  it('returns 400 for wrong current password', async () => {
    const user = await createVerifiedUser('wrongpw@example.com', 'WrongPW');
    const res = await request
      .post('/api/v1/users/me/change-password')
      .set('Cookie', user.cookie)
      .send({ currentPassword: 'WrongPassword1!', newPassword: 'NewPassword2!' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when new password is same as current', async () => {
    const user = await createVerifiedUser('samepw@example.com', 'SamePW');
    const res = await request
      .post('/api/v1/users/me/change-password')
      .set('Cookie', user.cookie)
      .send({ currentPassword: 'Password1!', newPassword: 'Password1!' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for weak new password', async () => {
    const user = await createVerifiedUser('weakpw@example.com', 'WeakPW');
    const res = await request
      .post('/api/v1/users/me/change-password')
      .set('Cookie', user.cookie)
      .send({ currentPassword: 'Password1!', newPassword: 'weak' });

    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request
      .post('/api/v1/users/me/change-password')
      .send({ currentPassword: 'Password1!', newPassword: 'NewPassword2!' });
    expect(res.status).toBe(401);
  });
});

// ─── POST /users/me/set-password (OAuth users) ───────────────────────────────

describe('POST /users/me/set-password', () => {
  it('sets a password for an OAuth-only user via OTP', async () => {
    // Create an OAuth user directly (no passwordHash)
    const oauthUser = await UserModel.create({
      name: 'OAuth User',
      email: 'oauth@example.com',
      authProviders: [{ provider: 'google', providerId: 'google-123' }],
      isEmailVerified: true,
    });

    // Log them in via the token (simulate by calling login directly — use a forced cookie)
    // We'll seed a valid session by calling register+verify (but this user has no password)
    // Instead, seed an OTP directly for set_password
    await seedOtp(String(oauthUser._id), 'set_password');

    // Request set-password endpoint
    const loginRes = await request.post('/api/v1/auth/login').send({
      email: 'oauth@example.com',
      password: 'whatever',
    });
    // OAuth user has no password so login fails — that's expected
    expect(loginRes.status).toBe(401);

    // For testing we need an authenticated session — create user via normal path
    // but then manually remove passwordHash
    const normalUser = await createVerifiedUser('oauthtest@example.com', 'OAuthTest');
    await UserModel.updateOne({ _id: normalUser.id }, { $unset: { passwordHash: 1 } });

    // Request OTP
    const reqOtp = await request
      .post('/api/v1/users/me/set-password/request')
      .set('Cookie', normalUser.cookie);
    expect(reqOtp.status).toBe(200);

    // Seed the OTP directly
    await seedOtp(normalUser.id, 'set_password');

    // Set the password
    const setRes = await request
      .post('/api/v1/users/me/set-password')
      .set('Cookie', normalUser.cookie)
      .send({ otp: TEST_OTP, newPassword: 'OAuthNewPass1!' });
    expect(setRes.status).toBe(200);

    // Can now log in with password
    const loginWithPw = await request.post('/api/v1/auth/login').send({
      email: 'oauthtest@example.com',
      password: 'OAuthNewPass1!',
    });
    expect(loginWithPw.status).toBe(200);
  });

  it('returns 400 if user already has a password', async () => {
    const user = await createVerifiedUser('haspw@example.com', 'HasPW');
    const res = await request
      .post('/api/v1/users/me/set-password/request')
      .set('Cookie', user.cookie);
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /users/me — soft delete ──────────────────────────────────────────

describe('DELETE /users/me', () => {
  it('soft-deletes the account with correct password', async () => {
    const user = await createVerifiedUser('delete@example.com', 'Delete User');

    const res = await request
      .delete('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ password: 'Password1!' });

    expect(res.status).toBe(200);

    // User should be anonymized
    const dbUser = await UserModel.findById(user.id).lean();
    expect(dbUser?.deletedAt).not.toBeNull();
    expect(dbUser?.name).toBe('Deleted User');
    expect(dbUser?.email).toMatch(/deleted\.invalid/);
    expect(dbUser?.isBlocked).toBe(true);
  });

  it('removes follows and decrements counters on delete', async () => {
    const user = await createVerifiedUser('deletef@example.com', 'DeleteFollows');
    const other = await createVerifiedUser('deletef2@example.com', 'OtherUser');

    // user follows other
    await request.post(`/api/v1/users/${other.id}/follow`).set('Cookie', user.cookie);
    // other follows user
    await request.post(`/api/v1/users/${user.id}/follow`).set('Cookie', other.cookie);

    // Verify follow counts
    const otherBefore = await UserModel.findById(other.id).lean();
    expect(otherBefore?.followerCount).toBe(1);

    // Delete user
    await request
      .delete('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ password: 'Password1!' });

    // other's followerCount should be decremented (user no longer follows)
    const otherAfter = await UserModel.findById(other.id).lean();
    expect(otherAfter?.followerCount).toBe(0);
    // other's followingCount should be decremented (other no longer follows deleted user)
    expect(otherAfter?.followingCount).toBe(0);

    // All follows involving deleted user removed
    const follows = await FollowModel.find({
      $or: [{ follower: user.id }, { following: user.id }],
    }).lean();
    expect(follows).toHaveLength(0);
  });

  it('anonymizes comments on delete', async () => {
    const user = await createVerifiedUser('deletecomment@example.com', 'DeleteComment');
    const author = await createVerifiedUser('postauthor2@example.com', 'PostAuthor2');
    const post = await PostModel.create({
      title: 'Test Post',
      slug: 'test-post-dc',
      content: '# Hello',
      excerpt: 'Hello',
      author: author.id,
      status: 'published',
      publishedAt: new Date(),
      readingTime: 1,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      trendingScore: 0,
    });

    // Create a comment by user
    await CommentModel.create({
      post: post._id,
      user: user.id,
      content: 'This is my comment',
      likeCount: 0,
      replyCount: 0,
      isEdited: false,
      isDeleted: false,
    });

    // Delete user
    await request
      .delete('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ password: 'Password1!' });

    const comment = await CommentModel.findOne({ user: user.id }).lean();
    expect(comment?.content).toBe('[deleted]');
    expect(comment?.isDeleted).toBe(true);
  });

  it('returns 400 for wrong password', async () => {
    const user = await createVerifiedUser('deletewrong@example.com', 'DeleteWrong');
    const res = await request
      .delete('/api/v1/users/me')
      .set('Cookie', user.cookie)
      .send({ password: 'WrongPassword1!' });

    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request
      .delete('/api/v1/users/me')
      .send({ password: 'Password1!' });
    expect(res.status).toBe(401);
  });
});
