import { login, verify2FA } from '../utils/auth';

export async function renderLoginPage(
  app: HTMLElement,
  renderNavBar: (page: 'home' | 'play' | 'tournaments' | 'login' | 'friends') => Promise<string>,
  setupNavigation: () => void,
  onLoginSuccess: () => void
): Promise<void> {
  const navBar = await renderNavBar('login');
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${navBar}

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="max-w-md mx-auto">
          <div class="bg-white rounded-lg shadow-lg p-8">
            <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">Login</h2>

            <form id="login-form" class="space-y-4" role="form" aria-label="Login form">
              <!-- Email field -->
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="your@email.com"
                  required
                  aria-required="true"
                  aria-label="Email address"
                  autocomplete="email"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>

              <!-- Password field -->
              <div>
                <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  required
                  aria-required="true"
                  aria-label="Password"
                  autocomplete="current-password"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>

              <!-- Error message -->
              <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-3" role="alert" aria-live="polite">
                <p class="text-red-700 text-sm"></p>
              </div>

              <!-- Submit button -->
              <button
                type="submit"
                id="login-btn"
                aria-label="Login to your account"
                class="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Login
              </button>
            </form>

            <!-- 2FA Verification Form (hidden initially) -->
            <div id="2fa-form" class="hidden space-y-4">
              <div class="text-center mb-4">
                <div class="text-4xl mb-2">🔐</div>
                <h3 class="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
                <p class="text-sm text-gray-600">Enter the 6-digit code from your authenticator app</p>
              </div>

              <div>
                <input
                  type="text"
                  id="2fa-code"
                  maxlength="6"
                  inputmode="numeric"
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div id="2fa-error" class="hidden bg-red-50 border border-red-200 rounded-lg p-3">
                <p class="text-red-700 text-sm"></p>
              </div>

              <button
                id="verify-2fa-btn"
                class="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Verify
              </button>

              <button
                id="back-to-login-btn"
                class="w-full text-gray-500 hover:text-gray-700 text-sm"
              >
                ← Back to login
              </button>
            </div>

            <!-- Divider -->
            <div class="mt-6 flex items-center">
              <div class="flex-grow border-t border-gray-300"></div>
              <span class="px-3 text-sm text-gray-500">or</span>
              <div class="flex-grow border-t border-gray-300"></div>
            </div>

            <!-- Google OAuth button -->
            <a
              href="/api/oauth/google"
              id="google-login-btn"
              class="mt-4 w-full py-2 px-4 border border-gray-300 rounded-lg flex items-center justify-center gap-3 hover:bg-gray-50 transition font-medium text-gray-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>

            <!-- Link to registration -->
            <div class="mt-6 text-center text-sm text-gray-600">
              Don't have an account?
              <button id="register-link" class="text-blue-600 hover:text-blue-700 font-semibold">
                Register here
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupNavigation();
  setupLoginForm(onLoginSuccess);
}

function setupLoginForm(onLoginSuccess: () => void): void {
  const form = document.getElementById('login-form') as HTMLFormElement;
  const emailInput = document.getElementById('email') as HTMLInputElement;
  const passwordInput = document.getElementById('password') as HTMLInputElement;
  const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
  const errorMessage = document.getElementById('error-message') as HTMLElement;
  const errorText = errorMessage.querySelector('p')!;
  const registerLink = document.getElementById('register-link') as HTMLButtonElement;

  // 2FA elements
  const twoFAForm = document.getElementById('2fa-form') as HTMLElement;
  const twoFACode = document.getElementById('2fa-code') as HTMLInputElement;
  const twoFAError = document.getElementById('2fa-error') as HTMLElement;
  const verifyBtn = document.getElementById('verify-2fa-btn') as HTMLButtonElement;
  const backBtn = document.getElementById('back-to-login-btn') as HTMLButtonElement;

  if (!form || !emailInput || !passwordInput || !loginBtn) return;

  const showError = (message: string) => {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
  };

  const hideError = () => {
    errorMessage.classList.add('hidden');
  };

  const show2FAError = (message: string) => {
    const errorP = twoFAError.querySelector('p');
    if (errorP) errorP.textContent = message;
    twoFAError.classList.remove('hidden');
  };

  const hide2FAError = () => {
    twoFAError.classList.add('hidden');
  };

  const showTwoFAForm = () => {
    form.classList.add('hidden');
    twoFAForm?.classList.remove('hidden');
    twoFACode?.focus();
  };

  const hideTwoFAForm = () => {
    form.classList.remove('hidden');
    twoFAForm?.classList.add('hidden');
    if (twoFACode) twoFACode.value = '';
    hide2FAError();
  };

  // Check URL parameters for 2FA
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('requires2FA') === 'true') {
    // tempToken is in HTTP-only cookie (sent automatically with verify request)
    showTwoFAForm();
    window.history.replaceState({}, '', '/login');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Please fill in all fields');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    try {
      const result = await login(email, password);

      // Check if 2FA is required
      if (result.requires2FA) {
        // tempToken is in HTTP-only cookie (set by backend)
        showTwoFAForm();
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
        return;
      }

      // Normal login success - reset form and redirect
      form.reset();
      onLoginSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      showError(message);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  });

  // 2FA verification handler
  if (verifyBtn && twoFACode) {
    verifyBtn.addEventListener('click', async () => {
      hide2FAError();
      const code = twoFACode.value.trim();

      if (!/^\d{6}$/.test(code)) {
        show2FAError('Please enter a valid 6-digit code');
        return;
      }

      // tempToken is in HTTP-only cookie (sent automatically)
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying...';

      try {
        await verify2FA(code);
        onLoginSuccess();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid code. Please try again.';
        show2FAError(message);
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify';
      }
    });

    // Filter non-numeric input in real-time
    twoFACode.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      input.value = input.value.replace(/[^\d]/g, '');
    });

    // Allow Enter key to submit
    twoFACode.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        verifyBtn.click();
      }
    });
  }

  // Back to login button
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      hideTwoFAForm();
    });
  }

  // Navigate to register page
  registerLink.addEventListener('click', () => {
    const event = new CustomEvent('navigate', { detail: { page: 'register' } });
    window.dispatchEvent(event);
  });
}
