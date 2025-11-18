/**
 * Institution Timezone Manager Module
 * Provides timezone lookup from instTimezones.dsv data
 * Lookup priority: ORG_CODE > CUSTOMERID > INSTITUTIONID
 * 
 * @module institutionTimezoneManager
 */

const InstitutionTimezoneManager = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  
  let isInitialized = false;
  
  // Embedded timezone data from instTimezones.dsv
// Institution Timezone Data
// Auto-generated from instTimezones.dsv
// Lookup priority: ORG_CODE > CUSTOMERID > INSTITUTIONID

  const INSTITUTION_TIMEZONE_DATA = {
  byOrgCode: {
  "EXLDEV1_INST": {
    "timezone": "Australia/Brisbane",
    "orgName": "The Asia-Pacific Alma Library",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "110"
    ],
    "institutionIds": [
      "121"
    ]
  },
  "QA_1_INST": {
    "timezone": "Asia/Jerusalem",
    "orgName": "QA - Provisioning",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "300"
    ],
    "institutionIds": [
      "301"
    ]
  },
  "ANZ_DEMO_1": {
    "timezone": "Australia/Sydney",
    "orgName": "ANZ Demo",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "480"
    ],
    "institutionIds": [
      "481"
    ]
  },
  "TRAINING_NZ_CLEAN": {
    "timezone": "US/Eastern",
    "orgName": "Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "500"
    ],
    "institutionIds": [
      "501"
    ]
  },
  "TRAINING_MEMBER1_CLEAN": {
    "timezone": "US/Central",
    "orgName": "Network - Member 1",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "500"
    ],
    "institutionIds": [
      "502"
    ]
  },
  "TRAINING_MEMBER2_CLEAN": {
    "timezone": "US/Central",
    "orgName": "Network - Member 2",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "500"
    ],
    "institutionIds": [
      "503"
    ]
  },
  "TRAINING_1_INST": {
    "timezone": "US/Central",
    "orgName": "Alma Institution",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "510"
    ],
    "institutionIds": [
      "521"
    ]
  },
  "TRIAL_1_INST": {
    "timezone": "Australia/Sydney",
    "orgName": "Alma Trial 1",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "570"
    ],
    "institutionIds": [
      "571"
    ]
  },
  "TRIAL_2_INST": {
    "timezone": "Australia/Sydney",
    "orgName": "Alma Trial 2",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "572"
    ],
    "institutionIds": [
      "573"
    ]
  },
  "TRIAL_3_INST": {
    "timezone": "Australia/Sydney",
    "orgName": "Alma Trial 3",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "574"
    ],
    "institutionIds": [
      "575"
    ]
  },
  "TRIAL_6_INST": {
    "timezone": "Australia/Sydney",
    "orgName": "Alma Trial 6",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "580"
    ],
    "institutionIds": [
      "581"
    ]
  },
  "TRIAL_7_INST": {
    "timezone": "Australia/Sydney",
    "orgName": "Alma Trial 7",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "582"
    ],
    "institutionIds": [
      "583"
    ]
  },
  "TRIAL_8_INST": {
    "timezone": "Australia/Sydney",
    "orgName": "Alma Trial 8",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "584"
    ],
    "institutionIds": [
      "585"
    ]
  },
  "TRIAL_9_INST": {
    "timezone": "Australia/Sydney",
    "orgName": "Alma Trial 9",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "586"
    ],
    "institutionIds": [
      "587"
    ]
  },
  "TRIAL_10_INST": {
    "timezone": "US/Eastern",
    "orgName": "Alma Trial 10",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "588"
    ],
    "institutionIds": [
      "589"
    ]
  },
  "TRIAL_ELECTRONIC": {
    "timezone": "US/Eastern",
    "orgName": "Alma Electronic Trial",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "750"
    ],
    "institutionIds": [
      "751"
    ]
  },
  "ALMASELECT_INST_1": {
    "timezone": "Asia/Singapore",
    "orgName": "Alma Select Demo 1",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "760"
    ],
    "institutionIds": [
      "761"
    ]
  },
  "ALMASELECT_INST_2": {
    "timezone": "Asia/Singapore",
    "orgName": "Alma Select Demo 2",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "760"
    ],
    "institutionIds": [
      "762"
    ]
  },
  "APAC_DEMO_ALMA_COLLEGE": {
    "timezone": "Asia/Singapore",
    "orgName": "APAC DEMO - Alma College",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "975"
    ],
    "institutionIds": [
      "976"
    ]
  },
  "61MONASH_MA": {
    "timezone": "Australia/West",
    "orgName": "Monash University Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "1740"
    ],
    "institutionIds": [
      "1752"
    ]
  },
  "61MONASH_SA": {
    "timezone": "Africa/Johannesburg",
    "orgName": "Monash University South Africa",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "1740"
    ],
    "institutionIds": [
      "1753"
    ]
  },
  "65SIM_INST": {
    "timezone": "Asia/Singapore",
    "orgName": "Singapore Institute Of Management (Singapore)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2190"
    ],
    "institutionIds": [
      "2191"
    ]
  },
  "61UNI_CAM": {
    "timezone": "Australia/Sydney",
    "orgName": "Campion College",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ],
    "institutionIds": [
      "2355"
    ]
  },
  "61UNI_CIS": {
    "timezone": "Australia/Sydney",
    "orgName": "Catholic Institute of Sydney",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ],
    "institutionIds": [
      "2356"
    ]
  },
  "61UNI_JMC": {
    "timezone": "Australia/Sydney",
    "orgName": "JMC Academy",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ],
    "institutionIds": [
      "2359"
    ]
  },
  "61UNI_NPG": {
    "timezone": "Australia/Sydney",
    "orgName": "National Portrait Gallery",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ],
    "institutionIds": [
      "2362"
    ]
  },
  "61UNI_NPL": {
    "timezone": "Australia/Sydney",
    "orgName": "NSW Police",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ],
    "institutionIds": [
      "2364"
    ]
  },
  "61UNI_TOP": {
    "timezone": "Australia/Sydney",
    "orgName": "IMC",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ],
    "institutionIds": [
      "2377"
    ]
  },
  "65SUTD_INST": {
    "timezone": "Asia/Singapore",
    "orgName": "Singapore University of Technology and Design",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2405"
    ],
    "institutionIds": [
      "2406"
    ]
  },
  "82SNU_INST": {
    "timezone": "Asia/Seoul",
    "orgName": "Seoul National University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2590"
    ],
    "institutionIds": [
      "2591"
    ]
  },
  "82UNIST_INST": {
    "timezone": "Asia/Seoul",
    "orgName": "Ulsan National Institute of Science and Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2595"
    ],
    "institutionIds": [
      "2596"
    ]
  },
  "65SMU_INST": {
    "timezone": "Asia/Singapore",
    "orgName": "Singapore Management University (SMU)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2600"
    ],
    "institutionIds": [
      "2601"
    ]
  },
  "82POSTECH_INST": {
    "timezone": "Asia/Seoul",
    "orgName": "POSTECH",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3285"
    ],
    "institutionIds": [
      "3286"
    ]
  },
  "852JULAC_NETWORK": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Joint University Librarians Advisory Committee (JULAC) - Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ],
    "institutionIds": [
      "3406"
    ]
  },
  "852JULAC_CUHK": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "The Chinese University of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ],
    "institutionIds": [
      "3407"
    ]
  },
  "852JULAC_CUH": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "City University of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ],
    "institutionIds": [
      "3408"
    ]
  },
  "852JULAC_HKBU": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Hong Kong Baptist University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ],
    "institutionIds": [
      "3409"
    ]
  },
  "852JULAC_EDUHK": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Education University of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ],
    "institutionIds": [
      "3410"
    ]
  },
  "852JULAC_HKPU": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Hong Kong Polytechnic University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ],
    "institutionIds": [
      "3411"
    ]
  },
  "852JULAC_HKUST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "HKUST Library",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ],
    "institutionIds": [
      "3412"
    ]
  },
  "852JULAC_LUN": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Lingnan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ],
    "institutionIds": [
      "3413"
    ]
  },
  "852JULAC_HKU": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "The University of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ],
    "institutionIds": [
      "3414"
    ]
  },
  "61SCLQ_INST": {
    "timezone": "Australia/Queensland",
    "orgName": "Supreme Court Library Queensland",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3470"
    ],
    "institutionIds": [
      "3471"
    ]
  },
  "63UAP_INST": {
    "timezone": "Asia/Singapore",
    "orgName": "University of Asia and the Pacific",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3585"
    ],
    "institutionIds": [
      "3586"
    ]
  },
  "81KEIO_INST": {
    "timezone": "Asia/Tokyo",
    "orgName": "KEIO University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4030"
    ],
    "institutionIds": [
      "4031"
    ]
  },
  "81SOKEI_WUNI": {
    "timezone": "Asia/Tokyo",
    "orgName": "Waseda University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4030"
    ],
    "institutionIds": [
      "4032"
    ]
  },
  "81SOKEI_NETWORK": {
    "timezone": "Japan",
    "orgName": "SoKei Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4030"
    ],
    "institutionIds": [
      "4033"
    ]
  },
  "81SOKEI_KEIO": {
    "timezone": "Japan",
    "orgName": "Keio University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4030"
    ],
    "institutionIds": [
      "4034"
    ]
  },
  "65SIT_INST": {
    "timezone": "Asia/Singapore",
    "orgName": "Singapore Institute of Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4055"
    ],
    "institutionIds": [
      "4056"
    ]
  },
  "886NKUST_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "National Kaohsiung University of Science and Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4120"
    ],
    "institutionIds": [
      "4121"
    ]
  },
  "852HKAPA_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "The Hong Kong Academy for Performing Arts",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4325"
    ],
    "institutionIds": [
      "4326"
    ]
  },
  "852VTC_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Vocational Training Council",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4680"
    ],
    "institutionIds": [
      "4681"
    ]
  },
  "886NTU_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "?????? National Taiwan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4785"
    ],
    "institutionIds": [
      "4786"
    ]
  },
  "65SUSS_INST": {
    "timezone": "Asia/Singapore",
    "orgName": "Singapore University of Social Sciences",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4925"
    ],
    "institutionIds": [
      "4926"
    ]
  },
  "81NII_NETWORK": {
    "timezone": "Japan",
    "orgName": "National Institute of Informatics - Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5060"
    ],
    "institutionIds": [
      "5061"
    ]
  },
  "81NII_INST1": {
    "timezone": "Japan",
    "orgName": "National Institute of Informatics IZ1",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5060"
    ],
    "institutionIds": [
      "5062"
    ]
  },
  "81NII_INST2": {
    "timezone": "Japan",
    "orgName": "National Institute of Informatics IZ2",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5060"
    ],
    "institutionIds": [
      "5063"
    ]
  },
  "81NII_INST3": {
    "timezone": "Japan",
    "orgName": "National Institute of Informatics IZ3",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5060"
    ],
    "institutionIds": [
      "5064"
    ]
  },
  "853MUST_INST": {
    "timezone": "Asia/Macao",
    "orgName": "Macau University of Science and Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5075"
    ],
    "institutionIds": [
      "5076"
    ]
  },
  "65NTU_INST": {
    "timezone": "Asia/Singapore",
    "orgName": "Nanyang Technological University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5145"
    ],
    "institutionIds": [
      "5146"
    ]
  },
  "44NOTTS_UNMC": {
    "timezone": "Asia/Kuala_Lumpur",
    "orgName": "University of Nottingham - Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5560"
    ],
    "institutionIds": [
      "5562"
    ]
  },
  "852WKCDA_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "West Kowloon Cultural District Authority",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5675"
    ],
    "institutionIds": [
      "5676"
    ]
  },
  "852HKBTS_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Hong Kong Baptist Theological Seminary",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5695"
    ],
    "institutionIds": [
      "5696"
    ]
  },
  "886NCCU_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "National Chengchi University (??????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5720"
    ],
    "institutionIds": [
      "5721"
    ]
  },
  "886UCO_NETWORK": {
    "timezone": "Asia/Taipei",
    "orgName": "U12 Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5910"
    ],
    "institutionIds": [
      "5911"
    ]
  },
  "886UCO_TKU": {
    "timezone": "Asia/Taipei",
    "orgName": "TKU ????",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5910"
    ],
    "institutionIds": [
      "5912"
    ]
  },
  "886UCO_SCU": {
    "timezone": "Asia/Taipei",
    "orgName": "???? / SCU",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5910"
    ],
    "institutionIds": [
      "5913"
    ]
  },
  "886UCO_MCU": {
    "timezone": "Asia/Taipei",
    "orgName": "Ming Chuan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5910"
    ],
    "institutionIds": [
      "5914"
    ]
  },
  "81BU_INST": {
    "timezone": "Japan",
    "orgName": "Bukkyo University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6200"
    ],
    "institutionIds": [
      "6201"
    ]
  },
  "853UOM_INST": {
    "timezone": "Asia/Macau",
    "orgName": "University of Macau",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6305"
    ],
    "institutionIds": [
      "6306"
    ]
  },
  "65NIE_INST": {
    "timezone": "Asia/Singapore",
    "orgName": "National Institute of Education",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6320"
    ],
    "institutionIds": [
      "6321"
    ]
  },
  "63DLSUL_INST": {
    "timezone": "Asia/Manila",
    "orgName": "De La Salle University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6350"
    ],
    "institutionIds": [
      "6351"
    ]
  },
  "60BOM_INST": {
    "timezone": "Asia/Kuala_Lumpur",
    "orgName": "Bank Negara Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6610"
    ],
    "institutionIds": [
      "6611"
    ]
  },
  "84VINU_INST": {
    "timezone": "Asia/Saigon",
    "orgName": "VinUniversity",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6680"
    ],
    "institutionIds": [
      "6681"
    ]
  },
  "886UST_NETWORK": {
    "timezone": "Asia/Taipei",
    "orgName": "University System of Taiwan (????????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6770"
    ],
    "institutionIds": [
      "6771"
    ]
  },
  "886UST_NYCU": {
    "timezone": "Asia/Taipei",
    "orgName": "National Yang Ming Chiao Tung University(????????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6770"
    ],
    "institutionIds": [
      "6772"
    ]
  },
  "886UST_NCU": {
    "timezone": "Asia/Taipei",
    "orgName": "National Central University (??????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6770"
    ],
    "institutionIds": [
      "6773"
    ]
  },
  "886UST_NTHU": {
    "timezone": "Asia/Taipei",
    "orgName": "National Tsing Hua University(??????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6770"
    ],
    "institutionIds": [
      "6774"
    ]
  },
  "852HA_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Hospital Authority (HA)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6805"
    ],
    "institutionIds": [
      "6806"
    ]
  },
  "84RVI_INST": {
    "timezone": "Asia/Saigon",
    "orgName": "RMIT University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6820"
    ],
    "institutionIds": [
      "6821"
    ]
  },
  "852LEGCO_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Legislative Council of HKSAR",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6975"
    ],
    "institutionIds": [
      "6976"
    ]
  },
  "81NII_LIB": {
    "timezone": "Japan",
    "orgName": "National Institute of Informatics",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7065"
    ],
    "institutionIds": [
      "7066"
    ]
  },
  "63MU_INST": {
    "timezone": "Asia/Manila",
    "orgName": "Mapua University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7135"
    ],
    "institutionIds": [
      "7136"
    ]
  },
  "65SPO_NETWORK": {
    "timezone": "Asia/Singapore",
    "orgName": "SG JPL Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7170"
    ],
    "institutionIds": [
      "7171"
    ]
  },
  "65SPO_TP": {
    "timezone": "Asia/Singapore",
    "orgName": "Temasek Polytechnic",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7170"
    ],
    "institutionIds": [
      "7172"
    ]
  },
  "65SPO_SP": {
    "timezone": "Asia/Singapore",
    "orgName": "Singapore Polytechnic",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7170"
    ],
    "institutionIds": [
      "7173"
    ]
  },
  "81NII_JUSTICE": {
    "timezone": "Japan",
    "orgName": "National Institute of Informatics � Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7245"
    ],
    "institutionIds": [
      "7246"
    ]
  },
  "81UEC_INST": {
    "timezone": "Japan",
    "orgName": "The University of Electro-Communications",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7420"
    ],
    "institutionIds": [
      "7421"
    ]
  },
  "81NII_NW": {
    "timezone": "Japan",
    "orgName": "The E-resources Data Sharing Services",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7530"
    ],
    "institutionIds": [
      "7531"
    ]
  },
  "852SFU_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Saint Francis University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7540"
    ],
    "institutionIds": [
      "7541"
    ]
  },
  "852HKSYU_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Hong Kong Shue Yan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7545"
    ],
    "institutionIds": [
      "7546"
    ]
  },
  "853CUM_INST": {
    "timezone": "Asia/Macau",
    "orgName": "City University of Macau",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7550"
    ],
    "institutionIds": [
      "7551"
    ]
  },
  "82ULSAN_INST": {
    "timezone": "Asia/Seoul",
    "orgName": "University of Ulsan",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7590"
    ],
    "institutionIds": [
      "7591"
    ]
  },
  "886CCPL_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "Chiang Chingkuo Presidential Library",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7745"
    ],
    "institutionIds": [
      "7746"
    ]
  },
  "65ITE_INST": {
    "timezone": "Asia/Singapore",
    "orgName": "Institute of Technical Education ITE",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7970"
    ],
    "institutionIds": [
      "7971"
    ]
  },
  "886NCHU_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "National Chung Hsing University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7975"
    ],
    "institutionIds": [
      "7976"
    ]
  },
  "886NSYSU_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "National Sun Yat-sen University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7975"
    ],
    "institutionIds": [
      "7977"
    ]
  },
  "886NCKU_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "National Cheng Kung University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7975"
    ],
    "institutionIds": [
      "7978"
    ]
  },
  "886CCU_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "National Chung Cheng University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7975"
    ],
    "institutionIds": [
      "7979"
    ]
  },
  "852HKMU_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Hong Kong Metropolitan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8060"
    ],
    "institutionIds": [
      "8061"
    ]
  },
  "852TWC_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Tung Wah College",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8060"
    ],
    "institutionIds": [
      "8062"
    ]
  },
  "852CHCHE_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Hong Kong Chu Hai College",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8060"
    ],
    "institutionIds": [
      "8063"
    ]
  },
  "852HSUHK_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "The Hang Seng University of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8060"
    ],
    "institutionIds": [
      "8064"
    ]
  },
  "65SPO_NYP": {
    "timezone": "Asia/Singapore",
    "orgName": "Nanyang Polytechnic",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8080"
    ],
    "institutionIds": [
      "8081"
    ]
  },
  "65SPO_NP": {
    "timezone": "Asia/Singapore",
    "orgName": "Ngee Ann Polytechnic",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8080"
    ],
    "institutionIds": [
      "8082"
    ]
  },
  "886NKUHT_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "National Kaohsiung University of Hospitality and Tourism",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8600"
    ],
    "institutionIds": [
      "8601"
    ]
  },
  "855UPP_INST": {
    "timezone": "Asia/Phnom_Penh",
    "orgName": "Royal University of Phnom Penh",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8715"
    ],
    "institutionIds": [
      "8716"
    ]
  },
  "82HUN_INST": {
    "timezone": "Asia/Seoul",
    "orgName": "Hongik University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8815"
    ],
    "institutionIds": [
      "8816"
    ]
  },
  "853IFT_INST": {
    "timezone": "Asia/Macau",
    "orgName": "Macao University of Tourism",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8820"
    ],
    "institutionIds": [
      "8821"
    ]
  },
  "66CMU_INST": {
    "timezone": "Asia/Bangkok",
    "orgName": "Chiang Mai Univ",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8905"
    ],
    "institutionIds": [
      "8906"
    ]
  },
  "852HKPU_PCOPACE": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "College of Professional and Continuing and Education",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9020"
    ],
    "institutionIds": [
      "9021"
    ]
  },
  "852YFBI_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Yan Fook Theological Seminary",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9025"
    ],
    "institutionIds": [
      "9026"
    ]
  },
  "81TORAY_INST": {
    "timezone": "Asia/Tokyo",
    "orgName": "Toray Industries Inc.",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9065"
    ],
    "institutionIds": [
      "9066"
    ]
  },
  "60NUMM_INST": {
    "timezone": "Asia/Kuala_Lumpur",
    "orgName": "Newcastle University Medicine Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9075"
    ],
    "institutionIds": [
      "9076"
    ]
  },
  "63UOSTP_INST": {
    "timezone": "Asia/Manila",
    "orgName": "University of Santo Tomas",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9110"
    ],
    "institutionIds": [
      "9111"
    ]
  },
  "886NHRI_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "National Health Research Institutes",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9125"
    ],
    "institutionIds": [
      "9126"
    ]
  },
  "66NIDA_INST": {
    "timezone": "Asia/Bangkok",
    "orgName": "National Institute of Development Administration",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9170"
    ],
    "institutionIds": [
      "9171"
    ]
  },
  "852HKIC_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Hong Kong Institute of Construction",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9175"
    ],
    "institutionIds": [
      "9176"
    ]
  },
  "852HKDC_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Hong Kong Design Centre",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9195"
    ],
    "institutionIds": [
      "9196"
    ]
  },
  "82KUN_INST": {
    "timezone": "Asia/Seoul",
    "orgName": "Konkuk University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9220"
    ],
    "institutionIds": [
      "9221"
    ]
  },
  "66MU_INST": {
    "timezone": "Asia/Bangkok",
    "orgName": "Mahidol University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9230"
    ],
    "institutionIds": [
      "9231"
    ]
  },
  "81UKITAK_INST": {
    "timezone": "Asia/Tokyo",
    "orgName": "Kitakyushu Shiritsu Daigaku",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9270"
    ],
    "institutionIds": [
      "9271"
    ]
  },
  "63UPS_INST": {
    "timezone": "Asia/Manila",
    "orgName": "University of the Philippines System",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9400"
    ],
    "institutionIds": [
      "9401"
    ]
  },
  "81KPU_INST": {
    "timezone": "Asia/Tokyo",
    "orgName": "Kobe Pharmaceutical University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9405"
    ],
    "institutionIds": [
      "9406"
    ]
  },
  "82KST_AJOU": {
    "timezone": "Asia/Seoul",
    "orgName": "Ajou University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9440"
    ],
    "institutionIds": [
      "9441"
    ]
  },
  "852JUD_INST": {
    "timezone": "Asia/Hong_Kong",
    "orgName": "Judiciary Libraries of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9520"
    ],
    "institutionIds": [
      "9521"
    ]
  },
  "92FCCF_INST": {
    "timezone": "Asia/Karachi",
    "orgName": "Forman Christian College (FCC)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9533"
    ],
    "institutionIds": [
      "9534"
    ]
  },
  "92LUMS_INST": {
    "timezone": "Asia/Karachi",
    "orgName": "Lahore University of Management Sciences",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9537"
    ],
    "institutionIds": [
      "9538"
    ]
  },
  "886FCU_INST": {
    "timezone": "Asia/Taipei",
    "orgName": "Feng Chia University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9607"
    ],
    "institutionIds": [
      "9608"
    ]
  },
  "66NLT_INST": {
    "timezone": "Asia/Bangkok",
    "orgName": "National Library of Thailand [Institute]",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9623"
    ],
    "institutionIds": [
      "9624"
    ]
  }
},
  byCustomerId: {
  "110": {
    "timezone": "Australia/Brisbane",
    "orgCode": "EXLDEV1_INST",
    "orgName": "The Asia-Pacific Alma Library",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "121"
    ]
  },
  "300": {
    "timezone": "Asia/Jerusalem",
    "orgCode": "QA_1_INST",
    "orgName": "QA - Provisioning",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "301"
    ]
  },
  "480": {
    "timezone": "Australia/Sydney",
    "orgCode": "ANZ_DEMO_1",
    "orgName": "ANZ Demo",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "481"
    ]
  },
  "500": {
    "timezone": "US/Eastern",
    "orgCode": "TRAINING_NZ_CLEAN",
    "orgName": "Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "501",
      "502",
      "503"
    ]
  },
  "510": {
    "timezone": "US/Central",
    "orgCode": "TRAINING_1_INST",
    "orgName": "Alma Institution",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "521"
    ]
  },
  "570": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_1_INST",
    "orgName": "Alma Trial 1",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "571"
    ]
  },
  "572": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_2_INST",
    "orgName": "Alma Trial 2",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "573"
    ]
  },
  "574": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_3_INST",
    "orgName": "Alma Trial 3",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "575"
    ]
  },
  "580": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_6_INST",
    "orgName": "Alma Trial 6",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "581"
    ]
  },
  "582": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_7_INST",
    "orgName": "Alma Trial 7",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "583"
    ]
  },
  "584": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_8_INST",
    "orgName": "Alma Trial 8",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "585"
    ]
  },
  "586": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_9_INST",
    "orgName": "Alma Trial 9",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "587"
    ]
  },
  "588": {
    "timezone": "US/Eastern",
    "orgCode": "TRIAL_10_INST",
    "orgName": "Alma Trial 10",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "589"
    ]
  },
  "750": {
    "timezone": "US/Eastern",
    "orgCode": "TRIAL_ELECTRONIC",
    "orgName": "Alma Electronic Trial",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "751"
    ]
  },
  "760": {
    "timezone": "Asia/Singapore",
    "orgCode": "ALMASELECT_INST_1",
    "orgName": "Alma Select Demo 1",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "761",
      "762"
    ]
  },
  "975": {
    "timezone": "Asia/Singapore",
    "orgCode": "APAC_DEMO_ALMA_COLLEGE",
    "orgName": "APAC DEMO - Alma College",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "976"
    ]
  },
  "1740": {
    "timezone": "Australia/West",
    "orgCode": "61MONASH_MA",
    "orgName": "Monash University Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "1752",
      "1753"
    ]
  },
  "2190": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SIM_INST",
    "orgName": "Singapore Institute Of Management (Singapore)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "2191"
    ]
  },
  "2350": {
    "timezone": "Australia/Sydney",
    "orgCode": "61UNI_CAM",
    "orgName": "Campion College",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "2355",
      "2356",
      "2359",
      "2362",
      "2364",
      "2377"
    ]
  },
  "2405": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SUTD_INST",
    "orgName": "Singapore University of Technology and Design",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "2406"
    ]
  },
  "2590": {
    "timezone": "Asia/Seoul",
    "orgCode": "82SNU_INST",
    "orgName": "Seoul National University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "2591"
    ]
  },
  "2595": {
    "timezone": "Asia/Seoul",
    "orgCode": "82UNIST_INST",
    "orgName": "Ulsan National Institute of Science and Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "2596"
    ]
  },
  "2600": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SMU_INST",
    "orgName": "Singapore Management University (SMU)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "2601"
    ]
  },
  "3285": {
    "timezone": "Asia/Seoul",
    "orgCode": "82POSTECH_INST",
    "orgName": "POSTECH",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "3286"
    ]
  },
  "3405": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JULAC_NETWORK",
    "orgName": "Joint University Librarians Advisory Committee (JULAC) - Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "3406",
      "3407",
      "3408",
      "3409",
      "3410",
      "3411",
      "3412",
      "3413",
      "3414"
    ]
  },
  "3470": {
    "timezone": "Australia/Queensland",
    "orgCode": "61SCLQ_INST",
    "orgName": "Supreme Court Library Queensland",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "3471"
    ]
  },
  "3585": {
    "timezone": "Asia/Singapore",
    "orgCode": "63UAP_INST",
    "orgName": "University of Asia and the Pacific",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "3586"
    ]
  },
  "4030": {
    "timezone": "Asia/Tokyo",
    "orgCode": "81KEIO_INST",
    "orgName": "KEIO University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "4031",
      "4032",
      "4033",
      "4034"
    ]
  },
  "4055": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SIT_INST",
    "orgName": "Singapore Institute of Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "4056"
    ]
  },
  "4120": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NKUST_INST",
    "orgName": "National Kaohsiung University of Science and Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "4121"
    ]
  },
  "4325": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKAPA_INST",
    "orgName": "The Hong Kong Academy for Performing Arts",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "4326"
    ]
  },
  "4680": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852VTC_INST",
    "orgName": "Vocational Training Council",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "4681"
    ]
  },
  "4785": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NTU_INST",
    "orgName": "?????? National Taiwan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "4786"
    ]
  },
  "4925": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SUSS_INST",
    "orgName": "Singapore University of Social Sciences",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "4926"
    ]
  },
  "5060": {
    "timezone": "Japan",
    "orgCode": "81NII_NETWORK",
    "orgName": "National Institute of Informatics - Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "5061",
      "5062",
      "5063",
      "5064"
    ]
  },
  "5075": {
    "timezone": "Asia/Macao",
    "orgCode": "853MUST_INST",
    "orgName": "Macau University of Science and Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "5076"
    ]
  },
  "5145": {
    "timezone": "Asia/Singapore",
    "orgCode": "65NTU_INST",
    "orgName": "Nanyang Technological University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "5146"
    ]
  },
  "5560": {
    "timezone": "Asia/Kuala_Lumpur",
    "orgCode": "44NOTTS_UNMC",
    "orgName": "University of Nottingham - Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "5562"
    ]
  },
  "5675": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852WKCDA_INST",
    "orgName": "West Kowloon Cultural District Authority",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "5676"
    ]
  },
  "5695": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKBTS_INST",
    "orgName": "Hong Kong Baptist Theological Seminary",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "5696"
    ]
  },
  "5720": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NCCU_INST",
    "orgName": "National Chengchi University (??????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "5721"
    ]
  },
  "5910": {
    "timezone": "Asia/Taipei",
    "orgCode": "886UCO_NETWORK",
    "orgName": "U12 Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "5911",
      "5912",
      "5913",
      "5914"
    ]
  },
  "6200": {
    "timezone": "Japan",
    "orgCode": "81BU_INST",
    "orgName": "Bukkyo University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "6201"
    ]
  },
  "6305": {
    "timezone": "Asia/Macau",
    "orgCode": "853UOM_INST",
    "orgName": "University of Macau",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "6306"
    ]
  },
  "6320": {
    "timezone": "Asia/Singapore",
    "orgCode": "65NIE_INST",
    "orgName": "National Institute of Education",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "6321"
    ]
  },
  "6350": {
    "timezone": "Asia/Manila",
    "orgCode": "63DLSUL_INST",
    "orgName": "De La Salle University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "6351"
    ]
  },
  "6610": {
    "timezone": "Asia/Kuala_Lumpur",
    "orgCode": "60BOM_INST",
    "orgName": "Bank Negara Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "6611"
    ]
  },
  "6680": {
    "timezone": "Asia/Saigon",
    "orgCode": "84VINU_INST",
    "orgName": "VinUniversity",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "6681"
    ]
  },
  "6770": {
    "timezone": "Asia/Taipei",
    "orgCode": "886UST_NETWORK",
    "orgName": "University System of Taiwan (????????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "6771",
      "6772",
      "6773",
      "6774"
    ]
  },
  "6805": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HA_INST",
    "orgName": "Hospital Authority (HA)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "6806"
    ]
  },
  "6820": {
    "timezone": "Asia/Saigon",
    "orgCode": "84RVI_INST",
    "orgName": "RMIT University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "6821"
    ]
  },
  "6975": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852LEGCO_INST",
    "orgName": "Legislative Council of HKSAR",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "6976"
    ]
  },
  "7065": {
    "timezone": "Japan",
    "orgCode": "81NII_LIB",
    "orgName": "National Institute of Informatics",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7066"
    ]
  },
  "7135": {
    "timezone": "Asia/Manila",
    "orgCode": "63MU_INST",
    "orgName": "Mapua University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7136"
    ]
  },
  "7170": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SPO_NETWORK",
    "orgName": "SG JPL Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7171",
      "7172",
      "7173"
    ]
  },
  "7245": {
    "timezone": "Japan",
    "orgCode": "81NII_JUSTICE",
    "orgName": "National Institute of Informatics � Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7246"
    ]
  },
  "7420": {
    "timezone": "Japan",
    "orgCode": "81UEC_INST",
    "orgName": "The University of Electro-Communications",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7421"
    ]
  },
  "7530": {
    "timezone": "Japan",
    "orgCode": "81NII_NW",
    "orgName": "The E-resources Data Sharing Services",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7531"
    ]
  },
  "7540": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852SFU_INST",
    "orgName": "Saint Francis University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7541"
    ]
  },
  "7545": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKSYU_INST",
    "orgName": "Hong Kong Shue Yan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7546"
    ]
  },
  "7550": {
    "timezone": "Asia/Macau",
    "orgCode": "853CUM_INST",
    "orgName": "City University of Macau",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7551"
    ]
  },
  "7590": {
    "timezone": "Asia/Seoul",
    "orgCode": "82ULSAN_INST",
    "orgName": "University of Ulsan",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7591"
    ]
  },
  "7745": {
    "timezone": "Asia/Taipei",
    "orgCode": "886CCPL_INST",
    "orgName": "Chiang Chingkuo Presidential Library",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7746"
    ]
  },
  "7970": {
    "timezone": "Asia/Singapore",
    "orgCode": "65ITE_INST",
    "orgName": "Institute of Technical Education ITE",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7971"
    ]
  },
  "7975": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NCHU_INST",
    "orgName": "National Chung Hsing University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "7976",
      "7977",
      "7978",
      "7979"
    ]
  },
  "8060": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKMU_INST",
    "orgName": "Hong Kong Metropolitan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "8061",
      "8062",
      "8063",
      "8064"
    ]
  },
  "8080": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SPO_NYP",
    "orgName": "Nanyang Polytechnic",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "8081",
      "8082"
    ]
  },
  "8600": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NKUHT_INST",
    "orgName": "National Kaohsiung University of Hospitality and Tourism",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "8601"
    ]
  },
  "8715": {
    "timezone": "Asia/Phnom_Penh",
    "orgCode": "855UPP_INST",
    "orgName": "Royal University of Phnom Penh",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "8716"
    ]
  },
  "8815": {
    "timezone": "Asia/Seoul",
    "orgCode": "82HUN_INST",
    "orgName": "Hongik University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "8816"
    ]
  },
  "8820": {
    "timezone": "Asia/Macau",
    "orgCode": "853IFT_INST",
    "orgName": "Macao University of Tourism",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "8821"
    ]
  },
  "8905": {
    "timezone": "Asia/Bangkok",
    "orgCode": "66CMU_INST",
    "orgName": "Chiang Mai Univ",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "8906"
    ]
  },
  "9020": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKPU_PCOPACE",
    "orgName": "College of Professional and Continuing and Education",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9021"
    ]
  },
  "9025": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852YFBI_INST",
    "orgName": "Yan Fook Theological Seminary",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9026"
    ]
  },
  "9065": {
    "timezone": "Asia/Tokyo",
    "orgCode": "81TORAY_INST",
    "orgName": "Toray Industries Inc.",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9066"
    ]
  },
  "9075": {
    "timezone": "Asia/Kuala_Lumpur",
    "orgCode": "60NUMM_INST",
    "orgName": "Newcastle University Medicine Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9076"
    ]
  },
  "9110": {
    "timezone": "Asia/Manila",
    "orgCode": "63UOSTP_INST",
    "orgName": "University of Santo Tomas",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9111"
    ]
  },
  "9125": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NHRI_INST",
    "orgName": "National Health Research Institutes",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9126"
    ]
  },
  "9170": {
    "timezone": "Asia/Bangkok",
    "orgCode": "66NIDA_INST",
    "orgName": "National Institute of Development Administration",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9171"
    ]
  },
  "9175": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKIC_INST",
    "orgName": "Hong Kong Institute of Construction",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9176"
    ]
  },
  "9195": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKDC_INST",
    "orgName": "Hong Kong Design Centre",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9196"
    ]
  },
  "9220": {
    "timezone": "Asia/Seoul",
    "orgCode": "82KUN_INST",
    "orgName": "Konkuk University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9221"
    ]
  },
  "9230": {
    "timezone": "Asia/Bangkok",
    "orgCode": "66MU_INST",
    "orgName": "Mahidol University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9231"
    ]
  },
  "9270": {
    "timezone": "Asia/Tokyo",
    "orgCode": "81UKITAK_INST",
    "orgName": "Kitakyushu Shiritsu Daigaku",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9271"
    ]
  },
  "9400": {
    "timezone": "Asia/Manila",
    "orgCode": "63UPS_INST",
    "orgName": "University of the Philippines System",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9401"
    ]
  },
  "9405": {
    "timezone": "Asia/Tokyo",
    "orgCode": "81KPU_INST",
    "orgName": "Kobe Pharmaceutical University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9406"
    ]
  },
  "9440": {
    "timezone": "Asia/Seoul",
    "orgCode": "82KST_AJOU",
    "orgName": "Ajou University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9441"
    ]
  },
  "9520": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JUD_INST",
    "orgName": "Judiciary Libraries of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9521"
    ]
  },
  "9533": {
    "timezone": "Asia/Karachi",
    "orgCode": "92FCCF_INST",
    "orgName": "Forman Christian College (FCC)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9534"
    ]
  },
  "9537": {
    "timezone": "Asia/Karachi",
    "orgCode": "92LUMS_INST",
    "orgName": "Lahore University of Management Sciences",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9538"
    ]
  },
  "9607": {
    "timezone": "Asia/Taipei",
    "orgCode": "886FCU_INST",
    "orgName": "Feng Chia University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9608"
    ]
  },
  "9623": {
    "timezone": "Asia/Bangkok",
    "orgCode": "66NLT_INST",
    "orgName": "National Library of Thailand [Institute]",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "institutionIds": [
      "9624"
    ]
  }
},
  byInstitutionId: {
  "121": {
    "timezone": "Australia/Brisbane",
    "orgCode": "EXLDEV1_INST",
    "orgName": "The Asia-Pacific Alma Library",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "110"
    ]
  },
  "301": {
    "timezone": "Asia/Jerusalem",
    "orgCode": "QA_1_INST",
    "orgName": "QA - Provisioning",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "300"
    ]
  },
  "481": {
    "timezone": "Australia/Sydney",
    "orgCode": "ANZ_DEMO_1",
    "orgName": "ANZ Demo",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "480"
    ]
  },
  "501": {
    "timezone": "US/Eastern",
    "orgCode": "TRAINING_NZ_CLEAN",
    "orgName": "Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "500"
    ]
  },
  "502": {
    "timezone": "US/Central",
    "orgCode": "TRAINING_MEMBER1_CLEAN",
    "orgName": "Network - Member 1",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "500"
    ]
  },
  "503": {
    "timezone": "US/Central",
    "orgCode": "TRAINING_MEMBER2_CLEAN",
    "orgName": "Network - Member 2",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "500"
    ]
  },
  "521": {
    "timezone": "US/Central",
    "orgCode": "TRAINING_1_INST",
    "orgName": "Alma Institution",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "510"
    ]
  },
  "571": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_1_INST",
    "orgName": "Alma Trial 1",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "570"
    ]
  },
  "573": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_2_INST",
    "orgName": "Alma Trial 2",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "572"
    ]
  },
  "575": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_3_INST",
    "orgName": "Alma Trial 3",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "574"
    ]
  },
  "581": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_6_INST",
    "orgName": "Alma Trial 6",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "580"
    ]
  },
  "583": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_7_INST",
    "orgName": "Alma Trial 7",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "582"
    ]
  },
  "585": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_8_INST",
    "orgName": "Alma Trial 8",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "584"
    ]
  },
  "587": {
    "timezone": "Australia/Sydney",
    "orgCode": "TRIAL_9_INST",
    "orgName": "Alma Trial 9",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "586"
    ]
  },
  "589": {
    "timezone": "US/Eastern",
    "orgCode": "TRIAL_10_INST",
    "orgName": "Alma Trial 10",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "588"
    ]
  },
  "751": {
    "timezone": "US/Eastern",
    "orgCode": "TRIAL_ELECTRONIC",
    "orgName": "Alma Electronic Trial",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "750"
    ]
  },
  "761": {
    "timezone": "Asia/Singapore",
    "orgCode": "ALMASELECT_INST_1",
    "orgName": "Alma Select Demo 1",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "760"
    ]
  },
  "762": {
    "timezone": "Asia/Singapore",
    "orgCode": "ALMASELECT_INST_2",
    "orgName": "Alma Select Demo 2",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "760"
    ]
  },
  "976": {
    "timezone": "Asia/Singapore",
    "orgCode": "APAC_DEMO_ALMA_COLLEGE",
    "orgName": "APAC DEMO - Alma College",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "975"
    ]
  },
  "1752": {
    "timezone": "Australia/West",
    "orgCode": "61MONASH_MA",
    "orgName": "Monash University Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "1740"
    ]
  },
  "1753": {
    "timezone": "Africa/Johannesburg",
    "orgCode": "61MONASH_SA",
    "orgName": "Monash University South Africa",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "1740"
    ]
  },
  "2191": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SIM_INST",
    "orgName": "Singapore Institute Of Management (Singapore)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2190"
    ]
  },
  "2355": {
    "timezone": "Australia/Sydney",
    "orgCode": "61UNI_CAM",
    "orgName": "Campion College",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ]
  },
  "2356": {
    "timezone": "Australia/Sydney",
    "orgCode": "61UNI_CIS",
    "orgName": "Catholic Institute of Sydney",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ]
  },
  "2359": {
    "timezone": "Australia/Sydney",
    "orgCode": "61UNI_JMC",
    "orgName": "JMC Academy",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ]
  },
  "2362": {
    "timezone": "Australia/Sydney",
    "orgCode": "61UNI_NPG",
    "orgName": "National Portrait Gallery",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ]
  },
  "2364": {
    "timezone": "Australia/Sydney",
    "orgCode": "61UNI_NPL",
    "orgName": "NSW Police",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ]
  },
  "2377": {
    "timezone": "Australia/Sydney",
    "orgCode": "61UNI_TOP",
    "orgName": "IMC",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2350"
    ]
  },
  "2406": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SUTD_INST",
    "orgName": "Singapore University of Technology and Design",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2405"
    ]
  },
  "2591": {
    "timezone": "Asia/Seoul",
    "orgCode": "82SNU_INST",
    "orgName": "Seoul National University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2590"
    ]
  },
  "2596": {
    "timezone": "Asia/Seoul",
    "orgCode": "82UNIST_INST",
    "orgName": "Ulsan National Institute of Science and Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2595"
    ]
  },
  "2601": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SMU_INST",
    "orgName": "Singapore Management University (SMU)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "2600"
    ]
  },
  "3286": {
    "timezone": "Asia/Seoul",
    "orgCode": "82POSTECH_INST",
    "orgName": "POSTECH",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3285"
    ]
  },
  "3406": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JULAC_NETWORK",
    "orgName": "Joint University Librarians Advisory Committee (JULAC) - Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ]
  },
  "3407": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JULAC_CUHK",
    "orgName": "The Chinese University of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ]
  },
  "3408": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JULAC_CUH",
    "orgName": "City University of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ]
  },
  "3409": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JULAC_HKBU",
    "orgName": "Hong Kong Baptist University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ]
  },
  "3410": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JULAC_EDUHK",
    "orgName": "Education University of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ]
  },
  "3411": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JULAC_HKPU",
    "orgName": "Hong Kong Polytechnic University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ]
  },
  "3412": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JULAC_HKUST",
    "orgName": "HKUST Library",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ]
  },
  "3413": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JULAC_LUN",
    "orgName": "Lingnan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ]
  },
  "3414": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JULAC_HKU",
    "orgName": "The University of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3405"
    ]
  },
  "3471": {
    "timezone": "Australia/Queensland",
    "orgCode": "61SCLQ_INST",
    "orgName": "Supreme Court Library Queensland",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3470"
    ]
  },
  "3586": {
    "timezone": "Asia/Singapore",
    "orgCode": "63UAP_INST",
    "orgName": "University of Asia and the Pacific",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "3585"
    ]
  },
  "4031": {
    "timezone": "Asia/Tokyo",
    "orgCode": "81KEIO_INST",
    "orgName": "KEIO University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4030"
    ]
  },
  "4032": {
    "timezone": "Asia/Tokyo",
    "orgCode": "81SOKEI_WUNI",
    "orgName": "Waseda University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4030"
    ]
  },
  "4033": {
    "timezone": "Japan",
    "orgCode": "81SOKEI_NETWORK",
    "orgName": "SoKei Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4030"
    ]
  },
  "4034": {
    "timezone": "Japan",
    "orgCode": "81SOKEI_KEIO",
    "orgName": "Keio University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4030"
    ]
  },
  "4056": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SIT_INST",
    "orgName": "Singapore Institute of Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4055"
    ]
  },
  "4121": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NKUST_INST",
    "orgName": "National Kaohsiung University of Science and Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4120"
    ]
  },
  "4326": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKAPA_INST",
    "orgName": "The Hong Kong Academy for Performing Arts",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4325"
    ]
  },
  "4681": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852VTC_INST",
    "orgName": "Vocational Training Council",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4680"
    ]
  },
  "4786": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NTU_INST",
    "orgName": "?????? National Taiwan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4785"
    ]
  },
  "4926": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SUSS_INST",
    "orgName": "Singapore University of Social Sciences",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "4925"
    ]
  },
  "5061": {
    "timezone": "Japan",
    "orgCode": "81NII_NETWORK",
    "orgName": "National Institute of Informatics - Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5060"
    ]
  },
  "5062": {
    "timezone": "Japan",
    "orgCode": "81NII_INST1",
    "orgName": "National Institute of Informatics IZ1",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5060"
    ]
  },
  "5063": {
    "timezone": "Japan",
    "orgCode": "81NII_INST2",
    "orgName": "National Institute of Informatics IZ2",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5060"
    ]
  },
  "5064": {
    "timezone": "Japan",
    "orgCode": "81NII_INST3",
    "orgName": "National Institute of Informatics IZ3",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5060"
    ]
  },
  "5076": {
    "timezone": "Asia/Macao",
    "orgCode": "853MUST_INST",
    "orgName": "Macau University of Science and Technology",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5075"
    ]
  },
  "5146": {
    "timezone": "Asia/Singapore",
    "orgCode": "65NTU_INST",
    "orgName": "Nanyang Technological University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5145"
    ]
  },
  "5562": {
    "timezone": "Asia/Kuala_Lumpur",
    "orgCode": "44NOTTS_UNMC",
    "orgName": "University of Nottingham - Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5560"
    ]
  },
  "5676": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852WKCDA_INST",
    "orgName": "West Kowloon Cultural District Authority",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5675"
    ]
  },
  "5696": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKBTS_INST",
    "orgName": "Hong Kong Baptist Theological Seminary",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5695"
    ]
  },
  "5721": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NCCU_INST",
    "orgName": "National Chengchi University (??????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5720"
    ]
  },
  "5911": {
    "timezone": "Asia/Taipei",
    "orgCode": "886UCO_NETWORK",
    "orgName": "U12 Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5910"
    ]
  },
  "5912": {
    "timezone": "Asia/Taipei",
    "orgCode": "886UCO_TKU",
    "orgName": "TKU ????",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5910"
    ]
  },
  "5913": {
    "timezone": "Asia/Taipei",
    "orgCode": "886UCO_SCU",
    "orgName": "???? / SCU",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5910"
    ]
  },
  "5914": {
    "timezone": "Asia/Taipei",
    "orgCode": "886UCO_MCU",
    "orgName": "Ming Chuan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "5910"
    ]
  },
  "6201": {
    "timezone": "Japan",
    "orgCode": "81BU_INST",
    "orgName": "Bukkyo University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6200"
    ]
  },
  "6306": {
    "timezone": "Asia/Macau",
    "orgCode": "853UOM_INST",
    "orgName": "University of Macau",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6305"
    ]
  },
  "6321": {
    "timezone": "Asia/Singapore",
    "orgCode": "65NIE_INST",
    "orgName": "National Institute of Education",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6320"
    ]
  },
  "6351": {
    "timezone": "Asia/Manila",
    "orgCode": "63DLSUL_INST",
    "orgName": "De La Salle University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6350"
    ]
  },
  "6611": {
    "timezone": "Asia/Kuala_Lumpur",
    "orgCode": "60BOM_INST",
    "orgName": "Bank Negara Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6610"
    ]
  },
  "6681": {
    "timezone": "Asia/Saigon",
    "orgCode": "84VINU_INST",
    "orgName": "VinUniversity",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6680"
    ]
  },
  "6771": {
    "timezone": "Asia/Taipei",
    "orgCode": "886UST_NETWORK",
    "orgName": "University System of Taiwan (????????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6770"
    ]
  },
  "6772": {
    "timezone": "Asia/Taipei",
    "orgCode": "886UST_NYCU",
    "orgName": "National Yang Ming Chiao Tung University(????????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6770"
    ]
  },
  "6773": {
    "timezone": "Asia/Taipei",
    "orgCode": "886UST_NCU",
    "orgName": "National Central University (??????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6770"
    ]
  },
  "6774": {
    "timezone": "Asia/Taipei",
    "orgCode": "886UST_NTHU",
    "orgName": "National Tsing Hua University(??????)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6770"
    ]
  },
  "6806": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HA_INST",
    "orgName": "Hospital Authority (HA)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6805"
    ]
  },
  "6821": {
    "timezone": "Asia/Saigon",
    "orgCode": "84RVI_INST",
    "orgName": "RMIT University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6820"
    ]
  },
  "6976": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852LEGCO_INST",
    "orgName": "Legislative Council of HKSAR",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "6975"
    ]
  },
  "7066": {
    "timezone": "Japan",
    "orgCode": "81NII_LIB",
    "orgName": "National Institute of Informatics",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7065"
    ]
  },
  "7136": {
    "timezone": "Asia/Manila",
    "orgCode": "63MU_INST",
    "orgName": "Mapua University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7135"
    ]
  },
  "7171": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SPO_NETWORK",
    "orgName": "SG JPL Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7170"
    ]
  },
  "7172": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SPO_TP",
    "orgName": "Temasek Polytechnic",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7170"
    ]
  },
  "7173": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SPO_SP",
    "orgName": "Singapore Polytechnic",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7170"
    ]
  },
  "7246": {
    "timezone": "Japan",
    "orgCode": "81NII_JUSTICE",
    "orgName": "National Institute of Informatics � Network",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7245"
    ]
  },
  "7421": {
    "timezone": "Japan",
    "orgCode": "81UEC_INST",
    "orgName": "The University of Electro-Communications",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7420"
    ]
  },
  "7531": {
    "timezone": "Japan",
    "orgCode": "81NII_NW",
    "orgName": "The E-resources Data Sharing Services",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7530"
    ]
  },
  "7541": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852SFU_INST",
    "orgName": "Saint Francis University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7540"
    ]
  },
  "7546": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKSYU_INST",
    "orgName": "Hong Kong Shue Yan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7545"
    ]
  },
  "7551": {
    "timezone": "Asia/Macau",
    "orgCode": "853CUM_INST",
    "orgName": "City University of Macau",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7550"
    ]
  },
  "7591": {
    "timezone": "Asia/Seoul",
    "orgCode": "82ULSAN_INST",
    "orgName": "University of Ulsan",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7590"
    ]
  },
  "7746": {
    "timezone": "Asia/Taipei",
    "orgCode": "886CCPL_INST",
    "orgName": "Chiang Chingkuo Presidential Library",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7745"
    ]
  },
  "7971": {
    "timezone": "Asia/Singapore",
    "orgCode": "65ITE_INST",
    "orgName": "Institute of Technical Education ITE",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7970"
    ]
  },
  "7976": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NCHU_INST",
    "orgName": "National Chung Hsing University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7975"
    ]
  },
  "7977": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NSYSU_INST",
    "orgName": "National Sun Yat-sen University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7975"
    ]
  },
  "7978": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NCKU_INST",
    "orgName": "National Cheng Kung University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7975"
    ]
  },
  "7979": {
    "timezone": "Asia/Taipei",
    "orgCode": "886CCU_INST",
    "orgName": "National Chung Cheng University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "7975"
    ]
  },
  "8061": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKMU_INST",
    "orgName": "Hong Kong Metropolitan University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8060"
    ]
  },
  "8062": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852TWC_INST",
    "orgName": "Tung Wah College",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8060"
    ]
  },
  "8063": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852CHCHE_INST",
    "orgName": "Hong Kong Chu Hai College",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8060"
    ]
  },
  "8064": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HSUHK_INST",
    "orgName": "The Hang Seng University of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8060"
    ]
  },
  "8081": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SPO_NYP",
    "orgName": "Nanyang Polytechnic",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8080"
    ]
  },
  "8082": {
    "timezone": "Asia/Singapore",
    "orgCode": "65SPO_NP",
    "orgName": "Ngee Ann Polytechnic",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8080"
    ]
  },
  "8601": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NKUHT_INST",
    "orgName": "National Kaohsiung University of Hospitality and Tourism",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8600"
    ]
  },
  "8716": {
    "timezone": "Asia/Phnom_Penh",
    "orgCode": "855UPP_INST",
    "orgName": "Royal University of Phnom Penh",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8715"
    ]
  },
  "8816": {
    "timezone": "Asia/Seoul",
    "orgCode": "82HUN_INST",
    "orgName": "Hongik University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8815"
    ]
  },
  "8821": {
    "timezone": "Asia/Macau",
    "orgCode": "853IFT_INST",
    "orgName": "Macao University of Tourism",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8820"
    ]
  },
  "8906": {
    "timezone": "Asia/Bangkok",
    "orgCode": "66CMU_INST",
    "orgName": "Chiang Mai Univ",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "8905"
    ]
  },
  "9021": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKPU_PCOPACE",
    "orgName": "College of Professional and Continuing and Education",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9020"
    ]
  },
  "9026": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852YFBI_INST",
    "orgName": "Yan Fook Theological Seminary",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9025"
    ]
  },
  "9066": {
    "timezone": "Asia/Tokyo",
    "orgCode": "81TORAY_INST",
    "orgName": "Toray Industries Inc.",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9065"
    ]
  },
  "9076": {
    "timezone": "Asia/Kuala_Lumpur",
    "orgCode": "60NUMM_INST",
    "orgName": "Newcastle University Medicine Malaysia",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9075"
    ]
  },
  "9111": {
    "timezone": "Asia/Manila",
    "orgCode": "63UOSTP_INST",
    "orgName": "University of Santo Tomas",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9110"
    ]
  },
  "9126": {
    "timezone": "Asia/Taipei",
    "orgCode": "886NHRI_INST",
    "orgName": "National Health Research Institutes",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9125"
    ]
  },
  "9171": {
    "timezone": "Asia/Bangkok",
    "orgCode": "66NIDA_INST",
    "orgName": "National Institute of Development Administration",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9170"
    ]
  },
  "9176": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKIC_INST",
    "orgName": "Hong Kong Institute of Construction",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9175"
    ]
  },
  "9196": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852HKDC_INST",
    "orgName": "Hong Kong Design Centre",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9195"
    ]
  },
  "9221": {
    "timezone": "Asia/Seoul",
    "orgCode": "82KUN_INST",
    "orgName": "Konkuk University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9220"
    ]
  },
  "9231": {
    "timezone": "Asia/Bangkok",
    "orgCode": "66MU_INST",
    "orgName": "Mahidol University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9230"
    ]
  },
  "9271": {
    "timezone": "Asia/Tokyo",
    "orgCode": "81UKITAK_INST",
    "orgName": "Kitakyushu Shiritsu Daigaku",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9270"
    ]
  },
  "9401": {
    "timezone": "Asia/Manila",
    "orgCode": "63UPS_INST",
    "orgName": "University of the Philippines System",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9400"
    ]
  },
  "9406": {
    "timezone": "Asia/Tokyo",
    "orgCode": "81KPU_INST",
    "orgName": "Kobe Pharmaceutical University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9405"
    ]
  },
  "9441": {
    "timezone": "Asia/Seoul",
    "orgCode": "82KST_AJOU",
    "orgName": "Ajou University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9440"
    ]
  },
  "9521": {
    "timezone": "Asia/Hong_Kong",
    "orgCode": "852JUD_INST",
    "orgName": "Judiciary Libraries of Hong Kong",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9520"
    ]
  },
  "9534": {
    "timezone": "Asia/Karachi",
    "orgCode": "92FCCF_INST",
    "orgName": "Forman Christian College (FCC)",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9533"
    ]
  },
  "9538": {
    "timezone": "Asia/Karachi",
    "orgCode": "92LUMS_INST",
    "orgName": "Lahore University of Management Sciences",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9537"
    ]
  },
  "9608": {
    "timezone": "Asia/Taipei",
    "orgCode": "886FCU_INST",
    "orgName": "Feng Chia University",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9607"
    ]
  },
  "9624": {
    "timezone": "Asia/Bangkok",
    "orgCode": "66NLT_INST",
    "orgName": "National Library of Thailand [Institute]",
    "dbServers": [
      "DWH_NA01_A_RO",
      "DWH_NA02_A_RO",
      "DWH_NA03_A_RO",
      "DWH_NA04_A_RO",
      "DWH_NA05_A_RO",
      "DWH_NA06_A_RO",
      "DWH_NA07_A_RO",
      "DWH_EU00_B_RO",
      "DWH_EU01_B_RO",
      "DWH_EU02_A_RO",
      "DWH_EU03_A_RO",
      "DWH_EU04_A_RO",
      "DWH_AP01_A_RO",
      "DWH_AP02_A_RO",
      "DWH_CA01_A_RO",
      "DWH_CN01_A_RO"
    ],
    "customerIds": [
      "9623"
    ]
  }
}
};

  // ========== LOOKUP METHODS ==========

  /**
   * Get timezone by ORG_CODE (highest priority)
   * @param {string} orgCode - Organization code (e.g., "EXLDEV1_INST")
   * @returns {Object|null} Timezone record with timezone, orgName, dbServers array, etc.
   */
  function getTimezoneByOrgCode(orgCode) {
    if (!orgCode) return null;
    
    const normalized = orgCode.trim();
    if (INSTITUTION_TIMEZONE_DATA.byOrgCode[normalized]) {
      const record = INSTITUTION_TIMEZONE_DATA.byOrgCode[normalized];
      console.log(`[InstitutionTimezoneManager] Found by ORG_CODE: ${normalized} -> ${record.timezone}`);
      return {
        timezone: record.timezone,
        orgCode: normalized,
        orgName: record.orgName,
        dbServers: record.dbServers,
        customerIds: record.customerIds,
        institutionIds: record.institutionIds,
        source: 'institution_data_org_code'
      };
    }
    
    return null;
  }

  /**
   * Get timezone by CUSTOMERID (second priority)
   * @param {string} customerId - Customer ID (e.g., "110")
   * @returns {Object|null} Timezone record
   */
  function getTimezoneByCustomerId(customerId) {
    if (!customerId) return null;
    
    const normalized = String(customerId).trim();
    if (INSTITUTION_TIMEZONE_DATA.byCustomerId[normalized]) {
      const record = INSTITUTION_TIMEZONE_DATA.byCustomerId[normalized];
      console.log(`[InstitutionTimezoneManager] Found by CUSTOMERID: ${normalized} -> ${record.timezone}`);
      return {
        timezone: record.timezone,
        customerId: normalized,
        orgCode: record.orgCode,
        orgName: record.orgName,
        dbServers: record.dbServers,
        institutionIds: record.institutionIds,
        source: 'institution_data_customer_id'
      };
    }
    
    return null;
  }

  /**
   * Get timezone by INSTITUTIONID (third priority)
   * @param {string} institutionId - Institution ID (e.g., "121")
   * @returns {Object|null} Timezone record
   */
  function getTimezoneByInstitutionId(institutionId) {
    if (!institutionId) return null;
    
    const normalized = String(institutionId).trim();
    if (INSTITUTION_TIMEZONE_DATA.byInstitutionId[normalized]) {
      const record = INSTITUTION_TIMEZONE_DATA.byInstitutionId[normalized];
      console.log(`[InstitutionTimezoneManager] Found by INSTITUTIONID: ${normalized} -> ${record.timezone}`);
      return {
        timezone: record.timezone,
        institutionId: normalized,
        orgCode: record.orgCode,
        orgName: record.orgName,
        dbServers: record.dbServers,
        customerIds: record.customerIds,
        source: 'institution_data_institution_id'
      };
    }
    
    return null;
  }

  /**
   * Get timezone using priority lookup: ORG_CODE > CUSTOMERID > INSTITUTIONID
   * @param {Object} identifiers - Object with orgCode, customerId, and/or institutionId
   * @returns {Object|null} Timezone record or null
   */
  function getTimezone(identifiers) {
    const { orgCode, customerId, institutionId } = identifiers || {};
    
    // Priority 1: ORG_CODE
    if (orgCode) {
      const result = getTimezoneByOrgCode(orgCode);
      if (result) return result;
    }
    
    // Priority 2: CUSTOMERID
    if (customerId) {
      const result = getTimezoneByCustomerId(customerId);
      if (result) return result;
    }
    
    // Priority 3: INSTITUTIONID
    if (institutionId) {
      const result = getTimezoneByInstitutionId(institutionId);
      if (result) return result;
    }
    
    console.log('[InstitutionTimezoneManager] No timezone found for identifiers:', identifiers);
    return null;
  }

  /**
   * Initialize the module
   * @returns {Promise<void>}
   */
  async function init() {
    if (isInitialized) {
      console.log('[InstitutionTimezoneManager] Already initialized');
      return;
    }

    try {
      const orgCodeCount = Object.keys(INSTITUTION_TIMEZONE_DATA.byOrgCode).length;
      const customerIdCount = Object.keys(INSTITUTION_TIMEZONE_DATA.byCustomerId).length;
      const institutionIdCount = Object.keys(INSTITUTION_TIMEZONE_DATA.byInstitutionId).length;
      
      console.log(`[InstitutionTimezoneManager] Initializing with ${orgCodeCount} ORG_CODE entries, ${customerIdCount} CUSTOMERID entries, ${institutionIdCount} INSTITUTIONID entries`);
      
      isInitialized = true;
      console.log('[InstitutionTimezoneManager] Initialization complete');
    } catch (error) {
      console.error('[InstitutionTimezoneManager] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Get statistics about the timezone data
   * @returns {Object} Statistics object
   */
  function getStats() {
    return {
      orgCodeCount: Object.keys(INSTITUTION_TIMEZONE_DATA.byOrgCode).length,
      customerIdCount: Object.keys(INSTITUTION_TIMEZONE_DATA.byCustomerId).length,
      institutionIdCount: Object.keys(INSTITUTION_TIMEZONE_DATA.byInstitutionId).length,
      isInitialized
    };
  }

  // ========== PUBLIC API ==========

  return {
    init,
    getTimezone,
    getTimezoneByOrgCode,
    getTimezoneByCustomerId,
    getTimezoneByInstitutionId,
    getStats
  };

})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InstitutionTimezoneManager;
}
