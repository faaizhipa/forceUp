/**
 * TimezoneNormalizer Module
 * Normalizes non-standard timezone values to valid IANA timezone identifiers
 * 
 * Purpose:
 * - Convert country codes/abbreviations (e.g., "US", "UK") to IANA format
 * - Use geographic context (city, country) for accurate resolution
 * - Provide consistent timezone formatting for display
 * - Calculate timezone offsets for time conversions
 * 
 * @module timezoneNormalizer
 */

const TimezoneNormalizer = (function() {
  'use strict';

  // ========== CONSTANTS ==========

  /**
   * Map of non-IANA timezone values to IANA timezone identifiers
   * Based on common patterns in customerMasterList.json
   */
  const TIMEZONE_MAPPINGS = {
    // Country codes to default IANA timezones
    'US': 'America/New_York',      // Default to Eastern Time
    'USA': 'America/New_York',
    'UK': 'Europe/London',
    'GB': 'Europe/London',
    'AU': 'Australia/Sydney',
    'AUS': 'Australia/Sydney',
    'CA': 'America/Toronto',
    'CAN': 'America/Toronto',
    'DE': 'Europe/Berlin',
    'FR': 'Europe/Paris',
    'JP': 'Asia/Tokyo',
    'CN': 'Asia/Shanghai',
    'IN': 'Asia/Kolkata',
    'SG': 'Asia/Singapore',
    'HK': 'Asia/Hong_Kong',
    'NZ': 'Pacific/Auckland',
    'IL': 'Asia/Jerusalem',
    'AE': 'Asia/Dubai',
    'ZA': 'Africa/Johannesburg',
    'BR': 'America/Sao_Paulo',
    'MX': 'America/Mexico_City',
    'KR': 'Asia/Seoul',
    'TW': 'Asia/Taipei',
    'TH': 'Asia/Bangkok',
    'MY': 'Asia/Kuala_Lumpur',
    'PH': 'Asia/Manila',
    'ID': 'Asia/Jakarta',
    'VN': 'Asia/Ho_Chi_Minh',
    'NL': 'Europe/Amsterdam',
    'BE': 'Europe/Brussels',
    'CH': 'Europe/Zurich',
    'AT': 'Europe/Vienna',
    'ES': 'Europe/Madrid',
    'IT': 'Europe/Rome',
    'PT': 'Europe/Lisbon',
    'PL': 'Europe/Warsaw',
    'SE': 'Europe/Stockholm',
    'NO': 'Europe/Oslo',
    'DK': 'Europe/Copenhagen',
    'FI': 'Europe/Helsinki',
    'IE': 'Europe/Dublin',
    'GR': 'Europe/Athens',
    'CZ': 'Europe/Prague',
    'RO': 'Europe/Bucharest',
    'HU': 'Europe/Budapest',
    'RU': 'Europe/Moscow',
    'TR': 'Europe/Istanbul',
    'SA': 'Asia/Riyadh',
    'EG': 'Africa/Cairo',
    'NG': 'Africa/Lagos',
    'KE': 'Africa/Nairobi',
    'AR': 'America/Buenos_Aires',
    'CL': 'America/Santiago',
    'CO': 'America/Bogota',
    'PE': 'America/Lima',
    
    // Common abbreviations
    'EST': 'America/New_York',
    'EDT': 'America/New_York',
    'PST': 'America/Los_Angeles',
    'PDT': 'America/Los_Angeles',
    'CST': 'America/Chicago',
    'CDT': 'America/Chicago',
    'MST': 'America/Denver',
    'MDT': 'America/Denver',
    'GMT': 'Europe/London',
    'BST': 'Europe/London',
    'CET': 'Europe/Paris',
    'CEST': 'Europe/Paris',
    'IST': 'Asia/Kolkata',
    'JST': 'Asia/Tokyo',
    'AEST': 'Australia/Sydney',
    'AEDT': 'Australia/Sydney',
    'AWST': 'Australia/Perth',
    
    // Canadian timezone abbreviations
    'NST': 'America/St_Johns',       // Newfoundland Standard Time
    'NDT': 'America/St_Johns',       // Newfoundland Daylight Time
    'AST': 'America/Halifax',        // Atlantic Standard Time
    'ADT': 'America/Halifax',        // Atlantic Daylight Time
    'ET': 'America/New_York',        // Eastern Time (generic)
    'CT': 'America/Chicago',         // Central Time (generic)
    'MT': 'America/Denver',          // Mountain Time (generic)
    'PT': 'America/Los_Angeles',     // Pacific Time (generic)
    
    // Special cases
    'UTC': 'UTC',
    'Etc/UTC': 'UTC',
    'Z': 'UTC'
  };

  /**
   * Country name to IANA timezone mappings
   * Used as fallback when timezone field is ambiguous
   */
  const COUNTRY_TO_TIMEZONE = {
    // English names
    'United States': 'America/New_York',
    'United States of America': 'America/New_York',
    'USA': 'America/New_York',
    'United Kingdom': 'Europe/London',
    'UK': 'Europe/London',
    'Great Britain': 'Europe/London',
    'England': 'Europe/London',
    'Canada': 'America/Toronto',
    'Australia': 'Australia/Sydney',
    'Germany': 'Europe/Berlin',
    'France': 'Europe/Paris',
    'Japan': 'Asia/Tokyo',
    'China': 'Asia/Shanghai',
    'India': 'Asia/Kolkata',
    'Singapore': 'Asia/Singapore',
    'Hong Kong': 'Asia/Hong_Kong',
    'New Zealand': 'Pacific/Auckland',
    'Israel': 'Asia/Jerusalem',
    'United Arab Emirates': 'Asia/Dubai',
    'UAE': 'Asia/Dubai',
    'South Africa': 'Africa/Johannesburg',
    'Brazil': 'America/Sao_Paulo',
    'Mexico': 'America/Mexico_City',
    'South Korea': 'Asia/Seoul',
    'Korea': 'Asia/Seoul',
    'Taiwan': 'Asia/Taipei',
    'Thailand': 'Asia/Bangkok',
    'Malaysia': 'Asia/Kuala_Lumpur',
    'Philippines': 'Asia/Manila',
    'Indonesia': 'Asia/Jakarta',
    'Vietnam': 'Asia/Ho_Chi_Minh',
    'Netherlands': 'Europe/Amsterdam',
    'Belgium': 'Europe/Brussels',
    'Switzerland': 'Europe/Zurich',
    'Austria': 'Europe/Vienna',
    'Spain': 'Europe/Madrid',
    'Italy': 'Europe/Rome',
    'Portugal': 'Europe/Lisbon',
    'Poland': 'Europe/Warsaw',
    'Sweden': 'Europe/Stockholm',
    'Norway': 'Europe/Oslo',
    'Denmark': 'Europe/Copenhagen',
    'Finland': 'Europe/Helsinki',
    'Ireland': 'Europe/Dublin',
    'Greece': 'Europe/Athens',
    'Czech Republic': 'Europe/Prague',
    'Czechia': 'Europe/Prague',
    'Romania': 'Europe/Bucharest',
    'Hungary': 'Europe/Budapest',
    'Russia': 'Europe/Moscow',
    'Russian Federation': 'Europe/Moscow',
    'Turkey': 'Europe/Istanbul',
    'Saudi Arabia': 'Asia/Riyadh',
    'Egypt': 'Africa/Cairo',
    'Nigeria': 'Africa/Lagos',
    'Kenya': 'Africa/Nairobi',
    'Argentina': 'America/Buenos_Aires',
    'Chile': 'America/Santiago',
    'Colombia': 'America/Bogota',
    'Peru': 'America/Lima'
  };

  /**
   * US state to timezone mappings (for more precise US timezone resolution)
   */
  const US_STATE_TIMEZONES = {
    // Eastern Time
    'CT': 'America/New_York',
    'DE': 'America/New_York',
    'DC': 'America/New_York',
    'FL': 'America/New_York', // Most of FL
    'GA': 'America/New_York',
    'IN': 'America/Indiana/Indianapolis', // Most of IN
    'KY': 'America/New_York', // Eastern part
    'ME': 'America/New_York',
    'MD': 'America/New_York',
    'MA': 'America/New_York',
    'MI': 'America/Detroit',
    'NH': 'America/New_York',
    'NJ': 'America/New_York',
    'NY': 'America/New_York',
    'NC': 'America/New_York',
    'OH': 'America/New_York',
    'PA': 'America/New_York',
    'RI': 'America/New_York',
    'SC': 'America/New_York',
    'VT': 'America/New_York',
    'VA': 'America/New_York',
    'WV': 'America/New_York',
    
    // Central Time
    'AL': 'America/Chicago',
    'AR': 'America/Chicago',
    'IL': 'America/Chicago',
    'IA': 'America/Chicago',
    'KS': 'America/Chicago', // Most
    'LA': 'America/Chicago',
    'MN': 'America/Chicago',
    'MS': 'America/Chicago',
    'MO': 'America/Chicago',
    'NE': 'America/Chicago', // Most
    'ND': 'America/Chicago', // Most
    'OK': 'America/Chicago',
    'SD': 'America/Chicago', // Most
    'TN': 'America/Chicago', // Most
    'TX': 'America/Chicago', // Most
    'WI': 'America/Chicago',
    
    // Mountain Time
    'AZ': 'America/Phoenix', // No DST
    'CO': 'America/Denver',
    'MT': 'America/Denver',
    'NM': 'America/Denver',
    'UT': 'America/Denver',
    'WY': 'America/Denver',
    
    // Pacific Time
    'CA': 'America/Los_Angeles',
    'NV': 'America/Los_Angeles',
    'OR': 'America/Los_Angeles',
    'WA': 'America/Los_Angeles',
    
    // Alaska & Hawaii
    'AK': 'America/Anchorage',
    'HI': 'Pacific/Honolulu'
  };

  /**
   * Canadian province/territory to timezone mappings
   * Includes both abbreviated codes and full names
   */
  const CANADA_PROVINCE_TIMEZONES = {
    // Newfoundland Time (UTC-3:30)
    'NL': 'America/St_Johns',
    'NFLD': 'America/St_Johns',
    'NEWFOUNDLAND': 'America/St_Johns',
    'NEWFOUNDLAND AND LABRADOR': 'America/St_Johns',
    
    // Atlantic Time (UTC-4)
    'NS': 'America/Halifax',
    'NOVA SCOTIA': 'America/Halifax',
    'NB': 'America/Moncton',
    'NEW BRUNSWICK': 'America/Moncton',
    'PE': 'America/Halifax',
    'PEI': 'America/Halifax',
    'PRINCE EDWARD ISLAND': 'America/Halifax',
    
    // Eastern Time (UTC-5)
    'ON': 'America/Toronto',
    'ONT': 'America/Toronto',
    'ONTARIO': 'America/Toronto',
    'QC': 'America/Montreal',
    'QUE': 'America/Montreal',
    'QUEBEC': 'America/Montreal',
    'PQ': 'America/Montreal', // Old postal abbreviation
    
    // Central Time (UTC-6)
    'MB': 'America/Winnipeg',
    'MAN': 'America/Winnipeg',
    'MANITOBA': 'America/Winnipeg',
    'SK': 'America/Regina', // Saskatchewan doesn't observe DST
    'SASK': 'America/Regina',
    'SASKATCHEWAN': 'America/Regina',
    'NU': 'America/Rankin_Inlet', // Most of Nunavut
    'NUNAVUT': 'America/Rankin_Inlet',
    
    // Mountain Time (UTC-7)
    'AB': 'America/Edmonton',
    'ALTA': 'America/Edmonton',
    'ALBERTA': 'America/Edmonton',
    'NT': 'America/Yellowknife',
    'NWT': 'America/Yellowknife',
    'NORTHWEST TERRITORIES': 'America/Yellowknife',
    
    // Pacific Time (UTC-8)
    'BC': 'America/Vancouver',
    'BRITISH COLUMBIA': 'America/Vancouver',
    'YT': 'America/Whitehorse',
    'YUKON': 'America/Whitehorse'
  };

  /**
   * Major city to timezone mappings
   * Used when city is provided in context
   */
  const CITY_TIMEZONES = {
    // Canadian Cities
    'TORONTO': 'America/Toronto',
    'OTTAWA': 'America/Toronto',
    'MISSISSAUGA': 'America/Toronto',
    'BRAMPTON': 'America/Toronto',
    'HAMILTON': 'America/Toronto',
    'LONDON': 'America/Toronto', // London, Ontario
    'KITCHENER': 'America/Toronto',
    'WATERLOO': 'America/Toronto',
    'WINDSOR': 'America/Toronto',
    'MONTREAL': 'America/Montreal',
    'QUEBEC CITY': 'America/Montreal',
    'LAVAL': 'America/Montreal',
    'GATINEAU': 'America/Montreal',
    'SHERBROOKE': 'America/Montreal',
    'VANCOUVER': 'America/Vancouver',
    'BURNABY': 'America/Vancouver',
    'SURREY': 'America/Vancouver',
    'RICHMOND': 'America/Vancouver',
    'VICTORIA': 'America/Vancouver',
    'KELOWNA': 'America/Vancouver',
    'CALGARY': 'America/Edmonton',
    'EDMONTON': 'America/Edmonton',
    'RED DEER': 'America/Edmonton',
    'LETHBRIDGE': 'America/Edmonton',
    'WINNIPEG': 'America/Winnipeg',
    'BRANDON': 'America/Winnipeg',
    'REGINA': 'America/Regina',
    'SASKATOON': 'America/Regina',
    'HALIFAX': 'America/Halifax',
    'DARTMOUTH': 'America/Halifax',
    'SAINT JOHN': 'America/Moncton',
    'MONCTON': 'America/Moncton',
    'FREDERICTON': 'America/Moncton',
    'ST. JOHNS': 'America/St_Johns',
    'ST JOHNS': 'America/St_Johns',
    "ST. JOHN'S": 'America/St_Johns',
    'CHARLOTTETOWN': 'America/Halifax',
    'WHITEHORSE': 'America/Whitehorse',
    'YELLOWKNIFE': 'America/Yellowknife',
    'IQALUIT': 'America/Iqaluit',
    
    // US Cities
    'NEW YORK': 'America/New_York',
    'NYC': 'America/New_York',
    'NEW YORK CITY': 'America/New_York',
    'MANHATTAN': 'America/New_York',
    'BROOKLYN': 'America/New_York',
    'BOSTON': 'America/New_York',
    'PHILADELPHIA': 'America/New_York',
    'WASHINGTON': 'America/New_York',
    'WASHINGTON DC': 'America/New_York',
    'WASHINGTON D.C.': 'America/New_York',
    'ATLANTA': 'America/New_York',
    'MIAMI': 'America/New_York',
    'ORLANDO': 'America/New_York',
    'CHARLOTTE': 'America/New_York',
    'RALEIGH': 'America/New_York',
    'PITTSBURGH': 'America/New_York',
    'DETROIT': 'America/Detroit',
    'CHICAGO': 'America/Chicago',
    'HOUSTON': 'America/Chicago',
    'DALLAS': 'America/Chicago',
    'AUSTIN': 'America/Chicago',
    'SAN ANTONIO': 'America/Chicago',
    'MINNEAPOLIS': 'America/Chicago',
    'MILWAUKEE': 'America/Chicago',
    'KANSAS CITY': 'America/Chicago',
    'ST LOUIS': 'America/Chicago',
    'ST. LOUIS': 'America/Chicago',
    'NEW ORLEANS': 'America/Chicago',
    'MEMPHIS': 'America/Chicago',
    'NASHVILLE': 'America/Chicago',
    'DENVER': 'America/Denver',
    'PHOENIX': 'America/Phoenix',
    'SALT LAKE CITY': 'America/Denver',
    'ALBUQUERQUE': 'America/Denver',
    'LAS VEGAS': 'America/Los_Angeles',
    'LOS ANGELES': 'America/Los_Angeles',
    'LA': 'America/Los_Angeles',
    'SAN FRANCISCO': 'America/Los_Angeles',
    'SF': 'America/Los_Angeles',
    'SAN JOSE': 'America/Los_Angeles',
    'SAN DIEGO': 'America/Los_Angeles',
    'SEATTLE': 'America/Los_Angeles',
    'PORTLAND': 'America/Los_Angeles',
    'ANCHORAGE': 'America/Anchorage',
    'HONOLULU': 'Pacific/Honolulu',
    
    // UK Cities
    'LONDON': 'Europe/London', // Default London is UK
    'MANCHESTER': 'Europe/London',
    'BIRMINGHAM': 'Europe/London',
    'LEEDS': 'Europe/London',
    'GLASGOW': 'Europe/London',
    'EDINBURGH': 'Europe/London',
    'LIVERPOOL': 'Europe/London',
    'BRISTOL': 'Europe/London',
    'CARDIFF': 'Europe/London',
    'BELFAST': 'Europe/London',
    'DUBLIN': 'Europe/Dublin',
    
    // European Cities
    'PARIS': 'Europe/Paris',
    'BERLIN': 'Europe/Berlin',
    'MUNICH': 'Europe/Berlin',
    'FRANKFURT': 'Europe/Berlin',
    'HAMBURG': 'Europe/Berlin',
    'AMSTERDAM': 'Europe/Amsterdam',
    'ROTTERDAM': 'Europe/Amsterdam',
    'BRUSSELS': 'Europe/Brussels',
    'ZURICH': 'Europe/Zurich',
    'GENEVA': 'Europe/Zurich',
    'VIENNA': 'Europe/Vienna',
    'MADRID': 'Europe/Madrid',
    'BARCELONA': 'Europe/Madrid',
    'ROME': 'Europe/Rome',
    'MILAN': 'Europe/Rome',
    'LISBON': 'Europe/Lisbon',
    'STOCKHOLM': 'Europe/Stockholm',
    'OSLO': 'Europe/Oslo',
    'COPENHAGEN': 'Europe/Copenhagen',
    'HELSINKI': 'Europe/Helsinki',
    'WARSAW': 'Europe/Warsaw',
    'PRAGUE': 'Europe/Prague',
    'BUDAPEST': 'Europe/Budapest',
    'ATHENS': 'Europe/Athens',
    'MOSCOW': 'Europe/Moscow',
    'ISTANBUL': 'Europe/Istanbul',
    
    // Asian Cities
    'TOKYO': 'Asia/Tokyo',
    'OSAKA': 'Asia/Tokyo',
    'BEIJING': 'Asia/Shanghai',
    'SHANGHAI': 'Asia/Shanghai',
    'SHENZHEN': 'Asia/Shanghai',
    'GUANGZHOU': 'Asia/Shanghai',
    'HONG KONG': 'Asia/Hong_Kong',
    'TAIPEI': 'Asia/Taipei',
    'SEOUL': 'Asia/Seoul',
    'SINGAPORE': 'Asia/Singapore',
    'KUALA LUMPUR': 'Asia/Kuala_Lumpur',
    'BANGKOK': 'Asia/Bangkok',
    'JAKARTA': 'Asia/Jakarta',
    'MANILA': 'Asia/Manila',
    'HO CHI MINH CITY': 'Asia/Ho_Chi_Minh',
    'SAIGON': 'Asia/Ho_Chi_Minh',
    'HANOI': 'Asia/Ho_Chi_Minh',
    'MUMBAI': 'Asia/Kolkata',
    'DELHI': 'Asia/Kolkata',
    'NEW DELHI': 'Asia/Kolkata',
    'BANGALORE': 'Asia/Kolkata',
    'BENGALURU': 'Asia/Kolkata',
    'CHENNAI': 'Asia/Kolkata',
    'HYDERABAD': 'Asia/Kolkata',
    'KOLKATA': 'Asia/Kolkata',
    'PUNE': 'Asia/Kolkata',
    'TEL AVIV': 'Asia/Jerusalem',
    'JERUSALEM': 'Asia/Jerusalem',
    'DUBAI': 'Asia/Dubai',
    'ABU DHABI': 'Asia/Dubai',
    'RIYADH': 'Asia/Riyadh',
    
    // Australia/NZ Cities
    'SYDNEY': 'Australia/Sydney',
    'MELBOURNE': 'Australia/Melbourne',
    'BRISBANE': 'Australia/Brisbane',
    'PERTH': 'Australia/Perth',
    'ADELAIDE': 'Australia/Adelaide',
    'CANBERRA': 'Australia/Sydney',
    'AUCKLAND': 'Pacific/Auckland',
    'WELLINGTON': 'Pacific/Auckland',
    'CHRISTCHURCH': 'Pacific/Auckland',
    
    // Latin America Cities
    'SAO PAULO': 'America/Sao_Paulo',
    'RIO DE JANEIRO': 'America/Sao_Paulo',
    'BUENOS AIRES': 'America/Buenos_Aires',
    'MEXICO CITY': 'America/Mexico_City',
    'SANTIAGO': 'America/Santiago',
    'LIMA': 'America/Lima',
    'BOGOTA': 'America/Bogota',
    
    // African Cities
    'JOHANNESBURG': 'Africa/Johannesburg',
    'CAPE TOWN': 'Africa/Johannesburg',
    'CAIRO': 'Africa/Cairo',
    'LAGOS': 'Africa/Lagos',
    'NAIROBI': 'Africa/Nairobi'
  };

  // ========== PRIVATE STATE ==========

  let isInitialized = false;
  
  // Cache for resolved timezones
  const resolvedCache = new Map();

  // ========== CORE FUNCTIONS ==========

  /**
   * Normalize a timezone value to a valid IANA timezone identifier
   * @param {string} timezone - Raw timezone value (may be non-IANA)
   * @param {Object} context - Geographic context for resolution
   * @param {string} context.country - Country name or code
   * @param {string} context.state - State/province code
   * @param {string} context.city - City name
   * @returns {Object} Normalized timezone info
   */
  function normalize(timezone, context = {}) {
    // Quick validation for null/empty
    if (!timezone || timezone === 'null' || timezone === 'undefined') {
      return resolveFromContext(context);
    }

    const tzUpper = timezone.trim().toUpperCase();
    const tzOriginal = timezone.trim();

    // Check cache first
    const cacheKey = `${tzOriginal}|${context.country || ''}|${context.state || ''}`;
    if (resolvedCache.has(cacheKey)) {
      return resolvedCache.get(cacheKey);
    }

    let result;

    // 1. Check if already a valid IANA timezone (contains /)
    if (tzOriginal.includes('/')) {
      result = validateAndFormat(tzOriginal);
    }
    // 2. Check direct mappings
    else if (TIMEZONE_MAPPINGS[tzUpper]) {
      result = {
        timezone: TIMEZONE_MAPPINGS[tzUpper],
        original: tzOriginal,
        source: 'mapping',
        isNormalized: true
      };
    }
    // 3. Try to resolve from context
    else {
      result = resolveFromContext(context, tzOriginal);
    }

    // Cache the result
    resolvedCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Validate and format a potential IANA timezone
   * @param {string} timezone - Timezone to validate
   * @returns {Object} Validation result
   */
  function validateAndFormat(timezone) {
    try {
      // Try to use the timezone with Intl.DateTimeFormat
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      
      return {
        timezone: timezone,
        original: timezone,
        source: 'iana',
        isNormalized: true,
        isValid: true
      };
    } catch (error) {
      // Invalid IANA timezone
      return {
        timezone: null,
        original: timezone,
        source: 'invalid',
        isNormalized: false,
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Resolve timezone from geographic context
   * @param {Object} context - Geographic context
   * @param {string} original - Original timezone value
   * @returns {Object} Resolution result
   */
  function resolveFromContext(context = {}, original = null) {
    const { country, state, city } = context;

    // Try city-specific resolution first (most precise)
    if (city) {
      const cityUpper = city.trim().toUpperCase();
      if (CITY_TIMEZONES[cityUpper]) {
        return {
          timezone: CITY_TIMEZONES[cityUpper],
          original: original,
          source: 'city',
          isNormalized: true,
          context: { city, country, state }
        };
      }
    }

    // Try US state-specific resolution
    if (country && (country.toUpperCase() === 'US' || country.toUpperCase() === 'USA' || 
                    country === 'United States' || country === 'United States of America')) {
      if (state && US_STATE_TIMEZONES[state.toUpperCase()]) {
        return {
          timezone: US_STATE_TIMEZONES[state.toUpperCase()],
          original: original,
          source: 'us_state',
          isNormalized: true,
          context: { country, state }
        };
      }
    }

    // Try Canadian province-specific resolution
    if (country && (country.toUpperCase() === 'CA' || country.toUpperCase() === 'CAN' || 
                    country.toUpperCase() === 'CANADA')) {
      if (state) {
        const stateUpper = state.trim().toUpperCase();
        if (CANADA_PROVINCE_TIMEZONES[stateUpper]) {
          return {
            timezone: CANADA_PROVINCE_TIMEZONES[stateUpper],
            original: original,
            source: 'canada_province',
            isNormalized: true,
            context: { country, state }
          };
        }
      }
    }

    // Try state/province without country context (check both US and Canada)
    if (state && !country) {
      const stateUpper = state.trim().toUpperCase();
      
      // Check US states first
      if (US_STATE_TIMEZONES[stateUpper]) {
        return {
          timezone: US_STATE_TIMEZONES[stateUpper],
          original: original,
          source: 'us_state_inferred',
          isNormalized: true,
          context: { state }
        };
      }
      
      // Check Canadian provinces
      if (CANADA_PROVINCE_TIMEZONES[stateUpper]) {
        return {
          timezone: CANADA_PROVINCE_TIMEZONES[stateUpper],
          original: original,
          source: 'canada_province_inferred',
          isNormalized: true,
          context: { state }
        };
      }
    }

    // Try country name resolution
    if (country) {
      const countryUpper = country.toUpperCase();
      
      // Check country code mappings
      if (TIMEZONE_MAPPINGS[countryUpper]) {
        return {
          timezone: TIMEZONE_MAPPINGS[countryUpper],
          original: original,
          source: 'country_code',
          isNormalized: true,
          context: { country }
        };
      }

      // Check full country name mappings
      const normalizedCountry = Object.keys(COUNTRY_TO_TIMEZONE).find(
        key => key.toUpperCase() === countryUpper
      );
      if (normalizedCountry) {
        return {
          timezone: COUNTRY_TO_TIMEZONE[normalizedCountry],
          original: original,
          source: 'country_name',
          isNormalized: true,
          context: { country }
        };
      }
    }

    // Unable to resolve
    return {
      timezone: null,
      original: original,
      source: 'unresolved',
      isNormalized: false,
      context
    };
  }

  /**
   * Get the current UTC offset for a timezone
   * @param {string} timezone - IANA timezone identifier
   * @param {Date} date - Date for offset calculation (default: now)
   * @returns {Object} Offset information
   */
  function getOffset(timezone, date = new Date()) {
    if (!timezone) return null;

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
      });

      const parts = formatter.formatToParts(date);
      const offsetPart = parts.find(p => p.type === 'timeZoneName');
      
      if (offsetPart) {
        const offsetStr = offsetPart.value; // e.g., "GMT-05:00"
        const match = offsetStr.match(/GMT([+-])(\d{2}):(\d{2})/);
        
        if (match) {
          const sign = match[1] === '+' ? 1 : -1;
          const hours = parseInt(match[2], 10);
          const minutes = parseInt(match[3], 10);
          const totalMinutes = sign * (hours * 60 + minutes);

          return {
            offsetString: offsetStr,
            offsetMinutes: totalMinutes,
            offsetHours: totalMinutes / 60,
            formatted: formatOffset(totalMinutes)
          };
        }
      }

      // Fallback: calculate offset from date comparison
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      const diffMinutes = (tzDate - utcDate) / 60000;

      return {
        offsetString: formatOffset(diffMinutes),
        offsetMinutes: diffMinutes,
        offsetHours: diffMinutes / 60,
        formatted: formatOffset(diffMinutes)
      };

    } catch (error) {
      console.warn('[TimezoneNormalizer] Error getting offset for', timezone, error);
      return null;
    }
  }

  /**
   * Format offset minutes to string (e.g., +05:30, -08:00)
   * @param {number} minutes - Offset in minutes
   * @returns {string} Formatted offset
   */
  function formatOffset(minutes) {
    const sign = minutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  /**
   * Get display name for a timezone
   * @param {string} timezone - IANA timezone identifier
   * @param {string} style - Display style ('long', 'short', 'shortOffset', 'longOffset')
   * @returns {string} Display name
   */
  function getDisplayName(timezone, style = 'long') {
    if (!timezone) return null;

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: style
      });

      const parts = formatter.formatToParts(new Date());
      const namePart = parts.find(p => p.type === 'timeZoneName');
      
      return namePart ? namePart.value : timezone.replace(/_/g, ' ');

    } catch (error) {
      // Fallback to simple formatting
      return timezone.replace(/_/g, ' ');
    }
  }

  /**
   * Convert a date/time from one timezone to another
   * @param {Date|string} dateTime - Date/time to convert
   * @param {string} fromTz - Source timezone (IANA)
   * @param {string} toTz - Target timezone (IANA)
   * @returns {Object} Conversion result
   */
  function convert(dateTime, fromTz, toTz) {
    try {
      const date = dateTime instanceof Date ? dateTime : new Date(dateTime);

      // Format in source timezone
      const fromFormatted = date.toLocaleString('en-US', { 
        timeZone: fromTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      // Format in target timezone
      const toFormatted = date.toLocaleString('en-US', { 
        timeZone: toTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      // Get offsets
      const fromOffset = getOffset(fromTz, date);
      const toOffset = getOffset(toTz, date);

      return {
        original: dateTime,
        from: {
          timezone: fromTz,
          formatted: fromFormatted,
          offset: fromOffset
        },
        to: {
          timezone: toTz,
          formatted: toFormatted,
          offset: toOffset
        },
        offsetDifferenceMinutes: (toOffset?.offsetMinutes || 0) - (fromOffset?.offsetMinutes || 0)
      };

    } catch (error) {
      console.error('[TimezoneNormalizer] Conversion error:', error);
      return {
        error: error.message,
        original: dateTime,
        from: { timezone: fromTz },
        to: { timezone: toTz }
      };
    }
  }

  /**
   * Check if a timezone string is a valid IANA identifier
   * @param {string} timezone - Timezone to check
   * @returns {boolean} True if valid
   */
  function isValidIANA(timezone) {
    if (!timezone || typeof timezone !== 'string') return false;
    
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current time in a timezone
   * @param {string} timezone - IANA timezone
   * @returns {Object} Current time info
   */
  function getCurrentTime(timezone) {
    if (!timezone) return null;

    try {
      const now = new Date();
      
      const formatted = now.toLocaleString('en-US', {
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      const time24h = now.toLocaleString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const offset = getOffset(timezone, now);

      return {
        timezone,
        formatted,
        time24h,
        offset,
        displayName: getDisplayName(timezone, 'long'),
        date: now
      };

    } catch (error) {
      console.error('[TimezoneNormalizer] Error getting current time:', error);
      return null;
    }
  }

  /**
   * Clear the resolution cache
   */
  function clearCache() {
    resolvedCache.clear();
    console.log('[TimezoneNormalizer] Cache cleared');
  }

  // ========== PUBLIC API ==========

  return {
    /**
     * Normalize a timezone value to IANA format
     * @param {string} timezone - Raw timezone value
     * @param {Object} context - Geographic context { country, state, city }
     * @returns {Object} { timezone, original, source, isNormalized }
     */
    normalize,

    /**
     * Get UTC offset for a timezone
     * @param {string} timezone - IANA timezone
     * @param {Date} date - Date for calculation
     * @returns {Object} Offset info
     */
    getOffset,

    /**
     * Get display name for a timezone
     * @param {string} timezone - IANA timezone
     * @param {string} style - 'long', 'short', 'shortOffset', 'longOffset'
     * @returns {string} Display name
     */
    getDisplayName,

    /**
     * Convert time between timezones
     * @param {Date|string} dateTime - Time to convert
     * @param {string} fromTz - Source timezone
     * @param {string} toTz - Target timezone
     * @returns {Object} Conversion result
     */
    convert,

    /**
     * Check if timezone is valid IANA
     * @param {string} timezone
     * @returns {boolean}
     */
    isValidIANA,

    /**
     * Get current time in timezone
     * @param {string} timezone
     * @returns {Object} Current time info
     */
    getCurrentTime,

    /**
     * Clear resolution cache
     */
    clearCache,

    /**
     * Get timezone mappings (for debugging)
     * @returns {Object}
     */
    getMappings: () => ({ ...TIMEZONE_MAPPINGS }),

    /**
     * Get country mappings (for debugging)
     * @returns {Object}
     */
    getCountryMappings: () => ({ ...COUNTRY_TO_TIMEZONE })
  };

})();

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezoneNormalizer;
}

