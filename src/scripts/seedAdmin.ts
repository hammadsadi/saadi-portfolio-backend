import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { UserModel } from '../modules/user/user.model.js';
import { env } from '../config/env.js';

async function seedAdmin(): Promise<void> {
  await connectDB();

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

seedAdmin()
  .then(() => { process.exit(0); })
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
