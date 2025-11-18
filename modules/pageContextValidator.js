/**
 * Page Context Validator Module
 * Provides validation utilities for page context and stale data prevention
 * Used by all modules that display case data to ensure data integrity
 */

const PageContextValidator = {
  /**
   * Gets current case context from page title and URL
   * This is the most reliable method for page identification
   * @returns {Object|null} { caseId: string, caseNumber: string, caseTitle: string, url: string, title: string } or null
   */
  getCurrentCaseContext() {
    const pageTitle = document.title;
    const currentURL = window.location.href;
    
    // Handle loading state
    if (pageTitle === 'Lightning Experience') {
      return null;
    }
    
    // Extract case ID from URL (most reliable)
    const caseIdMatch = currentURL.match(/\/Case\/([a-zA-Z0-9]{15,18})\//);
    if (!caseIdMatch) {
      return null;
    }
    
    const caseId = caseIdMatch[1];
    
    // Extract case number from title
    // Format: "00001026 | Case | Salesforce" or "00001026 - Subject | Case | Salesforce"
    const titleParts = pageTitle.split(' | ');
    if (titleParts[1] !== 'Case') {
      return null;
    }
    
    // Case number is first part (may include subject)
    const firstPart = titleParts[0].trim();
    const caseNumberMatch = firstPart.match(/^(\d{6,10})/);
    const caseNumber = caseNumberMatch ? caseNumberMatch[1] : null;
    
    // Extract full title (case number + subject)
    const caseTitle = firstPart;
    
    if (caseId && caseNumber) {
      return {
        caseId,
        caseNumber,
        caseTitle,
        url: currentURL,
        title: pageTitle
      };
    }
    
    return null;
  },

  /**
   * Validates page context before displaying data
   * Ensures that the data being displayed matches the current page
   * @param {string} dataCaseId - Case ID from data to display
   * @param {string} dataCaseNumber - Case number from data to display
   * @returns {Object} { valid: boolean, reason: string, currentContext: Object|null }
   */
  validatePageContextBeforeDisplay(dataCaseId, dataCaseNumber) {
    // Step 1: Get current page context (fast, reliable)
    const currentContext = this.getCurrentCaseContext();
    
    if (!currentContext) {
      return {
        valid: false,
        reason: 'Not on a valid case page',
        currentContext: null
      };
    }
    
    // Step 2: Validate case ID matches
    if (dataCaseId && dataCaseId !== currentContext.caseId) {
      console.warn(`[PageContextValidator] Case ID mismatch: data=${dataCaseId}, current=${currentContext.caseId}`);
      return {
        valid: false,
        reason: `Case ID mismatch: ${dataCaseId} !== ${currentContext.caseId}`,
        currentContext
      };
    }
    
    // Step 3: Validate case number matches
    if (dataCaseNumber && dataCaseNumber !== currentContext.caseNumber) {
      console.warn(`[PageContextValidator] Case number mismatch: data=${dataCaseNumber}, current=${currentContext.caseNumber}`);
      return {
        valid: false,
        reason: `Case number mismatch: ${dataCaseNumber} !== ${currentContext.caseNumber}`,
        currentContext
      };
    }
    
    // Step 4: Double-check page is still loading (may have changed)
    if (document.title === 'Lightning Experience') {
      return {
        valid: false,
        reason: 'Page is still loading',
        currentContext
      };
    }
    
    // All validations passed
    return {
      valid: true,
      reason: 'Context validated',
      currentContext
    };
  },

  /**
   * Safe data display wrapper with validation
   * @param {Object} data - Data to display (must have caseId and/or caseNumber)
   * @param {Function} displayFn - Function to call if validation passes (receives data)
   * @param {Function} clearFn - Optional function to call if validation fails (for clearing stale data)
   * @returns {boolean} True if data was displayed, false if validation failed
   */
  safeDisplayCaseData(data, displayFn, clearFn = null) {
    if (!data) {
      if (clearFn && typeof clearFn === 'function') {
        clearFn(null);
      }
      return false;
    }

    // Validate before displaying
    const validation = this.validatePageContextBeforeDisplay(data.caseId, data.caseNumber);
    
    if (!validation.valid) {
      console.warn(`[PageContextValidator] Cannot display data: ${validation.reason}`);
      
      // Clear stale data if clear function provided
      if (clearFn && typeof clearFn === 'function') {
        clearFn(null);
      }
      
      return false;
    }
    
    // Safe to display
    if (typeof displayFn === 'function') {
      displayFn(data);
    }
    
    return true;
  },

  /**
   * Extracts case ID from URL
   * Helper function for modules that need just the case ID
   * @returns {string|null}
   */
  getCaseIdFromUrl() {
    const match = window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})\//);
    return match ? match[1] : null;
  },

  /**
   * Checks if currently on a case page
   * @returns {boolean}
   */
  isOnCasePage() {
    const context = this.getCurrentCaseContext();
    return context !== null;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageContextValidator;
}

