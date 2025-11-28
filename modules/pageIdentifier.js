/**
 * Page Identifier Module
 * Identifies the current Salesforce page type based on URL patterns
 */

const PageIdentifier = {
  pageTypes: {
    CASE_PAGE_CHILD: 'case_page_child',
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
  _throttleTimer: null,
  _throttleDelay: 300, // 300ms throttle delay
  _pendingCallback: null,
  _isProcessing: false,

  /**
   * Gets current case context with validation (delegates to PageContextValidator)
   * @returns {Object|null} { caseId: string, caseNumber: string, caseTitle: string } or null
   */
  getCurrentCaseContext() {
    if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.getCurrentCaseContext === 'function') {
      return PageContextValidator.getCurrentCaseContext();
    }
    // Fallback if PageContextValidator not available
    return null;
  },

  /**
   * Normalizes tab label to standard format
   * @param {string} label - Tab label to normalize
   * @returns {string} Normalized tab label
   */
  normalizeTabLabel(label) {
    const normalized = (label || '').toLowerCase().trim();
    const mappings = {
      'details': 'details',
      'detail': 'details',
      'communication': 'communication',
      'communications': 'communication',
      'related': 'related',
      'files': 'files',
      'file': 'files',
      'attachments': 'files',
      'attachment': 'files',
      'history': 'history',
      'reporting fields': 'reporting_fields',
      'reporting': 'reporting_fields'
    };
    return mappings[normalized] || normalized;
  },

  /**
   * Detects the active tab view on a case page
   * Uses best practice: data-label + slds-is-active (most reliable)
   * @returns {string|null} 'details', 'communication', 'files', or null if not detectable
   */
  detectCasePageView() {
    try {
      // Strategy 1: data-label + slds-is-active (BEST - most reliable)
      const activeTab = document.querySelector('.slds-tabs_default__item.slds-is-active');
      if (activeTab && activeTab.dataset.label) {
        return this.normalizeTabLabel(activeTab.dataset.label);
      }

      // Strategy 2: aria-selected + title or data-label
      const activeByAria = document.querySelector('a[role="tab"][aria-selected="true"]');
      if (activeByAria) {
        // Try data-label first
        if (activeByAria.closest('li')?.dataset.label) {
          return this.normalizeTabLabel(activeByAria.closest('li').dataset.label);
        }
        // Fallback to title or text content
        const label = activeByAria.title || activeByAria.textContent?.trim();
        if (label) {
          return this.normalizeTabLabel(label);
        }
      }
      
      // Strategy 3: Component-based detection (fallback)
      if (document.querySelector('records-lwc-detail-panel') || 
          document.querySelector('force-record-layout-item')) {
        return 'details';
      }
      
      if (document.querySelector('runtime_sales_activities-activity-panel') ||
          document.querySelector('[data-component-id*="Communication"]')) {
        return 'communication';
      }
      
      return null;
    } catch (error) {
      console.log('PageIdentifier: Error detecting case page view:', error);
      return null;
    }
  },

  /**
   * Identifies the current page type with title + URL validation
   * @returns {Object} { type: string, caseId: string|null, caseNumber: string|null, reportId: string|null, view: string|null }
   */
  identifyPage() {
    const url = window.location.href;
    const hash = window.location.hash;

    console.log('PageIdentifier: Identifying page for URL:', url);

    // Case Page (Details, Communication, or Files Tab)
    const casePageMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/view(?:\?|$)/);
    if (casePageMatch) {
      const caseId = casePageMatch[1];
      
      // Get case context with title + URL validation
      const context = this.getCurrentCaseContext();
      
      // Validate case ID matches context (if context available)
      if (context !== null && context.caseId !== caseId) {
        console.warn(`[PageIdentifier] Case ID mismatch: URL=${caseId}, Context=${context.caseId}`);
      }
      
      const view = this.detectCasePageView();

      
      // Detect a "parent case" and "child case" scenario in the URL
      // Example: 
      // https://proquestllc.lightning.force.com/lightning/r/Case/500QO00000KaijmYAB/view?ws=%2Flightning%2Fr%2FCase%2F500QO00000kGONGYA4%2Fview
      // The 'ws' param encodes the child case being viewed inside the workspace/tab (as a URL-encoded inner path)
      let childCaseId = null;
      try {
        const parsedUrl = new URL(url);
        const wsParam = parsedUrl.searchParams.get('ws');
        if (wsParam && wsParam.includes('/lightning/r/Case/')) {
          // In some cases, wsParam may be encoded twice; try both approaches
          let decodedWs = decodeURIComponent(wsParam);
          try {
            // Try a second decode if there's still %2F in the string
            if (decodedWs.includes('%2F')) {
              decodedWs = decodeURIComponent(decodedWs);
            }
          } catch (_) { /* ignore */ }
          const childCaseMatch = decodedWs.match(/\/lightning\/r\/Case\/([^\/]+)\/view/);
          if (childCaseMatch) {
            childCaseId = childCaseMatch[1];
          }
        }
      } catch (e) {
        // Malformed URL or decoding error: ignore
      }

      // If we found a child case ID in the workspace param, use it as primary caseId
      // but keep the parent caseId as well for reference if needed in the future.
      if (childCaseId) {
        console.log(`[PageIdentifier] Child case ID detected in ws param: ${childCaseId} (parent caseId: ${caseId})`);
        // Replace 'caseId' in this context with the child, since that's the page in focus
        // Optionally, could add a field for parentId in result in future
        parentCaseId = caseId;
        caseId = childCaseId;
      }
      // Extract case number from title if available
      // Try to extract case number from the active tab label in Salesforce, falling back to document title if not found
      let caseNumberFromTab = null;
      try {
        // Look for the active tab element in standard Salesforce Lightning UI
        const activeTab = document.querySelector('.slds-tabs_default__item.slds-is-active');
        if (activeTab && activeTab.dataset && activeTab.dataset.label) {
          // The label might be like "00012345 - Subject", so extract the leading 6-10 digit case number
          const tabCaseNumberMatch = activeTab.dataset.label.match(/^(\d{6,10})/);
          if (tabCaseNumberMatch) {
            caseNumberFromTab = tabCaseNumberMatch[1];
          }
        }
      } catch (err) {
        // fallback, ignore, we'll try other methods
      }

      let caseNumberFromParentTab = null;
      if (childCaseId) {
        if (caseNumberFromTab) {
          caseNumberFromParentTab = caseNumberFromTab;
        }
        // Try to extract the case number for the child case from a tab label
        // Per instruction: extract the case number from the following selector
        // We assume you meant this selector for the child case workspace tab
        try {
          // This selector targets tabs in the Lightning UI; prefer the child caseId if present
          const tabList = Array.from(document.querySelectorAll('.slds-tabs_default__item'));
          let childTab = null;
          // Attempt to find a tab with the child caseId in its data attributes or label
          for (const tab of tabList) {
            // Prefer a data-label attribute that starts with 6-10 digits, or contains the child case id
            const label = tab.dataset && tab.dataset.label ? tab.dataset.label : '';
            if (label.match(/^(\d{6,10})/) && label.includes(childCaseId.slice(0, 6))) {
              childTab = tab;
              break;
            }
            // Or just try to match the caseId in data attributes (Robustness)
            if (
              (tab.dataset && tab.dataset.recordId && tab.dataset.recordId === childCaseId) ||
              (tab.dataset && tab.dataset.tabValue && tab.dataset.tabValue.includes(childCaseId))
            ) {
              childTab = tab;
              break;
            }
          }
          // Fallback: pick the first tab with case number pattern (6-10 digits at start)
          if (!childTab) {
            childTab = tabList.find(tab => {
              const label = tab.dataset && tab.dataset.label ? tab.dataset.label : '';
              return label.match(/^(\d{6,10})/);
            });
          }
          // Extract the case number from the found tab, if any
          if (childTab && childTab.dataset && childTab.dataset.label) {
            const match = childTab.dataset.label.match(/^(\d{6,10})/);
            if (match) {
              caseNumberFromTab = match[1];
            }
          }
        } catch (e) {
          // Ignore selector/parsing errors, fallback to defaults
        }
      }
      const titleMatch = caseNumberFromTab 
        ? [caseNumberFromTab] 
        : document.title.match(/^(\d{6,10})/);
      const caseNumberFromTitle = titleMatch ? titleMatch[1] : null;
      
      let result = null;

      if (childCaseId) {
        console.log(`[PageIdentifier] Child case ID detected in ws param: ${childCaseId} (parent caseId: ${caseId})`);
        result = {
          type: this.pageTypes.CASE_PAGE_CHILD,
          caseId: childCaseId,
          parentCaseId: caseId,
          caseNumber: caseNumberFromTab || caseNumberFromTitle,
          parentCaseNumber: parentCaseNumber,
          reportId: null,
          view: view,
          url: url
        }
      } else {
      result = {
        type: this.pageTypes.CASE_PAGE,
        caseId: context?.caseId || caseId, // Use validated case ID from context if available
        caseNumber: caseNumberFromTitle || context?.caseNumber || null,
        reportId: null,
        view: view,
        url: url
      };
    }
      
      // Validate page info before returning
      const validatedResult = this.validatePageInfo(result);
      console.log(`[PageIdentifier] Detected ${result.type}: ${validatedResult.caseId} - ${validatedResult.caseNumber}`);
      return result;
    }

    // Case Comments "View All" Page
    const caseCommentsMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/related\/CaseComments\/view(?:\?|$)/);
    if (caseCommentsMatch) {
      const caseId = caseCommentsMatch[1];
      const context = this.getCurrentCaseContext();
      
      // Extract case number from title if available
      const titleMatch = document.title.match(/^(\d{6,10})/);
      const caseNumberFromTitle = titleMatch ? titleMatch[1] : null;
      
      const result = {
        type: this.pageTypes.CASE_COMMENTS,
        caseId: context?.caseId || caseId,
        caseNumber: caseNumberFromTitle || context?.caseNumber || null,
        reportId: null,
        view: 'case_comments'
      };
      const validatedResult = this.validatePageInfo(result);
      console.log('PageIdentifier: Detected CASE_COMMENTS:', validatedResult);
      return validatedResult;
    }

    // Cases List Page
    if (url.includes('/lightning/o/Case/list')) {
      const result = {
        type: this.pageTypes.CASES_LIST,
        caseId: null,
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
   * Validates page info before returning
   * Ensures case ID and case number match current context
   * @param {Object} pageInfo - Page info to validate
   * @returns {Object} Validated page info
   */
  validatePageInfo(pageInfo) {
    if (pageInfo.type === this.pageTypes.CASE_PAGE || pageInfo.type === this.pageTypes.CASE_COMMENTS) {
      if (pageInfo.caseId) {
        const context = this.getCurrentCaseContext();
        
        if (context) {
          // Validate case ID matches
          if (pageInfo.caseId !== context.caseId) {
            console.warn(`[PageIdentifier] Case ID mismatch in page info, correcting`);
            return {
              ...pageInfo,
              caseId: context.caseId, // Use validated case ID
              caseNumber: context.caseNumber
            };
          }
          
          // Add case number if missing
          if (!pageInfo.caseNumber && context.caseNumber) {
            return {
              ...pageInfo,
              caseNumber: context.caseNumber
            };
          }
        }
      }
    }
    
    return pageInfo;
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
    // Register with priority=true to ensure PageIdentifier runs before other callbacks (e.g., PersistentBanner)
    if (typeof NavigationObserver !== 'undefined') {
      NavigationObserver.onRouteChange((url) => {
        console.log('PageIdentifier: Navigation detected to:', url);
        this._handleNavigationChange(callback);
      }, true); // Priority callback - runs before regular callbacks
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
    hasChanges = newPageInfo.url ?? (newPageInfo.url !== result._lastPageInfo.url || newPageInfo.url !== window.location.href);

    if (!hasChanges) {
      console.log('PageIdentifier: URL same, page info unchanged');
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
      // Module cleanup handled by individual modules
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
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageIdentifier;
}
