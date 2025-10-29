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

    // Case Page (Details, Communication, or Files Tab)
    const casePageMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/view/);
    if (casePageMatch) {
      return {
        type: this.pageTypes.CASE_PAGE,
        caseId: casePageMatch[1],
        reportId: null
      };
    }

    // Case Comments "View All" Page
    const caseCommentsMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/related\/CaseComments\/view/);
    if (caseCommentsMatch) {
      return {
        type: this.pageTypes.CASE_COMMENTS,
        caseId: caseCommentsMatch[1],
        reportId: null
      };
    }

    // Cases List Page
    if (url.includes('/lightning/o/Case/list')) {
      return {
        type: this.pageTypes.CASES_LIST,
        caseId: null,
        reportId: null
      };
    }

    // Salesforce Reports Home
    if (url.includes('/lightning/o/Report/home')) {
      return {
        type: this.pageTypes.REPORT_HOME,
        caseId: null,
        reportId: null
      };
    }

    // Report Page
    const reportMatch = url.match(/\/lightning\/r\/Report\/([^\/]+)\/view/);
    if (reportMatch) {
      return {
        type: this.pageTypes.REPORT_PAGE,
        caseId: null,
        reportId: reportMatch[1]
      };
    }

    // Search Page
    if (url.includes('/one/one.app#') && (url.includes('forceSearch:searchPageDesktop') || hash.includes('forceSearch:searchPageDesktop'))) {
      return {
        type: this.pageTypes.SEARCH_PAGE,
        caseId: null,
        reportId: null
      };
    }

    return {
      type: this.pageTypes.UNKNOWN,
      caseId: null,
      reportId: null
    };
  },

  /**
   * Checks if current page is a case page
   * @returns {boolean}
   */
  isCasePage() {
    const page = this.identifyPage();
    return page.type === this.pageTypes.CASE_PAGE || page.type === this.pageTypes.CASE_COMMENTS;
  },

  /**
   * Gets the current case ID if on a case page
   * @returns {string|null}
   */
  getCurrentCaseId() {
    const page = this.identifyPage();
    return page.caseId;
  },

  /**
   * Monitors URL changes and calls callback when page changes
   * @param {Function} callback - Called with page info when URL changes
   */
  monitorPageChanges(callback) {
    let lastUrl = window.location.href;
    let lastPageInfo = this.identifyPage();
    let debounceTimer = null;

    // Call immediately
    callback(lastPageInfo);

    // Debounced URL check function
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        const newPageInfo = this.identifyPage();

        // Only call callback if page type or ID changed
        if (newPageInfo.type !== lastPageInfo.type ||
            newPageInfo.caseId !== lastPageInfo.caseId ||
            newPageInfo.reportId !== lastPageInfo.reportId) {
          lastPageInfo = newPageInfo;
          callback(newPageInfo);
        }
      }
    };

    // Monitor URL changes with debouncing to prevent multiple triggers
    const observer = new MutationObserver(() => {
      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Set new timer - only check URL after DOM has settled
      debounceTimer = setTimeout(checkUrlChange, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen to popstate for back/forward navigation
    window.addEventListener('popstate', () => {
      const newPageInfo = this.identifyPage();
      if (newPageInfo.type !== lastPageInfo.type ||
          newPageInfo.caseId !== lastPageInfo.caseId) {
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
