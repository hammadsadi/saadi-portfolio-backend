import { Types } from 'mongoose';
import { LikeModel } from './like.model.js';
import { PostModel } from '@/modules/blog/post.model.js';
import { CommentModel } from '@/modules/comment/comment.model.js';
import type { LikeTargetType } from './like.types.js';
import { AppError } from '@/utils/AppError.js';
import { isDuplicateKeyError } from '@/utils/db.js';

async function getTargetLikeCount(
  targetType: LikeTargetType,
  targetId: Types.ObjectId,
): Promise<number> {
  if (targetType === 'post') {
    const doc = await PostModel.findById(targetId).select('likeCount').lean();
    return doc?.likeCount ?? 0;
  }
  const doc = await CommentModel.findById(targetId).select('likeCount').lean();
  return doc?.likeCount ?? 0;
}

async function adjustCounter(
  targetType: LikeTargetType,
  targetId: Types.ObjectId,
  delta: 1 | -1,
): Promise<number> {
  if (targetType === 'post') {
    const doc = await PostModel.findByIdAndUpdate(
      targetId,
      { $inc: { likeCount: delta } },
      { returnDocument: 'after' },
    );
    return doc?.likeCount ?? 0;
  }
  const doc = await CommentModel.findByIdAndUpdate(
    targetId,
    { $inc: { likeCount: delta } },
    { returnDocument: 'after' },
  );
  return doc?.likeCount ?? 0;
}

export async function toggleLike(
  userId: Types.ObjectId,
  targetType: LikeTargetType,
  targetId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const targetObjectId = new Types.ObjectId(targetId);

  const existing = await LikeModel.findOneAndDelete({
    user: userId,
    targetType,
    targetId: targetObjectId,
  });

  if (existing) {
    const likeCount = await adjustCounter(targetType, targetObjectId, -1);
    return { liked: false, likeCount };
  }

  try {
    await LikeModel.create({ user: userId, targetType, targetId: targetObjectId });
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      const likeCount = await getTargetLikeCount(targetType, targetObjectId);
      return { liked: true, likeCount };
    }
    throw err;
  }

  const likeCount = await adjustCounter(targetType, targetObjectId, 1);
  return { liked: true, likeCount };
}

export async function getLikeStatus(
  userId: Types.ObjectId | undefined,
  targetType: LikeTargetType,
  targetId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const targetObjectId = new Types.ObjectId(targetId);

  const [likeCount, likeDoc] = await Promise.all([
    getTargetLikeCount(targetType, targetObjectId),
    userId
      ? LikeModel.findOne({ user: userId, targetType, targetId: targetObjectId }).lean()
      : Promise.resolve(null),
  ]);

  return { liked: likeDoc !== null, likeCount };
}

export async function getLikedSet(
  userId: Types.ObjectId,
  targetType: LikeTargetType,
  targetIds: Types.ObjectId[],
): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const liked = await LikeModel.find({
    user: userId,
    targetType,
    targetId: { $in: targetIds },
  })
    .select('targetId')
    .lean();
  return new Set(liked.map((l) => l.targetId.toString()));
}

export async function validateTarget(
  targetType: LikeTargetType,
  targetId: string,
): Promise<void> {
  const id = new Types.ObjectId(targetId);
  const exists =
    targetType === 'post'
      ? await PostModel.exists({ _id: id, status: 'published' })
      : await CommentModel.exists({ _id: id, isDeleted: false });
  if (!exists) throw new AppError(`${targetType === 'post' ? 'Post' : 'Comment'} not found`, 404);
}
