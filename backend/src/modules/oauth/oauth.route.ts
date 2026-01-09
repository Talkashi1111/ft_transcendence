/**
 * OAuth Routes
 *
 * Implements Google OAuth 2.0 authentication with dynamic callback URI support.
 * Supports both localhost (for local demos) and mooo.com (for remote access).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { fetchGoogleProfile, upsertOAuthUser } from './oauth.service.js';
import { generateTempToken, getTempTokenExpiry } from '../../utils/auth-helpers.js';

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Validate required environment variables - returns null if not configured
function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

// Build callback URI from request host (supports both localhost and mooo.com)
function buildCallbackUri(request: FastifyRequest): string {
  let host = request.headers.host || 'localhost';

  // Vite dev proxy changes host from localhost:5173 to localhost:3000
  // Restore the original frontend port for OAuth callback
  if (host === 'localhost:3000') {
    host = 'localhost:5173';
  }

  // Determine protocol:
  // - In production (behind Caddy): use x-forwarded-proto or default to https
  // - In development: use http for localhost with port (e.g., localhost:5173)
  const isDevMode = host.includes(':'); // Dev mode has port in host (localhost:5173)
  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? forwardedProto : isDevMode ? 'http' : 'https';

  const uri = `${protocol}://${host}/api/oauth/google/callback`;
  request.log.info({ host, forwardedProto, isDevMode, protocol, uri }, 'OAuth callback URI');
  return uri;
}

// Generate PKCE code verifier and challenge
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// Generate state parameter for CSRF protection
function generateState(): string {
  return crypto.randomBytes(16).toString('base64url');
}

async function oauthRoutes(server: FastifyInstance) {
  const config = getOAuthConfig();

  // Skip OAuth registration if not configured (e.g., in CI without secrets)
  if (!config) {
    server.log.warn('OAuth not configured - Google login will be unavailable');
    return;
  }

  // Start OAuth flow - dynamically builds callback URI from request host
  server.get('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const callbackUri = buildCallbackUri(request);
    const { verifier, challenge } = generatePKCE();
    const state = generateState();

    // Store PKCE verifier and state in cookies for callback verification
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 600, // 10 minutes
    };
    reply.setCookie('oauth_verifier', verifier, cookieOptions);
    reply.setCookie('oauth_state', state, cookieOptions);

    // Build Google authorization URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: callbackUri,
      response_type: 'code',
      scope: 'profile email',
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    return reply.redirect(authUrl);
  });

  // Google OAuth callback handler
  server.get('/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { code, state } = request.query as { code?: string; state?: string };
      const storedState = request.cookies.oauth_state;
      const verifier = request.cookies.oauth_verifier;

      // Verify state to prevent CSRF
      if (!state || !storedState || state !== storedState) {
        request.log.error('OAuth state mismatch');
        return reply.redirect('/login?error=oauth_failed');
      }

      if (!code || !verifier) {
        request.log.error('Missing code or verifier');
        return reply.redirect('/login?error=oauth_failed');
      }

      // Clear OAuth cookies
      reply.clearCookie('oauth_verifier', { path: '/' });
      reply.clearCookie('oauth_state', { path: '/' });

      // Build callback URI from current request (must match what was sent to Google)
      const callbackUri = buildCallbackUri(request);

      // Exchange authorization code for access token
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          code_verifier: verifier,
          grant_type: 'authorization_code',
          redirect_uri: callbackUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        request.log.error({ error }, 'Token exchange failed');
        return reply.redirect('/login?error=oauth_failed');
      }

      const tokenData = (await tokenResponse.json()) as { access_token: string };

      // Fetch Google user profile
      const profile = await fetchGoogleProfile(tokenData.access_token);

      // Upsert user in database
      const user = await upsertOAuthUser(profile);

      // Check if 2FA is enabled
      if (user.twoFactorEnabled) {
        // Generate temp token for 2FA verification
        const tempToken = generateTempToken(server, user.id, user.email);

        // Store tempToken in HTTP-only cookie instead of URL (security best practice)
        reply.setCookie('2fa-temp-token', tempToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: getTempTokenExpiry(), // 5 minutes (matches JWT expiration)
        });

        return reply.redirect('/login?requires2FA=true');
      }

      // Generate JWT token (same as regular login)
      const accessToken = server.jwt.sign(
        {
          id: user.id,
          email: user.email,
        },
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

      // Redirect to home page after successful login
      return reply.redirect('/');
    } catch (error) {
      request.log.error(error, 'OAuth callback failed');
      return reply.redirect('/login?error=oauth_failed');
    }
  });
}

export default oauthRoutes;
