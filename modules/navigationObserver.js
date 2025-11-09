/**
 * NavigationObserver Module
 * Detects Lightning SPA navigation and triggers callbacks
 * Handles route changes without full page reloads
 */

const NavigationObserver = {
    callbacks: [],
    currentUrl: null,
    debounceTimer: null,
    debounceDelay: 250,
    titleObserver: null,
    isRunning: false,
    originalPushState: null,
    originalReplaceState: null,

    /**
     * Start observing navigation changes
     */
    start() {
        if (this.isRunning) {
            console.warn('[EXL] NavigationObserver: Already running');
            return;
        }

        this.currentUrl = window.location.href;
        this.isRunning = true;

        // Watch title changes (Lightning updates title on navigation)
        const titleElement = document.querySelector('title');
        if (titleElement) {
            this.titleObserver = new MutationObserver(() => {
                this.checkUrlChange();
            });

            this.titleObserver.observe(titleElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        // Intercept history API
        this.originalPushState = history.pushState;
        this.originalReplaceState = history.replaceState;

        const self = this;

        history.pushState = function(...args) {
            self.originalPushState.apply(history, args);
            self.checkUrlChange();
        };

        history.replaceState = function(...args) {
            self.originalReplaceState.apply(history, args);
            self.checkUrlChange();
        };

        // Watch popstate (back/forward)
        window.addEventListener('popstate', () => this.checkUrlChange());

        // Watch hash changes
        window.addEventListener('hashchange', () => this.checkUrlChange());

        console.log('[EXL] NavigationObserver: Started');
    },

    /**
     * Check if URL has changed
     */
    checkUrlChange() {
        const newUrl = window.location.href;

        if (newUrl !== this.currentUrl) {
            console.log(`[EXL] NavigationObserver: URL changed from ${this.currentUrl} to ${newUrl}`);
            this.currentUrl = newUrl;
            this.triggerCallbacks();
        }
    },

    /**
     * Trigger all registered callbacks (debounced)
     */
    triggerCallbacks() {
        // Debounce to avoid rapid-fire during complex navigations
        clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            console.log(`[EXL] NavigationObserver: Triggering ${this.callbacks.length} callback(s)`);
            
            this.callbacks.forEach((cb, index) => {
                try {
                    cb(this.currentUrl);
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
