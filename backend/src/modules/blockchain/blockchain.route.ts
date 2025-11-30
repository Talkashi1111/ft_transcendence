import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  TournamentMatchesResponseSchema,
  RecordMatchRequestSchema,
  RecordMatchResponseSchema,
  TotalMatchesResponseSchema,
} from './blockchain.schema.js';
import {
  getTournamentMatchesHandler,
  recordMatchHandler,
  getTotalMatchesHandler,
} from './blockchain.controller.js';

async function blockchainRoutes(server: FastifyInstance) {
  // Get all matches for a tournament
  server.get(
    '/tournaments/:tournamentId/matches',
    {
      schema: {
        tags: ['blockchain'],
        summary: 'Get all matches for a tournament',
        params: Type.Object({
          tournamentId: Type.String(),
        }),
        response: {
          200: TournamentMatchesResponseSchema,
        },
      },
    },
    getTournamentMatchesHandler
  );

  // Record a new match
  server.post(
    '/matches',
    {
      schema: {
        tags: ['blockchain'],
        summary: 'Record a new match on the blockchain',
        body: RecordMatchRequestSchema,
        response: {
          200: RecordMatchResponseSchema,
        },
      },
    },
    recordMatchHandler
  );

  // Get total number of matches
  server.get(
    '/matches/total',
    {
      schema: {
        tags: ['blockchain'],
        summary: 'Get total number of matches recorded',
        response: {
          200: TotalMatchesResponseSchema,
        },
      },
    },
    getTotalMatchesHandler
  );
}

export default blockchainRoutes;
