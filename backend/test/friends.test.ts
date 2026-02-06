import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from './setup.js';

describe('Friends Module', () => {
  let server: FastifyInstance;

  // User 1
  let user1Cookie: string;
  let user1Id: string;

  // User 2
  let user2Cookie: string;
  let user2Id: string;

  // User 3 (for additional scenarios)
  let user3Cookie: string;
  let user3Id: string;

  const user1 = {
    email: 'friend1@example.com',
    password: 'Password123!',
    alias: 'FriendUser1',
  };

  const user2 = {
    email: 'friend2@example.com',
    password: 'Password123!',
    alias: 'FriendUser2',
  };

  const user3 = {
    email: 'friend3@example.com',
    password: 'Password123!',
    alias: 'FriendUser3',
  };

  async function registerAndLogin(
    srv: FastifyInstance,
    userData: { email: string; password: string; alias: string }
  ): Promise<{ cookie: string; userId: string }> {
    await srv.inject({
      method: 'POST',
      url: '/api/users',
      payload: userData,
    });

    const loginResponse = await srv.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { email: userData.email, password: userData.password },
    });

    const cookies = loginResponse.cookies;
    const tokenCookie = cookies.find((c) => c.name === 'token');
    const cookie = tokenCookie?.value || '';

    const profileResponse = await srv.inject({
      method: 'GET',
      url: '/api/users/me',
      cookies: { token: cookie },
    });
    const profile = JSON.parse(profileResponse.body);

    return { cookie, userId: profile.id };
  }

  beforeAll(async () => {
    server = await buildApp();
    await server.ready();

    const result1 = await registerAndLogin(server, user1);
    user1Cookie = result1.cookie;
    user1Id = result1.userId;

    const result2 = await registerAndLogin(server, user2);
    user2Cookie = result2.cookie;
    user2Id = result2.userId;

    const result3 = await registerAndLogin(server, user3);
    user3Cookie = result3.cookie;
    user3Id = result3.userId;
  });

  afterAll(async () => {
    // Clean up friendships
    await prisma.notification.deleteMany({});
    await prisma.friendship.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: { in: [user1.email, user2.email, user3.email] },
      },
    });
    await server.close();
  });

  describe('GET /api/friends', () => {
    it('should return empty list initially', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/friends',
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.friends).toEqual([]);
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/friends',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/friends/requests', () => {
    it('should return empty requests initially', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/friends/requests',
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.received).toEqual([]);
      expect(body.sent).toEqual([]);
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/friends/requests',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/friends/request', () => {
    it('should send a friend request', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/friends/request',
        cookies: { token: user1Cookie },
        payload: { userId: user2Id },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Friend request sent');
      expect(body.friendshipId).toBeDefined();
    });

    it('should show pending request in sender sent list', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/friends/requests',
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sent.length).toBeGreaterThanOrEqual(1);
      const sentToUser2 = body.sent.find((r: { userId: string }) => r.userId === user2Id);
      expect(sentToUser2).toBeDefined();
      expect(sentToUser2.alias).toBe(user2.alias);
    });

    it('should show pending request in receiver received list', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/friends/requests',
        cookies: { token: user2Cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.received.length).toBeGreaterThanOrEqual(1);
      const fromUser1 = body.received.find((r: { userId: string }) => r.userId === user1Id);
      expect(fromUser1).toBeDefined();
      expect(fromUser1.alias).toBe(user1.alias);
    });

    it('should reject sending request to yourself', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/friends/request',
        cookies: { token: user1Cookie },
        payload: { userId: user1Id },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('yourself');
    });

    it('should reject duplicate friend request', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/friends/request',
        cookies: { token: user1Cookie },
        payload: { userId: user2Id },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('already');
    });

    it('should reject request to non-existent user', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/friends/request',
        cookies: { token: user1Cookie },
        payload: { userId: '00000000-0000-0000-0000-000000000000' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/friends/request',
        payload: { userId: user2Id },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/friends/:id/accept', () => {
    it('should accept a friend request', async () => {
      // Get the pending request ID from user2's perspective
      const requestsResponse = await server.inject({
        method: 'GET',
        url: '/api/friends/requests',
        cookies: { token: user2Cookie },
      });

      const requests = JSON.parse(requestsResponse.body);
      const friendRequest = requests.received.find((r: { userId: string }) => r.userId === user1Id);
      expect(friendRequest).toBeDefined();

      const response = await server.inject({
        method: 'POST',
        url: `/api/friends/${friendRequest.id}/accept`,
        cookies: { token: user2Cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Friend request accepted');
    });

    it('should show users as friends after acceptance', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/friends',
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.friends.length).toBeGreaterThanOrEqual(1);
      const friend = body.friends.find((f: { id: string }) => f.id === user2Id);
      expect(friend).toBeDefined();
      expect(friend.alias).toBe(user2.alias);
    });

    it('should reject accepting non-existent request', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/friends/00000000-0000-0000-0000-000000000000/accept',
        cookies: { token: user2Cookie },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });

    it('should reject if already friends (send again)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/friends/request',
        cookies: { token: user1Cookie },
        payload: { userId: user2Id },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('already friends');
    });
  });

  describe('POST /api/friends/:id/decline', () => {
    let friendshipId: string;

    beforeAll(async () => {
      // User3 sends a request to user1
      const response = await server.inject({
        method: 'POST',
        url: '/api/friends/request',
        cookies: { token: user3Cookie },
        payload: { userId: user1Id },
      });
      const body = JSON.parse(response.body);
      friendshipId = body.friendshipId;
    });

    it('should decline a friend request', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/friends/${friendshipId}/decline`,
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Friend request declined');
    });

    it('should reject declining non-existent request', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/friends/00000000-0000-0000-0000-000000000000/decline',
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });
  });

  describe('DELETE /api/friends/request/:id (cancel)', () => {
    let friendshipId: string;

    beforeAll(async () => {
      // User1 sends a request to user3
      const response = await server.inject({
        method: 'POST',
        url: '/api/friends/request',
        cookies: { token: user1Cookie },
        payload: { userId: user3Id },
      });
      const body = JSON.parse(response.body);
      friendshipId = body.friendshipId;
    });

    it('should cancel a sent friend request', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/friends/request/${friendshipId}`,
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Friend request cancelled');
    });

    it('should reject cancelling non-existent request', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/friends/request/00000000-0000-0000-0000-000000000000',
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });
  });

  describe('DELETE /api/friends/:id (remove friend)', () => {
    it('should remove a friend', async () => {
      // User1 and User2 are already friends from accept test
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/friends/${user2Id}`,
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Friend removed');
    });

    it('should no longer show as friends after removal', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/friends',
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const friend = body.friends.find((f: { id: string }) => f.id === user2Id);
      expect(friend).toBeUndefined();
    });

    it('should reject removing non-existent friendship', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/friends/00000000-0000-0000-0000-000000000000',
        cookies: { token: user1Cookie },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });
  });
});
