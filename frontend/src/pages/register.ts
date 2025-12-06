import { register } from '../utils/auth';

export async function renderRegisterPage(
  app: HTMLElement,
  renderNavBar: (page: 'home' | 'play' | 'tournaments' | 'login' | 'register') => Promise<string>,
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
            <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">Register</h2>

            <form id="register-form" class="space-y-4" role="form" aria-label="Registration form">
              <!-- Alias field -->
              <div>
                <label for="alias" class="block text-sm font-medium text-gray-700 mb-1">
                  Alias
                </label>
                <input
                  type="text"
                  id="alias"
                  name="alias"
                  placeholder="Choose your alias"
                  required
                  aria-required="true"
                  aria-label="Alias"
                  autocomplete="username"
                  minlength="3"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                <p class="text-xs text-gray-500 mt-1">Minimum 3 characters</p>
              </div>

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
                  placeholder="Create a password"
                  required
                  aria-required="true"
                  aria-label="Password"
                  autocomplete="new-password"
                  minlength="8"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                <p class="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
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
                Register
              </button>
            </form>

            <!-- Link to login -->
            <div class="mt-6 text-center text-sm text-gray-600">
              Already have an account?
              <button id="login-link" class="text-blue-600 hover:text-blue-700 font-semibold">
                Login here
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
