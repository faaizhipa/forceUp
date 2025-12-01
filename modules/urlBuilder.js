/**
 * URL Builder Module
 * Generates dynamic URLs based on case data and templates
 */

const URLBuilder = {
  /**
   * DC to Kibana mapping
   */
  kibanaMapping: {
    'NA04': 'http://lm-oss-kib.dc01.hosted.exlibrisgroup.com:5601/',
    'NA05': 'http://lm-oss-kib.dc01.hosted.exlibrisgroup.com:5601/',
    'NA06': 'http://lm-oss-kib.dc01.hosted.exlibrisgroup.com:5601/',
    'NA07': 'http://lm-oss-kib.dc01.hosted.exlibrisgroup.com:5601/',
    'NA08': 'http://lm-oss-kib.dc01.hosted.exlibrisgroup.com:5601/',
    'EU00': 'http://lm-oss-kib.dc03.hosted.exlibrisgroup.com:5601/',
    'EU01': 'http://lm-oss-kib.dc03.hosted.exlibrisgroup.com:5601/',
    'EU02': 'http://lm-oss-kib.dc03.hosted.exlibrisgroup.com:5601/',
    'NA01': 'http://lm-oss-kib.dc04.hosted.exlibrisgroup.com:5601/',
    'NA02': 'http://lm-oss-kib.dc04.hosted.exlibrisgroup.com:5601/',
    'NA03': 'http://lm-oss-kib.dc04.hosted.exlibrisgroup.com:5601/',
    'NA91': 'http://lm-oss-kib.dc04.hosted.exlibrisgroup.com:5601/',
    'AP01': 'http://lm-oss-kib.dc05.hosted.exlibrisgroup.com:5601/',
    'EU03': 'http://lm-oss-kib.dc06.hosted.exlibrisgroup.com:5601/',
    'EU04': 'http://lm-oss-kib.dc06.hosted.exlibrisgroup.com:5601/',
    'EU05': 'http://lm-oss-kib.dc06.hosted.exlibrisgroup.com:5601/',
    'EU06': 'http://lm-oss-kib.dc06.hosted.exlibrisgroup.com:5601/',
    'AP02': 'http://lm-oss-kib.dc07.hosted.exlibrisgroup.com:5601/',
    'CA01': 'http://lm-oss-kib.dc82.hosted.exlibrisgroup.com:5601/',
    'CN01': 'http://lm-oss-kib.dc81.hosted.exlibrisgroup.com:5601/login?next=%2F'
  },

  /**
   * Analytics refresh times by server region
   */
  analyticsRefreshTimes: {
    'AP': '12:00',
    'CN': '12:00',
    'EU': '20:00',
    'NA': '00:00',
    'CA': '00:00'
  },

  /**
   * Builds production Live View URL
   * @param {Object} caseData
   * @returns {string}
   */
  buildLiveViewURL(caseData) {
    return `https://${caseData.server}.alma.exlibrisgroup.com/esploro/?institution=${caseData.institutionCode}`;
  },

  /**
   * Builds production Back Office URL
   * @param {Object} caseData
   * @returns {string}
   */
  buildBackOfficeURL(caseData) {
    return `https://${caseData.server}.alma.exlibrisgroup.com/mng/login?institute=${caseData.institutionCode}&productCode=esploro&debug=true`;
  },

  /**
   * Builds sandbox URLs based on product type
   * @param {Object} caseData
   * @returns {Array} Array of sandbox button configs
   */
  buildSandboxURLs(caseData) {
    const product = caseData.productServiceName;
    const sandboxButtons = [];

    if (product && product.includes('esploro advanced')) {
      // Premium Sandbox
      sandboxButtons.push({
        label: 'PSB LV',
        tooltip: 'Premium Sandbox - Live View',
        url: `https://psb-${caseData.server}.alma.exlibrisgroup.com/esploro/?institution=${caseData.institutionCode}`
      });
      sandboxButtons.push({
        label: 'PSB BO',
        tooltip: 'Premium Sandbox - Back Office',
        url: `https://psb-${caseData.server}.alma.exlibrisgroup.com/mng/login?institute=${caseData.institutionCode}&productCode=esploro&debug=true`
      });
    } else if (product && product.includes('esploro standard')) {
      // Standard Sandbox
      sandboxButtons.push({
        label: 'SB LV',
        tooltip: 'Sandbox - Live View',
        url: `https://sb-${caseData.server}.alma.exlibrisgroup.com/esploro/?institution=${caseData.institutionCode}`
      });
      sandboxButtons.push({
        label: 'SB BO',
        tooltip: 'Sandbox - Back Office',
        url: `https://sb-${caseData.server}.alma.exlibrisgroup.com/mng/login?institute=${caseData.institutionCode}&productCode=esploro&debug=true`
      });
    }

    // SQA Environment (always available)
    sandboxButtons.push({
      label: 'SQA LV',
      tooltip: 'SQA - Live View',
      url: `https://sqa-${caseData.server}.alma.exlibrisgroup.com/esploro/?institution=${caseData.institutionCode}`
    });
    sandboxButtons.push({
      label: 'SQA BO',
      tooltip: 'SQA - Back Office',
      url: `https://sqa-${caseData.server}.alma.exlibrisgroup.com/mng/login?institute=${caseData.institutionCode}&productCode=esploro&debug=true`
    });

    return sandboxButtons;
  },

  /**
   * Gets Kibana URL for the affected environment
   * @param {Object} caseData - Object with affectedEnvironment or server property
   * @returns {string|null}
   */
  getKibanaURL(caseData) {
    let envPrefix = null;
    
    // Try affectedEnvironment first
    if (caseData.affectedEnvironment) {
      // Extract first 4 characters of environment
      envPrefix = caseData.affectedEnvironment.substring(0, 4).toUpperCase();
    } 
    // Fallback to server property (e.g., 'na05', 'eu01')
    else if (caseData.server) {
      // Server might be lowercase, extract first 4 chars and uppercase
      envPrefix = caseData.server.substring(0, 4).toUpperCase();
    }
    
    if (!envPrefix) return null;

    return this.kibanaMapping[envPrefix] || null;
  },

  /**
   * Builds customer JIRA URL
   * @param {Object} caseData
   * @returns {string}
   */
  buildCustomerJiraURL(caseData) {
    const accountNumber = encodeURIComponent(caseData.exLibrisAccountNumber || '');
    return `https://jira.clarivate.io/issues/?jql=project%20%3D%20URM%20AND%20%22Customer%20Code%22%20~%20${accountNumber}%20AND%20%22Platform%20Product%22%20%3D%20Esploro%20order%20by%20lastViewed%20DESC`;
  },

  /**
   * Gets next analytics refresh time in UTC and local time
   * @param {string} serverRegion - Server region (AP, EU, NA, CN, CA)
   * @param {string} userTimezone - User's timezone (e.g., 'America/New_York')
   * @returns {Object} { utc: string, local: string, isAuto: boolean }
   */
  getNextAnalyticsRefresh(serverRegion, userTimezone = null) {
    const baseTime = this.analyticsRefreshTimes[serverRegion];
    if (!baseTime) return null;

    const now = new Date();
    const [hours, minutes] = baseTime.split(':').map(Number);

    // Create today's refresh time in UTC
    const refreshTimeUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes));

    // If refresh time has passed today, show tomorrow's
    if (refreshTimeUTC < now) {
      refreshTimeUTC.setUTCDate(refreshTimeUTC.getUTCDate() + 1);
    }

    // Format UTC time
    const utcString = refreshTimeUTC.toISOString().substring(11, 16) + ' UTC';

    // Format local time
    let localString;
    let isAuto = false;
    let detectedRegion = '';

    try {
      if (!userTimezone) {
        // Auto-detect timezone
        userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        isAuto = true;
        detectedRegion = userTimezone.split('/')[0]; // e.g., 'America' from 'America/New_York'
      }

      const localTime = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(refreshTimeUTC);

      localString = `${localTime} (${detectedRegion || userTimezone})`;
    } catch (error) {
      // Fallback to UTC if timezone conversion fails
      localString = utcString;
    }

    return {
      utc: utcString,
      local: localString,
      isAuto: isAuto,
      timezone: userTimezone
    };
  },

  /**
   * Builds all button configurations
   * @param {Object} caseData
   * @param {string} labelStyle - 'formal', 'casual', or 'abbreviated'
   * @param {string} userTimezone - User's timezone preference
   * @returns {Object} All button groups
   */
  buildAllButtons(caseData, labelStyle = 'casual', userTimezone = null) {
    const labels = {
      formal: { lv: 'Portal', bo: 'Repository' },
      casual: { lv: 'Live View', bo: 'Back Office' },
      abbreviated: { lv: 'LV', bo: 'BO' }
    };

    const selectedLabels = labels[labelStyle] || labels.casual;

    const buttonGroups = {
      production: [
        {
          label: selectedLabels.lv,
          url: this.buildLiveViewURL(caseData),
          icon: 'utility:preview'
        },
        {
          label: selectedLabels.bo,
          url: this.buildBackOfficeURL(caseData),
          icon: 'utility:settings'
        }
      ],
      sandbox: this.buildSandboxURLs(caseData),
      tools: [
        {
          label: 'Kibana',
          url: this.getKibanaURL(caseData),
          icon: 'utility:search'
        },
        {
          label: 'Wiki',
          url: 'https://wiki.clarivate.io/pages/viewpage.action?spaceKey=ESP&title=Kibana+-+Log+Searching+Tool',
          icon: 'utility:knowledge_base'
        }
      ],
      sql: [
        {
          label: 'SQL Wiki',
          url: 'https://wiki.clarivate.io/spaces/ESP/pages/505330963/SQL+Course',
          icon: 'utility:database'
        },
        {
          label: 'SQL Alma',
          url: 'https://wiki.clarivate.io/display/ESP/SQL+Knowledgebase',
          icon: 'utility:database'
        },
        {
          label: 'SQL Esploro',
          url: 'https://wiki.clarivate.io/spaces/ESP/pages/505334550/Esploro+SQL+Queries',
          icon: 'utility:database'
        }
      ],
      misc: [
        {
          label: 'System Status',
          url: 'https://status.exlibrisgroup.com/system_status',
          icon: 'utility:info'
        },
        {
          label: 'Customer JIRA',
          url: this.buildCustomerJiraURL(caseData),
          icon: 'utility:bug'
        }
      ]
    };

    // Add analytics refresh info
    if (caseData.serverRegion) {
      const refreshInfo = this.getNextAnalyticsRefresh(caseData.serverRegion, userTimezone);
      buttonGroups.analyticsRefresh = refreshInfo;
    }

    return buttonGroups;
  },

  /**
   * Get wiki links for Wiki Shortcuts section
   * Extracts wiki links from tools and sql button groups
   * @returns {Array} Array of wiki link objects
   */
  getWikiLinks() {
    return [
      {
        label: 'Wiki',
        url: 'https://wiki.clarivate.io/pages/viewpage.action?spaceKey=ESP&title=Kibana+-+Log+Searching+Tool',
        icon: 'utility:knowledge_base'
      },
      {
        label: 'SQL Wiki',
        url: 'https://wiki.clarivate.io/spaces/ESP/pages/505330963/SQL+Course',
        icon: 'utility:database'
      },
      {
        label: 'SQL Alma',
        url: 'https://wiki.clarivate.io/display/ESP/SQL+Knowledgebase',
        icon: 'utility:database'
      },
      {
        label: 'SQL Esploro',
        url: 'https://wiki.clarivate.io/spaces/ESP/pages/505334550/Esploro+SQL+Queries',
        icon: 'utility:database'
      },
      {
        label: 'Esploro Customer List',
        url: 'https://wiki.clarivate.io/spaces/EXLPS/pages/506201574/Esploro+Customers',
        icon: 'utility:groups'
      }
    ];
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = URLBuilder;
}
