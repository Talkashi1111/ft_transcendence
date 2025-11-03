import 'dotenv/config';
import fastify from 'fastify';
import { Static, Type } from '@sinclair/typebox';
import { counterOperations } from './db.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import * as blockchain from './blockchain.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_HOST || '0.0.0.0';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define your schemas
const User = Type.Object({
  name: Type.String(),
  mail: Type.Optional(Type.String({ format: 'email' })),
});

// Counter schemas
const CounterResponse = Type.Object({
  value: Type.Integer()
});

const CounterRequest = Type.Object({
  value: Type.Integer()
});

// Tournament/Match schemas
const Match = Type.Object({
  matchId: Type.String(),
  tournamentId: Type.String(),
  player1Id: Type.String(),
  player1Alias: Type.String(),
  player2Id: Type.String(),
  player2Alias: Type.String(),
  score1: Type.String(),
  score2: Type.String(),
  timestamp: Type.String(),
  recordedBy: Type.String(),
});

const TournamentMatchesResponse = Type.Object({
  tournamentId: Type.Number(),
  matchIds: Type.Array(Type.String()),
  matches: Type.Array(Match),
});

const RecordMatchRequest = Type.Object({
  tournamentId: Type.Integer(),
  player1Id: Type.Integer(),
  player1Alias: Type.String(),
  player2Id: Type.Integer(),
  player2Alias: Type.String(),
  score1: Type.Integer(),
  score2: Type.Integer(),
});

const RecordMatchResponse = Type.Object({
  success: Type.Boolean(),
  matchId: Type.String(),
  txHash: Type.String(),
});

// Create types from schemas
type UserType = Static<typeof User>;
type CounterResponseType = Static<typeof CounterResponse>;
type CounterRequestType = Static<typeof CounterRequest>;
type TournamentMatchesResponseType = Static<typeof TournamentMatchesResponse>;
type RecordMatchRequestType = Static<typeof RecordMatchRequest>;
type RecordMatchResponseType = Static<typeof RecordMatchResponse>;

// Create server instance
const server = fastify({
  logger: { level: 'info' }
});

// Add a new endpoint with schema validation
server.post<{ Body: UserType, Reply: UserType }>(
  '/users',
  {
    schema: {
      body: User,
      response: {
        200: User
      },
    },
  },
  (request, reply) => {
    // The `name` and `mail` types are automatically inferred
    const { name, mail } = request.body;
    reply.status(200).send({ name, mail });
  }
);

// Counter endpoints
server.get<{ Reply: CounterResponseType }>(
  '/api/counter',
  {
    schema: {
      response: {
        200: CounterResponse
      },
    },
  },
  (request, reply) => {
    try {
      const result = counterOperations.getValue();
      reply.status(200).send({ value: result?.value || 0 });
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ value: 0 });
    }
  }
);

server.put<{ Body: CounterRequestType, Reply: CounterResponseType }>(
  '/api/counter',
  {
    schema: {
      body: CounterRequest,
      response: {
        200: CounterResponse
      },
    },
  },
  (request, reply) => {
    try {
      const { value } = request.body;
      const result = counterOperations.setValue(value);
      reply.status(200).send(result);
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ value: -1 });
    }
  }
);

// Tournament/Blockchain endpoints

// Get all matches for a tournament
server.get<{ Params: { tournamentId: string }, Reply: TournamentMatchesResponseType }>(
  '/api/tournaments/:tournamentId/matches',
  {
    schema: {
      params: Type.Object({
        tournamentId: Type.String(),
      }),
      response: {
        200: TournamentMatchesResponse,
      },
    },
  },
  async (request, reply) => {
    try {
      const tournamentId = parseInt(request.params.tournamentId, 10);

      if (isNaN(tournamentId)) {
        return reply.code(400).send({ error: 'Invalid tournament ID' } as never);
      }

      // Get match IDs for the tournament
      const matchIds = await blockchain.getTournamentMatches(tournamentId);

      // Fetch details for each match
      const matches = await Promise.all(
        matchIds.map(async (matchId) => {
          const match = await blockchain.getMatch(Number(matchId));
          return {
            matchId: matchId.toString(),
            tournamentId: match.tournamentId.toString(),
            player1Id: match.player1Id.toString(),
            player1Alias: match.player1Alias,
            player2Id: match.player2Id.toString(),
            player2Alias: match.player2Alias,
            score1: match.score1.toString(),
            score2: match.score2.toString(),
            timestamp: match.timestamp.toString(),
            recordedBy: match.recordedBy,
          };
        })
      );

      reply.status(200).send({
        tournamentId,
        matchIds: matchIds.map(id => id.toString()),
        matches,
      });
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch tournament matches' } as never);
    }
  }
);

// Record a new match
server.post<{ Body: RecordMatchRequestType, Reply: RecordMatchResponseType }>(
  '/api/matches',
  {
    schema: {
      body: RecordMatchRequest,
      response: {
        200: RecordMatchResponse,
      },
    },
  },
  async (request, reply) => {
    try {
      const { tournamentId, player1Id, player1Alias, player2Id, player2Alias, score1, score2 } = request.body;

      const result = await blockchain.recordMatch(
        tournamentId,
        player1Id,
        player1Alias,
        player2Id,
        player2Alias,
        score1,
        score2
      );

      reply.status(200).send({
        success: true,
        matchId: result.matchId.toString(),
        txHash: result.txHash,
      });
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({
        success: false,
        matchId: '0',
        txHash: '',
      });
    }
  }
);

// Get total number of matches
server.get(
  '/api/matches/total',
  async (request, reply) => {
    try {
      const total = await blockchain.getTotalMatches();
      reply.status(200).send({ total: total.toString() });
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch total matches' });
    }
  }
);

const start = async () => {
  try {
    // Serve static frontend files in production
    if (process.env.NODE_ENV === 'production') {
      const frontendPath = path.join(__dirname, '../../frontend/dist');

      // Verify frontend build exists
      if (!fs.existsSync(frontendPath)) {
        throw new Error(`Frontend build not found at ${frontendPath}. Ensure the application is properly built.`);
      }

      // Register static file serving
      await server.register(fastifyStatic, {
        root: frontendPath,
        prefix: '/',
      });

      // Serve index.html for all non-API routes (SPA support)
      // Cache index.html content at startup to avoid blocking on every request
      const indexPath = path.join(frontendPath, 'index.html');

      if (!fs.existsSync(indexPath)) {
        throw new Error(`index.html not found at ${indexPath}. Verify the frontend build completed successfully by running 'pnpm run build'.`);
      }

      const indexHtml = fs.readFileSync(indexPath, 'utf-8');

      server.setNotFoundHandler(async (request, reply) => {
        if (!request.url.startsWith('/api/')) {
          return reply.type('text/html').send(indexHtml);
        } else {
          return reply.code(404).send({ error: 'Not found' });
        }
      });
    }

    await server.listen({ port: +PORT, host: HOST });
    console.log(`✅ Server started on http://${HOST}:${PORT}`);
    if (process.env.NODE_ENV === 'production') {
      const hostPort = process.env.HOST_PORT || '8080';
      console.log(`🌍 Access your app at http://localhost:${hostPort}`);
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Only start the server if this file is run directly
const isMainModule = fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  start();
}

// Export for testing
export { server, start };
