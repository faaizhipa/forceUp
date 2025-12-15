/**
 * Settings Manager Module
 * Manages user preferences for Ex Libris extension
 */

const SettingsManager = (function() {
  'use strict';

  // Default settings
  const DEFAULT_SETTINGS = {
    // Ex Libris specific settings
    exlibris: {
      // Feature toggles
      // All features default to true (enabled) unless explicitly disabled
      features: {
        fieldHighlighting: true,
        contextMenu: true,
        multiTabSync: true,
        caseCommentMemory: true,
        characterCounter: true,
        dynamicMenu: true,
        persistentBanner: true,
        highlighterEnabled: true,
        bannerMessages: true,
        recordingQuotaEnforced: true,
        storageQuotaEnforced: true
      },

      // UI preferences
      ui: {
        buttonLabelStyle: 'casual', // 'formal', 'casual', 'abbreviated'
        timezone: 'auto', // 'auto' or IANA timezone string
        menuLocations: {
          cardActions: false,
          headerDetails: true
        }
      },

      // Performance settings
      performance: {
        cacheEnabled: true,
        maxCacheSize: 8 * 1024 * 1024, // 8MB
        cacheMaxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      },

      // Keyboard shortcuts enabled/disabled
      shortcuts: {
        enabled: false,
        bold: true,
        italic: true,
        code: true,
        closeModal: true
      },

      // Persistent Banner settings
      persistentBanner: {
        clarivateEnabled: false,  // Disable banner for Clarivate domains by default
        messages: {
          enabled: true,  // Enable/disable rotating messages (separate from feature toggle)
          defaultMessages: {
            enabled: true,
            items: [
              { id: 'default_1', text: 'Field Highlighting', enabled: true },
              { id: 'default_2', text: 'Context Menu Formatting', enabled: true },
              { id: 'default_3', text: 'Multi-Tab Warning', enabled: true },
              { id: 'default_4', text: 'Auto-Save Comments', enabled: true },
              { id: 'default_5', text: 'Character Counter', enabled: true },
              { id: 'default_6', text: 'Dynamic Buttons', enabled: true },
              { id: 'default_7', text: 'Persistent Banner', enabled: true },
              { id: 'default_8', text: 'Text Highlighter & Sticky Notes', enabled: true }
            ]
          },
          customMessages: [],
          rotationInterval: 5000,  // milliseconds (default: 5 seconds)
          autoRotate: true  // Enable/disable automatic rotation
        }
      }
    },

    // Highlighter & Notes settings (NEW)
    highlighterNotes: {
      // Feature flags
      featureFlags: {
        screenshots: true,
        richTextNotes: true,
        noteAnnotations: true
      },

      // Screenshot settings
      screenshots: {
        enabled: true,
        autoCleanup: true,
        retentionDays: 30,
        maxSizeMB: 5,
        jpegQuality: 0.8,
        maxImageWidth: 800
      },

      // Sticky notes settings
      notes: {
        collapseMode: 'manual', // 'manual' or 'auto'
        virtualScrollThreshold: 50,
        lazyLoadImages: true,
        defaultColor: 'yellow',
        defaultSize: {
          width: 300,
          height: 200
        }
      },

      // Cross-tab sync settings
      sync: {
        enabled: true,
        conflictResolution: 'prompt', // 'prompt', 'local', 'remote'
        autoResolveDelay: 10000 // milliseconds
      },

      // Multi-site banner activation (NEW)
      activeSites: {}, // { "example.com": true/false }

      // Banner dismissal settings (NEW)
      banner: {
        showCloseButton: true,
        dismissalDuration: 'session' // 'session' or 'permanent'
      }
    },

    // Legacy settings (for backwards compatibility)
    savedSelection: 'EndNote'
  };

  let currentSettings = null;
  let changeListeners = [];

  return {
    /**
     * Initializes settings manager
     * @returns {Promise<Object>}
     */
    async init() {
      await this.load();
      console.log('[SettingsManager] Initialized with settings:', currentSettings);
      return currentSettings;
    },

    /**
     * Loads settings from storage
     * @returns {Promise<Object>}
     */
    async load() {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get(null, (items) => {
          if (chrome.runtime.lastError) {
            console.error('[SettingsManager] Error loading settings:', chrome.runtime.lastError);
            currentSettings = this.getDefaultSettings();
            reject(chrome.runtime.lastError);
            return;
          }

          // Merge with defaults (deep merge)
          currentSettings = this.mergeWithDefaults(items);
          resolve(currentSettings);
        });
      });
    },

    /**
     * Saves settings to storage
     * Ensures all feature values are explicit booleans before saving
     * @param {Object} settings - Settings to save
     * @returns {Promise<void>}
     */
    async save(settings) {
      // Normalize feature values to explicit booleans before saving
      if (settings.exlibris?.features) {
        for (const featureName in settings.exlibris.features) {
          const value = settings.exlibris.features[featureName];
          // Ensure it's a boolean (not undefined, null, or other type)
          if (typeof value !== 'boolean') {
            settings.exlibris.features[featureName] = Boolean(value);
          }
        }
      }
      
      return new Promise((resolve, reject) => {
        chrome.storage.sync.set(settings, () => {
          if (chrome.runtime.lastError) {
            console.error('[SettingsManager] Error saving settings:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }

          currentSettings = this.mergeWithDefaults(settings);
          console.log('[SettingsManager] Settings saved:', currentSettings);
          
          // Notify listeners
          this.notifyListeners(currentSettings);
          resolve();
        });
      });
    },

    /**
     * Gets current settings
     * @returns {Object}
     */
    get() {
      return currentSettings || this.getDefaultSettings();
    },

    /**
     * Gets a specific setting value
     * @param {string} path - Dot-notation path (e.g., 'exlibris.features.fieldHighlighting')
     * @returns {*}
     */
    getValue(path) {
      const settings = this.get();
      const keys = path.split('.');
      let value = settings;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return undefined;
        }
      }

      return value;
    },

    /**
     * Sets a specific setting value
     * @param {string} path - Dot-notation path
     * @param {*} value - Value to set
     * @returns {Promise<void>}
     */
    async setValue(path, value) {
      const settings = this.get();
      const keys = path.split('.');
      const lastKey = keys.pop();
      let target = settings;

      // Navigate to parent object
      for (const key of keys) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        target = target[key];
      }

      // Set value
      target[lastKey] = value;

      // Save
      await this.save(settings);
    },

    /**
     * Gets default settings
     * @returns {Object}
     */
    getDefaultSettings() {
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    },

    /**
     * Merges settings with defaults (deep merge)
     * Also migrates undefined/null feature values to explicit booleans
     * @param {Object} settings
     * @returns {Object}
     */
    mergeWithDefaults(settings) {
      const defaults = this.getDefaultSettings();
      const merged = this.deepMerge(defaults, settings);
      
      // Migrate undefined/null feature values to explicit booleans
      if (merged.exlibris?.features) {
        const defaultFeatures = defaults.exlibris.features;
        for (const featureName in defaultFeatures) {
          const currentValue = merged.exlibris.features[featureName];
          // If value is undefined or null, use default
          if (currentValue === undefined || currentValue === null) {
            merged.exlibris.features[featureName] = defaultFeatures[featureName];
          }
          // Ensure it's a boolean
          else if (typeof currentValue !== 'boolean') {
            merged.exlibris.features[featureName] = Boolean(currentValue);
          }
        }
      }
      
      return merged;
    },

    /**
     * Deep merges two objects
     * @param {Object} target
     * @param {Object} source
     * @returns {Object}
     */
    deepMerge(target, source) {
      const result = { ...target };

      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = this.deepMerge(result[key] || {}, source[key]);
          } else {
            result[key] = source[key];
          }
        }
      }

      return result;
    },

    /**
     * Resets to default settings
     * @returns {Promise<void>}
     */
    async reset() {
      const defaults = this.getDefaultSettings();
      await this.save(defaults);
      console.log('[SettingsManager] Settings reset to defaults');
    },

    /**
     * Adds a change listener
     * @param {Function} callback - Called when settings change
     */
    addChangeListener(callback) {
      changeListeners.push(callback);
    },

    /**
     * Removes a change listener
     * @param {Function} callback
     */
    removeChangeListener(callback) {
      changeListeners = changeListeners.filter(cb => cb !== callback);
    },

    /**
     * Notifies all listeners of settings change
     * @param {Object} settings
     */
    notifyListeners(settings) {
      changeListeners.forEach(callback => {
        try {
          callback(settings);
        } catch (error) {
          console.error('[SettingsManager] Error in change listener:', error);
        }
      });
    },

    /**
     * Exports settings as JSON
     * @returns {string}
     */
    export() {
      return JSON.stringify(this.get(), null, 2);
    },

    /**
     * Imports settings from JSON
     * @param {string} json
     * @returns {Promise<void>}
     */
    async import(json) {
      try {
        const settings = JSON.parse(json);
        await this.save(settings);
        console.log('[SettingsManager] Settings imported successfully');
      } catch (error) {
        console.error('[SettingsManager] Error importing settings:', error);
        throw new Error('Invalid settings JSON');
      }
    },

    /**
     * Gets feature toggle state
     * Consistent logic: undefined/true = enabled, false = disabled
     * @param {string} featureName
     * @returns {boolean}
     */
    isFeatureEnabled(featureName) {
      const value = this.getValue(`exlibris.features.${featureName}`);
      // Consistent check: undefined or true means enabled, only false means disabled
      return value !== false;
    },

    /**
     * Toggles a feature on/off
     * @param {string} featureName
     * @param {boolean} enabled
     * @returns {Promise<void>}
     */
    async toggleFeature(featureName, enabled) {
      await this.setValue(`exlibris.features.${featureName}`, enabled);
      console.log(`[SettingsManager] Feature '${featureName}' ${enabled ? 'enabled' : 'disabled'}`);
    },

    /**
     * Gets storage usage info
     * @returns {Promise<Object>}
     */
    async getStorageInfo() {
      return new Promise((resolve) => {
        chrome.storage.sync.getBytesInUse(null, (bytes) => {
          const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB default
          resolve({
            used: bytes,
            max: maxBytes,
            percentage: Math.round((bytes / maxBytes) * 100),
            available: maxBytes - bytes
          });
        });
      });
    },

    /**
     * Clears all cache data
     * @returns {Promise<void>}
     */
    async clearCache() {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          const keysToRemove = Object.keys(items).filter(key => 
            key.startsWith('caseData_') || key === 'caseDataCache'
          );

          if (keysToRemove.length === 0) {
            console.log('[SettingsManager] No cache to clear');
            resolve();
            return;
          }

          chrome.storage.local.remove(keysToRemove, () => {
            console.log(`[SettingsManager] Cleared ${keysToRemove.length} cache entries`);
            resolve();
          });
        });
      });
    },

    /**
     * Gets timezone for display
     * @returns {string}
     */
    getTimezone() {
      const tz = this.getValue('exlibris.ui.timezone');
      if (tz === 'auto' || !tz) {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      }
      return tz;
    },

    /**
     * Validates settings object
     * @param {Object} settings
     * @returns {boolean}
     */
    validate(settings) {
      // Basic validation - ensure required structure exists
      if (!settings || typeof settings !== 'object') {
        return false;
      }

      // Check for valid button label style
      const validStyles = ['formal', 'casual', 'abbreviated'];
      const labelStyle = settings.exlibris?.ui?.buttonLabelStyle;
      if (labelStyle && !validStyles.includes(labelStyle)) {
        return false;
      }

      return true;
    }
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.SettingsManager = SettingsManager;
}
