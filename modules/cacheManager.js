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
  let _lock = false; // Lock flag to prevent race conditions
  let _queue = []; // Queue for concurrent requests
  let _persistTimer = null; // Timer for debouncing persistence

  // ========== PRIVATE FUNCTIONS ==========

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
   * Builds a deterministic signature from the extracted fields (from DOM)
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
   * Builds signature from data object (not DOM)
   * This is the correct way to build signatures for cached data
   * @param {Object} data - Case data object
   * @returns {string}
   */
  function buildSignatureFromData(data) {
    if (!data) return '';
    
    const fields = {
      status: (data.status || '').trim().toLowerCase(),
      subStatus: (data.subStatus || '').trim().toLowerCase(),
      category: (data.category || '').trim().toLowerCase(),
      subCategory: (data.subCategory || '').trim().toLowerCase(),
      analysisNote: (data.analysisNote || '').trim().toLowerCase()
    };

    return [
      fields.status,
      fields.subStatus,
      fields.category,
      fields.subCategory,
      fields.analysisNote
    ].join('|');
  }

  /**
   * Extracts case ID from current URL
   * @returns {string|null}
   */
  function getCaseIdFromUrl() {
    const match = window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})\//);
    return match ? match[1] : null;
  }

  /**
   * Determines if a cache entry should be accepted
   * Validates case ID, case number, and page state
   * @param {string} caseId - Case ID to validate
   * @param {string} caseNumber - Case number to validate (optional)
   * @param {Object} data - Data to validate
   * @returns {Object} { accept: boolean, reason: string }
   */
  function shouldAcceptCacheEntry(caseId, caseNumber, data) {
    // Step 1: Basic format validation
    if (!caseId || !/^[a-zA-Z0-9]{15,18}$/.test(caseId)) {
      return { accept: false, reason: 'Invalid case ID format' };
    }

    // Step 2: Validate case ID matches current page
    const currentCaseId = getCaseIdFromUrl();
    if (currentCaseId && currentCaseId !== caseId) {
      console.warn(`[CacheManager] Case ID mismatch: ${caseId} !== ${currentCaseId}, skipping cache`);
      return { accept: false, reason: `Case ID mismatch: ${caseId} !== ${currentCaseId}` };
    }

    // Step 3: Validate data contains matching case ID
    if (data.caseId && data.caseId !== caseId) {
      console.warn(`[CacheManager] Data case ID mismatch: ${data.caseId} !== ${caseId}`);
      return { accept: false, reason: `Data case ID mismatch: ${data.caseId} !== ${caseId}` };
    }

    // Step 4: Validate case number if provided
    if (caseNumber) {
      // Get current context if PageContextValidator available
      if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.getCurrentCaseContext === 'function') {
        const context = PageContextValidator.getCurrentCaseContext();
        if (context && context.caseNumber && context.caseNumber !== caseNumber) {
          console.warn(`[CacheManager] Case number mismatch: ${caseNumber} !== ${context.caseNumber}`);
          return { accept: false, reason: `Case number mismatch: ${caseNumber} !== ${context.caseNumber}` };
        }
      }

      // Validate data contains matching case number
      if (data.caseNumber && data.caseNumber !== caseNumber) {
        console.warn(`[CacheManager] Data case number mismatch: ${data.caseNumber} !== ${caseNumber}`);
        return { accept: false, reason: `Data case number mismatch: ${data.caseNumber} !== ${caseNumber}` };
      }
    }

    // Step 5: Check if page is still loading
    if (document.title === 'Lightning Experience') {
      return { accept: false, reason: 'Page is still loading' };
    }

    return { accept: true, reason: 'Validation passed' };
  }

  /**
   * Waits for lock to be released
   * @param {string} caseId - Case ID for the request
   * @returns {Promise<void>}
   */
  async function waitForLock(caseId) {
    return new Promise((resolve) => {
      _queue.push({ caseId, resolve });
      console.log(`[CacheManager] Request queued for case ${caseId} (lock active)`);
    });
  }

  /**
   * Acquires lock
   */
  function acquireLock() {
    _lock = true;
  }

  /**
   * Releases lock and processes queue
   */
  function releaseLock() {
    _lock = false;
    if (_queue.length > 0) {
      const next = _queue.shift();
      console.log(`[CacheManager] Processing queued request for case ${next.caseId}`);
      next.resolve();
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
          memoryCache.set(caseId, trimmed[caseId]);
        }

        // Save cleaned/trimmed cache back to storage
        if (Object.keys(trimmed).length !== Object.keys(data).length) {
          await saveToStorage(trimmed);
        }

        console.log(`[CacheManager] Initialized with ${memoryCache.size} cached cases`);
        
        isInitialized = true;
      } catch (err) {
        console.error('[CacheManager] Initialization error:', err);
        isInitialized = true; // Continue anyway
      }
    },

    /**
     * Gets cached data for a case
     * @param {string} caseId
     * @returns {Object|null} Cached data or null if not found or invalid
     */
    async get(caseId) {
      if (!isInitialized) {
        await this.init();
      }

      if (!caseId) return null;

      // Wait for lock if active
      if (_lock) {
        await waitForLock(caseId);
      }

      // Step 1: Validate case ID matches current page
      const currentCaseId = getCaseIdFromUrl();
      if (currentCaseId && currentCaseId !== caseId) {
        console.warn(`[CacheManager] Case ID mismatch on get: ${caseId} !== ${currentCaseId}, returning null`);
        return null;
      }

      // Step 2: Check memory cache
      const cached = memoryCache.get(caseId);
      if (!cached) {
        console.log(`[CacheManager] Cache miss for case ${caseId}`);
        return null;
      }

      // Step 3: Build signature from cached data (not current DOM)
      const cachedSignature = buildSignatureFromData(cached.data);

      if (!cachedSignature && !cached.signature) {
        console.warn('[CacheManager] No signature available, using cached data as fallback');
        return cached.data;
      }

      // Step 4: Get current signature from DOM for comparison
      const currentSignature = buildSignature();

      // Step 5: Compare signatures
      // Use cached signature if available, otherwise use stored signature
      const signatureToCompare = cachedSignature || cached.signature;
      
      if (currentSignature && signatureToCompare === currentSignature) {
        // ALWAYS validate case number matches, even if signature matches
        // This prevents returning stale cached data from a different case with same signature
        if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.getCurrentCaseContext === 'function') {
          const context = PageContextValidator.getCurrentCaseContext();
          if (context && cached.data.caseNumber && context.caseNumber !== cached.data.caseNumber) {
            console.warn(`[CacheManager] Signature matches but case number mismatch: ${cached.data.caseNumber} !== ${context.caseNumber}. Invalidating cache.`);
            memoryCache.delete(caseId); // Clear stale cache
            return null; // Force fresh extraction
          }
        }
        console.log(`[CacheManager] Cache hit for case ${caseId} (signature match)`);
        return cached.data;
      }

      // Step 6: If no current signature available, validate case number matches
      if (!currentSignature) {
        if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.getCurrentCaseContext === 'function') {
          const context = PageContextValidator.getCurrentCaseContext();
          if (context && cached.data.caseNumber && context.caseNumber !== cached.data.caseNumber) {
            console.warn(`[CacheManager] Case number mismatch: ${cached.data.caseNumber} !== ${context.caseNumber}`);
            return null;
          }
        }
        // If no signature but case number matches, return cached data
        console.log(`[CacheManager] Cache hit for case ${caseId} (no signature, case number validated)`);
        return cached.data;
      }

      console.log(`[CacheManager] Cache invalid for case ${caseId} (signature mismatch: ${signatureToCompare} !== ${currentSignature})`);
      return null;
    },

    /**
     * Sets cached data for a case
     * Validates case ID and case number before caching
     * Uses locking to prevent race conditions
     * @param {string} caseId
     * @param {Object} data - Case data to cache
     * @returns {Promise<void>}
     */
    async set(caseId, data) {
      if (!isInitialized) {
        await this.init();
      }

      if (!caseId || !data) return;

      // Wait for lock if active
      if (_lock) {
        await waitForLock(caseId);
      }

      try {
        // Acquire lock
        acquireLock();

        // Step 1: Validate cache entry should be accepted
        const validation = shouldAcceptCacheEntry(caseId, data.caseNumber, data);
        if (!validation.accept) {
          console.warn(`[CacheManager] Cache entry rejected: ${validation.reason}`);
          return;
        }

        // Step 2: Build signature from data (not DOM)
        const signature = buildSignatureFromData(data);
        
        const cacheEntry = {
          signature,
          data: data,
          timestamp: Date.now()
        };

        // Step 3: Update memory cache
        memoryCache.set(caseId, cacheEntry);

        console.log(`[CacheManager] Cached data for case ${caseId} (signature: ${signature || 'n/a'})`);

        // Step 4: Update storage (throttled)
        await this.persistToStorage();
      } finally {
        // Always release lock
        releaseLock();
      }
    },

    /**
     * Persists memory cache to storage
     * Debounced to avoid excessive writes
     * @returns {Promise<void>}
     */
    async persistToStorage() {
      if (!isInitialized) return;

      // Clear any pending debounce timer
      if (_persistTimer) {
        clearTimeout(_persistTimer);
      }

      // Debounce persistence (250ms)
      return new Promise((resolve) => {
        _persistTimer = setTimeout(async () => {
          try {
            const cacheData = {};
            memoryCache.forEach((entry, caseId) => {
              cacheData[caseId] = entry;
            });

            await saveToStorage(cacheData);
            console.log(`[CacheManager] Persisted ${memoryCache.size} entries to storage`);
            _persistTimer = null;
            resolve();
          } catch (err) {
            console.error('[CacheManager] Error persisting cache:', err);
            _persistTimer = null;
            resolve();
          }
        }, 250);
      });
    },

    /**
     * Clears cache for a specific case
     * @param {string} caseId
     */
    async clear(caseId) {
      if (!isInitialized) {
        await this.init();
      }

      if (!caseId) return;

      memoryCache.delete(caseId);
      await this.persistToStorage();

      console.log(`[CacheManager] Cleared cache for case ${caseId}`);
    },

    /**
     * Clears all cache
     */
    async clearAll() {
      memoryCache.clear();
      
      await new Promise((resolve) => {
        chrome.storage.local.remove([STORAGE_KEY, 'cacheVersion'], () => {
          console.log('[CacheManager] Cleared all cache');
          resolve();
        });
      });
    },

    /**
     * Gets cache statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
      const bytesUsed = await getStorageUsage();
      
      return {
        entriesCount: memoryCache.size,
        bytesUsed: bytesUsed,
        megabytesUsed: (bytesUsed / 1024 / 1024).toFixed(2),
        percentageUsed: ((bytesUsed / (MAX_CACHE_SIZE_MB * 1024 * 1024)) * 100).toFixed(2)
      };
    },

    /**
     * Cleans up the cache manager
     */
    cleanup() {
      if (!isInitialized) return;

      console.log('[CacheManager] Cleaning up...');
      
      // Persist any unsaved data
      this.persistToStorage();
      
      isInitialized = false;
    }
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CacheManager;
}
