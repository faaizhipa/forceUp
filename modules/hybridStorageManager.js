/**
 * Hybrid Storage Manager Module
 * Provides unified storage API with local and cloud (OneDrive) backends
 * Features: Auto-routing, sync, conflict resolution, offline queue
 * @module hybridStorageManager
 */

const HybridStorageManager = (function() {
  'use strict';

  // ========== CONSTANTS ==========
  
  const STORAGE_MODE = {
    LOCAL: 'local',
    CLOUD: 'cloud',
    HYBRID: 'hybrid'  // Local with cloud backup
  };

  const SYNC_STATUS = {
    SYNCED: 'synced',
    PENDING: 'pending',
    CONFLICT: 'conflict',
    ERROR: 'error'
  };

  const STORAGE_KEYS = {
    MODE: 'exl_storage_mode',
    SYNC_QUEUE: 'exl_sync_queue',
    LAST_SYNC: 'exl_last_sync',
    CLOUD_ENABLED: 'exl_cloud_enabled'
  };

  // OneDrive AppFolder path
  const ONEDRIVE_APP_FOLDER = '/drive/special/approot:';
  const ONEDRIVE_API_BASE = 'https://graph.microsoft.com/v1.0/me';

  // Sync interval (5 minutes)
  const SYNC_INTERVAL = 5 * 60 * 1000;

  // Data categories that can be synced
  const SYNCABLE_PREFIXES = [
    'exl_highlights_',
    'exl_notes_',
    'exl_bookmark_collections',
    'exl_bookmarks'
  ];

  // ========== STATE ==========
  
  let isInitialized = false;
  let currentMode = STORAGE_MODE.LOCAL;
  let syncQueue = [];
  let lastSyncTime = null;
  let syncInterval = null;
  let isSyncing = false;
  let syncListeners = [];

  // ========== INITIALIZATION ==========

  /**
   * Initialize the hybrid storage manager
   */
  async function init() {
    if (isInitialized) return;

    console.log('[HybridStorageManager] Initializing...');

    // Load settings
    await loadSettings();

    // Initialize OneDrive auth if cloud is enabled
    if (currentMode !== STORAGE_MODE.LOCAL && typeof OneDriveAuth !== 'undefined') {
      await OneDriveAuth.init();
    }

    // Start sync interval if cloud enabled
    if (isCloudEnabled()) {
      startSyncInterval();
    }

    // Process any pending sync queue
    await processSyncQueue();

    isInitialized = true;
    console.log('[HybridStorageManager] Initialized with mode:', currentMode);
  }

  /**
   * Load settings from storage
   */
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        STORAGE_KEYS.MODE,
        STORAGE_KEYS.SYNC_QUEUE,
        STORAGE_KEYS.LAST_SYNC,
        STORAGE_KEYS.CLOUD_ENABLED
      ], (result) => {
        currentMode = result[STORAGE_KEYS.MODE] || STORAGE_MODE.LOCAL;
        syncQueue = result[STORAGE_KEYS.SYNC_QUEUE] || [];
        lastSyncTime = result[STORAGE_KEYS.LAST_SYNC] || null;
        resolve();
      });
    });
  }

  /**
   * Check if cloud storage is enabled
   */
  function isCloudEnabled() {
    return currentMode === STORAGE_MODE.CLOUD || currentMode === STORAGE_MODE.HYBRID;
  }

  /**
   * Start periodic sync interval
   */
  function startSyncInterval() {
    if (syncInterval) return;

    syncInterval = setInterval(async () => {
      if (!isSyncing && OneDriveAuth?.isAuthenticated()) {
        await sync();
      }
    }, SYNC_INTERVAL);
  }

  /**
   * Stop sync interval
   */
  function stopSyncInterval() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  }

  // ========== STORAGE API ==========

  /**
   * Get data from storage
   * @param {string|string[]} keys - Key(s) to retrieve
   * @returns {Promise<Object>} Retrieved data
   */
  async function get(keys) {
    const keyArray = Array.isArray(keys) ? keys : [keys];

    // Always read from local first (for performance)
    const localData = await getFromLocal(keyArray);

    // If cloud mode and authenticated, check for newer data
    if (currentMode === STORAGE_MODE.CLOUD && OneDriveAuth?.isAuthenticated()) {
      try {
        const cloudData = await getFromCloud(keyArray);
        
        // Merge with conflict resolution (cloud wins by default)
        return mergeData(localData, cloudData);
      } catch (error) {
        console.warn('[HybridStorageManager] Cloud read failed, using local:', error);
        return localData;
      }
    }

    return localData;
  }

  /**
   * Set data to storage
   * @param {Object} data - Data to store
   * @returns {Promise<void>}
   */
  async function set(data) {
    // Always write to local first
    await setToLocal(data);

    // If cloud enabled, queue for sync or sync immediately
    if (isCloudEnabled()) {
      const syncableKeys = Object.keys(data).filter(isSyncableKey);
      
      if (syncableKeys.length > 0) {
        if (OneDriveAuth?.isAuthenticated()) {
          // Sync immediately for responsive feel
          try {
            await setToCloud(filterKeys(data, syncableKeys));
          } catch (error) {
            console.warn('[HybridStorageManager] Cloud write failed, queuing:', error);
            queueForSync(syncableKeys, 'set', data);
          }
        } else {
          // Queue for later sync
          queueForSync(syncableKeys, 'set', data);
        }
      }
    }
  }

  /**
   * Remove data from storage
   * @param {string|string[]} keys - Key(s) to remove
   * @returns {Promise<void>}
   */
  async function remove(keys) {
    const keyArray = Array.isArray(keys) ? keys : [keys];

    // Remove from local
    await removeFromLocal(keyArray);

    // If cloud enabled, also remove from cloud
    if (isCloudEnabled()) {
      const syncableKeys = keyArray.filter(isSyncableKey);
      
      if (syncableKeys.length > 0) {
        if (OneDriveAuth?.isAuthenticated()) {
          try {
            await removeFromCloud(syncableKeys);
          } catch (error) {
            console.warn('[HybridStorageManager] Cloud remove failed, queuing:', error);
            queueForSync(syncableKeys, 'remove', null);
          }
        } else {
          queueForSync(syncableKeys, 'remove', null);
        }
      }
    }
  }

  // ========== LOCAL STORAGE ==========

  /**
   * Get from local storage
   */
  async function getFromLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  }

  /**
   * Set to local storage
   */
  async function setToLocal(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => {
        resolve();
      });
    });
  }

  /**
   * Remove from local storage
   */
  async function removeFromLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, () => {
        resolve();
      });
    });
  }

  // ========== CLOUD STORAGE (OneDrive) ==========

  /**
   * Get from OneDrive cloud storage
   */
  async function getFromCloud(keys) {
    const result = {};
    const accessToken = await OneDriveAuth.getAccessToken();

    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    for (const key of keys) {
      try {
        const fileName = encodeURIComponent(sanitizeFileName(key) + '.json');
        const response = await fetch(
          `${ONEDRIVE_API_BASE}${ONEDRIVE_APP_FOLDER}/${fileName}:/content`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );

        if (response.ok) {
          result[key] = await response.json();
        }
      } catch (error) {
        console.debug('[HybridStorageManager] Key not found in cloud:', key);
      }
    }

    return result;
  }

  /**
   * Set to OneDrive cloud storage
   */
  async function setToCloud(data) {
    const accessToken = await OneDriveAuth.getAccessToken();

    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    for (const [key, value] of Object.entries(data)) {
      const fileName = encodeURIComponent(sanitizeFileName(key) + '.json');
      const content = JSON.stringify(value, null, 2);

      const response = await fetch(
        `${ONEDRIVE_API_BASE}${ONEDRIVE_APP_FOLDER}/${fileName}:/content`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: content
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to upload ${key}: ${response.status}`);
      }
    }
  }

  /**
   * Remove from OneDrive cloud storage
   */
  async function removeFromCloud(keys) {
    const accessToken = await OneDriveAuth.getAccessToken();

    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    for (const key of keys) {
      const fileName = encodeURIComponent(sanitizeFileName(key) + '.json');

      try {
        await fetch(
          `${ONEDRIVE_API_BASE}${ONEDRIVE_APP_FOLDER}/${fileName}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );
      } catch (error) {
        console.debug('[HybridStorageManager] File not found for deletion:', key);
      }
    }
  }

  // ========== SYNC OPERATIONS ==========

  /**
   * Perform full sync between local and cloud
   */
  async function sync() {
    if (isSyncing || !OneDriveAuth?.isAuthenticated()) {
      return false;
    }

    isSyncing = true;
    notifyListeners('sync_start');
    console.log('[HybridStorageManager] Starting sync...');

    try {
      // Process pending queue first
      await processSyncQueue();

      // Get all syncable local data
      const localData = await getFromLocal(null);
      const syncableLocalData = {};

      Object.keys(localData).forEach(key => {
        if (isSyncableKey(key)) {
          syncableLocalData[key] = localData[key];
        }
      });

      // Upload to cloud
      if (Object.keys(syncableLocalData).length > 0) {
        await setToCloud(syncableLocalData);
      }

      lastSyncTime = Date.now();
      await chrome.storage.local.set({ [STORAGE_KEYS.LAST_SYNC]: lastSyncTime });

      console.log('[HybridStorageManager] Sync completed');
      notifyListeners('sync_complete', { timestamp: lastSyncTime });
      return true;

    } catch (error) {
      console.error('[HybridStorageManager] Sync failed:', error);
      notifyListeners('sync_error', { error: error.message });
      return false;

    } finally {
      isSyncing = false;
    }
  }

  /**
   * Queue an operation for later sync
   */
  function queueForSync(keys, operation, data) {
    const queueItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      keys,
      operation,
      data: operation === 'set' ? filterKeys(data, keys) : null,
      timestamp: Date.now()
    };

    syncQueue.push(queueItem);
    chrome.storage.local.set({ [STORAGE_KEYS.SYNC_QUEUE]: syncQueue });
    console.log('[HybridStorageManager] Queued for sync:', queueItem.id);
  }

  /**
   * Process pending sync queue
   */
  async function processSyncQueue() {
    if (syncQueue.length === 0 || !OneDriveAuth?.isAuthenticated()) {
      return;
    }

    console.log('[HybridStorageManager] Processing sync queue:', syncQueue.length, 'items');

    const processedIds = [];

    for (const item of syncQueue) {
      try {
        if (item.operation === 'set') {
          await setToCloud(item.data);
        } else if (item.operation === 'remove') {
          await removeFromCloud(item.keys);
        }
        processedIds.push(item.id);
      } catch (error) {
        console.warn('[HybridStorageManager] Failed to process queue item:', item.id, error);
      }
    }

    // Remove processed items from queue
    syncQueue = syncQueue.filter(item => !processedIds.includes(item.id));
    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_QUEUE]: syncQueue });

    console.log('[HybridStorageManager] Processed', processedIds.length, 'queue items');
  }

  // ========== MIGRATION ==========

  /**
   * Migrate local data to cloud
   * @param {Function} progressCallback - Progress callback (0-100)
   * @returns {Promise<{success: boolean, migrated: number}>}
   */
  async function migrateToCloud(progressCallback) {
    if (!OneDriveAuth?.isAuthenticated()) {
      throw new Error('Not authenticated to OneDrive');
    }

    console.log('[HybridStorageManager] Starting migration to cloud...');

    try {
      // Get all local data
      const localData = await getFromLocal(null);
      const syncableKeys = Object.keys(localData).filter(isSyncableKey);
      const totalKeys = syncableKeys.length;
      let migratedCount = 0;

      for (let i = 0; i < syncableKeys.length; i++) {
        const key = syncableKeys[i];
        
        try {
          await setToCloud({ [key]: localData[key] });
          migratedCount++;
        } catch (error) {
          console.warn('[HybridStorageManager] Failed to migrate key:', key, error);
        }

        if (progressCallback) {
          progressCallback(Math.round(((i + 1) / totalKeys) * 100));
        }
      }

      console.log('[HybridStorageManager] Migration completed:', migratedCount, 'keys');

      return { success: true, migrated: migratedCount };

    } catch (error) {
      console.error('[HybridStorageManager] Migration failed:', error);
      return { success: false, migrated: 0, error: error.message };
    }
  }

  /**
   * Download all data from cloud
   * @returns {Promise<Object>} Downloaded data
   */
  async function downloadFromCloud() {
    if (!OneDriveAuth?.isAuthenticated()) {
      throw new Error('Not authenticated to OneDrive');
    }

    const accessToken = await OneDriveAuth.getAccessToken();

    // List all files in app folder
    const response = await fetch(
      `${ONEDRIVE_API_BASE}${ONEDRIVE_APP_FOLDER}:/children`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to list cloud files');
    }

    const result = await response.json();
    const files = result.value || [];
    const downloadedData = {};

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        try {
          const contentResponse = await fetch(
            file['@microsoft.graph.downloadUrl'],
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );

          if (contentResponse.ok) {
            const key = file.name.replace('.json', '');
            downloadedData[decodeURIComponent(key)] = await contentResponse.json();
          }
        } catch (error) {
          console.warn('[HybridStorageManager] Failed to download:', file.name, error);
        }
      }
    }

    return downloadedData;
  }

  // ========== SETTINGS ==========

  /**
   * Set storage mode
   * @param {string} mode - STORAGE_MODE value
   */
  async function setStorageMode(mode) {
    if (!Object.values(STORAGE_MODE).includes(mode)) {
      throw new Error('Invalid storage mode');
    }

    currentMode = mode;
    await chrome.storage.local.set({ [STORAGE_KEYS.MODE]: mode });

    if (isCloudEnabled()) {
      startSyncInterval();
    } else {
      stopSyncInterval();
    }

    console.log('[HybridStorageManager] Storage mode set to:', mode);
  }

  /**
   * Get current storage mode
   */
  function getStorageMode() {
    return currentMode;
  }

  // ========== LISTENERS ==========

  /**
   * Add sync event listener
   */
  function addSyncListener(callback) {
    syncListeners.push(callback);
    return () => {
      syncListeners = syncListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners
   */
  function notifyListeners(event, data = {}) {
    syncListeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (error) {
        console.error('[HybridStorageManager] Listener error:', error);
      }
    });
  }

  // ========== HELPERS ==========

  /**
   * Check if a key should be synced
   */
  function isSyncableKey(key) {
    return SYNCABLE_PREFIXES.some(prefix => key.startsWith(prefix));
  }

  /**
   * Filter object to only include specified keys
   */
  function filterKeys(obj, keys) {
    const result = {};
    keys.forEach(key => {
      if (obj.hasOwnProperty(key)) {
        result[key] = obj[key];
      }
    });
    return result;
  }

  /**
   * Sanitize filename for OneDrive
   */
  function sanitizeFileName(name) {
    // Replace characters not allowed in OneDrive filenames
    return name.replace(/[<>:"/\\|?*]/g, '_');
  }

  /**
   * Merge local and cloud data (cloud wins for conflicts)
   */
  function mergeData(localData, cloudData) {
    const merged = { ...localData };

    for (const [key, cloudValue] of Object.entries(cloudData)) {
      // Cloud value takes precedence
      merged[key] = cloudValue;
    }

    return merged;
  }

  /**
   * Get sync status
   */
  function getSyncStatus() {
    return {
      mode: currentMode,
      lastSync: lastSyncTime,
      queueLength: syncQueue.length,
      isSyncing: isSyncing,
      isAuthenticated: OneDriveAuth?.isAuthenticated() || false
    };
  }

  // ========== PUBLIC API ==========

  return {
    init,
    get,
    set,
    remove,
    sync,
    migrateToCloud,
    downloadFromCloud,
    setStorageMode,
    getStorageMode,
    getSyncStatus,
    addSyncListener,
    STORAGE_MODE,
    SYNC_STATUS
  };

})();

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HybridStorageManager;
}

