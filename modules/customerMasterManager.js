/**
 * CustomerMasterManager
 * 
 * Unified customer data and timezone resolution module.
 * Replaces both CustomerDataManager and CustomerTimezoneLookup with a single source of truth.
 * 
 * Features:
 * - Loads customerMasterList.json (7,212 institution records)
 * - Multiple lookup indexes for fast resolution
 * - User override capability for custom timezone mappings
 * - Backwards-compatible API for consuming modules
 */

const CustomerMasterManager = (function() {
  'use strict';

  // ========== CONSTANTS ==========

  const DATA_PATH = 'customerMasterList.json';
  const OVERRIDES_STORAGE_KEY = 'customerTimezoneOverrides';
  const UNKNOWN_STORAGE_KEY = 'customerTimezoneUnknowns';

  // ========== PRIVATE STATE ==========

  let isInitialized = false;
  let initPromise = null;
  
  // Data store
  let records = [];
  let indexes = {
    byAccountName: new Map(),
    byInstitutionCode: new Map(),
    byAccountCode: new Map(),
    byServerIds: new Map()
  };
  
  // User overrides
  let overrides = {};
  let unknownCustomers = [];

  // Metadata
  let meta = {
    version: null,
    recordCount: 0,
    buildDate: null
  };

  // ========== INITIALIZATION ==========

  /**
   * Initialize the module
   * @returns {Promise<void>}
   */
  async function initialize() {
    try {
      console.log('[CustomerMasterManager] Initializing...');

      // Load data and overrides in parallel
      const [dataLoaded, storedOverrides, storedUnknowns] = await Promise.all([
        loadDataset(),
        loadFromStorage(OVERRIDES_STORAGE_KEY),
        loadFromStorage(UNKNOWN_STORAGE_KEY)
      ]);

      overrides = storedOverrides || {};
      unknownCustomers = Array.isArray(storedUnknowns) ? storedUnknowns : [];

      console.log('[CustomerMasterManager] Initialized:', {
        records: records.length,
        accountNames: indexes.byAccountName.size,
        institutionCodes: indexes.byInstitutionCode.size,
        overrides: Object.keys(overrides).length,
        unknownCustomers: unknownCustomers.length
      });

    } catch (error) {
      console.error('[CustomerMasterManager] Initialization failed:', error);
      // Initialize with empty data to prevent crashes
      records = [];
      indexes = {
        byAccountName: new Map(),
        byInstitutionCode: new Map(),
        byAccountCode: new Map(),
        byServerIds: new Map()
      };
      overrides = {};
      unknownCustomers = [];
    }
  }

  /**
   * Load the customer master dataset from JSON
   * @returns {Promise<boolean>}
   */
  async function loadDataset() {
    try {
      const jsonUrl = chrome?.runtime?.getURL 
        ? chrome.runtime.getURL(DATA_PATH) 
        : DATA_PATH;

      const response = await fetch(jsonUrl);
      if (!response.ok) {
        throw new Error(`Failed to load ${DATA_PATH}: ${response.status}`);
      }

      const data = await response.json();
      
      // Store metadata
      if (data.meta) {
        meta = data.meta;
        console.log('[CustomerMasterManager] Loaded data:', {
          version: meta.version,
          recordCount: meta.recordCount,
          buildDate: meta.buildDate
        });
      }

      // Store records
      records = data.records || [];

      // Build indexes from pre-built index objects
      if (data.byAccountName) {
        indexes.byAccountName = new Map(
          Object.entries(data.byAccountName).map(([key, idx]) => [key, idx])
        );
      }

      if (data.byInstitutionCode) {
        indexes.byInstitutionCode = new Map(
          Object.entries(data.byInstitutionCode).map(([key, idx]) => [key, idx])
        );
      }

      if (data.byAccountCode) {
        indexes.byAccountCode = new Map(
          Object.entries(data.byAccountCode).map(([key, idx]) => [key, idx])
        );
      }

      if (data.byServerIds) {
        indexes.byServerIds = new Map(
          Object.entries(data.byServerIds).map(([key, idx]) => [key, idx])
        );
      }

      return true;

    } catch (error) {
      console.error('[CustomerMasterManager] Failed to load dataset, using empty dataset:', error);

      // Fallback to empty dataset so downstream lookups still work without crashing
      records = [];
      indexes = {
        byAccountName: new Map(),
        byInstitutionCode: new Map(),
        byAccountCode: new Map(),
        byServerIds: new Map()
      };
      meta = {
        version: 'fallback-empty',
        recordCount: 0,
        buildDate: new Date().toISOString()
      };

      return true; // Treat as handled to avoid repeated init failures
    }
  }

  // ========== LOOKUP HELPERS ==========

  /**
   * Normalize a string for lookup
   * @param {string} value - Input string
   * @returns {string|null} Normalized string or null
   */
  function normalizeKey(value) {
    if (!value || typeof value !== 'string') return null;
    return value.trim().toUpperCase();
  }

  /**
   * Build server+IDs composite key
   * @param {string} server - Server code
   * @param {string} customerId - Customer ID
   * @param {string} institutionId - Institution ID
   * @returns {string|null} Composite key or null
   */
  function buildServerIdsKey(server, customerId, institutionId) {
    if (!server || !customerId || !institutionId) return null;
    return `${normalizeKey(server)}|${customerId}|${institutionId}`;
  }

  /**
   * Get record by index
   * @param {number} index - Record index
   * @returns {Object|null} Record or null
   */
  function getRecordByIndex(index) {
    if (typeof index !== 'number' || index < 0 || index >= records.length) {
      return null;
    }
    return records[index];
  }

  /**
   * Look up customer in dataset by identifiers
   * @param {Object} identifiers - Lookup identifiers
   * @returns {Object|null} Customer record or null
   */
  function lookupInDataset(identifiers = {}) {
    // Strategy 1: Account name lookup (sfName or sqlName)
    if (identifiers.accountName) {
      const key = normalizeKey(identifiers.accountName);
      if (key && indexes.byAccountName.has(key)) {
        const record = getRecordByIndex(indexes.byAccountName.get(key));
        if (record) {
          return { record, matchType: 'accountName', matchValue: key };
        }
      }
    }

    // Strategy 2: Institution code lookup
    if (identifiers.institutionCode) {
      const key = normalizeKey(identifiers.institutionCode);
      if (key && indexes.byInstitutionCode.has(key)) {
        const record = getRecordByIndex(indexes.byInstitutionCode.get(key));
        if (record) {
          return { record, matchType: 'institutionCode', matchValue: key };
        }
      }
      // Also try with _INST suffix
      const keyWithInst = key && !key.endsWith('_INST') ? `${key}_INST` : null;
      if (keyWithInst && indexes.byAccountCode.has(keyWithInst)) {
        const record = getRecordByIndex(indexes.byAccountCode.get(keyWithInst));
        if (record) {
          return { record, matchType: 'accountCode', matchValue: keyWithInst };
        }
      }
    }

    // Strategy 3: Account code lookup
    if (identifiers.accountCode) {
      const key = normalizeKey(identifiers.accountCode);
      if (key && indexes.byAccountCode.has(key)) {
        const record = getRecordByIndex(indexes.byAccountCode.get(key));
        if (record) {
          return { record, matchType: 'accountCode', matchValue: key };
        }
      }
    }

    // Strategy 4: Server + IDs composite lookup
    if (identifiers.server && identifiers.customerId && identifiers.institutionId) {
      const key = buildServerIdsKey(
        identifiers.server,
        identifiers.customerId,
        identifiers.institutionId
      );
      if (key && indexes.byServerIds.has(key)) {
        const record = getRecordByIndex(indexes.byServerIds.get(key));
        if (record) {
          return { record, matchType: 'serverIds', matchValue: key };
        }
      }
    }

    return null;
  }

  /**
   * Look up in user overrides
   * @param {Object} identifiers - Lookup identifiers
   * @returns {Object|null} Override record or null
   */
  function lookupInOverrides(identifiers = {}) {
    const overrideList = Object.values(overrides);
    if (!overrideList.length) return null;

    const normalizedAccountName = identifiers.accountName 
      ? identifiers.accountName.toLowerCase().trim() 
      : null;
    const normalizedInstitutionCode = normalizeKey(identifiers.institutionCode);
    const normalizedAccountCode = normalizeKey(identifiers.accountCode);

    const match = overrideList.find((override) => {
      // Match by institution code
      if (normalizedInstitutionCode && normalizeKey(override.institutionCode) === normalizedInstitutionCode) {
        return true;
      }
      // Match by account code
      if (normalizedAccountCode && normalizeKey(override.accountCode) === normalizedAccountCode) {
        return true;
      }
      // Match by account name (partial match)
      if (normalizedAccountName && override.accountName) {
        const overrideName = override.accountName.toLowerCase().trim();
        if (overrideName === normalizedAccountName || 
            overrideName.includes(normalizedAccountName) || 
            normalizedAccountName.includes(overrideName)) {
          return true;
        }
      }
      return false;
    });

    return match || null;
  }

  /**
   * Build override storage key from data
   * @param {Object} data - Customer data
   * @returns {string|null} Override key
   */
  function buildOverrideKey(data = {}) {
    if (data.accountName) {
      return normalizeKey(data.accountName);
    }
    const code = data.institutionCode || data.accountCode || data.orgCode;
    if (code) return normalizeKey(code);
    return null;
  }

  /**
   * Format a customer record for return
   * @param {Object} record - Raw record
   * @param {string} source - Data source
   * @param {Object} matchMeta - Match metadata
   * @returns {Object} Formatted record
   */
  function formatCustomerRecord(record, source = 'customerMasterList', matchMeta = {}) {
    if (!record) return null;

    return {
      // Core identifiers
      sqlName: record.sqlName || null,
      sfName: record.sfName || null,
      accountName: record.sfName || record.sqlName || null,
      customerId: record.customerId || null,
      institutionId: record.institutionId || null,
      server: record.server || null,
      region: record.region || null,
      institutionCode: record.institutionCode || null,
      accountCode: record.accountCode || null,
      
      // Geography
      city: record.city || null,
      state: record.state || null,
      country: record.country || null,
      
      // Timezone (normalized via TimezoneNormalizer)
      timezone: normalizeTimezone(record),
      timezoneRaw: record.timezone || null, // Original value for debugging
      
      // Metadata
      source,
      matchType: matchMeta.matchType || null,
      matchValue: matchMeta.matchValue || null
    };
  }

  /**
   * Normalize timezone value using TimezoneNormalizer
   * @param {Object} record - Customer record with timezone and geography data
   * @returns {string|null} Normalized IANA timezone or null
   */
  function normalizeTimezone(record) {
    if (!record) return null;
    
    const rawTimezone = record.timezone;
    
    // Skip if no timezone
    if (!rawTimezone || rawTimezone === 'null' || rawTimezone === 'undefined') {
      return null;
    }
    
    // Use TimezoneNormalizer if available
    if (typeof TimezoneNormalizer !== 'undefined') {
      const result = TimezoneNormalizer.normalize(rawTimezone, {
        country: record.country,
        state: record.state,
        city: record.city
      });
      
      if (result && result.timezone) {
        // Log normalization for debugging (only if changed)
        if (result.timezone !== rawTimezone) {
          console.log('[CustomerMasterManager] Timezone normalized:', {
            original: rawTimezone,
            normalized: result.timezone,
            source: result.source
          });
        }
        return result.timezone;
      }
    }
    
    // If TimezoneNormalizer not available or couldn't normalize, return raw value
    // but only if it looks like a valid IANA timezone (contains /)
    if (rawTimezone.includes('/')) {
      return rawTimezone;
    }
    
    // Log warning for unresolved non-IANA timezone
    console.warn('[CustomerMasterManager] Unable to normalize timezone:', rawTimezone, {
      country: record.country,
      state: record.state
    });
    
    return null;
  }

  /**
   * Format timezone result for backwards compatibility
   * @param {Object} record - Customer record
   * @param {string} source - Data source
   * @param {Object} matchMeta - Match metadata
   * @returns {Object} Timezone result
   */
  function formatTimezoneResult(record, source = 'customerMasterList', matchMeta = {}) {
    if (!record) return null;

    const normalizedTz = normalizeTimezone(record);

    return {
      timezone: normalizedTz,
      timezoneRaw: record.timezone || null, // Original value for debugging
      source,
      accountName: record.sfName || record.sqlName || record.accountName || null,
      orgCode: record.institutionCode || record.accountCode || null,
      orgName: record.sfName || record.sqlName || null,
      server: record.server || null,
      region: record.region || null,
      city: record.city || null,
      state: record.state || null,
      country: record.country || null,
      dbServers: [], // Legacy field - no longer used
      customerIds: record.customerId ? [record.customerId] : [],
      institutionIds: record.institutionId ? [record.institutionId] : [],
      matchType: matchMeta.matchType || null,
      matchValue: matchMeta.matchValue || null
    };
  }

  // ========== STORAGE HELPERS ==========

  /**
   * Load data from chrome.storage.local
   * @param {string} key - Storage key
   * @returns {Promise<any>} Stored data
   */
  function loadFromStorage(key) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('[CustomerMasterManager] Storage read error:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(result[key]);
      });
    });
  }

  /**
   * Save data to chrome.storage.local
   * @param {string} key - Storage key
   * @param {any} data - Data to store
   * @returns {Promise<void>}
   */
  function saveToStorage(key, data) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: data }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('[CustomerMasterManager] Storage write error:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  // ========== PUBLIC API ==========

  return {
    /**
     * Initialize the module
     * @returns {Promise<void>}
     */
    async init() {
      if (isInitialized) return;
      if (!initPromise) {
        initPromise = initialize();
      }
      await initPromise;
      isInitialized = true;
    },

    // ========== CUSTOMER LOOKUP ==========

    /**
     * Find customer by account name
     * @param {string} accountName - Account name to search
     * @returns {Object|null} Customer record or null
     */
    findByAccountName(accountName) {
      if (!accountName) return null;

      // Check overrides first
      const override = lookupInOverrides({ accountName });
      if (override) {
        console.log('[CustomerMasterManager] Found customer in overrides:', accountName);
        return formatCustomerRecord(override, 'override', { matchType: 'override', matchValue: accountName });
      }

      // Search in dataset
      const result = lookupInDataset({ accountName });
      if (result) {
        console.log('[CustomerMasterManager] Found customer:', {
          accountName,
          matchType: result.matchType,
          name: result.record.sfName || result.record.sqlName
        });
        return formatCustomerRecord(result.record, 'customerMasterList', result);
      }

      console.log('[CustomerMasterManager] Customer not found by account name:', accountName);
      return null;
    },

    /**
     * Find customer by institution code with optional account name fallback
     * (Backwards compatible with CustomerDataManager.findByInstitutionCode)
     * @param {string} institutionCode - Institution code
     * @param {string} accountName - Optional account name for fallback
     * @returns {Object|null} Customer record or null
     */
    findByInstitutionCode(institutionCode, accountName = null) {
      // Check overrides first
      const override = lookupInOverrides({ institutionCode, accountName });
      if (override) {
        console.log('[CustomerMasterManager] Found customer in overrides (institution code):', institutionCode);
        return formatCustomerRecord(override, 'override', { matchType: 'override', matchValue: institutionCode });
      }

      // Strategy 1: Search by institution code
      if (institutionCode) {
        const result = lookupInDataset({ institutionCode });
        if (result) {
          console.log('[CustomerMasterManager] Found customer by institution code:', {
            institutionCode,
            matchType: result.matchType,
            name: result.record.sfName || result.record.sqlName
          });
          return formatCustomerRecord(result.record, 'customerMasterList', result);
        }
      }

      // Strategy 2: Fallback to account name
      if (accountName) {
        const result = lookupInDataset({ accountName });
        if (result) {
          console.log('[CustomerMasterManager] Found customer by account name fallback:', {
            accountName,
            matchType: result.matchType,
            name: result.record.sfName || result.record.sqlName
          });
          return formatCustomerRecord(result.record, 'customerMasterList', result);
        }
      }

      console.log('[CustomerMasterManager] Customer not found:', { institutionCode, accountName });
      return null;
    },

    /**
     * Find customer by server and IDs
     * @param {string} server - Server code (e.g., 'ap02')
     * @param {string} customerId - Customer ID
     * @param {string} institutionId - Institution ID
     * @returns {Object|null} Customer record or null
     */
    findByServerIds(server, customerId, institutionId) {
      const result = lookupInDataset({ server, customerId, institutionId });
      if (result) {
        console.log('[CustomerMasterManager] Found customer by server+IDs:', {
          server,
          customerId,
          institutionId,
          name: result.record.sfName || result.record.sqlName
        });
        return formatCustomerRecord(result.record, 'customerMasterList', result);
      }
      return null;
    },

    // ========== TIMEZONE RESOLUTION ==========

    /**
     * Resolve timezone for a customer
     * @param {Object} identifiers - Lookup identifiers
     * @returns {Promise<Object|null>} Timezone result or null
     */
    async resolveTimezone(identifiers = {}) {
      await this.init();

      // Check overrides first
      const override = lookupInOverrides(identifiers);
      if (override && override.timezone) {
        console.log('[CustomerMasterManager] Timezone from override:', override.timezone);
        return formatTimezoneResult(override, 'override', { matchType: 'override' });
      }

      // Search in dataset
      const result = lookupInDataset(identifiers);
      if (result && result.record.timezone) {
        console.log('[CustomerMasterManager] Timezone resolved:', {
          timezone: result.record.timezone,
          matchType: result.matchType
        });
        return formatTimezoneResult(result.record, 'customerMasterList', result);
      }

      console.log('[CustomerMasterManager] Timezone not found for:', identifiers);
      return null;
    },

    /**
     * Alias for resolveTimezone (backwards compatibility with CustomerDataManager)
     * @param {Object} identifiers - Lookup identifiers
     * @returns {Promise<Object|null>} Timezone result or null
     */
    async getCustomerTimezone(identifiers = {}) {
      return this.resolveTimezone(identifiers);
    },

    // ========== USER OVERRIDES ==========

    /**
     * Store a timezone override
     * @param {Object} params - Override parameters
     * @returns {Promise<Object>} Result
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
        institutionCode: params.institutionCode || params.orgCode || null,
        accountCode: params.accountCode || null,
        source: params.source || 'manual',
        timestamp: Date.now()
      };

      await saveToStorage(OVERRIDES_STORAGE_KEY, overrides);
      
      console.log('[CustomerMasterManager] Stored timezone override:', {
        key,
        timezone: params.timezone
      });
      
      return { success: true, timezone: params.timezone, overrideKey: key };
    },

    /**
     * Alias for storeTimezone
     * @param {Object} params - Override parameters
     * @returns {Promise<Object>} Result
     */
    async updateTimezone(params = {}) {
      return this.storeTimezone(params);
    },

    // ========== UNKNOWN CUSTOMERS ==========

    /**
     * Check for unknown customers needing review
     * @returns {Promise<Object>} Unknown customers status
     */
    async checkUnknownCustomers() {
      await this.init();
      return {
        count: unknownCustomers.length,
        customers: unknownCustomers,
        hasUnknown: unknownCustomers.length > 0
      };
    },

    /**
     * Add an unknown customer for later review
     * @param {Object} customerData - Customer data
     * @returns {Promise<void>}
     */
    async addUnknownCustomer(customerData = {}) {
      await this.init();

      const lookupKey = buildOverrideKey(customerData);
      if (!lookupKey) return;

      // Check if already exists
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
        console.log('[CustomerMasterManager] Added unknown customer:', lookupKey);
      }
    },

    /**
     * Remove an unknown customer
     * @param {string} customerId - Customer ID to remove
     * @returns {Promise<void>}
     */
    async removeUnknownCustomer(customerId) {
      await this.init();
      unknownCustomers = unknownCustomers.filter((record) => record.id !== customerId);
      await saveToStorage(UNKNOWN_STORAGE_KEY, unknownCustomers);
    },

    /**
     * Promote an unknown customer to override
     * @param {Object} customerData - Customer data with timezone
     * @returns {Promise<Object>} Result
     */
    async promoteUnknownCustomer(customerData = {}) {
      await this.init();

      if (customerData.id) {
        await this.removeUnknownCustomer(customerData.id);
      }

      if (customerData.timezone) {
        await this.storeTimezone({
          timezone: customerData.timezone,
          accountName: customerData.accountName,
          institutionCode: customerData.institutionCode,
          accountCode: customerData.accountCode,
          source: 'promoted'
        });
      }

      return { success: true, customer: customerData };
    },

    // ========== UTILITIES ==========

    /**
     * Get all customers
     * @returns {Array} All customer records
     */
    getAllCustomers() {
      return records.map((record) => formatCustomerRecord(record, 'customerMasterList'));
    },

    /**
     * Find customers by server
     * @param {string} server - Server code
     * @returns {Array} Matching customer records
     */
    findByServer(server) {
      if (!server) return [];
      const normalizedServer = server.toLowerCase().trim();
      return records
        .filter((record) => record.server && record.server.toLowerCase() === normalizedServer)
        .map((record) => formatCustomerRecord(record, 'customerMasterList'));
    },

    /**
     * Get statistics
     * @returns {Promise<Object>} Stats
     */
    async getStats() {
      await this.init();
      return {
        version: meta.version,
        recordCount: records.length,
        buildDate: meta.buildDate,
        indexSizes: {
          byAccountName: indexes.byAccountName.size,
          byInstitutionCode: indexes.byInstitutionCode.size,
          byAccountCode: indexes.byAccountCode.size,
          byServerIds: indexes.byServerIds.size
        },
        overrides: Object.keys(overrides).length,
        unknownCustomers: unknownCustomers.length,
        needsReview: unknownCustomers.length > 0
      };
    },

    /**
     * Get raw indexes (for debugging)
     * @returns {Promise<Object>} Indexes
     */
    async getIndexes() {
      await this.init();
      return indexes;
    },

    /**
     * Clear all user data (overrides and unknowns)
     * @returns {Promise<void>}
     */
    async clearAllUserData() {
      overrides = {};
      unknownCustomers = [];
      await saveToStorage(OVERRIDES_STORAGE_KEY, overrides);
      await saveToStorage(UNKNOWN_STORAGE_KEY, unknownCustomers);
      console.log('[CustomerMasterManager] Cleared all user data');
    },

    /**
     * Cleanup the module
     */
    cleanup() {
      if (!isInitialized) return;
      console.log('[CustomerMasterManager] Cleaning up...');
      isInitialized = false;
      initPromise = null;
    }
  };
})();

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CustomerMasterManager;
}

