import type { FastifyInstance } from 'fastify';
import {
  registerUserHandler,
  loginHandler,
  getUsersHandler,
  getMeHandler,
  logoutHandler,
  updateAliasHandler,
  searchUsersHandler,
  exportMyDataHandler,
} from './user.controller.js';
import {
  createUserJsonSchema,
  loginJsonSchema,
  updateAliasJsonSchema,
  userResponseJsonSchema,
  userMeResponseJsonSchema,
  loginResponseJsonSchema,
  usersResponseJsonSchema,
  exportMyDataResponseJsonSchema,
} from './user.schema.js';

async function userRoutes(server: FastifyInstance) {
  // Register new user
  server.post(
    '/',
    {
      schema: {
        description: 'Register a new user',
        tags: ['Users'],
        body: createUserJsonSchema,
        response: {
          201: userResponseJsonSchema,
        },
      },
    },
    registerUserHandler
  );

  // Login
  server.post(
    '/login',
    {
      schema: {
        description: 'Login with email and password',
        tags: ['Users'],
        body: loginJsonSchema,
        response: {
          200: loginResponseJsonSchema,
        },
      },
    },
    loginHandler
  );

  // Get all users (requires authentication)
  server.get(
    '/',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Get all users (requires authentication)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: usersResponseJsonSchema,
        },
      },
    },
    getUsersHandler
  );

  // Get current user profile
  server.get(
    '/me',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Get current user profile (includes 2FA status)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: userMeResponseJsonSchema,
        },
      },
    },
    getMeHandler
  );

  // Update user alias
  server.patch<{ Body: { alias: string } }>(
    '/me/alias',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Update user alias. Cannot be changed while in an active match or tournament.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        body: updateAliasJsonSchema,
        response: {
          200: userMeResponseJsonSchema,
        },
      },
    },
    updateAliasHandler
  );

  server.get(
    '/me/export',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Export current user private data (GDPR portability)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: exportMyDataResponseJsonSchema,
        },
      },
    },
    exportMyDataHandler
  );

  // Logout (clear authentication cookie)
  server.post(
    '/logout',
    {
      schema: {
        description: 'Logout user by clearing authentication cookie',
        tags: ['Users'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      },
    },
    logoutHandler
  );

  // Search users by alias
  server.get(
    '/search',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Search for users by alias (requires at least 2 characters)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Search query (min 2 chars)' },
            cursor: { type: 'string', description: 'Cursor for pagination' },
            limit: { type: 'string', description: 'Max results (1-50, default 20)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              users: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    alias: { type: 'string' },
                    isOnline: { type: 'boolean' },
                    lastSeenAt: { type: ['string', 'null'] },
                  },
                },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    searchUsersHandler
  );
}

export default userRoutes;
