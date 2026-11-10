import { Schema, model } from 'mongoose';
import type { Model } from 'mongoose';
import type { IOtp } from './otp.types.js';

const otpSchema = new Schema<IOtp>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: ['verify_email', 'reset_password', 'set_password', 'delete_account'], required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastSentAt: { type: Date, required: true },
    hourlySentCount: { type: Number, default: 1 },
    hourlyWindowStart: { type: Date, required: true },
    consumedAt: { type: Date },
    resetUsed: { type: Boolean },
  },
  { timestamps: false },
);

// Auto-delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for user + purpose lookups
otpSchema.index({ userId: 1, purpose: 1 });

export const OtpModel: Model<IOtp> = model<IOtp>('Otp', otpSchema);
