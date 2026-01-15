// backend/test/gdpr-delete.test.ts
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

// IMPORTANT: change this import to match your project path
import { buildApp } from '../src/app.js';

// Helper: parse Set-Cookie headers into a single Cookie header value
function cookieHeaderFromSetCookie(setCookie: string | string[] | undefined): string {
  if (!setCookie) return '';
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  // take only "name=value" part
  return arr.map((c) => c.split(';')[0]).join('; ');
}

describe('GDPR - /api/users/me/delete (backend)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // If you have a test DB reset helper, call it here.
    // Keeping it empty = minimal, but tests might conflict if DB persists.
  });

  it('rejects unauthenticated delete (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users/me/delete',
    });

    expect(res.statusCode).toBe(401);
  });

  it('allows authenticated user to delete themselves (200)', async () => {
    const email = `sid_${Date.now()}@example.com`;
    const alias = `sid_${Date.now()}`;
    const password = 'Aa1!aaaa'; // must match your schema rules

    // Register
    const reg = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { email, alias, password },
    });
    expect(reg.statusCode).toBe(201);

    // Login to get cookie token
    const login = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);

    const cookie = cookieHeaderFromSetCookie(login.headers['set-cookie']);
    expect(cookie).toContain('token=');

    // Delete account (authenticated)
    const del = await app.inject({
      method: 'POST',
      url: '/api/users/me/delete',
      headers: {
        cookie,
      },
    });

    expect(del.statusCode).toBe(200);
    const body = del.json();
    expect(body).toEqual({ success: true });
  });

  it('after delete, old token cannot access /me anymore (401)', async () => {
    const email = `sid_${Date.now()}@example.com`;
    const alias = `sid_${Date.now()}`;
    const password = 'Aa1!aaaa';

    // Register
    const reg = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { email, alias, password },
    });
    expect(reg.statusCode).toBe(201);

    // Login
    const login = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);

    const cookie = cookieHeaderFromSetCookie(login.headers['set-cookie']);
    expect(cookie).toContain('token=');

    // Delete
    const del = await app.inject({
      method: 'POST',
      url: '/api/users/me/delete',
      headers: { cookie },
    });
    expect(del.statusCode).toBe(200);

    // Try /me again with SAME cookie
    const me = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { cookie },
    });

    // This is your desired behavior for "immediate invalidation"
    expect(me.statusCode).toBe(401);
  });
});
