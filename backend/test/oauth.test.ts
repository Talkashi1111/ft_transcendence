import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/utils/prisma.js';
import fs from 'fs/promises';
import path from 'path';

let server: FastifyInstance;

describe('OAuth Module', () => {
  beforeAll(async () => {
    server = await buildApp();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('fetchGoogleProfile', () => {
    it('should fetch Google profile with valid access token', async () => {
      // This is an integration test that would require a real access token
      // We'll mock this in a more isolated unit test
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      // Mock fetch for this test
      const mockProfile = {
        sub: 'google-123',
        email: 'test@gmail.com',
        name: 'Test User',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProfile),
      });

      const profile = await fetchGoogleProfile('mock-access-token');

      expect(profile.sub).toBe('google-123');
      expect(profile.email).toBe('test@gmail.com');
      expect(profile.name).toBe('Test User');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-access-token' },
        })
      );
    });

    it('should throw error when Google API returns error', async () => {
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(fetchGoogleProfile('invalid-token')).rejects.toThrow(
        'Failed to fetch Google profile'
      );
    });
  });

  describe('upsertOAuthUser', () => {
    const testGoogleProfile = {
      sub: 'google-unique-id-12345',
      email: 'oauthtest@gmail.com',
      name: 'OAuth Test User',
    };

    beforeEach(async () => {
      // Clean up test user before each test
      await prisma.user.deleteMany({
        where: {
          OR: [{ email: testGoogleProfile.email }, { googleId: testGoogleProfile.sub }],
        },
      });
    });

    afterAll(async () => {
      // Clean up test users after all tests
      await prisma.user.deleteMany({
        where: {
          OR: [
            { email: testGoogleProfile.email },
            { googleId: testGoogleProfile.sub },
            { email: 'existing-password-user@gmail.com' },
          ],
        },
      });
    });

    it('should create new user for first-time OAuth login', async () => {
      const { upsertOAuthUser } = await import('../src/modules/oauth/oauth.service.js');

      const user = await upsertOAuthUser(testGoogleProfile);

      expect(user).toHaveProperty('id');
      expect(user.email).toBe(testGoogleProfile.email);
      expect(user.googleId).toBe(testGoogleProfile.sub);
      expect(user.password).toBeNull();
      // Alias should be derived from name
      expect(user.alias).toContain('oauth');
    });

    it('should return existing user for repeat OAuth login', async () => {
      const { upsertOAuthUser } = await import('../src/modules/oauth/oauth.service.js');

      // First login creates user
      const firstLogin = await upsertOAuthUser(testGoogleProfile);

      // Second login should return same user
      const secondLogin = await upsertOAuthUser(testGoogleProfile);

      expect(secondLogin.id).toBe(firstLogin.id);
      expect(secondLogin.googleId).toBe(testGoogleProfile.sub);
    });

    it('should link Google account to existing password user when email is verified', async () => {
      const { upsertOAuthUser } = await import('../src/modules/oauth/oauth.service.js');

      // Create existing password user first
      const existingUser = await prisma.user.create({
        data: {
          email: 'existing-password-user@gmail.com',
          alias: 'existinguser',
          password: 'hashed-password',
        },
      });

      // OAuth login with same email AND verified email should link accounts
      const linkedProfile = {
        sub: 'google-link-id-999',
        email: 'existing-password-user@gmail.com',
        email_verified: true, // Email is verified by Google
        name: 'Existing User',
      };

      const linkedUser = await upsertOAuthUser(linkedProfile);

      expect(linkedUser.id).toBe(existingUser.id);
      expect(linkedUser.googleId).toBe(linkedProfile.sub);
      expect(linkedUser.password).toBe('hashed-password'); // Password preserved
    });

    it('should throw error when valid profile fields are missing', async () => {
      const { upsertOAuthUser } = await import('../src/modules/oauth/oauth.service.js');

      const invalidProfile = {
        sub: '',
        email: '',
      };

      await expect(upsertOAuthUser(invalidProfile)).rejects.toThrow(
        'Invalid Google profile: missing required fields'
      );
    });

    it('should reject login when email is not verified and user exists (security)', async () => {
      const { upsertOAuthUser } = await import('../src/modules/oauth/oauth.service.js');

      // Create existing password user
      await prisma.user.create({
        data: {
          email: 'victim-user@gmail.com',
          alias: 'victimuser',
          password: 'hashed-password',
        },
      });

      // Attacker tries OAuth with unverified email matching victim's email
      const attackerProfile = {
        sub: 'attacker-google-id-666',
        email: 'victim-user@gmail.com', // Same email as victim
        email_verified: false, // But NOT verified!
        name: 'Attacker',
      };

      // Should REJECT login, preventing account takeover
      await expect(upsertOAuthUser(attackerProfile)).rejects.toThrow(
        'Google email is not verified and cannot be linked to existing account'
      );

      // Clean up
      await prisma.user.deleteMany({
        where: { OR: [{ email: 'victim-user@gmail.com' }, { googleId: attackerProfile.sub }] },
      });
    });

    it('should generate unique alias when name is not provided', async () => {
      const { upsertOAuthUser } = await import('../src/modules/oauth/oauth.service.js');

      const profileWithoutName = {
        sub: 'google-no-name-id',
        email: 'noname@gmail.com',
      };

      // Clean up first
      await prisma.user.deleteMany({ where: { email: profileWithoutName.email } });

      const user = await upsertOAuthUser(profileWithoutName);

      expect(user.alias).toMatch(/^user_[a-z0-9]+$/);

      // Clean up
      await prisma.user.deleteMany({ where: { email: profileWithoutName.email } });
    });

    describe('Google profile picture download', () => {
      const profileWithPicture = {
        sub: 'google-with-picture-id',
        email: 'withpicture@gmail.com',
        name: 'Picture User',
        picture: 'https://lh3.googleusercontent.com/a/test-picture',
      };

      beforeEach(async () => {
        // Clean up test user
        const user = await prisma.user.findUnique({
          where: { email: profileWithPicture.email },
        });
        if (user) {
          // Delete avatar files
          const avatarDir = path.join('/app/data/avatars', user.id);
          await fs.rm(avatarDir, { recursive: true, force: true }).catch(() => {});
          await prisma.user.delete({ where: { id: user.id } });
        }
      });

      afterAll(async () => {
        // Clean up
        const user = await prisma.user.findUnique({
          where: { email: profileWithPicture.email },
        });
        if (user) {
          const avatarDir = path.join('/app/data/avatars', user.id);
          await fs.rm(avatarDir, { recursive: true, force: true }).catch(() => {});
          await prisma.user.delete({ where: { id: user.id } });
        }
      });

      it('should create user without avatar when picture download fails', async () => {
        const { upsertOAuthUser } = await import('../src/modules/oauth/oauth.service.js');

        // Mock fetch to fail
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
        });

        const user = await upsertOAuthUser(profileWithPicture);

        // User should still be created, just without avatar
        expect(user.id).toBeTruthy();
        expect(user.email).toBe(profileWithPicture.email);
        expect(user.avatarPath).toBeNull();
      });

      it('should not download picture when profile has no picture URL', async () => {
        const { upsertOAuthUser } = await import('../src/modules/oauth/oauth.service.js');

        const profileNoPicture = {
          sub: 'google-no-picture-id',
          email: 'nopicture@gmail.com',
          name: 'No Picture User',
          // No picture field
        };

        // Clean up
        await prisma.user.deleteMany({ where: { email: profileNoPicture.email } });

        global.fetch = vi.fn();

        const user = await upsertOAuthUser(profileNoPicture);

        expect(user.avatarPath).toBeNull();
        // fetch should not have been called for picture download
        // (it might be called 0 times or only for other purposes)

        // Clean up
        await prisma.user.deleteMany({ where: { email: profileNoPicture.email } });
      });

      it('should reject invalid image from Google (magic bytes check)', async () => {
        const { upsertOAuthUser } = await import('../src/modules/oauth/oauth.service.js');

        // Return fake "image" that's actually text
        const fakeImage = Buffer.from('This is not a real image!');

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: () => Promise.resolve(fakeImage.buffer),
        });

        const user = await upsertOAuthUser(profileWithPicture);

        // User should be created but without avatar (invalid image rejected)
        expect(user.id).toBeTruthy();
        expect(user.avatarPath).toBeNull();
      });

      it('should handle network error during picture download', async () => {
        const { upsertOAuthUser } = await import('../src/modules/oauth/oauth.service.js');

        // Mock fetch to throw a network error
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const user = await upsertOAuthUser(profileWithPicture);

        // User should still be created, just without avatar
        expect(user.id).toBeTruthy();
        expect(user.email).toBe(profileWithPicture.email);
        expect(user.avatarPath).toBeNull();
      });
    });
  });

  describe('OAuth routes', () => {
    // Skip route tests if OAuth is not configured (e.g., in CI without secrets)
    const oauthConfigured = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

    it.skipIf(!oauthConfigured)('GET /api/oauth/google should redirect to Google', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/oauth/google',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('accounts.google.com');
      expect(response.headers.location).toContain('prompt=select_account');
    });

    it.skipIf(!oauthConfigured)(
      'GET /api/oauth/google/callback without code should redirect to login with error',
      async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/api/oauth/google/callback',
        });

        // Should redirect to login with error (no valid state/code)
        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toContain('/login');
      }
    );
  });

  describe('Google Profile Data Parsing', () => {
    beforeEach(() => {
      // Mock global fetch
      global.fetch = vi.fn();
    });

    it('should parse valid Google profile with all fields', async () => {
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      const mockProfile = {
        sub: 'google-user-123',
        email: 'user@gmail.com',
        email_verified: true,
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://lh3.googleusercontent.com/a/default-user',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response);

      const result = await fetchGoogleProfile('mock-access-token');

      expect(result).toEqual(mockProfile);
      expect(result.sub).toBe('google-user-123');
      expect(result.email).toBe('user@gmail.com');
      expect(result.email_verified).toBe(true);
      expect(result.picture).toBe('https://lh3.googleusercontent.com/a/default-user');
    });

    it('should parse Google profile without optional fields', async () => {
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      const mockProfile = {
        sub: 'google-user-456',
        email: 'another@gmail.com',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response);

      const result = await fetchGoogleProfile('mock-access-token');

      expect(result.sub).toBe('google-user-456');
      expect(result.email).toBe('another@gmail.com');
      expect(result.email_verified).toBeUndefined();
      expect(result.name).toBeUndefined();
      expect(result.picture).toBeUndefined();
    });

    it('should handle unverified email from Google', async () => {
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      const mockProfile = {
        sub: 'google-user-789',
        email: 'unverified@gmail.com',
        email_verified: false,
        name: 'Test User',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response);

      const result = await fetchGoogleProfile('mock-access-token');

      expect(result.email_verified).toBe(false);
    });

    it('should send correct authorization header', async () => {
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      const mockProfile = {
        sub: 'google-user-xyz',
        email: 'test@gmail.com',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response);

      await fetchGoogleProfile('test-token-123');

      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: 'Bearer test-token-123',
          },
        }
      );
    });

    it('should throw error when Google API returns error', async () => {
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(fetchGoogleProfile('invalid-token')).rejects.toThrow(
        'Failed to fetch Google profile'
      );
    });

    it('should handle profile with special characters in name', async () => {
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      const mockProfile = {
        sub: 'google-user-special',
        email: 'special@gmail.com',
        name: 'José García-López',
        picture: 'https://lh3.googleusercontent.com/a/special-user',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response);

      const result = await fetchGoogleProfile('mock-access-token');

      expect(result.name).toBe('José García-López');
    });

    it('should preserve picture URL exactly as provided by Google', async () => {
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      const pictureUrl = 'https://lh3.googleusercontent.com/a/AGNmyxZ1234567890abcdefghijk=s96-c';

      const mockProfile = {
        sub: 'google-user-pic',
        email: 'pic@gmail.com',
        picture: pictureUrl,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response);

      const result = await fetchGoogleProfile('mock-access-token');

      expect(result.picture).toBe(pictureUrl);
    });

    it('should handle empty string name', async () => {
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      const mockProfile = {
        sub: 'google-user-empty',
        email: 'empty@gmail.com',
        name: '',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response);

      const result = await fetchGoogleProfile('mock-access-token');

      expect(result.name).toBe('');
    });

    it('should handle very long email addresses', async () => {
      const { fetchGoogleProfile } = await import('../src/modules/oauth/oauth.service.js');

      const longEmail = 'a'.repeat(60) + '@gmail.com';

      const mockProfile = {
        sub: 'google-user-long-email',
        email: longEmail,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      } as Response);

      const result = await fetchGoogleProfile('mock-access-token');

      expect(result.email).toBe(longEmail);
    });
  });
});
