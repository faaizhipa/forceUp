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
      // Derived fields (populated in processData)
      institutionCode: null,
      customerCode: this.getExLibrisAccountNumber(),
      server: null,
      serverRegion: null,
      custID: null,
      customerId: null,
      instID: null,
      institutionId: null,
      customerName: null
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
      analysisNote: this.getFieldValue(['Analysis Note'])
    };
  },

  /**
   * Retrieves the case identifier from the current URL
   * @returns {string|null}
   */
  getCaseIdFromUrl() {
    const match = window.location.pathname.match(/Case\/([a-zA-Z0-9]{15,18})/);
    return match ? match[1] : null;
  },

  /**
   * Retrieves the case number from header text
   * @returns {string|null}
   */
  getCaseNumber() {
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
    const header = this.getHeaderText();
    if (!header) return null;
    const parts = header.split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ').trim() : header.trim();
  },

  /**
   * Gets combined header text (case number + subject)
   * @returns {string|null}
   */
  getHeaderText() {
    const headerField = document.querySelector('slot[name="primaryField"] lightning-formatted-text, records-formula-output[slot="primaryField"] lightning-formatted-text');
    return headerField ? (headerField.textContent || '').trim() : null;
  },

  /**
   * Retrieves description content with line breaks preserved
   * @returns {string|null}
   */
  getDescription() {
    const field = document.querySelector('records-record-layout-item[field-label*="Description"] lightning-formatted-text, records-record-layout-item[field-label*="Description"] .test-id__field-value');
    if (!field) return null;

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
   * @param {string[]} matchers - label fragments
   * @returns {string|null}
   */
  getFieldValue(matchers) {
    if (!Array.isArray(matchers) || matchers.length === 0) {
      return null;
    }

    const selector = matchers
      .map((label) => `records-record-layout-item[field-label*="${label}"] .test-id__field-value, records-record-layout-item[field-label*="${label}"] lightning-formatted-text, records-record-layout-item[field-label*="${label}"] force-lookup`)
      .join(',');

    const field = document.querySelector(selector);
    if (!field) return null;

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
   * @returns {string|null}
   */
  getAssetHref() {
    const link = document.querySelector('records-record-layout-item[field-label*="Asset"] a');
    return link ? link.href : null;
  },

  /**
   * Gets JIRA ID from the Jira section
   * @returns {string|null}
   */
  getJiraId() {
    const jiraSection = document.querySelector('flexipage-component2[data-component-id="flexipage_fieldSection6"]');
    if (jiraSection) {
      const jiraField = jiraSection.querySelector('div[data-target-selection-name*="Primary_Jira"], div[data-target-selection-name*="JIRA"]');
      if (jiraField) {
        const value = jiraField.querySelector('.test-id__field-value, lightning-formatted-text');
        return value ? value.textContent.trim() : null;
      }
    }
    return null;
  },

  /**
   * Gets the last modified date of the case
   * @returns {string|null}
   */
  getLastModifiedDate() {
    const field = document.querySelector('records-record-layout-item[field-label*="Last Modified"]');
    if (field) {
      const value = field.querySelector('.test-id__field-value, lightning-formatted-text, lightning-formatted-date-time');
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
      let formattedCode = originalCode;

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
      if (typeof CustomerDataManager !== 'undefined') {
        customerRecord = await this.getCustomerData(formattedCode, rawData.accountName);
        if (customerRecord) {
          console.log(`[CaseDataExtractor] Found customer by institution code: ${customerRecord.name || formattedCode}`);
        }
      }
    }
    
    // Step 2: If no institutionCode but we have accountName, search by name
    if (!customerRecord && rawData.accountName && typeof CustomerDataManager !== 'undefined') {
      customerRecord = await this.findCustomerByAccountName(rawData.accountName);
      if (customerRecord) {
        processed.institutionCode = customerRecord.institutionCode;
        console.log(`[CaseDataExtractor] Found customer by account name: ${customerRecord.name || 'unknown'}`);
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

    // Step 4: Apply customer record data as fallback for missing fields
    if (customerRecord) {
      // Always use customer data for these IDs if available
      if (customerRecord.custID) {
        processed.custID = customerRecord.custID;
        processed.customerid = customerRecord.custID;
      }
      if (customerRecord.instID) {
        processed.instID = customerRecord.instID;
        processed.institutionid = customerRecord.instID;
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
      
      console.log(`[CaseDataExtractor] Applied customer data - custID: ${processed.custID}, instID: ${processed.instID}, server: ${processed.server}`);
    } else if (processed.institutionCode) {
      console.warn(`[CaseDataExtractor] No customer record found for ${processed.institutionCode}`);
    }

    return processed;
  },

  /**
   * Gets customer data from CustomerDataManager with flexible matching
   * @param {string} institutionCode - Ex-Libris account number or institution code
   * @param {string} accountName - Optional account name for fallback matching
   * @returns {Promise<Object|null>}
   */
  async getCustomerData(institutionCode, accountName = null) {
    if (typeof CustomerDataManager === 'undefined') {
      console.warn('[CaseDataExtractor] CustomerDataManager not available');
      return null;
    }

    try {
      return CustomerDataManager.findByInstitutionCode(institutionCode, accountName);
    } catch (error) {
      console.error('[CaseDataExtractor] Error getting customer data:', error);
      return null;
    }
  },

  /**
   * Searches customer list by account name (fuzzy match)
   * @param {string} accountName
   * @returns {Promise<Object|null>}
   */
  async findCustomerByAccountName(accountName) {
    if (typeof CustomerDataManager === 'undefined') {
      console.warn('[CaseDataExtractor] CustomerDataManager not available');
      return null;
    }

    try {
      const allCustomers = CustomerDataManager.getAllCustomers();
      if (!allCustomers || allCustomers.length === 0) {
        return null;
      }

      const normalizedSearch = accountName.trim().toLowerCase();

      const exactMatch = allCustomers.find((customer) => {
        const customerName = (customer.name || '').trim().toLowerCase();
        return customerName === normalizedSearch;
      });

      if (exactMatch) {
        return exactMatch;
      }

      const partialMatch = allCustomers.find((customer) => {
        const customerName = (customer.name || '').trim().toLowerCase();
        return customerName.includes(normalizedSearch) || normalizedSearch.includes(customerName);
      });

      return partialMatch || null;
    } catch (error) {
      console.error('[CaseDataExtractor] Error searching customer by account name:', error);
      return null;
    }
  },

  /**
   * Gets complete processed case data
   * @returns {Promise<Object>}
   */
  async getData() {
    const rawData = this.extractCaseData();
    return this.processData(rawData);
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
