import {
  getCurrentUser,
  setup2FA,
  enable2FA,
  disable2FA,
  updateAlias,
  uploadAvatar,
  deleteAvatar,
  getAvatarUrl,
  exportMyData,
  deleteMyAccount,
} from '../utils/auth';
import { t } from '../i18n/i18n';
import { escapeHtml } from '../utils/sanitize';
import { setupGdprDeleteHandler } from './settings.gdpr';

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
          <h2 class="text-xl font-semibold text-gray-900 mb-4">${t('settings.avatar.picture')}</h2>
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
                  ${t('settings.avatar.picture.upload.button')}
                  <input type="file" id="avatar-input" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" />
                </label>
                <button id="delete-avatar-btn" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">
                  ${t('settings.avatar.picture.remove.button')}
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-2">${t('settings.avatar.picture.text')}</p>
              <div id="avatar-message" class="hidden mt-2 p-2 rounded text-sm" role="alert"></div>
            </div>
          </div>
        </div>

        <!-- User Info Section -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">${t('settings.account.info')}</h2>
          <div class="space-y-4">
            <div class="text-gray-600">
              <span class="font-medium">${t('settings.account.info.email')}</span> ${escapeHtml(user.email)}
            </div>

            <!-- Alias Edit Section -->
            <div>
              <label for="alias-input" class="block text-sm font-medium text-gray-700 mb-1">${t('settings.account.info.email.alias.label')}</label>
              <div class="flex gap-2">
                <input
                  type="text"
                  id="alias-input"
                  value="${escapeHtml(user.alias)}"
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
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
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
                    placeholder="${t('settings.2FA.setup.verification.code.placeholder')}"
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

        <!-- GDPR Info Section (toggleable card) -->
        <details class="group bg-white rounded-lg shadow-lg mb-6">
          <!-- Header / Toggle -->
          <summary
            class="list-none cursor-pointer p-6 flex items-center justify-between
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <div class="flex flex-col">
              <h2 class="text-xl font-semibold text-gray-900">
                GDPR & Privacy
              </h2>
              <p class="text-xs text-gray-500 mt-1 group-open:hidden">
                Click to view details
              </p>
              <p class="text-xs text-gray-500 mt-1 hidden group-open:block">
                Click to hide details
              </p>
            </div>

            <div class="flex items-center gap-2 text-blue-600">
              <span class="text-sm font-medium group-open:hidden">Show</span>
              <span class="text-sm font-medium hidden group-open:inline">Hide</span>
              <span class="transition-transform duration-200 group-open:rotate-90 text-gray-500">
                ›
              </span>
            </div>
          </summary>

          <!-- Content -->
          <div class="px-6 pb-6">
            <div class="space-y-6 text-gray-700 text-sm leading-relaxed">
              <!-- Privacy & Data Control (inside the same card) -->
              <div class="mt-1 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 class="text-base font-semibold text-gray-900 mb-3">
                  Privacy & Data Control
                </h3>

                <div class="space-y-3">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <p class="font-medium text-gray-900">Export my data</p>
                      <p class="text-xs text-gray-600">Download a copy of your personal data.</p>
                    </div>
                    <button
                      id="export-data-btn"
                      class="min-w-[7.5rem] inline-flex items-center justify-center rounded-md
                            border border-gray-300 bg-white px-2 py-2 text-sm font-medium
                            text-gray-900 text-center leading-tight hover:bg-gray-100"
                      type="button"
                    >
                      Export
                    </button>
                  </div>
                  <div class="pt-3 border-t border-gray-200">
                    <p class="text-xs font-semibold text-red-700 mb-2">Danger zone</p>

                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <p class="font-medium text-gray-900">Delete account</p>
                        <p class="text-xs text-gray-600">Permanently delete your account and erase personal data. Your game history may remain anonymised for integrity of rankings.</p>
                      </div>
                      <button
                        id="delete-account-btn"
                        class="min-w-[7.5rem] inline-flex items-center justify-center rounded-md
                              bg-red-600 px-2 py-2 text-sm font-semibold text-white
                              text-center leading-tight hover:bg-red-700"
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <section>
                <h3 class="font-semibold text-gray-900 mb-2">
                  1) What data we collect
                </h3>
                <p>
                  We collect only the data necessary to provide authentication,
                  gameplay, and account management features.
                </p>

                <div class="mt-4">
                  <h3 class="font-semibold text-gray-900 mb-2">
                    Cookies & local storage
                  </h3>
                  <p>
                    We use strictly necessary cookies and local storage mechanisms to ensure
                    secure authentication, session management, and basic application
                    functionality (such as language preferences). These technologies are
                    essential for the service to operate and do not require user consent
                    under applicable data protection laws.
                  </p>
                </div>
              </section>

              <section>
                <h3 class="font-semibold text-gray-900 mb-2">
                  2) Where data is stored
                </h3>
                <p>
                  All user data is stored securely on servers located within the EU.
                </p>
              </section>

              <!-- Section 3 toggle (no SVG; simple chevron) -->
              <section>
                <details class="group/inner rounded-lg border border-gray-200">
                  <summary
                    class="flex items-center justify-between cursor-pointer px-4 py-3 font-semibold text-gray-900
                          hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span>3) User rights</span>
                    <span class="transition-transform duration-200 group-open/inner:rotate-90 text-gray-500">
                      ›
                    </span>
                  </summary>

                  <div class="px-4 pb-4 text-sm text-gray-700">
                    <ul class="list-disc list-inside space-y-1">
                      <li>Right to access personal data</li>
                      <li>Right to rectification</li>
                      <li>Right to erasure</li>
                      <li>Right to data portability</li>
                    </ul>
                  </div>
                </details>
              </section>

              <section>
                <h3 class="font-semibold text-gray-900 mb-2">
                  4) Anonymisation & deletion policy
                </h3>
                <p>
                  Users may request account deletion at any time. Upon deletion,
                  personal identifiers are anonymised while preserving statistical data.
                </p>
              </section>

              <section>
                <h3 class="font-semibold text-gray-900 mb-2">
                  5) Retention and security
                </h3>
                <p>
                  Data is retained only as long as required and protected using
                  industry-standard encryption and access controls.
                </p>
              </section>

              <section>
                <h3 class="font-semibold text-gray-900 mb-2">
                  6) External reference
                </h3>
                <p>
                  For more information, see the official GDPR text:
                  <a
                    href="https://gdpr.eu"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-600 hover:underline"
                  >
                    https://gdpr.eu
                  </a>
                </p>
              </section>
            </div>
          </div>
        </details>

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
  setupGdprHandlers();
  setupGdprDeleteHandler();
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
        showMessage(t('settings.avatar.picture.filesize.error.message'), true);
        avatarInput.value = '';
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        showMessage(t('settings.avatar.picture.filetype.error.message'), true);
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
        showMessage(
          err instanceof Error
            ? err.message
            : t('settings.avatar.picture.avatarupload.error.message'),
          true
        );
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
        const result = await deleteAvatar();
        showMessage(result.message);

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
        showMessage(
          err instanceof Error
            ? err.message
            : t('settings.avatar.picture.avatarremove.error.message'),
          true
        );
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
        showMessage(t('settings.avatar.picture.aliaslength.error.message'), true);
        return;
      }

      if (!/^[a-zA-Z0-9_.-]+$/.test(newAlias)) {
        showMessage(t('settings.avatar.picture.aliasformat.error.message'), true);
        return;
      }

      updateBtn.disabled = true;
      updateBtn.textContent = t('settings.avatar.picture.updating.button');

      try {
        await updateAlias(newAlias);
        showMessage(t('settings.avatar.picture.aliasupdate.success.message'));
        aliasInput.value = newAlias;

        // Update navbar alias display
        const navAlias = document.getElementById('nav-user-alias');
        if (navAlias) {
          navAlias.textContent = newAlias;
        }
      } catch (err) {
        showMessage(
          err instanceof Error
            ? err.message
            : t('settings.avatar.picture.aliasupdate.error.message'),
          true
        );
      } finally {
        updateBtn.disabled = false;
        updateBtn.textContent = t('settings.avatar.picture.update.button');
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
        showMessage(
          err instanceof Error ? err.message : t('settings.2FA.setup.error.message'),
          true
        );
        setupBtn.textContent = t('settings.2FA.enable2FA');
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
        showMessage(t('settings.2FA.setup.code.error.message'), true);
        return;
      }

      (verifyBtn as HTMLButtonElement).disabled = true;
      verifyBtn.textContent = t('settings.2FA.verifying.button');

      try {
        await enable2FA(code);
        showMessage(t('settings.2FA.enable2FA.success.message'));
        // Reload page to show updated status
        setTimeout(() => {
          const event = new CustomEvent('navigate', { detail: { page: 'settings' } });
          window.dispatchEvent(event);
        }, 1500);
      } catch (err) {
        showMessage(
          err instanceof Error ? err.message : t('settings.2FA.setup.verify.code.error.message'),
          true
        );
        (verifyBtn as HTMLButtonElement).disabled = false;
        verifyBtn.textContent = t('settings.2FA.setup.verify.button');
      }
    });
  }

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      setupContainer?.classList.add('hidden');
      setupBtn?.classList.remove('hidden');
      if (setupBtn) {
        setupBtn.textContent = t('settings.2FA.cancel.enable2FA');
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

      if (!confirm(t('settings.2FA.disable2FA.popup.message'))) {
        return;
      }

      (disableBtn as HTMLButtonElement).disabled = true;
      disableBtn.textContent = t('settings.2FA.disabling.button');

      try {
        await disable2FA();
        showMessage(t('settings.2FA.disable2FA.confirm.message'));
        // Reload page to show updated status
        setTimeout(() => {
          const event = new CustomEvent('navigate', { detail: { page: 'settings' } });
          window.dispatchEvent(event);
        }, 1500);
      } catch (err) {
        showMessage(
          err instanceof Error ? err.message : t('settings.2FA.disable2FA.error.message'),
          true
        );
        (disableBtn as HTMLButtonElement).disabled = false;
        disableBtn.textContent = t('settings.2FA.disable2FA');
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

// --------------------------------------
// GDPR Helpers
// --------------------------------------

async function downloadJson(filename: string, data: unknown): Promise<void> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

// GDPR
function setupGdprHandlers(): void {
  const exportBtn = document.getElementById('export-data-btn') as HTMLButtonElement | null;
  const deleteBtn = document.getElementById('delete-account-btn') as HTMLButtonElement | null;

  exportBtn?.addEventListener('click', async () => {
    if (!exportBtn) return;
    exportBtn.disabled = true;
    try {
      const data = await exportMyData();
      await downloadJson('my-data.json', data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      exportBtn.disabled = false;
    }
  });

  deleteBtn?.addEventListener('click', async () => {
    const ok = confirm('Are you sure you want to delete your account? This cannot be undone.');
    if (!ok) return;

    deleteBtn.disabled = true;

    try {
      await deleteMyAccount();
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'login' } }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      deleteBtn.disabled = false; // only re-enable on failure
    }
  });
}
