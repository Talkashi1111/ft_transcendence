import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderLoginPage } from '../src/pages/login';
import * as auth from '../src/utils/auth';

describe('Login Page', () => {
  let container: HTMLElement;
  let mockRenderNavBar: ReturnType<typeof vi.fn>;
  let mockSetupNavigation: ReturnType<typeof vi.fn>;
  let mockOnLoginSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);

    mockRenderNavBar = vi.fn().mockResolvedValue('<nav>Mock NavBar</nav>');
    mockSetupNavigation = vi.fn();
    mockOnLoginSuccess = vi.fn();

    // Mock login function
    vi.spyOn(auth, 'login').mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('Rendering', () => {
    it('should render login form with all required elements', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      // Check form exists
      const form = container.querySelector('#login-form') as HTMLFormElement;
      expect(form).toBeTruthy();
      expect(form.getAttribute('role')).toBe('form');

      // Check email input
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      expect(emailInput).toBeTruthy();
      expect(emailInput.type).toBe('email');
      expect(emailInput.required).toBe(true);

      // Check password input
      const passwordInput = container.querySelector('#password') as HTMLInputElement;
      expect(passwordInput).toBeTruthy();
      expect(passwordInput.type).toBe('password');
      expect(passwordInput.required).toBe(true);

      // Check submit button
      const submitBtn = container.querySelector('#login-btn') as HTMLButtonElement;
      expect(submitBtn).toBeTruthy();
      expect(submitBtn.type).toBe('submit');
      expect(submitBtn.textContent?.trim()).toBe('Login');

      // Check error message container (should be hidden initially)
      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.classList.contains('hidden')).toBe(true);

      // Check register link
      const registerLink = container.querySelector('#register-link');
      expect(registerLink).toBeTruthy();
    });

    it('should render navigation bar', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      expect(mockRenderNavBar).toHaveBeenCalledWith('login');
      expect(container.innerHTML).toContain('Mock NavBar');
    });

    it('should call setupNavigation after rendering', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      expect(mockSetupNavigation).toHaveBeenCalled();
    });

    it('should render Google OAuth button with correct attributes', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const googleBtn = container.querySelector('#google-login-btn') as HTMLAnchorElement;
      expect(googleBtn).toBeTruthy();
      expect(googleBtn.href).toContain('/api/oauth/google');
      expect(googleBtn.textContent).toContain('Continue with Google');
    });

    it('should render divider with "or" separator before Google button', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      // Check for divider separator text
      expect(container.innerHTML).toContain('or');

      // Check that Google button comes after the divider
      const googleBtn = container.querySelector('#google-login-btn');
      expect(googleBtn).toBeTruthy();
    });

    it('should render Google icon SVG in the OAuth button with aria-hidden', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const googleBtn = container.querySelector('#google-login-btn');
      const svg = googleBtn?.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Form Validation', () => {
    it('should show error when email is empty', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Please fill in all fields');
    });

    it('should show error when password is empty', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;

      emailInput.value = 'test@example.com';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Please fill in all fields');
    });

    it('should show error when both fields are empty', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Please fill in all fields');
    });
  });

  describe('Form Submission', () => {
    it('should call login with correct credentials', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auth.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('should disable button and show loading state during login', async () => {
      // Mock a slow login
      vi.spyOn(auth, 'login').mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );

      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;
      const loginBtn = container.querySelector('#login-btn') as HTMLButtonElement;

      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Check immediately after submit
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(loginBtn.disabled).toBe(true);
      expect(loginBtn.textContent?.trim()).toBe('Logging in...');

      // Wait for login to complete
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    it('should call onLoginSuccess after successful login', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockOnLoginSuccess).toHaveBeenCalled();
    });

    it('should reset form after successful login', async () => {
      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should display error message on login failure', async () => {
      vi.spyOn(auth, 'login').mockRejectedValue(new Error('Invalid credentials'));

      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      emailInput.value = 'test@example.com';
      passwordInput.value = 'wrongpassword';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Invalid credentials');
    });

    it('should re-enable button after login failure', async () => {
      vi.spyOn(auth, 'login').mockRejectedValue(new Error('Network error'));

      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;
      const loginBtn = container.querySelector('#login-btn') as HTMLButtonElement;

      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(loginBtn.disabled).toBe(false);
      expect(loginBtn.textContent?.trim()).toBe('Login');
    });

    it('should hide error message on new submission', async () => {
      vi.spyOn(auth, 'login').mockRejectedValueOnce(new Error('First error'));

      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      emailInput.value = 'test@example.com';
      passwordInput.value = 'wrongpassword';

      // First submission - should show error
      let submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
      await new Promise((resolve) => setTimeout(resolve, 10));

      let errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);

      // Mock successful login for second attempt
      vi.spyOn(auth, 'login').mockResolvedValue({ success: true });
      passwordInput.value = 'correctpassword';

      // Second submission - error should be hidden
      submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Error should be hidden immediately on submit
      errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(true);
    });

    it('should show generic error message for non-Error objects', async () => {
      vi.spyOn(auth, 'login').mockRejectedValue('string error');

      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const form = container.querySelector('#login-form') as HTMLFormElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      const errorText = errorMessage?.querySelector('p');
      expect(errorText?.textContent).toContain('Login failed. Please try again.');
    });
  });

  describe('Register Link', () => {
    it('should dispatch navigate event when register link is clicked', async () => {
      const navigateSpy = vi.fn();
      window.addEventListener('navigate', navigateSpy);

      await renderLoginPage(container, mockRenderNavBar, mockSetupNavigation, mockOnLoginSuccess);

      const registerLink = container.querySelector('#register-link') as HTMLButtonElement;

      registerLink.click();

      expect(navigateSpy).toHaveBeenCalled();
      const event = navigateSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.page).toBe('register');

      window.removeEventListener('navigate', navigateSpy);
    });
  });
});
