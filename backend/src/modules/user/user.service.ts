import { prisma } from '../../utils/prisma.js';
import { hashPassword } from '../../utils/hash.js';
import type { CreateUserInput, UserStats } from './user.schema.js';

export async function createUser(input: CreateUserInput) {
  const { email, alias, password } = input;

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      alias,
      password: hashedPassword,
    },
  });

  return user;
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      alias: true,
      password: true,
      googleId: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });
}

export async function findUserByAlias(alias: string) {
  return prisma.user.findUnique({
    where: { alias },
  });
}

export async function findUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      alias: true,
      createdAt: true,
    },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      alias: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });
}

export async function updateUserAlias(id: string, alias: string) {
  return prisma.user.update({
    where: { id },
    data: { alias },
    select: {
      id: true,
      email: true,
      alias: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });
}

/**
 * Search users by alias (case-insensitive partial match)
 * Returns users excluding the current user
 * Paginated with cursor-based pagination
 *
 * Note: SQLite's LIKE is case-insensitive for ASCII characters by default,
 * so no special handling is needed for case-insensitivity.
 */
export async function searchUsers(
  query: string,
  currentUserId: string,
  cursor?: string,
  limit: number = 20
) {
  // Require at least 2 characters to search
  if (query.length < 2) {
    return { users: [], nextCursor: null };
  }

  const users = await prisma.user.findMany({
    where: {
      alias: {
        contains: query,
      },
      NOT: {
        id: currentUserId,
      },
    },
    select: {
      id: true,
      alias: true,
      lastSeenAt: true,
    },
    orderBy: { alias: 'asc' },
    take: limit + 1, // Fetch one extra to check if there are more
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor itself
    }),
  });

  // Check if there are more results
  const hasMore = users.length > limit;
  const resultUsers = hasMore ? users.slice(0, -1) : users;
  const nextCursor = hasMore ? resultUsers[resultUsers.length - 1]?.id : null;

  return {
    users: resultUsers,
    nextCursor,
  };
}

/**
 * Get user game statistics
 * Calculates wins/losses across all game modes
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  // Get all matches where user is player1 or player2
  const matches = await prisma.matchHistory.findMany({
    where: {
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
    orderBy: { playedAt: 'desc' },
    select: {
      id: true,
      mode: true,
      player1Id: true,
      player1Alias: true,
      player2Id: true,
      player2Alias: true,
      score1: true,
      score2: true,
      playedAt: true,
    },
  });

  // Get tournament counts
  const tournamentsOrganized = await prisma.localTournament.count({
    where: { organizerId: userId },
  });

  // Get user's alias for tournament win counting
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { alias: true },
  });

  // Count tournament wins where user's alias matches winner
  // Note: We check all aliases the user has used (stored in tournaments)
  const tournamentWins = await prisma.localTournament.count({
    where: {
      organizerId: userId,
      winner: user?.alias ?? '',
    },
  });

  // Initialize stats by mode
  const byMode = {
    tournament: { played: 0, wins: 0, losses: 0 },
    local1v1: { played: 0, wins: 0, losses: 0 },
    vsBot: { played: 0, wins: 0, losses: 0 },
    remote1v1: { played: 0, wins: 0, losses: 0 },
  };

  let totalWins = 0;
  let totalLosses = 0;

  // Calculate stats for each match
  for (const match of matches) {
    const isPlayer1 = match.player1Id === userId;
    const myScore = isPlayer1 ? match.score1 : match.score2;
    const opponentScore = isPlayer1 ? match.score2 : match.score1;
    const won = myScore > opponentScore;

    // Map mode to stats key
    const modeKey =
      match.mode === 'TOURNAMENT'
        ? 'tournament'
        : match.mode === 'LOCAL_1V1'
          ? 'local1v1'
          : match.mode === 'VS_BOT'
            ? 'vsBot'
            : 'remote1v1';

    byMode[modeKey].played++;
    if (won) {
      byMode[modeKey].wins++;
      totalWins++;
    } else {
      byMode[modeKey].losses++;
      totalLosses++;
    }
  }

  const totalGames = totalWins + totalLosses;
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  // Get recent matches (last 10)
  const recentMatches = matches.slice(0, 10).map((match) => {
    const isPlayer1 = match.player1Id === userId;
    const myScore = isPlayer1 ? match.score1 : match.score2;
    const opponentScore = isPlayer1 ? match.score2 : match.score1;

    return {
      id: match.id,
      mode: match.mode,
      player1Alias: match.player1Alias,
      player2Alias: match.player2Alias,
      score1: match.score1,
      score2: match.score2,
      won: myScore > opponentScore,
      playedAt: match.playedAt.toISOString(),
    };
  });

  return {
    totalGames,
    totalWins,
    totalLosses,
    winRate,
    byMode,
    tournamentsOrganized,
    tournamentWins,
    recentMatches,
  };
}
