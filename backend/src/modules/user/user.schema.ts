import * as z from 'zod';

// Core user schema (shared fields)
const userCore = {
  email: z.email({ message: 'Invalid email format' }),
  alias: z
    .string({ message: 'Alias is required and must be a string' })
    .min(3, 'Alias must be at least 3 characters')
    .max(30, 'Alias must be at most 30 characters')
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Alias can only contain letters, numbers, underscores, dots, and hyphens'
    ),
};

// Request schemas
export const createUserSchema = z.object({
  ...userCore,
  password: z
    .string({ message: 'Password is required and must be a string' })
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
});

export const loginSchema = z.object({
  email: z.email({ message: 'Invalid email format' }),
  password: z.string({ message: 'Password is required' }),
});

export const updateAliasSchema = z.object({
  alias: z
    .string({ message: 'Alias is required and must be a string' })
    .min(3, 'Alias must be at least 3 characters')
    .max(30, 'Alias must be at most 30 characters')
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Alias can only contain letters, numbers, underscores, dots, and hyphens'
    ),
});

// Response schemas
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  alias: z.string(),
  createdAt: z.string(),
});

// Response schema for /me endpoint that includes 2FA status
export const userMeResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  alias: z.string(),
  twoFactorEnabled: z.boolean(),
  createdAt: z.string(),
});

export const loginResponseSchema = z.object({
  success: z.boolean(),
  requires2FA: z.boolean().optional(),
  // Note: tempToken is sent via HTTP-only cookie (not in response body)
});

// Stats schemas
export const gameModeStatsSchema = z.object({
  played: z.number(),
  wins: z.number(),
  losses: z.number(),
});

export const userStatsSchema = z.object({
  totalGames: z.number(),
  totalWins: z.number(),
  totalLosses: z.number(),
  winRate: z.number(), // Percentage (0-100)
  byMode: z.object({
    tournament: gameModeStatsSchema,
    local1v1: gameModeStatsSchema,
    vsBot: gameModeStatsSchema,
    remote1v1: gameModeStatsSchema,
  }),
  tournamentsOrganized: z.number(),
  tournamentWins: z.number(),
  recentMatches: z.array(
    z.object({
      id: z.string(),
      mode: z.string(),
      player1Alias: z.string(),
      player2Alias: z.string(),
      score1: z.number(),
      score2: z.number(),
      won: z.boolean(),
      playedAt: z.string(),
    })
  ),
});

export const usersResponseSchema = z.array(userResponseSchema);

// TypeScript types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateAliasInput = z.infer<typeof updateAliasSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type UserStats = z.infer<typeof userStatsSchema>;

// JSON Schema for Fastify (Swagger) - using Zod 4's native toJSONSchema with draft-7 for Fastify/Ajv compatibility
export const createUserJsonSchema = z.toJSONSchema(createUserSchema, { target: 'draft-7' });
export const loginJsonSchema = z.toJSONSchema(loginSchema, { target: 'draft-7' });
export const updateAliasJsonSchema = z.toJSONSchema(updateAliasSchema, { target: 'draft-7' });
export const userResponseJsonSchema = z.toJSONSchema(userResponseSchema, { target: 'draft-7' });
export const userMeResponseJsonSchema = z.toJSONSchema(userMeResponseSchema, { target: 'draft-7' });
export const loginResponseJsonSchema = z.toJSONSchema(loginResponseSchema, { target: 'draft-7' });
export const usersResponseJsonSchema = z.toJSONSchema(usersResponseSchema, { target: 'draft-7' });
export const userStatsJsonSchema = z.toJSONSchema(userStatsSchema, { target: 'draft-7' });
