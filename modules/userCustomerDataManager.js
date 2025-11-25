/**
 * User Customer Data Manager Module
 * Manages user-added customer data stored in chrome.storage.local
 * Separate from default customer list, allows users to add/modify their own customer data
 */

const UserCustomerDataManager = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  
  const STORAGE_KEY = 'userCustomerList';
  let userCustomerList = [];
  let isInitialized = false;

  // ========== STORAGE HELPERS ==========
  
  /**
   * Load user customer list from storage
   * @returns {Promise<Array>}
   */
  function loadFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[UserCustomerDataManager] Error loading data:', chrome.runtime.lastError);
          resolve([]);
          return;
        }
        
        const stored = result[STORAGE_KEY];
        if (stored && Array.isArray(stored)) {
          resolve(stored);
        } else {
          resolve([]);
        }
      });
    });
  }

  /**
   * Save user customer list to storage
   * @param {Array} data - Customer list to save
   * @returns {Promise<void>}
   */
  function saveToStorage(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
        if (chrome.runtime.lastError) {
          console.error('[UserCustomerDataManager] Error saving data:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // ========== PUBLIC API ==========

  return {
    /**
     * Initializes the user customer data manager
     * @returns {Promise<void>}
     */
    async init() {
      if (isInitialized) return;

      console.log('[UserCustomerDataManager] Initializing...');

      try {
        userCustomerList = await loadFromStorage();
        isInitialized = true;
        console.log(`[UserCustomerDataManager] Initialized with ${userCustomerList.length} user-added customers`);
      } catch (err) {
        console.error('[UserCustomerDataManager] Initialization error:', err);
        userCustomerList = [];
        isInitialized = true;
      }
    },

    /**
     * Gets all user-added customers
     * @returns {Array}
     */
    getAll() {
      if (!isInitialized) {
        console.warn('[UserCustomerDataManager] Not initialized, returning empty array');
        return [];
      }
      return [...userCustomerList];
    },

    /**
     * Finds customer by institution code or account name
     * @param {string} institutionCode - Institution code to search for
     * @param {string} accountName - Optional account name for fallback matching
     * @returns {Object|null}
     */
    findByInstitutionCode(institutionCode, accountName = null) {
      if (!isInitialized) {
        console.warn('[UserCustomerDataManager] Not initialized');
        return null;
      }

      if (!institutionCode && !accountName) {
        return null;
      }

      // Strategy 1: Exact match on institution code
      if (institutionCode) {
        let customer = userCustomerList.find(c => c.institutionCode === institutionCode);
        if (customer) {
          console.log(`[UserCustomerDataManager] Found customer (exact match): ${customer.name || 'Unnamed'} (${institutionCode})`);
          return customer;
        }

        // Strategy 2: Partial match on institution code
        customer = userCustomerList.find(c => 
          c.institutionCode && c.institutionCode.includes(institutionCode)
        );
        if (customer) {
          console.log(`[UserCustomerDataManager] Found customer (partial match): ${customer.name || 'Unnamed'} (${institutionCode} matched ${customer.institutionCode})`);
          return customer;
        }
      }

      // Strategy 3: Fallback to account name matching
      if (accountName) {
        const normalizedAccountName = accountName.toLowerCase().trim();
        const customer = userCustomerList.find(c => {
          if (!c.name) return false;
          const customerName = c.name.toLowerCase().trim();
          return customerName === normalizedAccountName || 
                 customerName.includes(normalizedAccountName) ||
                 normalizedAccountName.includes(customerName);
        });

        if (customer) {
          console.log(`[UserCustomerDataManager] Found customer (name match): ${customer.name} matched "${accountName}"`);
          return customer;
        }
      }

      return null;
    },

    /**
     * Adds a new customer to the user list
     * @param {Object} customerData - Customer data object
     * @returns {Promise<Object>} Added customer with generated ID
     */
    async add(customerData) {
      if (!isInitialized) {
        await this.init();
      }

      if (!customerData.institutionCode) {
        throw new Error('institutionCode is required');
      }

      // Check if customer already exists
      const existing = this.findByInstitutionCode(customerData.institutionCode, customerData.name);
      if (existing) {
        throw new Error(`Customer with institutionCode "${customerData.institutionCode}" already exists. Use update() instead.`);
      }

      // Generate ID if not provided
      const newCustomer = {
        ...customerData,
        id: customerData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        addedAt: Date.now(),
        updatedAt: Date.now()
      };

      userCustomerList.push(newCustomer);
      await saveToStorage(userCustomerList);

      console.log(`[UserCustomerDataManager] Added customer: ${newCustomer.institutionCode}`);
      return newCustomer;
    },

    /**
     * Updates an existing customer
     * @param {string} institutionCode - Institution code of customer to update
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated customer
     */
    async update(institutionCode, updates) {
      if (!isInitialized) {
        await this.init();
      }

      const index = userCustomerList.findIndex(c => c.institutionCode === institutionCode);
      if (index === -1) {
        throw new Error(`Customer with institutionCode "${institutionCode}" not found`);
      }

      const updatedCustomer = {
        ...userCustomerList[index],
        ...updates,
        updatedAt: Date.now()
      };

      userCustomerList[index] = updatedCustomer;
      await saveToStorage(userCustomerList);

      console.log(`[UserCustomerDataManager] Updated customer: ${institutionCode}`);
      return updatedCustomer;
    },

    /**
     * Removes a customer from the user list
     * @param {string} institutionCode - Institution code of customer to remove
     * @returns {Promise<boolean>} True if removed, false if not found
     */
    async remove(institutionCode) {
      if (!isInitialized) {
        await this.init();
      }

      const index = userCustomerList.findIndex(c => c.institutionCode === institutionCode);
      if (index === -1) {
        return false;
      }

      userCustomerList.splice(index, 1);
      await saveToStorage(userCustomerList);

      console.log(`[UserCustomerDataManager] Removed customer: ${institutionCode}`);
      return true;
    },

    /**
     * Exports user customer list as JSON
     * @returns {string} JSON string
     */
    export() {
      if (!isInitialized) {
        console.warn('[UserCustomerDataManager] Not initialized, returning empty array');
        return JSON.stringify([], null, 2);
      }

      // Remove internal fields before export
      const exportData = userCustomerList.map(c => {
        const { id, addedAt, updatedAt, ...customer } = c;
        return customer;
      });

      return JSON.stringify(exportData, null, 2);
    },

    /**
     * Imports customer list from JSON
     * @param {string} jsonData - JSON string or parsed array
     * @param {Object} options - Import options
     * @param {boolean} options.overwrite - If true, replace existing list; if false, merge
     * @returns {Promise<Object>} Import result with stats
     */
    async import(jsonData, options = {}) {
      if (!isInitialized) {
        await this.init();
      }

      const { overwrite = false } = options;

      let importedData;
      if (typeof jsonData === 'string') {
        try {
          importedData = JSON.parse(jsonData);
        } catch (err) {
          throw new Error('Invalid JSON format');
        }
      } else {
        importedData = jsonData;
      }

      if (!Array.isArray(importedData)) {
        throw new Error('Imported data must be an array');
      }

      // Validate structure
      const validCustomers = [];
      const invalidCustomers = [];

      for (const customer of importedData) {
        if (!customer.institutionCode) {
          invalidCustomers.push(customer);
          continue;
        }
        validCustomers.push(customer);
      }

      if (overwrite) {
        // Replace entire list
        userCustomerList = validCustomers.map(c => ({
          ...c,
          id: c.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          addedAt: Date.now(),
          updatedAt: Date.now()
        }));
      } else {
        // Merge: update existing, add new
        for (const customer of validCustomers) {
          const existing = this.findByInstitutionCode(customer.institutionCode);
          if (existing) {
            // Update existing
            const index = userCustomerList.findIndex(c => c.institutionCode === customer.institutionCode);
            userCustomerList[index] = {
              ...userCustomerList[index],
              ...customer,
              id: userCustomerList[index].id, // Preserve existing ID
              updatedAt: Date.now()
            };
          } else {
            // Add new
            userCustomerList.push({
              ...customer,
              id: customer.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              addedAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        }
      }

      await saveToStorage(userCustomerList);

      const result = {
        total: importedData.length,
        valid: validCustomers.length,
        invalid: invalidCustomers.length,
        added: overwrite ? validCustomers.length : validCustomers.filter(c => !this.findByInstitutionCode(c.institutionCode)).length,
        updated: overwrite ? 0 : validCustomers.filter(c => this.findByInstitutionCode(c.institutionCode)).length
      };

      console.log(`[UserCustomerDataManager] Imported ${result.valid} customers (${result.added} added, ${result.updated} updated)`);
      return result;
    },

    /**
     * Gets statistics about user customer list
     * @returns {Object}
     */
    getStats() {
      return {
        count: userCustomerList.length,
        isInitialized
      };
    },

    /**
     * Cleans up the module
     */
    cleanup() {
      if (!isInitialized) return;
      
      console.log('[UserCustomerDataManager] Cleaning up...');
      isInitialized = false;
      userCustomerList = [];
    }
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserCustomerDataManager;
}

