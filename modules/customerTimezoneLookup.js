/**
 * CustomerTimezoneLookup
 * Centralized timezone lookup helper that converts instTimezones.dsv
 * into indexed lookup tables and manages local overrides.
 */

const CustomerTimezoneLookup = (function() {
  'use strict';

  const DATA_PATH = 'instTimezones.dsv';
  const OVERRIDES_STORAGE_KEY = 'customerTimezoneOverrides';
  const UNKNOWN_STORAGE_KEY = 'customerTimezoneUnknowns';

  let indexes = null;
  let overrides = {};
  let unknownCustomers = [];
  let isInitialized = false;
  let initPromise = null;

  // ========= PUBLIC API =========

  return {
    async init() {
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
        totalTimezoneRecords: Object.keys(indexes.byOrgCode || {}).length,
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
        Object.keys(indexes.byOrgCode || {}).length,
        'org codes'
      );
    } catch (error) {
      console.error('[CustomerTimezoneLookup] Initialization error:', error);
      indexes = indexes || { byOrgCode: {}, byCustomerId: {}, byInstitutionId: {} };
      overrides = overrides || {};
      unknownCustomers = unknownCustomers || [];
    }
  }

  async function loadDataset() {
    const url = chrome?.runtime?.getURL ? chrome.runtime.getURL(DATA_PATH) : DATA_PATH;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${DATA_PATH}: ${response.status}`);
      }
      const text = await response.text();
      return parseDsv(text);
    } catch (error) {
      console.error('[CustomerTimezoneLookup] Failed to load dataset:', error);
      return { byOrgCode: {}, byCustomerId: {}, byInstitutionId: {} };
    }
  }

  function parseDsv(text) {
    const lines = text.split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
    if (lines.length === 0) {
      return { byOrgCode: {}, byCustomerId: {}, byInstitutionId: {} };
    }

    const headerLine = lines.shift();
    const headers = splitLine(headerLine).map((h) => h.trim());
    const columnIndex = headers.reduce((acc, header, idx) => {
      acc[header] = idx;
      return acc;
    }, {});

    const byOrgCode = {};
    const byCustomerId = {};
    const byInstitutionId = {};

    for (const line of lines) {
      const parts = splitLine(line);
      if (!parts.length) continue;

      const row = {
        dbServer: getPart(parts, columnIndex.DB_SERVER),
        customerId: getPart(parts, columnIndex.CUSTOMERID),
        institutionId: getPart(parts, columnIndex.INSTITUTIONID),
        timezone: getPart(parts, columnIndex.ORG_TIMEZONE),
        orgCode: getPart(parts, columnIndex.ORG_CODE),
        orgName: getPart(parts, columnIndex.ORG_NAME)
      };

      if (!row.orgCode || !row.timezone) {
        continue;
      }

      const normalizedOrgCode = normalizeOrgCode(row.orgCode);
      if (!normalizedOrgCode) continue;

      let record = byOrgCode[normalizedOrgCode];
      if (!record) {
        record = {
          orgCode: normalizedOrgCode,
          orgName: row.orgName || null,
          timezone: row.timezone,
          dbServers: new Set(),
          customerIds: new Set(),
          institutionIds: new Set()
        };
        byOrgCode[normalizedOrgCode] = record;
      }

      if (row.dbServer) {
        record.dbServers.add(row.dbServer.toUpperCase());
      }

      if (row.customerId) {
        record.customerIds.add(row.customerId);
        byCustomerId[row.customerId] = record;
      }

      if (row.institutionId) {
        record.institutionIds.add(row.institutionId);
        byInstitutionId[row.institutionId] = record;
      }
    }

    return { byOrgCode, byCustomerId, byInstitutionId };
  }

  function splitLine(line) {
    if (!line) return [];
    if (line.includes('\t')) {
      return line.split('\t').map((part) => part.trim());
    }
    return line.trim().split(/\s{2,}/).map((part) => part.trim());
  }

  function getPart(parts, index) {
    if (index === undefined || index === -1) return '';
    return parts[index] || '';
  }

  // ========= LOOKUP HELPERS =========

  function lookupDataset(identifiers = {}) {
    const normalized = normalizeIdentifiers(identifiers);

    if (normalized.institutionCode && indexes.byOrgCode[normalized.institutionCode]) {
      return formatRecord(indexes.byOrgCode[normalized.institutionCode], 'instTimezones', {
        type: 'institutionCode',
        value: normalized.institutionCode
      });
    }

    if (normalized.customerId && indexes.byCustomerId[normalized.customerId]) {
      return formatRecord(indexes.byCustomerId[normalized.customerId], 'instTimezones', {
        type: 'customerId',
        value: normalized.customerId
      });
    }

    if (normalized.institutionId && indexes.byInstitutionId[normalized.institutionId]) {
      return formatRecord(indexes.byInstitutionId[normalized.institutionId], 'instTimezones', {
        type: 'institutionId',
        value: normalized.institutionId
      });
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
      customerId: normalizeId(input.customerId || input.custID),
      institutionId: normalizeId(input.institutionId || input.instID),
      accountName: input.accountName ? String(input.accountName).trim() : null
    };
  }

  function normalizeOrgCode(value) {
    if (!value) return null;
    return String(value).trim().toUpperCase();
  }

  function normalizeId(value) {
    if (!value) return null;
    return String(value).trim();
  }

  function formatRecord(record, source, matchMeta) {
    if (!record) return null;
    return {
      timezone: record.timezone,
      source,
      orgCode: record.orgCode,
      orgName: record.orgName,
      dbServers: Array.from(record.dbServers || []),
      customerIds: Array.from(record.customerIds || []),
      institutionIds: Array.from(record.institutionIds || []),
      matchType: matchMeta?.type || null,
      matchValue: matchMeta?.value || null
    };
  }

  function buildOverrideKey(data = {}) {
    const code =
      data.institutionCode ||
      data.orgCode ||
      data.accountCode ||
      data.customerCode ||
      null;
    if (code) return normalizeOrgCode(code);
    if (data.accountName) return data.accountName.trim().toLowerCase();
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

