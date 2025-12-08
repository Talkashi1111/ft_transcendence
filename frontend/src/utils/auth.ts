/**
 * Authentication Utility
 *
 * PRODUCTION IMPLEMENTATION:
 * - Uses httpOnly cookies for secure token storage
 * - Cookies are automatically sent with requests (credentials: 'include')
 * - No client-side token access (prevents XSS attacks)
 * - Backend sets/clears cookies; frontend just makes API calls
 */

// Login response type (no token in body - it's in cookie)
interface LoginResponse {
  success: boolean;
}

// Current user info (fresh from API)
export interface AuthUser {
  id: string;
  email: string;
  alias: string; // Always current - fetched from database
  createdAt: string;
}

/**
 * Custom error class for login errors
 */
class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginError';
  }
}

/**
 * Custom error class for registration errors
 */
class RegisterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegisterError';
  }
}

/**
 * Register a new user
 *
 * Note: Registration does NOT authenticate the user automatically.
 * After successful registration, users must login separately to obtain authentication cookies.
 * This is intentional for security and allows for future email verification flows.
 */
export async function register(alias: string, email: string, password: string): Promise<void> {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ alias, email, password }),
    credentials: 'include',
  });

  if (!response.ok) {
    try {
      const errorData = await response.json();
      // Handle different error cases based on status code
      if (response.status === 409 || response.status === 400) {
        // Server message specifies the exact issue (duplicate field or validation error)
        throw new RegisterError(errorData.message || 'Please check your input and try again');
      } else {
        throw new RegisterError(errorData.message || 'Registration failed');
      }
    } catch (parseError) {
      // If it's our custom RegisterError, rethrow it
      if (parseError instanceof RegisterError) {
        throw parseError;
      }
      // Otherwise, it's a JSON parsing error (network issue)
      throw new Error('Network error. Please check your connection and try again.');
    }
  }

  // Registration successful - no return value needed
  // User must login separately to authenticate
}

/**
 * Login with email and password
 * Cookie is set by backend automatically (httpOnly)
 */
export async function login(email: string, password: string) {
  const response = await fetch('/api/users/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
    credentials: 'include', // Include cookies in request
  });

  if (!response.ok) {
    // Try to parse error response
    try {
      const errorData = await response.json();
      // Handle different error cases based on status code
      if (response.status === 401) {
        // Use server message (handles OAuth-only users), fallback to generic message
        throw new LoginError(errorData.message || 'Invalid email or password');
      } else if (response.status === 400) {
        throw new LoginError('Please check your email and password format');
      } else {
        throw new LoginError(errorData.message || 'Login failed');
      }
    } catch (parseError) {
      // If it's our custom LoginError, rethrow it
      if (parseError instanceof LoginError) {
        throw parseError;
      }
      // Otherwise, it's a JSON parsing error (network issue)
      throw new Error('Network error. Please check your connection and try again.');
    }
  }

  const data: LoginResponse = await response.json();
  return data.success;
}

/**
 * Logout - calls backend to clear cookie
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/users/logout', {
      method: 'POST',
      credentials: 'include', // Include cookies
    });
  } catch {
    // Ignore errors - cookie might already be expired
  }
}

/**
 * Check if user is authenticated
 * Since we can't read httpOnly cookies from JS, we attempt to fetch current user
 * This will return true only if the cookie exists and is valid
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Get current user info from API (fresh data from database)
 * Cookie is automatically sent with credentials: 'include'
 * @returns Fresh user info from database or null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch('/api/users/me', {
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      return null;
    }

    const user: AuthUser = await response.json();
    return user;
  } catch {
    return null;
  }
}

/**
 * Get user ID - requires API call since we can't read httpOnly cookie
 * For most cases, use getCurrentUser() instead to get full user info
 * @returns User ID or null
 */
export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}

/**
 * Helper for authenticated API requests
 * With httpOnly cookies, just need to include credentials
 */
export function getAuthHeaders(): RequestInit {
  return { credentials: 'include' };
}
