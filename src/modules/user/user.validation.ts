import { z } from 'zod';

const RESERVED_USERNAMES = [
  'admin', 'me', 'api', 'www', 'root', 'support', 'help', 'about',
  'contact', 'feed', 'posts', 'users', 'auth', 'settings', 'profile',
  'login', 'register', 'signup', 'logout', 'dashboard', 'internal',
];

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .toLowerCase()
  .regex(/^[a-z0-9_]+$/, 'Username may only contain lowercase letters, numbers, and underscores')
  .refine((u) => !RESERVED_USERNAMES.includes(u), { message: 'That username is reserved' });

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const otpSchema = z
  .string()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d{6}$/, 'OTP must be numeric');

const socialLinkSchema = z.object({
  platform: z.string().min(1).max(50).trim(),
  url: z.url('Each social link must be a valid URL'),
});

/** PATCH /users/me — strict: rejects any key not listed here (including email). */
export const updateProfileSchema = z
  .object({
    name: z.string().min(2).max(100).trim().optional(),
    username: usernameSchema.optional(),
    bio: z.string().max(300).trim().nullable().optional(),
    avatar: z.url('Must be a valid URL').nullable().optional(),
    coverImage: z.url('Must be a valid URL').nullable().optional(),
    location: z.string().max(100).trim().nullable().optional(),
    website: z.url('Must be a valid URL').nullable().optional(),
    socialLinks: z.array(socialLinkSchema).max(10).optional(),
    profileVisibility: z.enum(['public', 'private-stats']).optional(),
    showProfileViews: z.boolean().optional(),
    notificationPreferences: z
      .object({
        newFollower: z.boolean().optional(),
        comments: z.boolean().optional(),
        replies: z.boolean().optional(),
        productUpdates: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** POST /users/me/change-password */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  })
  .strict();

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** POST /users/me/set-password — for OAuth-only accounts */
export const setPasswordSchema = z
  .object({
    otp: otpSchema,
    newPassword: passwordSchema,
  })
  .strict();

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

/** DELETE /users/me — password users send password; OAuth-only users send otp */
export const deleteAccountSchema = z
  .object({
    password: z.string().optional(),
    otp: otpSchema.optional(),
  })
  .strict()
  .refine((d) => d.password !== undefined || d.otp !== undefined, {
    message: 'Either password or otp is required',
  });

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const adminUpdateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  isBlocked: z.boolean().optional(),
  name: z.string().min(2).max(100).trim().optional(),
}).strict();

export const changeRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});
