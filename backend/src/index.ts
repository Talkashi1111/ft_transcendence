import fastify from 'fastify';

const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_HOST || '127.0.0.1';

const server = fastify({
  logger: { level: 'info' }  // Use Fastify's built-in logger configuration
});

server.get('/ping', async (request, reply) => {
  return 'pong 🏓\n';
});

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
