/**
 * Background Service Worker
 * Chrome Extension MV3 Background Script
 * 
 * @description Handles background tasks, storage, and message passing.
 * Note: Service workers are ephemeral - no persistent global state.
 */

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  LOCAL_TIMEZONE: 'gsw_localTimezone',
  CUSTOMER_TIMEZONE: 'gsw_customerTimezone',
  FAVORITE_TIMEZONES: 'gsw_favoriteTimezones',
  USER_PREFERENCES: 'gsw_userPreferences'
};

const DEFAULT_CONFIG = {
  localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  customerTimezone: 'America/New_York',
  favoriteTimezones: []
};

// ============================================================================
// Storage Helpers
// ============================================================================

/**
 * Gets configuration from storage
 * @returns {Promise<Object>} Configuration object
 */
async function getConfig() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.LOCAL_TIMEZONE,
      STORAGE_KEYS.CUSTOMER_TIMEZONE,
      STORAGE_KEYS.FAVORITE_TIMEZONES,
      STORAGE_KEYS.USER_PREFERENCES
    ]);

    return {
      localTimezone: result[STORAGE_KEYS.LOCAL_TIMEZONE] || DEFAULT_CONFIG.localTimezone,
      customerTimezone: result[STORAGE_KEYS.CUSTOMER_TIMEZONE] || DEFAULT_CONFIG.customerTimezone,
      favoriteTimezones: result[STORAGE_KEYS.FAVORITE_TIMEZONES] || DEFAULT_CONFIG.favoriteTimezones,
      userPreferences: result[STORAGE_KEYS.USER_PREFERENCES] || {}
    };
  } catch (error) {
    console.error('[Background] Failed to get config:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Saves configuration to storage
 * @param {Object} config - Configuration to save
 * @returns {Promise<boolean>} Success status
 */
async function saveConfig(config) {
  try {
    const data = {};
    
    if (config.localTimezone !== undefined) {
      data[STORAGE_KEYS.LOCAL_TIMEZONE] = config.localTimezone;
    }
    if (config.customerTimezone !== undefined) {
      data[STORAGE_KEYS.CUSTOMER_TIMEZONE] = config.customerTimezone;
    }
    if (config.favoriteTimezones !== undefined) {
      data[STORAGE_KEYS.FAVORITE_TIMEZONES] = config.favoriteTimezones;
    }
    if (config.userPreferences !== undefined) {
      data[STORAGE_KEYS.USER_PREFERENCES] = config.userPreferences;
    }

    await chrome.storage.local.set(data);
    console.log('[Background] Config saved successfully');
    return true;
  } catch (error) {
    console.error('[Background] Failed to save config:', error);
    return false;
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Handles incoming messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.action);

  switch (message.action) {
    case 'getConfig':
      getConfig().then(config => {
        sendResponse({ success: true, config });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response

    case 'saveConfig':
      saveConfig(message.config).then(success => {
        // Notify all tabs of config change
        if (success) {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, {
                action: 'configUpdated',
                config: message.config
              }).catch(() => {
                // Tab might not have content script
              });
            });
          });
        }
        sendResponse({ success });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Async response

    case 'addFavorite':
      getConfig().then(async config => {
        const favorites = config.favoriteTimezones || [];
        if (!favorites.includes(message.timezone)) {
          favorites.push(message.timezone);
          await saveConfig({ favoriteTimezones: favorites });
        }
        sendResponse({ success: true, favorites });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'removeFavorite':
      getConfig().then(async config => {
        const favorites = (config.favoriteTimezones || [])
          .filter(tz => tz !== message.timezone);
        await saveConfig({ favoriteTimezones: favorites });
        sendResponse({ success: true, favorites });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    default:
      console.warn('[Background] Unknown action:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

// ============================================================================
// Extension Lifecycle
// ============================================================================

/**
 * Extension installed/updated handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // Set default configuration
    await saveConfig(DEFAULT_CONFIG);
    console.log('[Background] Default configuration saved');
  }
});

/**
 * Extension startup handler
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Extension started');
});

// Log that service worker is active
console.log('[Background] Service worker initialized');
