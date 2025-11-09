/**
 * Keyboard Shortcuts Module
 * Handles keyboard shortcuts for text formatting and UI actions
 */

const KeyboardShortcuts = (function() {
  'use strict';

  let isEnabled = true;
  let activeTextarea = null;
  let shortcuts = {};

  // Default shortcut mappings
  const DEFAULT_SHORTCUTS = {
    // Text formatting shortcuts
    'Ctrl+B': { action: 'bold', description: 'Bold formatting' },
    'Ctrl+I': { action: 'italic', description: 'Italic formatting' },
    'Ctrl+Shift+C': { action: 'code', description: 'Code formatting' },
    'Ctrl+Shift+B': { action: 'boldserif', description: 'Bold Serif formatting' },
    'Ctrl+Alt+I': { action: 'bolditalic', description: 'Bold Italic formatting' },
    
    // Case conversion shortcuts
    'Ctrl+Shift+U': { action: 'uppercase', description: 'Convert to UPPERCASE' },
    'Ctrl+Shift+L': { action: 'lowercase', description: 'Convert to lowercase' },
    'Ctrl+Shift+T': { action: 'togglecase', description: 'Toggle Case' },
    
    // UI shortcuts
    'Escape': { action: 'closeModal', description: 'Close preview modal' },
    'Ctrl+Shift+R': { action: 'restoreComment', description: 'Open restore menu' },
    
    // Remove formatting
    'Ctrl+Shift+N': { action: 'normal', description: 'Remove formatting' }
  };

  return {
    /**
     * Initializes keyboard shortcuts
     * @param {Object} settings - Settings object
     */
    init(settings = {}) {
      isEnabled = settings?.exlibris?.shortcuts?.enabled !== false;
      shortcuts = { ...DEFAULT_SHORTCUTS };

      if (isEnabled) {
        this.attachListeners();
        console.log('[KeyboardShortcuts] Initialized');
      }
    },

    /**
     * Attaches keyboard event listeners
     */
    attachListeners() {
      // Main keyboard handler
      document.addEventListener('keydown', this.handleKeyDown.bind(this), true);

      // Track active textarea for formatting shortcuts
      document.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
          activeTextarea = e.target;
        }
      }, true);

      document.addEventListener('focusout', (e) => {
        if (e.target === activeTextarea) {
          // Small delay to allow command to execute before clearing
          setTimeout(() => {
            activeTextarea = null;
          }, 100);
        }
      }, true);
    },

    /**
     * Handles keyboard events
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
      if (!isEnabled) return;

      const key = this.getKeyString(event);
      const shortcut = shortcuts[key];

      if (!shortcut) return;

      // Check if shortcut should be handled
      if (this.shouldHandleShortcut(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();
        this.executeAction(shortcut.action, event);
      }
    },

    /**
     * Gets key string from event (e.g., "Ctrl+B")
     * @param {KeyboardEvent} event
     * @returns {string}
     */
    getKeyString(event) {
      const parts = [];

      if (event.ctrlKey) parts.push('Ctrl');
      if (event.altKey) parts.push('Alt');
      if (event.shiftKey) parts.push('Shift');
      if (event.metaKey) parts.push('Meta');

      // Get key name
      let key = event.key;
      
      // Normalize key names
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();

      parts.push(key);

      return parts.join('+');
    },

    /**
     * Checks if shortcut should be handled
     * @param {KeyboardEvent} event
     * @param {Object} shortcut
     * @returns {boolean}
     */
    shouldHandleShortcut(event, shortcut) {
      const action = shortcut.action;

      // Modal closing shortcut (Escape) - global
      if (action === 'closeModal') {
        return !!document.querySelector('.case-comment-preview-modal');
      }

      // Restore comment shortcut - only on case comment pages
      if (action === 'restoreComment') {
        return !!document.querySelector('.case-comment-restore-button');
      }

      // Text formatting shortcuts - only when textarea is focused
      const isTextFormatting = ['bold', 'italic', 'code', 'boldserif', 'bolditalic', 
                                'uppercase', 'lowercase', 'togglecase', 'normal'].includes(action);
      
      if (isTextFormatting) {
        // Must have active textarea with selection
        if (!activeTextarea) return false;
        
        // Check if textarea has selection
        const hasSelection = activeTextarea.selectionStart !== activeTextarea.selectionEnd;
        return hasSelection;
      }

      return false;
    },

    /**
     * Executes shortcut action
     * @param {string} action
     * @param {KeyboardEvent} event
     */
    executeAction(action, event) {
      console.log(`[KeyboardShortcuts] Executing action: ${action}`);

      switch (action) {
        // Text formatting
        case 'bold':
          this.formatSelection('bold');
          break;
        case 'italic':
          this.formatSelection('italic');
          break;
        case 'code':
          this.formatSelection('code');
          break;
        case 'boldserif':
          this.formatSelection('boldserif');
          break;
        case 'bolditalic':
          this.formatSelection('bolditalic');
          break;
        case 'normal':
          this.formatSelection('normal');
          break;

        // Case conversion
        case 'uppercase':
          this.convertCase('upper');
          break;
        case 'lowercase':
          this.convertCase('lower');
          break;
        case 'togglecase':
          this.convertCase('toggle');
          break;

        // UI actions
        case 'closeModal':
          this.closeModal();
          break;
        case 'restoreComment':
          this.openRestoreMenu();
          break;

        default:
          console.warn(`[KeyboardShortcuts] Unknown action: ${action}`);
      }
    },

    /**
     * Formats selected text in textarea
     * @param {string} style
     */
    formatSelection(style) {
      if (!activeTextarea || typeof TextFormatter === 'undefined') return;

      const start = activeTextarea.selectionStart;
      const end = activeTextarea.selectionEnd;
      const selectedText = activeTextarea.value.substring(start, end);

      if (!selectedText) return;

      // Convert text using TextFormatter
      const formatted = TextFormatter.convertToStyle(selectedText, style);

      // Replace selection
      activeTextarea.value = 
        activeTextarea.value.substring(0, start) +
        formatted +
        activeTextarea.value.substring(end);

      // Restore selection
      activeTextarea.selectionStart = start;
      activeTextarea.selectionEnd = start + formatted.length;

      // Trigger input event for auto-save
      activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));

      console.log(`[KeyboardShortcuts] Applied ${style} formatting`);
    },

    /**
     * Converts case of selected text
     * @param {string} caseType
     */
    convertCase(caseType) {
      if (!activeTextarea || typeof TextFormatter === 'undefined') return;

      const start = activeTextarea.selectionStart;
      const end = activeTextarea.selectionEnd;
      const selectedText = activeTextarea.value.substring(start, end);

      if (!selectedText) return;

      // Convert case using TextFormatter
      const converted = TextFormatter.convertCase(selectedText, caseType);

      // Replace selection
      activeTextarea.value = 
        activeTextarea.value.substring(0, start) +
        converted +
        activeTextarea.value.substring(end);

      // Restore selection
      activeTextarea.selectionStart = start;
      activeTextarea.selectionEnd = start + converted.length;

      // Trigger input event
      activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));

      console.log(`[KeyboardShortcuts] Applied ${caseType} case conversion`);
    },

    /**
     * Closes preview modal
     */
    closeModal() {
      const modal = document.querySelector('.case-comment-preview-modal');
      if (modal) {
        modal.remove();
        console.log('[KeyboardShortcuts] Closed preview modal');
      }
    },

    /**
     * Opens restore comment menu
     */
    openRestoreMenu() {
      const restoreButton = document.querySelector('.case-comment-restore-button');
      if (restoreButton) {
        restoreButton.click();
        console.log('[KeyboardShortcuts] Opened restore menu');
      }
    },

    /**
     * Enables keyboard shortcuts
     */
    enable() {
      isEnabled = true;
      console.log('[KeyboardShortcuts] Enabled');
    },

    /**
     * Disables keyboard shortcuts
     */
    disable() {
      isEnabled = false;
      console.log('[KeyboardShortcuts] Disabled');
    },

    /**
     * Gets all shortcuts
     * @returns {Object}
     */
    getAll() {
      return { ...shortcuts };
    },

    /**
     * Gets shortcuts by category
     * @param {string} category - 'formatting', 'case', 'ui'
     * @returns {Object}
     */
    getByCategory(category) {
      const categories = {
        formatting: ['bold', 'italic', 'code', 'boldserif', 'bolditalic', 'normal'],
        case: ['uppercase', 'lowercase', 'togglecase'],
        ui: ['closeModal', 'restoreComment']
      };

      const actions = categories[category] || [];
      const result = {};

      for (const [key, shortcut] of Object.entries(shortcuts)) {
        if (actions.includes(shortcut.action)) {
          result[key] = shortcut;
        }
      }

      return result;
    },

    /**
     * Checks if shortcuts are enabled
     * @returns {boolean}
     */
    isEnabled() {
      return isEnabled;
    },

    /**
     * Gets help text for all shortcuts
     * @returns {string}
     */
    getHelpText() {
      const lines = ['Keyboard Shortcuts:', ''];

      // Formatting
      lines.push('Text Formatting:');
      const formatting = this.getByCategory('formatting');
      for (const [key, shortcut] of Object.entries(formatting)) {
        lines.push(`  ${key} - ${shortcut.description}`);
      }
      lines.push('');

      // Case
      lines.push('Case Conversion:');
      const caseShortcuts = this.getByCategory('case');
      for (const [key, shortcut] of Object.entries(caseShortcuts)) {
        lines.push(`  ${key} - ${shortcut.description}`);
      }
      lines.push('');

      // UI
      lines.push('UI Actions:');
      const ui = this.getByCategory('ui');
      for (const [key, shortcut] of Object.entries(ui)) {
        lines.push(`  ${key} - ${shortcut.description}`);
      }

      return lines.join('\n');
    },

    /**
     * Cleanup method
     */
    cleanup() {
      // Event listeners are added with 'true' (capture), so they'll be automatically removed
      // when the page navigates away. No explicit cleanup needed.
      activeTextarea = null;
      console.log('[KeyboardShortcuts] Cleanup complete');
    }
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.KeyboardShortcuts = KeyboardShortcuts;
}
