import * as z from 'zod';

// Core user schema (shared fields)
const userCore = {
  email: z.email({ message: 'Invalid email format' }),
  alias: z
    .string({ message: 'Alias is required and must be a string' })
    .min(3, 'Alias must be at least 3 characters')
    .max(30, 'Alias must be at most 30 characters'),
};

// Request schemas
export const createUserSchema = z.object({
  ...userCore,
  password: z
    .string({ message: 'Password is required and must be a string' })
    .min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.email({ message: 'Invalid email format' }),
  password: z.string({ message: 'Password is required' }),
});

// Response schemas
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  alias: z.string(),
  createdAt: z.string(),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
});

export const usersResponseSchema = z.array(userResponseSchema);

// TypeScript types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;

// JSON Schema for Fastify (Swagger) - using Zod 4's native toJSONSchema with draft-7 for Fastify/Ajv compatibility
export const createUserJsonSchema = z.toJSONSchema(createUserSchema, { target: 'draft-7' });
export const loginJsonSchema = z.toJSONSchema(loginSchema, { target: 'draft-7' });
export const userResponseJsonSchema = z.toJSONSchema(userResponseSchema, { target: 'draft-7' });
export const loginResponseJsonSchema = z.toJSONSchema(loginResponseSchema, { target: 'draft-7' });
export const usersResponseJsonSchema = z.toJSONSchema(usersResponseSchema, { target: 'draft-7' });
