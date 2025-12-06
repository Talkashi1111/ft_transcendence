/**
 * Confirmation Modal System
 * Provides customizable, non-blocking confirmation dialogs
 */

interface ModalOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmClass?: string;
  cancelClass?: string;
  isDangerous?: boolean; // Use red/warning styling for destructive actions
}

let modalContainer: HTMLElement | null = null;

export function showConfirmModal(options: ModalOptions): Promise<boolean> {
  const {
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmClass = 'bg-blue-600 hover:bg-blue-700',
    cancelClass = 'bg-gray-500 hover:bg-gray-600',
    isDangerous = false,
  } = options;

  return new Promise((resolve) => {
    // Remove any existing modal
    if (modalContainer) {
      modalContainer.remove();
    }

    // Create modal container
    modalContainer = document.createElement('div');
    modalContainer.className =
      'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm';

    // Determine button styles
    const confirmButtonClass = isDangerous ? 'bg-red-600 hover:bg-red-700' : confirmClass;

    modalContainer.innerHTML = `
      <div class="modal-content bg-white rounded-lg shadow-2xl max-w-md w-full transform transition-all scale-95 opacity-0">
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 mb-4">${escapeHtml(title)}</h3>
          <p class="text-gray-700 mb-6 whitespace-pre-line">${escapeHtml(message)}</p>

          <div class="flex gap-3 justify-end">
            <button
              id="modal-cancel"
              class="px-5 py-2.5 ${cancelClass} text-white rounded-lg transition font-semibold"
            >
              ${escapeHtml(cancelText)}
            </button>
            <button
              id="modal-confirm"
              class="px-5 py-2.5 ${confirmButtonClass} text-white rounded-lg transition font-semibold"
            >
              ${escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalContainer);

    // Animate in
    requestAnimationFrame(() => {
      const content = modalContainer?.querySelector('.modal-content');
      if (content) {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
      }
    });

    // Handle confirm
    const confirmBtn = modalContainer.querySelector('#modal-confirm');
    const handleConfirm = () => {
      closeModal();
      resolve(true);
    };
    confirmBtn?.addEventListener('click', handleConfirm);

    // Handle cancel
    const cancelBtn = modalContainer.querySelector('#modal-cancel');
    const handleCancel = () => {
      closeModal();
      resolve(false);
    };
    cancelBtn?.addEventListener('click', handleCancel);

    // Handle backdrop click
    modalContainer.addEventListener('click', (e) => {
      if (e.target === modalContainer) {
        handleCancel();
      }
    });

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus confirm button (or cancel if dangerous)
    if (isDangerous) {
      (cancelBtn as HTMLElement)?.focus();
    } else {
      (confirmBtn as HTMLElement)?.focus();
    }
  });
}

function closeModal(): void {
  if (modalContainer) {
    const content = modalContainer.querySelector('.modal-content');
    if (content) {
      content.classList.add('scale-95', 'opacity-0');
    }
    setTimeout(() => {
      modalContainer?.remove();
      modalContainer = null;
    }, 200);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Convenience function for dangerous actions
export async function confirmDangerousAction(
  message: string,
  confirmText: string = 'Delete'
): Promise<boolean> {
  return showConfirmModal({
    title: 'Warning',
    message,
    confirmText,
    cancelText: 'Cancel',
    isDangerous: true,
  });
}
