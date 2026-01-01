// Game REST API routes

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { matchManager } from './match-manager.js';
import { prisma } from '../../utils/prisma.js';
import {
  createMatchSchema,
  playerInputSchema,
  matchResponseSchema,
  type CreateMatchInput,
  type PlayerInputData,
} from './game.schema.js';
import type { PlayerInput } from './game.types.js';

// Extend request type for authenticated routes
interface AuthenticatedRequest extends FastifyRequest {
  user: { id: string; email: string };
}

export default async function gameRoutes(server: FastifyInstance): Promise<void> {
  // All routes require authentication
  server.addHook('onRequest', server.authenticate);

  /**
   * Create a new match
   * POST /api/game/match
   */
  server.post<{ Body: CreateMatchInput }>(
    '/match',
    {
      schema: {
        description: 'Create a new game match',
        tags: ['Game'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['1v1', 'tournament'], default: '1v1' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              match: matchResponseSchema,
              websocketUrl: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateMatchInput }>, reply: FastifyReply) => {
      const { id } = (request as AuthenticatedRequest).user;
      const body = createMatchSchema.parse(request.body || {});

      try {
        // Get user's alias from database (alias is always present)
        const user = await prisma.user.findUnique({ where: { id }, select: { alias: true } });
        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }

        // Create match (without WebSocket for REST endpoint)
        const match = matchManager.createMatch(id, user.alias, null as never, body.mode);

        const protocol = request.headers['x-forwarded-proto'] || 'ws';
        const host = request.headers.host;
        const wsProtocol = protocol === 'https' ? 'wss' : 'ws';

        return reply.status(201).send({
          match: matchManager.toMatchResponse(match),
          websocketUrl: `${wsProtocol}://${host}/api/game/ws`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create match';
        return reply.status(400).send({ error: message });
      }
    }
  );

  /**
   * Get available matches
   * GET /api/game/matches
   */
  server.get(
    '/matches',
    {
      schema: {
        description: 'List available matches to join',
        tags: ['Game'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['1v1', 'tournament'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              matches: {
                type: 'array',
                items: matchResponseSchema,
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { mode?: '1v1' | 'tournament' } }>,
      reply: FastifyReply
    ) => {
      const { mode } = request.query;
      const matches = matchManager.getAvailableMatches(mode);
      return reply.send({ matches });
    }
  );

  /**
   * Get match by ID
   * GET /api/game/match/:id
   */
  server.get<{ Params: { id: string } }>(
    '/match/:id',
    {
      schema: {
        description: 'Get match details by ID',
        tags: ['Game'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              match: matchResponseSchema,
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const match = matchManager.getMatch(id);

      if (!match) {
        return reply.status(404).send({ error: 'Match not found' });
      }

      return reply.send({ match: matchManager.toMatchResponse(match) });
    }
  );

  /**
   * Get current game state
   * GET /api/game/match/:id/state
   */
  server.get<{ Params: { id: string } }>(
    '/match/:id/state',
    {
      schema: {
        description: 'Get current game state (for CLI/polling)',
        tags: ['Game'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              state: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const match = matchManager.getMatch(id);

      if (!match) {
        return reply.status(404).send({ error: 'Match not found' });
      }

      if (!match.engine) {
        return reply.send({ state: null, status: match.status });
      }

      return reply.send({
        state: match.engine.getState(),
        status: match.status,
      });
    }
  );

  /**
   * Send player input (for CLI/polling alternative to WebSocket)
   * POST /api/game/match/:id/input
   */
  server.post<{ Params: { id: string }; Body: PlayerInputData }>(
    '/match/:id/input',
    {
      schema: {
        description: 'Send player input (polling alternative to WebSocket)',
        tags: ['Game'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['up', 'down', 'none'] },
          },
          required: ['direction'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              state: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { id: userId } = (request as AuthenticatedRequest).user;
      const body = playerInputSchema.parse(request.body);

      const match = matchManager.getMatch(id);

      if (!match) {
        return reply.status(404).send({ error: 'Match not found' });
      }

      // Verify player is in this match
      if (match.player1.id !== userId && match.player2?.id !== userId) {
        return reply.status(403).send({ error: 'Not a player in this match' });
      }

      matchManager.handlePlayerInput(userId, body.direction as PlayerInput);

      return reply.send({
        success: true,
        state: match.engine?.getState() ?? null,
      });
    }
  );

  /**
   * Join a match
   * POST /api/game/match/:id/join
   */
  server.post<{ Params: { id: string } }>(
    '/match/:id/join',
    {
      schema: {
        description: 'Join an existing match',
        tags: ['Game'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              match: matchResponseSchema,
              websocketUrl: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id: matchId } = request.params;
      const { id } = (request as AuthenticatedRequest).user;

      try {
        // Get user's alias from database (alias is always present)
        const user = await prisma.user.findUnique({ where: { id }, select: { alias: true } });
        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }

        const match = matchManager.joinMatch(matchId, id, user.alias, null as never);

        const protocol = request.headers['x-forwarded-proto'] || 'ws';
        const host = request.headers.host;
        const wsProtocol = protocol === 'https' ? 'wss' : 'ws';

        return reply.send({
          match: matchManager.toMatchResponse(match),
          websocketUrl: `${wsProtocol}://${host}/api/game/ws`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to join match';
        return reply.status(400).send({ error: message });
      }
    }
  );

  /**
   * Leave current match
   * DELETE /api/game/match/current
   */
  server.delete(
    '/match/current',
    {
      schema: {
        description: 'Leave/cancel your current match',
        tags: ['Game'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id: userId } = (request as AuthenticatedRequest).user;

      matchManager.leaveMatch(userId);

      return reply.send({ success: true });
    }
  );

  /**
   * Quick match (auto matchmaking)
   * POST /api/game/quickmatch
   */
  server.post(
    '/quickmatch',
    {
      schema: {
        description: 'Quick match - automatically find or create a match',
        tags: ['Game'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              match: matchResponseSchema,
              websocketUrl: { type: 'string' },
              isNew: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = (request as AuthenticatedRequest).user;

      // Get user's alias from database (alias is always present)
      const user = await prisma.user.findUnique({ where: { id }, select: { alias: true } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const protocol = request.headers['x-forwarded-proto'] || 'ws';
      const host = request.headers.host;
      const wsProtocol = protocol === 'https' ? 'wss' : 'ws';

      // Try to find an existing match
      const existingMatch = matchManager.findAvailableMatch('1v1', id);

      if (existingMatch) {
        const match = matchManager.joinMatch(existingMatch.id, id, user.alias, null as never);
        return reply.send({
          match: matchManager.toMatchResponse(match),
          websocketUrl: `${wsProtocol}://${host}/api/game/ws`,
          isNew: false,
        });
      }

      // Create new match
      const match = matchManager.createMatch(id, user.alias, null as never, '1v1');
      return reply.send({
        match: matchManager.toMatchResponse(match),
        websocketUrl: `${wsProtocol}://${host}/api/game/ws`,
        isNew: true,
      });
    }
  );

  /**
   * Get player's current match
   * GET /api/game/current
   */
  server.get(
    '/current',
    {
      schema: {
        description: "Get the player's current active match",
        tags: ['Game'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              match: { ...matchResponseSchema, nullable: true },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as AuthenticatedRequest).user;
      const match = matchManager.getPlayerMatch(userId);

      return reply.send({
        match: match ? matchManager.toMatchResponse(match) : null,
      });
    }
  );
}
