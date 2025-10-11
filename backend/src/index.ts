import fastify from 'fastify';
import { Static, Type } from '@sinclair/typebox';
import { counterOperations } from './db.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fastifyStatic from '@fastify/static';
import fs from 'fs';

const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_HOST || '0.0.0.0';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define your schemas
const User = Type.Object({
  name: Type.String(),
  mail: Type.Optional(Type.String({ format: 'email' })),
});

// Counter schemas
const CounterResponse = Type.Object({
  value: Type.Integer()
});

const CounterRequest = Type.Object({
  value: Type.Integer()
});

// Create types from schemas
type UserType = Static<typeof User>;
type CounterResponseType = Static<typeof CounterResponse>;
type CounterRequestType = Static<typeof CounterRequest>;

// Create server instance
const server = fastify({
  logger: { level: 'info' }
});

// Add a new endpoint with schema validation
server.post<{ Body: UserType, Reply: UserType }>(
  '/users',
  {
    schema: {
      body: User,
      response: {
        200: User
      },
    },
  },
  (request, reply) => {
    // The `name` and `mail` types are automatically inferred
    const { name, mail } = request.body;
    reply.status(200).send({ name, mail });
  }
);

// Counter endpoints
server.get<{ Reply: CounterResponseType }>(
  '/api/counter',
  {
    schema: {
      response: {
        200: CounterResponse
      },
    },
  },
  (request, reply) => {
    try {
      const result = counterOperations.getValue();
      reply.status(200).send({ value: result?.value || 0 });
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ value: 0 });
    }
  }
);

server.put<{ Body: CounterRequestType, Reply: CounterResponseType }>(
  '/api/counter',
  {
    schema: {
      body: CounterRequest,
      response: {
        200: CounterResponse
      },
    },
  },
  (request, reply) => {
    try {
      const { value } = request.body;
      const result = counterOperations.setValue(value);
      reply.status(200).send(result);
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ value: -1 });
    }
  }
);

const start = async () => {
  try {
    // Serve static frontend files in production
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
      // Cache index.html content at startup to avoid blocking on every request
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

    await server.listen({ port: +PORT, host: HOST });
    console.log(`✅ Server started on http://${HOST}:${PORT}`);
    if (process.env.NODE_ENV === 'production') {
      const hostPort = process.env.HOST_PORT || '8080';
      console.log(`🌍 Access your app at http://localhost:${hostPort}`);
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Only start the server if this file is run directly
const isMainModule = fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  start();
}

// Export for testing
export { server, start };
