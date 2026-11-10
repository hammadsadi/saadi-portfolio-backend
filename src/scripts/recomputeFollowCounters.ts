/**
 * Recomputes followerCount and followingCount for all users from the Follow
 * collection. Run after a data incident or counter drift is suspected.
 *
 * Usage: npx tsx src/scripts/recomputeFollowCounters.ts
 */
import mongoose from 'mongoose';
import type { Types } from 'mongoose';
import { FollowModel } from '@/modules/follow/follow.model.js';
import { UserModel } from '@/modules/user/user.model.js';
import { env } from '@/config/env.js';

async function recompute(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  console.info('Connected to MongoDB. Recomputing follow counters...');

  // Aggregate actual counts from the Follow collection
  const [followerCounts, followingCounts] = await Promise.all([
    FollowModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $group: { _id: '$following', count: { $sum: 1 } } },
    ]),
    FollowModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $group: { _id: '$follower', count: { $sum: 1 } } },
    ]),
  ]);

  // Build a merged map: userId → { followerCount, followingCount }
  const updates = new Map<string, { followerCount: number; followingCount: number }>();

  for (const { _id, count } of followerCounts) {
    const key = String(_id);
    const existing = updates.get(key) ?? { followerCount: 0, followingCount: 0 };
    updates.set(key, { ...existing, followerCount: count });
  }
  for (const { _id, count } of followingCounts) {
    const key = String(_id);
    const existing = updates.get(key) ?? { followerCount: 0, followingCount: 0 };
    updates.set(key, { ...existing, followingCount: count });
  }

  // Reset all counters to 0, then apply correct values
  await UserModel.updateMany({}, { $set: { followerCount: 0, followingCount: 0 } });

  if (updates.size > 0) {
    await UserModel.bulkWrite(
      Array.from(updates.entries()).map(([id, counts]) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(id) },
          update: { $set: counts },
        },
      })),
    );
  }

  console.info(
    `Done. Updated ${String(updates.size)} users (${String(followerCounts.length)} with followers, ${String(followingCounts.length)} with followings).`,
  );

  await mongoose.disconnect();
}

recompute().catch((err: unknown) => {
  console.error('Recompute failed:', err);
  process.exit(1);
});
