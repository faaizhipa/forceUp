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
      // Not a case page, clear current data
      this.currentCaseId = null;
      this.lastExtractedData = null;
      this.isExtracting = false;
      this.extractionQueue = [];
      return;
    }

    const caseId = pageInfo.caseId;
    if (!caseId) {
      console.warn('[CasePageDataExtractor] Case page detected but no case ID found');
      return;
    }

    // Check if we already extracted data for this case
    if (this.currentCaseId === caseId && this.lastExtractedData) {
      console.log('[CasePageDataExtractor] Already have data for case:', caseId);
      return;
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

      // Extract all case data
      const data = await this.extractAllCaseData();
      
      // Validate extracted data matches current page context before using
      if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.validatePageContextBeforeDisplay === 'function') {
        const validation = PageContextValidator.validatePageContextBeforeDisplay(data.caseId, data.caseNumber);
        
        if (!validation.valid) {
          console.warn(`[CasePageDataExtractor] Extracted data validation failed: ${validation.reason}`);
          console.warn(`[CasePageDataExtractor] Data caseId: ${data.caseId}, caseNumber: ${data.caseNumber}`);
          if (validation.currentContext) {
            console.warn(`[CasePageDataExtractor] Current context caseId: ${validation.currentContext.caseId}, caseNumber: ${validation.currentContext.caseNumber}`);
          }
          // Clear extracted data if validation failed
          this.lastExtractedData = null;
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
      this.dispatchDataExtractedEvent(data);
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
   * Extract all case data fields
   * @returns {Object} - Extracted case data
   */
  async extractAllCaseData() {
    const data = {
      // Basic case info
      caseId: this.currentCaseId,
      caseNumber: this.getCaseNumber(),
      subject: this.getSubject(),
      description: this.getDescription(),

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
      extractedAt: new Date().toISOString()
    };

    // Enrich with customer data from CustomerDataManager
    if (typeof CustomerDataManager !== 'undefined' && data.exLibrisAccountNumber) {
      // Pass both institution code and account name for flexible matching
      const customerInfo = CustomerDataManager.findByInstitutionCode(
        data.exLibrisAccountNumber,
        data.accountName // Fallback to account name matching
      );
      
      if (customerInfo) {
        data.custID = customerInfo.custID;
        data.instID = customerInfo.instID;
        data.server = customerInfo.server;
        console.log('[CaseDataExtractor] Found customer by institution code:', customerInfo.name);
        console.log('[CaseDataExtractor] Using server from customer record:', customerInfo.server);
        console.log('[CaseDataExtractor] Applied customer data - custID:', customerInfo.custID, 'instID:', customerInfo.instID, 'server:', customerInfo.server);
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
   * Query through Shadow DOM to find elements
   * @param {string} selector - CSS selector
   * @param {Element} root - Root element to start search from
   * @returns {Element|null}
   */
  queryShadowDOM(selector, root = document.body) {
    // Try direct query first
    let element = root.querySelector(selector);
    if (element) return element;

    // Recursively search through shadow roots
    const traverse = (node) => {
      // Check current node's shadowRoot
      if (node.shadowRoot) {
        const found = node.shadowRoot.querySelector(selector);
        if (found) return found;
        
        // Recursively search shadow root's children
        for (const child of node.shadowRoot.children) {
          const result = traverse(child);
          if (result) return result;
        }
      }

      // Search regular children
      for (const child of node.children) {
        const result = traverse(child);
        if (result) return result;
      }

      return null;
    };

    return traverse(root);
  },

  /**
   * Extract text from records-record-layout-item by label
   * @param {string} label - Field label to search for
   * @returns {string|null}
   */
  getRecordLayoutField(label) {
    // Query by label attribute - try both direct and shadow DOM
    let layoutItem = document.querySelector(`records-record-layout-item[field-label="${label}"]`);
    
    // If not found, try shadow DOM traversal
    if (!layoutItem) {
      layoutItem = this.queryShadowDOM(`records-record-layout-item[field-label="${label}"]`);
    }
    
    if (!layoutItem) {
      // Try partial match
      const partialMatch = document.querySelector(`records-record-layout-item[field-label*="${label}"]`);
      if (!partialMatch) {
        // Try shadow DOM for partial match
        const shadowPartialMatch = this.queryShadowDOM(`records-record-layout-item[field-label*="${label}"]`);
        if (!shadowPartialMatch) {
          console.warn(`[CasePageDataExtractor] Could not find layout item for label: "${label}"`);
          return null;
        }
        const value = this.extractRecordLayoutValue(shadowPartialMatch);
        console.log(`[CasePageDataExtractor] Extracted "${label}" from shadow DOM (partial match):`, value);
        return value;
      }
      const value = this.extractRecordLayoutValue(partialMatch);
      console.log(`[CasePageDataExtractor] Extracted "${label}" (partial match):`, value);
      return value;
    }

    const value = this.extractRecordLayoutValue(layoutItem);
    console.log(`[CasePageDataExtractor] Extracted "${label}":`, value);
    return value;
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
    let formattedText = layoutItem.querySelector('lightning-formatted-text');
    if (!formattedText && layoutItem.shadowRoot) {
      formattedText = layoutItem.shadowRoot.querySelector('lightning-formatted-text');
    }
    
    // If still not found, try deep shadow DOM search
    if (!formattedText) {
      formattedText = this.queryShadowDOM('lightning-formatted-text', layoutItem);
    }
    
    if (formattedText && formattedText.textContent) {
      return formattedText.textContent.trim();
    }

    // 2. force-lookup > records-hoverable-link > a > span (nested slots)
    let lookup = layoutItem.querySelector('force-lookup');
    if (!lookup && layoutItem.shadowRoot) {
      lookup = layoutItem.shadowRoot.querySelector('force-lookup');
    }
    if (!lookup) {
      lookup = this.queryShadowDOM('force-lookup', layoutItem);
    }
    
    if (lookup) {
      // Try to find the anchor element
      let anchor = lookup.querySelector('records-hoverable-link a');
      if (!anchor && lookup.shadowRoot) {
        anchor = lookup.shadowRoot.querySelector('records-hoverable-link a');
      }
      if (!anchor) {
        anchor = this.queryShadowDOM('records-hoverable-link a', lookup);
      }
      
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
    let control = layoutItem.querySelector('div.slds-form-element__control span');
    if (!control && layoutItem.shadowRoot) {
      control = layoutItem.shadowRoot.querySelector('div.slds-form-element__control span');
    }
    if (!control) {
      control = this.queryShadowDOM('div.slds-form-element__control span', layoutItem);
    }
    
    if (control && control.textContent) {
      return this.cleanTextContent(control);
    }

    // 4. .test-id__field-value
    let fieldValue = layoutItem.querySelector('.test-id__field-value');
    if (!fieldValue && layoutItem.shadowRoot) {
      fieldValue = layoutItem.shadowRoot.querySelector('.test-id__field-value');
    }
    if (!fieldValue) {
      fieldValue = this.queryShadowDOM('.test-id__field-value', layoutItem);
    }
    
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
    let field = document.querySelector(`flexipage-field[data-field-id="${fieldId}"]`);
    
    // If not found, try shadow DOM traversal
    if (!field) {
      field = this.queryShadowDOM(`flexipage-field[data-field-id="${fieldId}"]`);
    }
    
    if (!field) {
      console.warn(`[CasePageDataExtractor] Could not find flexipage-field with data-field-id: "${fieldId}"`);
      return null;
    }

    if (isAnchored) {
      // Anchored data: Extract from the last span in the anchor chain
      // Path: record_flexipage-record-field > div > div > div.slds-form-element__control
      //   > span > slot > force-lookup > div > records-hoverable-link > div > a
      //   > span > slot > span > slot > span

      let anchor = field.querySelector('a');
      if (!anchor && field.shadowRoot) {
        anchor = field.shadowRoot.querySelector('a');
      }
      if (!anchor) {
        anchor = this.queryShadowDOM('a', field);
      }
      
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
      let lookup = field.querySelector('force-lookup');
      if (!lookup && field.shadowRoot) {
        lookup = field.shadowRoot.querySelector('force-lookup');
      }
      if (!lookup) {
        lookup = this.queryShadowDOM('force-lookup', field);
      }
      
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

      let formattedText = field.querySelector('lightning-formatted-text');
      if (!formattedText && field.shadowRoot) {
        formattedText = field.shadowRoot.querySelector('lightning-formatted-text');
      }
      if (!formattedText) {
        formattedText = this.queryShadowDOM('lightning-formatted-text', field);
      }
      
      if (formattedText && formattedText.textContent) {
        const text = formattedText.textContent.trim();
        console.log(`[CasePageDataExtractor] Extracted non-anchored field "${fieldId}":`, text);
        return text;
      }

      // Fallback to any text in the control
      let control = field.querySelector('div.slds-form-element__control');
      if (!control && field.shadowRoot) {
        control = field.shadowRoot.querySelector('div.slds-form-element__control');
      }
      if (!control) {
        control = this.queryShadowDOM('div.slds-form-element__control', field);
      }
      
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
   * Validates data before dispatching
   * @param {Object} data - Extracted case data
   */
  dispatchDataExtractedEvent(data) {
    // Validate before dispatching
    if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.validatePageContextBeforeDisplay === 'function') {
      const validation = PageContextValidator.validatePageContextBeforeDisplay(data.caseId, data.caseNumber);
      
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
   * Get the last extracted data
   * @returns {Object|null}
   */
  getLastExtractedData() {
    return this.lastExtractedData;
  },

  /**
   * Manually trigger data extraction for the current page
   * @returns {Promise<Object|null>}
   */
  async extractNow() {
    if (!this.currentCaseId) {
      console.warn('[CasePageDataExtractor] No case page currently loaded');
      return null;
    }

    console.log('[CasePageDataExtractor] Manual extraction triggered for case:', this.currentCaseId);
    await this.waitForPageLoad();
    const data = await this.extractAllCaseData();
    this.lastExtractedData = data;
    this.dispatchDataExtractedEvent(data);
    return data;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CasePageDataExtractor;
}
