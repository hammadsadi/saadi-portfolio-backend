import type { Types, HydratedDocument } from 'mongoose';
import { ContactModel } from './contact.model.js';
import type { IContact, IContactDocument, ContactUser, ContactStatus } from './contact.types.js';
import type { CreateContactInput } from './contact.validation.js';
import { AppError } from '@/utils/AppError.js';
import { buildMeta } from '@/utils/pagination.js';
import type { PaginationMeta } from '@/utils/pagination.js';
import {
  sendNewContactMessageEmailTemplate,
  sendAdminReplyEmailTemplate,
} from '@/modules/email/email.templates.js';
import { env } from '@/config/env.js';

type PopulatedContactDoc = HydratedDocument<Omit<IContact, 'user'> & { user: ContactUser }>;

export async function createContact(
  userId: Types.ObjectId,
  userEmail: string,
  userName: string,
  data: CreateContactInput,
): Promise<IContactDocument> {
  const contact = await ContactModel.create({
    user: userId,
    subject: data.subject,
    message: data.message,
  });

  void sendNewContactMessageEmailTemplate({
    to: env.ADMIN_SEED_EMAIL,
    senderName: userName,
    senderEmail: userEmail,
    subject: data.subject,
    message: data.message,
  }).catch((err: unknown) => {
    console.error('Failed to send contact notification email:', err);
  });

  return contact;
}

export async function listUserContacts(
  userId: Types.ObjectId,
  page: number,
  limit: number,
): Promise<{ items: IContactDocument[]; meta: PaginationMeta }> {
  const skip = (page - 1) * limit;
  const filter = { user: userId };

  const [docs, total] = await Promise.all([
    ContactModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContactModel.countDocuments(filter),
  ]);

  return { items: docs, meta: buildMeta(total, page, limit) };
}

export async function adminListContacts(
  page: number,
  limit: number,
  status?: ContactStatus,
): Promise<{ items: PopulatedContactDoc[]; meta: PaginationMeta }> {
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};
  if (status !== undefined) filter.status = status;

  const [docs, total] = await Promise.all([
    ContactModel.find(filter)
      .populate<{ user: ContactUser }>('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit) as unknown as Promise<PopulatedContactDoc[]>,
    ContactModel.countDocuments(filter),
  ]);

  return { items: docs, meta: buildMeta(total, page, limit) };
}

export async function adminUpdateContactStatus(
  contactId: string,
  status: ContactStatus,
): Promise<IContactDocument> {
  const contact = await ContactModel.findByIdAndUpdate(
    contactId,
    { $set: { status } },
    { returnDocument: 'after' },
  );
  if (!contact) throw new AppError('Message not found', 404);
  return contact;
}

export async function adminReplyToContact(
  contactId: string,
  reply: string,
): Promise<PopulatedContactDoc> {
  const contact = (await ContactModel.findById(contactId).populate<{ user: ContactUser }>(
    'user',
    'name email',
  )) as unknown as PopulatedContactDoc | null;
  if (!contact) throw new AppError('Message not found', 404);
  if (contact.status === 'archived') throw new AppError('Cannot reply to an archived message', 400);

  contact.adminReply = reply;
  contact.repliedAt = new Date();
  contact.status = 'replied';
  await contact.save();

  void sendAdminReplyEmailTemplate({
    to: contact.user.email,
    recipientName: contact.user.name,
    originalSubject: contact.subject,
    replyMessage: reply,
  }).catch((err: unknown) => {
    console.error('Failed to send admin reply email:', err);
  });

  return contact;
}
