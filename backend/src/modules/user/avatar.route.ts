/**
 * Avatar Routes
 *
 * Handles avatar upload, retrieval, and deletion.
 * Uses magic byte validation for security.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  validateImageBuffer,
  saveAvatar,
  deleteAvatarFile,
  readAvatarFile,
  readDefaultAvatar,
  getMimeTypeFromPath,
} from '../../utils/avatar.js';
import { prisma } from '../../utils/prisma.js';

// Rate limiting map: userId -> last upload timestamp
const uploadRateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 1000; // 1 minute between uploads

/**
 * Check rate limit for avatar uploads
 */
function checkRateLimit(userId: string): boolean {
  const lastUpload = uploadRateLimit.get(userId);
  const now = Date.now();

  if (lastUpload && now - lastUpload < RATE_LIMIT_MS) {
    return false;
  }

  return true;
}

/**
 * Update rate limit timestamp
 */
function updateRateLimit(userId: string): void {
  uploadRateLimit.set(userId, Date.now());
}

async function avatarRoutes(server: FastifyInstance) {
  /**
   * Upload avatar for current user
   * POST /api/users/me/avatar
   */
  server.post(
    '/me/avatar',
    {
      onRequest: [server.authenticate],
      schema: {
        description:
          'Upload avatar image for current user. Max 5MB, supports JPEG, PNG, WebP, GIF.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              avatarUrl: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
          429: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user.id;

      // Check rate limit
      if (!checkRateLimit(userId)) {
        return reply.status(429).send({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Please wait at least 1 minute between avatar uploads',
        });
      }

      try {
        // Get the uploaded file
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'No file uploaded. Please select an image file.',
          });
        }

        // Read file into buffer (with size limit enforced by multipart config)
        const buffer = await data.toBuffer();

        // Validate using magic bytes
        const validation = await validateImageBuffer(buffer);

        if (!validation.valid || !validation.mimeType) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: validation.error || 'Invalid image file',
          });
        }

        // Get user's current avatar to delete later
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { avatarPath: true },
        });

        // Save new avatar
        const { relativePath } = await saveAvatar(userId, buffer, validation.mimeType);

        // Update database
        await prisma.user.update({
          where: { id: userId },
          data: {
            avatarPath: relativePath,
            avatarMimeType: validation.mimeType,
            avatarUpdatedAt: new Date(),
          },
        });

        // Delete old avatar file (after DB update succeeds)
        if (user?.avatarPath) {
          await deleteAvatarFile(user.avatarPath);
        }

        // Update rate limit
        updateRateLimit(userId);

        return reply.send({
          success: true,
          message: 'Avatar uploaded successfully',
          avatarUrl: `/api/users/${userId}/avatar`,
        });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to upload avatar',
        });
      }
    }
  );

  /**
   * Get avatar for a user
   * GET /api/users/:id/avatar
   */
  server.get<{ Params: { id: string } }>(
    '/:id/avatar',
    {
      schema: {
        description: 'Get avatar image for a user. Returns default avatar if not set.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User ID' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'string',
            format: 'binary',
            description: 'Avatar image',
          },
          404: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        // Get user's avatar path
        const user = await prisma.user.findUnique({
          where: { id },
          select: { avatarPath: true, avatarMimeType: true, avatarUpdatedAt: true },
        });

        if (!user) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'User not found',
          });
        }

        // If user has an avatar, serve it
        if (user.avatarPath) {
          const buffer = await readAvatarFile(user.avatarPath);

          if (buffer) {
            // Set cache headers (cache for 1 hour, revalidate)
            const etag = user.avatarUpdatedAt
              ? `"${user.avatarUpdatedAt.getTime()}"`
              : `"${Date.now()}"`;

            return reply
              .header('Content-Type', user.avatarMimeType || getMimeTypeFromPath(user.avatarPath))
              .header('Cache-Control', 'public, max-age=3600')
              .header('ETag', etag)
              .send(buffer);
          }
        }

        // Serve default avatar
        const defaultAvatar = await readDefaultAvatar();
        return reply
          .header('Content-Type', 'image/svg+xml')
          .header('Cache-Control', 'public, max-age=86400') // Cache for 24 hours
          .send(defaultAvatar);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to retrieve avatar',
        });
      }
    }
  );

  /**
   * Delete avatar for current user
   * DELETE /api/users/me/avatar
   */
  server.delete(
    '/me/avatar',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Delete avatar for current user (reverts to default)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user.id;

      try {
        // Get user's current avatar
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { avatarPath: true },
        });

        if (!user?.avatarPath) {
          // User already has default avatar
          return reply.send({
            success: true,
            message: 'You already have the default avatar',
            hadAvatar: false,
          });
        }

        // Delete file from disk
        await deleteAvatarFile(user.avatarPath);

        // Update database
        await prisma.user.update({
          where: { id: userId },
          data: {
            avatarPath: null,
            avatarMimeType: null,
            avatarUpdatedAt: null,
          },
        });

        return reply.send({
          success: true,
          message: 'Profile picture removed',
          hadAvatar: true,
        });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to delete avatar',
        });
      }
    }
  );
}

export default avatarRoutes;
