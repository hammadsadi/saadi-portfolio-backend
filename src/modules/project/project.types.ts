import type { HydratedDocument } from 'mongoose';

export type ProjectStatus = 'draft' | 'published';

export interface IProject {
  title: string;
  slug: string;
  summary: string;
  description?: string;
  thumbnail?: string;
  gallery: string[];
  techStack: string[];
  liveUrl?: string;
  githubUrl?: string;
  category?: string;
  featured: boolean;
  order: number;
  status: ProjectStatus;
}

export type IProjectDocument = HydratedDocument<IProject>;
