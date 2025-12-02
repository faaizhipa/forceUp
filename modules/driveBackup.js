/**
 * Google Drive AppData Backup Module
 * Handles backup/restore of extension settings to Google Drive's AppData space
 * 
 * IMPORTANT: To enable Google Drive backup, you must:
 * 1. Create a Google Cloud project and enable the Drive API
 * 2. Create OAuth2 credentials (Chrome extension type)
 * 3. Update manifest.json with your client_id in the oauth2 section
 * 
 * @module driveBackup
 */

const DriveBackup = (function() {
  'use strict';

  // ========== CONSTANTS ==========
  
  // Google Drive API endpoints
  const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
  const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
  
  // Backup file configuration
  const BACKUP_FILE_NAME = 'penang-coe-salesforce-backup.json';
  const BACKUP_VERSION = 1;
  
  // Storage keys
  const STORAGE_KEYS = {
    BACKUP_FILE_ID: 'exl_gdrive_backup_file_id',
    LAST_BACKUP_TIME: 'exl_gdrive_last_backup',
    LAST_RESTORE_TIME: 'exl_gdrive_last_restore'
  };

  // ========== STATE ==========
  
  let cachedFileId = null;

  // ========== CONFIGURATION CHECK ==========

  /**
   * Check if Google Drive backup is properly configured
   * @returns {boolean} True if configured, false otherwise
   */
  function isConfigured() {
    try {
      const manifest = chrome.runtime.getManifest();
      const oauth2 = manifest.oauth2;
      
      if (!oauth2 || !oauth2.client_id) {
        return false;
      }
      
      // Check for placeholder value
      if (oauth2.client_id.includes('YOUR_GOOGLE_CLOUD_CLIENT_ID')) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn('[DriveBackup] Error checking configuration:', error);
      return false;
    }
  }

  // ========== AUTHENTICATION ==========

  /**
   * Get OAuth access token using Chrome's identity API
   * @param {boolean} interactive - Whether to show auth UI if needed
   * @returns {Promise<string>} Access token
   */
  async function getAccessToken(interactive = false) {
    // Check configuration first
    if (!isConfigured()) {
      throw new Error('Google Drive backup not configured. Please update manifest.json with a valid OAuth2 client_id.');
    }

    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('[DriveBackup] Auth error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!token) {
          reject(new Error('No access token received'));
          return;
        }
        resolve(token);
      });
    });
  }

  /**
   * Revoke the current access token (for logout)
   * @returns {Promise<void>}
   */
  async function revokeToken() {
    try {
      const token = await getAccessToken(false);
      if (token) {
        await new Promise((resolve) => {
          chrome.identity.removeCachedAuthToken({ token }, resolve);
        });
        console.log('[DriveBackup] Token revoked');
      }
    } catch (error) {
      console.warn('[DriveBackup] Error revoking token:', error);
    }
  }

  // ========== FILE OPERATIONS ==========

  /**
   * Search for the backup file in AppData folder
   * @param {string} token - Access token
   * @returns {Promise<string|null>} File ID if found, null otherwise
   */
  async function findBackupFile(token) {
    // Check cached file ID first
    if (cachedFileId) {
      return cachedFileId;
    }

    // Check storage for cached file ID
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.BACKUP_FILE_ID], (result) => {
        resolve(result[STORAGE_KEYS.BACKUP_FILE_ID] || null);
      });
    });

    if (stored) {
      // Verify the file still exists
      try {
        const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${stored}?fields=id,name`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          cachedFileId = stored;
          return stored;
        }
      } catch (error) {
        console.warn('[DriveBackup] Stored file ID invalid, searching...');
      }
    }

    // Search for the file
    const query = `name='${BACKUP_FILE_NAME}' and trashed=false`;
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q: query,
      fields: 'files(id,name,modifiedTime)'
    });

    try {
      const response = await fetch(`${DRIVE_FILES_ENDPOINT}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[DriveBackup] Search error:', errorData);
        return null;
      }

      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        const fileId = data.files[0].id;
        cachedFileId = fileId;
        await chrome.storage.local.set({ [STORAGE_KEYS.BACKUP_FILE_ID]: fileId });
        console.log('[DriveBackup] Found backup file:', fileId);
        return fileId;
      }

      console.log('[DriveBackup] No backup file found');
      return null;

    } catch (error) {
      console.error('[DriveBackup] Search error:', error);
      return null;
    }
  }

  /**
   * Create a new backup file in AppData folder
   * @param {string} token - Access token
   * @param {Object} backupData - Data to backup
   * @returns {Promise<string>} New file ID
   */
  async function createBackupFile(token, backupData) {
    const metadata = {
      name: BACKUP_FILE_NAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }));

    const response = await fetch(`${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Create failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    cachedFileId = data.id;
    await chrome.storage.local.set({ [STORAGE_KEYS.BACKUP_FILE_ID]: data.id });
    
    console.log('[DriveBackup] Created backup file:', data.id);
    return data.id;
  }

  /**
   * Update existing backup file
   * @param {string} token - Access token
   * @param {string} fileId - File ID to update
   * @param {Object} backupData - Data to backup
   * @returns {Promise<void>}
   */
  async function updateBackupFile(token, fileId, backupData) {
    const metadata = {
      name: BACKUP_FILE_NAME,
      mimeType: 'application/json'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }));

    const response = await fetch(`${DRIVE_UPLOAD_ENDPOINT}/${fileId}?uploadType=multipart`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Update failed: ${errorData.error?.message || response.statusText}`);
    }

    console.log('[DriveBackup] Updated backup file:', fileId);
  }

  /**
   * Download backup file content
   * @param {string} token - Access token
   * @param {string} fileId - File ID to download
   * @returns {Promise<Object>} Backup data
   */
  async function downloadBackupFile(token, fileId) {
    const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Download failed: ${errorData}`);
    }

    return await response.json();
  }

  // ========== BACKUP/RESTORE ==========

  /**
   * Build backup payload from current settings
   * @returns {Promise<Object>} Backup payload
   */
  async function buildBackupPayload() {
    // Get sync storage (user settings)
    const syncData = await new Promise((resolve) => {
      chrome.storage.sync.get(null, (data) => {
        resolve(data || {});
      });
    });

    // Get relevant local storage data
    const localData = await new Promise((resolve) => {
      chrome.storage.local.get([
        'exl_bannerMessages',
        'exl_hl_banner_whitelist',
        'exl_unknown_customers'
      ], (data) => {
        resolve(data || {});
      });
    });

    return {
      version: BACKUP_VERSION,
      created_at: new Date().toISOString(),
      extension_version: chrome.runtime.getManifest().version,
      sync_settings: syncData,
      local_settings: localData
    };
  }

  /**
   * Backup settings to Google Drive
   * @param {boolean} interactive - Whether to show auth UI if needed
   * @returns {Promise<Object>} Backup result { success, fileId, timestamp }
   */
  async function backup(interactive = true) {
    console.log('[DriveBackup] Starting backup...');

    try {
      const token = await getAccessToken(interactive);
      const backupData = await buildBackupPayload();
      
      // Check if file exists
      const fileId = await findBackupFile(token);
      
      if (fileId) {
        // Update existing file
        await updateBackupFile(token, fileId, backupData);
      } else {
        // Create new file
        await createBackupFile(token, backupData);
      }

      const timestamp = new Date().toISOString();
      await chrome.storage.local.set({ [STORAGE_KEYS.LAST_BACKUP_TIME]: timestamp });

      console.log('[DriveBackup] Backup completed successfully');
      return {
        success: true,
        fileId: cachedFileId,
        timestamp
      };

    } catch (error) {
      console.error('[DriveBackup] Backup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restore settings from Google Drive
   * @param {boolean} interactive - Whether to show auth UI if needed
   * @returns {Promise<Object>} Restore result { success, data, timestamp }
   */
  async function restore(interactive = true) {
    console.log('[DriveBackup] Starting restore...');

    try {
      const token = await getAccessToken(interactive);
      const fileId = await findBackupFile(token);

      if (!fileId) {
        return {
          success: false,
          error: 'No backup found'
        };
      }

      const backupData = await downloadBackupFile(token, fileId);

      // Validate backup version
      if (!backupData.version || backupData.version > BACKUP_VERSION) {
        return {
          success: false,
          error: 'Incompatible backup version'
        };
      }

      // Restore sync settings
      if (backupData.sync_settings && Object.keys(backupData.sync_settings).length > 0) {
        await new Promise((resolve, reject) => {
          chrome.storage.sync.set(backupData.sync_settings, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }

      // Restore local settings
      if (backupData.local_settings && Object.keys(backupData.local_settings).length > 0) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set(backupData.local_settings, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }

      const timestamp = new Date().toISOString();
      await chrome.storage.local.set({ [STORAGE_KEYS.LAST_RESTORE_TIME]: timestamp });

      console.log('[DriveBackup] Restore completed successfully');
      return {
        success: true,
        data: backupData,
        timestamp
      };

    } catch (error) {
      console.error('[DriveBackup] Restore failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if a backup exists
   * @param {boolean} interactive - Whether to show auth UI if needed
   * @returns {Promise<Object>} Check result { exists, modifiedTime }
   */
  async function checkBackup(interactive = false) {
    try {
      const token = await getAccessToken(interactive);
      const fileId = await findBackupFile(token);

      if (!fileId) {
        return { exists: false };
      }

      // Get file metadata
      const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}?fields=id,name,modifiedTime,size`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return { exists: false };
      }

      const data = await response.json();
      return {
        exists: true,
        modifiedTime: data.modifiedTime,
        size: data.size
      };

    } catch (error) {
      console.warn('[DriveBackup] Check failed:', error);
      return { exists: false, error: error.message };
    }
  }

  /**
   * Get last backup/restore timestamps
   * @returns {Promise<Object>} { lastBackup, lastRestore }
   */
  async function getTimestamps() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        STORAGE_KEYS.LAST_BACKUP_TIME,
        STORAGE_KEYS.LAST_RESTORE_TIME
      ], (result) => {
        resolve({
          lastBackup: result[STORAGE_KEYS.LAST_BACKUP_TIME] || null,
          lastRestore: result[STORAGE_KEYS.LAST_RESTORE_TIME] || null
        });
      });
    });
  }

  /**
   * Check if user is authenticated (has valid token)
   * @returns {Promise<boolean>}
   */
  async function isAuthenticated() {
    try {
      await getAccessToken(false);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete the backup file from Google Drive
   * @param {boolean} interactive - Whether to show auth UI if needed
   * @returns {Promise<Object>} Delete result { success }
   */
  async function deleteBackup(interactive = true) {
    try {
      const token = await getAccessToken(interactive);
      const fileId = await findBackupFile(token);

      if (!fileId) {
        return { success: true, message: 'No backup to delete' };
      }

      const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok && response.status !== 404) {
        const errorData = await response.text();
        throw new Error(`Delete failed: ${errorData}`);
      }

      // Clear cached file ID
      cachedFileId = null;
      await chrome.storage.local.remove([
        STORAGE_KEYS.BACKUP_FILE_ID,
        STORAGE_KEYS.LAST_BACKUP_TIME
      ]);

      console.log('[DriveBackup] Backup deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('[DriveBackup] Delete failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ========== PUBLIC API ==========

  return {
    backup,
    restore,
    checkBackup,
    deleteBackup,
    getTimestamps,
    isAuthenticated,
    isConfigured,
    revokeToken,
    // Constants for external use
    BACKUP_FILE_NAME,
    BACKUP_VERSION
  };

})();

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DriveBackup;
}
