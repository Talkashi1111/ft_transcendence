import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Server start function', () => {
  // Save original console.log and process.exit
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Mock console.log and console.error
    console.log = vi.fn();
    console.error = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore originals
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('should build and configure the app correctly', async () => {
    const app = await buildApp();

    // Verify app has the expected routes
    expect(app.hasRoute({ method: 'GET', url: '/healthcheck' })).toBe(true);
    expect(app.hasRoute({ method: 'POST', url: '/api/users' })).toBe(true);
    expect(app.hasRoute({ method: 'POST', url: '/api/users/login' })).toBe(true);
    expect(app.hasRoute({ method: 'GET', url: '/api/users' })).toBe(true);
    expect(app.hasRoute({ method: 'GET', url: '/api/users/me' })).toBe(true);

    // Verify blockchain routes are registered
    expect(app.hasRoute({ method: 'GET', url: '/api/tournaments/:tournamentId/matches' })).toBe(
      true
    );
    expect(app.hasRoute({ method: 'POST', url: '/api/matches' })).toBe(true);
    expect(app.hasRoute({ method: 'GET', url: '/api/matches/total' })).toBe(true);

    // Verify authenticate decorator is available
    expect(app.authenticate).toBeDefined();
    expect(typeof app.authenticate).toBe('function');

    await app.close();
  });

  it('should have swagger documentation endpoint', async () => {
    const app = await buildApp();

    // Request the docs endpoint
    const response = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(response.statusCode).toBe(200);
    const swagger = JSON.parse(response.payload);
    expect(swagger.openapi).toBe('3.0.0');
    expect(swagger.info.title).toBe('ft_transcendence API');

    await app.close();
  });
});
