/**
 * Data Migration Module
 * Handles migration of highlighter data across storage version changes
 * @module dataMigration
 */

const DataMigration = (function() {
  'use strict';

  const BACKUP_PREFIX = 'exl_highlighter_backup_';
  const MAX_BACKUPS = 5;
  const STORAGE_QUOTA_WARNING_THRESHOLD = 0.8; // 80% of quota

  /**
   * Find all old-format storage keys (without version)
   * @param {string} prefix - Storage key prefix to search for
   * @returns {Promise<Array<string>>} Array of old-format keys
   */
  async function findOldFormatKeys(prefix) {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError) {
          console.error('[DataMigration] Error finding old keys:', chrome.runtime.lastError);
          resolve([]);
          return;
        }

        const oldKeys = Object.keys(items).filter(key => {
          // Match keys with prefix but without version (v1, v2, etc.)
          if (!key.startsWith(prefix)) return false;
          // Check if key doesn't have version pattern (v1_, v2_, etc.)
          const versionPattern = /v\d+_/;
          return !versionPattern.test(key.substring(prefix.length));
        });

        resolve(oldKeys);
      });
    });
  }

  /**
   * Convert old storage key to new format with version
   * @param {string} oldKey - Old storage key
   * @param {number} version - New version number
   * @param {string} prefix - Storage prefix
   * @returns {string} New storage key
   */
  function convertKeyToNewFormat(oldKey, version, prefix) {
    // Extract the part after prefix
    const suffix = oldKey.substring(prefix.length);
    return `${prefix}v${version}_${suffix}`;
  }

  /**
   * Migrate highlights from old format to new format
   * @param {number} oldVersion - Old version (0 means no version)
   * @param {number} newVersion - New version
   * @returns {Promise<boolean>} Success status
   */
  async function migrateHighlights(oldVersion, newVersion) {
    try {
      console.log('[DataMigration] Migrating highlights from version', oldVersion, 'to', newVersion);

      const prefix = 'exl_highlights_';
      const oldKeys = await findOldFormatKeys(prefix);

      if (oldKeys.length === 0) {
        console.log('[DataMigration] No old highlight keys found');
        return true;
      }

      console.log('[DataMigration] Found', oldKeys.length, 'old highlight keys to migrate');

      // Load all old data
      const oldData = await new Promise((resolve) => {
        chrome.storage.local.get(oldKeys, (result) => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error loading old highlights:', chrome.runtime.lastError);
            resolve({});
            return;
          }
          resolve(result);
        });
      });

      // Create new keys and data
      const newData = {};
      for (const oldKey of oldKeys) {
        const newKey = convertKeyToNewFormat(oldKey, newVersion, prefix);
        newData[newKey] = oldData[oldKey];
      }

      // Save new format data
      await new Promise((resolve) => {
        chrome.storage.local.set(newData, () => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error saving migrated highlights:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          console.log('[DataMigration] Migrated', Object.keys(newData).length, 'highlight keys');
          resolve(true);
        });
      });

      // Remove old keys only after successful save
      await new Promise((resolve) => {
        chrome.storage.local.remove(oldKeys, () => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error removing old highlight keys:', chrome.runtime.lastError);
          } else {
            console.log('[DataMigration] Removed', oldKeys.length, 'old highlight keys');
          }
          resolve();
        });
      });

      return true;
    } catch (error) {
      console.error('[DataMigration] Error migrating highlights:', error);
      return false;
    }
  }

  /**
   * Migrate notes from old format to new format
   * @param {number} oldVersion - Old version (0 means no version)
   * @param {number} newVersion - New version
   * @returns {Promise<boolean>} Success status
   */
  async function migrateNotes(oldVersion, newVersion) {
    try {
      console.log('[DataMigration] Migrating notes from version', oldVersion, 'to', newVersion);

      const prefix = 'exl_notes_';
      const oldKeys = await findOldFormatKeys(prefix);

      if (oldKeys.length === 0) {
        console.log('[DataMigration] No old note keys found');
        return true;
      }

      console.log('[DataMigration] Found', oldKeys.length, 'old note keys to migrate');

      // Load all old data
      const oldData = await new Promise((resolve) => {
        chrome.storage.local.get(oldKeys, (result) => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error loading old notes:', chrome.runtime.lastError);
            resolve({});
            return;
          }
          resolve(result);
        });
      });

      // Create new keys and data
      const newData = {};
      for (const oldKey of oldKeys) {
        const newKey = convertKeyToNewFormat(oldKey, newVersion, prefix);
        newData[newKey] = oldData[oldKey];
      }

      // Save new format data
      await new Promise((resolve) => {
        chrome.storage.local.set(newData, () => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error saving migrated notes:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          console.log('[DataMigration] Migrated', Object.keys(newData).length, 'note keys');
          resolve(true);
        });
      });

      // Remove old keys only after successful save
      await new Promise((resolve) => {
        chrome.storage.local.remove(oldKeys, () => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error removing old note keys:', chrome.runtime.lastError);
          } else {
            console.log('[DataMigration] Removed', oldKeys.length, 'old note keys');
          }
          resolve();
        });
      });

      return true;
    } catch (error) {
      console.error('[DataMigration] Error migrating notes:', error);
      return false;
    }
  }

  /**
   * Migrate bookmarks from old format to new format
   * @param {number} oldVersion - Old version (0 means no version)
   * @param {number} newVersion - New version
   * @returns {Promise<boolean>} Success status
   */
  async function migrateBookmarks(oldVersion, newVersion) {
    try {
      console.log('[DataMigration] Migrating bookmarks from version', oldVersion, 'to', newVersion);

      const oldCollectionKey = 'exl_bookmark_collections';
      const oldBookmarkKey = 'exl_bookmarks';
      const newCollectionKey = `${oldCollectionKey}_v${newVersion}`;
      const newBookmarkKey = `${oldBookmarkKey}_v${newVersion}`;

      // Load old data
      const oldData = await new Promise((resolve) => {
        chrome.storage.local.get([oldCollectionKey, oldBookmarkKey], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error loading old bookmarks:', chrome.runtime.lastError);
            resolve({});
            return;
          }
          resolve(result);
        });
      });

      const hasOldData = oldData[oldCollectionKey] || oldData[oldBookmarkKey];
      if (!hasOldData) {
        console.log('[DataMigration] No old bookmark data found');
        return true;
      }

      // Create new format data
      const newData = {};
      if (oldData[oldCollectionKey]) {
        newData[newCollectionKey] = oldData[oldCollectionKey];
      }
      if (oldData[oldBookmarkKey]) {
        newData[newBookmarkKey] = oldData[oldBookmarkKey];
      }

      // Save new format data
      await new Promise((resolve) => {
        chrome.storage.local.set(newData, () => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error saving migrated bookmarks:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          console.log('[DataMigration] Migrated bookmark data');
          resolve(true);
        });
      });

      // Remove old keys only after successful save
      const keysToRemove = [];
      if (oldData[oldCollectionKey]) keysToRemove.push(oldCollectionKey);
      if (oldData[oldBookmarkKey]) keysToRemove.push(oldBookmarkKey);

      if (keysToRemove.length > 0) {
        await new Promise((resolve) => {
          chrome.storage.local.remove(keysToRemove, () => {
            if (chrome.runtime.lastError) {
              console.error('[DataMigration] Error removing old bookmark keys:', chrome.runtime.lastError);
            } else {
              console.log('[DataMigration] Removed old bookmark keys');
            }
            resolve();
          });
        });
      }

      return true;
    } catch (error) {
      console.error('[DataMigration] Error migrating bookmarks:', error);
      return false;
    }
  }

  /**
   * Find all old-format data across all types
   * @returns {Promise<Object>} Object with arrays of old keys by type
   */
  async function findOldData() {
    const highlights = await findOldFormatKeys('exl_highlights_');
    const notes = await findOldFormatKeys('exl_notes_');
    
    // Check for old bookmark keys
    const bookmarkData = await new Promise((resolve) => {
      chrome.storage.local.get(['exl_bookmark_collections', 'exl_bookmarks'], (result) => {
        resolve(result);
      });
    });
    const bookmarks = [];
    if (bookmarkData['exl_bookmark_collections']) bookmarks.push('exl_bookmark_collections');
    if (bookmarkData['exl_bookmarks']) bookmarks.push('exl_bookmarks');

    return {
      highlights,
      notes,
      bookmarks
    };
  }

  /**
   * Create backup of all highlighter data
   * @returns {Promise<string>} Backup key
   */
  async function createBackup() {
    try {
      console.log('[DataMigration] Creating backup...');

      // Get all highlighter-related data
      const allData = await new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error loading data for backup:', chrome.runtime.lastError);
            resolve({});
            return;
          }
          resolve(items);
        });
      });

      // Filter to only highlighter-related keys
      const backupData = {};
      const prefixes = ['exl_highlights_', 'exl_notes_', 'exl_bookmark_'];
      for (const key in allData) {
        if (prefixes.some(prefix => key.startsWith(prefix))) {
          backupData[key] = allData[key];
        }
      }

      const backup = {
        timestamp: Date.now(),
        version: 1,
        data: backupData
      };

      const backupKey = `${BACKUP_PREFIX}${backup.timestamp}`;
      
      await new Promise((resolve) => {
        chrome.storage.local.set({ [backupKey]: backup }, () => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error creating backup:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          console.log('[DataMigration] Backup created:', backupKey);
          resolve(true);
        });
      });

      return backupKey;
    } catch (error) {
      console.error('[DataMigration] Error creating backup:', error);
      return null;
    }
  }

  /**
   * Export all highlighter data to JSON
   * @returns {Promise<Object>} Exported data
   */
  async function exportAllData() {
    try {
      const allData = await new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error loading data for export:', chrome.runtime.lastError);
            resolve({});
            return;
          }
          resolve(items);
        });
      });

      // Filter to only highlighter-related keys
      const exportData = {};
      const prefixes = ['exl_highlights_', 'exl_notes_', 'exl_bookmark_'];
      for (const key in allData) {
        if (prefixes.some(prefix => key.startsWith(prefix))) {
          exportData[key] = allData[key];
        }
      }

      return {
        timestamp: Date.now(),
        version: 1,
        data: exportData
      };
    } catch (error) {
      console.error('[DataMigration] Error exporting data:', error);
      return null;
    }
  }

  /**
   * Import data from JSON backup
   * @param {Object} data - Data to import
   * @returns {Promise<boolean>} Success status
   */
  async function importAllData(data) {
    try {
      if (!data || !data.data) {
        console.error('[DataMigration] Invalid import data format');
        return false;
      }

      console.log('[DataMigration] Importing data...');

      await new Promise((resolve) => {
        chrome.storage.local.set(data.data, () => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error importing data:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          console.log('[DataMigration] Imported', Object.keys(data.data).length, 'keys');
          resolve(true);
        });
      });

      return true;
    } catch (error) {
      console.error('[DataMigration] Error importing data:', error);
      return false;
    }
  }

  /**
   * Cleanup old version data after successful migration
   * @returns {Promise<void>}
   */
  async function cleanupOldVersions() {
    try {
      const oldData = await findOldData();
      const allOldKeys = [
        ...oldData.highlights,
        ...oldData.notes,
        ...oldData.bookmarks
      ];

      if (allOldKeys.length === 0) {
        return;
      }

      console.log('[DataMigration] Cleaning up', allOldKeys.length, 'old version keys');

      await new Promise((resolve) => {
        chrome.storage.local.remove(allOldKeys, () => {
          if (chrome.runtime.lastError) {
            console.error('[DataMigration] Error cleaning up old versions:', chrome.runtime.lastError);
          } else {
            console.log('[DataMigration] Cleaned up old version keys');
          }
          resolve();
        });
      });
    } catch (error) {
      console.error('[DataMigration] Error cleaning up old versions:', error);
    }
  }

  /**
   * Cleanup old backups, keeping only the last MAX_BACKUPS
   * @returns {Promise<void>}
   */
  async function cleanupOldBackups() {
    try {
      const allData = await new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          resolve(items || {});
        });
      });

      // Find all backup keys
      const backupKeys = Object.keys(allData)
        .filter(key => key.startsWith(BACKUP_PREFIX))
        .map(key => ({
          key,
          timestamp: parseInt(key.substring(BACKUP_PREFIX.length)) || 0
        }))
        .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp, newest first

      // Keep only the last MAX_BACKUPS
      if (backupKeys.length > MAX_BACKUPS) {
        const keysToRemove = backupKeys.slice(MAX_BACKUPS).map(b => b.key);
        console.log('[DataMigration] Removing', keysToRemove.length, 'old backups');

        await new Promise((resolve) => {
          chrome.storage.local.remove(keysToRemove, () => {
            if (chrome.runtime.lastError) {
              console.error('[DataMigration] Error cleaning up old backups:', chrome.runtime.lastError);
            } else {
              console.log('[DataMigration] Cleaned up old backups');
            }
            resolve();
          });
        });
      }
    } catch (error) {
      console.error('[DataMigration] Error cleaning up old backups:', error);
    }
  }

  /**
   * Check storage quota and warn if approaching limit
   * @returns {Promise<Object>} Quota information
   */
  async function checkStorageQuota() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        if (chrome.runtime.lastError) {
          console.error('[DataMigration] Error checking storage quota:', chrome.runtime.lastError);
          resolve({ bytesInUse: 0, quota: 0, percentage: 0, warning: false });
          return;
        }

        // Chrome storage.local quota is typically 10MB (10,485,760 bytes)
        const quota = chrome.storage.local.QUOTA_BYTES || 10485760;
        const percentage = bytesInUse / quota;
        const warning = percentage >= STORAGE_QUOTA_WARNING_THRESHOLD;

        if (warning) {
          console.warn('[DataMigration] Storage quota warning:', 
            `${(percentage * 100).toFixed(1)}% used (${(bytesInUse / 1024 / 1024).toFixed(2)}MB / ${(quota / 1024 / 1024).toFixed(2)}MB)`);
        }

        resolve({
          bytesInUse,
          quota,
          percentage,
          warning
        });
      });
    });
  }

  /**
   * Run all migrations
   * @returns {Promise<boolean>} Success status
   */
  async function migrateAll() {
    try {
      console.log('[DataMigration] Starting migration...');

      // Check for old data first
      const oldData = await findOldData();
      const hasOldData = oldData.highlights.length > 0 || 
                        oldData.notes.length > 0 || 
                        oldData.bookmarks.length > 0;

      if (!hasOldData) {
        console.log('[DataMigration] No old data found, migration not needed');
        return true;
      }

      // Create backup before migration
      await createBackup();

      // Run migrations
      const highlightSuccess = await migrateHighlights(0, 1);
      const noteSuccess = await migrateNotes(0, 1);
      const bookmarkSuccess = await migrateBookmarks(0, 1);

      const allSuccess = highlightSuccess && noteSuccess && bookmarkSuccess;

      if (allSuccess) {
        // Cleanup old versions after successful migration
        await cleanupOldVersions();
      }

      // Always cleanup old backups
      await cleanupOldBackups();

      // Check storage quota
      await checkStorageQuota();

      console.log('[DataMigration] Migration completed:', allSuccess ? 'success' : 'partial');
      return allSuccess;
    } catch (error) {
      console.error('[DataMigration] Error during migration:', error);
      return false;
    }
  }

  return {
    migrateAll,
    migrateHighlights,
    migrateNotes,
    migrateBookmarks,
    findOldData,
    createBackup,
    exportAllData,
    importAllData,
    cleanupOldVersions,
    cleanupOldBackups,
    checkStorageQuota
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataMigration;
}

