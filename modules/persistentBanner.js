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
    
    // Current page info
    currentPage: {
        type: 'Unknown',
        caseNumber: null,
        subject: null,
        status: null,
        subStatus: null
    },

    // URL monitoring
    lastKnownUrl: null,
    urlMonitorInterval: null,

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
        
        this.isInitialized = true;
        console.log('[PersistentBanner] Initialized');
    },

    /**
     * Start monitoring URL changes
     */
    startUrlMonitoring() {
        this.lastKnownUrl = window.location.href;
        
        // Check URL every 500ms
        this.urlMonitorInterval = setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== this.lastKnownUrl) {
                console.log('[PersistentBanner] URL changed:', currentUrl);
                this.lastKnownUrl = currentUrl;
                this.handleUrlChange(currentUrl);
            }
        }, 500);
        
        console.log('[PersistentBanner] URL monitoring started');
    },

    /**
     * Stop monitoring URL changes
     */
    stopUrlMonitoring() {
        if (this.urlMonitorInterval) {
            clearInterval(this.urlMonitorInterval);
            this.urlMonitorInterval = null;
            console.log('[PersistentBanner] URL monitoring stopped');
        }
    },

    /**
     * Handle URL change - reset current page data
     * @param {string} newUrl
     */
    handleUrlChange(newUrl) {
        console.log('[PersistentBanner] Handling URL change, resetting current page data');
        
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
        this.currentPage = {
            type: pageData.type || 'Unknown',
            caseNumber: pageData.caseNumber || null,
            subject: pageData.subject || null,
            status: pageData.status || null,
            subStatus: pageData.subStatus || null,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

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
                        <span class="exl-banner-meta-item">Case: <strong id="exl-banner-case">—</strong></span>
                        <span class="exl-banner-meta-item">Subject: <strong id="exl-banner-subject">—</strong></span>
                        <span class="exl-banner-meta-item">Status: <strong id="exl-banner-status">—</strong></span>
                        <span class="exl-banner-meta-item">Substatus: <strong id="exl-banner-substatus">—</strong></span>
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

        // Force refresh of cached case data to ensure we're using current page data
        console.log('[PersistentBanner] Forcing refresh of case data before extraction');
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

        // Create a simple menu to choose format
        const formatChoice = await this.showFormatMenu();
        
        if (!formatChoice) {
            console.log('[PersistentBanner] Case detail extraction cancelled');
            return;
        }

        try {
            let result;
            
            if (formatChoice === 'xml') {
                result = await CaseDetailExtractor.copyAsXML();
            } else if (formatChoice === 'tsv') {
                result = await CaseDetailExtractor.copyAsTSV();
            }
            
            if (result && result.success) {
                this.showNotification(result.message, 'success');
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
     * Update banner UI with current page data
     */
    updateBannerUI() {
        if (!this.elements.pageType) return;

        // Update page type
        this.elements.pageType.textContent = this.currentPage.type;
        
        // Update page type styling based on type
        this.elements.pageType.className = 'exl-banner-page-type';
        this.elements.pageType.classList.add(`exl-page-${this.currentPage.type.toLowerCase().replace(/\s+/g, '-')}`);

        // Update metadata
        this.elements.caseNumber.textContent = this.currentPage.caseNumber || '—';
        this.elements.subject.textContent = this.currentPage.subject || '—';
        this.elements.status.textContent = this.currentPage.status || '—';
        this.elements.subStatus.textContent = this.currentPage.subStatus || '—';
        
        // Show/hide metadata section based on page type
        const metadataSection = this.elements.banner.querySelector('.exl-banner-metadata');
        if (this.currentPage.type === 'Case' && this.currentPage.caseNumber) {
            metadataSection.style.display = 'flex';
        } else {
            metadataSection.style.display = 'none';
        }
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
        this.isInitialized = false;
        console.log('[PersistentBanner] Cleaned up');
    }
};
