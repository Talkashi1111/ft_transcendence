/**
 * Authentication Helper Utilities
 *
 * Shared utilities for authentication flows to ensure consistent
 * token generation and security practices across all auth methods.
 */

import type { FastifyInstance } from 'fastify';

const TEMP_TOKEN_EXPIRY = 5 * 60; // 5 minutes in seconds

/**
 * Generate a temporary token for 2FA verification during login.
 * Used by regular login, OAuth, and other authentication flows.
 *
 * @param server - Fastify server instance with JWT plugin
 * @param userId - User's unique identifier
 * @param email - User's email address
 * @returns Signed JWT token valid for 5 minutes
 */
export function generateTempToken(server: FastifyInstance, userId: string, email: string): string {
  return server.jwt.sign(
    { id: userId, email, type: '2fa-pending' },
    { expiresIn: `${TEMP_TOKEN_EXPIRY}s` }
  );
}

/**
 * Get the expiry time for temporary 2FA tokens in seconds.
 */
export function getTempTokenExpiry(): number {
  return TEMP_TOKEN_EXPIRY;
}
