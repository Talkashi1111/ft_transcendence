import { TOTP } from 'otpauth';
import * as QRCode from 'qrcode';
import { prisma } from '../../utils/prisma.js';
import { encrypt, decrypt } from '../../utils/crypto.js';

const TOTP_ISSUER = 'ft_transcendence';

/**
 * Generates a new TOTP secret and QR code for 2FA setup.
 * The secret is NOT stored yet - it's returned to the user for verification.
 */
export async function generateTOTPSecret(
  userId: string,
  email: string
): Promise<{
  secret: string;
  qrCodeDataUrl: string;
}> {
  // Create a new TOTP instance
  const totp = new TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  // Get the secret in base32 format (what authenticator apps expect)
  const secret = totp.secret.base32;

  // Generate QR code as data URL
  const otpauthUri = totp.toString();
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

  return { secret, qrCodeDataUrl };
}

/**
 * Verifies a TOTP code against a secret.
 * Allows ±1 period (30 seconds) for clock drift.
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  const totp = new TOTP({
    issuer: TOTP_ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret,
  });

  // Validate with a window of 1 (allows ±30 seconds for clock drift)
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

/**
 * Enables 2FA for a user by storing the encrypted secret.
 */
export async function enable2FA(userId: string, secret: string): Promise<void> {
  const encryptedSecret = encrypt(secret);

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: encryptedSecret,
      twoFactorEnabled: true,
    },
  });
}

/**
 * Disables 2FA for a user.
 */
export async function disable2FA(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: null,
      twoFactorEnabled: false,
    },
  });
}

/**
 * Gets the decrypted 2FA secret for a user.
 * Returns null if 2FA is not enabled.
 */
export async function getUser2FASecret(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return null;
  }

  return decrypt(user.twoFactorSecret);
}

/**
 * Checks if a user has 2FA enabled.
 */
export async function isUser2FAEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true },
  });

  return user?.twoFactorEnabled ?? false;
}

/**
 * Gets user by ID with 2FA fields included.
 */
export async function getUserWith2FA(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      alias: true,
      password: true,
      twoFactorSecret: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });
}
