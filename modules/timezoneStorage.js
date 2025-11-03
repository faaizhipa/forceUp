/**
 * Timezone Storage Module
 * Manages timezone data for customers, linked to customer list
 * Stores timezone information by account name, account code, and institution code
 */

const TimezoneStorage = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  
  const STORAGE_KEY = 'customerTimezoneData';
  const UNKNOWN_CUSTOMERS_KEY = 'unknownCustomers';
  
  // ========== STORAGE OPERATIONS ==========

  /**
   * Get all timezone data from storage
   * @returns {Promise<Object>} Timezone data indexed by various keys
   */
  async function getAllTimezoneData() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve(result[STORAGE_KEY] || {});
      });
    });
  }

  /**
   * Save timezone data to storage
   * @param {Object} data - Timezone data to save
   * @returns {Promise<void>}
   */
  async function saveTimezoneData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
    });
  }

  /**
   * Get unknown customers (not in customer list)
   * @returns {Promise<Array>} Array of unknown customer records
   */
  async function getUnknownCustomers() {
    return new Promise((resolve) => {
      chrome.storage.local.get([UNKNOWN_CUSTOMERS_KEY], (result) => {
        resolve(result[UNKNOWN_CUSTOMERS_KEY] || []);
      });
    });
  }

  /**
   * Save unknown customers
   * @param {Array} customers - Array of unknown customer records
   * @returns {Promise<void>}
   */
  async function saveUnknownCustomers(customers) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [UNKNOWN_CUSTOMERS_KEY]: customers }, resolve);
    });
  }

  // ========== CUSTOMER MATCHING ==========

  /**
   * Find customer in customer list by various identifiers
   * @param {Object} identifiers - Object containing accountName, accountCode, institutionCode
   * @returns {Promise<Object|null>} Matching customer or null
   */
  async function findCustomerInList(identifiers) {
    const { accountName, accountCode, institutionCode } = identifiers;
    
    if (!accountName && !accountCode && !institutionCode) {
      console.warn('[TimezoneStorage] No identifiers provided for customer lookup');
      return null;
    }

    try {
      // Get customer list from CustomerDataManager
      const customerList = await CustomerDataManager.getCustomers();
      
      if (!customerList || customerList.length === 0) {
        console.warn('[TimezoneStorage] Customer list is empty');
        return null;
      }

      // Try matching by institution code first (most reliable)
      if (institutionCode) {
        const match = customerList.find(c => 
          c.institutionCode && c.institutionCode.toLowerCase() === institutionCode.toLowerCase()
        );
        if (match) {
          console.log(`[TimezoneStorage] Found customer by institutionCode: ${institutionCode}`);
          return match;
        }
      }

      // Try matching by account code
      if (accountCode) {
        const match = customerList.find(c => 
          c.institutionCode && c.institutionCode.toLowerCase() === accountCode.toLowerCase()
        );
        if (match) {
          console.log(`[TimezoneStorage] Found customer by accountCode: ${accountCode}`);
          return match;
        }
      }

      // Try matching by account name (case insensitive, partial match)
      if (accountName) {
        const normalizedName = accountName.toLowerCase().trim();
        const match = customerList.find(c => {
          if (!c.name) return false;
          const customerName = c.name.toLowerCase().trim();
          return customerName === normalizedName || 
                 customerName.includes(normalizedName) ||
                 normalizedName.includes(customerName);
        });
        if (match) {
          console.log(`[TimezoneStorage] Found customer by accountName: ${accountName}`);
          return match;
        }
      }

      console.log('[TimezoneStorage] No matching customer found in list');
      return null;
    } catch (error) {
      console.error('[TimezoneStorage] Error finding customer:', error);
      return null;
    }
  }

  // ========== TIMEZONE OPERATIONS ==========

  /**
   * Store timezone for a customer
   * @param {Object} params - Parameters object
   * @param {string} params.timezone - Timezone string (e.g., "America/New_York")
   * @param {string} [params.accountName] - Account name
   * @param {string} [params.accountCode] - Account code
   * @param {string} [params.institutionCode] - Institution code
   * @param {string} [params.source] - Source of timezone detection (e.g., "address", "case")
   * @returns {Promise<Object>} Result object with success status and details
   */
  async function storeTimezone(params) {
    const { timezone, accountName, accountCode, institutionCode, source = 'unknown' } = params;

    if (!timezone) {
      return { success: false, error: 'No timezone provided' };
    }

    try {
      // Find customer in list
      const customer = await findCustomerInList({ accountName, accountCode, institutionCode });
      
      const timezoneData = await getAllTimezoneData();
      const timestamp = Date.now();

      const record = {
        timezone,
        source,
        timestamp,
        lastUpdated: timestamp,
        accountName: accountName || null,
        accountCode: accountCode || null,
        institutionCode: institutionCode || null
      };

      if (customer) {
        // Customer found in list - store with multiple keys for lookup
        const primaryKey = customer.institutionCode || customer.name;
        
        // Store by primary key
        timezoneData[primaryKey] = {
          ...record,
          customerName: customer.name,
          server: customer.server,
          custID: customer.custID,
          instID: customer.instID,
          inCustomerList: true
        };

        // Also store by account name and code if different
        if (accountName && accountName !== primaryKey) {
          timezoneData[accountName] = timezoneData[primaryKey];
        }
        if (accountCode && accountCode !== primaryKey) {
          timezoneData[accountCode] = timezoneData[primaryKey];
        }

        await saveTimezoneData(timezoneData);

        console.log(`[TimezoneStorage] Stored timezone for known customer: ${customer.name} (${timezone})`);
        return { 
          success: true, 
          inCustomerList: true, 
          customer,
          timezone 
        };

      } else {
        // Customer NOT in list - store and add to unknown customers
        const lookupKey = institutionCode || accountCode || accountName;
        
        if (!lookupKey) {
          return { success: false, error: 'No valid identifier for storage' };
        }

        timezoneData[lookupKey] = {
          ...record,
          inCustomerList: false
        };

        await saveTimezoneData(timezoneData);

        // Add to unknown customers list
        await addUnknownCustomer({
          accountName,
          accountCode,
          institutionCode,
          timezone,
          source,
          detectedAt: timestamp
        });

        console.log(`[TimezoneStorage] Stored timezone for unknown customer: ${lookupKey} (${timezone})`);
        return { 
          success: true, 
          inCustomerList: false,
          needsReview: true,
          timezone,
          lookupKey
        };
      }

    } catch (error) {
      console.error('[TimezoneStorage] Error storing timezone:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get timezone for a customer
   * @param {Object} identifiers - Object containing accountName, accountCode, institutionCode
   * @returns {Promise<Object|null>} Timezone record or null
   */
  async function getTimezone(identifiers) {
    const { accountName, accountCode, institutionCode } = identifiers;
    
    try {
      const timezoneData = await getAllTimezoneData();

      // Try lookup by institution code first
      if (institutionCode && timezoneData[institutionCode]) {
        console.log(`[TimezoneStorage] Found timezone by institutionCode: ${institutionCode}`);
        return timezoneData[institutionCode];
      }

      // Try account code
      if (accountCode && timezoneData[accountCode]) {
        console.log(`[TimezoneStorage] Found timezone by accountCode: ${accountCode}`);
        return timezoneData[accountCode];
      }

      // Try account name
      if (accountName && timezoneData[accountName]) {
        console.log(`[TimezoneStorage] Found timezone by accountName: ${accountName}`);
        return timezoneData[accountName];
      }

      // Try finding customer in list and check if we have timezone under different key
      const customer = await findCustomerInList(identifiers);
      if (customer) {
        const primaryKey = customer.institutionCode || customer.name;
        if (timezoneData[primaryKey]) {
          console.log(`[TimezoneStorage] Found timezone by customer list match: ${primaryKey}`);
          return timezoneData[primaryKey];
        }
      }

      console.log('[TimezoneStorage] No timezone found for customer');
      return null;

    } catch (error) {
      console.error('[TimezoneStorage] Error getting timezone:', error);
      return null;
    }
  }

  /**
   * Update timezone for existing customer
   * @param {Object} params - Same as storeTimezone
   * @returns {Promise<Object>} Result object
   */
  async function updateTimezone(params) {
    // Same as storeTimezone - it will overwrite existing data
    const result = await storeTimezone(params);
    if (result.success) {
      console.log(`[TimezoneStorage] Updated timezone: ${params.timezone}`);
    }
    return result;
  }

  // ========== UNKNOWN CUSTOMER MANAGEMENT ==========

  /**
   * Add customer to unknown customers list
   * @param {Object} customerData - Customer data
   * @returns {Promise<void>}
   */
  async function addUnknownCustomer(customerData) {
    try {
      const unknownCustomers = await getUnknownCustomers();
      
      // Check if already exists
      const lookupKey = customerData.institutionCode || customerData.accountCode || customerData.accountName;
      const exists = unknownCustomers.some(c => {
        const existingKey = c.institutionCode || c.accountCode || c.accountName;
        return existingKey === lookupKey;
      });

      if (!exists) {
        unknownCustomers.push({
          ...customerData,
          id: `unknown_${Date.now()}`,
          needsReview: true
        });
        await saveUnknownCustomers(unknownCustomers);
        console.log(`[TimezoneStorage] Added unknown customer: ${lookupKey}`);
      } else {
        console.log(`[TimezoneStorage] Unknown customer already exists: ${lookupKey}`);
      }
    } catch (error) {
      console.error('[TimezoneStorage] Error adding unknown customer:', error);
    }
  }

  /**
   * Check if there are unknown customers pending review
   * @returns {Promise<Object>} Object with count and customers
   */
  async function checkUnknownCustomers() {
    try {
      const unknownCustomers = await getUnknownCustomers();
      return {
        count: unknownCustomers.length,
        customers: unknownCustomers,
        hasUnknown: unknownCustomers.length > 0
      };
    } catch (error) {
      console.error('[TimezoneStorage] Error checking unknown customers:', error);
      return { count: 0, customers: [], hasUnknown: false };
    }
  }

  /**
   * Remove customer from unknown list (after adding to customer list)
   * @param {string} customerId - ID of customer to remove
   * @returns {Promise<void>}
   */
  async function removeUnknownCustomer(customerId) {
    try {
      const unknownCustomers = await getUnknownCustomers();
      const filtered = unknownCustomers.filter(c => c.id !== customerId);
      await saveUnknownCustomers(filtered);
      console.log(`[TimezoneStorage] Removed unknown customer: ${customerId}`);
    } catch (error) {
      console.error('[TimezoneStorage] Error removing unknown customer:', error);
    }
  }

  /**
   * Promote unknown customer to customer list
   * This will be called after user confirms adding customer
   * @param {Object} customerData - Full customer data including server, custID, etc.
   * @returns {Promise<Object>} Result object
   */
  async function promoteUnknownCustomer(customerData) {
    try {
      // This will integrate with CustomerDataManager to add the customer
      // For now, just remove from unknown list
      if (customerData.id) {
        await removeUnknownCustomer(customerData.id);
      }

      // Update timezone record to mark as in customer list
      const timezoneData = await getAllTimezoneData();
      const lookupKey = customerData.institutionCode || customerData.accountCode || customerData.accountName;
      
      if (timezoneData[lookupKey]) {
        timezoneData[lookupKey].inCustomerList = true;
        timezoneData[lookupKey].customerName = customerData.name || customerData.accountName;
        await saveTimezoneData(timezoneData);
      }

      console.log(`[TimezoneStorage] Promoted unknown customer: ${lookupKey}`);
      return { success: true, customer: customerData };

    } catch (error) {
      console.error('[TimezoneStorage] Error promoting unknown customer:', error);
      return { success: false, error: error.message };
    }
  }

  // ========== STATISTICS & UTILITIES ==========

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Statistics object
   */
  async function getStats() {
    try {
      const timezoneData = await getAllTimezoneData();
      const unknownCustomers = await getUnknownCustomers();
      
      const totalRecords = Object.keys(timezoneData).length;
      const knownCustomers = Object.values(timezoneData).filter(r => r.inCustomerList).length;
      const unknownCount = unknownCustomers.length;

      return {
        totalTimezoneRecords: totalRecords,
        knownCustomers,
        unknownCustomers: unknownCount,
        needsReview: unknownCount > 0
      };
    } catch (error) {
      console.error('[TimezoneStorage] Error getting stats:', error);
      return {
        totalTimezoneRecords: 0,
        knownCustomers: 0,
        unknownCustomers: 0,
        needsReview: false
      };
    }
  }

  /**
   * Clear all timezone data (for debugging/reset)
   * @returns {Promise<void>}
   */
  async function clearAllData() {
    try {
      await saveTimezoneData({});
      await saveUnknownCustomers([]);
      console.log('[TimezoneStorage] Cleared all timezone data');
    } catch (error) {
      console.error('[TimezoneStorage] Error clearing data:', error);
    }
  }

  // ========== PUBLIC API ==========

  return {
    // Core operations
    storeTimezone,
    getTimezone,
    updateTimezone,
    
    // Customer matching
    findCustomerInList,
    
    // Unknown customer management
    checkUnknownCustomers,
    addUnknownCustomer,
    removeUnknownCustomer,
    promoteUnknownCustomer,
    
    // Utilities
    getStats,
    getAllTimezoneData,
    clearAllData
  };

})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezoneStorage;
}
