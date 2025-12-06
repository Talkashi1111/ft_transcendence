import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  login,
  logout,
  isAuthenticated,
  getCurrentUser,
  getUserId,
  getAuthHeaders,
} from '../src/utils/auth';

describe('Auth Utility', () => {
  const mockUser = {
    id: '123',
    email: 'test@test.com',
    alias: 'testuser',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('should successfully login (cookie set by backend)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const success = await login('test@test.com', 'password123');

      expect(success).toBe(true);
      expect(fetch).toHaveBeenCalledWith('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
        credentials: 'include',
      });
    });

    it('should throw error on 401 (invalid credentials)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      await expect(login('test@test.com', 'wrong')).rejects.toThrow('Invalid email or password');
    });

    it('should throw error on 400 (validation error)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad Request' }),
      });

      await expect(login('invalid', 'pass')).rejects.toThrow(
        'Please check your email and password format'
      );
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Network error');
        },
      });

      await expect(login('test@test.com', 'password')).rejects.toThrow('Network error');
    });

    it('should handle generic errors with message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' }),
      });

      await expect(login('test@test.com', 'password')).rejects.toThrow('Internal server error');
    });

    it('should handle JSON parse failures as network error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      });

      await expect(login('test@test.com', 'password')).rejects.toThrow('Network error');
    });
  });

  describe('logout', () => {
    it('should call logout endpoint with credentials', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await logout();

      expect(fetch).toHaveBeenCalledWith('/api/users/logout', {
        method: 'POST',
        credentials: 'include',
      });
    });

    it('should not throw on logout errors (cookie might be expired)', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(logout()).resolves.not.toThrow();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user can be fetched (valid cookie)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockUser,
      });

      const result = await isAuthenticated();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('/api/users/me', {
        credentials: 'include',
      });
    });

    it('should return false when API returns 401 (no cookie or expired)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch and return current user info from API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockUser,
      });

      const user = await getCurrentUser();

      expect(user).toEqual(mockUser);
      expect(fetch).toHaveBeenCalledWith('/api/users/me', {
        credentials: 'include',
      });
    });

    it('should return null on 401 (no cookie)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it('should return null on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('getUserId', () => {
    it('should return user ID from API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockUser,
      });

      const userId = await getUserId();
      expect(userId).toBe('123');
    });

    it('should return null when not authenticated', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const userId = await getUserId();
      expect(userId).toBeNull();
    });
  });

  describe('getAuthHeaders', () => {
    it('should return credentials include option', () => {
      const headers = getAuthHeaders();
      expect(headers).toEqual({ credentials: 'include' });
    });
  });
});
