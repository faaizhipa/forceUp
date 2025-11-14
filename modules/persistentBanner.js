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
    // NOTE: This is now synced with window.ExLibrisExtension.currentCaseNumber
    currentCaseId: null,

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

    // Event listener references (for cleanup)
    caseDataEventHandler: null,

    // Lifecycle state tracking
    lifecycleState: 'uninitialized', // 'uninitialized' | 'initialized' | 'resetting' | 'refreshing' | 'initiating'
    trackedCaseNumber: null, // Track current case number
    stateChangeUnsubscribe: null, // Function to unsubscribe from GlobalCaseState
    urlMonitorInterval: null, // URL monitoring interval

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
        
        // Green statuses - 2 shades darker from rgb(0, 100, 0)
        'Solution Delivered to Customer': { base: 'rgb(0, 60, 0)', category: 'green' },
        
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


    /**
     * Initialize the persistent banner
     */
    init() {
        if (this.isInitialized) {
            console.log('[PersistentBanner] Already initialized');
            return;
        }

        console.log('[PersistentBanner] Initializing...');
        
        // Initialize global case number if not exists
        if (typeof window.ExLibrisExtension === 'undefined') {
            window.ExLibrisExtension = {};
        }
        if (!window.ExLibrisExtension.hasOwnProperty('currentCaseNumber')) {
            window.ExLibrisExtension.currentCaseNumber = null;
        }
        
        // Sync internal state with global
        this.currentCaseId = window.ExLibrisExtension.currentCaseNumber;
        
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
        
        // Listen for global case number changes
        this.setupGlobalCaseNumberListener();

        // Register listener for GlobalCaseState changes
        if (typeof GlobalCaseState !== 'undefined') {
            this.stateChangeUnsubscribe = GlobalCaseState.onStateChange('PersistentBanner', (previousState, newState) => {
                this._handleStateChange(previousState, newState);
            });
            console.log('[PersistentBanner] Registered GlobalCaseState listener');
        }

        this.isInitialized = true;
        this.lifecycleState = 'initialized';
        console.log('[PersistentBanner] Initialized');
    },

    /**
     * Handle GlobalCaseState changes - implements reactive lifecycle
     * @param {Object} previousState - Previous state
     * @param {Object} newState - New state
     */
    _handleStateChange(previousState, newState) {
        console.log('[PersistentBanner] GlobalCaseState changed:', { previousState, newState });

        // Check if case number changed
        if (previousState.caseNumber === newState.caseNumber) {
            console.log('[PersistentBanner] Case number unchanged, ignoring');
            return;
        }

        console.log(`[PersistentBanner] Case changed from ${previousState.caseNumber} to ${newState.caseNumber}, starting lifecycle`);

        try {
            // PHASE 1: Resetting
            this.lifecycleState = 'resetting';
            console.log('[PersistentBanner] Lifecycle: RESETTING');

            // Abort URL monitoring temporarily (will restart in initiating phase)
            if (this.urlMonitorInterval) {
                clearInterval(this.urlMonitorInterval);
                this.urlMonitorInterval = null;
                console.log('[PersistentBanner] Stopped URL monitoring');
            }

            // Clear current page data
            this.currentPage = {
                type: 'Unknown',
                caseNumber: null,
                subject: null,
                status: null,
                subStatus: null
            };
            console.log('[PersistentBanner] Cleared current page data');

            // PHASE 2: Refreshing
            this.lifecycleState = 'refreshing';
            console.log('[PersistentBanner] Lifecycle: REFRESHING');

            // Update tracked case number
            this.trackedCaseNumber = newState.caseNumber;
            this.currentCaseId = newState.caseId;
            console.log('[PersistentBanner] Updated tracked case:', {
                caseNumber: this.trackedCaseNumber,
                caseId: this.currentCaseId
            });

            // PHASE 3: Initiating
            this.lifecycleState = 'initiating';
            console.log('[PersistentBanner] Lifecycle: INITIATING');

            // Restart URL monitoring
            this.startUrlMonitoring();
            console.log('[PersistentBanner] Restarted URL monitoring');

            // Update banner UI to show new case info (will read from GlobalCaseState)
            this.updateBannerUI();
            console.log('[PersistentBanner] Updated banner UI');

            this.lifecycleState = 'initialized';
            console.log('[PersistentBanner] Lifecycle: INITIALIZED (ready)');

        } catch (error) {
            console.error('[PersistentBanner] Error in lifecycle:', error);
            this.lifecycleState = 'initialized'; // Reset to initialized on error
        }
    },

    /**
     * Gets current lifecycle state
     * @returns {string} Current state
     */
    getLifecycleState() {
        return this.lifecycleState;
    },

    /**
     * Setup listener for global case number changes
     */
    setupGlobalCaseNumberListener() {
        // Poll for changes to window.ExLibrisExtension.currentCaseNumber
        setInterval(() => {
            if (typeof window.ExLibrisExtension !== 'undefined') {
                const globalCaseNumber = window.ExLibrisExtension.currentCaseNumber;
                
                // Check if case number changed
                if (globalCaseNumber !== this.currentCaseId) {
                    console.log(`[PersistentBanner] Global case number changed from ${this.currentCaseId} to ${globalCaseNumber}`);
                    
                    // Clear old case data if switching cases
                    if (this.currentCaseId && globalCaseNumber && this.currentCaseId !== globalCaseNumber) {
                        this.clearCaseData();
                    } else if (this.currentCaseId && !globalCaseNumber) {
                        this.clearCaseData();
                    }
                    
                    // Update internal state
                    this.currentCaseId = globalCaseNumber;
                    
                    // Update display
                    this.updateBannerUI();
                }
            }
        }, 500); // Check every 500ms
        
        console.log('[PersistentBanner] Global case number listener started');
    },

    /**
     * Setup listener for CasePageDataExtractor events
     */
    setupCaseDataListener() {
        // Remove existing listener if present
        if (this.caseDataEventHandler) {
            document.removeEventListener('casePageDataExtracted', this.caseDataEventHandler);
        }

        // Create and store handler reference
        this.caseDataEventHandler = (event) => {
            const data = event.detail;
            console.log('[PersistentBanner] Received case page data from CasePageDataExtractor:', data);

            // Validate that the data matches the global case number
            const globalCaseNumber = window.ExLibrisExtension?.currentCaseNumber;
            const dataCaseId = data.caseId || data.caseNumber || null;

            if (!globalCaseNumber) {
                console.warn('[PersistentBanner] No global case number set, ignoring case data');
                return;
            }

            if (dataCaseId && globalCaseNumber !== dataCaseId) {
                console.warn(`[PersistentBanner] Data case ID (${dataCaseId}) does not match global case number (${globalCaseNumber}), ignoring stale data`);
                return;
            }

            console.log('[PersistentBanner] Data validated for case:', globalCaseNumber);

            // Sync internal state with global
            this.currentCaseId = globalCaseNumber;

            // Update customer metadata from extracted data
            // CasePageDataExtractor now enriches data with custID, instID, server from CustomerDataManager
            this.customerMetadata = {
                customerId: data.custID || null,  // 4-digit customer ID
                institutionId: data.instID || null,  // 4-digit institution ID
                server: data.server || null,  // Server code (ap02, na05, etc.)
                productServiceName: data.platformService || null,  // Platform/Service with fallback
                institutionCode: data.exLibrisAccountNumber || null  // Institution code (61USC_INST, etc.)
            };

            console.log('[PersistentBanner] Updated customer metadata:', this.customerMetadata);

            // Update current page status from direct page data (for gradient coloring)
            if (data.pageStatus) {
                this.currentPage.status = data.pageStatus;
                console.log('[PersistentBanner] Updated status from page data:', data.pageStatus);
            }

            // Update banner UI with new metadata and status
            this.updateBannerUI();
        };

        // Attach the event listener
        document.addEventListener('casePageDataExtracted', this.caseDataEventHandler);

        // Also listen to PageIdentifier for view changes within the same case
        if (typeof PageIdentifier !== 'undefined' && typeof PageIdentifier.monitorPageChanges === 'function') {
            PageIdentifier.monitorPageChanges((pageInfo) => {
                console.log('[PersistentBanner] PageIdentifier change detected:', pageInfo);

                // Check if we're on a case page
                if (pageInfo.type === 'case_page' || pageInfo.type === 'case_comments') {
                    const caseId = pageInfo.caseId;

                    // Sync with global case number
                    if (typeof window.ExLibrisExtension !== 'undefined') {
                        window.ExLibrisExtension.currentCaseNumber = caseId;
                    }

                    // If the case ID changed, clear old data
                    if (caseId && this.currentCaseId && caseId !== this.currentCaseId) {
                        console.log(`[PersistentBanner] Case changed from ${this.currentCaseId} to ${caseId}`);
                        this.clearCaseData();
                        this.currentCaseId = caseId;
                    }
                } else {
                    // Not a case page, clear case data and global case number
                    if (typeof window.ExLibrisExtension !== 'undefined') {
                        window.ExLibrisExtension.currentCaseNumber = null;
                    }
                    if (this.currentCaseId) {
                        console.log('[PersistentBanner] Left case page, clearing case data');
                        this.clearCaseData();
                    }
                }
            });
            console.log('[PersistentBanner] PageIdentifier listener registered');
        }

        console.log('[PersistentBanner] Case data listeners registered');
    },

    /**
     * Get current case ID from URL using CaseIdentifiers utility
     * @returns {string|null}
     */
    getCurrentCaseIdFromUrl() {
        if (typeof CaseIdentifiers !== 'undefined') {
            return CaseIdentifiers.getCaseIdFromUrl();
        }
        // Fallback to manual extraction
        const match = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
        return match ? match[1] : null;
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
            NavigationObserver.onRouteChange((newUrl) => {
                if (newUrl !== this.lastKnownUrl) {
                    console.log('[PersistentBanner] URL changed:', newUrl);
                    this.lastKnownUrl = newUrl;
                    this.handleUrlChange(newUrl);
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
        console.log('[PersistentBanner] Handling URL change to:', newUrl);

        // Get the new case ID from URL
        const newCaseId = this.getCurrentCaseIdFromUrl();

        // Update global case number
        if (typeof window.ExLibrisExtension !== 'undefined') {
            window.ExLibrisExtension.currentCaseNumber = newCaseId;
        }

        // Check if we navigated to a different case or away from a case
        if (this.currentCaseId && newCaseId !== this.currentCaseId) {
            console.log(`[PersistentBanner] Case changed from ${this.currentCaseId} to ${newCaseId || 'non-case page'}`);
            // Clear case-specific data when navigating to a different case
            this.clearCaseData();
        } else if (this.currentCaseId && !newCaseId) {
            console.log('[PersistentBanner] Navigated away from case page');
            // Clear case-specific data when navigating away from case pages
            this.clearCaseData();
        }

        // Sync internal state with global
        this.currentCaseId = newCaseId;

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
        
        // Clear current case ID (internal state only, not global)
        this.currentCaseId = null;
        
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
     * Reads case information from GlobalCaseState as source of truth
     * @param {Object} pageData
     */
    updateCurrentPage(pageData = {}) {
        // ALWAYS read from GlobalCaseState as source of truth
        let caseNumber = null;
        let caseId = null;

        if (typeof GlobalCaseState !== 'undefined') {
            caseNumber = GlobalCaseState.getCaseNumber();
            caseId = GlobalCaseState.getCaseId();
            console.log('[PersistentBanner] Using GlobalCaseState - Case ID:', caseId, 'Case Number:', caseNumber);

            // If pageData has case info that differs from GlobalCaseState, warn and use GlobalCaseState
            if (pageData.caseNumber && pageData.caseNumber !== caseNumber) {
                console.warn(`[PersistentBanner] pageData case number (${pageData.caseNumber}) differs from GlobalCaseState (${caseNumber}), using GlobalCaseState`);
            }
            if (pageData.caseId && pageData.caseId !== caseId) {
                console.warn(`[PersistentBanner] pageData case ID (${pageData.caseId}) differs from GlobalCaseState (${caseId}), using GlobalCaseState`);
            }
        } else {
            console.warn('[PersistentBanner] GlobalCaseState not available, using pageData');
            // Fallback to pageData
            caseNumber = pageData.caseNumber;
            caseId = pageData.caseId;
        }

        this.currentPage = {
            type: pageData.type || 'Unknown',
            caseNumber: caseNumber,
            caseId: caseId,
            subject: pageData.subject || null,
            status: pageData.status || null,
            subStatus: pageData.subStatus || null,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        console.log('[PersistentBanner] Updated current page:', this.currentPage);

        // Update internal tracking
        this.currentCaseId = caseId;

        // Mark that PersistentBanner has consumed the global state
        if (typeof GlobalCaseState !== 'undefined' && caseNumber) {
            GlobalCaseState.markPersistentBannerUsed(caseNumber);
        }

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

                // Step 6: Highlight Jira fields now that panel is shown
                // These fields (Primary_Jira__c and Jira_Status__c) are only visible after panel injection
                if (typeof FieldHighlighter !== 'undefined' &&
                    typeof FieldHighlighter.highlightJiraFields === 'function') {
                    setTimeout(() => {
                        console.log('[PersistentBanner] Highlighting Jira fields after panel injection');
                        FieldHighlighter.highlightJiraFields();
                    }, 1000); // Wait for panel DOM to be fully rendered
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

        // Always use global case number for display
        const globalCaseNumber = window.ExLibrisExtension?.currentCaseNumber;
        
        // Sync internal state
        if (globalCaseNumber !== this.currentCaseId) {
            this.currentCaseId = globalCaseNumber;
        }

        // Update page type with friendly display name
        const displayName = this.getPageTypeDisplayName(this.currentPage.type);
        this.elements.pageType.textContent = displayName;
        
        // Update page type styling based on type
        this.elements.pageType.className = 'exl-banner-page-type';
        this.elements.pageType.classList.add(`exl-page-${this.currentPage.type.toLowerCase().replace(/\s+/g, '-')}`);

        // Update metadata - use global case number if available
        const displayCaseNumber = globalCaseNumber || this.currentPage.caseNumber || '—';
        this.elements.caseNumber.textContent = displayCaseNumber;
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
        // Use global case number to determine if we should show metadata
        if (this.currentPage.type === 'Case' && globalCaseNumber) {
            metadataSection.style.display = 'flex';
        } else {
            metadataSection.style.display = 'none';
        }
        
        // Update banner background based on case status
        this.updateBannerBackground();
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
     * Clean up - Called only when extension is being unloaded
     * NOT called during normal navigation/URL changes
     */
    cleanup() {
        console.log('[PersistentBanner] Starting cleanup (extension unload)...');
        
        // Remove event listener
        if (this.caseDataEventHandler) {
            document.removeEventListener('casePageDataExtracted', this.caseDataEventHandler);
            this.caseDataEventHandler = null;
            console.log('[PersistentBanner] Event listener removed');
        }

        // Clear global case number ONLY on extension unload
        if (typeof window.ExLibrisExtension !== 'undefined') {
            window.ExLibrisExtension.currentCaseNumber = null;
            console.log('[PersistentBanner] Global case number cleared (extension unload)');
        }

        // Stop monitoring and remove DOM elements
        this.stopUrlMonitoring();
        this.remove();
        
        // Clear internal state
        this.currentCaseId = null;
        this.currentPage = {
            type: 'Unknown',
            caseNumber: null,
            subject: null,
            status: null,
            subStatus: null
        };
        this.customerMetadata = {
            customerId: null,
            institutionId: null,
            server: null,
            productServiceName: null,
            institutionCode: null
        };
        
        this.isInitialized = false;
        console.log('[PersistentBanner] Cleanup complete (extension unloaded)');
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
