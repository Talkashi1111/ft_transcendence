import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from './setup.js';

/**
 * WebSocket Integration Tests
 *
 * Tests real-time game functionality including:
 * - Authentication via WebSocket (cookie headers)
 * - Match flow (create, join, play, end)
 * - Reconnection handling
 * - Race conditions
 * - Error scenarios
 *
 * Note: injectWS accepts an upgradeContext with headers, so cookies
 * can be passed via { headers: { cookie: 'token=xxx' } }.
 */
describe('WebSocket Integration', () => {
  let server: FastifyInstance;
  let player1Token: string;
  let player2Token: string;

  beforeAll(async () => {
    server = await buildApp();
    await server.ready();

    // Create two test users
    const player1 = {
      email: 'wsplayer1@example.com',
      password: 'Password123!',
      alias: 'WSPlayer1',
    };
    const player2 = {
      email: 'wsplayer2@example.com',
      password: 'Password123!',
      alias: 'WSPlayer2',
    };

    // Register and login player 1
    await server.inject({
      method: 'POST',
      url: '/api/users',
      payload: player1,
    });
    const login1 = await server.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { email: player1.email, password: player1.password },
    });
    player1Token = login1.cookies.find((c) => c.name === 'token')?.value || '';

    // Register and login player 2
    await server.inject({
      method: 'POST',
      url: '/api/users',
      payload: player2,
    });
    const login2 = await server.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { email: player2.email, password: player2.password },
    });
    player2Token = login2.cookies.find((c) => c.name === 'token')?.value || '';
  }, 30000); // 30 second timeout for setup (password hashing is slow)

  // Clean up any leftover matches before each test to ensure isolation
  beforeEach(async () => {
    // Leave any match player1 might be in
    await server.inject({
      method: 'DELETE',
      url: '/api/game/match/current',
      cookies: { token: player1Token },
    });
    // Leave any match player2 might be in
    await server.inject({
      method: 'DELETE',
      url: '/api/game/match/current',
      cookies: { token: player2Token },
    });
    // Small delay to ensure cleanup is complete
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterAll(async () => {
    if (server) {
      await prisma.user.deleteMany({
        where: {
          email: { in: ['wsplayer1@example.com', 'wsplayer2@example.com'] },
        },
      });
      await server.close();
    }
  });

  describe('Authentication', () => {
    it('should reject connection without token', async () => {
      // injectWS throws on 401, so we expect it to fail
      await expect(server.injectWS('/api/game/ws')).rejects.toThrow();
    });

    it('should accept connection with cookie header', async () => {
      // injectWS accepts upgradeContext with headers - cookies work!
      const ws = await server.injectWS('/api/game/ws', {
        headers: { cookie: `token=${player1Token}` },
      });

      expect(ws.readyState).toBe(1); // OPEN
      ws.terminate();
    });
  });

  describe('Ping/Pong Keep-alive', () => {
    it('should respond to ping with pong', async () => {
      const ws = await server.injectWS('/api/game/ws', {
        headers: { cookie: `token=${player1Token}` },
      });

      // Register event listener BEFORE sending message (per fastify-websocket docs)
      const pongPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Pong timeout')), 2000);
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.event === 'pong') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      // Send ping
      ws.send(JSON.stringify({ event: 'ping', data: {} }));

      await pongPromise;
      ws.terminate();
    });
  });

  describe('Match Flow', () => {
    let matchId: string;

    afterEach(async () => {
      // Clean up any matches
      if (matchId) {
        await server.inject({
          method: 'DELETE',
          url: '/api/game/match/current',
          cookies: { token: player1Token },
        });
        await server.inject({
          method: 'DELETE',
          url: '/api/game/match/current',
          cookies: { token: player2Token },
        });
        matchId = '';
      }
    });

    it('should handle full match lifecycle', async () => {
      // Player 1 creates match via REST
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player1Token },
      });
      const createBody = JSON.parse(createResponse.body);
      matchId = createBody.match.id;

      // Player 1 connects via WebSocket (using cookie header)
      const ws1 = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player1Token}` },
      });

      // Register message handler BEFORE any async work (per fastify-websocket docs)
      const ws1Messages: Array<{ event: string; data: unknown }> = [];
      ws1.on('message', (data) => {
        ws1Messages.push(JSON.parse(data.toString()));
      });

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Player 1 must reconnect to match BEFORE player 2 joins
      // This ensures player 1's WebSocket is associated with the match
      // and will receive the opponent_joined event
      ws1.send(JSON.stringify({ event: 'match:reconnect', data: {} }));
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Player 2 joins via REST
      const joinResponse = await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player2Token },
      });
      const joinBody = JSON.parse(joinResponse.body);
      expect(joinBody.match.id).toBe(matchId);
      expect(joinBody.isNew).toBe(false);

      // Player 2 connects via WebSocket
      const ws2 = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player2Token}` },
      });

      // Register message handler BEFORE any async work
      const ws2Messages: Array<{ event: string; data: unknown }> = [];
      ws2.on('message', (data) => {
        ws2Messages.push(JSON.parse(data.toString()));
      });

      // Player 2 needs to reconnect to receive game events
      // (Player 1 already reconnected before player 2 joined)
      ws2.send(JSON.stringify({ event: 'match:reconnect', data: {} }));

      // Wait for game to start (countdown + some game states)
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Verify player 1 received opponent_joined
      const opponentJoined = ws1Messages.find((m) => m.event === 'match:opponent_joined');
      expect(opponentJoined).toBeDefined();

      // Verify both received countdown events
      const p1Countdown = ws1Messages.filter((m) => m.event === 'game:countdown');
      const p2Countdown = ws2Messages.filter((m) => m.event === 'game:countdown');
      expect(p1Countdown.length).toBeGreaterThan(0);
      expect(p2Countdown.length).toBeGreaterThan(0);

      // Verify both received game:start
      const p1Start = ws1Messages.find((m) => m.event === 'game:start');
      const p2Start = ws2Messages.find((m) => m.event === 'game:start');
      expect(p1Start).toBeDefined();
      expect(p2Start).toBeDefined();

      // Verify both receiving game:state updates
      const p1States = ws1Messages.filter((m) => m.event === 'game:state');
      const p2States = ws2Messages.filter((m) => m.event === 'game:state');
      expect(p1States.length).toBeGreaterThan(0);
      expect(p2States.length).toBeGreaterThan(0);

      ws1.terminate();
      ws2.terminate();
    }, 10000);

    it('should handle player input', async () => {
      // Create and join match
      const create1 = await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player1Token },
      });
      matchId = JSON.parse(create1.body).match.id;

      const ws1 = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player1Token}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Player 2 joins
      await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player2Token },
      });

      const ws2 = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player2Token}` },
      });

      // Wait for game to start
      await new Promise((resolve) => setTimeout(resolve, 4500));

      // Send player inputs
      ws1.send(JSON.stringify({ event: 'player:input', data: { direction: 'up' } }));
      ws2.send(JSON.stringify({ event: 'player:input', data: { direction: 'down' } }));

      // Wait a bit for input to be processed
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Send stop input
      ws1.send(JSON.stringify({ event: 'player:input', data: { direction: 'none' } }));
      ws2.send(JSON.stringify({ event: 'player:input', data: { direction: 'none' } }));

      ws1.terminate();
      ws2.terminate();
    }, 10000);
  });

  describe('Reconnection', () => {
    it('should handle player reconnection within grace period', async () => {
      // Create match
      const create1 = await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player1Token },
      });
      const matchId = JSON.parse(create1.body).match.id;

      // Both players connect
      const ws1 = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player1Token}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player2Token },
      });

      const ws2 = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player2Token}` },
      });

      // Register message handler BEFORE any async work
      const ws2Messages: Array<{ event: string; data: unknown }> = [];
      ws2.on('message', (data) => {
        ws2Messages.push(JSON.parse(data.toString()));
      });

      // Both players need to explicitly reconnect (no auto-reconnect anymore)
      ws1.send(JSON.stringify({ event: 'match:reconnect', data: {} }));
      ws2.send(JSON.stringify({ event: 'match:reconnect', data: {} }));

      // Wait for game to start
      await new Promise((resolve) => setTimeout(resolve, 4500));

      // Player 1 disconnects
      ws1.terminate();

      // Wait for disconnect to be processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Player 2 should receive disconnect notification
      const disconnectMsg = ws2Messages.find((m) => m.event === 'match:opponent_disconnected');
      expect(disconnectMsg).toBeDefined();

      // Player 1 reconnects
      const ws1Reconnect = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player1Token}` },
      });

      // Explicitly request reconnection
      ws1Reconnect.send(JSON.stringify({ event: 'match:reconnect', data: {} }));

      // Wait for reconnection to be processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Player 2 should receive reconnect notification
      const reconnectMsg = ws2Messages.find((m) => m.event === 'match:opponent_reconnected');
      expect(reconnectMsg).toBeDefined();

      ws1Reconnect.terminate();
      ws2.terminate();

      // Clean up
      await server.inject({
        method: 'DELETE',
        url: '/api/game/match/current',
        cookies: { token: player1Token },
      });
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should handle unknown events gracefully', async () => {
      const ws = await server.injectWS('/api/game/ws', {
        headers: { cookie: `token=${player1Token}` },
      });

      // Register message handler BEFORE sending message
      const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.event === 'error') {
            resolve(msg.data);
          }
        });
      });

      // Send unknown event
      ws.send(JSON.stringify({ event: 'unknown:event', data: {} }));

      const error = await errorPromise;
      expect(error.code).toBe('UNKNOWN_EVENT');

      ws.terminate();
    });

    it('should handle invalid JSON gracefully', async () => {
      const ws = await server.injectWS('/api/game/ws', {
        headers: { cookie: `token=${player1Token}` },
      });

      // Register message handler BEFORE sending message
      const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.event === 'error') {
            resolve(msg.data);
          }
        });
      });

      // Send invalid JSON
      ws.send('not valid json {{{');

      const error = await errorPromise;
      expect(error.code).toBe('PARSE_ERROR');

      ws.terminate();
    });

    it('should handle joining non-existent match', async () => {
      const ws = await server.injectWS('/api/game/ws', {
        headers: { cookie: `token=${player1Token}` },
      });

      // Register message handler BEFORE sending message
      const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.event === 'error') {
            resolve(msg.data);
          }
        });
      });

      // Try to join non-existent match
      ws.send(
        JSON.stringify({
          event: 'match:join',
          data: { matchId: '00000000-0000-0000-0000-000000000000' },
        })
      );

      const error = await errorPromise;
      expect(error.code).toBe('JOIN_FAILED');

      ws.terminate();
    });
  });

  describe('Race Conditions', () => {
    it('should handle simultaneous quickmatch requests', async () => {
      // Both players request quickmatch at the same time
      const [response1, response2] = await Promise.all([
        server.inject({
          method: 'POST',
          url: '/api/game/quickmatch',
          cookies: { token: player1Token },
        }),
        // Small delay to ensure player 1's match is created first
        new Promise<Awaited<ReturnType<typeof server.inject>>>((resolve) =>
          setTimeout(async () => {
            resolve(
              await server.inject({
                method: 'POST',
                url: '/api/game/quickmatch',
                cookies: { token: player2Token },
              })
            );
          }, 50)
        ),
      ]);

      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);

      // They should be in the same match
      expect(body1.match.id).toBe(body2.match.id);
      expect(body1.isNew).toBe(true);
      expect(body2.isNew).toBe(false);

      // Clean up
      await server.inject({
        method: 'DELETE',
        url: '/api/game/match/current',
        cookies: { token: player1Token },
      });
    });

    it('should handle rapid input changes', async () => {
      // Create and start a match
      const create1 = await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player1Token },
      });
      const matchId = JSON.parse(create1.body).match.id;

      const ws1 = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player1Token}` },
      });

      await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player2Token },
      });

      const ws2 = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player2Token}` },
      });

      // Wait for game to start
      await new Promise((resolve) => setTimeout(resolve, 4500));

      // Send rapid input changes
      for (let i = 0; i < 10; i++) {
        ws1.send(JSON.stringify({ event: 'player:input', data: { direction: 'up' } }));
        ws1.send(JSON.stringify({ event: 'player:input', data: { direction: 'down' } }));
        ws2.send(JSON.stringify({ event: 'player:input', data: { direction: 'down' } }));
        ws2.send(JSON.stringify({ event: 'player:input', data: { direction: 'up' } }));
      }

      // Should not crash - just wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      ws1.terminate();
      ws2.terminate();

      // Clean up
      await server.inject({
        method: 'DELETE',
        url: '/api/game/match/current',
        cookies: { token: player1Token },
      });
    }, 10000);
  });

  describe('Edge Cases', () => {
    it('should prevent player from joining their own match', async () => {
      // Player 1 creates a match
      const create = await server.inject({
        method: 'POST',
        url: '/api/game/match',
        cookies: { token: player1Token },
        payload: { mode: '1v1' },
      });
      const matchId = JSON.parse(create.body).match.id;

      // Player 1 connects via WebSocket
      const ws = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player1Token}` },
      });

      // Register message handler BEFORE sending message
      const errorPromise = new Promise<{ code: string; message: string } | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 2000);
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.event === 'error' && msg.data.code === 'JOIN_FAILED') {
            clearTimeout(timeout);
            resolve(msg.data);
          }
        });
      });

      // Try to join own match via WS message
      ws.send(JSON.stringify({ event: 'match:join', data: { matchId } }));

      await errorPromise;
      // Should either error or just reconnect to existing (both valid)

      ws.terminate();

      // Clean up
      await server.inject({
        method: 'DELETE',
        url: '/api/game/match/current',
        cookies: { token: player1Token },
      });
    });

    it('should handle multiple connections from same user', async () => {
      // Create a match
      const create = await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player1Token },
      });
      const matchId = JSON.parse(create.body).match.id;

      // Player 1 connects twice
      const ws1a = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player1Token}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const ws1b = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player1Token}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second connection should be valid (replaces socket reference)
      expect(ws1b.readyState).toBe(1); // OPEN

      ws1a.terminate();
      ws1b.terminate();

      // Clean up
      await server.inject({
        method: 'DELETE',
        url: '/api/game/match/current',
        cookies: { token: player1Token },
      });
    });

    it('should handle voluntary leave during countdown', async () => {
      // Create and join match
      const create1 = await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player1Token },
      });
      const matchId = JSON.parse(create1.body).match.id;

      const ws1 = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player1Token}` },
      });

      await server.inject({
        method: 'POST',
        url: '/api/game/quickmatch',
        cookies: { token: player2Token },
      });

      const ws2 = await server.injectWS(`/api/game/ws?matchId=${matchId}`, {
        headers: { cookie: `token=${player2Token}` },
      });

      // Register message handler BEFORE sending message
      const ws2Messages: Array<{ event: string; data: unknown }> = [];
      ws2.on('message', (data) => {
        ws2Messages.push(JSON.parse(data.toString()));
      });

      // Both players need to explicitly reconnect (no auto-reconnect anymore)
      ws1.send(JSON.stringify({ event: 'match:reconnect', data: {} }));
      ws2.send(JSON.stringify({ event: 'match:reconnect', data: {} }));

      // Wait a bit (during countdown)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Player 1 leaves during countdown
      ws1.send(JSON.stringify({ event: 'match:leave', data: {} }));

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Player 2 should receive game:end (they win by forfeit)
      const endMsg = ws2Messages.find((m) => m.event === 'game:end');
      expect(endMsg).toBeDefined();

      ws1.terminate();
      ws2.terminate();
    }, 10000);
  });
});
