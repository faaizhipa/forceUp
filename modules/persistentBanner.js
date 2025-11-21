/**
 * PersistentBanner Module
 * Displays a persistent banner across all Salesforce pages showing:
 * - Current page type
 * - Primary case metadata (for case pages)
 * - Navigation history (last 3 pages)
 * - Action buttons
 */

const PersistentBanner = {
    isInitialized: false,
    bannerId: 'exl-persistent-banner',
    elements: {},

    // Navigation history queue (max 3 items)
    navigationHistory: [],
    maxHistoryItems: 3,

    // Current case tracking (to detect navigation to different case)
    currentCaseId: null,

    // Displayed case tracking (for stale data prevention)
    displayedCaseId: null,
    displayedCaseNumber: null,
    validationInterval: null,

    // Message rotation state
    messageRotationInterval: null,
    currentMessageIndex: 0,
    activeMessages: [],
    messageSettings: null,
    messagesReady: false,
    messageLoadPromise: null,
    messagesFeatureEnabled: false,
    messageSectionMinWidth: 220,

    // Cleanup tracking
    trackedListeners: [],  // Array of {element, event, handler} objects
    trackedObservers: [],  // Array of MutationObserver instances
    trackedTimers: [],    // Array of {type: 'interval'|'timeout', id} objects

    // Hover image state
    hoverImagePopup: null,
    hoverImageTimeout: null,

    // Context menu state
    contextMenu: null,
    contextMenuMessageId: null,

    // Modal state
    editModal: null,
    viewImageModal: null,

    // Collapsible section state (for case pages)
    showMessagesOnCasePage: false,  // Toggle state

    // Current page info
    currentPage: {
        type: 'Unknown',
        caseNumber: null,
        subject: null,
        status: null,
        subStatus: null,
        issue: null
    },

    // Customer metadata from CasePageDataExtractor
    customerMetadata: {
        customerId: null,
        institutionId: null,
        server: null,
        productServiceName: null,
        institutionCode: null
    },

    sectionCollapsedHeight: 48, // 3rem
    sectionOverflowRaf: null,
    updateSectionOverflowStatesBound: null,
    isTightLayout: true, // Start collapsed by default
    bannerHoverActive: false,

    // URL monitoring
    lastKnownUrl: null,
    urlChangeDebounceTimer: null, // Timer for debouncing URL change handling

    // Environment menu state
    envMenuVisible: false,

    // Case data polling state
    caseDataPollTimer: null,
    caseDataPollAttempts: 0,
    CASE_DATA_POLL_INTERVAL_MS: 4000,

    // Exponential backoff debouncing state
    debounceState: {
        // Track per-operation: { failureCount: number, lastFailureTime: number, lastSuccessTime: number }
        operations: new Map()
    },
    baseDebounceDelay: 100, // Base delay in ms
    maxDebounceDelay: 5000, // Maximum delay cap

    // Status color mapping (based on caseStatusHighlighter)
    STATUS_COLORS: {
        // Red statuses (match content_script.js)
        'New Email Received': { base: 'rgb(191, 39, 75)', category: 'red' },
        'Re-opened': { base: 'rgb(191, 39, 75)', category: 'red' },
        'Reopened': { base: 'rgb(191, 39, 75)', category: 'red' },
        'Completed by Resolver Group': { base: 'rgb(191, 39, 75)', category: 'red' },
        'New': { base: 'rgb(191, 39, 75)', category: 'red' },
        'Update Received': { base: 'rgb(191, 39, 75)', category: 'red' },

        // Orange statuses
        'Pending Action': { base: 'rgb(247, 114, 56)', category: 'orange' },
        'Initial Response Sent': { base: 'rgb(247, 114, 56)', category: 'orange' },
        'In Progress': { base: 'rgb(247, 114, 56)', category: 'orange' },

        // Purple statuses
        'Assigned to Resolver Group': { base: 'rgb(140, 77, 253)', category: 'purple' },
        'Pending Internal Response': { base: 'rgb(140, 77, 253)', category: 'purple' },
        'Pending AM Response': { base: 'rgb(140, 77, 253)', category: 'purple' },
        'Pending QA Review': { base: 'rgb(140, 77, 253)', category: 'purple' },

        // Green statuses
        'Solution Delivered to Customer': { base: 'rgb(45, 200, 64)', category: 'green' },

        // Gray statuses
        'Closed': { base: 'rgb(103, 103, 103)', category: 'gray' },
        'Pending Customer Response': { base: 'rgb(103, 103, 103)', category: 'gray' },

        // Yellow statuses
        'Pending System Update - Defect': { base: 'rgb(251, 178, 22)', category: 'yellow' },
        'Pending System Update - Enhancement': { base: 'rgb(251, 178, 22)', category: 'yellow' },
        'Pending System Update - Other': { base: 'rgb(251, 178, 22)', category: 'yellow' }
    },

    // Default banner gradient (for non-case pages)
    DEFAULT_GRADIENT: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',


    /**
     * Initialize the persistent banner
     */
    async init() {
        if (this.isInitialized) {
            console.log('[PersistentBanner] Already initialized');
            return;
        }

        // Check if feature is enabled in settings
        const isEnabled = await this.isFeatureEnabled();
        if (!isEnabled) {
            console.log('[PersistentBanner] Feature is disabled in settings');
            return;
        }

        console.log('[PersistentBanner] Initializing...');

        // Load navigation history from sessionStorage
        this.loadNavigationHistory();

        // Create and inject banner
        this.createBanner();
        
        // Set banner to collapsed by default
        if (this.elements.banner) {
            this.elements.banner.classList.add('exl-banner-tight');
        }
        
        this.updateSectionOverflowStatesBound = this.updateSectionOverflowStates.bind(this);
        this.trackListener(window, 'resize', this.updateSectionOverflowStatesBound);

        // Observe DOM for the right injection point
        this.observeForInjection();

        // Start URL monitoring to detect navigation changes
        this.startUrlMonitoring();

        // Listen for CasePageDataExtractor events
        this.setupCaseDataListener();

        // Listen for settings changes
        this.setupSettingsListener();

        // Start periodic validation for stale data prevention
        this.startPeriodicValidation();

        // Load messages for rotation
        await this.loadMessages();

        // Check initial state - if on case page, check extraction status
        this.checkInitialState();

        this.isInitialized = true;
        console.log('[PersistentBanner] Initialized');
    },

    /**
     * Check initial state when banner loads
     * If on case page, check extraction state and show appropriate content
     */
    checkInitialState() {
        const pageType = this.currentPage.type;
        const isCasePage = pageType === 'case_page';

        if (isCasePage) {
            const extractionState = this.isCaseDataExtractionComplete();
            console.log('[PersistentBanner] Initial state check - extraction state:', extractionState);

            // If extraction is complete, update UI immediately
            if (extractionState.complete && extractionState.hasData) {
                // Get the extracted data and update banner
                if (typeof CasePageDataExtractor !== 'undefined' && CasePageDataExtractor.lastExtractedData) {
                    const data = CasePageDataExtractor.lastExtractedData;
                    // Trigger update as if we received the event
                    const event = new CustomEvent('casePageDataExtracted', { detail: data });
                    document.dispatchEvent(event);
                }
            }
        }
    },

    /**
     * Start periodic validation to prevent stale data display
     * Checks every 2 seconds if displayed data is still valid
     */
    startPeriodicValidation() {
        // Clear any existing interval
        if (this.validationInterval) {
            clearInterval(this.validationInterval);
        }

        // Check every 2 seconds if displayed data is still valid
        // Only clear if case ID mismatches (case number mismatch might be timing issue)
        this.validationInterval = setInterval(async () => {
            if (this.displayedCaseId || this.displayedCaseNumber) {
                if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.validatePageContextBeforeDisplay === 'function') {
                    let validation = PageContextValidator.validatePageContextBeforeDisplay(
                        this.displayedCaseId,
                        this.displayedCaseNumber,
                        false // Don't wait for title update in periodic validation
                    );

                    // Handle async validation (shouldn't happen with waitForTitle=false, but just in case)
                    if (validation instanceof Promise) {
                        validation = await validation;
                    }

                    if (!validation.valid) {
                        // Only clear if case ID also mismatches (case number mismatch alone might be timing issue)
                        if (validation.currentContext && this.displayedCaseId && this.displayedCaseId !== validation.currentContext.caseId) {
                            console.warn('[PersistentBanner] Periodic validation failed - case ID mismatch, clearing display');
                            this.clearCaseData();
                            // Update UI to show cleared state
                            this.updateBannerUI();
                        } else {
                            // Case number mismatch but case ID matches - likely timing issue, log but don't clear
                            console.log('[PersistentBanner] Periodic validation: case number mismatch but case ID matches (likely timing issue)');
                        }
                    }
                }
            }
        }, 2000);

        console.log('[PersistentBanner] Periodic validation started');
    },

    /**
     * Stop periodic validation
     */
    stopPeriodicValidation() {
        if (this.validationInterval) {
            clearInterval(this.validationInterval);
            this.validationInterval = null;
            console.log('[PersistentBanner] Periodic validation stopped');
        }
    },

    /**
     * Check if persistent banner feature is enabled in settings
     * Uses SettingsManager if available, otherwise checks storage directly with consistent logic
     */
    async isFeatureEnabled() {
        // Try SettingsManager first (preferred method)
        if (typeof SettingsManager !== 'undefined') {
            return SettingsManager.isFeatureEnabled('persistentBanner');
        }

        // Fallback to direct storage check with consistent logic
        return new Promise((resolve) => {
            chrome.storage.sync.get(['exlibris'], (result) => {
                // Consistent check: !== false (undefined/true = enabled, false = disabled)
                const enabled = result.exlibris?.features?.persistentBanner !== false;
                resolve(enabled);
            });
        });
    },

    /**
     * Setup listener for settings changes
     */
    setupSettingsListener() {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync' && changes.exlibris) {
                // Check persistent banner feature toggle
                const newEnabled = changes.exlibris.newValue?.features?.persistentBanner !== false;
                const oldEnabled = changes.exlibris.oldValue?.features?.persistentBanner !== false;

                if (newEnabled !== oldEnabled) {
                    console.log('[PersistentBanner] Feature toggle changed:', newEnabled);
                    if (newEnabled) {
                        this.show();
                    } else {
                        this.hide();
                    }
                }

                // Check banner messages feature toggle
                const newMessagesEnabled = changes.exlibris.newValue?.features?.bannerMessages !== false;
                const oldMessagesEnabled = changes.exlibris.oldValue?.features?.bannerMessages !== false;

                if (newMessagesEnabled !== oldMessagesEnabled) {
                    console.log('[PersistentBanner] Banner messages feature toggle changed:', newMessagesEnabled);
                    // Reload messages and update display
                    this.loadMessages().then(() => {
                        this.updateBannerUI();
                    });
                }

                // Check message settings changes
                const newMessages = changes.exlibris.newValue?.persistentBanner?.messages;
                const oldMessages = changes.exlibris.oldValue?.persistentBanner?.messages;

                if (newMessages && JSON.stringify(newMessages) !== JSON.stringify(oldMessages)) {
                    console.log('[PersistentBanner] Message settings changed, reloading...');
                    // Reload messages and restart rotation
                    this.loadMessages().then(() => {
                        this.updateBannerUI();
                    });
                }
            }
        });
    },

    /**
     * Show the banner
     */
    show() {
        const banner = document.getElementById(this.bannerId);
        if (banner) {
            banner.style.display = 'block';
            // Restore Salesforce layout adjustments
            this.applySalesforceLayoutAdjustments(true);
            console.log('[PersistentBanner] Shown');
        } else if (!this.isInitialized) {
            // Re-initialize if banner doesn't exist
            this.init();
        }
    },

    /**
     * Hide the banner
     */
    hide() {
        const banner = document.getElementById(this.bannerId);
        if (banner) {
            banner.style.display = 'none';
            // Remove Salesforce layout adjustments
            this.applySalesforceLayoutAdjustments(false);
            console.log('[PersistentBanner] Hidden');
        }
    },

    /**
     * Apply or remove Salesforce layout adjustments
     * @param {boolean} apply - True to apply, false to remove
     */
    applySalesforceLayoutAdjustments(apply) {
        const globalHeader = document.querySelector('#oneHeader > div.slds-global-header.slds-grid.slds-grid_align-spread');
        const tabBar = document.querySelector('body > div.desktop.container.forceStyle.oneOne.navexDesktopLayoutContainer.lafAppLayoutHost.forceAccess > div.viewport > section > div.workspaceManager.navexWorkspaceManager > div > div.tabsetHeader.slds-context-bar.slds-context-bar--tabs.slds-no-print');
        const toolbars = document.querySelectorAll('div.toolbar.top.fadeOut.forceContentBasePreviewToolbar.forceContentPreviewPlayerTopToolbar, div.toolbar.top.forceContentBasePreviewToolbar.forceContentPreviewPlayerTopToolbar');

        if (apply) {
            if (globalHeader) globalHeader.style.marginTop = '45px';
            if (tabBar) tabBar.style.top = '95px';
            toolbars.forEach(toolbar => toolbar.style.top = '45px');
        } else {
            if (globalHeader) globalHeader.style.marginTop = '';
            if (tabBar) tabBar.style.top = '';
            toolbars.forEach(toolbar => toolbar.style.top = '');
        }
    },

    /**
     * Setup listener for CasePageDataExtractor events
     */
    setupCaseDataListener() {
        // Track when we last received data for fallback mechanism
        this.lastDataReceivedTime = null;
        this.dataReceptionTimeout = null;

        document.addEventListener('casePageDataExtracted', async (event) => {
            const data = event.detail;
            console.log('[PersistentBanner] Received case page data from CasePageDataExtractor:', data);

            // Clear any pending fallback timeout
            if (this.dataReceptionTimeout) {
                clearTimeout(this.dataReceptionTimeout);
                this.dataReceptionTimeout = null;
            }

            // Update last data received time
            this.lastDataReceivedTime = Date.now();

            // GUARDRAIL: Validate data before displaying using shared validation function
            if (typeof PageContextValidator !== 'undefined' &&
                typeof PageContextValidator.validateExtractedData === 'function') {
                try {
                    const validatedData = await PageContextValidator.validateExtractedData(data, {
                        waitForTitle: true, // Wait for title update during display (SPA navigation timing)
                        requireCaseId: true,
                        requireCaseNumber: false
                    });

                    if (!validatedData) {
                        console.warn(`[PersistentBanner] Cannot display data: validation failed - case mismatch detected`);
                        // Clear stale data if validation fails
                        this.clearCaseData();

                        // CRITICAL: Trigger fresh data extraction when case mismatch is detected
                        // If data was extracted using selectors from the page, case ID and case number should match.
                        // A mismatch indicates stale data that needs to be re-extracted.
                        if (typeof CasePageDataExtractor !== 'undefined' &&
                            typeof CasePageDataExtractor.extractNow === 'function') {
                            console.log('[PersistentBanner] Triggering fresh data extraction due to case mismatch...');
                            try {
                                // Force fresh extraction (bypass cache)
                                const freshData = await CasePageDataExtractor.extractNow(true);
                                if (freshData) {
                                    console.log('[PersistentBanner] Fresh data extracted successfully:', freshData.caseNumber);
                                    // The extractNow() method will dispatch a new event, which will trigger this listener again
                                    // with the fresh data, so we don't need to process it here
                                } else {
                                    console.warn('[PersistentBanner] Fresh extraction returned no data');
                                }
                            } catch (extractError) {
                                console.error('[PersistentBanner] Error during fresh extraction:', extractError);
                            }
                        } else {
                            console.warn('[PersistentBanner] Cannot trigger fresh extraction - CasePageDataExtractor not available');
                        }

                        return;
                    }

                    // Use validated data (ensures caseId and caseNumber match current page)
                    // Update data with validated values
                    data.caseId = validatedData.caseId || data.caseId;
                    data.caseNumber = validatedData.caseNumber || data.caseNumber;
                    console.log('[PersistentBanner] Data validated successfully');
                } catch (error) {
                    console.error('[PersistentBanner] Error during validation:', error);
                    // On validation error, clear data to prevent stale display
                    this.clearCaseData();

                    // Trigger fresh extraction on validation error as well
                    if (typeof CasePageDataExtractor !== 'undefined' &&
                        typeof CasePageDataExtractor.extractNow === 'function') {
                        console.log('[PersistentBanner] Triggering fresh data extraction due to validation error...');
                        try {
                            await CasePageDataExtractor.extractNow(true);
                        } catch (extractError) {
                            console.error('[PersistentBanner] Error during fresh extraction:', extractError);
                        }
                    }

                    return;
                }
            } else {
                // Fallback: Use old validation method if new function not available
                if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.validatePageContextBeforeDisplay === 'function') {
                    try {
                        let validation = PageContextValidator.validatePageContextBeforeDisplay(data.caseId, data.caseNumber);

                        // Handle async validation (when waiting for title update)
                        if (validation instanceof Promise) {
                            validation = await validation;
                        }

                        if (!validation.valid) {
                            console.warn(`[PersistentBanner] Cannot display data: ${validation.reason}`);
                            // Only clear if case ID also mismatches (case number mismatch might be timing issue)
                            if (validation.currentContext && data.caseId !== validation.currentContext.caseId) {
                                console.warn(`[PersistentBanner] Case ID mismatch detected: data=${data.caseId}, current=${validation.currentContext.caseId}`);
                                this.clearCaseData();

                                // CRITICAL: Trigger fresh data extraction when case ID mismatch is detected
                                // If data was extracted using selectors from the page, case ID and case number should match.
                                // A mismatch indicates stale data that needs to be re-extracted.
                                if (typeof CasePageDataExtractor !== 'undefined' &&
                                    typeof CasePageDataExtractor.extractNow === 'function') {
                                    console.log('[PersistentBanner] Triggering fresh data extraction due to case ID mismatch...');
                                    try {
                                        // Force fresh extraction (bypass cache)
                                        const freshData = await CasePageDataExtractor.extractNow(true);
                                        if (freshData) {
                                            console.log('[PersistentBanner] Fresh data extracted successfully:', freshData.caseNumber);
                                            // The extractNow() method will dispatch a new event, which will trigger this listener again
                                            // with the fresh data, so we don't need to process it here
                                        } else {
                                            console.warn('[PersistentBanner] Fresh extraction returned no data');
                                        }
                                    } catch (extractError) {
                                        console.error('[PersistentBanner] Error during fresh extraction:', extractError);
                                    }
                                } else {
                                    console.warn('[PersistentBanner] Cannot trigger fresh extraction - CasePageDataExtractor not available');
                                }
                            }
                            return;
                        }
                    } catch (error) {
                        console.error('[PersistentBanner] Error during validation:', error);
                        // On validation error, still try to display data (graceful degradation)
                        // But log the error for debugging
                    }
                }
            }

            // Extract case ID from the data
            const newCaseId = data.caseNumber || null;

            // Check if we've navigated to a different case
            if (this.currentCaseId && newCaseId && this.currentCaseId !== newCaseId) {
                console.log(`[PersistentBanner] Navigated from case ${this.currentCaseId} to ${newCaseId}, clearing old data...`);
                this.clearCaseData();
            }

            // Update current case ID
            this.currentCaseId = newCaseId;
            this.displayedCaseId = data.caseId || null;
            this.displayedCaseNumber = data.caseNumber || null;

            // Update customer metadata from extracted data
            // CasePageDataExtractor now enriches data with custID, instID, server from CustomerDataManager
            this.customerMetadata = {
                customerId: data.custID || null,  // 4-digit customer ID
                institutionId: data.instID || null,  // 4-digit institution ID
                server: data.server || null,  // Server code (ap02, na05, etc.)
                productServiceName: data.platformService || null,  // Platform/Service with fallback
                institutionCode: data.institutionCode || null  // Institution code (61USC_INST, etc.)
            };

            console.log('[PersistentBanner] Updated customer metadata:', this.customerMetadata);

            // Refresh current page summary details
            this.currentPage.caseNumber = data.caseNumber || this.currentPage.caseNumber || null;
            this.currentPage.subject = data.subject || this.currentPage.subject || null;
            this.currentPage.status = data.status || this.currentPage.status || null;
            this.currentPage.subStatus = data.subStatus || this.currentPage.subStatus || null;
            if (data.description) {
                this.currentPage.issue = data.description;
            } else if (data.issue) {
                this.currentPage.issue = data.issue;
            } else if (!this.currentPage.issue && data.subject) {
                this.currentPage.issue = data.subject;
            }

            // Update current page status from direct page data (for gradient coloring)
            if (data.pageStatus) {
                this.currentPage.status = data.pageStatus;
                console.log('[PersistentBanner] Updated status from page data:', data.pageStatus);
            }

            // Explicitly stop message rotation and hide messages when case data arrives
            this.stopMessageRotation();
            if (this.elements.messagesSection) {
                this.elements.messagesSection.style.display = 'none';
            }

            // Update banner UI with new metadata and status
            this.updateBannerUI();
        });

        // Set up fallback mechanism: if no data received within 3 seconds after page change, trigger manual extraction
        this.setupDataReceptionFallback();

        console.log('[PersistentBanner] CasePageDataExtractor listener registered');
    },

    /**
     * Setup fallback mechanism to trigger manual extraction if no data received
     */
    setupDataReceptionFallback() {
        // Monitor for page changes and set timeout
        if (typeof NavigationObserver !== 'undefined') {
            NavigationObserver.onRouteChange(() => {
                // Clear existing timeout
                if (this.dataReceptionTimeout) {
                    clearTimeout(this.dataReceptionTimeout);
                }

                // Reset last data received time
                this.lastDataReceivedTime = null;

                // Set timeout: if no data received within 3 seconds, trigger manual extraction
                this.dataReceptionTimeout = setTimeout(() => {
                    if (!this.lastDataReceivedTime || (Date.now() - this.lastDataReceivedTime) > 3000) {
                        console.warn('[PersistentBanner] No case data received within 3 seconds. Triggering manual extraction...');
                        this.triggerManualExtraction();
                    }
                }, 3000);
            });
        }
    },

    /**
     * Trigger manual case data extraction as fallback
     */
    triggerManualExtraction() {
        const caseId = this.getCaseIdFromUrl();
        if (caseId && typeof CasePageDataExtractor !== 'undefined' && typeof CasePageDataExtractor.extractNow === 'function') {
            console.log('[PersistentBanner] Triggering manual extraction for case:', caseId);
            CasePageDataExtractor.extractNow(caseId);
        } else {
            console.warn('[PersistentBanner] Cannot trigger manual extraction - CasePageDataExtractor not available');
        }
    },

    /**
     * Extract server code from affected environment
     * @param {string} affectedEnvironment - e.g., "NA05", "EU01"
     * @returns {string|null}
     */
    extractServerFromAffectedEnvironment(affectedEnvironment) {
        if (!affectedEnvironment) return null;

        // Match patterns like NA05, EU01, AP02, CN01, CA01
        const match = affectedEnvironment.match(/(NA|EU|AP|CN|CA)\d{2}/i);
        return match ? match[0].toLowerCase() : null;
    },

    /**
     * Extract institution code from affected environment or other sources
     * @param {string} affectedEnvironment
     * @returns {string|null}
     */
    extractInstitutionCode(affectedEnvironment) {
        // This is a placeholder - institution code would come from other fields
        // For now, return null and rely on other extraction methods
        return null;
    },

    /**
     * Extract case ID from current URL
     * @returns {string|null}
     */
    getCaseIdFromUrl() {
        const match = window.location.pathname.match(/\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})/);
        return match ? match[1] : null;
    },

    /**
     * Start monitoring URL changes using NavigationObserver
     */
    startUrlMonitoring() {
        this.lastKnownUrl = window.location.href;

        // Use NavigationObserver for immediate URL change detection
        if (typeof NavigationObserver !== 'undefined') {
            NavigationObserver.onRouteChange((newUrl) => {
                if (newUrl !== this.lastKnownUrl) {
                    console.log('[PersistentBanner] URL changed:', newUrl);
                    this.lastKnownUrl = newUrl;

                    // Debounce handleUrlChange by 10ms
                    if (this.urlChangeDebounceTimer) {
                        clearTimeout(this.urlChangeDebounceTimer);
                        this.urlChangeDebounceTimer = null;
                    }

                    this.urlChangeDebounceTimer = setTimeout(() => {
                        this.handleUrlChange(newUrl);
                        this.urlChangeDebounceTimer = null;
                    }, 10);
                }
            });
            console.log('[PersistentBanner] URL monitoring started (using NavigationObserver)');
        } else {
            console.warn('[PersistentBanner] NavigationObserver not available');
        }
    },

    /**
     * Stop monitoring URL changes (kept for compatibility)
     */
    stopUrlMonitoring() {
        // No-op: NavigationObserver doesn't need explicit stopping
        // Kept for API compatibility
        console.log('[PersistentBanner] URL monitoring stopped');
    },

    /**
     * Handle URL change - reset current page data
     * @param {string} newUrl
     */
    handleUrlChange(newUrl) {
        console.log('[PersistentBanner] Handling URL change, resetting current page data');

        // Detect case ID change and clear cache for old case ID
        const oldCaseId = this.currentCaseId;
        const newCaseId = this.getCaseIdFromUrl();

        if (oldCaseId && newCaseId && oldCaseId !== newCaseId) {
            console.log(`[PersistentBanner] Case ID changed from ${oldCaseId} to ${newCaseId}, clearing cache for old case`);
            // Clear cache for the old case ID to prevent stale data
            if (typeof CacheManager !== 'undefined' && typeof CacheManager.clear === 'function') {
                CacheManager.clear(oldCaseId).catch(err => {
                    console.warn(`[PersistentBanner] Error clearing cache for case ${oldCaseId}:`, err);
                });
            }
        }

        // Clear case-specific data when navigating away
        this.clearCaseData();

        // Reset current page to initial state
        this.currentPage = {
            type: 'Unknown',
            caseNumber: null,
            subject: null,
            status: null,
            subStatus: null,
            url: newUrl,
            timestamp: new Date().toISOString()
        };

        // Update UI to show loading/unknown state
        this.updateBannerUI();

        // The content script will call updateCurrentPage with proper data after page analysis
        console.log('[PersistentBanner] Waiting for content script to update page data...');
    },

    /**
     * Clear case-specific data (called when navigating to a different case or non-case page)
     */
    clearCaseData() {
        console.log('[PersistentBanner] Clearing case-specific data');

        // Clear current case ID
        this.currentCaseId = null;
        this.stopCaseDataPolling('case-data-cleared');

        // Clear displayed case tracking
        this.displayedCaseId = null;
        this.displayedCaseNumber = null;

        // Reset current page summary fields (preserve type/display type)
        this.currentPage.caseNumber = null;
        this.currentPage.subject = null;
        this.currentPage.status = null;
        this.currentPage.subStatus = null;
        this.currentPage.issue = null;

        // Clear customer metadata
        this.customerMetadata = {
            customerId: null,
            institutionId: null,
            server: null,
            productServiceName: null,
            institutionCode: null
        };

        // Reset environment menu state
        this.envMenuVisible = false;

        console.log('[PersistentBanner] Case data cleared');

        this.updateSectionOverflowStates();
    },

    /**
     * Load navigation history from sessionStorage
     */
    loadNavigationHistory() {
        try {
            const stored = sessionStorage.getItem('exl-navigation-history');
            if (stored) {
                this.navigationHistory = JSON.parse(stored);
                console.log('[PersistentBanner] Loaded navigation history:', this.navigationHistory);
            }
        } catch (error) {
            console.warn('[PersistentBanner] Failed to load navigation history:', error);
            this.navigationHistory = [];
        }
    },

    /**
     * Save navigation history to sessionStorage
     */
    saveNavigationHistory() {
        try {
            sessionStorage.setItem('exl-navigation-history', JSON.stringify(this.navigationHistory));
        } catch (error) {
            console.warn('[PersistentBanner] Failed to save navigation history:', error);
        }
    },

    /**
     * Add current page to navigation history
     * Only adds case pages (excludes non-case pages)
     * @param {Object} pageInfo
     */
    addToNavigationHistory(pageInfo) {
        // Only add case pages to history
        if (pageInfo.type !== 'case_page' || !pageInfo.caseNumber) {
            console.log('[PersistentBanner] Skipping non-case page in navigation history');
            return;
        }

        // Don't add if it's the same as the last entry
        const lastEntry = this.navigationHistory[this.navigationHistory.length - 1];
        if (lastEntry && lastEntry.url === pageInfo.url) {
            console.log('[PersistentBanner] Page already in history, skipping');
            return;
        }

        // Add to history
        this.navigationHistory.push(pageInfo);

        // Keep only last 3 items
        if (this.navigationHistory.length > this.maxHistoryItems) {
            this.navigationHistory.shift(); // Remove oldest
        }

        // Save to sessionStorage
        this.saveNavigationHistory();

        console.log('[PersistentBanner] Updated navigation history:', this.navigationHistory);

        // Update UI
        this.updateNavigationHistoryUI();
    },

    /**
     * Update current page information
     * Validates page context before updating
     * @param {Object} pageData
     */
    async updateCurrentPage(pageData = {}) {
        // Validate if this is case data
        if (pageData.caseNumber || pageData.caseId) {
            // Get case ID from URL if not provided
            const caseId = pageData.caseId || this.getCaseIdFromUrl();

            if (typeof PageContextValidator !== 'undefined' && typeof PageContextValidator.validatePageContextBeforeDisplay === 'function') {
                let validation = PageContextValidator.validatePageContextBeforeDisplay(caseId, pageData.caseNumber);

                // Handle async validation (when waiting for title update)
                if (validation instanceof Promise) {
                    validation = await validation;
                }

                if (!validation.valid) {
                    // Only clear if case ID mismatches (case number mismatch might be stale cache)
                    // If case ID matches but case number doesn't, allow update - fresh extraction will provide correct data
                    if (validation.currentContext && caseId !== validation.currentContext.caseId) {
                        console.warn(`[PersistentBanner] Cannot update page: ${validation.reason} (case ID mismatch)`);
                        this.clearCaseData();
                        return;
                    } else {
                        // Case number mismatch but case ID matches - likely stale cache, allow update
                        // Fresh extraction will provide correct data
                        console.warn(`[PersistentBanner] Case number mismatch (likely stale cache): ${validation.reason}. Allowing update - extraction will provide correct data.`);
                    }
                }
            }
        }

        // Normalize page type - store raw type for internal logic, display name for UI
        const rawPageType = pageData.type || 'Unknown';
        // Convert display name back to raw type if needed for logic checks
        const normalizedType = this.normalizePageType(rawPageType);

        this.currentPage = {
            type: normalizedType,  // Store raw type for logic checks
            displayType: this.getPageTypeDisplayName(normalizedType),  // Store display name for UI
            caseNumber: pageData.caseNumber || null,
            subject: pageData.subject || null,
            status: pageData.status || null,
            subStatus: pageData.subStatus || null,
            issue: pageData.issue || pageData.description || null,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        console.log('[PersistentBanner] Updated current page:', this.currentPage);

        // Track displayed case for validation
        if (pageData.caseNumber) {
            this.displayedCaseNumber = pageData.caseNumber;
        }
        if (pageData.caseId) {
            this.displayedCaseId = pageData.caseId;
        }

        // Update UI
        this.updateBannerUI();

        // Add to navigation history (only for case pages)
        this.addToNavigationHistory({
            type: this.currentPage.type,
            caseNumber: this.currentPage.caseNumber,
            caseId: this.currentPage.caseId,
            subject: this.currentPage.subject,
            issue: this.currentPage.issue || this.currentPage.description || null,
            status: this.currentPage.status,
            institutionCode: this.customerMetadata.institutionCode || null,
            url: this.currentPage.url,
            timestamp: this.currentPage.timestamp
        });
    },

    /**
     * Create banner element
     */
    createBanner() {
        const banner = document.createElement('div');
        banner.id = this.bannerId;
        banner.className = 'exl-persistent-banner';

        banner.innerHTML = `
            <div class="exl-banner-container">
                <div class="exl-banner-section exl-banner-page-info">
                    <div class="exl-section-label">Current Page</div>
                    <div class="exl-page-pill exl-banner-page-type" id="exl-banner-page-type">—</div>
                </div>
                
                <div class="exl-banner-section exl-banner-metadata" id="exl-banner-metadata-section">
                    <div class="exl-banner-metadata-grid" id="exl-banner-metadata">
                        <div class="exl-metadata-primary">
                            <div class="exl-section-label">Primary Metadata</div>
                            <div class="exl-banner-history-item exl-case-pill" id="exl-banner-case">—</div>
                        </div>
                        <div class="exl-metadata-body">
                            <div class="exl-metadata-fields">
                                <span class="exl-banner-meta-item">InstCode: <strong id="exl-banner-instcode">—</strong></span>
                                <span class="exl-banner-meta-item">CustID: <strong id="exl-banner-custid">—</strong></span>
                                <span class="exl-banner-meta-item">InstID: <strong id="exl-banner-instid">—</strong></span>
                                <span class="exl-banner-meta-item">Server: <strong id="exl-banner-server">—</strong></span>
                                <span class="exl-banner-meta-item" id="exl-banner-subject-item">Subject: <strong id="exl-banner-subject">—</strong></span>
                                <span class="exl-banner-meta-item exl-meta-extra-field" id="exl-banner-status-item">Status: <strong id="exl-banner-status">—</strong></span>
                                <span class="exl-banner-meta-item exl-meta-extra-field" id="exl-banner-substatus-item">Substatus: <strong id="exl-banner-substatus">—</strong></span>
                                <span class="exl-banner-meta-item exl-meta-extra-field">Product: <strong id="exl-banner-product">—</strong></span>
                            </div>
                            <div class="exl-metadata-issue" id="exl-banner-issue-item">
                                <span class="exl-banner-meta-label">Issue:</span>
                                <strong id="exl-banner-issue">—</strong>
                            </div>
                            <div class="exl-metadata-more-hint" aria-hidden="true">
                                Click for more details ▸
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="exl-banner-section exl-banner-messages" id="exl-banner-messages" style="display: none;">
                    <div class="exl-banner-message-content" id="exl-banner-message-content">
                        <!-- Message text rendered here (multiline support) -->
                    </div>
                    <div class="exl-banner-message-nav">
                        <button class="exl-banner-nav-btn" id="exl-message-prev" title="Previous message">◀</button>
                        <span class="exl-banner-message-index" id="exl-message-index">1/1</span>
                        <button class="exl-banner-nav-btn" id="exl-message-next" title="Next message">▶</button>
                    </div>
                </div>
                
                <div class="exl-banner-section exl-banner-env-toggle" id="exl-banner-env-toggle" style="display: none;">
                    <button class="exl-banner-btn exl-banner-env-toggle-btn" id="exl-env-toggle-btn">
                        Go to Customer Env ▶
                    </button>
                </div>
                
                <div class="exl-banner-section exl-banner-environment" id="exl-banner-env-section" style="display: none;">
                    <div class="exl-env-buttons-container" id="exl-env-buttons-container">
                        <!-- Buttons populated dynamically -->
                    </div>
                </div>
                
                <div class="exl-banner-section exl-banner-actions">
                    <button class="exl-banner-btn exl-actions-toggle" title="Show actions">Actions ▸</button>
                    <div class="exl-actions-list">
                        <button class="exl-banner-btn" data-action="refresh" title="Refresh banner data from current page">🔄 Refresh</button>
                        <button class="exl-banner-btn" data-action="action1" title="Extract and enable copy buttons for case comments">Extract Comments</button>
                        <button class="exl-banner-btn" data-action="action2" title="Show or update the Flexipage panel in case pages">Show Panel</button>
                        <button class="exl-banner-btn" data-action="action3" title="Copy case details as XML or TSV">Copy Details</button>
                    </div>
                </div>
                
                <div class="exl-banner-section exl-banner-history">
                    <div class="exl-section-label">Navigation History</div>
                    <div class="exl-banner-history-list" id="exl-banner-history">
                        <div class="exl-banner-history-placeholder">No navigation history yet</div>
                    </div>
                </div>
            </div>
        `;

        this.elements.banner = banner;
        this.cacheElements();
        this.wireEventHandlers();

        return banner;
    },

    /**
     * Cache banner element references
     */
    cacheElements() {
        const banner = this.elements.banner;
        if (!banner) return;

        this.elements.pageType = banner.querySelector('#exl-banner-page-type');
        this.elements.caseNumber = banner.querySelector('#exl-banner-case');
        this.elements.subject = banner.querySelector('#exl-banner-subject');
        this.elements.issue = banner.querySelector('#exl-banner-issue');
        this.elements.status = banner.querySelector('#exl-banner-status');
        this.elements.subStatus = banner.querySelector('#exl-banner-substatus');
        this.elements.product = banner.querySelector('#exl-banner-product');
        this.elements.instCode = banner.querySelector('#exl-banner-instcode');
        this.elements.custId = banner.querySelector('#exl-banner-custid');
        this.elements.instId = banner.querySelector('#exl-banner-instid');
        this.elements.server = banner.querySelector('#exl-banner-server');
        this.elements.envToggleSection = banner.querySelector('#exl-banner-env-toggle');
        this.elements.envToggleBtn = banner.querySelector('#exl-env-toggle-btn');
        this.elements.envSection = banner.querySelector('#exl-banner-env-section');
        this.elements.envButtonsContainer = banner.querySelector('#exl-env-buttons-container');
        this.elements.historyList = banner.querySelector('#exl-banner-history');
        this.elements.historySection = banner.querySelector('.exl-banner-history');
        this.elements.messagesSection = banner.querySelector('#exl-banner-messages');
        this.elements.messageContent = banner.querySelector('#exl-banner-message-content');
        this.elements.messagePrevBtn = banner.querySelector('#exl-message-prev');
        this.elements.messageNextBtn = banner.querySelector('#exl-message-next');
        this.elements.messageIndex = banner.querySelector('#exl-message-index');
        this.elements.metadataSection = banner.querySelector('#exl-banner-metadata-section');
    },

    /**
     * Wire event handlers
     */
    wireEventHandlers() {
        const banner = this.elements.banner;
        if (!banner) return;

        banner.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            this.handleAction(action);
        });

        // Handle environment toggle button
        if (this.elements.envToggleBtn) {
            this.elements.envToggleBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.toggleEnvMenu();
            });
        }

        // Handle environment button clicks
        banner.addEventListener('click', (event) => {
            const envButton = event.target.closest('[data-env-url]');
            if (!envButton) return;

            const url = envButton.dataset.envUrl;
            if (url) {
                window.open(url, '_blank');
            }
        });

        // Handle history item clicks
        banner.addEventListener('click', (event) => {
            const historyItem = event.target.closest('[data-history-url]');
            if (!historyItem) return;

            const url = historyItem.dataset.historyUrl;
            if (url) {
                window.location.href = url;
            }
        });

        // Handle message navigation buttons
        if (this.elements.messagePrevBtn) {
            this.trackListener(this.elements.messagePrevBtn, 'click', (e) => {
                e.stopPropagation();
                this.rotateToPreviousMessage();
            });
        }

        if (this.elements.messageNextBtn) {
            this.trackListener(this.elements.messageNextBtn, 'click', (e) => {
                e.stopPropagation();
                this.rotateToNextMessage();
            });
        }

        // Add context menu for message section
        if (this.elements.messageContent) {
            this.trackListener(this.elements.messageContent, 'contextmenu', (e) => {
                const currentMessage = this.activeMessages[this.currentMessageIndex];
                if (currentMessage) {
                    this.showContextMenu(e, currentMessage.id);
                }
            });
        }

        this.setupSectionToggleHandlers();
    },

    setupSectionToggleHandlers() {
        if (!this.elements.banner) return;
        const sections = this.elements.banner.querySelectorAll('.exl-banner-section');
        sections.forEach((section) => {
            if (section.classList.contains('exl-banner-history')) {
                return;
            }
            this.trackListener(section, 'click', (event) => {
                if (this.shouldIgnoreSectionToggle(event)) {
                    return;
                }
                this.handleSectionToggle(section);
            });
        });
    },

    shouldIgnoreSectionToggle(event) {
        const target = event.target;
        if (!target) return false;
        return Boolean(
            target.closest('button') ||
            target.closest('[data-action]') ||
            target.closest('[data-env-url]') ||
            target.closest('.exl-banner-history-item') ||
            target.closest('.exl-banner-message-nav') ||
            target.closest('.exl-banner-message-content') ||
            target.closest('#exl-banner-history')
        );
    },

    handleSectionToggle(section) {
        if (!section) return;

        const isExpanded = section.classList.contains('exl-section-expanded');
        if (isExpanded) {
            section.classList.remove('exl-section-expanded');
            if (this.elements.banner && !this.elements.banner.querySelector('.exl-banner-section.exl-section-expanded')) {
                this.elements.banner.classList.remove('exl-banner-expanded');
            }
        } else {
            this.collapseAllSectionsExcept(section);
            section.classList.add('exl-section-expanded');
            if (this.elements.banner) {
                this.elements.banner.classList.add('exl-banner-expanded');
            }
        }

        this.updateSectionOverflowStates();
    },

    collapseAllSectionsExcept(targetSection) {
        if (!this.elements.banner) return;
        const sections = this.elements.banner.querySelectorAll('.exl-banner-section');
        sections.forEach((section) => {
            if (section !== targetSection) {
                section.classList.remove('exl-section-expanded');
            }
        });
    },

    setBannerHoverState(isActive) {
        if (!this.elements.banner || this.bannerHoverActive === isActive) {
            this.bannerHoverActive = isActive;
            return;
        }

        this.bannerHoverActive = isActive;
        this.elements.banner.classList.toggle('exl-banner-hovering', isActive);
    },

    /**
     * Handle button actions
     * @param {string} action
     */
    handleAction(action) {
        console.log('[PersistentBanner] Action triggered:', action);

        switch (action) {
            case 'refresh':
                this.handleRefresh();
                break;
            case 'action1':
                this.handleCaseCommentExtractor();
                break;
            case 'action2':
                this.handleFlexipagePanel();
                break;
            case 'action3':
                this.handleCaseDetailExtractor();
                break;
            default:
                console.warn('[PersistentBanner] Unknown action:', action);
        }
    },

    /**
     * Handle refresh action - force refresh of banner data
     * Scrolls to load content and extracts case data like "Prepare Tools" does
     * Follows best practices: dependency checks, error handling, proper module interaction
     */
    async handleRefresh() {
        console.log('[PersistentBanner] Refresh button clicked');

        this.showNotification('Refreshing banner data...', 'info');

        try {
            const caseId = this.getCaseIdFromUrl();

            // Handle non-case pages
            if (!caseId) {
                if (typeof PageIdentifier !== 'undefined') {
                    const pageInfo = PageIdentifier.identifyPage(window.location.href);
                    const displayType = this.getPageTypeDisplayName(pageInfo.type);
                    await this.updateCurrentPage({
                        type: displayType,
                        caseNumber: null,
                        subject: null,
                        status: null,
                        subStatus: null
                    });
                    this.showNotification('Page info refreshed', 'success');
                } else {
                    this.showNotification('Unable to refresh: PageIdentifier not available', 'warning');
                }
                return;
            }

            // Save original scroll position
            const originalScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
            console.log('[PersistentBanner] Saved scroll position:', originalScrollTop);

            // Clear current case data (prevents stale data display)
            this.clearCaseData();

            // Clear toolkit cache if available
            if (typeof window.ExLibrisExtension !== 'undefined' &&
                window.ExLibrisExtension.caseToolkit) {
                window.ExLibrisExtension.caseToolkit.caseData = null;
                console.log('[PersistentBanner] Cleared toolkit cache');
            }

            // Step 1: Scroll to load all content (like "Prepare Tools")
            let scrollStats = null;
            const hasScrollController = typeof ScrollController !== 'undefined' &&
                typeof ScrollController.ensureFullPageLoad === 'function';

            if (hasScrollController) {
                console.log('[PersistentBanner] Using ScrollController.ensureFullPageLoad()');
                this.showNotification('Scrolling to load all content...', 'info');
                scrollStats = await ScrollController.ensureFullPageLoad();
                console.log('[PersistentBanner] Scroll complete:', scrollStats);
            } else {
                // Fallback: Incremental scrolling if ScrollController unavailable
                console.log('[PersistentBanner] ScrollController not available, using fallback incremental scrolling');
                this.showNotification('Scrolling to load content...', 'info');
                scrollStats = await this.scrollToLoadContent();
            }

            // Step 2: Extract case data after scrolling
            this.showNotification('Extracting case data...', 'info');

            // Priority 1: CasePageDataExtractor.extractNow() (preferred - event-driven)
            if (typeof CasePageDataExtractor !== 'undefined' &&
                typeof CasePageDataExtractor.extractNow === 'function') {
                console.log('[PersistentBanner] Using CasePageDataExtractor.extractNow()');
                const extractedData = await CasePageDataExtractor.extractNow();

                if (extractedData) {
                    // Event dispatched automatically, triggers update via setupCaseDataListener()
                    // Restore scroll position
                    window.scrollTo({ top: originalScrollTop, behavior: 'auto' });
                    this.showNotification('Banner data refreshed successfully', 'success');
                    return;
                }
                console.warn('[PersistentBanner] CasePageDataExtractor.extractNow() returned no data');
            }

            // Priority 2: ExLibrisExtension.getCaseData() with forceRefresh
            if (typeof window.ExLibrisExtension !== 'undefined' &&
                typeof window.ExLibrisExtension.getCaseData === 'function') {
                console.log('[PersistentBanner] Using ExLibrisExtension.getCaseData() with forceRefresh');
                const caseData = await window.ExLibrisExtension.getCaseData(caseId, { forceRefresh: true });

                if (caseData) {
                    await this.updateCurrentPage({
                        type: 'Case',
                        caseNumber: caseData.caseNumber,
                        subject: caseData.subject,
                        status: caseData.status,
                        subStatus: caseData.subStatus,
                        issue: caseData.description || caseData.issue || null
                    });

                    if (caseData.custID || caseData.instID || caseData.server) {
                        this.customerMetadata = {
                            customerId: caseData.custID || null,
                            institutionId: caseData.instID || null,
                            server: caseData.server || null,
                            productServiceName: caseData.productServiceName || null,
                            institutionCode: caseData.institutionCode || caseData.exLibrisAccountNumber || null
                        };
                    }

                    this.updateBannerUI();
                    // Restore scroll position
                    window.scrollTo({ top: originalScrollTop, behavior: 'auto' });
                    this.showNotification('Banner data refreshed successfully', 'success');
                    return;
                }
                console.warn('[PersistentBanner] ExLibrisExtension.getCaseData() returned no data');
            }

            // Priority 3: Fallback to CaseDataExtractor.getData()
            if (typeof CaseDataExtractor !== 'undefined') {
                console.log('[PersistentBanner] Using CaseDataExtractor.getData() as fallback');
                const freshData = await CaseDataExtractor.getData();

                if (freshData) {
                    await this.updateCurrentPage({
                        type: 'Case',
                        caseNumber: freshData.caseNumber,
                        subject: freshData.subject,
                        status: freshData.status,
                        subStatus: freshData.subStatus,
                        issue: freshData.description || freshData.issue || null
                    });

                    if (freshData.custID || freshData.instID || freshData.server) {
                        this.customerMetadata = {
                            customerId: freshData.custID || null,
                            institutionId: freshData.instID || null,
                            server: freshData.server || null,
                            productServiceName: freshData.productServiceName || null,
                            institutionCode: freshData.institutionCode || freshData.exLibrisAccountNumber || null
                        };
                    }

                    this.updateBannerUI();
                    // Restore scroll position
                    window.scrollTo({ top: originalScrollTop, behavior: 'auto' });
                    this.showNotification('Banner data refreshed successfully', 'success');
                    return;
                }
                console.warn('[PersistentBanner] CaseDataExtractor.getData() returned no data');
            }

            // All methods failed
            console.error('[PersistentBanner] All extraction methods failed or unavailable');
            // Restore scroll position even on failure
            window.scrollTo({ top: originalScrollTop, behavior: 'auto' });
            this.showNotification('Unable to refresh: No data extractors available', 'error');

        } catch (error) {
            console.error('[PersistentBanner] Error refreshing banner data:', error);
            this.showNotification('Error refreshing data: ' + (error.message || 'Unknown error'), 'error');
        }
    },

    /**
     * Scroll to load content incrementally (fallback when ScrollController unavailable)
     * @returns {Promise<Object>} Stats about scroll operation
     */
    async scrollToLoadContent() {
        const STEP_PX = 800;
        const DELAY_MS = 150;
        const MAX_SCROLLS = 50;

        const stats = {
            totalScrolled: 0,
            iterations: 0,
            startScrollHeight: document.documentElement.scrollHeight,
            endScrollHeight: 0,
            duration: 0,
            startTime: performance.now()
        };

        let lastScrollHeight = 0;
        let unchangedCount = 0;

        console.log('[PersistentBanner] Starting incremental scroll, initial height:', stats.startScrollHeight);

        for (let i = 0; i < MAX_SCROLLS; i++) {
            stats.iterations = i + 1;

            // Get current scroll position and height
            const currentScrollHeight = document.documentElement.scrollHeight;
            const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

            // Check if we've reached the bottom
            if (currentScrollTop + window.innerHeight >= currentScrollHeight - 10) {
                console.log('[PersistentBanner] Reached bottom after', stats.iterations, 'iterations');
                break;
            }

            // Check if content is still loading
            if (currentScrollHeight === lastScrollHeight) {
                unchangedCount++;
                if (unchangedCount >= 3) {
                    console.log('[PersistentBanner] No new content after 3 attempts, stopping');
                    break;
                }
            } else {
                unchangedCount = 0;
            }

            lastScrollHeight = currentScrollHeight;

            // Scroll by step
            window.scrollBy(0, STEP_PX);
            stats.totalScrolled += STEP_PX;

            // Wait for content to load
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }

        // Scroll back to top
        window.scrollTo({ top: 0, behavior: 'auto' });

        // Wait for any final renders
        await new Promise(resolve => setTimeout(resolve, 500));

        stats.endScrollHeight = document.documentElement.scrollHeight;
        stats.duration = performance.now() - stats.startTime;

        console.log('[PersistentBanner] Incremental scroll complete:', stats);
        return stats;
    },

    /**
     * Handle case comment extractor action
     */
    async handleCaseCommentExtractor() {
        // Check if we're on a case page
        if (this.currentPage.type !== 'case_page' || !this.currentPage.caseNumber) {
            this.showNotification('Please navigate to a Case page first', 'warning');
            return;
        }

        // Check if CaseCommentExtractor is available
        if (typeof CaseCommentExtractor === 'undefined') {
            this.showNotification('Case Comment Extractor module not loaded', 'error');
            return;
        }

        // Force refresh of cached case data to ensure we're using current page data
        console.log('[PersistentBanner] Forcing refresh of case data before comment extraction');
        if (typeof window.ExLibrisExtension !== 'undefined' &&
            typeof CaseDataExtractor !== 'undefined') {
            try {
                // Clear cached data
                if (window.ExLibrisExtension.caseToolkit) {
                    window.ExLibrisExtension.caseToolkit.caseData = null;
                }

                // Extract fresh data from current page
                const freshCaseData = await CaseDataExtractor.getData();

                // Update toolkit cache
                if (window.ExLibrisExtension.caseToolkit && freshCaseData) {
                    window.ExLibrisExtension.caseToolkit.caseData = freshCaseData;
                    console.log('[PersistentBanner] Refreshed case data:', freshCaseData.caseNumber);
                }
            } catch (error) {
                console.warn('[PersistentBanner] Error refreshing case data:', error);
            }
        }

        try {
            // Get fresh comments data from current page
            const data = CaseCommentExtractor.extractCaseComments();

            if (!data || !data.comments || data.comments.length === 0) {
                this.showNotification(
                    'No comments found. Make sure you are on the Communications tab and Case Comments section is loaded.',
                    'warning'
                );
                return;
            }

            console.log(`[PersistentBanner] Found ${data.comments.length} comment(s), attempting to inject buttons...`);

            // Re-initialize the extractor to use current page elements
            CaseCommentExtractor.initialize();

            // Wait for the buttons to be injected
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check if buttons were actually injected
            const injectedButtons = document.querySelectorAll('[data-cc-extractor="true"]');

            if (injectedButtons.length > 0) {
                this.showNotification(
                    `Found ${data.comments.length} comment(s). Copy buttons injected successfully.`,
                    'success'
                );
            } else {
                // Buttons not injected, but we have data - offer alternative
                console.warn('[PersistentBanner] Buttons not injected, action bar not found');
                this.showNotification(
                    `Found ${data.comments.length} comment(s), but could not inject buttons. The action bar may not be visible on this view.`,
                    'warning'
                );
            }
        } catch (error) {
            console.error('[PersistentBanner] Error extracting comments:', error);
            this.showNotification('Error extracting comments: ' + error.message, 'error');
        }
    },

    /**
     * Handle flexipage panel injection action
     */
    async handleFlexipagePanel() {
        // Check if we're on a case page
        if (this.currentPage.type !== 'case_page' || !this.currentPage.caseNumber) {
            this.showNotification('Please navigate to a Case page first', 'warning');
            return;
        }

        // Check if FlexipagePanelInjector is available
        if (typeof FlexipagePanelInjector === 'undefined') {
            this.showNotification('Flexipage Panel Injector module not loaded', 'error');
            return;
        }

        try {
            console.log('[PersistentBanner] Injecting panel and loading case data...');

            // Step 1: Extract or retrieve case data
            let caseData = null;
            let caseId = null;

            // Try to get case ID from URL
            const urlMatch = window.location.pathname.match(/\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})/);
            if (urlMatch) {
                caseId = urlMatch[1];
                console.log('[PersistentBanner] Detected case ID from URL:', caseId);
            }

            // Try to get from cached toolkit first
            if (window.ExLibrisExtension &&
                window.ExLibrisExtension.caseToolkit &&
                window.ExLibrisExtension.caseToolkit.caseData &&
                window.ExLibrisExtension.currentCaseId === caseId) {
                caseData = window.ExLibrisExtension.caseToolkit.caseData;
                console.log('[PersistentBanner] Using cached case data for case:', caseData.caseNumber);
            }

            // If no cached data or case ID mismatch, extract fresh data
            if (!caseData && typeof CaseDataExtractor !== 'undefined') {
                console.log('[PersistentBanner] No cached data, extracting fresh case data...');
                this.showNotification('Loading case data...', 'info');

                try {
                    caseData = await CaseDataExtractor.getData();

                    // Update toolkit cache
                    if (window.ExLibrisExtension && window.ExLibrisExtension.caseToolkit && caseData) {
                        window.ExLibrisExtension.caseToolkit.caseData = caseData;
                        window.ExLibrisExtension.currentCaseId = caseId;
                        console.log('[PersistentBanner] Cached fresh case data:', caseData.caseNumber);
                    }
                } catch (error) {
                    console.error('[PersistentBanner] Error extracting case data:', error);
                    this.showNotification('Error extracting case data: ' + error.message, 'error');
                    return;
                }
            }

            if (!caseData) {
                this.showNotification('Could not extract case data. Please try again.', 'error');
                return;
            }

            // Step 2: Inject the panel
            const success = FlexipagePanelInjector.ensureInjected();

            if (success) {
                this.showNotification('Panel injected successfully. Updating with case data...', 'success');

                // Step 3: Register action handler if available
                if (window.ExLibrisExtension && typeof window.ExLibrisExtension.handlePanelAction === 'function') {
                    FlexipagePanelInjector.registerActionHandler((action) => {
                        return window.ExLibrisExtension.handlePanelAction(action);
                    });
                }

                // Step 4: Update panel with case data
                const initialMetadata = (typeof CaseDataExtractor !== 'undefined' &&
                    typeof CaseDataExtractor.getInitialMetadata === 'function')
                    ? CaseDataExtractor.getInitialMetadata()
                    : null;

                if (initialMetadata) {
                    FlexipagePanelInjector.setInitialMetadata(initialMetadata);
                }

                // Get timezone setting
                const resolvedTimezone = window.ExLibrisExtension
                    ? window.ExLibrisExtension.resolveActiveTimezone(
                        window.ExLibrisExtension.settings?.exlibris?.ui?.timezone ||
                        window.ExLibrisExtension.settings?.timezone
                    )
                    : null;

                // Update full context
                FlexipagePanelInjector.updateContext({
                    caseNumber: caseData.caseNumber,
                    subject: caseData.subject,
                    status: caseData.status,
                    subStatus: caseData.subStatus,
                    category: caseData.category,
                    subCategory: caseData.subCategory,
                    analysisNote: caseData.analysisNote,
                    customerId: caseData.custID,
                    institutionId: caseData.instID,
                    server: caseData.server,
                    timezone: resolvedTimezone || '—'
                });

                FlexipagePanelInjector.setCaseSummary(caseData);

                // Set initial preparation state
                FlexipagePanelInjector.setPreparationState('initial', {
                    message: 'Case data loaded. Click "Prepare Tools" to enable full features.'
                });

                FlexipagePanelInjector.setSlot2Message('Case data ready. Prepare tools to populate the reference workspace.');

                // Step 5: Initialize CaseTimezoneResolver with full case data
                // Wait for panel to be fully rendered before initializing timezone resolver
                if (typeof CaseTimezoneResolver !== 'undefined' && caseData.accountName) {
                    setTimeout(async () => {
                        console.log('[PersistentBanner] Initializing CaseTimezoneResolver for account:', caseData.accountName);
                        // Pass full case data to enable institution-based timezone lookup
                        await CaseTimezoneResolver.init(caseData);
                    }, 1000); // 1 second delay to ensure panel DOM is fully ready
                } else if (!caseData.accountName) {
                    console.warn('[PersistentBanner] No account name available for timezone detection');
                }

                this.showNotification(
                    `Panel ready for case ${caseData.caseNumber}. Click "Prepare Tools" to continue.`,
                    'success'
                );
            } else {
                this.showNotification('Could not inject panel. Make sure you are on a Case record page.', 'warning');
            }
        } catch (error) {
            console.error('[PersistentBanner] Error injecting Flexipage panel:', error);
            this.showNotification('Error injecting panel: ' + error.message, 'error');
        }
    },

    /**
     * Handle case detail extractor action
     * Shows a menu to choose between XML and TSV formats
     */
    async handleCaseDetailExtractor() {
        // Check if we're on a case page
        if (this.currentPage.type !== 'case_page' || !this.currentPage.caseNumber) {
            this.showNotification('Please navigate to a Case page first', 'warning');
            return;
        }

        // Check if CaseDetailExtractor is available
        if (typeof CaseDetailExtractor === 'undefined') {
            this.showNotification('Case Detail Extractor module not loaded', 'error');
            return;
        }

        console.log('[PersistentBanner] Preparing case detail extraction...');

        // Step 1: Get or extract case data intelligently
        let caseData = null;
        let caseId = null;

        // Try to get case ID from URL
        const urlMatch = window.location.pathname.match(/\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})/);
        if (urlMatch) {
            caseId = urlMatch[1];
            console.log('[PersistentBanner] Detected case ID from URL:', caseId);
        }

        // Try to get from cached toolkit first
        if (window.ExLibrisExtension &&
            window.ExLibrisExtension.caseToolkit &&
            window.ExLibrisExtension.caseToolkit.caseData &&
            window.ExLibrisExtension.currentCaseId === caseId) {
            caseData = window.ExLibrisExtension.caseToolkit.caseData;
            console.log('[PersistentBanner] Using cached case data for extraction:', caseData.caseNumber);
        }

        // If no cached data or case ID mismatch, extract fresh data
        if (!caseData && typeof CaseDataExtractor !== 'undefined') {
            console.log('[PersistentBanner] No cached data available, extracting fresh case data...');
            this.showNotification('Loading case data...', 'info');

            try {
                caseData = await CaseDataExtractor.getData();

                // Update toolkit cache
                if (window.ExLibrisExtension && window.ExLibrisExtension.caseToolkit && caseData) {
                    window.ExLibrisExtension.caseToolkit.caseData = caseData;
                    window.ExLibrisExtension.currentCaseId = caseId;
                    console.log('[PersistentBanner] Cached fresh case data for extraction:', caseData.caseNumber);
                }
            } catch (error) {
                console.error('[PersistentBanner] Error extracting case data:', error);
                this.showNotification('Error extracting case data: ' + error.message, 'error');
                return;
            }
        }

        if (!caseData) {
            this.showNotification('Could not extract case data. Please try again.', 'error');
            return;
        }

        console.log('[PersistentBanner] Case data ready for extraction, showing format menu...');

        // Step 2: Show format selection menu
        const formatChoice = await this.showFormatMenu();

        if (!formatChoice) {
            console.log('[PersistentBanner] Case detail extraction cancelled');
            return;
        }

        // Step 3: Extract and copy based on selected format
        try {
            let result;

            if (formatChoice === 'xml') {
                console.log('[PersistentBanner] Extracting case details as XML...');
                result = await CaseDetailExtractor.copyAsXML();
            } else if (formatChoice === 'tsv') {
                console.log('[PersistentBanner] Extracting case details as TSV...');
                result = await CaseDetailExtractor.copyAsTSV();
            }

            if (result && result.success) {
                this.showNotification(result.message + ` (Case: ${caseData.caseNumber})`, 'success');
            } else {
                this.showNotification(result ? result.message : 'Extraction failed', 'error');
            }
        } catch (error) {
            console.error('[PersistentBanner] Error extracting case details:', error);
            this.showNotification('Error extracting details: ' + error.message, 'error');
        }
    },

    /**
     * Shows a format selection menu
     * @returns {Promise<string|null>} Selected format ('xml' or 'tsv') or null if cancelled
     */
    showFormatMenu() {
        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            // Create menu
            const menu = document.createElement('div');
            menu.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 24px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                min-width: 300px;
            `;

            menu.innerHTML = `
                <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #333;">
                    Select Export Format
                </h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="format-btn" data-format="xml" style="
                        padding: 12px 20px;
                        background: #0070d2;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: background 0.2s;
                    ">
                        Copy as XML
                    </button>
                    <button class="format-btn" data-format="tsv" style="
                        padding: 12px 20px;
                        background: #0070d2;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: background 0.2s;
                    ">
                        Copy as TSV
                    </button>
                    <button class="format-btn" data-format="cancel" style="
                        padding: 12px 20px;
                        background: #f3f3f3;
                        color: #333;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: background 0.2s;
                    ">
                        Cancel
                    </button>
                </div>
            `;

            overlay.appendChild(menu);
            document.body.appendChild(overlay);

            // Add hover effects
            const buttons = menu.querySelectorAll('.format-btn');
            buttons.forEach(btn => {
                btn.addEventListener('mouseenter', () => {
                    if (btn.dataset.format !== 'cancel') {
                        btn.style.background = '#005fb2';
                    } else {
                        btn.style.background = '#e0e0e0';
                    }
                });
                btn.addEventListener('mouseleave', () => {
                    if (btn.dataset.format !== 'cancel') {
                        btn.style.background = '#0070d2';
                    } else {
                        btn.style.background = '#f3f3f3';
                    }
                });
            });

            // Handle button clicks
            overlay.addEventListener('click', (e) => {
                const formatBtn = e.target.closest('.format-btn');
                if (formatBtn) {
                    const format = formatBtn.dataset.format;
                    overlay.remove();
                    resolve(format === 'cancel' ? null : format);
                } else if (e.target === overlay) {
                    // Clicked outside menu
                    overlay.remove();
                    resolve(null);
                }
            });
        });
    },

    /**
     * Show a notification message
     * @param {string} message
     * @param {string} type - 'success', 'error', 'warning', 'info'
     */
    showNotification(message, type = 'info') {
        // Create a temporary notification in the banner
        const notification = document.createElement('div');
        notification.className = `exl-banner-notification exl-banner-notification--${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 3.5rem;
            right: 1rem;
            background: ${type === 'success' ? '#2e844a' : type === 'error' ? '#ba0c2f' : type === 'warning' ? '#f4d250' : '#0070d2'};
            color: ${type === 'warning' ? '#333' : '#fff'};
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 13px;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    },

    /**
     * Normalize page type (convert display name to raw type if needed)
     * @param {string} pageType - Page type (raw or display name)
     * @returns {string} Raw page type
     */
    normalizePageType(pageType) {
        // Reverse mapping: display name -> raw type
        const reverseMap = {
            'Case': 'case_page',
            'Case Comments': 'case_comments',
            'Case List': 'cases_list',
            'Report Home': 'report_home',
            'Report': 'report_page',
            'Report Builder': 'report_builder',
            'Search': 'search_page',
            'Unknown': 'unknown'
        };

        // If it's a display name, convert to raw type
        if (reverseMap[pageType]) {
            return reverseMap[pageType];
        }

        // Otherwise assume it's already a raw type
        return pageType;
    },

    /**
     * Convert page type to display name
     * @param {string} pageType - Raw page type
     * @returns {string} Display name
     */
    getPageTypeDisplayName(pageType) {
        const displayNames = {
            'case_page': 'Case',
            'case_comments': 'Case Comments',
            'cases_list': 'Case List',
            'report_home': 'Report Home',
            'report_page': 'Report',
            'report_builder': 'Report Builder',
            'search_page': 'Search',
            'unknown': 'Unknown'
        };

        return displayNames[pageType] || pageType;
    },

    /**
     * Update banner UI with current page data
     */
    updateBannerUI() {
        if (!this.elements.pageType) return;

        // Update page type with friendly display name
        const displayName = this.currentPage.displayType || this.getPageTypeDisplayName(this.currentPage.type);
        this.elements.pageType.textContent = displayName;

        // Update page type styling based on raw type
        const rawType = this.currentPage.type;
        this.elements.pageType.className = 'exl-banner-page-type';
        this.elements.pageType.classList.add(`exl-page-${rawType.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')}`);

        // FIRST: Check if we're on a case page or case comments
        // These pages NEVER show messages - they have their own data
        const isCasePage = rawType === 'case_page';
        const isCaseComments = rawType === 'case_comments';
        const metadataSection = this.elements.metadataSection;
        const messagesSection = this.elements.messagesSection;

        if (isCasePage || isCaseComments) {
            // Case page or case comments - NEVER show messages
            if (messagesSection) {
                messagesSection.style.display = 'none';
                this.stopMessageRotation();
            }
            this.messagesFeatureEnabled = false;
            this.updateMessageSectionLayoutVisibility();

            // Check extraction state for case pages
            if (isCasePage) {
                const extractionState = this.isCaseDataExtractionComplete();

                if (extractionState.complete && extractionState.hasData) {
                    // Extraction complete - show case data
                    console.log('[PersistentBanner] Case data extraction complete - showing case data');
                } else {
                    if (extractionState.isExtracting) {
                        console.log('[PersistentBanner] Case data extraction in progress - rendering partial data');
                    } else {
                        console.log('[PersistentBanner] Case data extraction not started or no data yet');
                    }
                }

                if (metadataSection) {
                    metadataSection.style.display = 'flex';
                }
            } else {
                // Case comments - show metadata section
                if (metadataSection) {
                    metadataSection.style.display = 'flex';
                }
            }

            // Update metadata fields (will show '—' if no data)
            this.updateMetadataFields();
            this.updateSectionOverflowStates();
            this.evaluateCaseDataPolling('case-page-ui');

        } else {
            // NOT a case page or case comments - show messages if enabled
            if (metadataSection) {
                metadataSection.style.display = 'none';
            }
            this.stopCaseDataPolling('not-case-page');

            // Check if should show messages
            this.shouldShowMessages().then(showMessages => {
                this.messagesFeatureEnabled = showMessages;
                if (showMessages) {
                    // Show messages
                    if (messagesSection) {
                        messagesSection.style.display = 'flex';
                        this.updateMessageDisplay();
                        this.startMessageRotation();
                    }
                } else {
                    // Don't show messages (feature disabled or no messages)
                    if (messagesSection) {
                        messagesSection.style.display = 'none';
                        this.stopMessageRotation();
                    }
                }
                this.updateMessageSectionLayoutVisibility();
            }).catch(error => {
                console.error('[PersistentBanner] Error checking shouldShowMessages:', error);
                if (messagesSection) {
                    messagesSection.style.display = 'none';
                    this.stopMessageRotation();
                }
                this.messagesFeatureEnabled = false;
                this.updateMessageSectionLayoutVisibility();
            }).finally(() => {
                this.updateSectionOverflowStates();
            });
        }

        // Update banner background based on case status
        this.updateBannerBackground();
    },

    /**
     * Update metadata fields in the banner
     * Separated for reuse in different contexts
     */
    updateMetadataFields() {
        // Update case metadata
        if (this.elements.caseNumber) {
            this.elements.caseNumber.textContent = this.currentPage.caseNumber || '—';
            
            // Apply status-based color to case number (matching history items)
            if (this.currentPage.status) {
                const statusConfig = this.STATUS_COLORS[this.currentPage.status];
                if (statusConfig) {
                    const statusColor = statusConfig.base;
                    const statusCategory = statusConfig.category;
                    this.elements.caseNumber.style.setProperty('--status-color', statusColor);
                    this.elements.caseNumber.setAttribute('data-status-category', statusCategory);
                    this.elements.caseNumber.style.borderLeftColor = statusColor;
                } else {
                    // Default blue
                    this.elements.caseNumber.style.setProperty('--status-color', 'rgba(0, 112, 210, 0.5)');
                    this.elements.caseNumber.setAttribute('data-status-category', 'blue');
                    this.elements.caseNumber.style.borderLeftColor = 'rgba(0, 112, 210, 0.5)';
                }
            } else {
                // No status - default blue
                this.elements.caseNumber.style.setProperty('--status-color', 'rgba(0, 112, 210, 0.5)');
                this.elements.caseNumber.setAttribute('data-status-category', 'blue');
                this.elements.caseNumber.style.borderLeftColor = 'rgba(0, 112, 210, 0.5)';
            }
        }
        if (this.elements.subject) {
            this.elements.subject.textContent = this.currentPage.subject || '—';
        }
        if (this.elements.issue) {
            const issueText = this.currentPage.issue || '—';
            this.elements.issue.textContent = issueText;
        }
        if (this.elements.status) {
            this.elements.status.textContent = this.currentPage.status || '—';
        }
        if (this.elements.subStatus) {
            this.elements.subStatus.textContent = this.currentPage.subStatus || '—';
        }

        // Update customer metadata
        if (this.elements.product) {
            this.elements.product.textContent = this.customerMetadata.productServiceName || '—';
        }
        if (this.elements.instCode) {
            this.elements.instCode.textContent = this.customerMetadata.institutionCode || '—';
        }
        if (this.elements.custId) {
            this.elements.custId.textContent = this.customerMetadata.customerId || '—';
        }
        if (this.elements.instId) {
            this.elements.instId.textContent = this.customerMetadata.institutionId || '—';
        }
        if (this.elements.server) {
            this.elements.server.textContent = this.customerMetadata.server || '—';
        }

        // Show/hide environment toggle button and populate buttons
        const hasEnvData = Boolean(
            this.customerMetadata.server &&
            (this.customerMetadata.institutionCode || this.customerMetadata.institutionId)
        );

        // Show toggle button if we have environment data
        if (this.elements.envToggleSection) {
            this.elements.envToggleSection.style.display = hasEnvData ? 'flex' : 'none';
        }

        // Populate environment buttons if data is available
        if (hasEnvData && this.elements.envButtonsContainer) {
            this.populateEnvButtons();
        }

        // Keep environment section hidden by default (user must click toggle)
        if (this.elements.envSection) {
            this.elements.envSection.style.display = 'none';
        }
        // Reset menu visibility state when updating UI
        this.envMenuVisible = false;
        if (this.elements.envToggleBtn) {
            this.elements.envToggleBtn.textContent = 'Go to Customer Env ▶';
        }

        // Case summary is now always visible alongside customer metadata
    },

    /**
     * Update banner background gradient based on case status
     */
    updateBannerBackground() {
        if (!this.elements.banner) return;

        // Check if we're on a case page with a status
        if (this.currentPage.type === 'case_page' && this.currentPage.status) {
            const statusConfig = this.STATUS_COLORS[this.currentPage.status];

            if (statusConfig) {
                // Create gradient using the status color
                const baseColor = statusConfig.base;
                const gradient = this.createStatusGradient(baseColor);
                this.elements.banner.style.background = gradient;
                console.log(`[PersistentBanner] Applied ${statusConfig.category} gradient for status: ${this.currentPage.status}`);
            } else {
                // Unknown status - use default gradient
                this.elements.banner.style.background = this.DEFAULT_GRADIENT;
                console.log(`[PersistentBanner] Unknown status "${this.currentPage.status}", using default gradient`);
            }
        } else {
            // Not a case page or no status - use default gradient
            this.elements.banner.style.background = this.DEFAULT_GRADIENT;
        }
    },

    /**
     * Create gradient from base RGB color
     * @param {string} baseRgb - Base color in rgb() format
     * @returns {string} Linear gradient CSS
     */
    createStatusGradient(baseRgb) {
        // Extract RGB values from string like "rgb(178, 15, 66)"
        const rgbMatch = baseRgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!rgbMatch) {
            console.warn('[PersistentBanner] Invalid RGB format:', baseRgb);
            return this.DEFAULT_GRADIENT;
        }

        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);

        // Create gradient using the status color (lighter -> richer)
        const start = `rgba(${r}, ${g}, ${b}, 0.35)`;
        const mid = `rgba(${r}, ${g}, ${b}, 0.65)`;
        const end = `rgba(${r}, ${g}, ${b}, 0.9)`;
        return `linear-gradient(135deg, ${start} 0%, ${mid} 55%, ${end} 100%)`;
    },

    updateSectionOverflowStates() {
        if (this.sectionOverflowRaf) {
            cancelAnimationFrame(this.sectionOverflowRaf);
        }

        this.sectionOverflowRaf = requestAnimationFrame(() => {
            this.sectionOverflowRaf = null;
            this.applySectionOverflowStates();
        });
    },

    applySectionOverflowStates() {
        if (!this.elements.banner) return;
        this.evaluateBannerLayoutMode();

        const shouldCollapse = this.isTightLayout || this.bannerHoverActive;
        const sections = this.elements.banner.querySelectorAll('.exl-banner-section');
        sections.forEach((section) => {
            const hasOverflow = section.scrollHeight - 1 > this.sectionCollapsedHeight;
            if (shouldCollapse) {
                section.classList.toggle('exl-overflow', hasOverflow);
            } else {
                section.classList.remove('exl-overflow');
                section.classList.remove('exl-section-expanded');
            }
        });

        if (!this.elements.banner.querySelector('.exl-banner-section.exl-section-expanded')) {
            this.elements.banner.classList.remove('exl-banner-expanded');
            if (!this.isTightLayout) {
                this.setBannerHoverState(false);
            }
        }

        this.updateMessageSectionLayoutVisibility();
    },

    updateMessageSectionLayoutVisibility() {
        if (!this.elements.messagesSection) return;

        if (!this.messagesFeatureEnabled) {
            this.elements.messagesSection.style.display = 'none';
            return;
        }

        const banner = this.elements.banner;
        const container = banner ? banner.querySelector('.exl-banner-container') : null;
        if (!banner || !container) return;

        const isCollapsed = banner.classList.contains('exl-banner-tight');
        if (!isCollapsed) {
            this.elements.messagesSection.style.display = 'flex';
            return;
        }

        const historyWidth = this.elements.historySection ? this.elements.historySection.getBoundingClientRect().width : 0;
        const availableWidth = container.clientWidth - historyWidth;
        if (availableWidth <= this.messageSectionMinWidth) {
            this.elements.messagesSection.style.display = 'none';
            return;
        }

        const otherSections = Array.from(container.querySelectorAll('.exl-banner-section')).filter((section) => section !== this.elements.messagesSection && section !== this.elements.historySection);
        const usedWidth = otherSections.reduce((sum, section) => sum + section.getBoundingClientRect().width, 0);

        if ((availableWidth - usedWidth) > this.messageSectionMinWidth) {
            this.elements.messagesSection.style.display = 'flex';
        } else {
            this.elements.messagesSection.style.display = 'none';
        }
    },

    evaluateBannerLayoutMode() {
        if (!this.elements.banner) return;
        const container = this.elements.banner.querySelector('.exl-banner-container');
        if (!container) return;

        // Always keep banner collapsed by default unless a section is expanded
        const hasExpandedSection = this.elements.banner.querySelector('.exl-banner-section.exl-section-expanded');
        const shouldBeTight = !hasExpandedSection;
        
        if (shouldBeTight !== this.isTightLayout) {
            const wasTight = this.isTightLayout;
            this.isTightLayout = shouldBeTight;
            this.elements.banner.classList.toggle('exl-banner-tight', shouldBeTight);
            
            if (!shouldBeTight && wasTight) {
                // Banner is expanding - no action needed
                return;
            } else if (shouldBeTight && !wasTight) {
                // Banner is collapsing - clean up expanded sections
                const sections = container.querySelectorAll('.exl-banner-section');
                sections.forEach((section) => {
                    if (!section.classList.contains('exl-section-expanded')) {
                        section.classList.remove('exl-overflow');
                    }
                });
            }
        } else {
            // Ensure class matches state
            this.elements.banner.classList.toggle('exl-banner-tight', shouldBeTight);
        }
    },

    /**
     * Update navigation history UI
     * Shows case number and institution code, expands on hover to show subject and issue
     */
    updateNavigationHistoryUI() {
        if (!this.elements.historyList) return;

        // Filter to only case pages (should already be filtered, but double-check)
        const caseHistory = this.navigationHistory.filter(item => item.type === 'case_page' && item.caseNumber);

        if (caseHistory.length === 0) {
            this.elements.historyList.innerHTML = '<div class="exl-banner-history-placeholder">No navigation history yet</div>';
            return;
        }

        // Build history items (reverse order - newest first)
        const historyHTML = [...caseHistory].reverse().map((item, index) => {
            const relativeIndex = caseHistory.length - index;
            
            // Get status color
            const statusConfig = item.status ? this.STATUS_COLORS[item.status] : null;
            const statusColor = statusConfig ? statusConfig.base : 'rgb(8, 50, 104)'; // Default blue
            const statusCategory = statusConfig ? statusConfig.category : 'blue';
            
            // Get institution code (fallback to empty if not available)
            const instCode = item.institutionCode || '—';
            
            // Truncate subject and issue for display
            const subjectText = item.subject ? this.truncate(item.subject, 50) : '—';
            const issueText = item.issue ? this.truncate(item.issue, 80) : '—';

            return `
                <div class="exl-banner-history-item exl-history-item-collapsed" 
                     data-history-url="${item.url}" 
                     data-status-category="${statusCategory}"
                     style="--status-color: ${statusColor};"
                     title="Click to navigate">
                    <div class="exl-history-item-collapsed-content">
                        <span class="exl-history-number">${relativeIndex}</span>
                        <span class="exl-history-case-number">${item.caseNumber}</span>
                        <span class="exl-history-instcode">${instCode}</span>
                    </div>
                    <div class="exl-history-item-expanded-content">
                        <div class="exl-history-item-header">
                            <span class="exl-history-number">${relativeIndex}</span>
                            <span class="exl-history-case-number">${item.caseNumber}</span>
                            <span class="exl-history-instcode">${instCode}</span>
                        </div>
                        <div class="exl-history-item-body">
                            <div class="exl-history-subject">
                                <span class="exl-history-label">Subject:</span>
                                <span class="exl-history-value">${subjectText}</span>
                            </div>
                            <div class="exl-history-issue">
                                <span class="exl-history-label">Issue:</span>
                                <span class="exl-history-value">${issueText}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.historyList.innerHTML = historyHTML;
    },

    /**
     * Truncate text to specified length
     * @param {string} text
     * @param {number} maxLength
     * @returns {string}
     */
    truncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    /**
     * Observe DOM for injection point
     */
    observeForInjection() {
        const tryInject = () => {
            // Try multiple injection strategies
            const injectionPoint = this.findInjectionPoint();

            if (injectionPoint && !document.getElementById(this.bannerId)) {
                this.injectBanner(injectionPoint);
                return true;
            }
            return false;
        };

        // Try immediate injection
        if (tryInject()) {
            return;
        }

        // Set up observer for delayed injection
        const observer = new MutationObserver(() => {
            if (tryInject()) {
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        this.trackObserver(observer);

        // Cleanup after 10 seconds
        const timeoutId = setTimeout(() => observer.disconnect(), 10000);
        this.trackTimer('timeout', timeoutId);
    },

    /**
     * Find suitable injection point in Salesforce DOM
     * @returns {Element|null}
     */
    findInjectionPoint() {
        // Strategy 1: Lightning header container
        // const lightningHeader = document.querySelector('.slds-global-header_container');
        // if (lightningHeader) {
        //    return lightningHeader;
        //}

        // Strategy 2: Main viewport
        // const viewport = document.querySelector('div.slds-scope');
        // if (viewport) {
        //   return viewport;
        // }

        // Strategy 3: Body as fallback
        return document.body;
    },

    /**
     * Inject banner into DOM
     * @param {Element} targetElement
     */
    injectBanner(targetElement) {
        if (!this.elements.banner || !targetElement) {
            console.warn('[PersistentBanner] Cannot inject - missing banner or target');
            return;
        }

        // Insert at the beginning of target
        if (targetElement.firstChild) {
            targetElement.insertBefore(this.elements.banner, targetElement.firstChild);
        } else {
            targetElement.appendChild(this.elements.banner);
        }

        console.log('[PersistentBanner] Injected into:', targetElement);

        // Initial UI update
        this.updateBannerUI();
        this.updateNavigationHistoryUI();
    },

    /**
     * Check if banner is injected
     * @returns {boolean}
     */
    isInjected() {
        return document.getElementById(this.bannerId) !== null;
    },

    /**
     * Remove banner from DOM
     */
    remove() {
        const banner = document.getElementById(this.bannerId);
        if (banner) {
            banner.remove();
            console.log('[PersistentBanner] Removed from DOM');
        }
    },

    /**
     * Check if banner messages feature is enabled
     * Checks both feature toggle and messages.enabled setting
     * @returns {Promise<boolean>}
     */
    async isBannerMessagesEnabled() {
        return this.debounceOperation('isBannerMessagesEnabled', async () => {
            // Check feature toggle first
            if (typeof SettingsManager !== 'undefined') {
                const featureEnabled = SettingsManager.isFeatureEnabled('bannerMessages');
                if (!featureEnabled) {
                    return false;
                }
            }

            // Check messages.enabled setting
            return new Promise((resolve) => {
                chrome.storage.sync.get(['exlibris'], (result) => {
                    const enabled = result.exlibris?.persistentBanner?.messages?.enabled !== false;
                    resolve(enabled);
                });
            });
        });
    },

    /**
     * Check if case data extraction is complete
     * @returns {Object} { complete: boolean, hasData: boolean, isExtracting: boolean }
     */
    isCaseDataExtractionComplete() {
        if (typeof CasePageDataExtractor === 'undefined') {
            return { complete: false, hasData: false, isExtracting: false };
        }

        const isExtracting = CasePageDataExtractor.isExtracting || false;
        const hasData = CasePageDataExtractor.lastExtractedData !== null;
        const complete = !isExtracting && hasData;

        return {
            complete: complete,
            hasData: hasData,
            isExtracting: isExtracting
        };
    },

    /**
     * Determine if all key banner fields have data
     * @returns {boolean}
     */
    isBannerDisplayComplete() {
        const hasCaseBasics = Boolean(
            this.currentPage.caseNumber &&
            this.currentPage.subject &&
            this.currentPage.status
        );

        const hasCustomerMetadata = Boolean(
            this.customerMetadata.customerId &&
            (this.customerMetadata.institutionId || this.customerMetadata.institutionCode) &&
            this.customerMetadata.server
        );

        return hasCaseBasics && hasCustomerMetadata;
    },

    /**
     * Determine if we should continue polling for case data
     * @returns {boolean}
     */
    shouldPollForCaseData() {
        if (this.currentPage.type !== 'case_page') {
            return false;
        }

        if (typeof CasePageDataExtractor === 'undefined') {
            return false;
        }

        // Only poll if we have some identifier for the case
        const hasIdentifiers = Boolean(this.displayedCaseNumber || this.displayedCaseId || this.currentCaseId);
        if (!hasIdentifiers) {
            return false;
        }

        return !this.isBannerDisplayComplete();
    },

    /**
     * Start polling for additional case data until banner display is complete
     * @param {string} reason
     */
    startCaseDataPolling(reason = 'unknown') {
        if (!this.shouldPollForCaseData()) {
            return;
        }

        if (this.caseDataPollTimer) {
            return;
        }

        this.caseDataPollAttempts = 0;
        console.log(`[PersistentBanner] Starting case data polling (${reason})`);

        this.caseDataPollTimer = setInterval(() => {
            if (!this.shouldPollForCaseData()) {
                this.stopCaseDataPolling('data-complete');
                return;
            }

            this.caseDataPollAttempts += 1;
            const forceRefresh = this.caseDataPollAttempts > 5; // escalate after several attempts
            this.requestCaseDataRefresh({
                force: forceRefresh,
                reason: `poll-attempt-${this.caseDataPollAttempts}`
            });
        }, this.CASE_DATA_POLL_INTERVAL_MS);

        this.trackTimer('interval', this.caseDataPollTimer);
        // Kick off an immediate refresh without waiting for the first interval tick
        this.requestCaseDataRefresh({ reason: 'initial-poll' });
    },

    /**
     * Stop polling for case data
     * @param {string} reason
     */
    stopCaseDataPolling(reason = 'manual') {
        if (this.caseDataPollTimer) {
            clearInterval(this.caseDataPollTimer);
            this.caseDataPollTimer = null;
            console.log(`[PersistentBanner] Stopped case data polling (${reason}) after ${this.caseDataPollAttempts} attempts`);
        }
        this.caseDataPollAttempts = 0;
    },

    /**
     * Evaluate whether to start or stop polling based on current state
     * @param {string} context
     */
    evaluateCaseDataPolling(context = 'unknown') {
        if (this.shouldPollForCaseData()) {
            this.startCaseDataPolling(context);
        } else {
            this.stopCaseDataPolling(context);
        }
    },

    /**
     * Request additional case data from CasePageDataExtractor
     * @param {Object} options
     */
    async requestCaseDataRefresh(options = {}) {
        if (typeof CasePageDataExtractor === 'undefined') {
            console.warn('[PersistentBanner] Cannot refresh case data - CasePageDataExtractor unavailable');
            return;
        }

        if (CasePageDataExtractor.isExtracting) {
            console.log('[PersistentBanner] Case data refresh skipped - extraction already in progress');
            return;
        }

        const reason = options.reason || 'poll';
        const force = Boolean(options.force);

        if (!CasePageDataExtractor.currentCaseId && typeof CasePageDataExtractor.getCaseIdFromUrl === 'function') {
            const inferredCaseId = CasePageDataExtractor.getCaseIdFromUrl();
            if (inferredCaseId) {
                CasePageDataExtractor.currentCaseId = inferredCaseId;
            } else {
                console.warn('[PersistentBanner] Cannot refresh case data - no case ID detected');
                return;
            }
        }

        try {
            console.log(`[PersistentBanner] Requesting additional case data (${reason}${force ? ', force' : ''})`);
            await CasePageDataExtractor.extractNow({ force });
        } catch (error) {
            console.error('[PersistentBanner] Error requesting case data refresh:', error);
        }
    },

    /**
     * Load messages from storage and build active messages list
     * @returns {Promise<void>}
     */
    async loadMessages() {
        if (this.messageLoadPromise) {
            return this.messageLoadPromise;
        }

        this.messageLoadPromise = this.debounceOperation('loadMessages', async () => {
            this.messagesReady = false;

            await new Promise((resolve) => {
                chrome.storage.sync.get(['exlibris'], (result) => {
                    const messagesConfig = result.exlibris?.persistentBanner?.messages;

                    if (!messagesConfig) {
                        this.activeMessages = [];
                        this.messageSettings = null;
                        this.currentMessageIndex = 0;
                        console.log('[PersistentBanner] No message configuration found in storage');
                        this.messagesReady = true;
                        resolve();
                        return;
                    }

                    this.messageSettings = messagesConfig;
                    this.activeMessages = this.getActiveMessages(messagesConfig);
                    this.currentMessageIndex = 0;
                    this.messagesReady = true;
                    console.log(`[PersistentBanner] Loaded ${this.activeMessages.length} active messages`);
                    resolve();
                });
            });
        });

        try {
            await this.messageLoadPromise;
        } finally {
            this.messageLoadPromise = null;
        }
    },

    /**
     * Get combined list of enabled messages (default + custom)
     * @param {Object} messagesConfig - Messages configuration object
     * @returns {Array} Array of message objects with text property
     */
    getActiveMessages(messagesConfig) {
        const active = [];

        // Add enabled default messages if default messages are enabled
        if (messagesConfig.defaultMessages?.enabled && messagesConfig.defaultMessages?.items) {
            messagesConfig.defaultMessages.items.forEach(msg => {
                if (msg.enabled !== false && msg.text) {
                    active.push({
                        text: msg.text,
                        id: msg.id,
                        type: 'default',
                        hoverImage: msg.hoverImage || null,
                        description: msg.description || ''
                    });
                }
            });
        }

        // Add enabled custom messages
        if (messagesConfig.customMessages && Array.isArray(messagesConfig.customMessages)) {
            messagesConfig.customMessages.forEach(msg => {
                if (msg.enabled !== false && msg.text && msg.text.trim()) {
                    active.push({
                        text: msg.text.trim(),
                        id: msg.id,
                        type: 'custom',
                        hoverImage: msg.hoverImage || null,
                        description: msg.description || ''
                    });
                }
            });
        }

        return active;
    },

    /**
     * Start message rotation timer
     */
    startMessageRotation() {
        this.stopMessageRotation(); // Clear any existing timer

        if (!this.messageSettings || !this.messageSettings.autoRotate) {
            return;
        }

        if (this.activeMessages.length <= 1) {
            return; // No need to rotate if only one or no messages
        }

        const interval = this.messageSettings.rotationInterval || 5000;

        this.messageRotationInterval = setInterval(() => {
            this.rotateToNextMessage();
        }, interval);
        this.trackTimer('interval', this.messageRotationInterval);

        console.log(`[PersistentBanner] Started message rotation (${interval}ms interval)`);
    },

    /**
     * Stop message rotation timer
     */
    stopMessageRotation() {
        if (this.messageRotationInterval) {
            clearInterval(this.messageRotationInterval);
            this.messageRotationInterval = null;
            console.log('[PersistentBanner] Stopped message rotation');
        }
    },

    /**
     * Rotate to next message
     */
    rotateToNextMessage() {
        if (this.activeMessages.length === 0) return;

        this.currentMessageIndex = (this.currentMessageIndex + 1) % this.activeMessages.length;
        this.updateMessageDisplay();
    },

    /**
     * Rotate to previous message
     */
    rotateToPreviousMessage() {
        if (this.activeMessages.length === 0) return;

        this.currentMessageIndex = (this.currentMessageIndex - 1 + this.activeMessages.length) % this.activeMessages.length;
        this.updateMessageDisplay();
    },

    /**
     * Rotate to specific message index
     * @param {number} index - Message index (0-based)
     */
    rotateToMessage(index) {
        if (this.activeMessages.length === 0) return;

        if (index >= 0 && index < this.activeMessages.length) {
            this.currentMessageIndex = index;
            this.updateMessageDisplay();
        }
    },

    /**
     * Render message with multiline support (max 3 lines)
     * Uses DOM methods for security (CSP compliant)
     * @param {string} messageText - Message text (may contain \n for line breaks)
     * @returns {string} HTML string for message display
     */
    renderMessage(messageText) {
        if (!messageText) return '';

        // Split by newlines and limit to 3 lines
        const lines = messageText.split('\n').slice(0, 3);

        // Apply dynamic spacing based on line count
        let lineClass = 'message-line';
        if (lines.length === 1) {
            lineClass = 'message-line message-line-single';
        } else if (lines.length === 2) {
            lineClass = 'message-line message-line-double';
        } else {
            lineClass = 'message-line message-line-triple';
        }

        // Escape HTML and render lines (CSP compliant)
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        return lines.map(line => {
            const escaped = escapeHtml(line.trim());
            return `<div class="${lineClass}">${escaped}</div>`;
        }).join('');
    },

    /**
     * Update message display with current message
     */
    updateMessageDisplay() {
        if (!this.elements.messageContent || !this.elements.messageIndex) return;

        if (this.activeMessages.length === 0) {
            this.elements.messageContent.innerHTML = '<div class="message-line">No messages available</div>';
            this.elements.messageIndex.textContent = '0/0';

            // Disable navigation buttons
            if (this.elements.messagePrevBtn) this.elements.messagePrevBtn.disabled = true;
            if (this.elements.messageNextBtn) this.elements.messageNextBtn.disabled = true;
            return;
        }

        const currentMessage = this.activeMessages[this.currentMessageIndex];
        if (currentMessage) {
            this.elements.messageContent.innerHTML = this.renderMessage(currentMessage.text);
            this.elements.messageIndex.textContent = `${this.currentMessageIndex + 1}/${this.activeMessages.length}`;
        }

        // Enable/disable navigation buttons
        if (this.elements.messagePrevBtn) {
            this.elements.messagePrevBtn.disabled = this.activeMessages.length <= 1;
        }
        if (this.elements.messageNextBtn) {
            this.elements.messageNextBtn.disabled = this.activeMessages.length <= 1;
        }

        // Setup hover image functionality
        this.setupHoverImage();
    },

    /**
     * Show hover image popup
     * @param {string} imageData - Base64 image data or URL
     * @param {MouseEvent} event - Mouse event for positioning
     */
    showHoverImagePopup(imageData, event) {
        this.cleanupHoverImagePopup();

        if (!imageData) return;

        const popup = document.createElement('div');
        popup.className = 'exl-hover-image-popup';
        popup.innerHTML = `<img src="${imageData}" alt="Hover image" />`;

        document.body.appendChild(popup);
        this.hoverImagePopup = popup;

        // Position popup
        const rect = event.target.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        let top = rect.top - popupRect.height - 10;
        let left = rect.left + (rect.width / 2) - (popupRect.width / 2);

        // Adjust if outside viewport
        if (top < 0) top = rect.bottom + 10;
        if (left < 0) left = 10;
        if (left + popupRect.width > window.innerWidth) {
            left = window.innerWidth - popupRect.width - 10;
        }

        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
    },

    /**
     * Setup hover image functionality for message section
     */
    setupHoverImage() {
        if (!this.elements.messageContent) return;

        const messageContent = this.elements.messageContent;
        const currentMessage = this.activeMessages[this.currentMessageIndex];

        if (!currentMessage || !currentMessage.hoverImage) {
            return;
        }

        const hoverHandler = (e) => {
            if (currentMessage.hoverImage) {
                this.showHoverImagePopup(currentMessage.hoverImage, e);
            }
        };

        const leaveHandler = () => {
            if (this.hoverImageTimeout) {
                clearTimeout(this.hoverImageTimeout);
            }
            this.hoverImageTimeout = setTimeout(() => {
                this.cleanupHoverImagePopup();
            }, 200);
        };

        this.trackListener(messageContent, 'mouseenter', hoverHandler);
        this.trackListener(messageContent, 'mouseleave', leaveHandler);
    },

    /**
     * Show context menu for message section
     * @param {MouseEvent} event - Right-click event
     * @param {string} messageId - Message ID
     */
    showContextMenu(event, messageId) {
        event.preventDefault();
        event.stopPropagation();

        this.cleanupContextMenu();

        const currentMessage = this.activeMessages.find(m => m.id === messageId) ||
            this.activeMessages[this.currentMessageIndex];

        if (!currentMessage) return;

        const hasHoverImage = !!currentMessage.hoverImage;

        const menu = document.createElement('div');
        menu.className = 'exl-message-context-menu';
        menu.innerHTML = `
            <div class="exl-context-menu-item" data-action="edit">Edit message</div>
            <div class="exl-context-menu-item" data-action="add">Add message</div>
            <div class="exl-context-menu-item" data-action="remove">Remove message</div>
            ${hasHoverImage ?
                `<div class="exl-context-menu-item" data-action="view-image">View hover image</div>
                 <div class="exl-context-menu-item" data-action="remove-image">Remove hover image</div>` :
                `<div class="exl-context-menu-item" data-action="add-image">Add hover image</div>`
            }
        `;

        document.body.appendChild(menu);
        this.contextMenu = menu;
        this.contextMenuMessageId = messageId;

        // Position menu
        const rect = menu.getBoundingClientRect();
        let top = event.clientY;
        let left = event.clientX;

        if (top + rect.height > window.innerHeight) {
            top = window.innerHeight - rect.height - 10;
        }
        if (left + rect.width > window.innerWidth) {
            left = window.innerWidth - rect.width - 10;
        }

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;

        // Handle menu clicks
        const clickHandler = (e) => {
            const item = e.target.closest('.exl-context-menu-item');
            if (!item) return;

            const action = item.dataset.action;
            this.handleContextMenuAction(action, messageId);
            this.cleanupContextMenu();
        };

        // Close on outside click
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                this.cleanupContextMenu();
            }
        };

        this.trackListener(menu, 'click', clickHandler);
        this.trackListener(document, 'click', closeHandler, true);
        this.trackListener(document, 'contextmenu', closeHandler, true);
    },

    /**
     * Handle context menu action
     * @param {string} action - Action name
     * @param {string} messageId - Message ID
     */
    async handleContextMenuAction(action, messageId) {
        switch (action) {
            case 'edit':
                await this.showEditModal(messageId);
                break;
            case 'add':
                await this.addNewMessage();
                break;
            case 'remove':
                await this.removeMessage(messageId);
                break;
            case 'add-image':
                await this.showAddImageModal(messageId);
                break;
            case 'view-image':
                await this.showViewImageModal(messageId);
                break;
            case 'remove-image':
                await this.removeHoverImage(messageId);
                break;
        }
    },

    /**
     * Show edit message modal
     * @param {string} messageId - Message ID
     */
    async showEditModal(messageId) {
        this.cleanupModals();

        const message = this.activeMessages.find(m => m.id === messageId) ||
            this.activeMessages[this.currentMessageIndex];

        if (!message) return;

        const modal = document.createElement('div');
        modal.className = 'exl-edit-message-modal';
        modal.innerHTML = `
            <div class="exl-modal-overlay"></div>
            <div class="exl-modal-content">
                <div class="exl-modal-header">
                    <h3>Edit Message</h3>
                    <button class="exl-modal-close" data-action="close">×</button>
                </div>
                <div class="exl-modal-body">
                    <label>Message Text:</label>
                    <textarea id="exl-edit-message-text" rows="3" maxlength="240">${this.escapeHtml(message.text || '')}</textarea>
                    <label>Description (optional):</label>
                    <textarea id="exl-edit-message-desc" rows="5" placeholder="Add notes or description...">${this.escapeHtml(message.description || '')}</textarea>
                    ${message.hoverImage ? `<div class="exl-hover-image-preview"><img src="${message.hoverImage}" alt="Hover image" /></div>` : ''}
                </div>
                <div class="exl-modal-footer">
                    <button class="exl-btn-secondary" data-action="cancel">Cancel</button>
                    <button class="exl-btn-primary" data-action="save">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.editModal = modal;

        // Setup paste handler for description
        const descTextarea = modal.querySelector('#exl-edit-message-desc');
        if (descTextarea) {
            this.trackListener(descTextarea, 'paste', async (e) => {
                const items = e.clipboardData?.items;
                if (!items) return;

                for (let item of items) {
                    if (item.type.indexOf('image') !== -1) {
                        e.preventDefault();
                        const file = item.getAsFile();
                        const base64 = await this.fileToBase64(file);
                        if (base64) {
                            const img = document.createElement('img');
                            img.src = base64;
                            img.style.maxWidth = '100%';
                            descTextarea.value += `\n[Image: ${base64.substring(0, 50)}...]`;
                        }
                    }
                }
            });
        }

        // Handle modal actions
        const actionHandler = (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            if (action === 'save') {
                this.saveEditedMessage(messageId, modal);
            } else {
                this.cleanupModals();
            }
        };

        this.trackListener(modal, 'click', actionHandler);
    },

    /**
     * Save edited message
     * @param {string} messageId - Message ID
     * @param {Element} modal - Modal element
     */
    async saveEditedMessage(messageId, modal) {
        const text = modal.querySelector('#exl-edit-message-text')?.value.trim() || '';
        const description = modal.querySelector('#exl-edit-message-desc')?.value.trim() || '';

        if (!text) {
            alert('Message text cannot be empty');
            return;
        }

        // Update message in settings
        try {
            await this.debounceOperation('saveEditedMessage', async () => {
                let settings = null;
                if (typeof SettingsManager !== 'undefined') {
                    settings = SettingsManager.get();
                } else {
                    throw new Error('SettingsManager not available');
                }

                const messagesConfig = settings.exlibris?.persistentBanner?.messages;

                if (messagesConfig) {
                    // Update in custom messages
                    const customIndex = messagesConfig.customMessages?.findIndex(m => m.id === messageId);
                    if (customIndex !== undefined && customIndex >= 0) {
                        messagesConfig.customMessages[customIndex].text = text;
                        messagesConfig.customMessages[customIndex].description = description;
                    } else {
                        // Update in default messages
                        const defaultIndex = messagesConfig.defaultMessages?.items?.findIndex(m => m.id === messageId);
                        if (defaultIndex !== undefined && defaultIndex >= 0) {
                            messagesConfig.defaultMessages.items[defaultIndex].text = text;
                            messagesConfig.defaultMessages.items[defaultIndex].description = description;
                        }
                    }

                    await SettingsManager.save(settings);
                    await this.loadMessages();
                    this.updateMessageDisplay();
                    this.setupHoverImage();
                    this.cleanupModals();
                }
            });
        } catch (error) {
            console.error('[PersistentBanner] Error saving message:', error);
            alert('Error saving message');
        }
    },

    /**
     * Show view image modal
     * @param {string} messageId - Message ID
     */
    async showViewImageModal(messageId) {
        this.cleanupModals();

        const message = this.activeMessages.find(m => m.id === messageId) ||
            this.activeMessages[this.currentMessageIndex];

        if (!message || !message.hoverImage) return;

        const modal = document.createElement('div');
        modal.className = 'exl-view-image-modal';
        modal.innerHTML = `
            <div class="exl-modal-overlay"></div>
            <div class="exl-modal-content exl-image-content">
                <button class="exl-modal-close" data-action="close">×</button>
                <img src="${message.hoverImage}" alt="Hover image" />
            </div>
        `;

        document.body.appendChild(modal);
        this.viewImageModal = modal;

        const closeHandler = (e) => {
            if (e.target.closest('[data-action="close"]') || e.target.classList.contains('exl-modal-overlay')) {
                this.cleanupModals();
            }
        };

        this.trackListener(modal, 'click', closeHandler);
    },

    /**
     * Show add image modal
     * @param {string} messageId - Message ID
     */
    async showAddImageModal(messageId) {
        // This will be handled by popup UI, but we can show a simple prompt here
        const url = prompt('Enter image URL or leave empty to upload file:');
        if (url) {
            await this.setHoverImage(messageId, url);
        } else {
            // File upload would be handled by popup
            alert('Please use the popup settings to upload image files');
        }
    },

    /**
     * Set hover image for message
     * @param {string} messageId - Message ID
     * @param {string} imageData - Base64 or URL
     */
    async setHoverImage(messageId, imageData) {
        try {
            await this.debounceOperation('setHoverImage', async () => {
                let settings = null;
                if (typeof SettingsManager !== 'undefined') {
                    settings = SettingsManager.get();
                } else {
                    throw new Error('SettingsManager not available');
                }

                const messagesConfig = settings.exlibris?.persistentBanner?.messages;

                if (messagesConfig) {
                    const customIndex = messagesConfig.customMessages?.findIndex(m => m.id === messageId);
                    if (customIndex !== undefined && customIndex >= 0) {
                        messagesConfig.customMessages[customIndex].hoverImage = imageData;
                    } else {
                        const defaultIndex = messagesConfig.defaultMessages?.items?.findIndex(m => m.id === messageId);
                        if (defaultIndex !== undefined && defaultIndex >= 0) {
                            messagesConfig.defaultMessages.items[defaultIndex].hoverImage = imageData;
                        }
                    }

                    await SettingsManager.save(settings);
                    await this.loadMessages();
                    this.updateMessageDisplay();
                    this.setupHoverImage();
                }
            });
        } catch (error) {
            console.error('[PersistentBanner] Error setting hover image:', error);
            alert('Error setting hover image');
        }
    },

    /**
     * Remove hover image from message
     * @param {string} messageId - Message ID
     */
    async removeHoverImage(messageId) {
        await this.setHoverImage(messageId, null);
    },

    /**
     * Add new message
     */
    async addNewMessage() {
        try {
            await this.debounceOperation('addNewMessage', async () => {
                let settings = null;
                if (typeof SettingsManager !== 'undefined') {
                    settings = SettingsManager.get();
                } else {
                    throw new Error('SettingsManager not available');
                }

                const messagesConfig = settings.exlibris?.persistentBanner?.messages;

                if (messagesConfig) {
                    const newId = 'custom_' + Date.now();
                    const newMessage = {
                        id: newId,
                        text: 'New message - click to edit',
                        enabled: true,
                        hoverImage: null,
                        description: ''
                    };

                    if (!messagesConfig.customMessages) {
                        messagesConfig.customMessages = [];
                    }
                    messagesConfig.customMessages.push(newMessage);

                    await SettingsManager.save(settings);
                    await this.loadMessages();
                    this.updateMessageDisplay();
                }
            });
        } catch (error) {
            console.error('[PersistentBanner] Error adding message:', error);
            alert('Error adding message');
        }
    },

    /**
     * Remove message with confirmation
     * @param {string} messageId - Message ID
     */
    async removeMessage(messageId) {
        const message = this.activeMessages.find(m => m.id === messageId);
        const messageText = message?.text || 'this message';

        if (!confirm(`Are you sure you want to remove "${messageText}"?`)) {
            return;
        }

        try {
            await this.debounceOperation('removeMessage', async () => {
                let settings = null;
                if (typeof SettingsManager !== 'undefined') {
                    settings = SettingsManager.get();
                } else {
                    throw new Error('SettingsManager not available');
                }

                const messagesConfig = settings.exlibris?.persistentBanner?.messages;

                if (messagesConfig) {
                    // Remove from custom messages
                    if (messagesConfig.customMessages) {
                        messagesConfig.customMessages = messagesConfig.customMessages.filter(m => m.id !== messageId);
                    }

                    // Cannot remove default messages, only disable
                    const defaultIndex = messagesConfig.defaultMessages?.items?.findIndex(m => m.id === messageId);
                    if (defaultIndex !== undefined && defaultIndex >= 0) {
                        messagesConfig.defaultMessages.items[defaultIndex].enabled = false;
                    }

                    await SettingsManager.save(settings);
                    await this.loadMessages();
                    this.updateMessageDisplay();
                }
            });
        } catch (error) {
            console.error('[PersistentBanner] Error removing message:', error);
            alert('Error removing message');
        }
    },

    /**
     * Convert file to base64
     * @param {File} file - File object
     * @returns {Promise<string>} Base64 string
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            // Check file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                reject(new Error('File size exceeds 2MB limit'));
                return;
            }

            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Escape HTML
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Check if should show messages (feature enabled + not case page/comments)
     * Explicitly excludes case pages and case comments - these pages have their own data
     * @returns {Promise<boolean>}
     */
    async shouldShowMessages() {
        return this.debounceOperation('shouldShowMessages', async () => {
            if (!this.messagesReady) {
                await this.loadMessages();
            }

            // FIRST: Explicit early return for case pages and case comments
            // These pages NEVER show messages - they have their own data to display
            const pageType = this.currentPage.type; // Should be raw type after normalization
            const isCasePage = pageType === 'case_page';
            const isCaseComments = pageType === 'case_comments';

            // Check if showOnCasePages is enabled
            let settings = null;
            if (typeof SettingsManager !== 'undefined') {
                settings = SettingsManager.get();
            }
            const showOnCasePages = settings?.exlibris?.persistentBanner?.messages?.showOnCasePages;

            if ((isCasePage || isCaseComments) && !showOnCasePages) {
                console.log('[PersistentBanner] Case page/comments detected - messages will NOT be shown');
                return false;
            }

            // Check if feature is enabled
            const featureEnabled = await this.isBannerMessagesEnabled();
            if (!featureEnabled) {
                return false;
            }

            // Check if we have active messages
            if (this.activeMessages.length === 0) {
                return false;
            }

            // All checks passed - can show messages
            return true;
        });
    },

    /**
     * Track event listener for cleanup
     * @param {Element} element - Element to attach listener to
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Optional addEventListener options
     */
    trackListener(element, event, handler, options) {
        if (!element || !event || !handler) return;
        element.addEventListener(event, handler, options);
        this.trackedListeners.push({ element, event, handler, options });
    },

    /**
     * Track MutationObserver for cleanup
     * @param {MutationObserver} observer - Observer instance
     */
    trackObserver(observer) {
        if (observer) {
            this.trackedObservers.push(observer);
        }
    },

    /**
     * Track timer for cleanup
     * @param {string} type - 'interval' or 'timeout'
     * @param {number} id - Timer ID
     */
    trackTimer(type, id) {
        if (id) {
            this.trackedTimers.push({ type, id });
        }
    },

    /**
     * Cleanup all tracked resources
     */
    cleanupTrackedResources() {
        this.stopCaseDataPolling('cleanup');
        // Remove all tracked event listeners
        this.trackedListeners.forEach(({ element, event, handler, options }) => {
            try {
                if (element && element.removeEventListener) {
                    element.removeEventListener(event, handler, options);
                }
            } catch (error) {
                console.warn('[PersistentBanner] Error removing listener:', error);
            }
        });
        this.trackedListeners = [];

        // Disconnect all tracked observers
        this.trackedObservers.forEach(observer => {
            try {
                if (observer && observer.disconnect) {
                    observer.disconnect();
                }
            } catch (error) {
                console.warn('[PersistentBanner] Error disconnecting observer:', error);
            }
        });
        this.trackedObservers = [];

        // Clear all tracked timers
        this.trackedTimers.forEach(({ type, id }) => {
            try {
                if (type === 'interval') {
                    clearInterval(id);
                } else if (type === 'timeout') {
                    clearTimeout(id);
                }
            } catch (error) {
                console.warn('[PersistentBanner] Error clearing timer:', error);
            }
        });
        this.trackedTimers = [];

        // Clear URL change debounce timer
        if (this.urlChangeDebounceTimer) {
            clearTimeout(this.urlChangeDebounceTimer);
            this.urlChangeDebounceTimer = null;
        }

        // Cleanup hover image popup
        this.cleanupHoverImagePopup();

        // Cleanup context menu
        this.cleanupContextMenu();

        // Cleanup modals
        this.cleanupModals();
    },

    /**
     * Cleanup hover image popup
     */
    cleanupHoverImagePopup() {
        if (this.hoverImageTimeout) {
            clearTimeout(this.hoverImageTimeout);
            this.hoverImageTimeout = null;
        }
        if (this.hoverImagePopup) {
            try {
                this.hoverImagePopup.remove();
            } catch (error) {
                console.warn('[PersistentBanner] Error removing hover popup:', error);
            }
            this.hoverImagePopup = null;
        }
    },

    /**
     * Cleanup context menu
     */
    cleanupContextMenu() {
        if (this.contextMenu) {
            try {
                this.contextMenu.remove();
            } catch (error) {
                console.warn('[PersistentBanner] Error removing context menu:', error);
            }
            this.contextMenu = null;
        }
        this.contextMenuMessageId = null;
    },

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

        const visiblePanels = [];
        for (const selector of panelSelectors) {
            const allPanels = document.querySelectorAll(selector);
            for (const panel of allPanels) {
                if (this.isElementVisible(panel)) {
                    visiblePanels.push(panel);
                    console.log('[PersistentBanner] Found visible case details panel:', selector);
                }
            }
        }

        if (visiblePanels.length === 0) {
            console.warn('[PersistentBanner] No visible case details panel found');
            // Still try to extract basic metadata from URL/title
        }

        // Extract Case Number from first visible panel
        let caseNumber = '';
        for (const panel of visiblePanels) {
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
                    console.warn('[PersistentBanner] Metadata validation failed, returning null');
                    return null;
                }

                // Use validated metadata (ensures caseId and caseNumber match current page)
                metadata.caseId = validatedMetadata.caseId || metadata.caseId;
                metadata.caseNumber = validatedMetadata.caseNumber || metadata.caseNumber;
                console.log('[PersistentBanner] Metadata validated successfully');
            } catch (error) {
                console.error('[PersistentBanner] Error during metadata validation:', error);
                // On validation error, still return metadata but log the error
                // This provides graceful degradation
            }
        } else {
            // Fallback: Simple validation if PageContextValidator not available
            if (!metadata.caseId) {
                console.warn('[PersistentBanner] No case ID available, cannot validate');
                return null;
            }
        }

        // If no visible panels found, return basic metadata
        if (visiblePanels.length === 0) {
            console.warn('[PersistentBanner] No visible panels, returning basic metadata only');
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
        for (const panel of visiblePanels) {
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
                // Skip PersistentBanner's own elements (if any match the selector)
                if (item.closest(`#${this.bannerId}`)) {
                    return;
                }

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

        console.log('[PersistentBanner] Extracted metadata from', visiblePanels.length, 'visible panel(s):', metadata);
        return metadata;
    },

    /**
     * Get debounced delay for an operation based on failure history
     * Exponential backoff: baseDelay * (2 ^ failureCount)
     * @param {string} operationName - Name of the operation
     * @returns {number} Delay in milliseconds
     */
    getDebounceDelay(operationName) {
        const state = this.debounceState.operations.get(operationName) || { failureCount: 0 };
        const delay = Math.min(
            this.baseDebounceDelay * Math.pow(2, state.failureCount),
            this.maxDebounceDelay
        );
        return delay;
    },

    /**
     * Record operation success - reset failure count
     * @param {string} operationName
     */
    recordOperationSuccess(operationName) {
        const state = this.debounceState.operations.get(operationName) || { failureCount: 0 };
        state.failureCount = 0;
        state.lastSuccessTime = Date.now();
        this.debounceState.operations.set(operationName, state);
    },

    /**
     * Record operation failure - increment failure count
     * @param {string} operationName
     */
    recordOperationFailure(operationName) {
        const state = this.debounceState.operations.get(operationName) || { failureCount: 0 };
        state.failureCount = (state.failureCount || 0) + 1;
        state.lastFailureTime = Date.now();
        this.debounceState.operations.set(operationName, state);
    },

    /**
     * Debounce an async operation with exponential backoff
     * @param {string} operationName - Unique name for the operation
     * @param {Function} operation - Async function to execute
     * @returns {Promise} Debounced operation result
     */
    async debounceOperation(operationName, operation) {
        const delay = this.getDebounceDelay(operationName);

        // Wait for debounce delay
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        try {
            const result = await operation();
            this.recordOperationSuccess(operationName);
            return result;
        } catch (error) {
            this.recordOperationFailure(operationName);
            throw error;
        }
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
     * Cleanup modals
     */
    cleanupModals() {
        if (this.editModal) {
            try {
                this.editModal.remove();
            } catch (error) {
                console.warn('[PersistentBanner] Error removing edit modal:', error);
            }
            this.editModal = null;
        }
        if (this.viewImageModal) {
            try {
                this.viewImageModal.remove();
            } catch (error) {
                console.warn('[PersistentBanner] Error removing view image modal:', error);
            }
            this.viewImageModal = null;
        }
    },

    /**
     * Clean up
     * Follows best practices: restore layout adjustments, proper cleanup order
     */
    cleanup() {
        // Restore Salesforce layout adjustments BEFORE removing banner
        // This prevents leaving an unpleasant gap
        this.applySalesforceLayoutAdjustments(false);

        // Clear data reception timeout
        if (this.dataReceptionTimeout) {
            clearTimeout(this.dataReceptionTimeout);
            this.dataReceptionTimeout = null;
        }

        // Stop periodic validation
        this.stopPeriodicValidation();

        this.stopUrlMonitoring();
        this.stopMessageRotation();

        // Cleanup all tracked resources (listeners, observers, timers, popups, modals)
        this.cleanupTrackedResources();

        this.remove();
        this.isInitialized = false;
        console.log('[PersistentBanner] Cleaned up');
    },

    /**
     * Populate environment buttons with Production and Sandbox links
     */
    populateEnvButtons() {
        if (!this.elements.envButtonsContainer) return;

        const { server, institutionId, institutionCode, productServiceName } = this.customerMetadata;
        const resolvedInstitution = institutionCode || institutionId;

        if (!server || !resolvedInstitution) {
            console.warn('[PersistentBanner] Missing server or institution code for environment buttons');
            return;
        }

        const buttonsHtml = [];

        // Production Back Office button
        buttonsHtml.push(`
            <button class="exl-banner-btn exl-env-btn" 
                    data-env-url="https://${server}.alma.exlibrisgroup.com/esploro/?institution=${resolvedInstitution}"
                    title="Open Production Back Office">
                <span class="exl-env-label">Prod</span> Back Office
            </button>
        `);

        // Production Live View button
        buttonsHtml.push(`
            <button class="exl-banner-btn exl-env-btn" 
                    data-env-url="https://${server}.alma.exlibrisgroup.com/mng/login?institute=${resolvedInstitution}&productCode=esploro&debug=true"
                    title="Open Production Live View">
                <span class="exl-env-label">Prod</span> Live View
            </button>
        `);

        // SQA Environment buttons (always available)
        buttonsHtml.push(`
            <button class="exl-banner-btn exl-env-btn" 
                    data-env-url="https://sqa-${server}.alma.exlibrisgroup.com/esploro/?institution=${resolvedInstitution}"
                    title="Open SQA Back Office">
                <span class="exl-env-label">SQA</span> Back Office
            </button>
        `);

        buttonsHtml.push(`
            <button class="exl-banner-btn exl-env-btn" 
                    data-env-url="https://sqa-${server}.alma.exlibrisgroup.com/mng/login?institute=${resolvedInstitution}&productCode=esploro&debug=true"
                    title="Open SQA Live View">
                <span class="exl-env-label">SQA</span> Live View
            </button>
        `);

        // Sandbox buttons - depends on product type
        if (productServiceName) {
            if (productServiceName.includes('esploro advanced')) {
                // Premium Sandbox Back Office
                buttonsHtml.push(`
                    <button class="exl-banner-btn exl-env-btn" 
                            data-env-url="https://psb-${server}.alma.exlibrisgroup.com/esploro/?institution=${resolvedInstitution}"
                            title="Open Premium Sandbox Back Office">
                        <span class="exl-env-label">PSB</span> Back Office
                    </button>
                `);

                // Premium Sandbox Live View
                buttonsHtml.push(`
                    <button class="exl-banner-btn exl-env-btn" 
                            data-env-url="https://psb-${server}.alma.exlibrisgroup.com/mng/login?institute=${resolvedInstitution}&productCode=esploro&debug=true"
                            title="Open Premium Sandbox Live View">
                        <span class="exl-env-label">PSB</span> Live View
                    </button>
                `);
            } else if (productServiceName.includes('esploro standard')) {
                // Standard Sandbox Back Office
                buttonsHtml.push(`
                    <button class="exl-banner-btn exl-env-btn" 
                            data-env-url="https://sb-${server}.alma.exlibrisgroup.com/esploro/?institution=${resolvedInstitution}"
                            title="Open Sandbox Back Office">
                        <span class="exl-env-label">SB</span> Back Office
                    </button>
                `);

                // Standard Sandbox Live View
                buttonsHtml.push(`
                    <button class="exl-banner-btn exl-env-btn" 
                            data-env-url="https://sb-${server}.alma.exlibrisgroup.com/mng/login?institute=${resolvedInstitution}&productCode=esploro&debug=true"
                            title="Open Sandbox Live View">
                        <span class="exl-env-label">SB</span> Live View
                    </button>
                `);
            }
        }

        this.elements.envButtonsContainer.innerHTML = buttonsHtml.join('');
    },

    /**
     * Toggle environment menu visibility
     */
    toggleEnvMenu() {
        if (!this.elements.envSection || !this.elements.envToggleBtn) return;

        this.envMenuVisible = !this.envMenuVisible;

        if (this.envMenuVisible) {
            // Show environment buttons
            this.elements.envSection.style.display = 'flex';
            this.elements.envToggleBtn.textContent = '◀ Return to Menu';
            console.log('[PersistentBanner] Environment menu opened');
        } else {
            // Hide environment buttons
            this.elements.envSection.style.display = 'none';
            this.elements.envToggleBtn.textContent = 'Go to Customer Env ▶';
            console.log('[PersistentBanner] Environment menu closed');
        }

        this.updateSectionOverflowStates();
    },
};
