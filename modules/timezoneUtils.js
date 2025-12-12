/**
 * Timezone Utilities Module
 * Core timezone conversion and formatting utilities for Chrome Extension MV3
 *
 * @module TimezoneUtils
 */

const TimezoneUtils = (() => {
  'use strict';

  // ============================================================================
  // Constants
  // ============================================================================

  const DEFAULT_AWAKE_START = 7;
  const DEFAULT_AWAKE_END = 23;
  const DEFAULT_BUSINESS_START = 9;
  const DEFAULT_BUSINESS_END = 17;

  const STATUS_COLORS = {
    business: '#22c55e', // Green
    awake: '#eab308', // Yellow
    sleep: '#6b7280' // Gray
  };

  const COPY_FORMATS = {
    simple: {
      label: 'Simple',
      pattern: 'h:mm a',
      example: '9:00 AM'
    },
    military: {
      label: '24-Hour',
      pattern: 'HH:mm',
      example: '09:00'
    },
    iso: {
      label: 'ISO',
      pattern: "yyyy-MM-dd'T'HH:mm:ssXXX",
      example: '2024-01-15T09:00:00-05:00'
    },
    full: {
      label: 'Full',
      pattern: 'EEEE, MMMM d, yyyy h:mm a',
      example: 'Monday, January 15, 2024 9:00 AM'
    },
    short: {
      label: 'Short',
      pattern: 'MMM d, h:mm a',
      example: 'Jan 15, 9:00 AM'
    },
    dateOnly: {
      label: 'Date Only',
      pattern: 'MMM d, yyyy',
      example: 'Jan 15, 2024'
    }
  };

  // ============================================================================
  // Private Helper Functions
  // ============================================================================

  /**
   * Pads a number with leading zeros
   * @param {number} num - Number to pad
   * @param {number} size - Desired string length
   * @returns {string} Padded number string
   */
  function _padZero(num, size = 2) {
    return num.toString().padStart(size, '0');
  }

  /**
   * Gets the day of week name
   * @param {number} dayIndex - 0-6 (Sunday-Saturday)
   * @param {boolean} short - Return short form
   * @returns {string} Day name
   */
  function _getDayName(dayIndex, short = false) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return short ? shortDays[dayIndex] : days[dayIndex];
  }

  /**
   * Gets the month name
   * @param {number} monthIndex - 0-11 (Jan-Dec)
   * @param {boolean} short - Return short form
   * @returns {string} Month name
   */
  function _getMonthName(monthIndex, short = false) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return short ? shortMonths[monthIndex] : months[monthIndex];
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Gets all available IANA timezones supported by the browser
   * @returns {string[]} Array of timezone identifiers
   */
  function getAllTimezones() {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch (error) {
      console.warn('[TimezoneUtils] Failed to get supported timezones:', error);
      return [];
    }
  }

  /**
   * Gets the browser's current timezone
   * @returns {string} IANA timezone identifier
   */
  function getBrowserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.error('[TimezoneUtils] Failed to get browser timezone:', error);
      return 'UTC';
    }
  }

  /**
   * Gets the timezone abbreviation (e.g., "EST", "PST")
   * @param {Date} date - Reference date
   * @param {string} timezone - IANA timezone identifier
   * @returns {string} Timezone abbreviation
   */
  function getTimezoneAbbreviation(date, timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(date);
      const tzPart = parts.find((p) => p.type === 'timeZoneName');
      return tzPart?.value || '';
    } catch (error) {
      console.warn('[TimezoneUtils] Failed to get timezone abbreviation:', error);
      return '';
    }
  }

  /**
   * Gets the timezone offset string (e.g., "UTC-05:00")
   * @param {Date} date - Reference date
   * @param {string} timezone - IANA timezone identifier
   * @returns {string} Offset string
   */
  function getTimezoneOffset(date, timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
      });
      const parts = formatter.formatToParts(date);
      const tzPart = parts.find((p) => p.type === 'timeZoneName');
      return tzPart?.value?.replace('GMT', 'UTC') || 'UTC';
    } catch (error) {
      console.warn('[TimezoneUtils] Failed to get timezone offset:', error);
      return 'UTC';
    }
  }

  /**
   * Gets full timezone label with abbreviation and offset
   * @param {Date} date - Reference date
   * @param {string} timezone - IANA timezone identifier
   * @returns {string} Full label (e.g., "EST (UTC-05:00)")
   */
  function getFullTimezoneLabel(date, timezone) {
    const abbr = getTimezoneAbbreviation(date, timezone);
    const offset = getTimezoneOffset(date, timezone);

    if (abbr && abbr !== offset && !abbr.startsWith('GMT') && !abbr.startsWith('UTC')) {
      return `${abbr} (${offset})`;
    }
    return offset;
  }

  /**
   * Gets the hour in a specific timezone
   * @param {Date} date - Reference date
   * @param {string} timezone - IANA timezone identifier
   * @returns {number} Hour (0-23)
   */
  function getHourInTimezone(date, timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
      });
      const hourStr = formatter.format(date);
      return parseInt(hourStr, 10) % 24; // Handle "24" edge case
    } catch (error) {
      console.error('[TimezoneUtils] Failed to get hour in timezone:', error);
      return 0;
    }
  }

  /**
   * Gets the time components in a specific timezone
   * @param {Date} date - Reference date
   * @param {string} timezone - IANA timezone identifier
   * @returns {Object} Time components {year, month, day, hour, minute, second, dayOfWeek}
   */
  function getTimeComponents(date, timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        weekday: 'short'
      });

      const parts = formatter.formatToParts(date);
      const get = (type) => parts.find((p) => p.type === type)?.value || '0';

      return {
        year: parseInt(get('year'), 10),
        month: parseInt(get('month'), 10) - 1, // 0-indexed
        day: parseInt(get('day'), 10),
        hour: parseInt(get('hour'), 10) % 24,
        minute: parseInt(get('minute'), 10),
        second: parseInt(get('second'), 10),
        dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
      };
    } catch (error) {
      console.error('[TimezoneUtils] Failed to get time components:', error);
      return { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, dayOfWeek: 0 };
    }
  }

  /**
   * Formats a date in a specific timezone
   * @param {Date} date - Date to format
   * @param {string} timezone - IANA timezone identifier
   * @param {string} formatStr - Format pattern (simple subset)
   * @returns {string} Formatted date string
   */
  function formatInTimeZone(date, timezone, formatStr = 'HH:mm') {
    try {
      const c = getTimeComponents(date, timezone);
      const dayNameLong = _getDayName(c.dayOfWeek, false);
      const dayNameShort = _getDayName(c.dayOfWeek, true);
      const monthNameLong = _getMonthName(c.month, false);
      const monthNameShort = _getMonthName(c.month, true);
      const hour12 = c.hour === 0 ? 12 : c.hour > 12 ? c.hour - 12 : c.hour;

      // Replace numeric/time tokens first, then textual names to avoid single-letter collisions (e.g., "h" in "Thu").
      const replacements = [
        { t: 'yyyy', v: c.year.toString() },
        { t: 'yy',   v: (c.year % 100).toString().padStart(2, '0') },
        { t: 'MM',   v: _padZero(c.month + 1) },
        { t: 'M',    v: (c.month + 1).toString() },
        { t: 'dd',   v: _padZero(c.day) },
        { t: 'd',    v: c.day.toString() },
        { t: 'HH',   v: _padZero(c.hour) },
        { t: 'H',    v: c.hour.toString() },
        { t: 'hh',   v: _padZero(hour12) },
        { t: 'h',    v: hour12.toString() },
        { t: 'mm',   v: _padZero(c.minute) },
        { t: 'ss',   v: _padZero(c.second) },
        { t: 'a',    v: c.hour < 12 ? 'AM' : 'PM' },
        { t: 'EEEE', v: dayNameLong },
        { t: 'EEE',  v: dayNameShort },
        { t: 'MMMM', v: monthNameLong },
        { t: 'MMM',  v: monthNameShort }
      ];

      let result = formatStr;
      for (const { t, v } of replacements) {
        result = result.replace(new RegExp(t, 'g'), v);
      }
      return result;
    } catch (error) {
      console.error('[TimezoneUtils] Failed to format date:', error);
      return '';
    }
  }

  /**
   * Formats time for display (HH:mm)
   * @param {Date} date - Date to format
   * @param {string} timezone - IANA timezone identifier
   * @returns {string} Formatted time
   */
  function formatTimeForDisplay(date, timezone) {
    return formatInTimeZone(date, timezone, 'HH:mm');
  }

  /**
   * Formats date for display (EEE, MMM d)
   * @param {Date} date - Date to format
   * @param {string} timezone - IANA timezone identifier
   * @returns {string} Formatted date
   */
  function formatDateForDisplay(date, timezone) {
    return formatInTimeZone(date, timezone, 'EEE, MMM d');
  }

  /**
   * Gets the status type based on hour
   * @param {number} hour - Hour (0-23)
   * @param {number} awakeStart - Awake start hour
   * @param {number} awakeEnd - Awake end hour
   * @param {number} businessStart - Business start hour
   * @param {number} businessEnd - Business end hour
   * @returns {'business'|'awake'|'sleep'} Status type
   */
  function getTimeStatus(hour, awakeStart = DEFAULT_AWAKE_START, awakeEnd = DEFAULT_AWAKE_END, businessStart = DEFAULT_BUSINESS_START, businessEnd = DEFAULT_BUSINESS_END) {
    if (hour >= businessStart && hour < businessEnd) {
      return 'business';
    }
    if ((hour >= awakeStart && hour < businessStart) || (hour >= businessEnd && hour <= awakeEnd)) {
      return 'awake';
    }
    return 'sleep';
  }

  /**
   * Gets the status color
   * @param {'business'|'awake'|'sleep'} status - Status type
   * @returns {string} Color hex code
   */
  function getStatusColor(status) {
    return STATUS_COLORS[status] || STATUS_COLORS.sleep;
  }

  /**
   * Converts time to a target timezone
   * @param {Date} sourceDate - Source date
   * @param {string} targetTimezone - Target IANA timezone
   * @param {Object} config - Optional configuration
   * @returns {Object} Conversion result
   */
  function convertTime(sourceDate, targetTimezone, config = {}) {
    const hour = getHourInTimezone(sourceDate, targetTimezone);
    const status = getTimeStatus(hour, config.awakeStart, config.awakeEnd, config.businessStart, config.businessEnd);

    return {
      timezone: targetTimezone,
      date: sourceDate,
      formatted: formatTimeForDisplay(sourceDate, targetTimezone),
      hour,
      status
    };
  }

  /**
   * Calculates the overlap status for multiple timezones
   * @param {Date} date - Reference date
   * @param {Array} zones - Array of {timezone, config?}
   * @returns {'business'|'awake'|'sleep'} Overall status
   */
  function calculateOverlapStatus(date, zones) {
    const statuses = zones.map((zone) => {
      const result = convertTime(date, zone.timezone, zone.config || {});
      return result.status;
    });

    if (statuses.every((s) => s === 'business')) {
      return 'business';
    }
    if (statuses.some((s) => s === 'sleep')) {
      return 'sleep';
    }
    return 'awake';
  }

  /**
   * Checks for upcoming DST changes
   * @param {string} timezone - IANA timezone identifier
   * @param {number} daysAhead - Days to check ahead
   * @returns {Object|null} DST info or null
   */
  function checkUpcomingDST(timezone, daysAhead = 14) {
    try {
      const now = new Date();
      const currentOffset = getTimezoneOffset(now, timezone);

      for (let i = 1; i <= daysAhead; i++) {
        const futureDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        const futureOffset = getTimezoneOffset(futureDate, timezone);

        if (currentOffset !== futureOffset) {
          return {
            date: futureDate,
            fromOffset: currentOffset,
            toOffset: futureOffset,
            daysUntil: i
          };
        }
      }
      return null;
    } catch (error) {
      console.warn('[TimezoneUtils] Failed to check DST:', error);
      return null;
    }
  }

  /**
   * Creates a date at a specific time in a timezone
   * @param {string} timezone - IANA timezone identifier
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @param {number} day - Day
   * @param {number} hour - Hour
   * @param {number} minute - Minute
   * @returns {Date} UTC Date object
   */
  function createDateInTimezone(timezone, year, month, day, hour = 0, minute = 0) {
    try {
      const dateStr = `${year}-${_padZero(month + 1)}-${_padZero(day)}T${_padZero(hour)}:${_padZero(minute)}:00`;

      const tempDate = new Date(`${dateStr}Z`);
      const localParts = getTimeComponents(tempDate, timezone);

      const utcMs = tempDate.getTime();
      const localMs = Date.UTC(localParts.year, localParts.month, localParts.day, localParts.hour, localParts.minute, localParts.second);
      const offsetMs = localMs - utcMs;

      const targetLocal = Date.UTC(year, month, day, hour, minute, 0);
      return new Date(targetLocal - offsetMs);
    } catch (error) {
      console.error('[TimezoneUtils] Failed to create date in timezone:', error);
      return new Date();
    }
  }

  /**
   * Snaps a date to the nearest interval
   * @param {Date} date - Date to snap
   * @param {number} intervalMinutes - Interval in minutes
   * @returns {Date} Snapped date
   */
  function snapToInterval(date, intervalMinutes = 10) {
    const ms = date.getTime();
    const intervalMs = intervalMinutes * 60 * 1000;
    return new Date(Math.round(ms / intervalMs) * intervalMs);
  }

  // ============================================================================
  // Module Export
  // ============================================================================

  return {
    DEFAULT_AWAKE_START,
    DEFAULT_AWAKE_END,
    DEFAULT_BUSINESS_START,
    DEFAULT_BUSINESS_END,
    STATUS_COLORS,
    COPY_FORMATS,
    getAllTimezones,
    getBrowserTimezone,
    getTimezoneAbbreviation,
    getTimezoneOffset,
    getFullTimezoneLabel,
    getHourInTimezone,
    getTimeComponents,
    formatInTimeZone,
    formatTimeForDisplay,
    formatDateForDisplay,
    getTimeStatus,
    getStatusColor,
    convertTime,
    calculateOverlapStatus,
    checkUpcomingDST,
    createDateInTimezone,
    snapToInterval
  };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimezoneUtils;
}
