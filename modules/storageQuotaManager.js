/**
 * Storage Quota Manager Module
 * Tracks and manages chrome.storage.local quota (10MB total)
 * Enforces limits: 5MB screenshots + 2MB notes + 3MB buffer
 * 
 * Key Features:
 * - Storage breakdown by category
 * - Warning at 80% capacity (8MB)
 * - Auto-cleanup at 90% capacity (9MB)
 * - Retention policy enforcement
 */

const StorageQuotaManager = (function() {
  'use strict';

  // Constants
  const TOTAL_QUOTA_MB = 10;
  const TOTAL_QUOTA_BYTES = TOTAL_QUOTA_MB * 1024 * 1024;
  const SCREENSHOT_LIMIT_MB = 5;
  const SCREENSHOT_LIMIT_BYTES = SCREENSHOT_LIMIT_MB * 1024 * 1024;
  const NOTES_LIMIT_MB = 2;
  const NOTES_LIMIT_BYTES = NOTES_LIMIT_MB * 1024 * 1024;
  const BANNER_MESSAGES_LIMIT_MB = 3;
  const BANNER_MESSAGES_LIMIT_BYTES = BANNER_MESSAGES_LIMIT_MB * 1024 * 1024;
  const WARNING_THRESHOLD = 0.8; // 80%
  const CLEANUP_THRESHOLD = 0.9; // 90%
  const DEFAULT_RETENTION_DAYS = 30;

  // State
  let lastBreakdown = null;
  let lastCheckTime = 0;
  const CACHE_DURATION = 5000; // 5 seconds

  /**
   * Get storage breakdown by category
   * @param {boolean} forceRefresh - Force refresh cached data
   * @returns {Promise<Object>} Storage breakdown
   */
  async function getStorageBreakdown(forceRefresh = false) {
    try {
      // Return cached data if recent
      if (!forceRefresh && lastBreakdown && (Date.now() - lastCheckTime) < CACHE_DURATION) {
        return lastBreakdown;
      }

      const allData = await chrome.storage.local.get(null);
      const breakdown = {
        screenshots: 0,
        notes: 0,
        highlights: 0,
        cache: 0,
        settings: 0,
        bannerMessages: 0,
        other: 0,
        total: 0,
        itemCount: {
          screenshots: 0,
          notes: 0,
          highlights: 0,
          cache: 0,
          bannerMessages: 0,
          other: 0
        }
      };

      // Calculate size for each category
      for (const [key, value] of Object.entries(allData)) {
        const sizeBytes = estimateSize(value);

        if (key.startsWith('exl_screenshots_')) {
          breakdown.screenshots += sizeBytes;
          breakdown.itemCount.screenshots++;
        } else if (key.startsWith('exl_notes_') || key.startsWith('stickyNotes_')) {
          breakdown.notes += sizeBytes;
          breakdown.itemCount.notes++;
        } else if (key.startsWith('exl_highlights_') || key.startsWith('highlights_')) {
          breakdown.highlights += sizeBytes;
          breakdown.itemCount.highlights++;
        } else if (key.startsWith('caseData_') || key.startsWith('cache_')) {
          breakdown.cache += sizeBytes;
          breakdown.itemCount.cache++;
        } else if (key.startsWith('settings_') || key === 'userPreferences') {
          breakdown.settings += sizeBytes;
        } else if (key === 'exl_bannerMessages') {
          breakdown.bannerMessages += sizeBytes;
          breakdown.itemCount.bannerMessages++;
        } else {
          breakdown.other += sizeBytes;
          breakdown.itemCount.other++;
        }

        breakdown.total += sizeBytes;
      }

      // Convert to MB for display
      breakdown.screenshotsMB = (breakdown.screenshots / (1024 * 1024)).toFixed(2);
      breakdown.notesMB = (breakdown.notes / (1024 * 1024)).toFixed(2);
      breakdown.highlightsMB = (breakdown.highlights / (1024 * 1024)).toFixed(2);
      breakdown.cacheMB = (breakdown.cache / (1024 * 1024)).toFixed(2);
      breakdown.settingsMB = (breakdown.settings / (1024 * 1024)).toFixed(2);
      breakdown.bannerMessagesMB = (breakdown.bannerMessages / (1024 * 1024)).toFixed(2);
      breakdown.otherMB = (breakdown.other / (1024 * 1024)).toFixed(2);
      breakdown.totalMB = (breakdown.total / (1024 * 1024)).toFixed(2);
      breakdown.percentUsed = ((breakdown.total / TOTAL_QUOTA_BYTES) * 100).toFixed(1);

      // Cache result
      lastBreakdown = breakdown;
      lastCheckTime = Date.now();

      if (typeof Logger !== 'undefined') {
        Logger.log('[StorageQuotaManager] Breakdown:', breakdown);
      }

      return breakdown;

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[StorageQuotaManager] Breakdown failed:', error);
      }
      throw error;
    }
  }

  /**
   * Estimate size of stored object in bytes
   * @param {*} obj - Object to estimate
   * @returns {number} Estimated size in bytes
   */
  function estimateSize(obj) {
    const str = JSON.stringify(obj);
    // Rough estimate: 2 bytes per character (UTF-16)
    return str.length * 2;
  }

  /**
   * Check if screenshot can be stored within quota
   * @param {number} sizeBytes - Screenshot size in bytes
   * @returns {Promise<boolean>} True if can store
   */
  async function canStoreScreenshot(sizeBytes) {
    try {
      const breakdown = await getStorageBreakdown(true);

      // Check screenshot category limit
      if (breakdown.screenshots + sizeBytes > SCREENSHOT_LIMIT_BYTES) {
        if (typeof Logger !== 'undefined') {
          Logger.warn('[StorageQuotaManager] Screenshot limit exceeded');
        }
        showQuotaWarning('Screenshot storage limit reached (5MB). Delete old screenshots to continue.');
        return false;
      }

      // Check total quota
      if (breakdown.total + sizeBytes > TOTAL_QUOTA_BYTES) {
        if (typeof Logger !== 'undefined') {
          Logger.warn('[StorageQuotaManager] Total quota exceeded');
        }
        showQuotaWarning('Storage quota full (10MB). Please free up space.');
        return false;
      }

      // Check if approaching limit and trigger cleanup
      const newTotal = breakdown.total + sizeBytes;
      const newPercent = newTotal / TOTAL_QUOTA_BYTES;

      if (newPercent >= CLEANUP_THRESHOLD) {
        await performAutoCleanup();
        // Re-check after cleanup
        return canStoreScreenshot(sizeBytes);
      } else if (newPercent >= WARNING_THRESHOLD) {
        showQuotaWarning(`Storage ${(newPercent * 100).toFixed(0)}% full. Consider deleting old items.`);
      }

      return true;

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[StorageQuotaManager] canStoreScreenshot check failed:', error);
      }
      return false;
    }
  }

  /**
   * Check if banner message can be stored within quota
   * @param {Object} messageObject - Message object to store
   * @returns {Promise<boolean>} True if can store
   */
  async function canStoreBannerMessage(messageObject) {
    try {
      const sizeBytes = estimateSize(messageObject);
      const breakdown = await getStorageBreakdown(true);

      // Check banner messages category limit
      if (breakdown.bannerMessages + sizeBytes > BANNER_MESSAGES_LIMIT_BYTES) {
        if (typeof Logger !== 'undefined') {
          Logger.warn('[StorageQuotaManager] Banner messages limit exceeded');
        }
        showQuotaWarning('Banner messages storage limit reached (3MB). Delete old messages or remove images to continue.');
        return false;
      }

      // Check total quota
      if (breakdown.total + sizeBytes > TOTAL_QUOTA_BYTES) {
        if (typeof Logger !== 'undefined') {
          Logger.warn('[StorageQuotaManager] Total quota exceeded');
        }
        showQuotaWarning('Storage quota full (10MB). Please free up space.');
        return false;
      }

      // Warn if approaching category limit
      const newCategoryTotal = breakdown.bannerMessages + sizeBytes;
      const categoryPercent = newCategoryTotal / BANNER_MESSAGES_LIMIT_BYTES;
      
      if (categoryPercent >= 0.9) {
        showQuotaWarning(`Banner messages storage ${(categoryPercent * 100).toFixed(0)}% full. Consider removing hover images from old messages.`);
      }

      return true;

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[StorageQuotaManager] canStoreBannerMessage check failed:', error);
      }
      return false;
    }
  }

  /**
   * Get current banner messages storage size
   * @returns {Promise<number>} Size in bytes
   */
  async function getBannerMessagesSize() {
    try {
      const breakdown = await getStorageBreakdown(true);
      return breakdown.bannerMessages;
    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[StorageQuotaManager] getBannerMessagesSize failed:', error);
      }
      return 0;
    }
  }

  /**
   * Check if note can be stored within quota
   * @param {number} sizeBytes - Note size in bytes
   * @returns {Promise<boolean>} True if can store
   */
  async function canStoreNote(sizeBytes) {
    try {
      const breakdown = await getStorageBreakdown(true);

      // Check notes category limit
      if (breakdown.notes + sizeBytes > NOTES_LIMIT_BYTES) {
        if (typeof Logger !== 'undefined') {
          Logger.warn('[StorageQuotaManager] Notes limit exceeded');
        }
        showQuotaWarning('Notes storage limit reached (2MB). Delete old notes to continue.');
        return false;
      }

      // Check total quota
      if (breakdown.total + sizeBytes > TOTAL_QUOTA_BYTES) {
        if (typeof Logger !== 'undefined') {
          Logger.warn('[StorageQuotaManager] Total quota exceeded');
        }
        showQuotaWarning('Storage quota full (10MB). Please free up space.');
        return false;
      }

      return true;

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[StorageQuotaManager] canStoreNote check failed:', error);
      }
      return false;
    }
  }

  /**
   * Perform automatic cleanup of old screenshots
   */
  async function performAutoCleanup() {
    try {
      if (typeof Logger !== 'undefined') {
        Logger.log('[StorageQuotaManager] Starting auto-cleanup');
      }

      // Get settings for retention period
      let retentionDays = DEFAULT_RETENTION_DAYS;
      if (typeof SettingsManager !== 'undefined') {
        const settings = await SettingsManager.getSettings();
        retentionDays = settings?.screenshots?.retentionDays || DEFAULT_RETENTION_DAYS;
      }

      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      const allData = await chrome.storage.local.get(null);
      const keysToDelete = [];

      // Find old screenshots
      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith('exl_screenshots_') && value.timestamp && value.timestamp < cutoffTime) {
          keysToDelete.push(key);
        }
      }

      if (keysToDelete.length > 0) {
        await chrome.storage.local.remove(keysToDelete);
        if (typeof Logger !== 'undefined') {
          Logger.log(`[StorageQuotaManager] Cleaned up ${keysToDelete.length} old screenshots`);
        }
        showSuccessToast(`Cleaned up ${keysToDelete.length} old screenshots`);
      }

      // Force refresh breakdown
      lastBreakdown = null;

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[StorageQuotaManager] Auto-cleanup failed:', error);
      }
    }
  }

  /**
   * Get list of all screenshots with metadata
   * @returns {Promise<Array>} Array of screenshot objects with metadata
   */
  async function getScreenshotList() {
    try {
      const allData = await chrome.storage.local.get(null);
      const screenshots = [];

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith('exl_screenshots_')) {
          screenshots.push({
            storageKey: key,
            id: value.id,
            url: value.url,
            timestamp: value.timestamp,
            layerId: value.layerId,
            size: estimateSize(value),
            thumbnail: value.thumbnail
          });
        }
      }

      // Sort by timestamp (newest first)
      screenshots.sort((a, b) => b.timestamp - a.timestamp);

      return screenshots;

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[StorageQuotaManager] getScreenshotList failed:', error);
      }
      return [];
    }
  }

  /**
   * Delete screenshot by storage key
   * @param {string} storageKey - Storage key to delete
   * @returns {Promise<boolean>} True if deleted
   */
  async function deleteScreenshot(storageKey) {
    try {
      await chrome.storage.local.remove(storageKey);
      
      if (typeof Logger !== 'undefined') {
        Logger.log('[StorageQuotaManager] Deleted screenshot:', storageKey);
      }

      // Force refresh breakdown
      lastBreakdown = null;

      return true;

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[StorageQuotaManager] Delete failed:', error);
      }
      return false;
    }
  }

  /**
   * Delete multiple screenshots by storage keys
   * @param {Array<string>} storageKeys - Array of storage keys
   * @returns {Promise<number>} Number of deleted items
   */
  async function deleteScreenshots(storageKeys) {
    try {
      await chrome.storage.local.remove(storageKeys);
      
      if (typeof Logger !== 'undefined') {
        Logger.log(`[StorageQuotaManager] Deleted ${storageKeys.length} screenshots`);
      }

      // Force refresh breakdown
      lastBreakdown = null;

      return storageKeys.length;

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[StorageQuotaManager] Bulk delete failed:', error);
      }
      return 0;
    }
  }

  /**
   * Show quota warning toast
   * @param {string} message - Warning message
   */
  function showQuotaWarning(message) {
    const toast = document.createElement('div');
    toast.className = 'exl-quota-warning-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ffc107;
      color: #000;
      padding: 16px 24px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;

    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.marginBottom = '10px';
    toast.appendChild(messageDiv);

    const manageBtn = document.createElement('button');
    manageBtn.textContent = 'Manage Storage';
    manageBtn.style.cssText = `
      padding: 6px 12px;
      border: none;
      background: #000;
      color: #ffc107;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    `;
    manageBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openStorageManager' });
      toast.remove();
    });
    toast.appendChild(manageBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      line-height: 1;
    `;
    closeBtn.addEventListener('click', () => toast.remove());
    toast.appendChild(closeBtn);

    document.body.appendChild(toast);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 10000);
  }

  /**
   * Show success toast
   * @param {string} message - Success message
   */
  function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #51cf66;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
  }

  /**
   * Check storage quota and show warning if needed
   */
  async function checkQuota() {
    try {
      const breakdown = await getStorageBreakdown(true);
      const percent = parseFloat(breakdown.percentUsed) / 100;

      if (percent >= CLEANUP_THRESHOLD) {
        await performAutoCleanup();
      } else if (percent >= WARNING_THRESHOLD) {
        showQuotaWarning(`Storage ${breakdown.percentUsed}% full (${breakdown.totalMB}MB / ${TOTAL_QUOTA_MB}MB)`);
      }

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[StorageQuotaManager] checkQuota failed:', error);
      }
    }
  }

  /**
   * Initialize module
   */
  function init() {
    if (typeof Logger !== 'undefined') {
      Logger.log('[StorageQuotaManager] Initializing');
    }

    // Check quota on init
    checkQuota();

    // Periodic quota check (every 5 minutes)
    setInterval(checkQuota, 5 * 60 * 1000);
  }

  // Public API
  return {
    init,
    getStorageBreakdown,
    canStoreScreenshot,
    canStoreNote,
    canStoreBannerMessage,
    getBannerMessagesSize,
    performAutoCleanup,
    getScreenshotList,
    deleteScreenshot,
    deleteScreenshots,
    checkQuota,
    estimateSize
  };
})();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => StorageQuotaManager.init());
} else {
  StorageQuotaManager.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageQuotaManager;
}
