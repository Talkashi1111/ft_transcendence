/**
 * OAuth Service
 *
 * Handles Google OAuth user profile fetching and user upsert logic.
 */

import { prisma } from '../../utils/prisma.js';

interface GoogleProfile {
  sub: string; // Google's unique user ID
  email: string;
  email_verified?: boolean; // Whether Google has verified this email
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Fetch Google user profile using access token
 */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google profile');
  }

  return response.json() as Promise<GoogleProfile>;
}

/**
 * Generate a unique alias from Google profile name
 * Converts "John Doe" to "john_doe" and appends random suffix if needed
 */
function generateAliasFromName(name?: string): string {
  if (!name) {
    return `user_${Math.random().toString(36).substring(2, 8)}`;
  }

  const baseAlias = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 20);

  // Add random suffix to ensure uniqueness
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${baseAlias}_${suffix}`;
}

/**
 * Upsert OAuth user
 *
 * Strategy:
 * 1. If user with googleId exists, return them
 * 2. If user with same email exists (password user), link googleId to them
 * 3. Otherwise, create new user with googleId (no password)
 */
export async function upsertOAuthUser(profile: GoogleProfile) {
  // Validate required fields
  if (!profile.sub || !profile.email) {
    throw new Error('Invalid Google profile: missing required fields');
  }

  // First, try to find by googleId
  const existingByGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.sub },
  });

  if (existingByGoogleId) {
    return existingByGoogleId;
  }

  // Try to find by email (for account linking)
  // SECURITY: Only link accounts if Google has verified the email
  // This prevents attackers from using unverified emails to hijack accounts
  const existingByEmail = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (existingByEmail) {
    if (profile.email_verified) {
      // Link Google account to existing user (email is verified by Google)
      return await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { googleId: profile.sub },
      });
    } else {
      // User exists but email is not verified - reject login to prevent account takeover
      throw new Error('Google email is not verified and cannot be linked to existing account');
    }
  }

  // Create new OAuth user
  const alias = generateAliasFromName(profile.name);

  // Handle potential alias collision with retry
  let finalAlias = alias;
  let attempts = 0;
  while (attempts < 5) {
    try {
      return await prisma.user.create({
        data: {
          email: profile.email,
          alias: finalAlias,
          googleId: profile.sub,
          password: null, // OAuth users don't have passwords
        },
      });
    } catch (error) {
      const prismaError = error as { code?: string; meta?: { target?: string[] } };
      if (prismaError.code === 'P2002') {
        if (prismaError.meta?.target?.includes('alias')) {
          // Alias collision, try with new random suffix
          finalAlias = generateAliasFromName(profile.name);
          attempts++;
        } else if (prismaError.meta?.target?.includes('email')) {
          // Email collision due to race condition - retry the whole upsert
          // This will now find the user in the initial checks
          return upsertOAuthUser(profile);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate unique alias after multiple attempts');
}
