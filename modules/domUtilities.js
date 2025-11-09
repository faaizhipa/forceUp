/**
 * DOM Utilities Module
 * Provides common DOM manipulation and utility functions
 *
 * @module domUtilities
 */

const DomUtilities = (() => {
    'use strict';

    /**
     * Escapes special XML characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeXML(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Copies text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                console.log('[DomUtilities] Text copied using navigator.clipboard');
                return true;
            } else {
                console.log('[DomUtilities] Attempting fallback copy...');
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (successful) {
                    console.log('[DomUtilities] Fallback copy successful');
                    return true;
                } else {
                    console.error('[DomUtilities] Fallback copy failed');
                    return false;
                }
            }
        } catch (err) {
            console.error('[DomUtilities] Failed to copy text:', err);
            return false;
        }
    }

    /**
     * Checks if an element is visible
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} True if element is visible
     */
    function isElementVisible(element) {
        if (!element) return false;

        // Check if element or any parent has display:none or visibility:hidden
        let current = element;
        while (current && current !== document.body) {
            const style = window.getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            current = current.parentElement;
        }

        // Check if element has dimensions
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    // Public API
    return {
        escapeXML,
        copyToClipboard,
        isElementVisible
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DomUtilities;
}
