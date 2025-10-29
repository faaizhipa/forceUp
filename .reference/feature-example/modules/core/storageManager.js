/**
 * Storage Manager
 * 
 * Provides centralized storage operations for the extension,
 * abstracting chrome.storage.sync and chrome.storage.local operations.
 */

/**
 * Storage configuration and defaults.
 */
const STORAGE_CONFIG = {
    // Default settings for the extension
    defaultSettings: {
        injectionLocations: { card: true, header: true },
        buttonStyle: 'Formal',
        useScrapedList: false,
        enableFieldHighlighting: true,
        enableCaseListEnhancements: true,
        autoSaveComments: true,
        commentSaveInterval: 30000 // 30 seconds
    },
    
    // Storage keys
    keys: {
        SETTINGS: 'settings',
        SCRAPED_CUSTOMER_LIST: 'scrapedCustomerList',
        CASE_DATA_CACHE: 'caseDataCache',
        COMMENT_DRAFTS: 'commentDrafts',
        USER_PREFERENCES: 'userPreferences'
    },
    
    // Cache configuration
    cache: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 100 // Maximum cached items
    }
};

/**
 * In-memory cache for frequently accessed data.
 */
const memoryCache = new Map();

/**
 * Gets data from chrome.storage.sync.
 * @param {string|Array<string>} keys Storage key(s) to retrieve.
 * @returns {Promise<object>} Promise resolving to the retrieved data.
 */
export async function getSyncData(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(keys, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * Sets data in chrome.storage.sync.
 * @param {object} data Data object to store.
 * @returns {Promise<void>} Promise resolving when data is stored.
 */
export async function setSyncData(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(data, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Gets data from chrome.storage.local.
 * @param {string|Array<string>} keys Storage key(s) to retrieve.
 * @returns {Promise<object>} Promise resolving to the retrieved data.
 */
export async function getLocalData(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * Sets data in chrome.storage.local.
 * @param {object} data Data object to store.
 * @returns {Promise<void>} Promise resolving when data is stored.
 */
export async function setLocalData(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Gets extension settings with defaults.
 * @returns {Promise<object>} Promise resolving to settings object.
 */
export async function getSettings() {
    const cacheKey = STORAGE_CONFIG.keys.SETTINGS;
    
    // Check memory cache first
    if (memoryCache.has(cacheKey)) {
        const cached = memoryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
            return cached.data;
        }
    }

    try {
        const result = await getSyncData(STORAGE_CONFIG.keys.SETTINGS);
        const settings = { ...STORAGE_CONFIG.defaultSettings, ...result.settings };
        
        // Cache the result
        memoryCache.set(cacheKey, {
            data: settings,
            timestamp: Date.now()
        });
        
        return settings;
    } catch (error) {
        console.error('[Storage Manager] Error getting settings:', error);
        return STORAGE_CONFIG.defaultSettings;
    }
}

/**
 * Saves extension settings.
 * @param {object} settings Settings object to save.
 * @returns {Promise<void>} Promise resolving when settings are saved.
 */
export async function saveSettings(settings) {
    try {
        const mergedSettings = { ...STORAGE_CONFIG.defaultSettings, ...settings };
        await setSyncData({ [STORAGE_CONFIG.keys.SETTINGS]: mergedSettings });
        
        // Update memory cache
        memoryCache.set(STORAGE_CONFIG.keys.SETTINGS, {
            data: mergedSettings,
            timestamp: Date.now()
        });
        
        console.log('[Storage Manager] Settings saved successfully');
    } catch (error) {
        console.error('[Storage Manager] Error saving settings:', error);
        throw error;
    }
}

/**
 * Gets cached case data.
 * @param {string} caseId Case ID to retrieve data for.
 * @returns {Promise<object|null>} Promise resolving to case data or null.
 */
export async function getCaseData(caseId) {
    try {
        const result = await getLocalData(STORAGE_CONFIG.keys.CASE_DATA_CACHE);
        const cache = result.caseDataCache || {};
        
        const caseData = cache[caseId];
        if (caseData && isDataFresh(caseData.timestamp, STORAGE_CONFIG.cache.maxAge)) {
            return caseData.data;
        }
        
        return null;
    } catch (error) {
        console.error('[Storage Manager] Error getting case data:', error);
        return null;
    }
}

/**
 * Saves case data to cache.
 * @param {string} caseId Case ID.
 * @param {object} data Case data to cache.
 * @returns {Promise<void>} Promise resolving when data is cached.
 */
export async function setCaseData(caseId, data) {
    try {
        const result = await getLocalData(STORAGE_CONFIG.keys.CASE_DATA_CACHE);
        const cache = result.caseDataCache || {};
        
        // Clean old entries if cache is too large
        const cacheKeys = Object.keys(cache);
        if (cacheKeys.length >= STORAGE_CONFIG.cache.maxSize) {
            // Remove oldest entries
            const sorted = cacheKeys
                .map(key => ({ key, timestamp: cache[key].timestamp }))
                .sort((a, b) => a.timestamp - b.timestamp);
            
            const toRemove = sorted.slice(0, Math.floor(STORAGE_CONFIG.cache.maxSize * 0.1));
            toRemove.forEach(({ key }) => delete cache[key]);
        }
        
        cache[caseId] = {
            data,
            timestamp: Date.now()
        };
        
        await setLocalData({ [STORAGE_CONFIG.keys.CASE_DATA_CACHE]: cache });
        console.log(`[Storage Manager] Cached data for case: ${caseId}`);
    } catch (error) {
        console.error('[Storage Manager] Error setting case data:', error);
        throw error;
    }
}

/**
 * Gets comment draft for a case.
 * @param {string} caseId Case ID.
 * @returns {Promise<string>} Promise resolving to comment draft.
 */
export async function getCommentDraft(caseId) {
    try {
        const result = await getLocalData(`comment_${caseId}`);
        return result[`comment_${caseId}`] || '';
    } catch (error) {
        console.error('[Storage Manager] Error getting comment draft:', error);
        return '';
    }
}

/**
 * Saves comment draft for a case.
 * @param {string} caseId Case ID.
 * @param {string} content Comment content.
 * @returns {Promise<void>} Promise resolving when draft is saved.
 */
export async function saveCommentDraft(caseId, content) {
    try {
        await setLocalData({ [`comment_${caseId}`]: content });
        console.log(`[Storage Manager] Saved comment draft for case: ${caseId}`);
    } catch (error) {
        console.error('[Storage Manager] Error saving comment draft:', error);
        throw error;
    }
}

/**
 * Gets scraped customer data.
 * @returns {Promise<Array>} Promise resolving to customer data array.
 */
export async function getCustomerData() {
    try {
        const result = await getLocalData(STORAGE_CONFIG.keys.SCRAPED_CUSTOMER_LIST);
        return result.scrapedCustomerList || [];
    } catch (error) {
        console.error('[Storage Manager] Error getting customer data:', error);
        return [];
    }
}

/**
 * Saves scraped customer data.
 * @param {Array} customerData Customer data array.
 * @returns {Promise<void>} Promise resolving when data is saved.
 */
export async function saveCustomerData(customerData) {
    try {
        await setLocalData({ [STORAGE_CONFIG.keys.SCRAPED_CUSTOMER_LIST]: customerData });
        console.log('[Storage Manager] Customer data saved successfully');
    } catch (error) {
        console.error('[Storage Manager] Error saving customer data:', error);
        throw error;
    }
}

/**
 * Clears expired cache entries.
 * @returns {Promise<void>} Promise resolving when cleanup is complete.
 */
export async function cleanupCache() {
    try {
        const result = await getLocalData(STORAGE_CONFIG.keys.CASE_DATA_CACHE);
        const cache = result.caseDataCache || {};
        
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of Object.entries(cache)) {
            if (!isDataFresh(entry.timestamp, STORAGE_CONFIG.cache.maxAge)) {
                delete cache[key];
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            await setLocalData({ [STORAGE_CONFIG.keys.CASE_DATA_CACHE]: cache });
            console.log(`[Storage Manager] Cleaned ${cleaned} expired cache entries`);
        }
        
        // Clear memory cache entries older than 5 minutes
        for (const [key, entry] of memoryCache.entries()) {
            if (now - entry.timestamp > 300000) { // 5 minutes
                memoryCache.delete(key);
            }
        }
        
    } catch (error) {
        console.error('[Storage Manager] Error during cache cleanup:', error);
    }
}

/**
 * Removes all stored data (for debugging/reset purposes).
 * @returns {Promise<void>} Promise resolving when all data is cleared.
 */
export async function clearAllData() {
    try {
        await Promise.all([
            chrome.storage.sync.clear(),
            chrome.storage.local.clear()
        ]);
        memoryCache.clear();
        console.log('[Storage Manager] All data cleared');
    } catch (error) {
        console.error('[Storage Manager] Error clearing data:', error);
        throw error;
    }
}

/**
 * Gets storage usage information.
 * @returns {Promise<object>} Promise resolving to usage information.
 */
export async function getStorageUsage() {
    try {
        const [syncUsage, localUsage] = await Promise.all([
            new Promise(resolve => chrome.storage.sync.getBytesInUse(resolve)),
            new Promise(resolve => chrome.storage.local.getBytesInUse(resolve))
        ]);
        
        return {
            sync: {
                used: syncUsage,
                quota: chrome.storage.sync.QUOTA_BYTES,
                percentUsed: Math.round((syncUsage / chrome.storage.sync.QUOTA_BYTES) * 100)
            },
            local: {
                used: localUsage,
                quota: chrome.storage.local.QUOTA_BYTES,
                percentUsed: Math.round((localUsage / chrome.storage.local.QUOTA_BYTES) * 100)
            },
            memoryCache: {
                entries: memoryCache.size
            }
        };
    } catch (error) {
        console.error('[Storage Manager] Error getting storage usage:', error);
        return null;
    }
}

/**
 * Checks if cached data is still fresh.
 * @param {number} timestamp Data timestamp.
 * @param {number} maxAge Maximum age in milliseconds.
 * @returns {boolean} True if data is fresh.
 */
function isDataFresh(timestamp, maxAge) {
    return Date.now() - timestamp < maxAge;
}

// Automatic cache cleanup every hour
setInterval(cleanupCache, 60 * 60 * 1000);