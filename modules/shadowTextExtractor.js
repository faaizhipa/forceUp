/**
 * ShadowTextExtractor Module
 * Recursively extracts text from Shadow DOM trees (open roots only)
 * Follows MV3 best practices and handles native/synthetic shadow modes
 */

const ShadowTextExtractor = {
    /**
     * Extract all text from Shadow DOM trees
     * @param {Object} options - Configuration options
     * @param {Element} options.root - Starting element (default: document.body)
     * @param {number} options.maxNodes - Maximum nodes to visit (default: 10000)
     * @param {AbortSignal} options.abortSignal - Signal to abort operation
     * @param {boolean} options.includeHidden - Include hidden elements (default: false)
     * @returns {Object} { text: string, stats: Object }
     */
    extractAllText(options = {}) {
        const {
            root = document.body,
            maxNodes = 10000,
            abortSignal = null,
            includeHidden = false
        } = options;

        const stats = {
            nodesVisited: 0,
            shadowRootsTraversed: 0,
            closedRootsSkipped: 0,
            textLength: 0,
            startTime: performance.now(),
            endTime: 0
        };

        const textParts = [];

        /**
         * Recursively traverse DOM and Shadow DOM
         * @param {Node} node - Current node
         */
        const traverse = (node) => {
            // Check abort signal
            if (abortSignal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            // Check node limit
            if (stats.nodesVisited >= maxNodes) {
                console.warn('[EXL] ShadowTextExtractor: Max nodes reached, stopping traversal');
                return;
            }

            stats.nodesVisited++;

            // Skip hidden elements unless requested
            if (!includeHidden && node.nodeType === Node.ELEMENT_NODE) {
                try {
                    const style = window.getComputedStyle(node);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return;
                    }
                } catch (e) {
                    // Element may not support getComputedStyle, continue
                }
            }

            // Extract text from text nodes
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent?.trim();
                if (text) {
                    textParts.push(text);
                    stats.textLength += text.length;
                }
                return;
            }

            // Traverse shadow root if open
            if (node.shadowRoot) {
                if (node.shadowRoot.mode === 'open') {
                    stats.shadowRootsTraversed++;
                    traverse(node.shadowRoot);
                } else {
                    stats.closedRootsSkipped++;
                }
            }

            // Traverse children
            if (node.childNodes) {
                for (const child of node.childNodes) {
                    traverse(child);
                }
            }
        };

        try {
            traverse(root);
            stats.endTime = performance.now();
        } catch (err) {
            stats.endTime = performance.now();
            if (err.name !== 'AbortError') {
                console.error('[EXL] ShadowTextExtractor error:', err);
                throw err;
            }
        }

        return {
            text: textParts.join(' '),
            stats: {
                ...stats,
                duration: stats.endTime - stats.startTime
            }
        };
    },

    /**
     * Extract text from a specific selector (including shadow DOM)
     * @param {string} selector - CSS selector
     * @param {Object} options - Additional options
     * @returns {Object} { text: string, stats: Object }
     */
    extractFromSelector(selector, options = {}) {
        const element = document.querySelector(selector);
        
        if (!element) {
            console.warn(`[EXL] ShadowTextExtractor: Element not found for selector: ${selector}`);
            return {
                text: '',
                stats: { nodesVisited: 0, error: 'Element not found' }
            };
        }

        return this.extractAllText({
            ...options,
            root: element
        });
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShadowTextExtractor;
}
