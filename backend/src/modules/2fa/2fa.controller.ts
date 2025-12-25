import type { FastifyRequest, FastifyReply } from 'fastify';
import * as z from 'zod';
import {
  generateTOTPSecret,
  verifyTOTPCode,
  enable2FA,
  disable2FA,
  getUserWith2FA,
} from './2fa.service.js';
import {
  enable2FASchema,
  verify2FASchema,
  type Enable2FAInput,
  type Verify2FAInput,
} from './2fa.schema.js';
import { prisma } from '../../utils/prisma.js';
import { decrypt } from '../../utils/crypto.js';
import { getTempTokenExpiry } from '../../utils/auth-helpers.js';

// Temporary storage for pending 2FA secrets (in production, use Redis or similar)
// Key: userId, Value: { secret, expiresAt }
const pending2FASecrets = new Map<string, { secret: string; expiresAt: number }>();

// Rate limiting for 2FA verification attempts to prevent brute force attacks
// Key: tempToken hash, Value: { attempts, expiresAt }
const verificationAttempts = new Map<string, { attempts: number; expiresAt: number }>();
const MAX_VERIFICATION_ATTEMPTS = 5; // Max attempts per temp token

/**
 * Generate TOTP secret and QR code for 2FA setup.
 * Requires authentication.
 */
export async function setup2FAHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id: userId, email } = request.user as { id: string; email: string };

    // Check if 2FA is already enabled
    const user = await getUserWith2FA(userId);
    if (user?.twoFactorEnabled) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '2FA is already enabled. Disable it first to reconfigure.',
      });
    }

    // Generate new TOTP secret
    const { secret, qrCodeDataUrl } = await generateTOTPSecret(userId, email);

    // Store pending secret temporarily (expires in 10 minutes)
    pending2FASecrets.set(userId, {
      secret,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    // Clean up old pending secrets periodically
    cleanupPendingSecrets();

    return reply.send({ secret, qrCodeDataUrl });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to generate 2FA secret',
    });
  }
}

/**
 * Enable 2FA after verifying the user can generate valid codes.
 * Requires authentication.
 */
export async function enable2FAHandler(
  request: FastifyRequest<{ Body: Enable2FAInput }>,
  reply: FastifyReply
) {
  try {
    const validatedData = enable2FASchema.parse(request.body);
    const { id: userId } = request.user as { id: string; email: string };

    // Get pending secret
    const pending = pending2FASecrets.get(userId);
    if (!pending || pending.expiresAt < Date.now()) {
      pending2FASecrets.delete(userId);
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '2FA setup expired. Please start the setup process again.',
      });
    }

    // Verify the code
    if (!verifyTOTPCode(pending.secret, validatedData.code)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid verification code. Please try again.',
      });
    }

    // Enable 2FA
    await enable2FA(userId, pending.secret);
    pending2FASecrets.delete(userId);

    return reply.send({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.issues[0].message,
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to enable 2FA',
    });
  }
}

/**
 * Disable 2FA for the current user.
 * Requires authentication (JWT is sufficient proof of identity).
 */
export async function disable2FAHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id: userId } = request.user as { id: string; email: string };

    // Get user to check 2FA status
    const user = await getUserWith2FA(userId);
    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'User not found',
      });
    }

    if (!user.twoFactorEnabled) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '2FA is not enabled',
      });
    }

    // Disable 2FA - JWT authentication is sufficient proof of identity
    await disable2FA(userId);

    return reply.send({ success: true });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to disable 2FA',
    });
  }
}

/**
 * Verify 2FA code during login.
 * Uses a temporary token instead of full authentication.
 */
export async function verify2FAHandler(
  request: FastifyRequest<{ Body: Verify2FAInput }>,
  reply: FastifyReply
) {
  try {
    const validatedData = verify2FASchema.parse(request.body);

    // Get tempToken from HTTP-only cookie (both regular login and OAuth)
    const tempToken = request.cookies['2fa-temp-token'];

    if (!tempToken) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No temporary token provided. Please login again.',
      });
    }

    // Verify the temp token
    let tempPayload: { id: string; email: string; type: string };
    try {
      tempPayload = request.server.jwt.verify(tempToken) as typeof tempPayload;
    } catch {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired temporary token. Please login again.',
      });
    }

    // Ensure it's a 2FA pending token
    if (tempPayload.type !== '2fa-pending') {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid token type',
      });
    }

    // Rate limiting: Check verification attempts for this temp token
    cleanupExpiredAttempts();
    const attemptKey = tempToken; // Use token itself as key (already unique per session)
    const attempt = verificationAttempts.get(attemptKey);

    if (attempt && attempt.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Too many verification attempts. Please login again.',
      });
    }

    // Get user and verify 2FA code
    const user = await prisma.user.findUnique({
      where: { id: tempPayload.id },
      select: { id: true, email: true, twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: '2FA is not configured for this account',
      });
    }

    // Decrypt and verify the code
    const secret = decrypt(user.twoFactorSecret);
    if (!verifyTOTPCode(secret, validatedData.code)) {
      // Increment failed attempt counter
      const currentAttempts = attempt ? attempt.attempts + 1 : 1;
      verificationAttempts.set(attemptKey, {
        attempts: currentAttempts,
        expiresAt: Date.now() + getTempTokenExpiry() * 1000, // Convert seconds to milliseconds
      });

      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid verification code',
      });
    }

    // Success - clear rate limiting for this token
    verificationAttempts.delete(attemptKey);

    // Generate full JWT token
    const accessToken = request.server.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: '24h' }
    );

    // Set httpOnly cookie
    reply.setCookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    // Clear the temporary 2FA token cookie (if it exists from OAuth flow)
    reply.clearCookie('2fa-temp-token', { path: '/' });

    return reply.send({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.issues[0].message,
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to verify 2FA code',
    });
  }
}

/**
 * Cleanup expired pending 2FA secrets.
 */
function cleanupPendingSecrets() {
  const now = Date.now();
  for (const [userId, data] of pending2FASecrets.entries()) {
    if (data.expiresAt < now) {
      pending2FASecrets.delete(userId);
    }
  }
}

/**
 * Cleanup expired verification attempts to prevent memory leaks.
 */
function cleanupExpiredAttempts() {
  const now = Date.now();
  for (const [key, data] of verificationAttempts.entries()) {
    if (data.expiresAt < now) {
      verificationAttempts.delete(key);
    }
  }
}
