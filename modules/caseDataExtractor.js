/**
 * Case Data Extractor Module
 * Extracts relevant data from Salesforce case pages
 */

const CaseDataExtractor = {
  /**
   * Extracts all relevant case data for downstream modules
   * @returns {Object}
   */
  extractCaseData() {
    return {
      caseId: this.getCaseIdFromUrl(),
      caseNumber: this.getCaseNumber(),
      subject: this.getSubject(),
      description: this.getDescription(),
      contactName: this.getFieldValue(['Contact Name']),
      accountName: this.getFieldValue(['Account Name']),
      productServiceName: this.getProductServiceName(),
      assetText: this.getFieldValue(['Asset']),
      assetHref: this.getAssetHref(),
      category: this.getFieldValue(['Category']),
      subCategory: this.getFieldValue(['Sub-Category', 'Sub Category']),
      status: this.getFieldValue(['Status']),
      subStatus: this.getFieldValue(['Sub Status', 'Sub-Status']),
      analysisNote: this.getFieldValue(['Analysis Note']),
      exLibrisAccountNumber: this.getExLibrisAccountNumber(),
      affectedEnvironment: this.getAffectedEnvironment(),
      jiraId: this.getJiraId(),
      lastModifiedDate: this.getLastModifiedDate(),
      // Derived fields (populated in processData) - Using standardized naming
      institutionCode: null,    // Standardized (not instCode)
      customerCode: this.getExLibrisAccountNumber(),
      server: null,
      serverRegion: null,
      customerId: null,         // Standardized (not custID, custId)
      institutionId: null,      // Standardized (not instID, instId)
      customerName: null,
      customerTimezone: null,
      customerTimezoneSource: null,
      customerOrgCode: null,
      customerOrgName: null,
      customerDbServers: []
    };
  },

  /**
   * Builds a lightweight metadata package used by staged UI
   * @returns {Object}
   */
  getInitialMetadata() {
    return {
      caseId: this.getCaseIdFromUrl(),
      caseNumber: this.getCaseNumber(),
      subject: this.getSubject(),
      contactName: this.getFieldValue(['Contact Name']),
      accountName: this.getFieldValue(['Account Name']),
      productServiceName: this.getProductServiceName(),
      category: this.getFieldValue(['Category']),
      subCategory: this.getFieldValue(['Sub-Category', 'Sub Category']),
      status: this.getFieldValue(['Status']),
      subStatus: this.getFieldValue(['Sub Status', 'Sub-Status']),
      exLibrisAccountNumber: this.getExLibrisAccountNumber(),
      institutionCode: null,    // Standardized (not instCode)
      timezone: null,
      institutionId: null,      // Standardized (not instID)
      customerId: null,         // Standardized (not custID)
      analysisNote: this.getFieldValue(['Analysis Note'])
    };
  },

  /**
   * Retrieves the case identifier from the current URL
   * @returns {string|null}
   */
  getCaseIdFromUrl() {
    if (typeof CaseContextWatcher !== 'undefined') {
      const context = CaseContextWatcher.getCurrentContext?.();
      if (context?.caseId) {
        return context.caseId;
      }
    }

    const match = window.location.pathname.match(/Case\/([a-zA-Z0-9]{15,18})/);
    return match ? match[1] : null;
  },

  /**
   * Retrieves the case number from header text
   * @returns {string|null}
   */
  getCaseNumber() {
    if (typeof CaseContextWatcher !== 'undefined') {
      const context = CaseContextWatcher.getCurrentContext?.();
      if (context?.caseNumber) {
        return context.caseNumber;
      }
    }

    if (typeof CaseDomUtils !== 'undefined') {
      const visibleNumber = CaseDomUtils.getVisibleCaseNumber();
      if (visibleNumber) {
        return visibleNumber;
      }
    }

    const header = this.getHeaderText();
    if (!header) return null;
    const numberMatch = header.match(/^([0-9]{6,})/);
    return numberMatch ? numberMatch[1] : header;
  },

  /**
   * Retrieves the subject from header text
   * @returns {string|null}
   */
  getSubject() {
    if (typeof CaseDomUtils !== 'undefined') {
      const subject = CaseDomUtils.getVisibleCaseSubject();
      if (subject) {
        return subject;
      }
    }

    const header = this.getHeaderText();
    if (!header) return null;
    const parts = header.split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ').trim() : header.trim();
  },

  /**
   * Gets combined header text (case number + subject)
   * Always reselects visible elements fresh on each call
   * @returns {string|null}
   */
  getHeaderText() {
    if (typeof CaseDomUtils !== 'undefined') {
      const header = CaseDomUtils.getVisibleCaseHeaderText();
      if (header) {
        return header;
      }
    }

    // Fallback: check visibility of header field
    const candidates = document.querySelectorAll('slot[name="primaryField"] lightning-formatted-text, records-formula-output[slot="primaryField"] lightning-formatted-text');
    let headerField = null;
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      headerField = CaseDomUtils.getFirstVisibleElement(candidates);
    } else if (candidates.length > 0) {
      headerField = candidates[0];
    }
    return headerField ? (headerField.textContent || '').trim() : null;
  },

  /**
   * Retrieves description content with line breaks preserved
   * Always reselects visible elements fresh on each call
   * @returns {string|null}
   */
  getDescription() {
    const candidates = document.querySelectorAll('records-record-layout-item[field-label*="Description"]');
    let layoutItem = null;
    
    // Find visible layout item
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      layoutItem = CaseDomUtils.getFirstVisibleElement(candidates);
    } else if (candidates.length > 0) {
      layoutItem = candidates[0];
    }
    
    if (!layoutItem) {
      return null;
    }
    
    // Try to find visible field within the layout item
    const fieldCandidates = layoutItem.querySelectorAll('lightning-formatted-text, .test-id__field-value');
    let field = null;
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      field = CaseDomUtils.getFirstVisibleElement(fieldCandidates);
    } else if (fieldCandidates.length > 0) {
      field = fieldCandidates[0];
    }
    
    if (!field) {
      return null;
    }

    if (field.tagName && field.tagName.toLowerCase() === 'lightning-formatted-text') {
      return field.textContent.trim();
    }

    return this.normalizeText(field);
  },

  /**
   * Normalizes text content, converting <br> tags to newlines
   * @param {Element} node
   * @returns {string}
   */
  normalizeText(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('br').forEach((br) => (br.textContent = '\n'));
    return (clone.textContent || '').trim();
  },

  /**
   * Removes assistive or button text so only the visible field value remains
   * @param {Element} node
  * @returns {string|null}
   */
  cleanTextContent(node) {
    if (!node) return null;

    const clone = node.cloneNode(true);
    const removableSelectors = [
      'button',
      'lightning-button-icon',
      'lightning-button-menu',
      '.slds-assistive-text',
      '.assistiveText'
    ];

    removableSelectors.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    });

    clone.querySelectorAll('br').forEach((br) => (br.textContent = ' '));

    const text = clone.textContent || '';
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized || null;
  },

  /**
   * Generic field value lookup
   * Always reselects visible elements fresh on each call
   * @param {string[]} matchers - label fragments
   * @returns {string|null}
   */
  getFieldValue(matchers) {
    if (!Array.isArray(matchers) || matchers.length === 0) {
      return null;
    }

    // First, find visible layout items that match the label
    let layoutItem = null;
    for (const label of matchers) {
      const layoutCandidates = document.querySelectorAll(`records-record-layout-item[field-label*="${label}"]`);
      if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
        layoutItem = CaseDomUtils.getFirstVisibleElement(layoutCandidates);
      } else if (layoutCandidates.length > 0) {
        layoutItem = layoutCandidates[0];
      }
      if (layoutItem) break;
    }
    
    if (!layoutItem) {
      return null;
    }
    
    // Now find visible field within the layout item
    const fieldCandidates = layoutItem.querySelectorAll('.test-id__field-value, lightning-formatted-text, force-lookup');
    let field = null;
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      field = CaseDomUtils.getFirstVisibleElement(fieldCandidates);
    } else if (fieldCandidates.length > 0) {
      field = fieldCandidates[0];
    }
    
    if (!field) {
      return null;
    }

    if (field.tagName && field.tagName.toLowerCase() === 'lightning-formatted-text') {
      const text = field.textContent || '';
      return text.trim() || null;
    }

    const lookupElement = field.tagName && field.tagName.toLowerCase() === 'force-lookup'
      ? field
      : field.querySelector('force-lookup');

    const lookupLink = lookupElement ? lookupElement.querySelector('a') : null;
    if (lookupLink && lookupLink.textContent) {
      return lookupLink.textContent.trim();
    }

    const anchor = field.querySelector('a');
    if (anchor && anchor.textContent) {
      return anchor.textContent.trim();
    }

    return this.cleanTextContent(field);
  },

  /**
   * Gets Ex Libris Account Number
   * @returns {string|null}
   */
  getExLibrisAccountNumber() {
    return this.getFieldValue(['Ex Libris Account Number', 'Account Number']);
  },

  /**
   * Gets Affected Environment
   * @returns {string|null}
   */
  getAffectedEnvironment() {
    const fieldValue = this.getFieldValue(['Affected Environment']);
    
    if (!fieldValue) {
      return null;
    }

    // The field often contains a lookup with text like "Esploro EU00 - Production"
    // Extract the server code (NA##, EU##, AP##, CN##, CA##) from the text
    const serverMatch = fieldValue.match(/(NA\d{2}|EU\d{2}|AP\d{2}|CN\d{2}|CA\d{2})/i);
    if (serverMatch) {
      return serverMatch[1].toUpperCase();
    }

    // Return the full value as fallback
    return fieldValue;
  },

  /**
   * Gets Product/Service Name
   * @returns {string|null}
   */
  getProductServiceName() {
    const value = this.getFieldValue(['Product/Service Name', 'Product', 'Service Name']);
    return value ? value.toLowerCase() : null;
  },

  /**
   * Gets Asset href
   * Always reselects visible elements fresh on each call
   * @returns {string|null}
   */
  getAssetHref() {
    const layoutCandidates = document.querySelectorAll('records-record-layout-item[field-label*="Asset"]');
    let layoutItem = null;
    
    // Find visible layout item
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      layoutItem = CaseDomUtils.getFirstVisibleElement(layoutCandidates);
    } else if (layoutCandidates.length > 0) {
      layoutItem = layoutCandidates[0];
    }
    
    if (!layoutItem) {
      return null;
    }
    
    // Find visible link within the layout item
    const linkCandidates = layoutItem.querySelectorAll('a');
    let link = null;
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      link = CaseDomUtils.getFirstVisibleElement(linkCandidates);
    } else if (linkCandidates.length > 0) {
      link = linkCandidates[0];
    }
    
    return link ? link.href : null;
  },

  /**
   * Gets JIRA ID from the Jira section
   * Always reselects visible elements fresh on each call
   * @returns {string|null}
   */
  getJiraId() {
    const sectionCandidates = document.querySelectorAll('flexipage-component2[data-component-id="flexipage_fieldSection6"]');
    let jiraSection = null;
    
    // Find visible section
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      jiraSection = CaseDomUtils.getFirstVisibleElement(sectionCandidates);
    } else if (sectionCandidates.length > 0) {
      jiraSection = sectionCandidates[0];
    }
    
    if (!jiraSection) {
      return null;
    }
    
    // Double-check visibility of the section
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      if (!CaseDomUtils.isElementVisible(jiraSection)) {
        return null;
      }
    }
    
    const fieldCandidates = jiraSection.querySelectorAll('div[data-target-selection-name*="Primary_Jira"], div[data-target-selection-name*="JIRA"]');
    let jiraField = null;
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      jiraField = CaseDomUtils.getFirstVisibleElement(fieldCandidates);
    } else if (fieldCandidates.length > 0) {
      jiraField = fieldCandidates[0];
    }
    
    if (!jiraField) {
      return null;
    }
    
    const valueCandidates = jiraField.querySelectorAll('.test-id__field-value, lightning-formatted-text');
    let value = null;
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      value = CaseDomUtils.getFirstVisibleElement(valueCandidates);
    } else if (valueCandidates.length > 0) {
      value = valueCandidates[0];
    }
    
    return value ? value.textContent.trim() : null;
  },

  /**
   * Gets the last modified date of the case
   * Always reselects visible elements fresh on each call
   * @returns {string|null}
   */
  getLastModifiedDate() {
    const candidates = document.querySelectorAll('records-record-layout-item[field-label*="Last Modified"]');
    let field = null;
    
    // Find visible layout item
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      field = CaseDomUtils.getFirstVisibleElement(candidates);
    } else if (candidates.length > 0) {
      field = candidates[0];
    }
    
    if (field) {
      // Try to find visible value field within the layout item
      const valueCandidates = field.querySelectorAll('.test-id__field-value, lightning-formatted-text, lightning-formatted-date-time');
      let value = null;
      if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
        value = CaseDomUtils.getFirstVisibleElement(valueCandidates);
      } else if (valueCandidates.length > 0) {
        value = valueCandidates[0];
      }
      return value ? value.textContent.trim() : null;
    }
    return null;
  },

  /**
   * Processes raw case data to derive additional fields
   * @param {Object} rawData
   * @returns {Promise<Object>}
   */
  async processData(rawData) {
    const processed = { ...rawData };
    let customerRecord = null;

    // Step 1: Derive institutionCode from exLibrisAccountNumber if available
    if (rawData.exLibrisAccountNumber) {
      const originalCode = rawData.exLibrisAccountNumber.trim();
      let formattedCode = null;

      if (/FLVC/i.test(formattedCode)) {
        formattedCode = formattedCode.replace(/FLVC/gi, 'FALSC');
      }

      if (/-/.test(originalCode)) {
        formattedCode = formattedCode.replace(/-/g, '_');
      }

      if (!formattedCode.includes('_')) {
        formattedCode = `${formattedCode}_INST`;
      }

      processed.institutionCode = formattedCode === originalCode ? null : formattedCode;  
      processed.customerCode = originalCode;
      
      // Try to find customer record by institution code, with account name as fallback
      if (typeof CustomerMasterManager !== 'undefined') {
        customerRecord = await this.getCustomerData(formattedCode, rawData.accountName);
        if (customerRecord) {
          console.log(`[CaseDataExtractor] Found customer by institution code: ${customerRecord.accountName || formattedCode}`);
        }
      }
    }
    
    // Step 2: If no institutionCode but we have accountName, search by name
    if (!customerRecord && rawData.accountName && typeof CustomerMasterManager !== 'undefined') {
      customerRecord = await this.findCustomerByAccountName(rawData.accountName);
      if (customerRecord) {
        processed.institutionCode = customerRecord.institutionCode;
        console.log(`[CaseDataExtractor] Found customer by account name: ${customerRecord.accountName || 'unknown'}`);
      }
    }

    // Step 3: Extract server from affectedEnvironment field
    if (rawData.affectedEnvironment) {
      const serverMatch = rawData.affectedEnvironment.match(/(NA\d{2}|EU\d{2}|AP\d{2}|CN\d{2}|CA\d{2})/i);
      if (serverMatch) {
        processed.server = serverMatch[1].toLowerCase();
        processed.serverRegion = serverMatch[1].substring(0, 2).toUpperCase();
      }
    }

    if (rawData.exLibrisAccountNumber) {
      processed.regionNumber = rawData.exLibrisAccountNumber.substring(1, 4).toUpperCase();
      processed.accountCodePrefix = rawData.exLibrisAccountNumber.substring(0, rawData.exLibrisAccountNumber.indexOf("-"));
      processed.accountCodeSuffix = rawData.exLibrisAccountNumber.substring(rawData.exLibrisAccountNumber.indexOf("-") + 1);
    }

    // Step 4: Apply customer record data as fallback for missing fields
    if (customerRecord) {
      // Apply customer data using standardized field names
      // CustomerMasterManager uses standardized naming (customerId, institutionId, institutionCode)
      if (customerRecord.customerId) {
        processed.customerId = customerRecord.customerId;
      }
      if (customerRecord.institutionId) {
        processed.institutionId = customerRecord.institutionId;
      }
      if (customerRecord.institutionCode) {
        processed.institutionCode = customerRecord.institutionCode;
      }
      if (customerRecord.timezone) {
        processed.timezone = customerRecord.timezone;
      }
      if (customerRecord.name) {
        processed.customerName = customerRecord.name;
      }
      if (customerRecord.esploroEdition) {
        processed.edition = customerRecord.esploroEdition;
      }
      if (customerRecord.portalCustomDomain) {
        processed.portalCustomDomain = customerRecord.portalCustomDomain;
      }
      
      // Use customer server as fallback if not already set from affectedEnvironment
      if (!processed.server && customerRecord.server) {
        processed.server = customerRecord.server.toLowerCase();
        processed.serverRegion = customerRecord.server.substring(0, 2).toUpperCase();
        console.log(`[CaseDataExtractor] Using server from customer record: ${processed.server}`);
      } else if (processed.server && customerRecord.server && processed.server.toLowerCase() !== customerRecord.server.toLowerCase()) {
        console.warn(
          `[CaseDataExtractor] Server mismatch: Case shows ${processed.server}, customer record shows ${customerRecord.server}`
        );
      }
      
      console.log(`[CaseDataExtractor] Applied customer data - customerId: ${processed.customerId}, institutionId: ${processed.institutionId}, server: ${processed.server}`);
    } else if (processed.institutionCode) {
      console.warn(`[CaseDataExtractor] No customer record found for ${processed.institutionCode}`);
    }

    // Step 5: Resolve timezone information using CustomerMasterManager as single source of truth
    // CustomerMasterManager loads from customerMasterList.json and supports user overrides
    // No fallbacks - if CustomerMasterManager is unavailable or doesn't resolve, timezone remains null
    if (typeof CustomerMasterManager !== 'undefined') {
      try {
        const timezoneInfo = await CustomerMasterManager.resolveTimezone({
          accountName: processed.accountName || processed.customerName,
          institutionCode: processed.institutionCode || processed.customerCode,
          accountCode: customerRecord?.accountCode || null,
          server: processed.server || customerRecord?.server || null,
          customerId: processed.customerId || customerRecord?.customerId || null,  // Standardized
          institutionId: processed.institutionId || customerRecord?.institutionId || null  // Standardized
        });

        if (timezoneInfo && timezoneInfo.timezone) {
          processed.customerTimezone = timezoneInfo.timezone;
          processed.customerTimezoneRaw = timezoneInfo.timezoneRaw || timezoneInfo.timezone;
          processed.customerTimezoneSource = timezoneInfo.source || 'customerMasterManager';
          processed.customerOrgCode = timezoneInfo.orgCode || timezoneInfo.accountName || processed.institutionCode || processed.customerCode || null;
          processed.customerOrgName = timezoneInfo.orgName || timezoneInfo.accountName || processed.customerName || null;
          processed.customerDbServers = []; // No longer available in master list
          
          // Use TimezoneNormalizer for enhanced display if available
          if (typeof TimezoneNormalizer !== 'undefined') {
            processed.customerTimezoneDisplayName = TimezoneNormalizer.getDisplayName(timezoneInfo.timezone, 'long');
            const offset = TimezoneNormalizer.getOffset(timezoneInfo.timezone);
            if (offset) {
              processed.customerTimezoneOffset = offset.formatted;
              processed.customerTimezoneOffsetMinutes = offset.offsetMinutes;
            }
            // Get current time in customer timezone
            const currentTime = TimezoneNormalizer.getCurrentTime(timezoneInfo.timezone);
            if (currentTime) {
              processed.customerCurrentTime = currentTime.time24h;
            }
          } else {
            processed.customerTimezoneDisplayName = timezoneInfo.timezone.replace(/_/g, ' ');
          }
          
          // Enrich with additional data from master list if available
          if (timezoneInfo.server && !processed.server) {
            processed.server = timezoneInfo.server;
            processed.serverRegion = timezoneInfo.region || timezoneInfo.server.substring(0, 2).toUpperCase();
          }
          
          console.log('[CaseDataExtractor] Timezone resolved via CustomerMasterManager:', {
            timezone: timezoneInfo.timezone,
            raw: timezoneInfo.timezoneRaw,
            source: timezoneInfo.source,
            matchType: timezoneInfo.matchType,
            offset: processed.customerTimezoneOffset
          });
        } else {
          console.log('[CaseDataExtractor] Timezone not found in CustomerMasterManager for:', {
            institutionCode: processed.institutionCode || processed.customerCode,
            accountName: processed.accountName
          });
        }
      } catch (error) {
        console.error('[CaseDataExtractor] Error resolving customer timezone:', error);
      }
    } else {
      console.warn('[CaseDataExtractor] CustomerMasterManager not available for timezone resolution');
    }

    return processed;
  },

  /**
   * Gets customer data from CustomerMasterManager with flexible matching
   * @param {string} institutionCode - Ex-Libris account number or institution code
   * @param {string} accountName - Optional account name for fallback matching
   * @returns {Promise<Object|null>}
   */
  async getCustomerData(institutionCode, accountName = null) {
    if (typeof CustomerMasterManager === 'undefined') {
      console.warn('[CaseDataExtractor] CustomerMasterManager not available');
      return null;
    }

    try {
      return CustomerMasterManager.findByInstitutionCode(institutionCode, accountName);
    } catch (error) {
      console.error('[CaseDataExtractor] Error getting customer data:', error);
      return null;
    }
  },

  /**
   * Searches customer list by account name
   * @param {string} accountName
   * @returns {Promise<Object|null>}
   */
  async findCustomerByAccountName(accountName) {
    if (typeof CustomerMasterManager === 'undefined') {
      console.warn('[CaseDataExtractor] CustomerMasterManager not available');
      return null;
    }

    try {
      return CustomerMasterManager.findByAccountName(accountName);
    } catch (error) {
      console.error('[CaseDataExtractor] Error searching customer by account name:', error);'Sub Status'
      return null;
    }
  },

  /**
   * Gets complete processed case data
   * Priority: InterceptorCacheManager > CaseDataStore > DOM extraction
   * @returns {Promise<Object>}
   */
  async getData(options = {}) {
    const { force = false } = options;

    // Get current case number for cache lookup
    const caseNumber = this.getCaseNumber();

    // PRIORITY 1: Check InterceptorCacheManager first (from interceptor.js)
    if (!force && caseNumber && typeof InterceptorCacheManager !== 'undefined') {
      const cachedData = InterceptorCacheManager.get(caseNumber);
      if (cachedData) {
        console.log(`[CaseDataExtractor] Using cached interceptor data for case ${caseNumber}`);
        const mappedData = InterceptorCacheManager.mapToExpectedFields(cachedData);
        // Ensure caseId is set
        mappedData.caseId = this.getCaseIdFromUrl();
        return mappedData;
      }
    }

    // PRIORITY 2: Check CaseDataStore
    if (!force && typeof CaseDataStore !== 'undefined') {
      const stored = CaseDataStore.getCurrentData();
      if (stored) {
        return stored;
      }
    }

    // Wait for stable context
    if (typeof CaseContextWatcher !== 'undefined') {
      await CaseContextWatcher.getStableContext?.({ requireCase: true, timeout: 4000 });
    }

    // PRIORITY 3: Extract from DOM
    const rawData = this.extractCaseData();
    const processed = await this.processData(rawData);

    if (processed && typeof CaseDataStore !== 'undefined') {
      await CaseDataStore.setCurrentData(processed, 'CaseDataExtractor');
    }

    return processed;
  },

  /**
   * Reset extraction state - clears any cached values and forces fresh extraction
   */
  resetExtractionState() {
    // CaseDataExtractor doesn't maintain persistent state between calls
    // Each call to extractCaseData() extracts fresh from DOM
    // This method exists for API consistency with other extractors
    console.log('[CaseDataExtractor] Extraction state reset (no cached state to clear)');
  },

  /**
   * Cleans up the module
   */
  cleanup() {
    // No persistent state
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaseDataExtractor;
}
