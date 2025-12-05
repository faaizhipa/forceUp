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
  lastNotifiedData: null,
  pendingFieldUpdates: {},
  fieldUpdateDebounceTimer: null,
  lastAcceptedUrl: null,

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
   * Extract fresh case context from DOM (case ID from URL, case number from title)
   * Does NOT use any cached values, observers, or watchers
   * @returns {Object|null} { caseId, caseNumber, url } or null
   */
  extractFreshCaseContext() {
    const currentURL = window.location.href;
    
    // Extract case ID from URL (fresh, not cached)
    const caseIdMatch = currentURL.match(/\/Case\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
    if (!caseIdMatch) {
      return null;
    }
    
    const caseId = caseIdMatch[1];
    
    // Extract case number from title element in head (not body)
    const titleElement = document.querySelector('title');
    if (!titleElement) {
      return { caseId, caseNumber: null, url: currentURL };
    }
    
    const pageTitle = titleElement.textContent || '';
    
    // Handle loading state - title might be "Lightning Experience" or similar placeholder
    if (pageTitle === 'Lightning Experience' || !pageTitle.trim()) {
      return { caseId, caseNumber: null, url: currentURL };
    }
    
    // Parse title format: "00001026 | Case | Salesforce" or "00001026 - Subject | Case | Salesforce"
    const titleParts = pageTitle.split(' | ');
    
    // Check if title contains "Case" (could be "Case" or "Case Comments" or other case-related pages)
    const hasCaseInTitle = titleParts.some(part => part.trim() === 'Case' || part.trim().includes('Case'));
    
    let caseNumber = null;
    
    if (hasCaseInTitle) {
      // Case number is first part (may include subject)
      const firstPart = titleParts[0].trim();
      const caseNumberMatch = firstPart.match(/^(\d{6,10})/);
      caseNumber = caseNumberMatch ? caseNumberMatch[1] : null;
    } else {
      // Try to extract case number directly from title even if format is different
      const caseNumberMatch = pageTitle.match(/^(\d{6,10})/);
      caseNumber = caseNumberMatch ? caseNumberMatch[1] : null;
    }
    
    return { caseId, caseNumber, url: currentURL };
  },

  /**
   * Wait for title to update after navigation/refresh (debounced)
   * Polls document.title every 100ms, times out after 2000ms
   * @returns {Promise<string|null>} Extracted case number or null if timeout
   */
  async waitForTitleUpdate() {
    const startTime = Date.now();
    const maxWaitMs = 2000;
    const pollInterval = 100;
    
    // Check if title is already valid (not a placeholder)
    const initialTitle = document.title || '';
    if (initialTitle !== 'Lightning Experience' && initialTitle.trim()) {
      const context = this.extractFreshCaseContext();
      if (context && context.caseNumber) {
        return context.caseNumber;
      }
    }
    
    // Poll until title updates or timeout
    return new Promise((resolve) => {
      const checkTitle = () => {
        const elapsed = Date.now() - startTime;
        const currentTitle = document.title || '';
        
        // Check if title has updated from placeholder
        if (currentTitle !== 'Lightning Experience' && currentTitle.trim() && currentTitle !== initialTitle) {
          const context = this.extractFreshCaseContext();
          if (context && context.caseNumber) {
            resolve(context.caseNumber);
            return;
          }
        }
        
        // Timeout check
        if (elapsed >= maxWaitMs) {
          // Try one last time
          const context = this.extractFreshCaseContext();
          resolve(context ? context.caseNumber : null);
          return;
        }
        
        // Continue polling
        setTimeout(checkTitle, pollInterval);
      };
      
      // Start polling after initial delay (debounce)
      setTimeout(checkTitle, pollInterval);
    });
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

    // Step 1: Wait for title to update (debounced)
    await this.waitForTitleUpdate();

    // Step 2: Extract fresh case context from DOM (case ID from URL, case number from title)
    const extractedContext = this.extractFreshCaseContext();
    
    if (!extractedContext || !extractedContext.caseId) {
      console.warn('[CaseDataStore] Could not extract case ID from URL, rejecting data');
      return;
    }

    // Step 3: Strict validation - verify both case ID and case number match
    if (extractedContext.caseId !== data.caseId) {
      console.warn('[CaseDataStore] Case ID mismatch, rejecting data', {
        dataCaseId: data.caseId,
        extractedCaseId: extractedContext.caseId
      });
      
      // Dispatch mismatch event
      this.dispatchMismatchEvent({
        reason: 'caseId_mismatch',
        dataCaseId: data.caseId,
        dataCaseNumber: data.caseNumber || null,
        extractedCaseId: extractedContext.caseId,
        extractedCaseNumber: extractedContext.caseNumber
      });
      
      return;
    }

    if (extractedContext.caseNumber && data.caseNumber && extractedContext.caseNumber !== data.caseNumber) {
      console.warn('[CaseDataStore] Case number mismatch, rejecting data', {
        dataCaseNumber: data.caseNumber,
        extractedCaseNumber: extractedContext.caseNumber
      });
      
      // Dispatch mismatch event
      this.dispatchMismatchEvent({
        reason: 'caseNumber_mismatch',
        dataCaseId: data.caseId,
        dataCaseNumber: data.caseNumber,
        extractedCaseId: extractedContext.caseId,
        extractedCaseNumber: extractedContext.caseNumber
      });
      
      return;
    }

    // Step 4: Store accepted data with URL
    this.lastAcceptedUrl = extractedContext.url;
    
    const previousData = this.currentEntry ? this.currentEntry.data : null;
    
    this.currentEntry = {
      data: { ...data },
      source,
      updatedAt: Date.now(),
      url: extractedContext.url
    };

    // Step 5: Track field changes and emit per-field updates (debounced)
    this.trackFieldUpdates(previousData, data, source, extractedContext);

    // Step 6: Notify subscribers of full data update
    this.notifySubscribers({ data: this.currentEntry.data, source });
  },

  /**
   * Dispatch caseDataMismatch event for re-extraction
   * @param {Object} mismatchDetails
   */
  dispatchMismatchEvent(mismatchDetails) {
    try {
      const event = new CustomEvent('caseDataMismatch', {
        detail: mismatchDetails,
        bubbles: true,
        composed: true
      });
      document.dispatchEvent(event);
      console.log('[CaseDataStore] Dispatched caseDataMismatch event:', mismatchDetails);
    } catch (error) {
      console.error('[CaseDataStore] Error dispatching mismatch event:', error);
    }
  },

  /**
   * Track field changes and emit debounced per-field updates
   * @param {Object|null} previousData
   * @param {Object} newData
   * @param {string} source
   * @param {Object} context
   */
  trackFieldUpdates(previousData, newData, source, context) {
    if (!previousData) {
      // First time data is set, mark all fields as changed
      this.pendingFieldUpdates = { ...newData };
    } else {
      // Compare fields and track changes
      const changedFields = {};
      for (const key in newData) {
        if (newData.hasOwnProperty(key) && newData[key] !== previousData[key]) {
          changedFields[key] = newData[key];
        }
      }
      
      // Merge with existing pending updates
      Object.assign(this.pendingFieldUpdates, changedFields);
    }

    // Debounce field update notifications (500ms)
    clearTimeout(this.fieldUpdateDebounceTimer);
    this.fieldUpdateDebounceTimer = setTimeout(() => {
      if (Object.keys(this.pendingFieldUpdates).length > 0) {
        // Emit fieldUpdate event
        this.emitFieldUpdate({
          fields: { ...this.pendingFieldUpdates },
          caseId: context.caseId,
          caseNumber: context.caseNumber,
          url: context.url,
          source
        });
        
        // Update last notified data
        this.lastNotifiedData = { ...newData };
        
        // Clear pending updates
        this.pendingFieldUpdates = {};
      }
    }, 500);
  },

  /**
   * Emit fieldUpdate event for per-field updates
   * @param {Object} updatePayload
   */
  emitFieldUpdate(updatePayload) {
    try {
      const event = new CustomEvent('caseDataFieldUpdate', {
        detail: updatePayload,
        bubbles: true,
        composed: true
      });
      document.dispatchEvent(event);
      console.log('[CaseDataStore] Emitted fieldUpdate event:', updatePayload);
    } catch (error) {
      console.error('[CaseDataStore] Error emitting fieldUpdate event:', error);
    }
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

