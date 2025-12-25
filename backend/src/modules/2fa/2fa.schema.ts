import * as z from 'zod';

// Request schemas
export const enable2FASchema = z.object({
  code: z
    .string({ message: 'Verification code is required' })
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

export const verify2FASchema = z.object({
  code: z
    .string({ message: 'Verification code is required' })
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

// Disable 2FA - no body required, JWT auth is sufficient proof of identity
export const disable2FASchema = z.object({});

// Response schemas
export const setup2FAResponseSchema = z.object({
  secret: z.string(),
  qrCodeDataUrl: z.string(),
});

export const success2FAResponseSchema = z.object({
  success: z.boolean(),
});

export const verify2FAResponseSchema = z.object({
  success: z.boolean(),
});

// TypeScript types
export type Enable2FAInput = z.infer<typeof enable2FASchema>;
export type Verify2FAInput = z.infer<typeof verify2FASchema>;
export type Disable2FAInput = z.infer<typeof disable2FASchema>;
export type Setup2FAResponse = z.infer<typeof setup2FAResponseSchema>;

// JSON Schema for Fastify (Swagger)
export const enable2FAJsonSchema = z.toJSONSchema(enable2FASchema, { target: 'draft-7' });
export const verify2FAJsonSchema = z.toJSONSchema(verify2FASchema, { target: 'draft-7' });
export const disable2FAJsonSchema = z.toJSONSchema(disable2FASchema, { target: 'draft-7' });
export const setup2FAResponseJsonSchema = z.toJSONSchema(setup2FAResponseSchema, {
  target: 'draft-7',
});
export const success2FAResponseJsonSchema = z.toJSONSchema(success2FAResponseSchema, {
  target: 'draft-7',
});
export const verify2FAResponseJsonSchema = z.toJSONSchema(verify2FAResponseSchema, {
  target: 'draft-7',
});
