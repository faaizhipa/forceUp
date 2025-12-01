/**
 * CaseContextWatcher Module
 * Centralized observer that waits for Lightning navigation to settle (500ms) before
 * reading document.title and window.location to derive the current case context.
 */

const CaseContextWatcher = {
  isInitialized: false,
  subscribers: new Set(),
  pendingTimer: null,
  debounceDelay: 500,
  lastContext: null,
  lastEventMeta: null,

  /**
   * Initialize observers
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    this.scheduleContextRefresh('init');

    // Hook into NavigationObserver if available
    if (typeof NavigationObserver !== 'undefined') {
      try {
        NavigationObserver.start?.();
        NavigationObserver.onRouteChange(() => {
          this.scheduleContextRefresh('navigation');
        });
      } catch (error) {
        console.warn('[CaseContextWatcher] Unable to hook NavigationObserver:', error);
      }
    } else {
      // Fallback: listen to popstate + hashchange
      window.addEventListener('popstate', () => this.scheduleContextRefresh('popstate'));
      window.addEventListener('hashchange', () => this.scheduleContextRefresh('hashchange'));
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.scheduleContextRefresh('visibility');
      }
    });
  },

  /**
   * Schedule a head-context refresh after the debounce delay
   * @param {string} reason
   */
  scheduleContextRefresh(reason = 'manual') {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
    }

    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      this.refreshContext(reason);
    }, this.debounceDelay);
  },

  /**
   * Refresh context immediately and notify subscribers when it changes
   * @param {string} reason
   */
  refreshContext(reason = 'manual') {
    const context = this.buildContextSnapshot();
    const changed = this.hasMeaningfulChange(context);
    if (!changed) {
      return;
    }

    this.lastContext = context;
    this.lastEventMeta = {
      reason,
      timestamp: Date.now()
    };

    this.notifySubscribers(context, this.lastEventMeta);
  },

  /**
   * Create a snapshot of the current head-derived case context
   * Uses PageContextValidator if available for consistency
   * @returns {Object|null}
   */
  buildContextSnapshot() {
    // Prefer PageContextValidator if available for consistency
    if (typeof PageContextValidator !== 'undefined' &&
        typeof PageContextValidator.getCurrentCaseContext === 'function') {
      const context = PageContextValidator.getCurrentCaseContext();
      if (!context) {
        return null;
      }
      return {
        caseId: context.caseId || null,
        caseNumber: context.caseNumber || null,
        caseTitle: context.caseTitle || null,
        url: context.url || window.location.href,
        title: context.title || document.title || '',
        isCase: Boolean(context.caseId && context.caseNumber),
        timestamp: Date.now()
      };
    }

    // Fallback: direct extraction
    const title = document.title || '';
    const url = window.location.href || '';

    const caseIdMatch = url.match(/\/Case\/([a-zA-Z0-9]{15,18})\//);
    const caseId = caseIdMatch ? caseIdMatch[1] : null;

    let caseNumber = null;
    let caseTitle = null;

    if (title && title !== 'Lightning Experience') {
      const parts = title.split(' | ');
      if (parts[1] === 'Case') {
        caseTitle = parts[0].trim();
        const caseNumberMatch = caseTitle.match(/^(\d{6,})/);
        if (caseNumberMatch) {
          caseNumber = caseNumberMatch[1];
        }
      }
    }

    return {
      caseId,
      caseNumber,
      caseTitle,
      url,
      title,
      isCase: Boolean(caseId && caseNumber),
      timestamp: Date.now()
    };
  },

  /**
   * Compare new context to previous to avoid duplicate emissions
   * @param {Object|null} nextContext
   * @returns {boolean}
   */
  hasMeaningfulChange(nextContext) {
    if (!this.lastContext) {
      return true;
    }

    if (!nextContext) {
      return false;
    }

    return (
      nextContext.caseId !== this.lastContext.caseId ||
      nextContext.caseNumber !== this.lastContext.caseNumber ||
      nextContext.url !== this.lastContext.url ||
      nextContext.title !== this.lastContext.title
    );
  },

  /**
   * Subscribe to context updates
   * @param {Function} callback - Receives ({ context, meta })
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('CaseContextWatcher.subscribe requires a function callback');
    }

    this.subscribers.add(callback);

    // Immediately emit current context if available
    if (this.lastContext) {
      callback({ context: this.lastContext, meta: this.lastEventMeta });
    }

    return () => {
      this.subscribers.delete(callback);
    };
  },

  /**
   * Notify all subscribers
   * @param {Object|null} context
   * @param {Object} meta
   */
  notifySubscribers(context, meta) {
    this.subscribers.forEach((callback) => {
      try {
        callback({ context, meta });
      } catch (error) {
        console.error('[CaseContextWatcher] Subscriber error:', error);
      }
    });
  },

  /**
   * Returns the last known context
   * @returns {Object|null}
   */
  getCurrentContext() {
    return this.lastContext;
  },

  /**
   * Wait for a stable context (optionally requiring a case)
   * @param {Object} options
   * @param {boolean} options.requireCase - Require caseId + caseNumber
   * @param {number} options.timeout - Timeout in ms
   * @returns {Promise<Object|null>}
   */
  async getStableContext(options = {}) {
    const { requireCase = false, timeout = 4000 } = options;

    await this.init();

    const current = this.getCurrentContext();
    if (!requireCase || (current && current.caseId && current.caseNumber)) {
      return current;
    }

    return new Promise((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(this.getCurrentContext());
        }
      }, timeout);

      const unsubscribe = this.subscribe(({ context }) => {
        if (resolved || !context) {
          return;
        }

        if (context.caseId && context.caseNumber) {
          resolved = true;
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(context);
        }
      });
    });
  }
};

// Export for testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaseContextWatcher;
}

