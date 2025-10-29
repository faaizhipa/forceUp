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
      // Keep reference for longer to allow context menu operations
      setTimeout(() => {
        // Only clear if focus moved to something that's not a textarea
        if (document.activeElement && 
            document.activeElement.tagName !== 'TEXTAREA' && 
            !document.activeElement.isContentEditable) {
          // Don't clear immediately - context menu might still be open
          setTimeout(() => {
            activeTextarea = null;
          }, 2000);
        }
      }, 100);
    });

    // Track mousedown on textareas to maintain reference
    document.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'TEXTAREA' || 
          (e.target.tagName === 'DIV' && e.target.isContentEditable)) {
        activeTextarea = e.target;
      }
    }, true);
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
      
      // Restore cursor position and select the newly formatted text
      const newStart = context.start;
      const newEnd = context.start + formattedText.length;
      textarea.setSelectionRange(newStart, newEnd);
      
      // Focus the textarea to maintain context
      textarea.focus();
      
      // Trigger input event for auto-save
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      
      console.log('[ContextMenuHandler] Replaced text in textarea');
    } else if (context.type === 'contenteditable') {
      // For contenteditable
      const range = context.range;
      range.deleteContents();
      const textNode = document.createTextNode(formattedText);
      range.insertNode(textNode);
      
      // Select the newly inserted text
      range.setStartBefore(textNode);
      range.setEndAfter(textNode);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      console.log('[ContextMenuHandler] Replaced text in contenteditable');
    }

    // Keep active textarea reference - don't clear it
    // This allows multiple consecutive formatting operations
  }

  /**
   * Handles context menu click from background script
   * @param {Object} info - Context menu click info
   */
  function handleContextMenuClick(info) {
    console.log('[ContextMenuHandler] Context menu clicked:', info.menuItemId);

    // Handle symbol insertion (can work without selection)
    if (info.menuItemId.startsWith('exlibris-symbol-')) {
      const symbol = info.menuItemId.replace('exlibris-symbol-', '');
      
      // Check if there's a selection
      const context = getSelectionContext();
      
      if (context && context.text) {
        // If there's selected text, append symbol after it
        const formattedText = context.text + ' ' + symbol;
        replaceSelection(formattedText);
      } else {
        // If no selection, just insert symbol at cursor position
        insertSymbolAtCursor(symbol);
      }
      return;
    }

    // For all other formatting options, selection is required
    const context = getSelectionContext();
    if (!context) {
      console.warn('[ContextMenuHandler] No selection available for formatting');
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

    // Replace the selected text
    if (formattedText !== selectedText) {
      replaceSelection(formattedText);
    }
  }

  /**
   * Inserts symbol at cursor position (no selection needed)
   * @param {string} symbol
   */
  function insertSymbolAtCursor(symbol) {
    if (!activeTextarea) {
      console.warn('[ContextMenuHandler] No active textarea for symbol insertion');
      return;
    }

    if (activeTextarea.tagName === 'TEXTAREA') {
      const start = activeTextarea.selectionStart || 0;
      const end = activeTextarea.selectionEnd || 0;
      const before = activeTextarea.value.substring(0, start);
      const after = activeTextarea.value.substring(end);
      
      activeTextarea.value = before + symbol + after;
      
      // Place cursor after the symbol
      const newPos = start + symbol.length;
      activeTextarea.setSelectionRange(newPos, newPos);
      activeTextarea.focus();
      
      // Trigger input event
      activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      
      console.log('[ContextMenuHandler] Inserted symbol at cursor');
    } else if (activeTextarea.isContentEditable) {
      // For contenteditable
      const selection = window.getSelection();
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange();
      
      range.deleteContents();
      range.insertNode(document.createTextNode(symbol));
      range.collapse(false);
      
      selection.removeAllRanges();
      selection.addRange(range);
      
      console.log('[ContextMenuHandler] Inserted symbol in contenteditable');
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
