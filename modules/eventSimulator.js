/**
 * EventSimulator Module
 * Safely dispatches user-like events with visibility and state checks
 * Handles Shadow DOM event propagation
 */

const EventSimulator = {
    /**
     * Check if element is visible
     * @param {Element} element - Element to check
     * @returns {boolean} True if visible
     */
    isVisible(element) {
        if (!element) return false;
        
        // Check if element is in DOM
        if (!element.offsetParent && element !== document.body) {
            return false;
        }

        // Check bounding rect
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return false;
        }

        // Check computed style
        try {
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
        } catch (e) {
            // Continue if getComputedStyle fails
        }

        return true;
    },

    /**
     * Check if element is enabled
     * @param {Element} element - Element to check
     * @returns {boolean} True if enabled
     */
    isEnabled(element) {
        if (!element) return false;

        // Check disabled attribute
        if (element.disabled === true) {
            return false;
        }

        // Check aria-disabled
        if (element.getAttribute('aria-disabled') === 'true') {
            return false;
        }

        return true;
    },

    /**
     * Simulate click on element
     * @param {string|Element} target - Selector or element
     * @param {Object} options - Event options
     * @returns {boolean} True if click was dispatched
     */
    click(target, options = {}) {
        // Get element
        const element = typeof target === 'string' ? document.querySelector(target) : target;

        if (!element) {
            console.warn('[EXL] EventSimulator: Element not found for click');
            return false;
        }

        // Verify visibility
        if (!this.isVisible(element)) {
            console.warn('[EXL] EventSimulator: Element not visible, skipping click');
            return false;
        }

        // Verify enabled state
        if (!this.isEnabled(element)) {
            console.warn('[EXL] EventSimulator: Element disabled, skipping click');
            return false;
        }

        // Create and dispatch click event
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            composed: true, // Critical for Shadow DOM
            view: window,
            ...options
        });

        element.dispatchEvent(clickEvent);
        console.log('[EXL] EventSimulator: Click dispatched successfully');
        return true;
    },

    /**
     * Activate tab by label text
     * @param {string} labelText - Text content of tab to activate
     * @returns {boolean} True if tab was activated
     */
    activateTabByLabel(labelText) {
        // Common Salesforce tab selectors
        const selectors = [
            'a[role="tab"]',
            'button[role="tab"]',
            '.slds-tabs_default__item a',
            '.slds-tabs--default__item a'
        ];

        for (const selector of selectors) {
            const tabs = document.querySelectorAll(selector);
            
            for (const tab of tabs) {
                if (tab.textContent?.trim() === labelText) {
                    console.log(`[EXL] EventSimulator: Found tab with label "${labelText}"`);
                    return this.click(tab);
                }
            }
        }

        console.warn(`[EXL] EventSimulator: Tab not found with label "${labelText}"`);
        return false;
    },

    /**
     * Dispatch input event (for text fields)
     * @param {string|Element} target - Selector or element
     * @param {string} value - Value to set
     * @returns {boolean} True if successful
     */
    input(target, value) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;

        if (!element) {
            console.warn('[EXL] EventSimulator: Element not found for input');
            return false;
        }

        if (!this.isVisible(element) || !this.isEnabled(element)) {
            console.warn('[EXL] EventSimulator: Element not ready for input');
            return false;
        }

        // Set value
        element.value = value;

        // Dispatch input event
        const inputEvent = new Event('input', {
            bubbles: true,
            composed: true
        });
        element.dispatchEvent(inputEvent);

        // Dispatch change event
        const changeEvent = new Event('change', {
            bubbles: true,
            composed: true
        });
        element.dispatchEvent(changeEvent);

        console.log('[EXL] EventSimulator: Input event dispatched');
        return true;
    },

    /**
     * Focus element
     * @param {string|Element} target - Selector or element
     * @returns {boolean} True if successful
     */
    focus(target) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;

        if (!element) {
            console.warn('[EXL] EventSimulator: Element not found for focus');
            return false;
        }

        if (!this.isVisible(element)) {
            console.warn('[EXL] EventSimulator: Element not visible for focus');
            return false;
        }

        element.focus();
        
        // Dispatch focus event
        const focusEvent = new FocusEvent('focus', {
            bubbles: true,
            composed: true
        });
        element.dispatchEvent(focusEvent);

        console.log('[EXL] EventSimulator: Focus event dispatched');
        return true;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventSimulator;
}
