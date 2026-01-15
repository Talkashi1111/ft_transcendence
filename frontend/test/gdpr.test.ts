import { beforeEach, describe, expect, it, vi } from 'vitest';

// Helper: flush microtasks (Promises)
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('GDPR - auth.ts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deleteMyAccount() calls POST /api/users/me/delete with credentials', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

    // Import once (no need for resetModules/unmock if you aren’t globally mocking the module)
    const { deleteMyAccount } = await import('../src/utils/auth');

    await deleteMyAccount();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/users/me/delete', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('deleteMyAccount() throws server message on failure when response is JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Nope' }), { status: 500 })
    );

    const { deleteMyAccount } = await import('../src/utils/auth');

    await expect(deleteMyAccount()).rejects.toThrow('Nope');
  });

  it('deleteMyAccount() throws generic message if response body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }));

    const { deleteMyAccount } = await import('../src/utils/auth');

    await expect(deleteMyAccount()).rejects.toThrow('Failed to delete account');
  });
});

describe('GDPR - settings.ts delete button wiring', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = `<button id="delete-account-btn">Delete</button>`;
  });

  async function loadSettingsWithAuthMock(authMock: Record<string, unknown>) {
    vi.resetModules();
    vi.doMock('../src/utils/auth', () => authMock);

    // IMPORTANT: import settings AFTER mocking utils/auth
    const mod = await import('../src/pages/settings'); // <-- CHANGE THIS PATH TO YOUR REAL SETTINGS FILE
    if (typeof mod.setupGdprHandlers !== 'function') {
      throw new Error('setupGdprHandlers is not exported from settings module');
    }
    return mod;
  }

  it('does nothing if confirm is cancelled', async () => {
    const deleteMock = vi.fn();
    await loadSettingsWithAuthMock({
      deleteMyAccount: deleteMock,
      logout: vi.fn(),
    });

    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { setupGdprHandlers } = await import('../src/pages/settings'); // same path as above
    setupGdprHandlers();

    const btn = document.getElementById('delete-account-btn') as HTMLButtonElement;
    btn.click();
    await flush();

    expect(deleteMock).not.toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
  });

  it('on success: disables button, calls delete, navigates to login', async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const logoutMock = vi.fn().mockResolvedValue(undefined);

    await loadSettingsWithAuthMock({
      deleteMyAccount: deleteMock,
      logout: logoutMock,
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const navSpy = vi.fn();
    window.addEventListener('navigate', navSpy);

    const { setupGdprHandlers } = await import('../src/pages/settings'); // same path as above
    setupGdprHandlers();

    const btn = document.getElementById('delete-account-btn') as HTMLButtonElement;
    btn.click();

    expect(btn.disabled).toBe(true);

    await flush();

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(navSpy).toHaveBeenCalledTimes(1);

    const evt = navSpy.mock.calls[0][0] as CustomEvent;
    expect(evt.detail.page).toBe('login');
  });

  it('on failure: alerts error and re-enables button', async () => {
    const deleteMock = vi.fn().mockRejectedValue(new Error('Boom'));

    await loadSettingsWithAuthMock({
      deleteMyAccount: deleteMock,
      logout: vi.fn(),
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { setupGdprHandlers } = await import('../src/pages/settings'); // same path as above
    setupGdprHandlers();

    const btn = document.getElementById('delete-account-btn') as HTMLButtonElement;
    btn.click();

    expect(btn.disabled).toBe(true);

    await flush();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0]?.[0]).toContain('Boom');
    expect(btn.disabled).toBe(false);
  });
});
