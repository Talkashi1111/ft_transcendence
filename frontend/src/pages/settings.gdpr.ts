import { deleteMyAccount } from '../utils/auth';

export function setupGdprDeleteHandler(): void {
  const deleteBtn = document.getElementById('delete-account-btn') as HTMLButtonElement | null;
  if (!deleteBtn) return;

  deleteBtn.addEventListener('click', async () => {
    const ok = confirm('Are you sure you want to delete your account? This cannot be undone.');
    if (!ok) return;

    deleteBtn.disabled = true;

    try {
      await deleteMyAccount();
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'login' } }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      deleteBtn.disabled = false;
    }
  });
}
