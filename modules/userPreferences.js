/**
 * User Preferences Manager
 * 
 * Manages user-configurable preferences for timezone, shift hours, IRT expectations,
 * date formatting, and Salesforce UI timezone. Provides defaults for first-run experience.
 * 
 * @module userPreferences
 * @version 1.0.0
 */

const UserPreferences = (function() {
  'use strict';

  const STORAGE_KEY = 'userPreferences';
  const VERSION = '1.0.0';

  /**
   * Default preference values
   * Used on first run when no cached preferences exist
   */
  const DEFAULTS = {
    version: VERSION,
    
    // Shift Configuration
    shift: {
      timezone: 'Asia/Kuala_Lumpur',  // MYT (UTC+8)
      startHour: 21,  // 9 PM
      startMinute: 0,
      endHour: 6,     // 6 AM (next day for overnight shifts)
      endMinute: 0,
      isOvernightShift: true  // Shift crosses midnight
    },

    // User's Local Timezone
    userTimezone: {
      auto: true,  // Auto-detect from browser
      manual: null,  // Override if auto-detection is wrong
      detected: null  // Last detected timezone
    },

    // Salesforce UI Timezone
    salesforceTimezone: {
      auto: true,  // Try to detect from SF metadata
      manual: null,  // User-specified SF timezone
      detected: null  // Last detected SF timezone
    },

    // Favorite Timezones for timezone comparison widget
    favoriteTimezones: [],  // Array of IANA timezone identifiers

    // IRT (Initial Response Time) Expectations
    irt: {
      useTeamDefaults: true,  // Use team-specific IRT from teamConfigs
      customMinutes: null,  // Custom IRT override (minutes)
      team: 'EndNote'  // Default team
    },

    // Date/Time Formatting
    formatting: {
      dateFormat: 'auto',  // 'auto', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'
      timeFormat: '24h',  // '12h' or '24h'
      locale: 'auto'  // Auto-detect from browser, or specific locale like 'en-US'
    },

    // First-run flags
    meta: {
      isFirstRun: true,
      setupCompleted: false,
      lastUpdated: null,
      warningDismissed: false
    }
  };

  /**
   * Cache for loaded preferences
   */
  let cachedPreferences = null;

  /**
   * Detects user's browser timezone
   * @returns {string} IANA timezone identifier
   */
  function detectBrowserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.warn('[UserPreferences] Failed to detect browser timezone:', error);
      return 'Asia/Kuala_Lumpur';  // Fallback to MYT
    }
  }

  /**
   * Detects user's locale
   * @returns {string} Locale identifier
   */
  function detectBrowserLocale() {
    try {
      return navigator.language || navigator.userLanguage || 'en-US';
    } catch (error) {
      console.warn('[UserPreferences] Failed to detect browser locale:', error);
      return 'en-US';
    }
  }

  /**
   * Deep merges two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Loads preferences from storage
   * @returns {Promise<Object>} User preferences
   */
  async function load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          console.error('[UserPreferences] Error loading preferences:', chrome.runtime.lastError);
          const defaults = getDefaults();
          cachedPreferences = defaults;
          resolve(defaults);
          return;
        }

        if (result[STORAGE_KEY]) {
          // Merge with defaults to handle version updates
          const stored = result[STORAGE_KEY];
          const merged = deepMerge(DEFAULTS, stored);
          
          // Update meta information
          merged.meta.isFirstRun = false;
          
          cachedPreferences = merged;
          console.log('[UserPreferences] Loaded preferences:', merged);
          resolve(merged);
        } else {
          // First run - use defaults with auto-detection
          const defaults = getDefaults();
          cachedPreferences = defaults;
          console.log('[UserPreferences] First run - using defaults:', defaults);
          resolve(defaults);
        }
      });
    });
  }

  /**
   * Saves preferences to storage
   * @param {Object} preferences - Preferences to save
   * @returns {Promise<void>}
   */
  async function save(preferences) {
    return new Promise((resolve, reject) => {
      // Update metadata
      const toSave = {
        ...preferences,
        version: VERSION,
        meta: {
          ...preferences.meta,
          lastUpdated: new Date().toISOString()
        }
      };

      chrome.storage.local.set({ [STORAGE_KEY]: toSave }, () => {
        if (chrome.runtime.lastError) {
          console.error('[UserPreferences] Error saving preferences:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        cachedPreferences = toSave;
        console.log('[UserPreferences] Saved preferences:', toSave);
        resolve();
      });
    });
  }

  /**
   * Gets default preferences with auto-detection
   * @returns {Object} Default preferences
   */
  function getDefaults() {
    const defaults = JSON.parse(JSON.stringify(DEFAULTS));  // Deep clone
    
    // Auto-detect timezones and locale
    defaults.userTimezone.detected = detectBrowserTimezone();
    defaults.formatting.locale = detectBrowserLocale();
    
    return defaults;
  }

  /**
   * Gets effective timezone for shift calculations
   * Takes into account auto-detection and manual overrides
   * @param {Object} preferences - User preferences
   * @returns {string} IANA timezone identifier
   */
  function getEffectiveShiftTimezone(preferences) {
    return preferences.shift.timezone;
  }

  /**
   * Gets effective user timezone
   * @param {Object} preferences - User preferences
   * @returns {string} IANA timezone identifier
   */
  function getEffectiveUserTimezone(preferences) {
    if (!preferences.userTimezone.auto && preferences.userTimezone.manual) {
      return preferences.userTimezone.manual;
    }
    return preferences.userTimezone.detected || detectBrowserTimezone();
  }

  /**
   * Gets effective Salesforce UI timezone
   * @param {Object} preferences - User preferences
   * @returns {string|null} IANA timezone identifier or null if not set
   */
  function getEffectiveSalesforceTimezone(preferences) {
    if (!preferences.salesforceTimezone.auto && preferences.salesforceTimezone.manual) {
      return preferences.salesforceTimezone.manual;
    }
    return preferences.salesforceTimezone.detected || null;
  }

  /**
   * Updates a specific preference section
   * @param {string} section - Section name (e.g., 'shift', 'irt')
   * @param {Object} updates - Updates to apply
   * @returns {Promise<void>}
   */
  async function updateSection(section, updates) {
    const current = cachedPreferences || await load();
    
    if (!current[section]) {
      throw new Error(`Invalid preference section: ${section}`);
    }

    current[section] = {
      ...current[section],
      ...updates
    };

    await save(current);
  }

  /**
   * Marks setup as completed (dismisses first-run warning)
   * @returns {Promise<void>}
   */
  async function completeSetup() {
    const current = cachedPreferences || await load();
    
    current.meta.setupCompleted = true;
    current.meta.isFirstRun = false;
    current.meta.warningDismissed = true;

    await save(current);
  }

  /**
   * Checks if this is the first run or if setup is incomplete
   * @returns {Promise<boolean>} True if showing warning is needed
   */
  async function shouldShowWarning() {
    const prefs = cachedPreferences || await load();
    return prefs.meta.isFirstRun || !prefs.meta.setupCompleted || !prefs.meta.warningDismissed;
  }

  /**
   * Resets preferences to defaults
   * @returns {Promise<void>}
   */
  async function reset() {
    const defaults = getDefaults();
    await save(defaults);
  }

  /**
   * Gets cached preferences or loads them
   * @returns {Promise<Object>} User preferences
   */
  async function get() {
    if (cachedPreferences) {
      return cachedPreferences;
    }
    return await load();
  }

  /**
   * Exports preferences for backup
   * @returns {Promise<string>} JSON string of preferences
   */
  async function exportPreferences() {
    const prefs = await get();
    return JSON.stringify(prefs, null, 2);
  }

  /**
   * Imports preferences from backup
   * @param {string} jsonString - JSON string of preferences
   * @returns {Promise<void>}
   */
  async function importPreferences(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      
      // Validate basic structure
      if (!imported.shift || !imported.userTimezone || !imported.salesforceTimezone) {
        throw new Error('Invalid preference structure');
      }

      await save(imported);
    } catch (error) {
      console.error('[UserPreferences] Error importing preferences:', error);
      throw error;
    }
  }

  /**
   * Converts shift times to Date objects for the given date
   * Handles overnight shifts that cross midnight
   * @param {Object} preferences - User preferences
   * @param {Date} referenceDate - Reference date for shift
   * @returns {Object} { start: Date, end: Date }
   */
  function getShiftBoundaries(preferences, referenceDate = new Date()) {
    const shiftTz = getEffectiveShiftTimezone(preferences);
    const { startHour, startMinute, endHour, endMinute, isOvernightShift } = preferences.shift;

    // Create date objects in the shift timezone
    const startDate = new Date(referenceDate);
    startDate.setHours(startHour, startMinute, 0, 0);

    const endDate = new Date(referenceDate);
    endDate.setHours(endHour, endMinute, 0, 0);

    // If overnight shift, end time is next day
    if (isOvernightShift && endHour < startHour) {
      endDate.setDate(endDate.getDate() + 1);
    }

    return { start: startDate, end: endDate };
  }

  /**
   * Checks if a given time falls within the configured shift
   * @param {Date} dateTime - Date/time to check
   * @param {Object} preferences - User preferences
   * @returns {boolean} True if within shift hours
   */
  function isWithinShift(dateTime, preferences) {
    const { start, end } = getShiftBoundaries(preferences, dateTime);
    return dateTime >= start && dateTime <= end;
  }

  // Public API
  return {
    load,
    save,
    get,
    getDefaults,
    reset,
    updateSection,
    completeSetup,
    shouldShowWarning,
    exportPreferences,
    importPreferences,
    getEffectiveShiftTimezone,
    getEffectiveUserTimezone,
    getEffectiveSalesforceTimezone,
    getShiftBoundaries,
    isWithinShift,
    DEFAULTS,
    VERSION
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserPreferences;
}
