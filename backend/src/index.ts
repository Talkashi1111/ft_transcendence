import fastify from 'fastify';
import { Static, Type } from '@sinclair/typebox';

const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_HOST || '127.0.0.1';

// Define your schemas
const User = Type.Object({
  name: Type.String(),
  mail: Type.Optional(Type.String({ format: 'email' })),
});

// Create types from schemas
type UserType = Static<typeof User>;

// Create server instance
const server = fastify({
  logger: { level: 'info' }
});

// Keep your existing ping endpoint
server.get('/ping', async (request, reply) => {
  return 'pong 🏓\n';
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

const start = async () => {
  try {
    await server.listen({ port: +PORT, host: HOST });
    console.log('Server started successfully');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
