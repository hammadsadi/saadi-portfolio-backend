import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setEmailProvider } from '@/modules/email/email.service.js';
import { captureEmailProvider } from '../helpers/emails.js';
import { seedOtp, TEST_OTP } from '../helpers/otp.js';
import { UserModel } from '@/modules/user/user.model.js';
import { PostModel } from '@/modules/blog/post.model.js';
import { ProfileModel } from '@/modules/profile/profile.model.js';
import { ViewDedupeModel, DailyViewStatModel } from '@/modules/view/view.model.js';

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

async function seedPublishedPost(authorId: string, slug = 'test-post'): Promise<string> {
  const post = await PostModel.create({
    title: 'Test Post',
    slug,
    content: '# Hello',
    excerpt: 'Hello',
    author: new Types.ObjectId(authorId),
    status: 'published',
    publishedAt: new Date(),
    readingTime: 1,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    trendingScore: 0,
  });
  return String(post._id);
}

async function seedProfile(): Promise<string> {
  const profile = await ProfileModel.create({
    fullName: 'Hammad Sadi',
    headline: 'Developer',
    shortBio: 'Bio',
    email: 'admin@example.com',
    availabilityStatus: 'available',
    yearsOfExperience: 5,
    viewCount: 0,
  });
  return String(profile._id);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/views — view recording', () => {
  it('records a view for a published post', async () => {
    const author = await createVerifiedUser('author@example.com', 'Author');
    const postId = await seedPublishedPost(author.id);

    const viewer = await createVerifiedUser('viewer@example.com', 'Viewer');
    const res = await request
      .post('/api/v1/views')
      .set('Cookie', viewer.cookie)
      .send({ targetType: 'post', targetId: postId });

    expect(res.status).toBe(200);
    expect(res.body.data.counted).toBe(true);

    const post = await PostModel.findById(postId).lean();
    expect(post?.viewCount).toBe(1);

    const stat = await DailyViewStatModel.findOne({ targetType: 'post' }).lean();
    expect(stat).not.toBeNull();
    expect(stat?.views).toBe(1);
  });

  it('deduplicates: same viewer same post same day counts only once', async () => {
    const author = await createVerifiedUser('author2@example.com', 'Author2');
    const postId = await seedPublishedPost(author.id, 'dedup-post');

    const viewer = await createVerifiedUser('viewer2@example.com', 'Viewer2');

    const first = await request
      .post('/api/v1/views')
      .set('Cookie', viewer.cookie)
      .send({ targetType: 'post', targetId: postId });
    expect(first.body.data.counted).toBe(true);

    const second = await request
      .post('/api/v1/views')
      .set('Cookie', viewer.cookie)
      .send({ targetType: 'post', targetId: postId });
    expect(second.body.data.counted).toBe(false);

    const post = await PostModel.findById(postId).lean();
    expect(post?.viewCount).toBe(1);
  });

  it('does not count a view when post author views their own post', async () => {
    const author = await createVerifiedUser('author3@example.com', 'Author3');
    const postId = await seedPublishedPost(author.id, 'own-post');

    const res = await request
      .post('/api/v1/views')
      .set('Cookie', author.cookie)
      .send({ targetType: 'post', targetId: postId });

    expect(res.status).toBe(200);
    expect(res.body.data.counted).toBe(false);

    const post = await PostModel.findById(postId).lean();
    expect(post?.viewCount).toBe(0);
  });

  it('does not count a view for unpublished/non-existent post', async () => {
    const viewer = await createVerifiedUser('viewer3@example.com', 'Viewer3');
    const fakeId = new Types.ObjectId().toString();

    const res = await request
      .post('/api/v1/views')
      .set('Cookie', viewer.cookie)
      .send({ targetType: 'post', targetId: fakeId });

    expect(res.status).toBe(200);
    expect(res.body.data.counted).toBe(false);
  });

  it('filters bot user agents', async () => {
    const author = await createVerifiedUser('author4@example.com', 'Author4');
    const postId = await seedPublishedPost(author.id, 'bot-post');

    const res = await request
      .post('/api/v1/views')
      .set('User-Agent', 'Googlebot/2.1 (+http://www.google.com/bot.html)')
      .send({ targetType: 'post', targetId: postId });

    expect(res.status).toBe(200);
    expect(res.body.data.counted).toBe(false);

    const post = await PostModel.findById(postId).lean();
    expect(post?.viewCount).toBe(0);
  });

  it('filters curl user agents', async () => {
    const author = await createVerifiedUser('author5@example.com', 'Author5');
    const postId = await seedPublishedPost(author.id, 'curl-post');

    const res = await request
      .post('/api/v1/views')
      .set('User-Agent', 'curl/7.86.0')
      .send({ targetType: 'post', targetId: postId });

    expect(res.status).toBe(200);
    expect(res.body.data.counted).toBe(false);
  });

  it('records a view for a profile (non-admin viewer)', async () => {
    const viewer = await createVerifiedUser('profileviewer@example.com', 'PViewer');
    const profileId = await seedProfile();

    // Create an admin user so ownerId resolution works
    await UserModel.create({
      name: 'Admin',
      email: 'admin@site.com',
      passwordHash: 'x',
      role: 'admin',
      isVerified: true,
    });

    const res = await request
      .post('/api/v1/views')
      .set('Cookie', viewer.cookie)
      .send({ targetType: 'profile', targetId: profileId });

    expect(res.status).toBe(200);
    expect(res.body.data.counted).toBe(true);

    const profile = await ProfileModel.findById(profileId).lean();
    expect(profile?.viewCount).toBe(1);
  });

  it('does not count profile view when viewer is admin', async () => {
    // Create admin user and log in
    const adminUser = await UserModel.create({
      name: 'Admin',
      email: 'admin2@site.com',
      passwordHash: 'x',
      role: 'admin',
      isVerified: true,
    });
    // Need a real login — seed password
    await request
      .post('/api/v1/auth/register')
      .send({ name: 'Admin2', email: 'admin2login@site.com', password: 'Password1!' });
    const rawAdmin = await UserModel.findOne({ email: 'admin2login@site.com' });
    if (rawAdmin) {
      rawAdmin.role = 'admin';
      await rawAdmin.save();
      await seedOtp(String(rawAdmin._id), 'verify_email');
      await request
        .post('/api/v1/auth/verify-email')
        .send({ email: 'admin2login@site.com', otp: TEST_OTP });
    }
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: 'admin2login@site.com', password: 'Password1!' });
    const adminCookie = (loginRes.headers['set-cookie'] as string[] | undefined)?.join('; ') ?? '';

    const profileId = await seedProfile();
    // Also need an admin user for ownerId resolution
    void adminUser; // already created above

    const res = await request
      .post('/api/v1/views')
      .set('Cookie', adminCookie)
      .send({ targetType: 'profile', targetId: profileId });

    expect(res.status).toBe(200);
    expect(res.body.data.counted).toBe(false);
  });

  it('anonymous visitor: first cookieless visit uses hash dedup; server sets anon_vid cookie', async () => {
    const author = await createVerifiedUser('author6@example.com', 'Author6');
    const postId = await seedPublishedPost(author.id, 'anon-post');

    // First request (no cookie) — server uses IP+UA hash and sets anon_vid
    const first = await request
      .post('/api/v1/views')
      .send({ targetType: 'post', targetId: postId });
    expect(first.body.data.counted).toBe(true);

    const setCookieHeader = first.headers['set-cookie'] as string[] | undefined;
    expect(Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : '').toContain('anon_vid');

    // Second cookieless request on same day — same IP+UA hash → deduped
    const second = await request
      .post('/api/v1/views')
      .send({ targetType: 'post', targetId: postId });
    expect(second.body.data.counted).toBe(false);

    const post = await PostModel.findById(postId).lean();
    expect(post?.viewCount).toBe(1);
  });

  it('rejects request with missing targetId', async () => {
    const res = await request
      .post('/api/v1/views')
      .send({ targetType: 'post' });
    expect(res.status).toBe(400);
  });

  it('rejects request with invalid targetType', async () => {
    const res = await request
      .post('/api/v1/views')
      .send({ targetType: 'comment', targetId: new Types.ObjectId().toString() });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/users/me/analytics — user analytics', () => {
  it('returns analytics for authenticated user', async () => {
    const user = await createVerifiedUser('analytics@example.com', 'AnalyticsUser');

    const res = await request
      .get('/api/v1/users/me/analytics')
      .set('Cookie', user.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      range: '30d',
      profileViews: { total: 0, delta: 0 },
      postViews: { total: 0, delta: 0 },
      followers: { total: 0, delta: 0 },
      topPosts: { byViews: [], byLikes: [], byComments: [] },
    });
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request.get('/api/v1/users/me/analytics');
    expect(res.status).toBe(401);
  });

  it('respects the range query param', async () => {
    const user = await createVerifiedUser('analytics7d@example.com', 'Analytics7d');

    const res = await request
      .get('/api/v1/users/me/analytics?range=7d')
      .set('Cookie', user.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe('7d');
  });

  it('accumulates view counts in analytics after recording views', async () => {
    const author = await createVerifiedUser('analytics2@example.com', 'Analytics2');
    const viewer = await createVerifiedUser('viewer4@example.com', 'Viewer4');
    const postId = await seedPublishedPost(author.id, 'analytics-post');

    // Record a view from viewer
    await request
      .post('/api/v1/views')
      .set('Cookie', viewer.cookie)
      .send({ targetType: 'post', targetId: postId });

    // Check analytics show 1 view
    const res = await request
      .get('/api/v1/users/me/analytics')
      .set('Cookie', author.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.postViews.total).toBe(1);
  });
});

describe('GET /api/v1/posts/:id/analytics — post analytics', () => {
  it('returns post analytics for the post author', async () => {
    const author = await createVerifiedUser('postanalytics@example.com', 'PostAnalytics');
    const postId = await seedPublishedPost(author.id, 'pa-post');

    const res = await request
      .get(`/api/v1/posts/${postId}/analytics`)
      .set('Cookie', author.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ postId, total: 0, timeSeries: [] });
  });

  it('returns 403 for non-owner non-admin', async () => {
    const author = await createVerifiedUser('paauthor@example.com', 'PAAuthor');
    const other = await createVerifiedUser('paother@example.com', 'PAOther');
    const postId = await seedPublishedPost(author.id, 'pa-post2');

    const res = await request
      .get(`/api/v1/posts/${postId}/analytics`)
      .set('Cookie', other.cookie);

    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthenticated request', async () => {
    const author = await createVerifiedUser('paauthor2@example.com', 'PAAuthor2');
    const postId = await seedPublishedPost(author.id, 'pa-post3');

    const res = await request.get(`/api/v1/posts/${postId}/analytics`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent post', async () => {
    const user = await createVerifiedUser('pa404@example.com', 'PA404');
    const fakeId = new Types.ObjectId().toString();

    const res = await request
      .get(`/api/v1/posts/${fakeId}/analytics`)
      .set('Cookie', user.cookie);

    expect(res.status).toBe(404);
  });

  it('accumulates views in post analytics after recording', async () => {
    const author = await createVerifiedUser('paaccum@example.com', 'PAAccum');
    const viewer = await createVerifiedUser('paviewer@example.com', 'PAViewer');
    const postId = await seedPublishedPost(author.id, 'pa-accum');

    await request
      .post('/api/v1/views')
      .set('Cookie', viewer.cookie)
      .send({ targetType: 'post', targetId: postId });

    const res = await request
      .get(`/api/v1/posts/${postId}/analytics`)
      .set('Cookie', author.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.timeSeries).toHaveLength(1);
  });
});
