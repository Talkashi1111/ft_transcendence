/**
 * Database seed script
 *
 * Usage:
 *   npx prisma db seed              # Run seed (uses package.json config)
 *   npx tsx prisma/seed.ts          # Run directly
 *   npx tsx prisma/seed.ts --clean  # Clear DB first, then seed
 *
 * Environment:
 *   NODE_ENV=production  # Only seeds essential data (no demo users)
 *   NODE_ENV=development # Seeds demo users for testing
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/utils/hash.js';

const DATABASE_URL = process.env.DATABASE_URL || 'file:/app/data/database.db';
const adapter = new PrismaBetterSqlite3({ url: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const isProduction = process.env.NODE_ENV === 'production';
const shouldClean = process.argv.includes('--clean');

// Demo users for development
const demoUsers = [
  { email: 'alice@example.com', alias: 'alice', password: 'password123' },
  { email: 'bob@example.com', alias: 'bob', password: 'password123' },
  { email: 'charlie@example.com', alias: 'charlie', password: 'password123' },
  { email: 'demo@example.com', alias: 'demo', password: 'demo1234' },
];

// Essential users for production (e.g., admin account)
const prodUsers: typeof demoUsers = [
  // Add production seed users here if needed
  // { email: "admin@yourdomain.com", alias: "admin", password: process.env.ADMIN_PASSWORD || "changeme123" },
];

async function cleanDatabase() {
  console.log('🧹 Cleaning database...');
  await prisma.user.deleteMany();
  console.log('✅ Database cleaned');
}

async function seedUsers(users: typeof demoUsers) {
  console.log(`📦 Seeding ${users.length} users...`);

  for (const user of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (existingUser) {
      console.log(`  ⏭️  User ${user.email} already exists, skipping`);
      continue;
    }

    const hashedPassword = await hashPassword(user.password);

    await prisma.user.create({
      data: {
        email: user.email,
        alias: user.alias,
        password: hashedPassword,
      },
    });

    console.log(`  ✅ Created user: ${user.alias} (${user.email})`);
  }
}

async function main() {
  console.log('🌱 Starting database seed...');
  console.log(`   Environment: ${isProduction ? 'production' : 'development'}`);
  console.log(`   Database: ${DATABASE_URL}`);

  if (shouldClean) {
    await cleanDatabase();
  }

  if (isProduction) {
    // Production: only seed essential data
    if (prodUsers.length > 0) {
      await seedUsers(prodUsers);
    } else {
      console.log('ℹ️  No production seed data configured');
    }
  } else {
    // Development: seed demo users
    await seedUsers(demoUsers);
  }

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
