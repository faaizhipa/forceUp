/**
 * InterceptorCacheManager
 * 
 * Manages caching of case data captured by interceptor.js.
 * Stores data in chrome.storage.local keyed by caseNumber with 5-day TTL.
 * Enriches data with CustomerMasterManager lookups (server, customerId, institutionId, institutionCode, timezone).
 * 
 * Architecture:
 * - interceptor.js (MAIN world) → dispatches EXLIBRIS_DATA_UPDATED event
 * - content_script_exlibris.js → receives event, calls InterceptorCacheManager.store()
 * - Extractors → call InterceptorCacheManager.get() before DOM extraction
 * - PersistentBanner → receives CASE_DATA_READY event after data is ready
 * 
 * Storage Strategy:
 * - Uses chrome.storage.local for persistence across browser sessions
 * - 5-day TTL (432000000ms) with explicit expiryDate field
 * - Validates primary metadata before storing
 * - Automatic cleanup of expired entries on init
 */

const InterceptorCacheManager = (function() {
  'use strict';

  // ========== CONSTANTS ==========

  const STORAGE_KEY = 'exlibris_api_cache';
  const LEGACY_STORAGE_KEY = 'exlibris_interceptor_cache'; // For migration
  const TTL = 432000000; // 5 days in milliseconds (5 * 24 * 60 * 60 * 1000)
  const MAX_CACHE_SIZE = 100; // Maximum number of cases to cache
  const CLEANUP_INTERVAL = 3600000; // Cleanup every hour (60 * 60 * 1000)

  // Required fields for primary metadata validation
  const REQUIRED_FIELDS = ['Id', 'CaseNumber', 'Subject', 'AccountName', 'Status'];

  // ========== PRIVATE STATE ==========

  let isInitialized = false;
  let cleanupIntervalId = null;
  let cachePromise = null; // For async cache loading

  // ========== VALIDATION ==========

  /**
   * Validate that primary metadata fields are present
   * @param {Object} data - Raw data to validate
   * @returns {{valid: boolean, missing: string[]}} Validation result
   */
  function validatePrimaryMetadata(data) {
    if (!data) {
      return { valid: false, missing: ['data is null'] };
    }

    const missing = REQUIRED_FIELDS.filter(field => !data[field] || data[field] === '');
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  // ========== CACHE OPERATIONS ==========

  /**
   * Get the current cache from chrome.storage.local
   * @returns {Promise<Object>} Cache object
   */
  async function getCache() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        try {
          const cache = result[STORAGE_KEY] || {};
          resolve(cache);
        } catch (error) {
          console.warn('[InterceptorCacheManager] Failed to read cache:', error);
          resolve({});
        }
      });
    });
  }

  /**
   * Save cache to chrome.storage.local
   * @param {Object} cache - Cache object to save
   * @returns {Promise<void>}
   */
  async function saveCache(cache) {
    return new Promise((resolve) => {
      try {
        // Prune old entries if cache is too large
        const keys = Object.keys(cache);
        if (keys.length > MAX_CACHE_SIZE) {
          // Sort by timestamp, remove oldest
          const sortedKeys = keys.sort((a, b) => {
            return (cache[a]?.timestamp || 0) - (cache[b]?.timestamp || 0);
          });
          const toRemove = sortedKeys.slice(0, keys.length - MAX_CACHE_SIZE);
          toRemove.forEach(key => delete cache[key]);
          console.log('[InterceptorCacheManager] Pruned', toRemove.length, 'old cache entries');
        }

        chrome.storage.local.set({ [STORAGE_KEY]: cache }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[InterceptorCacheManager] Failed to save cache:', chrome.runtime.lastError);
          }
          resolve();
        });
      } catch (error) {
        console.warn('[InterceptorCacheManager] Failed to save cache:', error);
        resolve();
      }
    });
  }

  /**
   * Migrate from legacy sessionStorage to chrome.storage.local
   * @returns {Promise<boolean>} True if migration was performed
   */
  async function migrateLegacyCache() {
    return new Promise((resolve) => {
      try {
        // Check sessionStorage for legacy data
        const legacyData = sessionStorage.getItem(LEGACY_STORAGE_KEY);
        if (!legacyData) {
          resolve(false);
          return;
        }

        const legacyCache = JSON.parse(legacyData);
        if (!legacyCache || Object.keys(legacyCache).length === 0) {
          resolve(false);
          return;
        }

        // Update entries with new expiry format and save to chrome.storage.local
        const now = Date.now();
        const migratedCache = {};
        
        Object.entries(legacyCache).forEach(([key, entry]) => {
          if (entry && entry.timestamp) {
            // Add expiryDate if not present
            migratedCache[key] = {
              ...entry,
              expiryDate: entry.expiryDate || (entry.timestamp + TTL)
            };
          }
        });

        chrome.storage.local.set({ [STORAGE_KEY]: migratedCache }, () => {
          // Clear legacy sessionStorage after successful migration
          sessionStorage.removeItem(LEGACY_STORAGE_KEY);
          console.log('[InterceptorCacheManager] Migrated', Object.keys(migratedCache).length, 'entries from sessionStorage');
          resolve(true);
        });
      } catch (error) {
        console.warn('[InterceptorCacheManager] Migration failed:', error);
        resolve(false);
      }
    });
  }

  /**
   * Clean up expired cache entries
   * @returns {Promise<number>} Number of entries removed
   */
  async function cleanupExpiredEntries() {
    const cache = await getCache();
    const now = Date.now();
    let removedCount = 0;

    Object.keys(cache).forEach(key => {
      const entry = cache[key];
      const expiryDate = entry?.expiryDate || (entry?.timestamp ? entry.timestamp + TTL : 0);
      
      if (expiryDate < now) {
        delete cache[key];
        removedCount++;
      }
    });

    if (removedCount > 0) {
      await saveCache(cache);
      console.log('[InterceptorCacheManager] Cleaned up', removedCount, 'expired entries');
    }

    return removedCount;
  }

  // ========== ENRICHMENT ==========

  /**
   * Enrich raw interceptor data with CustomerMasterManager lookups
   * @param {Object} rawData - Raw data from interceptor.js
   * @returns {Promise<Object>} Enriched data
   */
  async function enrichWithCustomerData(rawData) {
    if (!rawData) return null;

    // Start with raw data
    const enriched = { ...rawData };

    // Try to find customer in CustomerMasterManager
    if (typeof CustomerMasterManager !== 'undefined') {
      try {
        const accountName = rawData.AccountName;
        
        if (accountName) {
          // Look up by account name
          const customer = CustomerMasterManager.findByAccountName(accountName);
          
          if (customer) {
            // Enrich with customer data
            enriched.server = customer.server || null;
            enriched.customerId = customer.customerId || null;
            enriched.institutionId = customer.institutionId || null;
            enriched.institutionCode = customer.institutionCode || null;
            enriched.accountCode = customer.accountCode || null;
            enriched.region = customer.region || null;
            enriched.city = customer.city || null;
            enriched.state = customer.state || null;
            enriched.country = customer.country || null;
            enriched.timezone = customer.timezone || null;
            enriched._customerMatch = {
              matchType: customer.matchType,
              matchValue: customer.matchValue,
              source: customer.source
            };
            
            console.log('[InterceptorCacheManager] Enriched with customer data:', {
              accountName,
              server: enriched.server,
              institutionCode: enriched.institutionCode,
              timezone: enriched.timezone
            });
          } else {
            console.log('[InterceptorCacheManager] Customer not found for:', accountName);
            enriched.server = null;
            enriched.customerId = null;
            enriched.institutionId = null;
            enriched.institutionCode = null;
            enriched.timezone = null;
            enriched._customerMatch = null;
          }
        }

        // Also try to resolve timezone if not found
        if (!enriched.timezone && accountName) {
          const tzResult = await CustomerMasterManager.resolveTimezone({ accountName });
          if (tzResult && tzResult.timezone) {
            enriched.timezone = tzResult.timezone;
            console.log('[InterceptorCacheManager] Resolved timezone:', tzResult.timezone);
          }
        }
      } catch (error) {
        console.warn('[InterceptorCacheManager] CustomerMasterManager lookup failed:', error);
      }
    }

    return enriched;
  }

  // ========== PUBLIC API ==========

  return {
    /**
     * Initialize the cache manager
     * Performs migration from sessionStorage and cleans up expired entries
     * @returns {Promise<void>}
     */
    async init() {
      if (isInitialized) return;

      try {
        // Migrate from legacy sessionStorage if needed
        await migrateLegacyCache();

        // Clean up expired entries
        await cleanupExpiredEntries();

        // Setup periodic cleanup
        if (cleanupIntervalId) {
          clearInterval(cleanupIntervalId);
        }
        cleanupIntervalId = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);

        isInitialized = true;
        console.log('[InterceptorCacheManager] Initialized with 5-day TTL and persistent storage');
      } catch (error) {
        console.error('[InterceptorCacheManager] Initialization failed:', error);
        isInitialized = true; // Still mark as initialized to prevent loops
      }
    },

    /**
     * Store new interceptor data with enrichment and validation
     * Only stores if primary metadata validation passes
     * @param {string} caseNumber - Case number as key
     * @param {Object} rawData - Raw data from interceptor.js
     * @returns {Promise<Object>} Enriched data or null if validation fails
     */
    async store(caseNumber, rawData) {
      if (!caseNumber || !rawData) {
        console.warn('[InterceptorCacheManager] Invalid store params:', { caseNumber, hasData: !!rawData });
        return null;
      }

      // Validate primary metadata before storing
      const validation = validatePrimaryMetadata(rawData);
      if (!validation.valid) {
        console.warn('[InterceptorCacheManager] Primary metadata validation failed for case:', caseNumber, 
          'Missing fields:', validation.missing);
        // Still broadcast the event but don't cache incomplete data
        const enriched = await enrichWithCustomerData(rawData);
        const mappedData = this.mapToExpectedFields(enriched);
        window.dispatchEvent(new CustomEvent('CASE_DATA_READY', { 
          detail: { ...mappedData, _validationFailed: true, _missingFields: validation.missing }
        }));
        return enriched;
      }

      // Enrich with customer data
      const enriched = await enrichWithCustomerData(rawData);

      // Store in cache with expiryDate
      const now = Date.now();
      const cache = await getCache();
      cache[caseNumber] = {
        data: rawData,
        enriched: enriched,
        timestamp: now,
        expiryDate: now + TTL // 5 days from now
      };
      await saveCache(cache);

      console.log('[InterceptorCacheManager] Stored case:', caseNumber, {
        hasEnrichment: !!enriched.timezone,
        cacheSize: Object.keys(cache).length,
        expiresIn: '5 days'
      });

      // Broadcast CASE_DATA_READY event for PersistentBanner
      const mappedData = this.mapToExpectedFields(enriched);
      window.dispatchEvent(new CustomEvent('CASE_DATA_READY', { 
        detail: mappedData 
      }));

      return enriched;
    },

    /**
     * Retrieve cached data by caseNumber
     * @param {string} caseNumber - Case number to retrieve
     * @returns {Promise<Object|null>} Enriched data or null if not found/expired
     */
    async get(caseNumber) {
      if (!caseNumber) return null;

      const cache = await getCache();
      const entry = cache[caseNumber];

      if (!entry) {
        console.log('[InterceptorCacheManager] Cache miss for:', caseNumber);
        return null;
      }

      // Check expiry using expiryDate field (preferred) or calculate from timestamp
      const now = Date.now();
      const expiryDate = entry.expiryDate || (entry.timestamp + TTL);
      
      if (now > expiryDate) {
        console.log('[InterceptorCacheManager] Cache expired for:', caseNumber);
        // Optionally remove expired entry
        delete cache[caseNumber];
        await saveCache(cache);
        return null;
      }

      const remainingDays = ((expiryDate - now) / (24 * 60 * 60 * 1000)).toFixed(1);
      console.log('[InterceptorCacheManager] Cache hit for:', caseNumber, 'expires in:', remainingDays + ' days');
      return entry.enriched;
    },

    /**
     * Synchronous get for backward compatibility (returns from last loaded cache)
     * @param {string} caseNumber - Case number to retrieve
     * @returns {Object|null} Enriched data or null
     */
    getSync(caseNumber) {
      console.warn('[InterceptorCacheManager] getSync() is deprecated, use get() with await');
      // This is a best-effort sync version - may not have latest data
      return null;
    },

    /**
     * Get raw cache entry (for debugging)
     * @param {string} caseNumber - Case number
     * @returns {Promise<Object|null>} Raw cache entry
     */
    async getRawEntry(caseNumber) {
      if (!caseNumber) return null;
      const cache = await getCache();
      return cache[caseNumber] || null;
    },

    /**
     * Check if case exists in cache (regardless of TTL)
     * @param {string} caseNumber - Case number
     * @returns {Promise<boolean>} True if exists
     */
    async has(caseNumber) {
      if (!caseNumber) return false;
      const cache = await getCache();
      return !!cache[caseNumber];
    },

    /**
     * Map enriched interceptor data to expected extractor fields
     * @param {Object} enrichedData - Enriched data from store()
     * @returns {Object} Mapped data for extractors
     */
    mapToExpectedFields(enrichedData) {
      if (!enrichedData) return null;

      return {
        // Core case fields
        caseId: enrichedData.Id || null,
        caseNumber: enrichedData.CaseNumber || null,
        subject: enrichedData.Subject || null,
        description: enrichedData.Description || null,
        accountName: enrichedData.AccountName || null,
        status: enrichedData.Status || null,
        priority: enrichedData.Priority || null,
        owner: enrichedData.OwnerName || null,
        contactName: enrichedData.ContactName || null,
        contactEmail: enrichedData.ContactEmail || null,
        createdDate: enrichedData.CreatedDate || null,

        // Product/Asset fields
        asset: enrichedData.Asset || null,
        category: enrichedData.Category || null,
        supportTeam: enrichedData.SupportTeam || null,
        affectedEnvironment: enrichedData.Environment || null,

        // Enriched customer fields from CustomerMasterManager
        server: enrichedData.server || null,
        customerId: enrichedData.customerId || null,
        institutionId: enrichedData.institutionId || null,
        institutionCode: enrichedData.institutionCode || null,
        accountCode: enrichedData.accountCode || null,
        region: enrichedData.region || null,
        city: enrichedData.city || null,
        state: enrichedData.state || null,
        country: enrichedData.country || null,
        timezone: enrichedData.timezone || null,

        // Metadata
        dataSource: 'interceptor-cache',
        extractedAt: new Date().toISOString(),
        _customerMatch: enrichedData._customerMatch || null,
        _raw: enrichedData._raw || null
      };
    },

    /**
     * Clear all cached data
     * @returns {Promise<void>}
     */
    async clear() {
      return new Promise((resolve) => {
        chrome.storage.local.remove([STORAGE_KEY], () => {
          console.log('[InterceptorCacheManager] Cache cleared');
          resolve();
        });
      });
    },

    /**
     * Remove a specific case from cache
     * @param {string} caseNumber - Case number to remove
     * @returns {Promise<void>}
     */
    async remove(caseNumber) {
      if (!caseNumber) return;
      const cache = await getCache();
      if (cache[caseNumber]) {
        delete cache[caseNumber];
        await saveCache(cache);
        console.log('[InterceptorCacheManager] Removed from cache:', caseNumber);
      }
    },

    /**
     * Get cache statistics
     * @returns {Promise<Object>} Stats
     */
    async getStats() {
      const cache = await getCache();
      const keys = Object.keys(cache);
      const now = Date.now();

      let validCount = 0;
      let expiredCount = 0;
      let nearestExpiry = Infinity;
      let furthestExpiry = 0;

      keys.forEach(key => {
        const entry = cache[key];
        const expiryDate = entry?.expiryDate || (entry?.timestamp ? entry.timestamp + TTL : 0);
        const remainingMs = expiryDate - now;
        
        if (remainingMs > 0) {
          validCount++;
          if (remainingMs < nearestExpiry) nearestExpiry = remainingMs;
          if (remainingMs > furthestExpiry) furthestExpiry = remainingMs;
        } else {
          expiredCount++;
        }
      });

      return {
        totalEntries: keys.length,
        validEntries: validCount,
        expiredEntries: expiredCount,
        nearestExpiryDays: keys.length > 0 && nearestExpiry !== Infinity 
          ? (nearestExpiry / (24 * 60 * 60 * 1000)).toFixed(2) 
          : null,
        furthestExpiryDays: keys.length > 0 && furthestExpiry > 0 
          ? (furthestExpiry / (24 * 60 * 60 * 1000)).toFixed(2) 
          : null,
        ttlDays: TTL / (24 * 60 * 60 * 1000),
        maxSize: MAX_CACHE_SIZE,
        storageType: 'chrome.storage.local'
      };
    },

    /**
     * Get all cached case numbers
     * @returns {Promise<Array<string>>} Case numbers
     */
    async getCachedCaseNumbers() {
      const cache = await getCache();
      return Object.keys(cache);
    },

    /**
     * Force cleanup of expired entries
     * @returns {Promise<number>} Number of entries removed
     */
    async cleanup() {
      return cleanupExpiredEntries();
    },

    /**
     * Validate primary metadata (exposed for external use)
     * @param {Object} data - Data to validate
     * @returns {{valid: boolean, missing: string[]}}
     */
    validateMetadata(data) {
      return validatePrimaryMetadata(data);
    },

    /**
     * Get required fields list
     * @returns {string[]} Required field names
     */
    getRequiredFields() {
      return [...REQUIRED_FIELDS];
    }
  };
})();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InterceptorCacheManager;
}