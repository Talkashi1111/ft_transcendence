import { z } from 'zod';

// Match creation schema
export const createMatchSchema = z.object({
  mode: z.enum(['1v1', 'tournament']).default('1v1'),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;

// Match join schema
export const joinMatchSchema = z.object({
  matchId: z.string().uuid(),
});

export type JoinMatchInput = z.infer<typeof joinMatchSchema>;

// Local match result schema (for recording completed local games)
export const localMatchResultSchema = z.object({
  mode: z.enum(['LOCAL_1V1', 'VS_BOT']),
  player1Alias: z.string().min(1).max(20),
  player2Alias: z.string().min(1).max(20), // Guest name or "Bot (Lvl X)"
  score1: z.number().int().min(0),
  score2: z.number().int().min(0),
});

export type LocalMatchResultInput = z.infer<typeof localMatchResultSchema>;

// Player input schema (for REST polling alternative)
export const playerInputSchema = z.object({
  direction: z.enum(['up', 'down', 'none']),
});

export type PlayerInputData = z.infer<typeof playerInputSchema>;

// Match response schema (for documentation)
export const matchResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    mode: { type: 'string', enum: ['1v1', 'tournament'] },
    status: {
      type: 'string',
      enum: ['waiting', 'countdown', 'playing', 'paused', 'finished', 'cancelled'],
    },
    player1: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        username: { type: 'string' },
        connected: { type: 'boolean' },
      },
    },
    player2: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string' },
        username: { type: 'string' },
        connected: { type: 'boolean' },
      },
    },
    score1: { type: 'number' },
    score2: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
    startedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};
