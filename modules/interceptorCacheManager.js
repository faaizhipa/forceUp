/**
 * InterceptorCacheManager
 * 
 * Manages caching of case data captured by interceptor.js.
 * Stores data in sessionStorage keyed by caseNumber.
 * Enriches data with CustomerMasterManager lookups (server, customerId, institutionId, institutionCode, timezone).
 * 
 * Architecture:
 * - interceptor.js (MAIN world) → dispatches EXLIBRIS_DATA_UPDATED event
 * - content_script_exlibris.js → receives event, calls InterceptorCacheManager.store()
 * - Extractors → call InterceptorCacheManager.get() before DOM extraction
 * - PersistentBanner → receives CASE_DATA_READY event after data is ready
 */

const InterceptorCacheManager = (function() {
  'use strict';

  // ========== CONSTANTS ==========

  const STORAGE_KEY = 'exlibris_interceptor_cache';
  const TTL = 300000; // 5 minutes in milliseconds
  const MAX_CACHE_SIZE = 50; // Maximum number of cases to cache

  // ========== PRIVATE STATE ==========

  let isInitialized = false;

  // ========== CACHE OPERATIONS ==========

  /**
   * Get the current cache from sessionStorage
   * @returns {Object} Cache object
   */
  function getCache() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn('[InterceptorCacheManager] Failed to read cache:', error);
      return {};
    }
  }

  /**
   * Save cache to sessionStorage
   * @param {Object} cache - Cache object to save
   */
  function saveCache(cache) {
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

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn('[InterceptorCacheManager] Failed to save cache:', error);
    }
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
     */
    init() {
      if (isInitialized) return;
      console.log('[InterceptorCacheManager] Initialized');
      isInitialized = true;
    },

    /**
     * Store new interceptor data with enrichment
     * @param {string} caseNumber - Case number as key
     * @param {Object} rawData - Raw data from interceptor.js
     * @returns {Promise<Object>} Enriched data
     */
    async store(caseNumber, rawData) {
      if (!caseNumber || !rawData) {
        console.warn('[InterceptorCacheManager] Invalid store params:', { caseNumber, hasData: !!rawData });
        return null;
      }

      // Enrich with customer data
      const enriched = await enrichWithCustomerData(rawData);

      // Store in cache
      const cache = getCache();
      cache[caseNumber] = {
        data: rawData,
        enriched: enriched,
        timestamp: Date.now()
      };
      saveCache(cache);

      console.log('[InterceptorCacheManager] Stored case:', caseNumber, {
        hasEnrichment: !!enriched.timezone,
        cacheSize: Object.keys(cache).length
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
     * @returns {Object|null} Enriched data or null if not found/stale
     */
    get(caseNumber) {
      if (!caseNumber) return null;

      const cache = getCache();
      const entry = cache[caseNumber];

      if (!entry) {
        console.log('[InterceptorCacheManager] Cache miss for:', caseNumber);
        return null;
      }

      // Check TTL
      const age = Date.now() - (entry.timestamp || 0);
      if (age > TTL) {
        console.log('[InterceptorCacheManager] Cache stale for:', caseNumber, 'age:', age + 'ms');
        return null;
      }

      console.log('[InterceptorCacheManager] Cache hit for:', caseNumber, 'age:', age + 'ms');
      return entry.enriched;
    },

    /**
     * Get raw cache entry (for debugging)
     * @param {string} caseNumber - Case number
     * @returns {Object|null} Raw cache entry
     */
    getRawEntry(caseNumber) {
      if (!caseNumber) return null;
      const cache = getCache();
      return cache[caseNumber] || null;
    },

    /**
     * Check if case exists in cache (regardless of TTL)
     * @param {string} caseNumber - Case number
     * @returns {boolean} True if exists
     */
    has(caseNumber) {
      if (!caseNumber) return false;
      const cache = getCache();
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
     */
    clear() {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        console.log('[InterceptorCacheManager] Cache cleared');
      } catch (error) {
        console.warn('[InterceptorCacheManager] Failed to clear cache:', error);
      }
    },

    /**
     * Remove a specific case from cache
     * @param {string} caseNumber - Case number to remove
     */
    remove(caseNumber) {
      if (!caseNumber) return;
      const cache = getCache();
      if (cache[caseNumber]) {
        delete cache[caseNumber];
        saveCache(cache);
        console.log('[InterceptorCacheManager] Removed from cache:', caseNumber);
      }
    },

    /**
     * Get cache statistics
     * @returns {Object} Stats
     */
    getStats() {
      const cache = getCache();
      const keys = Object.keys(cache);
      const now = Date.now();

      let freshCount = 0;
      let staleCount = 0;
      let oldestAge = 0;
      let newestAge = Infinity;

      keys.forEach(key => {
        const entry = cache[key];
        const age = now - (entry?.timestamp || 0);
        if (age <= TTL) {
          freshCount++;
        } else {
          staleCount++;
        }
        if (age > oldestAge) oldestAge = age;
        if (age < newestAge) newestAge = age;
      });

      return {
        totalEntries: keys.length,
        freshEntries: freshCount,
        staleEntries: staleCount,
        oldestAgeMs: keys.length > 0 ? oldestAge : null,
        newestAgeMs: keys.length > 0 ? newestAge : null,
        ttlMs: TTL,
        maxSize: MAX_CACHE_SIZE
      };
    },

    /**
     * Get all cached case numbers
     * @returns {Array<string>} Case numbers
     */
    getCachedCaseNumbers() {
      const cache = getCache();
      return Object.keys(cache);
    }
  };
})();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InterceptorCacheManager;
}

