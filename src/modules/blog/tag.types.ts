import type { HydratedDocument } from 'mongoose';

export interface ITag {
  name: string;
  slug: string;
}

export type ITagDocument = HydratedDocument<ITag>;
