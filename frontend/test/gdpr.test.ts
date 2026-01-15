// gdpr.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Helper: flush microtasks
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('GDPR - auth.ts (real module, no mocks)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deleteMyAccount() calls the correct endpoint', async () => {
    // Ensure we load the REAL module (not mocked)
    vi.resetModules();
    vi.unmock('../src/utils/auth');

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const { deleteMyAccount } = await import('../src/utils/auth');

    await deleteMyAccount();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/users/me/delete', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('deleteMyAccount() throws server message on failure', async () => {
    vi.resetModules();
    vi.unmock('../src/utils/auth');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Nope' }), { status: 500 })
    );

    const { deleteMyAccount } = await import('../src/utils/auth');

    await expect(deleteMyAccount()).rejects.toThrow('Nope');
  });

  it('deleteMyAccount() throws generic error if response has no json', async () => {
    vi.resetModules();
    vi.unmock('../src/utils/auth');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }));

    const { deleteMyAccount } = await import('../src/utils/auth');

    await expect(deleteMyAccount()).rejects.toThrow('Failed to delete account');
  });
});

describe('GDPR - Settings delete button', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = `<button id="delete-account-btn">Delete</button>`;
  });

  it('does nothing if confirm is cancelled', async () => {
    vi.resetModules();

    // Mock only for this test section
    vi.doMock('../src/utils/auth', () => ({
      deleteMyAccount: vi.fn(),
    }));

    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { setupGdprDeleteHandler } = await import('../src/pages/settings.gdpr');
    const { deleteMyAccount } = await import('../src/utils/auth');

    setupGdprDeleteHandler();

    const btn = document.getElementById('delete-account-btn') as HTMLButtonElement;
    btn.click();
    await flush();

    expect(deleteMyAccount).not.toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
  });

  it('disables button, calls deleteMyAccount, navigates on success', async () => {
    vi.resetModules();

    const deleteMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../src/utils/auth', () => ({
      deleteMyAccount: deleteMock,
    }));

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const navSpy = vi.fn();
    window.addEventListener('navigate', navSpy);

    const { setupGdprDeleteHandler } = await import('../src/pages/settings.gdpr');

    setupGdprDeleteHandler();

    const btn = document.getElementById('delete-account-btn') as HTMLButtonElement;
    btn.click();

    // Immediately disabled
    expect(btn.disabled).toBe(true);

    await flush();

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(navSpy).toHaveBeenCalledTimes(1);
    const evt = navSpy.mock.calls[0][0] as CustomEvent;
    expect(evt.detail.page).toBe('login');
  });

  it('alerts and re-enables button on failure', async () => {
    vi.resetModules();

    const deleteMock = vi.fn().mockRejectedValue(new Error('Boom'));
    vi.doMock('../src/utils/auth', () => ({
      deleteMyAccount: deleteMock,
    }));

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { setupGdprDeleteHandler } = await import('../src/pages/settings.gdpr');

    setupGdprDeleteHandler();

    const btn = document.getElementById('delete-account-btn') as HTMLButtonElement;
    btn.click();

    // Immediately disabled
    expect(btn.disabled).toBe(true);

    await flush();

    expect(window.alert).toHaveBeenCalledWith('Boom');
    expect(btn.disabled).toBe(false);
  });
});
