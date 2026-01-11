import { register } from '../utils/auth';
import { t } from '../i18n/i18n';

export async function renderRegisterPage(
  app: HTMLElement,
  renderNavBar: (
    page: 'home' | 'play' | 'tournaments' | 'login' | 'register' | 'friends'
  ) => Promise<string>,
  setupNavigation: () => void,
  onRegisterSuccess: () => void
): Promise<void> {
  const navBar = await renderNavBar('register');
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${navBar}

      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="max-w-md mx-auto">
          <div class="bg-white rounded-lg shadow-lg p-8">
            <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">${t('register.title')}</h2>

            <form id="register-form" class="space-y-4" role="form" aria-label="Registration form">
              <!-- Alias field -->
              <div>
                <label for="alias" class="block text-sm font-medium text-gray-700 mb-1">
                  ${t('register.alias.label')}
                </label>
                <input
                  type="text"
                  id="alias"
                  name="alias"
                  placeholder="${t('register.alias.placeholder')}"
                  required
                  aria-required="true"
                  aria-label="Alias"
                  autocomplete="username"
                  minlength="3"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                <p class="text-xs text-gray-500 mt-1">${t('register.alias.text')}</p>
              </div>

              <!-- Email field -->
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                  ${t('register.email.label')}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="${t('register.email.placeholder')}"
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
                  ${t('register.password.label')}
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="${t('register.password.placeholder')}"
                  required
                  aria-required="true"
                  aria-label="Password"
                  autocomplete="new-password"
                  minlength="8"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                <p class="text-xs text-gray-500 mt-1">${t('register.password.text')}</p>
              </div>

              <!-- Error message -->
              <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-3" role="alert" aria-live="polite">
                <p class="text-red-700 text-sm"></p>
              </div>

              <!-- Success message -->
              <div id="success-message" class="hidden bg-green-50 border border-green-200 rounded-lg p-3" role="alert" aria-live="polite">
                <p class="text-green-700 text-sm"></p>
              </div>

              <!-- Submit button -->
              <button
                type="submit"
                id="register-btn"
                aria-label="Create your account"
                class="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                ${t('register.button.login')}
              </button>
            </form>

            <!-- Divider -->
            <div class="mt-6 flex items-center">
              <div class="flex-grow border-t border-gray-300"></div>
              <span class="px-3 text-sm text-gray-500">${t('register.divider.or')}</span>
              <div class="flex-grow border-t border-gray-300"></div>
            </div>

            <!-- Google OAuth button -->
            <a
              href="/api/oauth/google"
              id="google-register-btn"
              class="mt-4 w-full py-2 px-4 border border-gray-300 rounded-lg flex items-center justify-center gap-3 hover:bg-gray-50 transition font-medium text-gray-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              ${t('register.button.google')}
            </a>

            <!-- Link to login -->
            <div class="mt-6 text-center text-sm text-gray-600">
              ${t('register.text.account_holder')}
              <button id="login-link" class="text-blue-600 hover:text-blue-700 font-semibold">
                ${t('register.link.login')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupNavigation();
  setupRegisterForm(onRegisterSuccess);
}

function setupRegisterForm(onRegisterSuccess: () => void): void {
  const form = document.getElementById('register-form') as HTMLFormElement;
  const aliasInput = document.getElementById('alias') as HTMLInputElement;
  const emailInput = document.getElementById('email') as HTMLInputElement;
  const passwordInput = document.getElementById('password') as HTMLInputElement;
  const registerBtn = document.getElementById('register-btn') as HTMLButtonElement;
  const errorMessage = document.getElementById('error-message') as HTMLElement;
  const errorText = errorMessage.querySelector('p')!;
  const successMessage = document.getElementById('success-message') as HTMLElement;
  const successText = successMessage.querySelector('p')!;
  const loginLink = document.getElementById('login-link') as HTMLButtonElement;

  if (!form || !aliasInput || !emailInput || !passwordInput || !registerBtn) return;

  const showError = (message: string) => {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    successMessage.classList.add('hidden');
  };

  const showSuccess = (message: string) => {
    successText.textContent = message;
    successMessage.classList.remove('hidden');
    errorMessage.classList.add('hidden');
  };

  const hideMessages = () => {
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();

    const alias = aliasInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Client-side validation
    if (!alias || !email || !password) {
      showError('Please fill in all fields');
      return;
    }

    if (alias.length < 3) {
      showError('Alias must be at least 3 characters');
      return;
    }

    if (password.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating account...';

    try {
      await register(alias, email, password);
      // Show success message
      showSuccess('Account created successfully! Redirecting to login...');
      // Reset form
      form.reset();
      // Wait a moment before redirecting
      setTimeout(() => {
        onRegisterSuccess();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      showError(message);
      registerBtn.disabled = false;
      registerBtn.textContent = 'Register';
    }
  });

  // Navigate to login page
  loginLink.addEventListener('click', () => {
    // This will be handled by the navigation system in main.ts
    const event = new CustomEvent('navigate', { detail: { page: 'login' } });
    window.dispatchEvent(event);
  });
}
