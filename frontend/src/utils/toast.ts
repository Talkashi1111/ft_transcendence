/**
 * Toast Notification System
 * Provides non-blocking, auto-dismissing notifications
 */

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastOptions {
  duration?: number // Duration in ms, 0 = no auto-dismiss
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'
}

let toastContainer: HTMLElement | null = null

function getToastContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.id = 'toast-container'
    toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none'
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

export function showToast(
  message: string,
  type: ToastType = 'info',
  options: ToastOptions = {}
): void {
  const { duration = 3000, position = 'top-right' } = options

  const container = getToastContainer()

  // Update container position
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  }
  container.className = `fixed z-50 flex flex-col gap-2 pointer-events-none ${positionClasses[position]}`

  // Create toast element
  const toast = document.createElement('div')
  toast.className = 'pointer-events-auto transform transition-all duration-300 ease-in-out opacity-0 translate-x-full'

  // Type-specific styles
  const typeStyles = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-yellow-500 text-white',
    info: 'bg-blue-600 text-white',
  }

  // Type-specific icons
  const typeIcons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  }

  toast.innerHTML = `
    <div class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${typeStyles[type]} min-w-[300px] max-w-md">
      <span class="text-xl font-bold">${typeIcons[type]}</span>
      <span class="flex-1">${escapeHtml(message)}</span>
      <button class="toast-close ml-2 text-white/80 hover:text-white text-xl leading-none">&times;</button>
    </div>
  `

  container.appendChild(toast)

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.remove('opacity-0', 'translate-x-full')
      toast.classList.add('opacity-100', 'translate-x-0')
    })
  })

  // Close button handler
  const closeButton = toast.querySelector('.toast-close')
  const closeToast = () => {
    toast.classList.add('opacity-0', 'translate-x-full')
    setTimeout(() => {
      toast.remove()
      if (container.children.length === 0) {
        container.remove()
        toastContainer = null
      }
    }, 300)
  }

  closeButton?.addEventListener('click', closeToast)

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(closeToast, duration)
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Convenience methods
export const toast = {
  success: (message: string, options?: ToastOptions) => showToast(message, 'success', options),
  error: (message: string, options?: ToastOptions) => showToast(message, 'error', options),
  warning: (message: string, options?: ToastOptions) => showToast(message, 'warning', options),
  info: (message: string, options?: ToastOptions) => showToast(message, 'info', options),
}
