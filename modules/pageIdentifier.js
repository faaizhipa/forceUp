/**
 * Page Identifier Module
 * Identifies the current Salesforce page type based on URL patterns
 */

const PageIdentifier = {
  pageTypes: {
    CASE_PAGE: 'case_page',
    CASE_COMMENTS: 'case_comments',
    CASES_LIST: 'cases_list',
    REPORT_HOME: 'report_home',
    REPORT_PAGE: 'report_page',
    REPORT_BUILDER: 'report_builder',
    SEARCH_PAGE: 'search_page',
    UNKNOWN: 'unknown'
  },

  // Throttling state
  _lastPageInfo: null,
  _lastDetectedCaseNumber: null, // Track last detected case number
  _throttleTimer: null,
  _throttleDelay: 300, // 300ms throttle delay
  _pendingCallback: null,
  _isProcessing: false,

  /**
   * Detects the active tab view on a case page
   * @returns {string|null} 'details', 'communication', 'files', or null if not detectable
   */
  /**
   * Gets the case number from the page header
   * Uses reliable Salesforce Lightning selectors to find visible case title
   * @returns {string|null}
   */
  getCaseNumberFromPage() {
    try {
      // Priority 1: Check active tab with visible record layout (most reliable)
      // Use querySelectorAll to find all potential matches and filter by actual visibility
      const candidateElements = document.querySelectorAll(
        'section.tabContent.active .forcegenerated-record-layout2 div.highlights .slds-page-header__title lightning-formatted-text'
      );

      if (candidateElements.length > 0) {
        // Filter by actual computed visibility (checking if element and ancestors are visible)
        for (const element of candidateElements) {
          // Check if element is actually visible (offsetParent !== null means it's rendered)
          if (element.offsetParent !== null) {
            const headerText = (element.textContent || '').trim();
            if (headerText) {
              // Extract case number (6+ digits at start of header)
              const numberMatch = headerText.match(/^([0-9]{6,})/);
              if (numberMatch) {
                const caseNumber = numberMatch[1];
                console.log('[PageIdentifier] Found visible case number:', caseNumber, 'from element:', element);
                
                // Update state and notify dependent modules
                this._updateCaseNumberState(caseNumber);
                
                return caseNumber;
              }
            }
          }
        }
      }

      // Priority 2: Fallback to legacy selectors (for edge cases)
      const fallbackField = document.querySelector('slot[name="primaryField"] lightning-formatted-text, records-formula-output[slot="primaryField"] lightning-formatted-text');
      if (fallbackField && fallbackField.offsetParent !== null) {
        const headerText = (fallbackField.textContent || '').trim();
        if (headerText) {
          const numberMatch = headerText.match(/^([0-9]{6,})/);
          if (numberMatch) {
            const caseNumber = numberMatch[1];
            console.log('[PageIdentifier] Found case number from fallback:', caseNumber);
            
            // Update state and notify dependent modules
            this._updateCaseNumberState(caseNumber);
            
            return caseNumber;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('PageIdentifier: Error extracting case number:', error);
      return null;
    }
  },

  /**
   * Update case number state and notify dependent modules
   * Updates GlobalCaseState which all other modules read from
   * @param {string} caseNumber - Detected case number
   * @private
   */
  _updateCaseNumberState(caseNumber) {
    // Skip if case number hasn't changed
    if (this._lastDetectedCaseNumber === caseNumber) {
      return;
    }

    console.log('[PageIdentifier] Case number changed:', this._lastDetectedCaseNumber, '->', caseNumber);
    this._lastDetectedCaseNumber = caseNumber;

    // Get current page info to extract case ID
    const currentPageInfo = this.identifyPage();

    // Update GlobalCaseState (ONLY PageIdentifier can do this)
    if (typeof GlobalCaseState !== 'undefined') {
      GlobalCaseState.updateCaseInfo(
        {
          caseNumber: caseNumber,
          caseId: currentPageInfo.caseId,
          url: window.location.href
        },
        'PageIdentifier'
      );
      console.log('[PageIdentifier] Updated GlobalCaseState:', {
        caseNumber,
        caseId: currentPageInfo.caseId,
        url: window.location.href
      });
    } else {
      console.warn('[PageIdentifier] GlobalCaseState not available!');
    }
  },

  detectCasePageView() {
    try {
      // Get case number from page header
      const caseNumber = this.getCaseNumberFromPage();

      // Check for active tab in Lightning interface
      const activeTab = document.querySelector('a[role="tab"][aria-selected="true"]');
      if (activeTab) {
        const tabText = activeTab.textContent?.trim();

        // Extract just the tab name by removing ALL case numbers (6+ digit sequences)
        let tabName = tabText;
        if (tabText) {
          // Remove all 6+ digit case numbers from the tab text
          tabName = tabText.replace(/\b\d{6,}\b/g, '').trim();
          // Remove leading/trailing separators like | or -
          tabName = tabName.replace(/^[\s|\-]+|[\s|\-]+$/g, '').trim();
          // Remove any duplicate separators in the middle
          tabName = tabName.replace(/[\s|\-]+[\s|\-]+/g, ' | ').trim();
        }

        // Format as "CaseNumber | TabName" if we have both
        if (caseNumber && tabName) {
          // Capitalize first letter of tab name
          const capitalizedTab = tabName.charAt(0).toUpperCase() + tabName.slice(1);
          return `${caseNumber} | ${capitalizedTab}`;
        }

        // If we only have case number, add default "Case" label
        if (caseNumber) {
          return `${caseNumber} | Case`;
        }

        // Fallback to just tab name if no case number
        return tabName || null;
      }

      // Fallback: check for specific components that indicate the view
      if (document.querySelector('records-lwc-detail-panel') ||
          document.querySelector('force-record-layout-item')) {
        return caseNumber ? `${caseNumber} | Details` : 'details';
      }

      if (document.querySelector('runtime_sales_activities-activity-panel') ||
          document.querySelector('[data-component-id*="Communication"]')) {
        return caseNumber ? `${caseNumber} | Communication` : 'communication';
      }

      // Return just case number if we have it but no tab
      return caseNumber ? `${caseNumber} | Case` : null;
    } catch (error) {
      console.log('PageIdentifier: Error detecting case page view:', error);
      return null;
    }
  },

  /**
   * Identifies the current page type
   * @returns {Object} { type: string, caseId: string|null, reportId: string|null, view: string|null }
   */
  identifyPage() {
    const url = window.location.href;
    const hash = window.location.hash;

    console.log('PageIdentifier: Identifying page for URL:', url);

    // Case Page (Details, Communication, or Files Tab)
    const casePageMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/view(?:\?|$)/);
    if (casePageMatch) {
      const view = this.detectCasePageView();
      // Use CaseIdentifiers to get actual case ID (handles ws parameter)
      const actualCaseId = typeof CaseIdentifiers !== 'undefined'
        ? CaseIdentifiers.getCaseIdFromUrl()
        : casePageMatch[1];
      // Extract case number from page header
      const caseNumber = this.getCaseNumberFromPage();
      const result = {
        type: this.pageTypes.CASE_PAGE,
        caseId: actualCaseId,
        caseNumber: caseNumber,
        reportId: null,
        view: view
      };
      console.log('PageIdentifier: Detected CASE_PAGE:', result);
      return result;
    }

    // Case Comments "View All" Page
    const caseCommentsMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/related\/CaseComments\/view(?:\?|$)/);
    if (caseCommentsMatch) {
      // Use CaseIdentifiers to get actual case ID (handles ws parameter)
      const actualCaseId = typeof CaseIdentifiers !== 'undefined'
        ? CaseIdentifiers.getCaseIdFromUrl()
        : caseCommentsMatch[1];
      // Extract case number from page header
      const caseNumber = this.getCaseNumberFromPage();
      const result = {
        type: this.pageTypes.CASE_COMMENTS,
        caseId: actualCaseId,
        caseNumber: caseNumber,
        reportId: null,
        view: 'case_comments'
      };
      console.log('PageIdentifier: Detected CASE_COMMENTS:', result);
      return result;
    }

    // Cases List Page
    if (url.includes('/lightning/o/Case/list')) {
      const result = {
        type: this.pageTypes.CASES_LIST,
        caseId: null,
        caseNumber: null,
        reportId: null,
        view: null
      };
      console.log('PageIdentifier: Detected CASES_LIST:', result);
      return result;
    }

    // Salesforce Reports Home (including with query parameters)
    if (url.includes('/lightning/o/Report/home')) {
      const result = {
        type: this.pageTypes.REPORT_HOME,
        caseId: null,
        caseNumber: null,
        reportId: null,
        view: null
      };
      console.log('PageIdentifier: Detected REPORT_HOME:', result);
      return result;
    }

    // Report Page (with or without query parameters)
    const reportMatch = url.match(/\/lightning\/r\/Report\/([^\/\?]+)(?:\/view)?(?:\?|$)/);
    if (reportMatch) {
      const result = {
        type: this.pageTypes.REPORT_PAGE,
        caseId: null,
        caseNumber: null,
        reportId: reportMatch[1],
        view: null
      };
      console.log('PageIdentifier: Detected REPORT_PAGE:', result);
      return result;
    }

    // Search Page
    if (url.includes('/one/one.app#') && (url.includes('forceSearch:searchPageDesktop') || hash.includes('forceSearch:searchPageDesktop'))) {
      const result = {
        type: this.pageTypes.SEARCH_PAGE,
        caseId: null,
        caseNumber: null,
        reportId: null,
        view: null
      };
      console.log('PageIdentifier: Detected SEARCH_PAGE (direct):', result);
      return result;
    }

    // Search Page with encoded JSON (base64)
    if (url.includes('/one/one.app#') && hash.length > 1) {
      try {
        // Remove the # and URL-decode first (in case of %3D, etc.)
        const encodedData = hash.substring(1);
        const urlDecodedData = decodeURIComponent(encodedData);
        const decodedData = atob(urlDecodedData);
        const jsonData = JSON.parse(decodedData);
        
        // Check for Report Builder
        if (jsonData.componentDef === 'reports:reportBuilder') {
          const result = {
            type: this.pageTypes.REPORT_BUILDER,
            caseId: null,
            caseNumber: null,
            reportId: jsonData.attributes?.recordId || null,
            view: null
          };
          console.log('PageIdentifier: Detected REPORT_BUILDER (encoded):', result);
          return result;
        }

        // Check for Search Page
        if (jsonData.componentDef === 'forceSearch:searchPageDesktop') {
          const result = {
            type: this.pageTypes.SEARCH_PAGE,
            caseId: null,
            caseNumber: null,
            reportId: null,
            view: null
          };
          console.log('PageIdentifier: Detected SEARCH_PAGE (encoded):', result);
          return result;
        }
      } catch (e) {
        console.log('PageIdentifier: Failed to decode hash data:', e.message);
        // If decoding fails, continue with other checks
      }
    }

    const result = {
      type: this.pageTypes.UNKNOWN,
      caseId: null,
      caseNumber: null,
      reportId: null,
      view: null
    };
    console.log('PageIdentifier: Detected UNKNOWN page type:', result);
    return result;
  },

  /**
   * Checks if current page is a case page
   * @returns {boolean}
   */
  isCasePage() {
    const page = this.identifyPage();
    const result = page.type === this.pageTypes.CASE_PAGE || page.type === this.pageTypes.CASE_COMMENTS;
    console.log('PageIdentifier: isCasePage():', result, 'for page type:', page.type);
    return result;
  },

  /**
   * Gets the current case ID if on a case page
   * @returns {string|null}
   */
  getCurrentCaseId() {
    const page = this.identifyPage();
    console.log('PageIdentifier: getCurrentCaseId():', page.caseId, 'for page type:', page.type);
    return page.caseId;
  },

  /**
   * Monitors URL changes and calls callback when page changes
   * Uses NavigationObserver for immediate detection with throttling
   * @param {Function} callback - Called with page info when URL changes
   */
  monitorPageChanges(callback) {
    if (!callback || typeof callback !== 'function') {
      console.error('PageIdentifier: callback must be a function');
      return;
    }

    // Store callback reference
    this._pendingCallback = callback;

    // Get initial page info
    const initialPageInfo = this.identifyPage();
    this._lastPageInfo = initialPageInfo;

    console.log('PageIdentifier: Starting page monitoring. Initial page:', initialPageInfo);

    // Call immediately with initial page (no throttle for first call)
    callback(initialPageInfo);

    // Use NavigationObserver for immediate URL change detection
    if (typeof NavigationObserver !== 'undefined') {
      NavigationObserver.onRouteChange((url) => {
        console.log('PageIdentifier: Navigation detected to:', url);
        this._handleNavigationChange(callback);
      });
    } else {
      console.warn('PageIdentifier: NavigationObserver not available, using fallback');
      
      // Fallback: Listen to popstate for back/forward navigation
      window.addEventListener('popstate', () => {
        console.log('PageIdentifier: Popstate event detected');
        this._handleNavigationChange(callback);
      });
    }
  },

  /**
   * Handle navigation change with throttling and immediate first invocation
   * @param {Function} callback - Callback to invoke
   * @private
   */
  _handleNavigationChange(callback) {
    const newPageInfo = this.identifyPage();

    // Check if page actually changed
    const hasChanges = this._detectPageChanges(newPageInfo);

    if (!hasChanges) {
      console.log('PageIdentifier: URL changed but page info unchanged');
      return;
    }

    // Clear any pending throttle timer
    if (this._throttleTimer) {
      clearTimeout(this._throttleTimer);
      this._throttleTimer = null;
    }

    // Invoke immediately (no throttle delay for navigation changes)
    this._invokeCallback(callback, newPageInfo);

    // Set throttle timer to prevent rapid-fire calls within throttle window
    this._throttleTimer = setTimeout(() => {
      this._throttleTimer = null;
    }, this._throttleDelay);
  },

  /**
   * Detect if page info has changed
   * @param {Object} newPageInfo - New page info
   * @returns {boolean} True if changes detected
   * @private
   */
  _detectPageChanges(newPageInfo) {
    if (!this._lastPageInfo) {
      return true;
    }

    return (
      newPageInfo.type !== this._lastPageInfo.type ||
      newPageInfo.caseId !== this._lastPageInfo.caseId ||
      newPageInfo.reportId !== this._lastPageInfo.reportId ||
      newPageInfo.view !== this._lastPageInfo.view
    );
  },

  /**
   * Invoke callback with page info and cleanup
   * @param {Function} callback - Callback to invoke
   * @param {Object} newPageInfo - New page info
   * @private
   */
  _invokeCallback(callback, newPageInfo) {
    const changes = this._getChangeSummary(newPageInfo);
    console.log(`PageIdentifier: Page changed (${changes}). Triggering callback.`);

    // Cleanup modules on significant changes (but not for view-only changes)
    const pageTypeChanged = newPageInfo.type !== this._lastPageInfo.type;
    const caseIdChanged = newPageInfo.caseId !== this._lastPageInfo.caseId;

    if (pageTypeChanged || caseIdChanged) {
      if (typeof CaseTimezoneResolver !== 'undefined') {
        CaseTimezoneResolver.cleanup();
        console.log('PageIdentifier: CaseTimezoneResolver cleaned up');
      }
    }

    // Update last page info
    this._lastPageInfo = newPageInfo;

    // Invoke callback
    try {
      callback(newPageInfo);
    } catch (error) {
      console.error('PageIdentifier: Error in callback:', error);
    }
  },

  /**
   * Get summary of changes
   * @param {Object} newPageInfo - New page info
   * @returns {string} Summary string
   * @private
   */
  _getChangeSummary(newPageInfo) {
    // If no previous page info, this is the initial page load
    if (!this._lastPageInfo) {
      return 'Initial';
    }

    const changedFields = [];

    if (newPageInfo.type !== this._lastPageInfo.type) {
      changedFields.push('PageType');
    }
    if (newPageInfo.caseId !== this._lastPageInfo.caseId) {
      changedFields.push('CaseID');
    }
    if (newPageInfo.reportId !== this._lastPageInfo.reportId) {
      changedFields.push('ReportID');
    }
    if (newPageInfo.view !== this._lastPageInfo.view) {
      changedFields.push('View');
    }

    return changedFields.join(', ') || 'Unknown';
  },

  /**
   * Cleanup - clear any pending throttle timers
   * Called on navigation away or extension unload
   */
  cleanup() {
    console.log('[PageIdentifier] Cleaning up...');

    // Clear throttle timer
    if (this._throttleTimer) {
      clearTimeout(this._throttleTimer);
      this._throttleTimer = null;
      console.log('[PageIdentifier] Throttle timer cleared');
    }

    // Reset state
    this._lastPageInfo = null;
    this._lastDetectedCaseNumber = null; // Reset case number tracking
    this._pendingCallback = null;
    this._isProcessing = false;

    console.log('[PageIdentifier] Cleanup complete');
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageIdentifier;
}
