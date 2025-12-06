import type { FastifyRequest, FastifyReply } from 'fastify';
import * as z from 'zod';
import { createUser, findUserByEmail, findUsers, findUserById } from './user.service.js';
import {
  createUserSchema,
  loginSchema,
  type CreateUserInput,
  type LoginInput,
} from './user.schema.js';
import { verifyPassword } from '../../utils/hash.js';

// Prisma error type for unique constraint violations
interface PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: { target?: string[] };
}

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
        message: error.issues,
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

    // Find user by email
    const user = await findUserByEmail(validatedData.email);
    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
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

    // Generate JWT token
    // Only include immutable fields (id, email)
    // DO NOT include mutable fields like alias (can change during session)
    const accessToken = request.server.jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      { expiresIn: '7d' }
    );

    // Set httpOnly cookie (production-ready)
    reply.setCookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
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
