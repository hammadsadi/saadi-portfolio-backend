import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { UserModel } from '../modules/user/user.model.js';
import { ProfileModel } from '../modules/profile/profile.model.js';
import { SkillModel } from '../modules/skill/skill.model.js';
import { SiteSettingsModel } from '../modules/siteSettings/siteSettings.model.js';
import type { SkillCategory } from '../modules/skill/skill.types.js';

// ---------------------------------------------------------------------------
// Admin user
// ---------------------------------------------------------------------------

async function seedAdmin(): Promise<void> {
  const existing = await UserModel.findOne({ email: env.ADMIN_SEED_EMAIL });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.info('Upgraded existing user to admin:', env.ADMIN_SEED_EMAIL);
    } else {
      console.info('Admin already exists:', env.ADMIN_SEED_EMAIL);
    }
    return;
  }
  const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);
  await UserModel.create({
    name: 'Hammad Sadi',
    email: env.ADMIN_SEED_EMAIL,
    passwordHash,
    role: 'admin',
    isEmailVerified: true,
  });
  console.info('Admin user created:', env.ADMIN_SEED_EMAIL);
}

// ---------------------------------------------------------------------------
// Profile singleton
// ---------------------------------------------------------------------------

async function seedProfile(): Promise<void> {
  await ProfileModel.findOneAndUpdate(
    {},
    {
      $setOnInsert: {
        fullName: 'Hammad Sadi',
        headline: 'MERN Stack Developer & AI Engineer',
        shortBio:
          'I build full-stack web applications and AI-powered tools. Passionate about clean architecture, developer experience, and shipping products that make a difference.',
        longBio:
          '## About Me\n\nI am a MERN Stack Developer and AI Engineer with a focus on building scalable backends, intuitive frontends, and intelligent systems.\n\nI work with MongoDB, Express, React, and Node.js as my primary stack, and I incorporate AI/ML capabilities using Python, FastAPI, and modern LLM tooling.\n\nI care deeply about code quality, type safety, and developer experience.',
        email: 'contact@hammadsadi.com',
        location: 'Pakistan',
        availabilityStatus: 'available',
        yearsOfExperience: 2,
        typedRoles: ['MERN Stack Developer', 'AI Engineer', 'Backend Architect'],
        socialLinks: [
          { platform: 'GitHub', url: 'https://github.com/hammadsadi', icon: 'github' },
          { platform: 'LinkedIn', url: 'https://linkedin.com/in/hammadsadi', icon: 'linkedin' },
        ],
        stats: [
          { label: 'Projects Completed', value: '20+' },
          { label: 'Happy Clients', value: '15+' },
          { label: 'Years Experience', value: '2+' },
        ],
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  console.info('Profile seeded');
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

interface SeedSkill {
  name: string;
  category: SkillCategory;
  proficiency: number;
  order: number;
}

const SKILLS: SeedSkill[] = [
  { name: 'React', category: 'Frontend', proficiency: 90, order: 0 },
  { name: 'Redux Toolkit', category: 'Frontend', proficiency: 85, order: 1 },
  { name: 'RTK Query', category: 'Frontend', proficiency: 82, order: 2 },
  { name: 'TanStack Query', category: 'Frontend', proficiency: 80, order: 3 },
  { name: 'Node.js', category: 'Backend', proficiency: 92, order: 4 },
  { name: 'Express.js', category: 'Backend', proficiency: 90, order: 5 },
  { name: 'Python FastAPI', category: 'Backend', proficiency: 72, order: 6 },
  { name: 'MongoDB', category: 'Database', proficiency: 85, order: 7 },
  { name: 'PostgreSQL', category: 'Database', proficiency: 75, order: 8 },
  { name: 'Prisma', category: 'Database', proficiency: 80, order: 9 },
  { name: 'Drizzle ORM', category: 'Database', proficiency: 70, order: 10 },
  { name: 'AI Engineering', category: 'AI/ML', proficiency: 78, order: 11 },
  { name: 'TypeScript', category: 'Tools', proficiency: 88, order: 12 },
];

async function seedSkills(): Promise<void> {
  const ops = SKILLS.map((skill) => ({
    updateOne: {
      filter: { name: skill.name },
      update: {
        $setOnInsert: { ...skill, isVisible: true },
      },
      upsert: true,
    },
  }));
  await SkillModel.bulkWrite(ops);
  console.info(`Skills seeded (${String(SKILLS.length)} entries)`);
}

// ---------------------------------------------------------------------------
// Site settings singleton
// ---------------------------------------------------------------------------

async function seedSiteSettings(): Promise<void> {
  await SiteSettingsModel.findOneAndUpdate(
    {},
    {
      $setOnInsert: {
        siteTitle: 'Hammad Sadi',
        seoDefaults: {
          titleTemplate: '%s | Hammad Sadi',
          description:
            'Portfolio of Hammad Sadi — MERN Stack Developer & AI Engineer. Building fast, scalable web apps and intelligent systems.',
          ogImage: '',
        },
        themeAccentColor: '#0d9488',
        navItems: [
          { label: 'Home', href: '/', order: 0 },
          { label: 'About', href: '/#about', order: 1 },
          { label: 'Skills', href: '/#skills', order: 2 },
          { label: 'Projects', href: '/#projects', order: 3 },
          { label: 'Experience', href: '/#experience', order: 4 },
          { label: 'Contact', href: '/#contact', order: 5 },
        ],
        footerText: '© 2025 Hammad Sadi. All rights reserved.',
        featureFlags: { blogEnabled: false, contactEnabled: true },
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  console.info('Site settings seeded');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  await connectDB();
  await seedAdmin();
  await seedProfile();
  await seedSkills();
  await seedSiteSettings();
  console.info('Seed complete');
}

seed()
  .then(() => { process.exit(0); })
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
