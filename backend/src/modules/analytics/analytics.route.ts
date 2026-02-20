import { FastifyInstance } from 'fastify';
import { Counter, register } from 'prom-client';

// 1. Define the Metric (Global variable)
const COUNTER_NAME = 'transcendence_page_views_total';

const pageViewCounter =
  (register.getSingleMetric(COUNTER_NAME) as Counter) ||
  new Counter({
    name: COUNTER_NAME,
    help: 'Total number of page views by authenticated users',
    labelNames: ['page'],
  });

const knownPages = ['home', 'play', 'tournaments', 'settings', 'friends', 'stats'];

// Initialize all known pages to 0 so they appear in Grafana immediately on startup,
// rather than showing "no data" until the first real page view occurs.
// Safe to run on every module load: Counter.inc(0) is a no-op on the value (counters
// only go up), and the getSingleMetric pattern above ensures we reuse the existing
// counter instance across hot-reloads / test re-runs instead of creating a new one.
knownPages.forEach((page) => {
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
            page: { type: 'string', enum: knownPages },
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
      // Only track views for known pages to keep Prometheus label cardinality bounded
      if (page && knownPages.includes(page)) {
        pageViewCounter.inc({ page: page });
      }

      return { success: true };
    }
  );
}
