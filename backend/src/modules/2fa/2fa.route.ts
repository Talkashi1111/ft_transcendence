import type { FastifyInstance } from 'fastify';
import {
  setup2FAHandler,
  enable2FAHandler,
  disable2FAHandler,
  verify2FAHandler,
} from './2fa.controller.js';
import {
  enable2FAJsonSchema,
  verify2FAJsonSchema,
  setup2FAResponseJsonSchema,
  success2FAResponseJsonSchema,
  verify2FAResponseJsonSchema,
} from './2fa.schema.js';

async function twoFactorRoutes(server: FastifyInstance) {
  // Setup 2FA - Generate secret and QR code
  server.post(
    '/setup',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Generate TOTP secret and QR code for 2FA setup',
        tags: ['2FA'],
        security: [{ bearerAuth: [] }],
        response: {
          200: setup2FAResponseJsonSchema,
        },
      },
    },
    setup2FAHandler
  );

  // Enable 2FA - Verify code and activate
  server.post(
    '/enable',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Verify TOTP code and enable 2FA',
        tags: ['2FA'],
        security: [{ bearerAuth: [] }],
        body: enable2FAJsonSchema,
        response: {
          200: success2FAResponseJsonSchema,
        },
      },
    },
    enable2FAHandler as never
  );

  // Disable 2FA
  server.post(
    '/disable',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Disable 2FA for the current user (JWT auth is sufficient)',
        tags: ['2FA'],
        security: [{ bearerAuth: [] }],
        response: {
          200: success2FAResponseJsonSchema,
        },
      },
    },
    disable2FAHandler as never
  );

  // Verify 2FA code during login
  server.post(
    '/verify',
    {
      schema: {
        description: 'Verify 2FA code during login (uses temp token)',
        tags: ['2FA'],
        body: verify2FAJsonSchema,
        response: {
          200: verify2FAResponseJsonSchema,
        },
      },
    },
    verify2FAHandler as never
  );
}

export default twoFactorRoutes;
