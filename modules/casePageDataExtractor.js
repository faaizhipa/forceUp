/**
 * Case Page Data Extractor Module
 * Automatically extracts case field data when navigating to a case detail page
 * Uses PageIdentifier to monitor page changes
 */

const CasePageDataExtractor = {
  isInitialized: false,
  currentCaseId: null,
  lastExtractedData: null,
  isExtracting: false, // Track if extraction is in progress
  extractionQueue: [], // Queue for pending extractions
  retryTimeoutId: null, // Track retry timeout for cleanup
  visiblePanels: [], // Store visible panels for scoped queries

  /**
   * Extracts case metadata from the page
   * Uses PageContextValidator to ensure data matches current page (prevents stale data)
   * @returns {Promise<Object|null>} Case metadata (validated against current page context) or null if validation fails
   */
  async extractCaseMetadata() {
    const metadata = {};

    // Extract Case ID from URL FIRST (source of truth)
    let urlMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
    metadata.caseId = urlMatch?.[1] || null;

    // STEP 1: Find the VISIBLE case details panels
    // Multiple slot elements exist in the DOM that shift position, so we must find the visible ones
    const panelSelectors = [
      'slot[name="tabs"] > flexipage-tab2[slot="detail"].slds-tabs_default__content.slds-show',
      'slot[name="tabs"] > flexipage-tab2[slot="tabs"].slds-tabs_default__content.slds-show'
    ];
    
    // Store visible panels for use by other extraction methods
    this.visiblePanels = [];
    for (const selector of panelSelectors) {
      const allPanels = document.querySelectorAll(selector);
      for (const panel of allPanels) {
        if (this.isElementVisible(panel)) {
          this.visiblePanels.push(panel);
          console.log('[CasePageDataExtractor] Found visible case details panel:', selector);
        }
      }
    }

    if (this.visiblePanels.length === 0) {
      console.warn('[CasePageDataExtractor] No visible case details panel found');
      // Still try to extract basic metadata from URL/title
    }

    // Extract Case Number from first visible panel
    let caseNumber = '';
    for (const panel of this.visiblePanels) {
      const caseNumberElement = panel.querySelector('lightning-formatted-text[data-output-element-id="output-field"][slot="output"]');
      if (caseNumberElement?.textContent.trim()) {
        caseNumber = caseNumberElement.textContent.trim();
        break;
      }
    }

    // Fallback: Extract from page title
    if (!caseNumber) {
      const titleElement = document.querySelector('title');
      const titleText = titleElement?.textContent.trim() || '';
      if (/^\d{8}/.test(titleText)) {
        caseNumber = titleText.substring(0, 8);
      }
    }

    // Additional fallback: Try to extract from breadcrumb or header on comments page
    if (!caseNumber) {
      const breadcrumbLinks = document.querySelectorAll('nav[role="navigation"] a, .breadcrumb a');
      for (const link of breadcrumbLinks) {
        const linkText = link.textContent.trim();
        if (/^\d{8}$/.test(linkText)) {
          caseNumber = linkText;
          break;
        }
      }
    }

    metadata.caseNumber = caseNumber || null;

    // GUARDRAIL: Validate extracted metadata against current page context
    // This prevents stale data from being used when navigating between cases
    if (typeof PageContextValidator !== 'undefined' &&
      typeof PageContextValidator.validateExtractedData === 'function') {
      try {
        const validatedMetadata = await PageContextValidator.validateExtractedData(metadata, {
          waitForTitle: false, // Don't wait during extraction (we're extracting fresh)
          requireCaseId: true,
          requireCaseNumber: false // Case number might not be available immediately
        });

        if (!validatedMetadata) {
          console.warn('[CasePageDataExtractor] Metadata validation failed, returning null');
          return null;
        }

        // Use validated metadata (ensures caseId and caseNumber match current page)
        metadata.caseId = validatedMetadata.caseId || metadata.caseId;
        metadata.caseNumber = validatedMetadata.caseNumber || metadata.caseNumber;
        console.log('[CasePageDataExtractor] Metadata validated successfully');
      } catch (error) {
        console.error('[CasePageDataExtractor] Error during metadata validation:', error);
        // On validation error, still return metadata but log the error
        // This provides graceful degradation
      }
    } else {
      // Fallback: Simple validation if PageContextValidator not available
      if (!metadata.caseId) {
        console.warn('[CasePageDataExtractor] No case ID available, cannot validate');
        return null;
      }
    }

    // If no visible panels found, return basic metadata
    if (this.visiblePanels.length === 0) {
      console.warn('[CasePageDataExtractor] No visible panels, returning basic metadata only');
      metadata.subject = 'N/A';
      metadata.description = 'N/A';
      metadata.priority = '';
      metadata.status = '';
      metadata.contactName = '';
      metadata.accountName = '';
      return metadata;
    }

    // STEP 2: Extract metadata from ALL visible panels
    // Initialize metadata fields
    metadata.subject = 'N/A';
    metadata.description = 'N/A';
    const metadataFields = {
      'Priority': 'priority',
      'Status': 'status',
      'Contact Name': 'contactName',
      'Account Name': 'accountName'
    };
    // Initialize all metadata fields to empty strings
    Object.values(metadataFields).forEach(field => {
      metadata[field] = '';
    });

    // Extract from each visible panel (later panels can override earlier ones if they have values)
    for (const panel of this.visiblePanels) {
      // Extract subject (only if not already found)
      if (metadata.subject === 'N/A' || !metadata.subject) {
        const subjectElement = panel.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Subject"] lightning-formatted-text[slot="outputField"]');
        if (subjectElement?.textContent.trim()) {
          metadata.subject = subjectElement.textContent.trim();
        }
      }

      // Extract description (only if not already found)
      if (metadata.description === 'N/A' || !metadata.description) {
        const descriptionElement = panel.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Description"] lightning-formatted-text[slot="outputField"]');
        if (descriptionElement?.textContent.trim()) {
          metadata.description = descriptionElement.textContent.trim();
        }
      }

      // Extract other metadata fields from this panel
      panel.querySelectorAll('records-record-layout-item, div.forcePageBlockItem').forEach((item) => {
        // Double-check visibility (should already be visible since it's in visiblePanels, but be safe)
        if (!this.isElementVisible(item)) {
          return;
        }

        const labelElement = item.querySelector('.slds-form-element__label, .test-id__field-label, label');
        if (labelElement) {
          const labelText = labelElement.textContent.trim();
          if (metadataFields[labelText]) {
            const valueElement = item.querySelector(
              '.slds-form-element__static lightning-formatted-text, ' +
              '.slds-form-element__control output lightning-formatted-text, ' +
              '.forceOutputLookup a span, .forceOutputLookup a, ' +
              '.forceOutputPicklist span, ' +
              'lightning-formatted-date-time, ' +
              'lightning-formatted-rich-text span, ' +
              '.test-id__field-value span, .test-id__field-value a, ' +
              'span.uiOutputText'
            );

            if (valueElement) {
              let value = valueElement.textContent.trim();

              // Clean up lookup field values
              if (labelText === 'Contact Name' || labelText === 'Account Name') {
                if (value.startsWith('Open ') && value.includes(' Preview')) {
                  value = value.substring(value.indexOf(' ') + 1, value.lastIndexOf(' Preview')).trim();
                } else if (valueElement.tagName === 'A' && valueElement.hasAttribute('title')) {
                  value = valueElement.getAttribute('title');
                }
              }

              // Only set if not already set or if current value is empty
              if (!metadata[metadataFields[labelText]] || metadata[metadataFields[labelText]] === '') {
                metadata[metadataFields[labelText]] = value;
              }
            }
          }
        }
      });
    }

    console.log('[CasePageDataExtractor] Extracted metadata from', this.visiblePanels.length, 'visible panel(s):', metadata);
    return metadata;
  },

  /**
   * Checks if an element is visible
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if element is visible
   */
  isElementVisible(element) {
    if (!element) return false;
    
    // Check if element or any parent has display:none or visibility:hidden
    let current = element;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      current = current.parentElement;
    }
    
    // Check if element has dimensions
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  /**
   * Initialize the module and start monitoring page changes
   */
  init() {
  if (this.isInitialized) {
    console.log('[CasePageDataExtractor] Already initialized, skipping');
    return;
  }

  console.log('[CasePageDataExtractor] Module initializing');
  this.isInitialized = true;

  // Use PageIdentifier to monitor page changes
  if (typeof PageIdentifier !== 'undefined' && typeof PageIdentifier.monitorPageChanges === 'function') {
    console.log('[CasePageDataExtractor] Using PageIdentifier for page monitoring');
    PageIdentifier.monitorPageChanges((pageInfo) => {
      this.handlePageChange(pageInfo);
    });
  } else {
    console.warn('[CasePageDataExtractor] PageIdentifier not available, module will not function');
  }
},

  /**
   * Handle page change events from PageIdentifier
   * @param {Object} pageInfo - Page information from PageIdentifier
   */
  async handlePageChange(pageInfo) {
  // Only handle case detail pages (PageIdentifier returns 'case_page')
  if (pageInfo.type !== 'case_page') {
    // Not a case page, cleanup and clear current data
    this.cleanup();
    return;
  }

  const caseId = pageInfo.caseId;
  if (!caseId) {
    console.warn('[CasePageDataExtractor] Case page detected but no case ID found');
    return;
  }

  // If case changed, cleanup previous state including retry timeout
  if (this.currentCaseId && this.currentCaseId !== caseId) {
    console.log(`[CasePageDataExtractor] Case changed from ${this.currentCaseId} to ${caseId}, cleaning up...`);
    // Clear retry timeout if active
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    this.lastExtractedData = null;
  }

  // Check if extraction is already in progress for this case
  if (this.isExtracting && this.currentCaseId === caseId) {
    console.log('[CasePageDataExtractor] Extraction already in progress for case:', caseId);
    return;
  }

  console.log('[CasePageDataExtractor] Extracting data for case:', caseId);
  this.currentCaseId = caseId;
  this.isExtracting = true;

    try {
      // Wait for page to fully load
      await this.waitForPageLoad();

      // FIRST: Extract metadata to populate visible panels
      // This ensures all subsequent extractions are scoped to visible panels only
      const metadata = await this.extractCaseMetadata();

      // Extract all case data (will now use visible panels via getRecordLayoutField/getFlexipageField)
      const data = await this.extractAllCaseData(metadata);

    // Validate extracted data matches current page context before using
    // Note: validatePageContextBeforeDisplay may return a Promise if waiting for title update
    if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.validatePageContextBeforeDisplay === 'function') {
      let validation = PageContextValidator.validatePageContextBeforeDisplay(data.caseId, data.caseNumber);

      // Handle async validation (when waiting for title update)
      if (validation instanceof Promise) {
        validation = await validation;
      }

      if (!validation.valid) {
        console.warn(`[CasePageDataExtractor] Extracted data validation failed: ${validation.reason}`);
        console.warn(`[CasePageDataExtractor] Data caseId: ${data.caseId}, caseNumber: ${data.caseNumber}`);
        if (validation.currentContext) {
          console.warn(`[CasePageDataExtractor] Current context caseId: ${validation.currentContext.caseId}, caseNumber: ${validation.currentContext.caseNumber}`);
        }
        // Clear extracted data if validation failed
        this.lastExtractedData = null;

        // Retry validation after a delay if case IDs matched (title might update later)
        if (validation.currentContext && data.caseId === validation.currentContext.caseId) {
          console.log('[CasePageDataExtractor] Case IDs match but case numbers don\'t. Retrying validation after delay...');

            // Clear any existing retry timeout
            if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId);
            this.retryTimeoutId = null;
          }

          // Store case ID for validation check
          const retryCaseId = data.caseId;

          this.retryTimeoutId = setTimeout(async () => {
            try {
              // Check if we're still on the same case (might have navigated away)
              const currentCaseId = this.getCaseIdFromUrl();
              if (currentCaseId !== retryCaseId) {
                console.log('[CasePageDataExtractor] Case changed during retry, aborting');
                this.retryTimeoutId = null;
                return;
              }

              // Retry with waitForTitle disabled (already waited)
              const retryValidation = PageContextValidator.validatePageContextBeforeDisplay(data.caseId, data.caseNumber, false);
              const retryResult = retryValidation instanceof Promise ? await retryValidation : retryValidation;

              if (retryResult.valid) {
                console.log('[CasePageDataExtractor] Retry validation succeeded');
                // Update data with validated identifiers
                if (retryResult.currentContext) {
                  data.caseId = retryResult.currentContext.caseId;
                  if (retryResult.currentContext.caseNumber && !data.caseNumber) {
                    data.caseNumber = retryResult.currentContext.caseNumber;
                  }
                }
                this.lastExtractedData = data;
                await this.dispatchDataExtractedEvent(data);
              } else {
                console.warn(`[CasePageDataExtractor] Retry validation also failed: ${retryResult.reason}`);
              }
            } catch (error) {
              console.error('[CasePageDataExtractor] Error during retry validation:', error);
            } finally {
              this.retryTimeoutId = null;
            }
          }, 500);
        }
        return;
      }

      // Update data with validated identifiers if needed
      if (validation.currentContext) {
        data.caseId = validation.currentContext.caseId;
        if (validation.currentContext.caseNumber && !data.caseNumber) {
          data.caseNumber = validation.currentContext.caseNumber;
        }
      }
    }

    this.lastExtractedData = data;

    console.log('[CasePageDataExtractor] Extracted case data (validated):', data);

    // Trigger custom event for other modules to consume (only if validated)
    await this.dispatchDataExtractedEvent(data);
  } catch (error) {
    console.error('[CasePageDataExtractor] Error during extraction:', error);
  } finally {
    // Mark extraction as complete
    this.isExtracting = false;
    console.log('[CasePageDataExtractor] Extraction complete for case:', caseId);
  }
},

/**
 * Wait for page elements to be present
 * @returns {Promise<void>}
 */
waitForPageLoad() {
  return new Promise((resolve) => {
    const maxAttempts = 20;
    let attempts = 0;

    const checkElements = () => {
      attempts++;
      const hasRecordLayout = document.querySelector('records-record-layout-item');
      const hasFlexipageField = document.querySelector('flexipage-field');

      if (hasRecordLayout || hasFlexipageField || attempts >= maxAttempts) {
        console.log('[CasePageDataExtractor] Page elements ready (attempt ' + attempts + ')');
        resolve();
      } else {
        setTimeout(checkElements, 200);
      }
    };

    checkElements();
  });
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
 * Normalize date string for comparison
 * Handles various Salesforce date formats
 * @param {string} dateString - Date string to normalize
 * @returns {string|null} - Normalized date string or null
 */
normalizeDate(dateString) {
  if (!dateString) return null;

  try {
    // Try to parse as Date and return ISO string
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // If parsing fails, return trimmed original
      return dateString.trim();
    }
    // Return ISO string for consistent comparison
    return date.toISOString();
  } catch (error) {
    // If error, return trimmed original
    return dateString.trim();
  }
},

  /**
   * Extract all case data fields using API cache when available
   * @param {Object|null} metadata - Metadata extracted from the page
   * @returns {Object} - Extracted case data
   */
  async extractAllCaseData(metadata = null) {
  const meta = metadata || await this.extractCaseMetadata();
  const apiData = this.getCachedApiData(meta?.caseId || this.currentCaseId, meta?.caseNumber || null);

  let data;
  if (apiData) {
    console.log('[CasePageDataExtractor] Using cached API data for case:', meta?.caseId || this.currentCaseId);
    data = this.buildCaseDataFromApi(apiData, meta);
  } else {
    console.log('[CasePageDataExtractor] API cache miss, extracting data from DOM');
    data = this.buildCaseDataFromDom(meta);
  }

  this.lastExtractedData = data;
  return data;
},

/**
 * Retrieve cached API data for a case
 * @param {string|null} caseId
 * @param {string|null} caseNumber
 * @returns {Object|null}
 */
getCachedApiData(caseId, caseNumber) {
  const cacheSource = window.FetchDataCache || (typeof FetchDataCache !== 'undefined' ? FetchDataCache : null);
  if (!cacheSource || typeof cacheSource.get !== 'function') {
    return null;
  }

  return cacheSource.get(caseId, caseNumber);
},

/**
 * Build case data using cached API information with DOM fallbacks
 * @param {Object} apiData - Normalized data from FetchDataCache
 * @param {Object|null} metadata - Metadata extracted from the page
 * @returns {Object}
 */
buildCaseDataFromApi(apiData, metadata = null) {
  const data = { ...(apiData || {}) };
  this.hydrateDataWithDomFallbacks(data, metadata);
  data.extractedAt = new Date().toISOString();
  return this.enrichWithCustomerData(data);
},

/**
 * Build case data entirely from DOM extraction
 * @param {Object|null} metadata - Metadata extracted from the page
 * @returns {Object}
 */
buildCaseDataFromDom(metadata = null) {
  const data = {
    // Basic case info
    caseId: metadata?.caseId || this.currentCaseId,
    caseNumber: metadata?.caseNumber || this.getCaseNumber(),
    subject: metadata?.subject || this.getSubject(),
    description: metadata?.description || this.getDescription(),
    institutionCode: metadata?.institutionCode || null,

    // Contact and Account
    accountName: this.getRecordLayoutField('Account Name'),
    contactName: this.getRecordLayoutField('Contact Name'),

    // Product/Service Information
    platformService: this.getPlatformService(), // Enhanced with fallback
    productServiceName: this.getRecordLayoutField('Product/Service Name'),

    // Case categorization
    category: this.getRecordLayoutField('Category'),
    subCategory: this.getRecordLayoutField('Sub-Category'),
    status: this.getRecordLayoutField('Status'),
    subStatus: this.getRecordLayoutField('Sub Status'),

    // Customer data
    exLibrisAccountNumber: this.getRecordLayoutField('Ex Libris Account Number'),
    analysisNote: this.getRecordLayoutField('Analysis Note'),

    // Flexipage fields (anchored data)
    asset: this.getFlexipageField('RecordAsset_Line_Item_cField', true),
    affectedEnvironment: this.getFlexipageField('Recordbl_Affected_Environment_cField', true),
    caseOwner: this.getFlexipageField('RecordOwnerIdField', true),
    parentCase: this.getFlexipageField('RecordParentIdField', true),
    parentCaseOwner: this.getFlexipageField('RecordParentCaseOwner_cField', true),

    // Flexipage fields (non-anchored data)
    escalation: this.getFlexipageField('RecordEscalation_cField', false),
    caseCreatedDate: this.getFlexipageField('RecordCreatedDateField', false),
    caseClosedOn: this.getFlexipageField('RecordClosedDateField', false),
    customerExLibrisAccountNumber: this.getFlexipageField('RecordEx_Libris_Account_Number_cField', false),
    pageStatus: this.getFlexipageField('RecordStatusField', false), // Direct page status for banner

    // Timestamp
    extractedAt: new Date().toISOString(),

    // Last Modified Date for reference
    lastModifiedDate: this.getLastModifiedDate()
  };

  return this.enrichWithCustomerData(data);
},

/**
 * Hydrate data object with DOM fallbacks for missing fields
 * @param {Object} data
 * @param {Object|null} metadata
 */
hydrateDataWithDomFallbacks(data, metadata = null) {
  const ensureValue = (key, getter) => {
    if (data[key] && data[key] !== 'N/A') {
      return;
    }
    const value = getter();
    if (value) {
      data[key] = value;
    }
  };

  data.caseId = data.caseId || metadata?.caseId || this.currentCaseId;
  data.caseNumber = data.caseNumber || metadata?.caseNumber || this.getCaseNumber();
  data.subject = data.subject || metadata?.subject || this.getSubject();
  data.description = data.description || metadata?.description || this.getDescription();

  ensureValue('accountName', () => this.getRecordLayoutField('Account Name'));
  ensureValue('contactName', () => this.getRecordLayoutField('Contact Name'));
  ensureValue('platformService', () => this.getPlatformService());
  ensureValue('productServiceName', () => this.getRecordLayoutField('Product/Service Name'));
  ensureValue('category', () => this.getRecordLayoutField('Category'));
  ensureValue('subCategory', () => this.getRecordLayoutField('Sub-Category'));
  ensureValue('status', () => this.getRecordLayoutField('Status'));
  ensureValue('subStatus', () => this.getRecordLayoutField('Sub Status'));
  ensureValue('exLibrisAccountNumber', () => this.getRecordLayoutField('Ex Libris Account Number'));
  ensureValue('analysisNote', () => this.getRecordLayoutField('Analysis Note'));
  ensureValue('asset', () => this.getFlexipageField('RecordAsset_Line_Item_cField', true));
  ensureValue('affectedEnvironment', () => this.getFlexipageField('Recordbl_Affected_Environment_cField', true));
  ensureValue('caseOwner', () => this.getFlexipageField('RecordOwnerIdField', true));
  ensureValue('parentCase', () => this.getFlexipageField('RecordParentIdField', true));
  ensureValue('parentCaseOwner', () => this.getFlexipageField('RecordParentCaseOwner_cField', true));
  ensureValue('escalation', () => this.getFlexipageField('RecordEscalation_cField', false));
  ensureValue('caseCreatedDate', () => this.getFlexipageField('RecordCreatedDateField', false));
  ensureValue('caseClosedOn', () => this.getFlexipageField('RecordClosedDateField', false));
  ensureValue('customerExLibrisAccountNumber', () => this.getFlexipageField('RecordEx_Libris_Account_Number_cField', false));
  ensureValue('pageStatus', () => this.getFlexipageField('RecordStatusField', false));
  ensureValue('institutionCode', () => metadata?.institutionCode || data.exLibrisAccountNumber || null);
  ensureValue('lastModifiedDate', () => this.getLastModifiedDate());
},

/**
 * Enrich case data with customer metadata
 * @param {Object} data
 * @returns {Object}
 */
enrichWithCustomerData(data) {
  if (typeof CustomerDataManager !== 'undefined' && data.exLibrisAccountNumber) {
    const customerInfo = CustomerDataManager.findByInstitutionCode(
      data.exLibrisAccountNumber,
      data.accountName
    );

    if (customerInfo) {
      data.custID = customerInfo.custID;
      data.instID = customerInfo.instID;
      data.server = customerInfo.server;
      data.institutionCode = customerInfo.institutionCode || data.institutionCode || data.exLibrisAccountNumber || null;
      console.log('[CaseDataExtractor] Found customer by institution code:', customerInfo.name);
      console.log('[CaseDataExtractor] Using server from customer record:', customerInfo.server);
      console.log(
        '[CaseDataExtractor] Applied customer data - custID:',
        customerInfo.custID,
        'instID:',
        customerInfo.instID,
        'server:',
        customerInfo.server,
        'institutionCode:',
        data.institutionCode
      );
    }
  }

  return data;
},

/**
 * Get Platform/Service field with fallback to RecordPlatform_cField
 * @returns {string|null}
 */
getPlatformService() {
  // Try primary method: records-record-layout-item
  let value = this.getFlexipageField('RecordPQ_Product_Group_cField', false);
  // Fallback to flexipage field if primary fails
  if (!value) {
    value = this.getRecordLayoutField('Product/Service Name');
    if (value) {
      console.log('[CasePageDataExtractor] Using case details mini panel for Product/Service Name:', value);
    }
  }

  return value;
},

/**
 * Get case number from page header
 * @returns {string|null}
 */
getCaseNumber() {
  const header = this.getHeaderText();
  if (header) {
    const numberMatch = header.match(/^([0-9]{6,})/);
    if (numberMatch) return numberMatch[1];
    return null;
  }

  // Fallback: some pages expose the case number (or related ID) as a non-anchored
  // flexipage-field. Per request, try the RecordEx_Libris_Account_Number_cField
  // which in some layouts contains the identifier as plain text.
  try {
    const flexValue = this.getFlexipageField('RecordEx_Libris_Account_Number_cField', false);
    if (flexValue) {
      // If the flex field contains an 6+ digit number at the start, return that
      const match = flexValue.match(/^([0-9]{6,})/);
      if (match) return match[1];
      // Otherwise return the raw value as a last resort
      return flexValue;
    }
  } catch (e) {
    console.warn('[CasePageDataExtractor] Error reading flexipage fallback for case number:', e);
  }

  return null;
},

/**
 * Get subject from page header
 * @returns {string|null}
 */
getSubject() {
  const header = this.getHeaderText();
  if (!header) return null;
  const parts = header.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : null;
},

/**
 * Get combined header text (case number + subject)
 * @returns {string|null}
 */
getHeaderText() {
  const headerField = document.querySelector('slot[name="primaryField"] lightning-formatted-text, records-formula-output[slot="primaryField"] lightning-formatted-text');
  return headerField ? (headerField.textContent || '').trim() : null;
},

/**
 * Get description field content
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
 * Extract text from records-record-layout-item by label
 * @param {string} label - Field label to search for
 * @returns {string|null}
 */
getRecordLayoutField(label) {
  if (this.visiblePanels && this.visiblePanels.length > 0) {
    for (const panel of this.visiblePanels) {
      const exactMatch = panel.querySelector(`records-record-layout-item[field-label="${label}"]`);
      if (exactMatch) {
        const value = this.extractRecordLayoutValue(exactMatch);
        if (value) {
          console.log(`[CasePageDataExtractor] Extracted "${label}" from visible panel:`, value);
          return value;
        }
      }

      const partialMatch = panel.querySelector(`records-record-layout-item[field-label*="${label}"]`);
      if (partialMatch) {
        const value = this.extractRecordLayoutValue(partialMatch);
        if (value) {
          console.log(`[CasePageDataExtractor] Extracted "${label}" from visible panel (partial match):`, value);
          return value;
        }
      }
    }
  }

  console.warn(`[CasePageDataExtractor] Could not find layout item for label: "${label}" in visible panels`);
  return null;
},

/**
 * Extract value from a records-record-layout-item element
 * Deep traversal through nested elements to find the actual value
 * @param {Element} layoutItem - The records-record-layout-item element
 * @returns {string|null}
 */
extractRecordLayoutValue(layoutItem) {
  if (!layoutItem) return null;

  // Common paths to the value:
  // 1. lightning-formatted-text (try both direct query and shadow DOM)
  const formattedText = layoutItem.querySelector('lightning-formatted-text');

  if (formattedText && formattedText.textContent) {
    return formattedText.textContent.trim();
  }

  // 2. force-lookup > records-hoverable-link > a > span (nested slots)
  const lookup = layoutItem.querySelector('force-lookup');

  if (lookup) {
    // Try to find the anchor element
    const anchor = lookup.querySelector('records-hoverable-link a, a');

    if (anchor) {
      // Navigate through slots to find the innermost span
      const spans = anchor.querySelectorAll('span');
      if (spans.length > 0) {
        // Get the last span which usually contains the actual text
        const lastSpan = spans[spans.length - 1];
        if (lastSpan.textContent) {
          return lastSpan.textContent.trim();
        }
      }
      // Fallback to anchor text
      if (anchor.textContent) {
        return anchor.textContent.trim();
      }
    }
  }

  // 3. Direct span in slds-form-element__control
  const control = layoutItem.querySelector('div.slds-form-element__control span');

  if (control && control.textContent) {
    return this.cleanTextContent(control);
  }

  // 4. .test-id__field-value
  const fieldValue = layoutItem.querySelector('.test-id__field-value');

  if (fieldValue && fieldValue.textContent) {
    return this.cleanTextContent(fieldValue);
  }

  // 5. Fallback: get all text content
  return this.cleanTextContent(layoutItem);
},

/**
 * Extract value from flexipage-field by data-field-id
 * @param {string} fieldId - The data-field-id value
 * @param {boolean} isAnchored - Whether the field contains anchor elements (lookup fields)
 * @returns {string|null}
 */
getFlexipageField(fieldId, isAnchored = false) {
  // FIRST: Search within visible panels only (prevents stale data from cached panels)
  if (this.visiblePanels && this.visiblePanels.length > 0) {
    for (const panel of this.visiblePanels) {
      let field = panel.querySelector(`flexipage-field[data-field-id="${fieldId}"]`);

      if (field) {
        // Extract value from this field using the existing extraction logic below
        const value = this.extractFlexipageFieldValue(field, fieldId, isAnchored);
        if (value) {
          console.log(`[CasePageDataExtractor] Extracted flexipage field "${fieldId}" from visible panel:`, value);
          return value;
        }
      }
    }
  }

  console.warn(`[CasePageDataExtractor] Could not find flexipage-field with data-field-id: "${fieldId}" in visible panels`);
  return null;
},

/**
 * Extract value from a flexipage-field element
 * @param {Element} field - The flexipage-field element
 * @param {boolean} isAnchored - Whether the field contains anchor elements (lookup fields)
 * @returns {string|null}
 */
extractFlexipageFieldValue(field, fieldId, isAnchored = false) {
  if (!field) return null;

  if (isAnchored) {
    // Anchored data: Extract from the last span in the anchor chain
    // Path: record_flexipage-record-field > div > div > div.slds-form-element__control
    //   > span > slot > force-lookup > div > records-hoverable-link > div > a
    //   > span > slot > span > slot > span

    const anchor = field.querySelector('a');

    if (anchor) {
      // Get all spans and find the deepest one with text
      const spans = anchor.querySelectorAll('span');
      if (spans.length > 0) {
        // Try to get the last span
        for (let i = spans.length - 1; i >= 0; i--) {
          const text = spans[i].textContent?.trim();
          if (text && text.length > 0) {
            // Make sure we're not getting nested content
            const childSpans = spans[i].querySelectorAll('span');
            if (childSpans.length === 0) {
              console.log(`[CasePageDataExtractor] Extracted anchored field "${fieldId}":`, text);
              return text;
            }
          }
        }
        // Fallback to the last span
        const lastSpan = spans[spans.length - 1];
        if (lastSpan.textContent) {
          const text = lastSpan.textContent.trim();
          console.log(`[CasePageDataExtractor] Extracted anchored field "${fieldId}" (fallback):`, text);
          return text;
        }
      }
      // Fallback to anchor text
      if (anchor.textContent) {
        const text = anchor.textContent.trim();
        console.log(`[CasePageDataExtractor] Extracted anchored field "${fieldId}" (anchor text):`, text);
        return text;
      }
    }

    // If no anchor found, try force-lookup
    const lookup = field.querySelector('force-lookup');

    if (lookup && lookup.textContent) {
      const text = this.cleanTextContent(lookup);
      console.log(`[CasePageDataExtractor] Extracted anchored field "${fieldId}" from force-lookup:`, text);
      return text;
    }

    console.warn(`[CasePageDataExtractor] Could not extract value from anchored field "${fieldId}"`);
  } else {
    // Non-anchored data: Extract from lightning-formatted-text
    // Path: slot > record_flexipage-record-field > div > div > div.slds-form-element__control
    //   > span > slot > lightning-formatted-text

    const formattedText = field.querySelector('lightning-formatted-text');

    if (formattedText && formattedText.textContent) {
      const text = formattedText.textContent.trim();
      console.log(`[CasePageDataExtractor] Extracted non-anchored field "${fieldId}":`, text);
      return text;
    }

    // Fallback to any text in the control
    const control = field.querySelector('div.slds-form-element__control');

    if (control && control.textContent) {
      const text = this.cleanTextContent(control);
      console.log(`[CasePageDataExtractor] Extracted non-anchored field "${fieldId}" from control:`, text);
      return text;
    }

    console.warn(`[CasePageDataExtractor] Could not extract value from non-anchored field "${fieldId}"`);
  }

  return null;
},

/**
 * Normalize text content, converting <br> tags to newlines
 * @param {Element} node
 * @returns {string}
 */
normalizeText(node) {
  if (!node) return '';
  const clone = node.cloneNode(true);
  clone.querySelectorAll('br').forEach((br) => (br.textContent = '\n'));
  return (clone.textContent || '').trim();
},

/**
 * Clean text content by removing buttons and assistive text
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
   * Dispatch custom event with extracted data
   * Validates data before dispatching (async if waiting for title update)
   * @param {Object} data - Extracted case data
   * @returns {Promise<void>}
   */
  async dispatchDataExtractedEvent(data) {
  // Validate before dispatching
  // Note: validatePageContextBeforeDisplay may return a Promise if waiting for title update
  if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.validatePageContextBeforeDisplay === 'function') {
    let validation = PageContextValidator.validatePageContextBeforeDisplay(data.caseId, data.caseNumber);

    // Handle async validation (when waiting for title update)
    if (validation instanceof Promise) {
      validation = await validation;
    }

    if (!validation.valid) {
      console.warn(`[CasePageDataExtractor] Cannot dispatch event: ${validation.reason}`);
      return;
    }
  }

  const event = new CustomEvent('casePageDataExtracted', {
    detail: data,
    bubbles: true,
    composed: true
  });
  document.dispatchEvent(event);
  console.log('[CasePageDataExtractor] Dispatched casePageDataExtracted event (validated)');
},

/**
 * Extract case ID from current URL
 * @returns {string|null}
 */
getCaseIdFromUrl() {
  if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.getCaseIdFromUrl === 'function') {
    return PageContextValidator.getCaseIdFromUrl();
  }
  // Fallback implementation
  const match = window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})\//);
  return match ? match[1] : null;
},

/**
 * Cleanup method to clear timeouts and reset state
 */
cleanup() {
  // Clear retry timeout if active
  if (this.retryTimeoutId) {
    clearTimeout(this.retryTimeoutId);
    this.retryTimeoutId = null;
  }

  // Reset state
  this.currentCaseId = null;
  this.lastExtractedData = null;
  this.isExtracting = false;
  this.extractionQueue = [];
},

  /**
   * Get the last extracted data
   * @returns {Object|null}
   */
  getLastExtractedData() {
  return this.lastExtractedData;
},

  /**
   * Manually trigger data extraction for the current page
   * @param {boolean|Object|string} options - Force flag, options object, or explicit case ID (legacy)
   * @returns {Promise<Object|null>}
   */
  async extractNow(options = {}) {
  if (!this.currentCaseId) {
    console.warn('[CasePageDataExtractor] No case page currently loaded');
    return null;
  }

  let forceRequested = false;
  let requestedCaseId = null;

  if (typeof options === 'boolean') {
    forceRequested = options;
  } else if (typeof options === 'string') {
    requestedCaseId = options;
  } else if (typeof options === 'object' && options !== null) {
    forceRequested = Boolean(options.force);
    requestedCaseId = options.caseId || null;
  }

  if (requestedCaseId && requestedCaseId !== this.currentCaseId) {
    console.warn(`[CasePageDataExtractor] extractNow() called for case ${requestedCaseId}, but current case is ${this.currentCaseId}. Proceeding with current case.`);
  }

  if (forceRequested) {
    console.log('[CasePageDataExtractor] Force extraction triggered for case:', this.currentCaseId);
  } else {
    console.log('[CasePageDataExtractor] Manual extraction triggered for case:', this.currentCaseId);
  }

  await this.waitForPageLoad();
  const metadata = await this.extractCaseMetadata();
  const data = await this.extractAllCaseData(metadata);
  this.lastExtractedData = data;
  await this.dispatchDataExtractedEvent(data);
  return data;
}
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CasePageDataExtractor;
}
