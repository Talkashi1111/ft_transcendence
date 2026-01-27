import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

// Lightweight integration checks for the Prometheus scrape endpoint.
describe('Metrics endpoint', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildApp();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should expose Prometheus metrics with correct content type', async () => {
    const res = await server.inject({ method: 'GET', url: '/metrics' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should include default process and nodejs metrics', async () => {
    const res = await server.inject({ method: 'GET', url: '/metrics' });
    const body = res.body;

    expect(body).toContain('process_cpu_user_seconds_total');
    expect(body).toContain('nodejs_version_info');
  });

  it('should expose custom transcendence metrics', async () => {
    const res = await server.inject({ method: 'GET', url: '/metrics' });
    const body = res.body;

    // Active remote matches gauge (initialized to 0)
    expect(body).toContain('transcendence_active_remote_matches_total');

    // Connected users gauge (collects on scrape)
    expect(body).toContain('transcendence_connected_users_total');

    // Page views counter (prefilled with known pages at 0)
    expect(body).toContain('transcendence_page_views_total{page="home"}');
  });

  it('should not register duplicate metrics across multiple app instances', async () => {
    let app1: FastifyInstance | null = null;
    let app2: FastifyInstance | null = null;

    try {
      app1 = await buildApp();
      await app1.ready();
      const res1 = await app1.inject({ method: 'GET', url: '/metrics' });
      expect(res1.statusCode).toBe(200);

      app2 = await buildApp();
      await app2.ready();
      const res2 = await app2.inject({ method: 'GET', url: '/metrics' });
      expect(res2.statusCode).toBe(200);
    } finally {
      if (app1) {
        await app1.close();
      }
      if (app2) {
        await app2.close();
      }
    }
  });
});
