/**
 * Note Keyboard Blocker Module
 * Prevents page-level and extension keyboard shortcuts from interfering
 * when typing in sticky note editors, while preserving browser default shortcuts
 */

const NoteKeyboardBlocker = (function() {
  'use strict';

  let isInitialized = false;
  let activeEditors = new Set();
  let keyDownHandler = null;

  // Browser default shortcuts that should always work
  const BROWSER_DEFAULT_SHORTCUTS = new Set([
    // Find
    'Ctrl+F',
    'Meta+F',
    // Reload
    'Ctrl+R',
    'Meta+R',
    'F5',
    // Close tab
    'Ctrl+W',
    'Meta+W',
    // New tab
    'Ctrl+T',
    'Meta+T',
    // New window
    'Ctrl+N',
    'Meta+N',
    // New incognito
    'Ctrl+Shift+N',
    'Meta+Shift+N',
    // Switch tabs
    'Ctrl+Tab',
    'Meta+Tab',
    'Ctrl+Shift+Tab',
    'Meta+Shift+Tab',
    // Fullscreen
    'F11',
    // Zoom
    'Ctrl+Plus',
    'Ctrl+Minus',
    'Ctrl+0',
    'Meta+Plus',
    'Meta+Minus',
    'Meta+0',
    // Escape (may be used for closing dialogs)
    'Escape'
  ]);

  /**
   * Get key string from event (e.g., "Ctrl+B")
   * @param {KeyboardEvent} event
   * @returns {string}
   */
  function getKeyString(event) {
    const parts = [];

    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');

    // Get key name
    let key = event.key;
    
    // Normalize key names
    if (key === ' ') key = 'Space';
    if (key === '+') key = 'Plus';
    if (key === '-') key = 'Minus';
    if (key === '=') key = 'Plus'; // = is often used for zoom in
    if (key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      // Single character keys without modifiers are just the key
      return key;
    }
    if (key.length === 1) key = key.toUpperCase();

    parts.push(key);

    return parts.join('+');
  }

  /**
   * Check if event is a browser default shortcut
   * @param {KeyboardEvent} event
   * @returns {boolean}
   */
  function isBrowserDefaultShortcut(event) {
    const keyString = getKeyString(event);
    
    // Check exact match
    if (BROWSER_DEFAULT_SHORTCUTS.has(keyString)) {
      return true;
    }

    // Special handling for function keys
    if (event.key.startsWith('F') && event.key.length <= 3) {
      const fKey = event.key;
      if (BROWSER_DEFAULT_SHORTCUTS.has(fKey)) {
        return true;
      }
    }

    // Allow single character keys without modifiers (normal typing)
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
      return true;
    }

    // Allow Shift + single character (capital letters, symbols)
    if (event.key.length === 1 && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      return true;
    }

    return false;
  }

  /**
   * Handle keydown events in capture phase
   * @param {KeyboardEvent} event
   */
  function handleKeyDown(event) {
    // Only block if we have active editors
    if (activeEditors.size === 0) {
      return;
    }

    // Check if the event target is within an active editor
    const target = event.target;
    const isInActiveEditor = Array.from(activeEditors).some(editor => 
      editor === target || editor.contains(target)
    );

    if (!isInActiveEditor) {
      return;
    }

    // Allow browser default shortcuts
    if (isBrowserDefaultShortcut(event)) {
      return;
    }

    // Stop propagation to prevent page-level handlers from receiving the event
    // But don't preventDefault() to allow normal typing behavior
    event.stopPropagation();
  }

  /**
   * Initialize the keyboard blocker
   */
  function init() {
    if (isInitialized) return;

    keyDownHandler = handleKeyDown.bind(this);
    
    // Use capture phase to intercept events before they reach page handlers
    document.addEventListener('keydown', keyDownHandler, true);

    isInitialized = true;
    console.log('[NoteKeyboardBlocker] Initialized');
  }

  /**
   * Start blocking shortcuts for a specific element
   * @param {HTMLElement} element - The note editor element
   */
  function blockShortcutsForElement(element) {
    if (!element) return;

    activeEditors.add(element);
    
    // Disable extension KeyboardShortcuts module if available
    if (typeof KeyboardShortcuts !== 'undefined' && KeyboardShortcuts.disable) {
      KeyboardShortcuts.disable();
    }

    console.log('[NoteKeyboardBlocker] Blocking shortcuts for element, active editors:', activeEditors.size);
  }

  /**
   * Stop blocking shortcuts for a specific element
   * @param {HTMLElement} element - The note editor element
   */
  function unblockShortcutsForElement(element) {
    if (!element) return;

    activeEditors.delete(element);

    // Re-enable extension KeyboardShortcuts module if no editors are active
    if (activeEditors.size === 0) {
      if (typeof KeyboardShortcuts !== 'undefined' && KeyboardShortcuts.enable) {
        KeyboardShortcuts.enable();
      }
    }

    console.log('[NoteKeyboardBlocker] Unblocking shortcuts for element, active editors:', activeEditors.size);
  }

  /**
   * Cleanup method
   */
  function cleanup() {
    if (keyDownHandler) {
      document.removeEventListener('keydown', keyDownHandler, true);
      keyDownHandler = null;
    }

    activeEditors.clear();
    isInitialized = false;
    console.log('[NoteKeyboardBlocker] Cleanup complete');
  }

  return {
    init,
    blockShortcutsForElement,
    unblockShortcutsForElement,
    isBrowserDefaultShortcut,
    cleanup
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.NoteKeyboardBlocker = NoteKeyboardBlocker;
}

