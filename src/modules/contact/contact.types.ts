import type { Types, HydratedDocument } from 'mongoose';

export type ContactStatus = 'new' | 'read' | 'replied' | 'archived';

export interface IContact {
  user: Types.ObjectId;
  subject: string;
  message: string;
  status: ContactStatus;
  adminReply?: string;
  repliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type IContactDocument = HydratedDocument<IContact>;

export interface ContactUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
}
