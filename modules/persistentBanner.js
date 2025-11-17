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
    currentCaseNumber: null,

    // Case number validation state
    caseNumberValidationTimer: null,
    caseNumberValidationAttempts: 0,
    MAX_CASE_VALIDATION_ATTEMPTS: 6,
    
    // Current page info
    currentPage: {
        type: 'Unknown',
        caseNumber: null,
        subject: null,
        status: null,
        subStatus: null
    },

    // Customer metadata from CasePageDataExtractor
    customerMetadata: {
        customerId: null,
        institutionId: null,
        server: null,
        productServiceName: null,
        institutionCode: null
    },

    // URL monitoring
    lastKnownUrl: null,

    // Environment menu state
    envMenuVisible: false,

    // Status color mapping (based on caseStatusHighlighter)
    STATUS_COLORS: {
        // Red statuses - 2 shades darker from rgb(178, 15, 66)
        'New Email Received': { base: 'rgb(107, 9, 40)', category: 'red' },
        'Re-opened': { base: 'rgb(107, 9, 40)', category: 'red' },
        'Reopened': { base: 'rgb(107, 9, 40)', category: 'red' },
        'Completed by Resolver Group': { base: 'rgb(107, 9, 40)', category: 'red' },
        'New': { base: 'rgb(107, 9, 40)', category: 'red' },
        'Update Received': { base: 'rgb(107, 9, 40)', category: 'red' },
        
        // Orange statuses - 2 shades darker from rgb(171, 46, 1)
        'Pending Action': { base: 'rgb(103, 28, 1)', category: 'orange' },
        'Initial Response Sent': { base: 'rgb(103, 28, 1)', category: 'orange' },
        'In Progress': { base: 'rgb(103, 28, 1)', category: 'orange' },
        
        // Purple statuses - 2 shades darker from rgb(100, 49, 179)
        'Assigned to Resolver Group': { base: 'rgb(60, 29, 107)', category: 'purple' },
        'Pending Internal Response': { base: 'rgb(60, 29, 107)', category: 'purple' },
        'Pending AM Response': { base: 'rgb(60, 29, 107)', category: 'purple' },
        'Pending QA Review': { base: 'rgb(60, 29, 107)', category: 'purple' },
        'Pending': { base: 'rgb(60, 29, 107)', category: 'purple' },
        
        // Green statuses - 2 shades darker from rgb(0, 100, 0)
        'Solution Delivered to Customer': { base: 'rgb(0, 60, 0)', category: 'green' },
        'Closed': { base: 'rgb(0, 60, 0)', category: 'green' },
        'Awaiting Customer Confirmation': { base: 'rgb(0, 60, 0)', category: 'green' },
        
        // Blue statuses - 2 shades darker from rgb(13, 83, 173)
        'Closed': { base: 'rgb(8, 50, 104)', category: 'blue' },
        'Pending Customer Response': { base: 'rgb(8, 50, 104)', category: 'blue' },
        
        // Yellow statuses - 2 shades darker from rgb(175, 96, 5)
        'Pending System Update - Defect': { base: 'rgb(105, 58, 3)', category: 'yellow' },
        'Pending System Update - Enhancement': { base: 'rgb(105, 58, 3)', category: 'yellow' },
        'Pending System Update - Other': { base: 'rgb(105, 58, 3)', category: 'yellow' }
    },

    // Default banner gradient (for non-case pages)
    DEFAULT_GRADIENT: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',

    // DOM selectors for case navigation elements
    SELECTORS: {
        RECORD_LAYOUT_BROKER: 'one-record-home-flexipage2',
        CONTEXT_BAR_TABS: '.slds-context-bar__item'
    },

    /**
     * Initialize the persistent banner
     */
    init() {
        if (this.isInitialized) {
            console.log('[PersistentBanner] Already initialized');
            return;
        }

        console.log('[PersistentBanner] Initializing...');
        
        // Load navigation history from sessionStorage
        this.loadNavigationHistory();
        
        // Create and inject banner
        this.createBanner();
        
        // Observe DOM for the right injection point
        this.observeForInjection();
        
        // Start URL monitoring to detect navigation changes
        this.startUrlMonitoring();
        
        // Listen for CasePageDataExtractor events
        this.setupCaseDataListener();
        
        this.isInitialized = true;
        console.log('[PersistentBanner] Initialized');
    },

    /**
     * Setup listener for CasePageDataExtractor events
     */
    setupCaseDataListener() {
        document.addEventListener('casePageDataExtracted', (event) => {
            const data = event.detail;
            console.log('[PersistentBanner] Received case page data from CasePageDataExtractor:', data);
            
            const newCaseNumber = data.caseNumber || null;
            const newCaseId = data.caseId || null;

            // CRITICAL: Verify extracted data matches the currently visible case number
            const visibleCase = this.getVisibleCaseNumberFromDom();
            if (visibleCase && visibleCase.caseNumber && newCaseNumber && visibleCase.caseNumber !== newCaseNumber) {
                console.warn(`[PersistentBanner] MISMATCH: Extracted case number ${newCaseNumber} does NOT match visible case ${visibleCase.caseNumber}. Ignoring stale data.`);
                // Schedule revalidation to pick up the correct visible case
                this.scheduleCaseNumberRevalidation('data-mismatch-detected', 500);
                return;
            }

            if (this.currentCaseNumber && newCaseNumber && this.currentCaseNumber !== newCaseNumber) {
                console.log(`[PersistentBanner] Navigated from case ${this.currentCaseNumber} to ${newCaseNumber}, clearing old data...`);
                this.clearCaseData();
            }

            if (newCaseId) {
                this.currentCaseId = newCaseId;
            }

            this.currentCaseNumber = newCaseNumber;
            
            // Update customer metadata from extracted data
            // CasePageDataExtractor now enriches data with custID, instID, server from CustomerDataManager
            this.customerMetadata = {
                customerId: data.custID || null,  // 4-digit customer ID
                institutionId: data.instID || null,  // 4-digit institution ID
                server: data.server || null,  // Server code (ap02, na05, etc.)
                productServiceName: data.platformService || null,  // Platform/Service with fallback
                institutionCode: data.institutionCode || data.exLibrisAccountNumber || null  // Use proper institution code from customer list, fallback to case field
            };
            
            console.log('[PersistentBanner] Updated customer metadata:', this.customerMetadata);
            
            // Update current page status from direct page data (for gradient coloring)
            if (data.pageStatus) {
                this.currentPage.status = data.pageStatus;
                console.log('[PersistentBanner] Updated status from page data:', data.pageStatus);
            }
            
            const pageType = this.isCasePageType(this.currentPage.type) ? this.currentPage.type : 'Case';
            this.updateCurrentPage({
                type: pageType,
                caseNumber: newCaseNumber,
                subject: data.subject,
                status: data.status || data.pageStatus || null,
                subStatus: data.subStatus || null
            });
        });
        
        console.log('[PersistentBanner] CasePageDataExtractor listener registered');
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
     * Start monitoring URL changes using NavigationObserver
     */
    startUrlMonitoring() {
        this.lastKnownUrl = window.location.href;
        
        // Use NavigationObserver for immediate URL change detection
        if (typeof NavigationObserver !== 'undefined') {
            console.log('[PersistentBanner] Setting up URL monitoring with NavigationObserver');
            NavigationObserver.onRouteChange((newUrl) => {
                if (newUrl.toLowerCase() !== this.lastKnownUrl.toLowerCase()) {
                    console.log('[PersistentBanner] URL changed:', newUrl, 'from ' + this.lastKnownUrl);
                    this.lastKnownUrl = newUrl;
                    this.handleUrlChange(newUrl);
                }
            });
            console.log('[PersistentBanner] URL monitoring started (using NavigationObserver)');
        } else {
            console.warn('[PersistentBanner] NavigationObserver not available');
        }

        // Setup click listeners for case navigation elements
        this.setupCaseNavigationListeners();
    },

    /**
     * Setup click listeners for case navigation elements
     */
    setupCaseNavigationListeners() {
        // Safety check: ensure SELECTORS is defined
        if (!this.SELECTORS) {
            console.warn('[PersistentBanner] SELECTORS not available, skipping navigation listeners setup');
            return;
        }

        const listeners = [
            { selector: this.SELECTORS.RECORD_LAYOUT_BROKER, label: 'Case tabs' },
            { selector: this.SELECTORS.CONTEXT_BAR_TABS, label: 'Case main view' }
        ];

        listeners.forEach(({ selector, label }) => {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    element.addEventListener('click', (event) => {
                        console.log(`[PersistentBanner] ${label} clicked:`, event);
                        // Add any specific handling logic here if needed
                    });
                    console.log(`[PersistentBanner] Click listener added for ${label}`);
                } else {
                    console.log(`[PersistentBanner] Element not found for ${label} (${selector})`);
                }
            } catch (error) {
                console.warn(`[PersistentBanner] Error setting up listener for ${label}:`, error);
            }
        });
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
        this.currentCaseNumber = null;
        this.resetCaseNumberValidationState();
        
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
     * @param {Object} pageInfo
     */
    addToNavigationHistory(pageInfo) {
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
     * @param {Object} pageData
     */
    updateCurrentPage(pageData = {}) {
        const resolvedType = pageData.type || this.currentPage.type || 'Unknown';
        const hasCaseNumber = Object.prototype.hasOwnProperty.call(pageData, 'caseNumber');
        const hasSubject = Object.prototype.hasOwnProperty.call(pageData, 'subject');
        const hasStatus = Object.prototype.hasOwnProperty.call(pageData, 'status');
        const hasSubStatus = Object.prototype.hasOwnProperty.call(pageData, 'subStatus');

        let incomingCaseNumber = hasCaseNumber ? pageData.caseNumber : this.currentPage.caseNumber;
        if (typeof incomingCaseNumber === 'string') {
            incomingCaseNumber = incomingCaseNumber.trim();
        }
        let resolvedCaseNumber = incomingCaseNumber || null;

        const resolvedSubject = hasSubject ? pageData.subject : this.currentPage.subject;
        const resolvedStatus = hasStatus ? pageData.status : this.currentPage.status;
        const resolvedSubStatus = hasSubStatus ? pageData.subStatus : this.currentPage.subStatus;

        const isCasePage = this.isCasePageType(resolvedType);
        let needsRevalidation = false;

        if (isCasePage) {
            const visibleCase = this.getVisibleCaseNumberFromDom();
            if (visibleCase && visibleCase.caseNumber) {
                if (resolvedCaseNumber && resolvedCaseNumber !== visibleCase.caseNumber) {
                    console.log(`[PersistentBanner] Case number mismatch (data: ${resolvedCaseNumber}, visible: ${visibleCase.caseNumber}). Using visible value.`);
                }
                resolvedCaseNumber = visibleCase.caseNumber;
                this.resetCaseNumberValidationState();
            } else {
                needsRevalidation = true;
            }
        } else {
            this.resetCaseNumberValidationState();
        }

        this.currentPage = {
            type: resolvedType,
            caseNumber: resolvedCaseNumber || null,
            subject: resolvedSubject || null,
            status: resolvedStatus || null,
            subStatus: resolvedSubStatus || null,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        this.currentCaseNumber = this.currentPage.caseNumber;

        console.log('[PersistentBanner] Updated current page:', this.currentPage);
        
        // Update UI
        this.updateBannerUI();
        
        // Add to navigation history
        this.addToNavigationHistory({
            type: this.currentPage.type,
            caseNumber: this.currentPage.caseNumber,
            subject: this.currentPage.subject,
            url: this.currentPage.url,
            timestamp: this.currentPage.timestamp
        });

        if (isCasePage && needsRevalidation) {
            this.scheduleCaseNumberRevalidation('updateCurrentPage');
        }
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
                    <div class="exl-banner-label">Current Page</div>
                    <div class="exl-banner-page-type" id="exl-banner-page-type">—</div>
                </div>
                
                <div class="exl-banner-section exl-banner-metadata">
                    <div class="exl-banner-label">Primary Metadata</div>
                    <div class="exl-banner-metadata-grid" id="exl-banner-metadata">
                        <span class="exl-banner-meta-item" id="exl-banner-case-item">Case: <strong id="exl-banner-case">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-subject-item">Subject: <strong id="exl-banner-subject">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-status-item">Status: <strong id="exl-banner-status">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-substatus-item">Substatus: <strong id="exl-banner-substatus">—</strong></span>
                        <span class="exl-banner-meta-item">Product: <strong id="exl-banner-product">—</strong></span>
                        <span class="exl-banner-meta-item">InstCode: <strong id="exl-banner-instcode">—</strong></span>
                        <span class="exl-banner-meta-item">CustID: <strong id="exl-banner-custid">—</strong></span>
                        <span class="exl-banner-meta-item">InstID: <strong id="exl-banner-instid">—</strong></span>
                        <span class="exl-banner-meta-item">Server: <strong id="exl-banner-server">—</strong></span>
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
                    <button class="exl-banner-btn" data-action="action1" title="Extract and enable copy buttons for case comments">Extract Comments</button>
                    <button class="exl-banner-btn" data-action="action2" title="Show or update the Flexipage panel in case pages">Show Panel</button>
                    <button class="exl-banner-btn" data-action="action3" title="Copy case details as XML or TSV">Copy Details</button>
                </div>
                
                <div class="exl-banner-section exl-banner-history">
                    <div class="exl-banner-label">Navigation History</div>
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
        this.elements.status = banner.querySelector('#exl-banner-status');
        this.elements.subStatus = banner.querySelector('#exl-banner-substatus');
        this.elements.caseItem = banner.querySelector('#exl-banner-case-item');
        this.elements.subjectItem = banner.querySelector('#exl-banner-subject-item');
        this.elements.statusItem = banner.querySelector('#exl-banner-status-item');
        this.elements.substatusItem = banner.querySelector('#exl-banner-substatus-item');
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
    },

    /**
     * Handle button actions
     * @param {string} action
     */
    handleAction(action) {
        console.log('[PersistentBanner] Action triggered:', action);
        
        switch (action) {
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
     * Handle case comment extractor action
     */
    async handleCaseCommentExtractor() {
        // Check if we're on a case page
        if (this.currentPage.type !== 'Case' || !this.currentPage.caseNumber) {
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
        if (this.currentPage.type !== 'Case' || !this.currentPage.caseNumber) {
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
                
                // Step 5: Initialize CaseTimezoneResolver with account name
                // Wait for panel to be fully rendered before initializing timezone resolver
                if (typeof CaseTimezoneResolver !== 'undefined' && caseData.accountName) {
                    setTimeout(async () => {
                        console.log('[PersistentBanner] Initializing CaseTimezoneResolver for account:', caseData.accountName);
                        await CaseTimezoneResolver.init(caseData.accountName);
                    }, 1000); // 1 second delay to ensure panel DOM is fully ready
                } else if (!caseData.accountName) {
                    console.warn('[PersistentBanner] No account name available for timezone detection');
                }
                
                // Step 6: Automatically trigger handlePrepareTools to scroll and load complete data
                this.showNotification('Preparing tools and loading complete case data...', 'info');
                
                if (typeof FlexipagePanelInjector.handlePrepareTools === 'function') {
                    // Wait a moment for panel to fully render before triggering preparation
                    setTimeout(async () => {
                        try {
                            await FlexipagePanelInjector.handlePrepareTools();
                            this.showNotification(
                                `Panel ready with complete data for case ${caseData.caseNumber}.`,
                                'success'
                            );
                        } catch (error) {
                            console.error('[PersistentBanner] Error during handlePrepareTools:', error);
                            this.showNotification('Tool preparation encountered an error.', 'warning');
                        }
                    }, 1500); // 1.5 second delay to ensure CaseTimezoneResolver completes first
                } else {
                    console.warn('[PersistentBanner] handlePrepareTools not available on FlexipagePanelInjector');
                    this.showNotification(
                        `Panel ready for case ${caseData.caseNumber}. Click "Prepare Tools" to continue.`,
                        'success'
                    );
                }
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
     * Shows a menu to choose between XML and TSV format
     */
    async handleCaseDetailExtractor() {
        // Check if we're on a case page
        if (this.currentPage.type !== 'Case' || !this.currentPage.caseNumber) {
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
     * Determine if a page type represents a case detail view
     * @param {string} pageType
     * @returns {boolean}
     */
    isCasePageType(pageType) {
        if (!pageType) return false;
        const normalized = pageType.toString().toLowerCase();
        if (normalized.includes('list')) return false;
        return normalized.includes('case');
    },

    /**
     * Checks if an element is visible in the current viewport
     * @param {Element} element
     * @returns {boolean}
     */
    isElementVisible(element) {
        if (!element) return false;

        let current = element;
        while (current && current !== document.body) {
            const style = window.getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            current = current.parentElement;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    },

    /**
     * Get case number from the active Salesforce Lightning console tab
     * @returns {{caseNumber: string, source: string, rawText: string}|null}
     */
    getActiveLightningConsoleTabCaseNumber() {
        // Find all console tab items (li elements with specific classes)
        const tabSelectors = [
            'li.tabItem.slds-context-bar__item',
            'li.oneConsoleTabItem',
            'li[role="presentation"].slds-context-bar__item',
            '.workspace__tabBar li[role="presentation"]'
        ];

        let activeTabs = [];

        for (const selector of tabSelectors) {
            const tabs = document.querySelectorAll(selector);
            if (!tabs.length) continue;

            for (const tab of tabs) {
                // Check if this tab is marked as active
                const isActive = tab.classList.contains('slds-is-active') || 
                               tab.classList.contains('active') ||
                               tab.getAttribute('aria-selected') === 'true';

                if (isActive && this.isElementVisible(tab)) {
                    activeTabs.push(tab);
                }
            }

            if (activeTabs.length > 0) {
                break; // Found active tabs with this selector
            }
        }

        if (activeTabs.length === 0) {
            return null;
        }

        // Get the last active tab (most recent/current)
        const activeTab = activeTabs[activeTabs.length - 1];

        // Try to extract case number from the tab's link text
        const tabLink = activeTab.querySelector('a');
        if (tabLink) {
            const tabText = (tabLink.textContent || '').trim();
            const caseNumber = this.extractCaseNumberFromText(tabText);
            if (caseNumber) {
                console.log('[PersistentBanner] Found case number from active console tab:', caseNumber);
                return { caseNumber, source: 'lightning-console-tab', rawText: tabText };
            }
        }

        // Fallback: check title attribute
        const titleAttr = activeTab.getAttribute('title');
        if (titleAttr) {
            const caseNumber = this.extractCaseNumberFromText(titleAttr);
            if (caseNumber) {
                console.log('[PersistentBanner] Found case number from active tab title:', caseNumber);
                return { caseNumber, source: 'lightning-console-tab-title', rawText: titleAttr };
            }
        }

        return null;
    },

    /**
     * Attempt to read the current visible case number from the DOM
     * @returns {{caseNumber: string, source: string, rawText: string}|null}
     */
    getVisibleCaseNumberFromDom() {
        // Priority 1: Check RecordCaseNumberField (most reliable source)
        // In case of nested case views, we want the CLOSEST one to the active content
        const caseNumberFieldSelectors = [
            'lightning-formatted-text[data-field-id="RecordCaseNumberField"]',
            'flexipage-field lightning-formatted-text[data-field-id="RecordCaseNumberField"]',
            'record_flexipage-record-field lightning-formatted-text[data-field-id="RecordCaseNumberField"]'
        ];

        let closestElement = null;
        let closestDistance = Infinity;

        for (const selector of caseNumberFieldSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (!this.isElementVisible(element)) {
                    continue;
                }

                const text = (element.textContent || '').trim();
                if (!text) continue;

                const caseNumber = this.extractCaseNumberFromText(text);
                if (!caseNumber) continue;

                // Calculate "distance" from viewport top (closer to top = more likely to be the active case)
                const rect = element.getBoundingClientRect();
                const distance = Math.abs(rect.top);

                // Prefer elements closer to the viewport top
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestElement = { caseNumber, source: 'RecordCaseNumberField', rawText: text, distance };
                }
            }
        }

        if (closestElement) {
            console.log('[PersistentBanner] Found case number from RecordCaseNumberField (closest to viewport):', closestElement.caseNumber, 'distance:', closestElement.distance);
            return closestElement;
        }

        // Priority 2: Check active Lightning console tab
        const consoleTabCase = this.getActiveLightningConsoleTabCaseNumber();
        if (consoleTabCase) {
            return consoleTabCase;
        }

        // Priority 3: Check standard page selectors (also use proximity logic for nested views)
        const selectors = [
            'slot[name="primaryField"] lightning-formatted-text',
            'records-formula-output[slot="primaryField"] lightning-formatted-text',
            '.slds-page-header__title lightning-formatted-text',
            '.slds-page-header__title span',
            'lightning-formatted-text[data-output-element-id="output-field"][slot="output"]',
            'h1.slds-page-header__title',
            'nav[role="navigation"] a',
            '.breadcrumb a',
            '.slds-breadcrumb__item a'
        ];

        let closestPageElement = null;
        let closestPageDistance = Infinity;

        for (const selector of selectors) {
            const nodes = document.querySelectorAll(selector);
            if (!nodes.length) continue;

            for (const node of nodes) {
                if (!this.isElementVisible(node)) {
                    continue;
                }

                const text = (node.textContent || '').trim();
                if (!text) continue;

                const caseNumber = this.extractCaseNumberFromText(text);
                if (!caseNumber) continue;

                // Use proximity to viewport for nested case scenarios
                const rect = node.getBoundingClientRect();
                const distance = Math.abs(rect.top);

                if (distance < closestPageDistance) {
                    closestPageDistance = distance;
                    closestPageElement = { caseNumber, source: selector, rawText: text, distance };
                }
            }
        }

        if (closestPageElement) {
            console.log('[PersistentBanner] Found case number from page selector (closest):', closestPageElement.source, closestPageElement.caseNumber);
            return closestPageElement;
        }

        // Priority 4: Check document title as final fallback
        const titleText = (document.title || '').trim();
        const titleMatch = this.extractCaseNumberFromText(titleText);
        if (titleMatch) {
            return { caseNumber: titleMatch, source: 'document.title', rawText: titleText };
        }

        return null;
    },

    /**
     * Extract the first 6+ digit sequence from text
     * @param {string} text
     * @returns {string|null}
     */
    extractCaseNumberFromText(text) {
        if (!text) return null;
        const match = text.match(/\b(\d{6,})\b/);
        return match ? match[1] : null;
    },

    /**
     * Schedule a revalidation of the visible case number
     * @param {string} reason
     * @param {number} [delay=250]
     */
    scheduleCaseNumberRevalidation(reason, delay = 250) {
        if (!this.isCasePageType(this.currentPage.type)) {
            this.resetCaseNumberValidationState();
            return;
        }

        if (this.caseNumberValidationTimer) {
            clearTimeout(this.caseNumberValidationTimer);
            this.caseNumberValidationTimer = null;
        }

        if (!reason || reason.indexOf('retry') === -1) {
            this.caseNumberValidationAttempts = 0;
        }

        if (this.caseNumberValidationAttempts >= this.MAX_CASE_VALIDATION_ATTEMPTS) {
            console.warn(`[PersistentBanner] Case number validation aborted after ${this.caseNumberValidationAttempts} attempts (${reason})`);
            return;
        }

        this.caseNumberValidationTimer = setTimeout(() => {
            this.caseNumberValidationTimer = null;
            this.revalidateCaseNumber(reason);
        }, delay);
    },

    /**
     * Revalidate the banner's case number against the visible DOM
     * @param {string} reason
     */
    revalidateCaseNumber(reason) {
        if (!this.isCasePageType(this.currentPage.type)) {
            this.resetCaseNumberValidationState();
            return;
        }

        this.caseNumberValidationAttempts += 1;

        const visibleCase = this.getVisibleCaseNumberFromDom();
        if (visibleCase && visibleCase.caseNumber) {
            if (this.currentPage.caseNumber !== visibleCase.caseNumber) {
                console.log(`[PersistentBanner] Case number revalidated (${reason}): ${this.currentPage.caseNumber || '—'} -> ${visibleCase.caseNumber}`);
                this.currentPage.caseNumber = visibleCase.caseNumber;
                this.currentCaseNumber = visibleCase.caseNumber;
                this.updateBannerUI();
            }

            this.resetCaseNumberValidationState();
            return;
        }

        if (this.caseNumberValidationAttempts < this.MAX_CASE_VALIDATION_ATTEMPTS) {
            this.scheduleCaseNumberRevalidation(`${reason}-retry`, 250);
        } else {
            console.warn(`[PersistentBanner] Could not verify visible case number after ${this.caseNumberValidationAttempts} attempts (${reason})`);
            this.resetCaseNumberValidationState();
        }
    },

    /**
     * Reset case number validation timers and counters
     */
    resetCaseNumberValidationState() {
        if (this.caseNumberValidationTimer) {
            clearTimeout(this.caseNumberValidationTimer);
            this.caseNumberValidationTimer = null;
        }
        this.caseNumberValidationAttempts = 0;
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
     * Convert page type to display name
     * @param {string} pageType
     * @returns {string}
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
        const displayName = this.getPageTypeDisplayName(this.currentPage.type);
        this.elements.pageType.textContent = displayName;
        
        // Update page type styling based on type
        this.elements.pageType.className = 'exl-banner-page-type';
        this.elements.pageType.classList.add(`exl-page-${this.currentPage.type.toLowerCase().replace(/\s+/g, '-')}`);

        // Update metadata
        this.elements.caseNumber.textContent = this.currentPage.caseNumber || '—';
        this.elements.subject.textContent = this.currentPage.subject || '—';
        this.elements.status.textContent = this.currentPage.status || '—';
        this.elements.subStatus.textContent = this.currentPage.subStatus || '—';
        
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
        const hasEnvData = this.customerMetadata.customerId && 
                          this.customerMetadata.institutionId && 
                          this.customerMetadata.server;
        
        // Show toggle button if we have environment data
        if (this.elements.envToggleSection) {
            this.elements.envToggleSection.style.display = hasEnvData ? 'flex' : 'none';
        }
        
        // Populate environment buttons if data is available
        if (hasEnvData) {
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
        
        // Show/hide case/subject/status/substatus based on customer data availability
        const hasCustomerData = hasEnvData;
        if (this.elements.caseItem) {
            this.elements.caseItem.style.display = hasCustomerData ? 'none' : 'inline';
        }
        if (this.elements.subjectItem) {
            this.elements.subjectItem.style.display = hasCustomerData ? 'none' : 'inline';
        }
        if (this.elements.statusItem) {
            this.elements.statusItem.style.display = hasCustomerData ? 'none' : 'inline';
        }
        if (this.elements.substatusItem) {
            this.elements.substatusItem.style.display = hasCustomerData ? 'none' : 'inline';
        }
        
        // Show/hide metadata section based on page type
        const metadataSection = this.elements.banner.querySelector('.exl-banner-metadata');
        if (this.currentPage.type === 'Case' && this.currentPage.caseNumber) {
            metadataSection.style.display = 'flex';
        } else {
            metadataSection.style.display = 'none';
        }
        
        // Update banner background based on case status
        this.updateBannerBackground();
        
        // Schedule post-render validation to ensure displayed case number matches visible DOM
        if (this.isCasePageType(this.currentPage.type) && this.currentPage.caseNumber) {
            this.scheduleCaseNumberRevalidation('post-ui-update', 300);
        }
    },

    /**
     * Update banner background gradient based on case status
     */
    updateBannerBackground() {
        if (!this.elements.banner) return;

        // Check if we're on a case page with a status
        if (this.currentPage.type === 'Case' && this.currentPage.status) {
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

        // Create gradient from default dark color to status color
        // Default dark color: rgb(26, 26, 46)
        return `linear-gradient(135deg, rgb(26, 26, 46) 0%, rgb(${r}, ${g}, ${b}) 100%)`;
    },

    /**
     * Update navigation history UI
     */
    updateNavigationHistoryUI() {
        if (!this.elements.historyList) return;

        if (this.navigationHistory.length === 0) {
            this.elements.historyList.innerHTML = '<div class="exl-banner-history-placeholder">No navigation history yet</div>';
            return;
        }

        // Build history items (reverse order - newest first)
        const historyHTML = [...this.navigationHistory].reverse().map((item, index) => {
            const relativeIndex = this.navigationHistory.length - index;
            const caseInfo = item.caseNumber ? `Case ${item.caseNumber}` : item.type;
            const subjectPreview = item.subject ? ` - ${this.truncate(item.subject, 40)}` : '';
            
            return `
                <div class="exl-banner-history-item" data-history-url="${item.url}" title="Click to navigate">
                    <span class="exl-history-number">${relativeIndex}</span>
                    <span class="exl-history-type">${item.type}</span>
                    <span class="exl-history-details">${caseInfo}${subjectPreview}</span>
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

        // Cleanup after 10 seconds
        setTimeout(() => observer.disconnect(), 10000);
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
     * Clean up
     */
    cleanup() {
        this.stopUrlMonitoring();
        this.remove();
        this.resetCaseNumberValidationState();
        this.currentCaseId = null;
        this.currentCaseNumber = null;
        this.isInitialized = false;
        console.log('[PersistentBanner] Cleaned up');
    },

    /**
     * Populate environment buttons with Production and Sandbox links
     */
    populateEnvButtons() {
        if (!this.elements.envButtonsContainer) return;
        
        const { server, institutionId, productServiceName } = this.customerMetadata;
        
        // Build institution code - for now using institutionId as placeholder
        // In production, you'd need proper institution code extraction
        const institutionCode = institutionId;
        
        const buttonsHtml = [];
        
        // Production Back Office button
        buttonsHtml.push(`
            <button class="exl-banner-btn exl-env-btn" 
                    data-env-url="https://${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}"
                    title="Open Production Back Office">
                <span class="exl-env-label">Prod</span> Back Office
            </button>
        `);
        
        // Production Live View button
        buttonsHtml.push(`
            <button class="exl-banner-btn exl-env-btn" 
                    data-env-url="https://${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true"
                    title="Open Production Live View">
                <span class="exl-env-label">Prod</span> Live View
            </button>
        `);
        
        // SQA Environment buttons (always available)
        buttonsHtml.push(`
            <button class="exl-banner-btn exl-env-btn" 
                    data-env-url="https://sqa-${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}"
                    title="Open SQA Back Office">
                <span class="exl-env-label">SQA</span> Back Office
            </button>
        `);
        
        buttonsHtml.push(`
            <button class="exl-banner-btn exl-env-btn" 
                    data-env-url="https://sqa-${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true"
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
                            data-env-url="https://psb-${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}"
                            title="Open Premium Sandbox Back Office">
                        <span class="exl-env-label">PSB</span> Back Office
                    </button>
                `);
                
                // Premium Sandbox Live View
                buttonsHtml.push(`
                    <button class="exl-banner-btn exl-env-btn" 
                            data-env-url="https://psb-${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true"
                            title="Open Premium Sandbox Live View">
                        <span class="exl-env-label">PSB</span> Live View
                    </button>
                `);
            } else if (productServiceName.includes('esploro standard')) {
                // Standard Sandbox Back Office
                buttonsHtml.push(`
                    <button class="exl-banner-btn exl-env-btn" 
                            data-env-url="https://sb-${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}"
                            title="Open Sandbox Back Office">
                        <span class="exl-env-label">SB</span> Back Office
                    </button>
                `);
                
                // Standard Sandbox Live View
                buttonsHtml.push(`
                    <button class="exl-banner-btn exl-env-btn" 
                            data-env-url="https://sb-${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true"
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
    },
};
