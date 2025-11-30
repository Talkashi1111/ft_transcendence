import { Static, Type } from '@sinclair/typebox';

// Match schema
export const MatchSchema = Type.Object({
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

// Request schemas
export const RecordMatchRequestSchema = Type.Object({
  tournamentId: Type.Integer(),
  player1Id: Type.Integer(),
  player1Alias: Type.String(),
  player2Id: Type.Integer(),
  player2Alias: Type.String(),
  score1: Type.Integer(),
  score2: Type.Integer(),
});

// Response schemas
export const TournamentMatchesResponseSchema = Type.Object({
  tournamentId: Type.Number(),
  matchIds: Type.Array(Type.String()),
  matches: Type.Array(MatchSchema),
});

export const RecordMatchResponseSchema = Type.Object({
  success: Type.Boolean(),
  matchId: Type.String(),
  txHash: Type.String(),
});

export const TotalMatchesResponseSchema = Type.Object({
  total: Type.String(),
});

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
});

// TypeScript types
export type Match = Static<typeof MatchSchema>;
export type RecordMatchRequest = Static<typeof RecordMatchRequestSchema>;
export type TournamentMatchesResponse = Static<typeof TournamentMatchesResponseSchema>;
export type RecordMatchResponse = Static<typeof RecordMatchResponseSchema>;
export type TotalMatchesResponse = Static<typeof TotalMatchesResponseSchema>;
