import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

let server: FastifyInstance;

describe('API Server', () => {
  // Setup before all tests
  beforeAll(async () => {
    server = await buildApp();
  });

  // Clean up after all tests
  afterAll(async () => {
    await server.close();
  });

  describe('Health check', () => {
    it('should return ok status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/healthcheck',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ status: 'ok' });
    });
  });

  describe('User registration', () => {
    const testUser = {
      email: 'test@example.com',
      alias: 'testuser',
      password: 'password123',
    };

    it('should register a new user', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser,
      });

      // Could be 201 (created) or 409 (already exists from previous test run)
      expect([201, 409]).toContain(response.statusCode);

      if (response.statusCode === 201) {
        const body = JSON.parse(response.payload);
        expect(body).toHaveProperty('id');
        expect(body.email).toBe(testUser.email);
        expect(body.alias).toBe(testUser.alias);
        expect(body).toHaveProperty('createdAt');
        // Password should not be returned
        expect(body).not.toHaveProperty('password');
      }
    });

    it('should reject duplicate email', async () => {
      // First, ensure user exists
      await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser,
      });

      // Try to register with same email
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should validate email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: {
          email: 'not-an-email',
          alias: 'testuser2',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate password minimum length', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: {
          email: 'test2@example.com',
          alias: 'testuser2',
          password: 'short', // Less than 8 characters
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate alias minimum length', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: {
          email: 'test3@example.com',
          alias: 'ab', // Less than 3 characters
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require all fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: {
          email: 'test4@example.com',
          // Missing alias and password
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('User login', () => {
    const testUser = {
      email: 'logintest@example.com',
      alias: 'loginuser',
      password: 'password123',
    };

    beforeAll(async () => {
      // Register user for login tests
      await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser,
      });
    });

    it('should login with valid credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('success');
      expect(body.success).toBe(true);
      // Check that cookie was set
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: testUser.email,
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject non-existent email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject OAuth-only user attempting password login', async () => {
      // Import prisma to create an OAuth-only user directly
      const { prisma } = await import('../src/utils/prisma.js');

      const oauthEmail = 'oauth-only-user@example.com';

      // Clean up any existing user
      await prisma.user.deleteMany({ where: { email: oauthEmail } });

      // Create an OAuth-only user (password is null)
      await prisma.user.create({
        data: {
          email: oauthEmail,
          alias: 'oauthonlyuser',
          password: null, // OAuth-only user has no password
          googleId: 'google-oauth-id-12345',
        },
      });

      // Attempt to login with password credentials
      const response = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: oauthEmail,
          password: 'anypassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('This account uses Google login. Please sign in with Google.');

      // Clean up
      await prisma.user.deleteMany({ where: { email: oauthEmail } });
    });
  });

  describe('User logout', () => {
    it('should logout and clear cookie', async () => {
      const testUser = {
        email: 'logout@example.com',
        alias: 'logoutuser',
        password: 'password123',
      };

      // Register user
      await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser,
      });

      // Login to get cookie
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      const loginCookie = loginResponse.headers['set-cookie'];
      expect(loginCookie).toBeDefined();

      // Logout
      const logoutResponse = await server.inject({
        method: 'POST',
        url: '/api/users/logout',
        headers: {
          cookie: loginCookie,
        },
      });

      expect(logoutResponse.statusCode).toBe(200);
      const body = JSON.parse(logoutResponse.payload);
      expect(body).toHaveProperty('success');
      expect(body.success).toBe(true);

      // Check that cookie was cleared (Max-Age=0)
      const logoutCookie = logoutResponse.headers['set-cookie'];
      expect(logoutCookie).toBeDefined();
      expect(logoutCookie).toContain('Max-Age=0');
    });

    it('should logout even without valid cookie', async () => {
      // Logout without authentication should still work (idempotent)
      const response = await server.inject({
        method: 'POST',
        url: '/api/users/logout',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('success');
      expect(body.success).toBe(true);
    });
  });

  describe('Protected routes', () => {
    let cookies: string;

    beforeAll(async () => {
      const testUser = {
        email: 'protected@example.com',
        alias: 'protecteduser',
        password: 'password123',
      };

      // Register user
      await server.inject({
        method: 'POST',
        url: '/api/users',
        payload: testUser,
      });

      // Login to get cookie
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      // Extract cookie from response
      cookies = loginResponse.headers['set-cookie'] as string;
    });

    it('should get users list with valid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users',
        headers: {
          cookie: cookies,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(Array.isArray(body)).toBe(true);
    });

    it('should reject request without token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users',
        headers: {
          cookie: 'token=invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should get current user profile', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: {
          cookie: cookies,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('id');
      expect(body.email).toBe('protected@example.com');
      expect(body.alias).toBe('protecteduser');
    });
  });
});
