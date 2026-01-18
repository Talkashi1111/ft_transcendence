import { FastifyInstance } from 'fastify';
import {
  RecordTournamentRequestSchema,
  RecordTournamentResponseSchema,
  TournamentResponseSchema,
  TournamentCountResponseSchema,
  GetTournamentParamsSchema,
  ErrorResponseSchema,
  UserTournamentsResponseSchema,
  GlobalTournamentsResponseSchema,
} from './blockchain.schema.js';
import {
  recordTournamentHandler,
  getTournamentFromBlockchainHandler,
  getTournamentCountHandler,
  getUserTournamentsHandler,
  getGlobalTournamentsHandler,
} from './blockchain.controller.js';

async function blockchainRoutes(server: FastifyInstance) {
  // Record a completed local tournament (requires authentication)
  server.post(
    '/tournaments/local',
    {
      onRequest: [server.authenticate],
      schema: {
        tags: ['tournaments'],
        summary: 'Record a completed local tournament on the blockchain',
        description:
          'Records tournament results to database and blockchain. Requires authentication.',
        security: [{ bearerAuth: [] }],
        body: RecordTournamentRequestSchema,
        response: {
          201: RecordTournamentResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    recordTournamentHandler as never
  );

  // Get tournament from blockchain for verification (requires authentication)
  server.get(
    '/tournaments/blockchain/:blockchainId',
    {
      onRequest: [server.authenticate],
      schema: {
        tags: ['tournaments'],
        summary: 'Get tournament data from blockchain for verification',
        description: 'Fetches tournament data directly from the blockchain smart contract.',
        security: [{ bearerAuth: [] }],
        params: GetTournamentParamsSchema,
        response: {
          200: TournamentResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    getTournamentFromBlockchainHandler as never
  );

  // Get total tournament count from blockchain (requires authentication)
  server.get(
    '/tournaments/blockchain/count',
    {
      onRequest: [server.authenticate],
      schema: {
        tags: ['tournaments'],
        summary: 'Get total number of tournaments on blockchain',
        security: [{ bearerAuth: [] }],
        response: {
          200: TournamentCountResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    getTournamentCountHandler as never
  );

  // Get user's tournament history (requires authentication)
  server.get(
    '/tournaments/me',
    {
      onRequest: [server.authenticate],
      schema: {
        tags: ['tournaments'],
        summary: "Get current user's tournament history",
        description: 'Returns all tournaments organized by the authenticated user.',
        security: [{ bearerAuth: [] }],
        response: {
          200: UserTournamentsResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    getUserTournamentsHandler as never
  );

  // Get recent global tournaments (requires authentication)
  server.get(
    '/tournaments/recent',
    {
      onRequest: [server.authenticate],
      schema: {
        tags: ['tournaments'],
        summary: 'Get recent global tournament history',
        description: 'Returns recent tournaments from all users.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', pattern: '^[0-9]+$', default: '20' },
          },
        },
        response: {
          200: GlobalTournamentsResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    getGlobalTournamentsHandler as never
  );
}

export default blockchainRoutes;
