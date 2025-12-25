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
    it('should require 2FA during login', async () => {
      // Logout first (use module-level cookies from previous test group)
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
      // tempToken is now in HTTP-only cookie
      expect(response.headers['set-cookie']).toBeDefined();
      const setCookieHeader = response.headers['set-cookie'] as string | string[];
      const cookieArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      expect(cookieArray.some((c) => c.startsWith('2fa-temp-token='))).toBe(true);

      // Store cookies for 2FA verification
      cookies = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
    });

    it('should verify 2FA code and issue token', async () => {
      const code = generateToken(totpSecret);
      const response = await server.inject({
        method: 'POST',
        url: '/api/2fa/verify',
        headers: { cookie: cookies }, // tempToken is in cookie now
        payload: {
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
        headers: { cookie: cookies }, // tempToken is in cookie
        payload: {
          code: '000000',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should rate limit after too many failed attempts', async () => {
      // First, logout and login again to get a fresh temp token
      await server.inject({
        method: 'POST',
        url: '/api/users/logout',
        headers: { cookie: cookies },
      });

      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      const freshCookies = loginResponse.headers['set-cookie'] as string;

      // Try 5 times with invalid code (should all fail)
      for (let i = 0; i < 5; i++) {
        const response = await server.inject({
          method: 'POST',
          url: '/api/2fa/verify',
          headers: { cookie: freshCookies },
          payload: {
            code: '000000',
          },
        });
        expect(response.statusCode).toBe(401);
      }

      // 6th attempt should be rate limited
      const rateLimitedResponse = await server.inject({
        method: 'POST',
        url: '/api/2fa/verify',
        headers: { cookie: freshCookies },
        payload: {
          code: '000000',
        },
      });

      expect(rateLimitedResponse.statusCode).toBe(429);
      const body = JSON.parse(rateLimitedResponse.payload);
      expect(body.message).toContain('Too many verification attempts');
    });

    it('should reject expired temp token', async () => {
      // Create an expired temp token (1 second expiry)
      const expiredToken = server.jwt.sign(
        { id: testUser.email, email: testUser.email, type: '2fa-pending' },
        { expiresIn: '1s' }
      );

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Try to use expired token
      const response = await server.inject({
        method: 'POST',
        url: '/api/2fa/verify',
        headers: { cookie: `2fa-temp-token=${expiredToken}` },
        payload: {
          code: generateToken(totpSecret),
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain('Invalid or expired temporary token');
    });

    it('should reject reused temp token after successful verification', async () => {
      // Logout and login to get fresh temp token
      await server.inject({
        method: 'POST',
        url: '/api/users/logout',
        headers: { cookie: cookies },
      });

      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/users/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      const tempCookies = loginResponse.headers['set-cookie'] as string;

      // First verification - should succeed
      const firstAttempt = await server.inject({
        method: 'POST',
        url: '/api/2fa/verify',
        headers: { cookie: tempCookies },
        payload: {
          code: generateToken(totpSecret),
        },
      });

      expect(firstAttempt.statusCode).toBe(200);

      // Extract the response cookies which should have the temp token cleared
      const responseCookies = firstAttempt.headers['set-cookie'] as string | string[];
      const cookieArray = Array.isArray(responseCookies) ? responseCookies : [responseCookies];

      // Verify temp token was cleared (should be in the set-cookie header with Max-Age=0 or Expires in past)
      const tempTokenCleared = cookieArray.some(
        (c) => c.includes('2fa-temp-token') && (c.includes('Max-Age=0') || c.includes('Expires='))
      );
      expect(tempTokenCleared).toBe(true);

      // Try to reuse the cleared cookie - should fail
      const reuseAttempt = await server.inject({
        method: 'POST',
        url: '/api/2fa/verify',
        headers: { cookie: cookieArray.join('; ') }, // Use response cookies which have cleared temp token
        payload: {
          code: generateToken(totpSecret),
        },
      });

      expect(reuseAttempt.statusCode).toBe(401);
      const body = JSON.parse(reuseAttempt.payload);
      expect(body.message).toContain('No temporary token provided');
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
