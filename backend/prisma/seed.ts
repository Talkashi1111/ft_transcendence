/**
 * Database seed script
 *
 * Usage:
 *   npx prisma db seed              # Run seed (uses package.json config)
 *   npx tsx prisma/seed.ts          # Run directly
 *   npx tsx prisma/seed.ts --clean  # Clear DB first, then seed
 *   npx tsx prisma/seed.ts --demo   # Force seed demo users (even in production)
 *
 * Environment:
 *   NODE_ENV=production  # Only seeds essential data (no demo users) unless --demo flag
 *   NODE_ENV=development # Seeds demo users for testing
 *
 * Production seeding (run inside container):
 *   docker exec -it ft_transcendence-prod npx tsx prisma/seed.ts --demo
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/utils/hash.js';

const DATABASE_URL = process.env.DATABASE_URL || 'file:/app/data/database.db';
const adapter = new PrismaBetterSqlite3({ url: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const isProduction = process.env.NODE_ENV === 'production';
const shouldClean = process.argv.includes('--clean');
const forceDemo = process.argv.includes('--demo');

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

  if (isProduction && !forceDemo) {
    // Production: only seed essential data (unless --demo flag is used)
    if (prodUsers.length > 0) {
      await seedUsers(prodUsers);
    } else {
      console.log('ℹ️  No production seed data configured');
      console.log('   Use --demo flag to seed demo users in production');
    }
  } else {
    // Development or --demo flag: seed demo users
    if (isProduction && forceDemo) {
      console.log('⚠️  Seeding demo users in PRODUCTION (--demo flag)');
    }
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
