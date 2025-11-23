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
  currentExtractionToken: null,

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

    if (typeof CaseContextWatcher !== 'undefined') {
      CaseContextWatcher.init?.();
    }

    if (typeof CaseDataStore !== 'undefined') {
      CaseDataStore.init();
    }

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
      this.cleanup('non-case-page');
      return;
    }

    if (typeof CaseContextWatcher !== 'undefined') {
      await CaseContextWatcher.init?.();
    }

    const context = (typeof CaseContextWatcher !== 'undefined')
      ? await CaseContextWatcher.getStableContext({ requireCase: true, timeout: 4000 })
      : null;

    const caseId = context?.caseId || pageInfo.caseId;
    const contextCaseNumber = context?.caseNumber || pageInfo.caseNumber || null;

    if (!caseId) {
      console.warn('[CasePageDataExtractor] Case page detected but no case ID found');
      this.cleanup('missing-case-id');
      return;
    }

    if (this.currentCaseId && this.currentCaseId !== caseId) {
      console.log(`[CasePageDataExtractor] Case changed from ${this.currentCaseId} to ${caseId}, cleaning up...`);
      this.cleanup('case-switch');
    }

    if (this.isExtracting && this.currentCaseId === caseId) {
      console.log('[CasePageDataExtractor] Extraction already in progress for case:', caseId);
      return;
    }

    console.log('[CasePageDataExtractor] Extracting data for case:', caseId);
    this.currentCaseId = caseId;

    const extractionToken = Symbol(`case-extraction-${caseId}-${Date.now()}`);
    this.currentExtractionToken = extractionToken;
    this.isExtracting = true;

    try {
      await this.waitForPageLoad(extractionToken);

      if (!this.isTokenActive(extractionToken)) {
        console.log('[CasePageDataExtractor] Navigation changed during wait, aborting extraction');
        return;
      }

      const data = await this.extractAllCaseData({
        caseId,
        caseNumber: contextCaseNumber
      });

      if (!this.isTokenActive(extractionToken)) {
        console.log('[CasePageDataExtractor] Token no longer active after extraction, aborting');
        return;
      }
      
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
                  if (typeof CaseDataStore !== 'undefined') {
                    await CaseDataStore.setCurrentData(data, 'CasePageDataExtractor');
                  }
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

      if (typeof CaseDataStore !== 'undefined') {
        await CaseDataStore.setCurrentData(data, 'CasePageDataExtractor');
      }

      // Trigger custom event for other modules to consume (only if validated)
      await this.dispatchDataExtractedEvent(data);
    } catch (error) {
      console.error('[CasePageDataExtractor] Error during extraction:', error);
    } finally {
      if (this.currentExtractionToken === extractionToken) {
        this.isExtracting = false;
        this.currentExtractionToken = null;
      }
      console.log('[CasePageDataExtractor] Extraction complete for case:', caseId);
    }
  },

  /**
   * Wait for visible page elements to be present
   * Checks for visible elements to ensure we wait for actual page content, not hidden/cached DOM nodes
   * @returns {Promise<void>}
   */
  waitForPageLoad(token = null) {
    return new Promise((resolve) => {
      const maxAttempts = 20;
      let attempts = 0;

      const checkElements = () => {
        if (token && !this.isTokenActive(token)) {
          resolve();
          return;
        }

        attempts++;
        
        // Check for visible record layout items
        let hasVisibleRecordLayout = false;
        const recordLayoutCandidates = document.querySelectorAll('records-record-layout-item');
        if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
          hasVisibleRecordLayout = CaseDomUtils.getFirstVisibleElement(recordLayoutCandidates) !== null;
        } else if (recordLayoutCandidates.length > 0) {
          // Fallback: if CaseDomUtils not available, check first candidate
          hasVisibleRecordLayout = recordLayoutCandidates.length > 0;
        }
        
        // Check for visible flexipage fields
        let hasVisibleFlexipageField = false;
        const flexipageCandidates = document.querySelectorAll('flexipage-field');
        if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
          hasVisibleFlexipageField = CaseDomUtils.getFirstVisibleElement(flexipageCandidates) !== null;
        } else if (flexipageCandidates.length > 0) {
          // Fallback: if CaseDomUtils not available, check first candidate
          hasVisibleFlexipageField = flexipageCandidates.length > 0;
        }

        if (hasVisibleRecordLayout || hasVisibleFlexipageField || attempts >= maxAttempts) {
          if (hasVisibleRecordLayout || hasVisibleFlexipageField) {
            console.log('[CasePageDataExtractor] Visible page elements ready (attempt ' + attempts + ')');
          } else {
            console.log('[CasePageDataExtractor] Max attempts reached, proceeding anyway (attempt ' + attempts + ')');
          }
          resolve();
        } else {
          setTimeout(checkElements, 200);
        }
      };

      checkElements();
    });
  },

  /**
   * Checks if the provided extraction token is still active
   * @param {symbol} token
   * @returns {boolean}
   */
  isTokenActive(token) {
    return Boolean(token && this.currentExtractionToken === token);
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
   * Normalize API data to match existing case data structure
   * Maps API field names to the structure expected by other modules
   * @param {Object} apiData - Flattened API field map from FetchInterceptor
   * @param {string} caseId - Current case ID
   * @returns {Object} - Normalized case data matching extractAllCaseDataFromDOM structure
   */
  normalizeApiData(apiData, caseId) {
    console.log('[CasePageDataExtractor] Normalizing API data, field count:', Object.keys(apiData).length);
    
    const data = {
      // Basic case info
      caseId: caseId,
      caseNumber: apiData.CaseNumber || null,
      subject: apiData.Subject || null,
      description: apiData.Description || null,

      // Contact and Account (from nested lookups)
      accountName: apiData['Account.Name'] || null,
      contactName: apiData['Contact.Name'] || null,

      // Product/Service Information
      platformService: apiData.PQ_Product_Group__c || apiData.Platform__c || null,
      productServiceName: apiData['Product_Service_Name__c'] || null,

      // Case categorization
      category: apiData.Category__c || null,
      subCategory: apiData.Sub_Category__c || null,
      status: apiData.Status || null,
      subStatus: apiData.Sub_Status__c || null,

      // Customer data
      exLibrisAccountNumber: apiData.Ex_Libris_Account_Number__c || null,
      analysisNote: apiData.Analysis_Note__c || null,

      // Additional fields from API
      asset: apiData.Asset_Line_Item__c || null,
      affectedEnvironment: apiData.bl_Affected_Environment__c || null,
      caseOwner: apiData['Owner.Name'] || null,
      parentCase: apiData['Parent.CaseNumber'] || null,
      parentCaseOwner: apiData.Parent_Case_Owner__c || null,

      // Additional metadata
      escalation: apiData.Escalation__c || null,
      caseCreatedDate: apiData.CreatedDate || null,
      caseClosedOn: apiData.ClosedDate || null,
      customerExLibrisAccountNumber: apiData.Ex_Libris_Account_Number__c || null,
      pageStatus: apiData.Status || null,

      // Timestamp
      extractedAt: new Date().toISOString(),
      lastModifiedDate: apiData.LastModifiedDate || null,
      
      // Metadata
      dataSource: 'API' // Mark data source for debugging
    };

    // Enrich with customer data from CustomerDataManager
    if (typeof CustomerDataManager !== 'undefined' && data.exLibrisAccountNumber) {
      const customerInfo = CustomerDataManager.findByInstitutionCode(
        data.exLibrisAccountNumber,
        data.accountName
      );
      
      if (customerInfo) {
        data.custID = customerInfo.custID;
        data.instID = customerInfo.instID;
        data.server = customerInfo.server;
        console.log('[CasePageDataExtractor] API data enriched with customer info:', customerInfo.name);
      }
    }

    console.log('[CasePageDataExtractor] Normalized API data:', {
      caseNumber: data.caseNumber,
      subject: data.subject?.substring(0, 50),
      fieldsPopulated: Object.values(data).filter(v => v !== null).length
    });

    return data;
  },

  /**
   * Extract all case data fields
   * Primary method that checks API data first, then falls back to DOM extraction
   * @param {Object} contextSnapshot - Optional context snapshot
   * @returns {Object} - Extracted case data
   */
  async extractAllCaseData(contextSnapshot = null) {
    const snapshot = contextSnapshot || (typeof CaseContextWatcher !== 'undefined'
      ? CaseContextWatcher.getCurrentContext?.()
      : null);
    const contextCaseId = snapshot?.caseId || this.currentCaseId;
    const contextCaseNumber = snapshot?.caseNumber || null;

    // PRIORITY 1: Try API data first (from FetchInterceptor)
    if (window.ExLibrisExtension?.apiCaseData) {
      const apiData = window.ExLibrisExtension.apiCaseData;
      const apiTimestamp = window.ExLibrisExtension.apiCaseDataTimestamp;
      
      // Check if data is fresh (within last 5 seconds)
      const age = Date.now() - (apiTimestamp || 0);
      if (age < 5000) {
        // Verify API data matches current case
        if (apiData.CaseNumber === contextCaseNumber || !contextCaseNumber) {
          console.log('[CasePageDataExtractor] Using fresh API data (age: ${age}ms)');
          return this.normalizeApiData(apiData, contextCaseId);
        } else {
          console.warn('[CasePageDataExtractor] API data case number mismatch, falling back to DOM', {
            apiCaseNumber: apiData.CaseNumber,
            contextCaseNumber
          });
        }
      } else {
        console.log('[CasePageDataExtractor] API data too old (age: ${age}ms), falling back to DOM');
      }
    }

    // PRIORITY 2: Fallback to DOM extraction
    console.log('[CasePageDataExtractor] Extracting data from DOM');
    return await this.extractAllCaseDataFromDOM(contextSnapshot);
  },

  /**
   * Extract all case data fields from DOM
   * Original DOM-based extraction method (now used as fallback)
   * @param {Object} contextSnapshot - Optional context snapshot
   * @returns {Object} - Extracted case data
   */
  async extractAllCaseDataFromDOM(contextSnapshot = null) {
    const snapshot = contextSnapshot || (typeof CaseContextWatcher !== 'undefined'
      ? CaseContextWatcher.getCurrentContext?.()
      : null);
    const contextCaseId = snapshot?.caseId || this.currentCaseId;
    const contextCaseNumber = snapshot?.caseNumber || null;

    const data = {
      // Basic case info
      caseId: contextCaseId,
      caseNumber: contextCaseNumber || this.getCaseNumber(),
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
      extractedAt: new Date().toISOString(),
      
      // Last Modified Date for cache validation
      lastModifiedDate: this.getLastModifiedDate()
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
    if (typeof CaseDomUtils !== 'undefined') {
      const visibleNumber = CaseDomUtils.getVisibleCaseNumber();
      if (visibleNumber) {
        return visibleNumber;
      }
    }

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
    if (typeof CaseDomUtils !== 'undefined') {
      const visibleSubject = CaseDomUtils.getVisibleCaseSubject();
      if (visibleSubject) {
        return visibleSubject;
      }
    }

    const header = this.getHeaderText();
    if (!header) return null;
    const parts = header.split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ').trim() : null;
  },

  /**
   * Get combined header text (case number + subject)
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
   * Get description field content
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
   * Always reselects visible elements fresh on each call
   * @param {string} label - Field label to search for
   * @returns {string|null}
   */
  getRecordLayoutField(label) {
    // Get all candidates and filter by visibility
    const candidates = document.querySelectorAll(`records-record-layout-item[field-label="${label}"]`);
    let layoutItem = null;
    
    // Check visibility of direct matches first
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      layoutItem = CaseDomUtils.getFirstVisibleElement(candidates);
    }
    
    // If no visible direct match, try shadow DOM traversal
    if (!layoutItem) {
      const shadowCandidates = [];
      candidates.forEach((candidate) => {
        const shadowMatch = this.queryShadowDOM(`records-record-layout-item[field-label="${label}"]`, candidate);
        if (shadowMatch) {
          shadowCandidates.push(shadowMatch);
        }
      });
      if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
        layoutItem = CaseDomUtils.getFirstVisibleElement(shadowCandidates);
      } else if (shadowCandidates.length > 0) {
        layoutItem = shadowCandidates[0];
      }
    }
    
    // If still not found, try partial match
    if (!layoutItem) {
      const partialCandidates = document.querySelectorAll(`records-record-layout-item[field-label*="${label}"]`);
      if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
        layoutItem = CaseDomUtils.getFirstVisibleElement(partialCandidates);
      } else if (partialCandidates.length > 0) {
        layoutItem = partialCandidates[0];
      }
      
      // Try shadow DOM for partial match
      if (!layoutItem) {
        const shadowPartialCandidates = [];
        partialCandidates.forEach((candidate) => {
          const shadowMatch = this.queryShadowDOM(`records-record-layout-item[field-label*="${label}"]`, candidate);
          if (shadowMatch) {
            shadowPartialCandidates.push(shadowMatch);
          }
        });
        if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
          layoutItem = CaseDomUtils.getFirstVisibleElement(shadowPartialCandidates);
        } else if (shadowPartialCandidates.length > 0) {
          layoutItem = shadowPartialCandidates[0];
        }
      }
    }
    
    if (!layoutItem) {
      console.warn(`[CasePageDataExtractor] Could not find visible layout item for label: "${label}"`);
      return null;
    }

    const value = this.extractRecordLayoutValue(layoutItem);
    console.log(`[CasePageDataExtractor] Extracted "${label}" from visible element:`, value);
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
    
    // Skip extraction if layout item is not visible
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      if (!CaseDomUtils.isElementVisible(layoutItem)) {
        console.warn('[CasePageDataExtractor] Skipping extraction from non-visible layout item');
        return null;
      }
    }

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
   * Always reselects visible elements fresh on each call
   * Prefers fields within visible tab container
   * @param {string} fieldId - The data-field-id value
   * @param {boolean} isAnchored - Whether the field contains anchor elements (lookup fields)
   * @returns {string|null}
   */
  getFlexipageField(fieldId, isAnchored = false) {
    // Get all candidates
    const candidates = document.querySelectorAll(`flexipage-field[data-field-id="${fieldId}"]`);
    let field = null;
    
    // Prefer fields within visible tab container
    const visibleTabContainer = document.querySelector('section.tabContent.active .forcegenerated-record-layout2[style*="display: block"]');
    const visibleTabRoot = visibleTabContainer || document.body;
    
    // First, try to find visible field within active tab
    if (visibleTabContainer) {
      const tabCandidates = visibleTabContainer.querySelectorAll(`flexipage-field[data-field-id="${fieldId}"]`);
      if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
        field = CaseDomUtils.getFirstVisibleElement(tabCandidates);
      } else if (tabCandidates.length > 0) {
        field = tabCandidates[0];
      }
    }
    
    // If not found in visible tab, check all candidates for visibility
    if (!field) {
      if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
        field = CaseDomUtils.getFirstVisibleElement(candidates);
      } else if (candidates.length > 0) {
        field = candidates[0];
      }
    }
    
    // If still not found, try shadow DOM traversal
    if (!field) {
      const shadowCandidates = [];
      candidates.forEach((candidate) => {
        const shadowMatch = this.queryShadowDOM(`flexipage-field[data-field-id="${fieldId}"]`, candidate);
        if (shadowMatch) {
          shadowCandidates.push(shadowMatch);
        }
      });
      if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
        field = CaseDomUtils.getFirstVisibleElement(shadowCandidates);
      } else if (shadowCandidates.length > 0) {
        field = shadowCandidates[0];
      }
    }
    
    if (!field) {
      console.warn(`[CasePageDataExtractor] Could not find visible flexipage-field with data-field-id: "${fieldId}"`);
      return null;
    }
    
    // Double-check visibility of the selected field
    if (typeof CaseDomUtils !== 'undefined' && CaseDomUtils.isElementVisible) {
      if (!CaseDomUtils.isElementVisible(field)) {
        console.warn(`[CasePageDataExtractor] Selected flexipage-field "${fieldId}" is not visible`);
        return null;
      }
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
  cleanup(reason = 'manual') {
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
    this.currentExtractionToken = null;

    if (typeof CaseDataStore !== 'undefined') {
      CaseDataStore.clear(`casepage-cleanup:${reason}`);
    }
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
   * @param {boolean} force - If true, bypass cache and force re-extraction
   * @returns {Promise<Object|null>}
   */
  async extractNow(force = false) {
    if (!this.currentCaseId) {
      console.warn('[CasePageDataExtractor] No case page currently loaded');
      return null;
    }

    if (force) {
      console.log('[CasePageDataExtractor] Force extraction triggered for case:', this.currentCaseId);
      this.lastExtractedData = null; // Clear cache
    } else {
      console.log('[CasePageDataExtractor] Manual extraction triggered for case:', this.currentCaseId);
    }

    await this.waitForPageLoad();
    const data = await this.extractAllCaseData();
    this.lastExtractedData = data;
    await this.dispatchDataExtractedEvent(data);
    return data;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CasePageDataExtractor;
}
