import { getCurrentUser, setup2FA, enable2FA, disable2FA } from '../utils/auth';

export async function renderSettingsPage(
  app: HTMLElement,
  renderNavBar: (page: 'home' | 'play' | 'tournaments' | 'settings') => Promise<string>,
  setupNavigation: () => void
): Promise<void> {
  const navBar = await renderNavBar('settings');
  const user = await getCurrentUser();

  if (!user) {
    // Redirect to login if not authenticated
    const event = new CustomEvent('navigate', { detail: { page: 'login' } });
    window.dispatchEvent(event);
    return;
  }

  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${navBar}

      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        <!-- User Info Section -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
          <div class="space-y-2 text-gray-600">
            <p><span class="font-medium">Email:</span> ${user.email}</p>
            <p><span class="font-medium">Alias:</span> ${user.alias}</p>
          </div>
        </div>

        <!-- 2FA Section -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Two-Factor Authentication (2FA)</h2>

          <div id="2fa-status" class="mb-4">
            ${
              user.twoFactorEnabled
                ? '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">✓ Enabled</span>'
                : '<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">Disabled</span>'
            }
          </div>

          <p class="text-gray-600 text-sm mb-4">
            Add an extra layer of security to your account by requiring a verification code from your authenticator app.
          </p>

          <!-- 2FA Actions -->
          <div id="2fa-actions">
            ${
              user.twoFactorEnabled
                ? `<button id="disable-2fa-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">
                  Disable 2FA
                </button>`
                : `<button id="setup-2fa-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                  Enable 2FA
                </button>`
            }
          </div>

          <!-- 2FA Setup Container (hidden initially) -->
          <div id="2fa-setup-container" class="hidden mt-6 p-4 border border-gray-200 rounded-lg">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Setup Two-Factor Authentication</h3>

            <div class="space-y-4">
              <div>
                <p class="text-sm text-gray-600 mb-2">1. Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
                <div id="qr-code-container" class="flex justify-center bg-white p-4 rounded border">
                  <div class="animate-pulse bg-gray-200 w-48 h-48"></div>
                </div>
              </div>

              <div>
                <p class="text-sm text-gray-600 mb-2">Or enter this secret manually:</p>
                <code id="secret-code" class="block bg-gray-100 p-2 rounded text-sm font-mono break-all"></code>
              </div>

              <div>
                <p class="text-sm text-gray-600 mb-2">2. Enter the 6-digit code from your authenticator app:</p>
                <div class="flex gap-2">
                  <input
                    type="text"
                    id="verification-code"
                    maxlength="6"
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    class="w-32 px-4 py-2 border border-gray-300 rounded-lg text-center text-lg tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <button id="verify-code-btn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:bg-gray-400">
                    Verify & Enable
                  </button>
                </div>
              </div>

              <button id="cancel-setup-btn" class="text-gray-500 hover:text-gray-700 text-sm">
                Cancel
              </button>
            </div>
          </div>

          <!-- Messages -->
          <div id="2fa-message" class="hidden mt-4 p-3 rounded-lg" role="alert"></div>
        </div>

        <!-- Back to Home -->
        <div class="mt-6">
          <button id="back-home-btn" class="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  `;

  setupNavigation();
  setup2FAHandlers();
}

function setup2FAHandlers(): void {
  const setupBtn = document.getElementById('setup-2fa-btn');
  const disableBtn = document.getElementById('disable-2fa-btn');
  const setupContainer = document.getElementById('2fa-setup-container');
  const qrCodeContainer = document.getElementById('qr-code-container');
  const secretCode = document.getElementById('secret-code');
  const verificationCode = document.getElementById('verification-code') as HTMLInputElement;
  const verifyBtn = document.getElementById('verify-code-btn');
  const cancelBtn = document.getElementById('cancel-setup-btn');
  const messageDiv = document.getElementById('2fa-message');
  const backHomeBtn = document.getElementById('back-home-btn');

  const showMessage = (message: string, isError = false) => {
    if (!messageDiv) return;
    messageDiv.textContent = message;
    messageDiv.classList.remove(
      'hidden',
      'bg-green-50',
      'text-green-700',
      'bg-red-50',
      'text-red-700'
    );
    if (isError) {
      messageDiv.classList.add('bg-red-50', 'text-red-700');
    } else {
      messageDiv.classList.add('bg-green-50', 'text-green-700');
    }
  };

  const hideMessage = () => {
    messageDiv?.classList.add('hidden');
  };

  // Setup 2FA button
  if (setupBtn) {
    setupBtn.addEventListener('click', async () => {
      hideMessage();
      setupBtn.textContent = 'Loading...';
      (setupBtn as HTMLButtonElement).disabled = true;

      try {
        const { secret, qrCodeDataUrl } = await setup2FA();

        if (qrCodeContainer) {
          qrCodeContainer.innerHTML = `<img src="${qrCodeDataUrl}" alt="2FA QR Code" class="w-48 h-48" />`;
        }
        if (secretCode) {
          secretCode.textContent = secret;
        }
        setupContainer?.classList.remove('hidden');
        setupBtn.classList.add('hidden');
      } catch (err) {
        showMessage(err instanceof Error ? err.message : 'Failed to setup 2FA', true);
        setupBtn.textContent = 'Enable 2FA';
        (setupBtn as HTMLButtonElement).disabled = false;
      }
    });
  }

  // Verify & Enable button
  if (verifyBtn && verificationCode) {
    verifyBtn.addEventListener('click', async () => {
      hideMessage();
      const code = verificationCode.value.trim();

      if (!/^\d{6}$/.test(code)) {
        showMessage('Please enter a valid 6-digit code', true);
        return;
      }

      (verifyBtn as HTMLButtonElement).disabled = true;
      verifyBtn.textContent = 'Verifying...';

      try {
        await enable2FA(code);
        showMessage('2FA has been enabled successfully!');
        // Reload page to show updated status
        setTimeout(() => {
          const event = new CustomEvent('navigate', { detail: { page: 'settings' } });
          window.dispatchEvent(event);
        }, 1500);
      } catch (err) {
        showMessage(err instanceof Error ? err.message : 'Failed to verify code', true);
        (verifyBtn as HTMLButtonElement).disabled = false;
        verifyBtn.textContent = 'Verify & Enable';
      }
    });
  }

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      setupContainer?.classList.add('hidden');
      setupBtn?.classList.remove('hidden');
      if (setupBtn) {
        setupBtn.textContent = 'Enable 2FA';
        (setupBtn as HTMLButtonElement).disabled = false;
      }
      if (verificationCode) verificationCode.value = '';
      hideMessage();
    });
  }

  // Disable 2FA button
  if (disableBtn) {
    disableBtn.addEventListener('click', async () => {
      hideMessage();

      if (
        !confirm('Are you sure you want to disable 2FA? This will make your account less secure.')
      ) {
        return;
      }

      (disableBtn as HTMLButtonElement).disabled = true;
      disableBtn.textContent = 'Disabling...';

      try {
        await disable2FA();
        showMessage('2FA has been disabled');
        // Reload page to show updated status
        setTimeout(() => {
          const event = new CustomEvent('navigate', { detail: { page: 'settings' } });
          window.dispatchEvent(event);
        }, 1500);
      } catch (err) {
        showMessage(err instanceof Error ? err.message : 'Failed to disable 2FA', true);
        (disableBtn as HTMLButtonElement).disabled = false;
        disableBtn.textContent = 'Disable 2FA';
      }
    });
  }

  // Back to home
  if (backHomeBtn) {
    backHomeBtn.addEventListener('click', () => {
      const event = new CustomEvent('navigate', { detail: { page: 'home' } });
      window.dispatchEvent(event);
    });
  }
}
