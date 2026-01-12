import {
  getCurrentUser,
  setup2FA,
  enable2FA,
  disable2FA,
  updateAlias,
  uploadAvatar,
  deleteAvatar,
  getAvatarUrl,
} from '../utils/auth';
import { t } from '../i18n/i18n';

export async function renderSettingsPage(
  app: HTMLElement,
  renderNavBar: (page: 'home' | 'play' | 'tournaments' | 'settings' | 'friends') => Promise<string>,
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
        <h1 class="text-3xl font-bold text-gray-900 mb-8">${t('settings.title')}</h1>

        <!-- Avatar Section -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">${t('settings.profile.picture')}</h2>
          <div class="flex items-center gap-6">
            <div class="relative">
              <img
                id="avatar-preview"
                src="${getAvatarUrl(user.id, Date.now())}"
                alt="Your avatar"
                class="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
              />
              <div id="avatar-loading" class="hidden absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                <svg class="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
            <div class="flex-1">
              <div class="flex flex-wrap gap-2">
                <label class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium cursor-pointer">
                  ${t('settings.profile.picture.upload.button')}
                  <input type="file" id="avatar-input" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" />
                </label>
                <button id="delete-avatar-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">
                  ${t('settings.profile.picture.remove.button')}
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-2">${t('settings.profile.picture.text')}</p>
              <div id="avatar-message" class="hidden mt-2 p-2 rounded text-sm" role="alert"></div>
            </div>
          </div>
        </div>

        <!-- User Info Section -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">${t('settings.account.info')}</h2>
          <div class="space-y-4">
            <div class="text-gray-600">
              <span class="font-medium">${t('settings.account.info.email')}</span> ${user.email}
            </div>

            <!-- Alias Edit Section -->
            <div>
              <label for="alias-input" class="block text-sm font-medium text-gray-700 mb-1">${t('settings.account.info.email.alias.label')}</label>
              <div class="flex gap-2">
                <input
                  type="text"
                  id="alias-input"
                  value="${user.alias}"
                  minlength="3"
                  maxlength="30"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  id="update-alias-btn"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400"
                >
                  ${t('settings.account.info.email.alias.update.button')}
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-1">${t('settings.account.info.email.alias.text')}</p>
              <div id="alias-message" class="hidden mt-2 p-2 rounded text-sm" role="alert"></div>
            </div>
          </div>
        </div>

        <!-- 2FA Section -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">${t('settings.2FA')}</h2>

          <div id="2fa-status" class="mb-4">
            ${
              user.twoFactorEnabled
                ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    ✓ ${t('settings.2FA.enabled')}
                   </span>`
                : `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                      ${t('settings.2FA.disabled')}
                  </span>`
            }
          </div>

          <p class="text-gray-600 text-sm mb-4">
            ${t('settings.2FA.text')}
          </p>

          <!-- 2FA Actions -->
          <div id="2fa-actions">
            ${
              user.twoFactorEnabled
                ? `<button id="disable-2fa-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">
                  ${t('settings.2FA.disable2FA')}
                </button>`
                : `<button id="setup-2fa-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                  ${t('settings.2FA.enable2FA')}
                </button>`
            }
          </div>

          <!-- 2FA Setup Container (hidden initially) -->
          <div id="2fa-setup-container" class="hidden mt-6 p-4 border border-gray-200 rounded-lg">
            <h3 class="text-lg font-medium text-gray-900 mb-4">${t('settings.2FA.setup')}</h3>

            <div class="space-y-4">
              <div>
                <p class="text-sm text-gray-600 mb-2">${t('settings.2FA.setup.scan')}</p>
                <div id="qr-code-container" class="flex justify-center bg-white p-4 rounded border">
                  <div class="animate-pulse bg-gray-200 w-48 h-48"></div>
                </div>
              </div>

              <div>
                <p class="text-sm text-gray-600 mb-2">${t('settings.2FA.setup.manual')}</p>
                <code id="secret-code" class="block bg-gray-100 p-2 rounded text-sm font-mono break-all"></code>
              </div>

              <div>
                <p class="text-sm text-gray-600 mb-2">${t('settings.2FA.setup.code')}</p>
                <div class="flex gap-2">
                  <input
                    type="text"
                    id="verification-code"
                    maxlength="6"
                    inputmode="numeric"
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    class="w-32 px-4 py-2 border border-gray-300 rounded-lg text-center text-lg tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <button id="verify-code-btn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:bg-gray-400">
                    ${t('settings.2FA.setup.verify.button')}
                  </button>
                </div>
              </div>

              <button id="cancel-setup-btn" class="text-gray-500 hover:text-gray-700 text-sm">
                ${t('settings.2FA.setup.cancel')}
              </button>
            </div>
          </div>

          <!-- Messages -->
          <div id="2fa-message" class="hidden mt-4 p-3 rounded-lg" role="alert"></div>
        </div>

        <!-- Back to Home -->
        <div class="mt-6">
          <button id="back-home-btn" class="text-blue-600 hover:text-blue-700 font-medium">
            ← ${t('settings.link.backtohome')}
          </button>
        </div>
      </div>
    </div>
  `;

  setupNavigation();
  setupAvatarHandler(user.id);
  setupAliasHandler();
  setup2FAHandlers();
}

function setupAvatarHandler(userId: string): void {
  const avatarInput = document.getElementById('avatar-input') as HTMLInputElement;
  const avatarPreview = document.getElementById('avatar-preview') as HTMLImageElement;
  const avatarLoading = document.getElementById('avatar-loading');
  const deleteBtn = document.getElementById('delete-avatar-btn') as HTMLButtonElement;
  const messageDiv = document.getElementById('avatar-message');

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

  const setLoading = (loading: boolean) => {
    if (avatarLoading) {
      avatarLoading.classList.toggle('hidden', !loading);
    }
  };

  // Handle file selection
  if (avatarInput) {
    avatarInput.addEventListener('change', async () => {
      hideMessage();
      const file = avatarInput.files?.[0];

      if (!file) return;

      // Client-side validation
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        showMessage('File is too large. Maximum size is 5MB.', true);
        avatarInput.value = '';
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        showMessage('Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.', true);
        avatarInput.value = '';
        return;
      }

      setLoading(true);

      try {
        const result = await uploadAvatar(file);
        showMessage(result.message);

        // Update preview with cache-busting
        if (avatarPreview) {
          avatarPreview.src = getAvatarUrl(userId, Date.now());
        }

        // Also update navbar avatar if it exists
        const navAvatar = document.getElementById('nav-user-avatar') as HTMLImageElement;
        if (navAvatar) {
          navAvatar.src = getAvatarUrl(userId, Date.now());
        }
      } catch (err) {
        showMessage(err instanceof Error ? err.message : 'Failed to upload avatar', true);
      } finally {
        setLoading(false);
        avatarInput.value = ''; // Reset input
      }
    });
  }

  // Handle delete button
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      hideMessage();

      if (!confirm('Are you sure you want to remove your profile picture?')) {
        return;
      }

      setLoading(true);
      deleteBtn.disabled = true;

      try {
        await deleteAvatar();
        showMessage('Profile picture removed');

        // Update preview with cache-busting (will show default avatar)
        if (avatarPreview) {
          avatarPreview.src = getAvatarUrl(userId, Date.now());
        }

        // Also update navbar avatar if it exists
        const navAvatar = document.getElementById('nav-user-avatar') as HTMLImageElement;
        if (navAvatar) {
          navAvatar.src = getAvatarUrl(userId, Date.now());
        }
      } catch (err) {
        showMessage(err instanceof Error ? err.message : 'Failed to remove avatar', true);
      } finally {
        setLoading(false);
        deleteBtn.disabled = false;
      }
    });
  }
}

function setupAliasHandler(): void {
  const aliasInput = document.getElementById('alias-input') as HTMLInputElement;
  const updateBtn = document.getElementById('update-alias-btn') as HTMLButtonElement;
  const messageDiv = document.getElementById('alias-message');

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

  if (updateBtn && aliasInput) {
    updateBtn.addEventListener('click', async () => {
      hideMessage();
      const newAlias = aliasInput.value.trim();

      // Client-side validation
      if (newAlias.length < 3 || newAlias.length > 30) {
        showMessage('Alias must be between 3 and 30 characters', true);
        return;
      }

      updateBtn.disabled = true;
      updateBtn.textContent = 'Updating...';

      try {
        await updateAlias(newAlias);
        showMessage('Alias updated successfully!');
        aliasInput.value = newAlias;

        // Update navbar alias display
        const navAlias = document.getElementById('nav-user-alias');
        if (navAlias) {
          navAlias.textContent = newAlias;
        }
      } catch (err) {
        showMessage(err instanceof Error ? err.message : 'Failed to update alias', true);
      } finally {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Update';
      }
    });
  }
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
      setupBtn.textContent = t('settings.2FA.loading.button');
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
    // Filter non-numeric input in real-time
    verificationCode.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      input.value = input.value.replace(/[^\d]/g, '');
    });

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
