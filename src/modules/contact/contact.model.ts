import { Schema, model } from 'mongoose';
import type { IContact } from './contact.types.js';

const contactSchema = new Schema<IContact>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ['new', 'read', 'replied', 'archived'],
      default: 'new',
    },
    adminReply: { type: String, trim: true },
    repliedAt: { type: Date },
  },
  { timestamps: true },
);

contactSchema.index({ user: 1, createdAt: -1 });
contactSchema.index({ status: 1, createdAt: -1 });

export const ContactModel = model<IContact>('Contact', contactSchema);
