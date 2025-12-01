#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const MASTERLIST_PATH = path.join(WORKSPACE_ROOT, 'Modified', 'instClean.csv');
const OUTPUT_PATH = path.join(WORKSPACE_ROOT, 'Modified', 'customerMasterList.js');
const EXCLUDED_DIRECTORIES = new Set(['.git', '.vscode', 'node_modules']);

const DEFAULT_COUNTRY_TZ = {
  'United States': 'America/New_York',
  'Canada': 'America/Toronto',
  'Australia': 'Australia/Sydney',
  'United Kingdom': 'Europe/London',
  'Ireland': 'Europe/Dublin',
  'France': 'Europe/Paris',
  'Germany': 'Europe/Berlin',
  'Netherlands': 'Europe/Amsterdam',
  'Belgium': 'Europe/Brussels',
  'Spain': 'Europe/Madrid',
  'Portugal': 'Europe/Lisbon',
  'Italy': 'Europe/Rome',
  'Switzerland': 'Europe/Zurich',
  'Austria': 'Europe/Vienna',
  'Sweden': 'Europe/Stockholm',
  'Norway': 'Europe/Oslo',
  'Denmark': 'Europe/Copenhagen',
  'Finland': 'Europe/Helsinki',
  'Poland': 'Europe/Warsaw',
  'Croatia': 'Europe/Zagreb',
  'Czech Republic': 'Europe/Prague',
  'Hungary': 'Europe/Budapest',
  'Greece': 'Europe/Athens',
  'Turkey': 'Europe/Istanbul',
  'Israel': 'Asia/Jerusalem',
  'Lebanon': 'Asia/Beirut',
  'Saudi Arabia': 'Asia/Riyadh',
  'United Arab Emirates': 'Asia/Dubai',
  'India': 'Asia/Kolkata',
  'China': 'Asia/Shanghai',
  'Japan': 'Asia/Tokyo',
  'Singapore': 'Asia/Singapore',
  'Malaysia': 'Asia/Kuala_Lumpur',
  'Indonesia': 'Asia/Jakarta',
  'Thailand': 'Asia/Bangkok',
  'Vietnam': 'Asia/Ho_Chi_Minh',
  'South Korea': 'Asia/Seoul',
  'Korea, Republic of': 'Asia/Seoul',
  'Taiwan': 'Asia/Taipei',
  'Philippines': 'Asia/Manila',
  'HongKong': 'Asia/Hong_Kong',
  'Hong Kong': 'Asia/Hong_Kong',
  'Macau': 'Asia/Macau',
  'New Zealand': 'Pacific/Auckland',
  'South Africa': 'Africa/Johannesburg',
  'Kenya': 'Africa/Nairobi',
  'Nigeria': 'Africa/Lagos',
  'Egypt': 'Africa/Cairo',
  'Morocco': 'Africa/Casablanca',
  'Ghana': 'Africa/Accra',
  'Brazil': 'America/Sao_Paulo',
  'Argentina': 'America/Argentina/Buenos_Aires',
  'Chile': 'America/Santiago',
  'Peru': 'America/Lima',
  'Mexico': 'America/Mexico_City',
  'Colombia': 'America/Bogota',
  'Costa Rica': 'America/Costa_Rica'
};

const COUNTRY_ALIASES = {
  USA: 'United States',
  US: 'United States',
  'UNITED STATES OF AMERICA': 'United States',
  'U.S.A.': 'United States',
  UK: 'United Kingdom',
  'GREAT BRITAIN': 'United Kingdom',
  ENGLAND: 'United Kingdom',
  SCOTLAND: 'United Kingdom',
  HONGKONG: 'Hong Kong',
  'HONG KONG SAR': 'Hong Kong',
  'KOREA, REPUBLIC OF': 'South Korea',
  'REPUBLIC OF KOREA': 'South Korea',
  'SOUTH KOREA': 'South Korea',
  'KOREA (SOUTH)': 'South Korea',
  'PEOPLE\'S REPUBLIC OF CHINA': 'China',
  'P.R. CHINA': 'China',
  'PR CHINA': 'China',
  PRC: 'China',
  'DEMOCRATIC REPUBLIC OF CONGO': 'Congo, Dem. Rep.',
  'CONGO, DEMOCRATIC REPUBLIC OF THE': 'Congo, Dem. Rep.',
  'CZECHIA': 'Czech Republic'
};

const SUBDIVISION_ALIASES = {
  'NEW SOUTH WALES': 'NSW',
  'NORTHERN TERRITORY': 'NT',
  'QUEENSLAND': 'QLD',
  'SOUTH AUSTRALIA': 'SA',
  'TASMANIA': 'TAS',
  'VICTORIA': 'VIC',
  'WESTERN AUSTRALIA': 'WA',
  'AUSTRALIAN CAPITAL TERRITORY': 'ACT',
  'BRITISH COLUMBIA': 'BC',
  'ALBERTA': 'AB',
  'SASKATCHEWAN': 'SK',
  'MANITOBA': 'MB',
  'NEW BRUNSWICK': 'NB',
  'NEWFOUNDLAND AND LABRADOR': 'NL',
  'NOVA SCOTIA': 'NS',
  'NORTHWEST TERRITORIES': 'NT',
  'PRINCE EDWARD ISLAND': 'PE',
  'QUEBEC': 'QC',
  'YUKON': 'YT',
  'NUNAVUT': 'NU',
  'ENGLAND': 'ENG',
  'SCOTLAND': 'SCT',
  'WALES': 'WLS',
  'NORTHERN IRELAND': 'NIR'
};

const US_STATE_TZ = {
  AL: 'America/Chicago',
  AK: 'America/Anchorage',
  AZ: 'America/Phoenix',
  AR: 'America/Chicago',
  CA: 'America/Los_Angeles',
  CO: 'America/Denver',
  CT: 'America/New_York',
  DC: 'America/New_York',
  DE: 'America/New_York',
  FL: 'America/New_York',
  GA: 'America/New_York',
  HI: 'Pacific/Honolulu',
  IA: 'America/Chicago',
  ID: 'America/Boise',
  IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis',
  KS: 'America/Chicago',
  KY: 'America/New_York',
  LA: 'America/Chicago',
  MA: 'America/New_York',
  MD: 'America/New_York',
  ME: 'America/New_York',
  MI: 'America/Detroit',
  MN: 'America/Chicago',
  MO: 'America/Chicago',
  MS: 'America/Chicago',
  MT: 'America/Denver',
  NC: 'America/New_York',
  ND: 'America/Chicago',
  NE: 'America/Chicago',
  NH: 'America/New_York',
  NJ: 'America/New_York',
  NM: 'America/Denver',
  NV: 'America/Los_Angeles',
  NY: 'America/New_York',
  OH: 'America/New_York',
  OK: 'America/Chicago',
  OR: 'America/Los_Angeles',
  PA: 'America/New_York',
  RI: 'America/New_York',
  SC: 'America/New_York',
  SD: 'America/Chicago',
  TN: 'America/Chicago',
  TX: 'America/Chicago',
  UT: 'America/Denver',
  VA: 'America/New_York',
  VT: 'America/New_York',
  WA: 'America/Los_Angeles',
  WI: 'America/Chicago',
  WV: 'America/New_York',
  WY: 'America/Denver'
};

const CA_PROVINCE_TZ = {
  AB: 'America/Edmonton',
  BC: 'America/Vancouver',
  MB: 'America/Winnipeg',
  NB: 'America/Moncton',
  NL: 'America/St_Johns',
  NS: 'America/Halifax',
  NT: 'America/Yellowknife',
  NU: 'America/Iqaluit',
  ON: 'America/Toronto',
  PE: 'America/Halifax',
  QC: 'America/Montreal',
  SK: 'America/Regina',
  YT: 'America/Whitehorse'
};

const AU_STATE_TZ = {
  ACT: 'Australia/Sydney',
  NSW: 'Australia/Sydney',
  NT: 'Australia/Darwin',
  QLD: 'Australia/Brisbane',
  SA: 'Australia/Adelaide',
  TAS: 'Australia/Hobart',
  VIC: 'Australia/Melbourne',
  WA: 'Australia/Perth'
};

const REGION_FALLBACK_TZ = {
  ap: 'Asia/Singapore',
  eu: 'Europe/Amsterdam',
  na: 'America/New_York',
  ca: 'America/Toronto',
  cn: 'Asia/Shanghai',
  cz: 'Europe/Prague'
};

try {
  main();
} catch (error) {
  console.error('[buildCustomerMaster] Failed to compile customer list:', error);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(MASTERLIST_PATH)) {
    throw new Error(`Master list not found at ${MASTERLIST_PATH}`);
  }

  const academicFiles = collectFiles(WORKSPACE_ROOT, (name) => /DWH_.*_data_academicunit\.csv$/i.test(name));
  const orgFiles = collectFiles(WORKSPACE_ROOT, (name) => /DWH_.*_data_orgunit\.csv$/i.test(name));

  if (!academicFiles.length || !orgFiles.length) {
    throw new Error('No DWH academic/orgunit files were located.');
  }

  const masterIndex = buildMasterIndex(loadCsvFile(MASTERLIST_PATH));
  const academicMap = buildAcademicMap(academicFiles);
  const orgMap = buildOrgMap(orgFiles);
  const compiled = mergeSources({ academicMap, orgMap, masterIndex });

  writeOutput(compiled);
  console.log(`[buildCustomerMaster] Compiled ${compiled.length} institution records.`);
}

function collectFiles(startDir, matcher) {
  const results = [];
  const queue = [startDir];

  while (queue.length) {
    const currentDir = queue.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..') {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
          queue.push(absolutePath);
        }
        continue;
      }

      if (matcher(entry.name)) {
        results.push(absolutePath);
      }
    }
  }

  return results;
}

function loadCsvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(raw);

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const records = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.length || (row.length === 1 && row[0].trim() === '')) {
      continue;
    }

    const record = {};
    headers.forEach((header, index) => {
      record[header] = (row[index] ?? '').trim();
    });
    records.push(record);
  }

  return records;
}

function parseCsv(content) {
  const text = content.replace(/^\uFEFF/, '');
  const rows = [];
  let value = '';
  let currentRow = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
      continue;
    }

    if (char === ',') {
      currentRow.push(value);
      value = '';
      continue;
    }

    if (char === '\n') {
      currentRow.push(value);
      rows.push(currentRow);
      currentRow = [];
      value = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    value += char;
  }

  if (value.length || currentRow.length) {
    currentRow.push(value);
    rows.push(currentRow);
  }

  return rows;
}

function normalizeHeader(header) {
  return header.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function buildMasterIndex(masterRows) {
  const byInstanceCode = new Map();
  const byAccountNumber = new Map();

  masterRows.forEach((row) => {
    const instanceCode = (row.INSTANCE_NAME_INSTITUTION_CODE || '').toUpperCase();
    const accountNumber = (row.ACCOUNT_NUMBER || '').toUpperCase();

    if (instanceCode) {
      byInstanceCode.set(instanceCode, row);
    }
    if (accountNumber) {
      byAccountNumber.set(accountNumber, row);
    }
  });

  return { byInstanceCode, byAccountNumber };
}

function buildAcademicMap(files) {
  const map = new Map();

  files.forEach((filePath) => {
    loadCsvFile(filePath).forEach((row) => {
      const key = makeKey(row.DB_SERVER, row.CUSTOMERID, row.INSTITUTIONID);
      if (!key) {
        return;
      }
      map.set(key, {
        dbServer: row.DB_SERVER,
        customerId: row.CUSTOMERID,
        institutionId: row.INSTITUTIONID,
        accountCode: row.BASE_CODE
      });
    });
  });

  return map;
}

function buildOrgMap(files) {
  const map = new Map();

  files.forEach((filePath) => {
    loadCsvFile(filePath).forEach((row) => {
      const key = makeKey(row.DB_SERVER, row.CUSTOMERID, row.INSTITUTIONID);
      if (!key) {
        return;
      }
      map.set(key, {
        dbServer: row.DB_SERVER,
        customerId: row.CUSTOMERID,
        institutionId: row.INSTITUTIONID,
        institutionCode: row.ORG_CODE,
        sqlName: row.NAME,
        timezone: row.ORG_TIMEZONE
      });
    });
  });

  return map;
}

function mergeSources({ academicMap, orgMap, masterIndex }) {
  const compiled = [];
  const seenKeys = new Set([...academicMap.keys(), ...orgMap.keys()]);

  for (const key of seenKeys) {
    const academic = academicMap.get(key) || {};
    const org = orgMap.get(key) || {};
    const institutionCode = org.institutionCode || deriveInstitutionCode(academic.accountCode);
    const accountCode = academic.accountCode || deriveAccountCode(institutionCode);
    const master = findMasterRow(masterIndex, { accountCode, institutionCode });
    const geo = extractGeo(master);
    const serverCode = deriveServerCode(org.dbServer || academic.dbServer);
    const region = (serverCode || '').slice(0, 2).toLowerCase();

    compiled.push({
      sqlName: org.sqlName || master?.ACCOUNT_NAME || master?.ACCOUNT_NAME_INTERNAL || 'Unknown',
      sfName: master?.ACCOUNT_NAME || master?.ACCOUNT_NAME_INTERNAL || 'Unknown',
      customerId: org.customerId || academic.customerId || '',
      institutionId: org.institutionId || academic.institutionId || '',
      server: serverCode,
      region,
      institutionCode: institutionCode || '',
      accountCode: accountCode || '',
      city: geo.city,
      state: geo.state,
      country: geo.country,
      timezone: selectTimezone(org.timezone, geo, region)
    });
  }

  return compiled.sort((a, b) => {
    if (a.server === b.server) {
      return a.accountCode.localeCompare(b.accountCode);
    }
    return a.server.localeCompare(b.server);
  });
}

function makeKey(dbServer, customerId, institutionId) {
  if (!dbServer || !customerId || !institutionId) {
    return '';
  }
  return [dbServer, customerId, institutionId].map((val) => String(val).trim().toUpperCase()).join('|');
}

function deriveInstitutionCode(accountCode) {
  if (!accountCode) {
    return '';
  }
  return accountCode.replace(/_INST$/i, '');
}

function deriveAccountCode(institutionCode) {
  if (!institutionCode) {
    return '';
  }
  return /_INST$/i.test(institutionCode) ? institutionCode : `${institutionCode}_INST`;
}

function findMasterRow(masterIndex, { accountCode, institutionCode }) {
  const normalizedAccount = (accountCode || '').toUpperCase();
  const normalizedInstitution = (institutionCode || '').toUpperCase();

  if (normalizedAccount && masterIndex.byInstanceCode.has(normalizedAccount)) {
    return masterIndex.byInstanceCode.get(normalizedAccount);
  }

  if (normalizedInstitution && masterIndex.byInstanceCode.has(normalizedInstitution)) {
    return masterIndex.byInstanceCode.get(normalizedInstitution);
  }

  if (normalizedAccount && masterIndex.byAccountNumber.has(normalizedAccount)) {
    return masterIndex.byAccountNumber.get(normalizedAccount);
  }

  if (normalizedInstitution && masterIndex.byAccountNumber.has(normalizedInstitution)) {
    return masterIndex.byAccountNumber.get(normalizedInstitution);
  }

  return null;
}

function extractGeo(masterRow) {
  if (!masterRow) {
    return { city: 'Unknown', state: 'Unknown', country: 'Unknown' };
  }

  const country = normalizeCountry(masterRow.COUNTRY) || 'Unknown';
  const state = normalizeSubdivision(masterRow.STATE_PROVINCE) || 'Unknown';
  const city = masterRow.CITY ? masterRow.CITY : 'Unknown';

  return { city, state, country };
}

function normalizeCountry(value = '') {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  return COUNTRY_ALIASES[upper] || trimmed;
}

function normalizeSubdivision(value = '') {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  return SUBDIVISION_ALIASES[upper] || upper;
}

function deriveServerCode(dbServer = '') {
  if (!dbServer) {
    return '';
  }
  const match = dbServer.match(/^DWH_(.+)_A_RO$/i);
  const server = match ? match[1] : dbServer;
  return server.toLowerCase();
}

function selectTimezone(existingTimezone, geo, region) {
  if (existingTimezone) {
    return existingTimezone;
  }

  const country = geo.country;
  const state = geo.state;

  if (country === 'United States') {
    const stateTz = US_STATE_TZ[state];
    if (stateTz) {
      return stateTz;
    }
  }

  if (country === 'Canada') {
    const provinceTz = CA_PROVINCE_TZ[state];
    if (provinceTz) {
      return provinceTz;
    }
  }

  if (country === 'Australia') {
    const auTz = AU_STATE_TZ[state];
    if (auTz) {
      return auTz;
    }
  }

  if (DEFAULT_COUNTRY_TZ[country]) {
    return DEFAULT_COUNTRY_TZ[country];
  }

  if (REGION_FALLBACK_TZ[region]) {
    return REGION_FALLBACK_TZ[region];
  }

  return 'Unknown';
}

function writeOutput(records) {
  const serialized = JSON.stringify(records, null, 2);
  const banner = '/**\n * Auto-generated customer master list.\n * Source: buildCustomerMaster.js\n */\n\n';
  const moduleExport = `${banner}const compiledCustomerMaster = ${serialized};\n\nmodule.exports = { compiledCustomerMaster };\n`;
  fs.writeFileSync(OUTPUT_PATH, moduleExport, 'utf8');
}
