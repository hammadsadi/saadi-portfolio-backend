import type { Request, Response, RequestHandler } from 'express';
import { catchAsync } from '@/utils/catchAsync.js';
import { sendResponse } from '@/utils/sendResponse.js';
import { AppError } from '@/utils/AppError.js';
import { clearAuthCookies } from '@/modules/auth/auth.service.js';
import {
  listUsers,
  getUserById,
  getUserByUsername,
  getUserPostsByUsername,
  adminUpdateUser,
  adminDeleteUser,
  updateOwnProfile,
  changePassword,
  requestSetPasswordOtp,
  setPassword,
  requestDeleteAccountOtp,
  softDeleteAccount,
} from './user.service.js';
import type { UserRole } from './user.types.js';
import type {
  UpdateProfileInput,
  ChangePasswordInput,
  SetPasswordInput,
  DeleteAccountInput,
} from './user.validation.js';
import { sendAccountDeletedEmailTemplate } from '@/modules/email/email.templates.js';

// GET /users  (admin)
export const listUsersHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { users, meta } = await listUsers(req);
  sendResponse(res, { message: 'Users retrieved', data: users, meta: { ...meta } });
});

/**
 * GET /users/:identifier
 * - If authenticated admin + 24-hex ObjectId param → admin view (full user record)
 * - Otherwise → public profile by username
 */
export const getUserByIdentifierHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { identifier } = req.params as { identifier: string };

    if (/^[0-9a-fA-F]{24}$/.test(identifier) && req.user?.role === 'admin') {
      const user = await getUserById(identifier);
      sendResponse(res, { message: 'User retrieved', data: user });
      return;
    }

    const profile = await getUserByUsername(identifier, req.user?._id);
    sendResponse(res, { message: 'User retrieved', data: profile });
  },
);

// GET /users/:username/posts
export const getUserPostsHandler: RequestHandler = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params as { username: string };
  const { items, meta } = await getUserPostsByUsername(username, req);
  sendResponse(res, { message: 'Posts retrieved', data: items, meta: { ...meta } });
});

// PATCH /users/:id  (admin)
export const adminUpdateUserHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { role, isBlocked, name } = req.body as {
      role?: UserRole;
      isBlocked?: boolean;
      name?: string;
    };
    const user = await adminUpdateUser(id, { role, isBlocked, name });
    sendResponse(res, { message: 'User updated', data: user });
  },
);

// DELETE /users/:id  (admin)
export const adminDeleteUserHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await adminDeleteUser(id);
    sendResponse(res, { message: 'User deleted' });
  },
);

// PATCH /users/:id/block  (admin)
export const blockUserHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const user = await adminUpdateUser(id, { isBlocked: true });
    sendResponse(res, { message: 'User blocked', data: user });
  },
);

// PATCH /users/:id/unblock  (admin)
export const unblockUserHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const user = await adminUpdateUser(id, { isBlocked: false });
    sendResponse(res, { message: 'User unblocked', data: user });
  },
);

// PATCH /users/:id/role  (admin)
export const changeRoleHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: UserRole };
    const user = await adminUpdateUser(id, { role });
    sendResponse(res, { message: 'Role updated', data: user });
  },
);

// PATCH /users/me
export const updateProfileHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const user = await updateOwnProfile(String(req.user._id), req.body as UpdateProfileInput);
    sendResponse(res, { message: 'Profile updated', data: user });
  },
);

// POST /users/me/change-password
export const changePasswordHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;
    await changePassword(String(req.user._id), currentPassword, newPassword);
    // Revoke current session cookies — all sessions already revoked in service
    clearAuthCookies(res);
    sendResponse(res, { message: 'Password changed. Please log in again.' });
  },
);

// POST /users/me/set-password/request  — sends OTP to OAuth-only user
export const requestSetPasswordHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    await requestSetPasswordOtp(String(req.user._id));
    sendResponse(res, { message: 'Verification code sent to your email.' });
  },
);

// POST /users/me/set-password
export const setPasswordHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { otp, newPassword } = req.body as SetPasswordInput;
    await setPassword(String(req.user._id), otp, newPassword);
    sendResponse(res, { message: 'Password set successfully.' });
  },
);

// POST /users/me/delete-account/request-otp  — for OAuth-only accounts
export const requestDeleteAccountOtpHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    await requestDeleteAccountOtp(String(req.user._id));
    sendResponse(res, { message: 'Verification code sent to your email.' });
  },
);

// DELETE /users/me
export const deleteAccountHandler: RequestHandler = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const { email, name } = await softDeleteAccount(String(req.user._id), req.body as DeleteAccountInput);
    clearAuthCookies(res);
    void sendAccountDeletedEmailTemplate({ to: email, name }).catch(() => undefined);
    sendResponse(res, { message: 'Account deleted.' });
  },
);
