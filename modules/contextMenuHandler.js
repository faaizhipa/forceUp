/**
 * Context Menu Handler Module
 * Manages Chrome context menu for text formatting in Salesforce textareas
 * 
 * This module works with background.js to create context menus and
 * communicates with TextFormatter to apply formatting to selected text.
 */

const ContextMenuHandler = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  
  let isInitialized = false;
  let activeTextarea = null;
  let lastSelection = null;

  // Context menu IDs
  const MENU_IDS = {
    PARENT: 'exlibris-text-format',
    
    // Style submenu
    STYLE_PARENT: 'exlibris-style',
    STYLE_BOLD: 'exlibris-style-bold',
    STYLE_ITALIC: 'exlibris-style-italic',
    STYLE_BOLD_ITALIC: 'exlibris-style-bolditalic',
    STYLE_BOLD_SERIF: 'exlibris-style-boldserif',
    STYLE_CODE: 'exlibris-style-code',
    STYLE_NORMAL: 'exlibris-style-normal',
    
    // Case submenu
    CASE_PARENT: 'exlibris-case',
    CASE_TOGGLE: 'exlibris-case-toggle',
    CASE_UPPER: 'exlibris-case-upper',
    CASE_LOWER: 'exlibris-case-lower',
    CASE_CAPITAL: 'exlibris-case-capital',
    CASE_SENTENCE: 'exlibris-case-sentence',
    
    // Symbols submenu
    SYMBOLS_PARENT: 'exlibris-symbols'
  };

  // ========== PRIVATE FUNCTIONS ==========

  /**
   * Tracks the currently focused textarea
   */
  function trackActiveTextarea() {
    document.addEventListener('focusin', (e) => {
      if (e.target.tagName === 'TEXTAREA' || 
          (e.target.tagName === 'DIV' && e.target.isContentEditable)) {
        activeTextarea = e.target;
        console.log('[ContextMenuHandler] Active textarea:', e.target);
      }
    });

    document.addEventListener('focusout', (e) => {
      // Keep reference for a short time in case context menu is opened
      setTimeout(() => {
        if (document.activeElement !== activeTextarea) {
          activeTextarea = null;
        }
      }, 500);
    });
  }

  /**
   * Tracks selection changes
   */
  function trackSelection() {
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        lastSelection = {
          text: selection.toString(),
          range: selection.getRangeAt(0)
        };
      }
    });
  }

  /**
   * Gets the current selection and its context
   * @returns {Object|null}
   */
  function getSelectionContext() {
    if (!activeTextarea) return null;

    const selection = window.getSelection();
    const selectedText = selection.toString();

    if (!selectedText) return null;

    // For textarea elements
    if (activeTextarea.tagName === 'TEXTAREA') {
      return {
        text: selectedText,
        start: activeTextarea.selectionStart,
        end: activeTextarea.selectionEnd,
        element: activeTextarea,
        type: 'textarea'
      };
    }

    // For contenteditable elements
    if (activeTextarea.isContentEditable) {
      return {
        text: selectedText,
        range: selection.getRangeAt(0),
        element: activeTextarea,
        type: 'contenteditable'
      };
    }

    return null;
  }

  /**
   * Replaces selected text with formatted text
   * @param {string} formattedText
   */
  function replaceSelection(formattedText) {
    const context = getSelectionContext();
    if (!context) {
      console.warn('[ContextMenuHandler] No selection context available');
      return;
    }

    if (context.type === 'textarea') {
      // For textarea
      const textarea = context.element;
      const before = textarea.value.substring(0, context.start);
      const after = textarea.value.substring(context.end);
      
      textarea.value = before + formattedText + after;
      
      // Restore cursor position
      const newEnd = context.start + formattedText.length;
      textarea.setSelectionRange(newEnd, newEnd);
      
      // Trigger input event for auto-save
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      
      console.log('[ContextMenuHandler] Replaced text in textarea');
    } else if (context.type === 'contenteditable') {
      // For contenteditable
      const range = context.range;
      range.deleteContents();
      range.insertNode(document.createTextNode(formattedText));
      
      // Move cursor to end of inserted text
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      console.log('[ContextMenuHandler] Replaced text in contenteditable');
    }

    // Clear active textarea after replacement
    setTimeout(() => {
      activeTextarea = null;
    }, 100);
  }

  /**
   * Handles context menu click from background script
   * @param {Object} info - Context menu click info
   */
  function handleContextMenuClick(info) {
    console.log('[ContextMenuHandler] Context menu clicked:', info.menuItemId);

    const context = getSelectionContext();
    if (!context) {
      console.warn('[ContextMenuHandler] No selection available');
      return;
    }

    const selectedText = context.text;
    let formattedText = selectedText;

    // Handle style conversions
    if (info.menuItemId === MENU_IDS.STYLE_BOLD) {
      formattedText = TextFormatter.convertToStyle(selectedText, 'bold');
    } else if (info.menuItemId === MENU_IDS.STYLE_ITALIC) {
      formattedText = TextFormatter.convertToStyle(selectedText, 'italic');
    } else if (info.menuItemId === MENU_IDS.STYLE_BOLD_ITALIC) {
      formattedText = TextFormatter.convertToStyle(selectedText, 'boldItalic');
    } else if (info.menuItemId === MENU_IDS.STYLE_BOLD_SERIF) {
      formattedText = TextFormatter.convertToStyle(selectedText, 'boldSerif');
    } else if (info.menuItemId === MENU_IDS.STYLE_CODE) {
      formattedText = TextFormatter.convertToStyle(selectedText, 'code');
    } else if (info.menuItemId === MENU_IDS.STYLE_NORMAL) {
      formattedText = TextFormatter.convertToNormal(selectedText);
    }
    // Handle case conversions
    else if (info.menuItemId === MENU_IDS.CASE_TOGGLE) {
      formattedText = TextFormatter.toggleCase(selectedText);
    } else if (info.menuItemId === MENU_IDS.CASE_UPPER) {
      formattedText = selectedText.toUpperCase();
    } else if (info.menuItemId === MENU_IDS.CASE_LOWER) {
      formattedText = TextFormatter.toLowerCase(selectedText);
    } else if (info.menuItemId === MENU_IDS.CASE_CAPITAL) {
      formattedText = TextFormatter.toCapitalCase(selectedText);
    } else if (info.menuItemId === MENU_IDS.CASE_SENTENCE) {
      formattedText = TextFormatter.toSentenceCase(selectedText);
    }
    // Handle symbol insertion
    else if (info.menuItemId.startsWith('exlibris-symbol-')) {
      const symbol = info.menuItemId.replace('exlibris-symbol-', '');
      formattedText = selectedText + ' ' + symbol;
    }

    // Replace the selected text
    if (formattedText !== selectedText) {
      replaceSelection(formattedText);
    }
  }

  // ========== PUBLIC API ==========

  return {
    /**
     * Initializes the context menu handler
     */
    init() {
      if (isInitialized) return;

      console.log('[ContextMenuHandler] Initializing...');

      // Track active textarea and selections
      trackActiveTextarea();
      trackSelection();

      // Listen for messages from background script
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'contextMenuClick') {
          handleContextMenuClick(request.info);
          sendResponse({ success: true });
        }
        return true;
      });

      // Context menus are created once by background.js on install/update
      // No need to request creation here

      isInitialized = true;
      console.log('[ContextMenuHandler] Initialized');
    },

    /**
     * Gets menu IDs for background script
     * @returns {Object}
     */
    getMenuIds() {
      return MENU_IDS;
    },

    /**
     * Manually applies formatting to selection
     * @param {string} formatType - 'bold', 'italic', etc.
     */
    applyFormatting(formatType) {
      const context = getSelectionContext();
      if (!context) return;

      let formattedText;
      if (formatType === 'normal') {
        formattedText = TextFormatter.convertToNormal(context.text);
      } else {
        formattedText = TextFormatter.convertToStyle(context.text, formatType);
      }

      replaceSelection(formattedText);
    },

    /**
     * Inserts a symbol at cursor
     * @param {string} symbol
     */
    insertSymbol(symbol) {
      if (!activeTextarea) return;

      if (activeTextarea.tagName === 'TEXTAREA') {
        const start = activeTextarea.selectionStart;
        const end = activeTextarea.selectionEnd;
        const before = activeTextarea.value.substring(0, start);
        const after = activeTextarea.value.substring(end);
        
        activeTextarea.value = before + symbol + after;
        activeTextarea.setSelectionRange(start + symbol.length, start + symbol.length);
        activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },

    /**
     * Checks if context menu is available
     * @returns {boolean}
     */
    isAvailable() {
      return isInitialized && activeTextarea !== null;
    },

    /**
     * Cleans up the module
     */
    cleanup() {
      if (!isInitialized) return;
      
      console.log('[ContextMenuHandler] Cleaning up...');
      activeTextarea = null;
      lastSelection = null;
      isInitialized = false;
    }
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContextMenuHandler;
}
