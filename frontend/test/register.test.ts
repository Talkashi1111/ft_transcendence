import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderRegisterPage } from '../src/pages/register';
import * as auth from '../src/utils/auth';

describe('Register Page', () => {
  let container: HTMLElement;
  let mockRenderNavBar: ReturnType<typeof vi.fn>;
  let mockSetupNavigation: ReturnType<typeof vi.fn>;
  let mockOnRegisterSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);

    mockRenderNavBar = vi.fn().mockResolvedValue('<nav>Mock NavBar</nav>');
    mockSetupNavigation = vi.fn();
    mockOnRegisterSuccess = vi.fn();

    // Mock register function
    vi.spyOn(auth, 'register').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('Rendering', () => {
    it('should render registration form with all required elements', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      // Check form exists
      const form = container.querySelector('#register-form') as HTMLFormElement;
      expect(form).toBeTruthy();
      expect(form.getAttribute('role')).toBe('form');

      // Check alias input
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      expect(aliasInput).toBeTruthy();
      expect(aliasInput.type).toBe('text');
      expect(aliasInput.required).toBe(true);
      expect(aliasInput.minLength).toBe(3);

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
      expect(passwordInput.minLength).toBe(8);

      // Check submit button
      const submitBtn = container.querySelector('#register-btn') as HTMLButtonElement;
      expect(submitBtn).toBeTruthy();
      expect(submitBtn.type).toBe('submit');
      expect(submitBtn.textContent?.trim()).toBe('Register');

      // Check error message container (should be hidden initially)
      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.classList.contains('hidden')).toBe(true);

      // Check success message container (should be hidden initially)
      const successMessage = container.querySelector('#success-message');
      expect(successMessage).toBeTruthy();
      expect(successMessage?.classList.contains('hidden')).toBe(true);

      // Check login link
      const loginLink = container.querySelector('#login-link');
      expect(loginLink).toBeTruthy();
    });

    it('should render navigation bar', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      expect(mockRenderNavBar).toHaveBeenCalledWith('register');
      expect(container.innerHTML).toContain('Mock NavBar');
    });

    it('should call setupNavigation after rendering', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      expect(mockSetupNavigation).toHaveBeenCalled();
    });

    it('should render Google OAuth button with correct attributes', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const googleBtn = container.querySelector('#google-register-btn') as HTMLAnchorElement;
      expect(googleBtn).toBeTruthy();
      expect(googleBtn.href).toContain('/api/oauth/google');
      expect(googleBtn.textContent).toContain('Sign up with Google');
    });

    it('should render divider with "or" separator before Google button', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      // Check for divider separator text
      expect(container.innerHTML).toContain('or');

      // Check that Google button comes after the divider
      const googleBtn = container.querySelector('#google-register-btn');
      expect(googleBtn).toBeTruthy();
    });

    it('should render Google icon SVG in the OAuth button with aria-hidden', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const googleBtn = container.querySelector('#google-register-btn');
      const svg = googleBtn?.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Form Validation', () => {
    it('should show error when all fields are empty', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Please fill in all fields');
    });

    it('should show error when alias is empty', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Please fill in all fields');
    });

    it('should show error when email is empty', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Please fill in all fields');
    });

    it('should show error when password is empty', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Please fill in all fields');
    });

    it('should show error when alias is less than 3 characters', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'ab'; // Only 2 characters
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Alias must be at least 3 characters');
    });

    it('should show error when password is less than 8 characters', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'pass123'; // Only 7 characters

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Password must be at least 8 characters');
    });
  });

  describe('Form Submission', () => {
    it('should call register with correct credentials', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(auth.register).toHaveBeenCalledWith('testuser', 'test@example.com', 'password123');
    });

    it('should disable button and show loading state during registration', async () => {
      // Mock a slow registration
      vi.spyOn(auth, 'register').mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(undefined), 100))
      );

      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;
      const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Check immediately after submit
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(registerBtn.disabled).toBe(true);
      expect(registerBtn.textContent?.trim()).toBe('Creating account...');

      // Wait for registration to complete
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    it('should show success message after successful registration', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const successMessage = container.querySelector('#success-message');
      expect(successMessage?.classList.contains('hidden')).toBe(false);
      expect(successMessage?.textContent).toContain('Account created successfully');
    });

    it('should reset form after successful registration', async () => {
      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(aliasInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
    });

    it('should call onRegisterSuccess after delay', async () => {
      vi.useFakeTimers();

      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Wait for async operations to complete
      await vi.runAllTimersAsync();

      // Should now be called
      expect(mockOnRegisterSuccess).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should display error message on registration failure (409 duplicate email)', async () => {
      vi.spyOn(auth, 'register').mockRejectedValue(
        new Error('User with this email already exists')
      );

      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'existing@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('User with this email already exists');
    });

    it('should display error message on registration failure (409 duplicate alias)', async () => {
      vi.spyOn(auth, 'register').mockRejectedValue(
        new Error('User with this alias already exists')
      );

      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'existinguser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('User with this alias already exists');
    });

    it('should display error message on registration failure (400 validation)', async () => {
      vi.spyOn(auth, 'register').mockRejectedValue(new Error('Please enter a valid email address'));

      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'invalid-email';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Please enter a valid email address');
    });

    it('should display error message on network error', async () => {
      vi.spyOn(auth, 'register').mockRejectedValue(new Error('Network error'));

      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);
      expect(errorMessage?.textContent).toContain('Network error');
    });

    it('should re-enable button after registration failure', async () => {
      vi.spyOn(auth, 'register').mockRejectedValue(new Error('Registration failed'));

      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;
      const registerBtn = container.querySelector('#register-btn') as HTMLButtonElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(registerBtn.disabled).toBe(false);
      expect(registerBtn.textContent?.trim()).toBe('Register');
    });

    it('should hide error and success messages on new submission', async () => {
      vi.spyOn(auth, 'register').mockRejectedValueOnce(new Error('First error'));

      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      // First submission - should show error
      let submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      let errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(false);

      // Mock successful registration for second attempt
      vi.spyOn(auth, 'register').mockResolvedValue(undefined);

      // Second submission - error message should be hidden initially
      submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Wait a tick for the event handler to execute
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Error should be hidden immediately on submit
      errorMessage = container.querySelector('#error-message');
      expect(errorMessage?.classList.contains('hidden')).toBe(true);

      // Wait for success message to appear
      await new Promise((resolve) => setTimeout(resolve, 50));
      const successMessage = container.querySelector('#success-message');
      expect(successMessage?.classList.contains('hidden')).toBe(false);
    });

    it('should show generic error message for non-Error objects', async () => {
      vi.spyOn(auth, 'register').mockRejectedValue('string error');

      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const form = container.querySelector('#register-form') as HTMLFormElement;
      const aliasInput = container.querySelector('#alias') as HTMLInputElement;
      const emailInput = container.querySelector('#email') as HTMLInputElement;
      const passwordInput = container.querySelector('#password') as HTMLInputElement;

      aliasInput.value = 'testuser';
      emailInput.value = 'test@example.com';
      passwordInput.value = 'password123';

      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const errorMessage = container.querySelector('#error-message');
      const errorText = errorMessage?.querySelector('p');
      expect(errorText?.textContent).toContain('Registration failed. Please try again.');
    });
  });

  describe('Login Link', () => {
    it('should dispatch navigate event when login link is clicked', async () => {
      const navigateSpy = vi.fn();
      window.addEventListener('navigate', navigateSpy);

      await renderRegisterPage(
        container,
        mockRenderNavBar,
        mockSetupNavigation,
        mockOnRegisterSuccess
      );

      const loginLink = container.querySelector('#login-link') as HTMLButtonElement;

      loginLink.click();

      expect(navigateSpy).toHaveBeenCalled();
      const event = navigateSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.page).toBe('login');

      window.removeEventListener('navigate', navigateSpy);
    });
  });
});
