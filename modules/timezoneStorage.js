/**
 * Timezone Storage Module
 * Stores and retrieves detected timezones for customer accounts
 * Maps timezones to customer names and institution codes
 */

const TimezoneStorage = {
    storageKey: 'detectedTimezones',
    isInitialized: false,

    /**
     * Initialize the timezone storage
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isInitialized) {
            return;
        }

        console.log('[TimezoneStorage] Initializing...');
        this.isInitialized = true;
        console.log('[TimezoneStorage] Initialized');
    },

    /**
     * Save timezone for an account
     * @param {string} accountName - Account/customer name
     * @param {string} timezone - Detected timezone (e.g., 'Australia/Sydney')
     * @param {string|null} institutionCode - Optional institution code
     * @returns {Promise<void>}
     */
    async saveTimezone(accountName, timezone, institutionCode = null) {
        if (!accountName || !timezone) {
            console.warn('[TimezoneStorage] Missing accountName or timezone');
            return;
        }

        try {
            const data = await this.getAllTimezones();
            
            // Create normalized key from account name
            const accountKey = this.normalizeKey(accountName);
            
            // Store timezone data
            data[accountKey] = {
                accountName: accountName,
                timezone: timezone,
                institutionCode: institutionCode,
                lastUpdated: Date.now(),
                timestamp: new Date().toISOString()
            };

            // If institution code is provided, also create a mapping
            if (institutionCode) {
                const codeKey = this.normalizeKey(institutionCode);
                data[codeKey] = {
                    accountName: accountName,
                    timezone: timezone,
                    institutionCode: institutionCode,
                    lastUpdated: Date.now(),
                    timestamp: new Date().toISOString()
                };
            }

            await this.saveAllTimezones(data);
            console.log(`[TimezoneStorage] Saved timezone for ${accountName}: ${timezone}${institutionCode ? ` (${institutionCode})` : ''}`);
        } catch (error) {
            console.error('[TimezoneStorage] Error saving timezone:', error);
        }
    },

    /**
     * Get timezone for an account or institution code
     * @param {string} identifier - Account name or institution code
     * @returns {Promise<Object|null>} Timezone data object or null
     */
    async getTimezone(identifier) {
        if (!identifier) {
            return null;
        }

        try {
            const data = await this.getAllTimezones();
            const key = this.normalizeKey(identifier);
            
            const timezoneData = data[key];
            
            if (timezoneData) {
                console.log(`[TimezoneStorage] Found cached timezone for ${identifier}: ${timezoneData.timezone}`);
                return timezoneData;
            }

            // Try to find by partial match in account name
            for (const [storedKey, value] of Object.entries(data)) {
                if (value.accountName && value.accountName.toLowerCase().includes(identifier.toLowerCase())) {
                    console.log(`[TimezoneStorage] Found timezone by partial match for ${identifier}: ${value.timezone}`);
                    return value;
                }
            }

            console.log(`[TimezoneStorage] No cached timezone found for ${identifier}`);
            return null;
        } catch (error) {
            console.error('[TimezoneStorage] Error getting timezone:', error);
            return null;
        }
    },

    /**
     * Get timezone string only (convenience method)
     * @param {string} identifier - Account name or institution code
     * @returns {Promise<string|null>}
     */
    async getTimezoneString(identifier) {
        const data = await this.getTimezone(identifier);
        return data ? data.timezone : null;
    },

    /**
     * Check if timezone exists for identifier
     * @param {string} identifier - Account name or institution code
     * @returns {Promise<boolean>}
     */
    async hasTimezone(identifier) {
        const timezone = await this.getTimezone(identifier);
        return timezone !== null;
    },

    /**
     * Get all stored timezones
     * @returns {Promise<Object>}
     */
    async getAllTimezones() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.storageKey], (result) => {
                resolve(result[this.storageKey] || {});
            });
        });
    },

    /**
     * Save all timezone data
     * @param {Object} data
     * @returns {Promise<void>}
     */
    async saveAllTimezones(data) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.storageKey]: data }, () => {
                resolve();
            });
        });
    },

    /**
     * Delete timezone for an identifier
     * @param {string} identifier - Account name or institution code
     * @returns {Promise<void>}
     */
    async deleteTimezone(identifier) {
        if (!identifier) {
            return;
        }

        try {
            const data = await this.getAllTimezones();
            const key = this.normalizeKey(identifier);
            
            if (data[key]) {
                delete data[key];
                await this.saveAllTimezones(data);
                console.log(`[TimezoneStorage] Deleted timezone for ${identifier}`);
            }
        } catch (error) {
            console.error('[TimezoneStorage] Error deleting timezone:', error);
        }
    },

    /**
     * Clear all stored timezones
     * @returns {Promise<void>}
     */
    async clearAll() {
        try {
            await this.saveAllTimezones({});
            console.log('[TimezoneStorage] Cleared all timezones');
        } catch (error) {
            console.error('[TimezoneStorage] Error clearing timezones:', error);
        }
    },

    /**
     * Get statistics about stored timezones
     * @returns {Promise<Object>}
     */
    async getStats() {
        const data = await this.getAllTimezones();
        const entries = Object.values(data);
        
        // Group by timezone
        const timezoneGroups = {};
        entries.forEach(entry => {
            if (!timezoneGroups[entry.timezone]) {
                timezoneGroups[entry.timezone] = [];
            }
            timezoneGroups[entry.timezone].push(entry.accountName);
        });

        return {
            totalEntries: entries.length,
            uniqueTimezones: Object.keys(timezoneGroups).length,
            timezoneGroups: timezoneGroups,
            lastUpdated: entries.length > 0 
                ? Math.max(...entries.map(e => e.lastUpdated))
                : null
        };
    },

    /**
     * Export all timezone data for backup
     * @returns {Promise<Object>}
     */
    async exportData() {
        const data = await this.getAllTimezones();
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            data: data
        };
    },

    /**
     * Import timezone data from backup
     * @param {Object} exportedData
     * @returns {Promise<void>}
     */
    async importData(exportedData) {
        if (!exportedData || !exportedData.data) {
            console.error('[TimezoneStorage] Invalid import data');
            return;
        }

        try {
            await this.saveAllTimezones(exportedData.data);
            console.log('[TimezoneStorage] Imported timezone data');
        } catch (error) {
            console.error('[TimezoneStorage] Error importing data:', error);
        }
    },

    /**
     * Normalize key for consistent lookups
     * @param {string} key
     * @returns {string}
     */
    normalizeKey(key) {
        if (!key) return '';
        // Convert to lowercase and remove extra whitespace
        return key.trim().toLowerCase().replace(/\s+/g, ' ');
    },

    /**
     * Try to match timezone using customer data from CustomerDataManager
     * @param {string} identifier - Account name or institution code
     * @returns {Promise<Object|null>}
     */
    async getTimezoneWithCustomerFallback(identifier) {
        // First check stored timezones
        let timezoneData = await this.getTimezone(identifier);
        if (timezoneData) {
            return timezoneData;
        }

        // Try to find in customer list if CustomerDataManager is available
        if (typeof CustomerDataManager !== 'undefined') {
            try {
                // Try to find customer by institution code
                const customer = CustomerDataManager.findByInstitutionCode(identifier);
                if (customer) {
                    // Check if we have timezone for the customer name
                    timezoneData = await this.getTimezone(customer.name);
                    if (timezoneData) {
                        console.log(`[TimezoneStorage] Found timezone via customer name lookup: ${customer.name}`);
                        return timezoneData;
                    }
                }

                // Try searching all customers for name match
                const allCustomers = CustomerDataManager.getAllCustomers();
                for (const customer of allCustomers) {
                    if (customer.name && customer.name.toLowerCase().includes(identifier.toLowerCase())) {
                        timezoneData = await this.getTimezone(customer.name);
                        if (timezoneData) {
                            console.log(`[TimezoneStorage] Found timezone via customer search: ${customer.name}`);
                            return timezoneData;
                        }
                    }
                }
            } catch (error) {
                console.warn('[TimezoneStorage] Error in customer fallback:', error);
            }
        }

        return null;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimezoneStorage;
}
