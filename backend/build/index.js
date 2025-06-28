"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_HOST || '127.0.0.1';
const server = (0, fastify_1.default)({
    logger: { level: 'info' } // Use Fastify's built-in logger configuration
});
server.get('/ping', async (request, reply) => {
    return 'pong 🏓\n';
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
