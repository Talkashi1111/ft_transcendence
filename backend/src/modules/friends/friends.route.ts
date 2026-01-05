import type { FastifyInstance } from 'fastify';
import {
  getFriendsHandler,
  getFriendRequestsHandler,
  sendFriendRequestHandler,
  acceptFriendRequestHandler,
  declineFriendRequestHandler,
  removeFriendHandler,
  cancelFriendRequestHandler,
} from './friends.controller.js';
import {
  friendsListResponseJsonSchema,
  friendRequestsResponseJsonSchema,
  sendFriendRequestBodyJsonSchema,
  friendRequestResponseJsonSchema,
  acceptDeclineResponseJsonSchema,
  removeFriendResponseJsonSchema,
  errorResponseJsonSchema,
} from './friends.schema.js';

async function friendsRoutes(server: FastifyInstance) {
  // All routes require authentication
  server.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }
  });

  // Get friends list with online status
  server.get(
    '/',
    {
      schema: {
        description: 'Get list of friends with online status',
        tags: ['Friends'],
        response: {
          200: friendsListResponseJsonSchema,
        },
      },
    },
    getFriendsHandler
  );

  // Get pending friend requests (sent and received)
  server.get(
    '/requests',
    {
      schema: {
        description: 'Get pending friend requests (sent and received)',
        tags: ['Friends'],
        response: {
          200: friendRequestsResponseJsonSchema,
        },
      },
    },
    getFriendRequestsHandler
  );

  // Send a friend request
  server.post(
    '/request',
    {
      schema: {
        description: 'Send a friend request to another user',
        tags: ['Friends'],
        body: sendFriendRequestBodyJsonSchema,
        response: {
          201: friendRequestResponseJsonSchema,
          400: errorResponseJsonSchema,
        },
      },
    },
    sendFriendRequestHandler
  );

  // Accept a friend request
  server.post(
    '/:id/accept',
    {
      schema: {
        description: 'Accept a pending friend request',
        tags: ['Friends'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Friendship ID' },
          },
          required: ['id'],
        },
        response: {
          200: acceptDeclineResponseJsonSchema,
          400: errorResponseJsonSchema,
        },
      },
    },
    acceptFriendRequestHandler
  );

  // Decline a friend request
  server.post(
    '/:id/decline',
    {
      schema: {
        description: 'Decline a pending friend request',
        tags: ['Friends'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Friendship ID' },
          },
          required: ['id'],
        },
        response: {
          200: acceptDeclineResponseJsonSchema,
          400: errorResponseJsonSchema,
        },
      },
    },
    declineFriendRequestHandler
  );

  // Cancel a sent friend request
  server.delete(
    '/request/:id',
    {
      schema: {
        description: 'Cancel a friend request you sent',
        tags: ['Friends'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Friendship ID' },
          },
          required: ['id'],
        },
        response: {
          200: acceptDeclineResponseJsonSchema,
          400: errorResponseJsonSchema,
        },
      },
    },
    cancelFriendRequestHandler
  );

  // Remove a friend
  server.delete(
    '/:id',
    {
      schema: {
        description: 'Remove a friend (unfriend)',
        tags: ['Friends'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User ID of the friend to remove' },
          },
          required: ['id'],
        },
        response: {
          200: removeFriendResponseJsonSchema,
          400: errorResponseJsonSchema,
        },
      },
    },
    removeFriendHandler
  );
}

export default friendsRoutes;
