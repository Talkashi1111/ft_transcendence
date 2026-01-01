import type { FastifyInstance } from 'fastify';
import {
  registerUserHandler,
  loginHandler,
  getUsersHandler,
  getMeHandler,
  logoutHandler,
  updateAliasHandler,
} from './user.controller.js';
import {
  createUserJsonSchema,
  loginJsonSchema,
  updateAliasJsonSchema,
  userResponseJsonSchema,
  userMeResponseJsonSchema,
  loginResponseJsonSchema,
  usersResponseJsonSchema,
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
}

export default userRoutes;
