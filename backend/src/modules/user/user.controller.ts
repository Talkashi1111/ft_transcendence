import type { FastifyRequest, FastifyReply } from 'fastify';
import * as z from 'zod';
import {
  createUser,
  findUserByEmail,
  findUsers,
  findUserById,
  updateUserAlias,
  searchUsers,
  getUserStats,
} from './user.service.js';
import {
  createUserSchema,
  loginSchema,
  updateAliasSchema,
  type CreateUserInput,
  type LoginInput,
  type UpdateAliasInput,
} from './user.schema.js';
import { verifyPassword } from '../../utils/hash.js';
import { generateTempToken, getTempTokenExpiry } from '../../utils/auth-helpers.js';
import { matchManager } from '../game/match-manager.js';

// Prisma error type for unique constraint violations
interface PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: { target?: string[] };
}

/**
 * Register a new user
 *
 * Note: This endpoint does NOT set authentication cookies.
 * Users must login separately after registration to obtain a session.
 * This allows for future email verification and other onboarding flows.
 */
export async function registerUserHandler(
  request: FastifyRequest<{ Body: CreateUserInput }>,
  reply: FastifyReply
) {
  try {
    // Validate input with Zod
    const validatedData = createUserSchema.parse(request.body);

    // Check if user with email already exists
    const existingUser = await findUserByEmail(validatedData.email);
    if (existingUser) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'User with this email already exists',
      });
    }

    // Create user
    const user = await createUser(validatedData);

    return reply.status(201).send({
      id: user.id,
      email: user.email,
      alias: user.alias,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.issues[0].message,
      });
    }

    // Handle Prisma unique constraint errors
    const prismaError = error as PrismaClientKnownRequestError;
    if (prismaError.code === 'P2002') {
      const target = prismaError.meta?.target;
      const field = Array.isArray(target) ? target[0] : 'field';
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: `User with this ${field} already exists`,
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong',
    });
  }
}

export async function loginHandler(
  request: FastifyRequest<{ Body: LoginInput }>,
  reply: FastifyReply
) {
  try {
    // Validate input with Zod
    const validatedData = loginSchema.parse(request.body);

    // Find user by email (include 2FA fields)
    const user = await findUserByEmail(validatedData.email);
    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Check if user has a password (OAuth-only users don't)
    if (!user.password) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'This account uses Google login. Please sign in with Google.',
      });
    }

    // Verify password (argon2 hash includes salt)
    const isValidPassword = await verifyPassword(validatedData.password, user.password);
    if (!isValidPassword) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate short-lived temp token for 2FA verification
      const tempToken = generateTempToken(request.server, user.id, user.email);

      // Store tempToken in HTTP-only cookie (same as OAuth flow)
      reply.setCookie('2fa-temp-token', tempToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: getTempTokenExpiry(), // 5 minutes (matches JWT expiration)
      });

      return reply.send({
        success: false,
        requires2FA: true,
      });
    }

    // No 2FA - proceed with normal login
    // Generate JWT token
    const accessToken = request.server.jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      { expiresIn: '24h' }
    );

    // Set httpOnly cookie (production-ready)
    reply.setCookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours in seconds
    });

    // Return success without token in body (it's in cookie)
    return reply.send({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.issues,
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong',
    });
  }
}

export async function getUsersHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const users = await findUsers();
    return reply.send(
      users.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong',
    });
  }
}

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Get user ID from JWT token (only id and email are in JWT)
    const { id } = request.user as { id: string; email: string };

    // Fetch full user from database (including current alias)
    const user = await findUserById(id);

    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'User not found',
      });
    }

    return reply.send({
      id: user.id,
      email: user.email,
      alias: user.alias,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong',
    });
  }
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  // Clear the authentication cookie
  reply.clearCookie('token', {
    path: '/',
  });

  return reply.send({ success: true });
}

/**
 * Update user's alias
 *
 * Restrictions:
 * - Alias must be 3-30 characters
 * - Alias must be unique
 * - Cannot change alias while in an active match or tournament
 */
export async function updateAliasHandler(
  request: FastifyRequest<{ Body: UpdateAliasInput }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.user as { id: string; email: string };
    const validatedData = updateAliasSchema.parse(request.body);

    // Check if user is in an active match (cannot change alias during game)
    if (matchManager.isPlayerInActiveMatch(id)) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'Cannot change alias while in an active match or tournament',
      });
    }

    // Update the alias
    const user = await updateUserAlias(id, validatedData.alias);

    return reply.send({
      id: user.id,
      email: user.email,
      alias: user.alias,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.issues[0].message,
      });
    }

    // Handle Prisma unique constraint errors (alias already taken)
    const prismaError = error as PrismaClientKnownRequestError;
    if (prismaError.code === 'P2002') {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'This alias is already taken',
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Something went wrong',
    });
  }
}

/**
 * Search for users by alias
 * Requires authentication
 * Query must be at least 2 characters
 */
export async function searchUsersHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = (request.query as { q?: string; cursor?: string; limit?: string }).q || '';
  const cursor = (request.query as { cursor?: string }).cursor;
  const limitStr = (request.query as { limit?: string }).limit;
  const limit = limitStr ? parseInt(limitStr, 10) : 20;

  // Validate limit
  const validLimit = Math.min(Math.max(1, limit), 50);

  const { users, nextCursor } = await searchUsers(query, request.user.id, cursor, validLimit);

  // Add online status to results
  const { isUserOnline } = await import('../game/game.gateway.js');
  const { prisma } = await import('../../utils/prisma.js');
  const { FriendshipStatus } = await import('../../generated/prisma/client.js');

  // Get all friendships between current user and search results
  const userIds = users.map((u) => u.id);
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { userId: request.user.id, friendId: { in: userIds } },
        { userId: { in: userIds }, friendId: request.user.id },
      ],
    },
    select: {
      userId: true,
      friendId: true,
      status: true,
    },
  });

  // Build a map of user id -> friendship status
  const friendshipMap = new Map<string, { isFriend: boolean; isPending: boolean }>();
  for (const f of friendships) {
    const otherId = f.userId === request.user.id ? f.friendId : f.userId;
    friendshipMap.set(otherId, {
      isFriend: f.status === FriendshipStatus.ACCEPTED,
      isPending: f.status === FriendshipStatus.PENDING,
    });
  }

  const usersWithStatus = users.map((user) => {
    const status = friendshipMap.get(user.id);
    return {
      id: user.id,
      alias: user.alias,
      isOnline: isUserOnline(user.id),
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      isFriend: status?.isFriend ?? false,
      isPending: status?.isPending ?? false,
    };
  });

  return reply.send({
    users: usersWithStatus,
    nextCursor,
  });
}

/**
 * Get user's game statistics
 */
export async function getMyStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id: userId } = request.user as { id: string; email: string };
    const stats = await getUserStats(userId);
    return reply.send(stats);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to fetch user stats',
    });
  }
}
