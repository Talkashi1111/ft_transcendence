"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const typebox_1 = require("@sinclair/typebox");
const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_HOST || '127.0.0.1';
// Define your schemas
const User = typebox_1.Type.Object({
    name: typebox_1.Type.String(),
    mail: typebox_1.Type.Optional(typebox_1.Type.String({ format: 'email' })),
});
// Create server instance
const server = (0, fastify_1.default)({
    logger: { level: 'info' }
});
// Keep your existing ping endpoint
server.get('/ping', async (request, reply) => {
    return 'pong 🏓\n';
});
// Add a new endpoint with schema validation
server.post('/users', {
    schema: {
        body: User,
        response: {
            200: User
        },
    },
}, (request, reply) => {
    // The `name` and `mail` types are automatically inferred
    const { name, mail } = request.body;
    reply.status(200).send({ name, mail });
});
const start = async () => {
    try {
        await server.listen({ port: +PORT, host: HOST });
        console.log('Server started successfully');
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
