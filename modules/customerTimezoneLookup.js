/**
 * CustomerTimezoneLookup
 * Centralized timezone lookup helper that loads pre-built timezone index
 * from timezones_index.json (generated from timezones_final.csv) and manages local overrides.
 */

const CustomerTimezoneLookup = (function() {
  'use strict';

  const DATA_PATH = 'timezones_index.json';
  const FALLBACK_JS_PATH = 'timezones_index.js';
  const OVERRIDES_STORAGE_KEY = 'customerTimezoneOverrides';
  const UNKNOWN_STORAGE_KEY = 'customerTimezoneUnknowns';

  let indexes = null;
  let overrides = {};
  let unknownCustomers = [];
  let isInitialized = false;
  let initPromise = null;

  // ========= PUBLIC API =========

  return {
    async  init() {
      if (isInitialized) return;
      if (!initPromise) {
        initPromise = initialize();
      }
      await initPromise;
      isInitialized = true;
    },

    /**
     * Resolve timezone using dataset and overrides
     * @param {Object} identifiers
     * @returns {Promise<Object|null>}
     */
    async resolveTimezone(identifiers = {}) {
      await this.init();
      return (
        lookupOverride(identifiers) ||
        lookupDataset(identifiers)
      );
    },

    /**
     * Alias for backwards compatibility
     */
    async getTimezone(identifiers = {}) {
      return this.resolveTimezone(identifiers);
    },

    /**
     * Store/override timezone info (legacy compatibility)
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async storeTimezone(params = {}) {
      await this.init();
      const key = buildOverrideKey(params);
      if (!key) {
        return { success: false, error: 'No valid identifier for storage' };
      }

      overrides[key] = {
        timezone: params.timezone,
        accountName: params.accountName || null,
        accountCode: params.accountCode || null,
        institutionCode: params.institutionCode || params.orgCode || null,
        source: params.source || 'manual',
        timestamp: Date.now()
      };

      await saveToStorage(OVERRIDES_STORAGE_KEY, overrides);
      return { success: true, timezone: params.timezone, overrideKey: key };
    },

    async updateTimezone(params = {}) {
      return this.storeTimezone(params);
    },

    async checkUnknownCustomers() {
      await this.init();
      return {
        count: unknownCustomers.length,
        customers: unknownCustomers,
        hasUnknown: unknownCustomers.length > 0
      };
    },

    async addUnknownCustomer(customerData = {}) {
      await this.init();
      const lookupKey = buildOverrideKey(customerData);
      if (!lookupKey) return;

      const exists = unknownCustomers.some((record) => {
        const existingKey = buildOverrideKey(record);
        return existingKey === lookupKey;
      });

      if (!exists) {
        unknownCustomers.push({
          ...customerData,
          id: customerData.id || `unknown_${Date.now()}`,
          detectedAt: Date.now(),
          needsReview: true
        });
        await saveToStorage(UNKNOWN_STORAGE_KEY, unknownCustomers);
      }
    },

    async removeUnknownCustomer(customerId) {
      await this.init();
      unknownCustomers = unknownCustomers.filter((record) => record.id !== customerId);
      await saveToStorage(UNKNOWN_STORAGE_KEY, unknownCustomers);
    },

    async promoteUnknownCustomer(customerData = {}) {
      await this.init();
      if (customerData.id) {
        await this.removeUnknownCustomer(customerData.id);
      }

      if (customerData.timezone) {
        await this.storeTimezone({
          timezone: customerData.timezone,
          accountName: customerData.accountName,
          accountCode: customerData.accountCode,
          institutionCode: customerData.institutionCode,
          source: 'promoted'
        });
      }

      return { success: true, customer: customerData };
    },

    async getStats() {
      await this.init();
      return {
        totalTimezoneRecords: indexes?.byAccountName?.size || 0,
        overrides: Object.keys(overrides).length,
        unknownCustomers: unknownCustomers.length,
        needsReview: unknownCustomers.length > 0
      };
    },

    async clearAllData() {
      overrides = {};
      unknownCustomers = [];
      await saveToStorage(OVERRIDES_STORAGE_KEY, overrides);
      await saveToStorage(UNKNOWN_STORAGE_KEY, unknownCustomers);
    },

    /**
     * Return raw indexes for consumers that need direct access
     */
    async getIndexes() {
      await this.init();
      return indexes;
    }
  };

  // ========= INITIALIZATION =========

  async function initialize() {
    try {
      const [dataset, storedOverrides, storedUnknowns] = await Promise.all([
        loadDataset(),
        loadFromStorage(OVERRIDES_STORAGE_KEY),
        loadFromStorage(UNKNOWN_STORAGE_KEY)
      ]);

      indexes = dataset;
      overrides = storedOverrides || {};
      unknownCustomers = Array.isArray(storedUnknowns) ? storedUnknowns : [];
      console.log(
        '[CustomerTimezoneLookup] Initialized',
        indexes?.byAccountName?.size || 0,
        'account names'
      );
    } catch (error) {
      console.error('[CustomerTimezoneLookup] Initialization error:', error);
      indexes = indexes || { byAccountName: new Map() };
      overrides = overrides || {};
      unknownCustomers = unknownCustomers || [];
    }
  }

  async function loadDataset() {
    // Try loading JSON index first
    const jsonUrl = chrome?.runtime?.getURL ? chrome.runtime.getURL(DATA_PATH) : DATA_PATH;
    
    try {
      const response = await fetch(jsonUrl);
      if (!response.ok) {
        throw new Error(`Failed to load ${DATA_PATH}: ${response.status}`);
      }
      const data = await response.json();
      return loadIndex(data);
    } catch (error) {
      console.warn('[CustomerTimezoneLookup] Failed to load JSON index, trying JS fallback:', error);
      
      // Fallback to JavaScript file
      return loadFallbackJS();
    }
  }

  async function loadFallbackJS() {
    try {
      // Check if already loaded in window
      if (typeof window !== 'undefined' && window.TimezoneIndexFallback) {
        const indexMap = window.TimezoneIndexFallback.getTimezoneIndex();
        console.log('[CustomerTimezoneLookup] Loaded timezone index from JS fallback (already in window)');
        return { byAccountName: indexMap };
      }

      const jsUrl = chrome?.runtime?.getURL ? chrome.runtime.getURL(FALLBACK_JS_PATH) : FALLBACK_JS_PATH;
      
      // Fetch JS file as text and extract the data
      const response = await fetch(jsUrl);
      if (!response.ok) {
        throw new Error(`Failed to load ${FALLBACK_JS_PATH}: ${response.status}`);
      }
      
      const jsText = await response.text();
      
      // Extract the TIMEZONE_INDEX_DATA object from the JS file
      // The data is in the format: const TIMEZONE_INDEX_DATA = {...};
      // Use a more robust regex that handles nested objects and large data
      const dataMatch = jsText.match(/const\s+TIMEZONE_INDEX_DATA\s*=\s*(\{[\s\S]*?\});/);
      if (!dataMatch || !dataMatch[1]) {
        throw new Error('Could not extract TIMEZONE_INDEX_DATA from JS file');
      }
      
      // Parse the extracted JSON (it's already valid JSON format)
      let indexData;
      try {
        indexData = JSON.parse(dataMatch[1]);
      } catch (parseError) {
        // If JSON.parse fails, try to extract just the object content
        // This handles cases where the object might have trailing content
        const objectContent = dataMatch[1].trim();
        if (objectContent.startsWith('{') && objectContent.endsWith('}')) {
          indexData = JSON.parse(objectContent);
        } else {
          throw new Error(`Failed to parse TIMEZONE_INDEX_DATA: ${parseError.message}`);
        }
      }
      
      // Convert to Map
      const byAccountName = new Map(Object.entries(indexData));
      
      console.log('[CustomerTimezoneLookup] Loaded timezone index from JS fallback');
      return { byAccountName };
    } catch (error) {
      console.error('[CustomerTimezoneLookup] Failed to load JS fallback:', error);
      return { byAccountName: new Map() };
    }
  }

  function loadIndex(data) {
    try {
      // Handle both direct index object and wrapped format with meta
      const indexData = data.index || data;
      
      // Convert object to Map for O(1) lookups
      const byAccountName = new Map(Object.entries(indexData));
      
      if (data.meta) {
        console.log('[CustomerTimezoneLookup] Loaded index:', {
          version: data.meta.version,
          recordCount: data.meta.recordCount,
          buildDate: data.meta.buildDate
        });
      }
      
      return { byAccountName };
    } catch (error) {
      console.error('[CustomerTimezoneLookup] Failed to parse index:', error);
      return { byAccountName: new Map() };
    }
  }


  // ========= LOOKUP HELPERS =========

  function lookupDataset(identifiers = {}) {
    const normalized = normalizeIdentifiers(identifiers);

    // Primary lookup: Account Name (normalized)
    if (normalized.accountName) {
      const normalizedAccountName = normalizeOrgCode(normalized.accountName);
      if (normalizedAccountName && indexes.byAccountName) {
        const record = indexes.byAccountName.get(normalizedAccountName);
        if (record) {
          return formatRecord(record, 'timezones_index', {
            type: 'accountName',
            value: normalizedAccountName
          });
        }
      }
    }

    // Fallback: Try institutionCode/orgCode/accountCode as Account Name
    if (normalized.institutionCode) {
      const normalizedAccountName = normalizeOrgCode(normalized.institutionCode);
      if (normalizedAccountName && indexes.byAccountName) {
        const record = indexes.byAccountName.get(normalizedAccountName);
        if (record) {
          return formatRecord(record, 'timezones_index', {
            type: 'institutionCode',
            value: normalizedAccountName
          });
        }
      }
    }

    return null;
  }

  function lookupOverride(identifiers = {}) {
    const normalized = normalizeIdentifiers(identifiers);
    const overrideRecords = Object.values(overrides);

    const match = overrideRecords.find((record) => {
      const recordOrgCode = normalizeOrgCode(record.institutionCode);
      const recordAccountCode = normalizeOrgCode(record.accountCode);

      if (normalized.institutionCode && recordOrgCode === normalized.institutionCode) return true;
      if (normalized.institutionCode && recordAccountCode === normalized.institutionCode) return true;
      if (normalized.accountName && record.accountName) {
        const recName = record.accountName.toLowerCase();
        const queryName = normalized.accountName.toLowerCase();
        if (recName === queryName) return true;
        if (recName.includes(queryName) || queryName.includes(recName)) return true;
      }
      return false;
    });

    if (!match) return null;

    return {
      timezone: match.timezone,
      source: match.source || 'manual',
      orgCode: normalizeOrgCode(match.institutionCode),
      orgName: match.accountName || null,
      dbServers: [],
      customerIds: [],
      institutionIds: [],
      matchType: 'override',
      matchValue: match.institutionCode || match.accountCode || match.accountName || 'override'
    };
  }

  function normalizeIdentifiers(input = {}) {
    return {
      institutionCode: normalizeOrgCode(
        input.institutionCode ||
          input.orgCode ||
          input.accountCode ||
          input.customerCode ||
          null
      ),
      accountName: input.accountName 
        ? String(input.accountName).trim() 
        : (input.institutionCode || input.orgCode || input.accountCode || input.customerCode 
          ? String(input.institutionCode || input.orgCode || input.accountCode || input.customerCode).trim()
          : null)
    };
  }

  function normalizeOrgCode(value) {
    if (!value) return null;
    return String(value).trim().toUpperCase();
  }

  function formatRecord(record, source, matchMeta) {
    if (!record) return null;
    return {
      timezone: record.timezone,
      source,
      accountName: record.accountName || null,
      accountNameInternal: record.accountNameInternal || null,
      orgCode: normalizeOrgCode(record.accountName), // For backward compatibility
      orgName: record.accountName || null, // For backward compatibility
      state: record.state || null,
      country: record.country || null,
      region: record.region || null,
      currency: record.currency || null,
      dbServers: [], // No longer available in CSV
      customerIds: [], // No longer available in CSV
      institutionIds: [], // No longer available in CSV
      matchType: matchMeta?.type || null,
      matchValue: matchMeta?.value || null
    };
  }

  function buildOverrideKey(data = {}) {
    // Prioritize Account Name
    if (data.accountName) {
      return normalizeOrgCode(data.accountName);
    }
    const code =
      data.institutionCode ||
      data.orgCode ||
      data.accountCode ||
      data.customerCode ||
      null;
    if (code) return normalizeOrgCode(code);
    return null;
  }

  // ========= STORAGE HELPERS =========

  function loadFromStorage(key) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('[CustomerTimezoneLookup] Storage read error:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(result[key]);
      });
    });
  }

  function saveToStorage(key, data) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: data }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('[CustomerTimezoneLookup] Storage write error:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CustomerTimezoneLookup;
}

