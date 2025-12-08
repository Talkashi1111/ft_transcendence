/**
 * OAuth Routes
 *
 * Implements Google OAuth 2.0 authentication using @fastify/oauth2 plugin.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import oauthPlugin from '@fastify/oauth2';
import { fetchGoogleProfile, upsertOAuthUser } from './oauth.service.js';

// Validate required environment variables
function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUri = process.env.OAUTH_CALLBACK_URI;

  if (!clientId || !clientSecret || !callbackUri) {
    throw new Error(
      'Missing OAuth configuration. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and OAUTH_CALLBACK_URI in .env'
    );
  }

  return { clientId, clientSecret, callbackUri };
}

// Extend FastifyInstance to include googleOAuth2
declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2: {
      getAccessTokenFromAuthorizationCodeFlow: (
        request: FastifyRequest
      ) => Promise<{ token: { access_token: string } }>;
      generateAuthorizationUri: (
        request: FastifyRequest,
        reply: FastifyReply,
        callback: (err: Error | null, uri: string) => void
      ) => void;
    };
  }
}

async function oauthRoutes(server: FastifyInstance) {
  const config = getOAuthConfig();

  // Register Google OAuth2 plugin
  await server.register(oauthPlugin, {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
      client: {
        id: config.clientId,
        secret: config.clientSecret,
      },
    },
    callbackUri: config.callbackUri,
    discovery: {
      issuer: 'https://accounts.google.com',
    },
    cookie: {
      path: '/', // Ensure cookie is available for callback
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
    pkce: 'S256',
  });

  // Custom route to start OAuth with prompt=select_account
  server.get('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    // Generate authorization URI (passes reply for cookie setting)
    const authorizationUri = await new Promise<string>((resolve, reject) => {
      server.googleOAuth2.generateAuthorizationUri(
        request,
        reply,
        (err: Error | null, uri: string) => {
          if (err) reject(err);
          else resolve(uri);
        }
      );
    });

    // Add prompt parameter to force account selection
    const url = new URL(authorizationUri);
    url.searchParams.set('prompt', 'select_account');

    return reply.redirect(url.toString());
  });

  // Google OAuth callback handler
  server.get('/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Exchange authorization code for access token
      const { token } = await server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

      // Fetch Google user profile
      const profile = await fetchGoogleProfile(token.access_token);

      // Upsert user in database
      const user = await upsertOAuthUser(profile);

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
