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

async function createAdminUser(email: string, name: string): Promise<TestUser> {
  const user = await createVerifiedUser(email, name);
  await UserModel.findByIdAndUpdate(user.id, { role: 'admin' });
  // Re-login to get a cookie that reflects admin role
  const loginRes = await request
    .post('/api/v1/auth/login')
    .send({ email, password: 'Password1!' });
  const setCookie = loginRes.headers['set-cookie'] as string[] | undefined;
  const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : '';
  return { id: user.id, cookie };
}

async function createPublishedPost(authorId: string): Promise<string> {
  const post = await PostModel.create({
    title: 'Test Post',
    slug: `test-post-${Date.now()}`,
    excerpt: 'A test post excerpt for integration tests.',
    content: '# Test\n\nSome markdown content.',
    status: 'published',
    publishedAt: new Date(),
    author: new mongoose.Types.ObjectId(authorId),
  });
  return String(post._id);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /comments', () => {
  it('returns empty list for a post with no comments', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const res = await request.get(`/api/v1/comments?postId=${postId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('lists top-level comments with correct shape', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Hello world' });

    const res = await request.get(`/api/v1/comments?postId=${postId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const comment = res.body.data[0] as {
      _id: string;
      content: string;
      likeCount: number;
      replyCount: number;
      isEdited: boolean;
      isDeleted: boolean;
      likedByMe: boolean;
    };
    expect(comment.content).toBe('Hello world');
    expect(comment.likeCount).toBe(0);
    expect(comment.replyCount).toBe(0);
    expect(comment.isEdited).toBe(false);
    expect(comment.isDeleted).toBe(false);
    expect(comment.likedByMe).toBe(false);
  });

  it('paginates correctly', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    for (let i = 0; i < 3; i++) {
      await CommentModel.create({
        post: new mongoose.Types.ObjectId(postId),
        user: new mongoose.Types.ObjectId(user.id),
        content: `Comment ${i}`,
      });
    }

    const res = await request.get(`/api/v1/comments?postId=${postId}&page=1&limit=2`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.meta.totalPages).toBe(2);
  });

  it('requires a valid postId', async () => {
    const res = await request.get('/api/v1/comments?postId=notanid');
    expect(res.status).toBe(400);
  });
});

describe('POST /comments', () => {
  it('creates a comment and increments post commentCount', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const res = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'My first comment' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('My first comment');
    expect(res.body.data.isDeleted).toBe(false);

    const post = await PostModel.findById(postId).select('commentCount').lean();
    expect(post?.commentCount).toBe(1);
  });

  it('requires authentication', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const res = await request
      .post('/api/v1/comments')
      .send({ postId, content: 'Should fail' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent post', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const fakePostId = new mongoose.Types.ObjectId().toString();

    const res = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId: fakePostId, content: 'Ghost comment' });
    expect(res.status).toBe(404);
  });

  it('strips XSS vectors from content', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const res = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Hello <script>alert("xss")</script> world' });

    expect(res.status).toBe(201);
    expect(res.body.data.content as string).not.toContain('<script>');
    expect(res.body.data.content as string).toContain('Hello');
  });

  it('rejects a duplicate comment submitted within 60 seconds', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);
    const content = 'Duplicate comment';

    await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content });

    const res = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content });

    expect(res.status).toBe(429);
  });
});

describe('POST /comments (replies)', () => {
  it('creates a reply and increments parent replyCount', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const parentRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Parent comment' });
    const parentId = String((parentRes.body.data as { _id: string })._id);

    const replyRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'A reply', parentId });

    expect(replyRes.status).toBe(201);
    expect(String((replyRes.body.data as { parent: string }).parent)).toBe(parentId);

    const parent = await CommentModel.findById(parentId).select('replyCount').lean();
    expect(parent?.replyCount).toBe(1);
  });

  it('returns 404 for a non-existent parent', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);
    const fakeParentId = new mongoose.Types.ObjectId().toString();

    const res = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Reply to ghost', parentId: fakeParentId });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /comments/:commentId', () => {
  it('updates own comment and sets isEdited', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const createRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Original content' });
    const commentId = String((createRes.body.data as { _id: string })._id);

    const patchRes = await request
      .patch(`/api/v1/comments/${commentId}`)
      .set('Cookie', user.cookie)
      .send({ content: 'Edited content' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.content).toBe('Edited content');
    expect(patchRes.body.data.isEdited).toBe(true);
  });

  it('forbids editing another user\'s comment', async () => {
    const owner = await createVerifiedUser('owner@example.com', 'Owner');
    const other = await createVerifiedUser('other@example.com', 'Other');
    const postId = await createPublishedPost(owner.id);

    const createRes = await request
      .post('/api/v1/comments')
      .set('Cookie', owner.cookie)
      .send({ postId, content: 'Owner comment' });
    const commentId = String((createRes.body.data as { _id: string })._id);

    const res = await request
      .patch(`/api/v1/comments/${commentId}`)
      .set('Cookie', other.cookie)
      .send({ content: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);
    const createRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Some comment' });
    const commentId = String((createRes.body.data as { _id: string })._id);

    const res = await request
      .patch(`/api/v1/comments/${commentId}`)
      .send({ content: 'No cookie' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /comments/:commentId', () => {
  it('soft-deletes own comment — content becomes [deleted], isDeleted true', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const createRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'To be deleted' });
    const commentId = String((createRes.body.data as { _id: string })._id);

    const delRes = await request
      .delete(`/api/v1/comments/${commentId}`)
      .set('Cookie', user.cookie);
    expect(delRes.status).toBe(200);

    const doc = await CommentModel.findById(commentId).lean();
    expect(doc?.isDeleted).toBe(true);

    // Deleted comment should appear as [deleted] in list
    const listRes = await request.get(`/api/v1/comments?postId=${postId}`);
    // A comment with no replies is filtered from the list (isDeleted + replyCount=0)
    expect(listRes.body.data).toHaveLength(0);
  });

  it('decrements post commentCount on soft delete', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const createRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Will be deleted' });
    const commentId = String((createRes.body.data as { _id: string })._id);

    await request.delete(`/api/v1/comments/${commentId}`).set('Cookie', user.cookie);

    const post = await PostModel.findById(postId).select('commentCount').lean();
    expect(post?.commentCount).toBe(0);
  });

  it('allows admin to delete any comment', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const admin = await createAdminUser('admin@example.com', 'Admin');
    const postId = await createPublishedPost(user.id);

    const createRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Admin will delete this' });
    const commentId = String((createRes.body.data as { _id: string })._id);

    const res = await request
      .delete(`/api/v1/comments/${commentId}`)
      .set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
  });

  it('forbids deleting another user\'s comment', async () => {
    const owner = await createVerifiedUser('owner@example.com', 'Owner');
    const other = await createVerifiedUser('other@example.com', 'Other');
    const postId = await createPublishedPost(owner.id);

    const createRes = await request
      .post('/api/v1/comments')
      .set('Cookie', owner.cookie)
      .send({ postId, content: 'Protected comment' });
    const commentId = String((createRes.body.data as { _id: string })._id);

    const res = await request
      .delete(`/api/v1/comments/${commentId}`)
      .set('Cookie', other.cookie);
    expect(res.status).toBe(403);
  });
});

describe('GET /comments/:commentId/replies', () => {
  it('lists replies in cursor order', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const parentRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Parent' });
    const parentId = String((parentRes.body.data as { _id: string })._id);

    // Post two replies via direct model insert to avoid duplicate-comment rate limit
    await CommentModel.create([
      { post: new mongoose.Types.ObjectId(postId), user: new mongoose.Types.ObjectId(user.id), parent: new mongoose.Types.ObjectId(parentId), content: 'Reply A' },
      { post: new mongoose.Types.ObjectId(postId), user: new mongoose.Types.ObjectId(user.id), parent: new mongoose.Types.ObjectId(parentId), content: 'Reply B' },
    ]);

    const res = await request.get(`/api/v1/comments/${parentId}/replies`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('supports cursor-based pagination', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const parentRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Parent' });
    const parentId = String((parentRes.body.data as { _id: string })._id);

    await CommentModel.create([
      { post: new mongoose.Types.ObjectId(postId), user: new mongoose.Types.ObjectId(user.id), parent: new mongoose.Types.ObjectId(parentId), content: 'Reply 1' },
      { post: new mongoose.Types.ObjectId(postId), user: new mongoose.Types.ObjectId(user.id), parent: new mongoose.Types.ObjectId(parentId), content: 'Reply 2' },
      { post: new mongoose.Types.ObjectId(postId), user: new mongoose.Types.ObjectId(user.id), parent: new mongoose.Types.ObjectId(parentId), content: 'Reply 3' },
    ]);

    const page1 = await request.get(`/api/v1/comments/${parentId}/replies?limit=2`);
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta.hasMore).toBe(true);
    const cursor = String(page1.body.meta.nextCursor);

    const page2 = await request.get(`/api/v1/comments/${parentId}/replies?limit=2&cursor=${cursor}`);
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.meta.hasMore).toBe(false);
  });
});

describe('DELETE /comments/admin/:commentId (hard delete)', () => {
  it('hard-deletes a comment as admin', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const admin = await createAdminUser('admin@example.com', 'Admin');
    const postId = await createPublishedPost(user.id);

    const createRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Hard delete target' });
    const commentId = String((createRes.body.data as { _id: string })._id);

    const res = await request
      .delete(`/api/v1/comments/admin/${commentId}`)
      .set('Cookie', admin.cookie);
    expect(res.status).toBe(200);

    const doc = await CommentModel.findById(commentId).lean();
    expect(doc).toBeNull();
  });

  it('requires admin role', async () => {
    const user = await createVerifiedUser('user@example.com', 'User');
    const postId = await createPublishedPost(user.id);

    const createRes = await request
      .post('/api/v1/comments')
      .set('Cookie', user.cookie)
      .send({ postId, content: 'Protected comment' });
    const commentId = String((createRes.body.data as { _id: string })._id);

    const res = await request
      .delete(`/api/v1/comments/admin/${commentId}`)
      .set('Cookie', user.cookie);
    expect(res.status).toBe(403);
  });
});
