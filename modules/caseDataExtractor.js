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
    const data = {
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
      accountCode: this.getExLibrisAccountNumber(),
      institutionCode: this.getInstitutionCode(),
      affectedEnvironment: this.getAffectedEnvironment(),
      jiraId: this.getJiraId(),
      lastModifiedDate: this.getLastModifiedDate(),
      priority: this.getPriorityValue(),
      // Derived fields (populated in processData)
      customerCode: this.getExLibrisAccountNumber(),
      server: null,
      serverRegion: null,
      custID: null,
      custId: null,
      customerId: null,
      instID: null,
      instId: null,
      institutionId: null,
      customerName: null,
      customerTimezone: null,
      customerTimezoneSource: null,
      customerOrgCode: null,
      customerOrgName: null,
      customerDbServers: []
    };

    const derivedServer = this.getServerFromEnvironment(data.affectedEnvironment);
    if (derivedServer && !data.server) {
      data.server = derivedServer;
    }

    this.enrichCustomerIds(data);
    return data;
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
   * Get priority from panel
   * @param {string} targetLabel - Label to search for (e.g., "Priority")
   * @returns {string|null}
   */
  getHighlightsPanelElementByLabel(targetLabel) {
    // 1. Helper to find all candidate components (piercing shadow boundaries)
    function getAllComponents(root, tagName) {
      let nodes = [];
      root.querySelectorAll(tagName).forEach((el) => nodes.push(el));
      root.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) {
          nodes = nodes.concat(getAllComponents(el.shadowRoot, tagName));
        }
      });
      return nodes;
    }

    // 2. Find all 'records-highlights-details-item' components
    const items = getAllComponents(document.body, "records-highlights-details-item");

    for (const item of items) {
      if (item.offsetWidth === 0 && item.offsetHeight === 0) continue;
      if (!item.shadowRoot) continue;

      const labelEl = item.shadowRoot.querySelector(
        `p[title="${targetLabel}"], p.slds-text-title`
      );
      const labelText = (labelEl?.textContent || "").trim();
      if (!labelEl || labelText !== targetLabel) continue;

      let valueEl = item.shadowRoot.querySelector("lightning-formatted-text");
      if (!valueEl) {
        valueEl = item.querySelector("lightning-formatted-text");
      }

      if (valueEl) {
        const value = (valueEl.textContent || valueEl.innerText || "").trim();
        if (value) {
          return value;
        }
      }
    }
    return null;
  },

  /**
   * Get priority value with fallbacks
   * @returns {string|null}
   */
  getPriorityValue() {
    const fromHighlights = this.getHighlightsPanelElementByLabel("Priority");
    if (fromHighlights && fromHighlights.trim()) {
      return fromHighlights.trim();
    }

    const fromTitleAttr = this.getHighlightsValueByTitle("Priority");
    if (fromTitleAttr && fromTitleAttr.trim()) {
      return fromTitleAttr.trim();
    }

    const fromRecordLayout = this.getFieldValue(["Priority"]);
    if (fromRecordLayout && fromRecordLayout.trim()) {
      return fromRecordLayout.trim();
    }

    return null;
  },

  /**
   * Query highlights item by title attribute when shadow lookup misses
   * @param {string} targetLabel
   * @returns {string|null}
   */
  getHighlightsValueByTitle(targetLabel) {
    const labelNodes = document.querySelectorAll(
      'records-highlights-details-item p[title]'
    );

    for (const labelNode of labelNodes) {
      const title = (labelNode.getAttribute("title") || "").trim();
      if (title !== targetLabel) continue;

      const hostItem = labelNode.closest("records-highlights-details-item");
      if (!hostItem) continue;

      let valueEl = hostItem.querySelector("lightning-formatted-text");
      if (!valueEl && hostItem.shadowRoot) {
        valueEl = hostItem.shadowRoot.querySelector(
          "lightning-formatted-text"
        );
      }

      const value = (valueEl?.textContent || valueEl?.innerText || "").trim();
      if (value) {
        return value;
      }
    }

    return null;
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
        console.log('Using visible case subject: [caseDataExtractor].getSubject()', subject);
        return subject;
      }
    }

    const header = this.getHeaderText();
    if (!header) return null;
    const parts = header.split(' - ');
     console.log('Using visible case subject: [caseDataExtractor].getHeaderText()', parts);
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
      const isVisible = typeof CaseDomUtils.isElementVisible === 'function' && CaseDomUtils.isElementVisible(header) ? true : false;
      if (header ) {
        return header;
      }
    }

    console.log('Visible case header not found via CaseDomUtils, falling back to direct DOM query.');

    // Fallback: check visibility of header field
    const candidates = document.querySelectorAll('slot[name="primaryField"] lightning-formatted-text, records-formula-output[slot="primaryField"] lightning-formatted-text');
    let headerField = null;
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      headerField = CaseDomUtils.getFirstVisibleElement(candidates);
    } else if (candidates.length > 0) {
      headerField = candidates[0];
    }
    return headerField ? (headerField.textContent || '').trim() : null;
    console.log('Using visible case header: [caseDataExtractor].getHeaderText()', headerField, candidates[0], candidates[1]);
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
   * Gets Institution Code if present as a dedicated field
   * @returns {string|null}
   */
  getInstitutionCode() {
    return this.getFieldValue(['Institution Code', 'Inst Code']);
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

    // Preserve legacy behavior: return server code if present, otherwise the raw value
    const serverMatch = fieldValue.match(/(NA\d{2}|EU\d{2}|AP\d{2}|CN\d{2}|CA\d{2})/i);
    if (serverMatch) {
      return serverMatch[1].toUpperCase();
    }

    return fieldValue;
  },

  /**
   * Derive server code from affected environment text
   * @param {string|null} environmentValue
   * @returns {string|null}
   */
  getServerFromEnvironment(environmentValue) {
    if (!environmentValue) return null;
    const serverMatch = environmentValue.match(/(NA\d{2}|EU\d{2}|AP\d{2}|CN\d{2}|CA\d{2})/i);
    return serverMatch ? serverMatch[1].toUpperCase() : null;
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
   * Populate cust/inst/server from master data when possible
   * @param {Object} data
   */
  enrichCustomerIds(data) {
    const identifiers = {
      institutionCode: data.institutionCode,
      accountCode: data.accountCode,
      accountName: data.accountName
    };

    const record = typeof CustomerMasterManager !== 'undefined'
      ? CustomerMasterManager.findByInstitutionCode(identifiers.institutionCode || identifiers.accountCode, identifiers.accountName)
      : null;

    const fallback = !record && typeof CustomerDataManager !== 'undefined'
      ? CustomerDataManager.findByInstitutionCode(identifiers.institutionCode || identifiers.accountCode, identifiers.accountName)
      : null;

    const resolved = record || fallback;
    if (resolved) {
      data.custID = data.custID || data.custId || data.customerId || resolved.custID || resolved.customerId || null;
      data.custId = data.custID;
      data.customerId = data.custID;
      data.instID = data.instID || data.instId || data.institutionId || resolved.instID || resolved.institutionId || null;
      data.instId = data.instID;
      data.institutionId = data.instID;
      if (!data.server && resolved.server) {
        data.server = resolved.server;
      }
      if (!data.institutionCode && resolved.institutionCode) {
        data.institutionCode = resolved.institutionCode;
      }
    }
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

    // Step 5: Resolve timezone information (CaseDataExtractor's independent implementation)
    // Uses ONLY CustomerDataManager.getCustomerTimezone() as the single source of truth
    // This uses CustomerTimezoneLookup which reads from timezones_index.json and user overrides
    // No fallbacks - if CustomerDataManager is unavailable or doesn't resolve, timezone remains null
    if (typeof CustomerDataManager !== 'undefined' && typeof CustomerDataManager.getCustomerTimezone === 'function') {
      try {
        const timezoneInfo = await CustomerDataManager.getCustomerTimezone({
          accountName: processed.accountName || processed.customerName, // Primary lookup key
          institutionCode: processed.institutionCode, // Fallback lookup
          customer: customerRecord
          // customerId and instID no longer used for timezone lookup
        });

        if (timezoneInfo && timezoneInfo.timezone) {
          processed.customerTimezone = timezoneInfo.timezone;
          processed.customerTimezoneSource = timezoneInfo.source || 'customerDataManager';
          processed.customerOrgCode = timezoneInfo.orgCode || processed.institutionCode || null;
          processed.customerOrgName = timezoneInfo.orgName || timezoneInfo.accountName || processed.customerName || null;
          processed.customerDbServers = timezoneInfo.dbServers || []; // Empty array as dbServers no longer available in CSV
          console.log('[CaseDataExtractor] Timezone resolved via CustomerDataManager:', {
            timezone: timezoneInfo.timezone,
            source: timezoneInfo.source
          });
        } else {
          console.log('[CaseDataExtractor] Timezone not found in CustomerDataManager for:', {
            institutionCode: processed.institutionCode,
            accountName: processed.accountName
          });
        }
      } catch (error) {
        console.error('[CaseDataExtractor] Error resolving customer timezone:', error);
      }
    } else {
      console.warn('[CaseDataExtractor] CustomerDataManager not available for timezone resolution');
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
  async getData(options = {}) {
    const { force = false } = options;

    if (!force && typeof CaseDataStore !== 'undefined') {
      const stored = CaseDataStore.getCurrentData();
      if (stored) {
        return stored;
      }
    }

    if (typeof CaseContextWatcher !== 'undefined') {
      await CaseContextWatcher.getStableContext?.({ requireCase: true, timeout: 4000 });
    }

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
