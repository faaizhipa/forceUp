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
    // Support both case detail page (/Case/[ID]/view) and case comments page (/Case/[ID]/related/CaseComments/view)
    const caseIdMatch = currentURL.match(/\/Case\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
    if (!caseIdMatch) {
      return null;
    }
    
    const caseId = caseIdMatch[1];
    
    // Extract case number from title
    // Format: "00001026 | Case | Salesforce" or "00001026 - Subject | Case | Salesforce"
    // On case comments page: "00001026 | Case Comments | Case | Salesforce" or similar
    const titleParts = pageTitle.split(' | ');
    
    // Check if title contains "Case" (could be "Case" or "Case Comments" or other case-related pages)
    const hasCaseInTitle = titleParts.some(part => part.trim() === 'Case' || part.trim().includes('Case'));
    if (!hasCaseInTitle) {
      // Try to extract case number directly from title even if format is different
      const caseNumberMatch = pageTitle.match(/^(\d{6,10})/);
      if (caseNumberMatch) {
        const caseNumber = caseNumberMatch[1];
        return {
          caseId,
          caseNumber,
          caseTitle: pageTitle,
          url: currentURL,
          title: pageTitle
        };
      }
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
    
    // If we have case ID but no case number from title, try to extract from URL or other sources
    if (caseId) {
      // Try extracting from breadcrumbs or other page elements as fallback
      const breadcrumbLinks = document.querySelectorAll('nav[role="navigation"] a, .breadcrumb a');
      for (const link of breadcrumbLinks) {
        const linkText = link.textContent.trim();
        if (/^\d{6,10}$/.test(linkText)) {
          return {
            caseId,
            caseNumber: linkText,
            caseTitle: pageTitle,
            url: currentURL,
            title: pageTitle
          };
        }
      }
      
      // Last resort: return context with case ID only (case number will be null)
      // This allows validation to proceed for case comments pages where title format may differ
      return {
        caseId,
        caseNumber: null, // Will be extracted later if needed
        caseTitle: pageTitle,
        url: currentURL,
        title: pageTitle
      };
    }
    
    return null;
  },

  /**
   * Waits for document.title to stabilize with the expected case number
   * Used to confirm the current page's case number is stable (not still updating)
   * @param {string} expectedCaseNumber - The case number we expect to see (from current page)
   * @param {number} maxWaitMs - Maximum time to wait in milliseconds (default: 500)
   * @returns {Promise<Object|null>} Stabilized context or null if changed/invalid
   */
  async waitForTitleStabilize(expectedCaseNumber, maxWaitMs = 500) {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms
    let timeoutId = null;
    let lastSeenContext = null;
    let stableCount = 0;
    const requiredStableChecks = 2; // Must see same value 2 times to consider stable
    
    return new Promise((resolve, reject) => {
      try {
        const checkTitle = () => {
          try {
            const elapsed = Date.now() - startTime;
            
            if (elapsed >= maxWaitMs) {
              // Timeout - return last seen context
              timeoutId = null;
              resolve(lastSeenContext);
              return;
            }
            
            const context = this.getCurrentCaseContext();
            
            if (!context) {
              // Title became invalid
              timeoutId = null;
              resolve(null);
              return;
            }
            
            // Check if context matches expected case number
            if (context.caseNumber === expectedCaseNumber) {
              // Same as expected - increment stable count
              stableCount++;
              
              if (stableCount >= requiredStableChecks) {
                // Title is stable
                console.log(`[PageContextValidator] Title stabilized after ${elapsed}ms with case number ${expectedCaseNumber}`);
                if (timeoutId) {
                  clearTimeout(timeoutId);
                  timeoutId = null;
                }
                resolve(context);
                return;
              }
            } else {
              // Case number changed - not stable
              stableCount = 0;
              lastSeenContext = context;
            }
            
            // Continue waiting
            timeoutId = setTimeout(checkTitle, checkInterval);
          } catch (error) {
            console.error('[PageContextValidator] Error in waitForTitleStabilize check:', error);
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            reject(error);
          }
        };
        
        checkTitle();
      } catch (error) {
        console.error('[PageContextValidator] Error setting up waitForTitleStabilize:', error);
        reject(error);
      }
    });
  },

  /**
   * Waits for document.title to update with the expected case number
   * Used when case ID matches but case number doesn't (title may update later)
   * @deprecated Use waitForTitleStabilize instead - this method waits for wrong case number
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
      // Case IDs match but case numbers don't - this means data is stale
      // The current page already shows a different case number, which is authoritative
      // Reject immediately - current page case number is the source of truth
      console.warn(`[PageContextValidator] Case number mismatch detected - rejecting stale data immediately`);
      console.warn(`[PageContextValidator] Current page: ${currentContext.caseNumber}, Data: ${dataCaseNumber}`);
      console.warn(`[PageContextValidator] Current page case number is authoritative - data is stale`);
      
      return {
        valid: false,
        reason: `Case number mismatch: data=${dataCaseNumber}, current=${currentContext.caseNumber}`,
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
    // Support both case detail page and case comments page
    const match = window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
    return match ? match[1] : null;
  },

  /**
   * Checks if currently on a case page
   * @returns {boolean}
   */
  isOnCasePage() {
    const context = this.getCurrentCaseContext();
    return context !== null;
  },

  /**
   * Main guardrail function against stale data
   * Validates extracted/cached data against current page context before use
   * This is the primary function modules should use to prevent stale data issues
   * 
   * @param {Object} extractedData - Data object with caseId and/or caseNumber properties
   * @param {Object} options - Validation options
   * @param {boolean} options.waitForTitle - Whether to wait for title update if case numbers don't match (default: true)
   * @param {boolean} options.requireCaseId - Whether case ID is required for validation (default: true)
   * @param {boolean} options.requireCaseNumber - Whether case number is required for validation (default: false)
   * @returns {Promise<Object|null>} Validated data object or null if validation fails
   */
  async validateExtractedData(extractedData, options = {}) {
    const {
      waitForTitle = true,
      requireCaseId = true,
      requireCaseNumber = false
    } = options;

    // Step 1: Check if data exists
    if (!extractedData) {
      console.warn('[PageContextValidator] No data provided to validateExtractedData');
      return null;
    }

    // Step 2: Extract case ID from URL first (source of truth)
    const currentCaseId = this.getCaseIdFromUrl();
    
    // Step 3: Get current page context
    const currentContext = this.getCurrentCaseContext();
    
    if (!currentContext) {
      console.warn('[PageContextValidator] Not on a valid case page');
      return null;
    }

    // Step 4: Validate case ID (most reliable - from URL)
    if (requireCaseId) {
      if (!extractedData.caseId && !currentCaseId) {
        console.warn('[PageContextValidator] Case ID required but not available');
        return null;
      }
      
      // If we have both, they must match
      if (extractedData.caseId && currentCaseId && extractedData.caseId !== currentCaseId) {
        console.warn(`[PageContextValidator] Case ID mismatch: extracted=${extractedData.caseId}, current=${currentCaseId}`);
        return null;
      }
      
      // If extracted data has case ID but URL doesn't, that's suspicious
      if (extractedData.caseId && !currentCaseId) {
        console.warn('[PageContextValidator] Extracted data has case ID but URL does not');
        return null;
      }
    }

    // Step 5: Validate case number (may need to wait for title update)
    if (extractedData.caseNumber) {
      const validation = this.validatePageContextBeforeDisplay(
        extractedData.caseId || currentCaseId,
        extractedData.caseNumber,
        waitForTitle
      );
      
      // Handle async validation (when waiting for title update)
      let validationResult = validation;
      if (validation instanceof Promise) {
        validationResult = await validation;
      }
      
      if (!validationResult.valid) {
        console.warn(`[PageContextValidator] Case number validation failed: ${validationResult.reason}`);
        // Reject if validation failed (prevents stale data)
        return null;
      }
    } else if (requireCaseNumber) {
      // Case number is required but not in extracted data
      console.warn('[PageContextValidator] Case number required but not in extracted data');
      return null;
    }

    // Step 6: Ensure extracted data has current case ID (use URL as source of truth)
    const validatedData = { ...extractedData };
    if (currentCaseId) {
      validatedData.caseId = currentCaseId;
    }
    
    // Step 7: Ensure extracted data has current case number from context
    if (currentContext.caseNumber) {
      validatedData.caseNumber = currentContext.caseNumber;
    }

    console.log('[PageContextValidator] Data validated successfully:', {
      caseId: validatedData.caseId,
      caseNumber: validatedData.caseNumber
    });

    return validatedData;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageContextValidator;
}

