import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setEmailProvider } from '@/modules/email/email.service.js';
import { captureEmailProvider } from '../helpers/emails.js';
import { seedOtp, TEST_OTP } from '../helpers/otp.js';
import { UserModel } from '@/modules/user/user.model.js';
import { PostModel } from '@/modules/blog/post.model.js';
import { FollowModel } from '@/modules/follow/follow.model.js';

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
  return { id: String(user._id), cookie };
}

// Creates a published post directly in MongoDB (bypasses HTTP to avoid siteSettings dependency)
async function seedPublishedPost(
  authorId: string,
  overrides: { title?: string; trendingScore?: number; publishedAt?: Date } = {},
): Promise<string> {
  const title = overrides.title ?? `Post by ${authorId.slice(-4)}`;
  const doc = await PostModel.create({
    title,
    slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`,
    excerpt: 'Test excerpt',
    content: 'Test content',
    tags: [],
    status: 'published',
    publishedAt: overrides.publishedAt ?? new Date(),
    readingTime: 1,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    trendingScore: overrides.trendingScore ?? 0,
    author: new mongoose.Types.ObjectId(authorId),
    seo: {},
  });
  return String(doc._id);
}

async function followUser(followerCookie: string, targetId: string): Promise<void> {
  await request
    .post(`/api/v1/users/${targetId}/follow`)
    .set('Cookie', followerCookie);
}

// ─── GET /feed/following ──────────────────────────────────────────────────────

describe('GET /feed/following', () => {
  it('returns only published posts from followed users', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    const bob = await createVerifiedUser('bob@example.com', 'Bob');
    const carol = await createVerifiedUser('carol@example.com', 'Carol');

    await seedPublishedPost(bob.id, { title: 'Bob Post' });
    await seedPublishedPost(carol.id, { title: 'Carol Post' });

    // Alice follows Bob only
    await followUser(alice.cookie, bob.id);

    const res = await request
      .get('/api/v1/feed/following')
      .set('Cookie', alice.cookie);

    expect(res.status).toBe(200);
    const titles = (res.body.data as { title: string }[]).map((p) => p.title);
    expect(titles).toContain('Bob Post');
    expect(titles).not.toContain('Carol Post');
  });

  it('includes own posts even when following nobody', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    await seedPublishedPost(alice.id, { title: 'My Own Post' });

    const res = await request
      .get('/api/v1/feed/following')
      .set('Cookie', alice.cookie);

    expect(res.status).toBe(200);
    const titles = (res.body.data as { title: string }[]).map((p) => p.title);
    expect(titles).toContain('My Own Post');
    expect(res.body.meta.followsNobody).toBe(true);
  });

  it('sets followsNobody: true when user follows no one', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');

    const res = await request
      .get('/api/v1/feed/following')
      .set('Cookie', alice.cookie);

    expect(res.status).toBe(200);
    expect(res.body.meta.followsNobody).toBe(true);
  });

  it('excludes draft and pending posts', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    const bob = await createVerifiedUser('bob@example.com', 'Bob');
    await followUser(alice.cookie, bob.id);

    // Insert a draft and a pending post directly
    await PostModel.create({
      title: 'Bob Draft',
      slug: 'bob-draft',
      excerpt: 'x',
      content: 'x',
      tags: [],
      status: 'draft',
      readingTime: 1,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      trendingScore: 0,
      author: new mongoose.Types.ObjectId(bob.id),
      seo: {},
    });
    await PostModel.create({
      title: 'Bob Pending',
      slug: 'bob-pending',
      excerpt: 'x',
      content: 'x',
      tags: [],
      status: 'pending',
      readingTime: 1,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      trendingScore: 0,
      author: new mongoose.Types.ObjectId(bob.id),
      seo: {},
    });

    const res = await request
      .get('/api/v1/feed/following')
      .set('Cookie', alice.cookie);

    expect(res.status).toBe(200);
    const titles = (res.body.data as { title: string }[]).map((p) => p.title);
    expect(titles).not.toContain('Bob Draft');
    expect(titles).not.toContain('Bob Pending');
  });

  it('removes posts from unfollowed users on next fetch', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    const bob = await createVerifiedUser('bob@example.com', 'Bob');

    await seedPublishedPost(bob.id, { title: 'Bob Post' });
    await followUser(alice.cookie, bob.id);

    const before = await request
      .get('/api/v1/feed/following')
      .set('Cookie', alice.cookie);
    expect((before.body.data as { title: string }[]).some((p) => p.title === 'Bob Post')).toBe(true);

    // Unfollow Bob
    await request
      .delete(`/api/v1/users/${bob.id}/follow`)
      .set('Cookie', alice.cookie);

    const after = await request
      .get('/api/v1/feed/following')
      .set('Cookie', alice.cookie);
    const titles = (after.body.data as { title: string }[]).map((p) => p.title);
    expect(titles).not.toContain('Bob Post');
  });

  it('returns posts sorted newest first', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    const bob = await createVerifiedUser('bob@example.com', 'Bob');
    await followUser(alice.cookie, bob.id);

    const older = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const newer = new Date(Date.now() - 1 * 60 * 60 * 1000);
    await seedPublishedPost(bob.id, { title: 'Old Post', publishedAt: older });
    await seedPublishedPost(bob.id, { title: 'New Post', publishedAt: newer });

    const res = await request
      .get('/api/v1/feed/following')
      .set('Cookie', alice.cookie);

    expect(res.status).toBe(200);
    const data = res.body.data as { title: string }[];
    expect(data[0]?.title).toBe('New Post');
    expect(data[1]?.title).toBe('Old Post');
  });

  it('supports cursor pagination and returns correct pages', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    const bob = await createVerifiedUser('bob@example.com', 'Bob');
    await followUser(alice.cookie, bob.id);

    // Create 5 posts at different timestamps
    for (let i = 0; i < 5; i++) {
      await seedPublishedPost(bob.id, {
        title: `Post ${String(i)}`,
        publishedAt: new Date(Date.now() - i * 60 * 60 * 1000),
      });
    }

    const page1 = await request
      .get('/api/v1/feed/following?limit=3')
      .set('Cookie', alice.cookie);

    expect(page1.status).toBe(200);
    expect((page1.body.data as unknown[]).length).toBe(3);
    expect(page1.body.meta.hasMore).toBe(true);
    expect(typeof page1.body.meta.nextCursor).toBe('string');

    const cursor = page1.body.meta.nextCursor as string;
    const page2 = await request
      .get(`/api/v1/feed/following?limit=3&cursor=${encodeURIComponent(cursor)}`)
      .set('Cookie', alice.cookie);

    expect(page2.status).toBe(200);
    expect((page2.body.data as unknown[]).length).toBe(2);
    expect(page2.body.meta.hasMore).toBe(false);

    // Ensure no overlap between pages
    const page1Ids = (page1.body.data as { _id: string }[]).map((p) => p._id);
    const page2Ids = (page2.body.data as { _id: string }[]).map((p) => p._id);
    const overlap = page1Ids.filter((id) => page2Ids.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const res = await request.get('/api/v1/feed/following');
    expect(res.status).toBe(401);
  });

  it('includes author summary and likedByMe on each item', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    const bob = await createVerifiedUser('bob@example.com', 'Bob');
    await followUser(alice.cookie, bob.id);
    const postId = await seedPublishedPost(bob.id, { title: 'Bob Post' });

    // Alice likes the post
    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', alice.cookie)
      .send({ targetType: 'post', targetId: postId });

    const res = await request
      .get('/api/v1/feed/following')
      .set('Cookie', alice.cookie);

    expect(res.status).toBe(200);
    const post = (res.body.data as { title: string; author: { name: string }; likedByMe: boolean }[])
      .find((p) => p.title === 'Bob Post');
    expect(post).toBeDefined();
    expect(post?.author.name).toBe('Bob');
    expect(post?.likedByMe).toBe(true);
  });
});

// ─── GET /feed/trending ───────────────────────────────────────────────────────

describe('GET /feed/trending', () => {
  it('returns published posts sorted by trendingScore descending', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');

    await seedPublishedPost(alice.id, { title: 'Low Score', trendingScore: 1 });
    await seedPublishedPost(alice.id, { title: 'High Score', trendingScore: 100 });
    await seedPublishedPost(alice.id, { title: 'Mid Score', trendingScore: 50 });

    const res = await request.get('/api/v1/feed/trending');

    expect(res.status).toBe(200);
    const data = res.body.data as { title: string }[];
    expect(data[0]?.title).toBe('High Score');
    expect(data[1]?.title).toBe('Mid Score');
    expect(data[2]?.title).toBe('Low Score');
  });

  it('excludes unpublished posts', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');

    await PostModel.create({
      title: 'Draft Post',
      slug: 'draft-post',
      excerpt: 'x',
      content: 'x',
      tags: [],
      status: 'draft',
      readingTime: 1,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      trendingScore: 999,
      author: new mongoose.Types.ObjectId(alice.id),
      seo: {},
    });

    const res = await request.get('/api/v1/feed/trending');
    expect(res.status).toBe(200);
    const titles = (res.body.data as { title: string }[]).map((p) => p.title);
    expect(titles).not.toContain('Draft Post');
  });

  it('filters by range=24h', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');

    await seedPublishedPost(alice.id, {
      title: 'Old Post',
      trendingScore: 100,
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    });
    await seedPublishedPost(alice.id, {
      title: 'Recent Post',
      trendingScore: 10,
      publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    });

    const res = await request.get('/api/v1/feed/trending?range=24h');

    expect(res.status).toBe(200);
    const titles = (res.body.data as { title: string }[]).map((p) => p.title);
    expect(titles).toContain('Recent Post');
    expect(titles).not.toContain('Old Post');
  });

  it('supports cursor pagination without duplicates', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');

    for (let i = 0; i < 5; i++) {
      await seedPublishedPost(alice.id, {
        title: `Trending Post ${String(i)}`,
        trendingScore: (5 - i) * 10,
      });
    }

    const page1 = await request.get('/api/v1/feed/trending?limit=3');
    expect(page1.status).toBe(200);
    expect((page1.body.data as unknown[]).length).toBe(3);
    expect(page1.body.meta.hasMore).toBe(true);

    const cursor = page1.body.meta.nextCursor as string;
    const page2 = await request.get(
      `/api/v1/feed/trending?limit=3&cursor=${encodeURIComponent(cursor)}`,
    );

    expect(page2.status).toBe(200);
    expect((page2.body.data as unknown[]).length).toBe(2);

    const p1Ids = (page1.body.data as { _id: string }[]).map((p) => p._id);
    const p2Ids = (page2.body.data as { _id: string }[]).map((p) => p._id);
    expect(p1Ids.filter((id) => p2Ids.includes(id))).toHaveLength(0);
  });

  it('is public — works without authentication', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    await seedPublishedPost(alice.id, { title: 'Public Post' });

    const res = await request.get('/api/v1/feed/trending');
    expect(res.status).toBe(200);
  });

  it('sets likedByMe correctly when viewer is authenticated', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    const bob = await createVerifiedUser('bob@example.com', 'Bob');
    const postId = await seedPublishedPost(bob.id, { title: 'Bob Trending', trendingScore: 50 });

    // Alice likes the post
    await request
      .post('/api/v1/likes/toggle')
      .set('Cookie', alice.cookie)
      .send({ targetType: 'post', targetId: postId });

    const res = await request
      .get('/api/v1/feed/trending')
      .set('Cookie', alice.cookie);

    expect(res.status).toBe(200);
    const post = (res.body.data as { title: string; likedByMe: boolean }[])
      .find((p) => p.title === 'Bob Trending');
    expect(post?.likedByMe).toBe(true);
  });
});

// ─── User post authoring ──────────────────────────────────────────────────────

describe('POST /posts/my (user authoring)', () => {
  it('verified user can create a post', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');

    const res = await request
      .post('/api/v1/posts/my')
      .set('Cookie', alice.cookie)
      .send({
        title: 'My First Post',
        excerpt: 'An introduction',
        content: '# Hello world',
        tags: ['typescript'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('My First Post');
    // No moderation configured → published immediately
    expect(res.body.data.status).toBe('published');
  });

  it('requires authentication', async () => {
    const res = await request.post('/api/v1/posts/my').send({
      title: 'Anon Post',
      excerpt: 'x',
      content: 'x',
    });
    expect(res.status).toBe(401);
  });

  it('user can list own posts', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    await request
      .post('/api/v1/posts/my')
      .set('Cookie', alice.cookie)
      .send({ title: 'Alice Post', excerpt: 'x', content: 'x' });

    const res = await request.get('/api/v1/posts/my').set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect((res.body.data as { title: string }[]).some((p) => p.title === 'Alice Post')).toBe(true);
  });

  it('user cannot update another user\'s post', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    const bob = await createVerifiedUser('bob@example.com', 'Bob');
    const postId = await seedPublishedPost(bob.id, { title: "Bob's Post" });

    const res = await request
      .patch(`/api/v1/posts/my/${postId}`)
      .set('Cookie', alice.cookie)
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('user can delete own post', async () => {
    const alice = await createVerifiedUser('alice@example.com', 'Alice');
    const createRes = await request
      .post('/api/v1/posts/my')
      .set('Cookie', alice.cookie)
      .send({ title: 'To Delete', excerpt: 'x', content: 'x' });

    const id = (createRes.body.data as { _id: string })._id;
    const deleteRes = await request
      .delete(`/api/v1/posts/my/${id}`)
      .set('Cookie', alice.cookie);
    expect(deleteRes.status).toBe(200);
  });
});
