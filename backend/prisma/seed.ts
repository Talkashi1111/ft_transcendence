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
  GameMode,
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
  await prisma.matchHistory.deleteMany();
  await prisma.localTournament.deleteMany();
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

  const now = new Date();

  // ============================================
  // Timeline of events (for consistency):
  // - 10 days ago: Alice registered, sent requests to Bob and Charlie
  // - 9 days ago: Bob accepted Alice's request
  // - 8 days ago: Charlie accepted Alice's request, Bob sent request to Charlie
  // - 7 days ago: Charlie accepted Bob's request
  // - 5 days ago: Demo registered, sent request to Alice
  // - 4 days ago: Alice accepted Demo's request
  // - 2 days ago: Eve sent request to Demo (pending)
  // - 1 day ago: Frank sent request to Demo (pending)
  // ============================================

  // Define friendships: [senderId, receiverId, status, createdAt]
  const friendships: [string, string, FriendshipStatus, Date][] = [
    // Alice sent request to Bob (10 days ago), Bob accepted (9 days ago)
    [
      alice.id,
      bob.id,
      FriendshipStatus.ACCEPTED,
      new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    ],
    // Alice sent request to Charlie (10 days ago), Charlie accepted (8 days ago)
    [
      alice.id,
      charlie.id,
      FriendshipStatus.ACCEPTED,
      new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    ],
    // Bob sent request to Charlie (8 days ago), Charlie accepted (7 days ago)
    [
      bob.id,
      charlie.id,
      FriendshipStatus.ACCEPTED,
      new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
    ],
    // Demo sent request to Alice (5 days ago), Alice accepted (4 days ago)
    [
      demo.id,
      alice.id,
      FriendshipStatus.ACCEPTED,
      new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    ],
    // Eve sent request to Demo (2 days ago) - PENDING
    [eve.id, demo.id, FriendshipStatus.PENDING, new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)],
    // Frank sent request to Demo (1 day ago) - PENDING
    [
      frank.id,
      demo.id,
      FriendshipStatus.PENDING,
      new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    ],
  ];

  for (const [userId, friendId, status, createdAt] of friendships) {
    // Check if friendship already exists
    const existing = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });

    if (existing) {
      console.log(`  ⏭️  Friendship already exists, skipping`);
      continue;
    }

    await prisma.friendship.create({
      data: { userId, friendId, status, createdAt },
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

  const now = new Date();

  // Notifications match the friendship timeline
  // Eve sent request 2 days ago, Frank sent request 1 day ago
  const notifications = [
    {
      userId: demo.id,
      type: NotificationType.FRIEND_REQUEST,
      data: JSON.stringify({ fromUserId: eve.id, fromAlias: eve.alias }),
      read: false,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    {
      userId: demo.id,
      type: NotificationType.FRIEND_REQUEST,
      data: JSON.stringify({ fromUserId: frank.id, fromAlias: frank.alias }),
      read: false,
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
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

  // lastSeenAt must be AFTER any actions the user took
  // Timeline reference:
  // - Demo: main user, last seen 1 hour ago
  // - Alice: accepted demo's request 4 days ago, last seen 2 days ago
  // - Bob: accepted Alice's request 9 days ago, last seen 5 min ago (active)
  // - Charlie: accepted requests 7-8 days ago, last seen 2 hours ago
  // - Eve: sent request to demo 2 days ago, last seen 1 day ago
  // - Frank: sent request to demo 1 day ago, last seen 6 hours ago
  // - Grace: no friendships, last seen 30 min ago
  // - Henry: no friendships, never logged in (null)
  const now = new Date();
  const lastSeenTimes: [string, Date | null][] = [
    ['demo', new Date(now.getTime() - 1 * 60 * 60 * 1000)], // 1 hour ago
    ['alice', new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)], // 2 days ago
    ['bob', new Date(now.getTime() - 5 * 60 * 1000)], // 5 minutes ago
    ['charlie', new Date(now.getTime() - 2 * 60 * 60 * 1000)], // 2 hours ago
    ['eve', new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)], // 1 day ago (after sending request)
    ['frank', new Date(now.getTime() - 6 * 60 * 60 * 1000)], // 6 hours ago (after sending request)
    ['grace', new Date(now.getTime() - 30 * 60 * 1000)], // 30 minutes ago
    ['henry', null], // Never logged in (no friendships or actions)
  ];

  for (const [alias, lastSeenAt] of lastSeenTimes) {
    await prisma.user.update({
      where: { alias },
      data: { lastSeenAt },
    });
    console.log(`  ✅ ${alias}: ${lastSeenAt ? lastSeenAt.toISOString() : 'never'}`);
  }
}

async function seedTournamentsAndMatches() {
  console.log('🏆 Seeding tournaments and match history...');

  // Get users
  const alice = await prisma.user.findUnique({ where: { alias: 'alice' } });
  const bob = await prisma.user.findUnique({ where: { alias: 'bob' } });
  const charlie = await prisma.user.findUnique({ where: { alias: 'charlie' } });
  const demo = await prisma.user.findUnique({ where: { alias: 'demo' } });
  const eve = await prisma.user.findUnique({ where: { alias: 'eve' } });

  if (!alice || !bob || !charlie || !demo || !eve) {
    console.log('  ⏭️  Some users not found, skipping tournaments and matches');
    return;
  }

  // Check if tournaments already exist
  const existingTournaments = await prisma.localTournament.count();
  if (existingTournaments > 0) {
    console.log(`  ⏭️  ${existingTournaments} tournaments already exist, skipping`);
    return;
  }

  const now = new Date();

  // ============================================
  // IMPORTANT: Tournament Detail View needs ALL matches
  // - Stats query uses: WHERE player1Id = userId OR player2Id = userId
  // - Tournament detail view shows t.matches (all matches with tournamentId)
  // - So we store ALL matches, but only set player1Id/player2Id when organizer played
  // - Matches where organizer didn't play: player1Id = null, player2Id = null
  // ============================================

  // Helper function to create match with proper player IDs
  const createMatch = async (data: {
    tournamentId: string;
    organizerId: string;
    organizerAlias: string;
    player1Alias: string;
    player2Alias: string;
    score1: number;
    score2: number;
    round: number;
    matchOrder: number;
    playedAt: Date;
  }) => {
    // For tournament matches, player1Id is always the organizer (they record all matches)
    // player2Id is only set if organizer happens to be player2 in the match
    const player2Id = data.player2Alias === data.organizerAlias ? data.organizerId : undefined;

    await prisma.matchHistory.create({
      data: {
        mode: GameMode.TOURNAMENT,
        tournamentId: data.tournamentId,
        player1Id: data.organizerId,
        player1Alias: data.player1Alias,
        player2Id,
        player2Alias: data.player2Alias,
        score1: data.score1,
        score2: data.score2,
        round: data.round,
        matchOrder: data.matchOrder,
        playedAt: data.playedAt,
      },
    });
  };

  // ============================================
  // Tournament 1: 4-player by Demo - demo WON
  // Players: [demo, Player 2, Player 3, Player 4]
  // Bracket (4-player template):
  //   Match 0 (R1): demo (idx 0) vs Player 4 (idx 3) -> demo wins 5-2
  //   Match 1 (R1): Player 2 (idx 1) vs Player 3 (idx 2) -> Player 2 wins 5-3
  //   Match 2 (Final): demo vs Player 2 -> demo wins 5-4
  // ============================================
  const tournament1 = await prisma.localTournament.create({
    data: {
      organizerId: demo.id,
      organizerAlias: 'demo',
      playerCount: 4,
      winner: 'demo',
      blockchainId: 3,
      txHash: '0x5c43a4cc97cff3c78bd7e5bb0db4dca8c9f6f8545ce84554a30e8482e10fe2df',
      playedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000),
      recordedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000),
    },
  });
  console.log(`  ✅ Tournament 1: 4-player by demo (blockchain verified, demo won)`);

  // All matches for tournament 1
  await createMatch({
    tournamentId: tournament1.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'demo',
    player2Alias: 'Player 4',
    score1: 5,
    score2: 2,
    round: 1,
    matchOrder: 0,
    playedAt: tournament1.playedAt,
  });
  await createMatch({
    tournamentId: tournament1.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'Player 2',
    player2Alias: 'Player 3',
    score1: 5,
    score2: 3,
    round: 1,
    matchOrder: 1,
    playedAt: tournament1.playedAt,
  });
  await createMatch({
    tournamentId: tournament1.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'demo',
    player2Alias: 'Player 2',
    score1: 5,
    score2: 4,
    round: 2,
    matchOrder: 2,
    playedAt: tournament1.playedAt,
  });

  // ============================================
  // Tournament 2: 4-player by Demo - demo LOST in final
  // Players: [demo, John, Sarah, Mike]
  // Bracket:
  //   Match 0 (R1): demo vs Mike -> demo wins 5-1
  //   Match 1 (R1): John vs Sarah -> John wins 5-2
  //   Match 2 (Final): demo vs John -> John wins 5-3
  // ============================================
  const tournament2 = await prisma.localTournament.create({
    data: {
      organizerId: demo.id,
      organizerAlias: 'demo',
      playerCount: 4,
      winner: 'John',
      blockchainId: 4,
      txHash: '0xb9443bb186c91458c854d5e391da7a49f46dac287f310d864919bfe94046004d',
      playedAt: new Date(now.getTime() - 22 * 60 * 60 * 1000),
      recordedAt: new Date(now.getTime() - 22 * 60 * 60 * 1000),
    },
  });
  console.log(`  ✅ Tournament 2: 4-player by demo (blockchain verified, John won)`);

  // All matches for tournament 2
  await createMatch({
    tournamentId: tournament2.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'demo',
    player2Alias: 'Mike',
    score1: 5,
    score2: 1,
    round: 1,
    matchOrder: 0,
    playedAt: tournament2.playedAt,
  });
  await createMatch({
    tournamentId: tournament2.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'John',
    player2Alias: 'Sarah',
    score1: 5,
    score2: 2,
    round: 1,
    matchOrder: 1,
    playedAt: tournament2.playedAt,
  });
  await createMatch({
    tournamentId: tournament2.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'demo',
    player2Alias: 'John',
    score1: 3,
    score2: 5,
    round: 2,
    matchOrder: 2,
    playedAt: tournament2.playedAt,
  });

  // ============================================
  // Tournament 3: 8-player by Demo - demo LOST in finals
  // Players: [demo, Alex, Ben, Chris, Dana, Emma, Felix, Grace]
  // Bracket (8-player template):
  //   Match 0 (R1): demo (0) vs Grace (7) -> demo wins 5-2
  //   Match 1 (R1): Chris (3) vs Dana (4) -> Chris wins 5-3
  //   Match 2 (R1): Alex (1) vs Felix (6) -> Alex wins 5-1
  //   Match 3 (R1): Ben (2) vs Emma (5) -> Ben wins 5-4
  //   Match 4 (R2): demo vs Chris -> demo wins 5-3
  //   Match 5 (R2): Alex vs Ben -> Alex wins 5-2
  //   Match 6 (Final): demo vs Alex -> Alex wins 5-4
  // ============================================
  const tournament3 = await prisma.localTournament.create({
    data: {
      organizerId: demo.id,
      organizerAlias: 'demo',
      playerCount: 8,
      winner: 'Alex',
      blockchainId: 5,
      txHash: '0xf0cdc11e6f0a054a94c967c576358a4a62ffd46f84b0e559957d80a14bad7c73',
      playedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
      recordedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
    },
  });
  console.log(`  ✅ Tournament 3: 8-player by demo (blockchain verified, Alex won)`);

  // All 7 matches for tournament 3
  // Round 1: 4 matches
  await createMatch({
    tournamentId: tournament3.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'demo',
    player2Alias: 'Grace',
    score1: 5,
    score2: 2,
    round: 1,
    matchOrder: 0,
    playedAt: tournament3.playedAt,
  });
  await createMatch({
    tournamentId: tournament3.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'Chris',
    player2Alias: 'Dana',
    score1: 5,
    score2: 3,
    round: 1,
    matchOrder: 1,
    playedAt: tournament3.playedAt,
  });
  await createMatch({
    tournamentId: tournament3.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'Alex',
    player2Alias: 'Felix',
    score1: 5,
    score2: 1,
    round: 1,
    matchOrder: 2,
    playedAt: tournament3.playedAt,
  });
  await createMatch({
    tournamentId: tournament3.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'Ben',
    player2Alias: 'Emma',
    score1: 5,
    score2: 4,
    round: 1,
    matchOrder: 3,
    playedAt: tournament3.playedAt,
  });
  // Round 2: 2 matches (semi-finals)
  await createMatch({
    tournamentId: tournament3.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'demo',
    player2Alias: 'Chris',
    score1: 5,
    score2: 3,
    round: 2,
    matchOrder: 4,
    playedAt: tournament3.playedAt,
  });
  await createMatch({
    tournamentId: tournament3.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'Alex',
    player2Alias: 'Ben',
    score1: 5,
    score2: 2,
    round: 2,
    matchOrder: 5,
    playedAt: tournament3.playedAt,
  });
  // Round 3: Final
  await createMatch({
    tournamentId: tournament3.id,
    organizerId: demo.id,
    organizerAlias: 'demo',
    player1Alias: 'demo',
    player2Alias: 'Alex',
    score1: 4,
    score2: 5,
    round: 3,
    matchOrder: 6,
    playedAt: tournament3.playedAt,
  });

  // ============================================
  // Standalone matches (non-tournament)
  // ============================================
  console.log('  📊 Seeding standalone matches...');

  // Local 1v1 matches (player2Id = null, opponent is local guest)
  await prisma.matchHistory.create({
    data: {
      mode: GameMode.LOCAL_1V1,
      player1Id: demo.id,
      player1Alias: 'demo',
      player2Id: null,
      player2Alias: 'Friend',
      score1: 5,
      score2: 3,
      playedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.matchHistory.create({
    data: {
      mode: GameMode.LOCAL_1V1,
      player1Id: demo.id,
      player1Alias: 'demo',
      player2Id: null,
      player2Alias: 'Brother',
      score1: 2,
      score2: 5,
      playedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.matchHistory.create({
    data: {
      mode: GameMode.LOCAL_1V1,
      player1Id: alice.id,
      player1Alias: 'alice',
      player2Id: null,
      player2Alias: 'Roommate',
      score1: 5,
      score2: 4,
      playedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // VS Bot matches
  await prisma.matchHistory.create({
    data: {
      mode: GameMode.VS_BOT,
      player1Id: demo.id,
      player1Alias: 'demo',
      player2Id: null,
      player2Alias: 'Bot (Easy)',
      score1: 5,
      score2: 1,
      playedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
  });

  await prisma.matchHistory.create({
    data: {
      mode: GameMode.VS_BOT,
      player1Id: demo.id,
      player1Alias: 'demo',
      player2Id: null,
      player2Alias: 'Bot (Hard)',
      score1: 3,
      score2: 5,
      playedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    },
  });

  await prisma.matchHistory.create({
    data: {
      mode: GameMode.VS_BOT,
      player1Id: alice.id,
      player1Alias: 'alice',
      player2Id: null,
      player2Alias: 'Bot (Hard)',
      score1: 5,
      score2: 4,
      playedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // Remote 1v1 matches (BOTH players are real users)
  await prisma.matchHistory.create({
    data: {
      mode: GameMode.REMOTE_1V1,
      player1Id: demo.id,
      player1Alias: 'demo',
      player2Id: eve.id,
      player2Alias: 'eve',
      score1: 5,
      score2: 4,
      playedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
  });

  await prisma.matchHistory.create({
    data: {
      mode: GameMode.REMOTE_1V1,
      player1Id: bob.id,
      player1Alias: 'bob',
      player2Id: demo.id,
      player2Alias: 'demo',
      score1: 5,
      score2: 2,
      playedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
  });

  await prisma.matchHistory.create({
    data: {
      mode: GameMode.REMOTE_1V1,
      player1Id: alice.id,
      player1Alias: 'alice',
      player2Id: charlie.id,
      player2Alias: 'charlie',
      score1: 5,
      score2: 3,
      playedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
  });

  // Count totals
  const tournamentCount = await prisma.localTournament.count();
  const matchCount = await prisma.matchHistory.count();
  console.log(`  ✅ Seeded ${tournamentCount} tournaments and ${matchCount} matches`);
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
    await seedTournamentsAndMatches();
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
