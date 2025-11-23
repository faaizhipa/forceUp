/**
 * Fetch Interceptor Module
 * Intercepts Salesforce API calls to extract case data directly from API responses
 * This provides a more reliable and faster data source than DOM extraction
 * 
 * CRITICAL: Must be loaded at document_start (before page scripts)
 * 
 * Architecture:
 * 1. Monkey-patches window.fetch before page scripts load
 * 2. Intercepts aura.RecordUi.getRecordWithFields API calls
 * 3. Extracts and flattens field data from JSON response
 * 4. Stores in window.ExLibrisExtension.apiCaseData
 * 5. Other modules (CasePageDataExtractor) use this as primary data source
 */

const FetchInterceptor = (function() {
  'use strict';

  // Private state
  let isInitialized = false;
  let lastProcessedUrl = null;
  let lastProcessedTimestamp = 0;
  const DEBOUNCE_DELAY = 100; // ms
  const API_ENDPOINT_PATTERN = 'aura.RecordUi.getRecordWithFields';

  /**
   * Initialize the fetch interceptor
   * MUST be called at document_start
   */
  function init() {
    if (isInitialized) {
      console.log('[FetchInterceptor] Already initialized, skipping');
      return;
    }

    console.log('[FetchInterceptor] Initializing fetch interception');
    patchFetch();
    isInitialized = true;
  }

  /**
   * Monkey-patch window.fetch to intercept API calls
   */
  function patchFetch() {
    const { fetch: originalFetch } = window;

    if (!originalFetch) {
      console.error('[FetchInterceptor] window.fetch not available');
      return;
    }

    window.fetch = async (...args) => {
      // Always call original fetch first
      const response = await originalFetch(...args);

      try {
        // Level 1 Filter: URL check (extremely fast)
        const requestUrl = args[0] instanceof Request ? args[0].url : args[0].toString();
        
        if (requestUrl.includes(API_ENDPOINT_PATTERN)) {
          // Level 2 Filter: Process response asynchronously (don't block)
          handleCaseApiResponse(response.clone(), requestUrl);
        }
      } catch (error) {
        console.error('[FetchInterceptor] Error in fetch wrapper:', error);
      }

      return response;
    };

    console.log('[FetchInterceptor] window.fetch successfully patched');
  }

  /**
   * Handle API response that may contain case data
   * @param {Response} responseClone - Cloned response object
   * @param {string} requestUrl - Original request URL
   */
  async function handleCaseApiResponse(responseClone, requestUrl) {
    try {
      const body = await responseClone.text();
      
      // Level 2 Filter: Parse JSON
      let data;
      try {
        data = JSON.parse(body);
      } catch (parseError) {
        // Not JSON, ignore silently
        return;
      }

      // Level 3 Filter: Verify it's case data
      const fields = data?.actions?.[0]?.returnValue?.fields;
      
      if (!fields || !fields.CaseNumber || !fields.Subject) {
        // Not case data, ignore
        return;
      }

      // Debounce: Prevent processing duplicate requests rapidly
      const currentUrl = window.location.href;
      const now = Date.now();
      
      if (currentUrl === lastProcessedUrl && (now - lastProcessedTimestamp) < DEBOUNCE_DELAY) {
        console.log('[FetchInterceptor] Debouncing duplicate request');
        return;
      }

      lastProcessedUrl = currentUrl;
      lastProcessedTimestamp = now;

      // Extract and store case data
      const extractedData = extractNonNullValues(fields);
      storeCaseData(extractedData, now);

      console.log('[FetchInterceptor] Case data captured from API:', {
        caseNumber: extractedData.CaseNumber,
        fieldCount: Object.keys(extractedData).length,
        timestamp: now
      });

    } catch (error) {
      console.error('[FetchInterceptor] Error processing API response:', error);
    }
  }

  /**
   * Recursively extract non-null values from API field structure
   * Handles nested records (Account, Contact, etc.)
   * 
   * @param {Object} fields - API fields object
   * @param {string} parentKey - Parent key for nested fields (e.g., "Account.")
   * @param {Object} results - Accumulator for results
   * @returns {Object} Flattened field map
   * 
   * Example input:
   * {
   *   "CaseNumber": { "value": "00001026" },
   *   "Account": {
   *     "value": {
   *       "apiName": "Account",
   *       "fields": {
   *         "Name": { "value": "University X" }
   *       }
   *     }
   *   }
   * }
   * 
   * Example output:
   * {
   *   "CaseNumber": "00001026",
   *   "Account.Name": "University X"
   * }
   */
  function extractNonNullValues(fields, parentKey = '', results = {}) {
    for (const key in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;

      const fieldData = fields[key];
      const value = fieldData?.value;
      const fullKey = parentKey + key;

      if (value !== null && value !== undefined) {
        // Check if nested record (Account, Contact, etc.)
        if (typeof value === 'object' && value.apiName && value.fields) {
          // Recursively extract nested fields
          extractNonNullValues(value.fields, fullKey + '.', results);
        }
        // Simple value (string, number, boolean)
        else if (typeof value !== 'object' || value === null) {
          results[fullKey] = value;
        }
        // Complex object without apiName (e.g., address)
        else if (typeof value === 'object' && !value.apiName) {
          // Store as-is or stringify based on structure
          results[fullKey] = value;
        }
      }
    }

    return results;
  }

  /**
   * Store extracted case data in global state
   * @param {Object} extractedData - Flattened field map
   * @param {number} timestamp - Timestamp when data was extracted
   */
  function storeCaseData(extractedData, timestamp) {
    // Ensure global state object exists
    if (typeof window.ExLibrisExtension === 'undefined') {
      console.warn('[FetchInterceptor] window.ExLibrisExtension not yet available, data will be stored when available');
      // Store temporarily and retry
      window._pendingApiCaseData = { data: extractedData, timestamp };
      return;
    }

    // Store in global state
    window.ExLibrisExtension.apiCaseData = extractedData;
    window.ExLibrisExtension.apiCaseDataTimestamp = timestamp;

    // Optionally dispatch event for other modules to listen
    try {
      const event = new CustomEvent('caseDataFromApi', {
        detail: {
          data: extractedData,
          timestamp,
          source: 'FetchInterceptor'
        },
        bubbles: true,
        composed: true
      });
      document.dispatchEvent(event);
    } catch (error) {
      // Event dispatch not critical, continue
      console.warn('[FetchInterceptor] Could not dispatch event:', error);
    }
  }

  /**
   * Check if interceptor is initialized
   * @returns {boolean}
   */
  function isReady() {
    return isInitialized;
  }

  /**
   * Get current API case data (for debugging)
   * @returns {Object|null}
   */
  function getCurrentData() {
    return window.ExLibrisExtension?.apiCaseData || null;
  }

  /**
   * Cleanup method (for future use)
   */
  function cleanup() {
    lastProcessedUrl = null;
    lastProcessedTimestamp = 0;
    console.log('[FetchInterceptor] Cleaned up state');
  }

  // Public API
  return {
    init,
    isReady,
    getCurrentData,
    cleanup
  };
})();

// Auto-initialize at document_start
// This ensures fetch is patched before Salesforce scripts load
if (document.readyState === 'loading') {
  FetchInterceptor.init();
} else {
  // Fallback: if already loaded, init immediately
  console.warn('[FetchInterceptor] Document already loaded, may miss early API calls');
  FetchInterceptor.init();
}

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FetchInterceptor;
}
