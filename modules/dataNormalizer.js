/**
 * DataNormalizer Module
 * 
 * Normalizes field names from various data sources to use standardized naming conventions.
 * This module provides backward compatibility during the transition from deprecated field names
 * to the standardized camelCase naming convention.
 * 
 * Standard Naming Convention:
 * - customerId (not custID, custId, customerid)
 * - institutionId (not instID, instId, institutionid)
 * - institutionCode (not instCode)
 * 
 * @module DataNormalizer
 */
const DataNormalizer = {
  /**
   * Normalizes customer-related field names to standard camelCase
   * Accepts data with deprecated field names and returns object with standardized names
   * 
   * @param {Object} data - Input data that may contain deprecated field names
   * @returns {Object} Normalized data with standardized field names
   * 
   * @example
   * // Input: { custID: '1234', instCode: '61USC_INST' }
   * // Output: { customerId: '1234', institutionCode: '61USC_INST' }
   */
  normalizeCustomerFields(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const normalized = { ...data };

    // Normalize customerId (accepts: custID, custId, customerid, customerId)
    if (normalized.customerId === undefined || normalized.customerId === null) {
      normalized.customerId = data.custID || data.custId || data.customerid || null;
    }
    // Remove deprecated variants from normalized object
    delete normalized.custID;
    delete normalized.custId;
    delete normalized.customerid;

    // Normalize institutionId (accepts: instID, instId, institutionid, institutionId)
    if (normalized.institutionId === undefined || normalized.institutionId === null) {
      normalized.institutionId = data.instID || data.instId || data.institutionid || null;
    }
    // Remove deprecated variants from normalized object
    delete normalized.instID;
    delete normalized.instId;
    delete normalized.institutionid;

    // Normalize institutionCode (accepts: instCode, institutionCode)
    if (normalized.institutionCode === undefined || normalized.institutionCode === null) {
      normalized.institutionCode = data.instCode || null;
    }
    // Remove deprecated variant from normalized object
    delete normalized.instCode;

    return normalized;
  },

  /**
   * Extracts and normalizes only customer-related fields from data
   * Returns a clean object with only customer metadata fields
   * 
   * @param {Object} data - Input data containing customer fields
   * @returns {Object} Object containing only normalized customer fields
   */
  extractCustomerMetadata(data) {
    if (!data || typeof data !== 'object') {
      return {
        customerId: null,
        institutionId: null,
        institutionCode: null,
        server: null,
        productServiceName: null,
        timezone: null
      };
    }

    return {
      customerId: data.customerId || data.custID || data.custId || data.customerid || null,
      institutionId: data.institutionId || data.instID || data.instId || data.institutionid || null,
      institutionCode: data.institutionCode || data.instCode || null,
      server: data.server || null,
      productServiceName: data.productServiceName || data.platformService || null,
      timezone: data.timezone || data.customerTimezone || null,
      timezoneSource: data.timezoneSource || data.customerTimezoneSource || null,
      customerOrgCode: data.customerOrgCode || null,
      customerOrgName: data.customerOrgName || null
    };
  },

  /**
   * Normalizes a complete case data object
   * Handles all deprecated field names and returns standardized structure
   * 
   * @param {Object} data - Raw case data from extractor
   * @returns {Object} Normalized case data
   */
  normalizeCaseData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const normalized = this.normalizeCustomerFields(data);

    // Ensure consistent timezone field naming
    if (normalized.customerTimezone && !normalized.timezone) {
      normalized.timezone = normalized.customerTimezone;
    }
    if (normalized.customerTimezoneSource && !normalized.timezoneSource) {
      normalized.timezoneSource = normalized.customerTimezoneSource;
    }

    return normalized;
  },

  /**
   * Checks if data contains any deprecated field names
   * Useful for logging warnings during transition period
   * 
   * @param {Object} data - Data object to check
   * @returns {Object} Object with hasDeprecated flag and list of deprecated fields found
   */
  checkDeprecatedFields(data) {
    if (!data || typeof data !== 'object') {
      return { hasDeprecated: false, deprecatedFields: [] };
    }

    const deprecatedMappings = {
      'custID': 'customerId',
      'custId': 'customerId',
      'customerid': 'customerId',
      'instID': 'institutionId',
      'instId': 'institutionId',
      'institutionid': 'institutionId',
      'instCode': 'institutionCode'
    };

    const found = [];
    for (const [deprecated, standard] of Object.entries(deprecatedMappings)) {
      if (data[deprecated] !== undefined) {
        found.push({ deprecated, standard, value: data[deprecated] });
      }
    }

    return {
      hasDeprecated: found.length > 0,
      deprecatedFields: found
    };
  },

  /**
   * Logs a warning if deprecated fields are found
   * Call this at data entry points during transition period
   * 
   * @param {Object} data - Data to check
   * @param {string} source - Source identifier for logging (e.g., 'CaseDataExtractor')
   */
  warnIfDeprecated(data, source = 'Unknown') {
    const check = this.checkDeprecatedFields(data);
    if (check.hasDeprecated) {
      console.warn(`[DataNormalizer] Deprecated field names found in ${source}:`,
        check.deprecatedFields.map(f => `${f.deprecated} → ${f.standard}`).join(', ')
      );
    }
  }
};

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataNormalizer;
}
