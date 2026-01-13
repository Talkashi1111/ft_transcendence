import 'dotenv/config';
import fastify, { FastifyInstance } from 'fastify';
import { fileURLToPath } from 'url';
import path from 'path';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyWebsocket from '@fastify/websocket';
import fastifyMultipart from '@fastify/multipart';
import fastifyMetrics from 'fastify-metrics';
import fs from 'fs';
import userRoutes from './modules/user/user.route.js';
import avatarRoutes from './modules/user/avatar.route.js';
import blockchainRoutes from './modules/blockchain/blockchain.route.js';
import oauthRoutes from './modules/oauth/oauth.route.js';
import twoFactorRoutes from './modules/2fa/2fa.route.js';
import gameRoutes from './modules/game/game.route.js';
import friendsRoutes from './modules/friends/friends.route.js';
import notificationsRoutes from './modules/notifications/notifications.route.js';
import { registerGameWebSocket } from './modules/game/game.gateway.js';

const PORT = process.env.PORT || 3000;

// Ensure JWT_SECRET is set securely
// In production: MUST be set via environment variable (throws if missing)
// In development: Uses a fixed fallback for convenience (tokens persist across restarts)
// Note: A random secret would be more secure but would invalidate tokens on every restart
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production.');
  }
  console.warn('Warning: Using fallback JWT secret. Set JWT_SECRET in .env for production!');
  return 'dev-only-jwt-secret-do-not-use-in-production';
}

const JWT_SECRET = getJwtSecret();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend FastifyInstance for JWT and authenticate decorator
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply
    ) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; type?: string };
    user: { id: string; email: string; type?: string };
  }
}

/**
 * Build and configure the Fastify application
 */
export async function buildApp(): Promise<FastifyInstance> {
  const server = fastify({
    logger: { level: 'info' },
  });

  // Register Swagger
  await server.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'ft_transcendence API',
        description: 'API documentation for ft_transcendence',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await server.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  });

  // Register Cookie plugin
  await server.register(fastifyCookie);

  // Register Multipart plugin for file uploads (avatars)
  await server.register(fastifyMultipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max file size
      files: 1, // Only 1 file per request
    },
  });

  // Register WebSocket plugin
  await server.register(fastifyWebsocket);

  // Register JWT
  await server.register(fastifyJwt, {
    secret: JWT_SECRET,
    cookie: {
      cookieName: 'token', // Read JWT from 'token' cookie
      signed: false, // We'll handle cookie signing separately
    },
  });

  // Register Metrics plugin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await server.register(fastifyMetrics as any, {
    endpoint: '/metrics',
    enableDefaultMetrics: true,
  });

  // Authentication decorator
  server.decorate(
    'authenticate',
    async function (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply
    ) {
      try {
        await request.jwtVerify();
      } catch (err) {
        const message =
          err instanceof Error && err.message.includes('expired')
            ? 'Token has expired'
            : 'Invalid or missing token';
        reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message });
      }
    }
  );

  // Custom validation error handler
  server.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      // Handle validation errors with user-friendly messages
      const firstError = error.validation[0];
      let message = firstError.message || 'Validation error';

      // Make email validation errors more user-friendly
      if (
        firstError.instancePath === '/email' ||
        (firstError.params && 'pattern' in firstError.params)
      ) {
        if (message.includes('pattern')) {
          message = 'Please enter a valid email address';
        }
      }

      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: message,
      });
    }

    // Re-throw other errors for default handling
    return reply.send(error);
  });

  // Register routes
  await server.register(userRoutes, { prefix: '/api/users' });
  await server.register(avatarRoutes, { prefix: '/api/users' });
  await server.register(blockchainRoutes, { prefix: '/api' });
  await server.register(oauthRoutes, { prefix: '/api/oauth' });
  await server.register(twoFactorRoutes, { prefix: '/api/2fa' });
  await server.register(gameRoutes, { prefix: '/api/game' });
  await server.register(friendsRoutes, { prefix: '/api/friends' });
  await server.register(notificationsRoutes, { prefix: '/api/notifications' });

  // Register WebSocket gateway for real-time game communication
  await registerGameWebSocket(server);

  // Health check endpoint
  server.get('/healthcheck', async () => {
    return { status: 'ok' };
  });

  return server;
}

/**
 * Configure static file serving for production
 */
export async function configureStaticServing(server: FastifyInstance): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../../frontend/dist');

    // Verify frontend build exists
    if (!fs.existsSync(frontendPath)) {
      throw new Error(
        `Frontend build not found at ${frontendPath}. Ensure the application is properly built.`
      );
    }

    // Register static file serving
    await server.register(fastifyStatic, {
      root: frontendPath,
      prefix: '/',
    });

    // Serve index.html for all non-API routes (SPA support)
    const indexPath = path.join(frontendPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      throw new Error(
        `index.html not found at ${indexPath}. Verify the frontend build completed successfully by running 'pnpm run build'.`
      );
    }

    const indexHtml = fs.readFileSync(indexPath, 'utf-8');

    server.setNotFoundHandler(async (request, reply) => {
      if (!request.url.startsWith('/api/')) {
        return reply.type('text/html').send(indexHtml);
      } else {
        return reply.code(404).send({ error: 'Not found' });
      }
    });
  }
}
