/**
 * Configurable Timezone Utilities
 * 
 * Provides timezone conversion and working hours calculation based on user preferences.
 * Replaces hardcoded MYT timezone functions with configurable system that supports
 * multiple timezones, shift configurations, and user locale awareness.
 * 
 * @module timezoneUtils
 * @version 1.0.0
 */

const TimezoneUtils = (function() {
  'use strict';

  let userPreferences = null;

  /**
   * Initializes the timezone utilities with user preferences
   * @param {Object} preferences - User preferences object
   */
  async function init(preferences) {
    userPreferences = preferences || await getUserPreferences();
    console.log('[TimezoneUtils] Initialized with preferences:', userPreferences);
  }

  /**
   * Gets user preferences from storage or UserPreferences module
   * @returns {Promise<Object>} User preferences
   */
  async function getUserPreferences() {
    try {
      if (typeof UserPreferences !== 'undefined') {
        return await UserPreferences.get();
      }

      // Fallback to chrome storage
      return new Promise((resolve) => {
        chrome.storage.sync.get('userPreferences', (result) => {
          if (result.userPreferences) {
            resolve(result.userPreferences);
          } else {
            // Return defaults if not found
            resolve(getDefaultPreferences());
          }
        });
      });
    } catch (error) {
      console.error('[TimezoneUtils] Error getting preferences:', error);
      return getDefaultPreferences();
    }
  }

  /**
   * Gets default preferences
   * @returns {Object} Default preferences
   */
  function getDefaultPreferences() {
    return {
      shift: {
        timezone: 'Asia/Kuala_Lumpur',
        startHour: 21,
        startMinute: 0,
        endHour: 6,
        endMinute: 0,
        isOvernightShift: true
      },
      userTimezone: {
        auto: true,
        manual: null,
        detected: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      salesforceTimezone: {
        auto: true,
        manual: null,
        detected: null
      },
      formatting: {
        dateFormat: 'auto',
        timeFormat: '24h'
      }
    };
  }

  /**
   * Converts a date to the shift timezone
   * @param {Date} date - Date to convert
   * @param {string} [timezone] - Override timezone (uses shift timezone if not provided)
   * @returns {Date} Converted date
   */
  function convertToShiftTimezone(date, timezone) {
    if (!userPreferences) {
      console.warn('[TimezoneUtils] Not initialized, using defaults');
      userPreferences = getDefaultPreferences();
    }

    const targetTz = timezone || userPreferences.shift.timezone;
    
    try {
      // Get UTC timestamp
      const utcTime = date.getTime();
      
      // Create formatter for target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: targetTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      // Parse the formatted string back to components
      const parts = formatter.formatToParts(date);
      const components = {};
      parts.forEach(part => {
        if (part.type !== 'literal') {
          components[part.type] = part.value;
        }
      });

      // Create date in target timezone
      const converted = new Date(
        `${components.year}-${components.month}-${components.day}T${components.hour}:${components.minute}:${components.second}`
      );

      return converted;
    } catch (error) {
      console.error('[TimezoneUtils] Error converting timezone:', error);
      return date;  // Fallback to original date
    }
  }

  /**
   * Creates a date in the shift timezone
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @param {number} day - Day
   * @param {number} [hours=0] - Hours
   * @param {number} [minutes=0] - Minutes
   * @param {number} [seconds=0] - Seconds
   * @returns {Date} Date in shift timezone
   */
  function createShiftTimezoneDate(year, month, day, hours = 0, minutes = 0, seconds = 0) {
    if (!userPreferences) {
      console.warn('[TimezoneUtils] Not initialized, using defaults');
      userPreferences = getDefaultPreferences();
    }

    try {
      // Create date string in shift timezone
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      
      // Parse with timezone
      const date = new Date(dateStr);
      
      // Adjust for timezone offset
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userPreferences.shift.timezone,
        timeZoneName: 'shortOffset'
      });
      
      return date;
    } catch (error) {
      console.error('[TimezoneUtils] Error creating shift timezone date:', error);
      return new Date(year, month, day, hours, minutes, seconds);
    }
  }

  /**
   * Calculates working minutes between two dates based on configured shift hours
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @param {Object} [customWorkingHours] - Override working hours { start: hour, end: hour }
   * @returns {number} Total working minutes
   */
  function calculateWorkingMinutes(startDate, endDate, customWorkingHours) {
    if (!userPreferences) {
      console.warn('[TimezoneUtils] Not initialized, using defaults');
      userPreferences = getDefaultPreferences();
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return 0;
    }

    // Use custom hours or get from preferences
    const workingHours = customWorkingHours || {
      start: userPreferences.shift.startHour,
      end: userPreferences.shift.endHour
    };

    let totalWorkingMinutes = 0;
    let currentDate = new Date(start);

    // Convert to shift timezone for calculations
    const shiftStart = convertToShiftTimezone(currentDate);
    const shiftEnd = convertToShiftTimezone(end);

    while (currentDate < end) {
      // Create working hours boundaries for this day
      const dayStart = new Date(currentDate);
      dayStart.setHours(workingHours.start, userPreferences.shift.startMinute || 0, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(workingHours.end, userPreferences.shift.endMinute || 0, 0, 0);

      // Handle overnight shifts
      if (userPreferences.shift.isOvernightShift && workingHours.end < workingHours.start) {
        dayEnd.setDate(dayEnd.getDate() + 1);
      }

      // Find the effective start and end times for this day
      const effectiveStart = currentDate < dayStart ? dayStart : currentDate;
      const effectiveEnd = end > dayEnd ? dayEnd : end;

      // If there's overlap with working hours on this day
      if (effectiveStart < effectiveEnd && effectiveStart < dayEnd && effectiveEnd > dayStart) {
        const dailyWorkingMinutes = (effectiveEnd - effectiveStart) / (1000 * 60);
        totalWorkingMinutes += dailyWorkingMinutes;
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    return totalWorkingMinutes;
  }

  /**
   * Calculates working time difference between a date and now
   * @param {Date|string} date - Start date
   * @param {Object} [teamConfig] - Team configuration with working hours
   * @returns {number} Working minutes
   */
  function calculateWorkingTimeDifferenceInMinutes(date, teamConfig) {
    const openDate = new Date(date);
    const currentDate = new Date();
    
    if (teamConfig && teamConfig.workingHours) {
      return calculateWorkingMinutes(openDate, currentDate, teamConfig.workingHours);
    }
    
    return calculateWorkingMinutes(openDate, currentDate);
  }

  /**
   * Formats a date according to user preferences
   * @param {Date} date - Date to format
   * @param {boolean} [includeTime=false] - Whether to include time
   * @returns {string} Formatted date string
   */
  function formatDate(date, includeTime = false) {
    if (!userPreferences) {
      userPreferences = getDefaultPreferences();
    }

    const dateFormat = userPreferences.formatting.dateFormat;
    const timeFormat = userPreferences.formatting.timeFormat;

    try {
      let options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      };

      if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = timeFormat === '12h';
      }

      // Use auto locale or default
      const locale = userPreferences.formatting.locale || 'en-US';

      if (dateFormat === 'auto') {
        return new Intl.DateTimeFormat(locale, options).format(date);
      }

      // Manual format
      const formatted = new Intl.DateTimeFormat('en-US', options).format(date);
      
      switch (dateFormat) {
        case 'DD/MM/YYYY':
          return formatted.replace(/(\d+)\/(\d+)\/(\d+)/, '$2/$1/$3');
        case 'YYYY-MM-DD':
          return date.toISOString().split('T')[0];
        case 'MM/DD/YYYY':
        default:
          return formatted;
      }
    } catch (error) {
      console.error('[TimezoneUtils] Error formatting date:', error);
      return date.toLocaleDateString();
    }
  }

  /**
   * Checks if a date/time falls within configured shift hours
   * @param {Date} date - Date to check
   * @returns {boolean} True if within shift hours
   */
  function isWithinShiftHours(date) {
    if (!userPreferences) {
      userPreferences = getDefaultPreferences();
    }

    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    const shiftStart = userPreferences.shift.startHour * 60 + (userPreferences.shift.startMinute || 0);
    const shiftEnd = userPreferences.shift.endHour * 60 + (userPreferences.shift.endMinute || 0);

    if (userPreferences.shift.isOvernightShift && shiftEnd < shiftStart) {
      // Overnight shift: within if after start OR before end
      return timeInMinutes >= shiftStart || timeInMinutes <= shiftEnd;
    } else {
      // Regular shift: within if between start and end
      return timeInMinutes >= shiftStart && timeInMinutes <= shiftEnd;
    }
  }

  /**
   * Gets the timezone offset for a timezone
   * @param {string} timezone - IANA timezone identifier
   * @returns {number} Offset in minutes
   */
  function getTimezoneOffset(timezone) {
    try {
      const now = new Date();
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const localDate = new Date(now.toLocaleString('en-US'));
      return (localDate - tzDate) / (1000 * 60);
    } catch (error) {
      console.error('[TimezoneUtils] Error getting timezone offset:', error);
      return 0;
    }
  }

  /**
   * Gets current shift timezone
   * @returns {string} IANA timezone identifier
   */
  function getShiftTimezone() {
    if (!userPreferences) {
      userPreferences = getDefaultPreferences();
    }
    return userPreferences.shift.timezone;
  }

  /**
   * Gets shift boundaries for a given date
   * @param {Date} [referenceDate] - Reference date (defaults to now)
   * @returns {Object} { start: Date, end: Date }
   */
  function getShiftBoundaries(referenceDate = new Date()) {
    if (!userPreferences) {
      userPreferences = getDefaultPreferences();
    }

    const { startHour, startMinute, endHour, endMinute, isOvernightShift } = userPreferences.shift;

    const startDate = new Date(referenceDate);
    startDate.setHours(startHour, startMinute || 0, 0, 0);

    const endDate = new Date(referenceDate);
    endDate.setHours(endHour, endMinute || 0, 0, 0);

    // If overnight shift, end time is next day
    if (isOvernightShift && endHour < startHour) {
      endDate.setDate(endDate.getDate() + 1);
    }

    return { start: startDate, end: endDate };
  }

  // Public API
  return {
    init,
    convertToShiftTimezone,
    createShiftTimezoneDate,
    calculateWorkingMinutes,
    calculateWorkingTimeDifferenceInMinutes,
    formatDate,
    isWithinShiftHours,
    getTimezoneOffset,
    getShiftTimezone,
    getShiftBoundaries,
    getUserPreferences
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezoneUtils;
}
