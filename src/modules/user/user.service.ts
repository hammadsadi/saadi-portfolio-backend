import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import type { Types } from 'mongoose';
import { UserModel } from './user.model.js';
import { PostModel } from '@/modules/blog/post.model.js';
import { CommentModel } from '@/modules/comment/comment.model.js';
import { LikeModel } from '@/modules/like/like.model.js';
import { FollowModel } from '@/modules/follow/follow.model.js';
import { issueOtp, verifyOtp, consumeOtp } from '@/modules/otp/otp.service.js';
import {
  sendPasswordChangedEmailTemplate,
  sendSetPasswordEmailTemplate,
} from '@/modules/email/email.templates.js';
import { AppError } from '@/utils/AppError.js';
import { parsePagination, buildMeta } from '@/utils/pagination.js';
import type { IUserDocument, UserPublic, UserPublicProfile, UserRole } from './user.types.js';
import type { UpdateProfileInput } from './user.validation.js';

const USERNAME_COOLDOWN_DAYS = 30;

export function toPublicUser(user: IUserDocument): UserPublic {
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    username: user.username ?? null,
    avatar: user.avatar ?? null,
    coverImage: user.coverImage ?? null,
    bio: user.bio ?? null,
    location: user.location ?? null,
    website: user.website ?? null,
    socialLinks: user.socialLinks,
    profileVisibility: user.profileVisibility,
    showProfileViews: user.showProfileViews,
    role: user.role,
    providers: user.authProviders.map((p) => p.provider),
    isEmailVerified: user.isEmailVerified,
    isBlocked: user.isBlocked,
    lastLoginAt: user.lastLoginAt ?? null,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    notificationPreferences: {
      newFollower: user.notificationPreferences.newFollower,
      comments: user.notificationPreferences.comments,
      replies: user.notificationPreferences.replies,
      productUpdates: user.notificationPreferences.productUpdates,
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function listUsers(req: Request): Promise<{
  users: UserPublic[];
  meta: ReturnType<typeof buildMeta>;
}> {
  const { page, limit, skip, sort, search } = parsePagination(req);

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (typeof req.query.role === 'string') filter.role = req.query.role;
  if (typeof req.query.isBlocked === 'string') {
    filter.isBlocked = req.query.isBlocked === 'true';
  }

  const [docs, total] = await Promise.all([
    UserModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    UserModel.countDocuments(filter),
  ]);

  return {
    users: (docs as IUserDocument[]).map(toPublicUser),
    meta: buildMeta(total, page, limit),
  };
}

export async function getUserById(id: string): Promise<UserPublic> {
  const user = (await UserModel.findById(id).lean()) as IUserDocument | null;
  if (!user) throw new AppError('User not found', 404);
  return toPublicUser(user);
}

export async function getUserByUsername(
  username: string,
  viewerId?: Types.ObjectId,
): Promise<UserPublicProfile> {
  const user = (await UserModel.findOne({ username: username.toLowerCase() }).lean()) as IUserDocument | null;
  if (!user || user.deletedAt) throw new AppError('User not found', 404);

  const [postCount, isFollowedByMe] = await Promise.all([
    PostModel.countDocuments({ author: user._id, status: 'published' }),
    viewerId
      ? FollowModel.exists({ follower: viewerId, following: user._id }).then(Boolean)
      : Promise.resolve(false),
  ]);

  const profile: UserPublicProfile = {
    _id: String(user._id),
    name: user.name,
    username: user.username ?? null,
    avatar: user.avatar ?? null,
    coverImage: user.coverImage ?? null,
    bio: user.bio ?? null,
    location: user.location ?? null,
    website: user.website ?? null,
    socialLinks: user.socialLinks,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    postCount,
    isFollowedByMe,
    createdAt: user.createdAt,
  };

  if (user.showProfileViews) {
    // viewCount is stored on the profile document; re-use the user's id as the owner reference.
    // For users, viewCount comes from the ProfileModel aggregation; we surface it only when opted in.
    // We omit it here and let the client call the profile view endpoint if needed.
    // If the user has explicitly enabled it, include it from future profile-linked data.
    // For now, viewCount is not stored directly on User — omit to avoid stale data.
  }

  return profile;
}

export async function getUserPostsByUsername(
  username: string,
  req: Request,
): Promise<{ items: unknown[]; meta: ReturnType<typeof buildMeta> }> {
  const user = (await UserModel.findOne({ username: username.toLowerCase() })
    .select('_id deletedAt')
    .lean()) as { _id: Types.ObjectId; deletedAt?: Date | null } | null;

  if (!user || user.deletedAt) throw new AppError('User not found', 404);

  const { page, limit, skip } = parsePagination(req);

  const filter: Record<string, unknown> = {
    author: user._id,
    status: 'published',
    publishedAt: { $lte: new Date() },
  };

  const [items, total] = await Promise.all([
    PostModel.find(filter)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title slug excerpt coverImage readingTime viewCount likeCount commentCount publishedAt tags category')
      .lean(),
    PostModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function adminUpdateUser(
  id: string,
  updates: { role?: UserRole; isBlocked?: boolean; name?: string },
): Promise<UserPublic> {
  const user = (await UserModel.findByIdAndUpdate(id, { $set: updates }, {
    returnDocument: 'after',
    runValidators: true,
  }).lean()) as IUserDocument | null;
  if (!user) throw new AppError('User not found', 404);
  return toPublicUser(user);
}

export async function adminDeleteUser(id: string): Promise<void> {
  const result = await UserModel.findByIdAndDelete(id);
  if (!result) throw new AppError('User not found', 404);
}

export async function updateOwnProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserPublic> {
  const user = (await UserModel.findById(userId).lean()) as IUserDocument | null;
  if (!user) throw new AppError('User not found', 404);

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.avatar !== undefined) patch.avatar = input.avatar;
  if (input.coverImage !== undefined) patch.coverImage = input.coverImage;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.location !== undefined) patch.location = input.location;
  if (input.website !== undefined) patch.website = input.website;
  if (input.socialLinks !== undefined) patch.socialLinks = input.socialLinks;
  if (input.profileVisibility !== undefined) patch.profileVisibility = input.profileVisibility;
  if (input.showProfileViews !== undefined) patch.showProfileViews = input.showProfileViews;

  if (input.notificationPreferences !== undefined) {
    const prefs = input.notificationPreferences;
    if (prefs.newFollower !== undefined) patch['notificationPreferences.newFollower'] = prefs.newFollower;
    if (prefs.comments !== undefined) patch['notificationPreferences.comments'] = prefs.comments;
    if (prefs.replies !== undefined) patch['notificationPreferences.replies'] = prefs.replies;
    if (prefs.productUpdates !== undefined) patch['notificationPreferences.productUpdates'] = prefs.productUpdates;
  }

  if (input.username !== undefined) {
    const newUsername = input.username.toLowerCase();

    if (user.usernameChangedAt) {
      const daysSinceChange =
        (Date.now() - new Date(user.usernameChangedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceChange < USERNAME_COOLDOWN_DAYS) {
        const daysLeft = Math.ceil(USERNAME_COOLDOWN_DAYS - daysSinceChange);
        throw new AppError(
          `Username can only be changed once every ${String(USERNAME_COOLDOWN_DAYS)} days. Try again in ${String(daysLeft)} day${daysLeft === 1 ? '' : 's'}.`,
          409,
        );
      }
    }

    if (newUsername !== (user.username ?? '')) {
      const taken = await UserModel.exists({ username: newUsername, _id: { $ne: userId } });
      if (taken) throw new AppError('That username is already taken', 409);
      patch.username = newUsername;
      patch.usernameChangedAt = new Date();
    }
  }

  if (Object.keys(patch).length === 0) {
    return toPublicUser(user);
  }

  const updated = (await UserModel.findByIdAndUpdate(
    userId,
    { $set: patch },
    { returnDocument: 'after', runValidators: true },
  ).lean()) as IUserDocument | null;

  if (!updated) throw new AppError('User not found', 404);
  return toPublicUser(updated);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw new AppError('User not found', 404);
  if (!user.passwordHash) {
    throw new AppError('Your account uses social login. Use "Set password" instead.', 400);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) throw new AppError('Current password is incorrect', 400);

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new AppError('New password must be different from your current password', 400);
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await UserModel.updateOne(
    { _id: userId },
    { $set: { passwordHash: newHash, refreshTokens: [] } },
  );

  void sendPasswordChangedEmailTemplate({ to: user.email, name: user.name }).catch(() => undefined);
}

export async function requestSetPasswordOtp(userId: string): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw new AppError('User not found', 404);
  if (user.passwordHash) {
    throw new AppError('Your account already has a password. Use "Change password" instead.', 400);
  }

  const code = await issueOtp(userId, 'set_password');
  void sendSetPasswordEmailTemplate({ to: user.email, name: user.name, otp: code }).catch(() => undefined);
}

export async function setPassword(
  userId: string,
  otpCode: string,
  newPassword: string,
): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw new AppError('User not found', 404);
  if (user.passwordHash) {
    throw new AppError('Your account already has a password. Use "Change password" instead.', 400);
  }

  const otpDoc = await verifyOtp(userId, 'set_password', otpCode);
  await consumeOtp(String(otpDoc._id));

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await UserModel.updateOne({ _id: userId }, { $set: { passwordHash } });
}

export async function requestDeleteAccountOtp(userId: string): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw new AppError('User not found', 404);
  if (user.passwordHash) {
    throw new AppError('Password accounts must confirm with their password, not an OTP.', 400);
  }

  const code = await issueOtp(userId, 'delete_account');
  void sendSetPasswordEmailTemplate({ to: user.email, name: user.name, otp: code }).catch(() => undefined);
}

/**
 * Soft-delete policy:
 * - User: deletedAt set, name anonymized, email suffixed, username cleared, profile data cleared, isBlocked set, all sessions revoked.
 * - Comments: content replaced with "[deleted]", isDeleted set to true.
 * - Likes: removed; likeCount decremented on each target.
 * - Follows: removed; follower/followingCount decremented on affected users.
 */
export async function softDeleteAccount(
  userId: string,
  options: { password?: string; otp?: string },
): Promise<{ email: string; name: string }> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw new AppError('User not found', 404);

  if (user.passwordHash) {
    if (!options.password) throw new AppError('Password is required to delete this account', 400);
    const isMatch = await bcrypt.compare(options.password, user.passwordHash);
    if (!isMatch) throw new AppError('Password is incorrect', 400);
  } else {
    if (!options.otp) throw new AppError('OTP is required to delete this account', 400);
    const otpDoc = await verifyOtp(userId, 'delete_account', options.otp);
    await consumeOtp(String(otpDoc._id));
  }

  const deletedEmail = user.email;
  const deletedName = user.name;
  const anonEmail = `deleted_${String(user._id)}@deleted.invalid`;

  // 1. Anonymize & deactivate the user record
  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        deletedAt: new Date(),
        name: 'Deleted User',
        email: anonEmail,
        username: null,
        avatar: null,
        coverImage: null,
        bio: null,
        location: null,
        website: null,
        socialLinks: [],
        isBlocked: true,
        refreshTokens: [],
      },
    },
  );

  // 2. Anonymize comments (preserve thread structure)
  await CommentModel.updateMany(
    { user: userId, isDeleted: false },
    { $set: { content: '[deleted]', isDeleted: true } },
  );

  // 3. Remove likes and decrement counters
  const userLikes = await LikeModel.find({ user: userId }).lean() as {
    targetType: string;
    targetId: Types.ObjectId;
  }[];
  if (userLikes.length > 0) {
    const postLikeIds = userLikes.filter((l) => l.targetType === 'post').map((l) => l.targetId);
    const commentLikeIds = userLikes.filter((l) => l.targetType === 'comment').map((l) => l.targetId);
    await Promise.all([
      postLikeIds.length > 0
        ? PostModel.updateMany({ _id: { $in: postLikeIds } }, { $inc: { likeCount: -1 } })
        : Promise.resolve(),
      commentLikeIds.length > 0
        ? CommentModel.updateMany({ _id: { $in: commentLikeIds } }, { $inc: { likeCount: -1 } })
        : Promise.resolve(),
      LikeModel.deleteMany({ user: userId }),
    ]);
  }

  // 4. Remove follows and adjust counters
  const [followingRelations, followerRelations] = await Promise.all([
    FollowModel.find({ follower: userId }).lean() as Promise<{ following: Types.ObjectId }[]>,
    FollowModel.find({ following: userId }).lean() as Promise<{ follower: Types.ObjectId }[]>,
  ]);

  await Promise.all([
    followingRelations.length > 0
      ? UserModel.updateMany(
          { _id: { $in: followingRelations.map((f) => f.following) } },
          { $inc: { followerCount: -1 } },
        )
      : Promise.resolve(),
    followerRelations.length > 0
      ? UserModel.updateMany(
          { _id: { $in: followerRelations.map((f) => f.follower) } },
          { $inc: { followingCount: -1 } },
        )
      : Promise.resolve(),
    FollowModel.deleteMany({ $or: [{ follower: userId }, { following: userId }] }),
  ]);

  return { email: deletedEmail, name: deletedName };
}
