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
import {
  PrismaClient,
  FriendshipStatus,
  NotificationType,
} from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/utils/hash.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL || 'file:/app/data/database.db';
const adapter = new PrismaBetterSqlite3({ url: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const isProduction = process.env.NODE_ENV === 'production';
const shouldClean = process.argv.includes('--clean');
const forceDemo = process.argv.includes('--demo');

// Demo users for development
const demoUsers = [
  { email: 'alice@example.com', alias: 'alice', password: 'Password123!' },
  { email: 'bob@example.com', alias: 'bob', password: 'Password123!' },
  { email: 'charlie@example.com', alias: 'charlie', password: 'Password123!' },
  { email: 'demo@example.com', alias: 'demo', password: 'Demo1234!' },
  { email: 'eve@example.com', alias: 'eve', password: 'Password123!' },
  { email: 'frank@example.com', alias: 'frank', password: 'Password123!' },
  { email: 'grace@example.com', alias: 'grace', password: 'Password123!' },
  { email: 'henry@example.com', alias: 'henry', password: 'Password123!' },
];

// Essential users for production (e.g., admin account)
const prodUsers: typeof demoUsers = [
  // Add production seed users here if needed
  // { email: "admin@yourdomain.com", alias: "admin", password: process.env.ADMIN_PASSWORD || "changeme123" },
];

async function cleanDatabase() {
  console.log('🧹 Cleaning database...');
  // Delete in correct order due to foreign keys
  await prisma.notification.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Database cleaned');
}

async function cleanAvatars() {
  console.log('🖼️  Cleaning avatars...');
  const avatarDir = '/app/data/avatars';

  try {
    // Check if directory exists
    await fs.access(avatarDir);

    // Get all files in the directory
    const files = await fs.readdir(avatarDir, { withFileTypes: true });

    // Remove all subdirectories and files
    for (const file of files) {
      const filePath = path.join(avatarDir, file.name);
      if (file.isDirectory()) {
        // Recursively remove directory and its contents
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        // Remove file
        await fs.unlink(filePath);
      }
    }

    console.log('✅ All avatars cleaned');
  } catch (err) {
    // Directory might not exist yet, which is fine
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('ℹ️  Avatar directory does not exist, skipping');
    } else {
      console.error('⚠️  Failed to clean avatars:', err);
      throw err;
    }
  }
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

  return users.length;
}

async function seedFriendships() {
  console.log('👥 Seeding friendships...');

  // Get users by alias
  const alice = await prisma.user.findUnique({ where: { alias: 'alice' } });
  const bob = await prisma.user.findUnique({ where: { alias: 'bob' } });
  const charlie = await prisma.user.findUnique({ where: { alias: 'charlie' } });
  const demo = await prisma.user.findUnique({ where: { alias: 'demo' } });
  const eve = await prisma.user.findUnique({ where: { alias: 'eve' } });
  const frank = await prisma.user.findUnique({ where: { alias: 'frank' } });

  if (!alice || !bob || !charlie || !demo || !eve || !frank) {
    console.log('  ⏭️  Some users not found, skipping friendships');
    return;
  }

  // Define friendships: [senderId, receiverId, status]
  const friendships: [string, string, FriendshipStatus][] = [
    // Alice is friends with Bob and Charlie
    [alice.id, bob.id, FriendshipStatus.ACCEPTED],
    [alice.id, charlie.id, FriendshipStatus.ACCEPTED],
    // Demo has pending request from Eve
    [eve.id, demo.id, FriendshipStatus.PENDING],
    // Demo is friends with Alice
    [demo.id, alice.id, FriendshipStatus.ACCEPTED],
    // Frank sent request to Demo (pending)
    [frank.id, demo.id, FriendshipStatus.PENDING],
    // Bob is friends with Charlie
    [bob.id, charlie.id, FriendshipStatus.ACCEPTED],
  ];

  for (const [userId, friendId, status] of friendships) {
    // Check if friendship already exists
    const existing = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });

    if (existing) {
      console.log(`  ⏭️  Friendship already exists, skipping`);
      continue;
    }

    await prisma.friendship.create({
      data: { userId, friendId, status },
    });

    const sender = await prisma.user.findUnique({ where: { id: userId } });
    const receiver = await prisma.user.findUnique({ where: { id: friendId } });
    console.log(`  ✅ ${sender?.alias} → ${receiver?.alias} (${status})`);
  }
}

async function seedNotifications() {
  console.log('🔔 Seeding notifications...');

  const demo = await prisma.user.findUnique({ where: { alias: 'demo' } });
  const eve = await prisma.user.findUnique({ where: { alias: 'eve' } });
  const frank = await prisma.user.findUnique({ where: { alias: 'frank' } });

  if (!demo || !eve || !frank) {
    console.log('  ⏭️  Some users not found, skipping notifications');
    return;
  }

  // Check if notifications already exist for demo user
  const existingCount = await prisma.notification.count({
    where: { userId: demo.id },
  });

  if (existingCount > 0) {
    console.log(`  ⏭️  Demo user already has ${existingCount} notifications, skipping`);
    return;
  }

  // Create notifications for demo user (pending friend requests)
  const notifications = [
    {
      userId: demo.id,
      type: NotificationType.FRIEND_REQUEST,
      data: JSON.stringify({ fromUserId: eve.id, fromAlias: eve.alias }),
      read: false,
    },
    {
      userId: demo.id,
      type: NotificationType.FRIEND_REQUEST,
      data: JSON.stringify({ fromUserId: frank.id, fromAlias: frank.alias }),
      read: false,
    },
  ];

  for (const notification of notifications) {
    await prisma.notification.create({ data: notification });
    const data = JSON.parse(notification.data);
    console.log(`  ✅ Notification for ${demo.alias}: ${notification.type} from ${data.fromAlias}`);
  }
}

async function updateLastSeenTimes() {
  console.log('⏰ Setting lastSeenAt for demo users...');

  // Set varied lastSeenAt times for demo purposes
  const now = new Date();
  const lastSeenTimes: [string, Date | null][] = [
    ['alice', null], // Never seen (will appear as "Never")
    ['bob', new Date(now.getTime() - 5 * 60 * 1000)], // 5 minutes ago
    ['charlie', new Date(now.getTime() - 2 * 60 * 60 * 1000)], // 2 hours ago
    ['eve', new Date(now.getTime() - 24 * 60 * 60 * 1000)], // 1 day ago
    ['frank', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)], // 1 week ago
    ['grace', new Date(now.getTime() - 30 * 60 * 1000)], // 30 minutes ago
    ['henry', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)], // 3 days ago
  ];

  for (const [alias, lastSeenAt] of lastSeenTimes) {
    await prisma.user.update({
      where: { alias },
      data: { lastSeenAt },
    });
    console.log(`  ✅ ${alias}: ${lastSeenAt ? lastSeenAt.toISOString() : 'never'}`);
  }
}

async function main() {
  console.log('🌱 Starting database seed...');
  console.log(`   Environment: ${isProduction ? 'production' : 'development'}`);
  console.log(`   Database: ${DATABASE_URL}`);

  if (shouldClean) {
    await cleanDatabase();
    await cleanAvatars();
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
    await seedFriendships();
    await seedNotifications();
    await updateLastSeenTimes();
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
