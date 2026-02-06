import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from './setup.js';

describe('User Profile & Settings', () => {
  let server: FastifyInstance;
  let authCookie: string;
  let userId: string;

  const testUser = {
    email: 'profile-test@example.com',
    password: 'Password123!',
    alias: 'ProfileUser',
  };

  // Second user for search tests
  const searchUser = {
    email: 'searchable@example.com',
    password: 'Password123!',
    alias: 'SearchTarget',
  };

  beforeAll(async () => {
    server = await buildApp();
    await server.ready();

    // Register & login main test user
    await server.inject({
      method: 'POST',
      url: '/api/users',
      payload: testUser,
    });

    const loginResponse = await server.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { email: testUser.email, password: testUser.password },
    });

    const cookies = loginResponse.cookies;
    const tokenCookie = cookies.find((c) => c.name === 'token');
    authCookie = tokenCookie?.value || '';

    const profileResponse = await server.inject({
      method: 'GET',
      url: '/api/users/me',
      cookies: { token: authCookie },
    });
    const profile = JSON.parse(profileResponse.body);
    userId = profile.id;

    // Register second user for search
    await server.inject({
      method: 'POST',
      url: '/api/users',
      payload: searchUser,
    });
  });

  afterAll(async () => {
    await prisma.matchHistory.deleteMany({
      where: {
        OR: [{ player1Id: userId }, { player2Id: userId }],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testUser.email, searchUser.email] } },
    });
    await server.close();
  });

  describe('PATCH /api/users/me/alias', () => {
    it('should update alias successfully', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/alias',
        cookies: { token: authCookie },
        payload: { alias: 'UpdatedAlias' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.alias).toBe('UpdatedAlias');
      expect(body.id).toBe(userId);
      expect(body.email).toBe(testUser.email);
    });

    it('should reject alias shorter than 3 characters', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/alias',
        cookies: { token: authCookie },
        payload: { alias: 'ab' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject alias with invalid characters', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/alias',
        cookies: { token: authCookie },
        payload: { alias: 'bad alias!' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject alias that is already taken', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/alias',
        cookies: { token: authCookie },
        payload: { alias: searchUser.alias },
      });

      expect(response.statusCode).toBe(409);
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/alias',
        payload: { alias: 'NewAlias' },
      });

      expect(response.statusCode).toBe(401);
    });

    // Restore original alias
    it('should restore original alias', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/alias',
        cookies: { token: authCookie },
        payload: { alias: testUser.alias },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.alias).toBe(testUser.alias);
    });
  });

  describe('PATCH /api/users/me/language', () => {
    it('should update preferred language to German', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/language',
        cookies: { token: authCookie },
        payload: { preferredLanguage: 'de' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.preferredLanguage).toBe('de');
    });

    it('should update preferred language to French', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/language',
        cookies: { token: authCookie },
        payload: { preferredLanguage: 'fr' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.preferredLanguage).toBe('fr');
    });

    it('should update preferred language to Japanese', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/language',
        cookies: { token: authCookie },
        payload: { preferredLanguage: 'ja' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.preferredLanguage).toBe('ja');
    });

    it('should update preferred language to English', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/language',
        cookies: { token: authCookie },
        payload: { preferredLanguage: 'en' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.preferredLanguage).toBe('en');
    });

    it('should reject invalid language', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/language',
        cookies: { token: authCookie },
        payload: { preferredLanguage: 'xx' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/users/me/language',
        payload: { preferredLanguage: 'en' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/users/search', () => {
    it('should find users by alias', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/search?q=SearchTarget',
        cookies: { token: authCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.users.length).toBeGreaterThanOrEqual(1);
      const found = body.users.find((u: { alias: string }) => u.alias === searchUser.alias);
      expect(found).toBeDefined();
    });

    it('should return empty for short query (less than 2 chars)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/search?q=S',
        cookies: { token: authCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.users).toEqual([]);
    });

    it('should not include current user in results', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/users/search?q=${testUser.alias}`,
        cookies: { token: authCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const self = body.users.find((u: { id: string }) => u.id === userId);
      expect(self).toBeUndefined();
    });

    it('should return empty for non-matching query', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/search?q=ZZZZZZNONEXISTENT',
        cookies: { token: authCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.users).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/search?q=Se&limit=1',
        cookies: { token: authCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.users.length).toBeLessThanOrEqual(1);
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/search?q=test',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/users/me/stats', () => {
    it('should return user statistics', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/me/stats',
        cookies: { token: authCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('totalGames');
      expect(body).toHaveProperty('totalWins');
      expect(body).toHaveProperty('totalLosses');
      expect(body).toHaveProperty('winRate');
      expect(body).toHaveProperty('byMode');
      expect(body.byMode).toHaveProperty('tournament');
      expect(body.byMode).toHaveProperty('local1v1');
      expect(body.byMode).toHaveProperty('vsBot');
      expect(body.byMode).toHaveProperty('remote1v1');
      expect(body).toHaveProperty('tournamentsOrganized');
      expect(body).toHaveProperty('tournamentWins');
      expect(body).toHaveProperty('recentMatches');
      expect(Array.isArray(body.recentMatches)).toBe(true);
      expect(typeof body.winRate).toBe('number');
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/me/stats',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
