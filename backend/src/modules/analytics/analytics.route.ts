import { FastifyInstance } from 'fastify';
import { Counter } from 'prom-client';

// 1. Define the Metric (Global variable)
const pageViewCounter = new Counter({
  name: 'transcendence_page_views_total',
  help: 'Total number of page views by authenticated users',
  labelNames: ['page'], // We will label counts by page name (e.g., 'home', 'play')
});

// Initialize all known pages to 0 so they appear in Grafana immediately
const knownPages = ['home', 'play', 'tournaments', 'settings', 'friends'];
knownPages.forEach(page => {
  // .labels(...) creates the time series with value 0
  pageViewCounter.labels(page).inc(0);
});

export default async function analyticsRoutes(server: FastifyInstance) {
  // 2. Define the Endpoint
  server.post<{ Body: { page: string } }>(
    '/page-view',
    {
      schema: {
        description: 'Track a page view (authenticated users only)',
        tags: ['Analytics'],
        security: [{ bearerAuth: [] }], // Documentation only
        body: {
          type: 'object',
          properties: {
            page: { type: 'string' },
          },
          required: ['page'],
        },
        response: {
          200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
          },
        },
      },
    },
    async (request, reply) => {
      // 3. Security Check
      // We use your existing 'authenticate' decorator to ensure only logged-in users track data
      try {
        await request.jwtVerify();
      } catch {
        // If not authenticated, we just ignore the metric to avoid noise/spam
        return reply.send({ success: false });
      }

      const { page } = request.body;

      // 4. Increment the Counter
      if (page) {
        pageViewCounter.inc({ page: page });
      }

      return { success: true };
    }
  );
}