import type { FastifyInstance } from 'fastify';
import {
  getNotificationsHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
  deleteNotificationHandler,
} from './notifications.controller.js';

async function notificationsRoutes(server: FastifyInstance) {
  // All routes require authentication
  server.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }
  });

  // Get notifications
  server.get(
    '/',
    {
      schema: {
        description: 'Get user notifications',
        tags: ['Notifications'],
        querystring: {
          type: 'object',
          properties: {
            unreadOnly: { type: 'string', enum: ['true', 'false'] },
            limit: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              notifications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    data: { type: 'object', additionalProperties: true },
                    read: { type: 'boolean' },
                    createdAt: { type: 'string' },
                  },
                },
              },
              unreadCount: { type: 'number' },
            },
          },
        },
      },
    },
    getNotificationsHandler
  );

  // Get unread count only
  server.get(
    '/unread-count',
    {
      schema: {
        description: 'Get unread notification count',
        tags: ['Notifications'],
        response: {
          200: {
            type: 'object',
            properties: {
              count: { type: 'number' },
            },
          },
        },
      },
    },
    getUnreadCountHandler
  );

  // Mark specific notifications as read
  server.post(
    '/read',
    {
      schema: {
        description: 'Mark specific notifications as read',
        tags: ['Notifications'],
        body: {
          type: 'object',
          required: ['notificationIds'],
          properties: {
            notificationIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    markAsReadHandler
  );

  // Mark all as read
  server.post(
    '/read-all',
    {
      schema: {
        description: 'Mark all notifications as read',
        tags: ['Notifications'],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    markAllAsReadHandler
  );

  // Delete a notification
  server.delete(
    '/:id',
    {
      schema: {
        description: 'Delete a notification',
        tags: ['Notifications'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    deleteNotificationHandler
  );
}

export default notificationsRoutes;
