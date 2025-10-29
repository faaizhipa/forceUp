/**
 * DOM Utilities Module
 * 
 * Provides utilities for DOM manipulation, including shadow DOM traversal
 * and element selection across Salesforce Lightning components.
 */

/**
 * Gets child elements from a node, handling different node types including shadow roots.
 * @param {Node} node The node to get children from.
 * @returns {Element[]} Array of child elements.
 */
function getChildElements(node) {
    if (!node) return [];
    if (node.nodeType === Node.DOCUMENT_NODE) {
        return node.documentElement ? [node.documentElement] : [];
    }
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        return Array.from(node.childNodes).filter(child => child.nodeType === Node.ELEMENT_NODE);
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
        return Array.from(node.children);
    }
    return [];
}

/**
 * Recursively searches the DOM, including shadow roots, for elements matching a selector.
 * @param {string} selector The CSS selector to match.
 * @returns {Element[]} All matched elements across light and shadow DOM trees.
 */
export function querySelectorDeepAll(selector) {
    const matches = [];
    const queue = [document];

    while (queue.length) {
        const node = queue.shift();
        if (!node) continue;

        if (node.nodeType === Node.ELEMENT_NODE && node.matches(selector)) {
            matches.push(node);
        }

        if (node.shadowRoot) {
            queue.push(node.shadowRoot);
        }

        const children = getChildElements(node);
        for (const child of children) {
            queue.push(child);
        }
    }

    return matches;
}

/**
 * Safely extracts text content from an element by field label.
 * @param {string} labelText The visible label text to search for.
 * @param {Element} [context=document] The root element to search within.
 * @returns {string|null} The extracted text content or null if not found.
 */
export function extractDataByLabel(labelText, context = document) {
    const selector = `records-record-layout-item[field-label="${labelText}"] .test-id__field-value`;
    const element = context.querySelector(selector);
    return element ? element.textContent.trim() : null;
}

/**
 * Ensures the entire page is loaded by programmatically scrolling to trigger lazy loading.
 * @description This function handles pages with lazy-loading or infinite scroll by scrolling to
 * the bottom of the page to trigger content loading, waiting for a brief period of no DOM
 * mutations, and then restoring the user's original scroll position.
 * @returns {Promise<void>} A promise that resolves when the page is considered fully loaded.
 */
export async function ensureFullPageLoad() {
    return new Promise((resolve) => {
        const originalScrollY = window.scrollY;
        window.scrollTo(0, document.body.scrollHeight);

        let mutationTimeout;
        const observer = new MutationObserver(() => {
            clearTimeout(mutationTimeout);
            mutationTimeout = setTimeout(() => {
                observer.disconnect();
                window.scrollTo(0, originalScrollY);
                resolve();
            }, 500); // Wait for 500ms of no mutations.
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // A safety timeout to ensure the observer doesn't run indefinitely.
        setTimeout(() => {
            observer.disconnect();
            window.scrollTo(0, originalScrollY);
            resolve();
        }, 10000); // 10 second safety timeout
    });
}

/**
 * Creates a safe, persistent observer that waits for an element to appear.
 * @param {string} selector CSS selector for the target element.
 * @param {Function} callback Function to call when element is found.
 * @param {Element} [root=document.body] Root element to observe.
 * @param {number} [timeout=30000] Timeout in milliseconds (default 30s).
 * @returns {Object} Observer control object with disconnect method.
 */
export function waitForElement(selector, callback, root = document.body, timeout = 30000) {
    // Check if element already exists
    const existingElement = root.querySelector(selector);
    if (existingElement) {
        callback(existingElement);
        return { disconnect: () => {} };
    }

    // Set up observer for future appearance
    const observer = new MutationObserver((mutations) => {
        const element = root.querySelector(selector);
        if (element) {
            observer.disconnect();
            callback(element);
        }
    });

    observer.observe(root, {
        childList: true,
        subtree: true
    });

    // Safety timeout
    const timeoutId = setTimeout(() => {
        observer.disconnect();
        console.warn(`Element ${selector} not found within ${timeout}ms`);
    }, timeout);

    return {
        disconnect: () => {
            clearTimeout(timeoutId);
            observer.disconnect();
        }
    };
}