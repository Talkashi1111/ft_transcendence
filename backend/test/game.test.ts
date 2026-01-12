import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from './setup.js';

describe('Game Module', () => {
  let server: FastifyInstance;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    server = await buildApp();
    await server.ready();

    // Create a test user and get auth token
    const testUser = {
      email: 'gametest@example.com',
      password: 'Password123!',
      alias: 'GameTester',
    };

    // Register user
    await server.inject({
      method: 'POST',
      url: '/api/users',
      payload: testUser,
    });

    // Login to get token
    const loginResponse = await server.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    const cookies = loginResponse.cookies;
    const tokenCookie = cookies.find((c) => c.name === 'token');
    authToken = tokenCookie?.value || '';

    // Get user ID from the response or directly
    const profileResponse = await server.inject({
      method: 'GET',
      url: '/api/users/me',
      cookies: { token: authToken },
    });
    const profile = JSON.parse(profileResponse.body);
    userId = profile.id;
  });

  afterAll(async () => {
    // Clean up test user
    await prisma.user.deleteMany({ where: { email: 'gametest@example.com' } });
    await server.close();
  });

  describe('REST API', () => {
    describe('GET /api/game/matches', () => {
      it('should return empty list initially', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/api/game/matches',
          cookies: { token: authToken },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.matches).toEqual([]);
      });

      it('should require authentication', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/api/game/matches',
        });

        expect(response.statusCode).toBe(401);
      });
    });

    describe('POST /api/game/match', () => {
      it('should create a new match', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/api/game/match',
          cookies: { token: authToken },
          payload: { mode: '1v1' },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.match).toBeDefined();
        expect(body.match.id).toBeDefined();
        expect(body.match.status).toBe('waiting');
        expect(body.match.mode).toBe('1v1');
        expect(body.match.player1.id).toBe(userId);
        expect(body.websocketUrl).toBeDefined();

        // Clean up - leave the match
        await server.inject({
          method: 'DELETE',
          url: '/api/game/match/current',
          cookies: { token: authToken },
        });
      });

      it('should require authentication', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/api/game/match',
          payload: { mode: '1v1' },
        });

        expect(response.statusCode).toBe(401);
      });
    });

    describe('GET /api/game/current', () => {
      it('should return null when not in a match', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/api/game/current',
          cookies: { token: authToken },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.match).toBeNull();
      });

      it('should return current match when in one', async () => {
        // Create a match first
        const createResponse = await server.inject({
          method: 'POST',
          url: '/api/game/match',
          cookies: { token: authToken },
          payload: { mode: '1v1' },
        });
        const createBody = JSON.parse(createResponse.body);

        // Get current match
        const response = await server.inject({
          method: 'GET',
          url: '/api/game/current',
          cookies: { token: authToken },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.match).toBeDefined();
        expect(body.match.id).toBe(createBody.match.id);

        // Clean up
        await server.inject({
          method: 'DELETE',
          url: '/api/game/match/current',
          cookies: { token: authToken },
        });
      });
    });

    describe('GET /api/game/match/:id', () => {
      it('should return 404 for non-existent match', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/api/game/match/00000000-0000-0000-0000-000000000000',
          cookies: { token: authToken },
        });

        expect(response.statusCode).toBe(404);
      });

      it('should return match details', async () => {
        // Create a match
        const createResponse = await server.inject({
          method: 'POST',
          url: '/api/game/match',
          cookies: { token: authToken },
          payload: { mode: '1v1' },
        });
        const createBody = JSON.parse(createResponse.body);
        const matchId = createBody.match.id;

        // Get match details
        const response = await server.inject({
          method: 'GET',
          url: `/api/game/match/${matchId}`,
          cookies: { token: authToken },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.match.id).toBe(matchId);

        // Clean up
        await server.inject({
          method: 'DELETE',
          url: '/api/game/match/current',
          cookies: { token: authToken },
        });
      });
    });

    describe('DELETE /api/game/match/current', () => {
      it('should leave/cancel current match', async () => {
        // Create a match
        const createResponse = await server.inject({
          method: 'POST',
          url: '/api/game/match',
          cookies: { token: authToken },
          payload: { mode: '1v1' },
        });
        const createBody = JSON.parse(createResponse.body);
        const matchId = createBody.match.id;

        // Leave match
        const response = await server.inject({
          method: 'DELETE',
          url: '/api/game/match/current',
          cookies: { token: authToken },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);

        // Verify match is gone
        const getResponse = await server.inject({
          method: 'GET',
          url: `/api/game/match/${matchId}`,
          cookies: { token: authToken },
        });
        expect(getResponse.statusCode).toBe(404);
      });
    });

    describe('POST /api/game/quickmatch', () => {
      it('should create a new match when none available', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/api/game/quickmatch',
          cookies: { token: authToken },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.match).toBeDefined();
        expect(body.isNew).toBe(true);

        // Clean up
        await server.inject({
          method: 'DELETE',
          url: '/api/game/match/current',
          cookies: { token: authToken },
        });
      });
    });
  });
});
