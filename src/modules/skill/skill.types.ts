import type { HydratedDocument } from 'mongoose';

export type SkillCategory = 'Frontend' | 'Backend' | 'Database' | 'AI/ML' | 'DevOps' | 'Tools';

export interface ISkill {
  name: string;
  category: SkillCategory;
  icon?: string;
  proficiency: number;
  order: number;
  isVisible: boolean;
}

export type ISkillDocument = HydratedDocument<ISkill>;
