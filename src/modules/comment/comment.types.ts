import type { HydratedDocument, Types } from 'mongoose';

export interface ICommentAuthor {
  _id: Types.ObjectId;
  name: string;
  avatar?: string | null;
}

export interface IComment {
  post: Types.ObjectId;
  user: Types.ObjectId;
  parent: Types.ObjectId | null;
  content: string;
  likeCount: number;
  replyCount: number;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ICommentDocument = HydratedDocument<IComment>;

export interface CommentResult {
  _id: Types.ObjectId;
  post: Types.ObjectId;
  user: ICommentAuthor | null;
  parent: Types.ObjectId | null;
  content: string;
  likeCount: number;
  replyCount: number;
  isEdited: boolean;
  isDeleted: boolean;
  likedByMe: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CursorPaginationMeta {
  hasMore: boolean;
  nextCursor: string | null;
}
