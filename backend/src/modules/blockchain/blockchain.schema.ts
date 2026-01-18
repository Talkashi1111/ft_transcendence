import { Static, Type } from '@sinclair/typebox';

// ============================================
// Match Schema (for request/response)
// ============================================

export const MatchInputSchema = Type.Object({
  player1: Type.String({ minLength: 1, maxLength: 50 }),
  player2: Type.String({ minLength: 1, maxLength: 50 }),
  score1: Type.Integer({ minimum: 0, maximum: 255 }),
  score2: Type.Integer({ minimum: 0, maximum: 255 }),
  round: Type.Integer({ minimum: 1, maximum: 255 }),
});

export const MatchOutputSchema = Type.Object({
  player1: Type.String(),
  player2: Type.String(),
  score1: Type.Number(),
  score2: Type.Number(),
  round: Type.Number(),
});

// ============================================
// Request Schemas
// ============================================

// POST /api/tournaments/local - Record a completed tournament
export const RecordTournamentRequestSchema = Type.Object({
  players: Type.Array(Type.String({ minLength: 1, maxLength: 50 }), { minItems: 2, maxItems: 8 }),
  matches: Type.Array(MatchInputSchema, { minItems: 1 }),
});

// GET /api/tournaments/blockchain/:blockchainId - Verify tournament on blockchain
export const GetTournamentParamsSchema = Type.Object({
  blockchainId: Type.String({ pattern: '^[0-9]+$' }),
});

// ============================================
// Response Schemas
// ============================================

export const RecordTournamentResponseSchema = Type.Object({
  success: Type.Boolean(),
  tournamentId: Type.String(), // DB UUID
  blockchainId: Type.String(), // Contract's tournament ID
  txHash: Type.String(),
  snowtraceUrl: Type.String(),
});

export const TournamentResponseSchema = Type.Object({
  blockchainId: Type.String(),
  odUserId: Type.String(),
  organizer: Type.String(),
  players: Type.Array(Type.String()),
  winner: Type.String(),
  timestamp: Type.String(),
  recordedBy: Type.String(),
  matches: Type.Array(MatchOutputSchema),
});

export const TournamentCountResponseSchema = Type.Object({
  count: Type.String(),
});

// GET /api/tournaments/me - List user's tournaments
export const UserTournamentSchema = Type.Object({
  id: Type.String(),
  blockchainId: Type.Union([Type.Number(), Type.Null()]),
  organizerAlias: Type.String(),
  playerCount: Type.Number(),
  winner: Type.String(),
  txHash: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  recordedAt: Type.Union([Type.String(), Type.Null()]),
  matches: Type.Array(
    Type.Object({
      player1Alias: Type.String(),
      player2Alias: Type.String(),
      score1: Type.Number(),
      score2: Type.Number(),
      round: Type.Number(),
    })
  ),
});

export const UserTournamentsResponseSchema = Type.Object({
  tournaments: Type.Array(UserTournamentSchema),
  total: Type.Number(),
});

// GET /api/tournaments/recent - List recent global tournaments
export const GlobalTournamentsResponseSchema = Type.Object({
  tournaments: Type.Array(UserTournamentSchema),
  total: Type.Number(),
});

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
});

// ============================================
// TypeScript Types
// ============================================

export type MatchInput = Static<typeof MatchInputSchema>;
export type MatchOutput = Static<typeof MatchOutputSchema>;
export type RecordTournamentRequest = Static<typeof RecordTournamentRequestSchema>;
export type RecordTournamentResponse = Static<typeof RecordTournamentResponseSchema>;
export type TournamentResponse = Static<typeof TournamentResponseSchema>;
export type TournamentCountResponse = Static<typeof TournamentCountResponseSchema>;
export type UserTournament = Static<typeof UserTournamentSchema>;
export type UserTournamentsResponse = Static<typeof UserTournamentsResponseSchema>;
export type GlobalTournamentsResponse = Static<typeof GlobalTournamentsResponseSchema>;
