/**
 * URL Change Monitor Module
 * Tracks URL changes, page type changes, and case ID changes
 * Provides a centralized monitoring system for page navigation
 */

const UrlChangeMonitor = {
  // State tracking
  state: {
    lastUrl: null,
    lastPageType: null,
    lastCaseId: null,
    lastReportId: null,
    lastView: null,
    initialized: false,
    lastActivityTimestamp: null,
    idleHelperEnabled: false
  },

  // Callbacks to notify when changes occur
  callbacks: [],
  
  // Idle detection helper
  idleHelper: {
    timer: null,
    triggered: false,
    delay: 2000, // 2 seconds
    callback: null
  },

  /**
   * Initialize the monitor with current page state
   * @param {Object} pageInfo - Initial page info from PageIdentifier
   */
  init(pageInfo) {
    if (this.state.initialized) {
      console.log('[UrlChangeMonitor] Already initialized');
      return;
    }

    this.state.lastUrl = window.location.href;
    this.state.lastPageType = pageInfo?.type || null;
    this.state.lastCaseId = pageInfo?.caseId || null;
    this.state.lastReportId = pageInfo?.reportId || null;
    this.state.lastView = pageInfo?.view || null;
    this.state.initialized = true;
    this.state.lastActivityTimestamp = Date.now();

    console.log('[UrlChangeMonitor] Initialized with state:', {
      url: this.state.lastUrl,
      pageType: this.state.lastPageType,
      caseId: this.state.lastCaseId,
      reportId: this.state.lastReportId,
      view: this.state.lastView
    });
  },

  /**
   * Register a callback to be notified of changes
   * @param {Function} callback - Called with change details
   */
  onChanged(callback) {
    if (typeof callback === 'function') {
      this.callbacks.push(callback);
      console.log('[UrlChangeMonitor] Registered callback, total callbacks:', this.callbacks.length);
    }
  },

  /**
   * Check if anything changed and notify callbacks
   * @param {Object} currentPageInfo - Current page info from PageIdentifier
   * @returns {Object} Change details
   */
  checkForChanges(currentPageInfo) {
    const currentUrl = window.location.href;
    const currentPageType = currentPageInfo?.type || null;
    const currentCaseId = currentPageInfo?.caseId || null;
    const currentReportId = currentPageInfo?.reportId || null;
    const currentView = currentPageInfo?.view || null;

    // Determine what changed
    const changes = {
      urlChanged: this.state.lastUrl !== currentUrl,
      pageTypeChanged: this.state.lastPageType !== currentPageType,
      caseIdChanged: this.state.lastCaseId !== currentCaseId,
      reportIdChanged: this.state.lastReportId !== currentReportId,
      viewChanged: this.state.lastView !== currentView,
      anyChange: false,
      timestamp: Date.now()
    };

    // Determine if any significant change occurred
    changes.anyChange = changes.urlChanged || 
                        changes.pageTypeChanged || 
                        changes.caseIdChanged || 
                        changes.reportIdChanged ||
                        changes.viewChanged;

    // Update last activity timestamp
    this.state.lastActivityTimestamp = Date.now();

    // Log detailed change information
    if (changes.anyChange) {
      console.log('[UrlChangeMonitor] Changes detected:', {
        urlChanged: changes.urlChanged,
        pageTypeChanged: changes.pageTypeChanged,
        caseIdChanged: changes.caseIdChanged,
        reportIdChanged: changes.reportIdChanged,
        viewChanged: changes.viewChanged,
        from: {
          url: this.state.lastUrl,
          pageType: this.state.lastPageType,
          caseId: this.state.lastCaseId,
          reportId: this.state.lastReportId,
          view: this.state.lastView
        },
        to: {
          url: currentUrl,
          pageType: currentPageType,
          caseId: currentCaseId,
          reportId: currentReportId,
          view: currentView
        }
      });

      // Update state to current values
      this.state.lastUrl = currentUrl;
      this.state.lastPageType = currentPageType;
      this.state.lastCaseId = currentCaseId;
      this.state.lastReportId = currentReportId;
      this.state.lastView = currentView;

      // Notify all registered callbacks
      this.notifyCallbacks(changes, currentPageInfo);
      
      // Reset idle helper when significant change occurs
      this.resetIdleHelper();
    } else {
      console.log('[UrlChangeMonitor] No significant changes detected');
      
      // Start idle helper if enabled and not already triggered
      if (this.state.idleHelperEnabled) {
        this.startIdleHelper(currentPageInfo);
      }
    }

    return changes;
  },

  /**
   * Notify all registered callbacks of changes
   * @param {Object} changes - Change details
   * @param {Object} pageInfo - Current page info
   */
  notifyCallbacks(changes, pageInfo) {
    const callbackData = {
      changes,
      pageInfo,
      previous: {
        url: this.state.lastUrl,
        pageType: this.state.lastPageType,
        caseId: this.state.lastCaseId,
        reportId: this.state.lastReportId,
        view: this.state.lastView
      }
    };

    console.log(`[UrlChangeMonitor] Notifying ${this.callbacks.length} callbacks`);

    this.callbacks.forEach((callback, index) => {
      try {
        callback(callbackData);
      } catch (error) {
        console.error(`[UrlChangeMonitor] Error in callback ${index}:`, error);
      }
    });
  },

  /**
   * Get the current tracked state
   * @returns {Object} Current state
   */
  getState() {
    return {
      ...this.state,
      currentUrl: window.location.href
    };
  },

  /**
   * Check if specific change type occurred
   * @param {string} changeType - 'url', 'pageType', 'caseId', or 'reportId'
   * @returns {boolean}
   */
  hasChanged(changeType) {
    const currentUrl = window.location.href;
    
    switch (changeType) {
      case 'url':
        return this.state.lastUrl !== currentUrl;
      case 'pageType':
        // Need to check via PageIdentifier
        return false; // Cannot determine without current page info
      case 'caseId':
        // Need to check via PageIdentifier
        return false; // Cannot determine without current page info
      case 'reportId':
        // Need to check via PageIdentifier
        return false; // Cannot determine without current page info
      default:
        console.warn('[UrlChangeMonitor] Unknown change type:', changeType);
        return false;
    }
  },

  /**
   * Check if currently on a case page
   * @returns {boolean}
   */
  isOnCasePage() {
    return this.state.lastPageType === 'case_page' || 
           this.state.lastPageType === 'case_comments';
  },

  /**
   * Check if case ID changed (navigated to different case)
   * @returns {boolean}
   */
  didCaseIdChange() {
    // This should be called after checkForChanges
    // Returns the last check result
    return this.state.lastCaseId !== null;
  },

  /**
   * Reset the monitor (useful for testing or re-initialization)
   */
  reset() {
    console.log('[UrlChangeMonitor] Resetting state');
    this.state = {
      lastUrl: null,
      lastPageType: null,
      lastCaseId: null,
      lastReportId: null,
      lastView: null,
      initialized: false,
      lastActivityTimestamp: null,
      idleHelperEnabled: false
    };
    this.callbacks = [];
    this.resetIdleHelper();
  },

  /**
   * Enable idle helper to trigger callback after inactivity
   * This helps ensure PageIdentifier proceeds when page is stable
   * @param {Function} callback - Called when page has been idle for specified duration
   * @param {number} delay - Delay in milliseconds (default: 2000ms)
   */
  enableIdleHelper(callback, delay = 2000) {
    this.state.idleHelperEnabled = true;
    this.idleHelper.callback = callback;
    this.idleHelper.delay = delay;
    console.log(`[UrlChangeMonitor] Idle helper enabled (${delay}ms delay)`);
  },

  /**
   * Disable idle helper
   */
  disableIdleHelper() {
    this.state.idleHelperEnabled = false;
    this.resetIdleHelper();
    console.log('[UrlChangeMonitor] Idle helper disabled');
  },

  /**
   * Start idle helper timer
   * @param {Object} pageInfo - Current page info
   */
  startIdleHelper(pageInfo) {
    // Don't start if already triggered or timer is running
    if (this.idleHelper.triggered || this.idleHelper.timer) {
      return;
    }

    console.log(`[UrlChangeMonitor] Starting idle helper timer (${this.idleHelper.delay}ms)`);
    
    this.idleHelper.timer = setTimeout(() => {
      if (!this.idleHelper.triggered) {
        console.log('[UrlChangeMonitor] Idle period detected - triggering idle helper callback');
        this.idleHelper.triggered = true;
        
        if (typeof this.idleHelper.callback === 'function') {
          try {
            this.idleHelper.callback(pageInfo);
          } catch (error) {
            console.error('[UrlChangeMonitor] Error in idle helper callback:', error);
          }
        }
        
        // Disable idle helper after triggering once
        this.disableIdleHelper();
      }
    }, this.idleHelper.delay);
  },

  /**
   * Reset idle helper timer and triggered state
   */
  resetIdleHelper() {
    if (this.idleHelper.timer) {
      clearTimeout(this.idleHelper.timer);
      this.idleHelper.timer = null;
    }
    this.idleHelper.triggered = false;
    console.log('[UrlChangeMonitor] Idle helper reset');
  },

  /**
   * Get time since last activity (in milliseconds)
   * @returns {number}
   */
  getTimeSinceLastActivity() {
    if (!this.state.lastActivityTimestamp) {
      return 0;
    }
    return Date.now() - this.state.lastActivityTimestamp;
  },

  /**
   * Get a summary of what changed for logging
   * @param {Object} changes - Change object from checkForChanges
   * @returns {string}
   */
  getChangeSummary(changes) {
    const parts = [];
    if (changes.urlChanged) parts.push('URL');
    if (changes.pageTypeChanged) parts.push('PageType');
    if (changes.caseIdChanged) parts.push('CaseID');
    if (changes.reportIdChanged) parts.push('ReportID');
    if (changes.viewChanged) parts.push('View');
    
    return parts.length > 0 ? parts.join(', ') : 'None';
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UrlChangeMonitor;
}
