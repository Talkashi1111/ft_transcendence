import 'dotenv/config';
import fastify, { FastifyInstance } from 'fastify';
import { fileURLToPath } from 'url';
import path from 'path';
import fastifyStatic from '@fastify/static';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fs from 'fs';
import userRoutes from './modules/user/user.route.js';
import blockchainRoutes from './modules/blockchain/blockchain.route.js';

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend FastifyInstance for JWT and authenticate decorator
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; alias: string };
    user: { id: string; email: string; alias: string };
  }
}

/**
 * Build and configure the Fastify application
 */
export async function buildApp(): Promise<FastifyInstance> {
  const server = fastify({
    logger: { level: 'info' }
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

  // Register JWT
  await server.register(fastifyJwt, {
    secret: JWT_SECRET,
  });

  // Authentication decorator
  server.decorate('authenticate', async function (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or missing token' });
    }
  });

  // Register routes
  await server.register(userRoutes, { prefix: '/api/users' });
  await server.register(blockchainRoutes, { prefix: '/api' });

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
      throw new Error(`Frontend build not found at ${frontendPath}. Ensure the application is properly built.`);
    }

    // Register static file serving
    await server.register(fastifyStatic, {
      root: frontendPath,
      prefix: '/',
    });

    // Serve index.html for all non-API routes (SPA support)
    const indexPath = path.join(frontendPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      throw new Error(`index.html not found at ${indexPath}. Verify the frontend build completed successfully by running 'pnpm run build'.`);
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
