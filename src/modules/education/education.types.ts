import type { HydratedDocument } from 'mongoose';

export interface IEducation {
  institution: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate?: Date;
  description?: string;
  order: number;
}

export type IEducationDocument = HydratedDocument<IEducation>;
