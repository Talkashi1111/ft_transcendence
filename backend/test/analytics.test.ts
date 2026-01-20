import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

let server: FastifyInstance;
let authCookie: string; // The token cookie value

describe('Analytics Routes', () => {
  // Setup before all tests
  beforeAll(async () => {
    server = await buildApp();

    // Create a user and login to get a token
    const testUser = {
      email: 'analytics-test@example.com',
      alias: 'analyticsUser',
      password: 'Password123!',
    };

    // 1. Register
    await server.inject({
      method: 'POST',
      url: '/api/users',
      payload: testUser,
    });

    // 2. Login
    const loginResponse = await server.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    // Extract cookie
    // fastify-cookie sets multiple cookies potentially, or just one
    // We need to look for the 'token' cookie or pass the whole set-cookie header
    const setCookie = loginResponse.headers['set-cookie'];
    if (Array.isArray(setCookie)) {
      authCookie = setCookie.join('; ');
    } else if (typeof setCookie === 'string') {
      authCookie = setCookie;
    }
  });

  // Clean up after all tests
  afterAll(async () => {
    if (server) await server.close();
  });

  describe('POST /api/analytics/page-view', () => {
    it('should return success: false when not authenticated', async () => {
      // No cookie provided
      const response = await server.inject({
        method: 'POST',
        url: '/api/analytics/page-view',
        payload: {
          page: 'home',
        },
      });

      expect(response.statusCode).toBe(200); // It catches error and returns 200 with success: false
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ success: false });
    });

    it('should return success: true when authenticated', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/analytics/page-view',
        headers: {
          cookie: authCookie,
        },
        payload: {
          page: 'home',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ success: true });
    });

    it('should increment metric for valid page', async () => {
      // This is functionally same as above, but explicitly targeting the "Increment Counter" logic path
      const response = await server.inject({
        method: 'POST',
        url: '/api/analytics/page-view',
        headers: {
          cookie: authCookie,
        },
        payload: {
          page: 'play',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({ success: true });
    });
  });
});
