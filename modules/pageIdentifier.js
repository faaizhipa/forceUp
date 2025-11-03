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
    SEARCH_PAGE: 'search_page',
    UNKNOWN: 'unknown'
  },

  /**
   * Identifies the current page type
   * @returns {Object} { type: string, caseId: string|null, reportId: string|null }
   */
  identifyPage() {
    const url = window.location.href;
    const hash = window.location.hash;

    console.log('PageIdentifier: Identifying page for URL:', url);

    // Case Page (Details, Communication, or Files Tab)
    const casePageMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/view(?:\?|$)/);
    if (casePageMatch) {
      const result = {
        type: this.pageTypes.CASE_PAGE,
        caseId: casePageMatch[1],
        reportId: null
      };
      console.log('PageIdentifier: Detected CASE_PAGE:', result);
      return result;
    }

    // Case Comments "View All" Page
    const caseCommentsMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/related\/CaseComments\/view(?:\?|$)/);
    if (caseCommentsMatch) {
      const result = {
        type: this.pageTypes.CASE_COMMENTS,
        caseId: caseCommentsMatch[1],
        reportId: null
      };
      console.log('PageIdentifier: Detected CASE_COMMENTS:', result);
      return result;
    }

    // Cases List Page
    if (url.includes('/lightning/o/Case/list')) {
      const result = {
        type: this.pageTypes.CASES_LIST,
        caseId: null,
        reportId: null
      };
      console.log('PageIdentifier: Detected CASES_LIST:', result);
      return result;
    }

    // Salesforce Reports Home (including with query parameters)
    if (url.includes('/lightning/o/Report/home')) {
      const result = {
        type: this.pageTypes.REPORT_HOME,
        caseId: null,
        reportId: null
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
        reportId: reportMatch[1]
      };
      console.log('PageIdentifier: Detected REPORT_PAGE:', result);
      return result;
    }

    // Search Page
    if (url.includes('/one/one.app#') && (url.includes('forceSearch:searchPageDesktop') || hash.includes('forceSearch:searchPageDesktop'))) {
      const result = {
        type: this.pageTypes.SEARCH_PAGE,
        caseId: null,
        reportId: null
      };
      console.log('PageIdentifier: Detected SEARCH_PAGE (direct):', result);
      return result;
    }

    // Search Page with encoded JSON (base64)
    if (url.includes('/one/one.app#') && hash.length > 1) {
      try {
        // Remove the # and decode the base64 JSON
        const encodedData = hash.substring(1);
        const decodedData = atob(encodedData);
        const jsonData = JSON.parse(decodedData);
        
        if (jsonData.componentDef === 'forceSearch:searchPageDesktop') {
          const result = {
            type: this.pageTypes.SEARCH_PAGE,
            caseId: null,
            reportId: null
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
      reportId: null
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
   * @param {Function} callback - Called with page info when URL changes
   */
  monitorPageChanges(callback) {
    let lastUrl = window.location.href;
    let lastPageInfo = this.identifyPage();
    let exlDebounceTimerUrlCheck = null;

    console.log('PageIdentifier: Starting page monitoring. Initial page:', lastPageInfo);

    // Call immediately
    callback(lastPageInfo);

    // Debounced URL check function
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('PageIdentifier: URL changed from', lastUrl, 'to', currentUrl);
        lastUrl = currentUrl;
        const newPageInfo = this.identifyPage();

        // Only call callback if page type or ID changed
        if (newPageInfo.type !== lastPageInfo.type ||
            newPageInfo.caseId !== lastPageInfo.caseId ||
            newPageInfo.reportId !== lastPageInfo.reportId) {
          console.log('PageIdentifier: Page changed from', lastPageInfo, 'to', newPageInfo);
          
          // Cleanup CaseTimezoneResolver on page change
          if (typeof CaseTimezoneResolver !== 'undefined') {
            CaseTimezoneResolver.cleanup();
            console.log('PageIdentifier: CaseTimezoneResolver cleaned up');
          }
          
          lastPageInfo = newPageInfo;
          callback(newPageInfo);
        } else {
          console.log('PageIdentifier: URL changed but page info unchanged:', newPageInfo);
        }
      }
    };

    // Monitor URL changes with debouncing to prevent multiple triggers
    const observer = new MutationObserver(() => {
      // Clear existing timer
      if (exlDebounceTimerUrlCheck) {
        clearTimeout(exlDebounceTimerUrlCheck);
      }
      
      // Set new timer - only check URL after DOM has settled
      exlDebounceTimerUrlCheck = setTimeout(checkUrlChange, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen to popstate for back/forward navigation
    window.addEventListener('popstate', () => {
      console.log('PageIdentifier: Popstate event detected');
      const newPageInfo = this.identifyPage();
      if (newPageInfo.type !== lastPageInfo.type ||
          newPageInfo.caseId !== lastPageInfo.caseId) {
        console.log('PageIdentifier: Popstate page change from', lastPageInfo, 'to', newPageInfo);
        
        // Cleanup CaseTimezoneResolver on popstate
        if (typeof CaseTimezoneResolver !== 'undefined') {
          CaseTimezoneResolver.cleanup();
          console.log('PageIdentifier: CaseTimezoneResolver cleaned up (popstate)');
        }
        
        lastPageInfo = newPageInfo;
        callback(newPageInfo);
      }
    });
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageIdentifier;
}
