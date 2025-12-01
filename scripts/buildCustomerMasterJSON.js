#!/usr/bin/env node

/**
 * Build script to convert customerMasterList.js to customerMasterList.json
 * 
 * This script:
 * 1. Loads the compiled customer master list from the feature folder
 * 2. Builds multiple indexes for fast lookup
 * 3. Outputs a JSON file for the extension to load via fetch
 * 
 * Usage:
 *   node scripts/buildCustomerMasterJSON.js
 */

const fs = require('fs');
const path = require('path');

const SOURCE_PATH = path.resolve(__dirname, '../docs/feature-customertimezones/customerMasterList.js');
const OUTPUT_PATH = path.resolve(__dirname, '../customerMasterList.json');

/**
 * Normalize a string for use as a lookup key
 * @param {string} value - Input string
 * @returns {string} Normalized uppercase string
 */
function normalizeKey(value) {
  if (!value || typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

/**
 * Build composite key for server+IDs lookup
 * @param {string} server - Server code
 * @param {string} customerId - Customer ID
 * @param {string} institutionId - Institution ID
 * @returns {string} Composite key
 */
function buildServerIdsKey(server, customerId, institutionId) {
  if (!server || !customerId || !institutionId) return '';
  return `${normalizeKey(server)}|${customerId}|${institutionId}`;
}

try {
  console.log('[buildCustomerMasterJSON] Starting build...');
  console.log(`[buildCustomerMasterJSON] Source: ${SOURCE_PATH}`);
  console.log(`[buildCustomerMasterJSON] Output: ${OUTPUT_PATH}`);

  // Check if source file exists
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Source file not found: ${SOURCE_PATH}`);
  }

  // Load the source file
  const { compiledCustomerMaster } = require(SOURCE_PATH);

  if (!Array.isArray(compiledCustomerMaster)) {
    throw new Error('compiledCustomerMaster is not an array');
  }

  console.log(`[buildCustomerMasterJSON] Loaded ${compiledCustomerMaster.length} records`);

  // Build output structure with multiple indexes
  const output = {
    meta: {
      version: '1.0',
      recordCount: compiledCustomerMaster.length,
      buildDate: new Date().toISOString(),
      source: 'buildCustomerMasterJSON.js'
    },
    // All records as array for iteration
    records: compiledCustomerMaster,
    // Index by normalized account name (sfName preferred, sqlName fallback)
    byAccountName: {},
    // Index by institution code
    byInstitutionCode: {},
    // Index by account code
    byAccountCode: {},
    // Index by server+customerId+institutionId composite key
    byServerIds: {}
  };

  // Build indexes
  let accountNameCount = 0;
  let institutionCodeCount = 0;
  let accountCodeCount = 0;
  let serverIdsCount = 0;

  compiledCustomerMaster.forEach((record, index) => {
    // Index by account name (prefer sfName, fallback to sqlName)
    const sfNameKey = normalizeKey(record.sfName);
    const sqlNameKey = normalizeKey(record.sqlName);
    
    // Add sfName to index if valid and not "Unknown"
    if (sfNameKey && sfNameKey !== 'UNKNOWN') {
      if (!output.byAccountName[sfNameKey]) {
        output.byAccountName[sfNameKey] = index;
        accountNameCount++;
      }
    }
    
    // Add sqlName as additional key if different from sfName
    if (sqlNameKey && sqlNameKey !== 'UNKNOWN' && sqlNameKey !== sfNameKey) {
      if (!output.byAccountName[sqlNameKey]) {
        output.byAccountName[sqlNameKey] = index;
        accountNameCount++;
      }
    }

    // Index by institution code
    const institutionCodeKey = normalizeKey(record.institutionCode);
    if (institutionCodeKey) {
      if (!output.byInstitutionCode[institutionCodeKey]) {
        output.byInstitutionCode[institutionCodeKey] = index;
        institutionCodeCount++;
      }
    }

    // Index by account code
    const accountCodeKey = normalizeKey(record.accountCode);
    if (accountCodeKey && accountCodeKey !== institutionCodeKey) {
      if (!output.byAccountCode[accountCodeKey]) {
        output.byAccountCode[accountCodeKey] = index;
        accountCodeCount++;
      }
    }

    // Index by server+IDs composite key
    const serverIdsKey = buildServerIdsKey(record.server, record.customerId, record.institutionId);
    if (serverIdsKey) {
      if (!output.byServerIds[serverIdsKey]) {
        output.byServerIds[serverIdsKey] = index;
        serverIdsCount++;
      }
    }
  });

  console.log(`[buildCustomerMasterJSON] Built indexes:`);
  console.log(`  - byAccountName: ${accountNameCount} entries`);
  console.log(`  - byInstitutionCode: ${institutionCodeCount} entries`);
  console.log(`  - byAccountCode: ${accountCodeCount} entries`);
  console.log(`  - byServerIds: ${serverIdsCount} entries`);

  // Write output file
  const jsonContent = JSON.stringify(output);
  fs.writeFileSync(OUTPUT_PATH, jsonContent, 'utf8');

  const fileSizeBytes = fs.statSync(OUTPUT_PATH).size;
  const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

  console.log(`[buildCustomerMasterJSON] Successfully wrote ${OUTPUT_PATH}`);
  console.log(`[buildCustomerMasterJSON] File size: ${fileSizeMB} MB (${fileSizeBytes} bytes)`);
  console.log('[buildCustomerMasterJSON] Build complete!');

} catch (error) {
  console.error('[buildCustomerMasterJSON] Build failed:', error);
  process.exit(1);
}

