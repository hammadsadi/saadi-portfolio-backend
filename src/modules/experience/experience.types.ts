import type { HydratedDocument } from 'mongoose';

export interface IExperience {
  company: string;
  role: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  description?: string;
  techStack: string[];
  order: number;
}

export type IExperienceDocument = HydratedDocument<IExperience>;
