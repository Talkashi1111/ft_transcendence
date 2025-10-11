import fastify from 'fastify';
import { Static, Type } from '@sinclair/typebox';
import { counterOperations } from './db.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_HOST || '127.0.0.1';

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
    await server.listen({ port: +PORT, host: HOST });
    console.log('Server started successfully');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

// Export for testing
export { server, start };
