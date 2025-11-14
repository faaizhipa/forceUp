/**
 * Cache Manager Module
 * Manages case data caching with last-modified validation
 */

const CacheManager = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  
  const STORAGE_KEY = 'caseCacheData';
  const CACHE_VERSION = 2;
  const MAX_CACHE_AGE_DAYS = 30;
  const MAX_CACHE_SIZE_MB = 8; // Leave 2MB buffer for other data
  
  let memoryCache = new Map(); // In-memory cache for current session
  let isInitialized = false;
  let currentUrl = window.location.href; // Track URL for navigation detection
  let ongoingValidations = new Map(); // Track ongoing background validations

  // Lifecycle state tracking
  let lifecycleState = 'uninitialized'; // 'uninitialized' | 'initialized' | 'resetting' | 'refreshing' | 'initiating'
  let trackedCaseNumber = null; // Track current case number
  let stateChangeUnsubscribe = null; // Function to unsubscribe from GlobalCaseState

  // ========== PRIVATE FUNCTIONS ==========

  /**
   * Extracts case ID from current URL
   * @returns {string|null} Case ID or null if not found
   */
  function getCaseIdFromUrl() {
    const url = window.location.href;
    
    // Salesforce Lightning case page patterns
    const patterns = [
      /\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})\/view/,  // Lightning record page
      /\/[a-zA-Z0-9]{15,18}\/Case\/([a-zA-Z0-9]{15,18})/,  // Console view
      /Case\/([a-zA-Z0-9]{15,18})/                          // General case pattern
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        console.log(`[CacheManager] Extracted case ID ${match[1]} from URL`);
        return match[1];
      }
    }
    
    console.log('[CacheManager] No case ID found in URL:', url);
    return null;
  }

  /**
   * Gets cache data from chrome.storage.local
   * @returns {Promise<Object>}
   */
  async function loadFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY, 'cacheVersion'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[CacheManager] Error loading cache:', chrome.runtime.lastError);
          resolve({ cacheVersion: CACHE_VERSION, data: {} });
          return;
        }

        // Check version
        const storedVersion = result.cacheVersion || 0;
        if (storedVersion < CACHE_VERSION) {
          console.log(`[CacheManager] Cache version mismatch (${storedVersion} < ${CACHE_VERSION}), clearing cache`);
          resolve({ cacheVersion: CACHE_VERSION, data: {} });
          return;
        }

        resolve({
          cacheVersion: storedVersion,
          data: result[STORAGE_KEY] || {}
        });
      });
    });
  }

  /**
   * Saves cache data to chrome.storage.local
   * @param {Object} cacheData
   * @returns {Promise<void>}
   */
  async function saveToStorage(cacheData) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({
        [STORAGE_KEY]: cacheData,
        cacheVersion: CACHE_VERSION
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('[CacheManager] Error saving cache:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Checks storage usage
   * @returns {Promise<number>} Bytes used
   */
  async function getStorageUsage() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        resolve(bytes || 0);
      });
    });
  }

  /**
   * Cleans up old cache entries
   * @param {Object} cacheData
   * @returns {Object} Cleaned cache data
   */
  function cleanupOldEntries(cacheData) {
    const now = Date.now();
    const maxAge = MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000;
    const cleaned = {};
    let removedCount = 0;

    for (const caseId in cacheData) {
      const entry = cacheData[caseId];
      const age = now - (entry.timestamp || 0);

      if (age < maxAge) {
        cleaned[caseId] = entry;
      } else {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[CacheManager] Removed ${removedCount} old cache entries`);
    }

    return cleaned;
  }

  /**
   * Removes least recently used entries if storage is too large
   * @param {Object} cacheData
   * @returns {Object} Trimmed cache data
   */
  async function trimCacheIfNeeded(cacheData) {
    const bytesUsed = await getStorageUsage();
    const maxBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;

    if (bytesUsed < maxBytes) {
      return cacheData;
    }

    console.warn(`[CacheManager] Storage limit approaching (${(bytesUsed / 1024 / 1024).toFixed(2)}MB), trimming cache...`);

    // Sort by timestamp (oldest first)
    const entries = Object.entries(cacheData).sort((a, b) => {
      return (a[1].timestamp || 0) - (b[1].timestamp || 0);
    });

    // Keep only the newest 50% of entries
    const keepCount = Math.floor(entries.length / 2);
    const trimmed = {};

    for (let i = entries.length - keepCount; i < entries.length; i++) {
      const [caseId, entry] = entries[i];
      trimmed[caseId] = entry;
    }

    console.log(`[CacheManager] Trimmed ${entries.length - keepCount} entries`);

    return trimmed;
  }

  /**
   * Extracts signature fields used to validate cache freshness
   * @returns {Object} { status, subStatus, category, subCategory, analysisNote }
   */
  function extractSignatureFields() {
    const getFieldValue = (matchers) => {
      const selectors = matchers
        .map((matcher) => `records-record-layout-item[field-label*="${matcher}"] .test-id__field-value, records-record-layout-item[field-label*="${matcher}"] lightning-formatted-text`)
        .join(',');

      const node = document.querySelector(selectors);
      if (!node) {
        return '';
      }

      return (node.textContent || '').trim();
    };

    return {
      status: getFieldValue(['Status']),
      subStatus: getFieldValue(['Sub Status', 'Sub-Status']),
      category: getFieldValue(['Category']),
      subCategory: getFieldValue(['Sub-Category', 'Sub Category']),
      analysisNote: getFieldValue(['Analysis Note'])
    };
  }

  /**
   * Builds a deterministic signature from the extracted fields
   * @returns {string}
   */
  function buildSignature() {
    const fields = extractSignatureFields();

    return [
      fields.status,
      fields.subStatus,
      fields.category,
      fields.subCategory,
      fields.analysisNote
    ].map((value) => (value || '').toLowerCase()).join('|');
  }

  /**
   * Resolve CaseDataExtractor module if available
   * Supports window.CaseDataExtractor or require('./caseDataExtractor')
   * @returns {Object|null}
   */
  function getCaseDataExtractor() {
    if (typeof window !== 'undefined' && window.CaseDataExtractor) {
      return window.CaseDataExtractor;
    }

    try {
      if (typeof require !== 'undefined') {
        // attempt require; may throw in content script context where require is undefined
        // eslint-disable-next-line global-require
        return require('./caseDataExtractor');
      }
    } catch (e) {
      // ignore
    }

    return null;
  }

  /**
   * Performs silent background validation and updates cache if needed
   * @param {string} caseId - Case ID to validate
   * @param {Object} cachedData - Currently cached data
   * @param {string} validationUrl - URL when validation started (for abort detection)
   * @returns {Promise<void>}
   */
  async function _validateAndUpdateCache(caseId, cachedData, validationUrl) {
    const validationId = `${caseId}_${Date.now()}`;
    
    try {
      console.log(`[CacheManager] Starting background validation for case ${caseId}`);
      ongoingValidations.set(caseId, validationId);

      // Get extractor
      const extractor = getCaseDataExtractor();
      if (!extractor || typeof extractor.extractCaseData !== 'function') {
        console.warn('[CacheManager] CaseDataExtractor not available for background validation');
        return;
      }

      // Silent extraction
      const freshData = await extractor.extractCaseData(caseId).catch((err) => {
        console.error('[CacheManager] Background extraction failed:', err);
        return null;
      });

      // Abort checks
      if (!freshData) {
        console.log('[CacheManager] Background extraction returned no data, aborting validation');
        return;
      }

      if (window.location.href !== validationUrl) {
        console.log('[CacheManager] URL changed during validation, aborting update');
        return;
      }

      if (ongoingValidations.get(caseId) !== validationId) {
        console.log('[CacheManager] Newer validation started, aborting this one');
        return;
      }

      // Validation conditions
      const cachedCaseId = cachedData.caseId || cachedData['Case ID'] || '';
      const cachedCaseNumber = cachedData.caseNumber || cachedData['Case Number'] || '';
      const freshCaseId = freshData.caseId || freshData['Case ID'] || '';
      const freshCaseNumber = freshData.caseNumber || freshData['Case Number'] || '';
      const cachedLastModified = cachedData.lastModified || cachedData['Last Modified Date'] || '';
      const freshLastModified = freshData.lastModified || freshData['Last Modified Date'] || '';

      // Condition 1: Case IDs must match
      if (freshCaseId !== cachedCaseId || freshCaseId !== caseId) {
        console.warn(`[CacheManager] Case ID mismatch - Fresh: ${freshCaseId}, Cached: ${cachedCaseId}, Expected: ${caseId} - Aborting update`);
        return;
      }

      // Condition 2: Case Numbers must match
      if (freshCaseNumber !== cachedCaseNumber) {
        console.warn(`[CacheManager] Case Number mismatch - Fresh: ${freshCaseNumber}, Cached: ${cachedCaseNumber} - Aborting update`);
        return;
      }

      // Condition 3: Fresh data must be newer
      if (freshLastModified <= cachedLastModified) {
        console.log(`[CacheManager] Cached data is up-to-date (${cachedLastModified}), no update needed`);
        return;
      }

      // All conditions passed - update cache
      console.log(`[CacheManager] Updating cache for case ${caseId} (${cachedLastModified} -> ${freshLastModified})`);
      
      const cacheEntry = {
        data: freshData,
        timestamp: Date.now(),
        caseNumber: freshCaseNumber
      };

      // Update memory cache
      memoryCache.set(caseId, cacheEntry);

      // Update storage
      const storageData = await loadFromStorage();
      storageData.data[caseId] = cacheEntry;
      await saveToStorage(storageData.data);

      console.log(`[CacheManager] Cache updated successfully for case ${caseId}`);

    } catch (err) {
      console.error(`[CacheManager] Background validation error for case ${caseId}:`, err);
    } finally {
      // Clean up validation tracking
      if (ongoingValidations.get(caseId) === validationId) {
        ongoingValidations.delete(caseId);
      }
    }
  }

  // ========== PUBLIC API ==========

  return {
    /**
     * Initializes the cache manager
     */
    async init() {
      if (isInitialized) return;

      console.log('[CacheManager] Initializing...');

      try {
        const { data } = await loadFromStorage();
        
        // Clean up old entries
        const cleaned = cleanupOldEntries(data);
        
        // Trim if needed
        const trimmed = await trimCacheIfNeeded(cleaned);
        
        // Load into memory cache
        for (const caseId in trimmed) {
          console.log(`[CacheManager] Loaded cached case ${caseId} where ${trimmed[caseId]}`);
          memoryCache.set(caseId, trimmed[caseId]);
        }

        // Save cleaned/trimmed cache back to storage
        if (Object.keys(trimmed).length !== Object.keys(data).length) {
          await saveToStorage(trimmed);
        }

        console.log(`[CacheManager] Initialized with ${memoryCache.size} cached cases`);

        isInitialized = true;
        lifecycleState = 'initialized';

        // Register listener for GlobalCaseState changes
        if (typeof GlobalCaseState !== 'undefined') {
          stateChangeUnsubscribe = GlobalCaseState.onStateChange('CacheManager', (previousState, newState) => {
            this._handleStateChange(previousState, newState);
          });
          console.log('[CacheManager] Registered GlobalCaseState listener');
        }
      } catch (err) {
        console.error('[CacheManager] Initialization error:', err);
        isInitialized = true; // Continue anyway
        lifecycleState = 'initialized';
      }
    },

    /**
     * Handle GlobalCaseState changes - implements reactive lifecycle
     * @param {Object} previousState - Previous state
     * @param {Object} newState - New state
     * @private
     */
    async _handleStateChange(previousState, newState) {
      console.log('[CacheManager] GlobalCaseState changed:', { previousState, newState });

      // Check if case number changed
      if (previousState.caseNumber === newState.caseNumber) {
        console.log('[CacheManager] Case number unchanged, ignoring');
        return;
      }

      console.log(`[CacheManager] Case changed from ${previousState.caseNumber} to ${newState.caseNumber}, starting lifecycle`);

      try {
        // PHASE 1: Resetting
        lifecycleState = 'resetting';
        console.log('[CacheManager] Lifecycle: RESETTING');

        // Abort all ongoing validations
        ongoingValidations.clear();
        console.log('[CacheManager] Aborted all ongoing validations');

        // PHASE 2: Refreshing
        lifecycleState = 'refreshing';
        console.log('[CacheManager] Lifecycle: REFRESHING');

        // Update tracked case number
        trackedCaseNumber = newState.caseNumber;
        console.log('[CacheManager] Updated tracked case number:', trackedCaseNumber);

        // PHASE 3: Initiating
        lifecycleState = 'initiating';
        console.log('[CacheManager] Lifecycle: INITIATING');

        // Trigger cache lookup/refresh for new case
        // This will be called by other modules, we just track state here
        console.log('[CacheManager] Ready for new case data requests');

        lifecycleState = 'initialized';
        console.log('[CacheManager] Lifecycle: INITIALIZED (ready)');

      } catch (error) {
        console.error('[CacheManager] Error in lifecycle:', error);
        lifecycleState = 'initialized'; // Reset to initialized on error
      }
    },

    /**
     * Gets current lifecycle state
     * @returns {string} Current state
     */
    getLifecycleState() {
      return lifecycleState;
    },

    /**
     * Gets cached data for a case
     * Returns cached data immediately and performs background validation
     * Uses GlobalCaseState as source of truth for current case
     * @param {string} caseId - Optional case ID, will use GlobalCaseState if not provided
     * @returns {Object|null} Cached data or null if not found
     */
    async get(caseId) {
      if (!isInitialized) {
        await this.init();
      }

      // ALWAYS read from GlobalCaseState as source of truth
      let targetCaseId = caseId;
      let targetCaseNumber = null;

      if (typeof GlobalCaseState !== 'undefined') {
        const globalCaseId = GlobalCaseState.getCaseId();
        const globalCaseNumber = GlobalCaseState.getCaseNumber();

        // If GlobalCaseState has a case, use it
        if (globalCaseId) {
          // If provided caseId differs from global, warn and use global
          if (caseId && caseId !== globalCaseId) {
            console.warn(`[CacheManager] Provided case ID (${caseId}) differs from GlobalCaseState (${globalCaseId}), using GlobalCaseState`);
          }
          targetCaseId = globalCaseId;
          targetCaseNumber = globalCaseNumber;
          console.log(`[CacheManager] Using GlobalCaseState - Case ID: ${targetCaseId}, Case Number: ${targetCaseNumber}`);
        } else {
          console.warn('[CacheManager] GlobalCaseState has no case info, falling back to URL extraction');
        }
      } else {
        console.warn('[CacheManager] GlobalCaseState not available!');
      }

      // Fallback: Extract from URL if GlobalCaseState not available
      if (!targetCaseId) {
        targetCaseId = getCaseIdFromUrl();
        console.log(`[CacheManager] Extracted case ID from URL: ${targetCaseId}`);
      }

      if (!targetCaseId) {
        console.warn('[CacheManager] No case ID available from any source');
        return null;
      }

      // Update current URL for navigation detection
      currentUrl = window.location.href;

      // Check memory cache
      const cached = memoryCache.get(targetCaseId);

      if (cached && cached.data) {
        console.log(`[CacheManager] Cache hit for case ${targetCaseId} (Case Number: ${cached.caseNumber})`);

        // Mark that CacheManager has consumed the global state
        if (typeof GlobalCaseState !== 'undefined' && targetCaseNumber) {
          GlobalCaseState.markCacheManagerUsed(targetCaseNumber);
        }

        // Trigger background validation (fire and forget)
        _validateAndUpdateCache(targetCaseId, cached.data, currentUrl).catch((err) => {
          console.error('[CacheManager] Background validation error:', err);
        });

        // Return cached data immediately
        return cached.data;
      }

      // Cache miss - extract fresh data
      console.log(`[CacheManager] Cache miss for case ${targetCaseId} -> extracting fresh data`);
      const extractor = getCaseDataExtractor();
      if (!extractor || typeof extractor.extractCaseData !== 'function') {
        console.warn('[CacheManager] CaseDataExtractor not available');
        return null;
      }

      try {
        const extracted = await extractor.extractCaseData(targetCaseId).catch(() => extractor.extractCaseData());

        if (!extracted) {
          console.warn(`[CacheManager] Extraction returned no data for case ${targetCaseId}`);
          return null;
        }

        // Create cache entry
        const extractedCaseNumber = extracted.caseNumber || extracted['Case Number'] || targetCaseNumber || '';
        const cacheEntry = {
          data: extracted,
          timestamp: Date.now(),
          caseNumber: extractedCaseNumber
        };

        // Store in memory cache
        memoryCache.set(targetCaseId, cacheEntry);

        // Store in chrome.storage
        const storageData = await loadFromStorage();
        storageData.data[targetCaseId] = cacheEntry;
        await saveToStorage(storageData.data);

        console.log(`[CacheManager] Cached new data for case ${targetCaseId} (Case Number: ${extractedCaseNumber})`);

        // Mark that CacheManager has consumed the global state
        if (typeof GlobalCaseState !== 'undefined' && targetCaseNumber) {
          GlobalCaseState.markCacheManagerUsed(targetCaseNumber);
        }

        return extracted;
      } catch (err) {
        console.error(`[CacheManager] Error extracting data for case ${targetCaseId}:`, err);
        return null;
      }
    },

    /**
     * Manually invalidates cache for a case
     * @param {string} caseId - Case ID to invalidate
     */
    async invalidate(caseId) {
      if (!caseId) {
        caseId = getCaseIdFromUrl();
      }
      
      if (!caseId) {
        console.warn('[CacheManager] Cannot invalidate: no case ID provided');
        return;
      }

      console.log(`[CacheManager] Invalidating cache for case ${caseId}`);
      
      // Remove from memory
      memoryCache.delete(caseId);

      // Remove from storage
      const storageData = await loadFromStorage();
      if (storageData.data[caseId]) {
        delete storageData.data[caseId];
        await saveToStorage(storageData.data);
      }
    },

    /**
     * Clears all cached data
     */
    async clear() {
      console.log('[CacheManager] Clearing all cache data');
      memoryCache.clear();
      await saveToStorage({});
    }
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.CacheManager = CacheManager;
}
