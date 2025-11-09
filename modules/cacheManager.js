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

      // Check memory cache
      const cached = memoryCache.get(caseId);
      if (!cached) {
        console.log(`[CacheManager] Cache miss for case ${caseId}`);
        return null;
      }

      // Get current last modified date from DOM
      const currentSignature = buildSignature();

      if (!currentSignature) {
        console.warn('[CacheManager] Could not resolve status signature, using cached data as fallback');
        return cached.data;
      }

      if (cached.signature && cached.signature === currentSignature) {
        console.log(`[CacheManager] Cache hit for case ${caseId} (signature: ${currentSignature})`);
        return cached.data;
      }

      console.log(`[CacheManager] Cache invalid for case ${caseId} (signature mismatch)`);
      return null;
    },

    /**
     * Sets cached data for a case
     * @param {string} caseId
     * @param {Object} data - Case data to cache
     * @returns {Promise<void>}
     */
    async set(caseId, data) {
      if (!isInitialized) {
        await this.init();
      }

      if (!caseId || !data) return;

      const signature = buildSignature();
      
      const cacheEntry = {
        signature,
        data: data,
        timestamp: Date.now()
      };

      // Update memory cache
      memoryCache.set(caseId, cacheEntry);

      console.log(`[CacheManager] Cached data for case ${caseId} (signature: ${signature || 'n/a'})`);

      // Update storage (throttled)
      await this.persistToStorage();
    },

    /**
     * Persists memory cache to storage
     * @returns {Promise<void>}
     */
    async persistToStorage() {
      if (!isInitialized) return;

      try {
        const cacheData = {};
        memoryCache.forEach((entry, caseId) => {
          cacheData[caseId] = entry;
        });

        await saveToStorage(cacheData);
        console.log(`[CacheManager] Persisted ${memoryCache.size} entries to storage`);
      } catch (err) {
        console.error('[CacheManager] Error persisting cache:', err);
      }
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
