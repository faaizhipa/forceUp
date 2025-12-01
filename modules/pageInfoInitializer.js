/**
 * PageInfo Initializer
 * 
 * PURPOSE:
 * Ensures page type information is available EARLY at document_start,
 * before modules like persistentBanner.js that depend on it.
 * 
 * PROBLEM SOLVED:
 * In SPA environments like Salesforce Lightning, modules load asynchronously.
 * persistentBanner.js may initialize before PageIdentifier.identifyPage() is called,
 * leading to race conditions where page info is undefined.
 * 
 * SOLUTION:
 * 1. Run at document_start (before DOM is ready)
 * 2. Use PageIdentifier.identifyPageFromUrl() for immediate URL-based identification
 * 3. Store result in window.exLibrisPageInfo global
 * 4. Set ready flag and dispatch 'exLibrisPageInfoReady' event
 * 5. When DOM is ready, update with full identifyPage() result
 * 6. Monitor URL changes and update pageInfo accordingly
 * 
 * USAGE:
 * Modules can check:
 * - window.exLibrisPageInfo.ready - boolean flag
 * - window.exLibrisPageInfo.current - the current pageInfo object
 * - Listen for 'exLibrisPageInfoReady' event if not ready yet
 * - Listen for 'exLibrisPageInfoUpdated' event for subsequent updates
 */

(function() {
  'use strict';

  // ========== GLOBAL STATE ==========
  
  /**
   * Global pageInfo state object
   * Available to all content scripts via window.exLibrisPageInfo
   */
  window.exLibrisPageInfo = window.exLibrisPageInfo || {
    ready: false,
    current: null,
    partial: true,  // true until full DOM-based identification completes
    lastUrl: null,
    lastUpdated: null,
    source: null    // 'url-only' | 'full' | 'navigation'
  };

  // ========== INITIALIZER MODULE ==========

  const PageInfoInitializer = {
    isInitialized: false,
    domReadyCallbackFired: false,
    urlChangeObserver: null,
    titleObserver: null,
    
    /**
     * Initialize the pageInfo system
     * Called immediately at document_start
     */
    init() {
      if (this.isInitialized) {
        console.log('[PageInfoInitializer] Already initialized');
        return;
      }

      console.log('[PageInfoInitializer] Initializing at document_start...');
      
      // Phase 1: Immediate URL-based identification (no DOM needed)
      this.identifyFromUrl();
      
      // Phase 2: Set up DOM ready callback for full identification
      this.waitForDomReady(() => {
        this.identifyFull();
      });
      
      // Phase 3: Set up navigation monitoring
      this.setupNavigationMonitoring();
      
      this.isInitialized = true;
      console.log('[PageInfoInitializer] Initialization complete');
    },

    /**
     * Phase 1: Identify page from URL only (DOM-free)
     * This runs immediately at document_start
     */
    identifyFromUrl() {
      const url = window.location.href;
      
      // Check if PageIdentifier is loaded
      if (typeof PageIdentifier === 'undefined') {
        console.warn('[PageInfoInitializer] PageIdentifier not loaded yet, deferring...');
        // Retry after a short delay
        setTimeout(() => this.identifyFromUrl(), 50);
        return;
      }

      // Check if the new method exists
      if (typeof PageIdentifier.identifyPageFromUrl !== 'function') {
        console.warn('[PageInfoInitializer] identifyPageFromUrl() not available, using fallback');
        // Fallback: create minimal pageInfo from URL manually
        const pageInfo = this.fallbackIdentifyFromUrl(url);
        this.updatePageInfo(pageInfo, 'url-only-fallback');
        return;
      }

      try {
        const pageInfo = PageIdentifier.identifyPageFromUrl(url);
        this.updatePageInfo(pageInfo, 'url-only');
        console.log('[PageInfoInitializer] URL-based identification complete:', pageInfo);
      } catch (error) {
        console.error('[PageInfoInitializer] Error in URL identification:', error);
        // Set minimal pageInfo even on error
        this.updatePageInfo({
          type: 'UNKNOWN',
          caseId: null,
          caseNumber: null,
          reportId: null,
          view: null,
          partial: true,
          error: error.message
        }, 'error');
      }
    },

    /**
     * Fallback URL identification when PageIdentifier.identifyPageFromUrl is not available
     * @param {string} url - URL to identify
     * @returns {Object} Minimal pageInfo
     */
    fallbackIdentifyFromUrl(url) {
      // Basic URL pattern matching
      let type = 'UNKNOWN';
      let caseId = null;
      let reportId = null;

      // Case page: /lightning/r/Case/{id}/view
      const caseMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/view/);
      if (caseMatch) {
        type = 'CASE_PAGE';
        caseId = caseMatch[1];
      }
      // Case comments: /lightning/r/Case/{id}/related/CaseComments
      else if (url.includes('/related/CaseComments')) {
        type = 'CASE_COMMENTS';
        const match = url.match(/\/lightning\/r\/Case\/([^\/]+)/);
        caseId = match ? match[1] : null;
      }
      // Cases list: /lightning/o/Case/list
      else if (url.includes('/lightning/o/Case/list')) {
        type = 'CASES_LIST';
      }
      // Report page: /lightning/r/Report/{id}
      else if (url.includes('/lightning/r/Report/')) {
        const match = url.match(/\/lightning\/r\/Report\/([^\/]+)/);
        reportId = match ? match[1] : null;
        type = url.includes('/edit') ? 'REPORT_BUILDER' : 'REPORT_PAGE';
      }
      // Report home: /lightning/o/Report/home
      else if (url.includes('/lightning/o/Report/home')) {
        type = 'REPORT_HOME';
      }

      return {
        type,
        caseId,
        caseNumber: null,
        reportId,
        view: null,
        partial: true
      };
    },

    /**
     * Phase 2: Full DOM-based identification
     * Called when DOM is ready
     */
    identifyFull() {
      if (this.domReadyCallbackFired) {
        console.log('[PageInfoInitializer] DOM ready callback already fired, skipping');
        return;
      }
      this.domReadyCallbackFired = true;

      console.log('[PageInfoInitializer] DOM ready, performing full identification...');

      if (typeof PageIdentifier === 'undefined') {
        console.warn('[PageInfoInitializer] PageIdentifier not available for full identification');
        return;
      }

      try {
        const pageInfo = PageIdentifier.identifyPage();
        if (pageInfo) {
          pageInfo.partial = false; // Full identification complete
          this.updatePageInfo(pageInfo, 'full');
          console.log('[PageInfoInitializer] Full identification complete:', pageInfo);
        }
      } catch (error) {
        console.error('[PageInfoInitializer] Error in full identification:', error);
      }
    },

    /**
     * Update the global pageInfo state
     * @param {Object} pageInfo - New pageInfo object
     * @param {string} source - Source of the update ('url-only', 'full', 'navigation')
     */
    updatePageInfo(pageInfo, source) {
      const previousPageInfo = window.exLibrisPageInfo.current;
      const wasReady = window.exLibrisPageInfo.ready;

      window.exLibrisPageInfo.current = pageInfo;
      window.exLibrisPageInfo.partial = pageInfo.partial !== false;
      window.exLibrisPageInfo.lastUrl = window.location.href;
      window.exLibrisPageInfo.lastUpdated = Date.now();
      window.exLibrisPageInfo.source = source;
      window.exLibrisPageInfo.ready = true;

      // Dispatch ready event (first time only)
      if (!wasReady) {
        console.log('[PageInfoInitializer] Dispatching exLibrisPageInfoReady event');
        const readyEvent = new CustomEvent('exLibrisPageInfoReady', {
          detail: { pageInfo, source },
          bubbles: true,
          composed: true
        });
        document.dispatchEvent(readyEvent);
        window.dispatchEvent(readyEvent);
      }

      // Dispatch update event (for navigation changes)
      if (wasReady && previousPageInfo) {
        const hasChanged = previousPageInfo.caseId !== pageInfo.caseId ||
                          previousPageInfo.type !== pageInfo.type ||
                          previousPageInfo.reportId !== pageInfo.reportId;
        
        if (hasChanged) {
          console.log('[PageInfoInitializer] Dispatching exLibrisPageInfoUpdated event');
          const updateEvent = new CustomEvent('exLibrisPageInfoUpdated', {
            detail: { pageInfo, previousPageInfo, source },
            bubbles: true,
            composed: true
          });
          document.dispatchEvent(updateEvent);
          window.dispatchEvent(updateEvent);
        }
      }
    },

    /**
     * Wait for DOM to be ready
     * @param {Function} callback - Callback to execute when DOM is ready
     */
    waitForDomReady(callback) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
      } else {
        // DOM already loaded
        callback();
      }
    },

    /**
     * Phase 3: Set up navigation monitoring for SPA navigation
     */
    setupNavigationMonitoring() {
      // Track the last URL to detect changes
      let lastUrl = window.location.href;

      // Method 1: History API interception
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      const self = this;

      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        self.handleNavigation('pushState');
      };

      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        self.handleNavigation('replaceState');
      };

      // Method 2: Popstate events (back/forward navigation)
      window.addEventListener('popstate', () => {
        this.handleNavigation('popstate');
      });

      // Method 3: Hash change events
      window.addEventListener('hashchange', () => {
        this.handleNavigation('hashchange');
      });

      // Method 4: Title change observer (Salesforce updates title on navigation)
      // Only set up after DOM is ready
      this.waitForDomReady(() => {
        this.setupTitleObserver();
      });

      console.log('[PageInfoInitializer] Navigation monitoring set up');
    },

    /**
     * Set up MutationObserver on document title
     */
    setupTitleObserver() {
      const titleElement = document.querySelector('title');
      if (!titleElement) {
        console.warn('[PageInfoInitializer] No title element found for observer');
        return;
      }

      this.titleObserver = new MutationObserver(() => {
        // Title changed - might indicate navigation
        const currentUrl = window.location.href;
        if (currentUrl !== window.exLibrisPageInfo.lastUrl) {
          this.handleNavigation('title-change');
        }
      });

      this.titleObserver.observe(titleElement, {
        childList: true,
        subtree: true,
        characterData: true
      });

      console.log('[PageInfoInitializer] Title observer set up');
    },

    /**
     * Handle navigation events
     * @param {string} trigger - What triggered the navigation ('pushState', 'popstate', etc.)
     */
    handleNavigation(trigger) {
      const currentUrl = window.location.href;
      
      // Skip if URL hasn't actually changed
      if (currentUrl === window.exLibrisPageInfo.lastUrl) {
        return;
      }

      console.log(`[PageInfoInitializer] Navigation detected (${trigger}):`, currentUrl);

      // Debounce rapid navigation events
      if (this.navigationDebounceTimer) {
        clearTimeout(this.navigationDebounceTimer);
      }

      this.navigationDebounceTimer = setTimeout(() => {
        // Re-identify page
        if (typeof PageIdentifier !== 'undefined' && typeof PageIdentifier.identifyPage === 'function') {
          try {
            const pageInfo = PageIdentifier.identifyPage();
            if (pageInfo) {
              pageInfo.partial = false;
              this.updatePageInfo(pageInfo, 'navigation');
            }
          } catch (error) {
            console.error('[PageInfoInitializer] Error identifying page after navigation:', error);
            // Fall back to URL-only identification
            this.identifyFromUrl();
          }
        } else {
          // PageIdentifier not available - use URL-only
          this.identifyFromUrl();
        }
      }, 250); // 250ms debounce
    },

    /**
     * Cleanup observers
     */
    cleanup() {
      if (this.titleObserver) {
        this.titleObserver.disconnect();
        this.titleObserver = null;
      }

      if (this.navigationDebounceTimer) {
        clearTimeout(this.navigationDebounceTimer);
        this.navigationDebounceTimer = null;
      }

      console.log('[PageInfoInitializer] Cleaned up');
    }
  };

  // ========== IMMEDIATE INITIALIZATION ==========
  
  // Initialize immediately when script loads (at document_start)
  PageInfoInitializer.init();

  // Export for debugging/testing
  window.PageInfoInitializer = PageInfoInitializer;

})();
