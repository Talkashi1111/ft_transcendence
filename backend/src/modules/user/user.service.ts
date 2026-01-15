import { prisma } from '../../utils/prisma.js';
import { hashPassword } from '../../utils/hash.js';
import type { CreateUserInput } from './user.schema.js';

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

export async function exportMyData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      alias: true,
      twoFactorEnabled: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  if (!user) return null;

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      alias: user.alias,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt.toISOString(),
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    },
  };
}