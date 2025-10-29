/**
 * Comment Enhancements Module
 * 
 * Provides productivity enhancements for case comment text areas including:
 * - Unicode text styling (bold, italic, monospace)
 * - Context menu with text manipulation tools
 * - Symbol insertion and case transformation
 * - Auto-save comment memory with restore functionality
 * - Live character counter
 * - Collapsible side panel with notepad and code editor
 * 
 * @module CommentEnhancements
 */

import { EventBus } from '../core/eventBus.js';
import { StorageManager } from '../core/storageManager.js';

/**
 * A map of standard alphanumeric characters to their Unicode counterparts for various styles.
 * @description This constant object provides the character mappings necessary to "fake" bold,
 * italic, and monospace styles in a plain text area by substituting standard characters
 * with their styled Unicode equivalents.
 * @const {object}
 */
const CHAR_MAPS = {
    bold: { 'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇', 'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭', '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵' },
    italic: { 'a': '𝘢', 'b': '𝘣', 'c': '𝘤', 'd': '𝘥', 'e': '𝘦', 'f': '𝘧', 'g': '𝘨', 'h': '𝘩', 'i': '𝘪', 'j': '𝘫', 'k': '𝘬', 'l': '𝘭', 'm': '𝘮', 'n': '𝘯', 'o': '𝘰', 'p': '𝘱', 'q': '𝘲', 'r': '𝘳', 's': '𝘴', 't': '𝘵', 'u': '𝘶', 'v': '𝘷', 'w': '𝘸', 'x': '𝘹', 'y': '𝘺', 'z': '𝘻', 'A': '𝘈', 'B': '𝘉', 'C': '𝘊', 'D': '𝘋', 'E': '𝘌', 'F': '𝘍', 'G': '𝘎', 'H': '𝘏', 'I': '𝘐', 'J': '𝘑', 'K': '𝘒', 'L': '𝘓', 'M': '𝘔', 'N': '𝘕', 'O': '𝘖', 'P': '𝘗', 'Q': '𝘘', 'R': '𝘙', 'S': '𝘚', 'T': '𝘛', 'U': '𝘜', 'V': '𝘝', 'W': '𝘞', 'X': '𝘟', 'Y': '𝘠', 'Z': '𝘡' },
    code: { 'a': '𝚊', 'b': '𝚋', 'c': '𝚌', 'd': '𝚍', 'e': '𝚎', 'f': '𝚏', 'g': '𝚐', 'h': '𝚑', 'i': '𝚒', 'j': '𝚓', 'k': '𝚔', 'l': '𝚕', 'm': '𝚖', 'n': '𝚗', 'o': '𝚘', 'p': '𝚙', 'q': '𝚚', 'r': '𝚛', 's': '𝚜', 't': '𝚝', 'u': '𝚞', 'v': '𝚟', 'w': '𝚠', 'x': '𝚡', 'y': '𝚢', 'z': '𝚣', 'A': '𝙰', 'B': '𝙱', 'C': '𝙲', 'D': '𝙳', 'E': '𝙴', 'F': '𝙵', 'G': '𝙶', 'H': '𝙷', 'I': '𝙸', 'J': '𝙹', 'K': '𝙺', 'L': '𝙻', 'M': '𝙼', 'N': '𝙽', 'O': '𝙾', 'P': '𝙿', 'Q': '𝚀', 'R': '𝚁', 'S': '𝚂', 'T': '𝚃', 'U': '𝚄', 'V': '𝚅', 'W': '𝚆', 'X': '𝚇', 'Y': '𝚈', 'Z': '𝚉', '0': '𝟶', '1': '𝟷', '2': '𝟸', '3': '𝟹', '4': '𝟺', '5': '𝟻', '6': '𝟼', '7': '𝟽', '8': '𝟾', '9': '𝟿' }
};

/**
 * Collection of symbols available for insertion via context menu
 * @const {Array<string>}
 */
const INSERTION_SYMBOLS = ['▪', '∘', '▫', '►', '▻', '▸', '▹', '▿', '▾', '⋯', '⋮'];

/**
 * Collection of case transformation types
 * @const {Array<string>}
 */
const CASE_TYPES = ['Toggle Case', 'Capital Case', 'Sentence Case', 'Lower Case'];

/**
 * CSS styles for the context menu
 * @const {object}
 */
const MENU_STYLES = {
    position: 'absolute',
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '5px',
    zIndex: '10000',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px'
};

/**
 * CSS styles for menu buttons
 * @const {object}
 */
const BUTTON_STYLES = {
    display: 'block',
    width: '100%',
    padding: '4px 8px',
    margin: '1px 0',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    textAlign: 'left'
};

/**
 * CommentEnhancements class manages all comment-related productivity features
 */
export class CommentEnhancements {
    constructor() {
        this.storageManager = null;
        this.eventBus = null;
        this.initialized = false;
        this.saveTimeout = null;
        this.currentCaseId = null;
    }

    /**
     * Initialize the comment enhancements module
     * @param {StorageManager} storageManager - Storage manager instance
     * @param {EventBus} eventBus - Event bus instance
     */
    async initialize(storageManager, eventBus) {
        try {
            this.storageManager = storageManager;
            this.eventBus = eventBus;
            
            // Extract case ID from URL
            this.currentCaseId = this.extractCaseId();
            if (!this.currentCaseId) {
                console.warn('[CommentEnhancements] No case ID found in URL');
                return;
            }

            await this.initializeCommentEnhancements();
            this.initialized = true;
            
            console.log('[CommentEnhancements] Initialized successfully');
        } catch (error) {
            console.error('[CommentEnhancements] Initialization failed:', error);
        }
    }

    /**
     * Extract case ID from the current URL
     * @returns {string|null} Case ID or null if not found
     */
    extractCaseId() {
        const match = window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{18})/);
        return match ? match[1] : null;
    }

    /**
     * Main initialization function for all comment enhancement features
     * @private
     */
    async initializeCommentEnhancements() {
        const commentTextArea = document.querySelector('textarea[name="inputComment"]');
        if (!commentTextArea) {
            console.warn('[CommentEnhancements] Comment textarea not found');
            return;
        }

        // Initialize all enhancement features
        await this.initCommentMemory(commentTextArea);
        this.initCharacterCounter(commentTextArea);
        this.initContextMenu(commentTextArea);
        this.initSidePanel();

        console.log('[CommentEnhancements] All features initialized');
    }

    /**
     * Initialize context menu for text selection
     * @param {HTMLTextAreaElement} textarea - Target textarea
     * @private
     */
    initContextMenu(textarea) {
        // Add selection event listener
        textarea.addEventListener('select', (event) => {
            const selection = window.getSelection().toString();
            if (selection.length > 0) {
                this.createContextMenu(event.clientX, event.clientY, textarea);
            }
        });

        // Remove menu on click outside
        document.addEventListener('click', () => {
            this.removeContextMenu();
        });
    }

    /**
     * Create and display context menu for text manipulation
     * @param {number} x - X coordinate for menu position
     * @param {number} y - Y coordinate for menu position
     * @param {HTMLTextAreaElement} textarea - Target textarea
     * @private
     */
    createContextMenu(x, y, textarea) {
        this.removeContextMenu();

        const menu = document.createElement('div');
        menu.id = 'case-comment-context-menu';
        
        // Apply menu styles
        Object.assign(menu.style, MENU_STYLES);
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // Add style buttons (Bold, Italic, Code)
        ['bold', 'italic', 'code'].forEach(style => {
            const button = this.createMenuButton(
                style.charAt(0).toUpperCase() + style.slice(1),
                () => this.applyStyle(style, textarea)
            );
            menu.appendChild(button);
        });

        // Add symbols button
        const symbolButton = this.createMenuButton('Symbols', (e) => {
            e.stopPropagation();
            this.createSymbolSubMenu(e.target, textarea);
        });
        menu.appendChild(symbolButton);

        // Add case button
        const caseButton = this.createMenuButton('Case', (e) => {
            e.stopPropagation();
            this.createCaseSubMenu(e.target, textarea);
        });
        menu.appendChild(caseButton);

        document.body.appendChild(menu);
    }

    /**
     * Create a styled menu button
     * @param {string} text - Button text
     * @param {Function} clickHandler - Click event handler
     * @returns {HTMLButtonElement} Created button element
     * @private
     */
    createMenuButton(text, clickHandler) {
        const button = document.createElement('button');
        button.textContent = text;
        Object.assign(button.style, BUTTON_STYLES);
        
        // Add hover effect
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#f0f0f0';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'transparent';
        });
        
        button.onclick = clickHandler;
        return button;
    }

    /**
     * Create submenu for symbol insertion
     * @param {HTMLElement} parentButton - Parent button element
     * @param {HTMLTextAreaElement} textarea - Target textarea
     * @private
     */
    createSymbolSubMenu(parentButton, textarea) {
        const subMenu = document.createElement('div');
        const rect = parentButton.getBoundingClientRect();
        
        Object.assign(subMenu.style, MENU_STYLES);
        subMenu.style.left = `${rect.right + 5}px`;
        subMenu.style.top = `${rect.top}px`;
        subMenu.className = 'comment-submenu';

        INSERTION_SYMBOLS.forEach(symbol => {
            const button = this.createMenuButton(symbol, () => {
                this.insertText(symbol, textarea);
                this.removeContextMenu();
            });
            subMenu.appendChild(button);
        });

        document.body.appendChild(subMenu);
    }

    /**
     * Create submenu for case transformation
     * @param {HTMLElement} parentButton - Parent button element  
     * @param {HTMLTextAreaElement} textarea - Target textarea
     * @private
     */
    createCaseSubMenu(parentButton, textarea) {
        const subMenu = document.createElement('div');
        const rect = parentButton.getBoundingClientRect();
        
        Object.assign(subMenu.style, MENU_STYLES);
        subMenu.style.left = `${rect.right + 5}px`;
        subMenu.style.top = `${rect.top}px`;
        subMenu.className = 'comment-submenu';

        CASE_TYPES.forEach(caseType => {
            const button = this.createMenuButton(caseType, () => {
                this.toggleCase(caseType, textarea);
                this.removeContextMenu();
            });
            subMenu.appendChild(button);
        });

        document.body.appendChild(subMenu);
    }

    /**
     * Remove context menu and any submenus
     * @private
     */
    removeContextMenu() {
        const menu = document.getElementById('case-comment-context-menu');
        if (menu) {
            menu.remove();
        }
        
        // Remove any submenus
        document.querySelectorAll('.comment-submenu').forEach(submenu => {
            submenu.remove();
        });
    }

    /**
     * Apply Unicode style to selected text
     * @param {string} style - Style to apply (bold, italic, code)
     * @param {HTMLTextAreaElement} textarea - Target textarea
     * @private
     */
    applyStyle(style, textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const map = CHAR_MAPS[style];

        const transformedText = selectedText.split('').map(char => map[char] || char).join('');
        textarea.setRangeText(transformedText, start, end, 'select');
        
        this.removeContextMenu();
    }

    /**
     * Insert text at cursor position
     * @param {string} text - Text to insert
     * @param {HTMLTextAreaElement} textarea - Target textarea
     * @private
     */
    insertText(text, textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.setRangeText(text, start, end, 'end');
    }

    /**
     * Transform case of selected text
     * @param {string} caseType - Type of case transformation
     * @param {HTMLTextAreaElement} textarea - Target textarea
     * @private
     */
    toggleCase(caseType, textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        let selectedText = textarea.value.substring(start, end);

        switch (caseType) {
            case 'Toggle Case':
                selectedText = selectedText.split('').map(c => 
                    c.toUpperCase() === c ? c.toLowerCase() : c.toUpperCase()
                ).join('');
                break;
            case 'Capital Case':
                selectedText = selectedText.split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');
                break;
            case 'Sentence Case':
                selectedText = selectedText.charAt(0).toUpperCase() + selectedText.slice(1).toLowerCase();
                break;
            case 'Lower Case':
                selectedText = selectedText.toLowerCase();
                break;
        }

        textarea.setRangeText(selectedText, start, end, 'select');
    }

    /**
     * Initialize comment memory (auto-save/restore)
     * @param {HTMLTextAreaElement} textarea - Target textarea
     * @private
     */
    async initCommentMemory(textarea) {
        if (!this.currentCaseId) return;

        const storageKey = `comment_${this.currentCaseId}`;

        // Add input listener for auto-save
        textarea.addEventListener('input', () => {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(async () => {
                const text = textarea.value;
                if (text.length > 0) {
                    await this.storageManager.setLocal(storageKey, text);
                } else {
                    await this.storageManager.removeLocal(storageKey);
                }
            }, 500);
        });

        // Create restore button
        const restoreButton = document.createElement('button');
        restoreButton.textContent = 'Restore';
        restoreButton.style.marginLeft = '10px';
        restoreButton.style.padding = '4px 8px';
        restoreButton.style.fontSize = '12px';
        restoreButton.style.cursor = 'pointer';
        
        restoreButton.onclick = async () => {
            try {
                const savedText = await this.storageManager.getLocal(storageKey);
                if (savedText) {
                    textarea.value = savedText;
                    // Trigger input event to update character counter
                    textarea.dispatchEvent(new Event('input'));
                }
            } catch (error) {
                console.error('[CommentEnhancements] Error restoring comment:', error);
            }
        };

        textarea.parentElement.appendChild(restoreButton);
    }

    /**
     * Initialize live character counter
     * @param {HTMLTextAreaElement} textarea - Target textarea
     * @private
     */
    initCharacterCounter(textarea) {
        const counter = document.createElement('span');
        counter.style.marginLeft = '10px';
        counter.style.fontSize = '12px';
        counter.style.color = '#666';
        counter.id = 'character-counter';

        const updateCounter = () => {
            const length = textarea.value.length;
            counter.textContent = `${length} character${length !== 1 ? 's' : ''}`;
        };

        textarea.addEventListener('input', updateCounter);
        updateCounter(); // Initial count

        textarea.parentElement.appendChild(counter);
    }

    /**
     * Initialize collapsible side panel with notepad and code editor
     * @private
     */
    initSidePanel() {
        // Create side panel
        const sidePanel = document.createElement('div');
        sidePanel.id = 'case-comment-side-panel';
        sidePanel.style.cssText = `
            position: fixed;
            top: 0;
            right: -350px;
            width: 350px;
            height: 100vh;
            background: white;
            border-left: 1px solid #ccc;
            z-index: 9999;
            transition: right 0.3s ease;
            overflow-y: auto;
            box-shadow: -2px 0 5px rgba(0,0,0,0.1);
        `;

        sidePanel.innerHTML = `
            <div style="padding: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; font-size: 16px;">Comment Tools</h3>
                    <button id="close-side-panel" style="background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Notepad</h4>
                    <textarea id="side-panel-notepad" style="width: 100%; height: 200px; border: 1px solid #ccc; padding: 8px; resize: vertical;" placeholder="Quick notes..."></textarea>
                </div>
                
                <div>
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Code Editor</h4>
                    <textarea id="side-panel-code" style="width: 100%; height: 200px; border: 1px solid #ccc; padding: 8px; font-family: 'Courier New', monospace; resize: vertical;" placeholder="Code snippets..."></textarea>
                </div>
            </div>
        `;

        document.body.appendChild(sidePanel);

        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Notes';
        toggleButton.style.cssText = `
            position: fixed;
            top: 50%;
            right: 10px;
            transform: translateY(-50%);
            background: #0070d2;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            z-index: 10000;
            font-size: 12px;
        `;

        document.body.appendChild(toggleButton);

        // Toggle functionality
        const togglePanel = () => {
            const panel = document.getElementById('case-comment-side-panel');
            const isOpen = panel.style.right === '0px';
            panel.style.right = isOpen ? '-350px' : '0px';
            toggleButton.textContent = isOpen ? 'Notes' : 'Close';
        };

        toggleButton.addEventListener('click', togglePanel);
        
        // Close button functionality
        document.getElementById('close-side-panel').addEventListener('click', togglePanel);

        // Save notepad and code content to storage
        this.initSidePanelStorage();
    }

    /**
     * Initialize storage for side panel content
     * @private
     */
    async initSidePanelStorage() {
        if (!this.storageManager || !this.currentCaseId) return;

        const notepadKey = `notepad_${this.currentCaseId}`;
        const codeKey = `code_${this.currentCaseId}`;

        const notepad = document.getElementById('side-panel-notepad');
        const codeEditor = document.getElementById('side-panel-code');

        if (!notepad || !codeEditor) return;

        // Load saved content
        try {
            const savedNotepad = await this.storageManager.getLocal(notepadKey);
            const savedCode = await this.storageManager.getLocal(codeKey);
            
            if (savedNotepad) notepad.value = savedNotepad;
            if (savedCode) codeEditor.value = savedCode;
        } catch (error) {
            console.error('[CommentEnhancements] Error loading side panel content:', error);
        }

        // Auto-save functionality
        let notepadTimeout, codeTimeout;

        notepad.addEventListener('input', () => {
            clearTimeout(notepadTimeout);
            notepadTimeout = setTimeout(async () => {
                try {
                    await this.storageManager.setLocal(notepadKey, notepad.value);
                } catch (error) {
                    console.error('[CommentEnhancements] Error saving notepad:', error);
                }
            }, 500);
        });

        codeEditor.addEventListener('input', () => {
            clearTimeout(codeTimeout);
            codeTimeout = setTimeout(async () => {
                try {
                    await this.storageManager.setLocal(codeKey, codeEditor.value);
                } catch (error) {
                    console.error('[CommentEnhancements] Error saving code:', error);
                }
            }, 500);
        });
    }

    /**
     * Clean up resources and event listeners
     */
    destroy() {
        this.removeContextMenu();
        
        // Clear any pending timeouts
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Remove side panel elements
        const sidePanel = document.getElementById('case-comment-side-panel');
        const toggleButton = document.querySelector('button[style*="position: fixed"][style*="right: 10px"]');
        
        if (sidePanel) sidePanel.remove();
        if (toggleButton) toggleButton.remove();

        this.initialized = false;
        console.log('[CommentEnhancements] Destroyed');
    }

    /**
     * Check if module is initialized
     * @returns {boolean} Initialization status
     */
    isInitialized() {
        return this.initialized;
    }
}

// Create singleton instance
export const commentEnhancements = new CommentEnhancements();
export default commentEnhancements;