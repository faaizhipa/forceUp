/**
 * CaseDataStore Module
 * Holds the latest validated case payload in memory and synchronizes it with the current
 * CaseContextWatcher context. Acts as the single source of truth for UI consumers.
 */

const CaseDataStore = {
  isInitialized: false,
  currentEntry: null,
  subscribers: new Set(),
  contextUnsubscribe: null,

  /**
   * Initialize the store and subscribe to context changes
   */
  init() {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    if (typeof CaseContextWatcher !== 'undefined') {
      CaseContextWatcher.init?.();
      this.contextUnsubscribe = CaseContextWatcher.subscribe(({ context }) => {
        this.handleContextChange(context);
      });
    }
  },

  /**
   * Clears data when context no longer matches
   * @param {Object|null} context
   */
  handleContextChange(context) {
    if (!context || !context.caseId) {
      this.clear('context-missing');
      return;
    }

    if (this.currentEntry && this.currentEntry.data.caseId !== context.caseId) {
      this.clear('context-switch');
    }
  },

  /**
   * Get currently stored data (only if it matches the current case)
   * @returns {Object|null}
   */
  getCurrentData() {
    if (!this.currentEntry || !this.currentEntry.data) {
      return null;
    }

    const watcherContext = typeof CaseContextWatcher !== 'undefined'
      ? CaseContextWatcher.getCurrentContext?.()
      : null;

    if (watcherContext && watcherContext.caseId && watcherContext.caseId !== this.currentEntry.data.caseId) {
      return null;
    }

    return this.currentEntry.data;
  },

  /**
   * Set current data after validating against the active case context
   * @param {Object} data
   * @param {string} source
   */
  async setCurrentData(data, source = 'unknown') {
    if (!data) {
      console.warn('[CaseDataStore] Attempted to store empty data');
      return;
    }

    if (!data.caseId) {
      console.warn('[CaseDataStore] Data missing caseId, rejecting');
      return;
    }

    if (typeof CaseContextWatcher !== 'undefined') {
      await CaseContextWatcher.init?.();
      
      // Try to get stable context with a short timeout
      let context = null;
      try {
        if (typeof CaseContextWatcher.getStableContext === 'function') {
          context = await Promise.race([
            CaseContextWatcher.getStableContext({ requireCase: false, timeout: 1000 }),
            new Promise(resolve => setTimeout(() => resolve(null), 1000))
          ]);
        } else {
          context = CaseContextWatcher.getCurrentContext?.();
        }
      } catch (error) {
        console.warn('[CaseDataStore] Error getting context:', error);
        // Fallback: try direct getCurrentContext
        context = CaseContextWatcher.getCurrentContext?.();
      }
      
      // If context is not available yet, try to extract caseId from URL as fallback
      if (!context || !context.caseId) {
        const urlMatch = window.location.href.match(/\/Case\/([a-zA-Z0-9]{15,18})\//);
        const urlCaseId = urlMatch ? urlMatch[1] : null;
        
        // If URL caseId matches data caseId, allow storage (context might not be ready yet)
        if (urlCaseId && urlCaseId === data.caseId) {
          console.log('[CaseDataStore] Context not ready, but URL caseId matches, allowing storage');
          // Continue to store the data
        } else {
          console.warn('[CaseDataStore] No active case context and URL caseId mismatch, rejecting data', {
            dataCaseId: data.caseId,
            urlCaseId: urlCaseId
          });
          return;
        }
      } else if (context.caseId !== data.caseId) {
        console.warn('[CaseDataStore] Case mismatch, rejecting data', {
          dataCaseId: data.caseId,
          contextCaseId: context.caseId
        });
        return;
      }
    }

    this.currentEntry = {
      data: { ...data },
      source,
      updatedAt: Date.now()
    };

    this.notifySubscribers({ data: this.currentEntry.data, source });
  },

  /**
   * Clear the stored data
   * @param {string} reason
   */
  clear(reason = 'manual') {
    if (!this.currentEntry) {
      return;
    }

    this.currentEntry = null;
    this.notifySubscribers({ data: null, reason });
  },

  /**
   * Subscribe to data updates
   * @param {Function} callback - Receives ({ data, source?, reason? })
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('CaseDataStore.subscribe requires a function callback');
    }

    this.subscribers.add(callback);

    // Emit current state immediately
    callback({ data: this.currentEntry ? this.currentEntry.data : null, source: 'immediate' });

    return () => {
      this.subscribers.delete(callback);
    };
  },

  /**
   * Notify subscribers
   * @param {Object} payload
   */
  notifySubscribers(payload) {
    this.subscribers.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error('[CaseDataStore] Subscriber error:', error);
      }
    });
  }
};

// Export for testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaseDataStore;
}

