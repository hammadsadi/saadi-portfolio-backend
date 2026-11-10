import type { Types, HydratedDocument } from 'mongoose';

export type OtpPurpose = 'verify_email' | 'reset_password' | 'set_password' | 'delete_account';

export interface IOtp {
  userId: Types.ObjectId;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  lastSentAt: Date;
  hourlySentCount: number;
  hourlyWindowStart: Date;
  consumedAt?: Date;
  resetUsed?: boolean;
}

export type IOtpDocument = HydratedDocument<IOtp>;
