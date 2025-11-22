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
   * @returns {Object}
   */
  buildContextSnapshot() {
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

    const timestamp = new Date().toISOString();

    return {
      caseId,
      caseNumber,
      caseTitle,
      url,
      title,
      isCase: Boolean(caseId && caseNumber),
      timestamp
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
/**
 * CaseContextWatcher Module
 * Provides a head-based case context that waits for Lightning navigation
 * to settle (500ms) before emitting { caseId, caseNumber, title, url } payloads.
 * Other modules can await getStableContext() or subscribe to changes.
 */

const CaseContextWatcher = {
  stabilizeDelayMs: 500,
  isInitialized: false,
  refreshTimer: null,
  currentContext: null,
  listeners: new Set(),
  pendingResolvers: [],

  /**
   * Initialize the watcher and hook into navigation signals
   */
  init() {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    console.log('[CaseContextWatcher] Initializing');

    // Kick off an initial read after the page settles
    this.scheduleContextRefresh('init');

    if (typeof NavigationObserver !== 'undefined' &&
        typeof NavigationObserver.onRouteChange === 'function') {
      NavigationObserver.onRouteChange((url) => {
        this.handleNavigationSignal(url);
      });
      console.log('[CaseContextWatcher] Subscribed to NavigationObserver');
    } else {
      console.warn('[CaseContextWatcher] NavigationObserver unavailable, using fallback listeners');
      window.addEventListener('popstate', () => this.handleNavigationSignal(window.location.href));
      window.addEventListener('hashchange', () => this.handleNavigationSignal(window.location.href));
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.scheduleContextRefresh('visibilitychange');
      }
    });
  },

  /**
   * Handle navigation notifications
   * @param {string} url
   */
  handleNavigationSignal(url) {
    console.log('[CaseContextWatcher] Navigation signal received:', url);
    this.scheduleContextRefresh('navigation');
  },

  /**
   * Schedule a context refresh after the stabilization delay
   * @param {string} reason
   */
  scheduleContextRefresh(reason = 'unknown') {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.refreshContext(reason);
    }, this.stabilizeDelayMs);
  },

  /**
   * Force an immediate refresh (used by callers that need latest context)
   */
  refreshNow(reason = 'manual') {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.refreshContext(reason);
  },

  /**
   * Refresh the current context and notify listeners when it changes
   * @param {string} reason
   */
  refreshContext(reason) {
    const previous = this.currentContext;
    const next = this.buildContextFromHead();

    if (!next) {
      if (previous !== null) {
        console.log('[CaseContextWatcher] Head context unavailable, clearing state');
        this.currentContext = null;
        this.emitChange(null, reason);
      } else {
        // Still waiting for a valid case context, keep pending resolvers alive
        this.resolvePendingResolvers(null, false);
      }
      return;
    }

    if (!previous || this.hasMeaningfulChange(previous, next)) {
      this.currentContext = next;
      console.log('[CaseContextWatcher] Context updated:', next);
      this.emitChange(next, reason);
    } else {
      // Context is stable, resolve any waiters
      this.resolvePendingResolvers(next, true);
    }
  },

  /**
   * Determine if the emitted payload has changed in a meaningful way
   * @param {Object} previous
   * @param {Object} next
   * @returns {boolean}
   */
  hasMeaningfulChange(previous, next) {
    return (
      previous.caseId !== next.caseId ||
      previous.caseNumber !== next.caseNumber ||
      previous.url !== next.url ||
      previous.title !== next.title
    );
  },

  /**
   * Build a context object from head elements (title + URL)
   * @returns {Object|null}
   */
  buildContextFromHead() {
    if (typeof PageContextValidator !== 'undefined' &&
        typeof PageContextValidator.getCurrentCaseContext === 'function') {
      const context = PageContextValidator.getCurrentCaseContext();
      if (!context) {
        return null;
      }
      return {
        caseId: context.caseId || null,
        caseNumber: context.caseNumber || null,
        title: context.title || document.title || '',
        url: context.url || window.location.href,
        timestamp: Date.now()
      };
    }

    const title = document.title || '';
    const url = window.location.href;

    if (!url || title === 'Lightning Experience') {
      return null;
    }

    const caseIdMatch = url.match(/\/Case\/([a-zA-Z0-9]{15,18})\//);
    if (!caseIdMatch) {
      return null;
    }

    const titleParts = title.split(' | ');
    const caseNumberMatch = titleParts[0]?.match(/^(\d{6,10})/);

    return {
      caseId: caseIdMatch[1],
      caseNumber: caseNumberMatch ? caseNumberMatch[1] : null,
      title,
      url,
      timestamp: Date.now()
    };
  },

  /**
   * Notify listeners and pending resolvers
   * @param {Object|null} context
   * @param {string} reason
   */
  emitChange(context, reason) {
    this.listeners.forEach((listener) => {
      try {
        listener(context, reason);
      } catch (error) {
        console.error('[CaseContextWatcher] Listener error:', error);
      }
    });
    this.resolvePendingResolvers(context, true);
  },

  /**
   * Resolve pending promises waiting for a stable context
   * @param {Object|null} context
   * @param {boolean} allowNullResolution - whether to resolve null waiters
   */
  resolvePendingResolvers(context, allowNullResolution) {
    if (this.pendingResolvers.length === 0) {
      return;
    }

    const remaining = [];

    this.pendingResolvers.forEach((entry) => {
      const hasCase = context && context.caseId;
      const shouldResolve =
        (context && (!entry.requireCase || hasCase)) ||
        (!context && allowNullResolution && !entry.requireCase);

      if (shouldResolve) {
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId);
        }
        entry.resolve(context || null);
      } else {
        remaining.push(entry);
      }
    });

    this.pendingResolvers = remaining;
  },

  /**
   * Subscribe to context changes
   * @param {Function} listener
   * @returns {Function} unsubscribe function
   */
  onChange(listener) {
    if (typeof listener !== 'function') {
      console.error('[CaseContextWatcher] Listener must be a function');
      return () => {};
    }

    this.listeners.add(listener);

    // Fire immediately with current context if available
    if (this.currentContext) {
      try {
        listener(this.currentContext, 'immediate');
      } catch (error) {
        console.error('[CaseContextWatcher] Immediate listener error:', error);
      }
    }

    return () => {
      this.listeners.delete(listener);
    };
  },

  /**
   * Await a stable context
   * @param {Object} options
   * @param {boolean} options.requireCase - require caseId to resolve (default true)
   * @param {number} options.timeoutMs - timeout before resolving null (default 5000)
   * @returns {Promise<Object|null>}
   */
  async getStableContext(options = {}) {
    const { requireCase = true, timeoutMs = 5000 } = options;

    if (this.currentContext && (!requireCase || this.currentContext.caseId)) {
      return this.currentContext;
    }

    return new Promise((resolve) => {
      const entry = { resolve, requireCase };

      if (timeoutMs > 0) {
        entry.timeoutId = setTimeout(() => {
          entry.timeoutId = null;
          entry.resolve(null);
        }, timeoutMs);
      }

      this.pendingResolvers.push(entry);
      this.scheduleContextRefresh('getStableContext');
    });
  }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaseContextWatcher;
}

