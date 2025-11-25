/**
 * Build Timezone Index Script
 * Parses timezones_final.csv and generates a serialized Map-based JSON index
 * for O(1) lookups in CustomerTimezoneLookup module.
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'timezones_final.csv');
const OUTPUT_PATH = path.join(__dirname, '..', 'timezones_index.json');
const OUTPUT_JS_PATH = path.join(__dirname, '..', 'timezones_index.js');

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  return result;
}

/**
 * Normalize Account Name for consistent lookups
 */
function normalizeAccountName(name) {
  if (!name) return null;
  return String(name).trim().toUpperCase();
}

/**
 * Validate timezone format (basic IANA timezone check)
 */
function isValidTimezone(tz) {
  if (!tz || !tz.trim()) return false;
  // Basic validation: should contain / or be a known single-word timezone
  const tzPattern = /^[A-Za-z_]+(\/[A-Za-z_]+)+$/;
  return tzPattern.test(tz) || ['UTC', 'GMT'].includes(tz.toUpperCase());
}

/**
 * US State to timezone mapping
 */
const US_STATE_TIMEZONES = {
  // Eastern Time
  'CT': 'America/New_York', 'DE': 'America/New_York', 'FL': 'America/New_York',
  'GA': 'America/New_York', 'ME': 'America/New_York', 'MD': 'America/New_York',
  'MA': 'America/New_York', 'NH': 'America/New_York', 'NJ': 'America/New_York',
  'NY': 'America/New_York', 'NC': 'America/New_York', 'OH': 'America/New_York',
  'PA': 'America/New_York', 'RI': 'America/New_York', 'SC': 'America/New_York',
  'VT': 'America/New_York', 'VA': 'America/New_York', 'WV': 'America/New_York',
  
  // Central Time
  'AL': 'America/Chicago', 'AR': 'America/Chicago', 'IL': 'America/Chicago',
  'IN': 'America/Chicago', 'IA': 'America/Chicago', 'KS': 'America/Chicago',
  'KY': 'America/Chicago', 'LA': 'America/Chicago', 'MI': 'America/Chicago',
  'MN': 'America/Chicago', 'MS': 'America/Chicago', 'MO': 'America/Chicago',
  'NE': 'America/Chicago', 'OK': 'America/Chicago', 'SD': 'America/Chicago',
  'TN': 'America/Chicago', 'TX': 'America/Chicago', 'WI': 'America/Chicago',
  
  // Mountain Time
  'AZ': 'America/Phoenix', 'CO': 'America/Denver', 'ID': 'America/Denver',
  'MT': 'America/Denver', 'NM': 'America/Denver', 'ND': 'America/Denver',
  'UT': 'America/Denver', 'WY': 'America/Denver',
  
  // Pacific Time
  'CA': 'America/Los_Angeles', 'NV': 'America/Los_Angeles',
  'OR': 'America/Los_Angeles', 'WA': 'America/Los_Angeles',
  
  // Alaska & Hawaii
  'AK': 'America/Anchorage',
  'HI': 'Pacific/Honolulu'
};

/**
 * Country to timezone mapping (fallback)
 */
const COUNTRY_TIMEZONES = {
  'United States': 'America/New_York', // Default to Eastern
  'Canada': 'America/Toronto',
  'Mexico': 'America/Mexico_City',
  'United Kingdom': 'Europe/London',
  'UK': 'Europe/London',
  'France': 'Europe/Paris',
  'Germany': 'Europe/Berlin',
  'Spain': 'Europe/Madrid',
  'Italy': 'Europe/Rome',
  'Netherlands': 'Europe/Amsterdam',
  'Belgium': 'Europe/Brussels',
  'Switzerland': 'Europe/Zurich',
  'Austria': 'Europe/Vienna',
  'Sweden': 'Europe/Stockholm',
  'Norway': 'Europe/Oslo',
  'Denmark': 'Europe/Copenhagen',
  'Finland': 'Europe/Helsinki',
  'Poland': 'Europe/Warsaw',
  'Ireland': 'Europe/Dublin',
  'Portugal': 'Europe/Lisbon',
  'Greece': 'Europe/Athens',
  'Australia': 'Australia/Sydney',
  'New Zealand': 'Pacific/Auckland',
  'Japan': 'Asia/Tokyo',
  'China': 'Asia/Shanghai',
  'India': 'Asia/Kolkata',
  'Singapore': 'Asia/Singapore',
  'Hong Kong': 'Asia/Hong_Kong',
  'South Korea': 'Asia/Seoul',
  'Brazil': 'America/Sao_Paulo',
  'Argentina': 'America/Argentina/Buenos_Aires',
  'Chile': 'America/Santiago',
  'South Africa': 'Africa/Johannesburg',
  'Russian Federation': 'Europe/Moscow',
  'Russia': 'Europe/Moscow',
  'Turkey': 'Europe/Istanbul',
  'Colombia': 'America/Bogota',
  'Costa Rica': 'America/Costa_Rica',
  'Bolivia, Plurinational State of': 'America/La_Paz',
  'Bolivia': 'America/La_Paz',
  'Malaysia': 'Asia/Kuala_Lumpur',
  'Indonesia': 'Asia/Jakarta',
  'Ecuador': 'America/Guayaquil',
  'Kazakhstan': 'Asia/Almaty',
  'USA': 'America/New_York' // Alternative name for United States
};

/**
 * Derive timezone from state/province and country
 */
function deriveTimezone(stateProvince, country) {
  // Normalize state/province - skip if it's "null" string
  const normalizedState = stateProvince && stateProvince.trim().toLowerCase() !== 'null' 
    ? stateProvince.trim() 
    : null;
  const normalizedCountry = country && country.trim().toLowerCase() !== 'null'
    ? country.trim()
    : null;

  if (!normalizedState && !normalizedCountry) {
    return null;
  }

  // Try US state first (if country is United States or USA)
  if (normalizedCountry && (
    normalizedCountry === 'United States' || 
    normalizedCountry === 'USA' ||
    normalizedCountry.includes('United States')
  )) {
    if (normalizedState) {
      const stateCode = normalizedState.toUpperCase();
      // Check if it's a 2-letter state code
      if (stateCode.length === 2 && US_STATE_TIMEZONES[stateCode]) {
        return US_STATE_TIMEZONES[stateCode];
      }
      // Try to match state name to code (basic mapping)
      const stateNameMap = {
        'WISCONSIN': 'WI', 'UTAH': 'UT', 'OHIO': 'OH', 'SOUTH CAROLINA': 'SC',
        'FLORIDA': 'FL', 'INDIANA': 'IN', 'MICHIGAN': 'MI', 'TENNESSEE': 'TN',
        'NORTH DAKOTA': 'ND', 'VIRGINIA': 'VA', 'PENNSYLVANIA': 'PA',
        'MASSACHUSETTS': 'MA', 'MISSOURI': 'MO', 'NORTH CAROLINA': 'NC'
      };
      const stateUpper = normalizedState.toUpperCase();
      if (stateNameMap[stateUpper] && US_STATE_TIMEZONES[stateNameMap[stateUpper]]) {
        return US_STATE_TIMEZONES[stateNameMap[stateUpper]];
      }
    }
  }

  // Try country-based lookup
  if (normalizedCountry) {
    // Direct match (case-insensitive)
    const directMatch = Object.keys(COUNTRY_TIMEZONES).find(
      key => key.toLowerCase() === normalizedCountry.toLowerCase()
    );
    if (directMatch) {
      return COUNTRY_TIMEZONES[directMatch];
    }
    // Try partial match for countries with variations (case-insensitive)
    for (const [key, tz] of Object.entries(COUNTRY_TIMEZONES)) {
      const keyLower = key.toLowerCase();
      const countryLower = normalizedCountry.toLowerCase();
      if (countryLower.includes(keyLower) || keyLower.includes(countryLower)) {
        return tz;
      }
    }
  }

  return null;
}

/**
 * Main build function
 */
function buildIndex() {
  console.log('[BuildTimezoneIndex] Starting index build...');
  console.log(`[BuildTimezoneIndex] Reading CSV from: ${CSV_PATH}`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`[BuildTimezoneIndex] Error: CSV file not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    console.error('[BuildTimezoneIndex] Error: CSV file is empty');
    process.exit(1);
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.trim());
  
  // Find column indices
  const columnIndex = {
    stateProvince: headers.indexOf('State/Province'),
    country: headers.indexOf('Country'),
    timezone: headers.indexOf('Country Lookup: Time Zone'),
    region: headers.indexOf('Exlibris Customer Care Region'),
    accountName: headers.indexOf('Account Name'),
    accountNameInternal: headers.indexOf('Account Name Internal'),
    currency: headers.indexOf('Account Currency')
  };

  // Validate required columns
  if (columnIndex.accountName === -1 || columnIndex.timezone === -1) {
    console.error('[BuildTimezoneIndex] Error: Required columns not found in CSV');
    console.error('[BuildTimezoneIndex] Found columns:', headers);
    process.exit(1);
  }

  console.log('[BuildTimezoneIndex] Column mapping:', columnIndex);

  // Build index Map
  const index = new Map();
  let processedCount = 0;
  let skippedCount = 0;
  let duplicateCount = 0;
  const duplicates = [];

  // Process data rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const parts = parseCSVLine(line);
    
    const accountName = parts[columnIndex.accountName]?.trim();
    let timezone = parts[columnIndex.timezone]?.trim();
    const stateProvince = parts[columnIndex.stateProvince]?.trim() || null;
    const country = parts[columnIndex.country]?.trim() || null;
    
    // Skip rows with empty Account Name
    if (!accountName) {
      skippedCount++;
      continue;
    }

    // If timezone is empty, try to derive it from state/province and country
    if (!timezone) {
      const derivedTimezone = deriveTimezone(stateProvince, country);
      if (derivedTimezone) {
        timezone = derivedTimezone;
        console.log(`[BuildTimezoneIndex] Derived timezone "${timezone}" for "${accountName}" from state: "${stateProvince}", country: "${country}"`);
      } else {
        console.warn(`[BuildTimezoneIndex] Could not derive timezone for "${accountName}" (state: "${stateProvince}", country: "${country}")`);
        skippedCount++;
        continue;
      }
    }

    // Validate timezone format
    if (!isValidTimezone(timezone)) {
      console.warn(`[BuildTimezoneIndex] Invalid timezone format: "${timezone}" for account "${accountName}"`);
      skippedCount++;
      continue;
    }

    const normalizedName = normalizeAccountName(accountName);
    if (!normalizedName) {
      skippedCount++;
      continue;
    }

    // Check for duplicates
    if (index.has(normalizedName)) {
      duplicateCount++;
      duplicates.push({
        accountName: accountName,
        normalized: normalizedName,
        existing: index.get(normalizedName).accountName
      });
      // Keep first occurrence
      continue;
    }

    // Create record
    const record = {
      timezone: timezone,
      accountName: accountName,
      accountNameInternal: parts[columnIndex.accountNameInternal]?.trim() || null,
      state: parts[columnIndex.stateProvince]?.trim() || null,
      country: parts[columnIndex.country]?.trim() || null,
      region: parts[columnIndex.region]?.trim() || null,
      currency: parts[columnIndex.currency]?.trim() || null
    };

    index.set(normalizedName, record);
    processedCount++;
  }

  // Log statistics
  console.log(`[BuildTimezoneIndex] Processed: ${processedCount} records`);
  console.log(`[BuildTimezoneIndex] Skipped: ${skippedCount} records`);
  if (duplicateCount > 0) {
    console.warn(`[BuildTimezoneIndex] Duplicates found: ${duplicateCount}`);
    if (duplicates.length <= 10) {
      console.warn('[BuildTimezoneIndex] Sample duplicates:', duplicates.slice(0, 5));
    }
  }

  // Convert Map to object for JSON serialization
  const indexObject = {};
  for (const [key, value] of index.entries()) {
    indexObject[key] = value;
  }

  // Create output structure with metadata
  const output = {
    meta: {
      version: '1.0',
      buildDate: new Date().toISOString(),
      recordCount: index.size,
      format: 'map',
      sourceFile: 'timezones_final.csv'
    },
    index: indexObject
  };

  // Write to file (compact JSON, no whitespace)
  const jsonContent = JSON.stringify(output);
  fs.writeFileSync(OUTPUT_PATH, jsonContent, 'utf-8');

  const fileSize = fs.statSync(OUTPUT_PATH).size;
  const fileSizeKB = (fileSize / 1024).toFixed(2);

  console.log(`[BuildTimezoneIndex] Index built successfully!`);
  console.log(`[BuildTimezoneIndex] Output: ${OUTPUT_PATH}`);
  console.log(`[BuildTimezoneIndex] File size: ${fileSizeKB} KB`);
  console.log(`[BuildTimezoneIndex] Records in index: ${index.size}`);

  // Generate JavaScript fallback file
  generateJSFile(index, output.meta);
}

/**
 * Generate JavaScript file with embedded timezone data as fallback
 */
function generateJSFile(index, meta) {
  console.log('[BuildTimezoneIndex] Generating JavaScript fallback file...');

  // Convert Map to object for serialization
  const indexObject = {};
  for (const [key, value] of index.entries()) {
    indexObject[key] = value;
  }

  // Generate JS file content
  const jsContent = `/**
 * Timezone Index (Fallback)
 * Auto-generated from timezones_final.csv
 * Build Date: ${meta.buildDate}
 * Record Count: ${meta.recordCount}
 * 
 * This file serves as a fallback when timezones_index.json cannot be loaded.
 * Structure: Map keyed by normalized Account Name (uppercase, trimmed)
 */

(function() {
  'use strict';

  const TIMEZONE_INDEX_DATA = ${JSON.stringify(indexObject, null, 2)};
  const INDEX_META = ${JSON.stringify(meta, null, 2)};

  /**
   * Get timezone index as Map for O(1) lookups
   * @returns {Map<string, Object>}
   */
  function getTimezoneIndex() {
    const indexMap = new Map();
    for (const [key, value] of Object.entries(TIMEZONE_INDEX_DATA)) {
      indexMap.set(key, value);
    }
    return indexMap;
  }

  /**
   * Get index metadata
   * @returns {Object}
   */
  function getIndexMeta() {
    return INDEX_META;
  }

  // Export for use in CustomerTimezoneLookup
  if (typeof window !== 'undefined') {
    window.TimezoneIndexFallback = {
      getTimezoneIndex: getTimezoneIndex,
      getIndexMeta: getIndexMeta,
      data: TIMEZONE_INDEX_DATA,
      meta: INDEX_META
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getTimezoneIndex: getTimezoneIndex,
      getIndexMeta: getIndexMeta,
      data: TIMEZONE_INDEX_DATA,
      meta: INDEX_META
    };
  }
})();
`;

  // Write JS file
  fs.writeFileSync(OUTPUT_JS_PATH, jsContent, 'utf-8');

  const jsFileSize = fs.statSync(OUTPUT_JS_PATH).size;
  const jsFileSizeKB = (jsFileSize / 1024).toFixed(2);

  console.log(`[BuildTimezoneIndex] JavaScript fallback file generated!`);
  console.log(`[BuildTimezoneIndex] Output: ${OUTPUT_JS_PATH}`);
  console.log(`[BuildTimezoneIndex] File size: ${jsFileSizeKB} KB`);
}

// Run build
try {
  buildIndex();
  console.log('[BuildTimezoneIndex] Build completed successfully');
} catch (error) {
  console.error('[BuildTimezoneIndex] Build failed:', error);
  process.exit(1);
}

