import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import { buildApp, configureStaticServing } from './app.js';
import { cleanupOldNotifications } from './modules/notifications/notifications.service.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_HOST || '0.0.0.0';

const start = async () => {
  try {
    const server = await buildApp();
    await configureStaticServing(server);

    await server.listen({ port: +PORT, host: HOST });
    console.log(`✅ Server started on http://${HOST}:${PORT}`);

    // Cleanup old notifications on startup
    const cleanup = await cleanupOldNotifications();
    if (cleanup.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanup.deletedCount} old notifications`);
    }

    if (process.env.NODE_ENV === 'production') {
      const hostPort = process.env.HOST_PORT || '8080';
      console.log(`🌍 Access your app at http://localhost:${hostPort}`);
    }
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Only start the server if this file is run directly
const __filename = fileURLToPath(import.meta.url);
const isMainModule = __filename === path.resolve(process.argv[1]);
if (isMainModule) {
  start();
}

// Export for testing
export { buildApp, start };
