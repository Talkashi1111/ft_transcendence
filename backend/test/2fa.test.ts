import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

import { TOTP } from 'otpauth';

let server: FastifyInstance;

describe('2FA Module', () => {
  // Setup before all tests
  beforeAll(async () => {
    server = await buildApp();
  });

  // Clean up after all tests
  afterAll(async () => {
    await server.close();
  });

  const testUser = {
    email: '2fa-test@example.com',
    alias: '2fauser',
    password: 'password123',
  };

  let cookies: string;
  let totpSecret: string;

  // Helper to generate a valid TOTP code
  const generateToken = (secret: string) => {
    const totp = new TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });
    return totp.generate();
  };

  describe('Setup & Enable 2FA', () => {
    beforeAll(async () => {
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

      cookies = loginResponse.headers['set-cookie'] as string;
    });

    it('should setup 2FA and receive secret', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/2fa/setup',
        headers: { cookie: cookies },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('secret');
      expect(body).toHaveProperty('qrCodeDataUrl');

      totpSecret = body.secret;
    });

    it('should fail to enable 2FA with invalid code', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/2fa/enable',
        headers: { cookie: cookies },
        payload: { code: '000000' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should enable 2FA with valid code', async () => {
      const code = generateToken(totpSecret);
      const response = await server.inject({
        method: 'POST',
        url: '/api/2fa/enable',
        headers: { cookie: cookies },
        payload: { code },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });

    it('should fail to setup 2FA if already enabled', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/2fa/setup',
        headers: { cookie: cookies },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Login with 2FA', () => {
    let tempToken: string;

    it('should require 2FA during login', async () => {
      // Logout first
      await server.inject({
        method: 'POST',
        url: '/api/users/logout',
        headers: { cookie: cookies },
      });

      // Attempt login
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
      expect(body.success).toBe(false);
      expect(body.requires2FA).toBe(true);
      expect(body.tempToken).toBeDefined();

      tempToken = body.tempToken;
    });

    it('should verify 2FA code and issue token', async () => {
      const code = generateToken(totpSecret);
      const response = await server.inject({
        method: 'POST',
        url: '/api/2fa/verify',
        payload: {
          tempToken,
          code,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined();

      // Update cookies for next tests
      cookies = response.headers['set-cookie'] as string;
    });

    it('should fail verify with invalid code', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/2fa/verify',
        payload: {
          tempToken,
          code: '000000',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Disable 2FA', () => {
    it('should disable 2FA', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/2fa/disable',
        headers: { cookie: cookies },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });

    it('should fail to disable 2FA if not enabled', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/2fa/disable',
        headers: { cookie: cookies },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
