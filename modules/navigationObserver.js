/**
 * NavigationObserver Module
 * Detects Lightning SPA navigation and triggers callbacks
 * Handles route changes without full page reloads
 */

const NavigationObserver = {
    callbacks: [],
    currentUrl: null,
    currentTitle: null,
    currentCaseId: null,
    currentCaseNumber: null,
    debounceTimer: null,
    debounceDelay: 250,
    titleObserver: null,
    urlObserver: null,
    isRunning: false,
    originalPushState: null,
    originalReplaceState: null,

    /**
     * Start observing navigation changes with enhanced detection
     */
    start() {
        if (this.isRunning) {
            console.warn('[EXL] NavigationObserver: Already running');
            return;
        }

        this.currentUrl = window.location.href;
        this.currentTitle = document.title;
        this.updateCaseContext();
        this.isRunning = true;

        // Signal 1: Watch title changes (Lightning updates title on navigation)
        const titleElement = document.querySelector('title');
        if (titleElement) {
            this.titleObserver = new MutationObserver(() => {
                this.checkNavigation();
            });

            this.titleObserver.observe(titleElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        // Signal 2: Intercept history API
        this.originalPushState = history.pushState;
        this.originalReplaceState = history.replaceState;

        const self = this;

        history.pushState = function(...args) {
            self.originalPushState.apply(history, args);
            self.checkNavigation();
        };

        history.replaceState = function(...args) {
            self.originalReplaceState.apply(history, args);
            self.checkNavigation();
        };

        // Signal 3: Watch popstate (back/forward)
        window.addEventListener('popstate', () => this.checkNavigation());

        // Signal 4: Watch hash changes
        window.addEventListener('hashchange', () => this.checkNavigation());

        // Signal 5: DOM mutations (fallback for missed navigations)
        this.urlObserver = new MutationObserver(() => {
            // Check if URL or title changed via DOM mutation
            const newUrl = window.location.href;
            const newTitle = document.title;
            
            if (newUrl !== this.currentUrl || newTitle !== this.currentTitle) {
                this.checkNavigation();
            }
        });
        
        // Observe document body for changes (lightweight, debounced)
        if (document.body) {
            this.urlObserver.observe(document.body, {
                childList: true,
                subtree: false, // Only direct children to reduce overhead
                attributes: false
            });
        } else {
            // Wait for body to be available
            const bodyObserver = new MutationObserver(() => {
                if (document.body) {
                    bodyObserver.disconnect();
                    this.urlObserver.observe(document.body, {
                        childList: true,
                        subtree: false,
                        attributes: false
                    });
                }
            });
            bodyObserver.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }

        console.log('[EXL] NavigationObserver: Started with enhanced detection');
    },

    /**
     * Update case context from current page
     */
    updateCaseContext() {
        if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.getCurrentCaseContext === 'function') {
            const context = PageContextValidator.getCurrentCaseContext();
            if (context) {
                this.currentCaseId = context.caseId;
                this.currentCaseNumber = context.caseNumber;
            } else {
                this.currentCaseId = null;
                this.currentCaseNumber = null;
            }
        } else {
            // Fallback: extract from URL only
            const match = window.location.href.match(/\/Case\/([a-zA-Z0-9]{15,18})\//);
            this.currentCaseId = match ? match[1] : null;
            this.currentCaseNumber = null;
        }
    },

    /**
     * Check if navigation occurred (enhanced with multiple signals)
     */
    checkNavigation() {
        const newUrl = window.location.href;
        const newTitle = document.title;
        
        // Get new case context
        let newContext = null;
        if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.getCurrentCaseContext === 'function') {
            newContext = PageContextValidator.getCurrentCaseContext();
        }
        
        // Check URL change
        const urlChanged = newUrl !== this.currentUrl;
        
        // Check title change
        const titleChanged = newTitle !== this.currentTitle;
        
        // Check case context change
        const caseIdChanged = newContext?.caseId !== this.currentCaseId;
        const caseNumberChanged = newContext?.caseNumber !== this.currentCaseNumber;
        
        // Navigation detected if any indicator changed
        if (urlChanged || titleChanged || caseIdChanged || caseNumberChanged) {
            console.log('[EXL] NavigationObserver: Navigation detected:', {
                urlChanged,
                titleChanged,
                caseIdChanged,
                caseNumberChanged,
                from: { url: this.currentUrl, caseId: this.currentCaseId },
                to: { url: newUrl, caseId: newContext?.caseId }
            });
            
            this.currentUrl = newUrl;
            this.currentTitle = newTitle;
            this.updateCaseContext();
            this.triggerCallbacks();
        }
    },

    /**
     * Trigger all registered callbacks with context information (debounced)
     */
    triggerCallbacks() {
        // Debounce to avoid rapid-fire during complex navigations
        clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            const context = {
                url: this.currentUrl,
                title: this.currentTitle,
                caseId: this.currentCaseId,
                caseNumber: this.currentCaseNumber
            };
            
            console.log(`[EXL] NavigationObserver: Triggering ${this.callbacks.length} callback(s)`);
            
            this.callbacks.forEach((cb, index) => {
                try {
                    // Support both old signature (url only) and new signature (url, context)
                    if (cb.length === 2) {
                        cb(this.currentUrl, context);
                    } else {
                        cb(this.currentUrl);
                    }
                } catch (err) {
                    console.error(`[EXL] NavigationObserver: Callback ${index} error:`, err);
                }
            });
        }, this.debounceDelay);
    },

    /**
     * Register callback for route changes
     * @param {Function} callback - Function to call on route change
     */
    onRouteChange(callback) {
        if (typeof callback !== 'function') {
            console.error('[EXL] NavigationObserver: Callback must be a function');
            return;
        }

        this.callbacks.push(callback);
        console.log(`[EXL] NavigationObserver: Registered callback (total: ${this.callbacks.length})`);
    },

    /**
     * Remove callback
     * @param {Function} callback - Callback to remove
     */
    offRouteChange(callback) {
        const index = this.callbacks.indexOf(callback);
        if (index !== -1) {
            this.callbacks.splice(index, 1);
            console.log(`[EXL] NavigationObserver: Removed callback (remaining: ${this.callbacks.length})`);
        }
    },

    /**
     * Stop observing navigation
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        // Disconnect title observer
        if (this.titleObserver) {
            this.titleObserver.disconnect();
            this.titleObserver = null;
        }

        // Disconnect URL observer
        if (this.urlObserver) {
            this.urlObserver.disconnect();
            this.urlObserver = null;
        }

        // Restore history methods
        if (this.originalPushState) {
            history.pushState = this.originalPushState;
        }
        if (this.originalReplaceState) {
            history.replaceState = this.originalReplaceState;
        }

        // Clear callbacks and timers
        this.callbacks = [];
        clearTimeout(this.debounceTimer);
        this.isRunning = false;

        console.log('[EXL] NavigationObserver: Stopped');
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationObserver;
}
