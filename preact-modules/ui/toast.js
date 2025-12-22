/**
 * Toast Notification System
 * 
 * Simple, lightweight toast notifications
 * No dependencies, pure vanilla JS
 * 
 * Usage:
 * ```js
 * import { toast } from './toast.js'
 * 
 * toast.success('Copied to clipboard!')
 * toast.error('Failed to save')
 * toast.info('Processing...')
 * ```
 */

// Toast container styles
const TOAST_STYLES = `
  #toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .toast {
    min-width: 280px;
    max-width: 400px;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.4;
    pointer-events: auto;
    animation: toast-in 0.2s ease-out;
    transition: opacity 0.2s, transform 0.2s;
  }

  .toast.toast-out {
    animation: toast-out 0.2s ease-in forwards;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes toast-out {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }

  .toast-success {
    background: #10b981;
    color: white;
  }

  .toast-error {
    background: #ef4444;
    color: white;
  }

  .toast-info {
    background: #3b82f6;
    color: white;
  }

  .toast-warning {
    background: #f59e0b;
    color: white;
  }

  .toast-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .toast-message {
    flex: 1;
  }

  .toast-close {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .toast-close:hover {
    opacity: 1;
  }
`

// Inject styles
function injectStyles() {
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style')
    style.id = 'toast-styles'
    style.textContent = TOAST_STYLES
    document.head.appendChild(style)
  }
}

// Get or create toast container
function getContainer() {
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    document.body.appendChild(container)
    injectStyles()
  }
  return container
}

// SVG Icons
const ICONS = {
  success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
  error: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
  info: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
  warning: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`
}

const CLOSE_ICON = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {Object} options - Toast options
 * @param {string} options.type - Toast type (success, error, info, warning)
 * @param {number} options.duration - Duration in ms (default: 3000)
 * @param {boolean} options.closable - Show close button (default: true)
 */
function showToast(message, options = {}) {
  const {
    type = 'info',
    duration = 3000,
    closable = true
  } = options

  const container = getContainer()
  
  // Create toast element
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  
  // Add icon
  const icon = document.createElement('div')
  icon.className = 'toast-icon'
  icon.innerHTML = ICONS[type] || ICONS.info
  toast.appendChild(icon)
  
  // Add message
  const messageEl = document.createElement('div')
  messageEl.className = 'toast-message'
  messageEl.textContent = message
  toast.appendChild(messageEl)
  
  // Add close button
  if (closable) {
    const closeBtn = document.createElement('button')
    closeBtn.className = 'toast-close'
    closeBtn.innerHTML = CLOSE_ICON
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.onclick = () => removeToast(toast)
    toast.appendChild(closeBtn)
  }
  
  // Add to container
  container.appendChild(toast)
  
  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration)
  }
  
  return toast
}

/**
 * Remove a toast with animation
 * @param {HTMLElement} toast - Toast element to remove
 */
function removeToast(toast) {
  toast.classList.add('toast-out')
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast)
    }
  }, 200)
}

/**
 * Toast API
 */
export const toast = {
  success: (message, options) => showToast(message, { ...options, type: 'success' }),
  error: (message, options) => showToast(message, { ...options, type: 'error' }),
  info: (message, options) => showToast(message, { ...options, type: 'info' }),
  warning: (message, options) => showToast(message, { ...options, type: 'warning' }),
  
  // Alias
  message: (message, options) => showToast(message, options),
  
  // Promise-based toast for async operations
  promise: async (promise, { loading, success, error }) => {
    const loadingToast = showToast(loading, { type: 'info', duration: 0 })
    
    try {
      const result = await promise
      removeToast(loadingToast)
      showToast(success, { type: 'success' })
      return result
    } catch (err) {
      removeToast(loadingToast)
      showToast(error || err.message, { type: 'error' })
      throw err
    }
  }
}

// Export for use in both ES modules and vanilla JS
export default toast

// Also expose globally
if (typeof window !== 'undefined') {
  window.toast = toast
}
