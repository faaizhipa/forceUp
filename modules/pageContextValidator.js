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
   * Waits for document.title to update with the expected case number
   * Used when case ID matches but case number doesn't (title may update later)
   * @param {string} expectedCaseNumber - The case number we're waiting for
   * @param {number} maxWaitMs - Maximum time to wait in milliseconds (default: 2000)
   * @returns {Promise<Object|null>} Updated context or null if timeout
   */
  async waitForTitleUpdate(expectedCaseNumber, maxWaitMs = 2000) {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms
    let timeoutId = null;
    
    return new Promise((resolve, reject) => {
      try {
        const checkTitle = () => {
          try {
            const elapsed = Date.now() - startTime;
            
            if (elapsed >= maxWaitMs) {
              // Timeout - return current context even if it doesn't match
              const context = this.getCurrentCaseContext();
              timeoutId = null;
              resolve(context);
              return;
            }
            
            const context = this.getCurrentCaseContext();
            
            // If title has updated with expected case number, return it
            if (context && context.caseNumber === expectedCaseNumber) {
              console.log(`[PageContextValidator] Title updated after ${elapsed}ms`);
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              resolve(context);
              return;
            }
            
            // Continue waiting
            timeoutId = setTimeout(checkTitle, checkInterval);
          } catch (error) {
            console.error('[PageContextValidator] Error in waitForTitleUpdate check:', error);
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            reject(error);
          }
        };
        
        checkTitle();
      } catch (error) {
        console.error('[PageContextValidator] Error setting up waitForTitleUpdate:', error);
        reject(error);
      }
    });
  },

  /**
   * Validates page context before displaying data
   * Ensures that the data being displayed matches the current page
   * If case IDs match but case numbers don't, waits for title update (SPA navigation timing issue)
   * @param {string} dataCaseId - Case ID from data to display
   * @param {string} dataCaseNumber - Case number from data to display
   * @param {boolean} waitForTitle - Whether to wait for title update if case numbers don't match (default: true)
   * @returns {Object|Promise<Object>} { valid: boolean, reason: string, currentContext: Object|null }
   */
  validatePageContextBeforeDisplay(dataCaseId, dataCaseNumber, waitForTitle = true) {
    // Step 1: Get current page context (fast, reliable)
    const currentContext = this.getCurrentCaseContext();
    
    if (!currentContext) {
      return {
        valid: false,
        reason: 'Not on a valid case page',
        currentContext: null
      };
    }
    
    // Step 2: Validate case ID matches (most reliable - from URL)
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
      // Case IDs match but case numbers don't - this is likely a timing issue
      // During SPA navigation, DOM updates before document.title
      // If waitForTitle is enabled, wait for title to update
      if (waitForTitle && dataCaseId === currentContext.caseId) {
        console.log(`[PageContextValidator] Case number mismatch but case IDs match. Waiting for title update...`);
        console.log(`[PageContextValidator] Data caseNumber: ${dataCaseNumber}, Current title caseNumber: ${currentContext.caseNumber}`);
        
        // Return a promise that waits for title update
        return this.waitForTitleUpdate(dataCaseNumber, 2000).then((updatedContext) => {
          if (!updatedContext) {
            return {
              valid: false,
              reason: 'Title update timeout',
              currentContext: null
            };
          }
          
          // Check again after title update
          if (updatedContext.caseNumber === dataCaseNumber) {
            console.log(`[PageContextValidator] Title updated successfully. Case number now matches.`);
            return {
              valid: true,
              reason: 'Context validated after title update',
              currentContext: updatedContext
            };
          } else {
            console.warn(`[PageContextValidator] Title updated but case number still doesn't match: ${dataCaseNumber} !== ${updatedContext.caseNumber}`);
            return {
              valid: false,
              reason: `Case number mismatch after title update: ${dataCaseNumber} !== ${updatedContext.caseNumber}`,
              currentContext: updatedContext
            };
          }
        });
      }
      
      // Case numbers don't match and we're not waiting
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

