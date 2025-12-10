'use strict';

const GlobalSyncStateStore = (() => {
  'use strict';

  const STORAGE_KEYS = {
    localTimezone: 'gsw_localTimezone',
    customerTimezone: 'gsw_customerTimezone',
    favoriteTimezones: 'gsw_favoriteTimezones',
    userPreferences: 'gsw_userPreferences',
    themePreference: 'gsw_themePreference'
  };

  const DEFAULTS = {
    localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    customerTimezone: 'America/New_York',
    favoriteTimezones: [],
    userPreferences: {
      awakeStart: 7,
      awakeEnd: 23,
      businessStart: 9,
      businessEnd: 17
    },
    themePreference: 'auto'
  };

  const subscribers = new Map();
  let subscriberId = 0;

  const state = {
    ...DEFAULTS,
    lastUpdated: Date.now(),
    isInitialized: false,
    pending: false
  };

  function _emit(eventName, detail) {
    subscribers.forEach((callback) => {
      try {
        callback(eventName, detail);
      } catch (error) {
        console.error('[GlobalSyncStateStore] Subscriber callback failed:', error);
      }
    });
  }

  async function _getStorageApi() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    // Fallback for environments without chrome APIs (tests)
    const memoryStore = new Map();
    return {
      async get(keys) {
        const result = {};
        keys.forEach((key) => {
          if (memoryStore.has(key)) {
            result[key] = memoryStore.get(key);
          }
        });
        return result;
      },
      async set(items) {
        Object.entries(items).forEach(([key, value]) => {
          memoryStore.set(key, value);
        });
      }
    };
  }

  async function load() {
    const storage = await _getStorageApi();
    try {
      const result = await storage.get(Object.values(STORAGE_KEYS));
      state.localTimezone = result[STORAGE_KEYS.localTimezone] || DEFAULTS.localTimezone;
      state.customerTimezone = result[STORAGE_KEYS.customerTimezone] || DEFAULTS.customerTimezone;
      state.favoriteTimezones = result[STORAGE_KEYS.favoriteTimezones] || DEFAULTS.favoriteTimezones;
      state.userPreferences = {
        ...DEFAULTS.userPreferences,
        ...(result[STORAGE_KEYS.userPreferences] || {})
      };
      state.themePreference = result[STORAGE_KEYS.themePreference] || DEFAULTS.themePreference;
      state.isInitialized = true;
      state.lastUpdated = Date.now();
      _emit('loaded', { ...state });
      return { ...state };
    } catch (error) {
      console.error('[GlobalSyncStateStore] Failed to load state:', error);
      throw error;
    }
  }

  async function save(partial) {
    const storage = await _getStorageApi();
    const payload = {};

    if (partial.localTimezone !== undefined) {
      payload[STORAGE_KEYS.localTimezone] = partial.localTimezone;
    }
    if (partial.customerTimezone !== undefined) {
      payload[STORAGE_KEYS.customerTimezone] = partial.customerTimezone;
    }
    if (partial.favoriteTimezones !== undefined) {
      payload[STORAGE_KEYS.favoriteTimezones] = partial.favoriteTimezones;
    }
    if (partial.userPreferences !== undefined) {
      payload[STORAGE_KEYS.userPreferences] = partial.userPreferences;
    }
    if (partial.themePreference !== undefined) {
      payload[STORAGE_KEYS.themePreference] = partial.themePreference;
    }

    try {
      await storage.set(payload);
      Object.assign(state, partial);
      state.lastUpdated = Date.now();
      _emit('updated', { ...state });
      return true;
    } catch (error) {
      console.error('[GlobalSyncStateStore] Failed to save state:', error);
      return false;
    }
  }

  function getSnapshot() {
    return { ...state };
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Subscriber must be a function');
    }
    const id = ++subscriberId;
    subscribers.set(id, callback);
    return () => {
      subscribers.delete(id);
    };
  }

  function setTheme(preference) {
    if (!['auto', 'light', 'dark'].includes(preference)) {
      console.warn('[GlobalSyncStateStore] Invalid theme preference:', preference);
      return Promise.resolve(false);
    }
    return save({ themePreference: preference });
  }

  async function initialize() {
    if (state.isInitialized) {
      return { ...state };
    }
    return load();
  }

  return {
    initialize,
    load,
    save,
    getSnapshot,
    subscribe,
    setTheme
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlobalSyncStateStore;
}
