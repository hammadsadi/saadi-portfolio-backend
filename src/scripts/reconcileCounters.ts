/**
 * Reconciles all denormalized counters from their source-of-truth collections.
 * Safe to run at any time — uses bulk writes and does not lock.
 *
 * Counters reconciled:
 *   User.followerCount  ← Follow collection (following = userId)
 *   User.followingCount ← Follow collection (follower  = userId)
 *   Post.likeCount      ← Like  collection (targetType='post')
 *   Post.commentCount   ← Comment collection (post = postId, isDeleted=false)
 *   Comment.likeCount   ← Like  collection (targetType='comment')
 *   Post.viewCount      ← DailyViewStat collection (targetType='post', sum of views)
 *
 * Usage:
 *   pnpm reconcile-counters
 */
import mongoose from 'mongoose';
import type { Types } from 'mongoose';
import { FollowModel } from '@/modules/follow/follow.model.js';
import { UserModel } from '@/modules/user/user.model.js';
import { PostModel } from '@/modules/blog/post.model.js';
import { CommentModel } from '@/modules/comment/comment.model.js';
import { LikeModel } from '@/modules/like/like.model.js';
import { DailyViewStatModel } from '@/modules/view/view.model.js';
import { env } from '@/config/env.js';

interface AggCount { _id: Types.ObjectId; count: number }

async function reconcile(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  console.info('Connected to MongoDB. Reconciling counters...\n');

  // ── 1. User follow counters ────────────────────────────────────────────────
  console.info('1/5  User followerCount / followingCount …');
  const [followerCounts, followingCounts] = await Promise.all([
    FollowModel.aggregate<AggCount>([{ $group: { _id: '$following', count: { $sum: 1 } } }]),
    FollowModel.aggregate<AggCount>([{ $group: { _id: '$follower', count: { $sum: 1 } } }]),
  ]);

  const userCountMap = new Map<string, { followerCount: number; followingCount: number }>();
  for (const { _id, count } of followerCounts) {
    const key = String(_id);
    userCountMap.set(key, { followerCount: count, followingCount: userCountMap.get(key)?.followingCount ?? 0 });
  }
  for (const { _id, count } of followingCounts) {
    const key = String(_id);
    userCountMap.set(key, { followerCount: userCountMap.get(key)?.followerCount ?? 0, followingCount: count });
  }

  await UserModel.updateMany({}, { $set: { followerCount: 0, followingCount: 0 } });
  if (userCountMap.size > 0) {
    await UserModel.bulkWrite(
      Array.from(userCountMap.entries()).map(([id, counts]) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(id) },
          update: { $set: counts },
        },
      })),
    );
  }
  console.info(`    → ${String(userCountMap.size)} users updated`);

  // ── 2. Post likeCount ──────────────────────────────────────────────────────
  console.info('2/5  Post.likeCount …');
  const postLikes = await LikeModel.aggregate<AggCount>([
    { $match: { targetType: 'post' } },
    { $group: { _id: '$targetId', count: { $sum: 1 } } },
  ]);

  await PostModel.updateMany({}, { $set: { likeCount: 0 } });
  if (postLikes.length > 0) {
    await PostModel.bulkWrite(
      postLikes.map(({ _id, count }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { likeCount: count } },
        },
      })),
    );
  }
  console.info(`    → ${String(postLikes.length)} posts updated`);

  // ── 3. Post commentCount ───────────────────────────────────────────────────
  console.info('3/5  Post.commentCount …');
  const postComments = await CommentModel.aggregate<AggCount>([
    { $match: { isDeleted: false } },
    { $group: { _id: '$post', count: { $sum: 1 } } },
  ]);

  await PostModel.updateMany({}, { $set: { commentCount: 0 } });
  if (postComments.length > 0) {
    await PostModel.bulkWrite(
      postComments.map(({ _id, count }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { commentCount: count } },
        },
      })),
    );
  }
  console.info(`    → ${String(postComments.length)} posts updated`);

  // ── 4. Comment likeCount ───────────────────────────────────────────────────
  console.info('4/5  Comment.likeCount …');
  const commentLikes = await LikeModel.aggregate<AggCount>([
    { $match: { targetType: 'comment' } },
    { $group: { _id: '$targetId', count: { $sum: 1 } } },
  ]);

  await CommentModel.updateMany({}, { $set: { likeCount: 0 } });
  if (commentLikes.length > 0) {
    await CommentModel.bulkWrite(
      commentLikes.map(({ _id, count }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { likeCount: count } },
        },
      })),
    );
  }
  console.info(`    → ${String(commentLikes.length)} comments updated`);

  // ── 5. Post viewCount ──────────────────────────────────────────────────────
  console.info('5/5  Post.viewCount …');
  const postViews = await DailyViewStatModel.aggregate<AggCount>([
    { $match: { targetType: 'post' } },
    { $group: { _id: '$targetId', count: { $sum: '$views' } } },
  ]);

  await PostModel.updateMany({}, { $set: { viewCount: 0 } });
  if (postViews.length > 0) {
    await PostModel.bulkWrite(
      postViews.map(({ _id, count }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { viewCount: count } },
        },
      })),
    );
  }
  console.info(`    → ${String(postViews.length)} posts updated`);

  console.info('\nAll counters reconciled successfully.');
  await mongoose.disconnect();
}

reconcile().catch((err: unknown) => {
  console.error('Counter reconciliation failed:', err);
  process.exit(1);
});
