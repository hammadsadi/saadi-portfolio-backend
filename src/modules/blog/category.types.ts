import type { HydratedDocument } from 'mongoose';

export interface ICategory {
  name: string;
  slug: string;
  description?: string;
}

export type ICategoryDocument = HydratedDocument<ICategory>;
