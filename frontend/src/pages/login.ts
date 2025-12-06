import { login } from '../utils/auth';

export async function renderLoginPage(
  app: HTMLElement,
  renderNavBar: (page: 'home' | 'play' | 'tournaments' | 'login') => Promise<string>,
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

            <!-- Link to registration (placeholder) -->
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

  if (!form || !emailInput || !passwordInput || !loginBtn) return;

  const showError = (message: string) => {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
  };

  const hideError = () => {
    errorMessage.classList.add('hidden');
  };

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
      await login(email, password);
      // Reset form
      form.reset();
      // Call callback to redirect
      onLoginSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      showError(message);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  });

  // Placeholder for register link
  registerLink.addEventListener('click', () => {
    // TODO: Navigate to register page when it's implemented
    alert('Registration page coming soon!');
  });
}
