/**
 * Drive Backup Module
 * Handles backup and restore of extension data to Google Drive AppData folder
 * 
 * Uses the Google Drive API v3 with the drive.appdata scope to store
 * backup data in a hidden app-specific folder. The backup file is named
 * 'penang-coe-salesforce-backup.json' and contains:
 * - All chrome.storage.sync contents (settings)
 * - Selected chrome.storage.local contents (case data, highlights, notes, bookmarks)
 * 
 * To extend backup coverage, add additional prefixes to LOCAL_PREFIXES array.
 * 
 * @module driveBackup
 * @version 1.0.0
 */

const BACKUP_FILE_NAME = 'penang-coe-salesforce-backup.json';
const BACKUP_VERSION = 1;

// Prefixes for chrome.storage.local keys to include in backup
// Add new prefixes here to extend backup coverage
const LOCAL_PREFIXES = [
  'caseData_',           // Case data cache entries
  'caseCacheData',       // CacheManager main storage key
  'caseVersion',         // Cache version tracking
  'exl_highlights_',     // Highlighter data
  'exl_notes_',          // Sticky notes data
  'exl_bookmark',        // Bookmark collections and bookmarks
  'caseCommentMemory',   // Comment memory/history
  'userPreferences'      // User preferences
];

/**
 * Gets an OAuth access token via Chrome identity API
 * @param {boolean} interactive - Whether to show auth UI if needed
 * @returns {Promise<string>} Access token
 * @throws {Error} If token acquisition fails
 */
async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message || 'Failed to get auth token';
        console.error('[DriveBackup] Auth error:', errorMessage);
        reject(new Error(errorMessage));
        return;
      }
      if (!token) {
        reject(new Error('No token returned'));
        return;
      }
      resolve(token);
    });
  });
}

/**
 * Removes a cached auth token (used when token is invalid)
 * @param {string} token - The token to remove from cache
 * @returns {Promise<void>}
 */
async function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      console.log('[DriveBackup] Cached token removed');
      resolve();
    });
  });
}

/**
 * Searches for the backup file in Google Drive AppData folder
 * @param {string} token - OAuth access token
 * @returns {Promise<string|null>} File ID if found, null otherwise
 */
async function findBackupFile(token) {
  const query = encodeURIComponent(`name='${BACKUP_FILE_NAME}'`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name)`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error(`AUTH_ERROR:${status}`);
    }
    throw new Error(`Failed to search files: ${status}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    console.log('[DriveBackup] Found existing backup file:', data.files[0].id);
    return data.files[0].id;
  }

  console.log('[DriveBackup] No existing backup file found');
  return null;
}

/**
 * Creates a new backup file in Google Drive AppData folder
 * @param {string} token - OAuth access token
 * @param {Object} backupData - Data to backup
 * @returns {Promise<string>} Created file ID
 */
async function createBackupFile(token, backupData) {
  const metadata = {
    name: BACKUP_FILE_NAME,
    parents: ['appDataFolder']
  };

  const boundary = '-------DriveBackupBoundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(backupData) +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&spaces=appDataFolder',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    }
  );

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error(`AUTH_ERROR:${status}`);
    }
    throw new Error(`Failed to create backup file: ${status}`);
  }

  const data = await response.json();
  console.log('[DriveBackup] Created backup file:', data.id);
  return data.id;
}

/**
 * Updates an existing backup file in Google Drive
 * @param {string} token - OAuth access token
 * @param {string} fileId - ID of file to update
 * @param {Object} backupData - Data to backup
 * @returns {Promise<void>}
 */
async function updateBackupFile(token, fileId, backupData) {
  const metadata = {
    name: BACKUP_FILE_NAME
  };

  const boundary = '-------DriveBackupBoundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(backupData) +
    closeDelimiter;

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    }
  );

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error(`AUTH_ERROR:${status}`);
    }
    throw new Error(`Failed to update backup file: ${status}`);
  }

  console.log('[DriveBackup] Updated backup file:', fileId);
}

/**
 * Downloads the backup file content from Google Drive
 * @param {string} token - OAuth access token
 * @param {string} fileId - ID of file to download
 * @returns {Promise<Object>} Parsed backup data
 */
async function downloadBackupFile(token, fileId) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error(`AUTH_ERROR:${status}`);
    }
    throw new Error(`Failed to download backup file: ${status}`);
  }

  const data = await response.json();
  console.log('[DriveBackup] Downloaded backup file');
  return data;
}

/**
 * Collects all data from chrome.storage.sync
 * @returns {Promise<Object>} Sync storage contents
 */
async function collectSyncData() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (items) => {
      if (chrome.runtime.lastError) {
        console.error('[DriveBackup] Error reading sync storage:', chrome.runtime.lastError);
        resolve({});
        return;
      }
      resolve(items || {});
    });
  });
}

/**
 * Collects selected data from chrome.storage.local based on prefixes
 * @returns {Promise<Object>} Filtered local storage contents
 */
async function collectLocalData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      if (chrome.runtime.lastError) {
        console.error('[DriveBackup] Error reading local storage:', chrome.runtime.lastError);
        resolve({});
        return;
      }

      // Filter items by prefix
      const filtered = {};
      for (const key in items) {
        const shouldInclude = LOCAL_PREFIXES.some(prefix => key.startsWith(prefix));
        if (shouldInclude) {
          filtered[key] = items[key];
        }
      }

      console.log('[DriveBackup] Collected', Object.keys(filtered).length, 'local storage items');
      resolve(filtered);
    });
  });
}

/**
 * Writes data back to chrome.storage.sync
 * @param {Object} data - Data to write
 * @returns {Promise<void>}
 */
async function writeSyncData(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      console.log('[DriveBackup] Restored sync data');
      resolve();
    });
  });
}

/**
 * Writes data back to chrome.storage.local
 * @param {Object} data - Data to write
 * @returns {Promise<void>}
 */
async function writeLocalData(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      console.log('[DriveBackup] Restored local data');
      resolve();
    });
  });
}

/**
 * Handles auth errors by clearing cached token and rethrowing
 * @param {Error} error - The error to check
 * @param {string} token - The token that was used
 * @throws {Error} Always throws after handling
 */
async function handleAuthError(error, token) {
  if (error.message && error.message.startsWith('AUTH_ERROR:')) {
    if (token) {
      await removeCachedToken(token);
    }
    throw new Error('Authentication failed. Please try again to re-authenticate.');
  }
  throw error;
}

/**
 * Backs up extension data to Google Drive AppData folder
 * @param {Object} options - Backup options
 * @param {boolean} options.interactive - Whether to show auth UI if needed (default: true)
 * @returns {Promise<{ok: boolean, message?: string, error?: string}>}
 */
export async function backupNow({ interactive = true } = {}) {
  console.log('[DriveBackup] Starting backup...');
  let token = null;

  try {
    // Get auth token
    token = await getAuthToken(interactive);

    // Collect data to backup
    const syncData = await collectSyncData();
    const localData = await collectLocalData();

    const backupPayload = {
      version: BACKUP_VERSION,
      created_at: new Date().toISOString(),
      sync: syncData,
      local: localData
    };

    console.log('[DriveBackup] Backup payload prepared:', {
      syncKeys: Object.keys(syncData).length,
      localKeys: Object.keys(localData).length
    });

    // Check if backup file exists
    let fileId = null;
    try {
      fileId = await findBackupFile(token);
    } catch (error) {
      await handleAuthError(error, token);
    }

    // Create or update backup file
    try {
      if (fileId) {
        await updateBackupFile(token, fileId, backupPayload);
      } else {
        await createBackupFile(token, backupPayload);
      }
    } catch (error) {
      await handleAuthError(error, token);
    }

    console.log('[DriveBackup] Backup completed successfully');
    return { 
      ok: true, 
      message: 'Backup completed successfully' 
    };

  } catch (error) {
    console.error('[DriveBackup] Backup failed:', error);
    return { 
      ok: false, 
      error: error.message || 'Backup failed' 
    };
  }
}

/**
 * Restores extension data from Google Drive AppData folder
 * @param {Object} options - Restore options
 * @param {boolean} options.interactive - Whether to show auth UI if needed (default: true)
 * @returns {Promise<{ok: boolean, message?: string, error?: string}>}
 */
export async function restoreNow({ interactive = true } = {}) {
  console.log('[DriveBackup] Starting restore...');
  let token = null;

  try {
    // Get auth token
    token = await getAuthToken(interactive);

    // Find backup file
    let fileId = null;
    try {
      fileId = await findBackupFile(token);
    } catch (error) {
      await handleAuthError(error, token);
    }

    if (!fileId) {
      return { 
        ok: false, 
        error: 'No backup found in Google Drive' 
      };
    }

    // Download backup data
    let backupData = null;
    try {
      backupData = await downloadBackupFile(token, fileId);
    } catch (error) {
      await handleAuthError(error, token);
    }

    // Validate backup structure
    if (!backupData || typeof backupData.version !== 'number') {
      return { 
        ok: false, 
        error: 'Invalid backup file format' 
      };
    }

    console.log('[DriveBackup] Backup file version:', backupData.version, 
      'created:', backupData.created_at);

    // Restore sync data
    if (backupData.sync && Object.keys(backupData.sync).length > 0) {
      await writeSyncData(backupData.sync);
    }

    // Restore local data
    if (backupData.local && Object.keys(backupData.local).length > 0) {
      await writeLocalData(backupData.local);
    }

    console.log('[DriveBackup] Restore completed successfully');
    return { 
      ok: true, 
      message: `Restore completed. Backup from ${backupData.created_at}` 
    };

  } catch (error) {
    console.error('[DriveBackup] Restore failed:', error);
    return { 
      ok: false, 
      error: error.message || 'Restore failed' 
    };
  }
}

// Default export for ES module
export default {
  backupNow,
  restoreNow
};
