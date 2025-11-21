/**
 * Timezone Converter Module
 * Provides timezone conversion utilities for displaying times in multiple timezones
 * Compares case timezone, user timezone, and UTC
 * 
 * @module timezoneConverter
 */

const TimezoneConverter = (function() {
  'use strict';

  /**
   * Convert date between timezones
   * @param {Date|string} date - Date to convert
   * @param {string} fromTimezone - Source timezone (IANA) or null for UTC
   * @param {string} toTimezone - Target timezone (IANA)
   * @returns {Date} Converted date
   */
  function convertTime(date, fromTimezone, toTimezone) {
    if (!date) return null;
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.warn('[TimezoneConverter] Invalid date provided:', date);
      return null;
    }

    if (!toTimezone || toTimezone === 'UTC') {
      // Convert to UTC
      return new Date(dateObj.toISOString());
    }

    try {
      // Use Intl.DateTimeFormat for accurate timezone conversion
      // Format the date in the target timezone, then parse it back
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: toTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(dateObj);
      const year = parseInt(parts.find(p => p.type === 'year').value);
      const month = parseInt(parts.find(p => p.type === 'month').value) - 1; // 0-indexed
      const day = parseInt(parts.find(p => p.type === 'day').value);
      const hour = parseInt(parts.find(p => p.type === 'hour').value);
      const minute = parseInt(parts.find(p => p.type === 'minute').value);
      const second = parseInt(parts.find(p => p.type === 'second').value);

      // Create date in target timezone
      return new Date(year, month, day, hour, minute, second);
    } catch (error) {
      console.error('[TimezoneConverter] Error converting time:', error);
      return dateObj; // Fallback to original date
    }
  }

  /**
   * Format time for display in specific timezone
   * @param {Date} date - Date to format
   * @param {string} timezone - Target timezone (IANA) or 'UTC'
   * @param {Object} options - Formatting options
   * @param {boolean} options.includeDate - Include date in output
   * @param {boolean} options.includeSeconds - Include seconds
   * @param {boolean} options.hour12 - Use 12-hour format
   * @returns {string} Formatted time string
   */
  function formatTimeForTimezone(date, timezone, options = {}) {
    if (!date) return 'N/A';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    const {
      includeDate = false,
      includeSeconds = false,
      hour12 = false
    } = options;

    try {
      const formatOptions = {
        timeZone: timezone === 'UTC' ? 'UTC' : timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: hour12
      };

      if (includeDate) {
        formatOptions.year = 'numeric';
        formatOptions.month = 'short';
        formatOptions.day = 'numeric';
      }

      if (includeSeconds) {
        formatOptions.second = '2-digit';
      }

      const formatter = new Intl.DateTimeFormat('en-US', formatOptions);
      let formatted = formatter.format(dateObj);

      // Add timezone abbreviation
      const tzAbbr = getTimezoneAbbreviation(timezone, dateObj);
      if (tzAbbr) {
        formatted += ` ${tzAbbr}`;
      }

      return formatted;
    } catch (error) {
      console.error('[TimezoneConverter] Error formatting time:', error);
      return dateObj.toISOString();
    }
  }

  /**
   * Format date portion for timezone
   * @param {Date} date - Date to format
   * @param {string} timezone - Target timezone (IANA)
   * @returns {string} Formatted date string
   */
  function formatDateForTimezone(date, timezone) {
    if (!date) return 'N/A';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone === 'UTC' ? 'UTC' : timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      return formatter.format(dateObj);
    } catch (error) {
      console.error('[TimezoneConverter] Error formatting date:', error);
      return dateObj.toLocaleDateString();
    }
  }

  /**
   * Get timezone abbreviation (SGT, MYT, EST, etc.)
   * @param {string} timezone - IANA timezone identifier
   * @param {Date} date - Date to get abbreviation for (for DST handling)
   * @returns {string} Timezone abbreviation
   */
  function getTimezoneAbbreviation(timezone, date = new Date()) {
    if (!timezone || timezone === 'UTC') {
      return 'UTC';
    }

    try {
      // Use Intl.DateTimeFormat to get timezone name
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      });

      const parts = formatter.formatToParts(date);
      const tzName = parts.find(p => p.type === 'timeZoneName');
      return tzName ? tzName.value : timezone.split('/').pop().replace(/_/g, ' ');
    } catch (error) {
      console.warn('[TimezoneConverter] Error getting timezone abbreviation:', error);
      return timezone.split('/').pop() || 'UTC';
    }
  }

  /**
   * Get human-readable timezone display name
   * @param {string} timezone - IANA timezone identifier
   * @returns {string} Display name
   */
  function getTimezoneDisplayName(timezone) {
    if (!timezone || timezone === 'UTC') {
      return 'UTC';
    }

    // Common timezone display names
    const displayNames = {
      'Asia/Kuala_Lumpur': 'Malaysia (MYT)',
      'Asia/Singapore': 'Singapore (SGT)',
      'Asia/Manila': 'Philippines (PHT)',
      'Asia/Kolkata': 'India (IST)',
      'Europe/London': 'London (GMT/BST)',
      'America/New_York': 'Eastern Time (ET)',
      'America/Chicago': 'Central Time (CT)',
      'America/Los_Angeles': 'Pacific Time (PT)',
      'Australia/Sydney': 'Sydney (AEDT/AEST)'
    };

    if (displayNames[timezone]) {
      return displayNames[timezone];
    }

    // Fallback: Format timezone string nicely
    return timezone.split('/').map(part => 
      part.replace(/_/g, ' ')
    ).join(' - ');
  }

  /**
   * Get UTC offset for timezone
   * @param {string} timezone - IANA timezone identifier
   * @param {Date} date - Date to get offset for (for DST)
   * @returns {string} Offset string (e.g., "+08:00", "-05:00")
   */
  function getTimezoneOffset(timezone, date = new Date()) {
    if (!timezone || timezone === 'UTC') {
      return '+00:00';
    }

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
      });

      const parts = formatter.formatToParts(date);
      const offset = parts.find(p => p.type === 'timeZoneName');
      
      if (offset) {
        // Extract offset from string like "GMT+08:00"
        const match = offset.value.match(/([+-]\d{2}):(\d{2})/);
        if (match) {
          return match[0];
        }
      }

      // Fallback: Calculate offset manually
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      const offsetMs = tzDate - utcDate;
      const offsetHours = Math.floor(Math.abs(offsetMs) / (1000 * 60 * 60));
      const offsetMinutes = Math.floor((Math.abs(offsetMs) % (1000 * 60 * 60)) / (1000 * 60));
      const sign = offsetMs >= 0 ? '+' : '-';
      
      return `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
    } catch (error) {
      console.warn('[TimezoneConverter] Error getting timezone offset:', error);
      return '+00:00';
    }
  }

  /**
   * Get available dates from case data and refresh info
   * @param {Object} caseData - Case data object
   * @param {Object} refreshInfo - Analytics refresh info from URLBuilder
   * @returns {Array} Array of date options { label: string, value: string, date: Date }
   */
  function getAvailableDates(caseData, refreshInfo) {
    const dates = [];

    // Always include Today (current date/time) as first option
    dates.push({
      label: 'Today',
      value: 'today',
      date: new Date()
    });

    // Always include Analytics Refresh (default)
    if (refreshInfo && refreshInfo.utc) {
      // Parse UTC time from refreshInfo.utc (format: "HH:MM UTC")
      const utcMatch = refreshInfo.utc.match(/(\d{2}):(\d{2})/);
      if (utcMatch) {
        const now = new Date();
        const [hours, minutes] = utcMatch.slice(1).map(Number);
        
        // Create refresh time in UTC
        const refreshTime = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          hours,
          minutes
        ));

        // If refresh time has passed today, use tomorrow
        if (refreshTime < now) {
          refreshTime.setUTCDate(refreshTime.getUTCDate() + 1);
        }

        dates.push({
          label: 'Next Analytics Refresh',
          value: 'analytics_refresh',
          date: refreshTime
        });
      }
    }

    // Case Created Date
    if (caseData && caseData.caseCreatedDate) {
      const createdDate = parseSalesforceDate(caseData.caseCreatedDate);
      if (createdDate) {
        dates.push({
          label: 'Case Created Date',
          value: 'case_created',
          date: createdDate
        });
      }
    }

    // Case Closed Date
    if (caseData && caseData.caseClosedOn) {
      const closedDate = parseSalesforceDate(caseData.caseClosedOn);
      if (closedDate) {
        dates.push({
          label: 'Case Closed Date',
          value: 'case_closed',
          date: closedDate
        });
      }
    }

    // Case Last Modified
    if (caseData && caseData.lastModifiedDate) {
      const modifiedDate = parseSalesforceDate(caseData.lastModifiedDate);
      if (modifiedDate) {
        dates.push({
          label: 'Case Last Modified',
          value: 'case_modified',
          date: modifiedDate
        });
      }
    }

    return dates;
  }

  /**
   * Parse Salesforce date format
   * Handles various Salesforce date/time formats
   * @param {string} dateString - Date string from Salesforce
   * @returns {Date|null} Parsed date or null
   */
  function parseSalesforceDate(dateString) {
    if (!dateString) return null;

    try {
      // Try ISO format first
      const isoDate = new Date(dateString);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }

      // Try common Salesforce formats
      // Format: "12/15/2024 2:30 PM" or "12/15/2024, 2:30 PM"
      const formats = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*,?\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i,
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        /(\d{4})-(\d{2})-(\d{2})\s*(\d{2}):(\d{2}):(\d{2})/
      ];

      for (const format of formats) {
        const match = dateString.match(format);
        if (match) {
          if (match[6]) {
            // Has AM/PM
            let hours = parseInt(match[4]);
            const minutes = parseInt(match[5]);
            const ampm = match[6].toUpperCase();
            
            if (ampm === 'PM' && hours !== 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;

            return new Date(
              parseInt(match[3]),
              parseInt(match[1]) - 1,
              parseInt(match[2]),
              hours,
              minutes
            );
          } else if (match[4]) {
            // 24-hour format
            return new Date(
              parseInt(match[1]),
              parseInt(match[2]) - 1,
              parseInt(match[3]),
              parseInt(match[4]),
              parseInt(match[5]),
              parseInt(match[6] || 0)
            );
          } else {
            // Date only
            return new Date(
              parseInt(match[3]),
              parseInt(match[1]) - 1,
              parseInt(match[2])
            );
          }
        }
      }

      // Last resort: try Date constructor
      const fallback = new Date(dateString);
      if (!isNaN(fallback.getTime())) {
        return fallback;
      }

      console.warn('[TimezoneConverter] Could not parse date:', dateString);
      return null;
    } catch (error) {
      console.error('[TimezoneConverter] Error parsing date:', error);
      return null;
    }
  }

  /**
   * Resolve case timezone from case data
   * Priority: TimezoneStorage > InstitutionTimezoneManager > UTC fallback
   * @param {Object} caseData - Case data object
   * @returns {Promise<Object>} { timezone: string, displayName: string, source: string }
   */
  async function resolveCaseTimezone(caseData) {
    if (!caseData) {
      return {
        timezone: 'UTC',
        displayName: 'UTC',
        source: 'fallback',
        isAuto: false
      };
    }

    try {
      // Try TimezoneStorage first
      if (typeof TimezoneStorage !== 'undefined') {
        const timezoneData = await TimezoneStorage.getTimezone({
          accountName: caseData.accountName,
          accountCode: caseData.exLibrisAccountNumber,
          institutionCode: caseData.institutionCode,
          customerId: caseData.custID,
          instID: caseData.instID
        });

        if (timezoneData && timezoneData.timezone) {
          return {
            timezone: timezoneData.timezone,
            displayName: getTimezoneDisplayName(timezoneData.timezone),
            source: timezoneData.source || 'storage',
            isAuto: false
          };
        }
      }

      // Fallback to InstitutionTimezoneManager
      if (typeof InstitutionTimezoneManager !== 'undefined' && caseData.institutionCode) {
        const instResult = InstitutionTimezoneManager.getTimezone({
          orgCode: caseData.institutionCode,
          customerId: caseData.custID,
          institutionId: caseData.instID
        });

        if (instResult && instResult.timezone) {
          return {
            timezone: instResult.timezone,
            displayName: getTimezoneDisplayName(instResult.timezone),
            source: 'institution',
            isAuto: false
          };
        }
      }

      // UTC fallback
      return {
        timezone: 'UTC',
        displayName: 'UTC',
        source: 'fallback',
        isAuto: false
      };
    } catch (error) {
      console.error('[TimezoneConverter] Error resolving case timezone:', error);
      return {
        timezone: 'UTC',
        displayName: 'UTC',
        source: 'fallback',
        isAuto: false
      };
    }
  }

  /**
   * Resolve user timezone from UserPreferences
   * @returns {Promise<Object>} { timezone: string, displayName: string, isAuto: boolean }
   */
  async function resolveUserTimezone() {
    try {
      if (typeof UserPreferences !== 'undefined') {
        const prefs = await UserPreferences.get();
        const userTz = UserPreferences.getEffectiveUserTimezone(prefs);
        
        return {
          timezone: userTz,
          displayName: getTimezoneDisplayName(userTz),
          isAuto: prefs.userTimezone.auto,
          source: prefs.userTimezone.auto ? 'auto' : 'manual'
        };
      }

      // Fallback to browser detection
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return {
        timezone: browserTz,
        displayName: getTimezoneDisplayName(browserTz),
        isAuto: true,
        source: 'browser'
      };
    } catch (error) {
      console.error('[TimezoneConverter] Error resolving user timezone:', error);
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return {
        timezone: browserTz,
        displayName: getTimezoneDisplayName(browserTz),
        isAuto: true,
        source: 'browser'
      };
    }
  }

  /**
   * Resolve server timezone from server region
   * @param {string} serverRegion - Server region (AP, EU, NA, CN, CA)
   * @returns {Object} { timezone: string, displayName: string, isAuto: boolean }
   */
  function resolveServerTimezone(serverRegion) {
    if (!serverRegion) {
      return {
        timezone: 'UTC',
        displayName: 'UTC',
        isAuto: true,
        source: 'fallback'
      };
    }

    // Map server regions to representative timezones
    const regionToTimezoneMap = {
      'NA': 'America/New_York',   // North America (Eastern)
      'EU': 'Europe/London',      // Europe (London)
      'AP': 'Asia/Singapore',     // Asia Pacific (Singapore)
      'CN': 'Asia/Shanghai',      // China
      'CA': 'America/Toronto'     // Canada (Eastern)
    };

    const region = serverRegion.toUpperCase();
    const timezone = regionToTimezoneMap[region] || 'UTC';

    return {
      timezone: timezone,
      displayName: getTimezoneDisplayName(timezone),
      isAuto: false,
      source: 'server_region',
      abbreviation: getTimezoneAbbreviation(timezone),
      offset: getTimezoneOffset(timezone)
    };
  }

  /**
   * Convert date to all four timezones (Case, User, Server, UTC)
   * @param {Date} date - Date to convert
   * @param {string} caseTimezone - Case timezone (IANA)
   * @param {string} userTimezone - User timezone (IANA)
   * @param {string} serverTimezone - Server timezone (IANA)
   * @returns {Object} Conversions for all four timezones
   */
  function convertToAllTimezones(date, caseTimezone, userTimezone, serverTimezone) {
    if (!date) {
      return {
        case: { date: null, time: 'N/A', dateStr: 'N/A', time24: 'N/A', ampm: 'N/A' },
        user: { date: null, time: 'N/A', dateStr: 'N/A', time24: 'N/A', ampm: 'N/A' },
        server: { date: null, time: 'N/A', dateStr: 'N/A', time24: 'N/A', ampm: 'N/A' },
        utc: { date: null, time: 'N/A', dateStr: 'N/A', time24: 'N/A', ampm: 'N/A' }
      };
    }

    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return {
        case: { date: null, time: 'Invalid Date', dateStr: 'Invalid Date', time24: 'Invalid Date', ampm: 'N/A' },
        user: { date: null, time: 'Invalid Date', dateStr: 'Invalid Date', time24: 'Invalid Date', ampm: 'N/A' },
        server: { date: null, time: 'Invalid Date', dateStr: 'Invalid Date', time24: 'Invalid Date', ampm: 'N/A' },
        utc: { date: null, time: 'Invalid Date', dateStr: 'Invalid Date', time24: 'Invalid Date', ampm: 'N/A' }
      };
    }

    const formatTimezoneData = (tz) => {
      const time24 = formatTimeForTimezone(dateObj, tz, { includeSeconds: false, hour12: false });
      const time12 = formatTimeForTimezone(dateObj, tz, { includeSeconds: false, hour12: true });
      const ampm = new Intl.DateTimeFormat('en-US', { 
        hour: 'numeric', 
        hour12: true, 
        timeZone: tz 
      }).format(dateObj).match(/([AP]M)/)?.[1] || '';
      
      return {
        date: dateObj,
        time: time12,
        time24: time24,
        ampm: ampm,
        dateStr: formatDateForTimezone(dateObj, tz),
        timezone: tz,
        displayName: getTimezoneDisplayName(tz),
        abbreviation: getTimezoneAbbreviation(tz),
        offset: getTimezoneOffset(tz)
      };
    };

    return {
      case: formatTimezoneData(caseTimezone),
      user: formatTimezoneData(userTimezone),
      server: formatTimezoneData(serverTimezone || 'UTC'),
      utc: formatTimezoneData('UTC')
    };
  }

  /**
   * Format date to Kibana-compatible string
   * Format: "Nov 17, 2025 @ 23:30:00.000"
   * @param {Date} date - Date to format
   * @param {string} timezone - Timezone for formatting
   * @returns {string} Formatted date string
   */
  function formatToKibana(date, timezone) {
    if (!date || isNaN(date.getTime())) return 'N/A';

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: timezone === 'UTC' ? 'UTC' : timezone
      });

      const parts = formatter.formatToParts(date);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      const hour = parts.find(p => p.type === 'hour')?.value;
      const minute = parts.find(p => p.type === 'minute')?.value;
      const second = parts.find(p => p.type === 'second')?.value;
      const ms = date.getMilliseconds().toString().padStart(3, '0');

      return `${month} ${day}, ${year} @ ${hour}:${minute}:${second}.${ms}`;
    } catch (error) {
      console.error('[TimezoneConverter] Error formatting to Kibana format:', error);
      return 'N/A';
    }
  }

  /**
   * Format date to ISO 8601 string
   * Format: "2025-11-17T23:30:00.000Z"
   * @param {Date} date - Date to format
   * @param {string} timezone - Timezone for formatting
   * @returns {string} ISO 8601 formatted string
   */
  function formatToISO8601(date, timezone) {
    if (!date || isNaN(date.getTime())) return 'N/A';

    try {
      // Convert to target timezone first
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: timezone === 'UTC' ? 'UTC' : timezone
      });

      const parts = formatter.formatToParts(date);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      const hour = parts.find(p => p.type === 'hour')?.value;
      const minute = parts.find(p => p.type === 'minute')?.value;
      const second = parts.find(p => p.type === 'second')?.value;
      const ms = date.getMilliseconds().toString().padStart(3, '0');

      // Create date in target timezone and convert to UTC ISO string
      const tzDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}`);
      const offset = tzDate.getTimezoneOffset();
      const utcDate = new Date(tzDate.getTime() - (offset * 60 * 1000));
      
      return utcDate.toISOString();
    } catch (error) {
      console.error('[TimezoneConverter] Error formatting to ISO 8601:', error);
      return date.toISOString();
    }
  }

  /**
   * Format date to Unix timestamp (seconds)
   * @param {Date} date - Date to format
   * @returns {string} Unix timestamp
   */
  function formatToUnixTimestamp(date) {
    if (!date || isNaN(date.getTime())) return 'N/A';
    return Math.floor(date.getTime() / 1000).toString();
  }

  /**
   * Format date to Unix timestamp (milliseconds)
   * @param {Date} date - Date to format
   * @returns {string} Unix timestamp in milliseconds
   */
  function formatToUnixTimestampMs(date) {
    if (!date || isNaN(date.getTime())) return 'N/A';
    return date.getTime().toString();
  }

  // Public API
  return {
    convertTime,
    formatTimeForTimezone,
    formatDateForTimezone,
    getTimezoneAbbreviation,
    getTimezoneDisplayName,
    getTimezoneOffset,
    getAvailableDates,
    parseSalesforceDate,
    resolveCaseTimezone,
    resolveUserTimezone,
    resolveServerTimezone,
    convertToAllTimezones,
    formatToKibana,
    formatToISO8601,
    formatToUnixTimestamp,
    formatToUnixTimestampMs
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezoneConverter;
}

