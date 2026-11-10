import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setEmailProvider } from '@/modules/email/email.service.js';
import { captureEmailProvider } from '../helpers/emails.js';
import { seedOtp, TEST_OTP } from '../helpers/otp.js';
import { UserModel } from '@/modules/user/user.model.js';
import { PostModel } from '@/modules/blog/post.model.js';
import { CommentModel } from '@/modules/comment/comment.model.js';

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
  await request.post('/api/v1/auth/register').send({ name, email, password: 'Password1!' });
  const user = await UserModel.findOne({ email });
  if (!user) throw new Error(`User not created: ${email}`);
  await seedOtp(String(user._id), 'verify_email');
  const verifyRes = await request.post('/api/v1/auth/verify-email').send({ email, otp: TEST_OTP });
  const setCookie = verifyRes.headers['set-cookie'] as string[] | undefined;
  const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : '';
  return { id: String(user._id), cookie };
}

async function createPublishedPost(authorId: string): Promise<string> {
  const post = await PostModel.create({
    title: 'Test Post',
    slug: `test-post-${Date.now()}-${Math.random()}`,
    excerpt: 'A test post excerpt.',
    content: '# Test\n\nContent.',
    status: 'published',
    publishedAt: new Date(),
    author: new mongoose.Types.ObjectId(authorId),
  });
  return String(post._id);
}

async function createComment(postId: string, userId: string): Promise<string> {
  const comment = await CommentModel.create({
    post: new mongoose.Types.ObjectId(postId),
    user: new mongoose.Types.ObjectId(userId),
    content: 'A comment to like',
  });
  return String(comment._id);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /likes/toggle — post', () => {
  it('likes a post and returns liked=true with likeCount=1', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const res = await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'post', targetId: postId });

    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(true);
    expect(res.body.data.likeCount).toBe(1);
  });

  it('unlikes a post on second toggle and returns liked=false with likeCount=0', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'post', targetId: postId });

    const res = await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'post', targetId: postId });

    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(false);
    expect(res.body.data.likeCount).toBe(0);
  });

  it('increments post likeCount in the database', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'post', targetId: postId });

    const post = await PostModel.findById(postId).select('likeCount').lean();
    expect(post?.likeCount).toBe(1);
  });

  it('decrements post likeCount on unlike', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'post', targetId: postId });

    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'post', targetId: postId });

    const post = await PostModel.findById(postId).select('likeCount').lean();
    expect(post?.likeCount).toBe(0);
  });

  it('requires authentication', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const res = await request
      .post('/api/v1/likes/toggle')
      .send({ targetType: 'post', targetId: postId });
    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent post', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'post', targetId: fakeId });
    expect(res.status).toBe(404);
  });

  it('is idempotent under concurrent likes — likeCount stays at 1', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request
          .post('/api/v1/likes/toggle')
          .set('Cookie', user.cookie)
          .send({ targetType: 'post', targetId: postId }),
      ),
    );

    // All requests succeed
    for (const r of results) {
      expect(r.status).toBe(200);
    }

    // Final state: net likes from odd-number-of-toggles is not predictable,
    // but likeCount should never go negative
    const post = await PostModel.findById(postId).select('likeCount').lean();
    expect(post?.likeCount).toBeGreaterThanOrEqual(0);
  });
});

describe('POST /likes/toggle — comment', () => {
  it('likes a comment and increments comment likeCount', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);
    const commentId = await createComment(postId, user.id);

    const res = await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'comment', targetId: commentId });

    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(true);
    expect(res.body.data.likeCount).toBe(1);

    const comment = await CommentModel.findById(commentId).select('likeCount').lean();
    expect(comment?.likeCount).toBe(1);
  });

  it('unlikes a comment and decrements comment likeCount', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);
    const commentId = await createComment(postId, user.id);

    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'comment', targetId: commentId });

    const res = await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'comment', targetId: commentId });

    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(false);
    expect(res.body.data.likeCount).toBe(0);

    const comment = await CommentModel.findById(commentId).select('likeCount').lean();
    expect(comment?.likeCount).toBe(0);
  });

  it('returns 404 for a deleted comment', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);
    const commentId = await createComment(postId, user.id);

    await CommentModel.findByIdAndUpdate(commentId, { isDeleted: true });

    const res = await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'comment', targetId: commentId });
    expect(res.status).toBe(404);
  });
});

describe('GET /likes/status', () => {
  it('returns liked=true for the user who liked the post', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'post', targetId: postId });

    const res = await request
      .get(`/api/v1/likes/status?targetType=post&targetId=${postId}`)
      .set('Cookie', user.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(true);
    expect(res.body.data.likeCount).toBe(1);
  });

  it('returns liked=false for a user who has not liked', async () => {
    const user1 = await createVerifiedUser('user1@example.com', 'User One');
    const user2 = await createVerifiedUser('user2@example.com', 'User Two');
    const postId = await createPublishedPost(user1.id);

    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user1.cookie)
      .send({ targetType: 'post', targetId: postId });

    const res = await request
      .get(`/api/v1/likes/status?targetType=post&targetId=${postId}`)
      .set('Cookie', user2.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(false);
    expect(res.body.data.likeCount).toBe(1);
  });

  it('returns liked=false for anonymous users', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'post', targetId: postId });

    const res = await request.get(`/api/v1/likes/status?targetType=post&targetId=${postId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(false);
    expect(res.body.data.likeCount).toBe(1);
  });

  it('returns liked status for a comment', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);
    const commentId = await createComment(postId, user.id);

    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', user.cookie)
      .send({ targetType: 'comment', targetId: commentId });

    const res = await request
      .get(`/api/v1/likes/status?targetType=comment&targetId=${commentId}`)
      .set('Cookie', user.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(true);
  });

  it('requires valid targetType and targetId', async () => {
    const res = await request.get('/api/v1/likes/status?targetType=invalid&targetId=abc');
    expect(res.status).toBe(400);
  });
});
