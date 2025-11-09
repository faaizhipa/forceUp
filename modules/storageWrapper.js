/**
 * Storage Wrapper Module
 * Provides Promise-based wrappers for Chrome storage operations
 *
 * @module storageWrapper
 */

const StorageWrapper = (() => {
    'use strict';

    /**
     * Gets data from chrome.storage.local
     * @param {string|string[]|Object} keys - Storage keys to retrieve
     * @returns {Promise<Object>} Retrieved data
     */
    async function getLocal(keys) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(keys, (result) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(result);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Sets data in chrome.storage.local
     * @param {Object} items - Key-value pairs to store
     * @returns {Promise<void>}
     */
    async function setLocal(items) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set(items, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Removes data from chrome.storage.local
     * @param {string|string[]} keys - Keys to remove
     * @returns {Promise<void>}
     */
    async function removeLocal(keys) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.remove(keys, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Clears all data from chrome.storage.local
     * @returns {Promise<void>}
     */
    async function clearLocal() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.clear(() => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Gets data from chrome.storage.sync
     * @param {string|string[]|Object} keys - Storage keys to retrieve
     * @returns {Promise<Object>} Retrieved data
     */
    async function getSync(keys) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.get(keys, (result) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(result);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Sets data in chrome.storage.sync
     * @param {Object} items - Key-value pairs to store
     * @returns {Promise<void>}
     */
    async function setSync(items) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.set(items, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Removes data from chrome.storage.sync
     * @param {string|string[]} keys - Keys to remove
     * @returns {Promise<void>}
     */
    async function removeSync(keys) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.remove(keys, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Clears all data from chrome.storage.sync
     * @returns {Promise<void>}
     */
    async function clearSync() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.clear(() => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Public API
    return {
        // Local storage
        getLocal,
        setLocal,
        removeLocal,
        clearLocal,
        // Sync storage
        getSync,
        setSync,
        removeSync,
        clearSync
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageWrapper;
}
