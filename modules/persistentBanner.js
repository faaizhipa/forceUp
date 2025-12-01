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

    // Displayed case tracking (for stale data prevention)
    displayedCaseId: null,
    displayedCaseNumber: null,
    validationInterval: null,

    // Polling state for incremental data updates
    dataPollingInterval: null,
    pollingStartTime: null,
    maxPollingDuration: 10000, // Stop polling after 10 seconds
    pollingIntervalMs: 500, // Poll every 500ms

    // Retry state for exponential backoff
    retryTimeoutId: null,
    retryAttempt: 0,
    retryDelayMs: 5000, // Initial 5 seconds
    maxRetryDelayMs: 60000, // Max 60 seconds

    // Complete metadata storage - stores all fields from CasePageDataExtractor
    fullCaseMetadata: null,

    // Message rotation state
    messageRotationInterval: null,
    currentMessageIndex: 0,
    activeMessages: [],
    messageSettings: null,
    wasAutoRotating: false,
    
    // Message display mode: 'hidden' | 'banner' | 'rotating'
    messageDisplayMode: 'banner',
    
    // Banner state: 'collapsed' | 'expanded'
    bannerState: 'expanded',
    
    // Message hover popup
    messageHoverPopup: null,
    messageHoverTimeout: null,
    
    // Message edit popup
    messageEditPopup: null,
    selectedEditMessageId: null,
    
    // Rotating sticky bar
    rotatingStickyBar: null,
    rotatingStickyBarMessages: [],
    rotatingStickyBarIndex: 0,
    rotatingStickyBarInterval: null,
    
    // Environment buttons ready state
    environmentButtonsReady: false,

    // Cleanup tracking arrays
    trackedTimers: [],
    trackedListeners: [],
    trackedObservers: [],

    // UI state for modals and overlays
    hoverImagePopup: null,
    hoverImageTimeout: null,
    contextMenu: null,
    contextMenuMessageId: null,
    editModal: null,
    viewImageModal: null,
    addImageModal: null,
    imagePreviewOverlay: null,
    messageDropdown: null,
    currentDisplayedMessage: null,

    // Current page info
    currentPage: {
        type: 'Unknown',
        caseNumber: null,
        subject: null,
        status: null,
        subStatus: null
    },

    // Customer metadata from CasePageDataExtractor
    // Standard naming: customerId, institutionId, institutionCode (no abbreviations)
    customerMetadata: {
        customerId: null,       // 4-digit customer ID
        institutionId: null,    // Institution ID (numeric)
        institutionCode: null,  // Institution code (e.g., "61USC_INST")
        server: null,           // Server code (e.g., "na05")
        productServiceName: null,
        timezone: null
    },

    // Customer time refresh interval
    customerTimeInterval: null,

    // Metadata rotation state
    metadataRotation: {
        active: false,
        timer: null,
        startDelayTimer: null,
        currentIndex: 0,
        rotatableFields: ['exl-banner-subject-item', 'exl-banner-status-item', 'exl-banner-product-item'],
        interval: 5000 // 5 seconds rotation interval
    },

    // URL monitoring
    lastKnownUrl: null,
    lastAcceptedUrl: null, // URL when data was last accepted from CaseDataStore

    // Environment menu state
    envMenuVisible: false,

    // Popup menu state
    activePopup: null, // 'tools' | 'wiki' | null
    popupCloseHandler: null,

    // Action-focused mode state
    actionFocusedMode: {
        active: false,
        currentTool: null, // 'timezone-inspector' | 'sql-wizard' | 'customer-data'
        originalCaseId: null,
        originalCaseNumber: null,
        originalCaseData: null
    },

    // Subscriptions
    contextUnsubscribe: null,
    storeUnsubscribe: null,

    // Status color mapping (based on caseStatusHighlighter)
    STATUS_COLORS: {
        // Red statuses - 2 shades darker from rgb(178, 15, 66)
        'New Email Received': { base: 'rgb(206, 58, 85)', background: 'rgb(109, 9, 41)', category: 'red' },
        'Re-opened': { base: 'rgb(206, 58, 85)', background: 'rgb(109, 9, 41)', category: 'red' },
        'Reopened': { base: 'rgb(206, 58, 85)', background: 'rgb(109, 9, 41)', category: 'red' },
        'Completed by Resolver Group': { base: 'rgb(206, 58, 85)', background: 'rgb(109, 9, 41)', category: 'red' },
        'New': { base: 'rgb(206, 58, 85)', background: 'rgb(109, 9, 41)', category: 'red' },
        'Update Received': { base: 'rgb(206, 58, 85)', background: 'rgb(109, 9, 41)', category: 'red' },

        // Orange statuses - 2 shades darker from rgb(171, 46, 1)
        'Pending Action': { base: 'rgb(234, 118, 62)', background: 'rgb(119, 32, 2)', category: 'orange' },
        'Initial Response Sent': { base: 'rgb(234, 118, 62)', background: 'rgb(119, 32, 2)', category: 'orange' },
        'In Progress': { base: 'rgb(234, 118, 62)', background: 'rgb(119, 32, 2)', category: 'orange' },

        // Purple statuses - 2 shades darker from rgb(100, 49, 179)
        'Assigned to Resolver Group': { base: 'rgb(127, 80, 246)', background: 'rgb(65, 56, 204)', category: 'purple' },
        'Pending Internal Response': { base: 'rgb(127, 80, 246)', background: 'rgb(65, 56, 204)', category: 'purple' },
        'Pending AM Response': { base: 'rgb(127, 80, 246)', background: 'rgb(65, 56, 204)', category: 'purple' },
        'Pending QA Review': { base: 'rgb(127, 80, 246)', background: 'rgb(65, 56, 204)', category: 'purple' },

        // Green statuses - 2 shades darker from rgb(0, 100, 0)
        'Solution Delivered to Customer': { base: 'rgb(7, 141, 18)', background: 'rgb(0, 60, 0)', category: 'green' },
        'Pending Customer Response': { base: 'rgb(7, 141, 18)', background: 'rgb(0, 60, 0)', category: 'blue' },
        'Awaiting Customer Confirmation': { base: 'rgb(7, 141, 18)', background: 'rgb(0, 60, 0)', category: 'blue' },

        // Blue statuses - 2 shades darker from rgb(13, 83, 173)
        'Closed': { base: 'rgb(44, 118, 204)', background: 'rgb(21, 58, 101)', category: 'blue' },
        'Pending': { base: 'rgb(44, 118, 204)', background: 'rgb(21, 58, 101)', category: 'blue' },

        // Yellow statuses - 2 shades darker from rgb(175, 96, 5)
        'Pending System Update - Defect': { base: 'rgb(234, 118, 62)', background: 'rgb(119, 32, 2)', category: 'yellow' },
        'Pending System Update - Enhancement': { base: 'rgb(234, 118, 62)', background: 'rgb(119, 32, 2)', category: 'yellow' },
        'Pending System Update - Other': { base: 'rgb(234, 118, 62)', background: 'rgb(119, 32, 2)', category: 'yellow' },
        'Under Review': { base: 'rgb(234, 118, 62)', background: 'rgb(119, 32, 2)', category: 'yellow' },
    },

    // Default banner gradient (for non-case pages)
    DEFAULT_GRADIENT: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',

    // =================================================================
    // PAGE MODE CONFIGURATION
    // =================================================================
    // Controls which sections/features are visible based on page type
    // Allows single module to serve both ProQuest and Clarivate domains
    
    /**
     * Page mode configuration
     * 'full' - All sections visible (ProQuest/Ex Libris Salesforce)
     * 'minimal' - Only timezone, messages, and tools (Clarivate Salesforce)
     */
    pageMode: 'full',
    
    /**
     * Page configuration - controls which sections are visible
     */
    pageConfig: {
        // Section visibility
        showCurrentPage: true,       // "Current Page" section
        showMetadata: true,          // "Primary Metadata" section (case details)
        showMessages: true,          // Messages section
        showCustomerEnv: true,       // "Customer Env" button
        showTools: true,             // "Tools" button
        showWikiShortcuts: true,     // "Wiki Shortcuts" button
        showNavigationHistory: true, // "Navigation History" section
        
        // Feature flags
        enableCaseDataExtraction: true,  // Extract and display case data
        enableTimezoneDisplay: true,     // Show timezone fields
        enableCustomerTime: true,        // Show customer current time
        enableMessageRotation: true,     // Auto-rotate messages
        enableMetadataRotation: true,    // Auto-rotate metadata fields
        enableDataPolling: true,         // Poll for data updates
        enableContextValidation: true,   // Validate page context
        
        // CSS class suffix for styling ('' for full, '-cforce' for minimal)
        classNameSuffix: '',
        
        // Banner ID (for unique DOM identification)
        bannerId: 'exl-persistent-banner'
    },
    
    /**
     * Predefined page mode configurations
     */
    PAGE_MODE_CONFIGS: {
        // Full mode - ProQuest/Ex Libris Salesforce (default)
        full: {
            showCurrentPage: true,
            showMetadata: true,
            showMessages: true,
            showCustomerEnv: true,
            showTools: true,
            showWikiShortcuts: true,
            showNavigationHistory: true,
            enableCaseDataExtraction: true,
            enableTimezoneDisplay: true,
            enableCustomerTime: true,
            enableMessageRotation: true,
            enableMetadataRotation: true,
            enableDataPolling: true,
            enableContextValidation: true,
            classNameSuffix: '',
            bannerId: 'exl-persistent-banner'
        },
        
        // Minimal mode - Clarivate Salesforce (simplified)
        minimal: {
            showCurrentPage: false,
            showMetadata: false,
            showMessages: true,
            showCustomerEnv: false,
            showTools: true,
            showWikiShortcuts: false,
            showNavigationHistory: false,
            enableCaseDataExtraction: false,
            enableTimezoneDisplay: true,
            enableCustomerTime: true,
            enableMessageRotation: true,
            enableMetadataRotation: false,
            enableDataPolling: false,
            enableContextValidation: false,
            classNameSuffix: '-cforce',
            bannerId: 'exl-persistent-banner-cforce'
        }
    },
    
    /**
     * Set page mode - configures banner for different environments
     * @param {string} mode - 'full' | 'minimal'
     */
    setPageMode(mode) {
        if (!this.PAGE_MODE_CONFIGS[mode]) {
            console.warn(`[PersistentBanner] Unknown page mode: ${mode}, defaulting to 'full'`);
            mode = 'full';
        }
        
        this.pageMode = mode;
        this.pageConfig = { ...this.PAGE_MODE_CONFIGS[mode] };
        this.bannerId = this.pageConfig.bannerId;
        
        console.log(`[PersistentBanner] Page mode set to '${mode}'`);
    },

    // =================================================================
    // UTILITY METHODS - Image Compression & Validation
    // =================================================================

    /**
     * Escape HTML entities for safe display
     * Delegates to PersistentBannerBase.BannerMessageManager
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        return PersistentBannerBase.BannerMessageManager.escapeHtml(text);
    },

    /**
     * Compress base64 image to specified max width while maintaining aspect ratio
     * Delegates to PersistentBannerBase.BannerImageManager
     * @param {string} base64String - Base64 image string (with or without data URI prefix)
     * @param {number} maxWidth - Maximum width in pixels (default 700)
     * @param {number} quality - JPEG quality 0-1 (default 0.85)
     * @returns {Promise<string>} Compressed base64 string
     */
    async compressBase64Image(base64String, maxWidth = 700, quality = 0.85) {
        return PersistentBannerBase.BannerImageManager.compressImage(base64String, maxWidth, quality);
    },

    /**
     * Validate and compress image, checking size constraints
     * Delegates to PersistentBannerBase.BannerImageManager
     * @param {string} base64String - Base64 image string
     * @returns {Promise<{valid: boolean, compressed: string|null, error: string|null, originalSize: number, compressedSize: number}>}
     */
    async validateAndCompressImage(base64String) {
        return PersistentBannerBase.BannerImageManager.validateAndCompress(base64String);
    },

    /**
     * Convert image URL to base64
     * Delegates to PersistentBannerBase.BannerImageManager
     * @param {string} imageUrl - Image URL
     * @returns {Promise<string>} Base64 string
     */
    async imageUrlToBase64(imageUrl) {
        return PersistentBannerBase.BannerImageManager.urlToBase64(imageUrl);
    },

    /**
     * Extract image from clipboard paste event
     * Delegates to PersistentBannerBase.BannerImageManager
     * @param {ClipboardEvent} event - Paste event
     * @returns {Promise<string|null>} Base64 string or null
     */
    async extractImageFromClipboard(event) {
        return PersistentBannerBase.BannerImageManager.extractFromClipboard(event);
    },

    /**
     * Validate message text
     * Delegates to PersistentBannerBase.BannerMessageManager
     * @param {string} text - Message text
     * @returns {{valid: boolean, error: string|null}}
     */
    validateMessageText(text) {
        return PersistentBannerBase.BannerMessageManager.validateText(text);
    },

    // =================================================================
    // STORAGE MANAGEMENT - Local Storage with Sync Preparation
    // =================================================================

    /**
     * Migrate legacy messages from chrome.storage.sync to chrome.storage.local
     * Called once during initialization if migration not yet complete
     * @returns {Promise<boolean>} True if migration performed
     */
    async migrateLegacyMessagesFromSync() {
        return new Promise((resolve) => {
            // Check if migration already done
            chrome.storage.local.get(['exl_bannerMessages_migrated'], (result) => {
                if (result.exl_bannerMessages_migrated) {
                    console.log('[PersistentBanner] Migration already complete, skipping');
                    resolve(false);
                    return;
                }

                // Read legacy data from sync storage
                chrome.storage.sync.get(['exlibris'], (syncResult) => {
                    const legacyMessages = syncResult.exlibris?.persistentBanner?.messages;

                    if (!legacyMessages) {
                        console.log('[PersistentBanner] No legacy messages found to migrate');
                        // Mark migration complete even if no data
                        chrome.storage.local.set({ exl_bannerMessages_migrated: true });
                        resolve(false);
                        return;
                    }

                    // Convert to new local storage format
                    const newFormat = {
                        enabled: legacyMessages.enabled !== false,
                        autoRotate: legacyMessages.autoRotate !== false,
                        rotationInterval: legacyMessages.rotationInterval || 5000,
                        defaultMessages: legacyMessages.defaultMessages || { enabled: true, items: [] },
                        customMessages: legacyMessages.customMessages || [],
                        syncEnabled: false,
                        lastSyncTime: null,
                        migrated: true
                    };

                    // Save to local storage
                    chrome.storage.local.set({
                        exl_bannerMessages: newFormat,
                        exl_bannerMessages_migrated: true
                    }, () => {
                        console.log('[PersistentBanner] Successfully migrated messages from sync to local storage');
                        console.log(`[PersistentBanner] Migrated ${newFormat.customMessages.length} custom messages and ${newFormat.defaultMessages.items?.length || 0} default messages`);
                        resolve(true);
                    });
                });
            });
        });
    },

    /**
     * Load messages from chrome.storage.local
     * Uses PersistentBannerBase.BannerMessageManager for storage operations
     * @returns {Promise<void>}
     */
    async loadMessagesFromLocal() {
        const messagesConfig = await PersistentBannerBase.BannerMessageManager.loadMessages();

        if (!messagesConfig) {
            this.activeMessages = [];
            this.messageSettings = null;
            console.log('[PersistentBanner] No messages found in local storage');
            return;
        }

        this.messageSettings = messagesConfig;
        this.activeMessages = await this.getActiveMessages(messagesConfig);

        // Check for pinned message matching current case
        this.prioritizePinnedMessage();

        console.log(`[PersistentBanner] Loaded ${this.activeMessages.length} active messages from local storage`);
    },

    /**
     * Save messages to chrome.storage.local
     * Uses PersistentBannerBase.BannerMessageManager for storage operations
     * @param {Object} messagesConfig - Messages configuration
     * @returns {Promise<boolean>} Success status
     */
    async saveMessagesToLocal(messagesConfig) {
        const saved = await PersistentBannerBase.BannerMessageManager.saveMessages(messagesConfig);
        if (!saved) {
            console.warn('[PersistentBanner] Failed to save messages (quota exceeded or error)');
        }
        return saved;
    },

    // =================================================================
    // CLEANUP TRACKING UTILITIES
    // =================================================================

    /**
     * Register a timer for cleanup tracking
     * @param {number} timerId - Timer ID from setTimeout/setInterval
     * @param {string} type - 'timeout' or 'interval'
     * @returns {number} The timer ID (for chaining)
     */
    registerTimer(timerId, type = 'interval') {
        this.trackedTimers.push({ id: timerId, type });
        return timerId;
    },

    /**
     * Register an event listener for cleanup tracking
     * @param {Element} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Event listener options
     */
    registerListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        this.trackedListeners.push({ element, event, handler, options });
    },

    /**
     * Register a MutationObserver for cleanup tracking
     * @param {MutationObserver} observer - Observer instance
     */
    registerObserver(observer) {
        this.trackedObservers.push(observer);
    },

    /**
     * Clean up all tracked resources
     */
    cleanupTrackedResources() {
        // Clear all timers
        this.trackedTimers.forEach(({ id, type }) => {
            if (type === 'interval') {
                clearInterval(id);
            } else {
                clearTimeout(id);
            }
        });
        this.trackedTimers = [];

        // Remove all listeners
        this.trackedListeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        this.trackedListeners = [];

        // Disconnect all observers
        this.trackedObservers.forEach(observer => {
            observer.disconnect();
        });
        this.trackedObservers = [];

        console.log('[PersistentBanner] Cleaned up all tracked resources');
    },

    /**
     * Setup hover image functionality for a message element
     * @param {HTMLElement} messageElement - The message element to attach hover listeners to
     * @param {string} hoverImage - Base64 image data URL
     * @param {string} messageText - Message text for accessibility
     */
    setupHoverImage(messageElement, hoverImage, messageText = '') {
        if (!messageElement || !hoverImage) {
            return;
        }

        // Add cursor pointer to indicate interactivity
        messageElement.style.cursor = 'pointer';
        messageElement.title = 'Hover to see image';

        // Mouse enter handler - show popup after 200ms delay
        const handleMouseEnter = (event) => {
            // Clear any existing timeout
            if (this.hoverImageTimeout) {
                clearTimeout(this.hoverImageTimeout);
            }

            // Set timeout for 200ms delay
            this.hoverImageTimeout = this.registerTimer(setTimeout(() => {
                this.showHoverImagePopup(hoverImage, event, messageText);
            }, 200), 'timeout');
        };

        // Mouse leave handler - cleanup popup
        const handleMouseLeave = () => {
            // Clear timeout if mouse leaves before popup shows
            if (this.hoverImageTimeout) {
                clearTimeout(this.hoverImageTimeout);
                this.hoverImageTimeout = null;
            }

            this.cleanupHoverImagePopup();
        };

        // Register listeners for cleanup tracking
        this.registerListener(messageElement, 'mouseenter', handleMouseEnter);
        this.registerListener(messageElement, 'mouseleave', handleMouseLeave);
    },

    /**
     * Show hover image popup at cursor position
     * @param {string} imageData - Base64 image data URL
     * @param {MouseEvent} event - Mouse event for positioning
     * @param {string} altText - Alternative text for accessibility
     */
    showHoverImagePopup(imageData, event, altText = '') {
        // Cleanup any existing popup first
        this.cleanupHoverImagePopup();

        // Create popup container
        const popup = document.createElement('div');
        popup.className = 'exl-hover-image-popup';
        popup.style.cssText = `
            position: fixed;
            z-index: 999999;
            background: white;
            border: 2px solid #0070d2;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            padding: 8px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
            max-width: 400px;
        `;

        // Create image element
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = altText || 'Hover image';
        img.style.cssText = `
            display: block;
            max-width: 100%;
            height: auto;
            border-radius: 2px;
        `;

        popup.appendChild(img);
        document.body.appendChild(popup);

        // Position popup above cursor with 10px margin
        const positionPopup = () => {
            const rect = popup.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            let top = event.clientY - rect.height - 10;
            let left = event.clientX - (rect.width / 2);

            // Fallback: if overflow top, position below cursor
            if (top < 0) {
                top = event.clientY + 10;
            }

            // Constrain to viewport horizontally
            if (left < 0) {
                left = 10;
            } else if (left + rect.width > viewportWidth) {
                left = viewportWidth - rect.width - 10;
            }

            // Constrain to viewport vertically (bottom)
            if (top + rect.height > viewportHeight) {
                top = viewportHeight - rect.height - 10;
            }

            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        };

        // Wait for image to load before positioning
        img.onload = () => {
            positionPopup();
            // Fade in
            setTimeout(() => {
                popup.style.opacity = '1';
            }, 10);
        };

        // Store reference
        this.hoverImagePopup = popup;
    },

    /**
     * Cleanup hover image popup
     */
    cleanupHoverImagePopup() {
        // Clear timeout if pending
        if (this.hoverImageTimeout) {
            clearTimeout(this.hoverImageTimeout);
            this.hoverImageTimeout = null;
        }

        // Remove popup with fade out
        if (this.hoverImagePopup) {
            this.hoverImagePopup.style.opacity = '0';

            // Remove after fade animation completes
            setTimeout(() => {
                if (this.hoverImagePopup && this.hoverImagePopup.parentNode) {
                    this.hoverImagePopup.parentNode.removeChild(this.hoverImagePopup);
                }
                this.hoverImagePopup = null;
            }, 200);
        }
    },

    /**
     * Show context menu for message interactions
     * @param {MouseEvent} event - Right-click event for positioning
     * @param {string} messageId - ID of the message
     */
    showContextMenu(event, messageId) {
        event.preventDefault();
        event.stopPropagation();

        // Close any existing context menu
        this.closeContextMenu();

        // Get message data
        const message = this.activeMessages.find(m => m.id === messageId) || this.currentDisplayedMessage;
        if (!message) {
            console.warn('[PersistentBanner] Cannot show context menu - message not found');
            return;
        }

        // Get current case context for conditional pin option
        let currentContext = null;
        if (typeof CaseContextWatcher !== 'undefined' && typeof CaseContextWatcher.getCurrentContext === 'function') {
            currentContext = CaseContextWatcher.getCurrentContext();
        }

        // Create menu element
        const menu = document.createElement('div');
        menu.className = 'exl-context-menu';
        menu.style.cssText = `
            position: fixed;
            z-index: 999999;
            background: white;
            border: 1px solid #d0d0d0;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            padding: 4px 0;
            min-width: 180px;
        `;

        // Build menu items
        const menuItems = [];

        // Add New Message (always available)
        menuItems.push({ label: 'Add New Message', action: 'addNew', icon: '➕' });

        // Separator
        menuItems.push({ separator: true });

        // Edit Message
        menuItems.push({ label: 'Edit Message', action: 'edit', icon: '✏️' });

        // Image options
        if (!message.hoverImage) {
            menuItems.push({ label: 'Add Hover Image', action: 'addImage', icon: '🖼️' });
        } else {
            menuItems.push({ label: 'View Hover Image', action: 'viewImage', icon: '👁️' });
            menuItems.push({ label: 'Remove Hover Image', action: 'removeImage', icon: '🗑️' });
        }

        // Pin/Unpin options
        if (currentContext && currentContext.isCase) {
            if (!message.pinnedCaseNumber) {
                menuItems.push({ label: 'Pin to Current Case', action: 'pin', icon: '📌' });
            } else {
                menuItems.push({ label: 'Unpin from Case', action: 'unpin', icon: '📍' });
            }
        }

        // Separator
        menuItems.push({ separator: true });

        // Mark as Noted (hide from display)
        menuItems.push({ label: 'Mark as Noted', action: 'noted', icon: '✓' });

        // Remove Message
        menuItems.push({ label: 'Remove Message', action: 'remove', icon: '❌' });

        // Render menu items
        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: #e0e0e0; margin: 4px 0;';
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'exl-context-menu-item';
                menuItem.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: background 0.1s ease;
                `;
                menuItem.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;

                // Hover effect
                menuItem.addEventListener('mouseenter', () => {
                    menuItem.style.background = '#f0f0f0';
                });
                menuItem.addEventListener('mouseleave', () => {
                    menuItem.style.background = 'transparent';
                });

                // Click handler
                menuItem.addEventListener('click', () => {
                    this.handleContextMenuAction(item.action, message.id);
                    this.closeContextMenu();
                });

                menu.appendChild(menuItem);
            }
        });

        // Position menu at click coordinates
        menu.style.top = `${event.clientY}px`;
        menu.style.left = `${event.clientX}px`;

        // Adjust if menu would overflow viewport
        document.body.appendChild(menu);
        const rect = menu.getBoundingClientRect();

        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 10}px`;
        }

        // Close on outside click
        const closeOnOutsideClick = (e) => {
            if (!menu.contains(e.target)) {
                this.closeContextMenu();
                document.removeEventListener('click', closeOnOutsideClick);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeOnOutsideClick);
        }, 0);

        // Store references
        this.contextMenu = menu;
        this.contextMenuMessageId = message.id;
    },

    /**
     * Close context menu
     */
    closeContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
            this.contextMenuMessageId = null;
        }
    },

    /**
     * Handle context menu action
     * @param {string} action - Action to perform
     * @param {string} messageId - Message ID
     */
    async handleContextMenuAction(action, messageId) {
        console.log(`[PersistentBanner] Context menu action: ${action} for message ${messageId}`);

        switch (action) {
            case 'addNew':
                await this.showAddNewMessageModal();
                break;
            case 'edit':
                this.showEditModal(messageId);
                break;
            case 'addImage':
                this.showAddImageModal(messageId);
                break;
            case 'viewImage':
                this.showViewImageModal(messageId);
                break;
            case 'removeImage':
                await this.removeMessageImage(messageId);
                break;
            case 'pin':
                await this.pinMessageToCase(messageId);
                break;
            case 'unpin':
                await this.unpinMessageFromCase(messageId);
                break;
            case 'noted':
                await this.markMessageAsNoted(messageId);
                break;
            case 'remove':
                await this.removeMessage(messageId);
                break;
            default:
                console.warn(`[PersistentBanner] Unknown context menu action: ${action}`);
        }
    },

    /**
     * Remove hover image from message
     * @param {string} messageId - Message ID
     */
    async removeMessageImage(messageId) {
        const messagesConfig = await this.loadMessagesFromLocal();
        const message = messagesConfig.customMessages.find(m => m.id === messageId);

        if (message) {
            message.hoverImage = null;

            const saved = await this.saveMessagesToLocal(messagesConfig);
            if (saved) {
                this.showNotification('Hover image removed', 'success');
                // Reload messages to update display
                await this.loadAndDisplayMessages();
            }
        }
    },

    /**
     * Remove message
     * @param {string} messageId - Message ID
     */
    async removeMessage(messageId) {
        const messagesConfig = await this.loadMessagesFromLocal();
        messagesConfig.customMessages = messagesConfig.customMessages.filter(m => m.id !== messageId);

        const saved = await this.saveMessagesToLocal(messagesConfig);
        if (saved) {
            this.showNotification('Message removed', 'success');
            // Reload messages to update display
            await this.loadAndDisplayMessages();
        }
    },

    /**
     * Pin message to current case
     * @param {string} messageId - Message ID to pin
     */
    async pinMessageToCase(messageId) {
        // Get current case context
        if (typeof CaseContextWatcher === 'undefined' || typeof CaseContextWatcher.getCurrentContext !== 'function') {
            this.showNotification('Cannot pin - CaseContextWatcher not available', 'error');
            return;
        }

        const context = CaseContextWatcher.getCurrentContext();
        if (!context || !context.isCase) {
            this.showNotification('Cannot pin - not on a case page', 'error');
            return;
        }

        if (!context.caseNumber) {
            this.showNotification('Cannot pin - case number not available', 'error');
            return;
        }

        // Load messages
        const messagesConfig = await this.loadMessagesFromLocal();

        // Check if case already has a pinned message (one-per-case rule)
        const existingPinned = messagesConfig.customMessages.find(
            m => m.pinnedCaseNumber === context.caseNumber && m.id !== messageId
        );

        if (existingPinned) {
            this.showNotification(`Case ${context.caseNumber} already has a pinned message`, 'error');
            return;
        }

        // Find and update message
        const message = messagesConfig.customMessages.find(m => m.id === messageId);
        if (!message) {
            this.showNotification('Message not found', 'error');
            return;
        }

        // Pin message
        message.pinnedCaseNumber = context.caseNumber;
        message.pinnedCaseId = context.caseId;
        message.pinnedCaseUrl = context.url || window.location.href;

        // Save
        const saved = await this.saveMessagesToLocal(messagesConfig);
        if (saved) {
            this.showNotification(`Message pinned to case ${context.caseNumber}`, 'success');
            // Reload messages to update display
            await this.loadAndDisplayMessages();
        }
    },

    /**
     * Unpin message from case
     * @param {string} messageId - Message ID to unpin
     */
    async unpinMessageFromCase(messageId) {
        const messagesConfig = await this.loadMessagesFromLocal();
        const message = messagesConfig.customMessages.find(m => m.id === messageId);

        if (!message) {
            this.showNotification('Message not found', 'error');
            return;
        }

        const pinnedCaseNumber = message.pinnedCaseNumber;

        // Unpin message
        message.pinnedCaseNumber = null;
        message.pinnedCaseId = null;
        message.pinnedCaseUrl = null;

        // Save
        const saved = await this.saveMessagesToLocal(messagesConfig);
        if (saved) {
            this.showNotification(`Message unpinned from case ${pinnedCaseNumber}`, 'success');
            // Reload messages to update display
            await this.loadAndDisplayMessages();
        }
    },

    /**
     * Prioritize pinned message for current case
     * If on a case page and a message is pinned to this case, move it to front and display immediately
     */
    prioritizePinnedMessage() {
        // Get current case context
        if (typeof CaseContextWatcher === 'undefined' || typeof CaseContextWatcher.getCurrentContext !== 'function') {
            return;
        }

        const context = CaseContextWatcher.getCurrentContext();
        if (!context || !context.isCase || !context.caseNumber) {
            return;
        }

        // Search for pinned message matching this case
        const pinnedIndex = this.activeMessages.findIndex(m => m.pinnedCaseNumber === context.caseNumber);

        if (pinnedIndex !== -1) {
            // Move pinned message to front
            const [pinnedMessage] = this.activeMessages.splice(pinnedIndex, 1);
            this.activeMessages.unshift(pinnedMessage);

            // Set current index to 0 to display pinned message
            this.currentMessageIndex = 0;

            console.log(`[PersistentBanner] Prioritized pinned message for case ${context.caseNumber}`);
        }
    },

    /**
     * Load and display messages (used after updates)
     */
    async loadAndDisplayMessages() {
        await this.loadMessagesFromLocal();
        this.updateMessageDisplay();
    },

    /**
     * Show modal to add a new message
     */
    async showAddNewMessageModal() {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'exl-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(3px);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'exl-add-message-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;

        modal.innerHTML = `
            <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #333;">Add New Message</h2>
            
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Message Text <span style="color: #999;">(4000 chars max)</span>
            </label>
            <textarea 
                class="exl-add-message-text"
                style="width: 100%; min-height: 150px; padding: 12px; border: 1px solid #d0d0d0; border-radius: 4px; font-family: inherit; font-size: 14px; resize: vertical;"
                maxlength="4000"
                placeholder="Enter your message text..."
            ></textarea>
            <div class="exl-char-counter" style="text-align: right; font-size: 12px; color: #666; margin-top: 4px;">
                0/4000
            </div>
            
            <label style="display: block; margin: 16px 0 8px 0; font-weight: 600; color: #333;">
                Description <span style="color: #999;">(optional)</span>
            </label>
            <textarea 
                class="exl-add-message-description"
                style="width: 100%; min-height: 80px; padding: 12px; border: 1px solid #d0d0d0; border-radius: 4px; font-family: inherit; font-size: 14px; resize: vertical;"
                placeholder="Add a description for this message..."
            ></textarea>
            
            <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
                <button class="exl-modal-cancel" style="padding: 10px 24px; border: 1px solid #d0d0d0; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    Cancel
                </button>
                <button class="exl-modal-save" style="padding: 10px 24px; border: none; background: #0070d2; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;">
                    Add Message
                </button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Get elements
        const textArea = modal.querySelector('.exl-add-message-text');
        const descArea = modal.querySelector('.exl-add-message-description');
        const charCounter = modal.querySelector('.exl-char-counter');
        const cancelBtn = modal.querySelector('.exl-modal-cancel');
        const saveBtn = modal.querySelector('.exl-modal-save');

        // Character counter
        textArea.addEventListener('input', () => {
            charCounter.textContent = `${textArea.value.length}/4000`;
        });

        // Close modal function
        const closeModal = () => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
        };

        // Cancel handler
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Save handler
        saveBtn.addEventListener('click', async () => {
            const text = textArea.value.trim();
            const description = descArea.value.trim();

            if (!text) {
                this.showNotification('Message text is required', 'error');
                return;
            }

            // Generate unique ID
            const newMessageId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Load existing messages
            const messagesConfig = await this.loadMessagesFromLocal();

            // Create new message
            const newMessage = {
                id: newMessageId,
                text: text,
                description: description || null,
                displayMode: 'banner',
                enabled: true,
                hoverImage: null,
                pinnedCaseNumber: null,
                pinnedCaseId: null,
                pinnedCaseUrl: null,
                createdAt: Date.now()
            };

            // Add to custom messages
            messagesConfig.customMessages.push(newMessage);

            // Save
            const saved = await this.saveMessagesToLocal(messagesConfig);
            if (saved) {
                this.showNotification('Message added successfully', 'success');
                closeModal();
                // Reload messages to update display
                await this.loadAndDisplayMessages();
            } else {
                this.showNotification('Failed to save message', 'error');
            }
        });

        // Focus on text area
        textArea.focus();
    },

    /**
     * Show Text Formatter modal
     * Provides Unicode text formatting for case comments
     */
    showTextFormatterModal() {
        // Remove existing modal
        const existing = document.getElementById('exl-text-formatter-modal');
        if (existing) existing.remove();

        // Get available styles from TextFormatter or use defaults
        const styles = typeof TextFormatter !== 'undefined' && TextFormatter.characterMaps
            ? Object.keys(TextFormatter.characterMaps).filter(s => s !== 'normal')
            : ['bold', 'boldItalic', 'italic', 'boldSerif', 'code'];

        // Create style preview helper
        const convertSampleText = (text, style) => {
            if (typeof TextFormatter !== 'undefined' && TextFormatter.convertToStyle) {
                return TextFormatter.convertToStyle(text, style);
            }
            return text;
        };

        let styleOptionsHTML = styles.map(style => {
            const displayName = style.replace(/([A-Z])/g, ' $1').trim();
            const sampleText = convertSampleText('Sample', style);
            return `
                <button class="exl-text-style-btn" data-style="${style}" title="${displayName}" style="display: flex; flex-direction: column; align-items: center; padding: 8px 12px; border: 1px solid #d0d0d0; border-radius: 4px; background: #fff; cursor: pointer; min-width: 70px;">
                    <span class="exl-style-preview" style="font-size: 14px; margin-bottom: 4px;">${sampleText}</span>
                    <span class="exl-style-name" style="font-size: 10px; color: #666;">${displayName}</span>
                </button>
            `;
        }).join('');

        // Get bullet symbols
        const symbols = typeof TextFormatter !== 'undefined' && TextFormatter.symbols
            ? TextFormatter.symbols
            : ['▪', '∘', '▫', '►', '▻', '▸', '▹', '▿', '▾', '⋯', '⋮'];

        let symbolsHTML = symbols.map(sym => `
            <button class="exl-symbol-btn" data-symbol="${sym}" title="Insert ${sym}" style="padding: 6px 10px; border: 1px solid #d0d0d0; border-radius: 4px; background: #fff; cursor: pointer; font-size: 16px;">${sym}</button>
        `).join('');

        const overlay = document.createElement('div');
        overlay.id = 'exl-text-formatter-modal';
        overlay.className = 'exl-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(3px);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        `;

        overlay.innerHTML = `
            <div class="exl-text-formatter-content" style="background: white; border-radius: 8px; padding: 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 20px; color: #333;">Text Formatter</h2>
                    <button class="exl-modal-close" title="Close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
                </div>
                
                <!-- Input Section -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Input Text:</label>
                    <textarea id="exl-formatter-input" rows="3" placeholder="Enter text to format..." style="width: 100%; padding: 12px; border: 1px solid #d0d0d0; border-radius: 4px; font-family: inherit; font-size: 14px; resize: vertical;"></textarea>
                </div>
                
                <!-- Style Buttons -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Apply Style:</label>
                    <div class="exl-style-buttons" style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${styleOptionsHTML}
                    </div>
                </div>
                
                <!-- Symbols -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Insert Symbol:</label>
                    <div class="exl-symbol-buttons" style="display: flex; gap: 6px; flex-wrap: wrap;">
                        ${symbolsHTML}
                    </div>
                </div>
                
                <!-- Output Section -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Formatted Output:</label>
                    <textarea id="exl-formatter-output" rows="3" readonly placeholder="Formatted text will appear here..." style="width: 100%; padding: 12px; border: 1px solid #d0d0d0; border-radius: 4px; font-family: inherit; font-size: 14px; resize: vertical; background: #f9f9f9;"></textarea>
                </div>
                
                <!-- Actions -->
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="exl-formatter-clear" style="padding: 10px 24px; border: 1px solid #d0d0d0; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">Clear</button>
                    <button id="exl-formatter-copy" style="padding: 10px 24px; border: none; background: #0070d2; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;">Copy Output</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Wire up events
        const inputEl = overlay.querySelector('#exl-formatter-input');
        const outputEl = overlay.querySelector('#exl-formatter-output');
        const closeBtn = overlay.querySelector('.exl-modal-close');
        const clearBtn = overlay.querySelector('#exl-formatter-clear');
        const copyBtn = overlay.querySelector('#exl-formatter-copy');

        // Close button
        closeBtn.addEventListener('click', () => overlay.remove());

        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        // ESC to close
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Style buttons
        overlay.querySelectorAll('.exl-text-style-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const style = btn.dataset.style;
                const inputText = inputEl.value;

                if (!inputText.trim()) {
                    outputEl.value = '';
                    return;
                }

                const formatted = convertSampleText(inputText, style);
                outputEl.value = formatted;
            });
        });

        // Symbol buttons
        overlay.querySelectorAll('.exl-symbol-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const symbol = btn.dataset.symbol;
                const cursorPos = inputEl.selectionStart;
                const textBefore = inputEl.value.substring(0, cursorPos);
                const textAfter = inputEl.value.substring(inputEl.selectionEnd);

                inputEl.value = textBefore + symbol + textAfter;
                inputEl.focus();
                inputEl.selectionStart = inputEl.selectionEnd = cursorPos + symbol.length;
            });
        });

        // Clear button
        clearBtn.addEventListener('click', () => {
            inputEl.value = '';
            outputEl.value = '';
            inputEl.focus();
        });

        // Copy button
        copyBtn.addEventListener('click', async () => {
            const output = outputEl.value;
            if (!output.trim()) {
                this.showNotification('Nothing to copy. Please format some text first.', 'warning');
                return;
            }

            try {
                await navigator.clipboard.writeText(output);
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            } catch (error) {
                console.error('[PersistentBanner] Copy failed:', error);
                this.showNotification('Failed to copy. Please copy manually.', 'error');
            }
        });

        // Focus input
        inputEl.focus();
    },

    /**
     * Show Edit Messages modal (Message Manager)
     * Lists all messages with edit/delete/toggle capabilities
     */
    showEditMessagesModal() {
        // Remove existing modal
        const existing = document.getElementById('exl-message-manager-modal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'exl-message-manager-modal';
        overlay.className = 'exl-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(3px);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        `;

        overlay.innerHTML = `
            <div class="exl-message-manager-content" style="background: white; border-radius: 8px; padding: 24px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 20px; color: #333;">Message Manager</h2>
                    <button class="exl-modal-close" title="Close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
                </div>
                
                <div id="exl-message-list" style="min-height: 100px; margin-bottom: 16px;">
                    <!-- Messages will be populated here -->
                    <div style="text-align: center; color: #666; padding: 20px;">Loading messages...</div>
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="exl-msg-manager-add" style="padding: 10px 24px; border: none; background: #0070d2; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;">➕ Add Message</button>
                    <button id="exl-msg-manager-close" style="padding: 10px 24px; border: 1px solid #d0d0d0; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Populate message list
        this.populateMessageManagerList(overlay);

        // Wire events
        const closeBtn = overlay.querySelector('.exl-modal-close');
        const closeBottomBtn = overlay.querySelector('#exl-msg-manager-close');
        const addBtn = overlay.querySelector('#exl-msg-manager-add');

        closeBtn.addEventListener('click', () => overlay.remove());
        closeBottomBtn.addEventListener('click', () => overlay.remove());
        
        addBtn.addEventListener('click', async () => {
            overlay.remove();
            await this.showAddNewMessageModal();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        // ESC to close
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    },

    /**
     * Populate message list in Message Manager modal
     */
    async populateMessageManagerList(modal) {
        const listContainer = modal.querySelector('#exl-message-list');
        const messagesConfig = await this.loadMessagesFromLocal();
        const messages = messagesConfig.customMessages || [];

        if (messages.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #666;">
                    <p style="font-size: 48px; margin: 0 0 12px 0;">📭</p>
                    <p style="margin: 0 0 8px 0; font-size: 16px;">No messages yet.</p>
                    <p style="margin: 0; font-size: 14px;">Click "Add Message" to create your first message.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = messages.map((msg, index) => `
            <div class="exl-message-item" data-index="${index}" data-id="${msg.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 8px; background: #f9f9f9;">
                <div class="exl-message-item-content" style="flex: 1; overflow: hidden;">
                    <div class="exl-message-item-text" style="font-size: 14px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml((msg.text || '').substring(0, 80))}${(msg.text || '').length > 80 ? '...' : ''}</div>
                    ${msg.description ? `<div class="exl-message-item-desc" style="font-size: 12px; color: #666; margin-top: 4px;">${this.escapeHtml(msg.description)}</div>` : ''}
                </div>
                <div class="exl-message-item-actions" style="display: flex; gap: 8px; align-items: center; margin-left: 12px;">
                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                        <input type="checkbox" data-action="toggle" ${msg.enabled !== false ? 'checked' : ''}>
                        <span style="font-size: 12px; color: #666;">On</span>
                    </label>
                    <button class="exl-btn-icon" data-action="edit" title="Edit" style="padding: 6px; border: none; background: none; cursor: pointer; font-size: 16px;">✏️</button>
                    <button class="exl-btn-icon exl-btn-danger" data-action="delete" title="Delete" style="padding: 6px; border: none; background: none; cursor: pointer; font-size: 16px;">🗑️</button>
                </div>
            </div>
        `).join('');

        // Wire item events
        listContainer.querySelectorAll('.exl-message-item').forEach((item) => {
            const messageId = item.dataset.id;

            // Toggle enabled
            const toggle = item.querySelector('[data-action="toggle"]');
            toggle?.addEventListener('change', async (e) => {
                await this.toggleMessageEnabled(messageId, e.target.checked);
            });

            // Edit button
            const editBtn = item.querySelector('[data-action="edit"]');
            editBtn?.addEventListener('click', async () => {
                modal.remove();
                await this.showEditModal(messageId);
            });

            // Delete button
            const deleteBtn = item.querySelector('[data-action="delete"]');
            deleteBtn?.addEventListener('click', async () => {
                await this.deleteMessageById(messageId, modal);
            });
        });
    },

    /**
     * Toggle message enabled state
     */
    async toggleMessageEnabled(messageId, enabled) {
        const messagesConfig = await this.loadMessagesFromLocal();
        const message = messagesConfig.customMessages.find(m => m.id === messageId);
        
        if (message) {
            message.enabled = enabled;
            await this.saveMessagesToLocal(messagesConfig);
            await this.loadAndDisplayMessages();
        }
    },

    /**
     * Delete message by ID
     */
    async deleteMessageById(messageId, modal) {
        if (!confirm('Delete this message?')) return;

        const messagesConfig = await this.loadMessagesFromLocal();
        messagesConfig.customMessages = messagesConfig.customMessages.filter(m => m.id !== messageId);
        
        await this.saveMessagesToLocal(messagesConfig);
        await this.loadAndDisplayMessages();
        
        if (modal) {
            this.populateMessageManagerList(modal);
        }
    },

    /**
     * Show edit modal for message
     * @param {string} messageId - Message ID to edit
     */
    async showEditModal(messageId) {
        const messagesConfig = await this.loadMessagesFromLocal();
        const message = messagesConfig.customMessages.find(m => m.id === messageId);

        if (!message) {
            this.showNotification('Message not found', 'error');
            return;
        }

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'exl-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(3px);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'exl-edit-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;

        modal.innerHTML = `
            <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #333;">Edit Message</h2>
            
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                Message Text <span style="color: #999;">(4000 chars max)</span>
            </label>
            <textarea 
                class="exl-edit-message-text"
                style="width: 100%; min-height: 150px; padding: 12px; border: 1px solid #d0d0d0; border-radius: 4px; font-family: inherit; font-size: 14px; resize: vertical;"
                maxlength="4000"
            >${message.text || ''}</textarea>
            <div class="exl-char-counter" style="text-align: right; font-size: 12px; color: #666; margin-top: 4px;">
                ${(message.text || '').length}/4000
            </div>
            
            <label style="display: block; margin: 16px 0 8px 0; font-weight: 600; color: #333;">
                Description <span style="color: #999;">(optional)</span>
            </label>
            <textarea 
                class="exl-edit-message-description"
                style="width: 100%; min-height: 80px; padding: 12px; border: 1px solid #d0d0d0; border-radius: 4px; font-family: inherit; font-size: 14px; resize: vertical;"
                placeholder="Add a description for this message..."
            >${message.description || ''}</textarea>
            
            <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
                <button class="exl-modal-cancel" style="padding: 10px 24px; border: 1px solid #d0d0d0; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    Cancel
                </button>
                <button class="exl-modal-save" style="padding: 10px 24px; border: none; background: #0070d2; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;">
                    Save Changes
                </button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Get elements
        const textArea = modal.querySelector('.exl-edit-message-text');
        const descArea = modal.querySelector('.exl-edit-message-description');
        const charCounter = modal.querySelector('.exl-char-counter');
        const cancelBtn = modal.querySelector('.exl-modal-cancel');
        const saveBtn = modal.querySelector('.exl-modal-save');

        // Character counter
        textArea.addEventListener('input', () => {
            charCounter.textContent = `${textArea.value.length}/4000`;
        });

        // Cancel handler
        const closeModal = () => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
            this.editModal = null;
        };

        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // ESC key handler
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Save handler
        saveBtn.addEventListener('click', async () => {
            const newText = textArea.value.trim();

            if (!newText) {
                this.showNotification('Message text cannot be empty', 'error');
                return;
            }

            // Validate text length
            const validation = this.validateMessageText(newText);
            if (!validation.valid) {
                this.showNotification(validation.error, 'error');
                return;
            }

            // Update message
            message.text = newText;
            message.description = descArea.value.trim();

            // Save
            const saved = await this.saveMessagesToLocal(messagesConfig);
            if (saved) {
                this.showNotification('Message updated', 'success');
                closeModal();
                await this.loadAndDisplayMessages();
            }
        });

        // Store reference
        this.editModal = overlay;
    },

    /**
     * Show add image modal with 3 input methods
     * @param {string} messageId - Message ID to add image to
     */
    async showAddImageModal(messageId) {
        const messagesConfig = await this.loadMessagesFromLocal();
        const message = messagesConfig.customMessages.find(m => m.id === messageId);

        if (!message) {
            this.showNotification('Message not found', 'error');
            return;
        }

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'exl-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(3px);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'exl-add-image-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;

        modal.innerHTML = `
            <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #333;">Add Hover Image</h2>
            
            <div class="exl-image-tabs" style="display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 2px solid #e0e0e0;">
                <button class="exl-tab-btn active" data-tab="upload" style="padding: 10px 20px; border: none; background: transparent; cursor: pointer; font-size: 14px; font-weight: 600; color: #666; border-bottom: 3px solid transparent; margin-bottom: -2px;">
                    📤 Upload
                </button>
                <button class="exl-tab-btn" data-tab="url" style="padding: 10px 20px; border: none; background: transparent; cursor: pointer; font-size: 14px; font-weight: 600; color: #666; border-bottom: 3px solid transparent; margin-bottom: -2px;">
                    🔗 URL
                </button>
                <button class="exl-tab-btn" data-tab="paste" style="padding: 10px 20px; border: none; background: transparent; cursor: pointer; font-size: 14px; font-weight: 600; color: #666; border-bottom: 3px solid transparent; margin-bottom: -2px;">
                    📋 Paste
                </button>
            </div>
            
            <div class="exl-tab-content">
                <!-- Upload Tab -->
                <div class="exl-tab-panel" data-panel="upload" style="display: block;">
                    <input type="file" accept="image/*" class="exl-image-upload" style="width: 100%; padding: 12px; border: 2px dashed #d0d0d0; border-radius: 4px; cursor: pointer;">
                </div>
                
                <!-- URL Tab -->
                <div class="exl-tab-panel" data-panel="url" style="display: none;">
                    <input type="text" class="exl-image-url" placeholder="https://example.com/image.jpg" style="width: 100%; padding: 12px; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 14px;">
                    <button class="exl-load-url-btn" style="margin-top: 12px; padding: 10px 24px; background: #0070d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
                        Load Image
                    </button>
                </div>
                
                <!-- Paste Tab -->
                <div class="exl-tab-panel" data-panel="paste" style="display: none;">
                    <div style="padding: 40px; border: 2px dashed #d0d0d0; border-radius: 4px; text-align: center; color: #666;">
                        <p style="margin: 0 0 8px 0; font-size: 16px;">📋</p>
                        <p style="margin: 0;">Copy an image and paste it here (Ctrl+V)</p>
                    </div>
                    <textarea class="exl-paste-area" style="opacity: 0; position: absolute; width: 1px; height: 1px;"></textarea>
                </div>
            </div>
            
            <div class="exl-image-preview-area" style="margin-top: 20px; display: none;">
                <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: #f5f5f5; border-radius: 4px;">
                    <img class="exl-preview-img" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 2px solid #d0d0d0;">
                    <div style="flex: 1;">
                        <div class="exl-image-info"></div>
                        <div class="exl-compression-info" style="font-size: 12px; color: #666; margin-top: 4px;"></div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
                <button class="exl-modal-cancel" style="padding: 10px 24px; border: 1px solid #d0d0d0; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    Cancel
                </button>
                <button class="exl-modal-save" style="padding: 10px 24px; border: none; background: #0070d2; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;" disabled>
                    Add Image
                </button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Get elements
        let currentImageData = null;
        const tabBtns = modal.querySelectorAll('.exl-tab-btn');
        const tabPanels = modal.querySelectorAll('.exl-tab-panel');
        const uploadInput = modal.querySelector('.exl-image-upload');
        const urlInput = modal.querySelector('.exl-image-url');
        const loadUrlBtn = modal.querySelector('.exl-load-url-btn');
        const pasteArea = modal.querySelector('.exl-paste-area');
        const previewArea = modal.querySelector('.exl-image-preview-area');
        const previewImg = modal.querySelector('.exl-preview-img');
        const imageInfo = modal.querySelector('.exl-image-info');
        const compressionInfo = modal.querySelector('.exl-compression-info');
        const cancelBtn = modal.querySelector('.exl-modal-cancel');
        const saveBtn = modal.querySelector('.exl-modal-save');

        // Tab switching
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;

                // Update tab buttons
                tabBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.color = '#666';
                    b.style.borderBottomColor = 'transparent';
                });
                btn.classList.add('active');
                btn.style.color = '#0070d2';
                btn.style.borderBottomColor = '#0070d2';

                // Update panels
                tabPanels.forEach(p => {
                    p.style.display = p.dataset.panel === targetTab ? 'block' : 'none';
                });

                // Focus paste area if paste tab
                if (targetTab === 'paste') {
                    pasteArea.focus();
                }
            });
        });

        // Process and display image
        const processImage = async (base64Data) => {
            try {
                compressionInfo.textContent = 'Compressing...';

                const result = await this.validateAndCompressImage(base64Data);

                if (!result.valid) {
                    this.showNotification(result.error, 'error');
                    compressionInfo.textContent = '';
                    return;
                }

                currentImageData = result.compressed;
                previewImg.src = result.compressed;
                previewArea.style.display = 'block';

                const originalKB = Math.round(result.sizes.original / 1024);
                const compressedKB = Math.round(result.sizes.compressed / 1024);
                const reduction = Math.round((1 - result.sizes.compressed / result.sizes.original) * 100);

                imageInfo.textContent = `Image ready (${compressedKB} KB)`;
                compressionInfo.textContent = `Compressed from ${originalKB} KB (${reduction}% reduction)`;
                saveBtn.disabled = false;

            } catch (error) {
                console.error('[PersistentBanner] Image processing error:', error);
                this.showNotification('Failed to process image', 'error');
            }
        };

        // Upload handler
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                processImage(event.target.result);
            };
            reader.readAsDataURL(file);
        });

        // URL handler
        loadUrlBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            if (!url) {
                this.showNotification('Please enter an image URL', 'error');
                return;
            }

            try {
                loadUrlBtn.textContent = 'Loading...';
                loadUrlBtn.disabled = true;

                const base64 = await this.imageUrlToBase64(url);
                await processImage(base64);

            } catch (error) {
                this.showNotification('Failed to load image from URL', 'error');
            } finally {
                loadUrlBtn.textContent = 'Load Image';
                loadUrlBtn.disabled = false;
            }
        });

        // Paste handler
        pasteArea.addEventListener('paste', async (e) => {
            try {
                const base64 = await this.extractImageFromClipboard(e);
                if (base64) {
                    await processImage(base64);
                } else {
                    this.showNotification('No image found in clipboard', 'error');
                }
            } catch (error) {
                this.showNotification('Failed to paste image', 'error');
            }
        });

        // Keep paste area focused
        document.addEventListener('click', (e) => {
            if (modal.contains(e.target) && tabPanels[2].style.display !== 'none') {
                pasteArea.focus();
            }
        });

        // Cancel handler
        const closeModal = () => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
            this.addImageModal = null;
        };

        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // ESC key handler
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Save handler
        saveBtn.addEventListener('click', async () => {
            if (!currentImageData) {
                this.showNotification('No image selected', 'error');
                return;
            }

            message.hoverImage = currentImageData;

            const saved = await this.saveMessagesToLocal(messagesConfig);
            if (saved) {
                this.showNotification('Hover image added', 'success');
                closeModal();
                await this.loadAndDisplayMessages();
            }
        });

        // Store reference
        this.addImageModal = overlay;
    },

    /**
     * Show view image modal (full-screen preview)
     * @param {string} messageId - Message ID
     */
    async showViewImageModal(messageId) {
        const messagesConfig = await this.loadMessagesFromLocal();
        const message = messagesConfig.customMessages.find(m => m.id === messageId);

        if (!message || !message.hoverImage) {
            this.showNotification('No image to display', 'error');
            return;
        }

        // Create full-screen overlay
        const overlay = document.createElement('div');
        overlay.className = 'exl-view-image-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
            cursor: pointer;
        `;

        // Create image container
        const container = document.createElement('div');
        container.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            position: relative;
        `;

        // Create image
        const img = document.createElement('img');
        img.src = message.hoverImage;
        img.alt = 'Full-size preview';
        img.style.cssText = `
            max-width: 100%;
            max-height: 90vh;
            border: 4px solid white;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            cursor: default;
        `;

        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: -16px;
            right: -16px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background: white;
            color: #333;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s ease;
        `;

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.transform = 'scale(1.1)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.transform = 'scale(1)';
        });

        container.appendChild(img);
        container.appendChild(closeBtn);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // Prevent image click from closing
        img.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Close handlers
        const closeModal = () => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
            this.viewImageModal = null;
        };

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
        });

        overlay.addEventListener('click', closeModal);

        // ESC key handler
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Store reference
        this.viewImageModal = overlay;
    },

    /**
     * Inject CSS styles for modals
     */
    injectModalStyles() {
        // Check if already injected
        if (document.getElementById('exl-modal-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'exl-modal-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .exl-tab-btn.active {
                color: #0070d2 !important;
                border-bottom-color: #0070d2 !important;
            }
            
            .exl-message-dropdown-item:hover {
                background: #f0f0f0 !important;
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * Pause message rotation (stores current state for resume)
     */
    pauseMessageRotation() {
        if (this.messageRotationInterval) {
            this.wasAutoRotating = true;
            this.stopMessageRotation();
            console.log('[PersistentBanner] Message rotation paused (hover)');
        }
    },

    /**
     * Resume message rotation if it was previously auto-rotating
     */
    resumeMessageRotation() {
        if (this.wasAutoRotating) {
            this.startMessageRotation();
            this.wasAutoRotating = false;
            console.log('[PersistentBanner] Message rotation resumed');
        }
    },

    /**
     * Show message dropdown with previews
     */
    showMessageDropdown() {
        // Close any existing dropdown
        this.closeMessageDropdown();

        if (this.activeMessages.length === 0) {
            return;
        }

        // Get message index position
        const indexElement = this.elements.messageIndex;
        if (!indexElement) return;

        const rect = indexElement.getBoundingClientRect();

        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'exl-message-dropdown';
        dropdown.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #d0d0d0;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-height: 400px;
            overflow-y: auto;
            z-index: 999999;
            min-width: 300px;
            animation: slideIn 0.2s ease;
        `;

        // Position dropdown
        dropdown.style.top = `${rect.bottom + 8}px`;
        dropdown.style.left = `${rect.left}px`;

        // Build dropdown items
        this.activeMessages.forEach((message, index) => {
            const item = document.createElement('div');
            item.className = 'exl-message-dropdown-item';
            item.style.cssText = `
                padding: 12px 16px;
                cursor: pointer;
                border-bottom: 1px solid #f0f0f0;
                display: flex;
                align-items: center;
                gap: 12px;
                transition: background 0.1s ease;
            `;

            // Remove border from last item
            if (index === this.activeMessages.length - 1) {
                item.style.borderBottom = 'none';
            }

            // Add thumbnail if hover image exists
            if (message.hoverImage) {
                const thumbnail = document.createElement('img');
                thumbnail.src = message.hoverImage;
                thumbnail.style.cssText = `
                    width: 40px;
                    height: 40px;
                    object-fit: cover;
                    border-radius: 4px;
                    border: 1px solid #d0d0d0;
                    flex-shrink: 0;
                `;
                item.appendChild(thumbnail);
            }

            // Add text content
            const content = document.createElement('div');
            content.style.cssText = 'flex: 1; min-width: 0;';

            // Message preview (first 50 chars)
            const preview = document.createElement('div');
            preview.style.cssText = `
                font-size: 14px;
                color: #333;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 4px;
            `;
            const previewText = message.text.length > 50
                ? message.text.substring(0, 50) + '...'
                : message.text;
            preview.textContent = previewText;
            content.appendChild(preview);

            // Metadata line
            const metadata = document.createElement('div');
            metadata.style.cssText = 'font-size: 11px; color: #666; display: flex; align-items: center; gap: 8px;';

            // Current indicator
            if (index === this.currentMessageIndex) {
                const currentBadge = document.createElement('span');
                currentBadge.textContent = '● Current';
                currentBadge.style.cssText = 'color: #0070d2; font-weight: 600;';
                metadata.appendChild(currentBadge);
            }

            // Pin indicator
            if (message.pinnedCaseNumber) {
                const pinBadge = document.createElement('span');
                pinBadge.textContent = `📌 ${message.pinnedCaseNumber}`;
                pinBadge.style.cssText = 'color: #e07800;';
                metadata.appendChild(pinBadge);
            }

            content.appendChild(metadata);
            item.appendChild(content);

            // Click handler
            item.addEventListener('click', () => {
                this.currentMessageIndex = index;
                this.updateMessageDisplay();
                this.closeMessageDropdown();
            });

            dropdown.appendChild(item);
        });

        document.body.appendChild(dropdown);

        // Adjust position if overflow
        const dropdownRect = dropdown.getBoundingClientRect();
        if (dropdownRect.right > window.innerWidth) {
            dropdown.style.left = `${window.innerWidth - dropdownRect.width - 10}px`;
        }
        if (dropdownRect.bottom > window.innerHeight) {
            dropdown.style.top = `${rect.top - dropdownRect.height - 8}px`;
        }

        // Close on outside click
        const closeOnOutsideClick = (e) => {
            if (!dropdown.contains(e.target) && e.target !== indexElement) {
                this.closeMessageDropdown();
                document.removeEventListener('click', closeOnOutsideClick);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeOnOutsideClick);
        }, 0);

        // Store reference
        this.messageDropdown = dropdown;
    },

    /**
     * Close message dropdown
     */
    closeMessageDropdown() {
        if (this.messageDropdown) {
            this.messageDropdown.remove();
            this.messageDropdown = null;
        }
    },

    /**
     * Initialize the persistent banner
     * @param {Object} options - Initialization options
     * @param {string} options.mode - Page mode: 'full' (default) or 'minimal'
     */
    async init(options = {}) {
        if (this.isInitialized) {
            console.log('[PersistentBanner] Already initialized');
            return;
        }

        // Set page mode if specified
        if (options.mode) {
            this.setPageMode(options.mode);
        }

        // Check if banner should be shown (includes feature enabled + dismissal checks)
        if (!this.shouldShowBanner()) {
            console.log('[PersistentBanner] Banner should not be shown (disabled or dismissed)');
            return;
        }

        console.log(`[PersistentBanner] Initializing in '${this.pageMode}' mode...`);

        // Inject CSS animations for modals
        this.injectModalStyles();

        // Load navigation history from sessionStorage
        this.loadNavigationHistory();

        // Create and inject banner
        this.createBanner();

        // Initialize environment button visibility (hidden until ready)
        if (this.pageConfig.showCustomerEnv) {
            this.updateEnvironmentButtonVisibility();
        }

        // Observe DOM for the right injection point
        this.observeForInjection();

        // Start URL monitoring to detect navigation changes (only in full mode)
        if (this.pageConfig.enableCaseDataExtraction) {
            this.startUrlMonitoring();
        }

        // Subscribe to case context + data store updates (only in full mode)
        if (this.pageConfig.enableContextValidation) {
            this.setupContextSubscriptions();
        }

        // Initialize UserCustomerDataManager (only in full mode)
        if (this.pageConfig.enableCaseDataExtraction && typeof UserCustomerDataManager !== 'undefined') {
            await UserCustomerDataManager.init();
            console.log('[PersistentBanner] UserCustomerDataManager initialized');
        }

        // Setup case data listener (only in full mode)
        if (this.pageConfig.enableCaseDataExtraction) {
            this.setupCaseDataListener();
        }

        // Listen for settings changes
        this.setupSettingsListener();

        // Start periodic validation for stale data prevention (only in full mode)
        if (this.pageConfig.enableContextValidation) {
            this.startPeriodicValidation();
        }

        // Migrate legacy messages from sync storage if needed
        await this.migrateLegacyMessagesFromSync();

        // Load messages for rotation from local storage
        await this.loadMessagesFromLocal();

        // Setup storage change listener for cross-tab synchronization
        this.setupStorageChangeListener();

        // Setup message listener for popup toggle commands
        this.setupPopupMessageListener();

        // Check initial state - if on case page, check extraction status (only in full mode)
        if (this.pageConfig.enableCaseDataExtraction) {
            this.checkInitialState();
        }
        
        // Start customer time update (for minimal mode with timezone display)
        if (this.pageConfig.enableCustomerTime && !this.pageConfig.enableCaseDataExtraction) {
            this.startCustomerTimeUpdate();
        }

        this.isInitialized = true;
        console.log('[PersistentBanner] Initialized');
    },

    /**
     * Setup message listener for popup toggle commands
     * Banner cannot be disabled via messages - only supports restoring if dismissed
     */
    setupPopupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'toggleBanner') {
                console.log('[PersistentBanner] Received toggleBanner message:', message);

                // Only allow restoring banner if dismissed - cannot disable
                if (message.enabled === true) {
                    // Restore banner
                    this.undoBannerDismissal();
                    sendResponse({ success: true });
                } else {
                    // Ignore disable requests - banner is always enabled
                    console.log('[PersistentBanner] Ignoring banner disable request - banner is always enabled');
                    sendResponse({ success: false, message: 'Banner cannot be disabled' });
                }

                return true; // Async response
            }
        });

        console.log('[PersistentBanner] Popup message listener registered');
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
            let urlCasePage = window.location.href;
            this.currentPage.caseId = document.urlCasePage.match(/\/Case\/([a-zA-Z0-9]{15,18})\//)[1];
            this.currentPage.caseNumber = document.head.querySelector('title').textContent.split(' | ')[0];
            this.displayedCaseId = this.currentPage.caseId;
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
     * Setup storage change listener for cross-tab synchronization
     * Reloads messages when they are changed in another tab
     */
    setupStorageChangeListener() {
        const handleStorageChange = async (changes, areaName) => {
            // Only listen for local storage changes (where banner messages are stored)
            if (areaName !== 'local') return;

            // Check if banner messages were changed
            if (changes.exl_bannerMessages) {
                console.log('[PersistentBanner] Banner messages changed in another tab, reloading...');

                // Debounced reload to prevent rapid-fire updates
                if (this.debouncedReloadMessages) {
                    this.debouncedReloadMessages();
                } else {
                    // Create debounced function if not exists
                    if (typeof DebounceUtils !== 'undefined') {
                        this.debouncedReloadMessages = DebounceUtils.debounce(async () => {
                            await this.reloadMessagesFromStorage();
                        }, 250);
                        this.debouncedReloadMessages();
                    } else {
                        // Fallback without debouncing
                        await this.reloadMessagesFromStorage();
                    }
                }
            }
        };

        // Register listener for cleanup tracking
        this.storageChangeListener = handleStorageChange;
        chrome.storage.onChanged.addListener(this.storageChangeListener);
        // Note: Chrome API listeners are tracked in this.storageChangeListener 
        // and cleaned up in cleanup() method - they don't use registerListener()
        // which is for DOM element listeners only

        console.log('[PersistentBanner] Storage change listener registered for cross-tab sync');
    },

    /**
     * Reload messages from storage (for cross-tab sync)
     * Smart preservation: if current message still exists by ID, keep displaying it
     */
    async reloadMessagesFromStorage() {
        console.log('[PersistentBanner] Reloading messages from storage...');

        // Remember currently displayed message ID
        const currentMessageId = this.currentDisplayedMessage?.id || null;

        // Load messages from storage
        await this.loadMessagesFromLocal();

        // Smart message preservation by ID
        if (currentMessageId) {
            // Check if current message still exists
            const stillExists = this.activeMessages.some(msg => msg.id === currentMessageId);

            if (stillExists) {
                // Find index and update currentMessageIndex
                const newIndex = this.activeMessages.findIndex(msg => msg.id === currentMessageId);
                if (newIndex !== -1) {
                    this.currentMessageIndex = newIndex;
                    console.log(`[PersistentBanner] Preserved current message (ID: ${currentMessageId})`);
                } else {
                    // Shouldn't happen, but fallback to first message
                    this.currentMessageIndex = 0;
                }
            } else {
                // Message was deleted, start from beginning
                console.log(`[PersistentBanner] Current message (ID: ${currentMessageId}) no longer exists, resetting to first message`);
                this.currentMessageIndex = 0;
            }
        } else {
            // No message was being displayed, start from beginning
            this.currentMessageIndex = 0;
        }

        // Update display with new/preserved message
        this.updateMessageDisplay();

        console.log('[PersistentBanner] Messages reloaded successfully');
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
        this.validationInterval = this.registerTimer(setInterval(async () => {
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
                        // Case number mismatch is authoritative - always clear stale data
                        if (validation.currentContext) {
                            const caseIdMismatch = this.displayedCaseId && this.displayedCaseId !== validation.currentContext.caseId;
                            const caseNumberMismatch = this.displayedCaseNumber && validation.currentContext.caseNumber &&
                                this.displayedCaseNumber !== validation.currentContext.caseNumber;

                            if (caseIdMismatch || caseNumberMismatch) {
                                console.warn('[PersistentBanner] Periodic validation failed - stale data detected', {
                                    caseIdMismatch,
                                    caseNumberMismatch,
                                    displayedCaseId: this.displayedCaseId,
                                    displayedCaseNumber: this.displayedCaseNumber,
                                    currentCaseId: validation.currentContext.caseId,
                                    currentCaseNumber: validation.currentContext.caseNumber
                                });
                                this.clearCaseData();
                                // Update UI to show cleared state
                                this.updateBannerUI();
                            }
                        } else {
                            // No current context - clear stale data
                            console.warn('[PersistentBanner] Periodic validation failed - no current context, clearing display');
                            this.clearCaseData();
                            this.updateBannerUI();
                        }
                    }
                }
            }
        }, 2000), 'interval');

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
     * Start polling CaseDataStore for incremental data updates
     * Polls every 500ms until all metadata fields are captured or timeout reached
     */
    startDataPolling() {
        // Don't start if already polling
        if (this.dataPollingInterval) {
            return;
        }

        // Validate we're on a case page
        const currentContext = typeof CaseContextWatcher !== 'undefined' ? CaseContextWatcher.getCurrentContext?.() : null;
        if (!currentContext || !currentContext.caseId || currentContext.caseId !== this.currentCaseId) {
            console.log('[PersistentBanner] Not starting polling - not on valid case page');
            return;
        }

        console.log('[PersistentBanner] Starting data polling for complete metadata');
        this.pollingStartTime = Date.now();

        this.dataPollingInterval = this.registerTimer(setInterval(() => {
            // Check if we've exceeded max polling duration
            const elapsed = Date.now() - this.pollingStartTime;
            if (elapsed >= this.maxPollingDuration) {
                console.log('[PersistentBanner] Polling timeout reached, checking completeness...');

                // Check if metadata is complete before stopping
                const isComplete = this.fullCaseMetadata && this.isMetadataComplete(this.fullCaseMetadata);

                if (isComplete) {
                    console.log('[PersistentBanner] Metadata is complete, stopping polling');
                    this.stopDataPolling();
                    this.cancelMetadataRetry(); // Cancel any pending retries
                } else {
                    console.log('[PersistentBanner] Metadata incomplete after timeout, scheduling retry');
                    // Stop polling but schedule retry with exponential backoff
                    this.stopDataPolling();
                    this.scheduleMetadataRetry();
                }
                return;
            }

            // Validate we're still on the same case
            const context = typeof CaseContextWatcher !== 'undefined' ? CaseContextWatcher.getCurrentContext?.() : null;
            if (!context || !context.caseId || context.caseId !== this.currentCaseId) {
                console.log('[PersistentBanner] Case context changed during polling, stopping');
                this.stopDataPolling();
                this.cancelMetadataRetry();
                return;
            }

            // Poll CaseDataStore for latest data
            if (typeof CaseDataStore !== 'undefined') {
                const latestData = CaseDataStore.getCurrentData();
                if (latestData) {
                    // Validate data matches current context
                    if (latestData.caseId === this.currentCaseId &&
                        (!context.caseNumber || latestData.caseNumber === context.caseNumber)) {
                        // Update with latest data (will store in fullCaseMetadata and update UI progressively)
                        this.applyDataUpdate(latestData, 'polling');

                        // Check if metadata is now complete
                        if (this.fullCaseMetadata && this.isMetadataComplete(this.fullCaseMetadata)) {
                            console.log('[PersistentBanner] All metadata fields captured, stopping polling');
                            this.stopDataPolling();
                            this.cancelMetadataRetry();
                            return;
                        }
                    } else {
                        console.warn('[PersistentBanner] Polled data does not match current context, stopping polling');
                        this.stopDataPolling();
                        this.cancelMetadataRetry();
                    }
                }
            }
        }, this.pollingIntervalMs));

        console.log('[PersistentBanner] Data polling started');
    },

    /**
     * Stop polling for data updates
     */
    stopDataPolling() {
        if (this.dataPollingInterval) {
            clearInterval(this.dataPollingInterval);
            this.dataPollingInterval = null;
            this.pollingStartTime = null;
            console.log('[PersistentBanner] Data polling stopped');
        }
    },

    /**
     * Schedule metadata retry with exponential backoff
     * Retries polling when metadata is incomplete after initial polling timeout
     */
    scheduleMetadataRetry() {
        // Cancel any existing retry
        this.cancelMetadataRetry();

        // Validate we're still on a case page
        const currentContext = typeof CaseContextWatcher !== 'undefined' ? CaseContextWatcher.getCurrentContext?.() : null;
        if (!currentContext || !currentContext.caseId || currentContext.caseId !== this.currentCaseId) {
            console.log('[PersistentBanner] Not scheduling retry - not on valid case page');
            return;
        }

        // Check if metadata is already complete
        if (this.fullCaseMetadata && this.isMetadataComplete(this.fullCaseMetadata)) {
            console.log('[PersistentBanner] Metadata is already complete, skipping retry');
            return;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
            this.retryDelayMs * Math.pow(2, this.retryAttempt),
            this.maxRetryDelayMs
        );

        console.log(`[PersistentBanner] Scheduling metadata retry #${this.retryAttempt + 1} in ${delay}ms`);

        this.retryTimeoutId = this.registerTimer(setTimeout(async () => {
            this.retryTimeoutId = null;

            // Validate we're still on the same case
            const context = typeof CaseContextWatcher !== 'undefined' ? CaseContextWatcher.getCurrentContext?.() : null;
            if (!context || !context.caseId || context.caseId !== this.currentCaseId) {
                console.log('[PersistentBanner] Case changed during retry wait, cancelling retry');
                this.retryAttempt = 0;
                return;
            }

            // Check if metadata is now complete (maybe it was updated from another source)
            if (this.fullCaseMetadata && this.isMetadataComplete(this.fullCaseMetadata)) {
                console.log('[PersistentBanner] Metadata completed before retry, cancelling');
                this.retryAttempt = 0;
                return;
            }

            // Increment retry attempt
            this.retryAttempt++;

            console.log(`[PersistentBanner] Retrying metadata polling (attempt ${this.retryAttempt})`);

            // Restart polling
            this.startDataPolling();
        }, delay));
    },

    /**
     * Cancel pending metadata retry
     */
    cancelMetadataRetry() {
        if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId);
            this.retryTimeoutId = null;
            console.log('[PersistentBanner] Metadata retry cancelled');
        }
        // Reset retry attempt counter when cancelling (e.g., on navigation or completion)
        this.retryAttempt = 0;
    },

    /**
     * Get list of all required metadata fields from CasePageDataExtractor
     * @returns {Array<string>} Array of field names
     */
    getRequiredMetadataFields() {
        return [
            // Basic case info
            'caseId',
            'caseNumber',
            'subject',
            'description',

            // Contact and Account
            'accountName',
            'contactName',

            // Product/Service Information
            'platformService',
            'productServiceName',

            // Case categorization
            'category',
            'subCategory',
            'status',
            'subStatus',

            // Customer data (standardized naming)
            'exLibrisAccountNumber',
            'analysisNote',
            'customerId',      // Standardized (not custId, custID)
            'institutionId',   // Standardized (not instID, instId)
            'institutionCode', // Standardized (not instCode)
            'server',

            // Flexipage fields (anchored data)
            'asset',
            'affectedEnvironment',
            'caseOwner',
            'parentCase',
            'parentCaseOwner',

            // Flexipage fields (non-anchored data)
            'escalation',
            'caseCreatedDate',
            'caseClosedOn',
            'customerExLibrisAccountNumber',
            'pageStatus',

            // Timestamps
            'extractedAt',
            'lastModifiedDate',

            // Timezone (resolved during polling)
            'timezone',
            'timezoneDisplayName',
            'timezoneSource'
        ];
    },

    /**
     * Get list of optional metadata fields that can legitimately be null
     * @returns {Array<string>} Array of field names that are optional
     */
    getOptionalMetadataFields() {
        return [
            'description',
            'contactName',
            'platformService',
            'productServiceName',
            'category',
            'subCategory',
            'subStatus',
            'analysisNote',
            'asset',
            'affectedEnvironment',
            'parentCase',
            'parentCaseOwner',
            'escalation',
            'caseCreatedDate',
            'caseClosedOn',
            'customerExLibrisAccountNumber',
            'lastModifiedDate'
        ];
    },

    /**
     * Resolve and store timezone from case data
     * Handles timezone from both CasePageDataExtractor and CaseDataExtractor formats
     * Uses TimezoneConverter as fallback if timezone not already present
     * @param {Object} caseData - Case data object
     * @returns {Promise<void>}
     */
    async resolveAndStoreTimezone(caseData) {
        if (!caseData) {
            return;
        }

        // Only resolve timezone if we have required fields
        if (!caseData.accountName && !caseData.exLibrisAccountNumber && !caseData.institutionCode) {
            console.log('[PersistentBanner] Skipping timezone resolution - missing account information');
            return;
        }

        // Check if timezone is already resolved and cached in fullCaseMetadata
        if (this.fullCaseMetadata &&
            this.fullCaseMetadata.timezone &&
            this.fullCaseMetadata.exLibrisAccountNumber === caseData.exLibrisAccountNumber &&
            this.fullCaseMetadata.accountName === caseData.accountName) {
            console.log('[PersistentBanner] Timezone already resolved for this case');
            return;
        }

        // Check if timezone is already present in incoming caseData from either extractor
        // Handle CasePageDataExtractor format: timezone, timezoneDisplayName, timezoneSource
        if (caseData.timezone) {
            console.log('[PersistentBanner] Timezone already present in caseData (from CasePageDataExtractor), using it directly');
            if (!this.fullCaseMetadata) {
                this.fullCaseMetadata = {};
            }

            this.fullCaseMetadata.timezone = caseData.timezone;
            this.fullCaseMetadata.timezoneDisplayName = caseData.timezoneDisplayName || caseData.timezone;
            this.fullCaseMetadata.timezoneSource = caseData.timezoneSource || 'casePageDataExtractor';

            console.log('[PersistentBanner] Timezone copied from CasePageDataExtractor:', {
                timezone: caseData.timezone,
                displayName: caseData.timezoneDisplayName,
                source: caseData.timezoneSource
            });

            // Update UI to reflect timezone if banner is visible
            this.updateBannerUI();
            return;
        }

        // Handle CaseDataExtractor format: customerTimezone, customerTimezoneSource
        if (caseData.customerTimezone) {
            console.log('[PersistentBanner] Timezone already present in caseData (from CaseDataExtractor), using it directly');
            if (!this.fullCaseMetadata) {
                this.fullCaseMetadata = {};
            }

            this.fullCaseMetadata.timezone = caseData.customerTimezone;
            this.fullCaseMetadata.timezoneDisplayName = caseData.customerTimezone || caseData.customerTimezone.replace(/_/g, ' ');
            this.fullCaseMetadata.timezoneSource = caseData.customerTimezoneSource || 'caseDataExtractor';

            console.log('[PersistentBanner] Timezone copied from CaseDataExtractor:', {
                timezone: caseData.customerTimezone,
                source: caseData.customerTimezoneSource
            });

            // Update UI to reflect timezone if banner is visible
            this.updateBannerUI();
            return;
        }

        // NO FALLBACK - Only use CustomerMasterManager.resolveTimezone() as single source of truth
        // If timezone is not already present in caseData, it means CustomerMasterManager didn't resolve it
        // We don't try to resolve it again here - the extractors are responsible for calling CustomerMasterManager
        console.log('[PersistentBanner] Timezone not present in caseData - CustomerMasterManager did not resolve it. No fallback resolution.');
    },

    /**
     * Check if metadata is complete (all required fields populated)
     * Required fields are: caseId, caseNumber, subject, accountName, status, exLibrisAccountNumber, extractedAt
     * Optional fields can be null/undefined and still be considered complete
     * @param {Object} data - Data object to check
     * @returns {boolean} True if all required fields are populated
     */
    isMetadataComplete(data) {
        if (!data) {
            return false;
        }

        // Required fields that must be present and non-null/non-empty for metadata to be considered complete
        const criticalRequiredFields = [
            'caseId',
            'caseNumber',
            'subject',
            'accountName',
            'status',
            'exLibrisAccountNumber',
            'extractedAt'
        ];

        // Check critical required fields
        for (const field of criticalRequiredFields) {
            const value = data[field];

            if (value === null || value === undefined) {
                return false;
            }

            // Empty strings are considered incomplete for required fields
            if (typeof value === 'string' && value.trim() === '') {
                return false;
            }
        }

        // Check timezone - required if we have account information
        // Timezone may take time to resolve, so we check if account info exists first
        if (data.exLibrisAccountNumber && (!data.timezone || data.timezone === null || data.timezone === undefined)) {
            // If we have account info, timezone should be resolved eventually
            // But we'll be lenient - if other critical fields are complete, consider it complete
            // The retry mechanism will continue trying to resolve timezone
            // For now, we'll only require timezone if we've had time to resolve it (e.g., after retries)
        }

        return true;
    },

    /**
     * Apply data update from store (only updates fields that are explicitly present)
     * This method is used by both event-driven updates and polling
     * @param {Object} data - Data from CaseDataStore
     * @param {string} source - Source of the update ('store', 'polling', etc.)
     */
    applyDataUpdate(data, source = 'unknown') {
        if (!data || !data.caseId) {
            return;
        }

        // Validate data matches current context using CaseContextWatcher
        const currentContext = typeof CaseContextWatcher !== 'undefined' ? CaseContextWatcher.getCurrentContext?.() : null;
        if (currentContext && currentContext.caseId && data.caseId !== currentContext.caseId) {
            console.warn('[PersistentBanner] Ignoring data update for different case (context mismatch)', {
                dataCaseId: data.caseId,
                contextCaseId: currentContext.caseId,
                source
            });
            return;
        }

        // Additional validation: Check URL for case ID to catch race conditions
        // This guards against stale data when CaseContextWatcher hasn't updated yet
        const urlMatch = window.location.href.match(/\/Case\/([^\/]+)\/view/);
        const caseIdFromUrl = urlMatch ? urlMatch[1] : null;
        if (caseIdFromUrl && data.caseId !== caseIdFromUrl) {
            console.warn('[PersistentBanner] Ignoring data update for different case (URL mismatch)', {
                dataCaseId: data.caseId,
                urlCaseId: caseIdFromUrl,
                source
            });
            return;
        }

        // Check if case ID changed - if so, clear all fields first
        const titleMatch = document.title.match(/^(\d{6,10})/);
        const caseNumberFromTitle = titleMatch ? titleMatch[1] : null;
        this.currentPage.caseNumber = this.currentPage.caseNumber === null ? caseNumberFromTitle : this.currentPage.caseNumber;
        const caseIdChanged = this.displayedCaseId && data.caseId && this.displayedCaseId !== data.caseId;
        const caseNumberChanged = data.caseNumber && data.caseNumber !== this.currentPage.caseNumber;

        // If case ID or case number changed, clear all metadata to prevent stale data
        if (caseIdChanged || caseNumberChanged) {
            console.log('[PersistentBanner] Case identifier changed, clearing all metadata:', {
                caseIdChanged,
                caseNumberChanged,
                oldCaseId: this.displayedCaseId,
                newCaseId: data.caseId,
                oldCaseNumber: this.currentPage.caseNumber,
                newCaseNumber: data.caseNumber
            });

            // Clear all metadata fields including fullCaseMetadata
            this.currentPage.subject = null;
            this.currentPage.status = null;
            this.currentPage.subStatus = null;
            this.displayedCaseId = null;
            this.displayedCaseNumber = null;
            this.fullCaseMetadata = null;
        }

        // Store/merge complete metadata in fullCaseMetadata
        if (!this.fullCaseMetadata) {
            // Initialize fullCaseMetadata with all fields from data
            this.fullCaseMetadata = { ...data };
        } else {
            // Merge new data with existing fullCaseMetadata (preserve fields not in new data)
            // Only update fields that are explicitly present in new data (not undefined)
            for (const key in data) {
                if (data[key] !== undefined) {
                    this.fullCaseMetadata[key] = data[key];
                }
            }
        }

        // Resolve timezone asynchronously (don't block UI update)
        this.resolveAndStoreTimezone(this.fullCaseMetadata).catch(error => {
            console.error('[PersistentBanner] Error resolving timezone in applyDataUpdate:', error);
        });

        // Only update fields that are explicitly present in the new data (no fallback to stale values)
        let hasChanges = false;

        if (data.caseId) {
            this.displayedCaseId = data.caseId;
        }
        if (data.caseNumber) {
            // Always update case number when provided
            if (data.caseNumber !== this.currentPage.caseNumber) {
                this.displayedCaseNumber = data.caseNumber;
                this.currentPage.caseNumber = data.caseNumber;
                hasChanges = true;

                // When case number changes, clear subject to force re-extraction from new case
                if (this.currentPage.subject) {
                    console.log('[PersistentBanner] Case number changed, clearing subject to prevent stale data');
                    this.currentPage.subject = null;
                }
            }
        }

        // Always update subject if provided (even if null) when case number matches
        // This ensures we clear stale subject when new case doesn't have one
        if (data.subject !== undefined) {
            if (data.caseNumber && data.caseNumber === this.currentPage.caseNumber) {
                // Only update subject if case number matches current
                if (data.subject !== this.currentPage.subject) {
                    this.currentPage.subject = data.subject;
                    hasChanges = true;
                }
            } else if (!data.caseNumber && data.subject !== this.currentPage.subject) {
                // If no case number in data, still update if different (for backward compatibility)
                this.currentPage.subject = data.subject;
                hasChanges = true;
            }
        } else if (caseNumberChanged) {
            // Case number changed but no subject in data - ensure it's cleared
            if (this.currentPage.subject) {
                this.currentPage.subject = null;
                hasChanges = true;
            }
        }

        if (data.status !== undefined && data.status !== null) {
            if (data.status !== this.currentPage.status) {
                this.currentPage.status = data.status;
                hasChanges = true;
            }
        } else if (caseNumberChanged || caseIdChanged) {
            // Clear status when case changes
            if (this.currentPage.status) {
                this.currentPage.status = null;
                hasChanges = true;
            }
        }

        if (data.subStatus !== undefined && data.subStatus !== null) {
            if (data.subStatus !== this.currentPage.subStatus) {
                this.currentPage.subStatus = data.subStatus;
                hasChanges = true;
            }
        } else if (caseNumberChanged || caseIdChanged) {
            // Clear subStatus when case changes
            if (this.currentPage.subStatus) {
                this.currentPage.subStatus = null;
                hasChanges = true;
            }
        }

        // Update customer metadata only if explicitly present
        // Normalize incoming data to use standardized field names
        const normalizedData = typeof DataNormalizer !== 'undefined' 
            ? DataNormalizer.normalizeCustomerFields(data) 
            : data;
        
        // Use standardized field name: customerId
        if (normalizedData.customerId !== undefined) {
            const newCustId = normalizedData.customerId || null;
            if (newCustId !== this.customerMetadata.customerId) {
                this.customerMetadata.customerId = newCustId;
                hasChanges = true;
            }
        }
        // Use standardized field name: institutionId
        if (normalizedData.institutionId !== undefined) {
            const newInstId = normalizedData.institutionId || null;
            if (newInstId !== this.customerMetadata.institutionId) {
                this.customerMetadata.institutionId = newInstId;
                hasChanges = true;
            }
        }
        if (normalizedData.server !== undefined && normalizedData.server !== this.customerMetadata.server) {
            this.customerMetadata.server = normalizedData.server || null;
            hasChanges = true;
        }
        if (normalizedData.productServiceName !== undefined && normalizedData.productServiceName !== this.customerMetadata.productServiceName) {
            this.customerMetadata.productServiceName = normalizedData.productServiceName || null;
            hasChanges = true;
        }
        // Use standardized field name: institutionCode
        if (normalizedData.institutionCode !== undefined) {
            const newInstCode = normalizedData.institutionCode || null;
            if (newInstCode !== this.customerMetadata.institutionCode) {
                this.customerMetadata.institutionCode = newInstCode;
                hasChanges = true;
            }
        }

        // Enrich customer metadata from UserCustomerDataManager or CustomerMasterManager if missing
        if (this.customerMetadata.institutionCode &&
            (!this.customerMetadata.customerId || !this.customerMetadata.institutionId || !this.customerMetadata.server)) {
            this.enrichCustomerMetadataFromManagers(data.accountName);
            hasChanges = true;
        }

        // Populate environment buttons if we have required metadata
        // This ensures env menu shows after metadata extraction
        if (this.customerMetadata.institutionCode || this.customerMetadata.server) {
            this.populateEnvButtons();
        }

        // Update page type
        if (!this.currentPage.type || this.currentPage.type !== 'case_page') {
            this.currentPage.type = 'case_page';
            this.currentPage.displayType = this.getPageTypeDisplayName('case_page');
            hasChanges = true;
        }

        // Always update UI to show new data progressively (even if primary fields unchanged)
        // This ensures partial data appears immediately as it's extracted during polling
        const shouldUpdateUI = hasChanges || source === 'polling';

        if (shouldUpdateUI) {
            console.log(`[PersistentBanner] Applied data update from ${source}:`, {
                caseNumber: this.currentPage.caseNumber,
                subject: this.currentPage.subject,
                status: this.currentPage.status,
                metadataComplete: this.fullCaseMetadata ? this.isMetadataComplete(this.fullCaseMetadata) : false
            });

            // Update UI immediately to show progressive loading
            this.updateBannerUI();
        }
    },

    /**
     * Get full case metadata
     * Returns complete metadata object stored in PersistentBanner
     * @returns {Object|null} Full case metadata or null if not available
     */
    getFullCaseMetadata() {
        return this.fullCaseMetadata || null;
    },

    /**
     * Get specific metadata field
     * @param {string} fieldName - Name of the field to retrieve
     * @returns {*} Field value or null if field doesn't exist or metadata not loaded
     */
    getMetadataField(fieldName) {
        if (!this.fullCaseMetadata || !fieldName) {
            return null;
        }
        return this.fullCaseMetadata[fieldName] !== undefined ? this.fullCaseMetadata[fieldName] : null;
    },

    /**
     * Get all metadata (alias for getFullCaseMetadata)
     * @returns {Object|null} Full case metadata or null if not available
     */
    getAllMetadata() {
        return this.getFullCaseMetadata();
    },

    /**
     * Check if metadata is complete
     * @returns {boolean} True if all required fields are populated
     */
    hasCompleteMetadata() {
        return this.fullCaseMetadata ? this.isMetadataComplete(this.fullCaseMetadata) : false;
    },

    /**
     * Get list of missing metadata fields
     * @returns {Array<string>} Array of field names that are missing
     */
    getMissingMetadataFields() {
        if (!this.fullCaseMetadata) {
            return this.getRequiredMetadataFields();
        }

        const requiredFields = this.getRequiredMetadataFields();
        const optionalFields = this.getOptionalMetadataFields();
        const missing = [];

        for (const field of requiredFields) {
            // Skip optional fields
            if (optionalFields.includes(field)) {
                continue;
            }

            const value = this.fullCaseMetadata[field];

            if (value === null || value === undefined) {
                // Check if this is a timezone field that we should have resolved
                if (field === 'timezone' && this.fullCaseMetadata.exLibrisAccountNumber) {
                    missing.push(field);
                    continue;
                }
                missing.push(field);
            } else if (typeof value === 'string' && value.trim() === '') {
                if (field !== 'description') {
                    missing.push(field);
                }
            }
        }

        return missing;
    },

    /**
     * Get metadata age in milliseconds
     * @returns {number|null} Age in milliseconds or null if metadata not available or no timestamp
     */
    getMetadataAge() {
        if (!this.fullCaseMetadata || !this.fullCaseMetadata.extractedAt) {
            return null;
        }

        try {
            const extractedTime = new Date(this.fullCaseMetadata.extractedAt).getTime();
            return Date.now() - extractedTime;
        } catch (error) {
            console.error('[PersistentBanner] Error calculating metadata age:', error);
            return null;
        }
    },

    /**
     * Enrich customer metadata from UserCustomerDataManager or CustomerMasterManager
     * Priority: UserCustomerDataManager > CustomerMasterManager
     * @param {string} accountName - Optional account name for lookup
     */
    enrichCustomerMetadataFromManagers(accountName = null) {
        const institutionCode = this.customerMetadata.institutionCode;
        if (!institutionCode) return;

        let customerData = null;

        // Check UserCustomerDataManager first (user-added data takes priority)
        if (typeof UserCustomerDataManager !== 'undefined') {
            customerData = UserCustomerDataManager.findByInstitutionCode(institutionCode, accountName);
            if (customerData) {
                console.log('[PersistentBanner] Found customer in UserCustomerDataManager:', customerData.institutionCode);
            }
        }

        // Fallback to CustomerMasterManager
        if (!customerData && typeof CustomerMasterManager !== 'undefined') {
            customerData = CustomerMasterManager.findByInstitutionCode(institutionCode, accountName);
            if (customerData) {
                console.log('[PersistentBanner] Found customer in CustomerMasterManager:', customerData.institutionCode);
            }
        }

        // Update metadata if customer found and fields are missing
        // CustomerMasterManager uses standardized field names (customerId, institutionId)
        if (customerData) {
            if (!this.customerMetadata.customerId && customerData.customerId) {
                this.customerMetadata.customerId = customerData.customerId;
            }
            if (!this.customerMetadata.institutionId && customerData.institutionId) {
                this.customerMetadata.institutionId = customerData.institutionId;
            }
            if (!this.customerMetadata.server && customerData.server) {
                this.customerMetadata.server = customerData.server;
            }
            if (!this.customerMetadata.institutionCode && customerData.institutionCode) {
                this.customerMetadata.institutionCode = customerData.institutionCode;
            }
        }
    },

    /**
     * Handle banner close button click
     * Dismisses banner for session and shows undo notification
     */
    handleBannerClose() {
        console.log('[PersistentBanner] Close button clicked');

        // Check if close button is enabled in settings
        if (this.messageSettings && this.messageSettings.banner && this.messageSettings.banner.showCloseButton === false) {
            console.log('[PersistentBanner] Close button is disabled in settings');
            return;
        }

        // Get dismissal duration from settings (default: 'session')
        const dismissalDuration = this.messageSettings?.banner?.dismissalDuration || 'session';

        // Hide banner with slide-up animation
        const banner = this.elements.banner;
        if (banner) {
            banner.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            banner.style.transform = 'translateY(-100%)';
            banner.style.opacity = '0';

            setTimeout(() => {
                banner.style.display = 'none';
            }, 300);
        }

        // Store dismissal based on duration setting
        if (dismissalDuration === 'session') {
            // Session-based dismissal (clears on browser close)
            const domain = this.getCurrentDomain();
            sessionStorage.setItem(`exl_banner_dismissed_${domain}`, 'true');
            console.log('[PersistentBanner] Banner dismissed for session on domain:', domain);
        } else if (dismissalDuration === 'permanent') {
            // Permanent dismissal (disable for this domain)
            this.disableBannerForDomain();
        }

        // Show undo notification with 7-second duration
        this.showUndoNotification();
    },

    /**
     * Get current domain for dismissal tracking
     * @returns {string} Current domain (hostname without www.)
     */
    getCurrentDomain() {
        try {
            const hostname = window.location.hostname;
            return hostname.replace(/^www\./, '');
        } catch (error) {
            console.error('[PersistentBanner] Failed to get current domain:', error);
            return 'unknown';
        }
    },

    /**
     * Disable banner for current domain permanently
     */
    async disableBannerForDomain() {
        const domain = this.getCurrentDomain();

        // Use SiteActivationManager if available
        if (typeof SiteActivationManager !== 'undefined' && typeof SiteActivationManager.disableBanner === 'function') {
            await SiteActivationManager.disableBanner(domain);
            console.log('[PersistentBanner] Banner permanently disabled for domain via SiteActivationManager:', domain);
        } else {
            // Fallback: Update settings directly
            const settings = await this.loadMessagesFromLocal();
            if (!settings.activeSites) {
                settings.activeSites = {};
            }
            settings.activeSites[domain] = false;
            await this.saveMessagesToLocal(settings);
            console.log('[PersistentBanner] Banner permanently disabled for domain via settings:', domain);
        }
    },

    /**
     * Show undo notification with 7-second duration
     */
    showUndoNotification() {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'exl-banner-notification';
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 999999;
            display: flex;
            align-items: center;
            gap: 16px;
            animation: slideInUp 0.3s ease-out;
            max-width: 400px;
        `;

        notification.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px;">Banner Hidden</div>
                <div style="font-size: 13px; opacity: 0.9;">Click Undo to restore, or use extension popup to reactivate.</div>
            </div>
            <button class="exl-undo-btn" style="
                padding: 8px 16px;
                background: #0070d2;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
                white-space: nowrap;
                transition: background 0.2s ease;
            ">Undo</button>
        `;

        document.body.appendChild(notification);

        // Undo button handler
        const undoBtn = notification.querySelector('.exl-undo-btn');
        undoBtn.addEventListener('click', () => {
            this.undoBannerDismissal();
            notification.remove();
        });

        undoBtn.addEventListener('mouseenter', () => {
            undoBtn.style.background = '#005fb2';
        });

        undoBtn.addEventListener('mouseleave', () => {
            undoBtn.style.background = '#0070d2';
        });

        // Auto-remove after 7 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutDown 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 7000);
    },

    /**
     * Undo banner dismissal - restore banner immediately
     */
    undoBannerDismissal() {
        console.log('[PersistentBanner] Undo banner dismissal');

        // Clear session dismissal flag
        const domain = this.getCurrentDomain();
        sessionStorage.removeItem(`exl_banner_dismissed_${domain}`);

        // Restore banner display
        const banner = this.elements.banner;
        if (banner) {
            banner.style.display = 'block';
            banner.style.transform = 'translateY(0)';
            banner.style.opacity = '1';
        }

        // Show success notification
        this.showNotification('Banner restored', 'success');
    },

    /**
     * Check if banner should be shown (not dismissed)
     * @returns {boolean} True if banner should be shown
     */
    shouldShowBanner() {
        // Banner is always enabled - only check if dismissed for current session
        const domain = this.getCurrentDomain();
        const isDismissed = sessionStorage.getItem(`exl_banner_dismissed_${domain}`) === 'true';

        if (isDismissed) {
            console.log('[PersistentBanner] Banner dismissed for session on domain:', domain);
            return false;
        }

        // Banner always shows if not dismissed
        return true;
    },

    /**
     * Check if persistent banner feature is enabled
     * Always returns true - banner cannot be disabled
     */
    async isFeatureEnabled() {
        // Banner is always enabled - no user control
        return true;
    },

    /**
     * Setup listener for settings changes
     */
    setupSettingsListener() {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            // Monitor sync storage for feature toggles
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
                    this.loadMessagesFromLocal().then(() => {
                        this.updateBannerUI();
                    });
                }
            }

            // Monitor local storage for message content changes
            if (areaName === 'local' && changes.exl_bannerMessages) {
                console.log('[PersistentBanner] Banner messages content changed in local storage, reloading...');
                // Reload messages and restart rotation
                this.loadMessagesFromLocal().then(() => {
                    this.updateBannerUI();
                });
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

        // Listen for CASE_DATA_READY event from InterceptorCacheManager (via extractors)
        // This is the primary data source when interceptor.js captures API data
        window.addEventListener('CASE_DATA_READY', async (event) => {
            const caseData = event.detail;
            if (!caseData || !caseData.caseNumber) {
                console.log('[PersistentBanner] CASE_DATA_READY event received but no case number');
                return;
            }

            // Validate data matches current URL to prevent stale data from race conditions
            if (caseData.caseId) {
                const urlMatch = window.location.href.match(/\/Case\/([^\/]+)\/view/);
                const caseIdFromUrl = urlMatch ? urlMatch[1] : null;
                if (caseIdFromUrl && caseData.caseId !== caseIdFromUrl) {
                    console.warn('[PersistentBanner] CASE_DATA_READY ignored - data is for different case (URL mismatch)', {
                        dataCaseId: caseData.caseId,
                        urlCaseId: caseIdFromUrl
                    });
                    return;
                }
            }

            console.log('[PersistentBanner] Received CASE_DATA_READY from interceptor:', caseData.caseNumber);

            // Update last data received time
            this.lastDataReceivedTime = Date.now();

            // Clear any pending fallback timeout
            if (this.dataReceptionTimeout) {
                clearTimeout(this.dataReceptionTimeout);
                this.dataReceptionTimeout = null;
            }

            // Update banner with interceptor data
            await this.updateCurrentPage({
                type: 'Case',
                caseNumber: caseData.caseNumber,
                subject: caseData.subject,
                status: caseData.status,
                subStatus: caseData.subStatus
            });

            // Store full metadata including enriched customer data
            this.fullCaseMetadata = caseData;

            // Update customer metadata from enriched data
            // Include institutionCode in the condition check to ensure it's captured even when other fields are null
            if (caseData.server || caseData.customerId || caseData.institutionId || caseData.timezone || caseData.institutionCode) {
                this.customerMetadata = {
                    customerId: caseData.customerId || null,
                    institutionId: caseData.institutionId || null,
                    server: caseData.server || null,
                    region: caseData.region || null,
                    timezone: caseData.timezone || null,
                    institutionCode: caseData.institutionCode || null,
                    accountCode: caseData.accountCode || null,
                    productServiceName: caseData.productServiceName || null,
                    accountName: caseData.accountName || null
                };
                console.log('[PersistentBanner] Updated customer metadata from interceptor:', this.customerMetadata);
            }

            this.updateBannerUI();
        });

        document.addEventListener('casePageDataExtracted', async (event) => {
            const data = event.detail;
            console.log('[PersistentBanner] Received case page data from CasePageDataExtractor:', data);

            // GUARDRAIL: Validate data matches current URL before processing
            // This catches race conditions when old data arrives after navigation
            if (data.caseId) {
                const urlMatch = window.location.href.match(/\/Case\/([^\/]+)\/view/);
                const caseIdFromUrl = urlMatch ? urlMatch[1] : null;
                if (caseIdFromUrl && data.caseId !== caseIdFromUrl) {
                    console.warn('[PersistentBanner] casePageDataExtracted ignored - data is for different case (URL mismatch)', {
                        dataCaseId: data.caseId,
                        urlCaseId: caseIdFromUrl
                    });
                    return;
                }
            }

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
                        console.warn(`[PersistentBanner] Cannot display data: validation failed`);
                        // Clear stale data if validation fails
                        this.clearCaseData();
                        this.updateBannerUI();
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
                    this.updateBannerUI();
                    return;
                }
                if (typeof CaseDataStore !== 'undefined') {
                    await CaseDataStore.setCurrentData(data, 'casePageDataExtractor-event');
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
                            // Case number mismatch is authoritative - always clear stale data
                            // If validation failed, it means data doesn't match current page
                            if (validation.currentContext) {
                                const caseIdMismatch = data.caseId && data.caseId !== validation.currentContext.caseId;
                                const caseNumberMismatch = data.caseNumber && validation.currentContext.caseNumber &&
                                    data.caseNumber !== validation.currentContext.caseNumber;

                                if (caseIdMismatch || caseNumberMismatch) {
                                    console.warn('[PersistentBanner] Validation failed - mismatched identifiers, clearing stale data', {
                                        caseIdMismatch,
                                        caseNumberMismatch,
                                        dataCaseId: data.caseId,
                                        dataCaseNumber: data.caseNumber,
                                        currentCaseId: validation.currentContext.caseId,
                                        currentCaseNumber: validation.currentContext.caseNumber
                                    });
                                    this.clearCaseData();
                                }
                            } else {
                                // No current context - clear stale data
                                this.clearCaseData();
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

            if (typeof CaseDataStore !== 'undefined') {
                await CaseDataStore.setCurrentData(data, 'casePageDataExtractor-event');
                return;
            }

            // Extract case ID from the data
            const newCaseId = data.caseId || null;

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
            // CasePageDataExtractor enriches data - normalize to standardized field names
            const normalizedData = typeof DataNormalizer !== 'undefined'
                ? DataNormalizer.normalizeCustomerFields(data)
                : data;
            const instCodeValue = normalizedData.institutionCode || null;
            this.customerMetadata = {
                customerId: normalizedData.customerId || null,  // 4-digit customer ID (standardized)
                institutionId: normalizedData.institutionId || null,  // Institution ID (standardized)
                server: normalizedData.server || null,  // Server code (ap02, na05, etc.)
                productServiceName: normalizedData.platformService || null,  // Platform/Service with fallback
                institutionCode: instCodeValue,  // Institution code (61USC_INST, etc.) (standardized)
                timezone: normalizedData.customerTimezone || this.customerMetadata.timezone || null,
                timezoneSource: normalizedData.customerTimezoneSource || this.customerMetadata.timezoneSource || null,
                customerOrgCode: normalizedData.customerOrgCode || null,
                customerOrgName: normalizedData.customerOrgName || null,
                customerDbServers: normalizedData.customerDbServers || []
            };

            console.log('[PersistentBanner] Updated customer metadata:', this.customerMetadata);

            // Get timezone if not already set
            if (!this.customerMetadata.timezone) {
                this.getCustomerTimezone().then(timezone => {
                    if (timezone) {
                        this.customerMetadata.timezone = timezone;
                        this.updateTimezoneDisplay();
                        this.startCustomerTimeRefresh();
                    }
                });
            }

            // Update current page status from direct page data (for gradient coloring)
            if (data.pageStatus) {
                this.currentPage.status = data.pageStatus;
                console.log('[PersistentBanner] Updated status from page data:', data.pageStatus);
            }

            // Messages can now appear on case pages - check if should show
            this.shouldShowMessages().then(showMessages => {
                if (showMessages && this.elements.messagesSection) {
                    this.elements.messagesSection.style.display = 'flex';
                    this.updateMessageDisplay();
                    this.startMessageRotation();
                    // Check width after showing section
                    setTimeout(() => this.checkMessageSectionWidth(), 100);
                } else if (this.elements.messagesSection) {
                    this.elements.messagesSection.style.display = 'none';
                    this.stopMessageRotation();
                }
            }).catch(error => {
                console.error('[PersistentBanner] Error checking shouldShowMessages:', error);
            });

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
                this.dataReceptionTimeout = this.registerTimer(setTimeout(() => {
                    if (!this.lastDataReceivedTime || (Date.now() - this.lastDataReceivedTime) > 3000) {
                        console.warn('[PersistentBanner] No case data received within 3 seconds. Triggering manual extraction...');
                        this.triggerManualExtraction();
                    }
                }, 3000), 'timeout');
            });
        }
    },

    /**
     * Trigger manual case data extraction as fallback
     */
    triggerManualExtraction() {
        // Check if we're on a case page first
        const urlNow = window.location.href;
        const casePageMatchForExtraction = urlNow.match(/\/lightning\/r\/Case\/([^\/]+)\/view(?:\?|$)/);

        if (!casePageMatchForExtraction) {
            // Not on a case page - this is expected, no need to log
            return;
        }

        const caseId = casePageMatchForExtraction[1];

        if (typeof CasePageDataExtractor !== 'undefined' && typeof CasePageDataExtractor.extractNow === 'function') {
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

    // =================================================================
    // CASE PAGE DETECTION & VALIDATION (restored from previous version)
    // =================================================================

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

    // =================================================================
    // PAGE INFO METHODS
    // =================================================================

    /**
     * Get page info using global window.exLibrisPageInfo if available,
     * otherwise fall back to PageIdentifier.identifyPage()
     * 
     * This ensures consistent page info access with early initialization support.
     * @returns {Object|null} Page info object with type, caseId, etc.
     */
    getPageInfo() {
        // Priority 1: Use pre-initialized global pageInfo (from pageInfoInitializer.js)
        if (window.exLibrisPageInfo && window.exLibrisPageInfo.ready && window.exLibrisPageInfo.current) {
            console.log('[PersistentBanner] Using global exLibrisPageInfo:', window.exLibrisPageInfo.current.type);
            return window.exLibrisPageInfo.current;
        }

        // Priority 2: Fall back to PageIdentifier.identifyPage()
        if (typeof PageIdentifier !== 'undefined' && typeof PageIdentifier.identifyPage === 'function') {
            try {
                const pageInfo = PageIdentifier.identifyPage();
                console.log('[PersistentBanner] Using PageIdentifier.identifyPage():', pageInfo?.type);
                return pageInfo;
            } catch (error) {
                console.error('[PersistentBanner] Error calling PageIdentifier.identifyPage():', error);
            }
        }

        // Priority 3: Return null if nothing available
        console.warn('[PersistentBanner] No page info available');
        return null;
    },

    /**
     * Wait for page info to be ready (async version)
     * Useful when page info may not be immediately available
     * @param {number} timeout - Max time to wait in ms (default: 2000)
     * @returns {Promise<Object|null>} Page info or null on timeout
     */
    async waitForPageInfo(timeout = 2000) {
        // Check if already available
        const immediate = this.getPageInfo();
        if (immediate) {
            return immediate;
        }

        // Wait for exLibrisPageInfoReady event
        return new Promise((resolve) => {
            const handleReady = (event) => {
                window.removeEventListener('exLibrisPageInfoReady', handleReady);
                clearTimeout(timeoutId);
                resolve(event.detail?.pageInfo || this.getPageInfo());
            };

            window.addEventListener('exLibrisPageInfoReady', handleReady, { once: true });

            const timeoutId = setTimeout(() => {
                window.removeEventListener('exLibrisPageInfoReady', handleReady);
                console.warn('[PersistentBanner] Timeout waiting for pageInfo');
                resolve(this.getPageInfo()); // Try one more time
            }, timeout);
        });
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
     * Subscribe to CaseContextWatcher and CaseDataStore updates
     */
    setupContextSubscriptions() {
        if (typeof CaseContextWatcher !== 'undefined') {
            CaseContextWatcher.init?.();
            if (this.contextUnsubscribe) {
                this.contextUnsubscribe();
            }
            // CaseContextWatcher subscription removed - not used
        }

        if (typeof CaseDataStore !== 'undefined') {
            CaseDataStore.init();
            if (this.storeUnsubscribe) {
                this.storeUnsubscribe();
            }
            this.storeUnsubscribe = CaseDataStore.subscribe(({ data, source }) => {
                this.handleStoreDataUpdate(data, source);
            });
        }

        // Listen for per-field updates from CaseDataStore
        document.addEventListener('caseDataFieldUpdate', (event) => {
            this.handleFieldUpdate(event.detail);
        });

        // Listen for mismatch events to trigger re-extraction
        document.addEventListener('caseDataMismatch', (event) => {
            console.warn('[PersistentBanner] Received caseDataMismatch event:', event.detail);
            // Clear current data and trigger re-extraction
            this.clearCaseData();
            this.updateBannerUI();
        });
    },



    /**
     * Handle CaseDataStore data updates
     * @param {Object|null} data
     * @param {string} source
     */
    handleStoreDataUpdate(data, source = 'unknown') {
        if (!data) {
            if (source !== 'immediate') {
                console.log('[PersistentBanner] CaseDataStore cleared data (source:', source, ')');
                this.stopDataPolling();
                this.clearCaseData(true);
                this.updateBannerUI();
            }
            return;
        }

        // Step 1: Validate URL - extract current URL fresh from window.location.href
        const currentUrl = window.location.href;

        // Check if URL matches the one provided by CaseDataStore (if available)
        if (data.url && data.url !== currentUrl) {
            console.warn('[PersistentBanner] URL mismatch, rejecting update', {
                dataUrl: data.url,
                currentUrl: currentUrl
            });
            return;
        }

        // Step 2: Verify case ID matches current page
        if (data.caseId && this.currentCaseId && data.caseId !== this.currentCaseId) {
            console.warn('[PersistentBanner] Ignoring store data for different case', data.caseId, this.currentCaseId);

            // Check for case navigation in action-focused mode
            if (this.actionFocusedMode.active) {
                const currentContext = typeof CaseContextWatcher !== 'undefined' ? CaseContextWatcher.getCurrentContext?.() : null;
                if (currentContext && currentContext.caseNumber) {
                    this.showStaleDataWarning(currentContext.caseNumber);
                }
            }

            return;
        }

        // Step 3: Verify case number matches (if both are present)
        if (data.caseNumber && this.currentPage.caseNumber && data.caseNumber !== this.currentPage.caseNumber) {
            console.warn('[PersistentBanner] Case number mismatch, rejecting update', {
                dataCaseNumber: data.caseNumber,
                currentCaseNumber: this.currentPage.caseNumber
            });
            return;
        }

        // Step 4: Store accepted URL for future comparisons
        this.lastAcceptedUrl = currentUrl;

        // Step 5: Apply data update (only updates fields that are explicitly present)
        this.applyDataUpdate(data, source);

        // Start polling if primary metadata (caseNumber) is now available
        const hasCaseNumber = !!this.currentPage.caseNumber;
        if (hasCaseNumber && !this.dataPollingInterval) {
            this.startDataPolling();
            this.currentPage.type = 'case_page';
        } else { 
            const pageInfo = this.getPageInfo();
            this.currentPage.type = pageInfo?.type || 'UNKNOWN';
        }

        // Stop polling if all primary metadata is captured
        const hasAllPrimaryMetadata = this.currentPage.caseNumber &&
            this.currentPage.subject &&
            this.currentPage.status;
        if (hasAllPrimaryMetadata && this.dataPollingInterval) {
            console.log('[PersistentBanner] All primary metadata captured, stopping polling');
            this.stopDataPolling();
        }
    },

    /**
     * Handle per-field updates from CaseDataStore
     * @param {Object} updatePayload - { fields: Object, caseId: string, caseNumber: string, url: string, source: string }
     */
    handleFieldUpdate(updatePayload) {
        if (!updatePayload || !updatePayload.fields) {
            return;
        }

        const { fields, caseId, caseNumber, url, source } = updatePayload;

        // Step 1: Validate URL - extract current URL fresh from window.location.href
        const currentUrl = window.location.href;

        if (url && url !== currentUrl) {
            console.warn('[PersistentBanner] URL mismatch in field update, rejecting', {
                updateUrl: url,
                currentUrl: currentUrl
            });
            return;
        }

        // Step 2: Verify case ID matches
        if (caseId && this.currentCaseId && caseId !== this.currentCaseId) {
            console.warn('[PersistentBanner] Case ID mismatch in field update, rejecting', {
                updateCaseId: caseId,
                currentCaseId: this.currentCaseId
            });
            return;
        }

        // Step 3: Verify case number matches
        if (caseNumber && this.currentPage.caseNumber && caseNumber !== this.currentPage.caseNumber) {
            console.warn('[PersistentBanner] Case number mismatch in field update, rejecting', {
                updateCaseNumber: caseNumber,
                currentCaseNumber: this.currentPage.caseNumber
            });
            return;
        }

        // Step 4: Update specific fields incrementally
        // Update currentPage fields
        if (fields.caseNumber !== undefined) {
            this.currentPage.caseNumber = fields.caseNumber;
        }
        if (fields.subject !== undefined) {
            this.currentPage.subject = fields.subject;
        }
        if (fields.status !== undefined) {
            this.currentPage.status = fields.status;
        }
        if (fields.subStatus !== undefined) {
            this.currentPage.subStatus = fields.subStatus;
        }

        // Update customerMetadata fields
        if (fields.customerId !== undefined) {
            this.customerMetadata.customerId = fields.customerId;
        }
        if (fields.institutionId !== undefined) {
            this.customerMetadata.institutionId = fields.institutionId;
        }
        if (fields.server !== undefined) {
            this.customerMetadata.server = fields.server;
            // Populate env buttons when server is set (needs institutionCode too)
            if (this.customerMetadata.institutionCode) {
                this.populateEnvButtons();
            }
        }
        if (fields.productServiceName !== undefined) {
            this.customerMetadata.productServiceName = fields.productServiceName;
            // Update env buttons if product service name changes (affects sandbox buttons)
            if (this.customerMetadata.institutionCode) {
                this.populateEnvButtons();
            }
        }
        if (fields.institutionCode !== undefined) {
            this.customerMetadata.institutionCode = fields.institutionCode;
            // Populate env buttons when institutionCode is set
            this.populateEnvButtons();
        }
        if (fields.customerTimezone !== undefined) {
            this.customerMetadata.timezone = fields.customerTimezone;
        }

        // Step 5: Update UI to reflect changes
        this.updateBannerUI();

        // Step 6: Update navigation history if case number changed
        if (fields.caseNumber && fields.caseNumber !== this.displayedCaseNumber) {
            // Navigation history will be updated on next page change
        }

        console.log('[PersistentBanner] Applied incremental field updates:', Object.keys(fields));
    },

    /**
     * Handle URL change - reset current page data
     * @param {string} newUrl
     */
    handleUrlChange(newUrl) {
        console.log('[PersistentBanner] Handling URL change, resetting current page data');

        // Clear case-specific data when navigating away (this also clears fullCaseMetadata and cancels retries)
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

        // Update UI to reflect cleared state
        this.updateBannerUI();

        // The content script will call updateCurrentPage with proper data after page analysis
        console.log('[PersistentBanner] Waiting for content script to update page data...');
    },

    /**
     * Clear case-specific data (called when navigating to a different case or non-case page)
     */
    clearCaseData(preserveContext = false) {
        console.log('[PersistentBanner] Clearing case-specific data');

        // Stop polling when clearing data
        this.stopDataPolling();

        // Cancel any pending retries
        this.cancelMetadataRetry();

        // Clear full case metadata
        this.fullCaseMetadata = null;

        // Clear current case ID
        if (!preserveContext) {
            this.currentCaseId = null;
        }

        // Clear displayed case tracking
        this.displayedCaseId = null;
        this.displayedCaseNumber = null;

        // Stop customer time refresh
        this.stopCustomerTimeRefresh();

        // Clear customer metadata
        // Uses standardized field names only (no instCode alias)
        this.customerMetadata = {
            customerId: null,
            institutionId: null,
            server: null,
            productServiceName: null,
            institutionCode: null,
            timezone: null
        };

        // Reset displayed page metadata
        if (this.currentPage) {
            this.currentPage.caseNumber = null;
            this.currentPage.subject = null;
            this.currentPage.status = null;
            this.currentPage.subStatus = null;
        }

        // Reset environment menu state
        this.envMenuVisible = false;

        // Clear CaseDataStore to prevent stale data
        if (typeof CaseDataStore !== 'undefined' && typeof CaseDataStore.clear === 'function') {
            CaseDataStore.clear('navigation');
        }

        // Clear cached case data in window.ExLibrisExtension
        if (window.ExLibrisExtension) {
            if (window.ExLibrisExtension.caseToolkit) {
                window.ExLibrisExtension.caseToolkit.caseData = null;
            }

        }

        // Clear last extracted data in CasePageDataExtractor
        if (typeof CasePageDataExtractor !== 'undefined') {
            CasePageDataExtractor.lastExtractedData = null;
            CasePageDataExtractor.currentCaseId = null;
        }

        console.log('[PersistentBanner] Case data cleared (including cached data and full metadata)');
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
        // Only add case pages to history
        if (pageInfo.type !== 'case_page') {
            return;
        }

        // Don't add if it's the same as the last entry
        const lastEntry = this.navigationHistory[this.navigationHistory.length - 1];

        const historyEntry = {
            ...pageInfo,
            subject: pageInfo.subject || this.currentPage.subject || null,
            description: this.currentPage.description || null,
            customerId: this.customerMetadata.customerId || null,  // Standardized field name
            institutionId: this.customerMetadata.institutionId || null,  // Standardized field name
            server: this.customerMetadata.server || null,
            institutionCode: pageInfo.institutionCode || this.customerMetadata.institutionCode || this.currentPage.institutionCode || this.currentPage.exLibrisAccountNumber || null,
            status: pageInfo.status || this.currentPage.status || null,
            accountCode: this.customerMetadata.i || this.currentPage.accountCode || this.currentPage.exLibrisAccountNumber || null,
            accountName: this.customerMetadata.accountName || this.currentPage.accountName || null
        };

        if (lastEntry && lastEntry.url === pageInfo.url) {
            console.log('[PersistentBanner:History] Page already in history. Updating last entry.');
            for (const key in lastEntry) {
                if (lastEntry[key] && pageInfo[key]) {
                    lastEntry[key] = pageInfo[key];
                }
            }
            console.log('[PersistentBanner:History] Last entry:', lastEntry);

        }

        this.navigationHistory.push(historyEntry);

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
                    // Case number mismatch is authoritative - always clear stale data
                    if (validation.currentContext) {
                        const caseIdMismatch = caseId && caseId !== validation.currentContext.caseId;
                        const caseNumberMismatch = pageData.caseNumber && validation.currentContext.caseNumber &&
                            pageData.caseNumber !== validation.currentContext.caseNumber;

                        if (caseIdMismatch || caseNumberMismatch) {
                            console.warn(`[PersistentBanner] Cannot update page: ${validation.reason}`, {
                                caseIdMismatch,
                                caseNumberMismatch,
                                pageDataCaseId: caseId,
                                pageDataCaseNumber: pageData.caseNumber,
                                currentCaseId: validation.currentContext.caseId,
                                currentCaseNumber: validation.currentContext.caseNumber
                            });
                            this.clearCaseData();
                            this.updateBannerUI();
                            return;
                        }
                    } else {
                        // No current context - clear stale data
                        console.warn(`[PersistentBanner] Cannot update page: ${validation.reason} (no current context)`);
                        this.clearCaseData();
                        this.updateBannerUI();
                        return;
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
            institutionCode: pageData.institutionCode || pageData.exLibrisAccountNumber || null,
            exLibrisAccountNumber: pageData.exLibrisAccountNumber || pageData.institutionCode || null,
            accountName: pageData.accountName || null,
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

        // Add to navigation history
        this.addToNavigationHistory({
            type: this.currentPage.type,
            caseNumber: this.currentPage.caseNumber,
            subject: this.currentPage.subject,
            url: this.currentPage.url,
            timestamp: this.currentPage.timestamp,
            institutionCode: this.customerMetadata.institutionCode || this.currentPage.institutionCode || this.currentPage.exLibrisAccountNumber || null,
            status: this.currentPage.status || null
        });
    },

    /**
     * Create banner element
     */
    createBanner() {
        const banner = document.createElement('div');
        banner.id = this.bannerId;
        banner.className = `exl-persistent-banner${this.pageConfig.classNameSuffix}`;
        banner.setAttribute('tabindex', '-1'); // Exclude container from tab order

        // Build banner HTML based on pageConfig
        const config = this.pageConfig;
        const suffix = config.classNameSuffix;
        
        let sectionsHTML = '';
        
        // Current Page section (full mode only)
        if (config.showCurrentPage) {
            sectionsHTML += `
                <div class="exl-banner-section exl-banner-page-info">
                    <div class="exl-banner-label">Current<br>Page</div>
                    <div class="exl-banner-page-type" id="exl-banner-page-type">—</div>
                </div>
            `;
        }
        
        // Primary Metadata section (full mode only)
        if (config.showMetadata) {
            sectionsHTML += `
                <div class="exl-banner-section exl-banner-metadata" id="exl-banner-metadata-section">
                    <div class="exl-banner-label">Primary<br>Metadata</div>
                    <div class="exl-banner-metadata-grid" id="exl-banner-metadata">
                        <span class="exl-banner-meta-item" id="exl-banner-subject-item"><span class="exl-meta-label">Subject:</span><strong id="exl-banner-subject">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-status-item"><span class="exl-meta-label">Status:</span><strong id="exl-banner-status">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-substatus-item"><span class="exl-meta-label">Substatus:</span><strong id="exl-banner-substatus">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-product-item"><span class="exl-meta-label">Product:</span><strong id="exl-banner-product">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-instcode-item"><span class="exl-meta-label">InstCode:</span><strong id="exl-banner-instcode">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-custid-item"><span class="exl-meta-label">CustID:</span><strong id="exl-banner-custid">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-instid-item"><span class="exl-meta-label">InstID:</span><strong id="exl-banner-instid">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-server-item"><span class="exl-meta-label">Server:</span><strong id="exl-banner-server">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-timezone-item"><span class="exl-meta-label">Timezone:</span><strong id="exl-banner-timezone">—</strong></span>
                        <span class="exl-banner-meta-item" id="exl-banner-customer-time-item"><span class="exl-meta-label">Customer Time:</span><strong id="exl-banner-customer-time">—</strong></span>
                        <span class="exl-refresh-emoji" id="exl-refresh-emoji" data-action="refresh" title="Refresh and display the correct data and codes from the currently-viewed case">🔄</span>
                        <div class="exl-customer-data-notification" id="exl-customer-data-notification" style="gap: 0px; display: none; border-top-width: 0px; border-left-width: 0px; border-right-width: 0px; border-bottom-width: 0px; padding-bottom: 0px; padding-top: 0px; height: 40px; align-items: center; background-color: rgba(255, 255, 255, 0);">
                            <span class="exl-notification-text" style="padding: 2px 8px 2px 12px; box-shadow: rgba(127, 80, 246, 0.15) 0px 2px 8px, rgba(255, 255, 255, 0.1) 0px 1px 0px inset; background-color: rgba(255, 255, 255, 0.20); border-radius: 4px 0 0 4px; margin: 0px; width: 200px;">Hmm...looks like we do not have this customer's internal details in memory.</span>
                            <button class="exl-banner-btn exl-customer-data-btn" style="min-height: 19px; border-width: 0px; border-style: initial; border-image: initial; border-radius: 0 3px 3px 0;" id="exl-customer-data-btn" tabindex="0">Add/Modify Customer Data</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Timezone section (minimal mode only - shows timezone and customer time without full metadata)
        if (config.enableTimezoneDisplay && !config.showMetadata) {
            sectionsHTML += `
                <div class="exl-banner-section${suffix} exl-banner-timezone-section${suffix}">
                    <div class="exl-banner-tz-row${suffix}">
                        <span class="exl-tz-label${suffix}">Timezone:</span>
                        <span class="exl-tz-value${suffix}" id="exl-banner-timezone${suffix}">—</span>
                    </div>
                    <div class="exl-banner-tz-row${suffix}">
                        <span class="exl-tz-label${suffix}">Customer Time:</span>
                        <span class="exl-tz-value${suffix}" id="exl-banner-customer-time${suffix}">—</span>
                    </div>
                </div>
            `;
        }
        
        // Messages section
        if (config.showMessages) {
            sectionsHTML += `
                <div class="exl-banner-section${suffix} exl-banner-messages${suffix}" id="exl-banner-messages${suffix}" style="display: none;">
                    <div class="exl-banner-message-content${suffix}" id="exl-banner-message-content${suffix}">
                        <!-- Message text rendered here (multiline support) -->
                    </div>
                    <div class="exl-banner-message-nav${suffix}">
                        <button class="exl-banner-nav-btn${suffix}" id="exl-message-prev${suffix}" title="Previous message" tabindex="0">◀</button>
                        <span class="exl-banner-message-index${suffix}" id="exl-message-index${suffix}">1/1</span>
                        <button class="exl-banner-nav-btn${suffix}" id="exl-message-next${suffix}" title="Next message" tabindex="0">▶</button>
                    </div>
                </div>
            `;
        }
        
        // Actions section (buttons)
        let actionsHTML = '';
        if (config.showCustomerEnv) {
            actionsHTML += `<button class="exl-banner-btn${suffix} exl-popup-trigger${suffix}" data-popup="env" title="Open Customer Environment menu" tabindex="0">Customer Env</button>`;
        }
        if (config.showTools) {
            actionsHTML += `<button class="exl-banner-btn${suffix} exl-popup-trigger${suffix}" data-popup="tools" title="Open Tools menu" tabindex="0">Tools</button>`;
        }
        if (config.showWikiShortcuts) {
            actionsHTML += `<button class="exl-banner-btn${suffix} exl-popup-trigger${suffix}" data-popup="wiki" title="Open Wiki Shortcuts menu" tabindex="0">Wiki Shortcuts</button>`;
        }
        
        if (actionsHTML) {
            sectionsHTML += `
                <div class="exl-banner-section${suffix} exl-banner-actions${suffix}">
                    ${actionsHTML}
                </div>
            `;
        }
        
        // Tools popup menu
        if (config.showTools) {
            let toolsMenuItems = '';
            
            // Full mode tools
            if (config.showMetadata) {
                toolsMenuItems = `
                    <button class="exl-popup-menu-item exl-disabled" data-tool="timezone-inspector" title="Timezone Inspector (Coming Soon)" disabled tabindex="-1">Timezone Inspector</button>
                    <button class="exl-popup-menu-item exl-disabled" data-tool="sql-wizard" title="SQL Wizard (Coming Soon)" disabled tabindex="-1">SQL Wizard</button>
                    <button class="exl-popup-menu-item" data-tool="customer-data" title="Open Add/Modify Customer Data tool" tabindex="0">Add/Modify Customer Data</button>
                    <button class="exl-popup-menu-item" data-tool="color-handler-settings" title="Configure colors for status, anchor, and case highlighting" tabindex="0">Color Handler Settings</button>
                    <button class="exl-popup-menu-item" data-action="action1" title="Extract and enable copy buttons for case comments" tabindex="0">Extract Case Comments</button>
                    <button class="exl-popup-menu-item" data-action="action3" title="Copy case details as XML or TSV" tabindex="0">Copy Case Details</button>
                `;
            } else {
                // Minimal mode tools (Clarivate)
                toolsMenuItems = `
                    <button class="exl-popup-menu-item${suffix}" data-tool="color-handler-settings" title="Configure status colors" tabindex="0">Color Settings</button>
                    <button class="exl-popup-menu-item${suffix}" data-tool="text-formatter" title="Open Text Formatter" tabindex="0">Text Formatter</button>
                    <button class="exl-popup-menu-item${suffix}" data-tool="message-manager" title="Manage Banner Messages" tabindex="0">Manage Messages</button>
                `;
            }
            
            sectionsHTML += `
                <div class="exl-popup-menu${suffix}" id="exl-tools-popup${suffix}" style="display: none;">
                    <div class="exl-popup-menu-content${suffix}">
                        ${toolsMenuItems}
                    </div>
                </div>
            `;
        }
        
        // Wiki Shortcuts popup menu (full mode only)
        if (config.showWikiShortcuts) {
            sectionsHTML += `
                <div class="exl-popup-menu" id="exl-wiki-popup" style="display: none;">
                    <div class="exl-popup-menu-content" id="exl-wiki-popup-content">
                        <!-- Populated dynamically from URLBuilder.getWikiLinks() -->
                    </div>
                </div>
            `;
        }
        
        // Customer Environment popup menu (full mode only)
        if (config.showCustomerEnv) {
            sectionsHTML += `
                <div class="exl-popup-menu" id="exl-env-popup" style="display: none;">
                    <div class="exl-popup-menu-content" id="exl-env-popup-content">
                        <!-- Populated dynamically from populateEnvButtons() -->
                    </div>
                </div>
            `;
        }
        
        // Navigation History section (full mode only)
        if (config.showNavigationHistory) {
            sectionsHTML += `
                <div class="exl-banner-section exl-banner-history">
                    <div class="exl-banner-label">Navigation<br>History</div>
                    <div class="exl-banner-history-list" id="exl-banner-history">
                        <div class="exl-banner-history-placeholder">No navigation history yet</div>
                    </div>
                </div>
            `;
        }

        banner.innerHTML = `
            <div class="exl-banner-container${suffix}">
                ${sectionsHTML}
            </div>
        `;

        this.elements.banner = banner;
        this.cacheElements();
        this.wireEventHandlers();
        
        if (config.showMessages) {
            this.setupMessageSectionResizeObserver();
        }

        return banner;
    },

    /**
     * Cache banner element references
     * Uses pageConfig.classNameSuffix to select appropriate elements
     */
    cacheElements() {
        const banner = this.elements.banner;
        if (!banner) return;
        
        const suffix = this.pageConfig.classNameSuffix || '';

        // Full mode elements (no suffix)
        this.elements.pageType = banner.querySelector('#exl-banner-page-type');
        this.elements.subject = banner.querySelector('#exl-banner-subject');
        this.elements.status = banner.querySelector('#exl-banner-status');
        this.elements.subStatus = banner.querySelector('#exl-banner-substatus');
        this.elements.subjectItem = banner.querySelector('#exl-banner-subject-item');
        this.elements.statusItem = banner.querySelector('#exl-banner-status-item');
        this.elements.substatusItem = banner.querySelector('#exl-banner-substatus-item');
        this.elements.product = banner.querySelector('#exl-banner-product');
        this.elements.instCode = banner.querySelector('#exl-banner-instcode');
        this.elements.custId = banner.querySelector('#exl-banner-custid');
        this.elements.instId = banner.querySelector('#exl-banner-instid');
        this.elements.server = banner.querySelector('#exl-banner-server');
        this.elements.refreshEmoji = banner.querySelector('#exl-refresh-emoji');
        this.elements.envPopup = banner.querySelector('#exl-env-popup');
        this.elements.envPopupContent = banner.querySelector('#exl-env-popup-content');
        this.elements.historyList = banner.querySelector('#exl-banner-history');
        this.elements.metadataSection = banner.querySelector('#exl-banner-metadata-section');
        this.elements.customerDataNotification = banner.querySelector('#exl-customer-data-notification');
        this.elements.customerDataBtn = banner.querySelector('#exl-customer-data-btn');
        this.elements.wikiPopup = banner.querySelector('#exl-wiki-popup');
        this.elements.wikiPopupContent = banner.querySelector('#exl-wiki-popup-content');
        
        // Elements with suffix support (used in both full and minimal mode)
        this.elements.timezone = banner.querySelector(`#exl-banner-timezone${suffix}`);
        this.elements.customerTime = banner.querySelector(`#exl-banner-customer-time${suffix}`);
        this.elements.timezoneItem = banner.querySelector('#exl-banner-timezone-item');
        this.elements.customerTimeItem = banner.querySelector('#exl-banner-customer-time-item');
        this.elements.messagesSection = banner.querySelector(`#exl-banner-messages${suffix}`);
        this.elements.messageContent = banner.querySelector(`#exl-banner-message-content${suffix}`);
        this.elements.messagePrevBtn = banner.querySelector(`#exl-message-prev${suffix}`);
        this.elements.messageNextBtn = banner.querySelector(`#exl-message-next${suffix}`);
        this.elements.messageIndex = banner.querySelector(`#exl-message-index${suffix}`);
        this.elements.toolsPopup = banner.querySelector(`#exl-tools-popup${suffix}`);
    },

    /**
     * Check and update collapsed state of message section based on width
     * Can be called manually when section visibility changes
     */
    checkMessageSectionWidth() {
        if (!this.elements.messagesSection) return;

        const COLLAPSE_THRESHOLD = 175; // Collapse when width < 175px
        const EXPAND_THRESHOLD = 190; // Expand when width >= 190px
        const NARROW_MODE_THRESHOLD = 500; // Enable hover expansion when width < 500px

        // Only check if the section is visible
        const isVisible = this.elements.messagesSection.style.display !== 'none' &&
            window.getComputedStyle(this.elements.messagesSection).display !== 'none';

        if (!isVisible) return;

        const width = this.elements.messagesSection.offsetWidth;
        const hasCollapsedClass = this.elements.messagesSection.classList.contains('collapsed');
        const hasNarrowMode = this.elements.messagesSection.classList.contains('narrow-mode');

        // Collapse when width is less than threshold
        if (width < COLLAPSE_THRESHOLD && !hasCollapsedClass) {
            this.elements.messagesSection.classList.add('collapsed');
            console.log('[PersistentBanner] Message section collapsed (width:', width, 'px)');
        }
        // Expand when width is greater than or equal to threshold
        else if (width >= EXPAND_THRESHOLD && hasCollapsedClass) {
            this.elements.messagesSection.classList.remove('collapsed');
            console.log('[PersistentBanner] Message section expanded (width:', width, 'px)');
        }

        // Toggle narrow-mode for hover expansion behavior
        // Only enable hover expansion when section is narrow (< 500px)
        if (width < NARROW_MODE_THRESHOLD && !hasNarrowMode) {
            this.elements.messagesSection.classList.add('narrow-mode');
            console.log('[PersistentBanner] Narrow mode enabled (width:', width, 'px)');
        } else if (width >= NARROW_MODE_THRESHOLD && hasNarrowMode) {
            this.elements.messagesSection.classList.remove('narrow-mode');
            console.log('[PersistentBanner] Narrow mode disabled, section has enough space (width:', width, 'px)');
        }
    },

    /**
     * Setup resize observer for message section to handle collapsed state
     */
    setupMessageSectionResizeObserver() {
        if (!this.elements.messagesSection) return;

        // Use a debounce timer to prevent excessive checks
        let resizeTimer = null;

        const checkWidth = () => {
            this.checkMessageSectionWidth();
        };

        // Create ResizeObserver to watch for size changes
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver((entries) => {
                // Debounce the width check
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    checkWidth();
                }, 100);
            });

            resizeObserver.observe(this.elements.messagesSection);

            // Store observer for cleanup
            if (!this.trackedObservers) {
                this.trackedObservers = [];
            }
            this.trackedObservers.push({
                observer: resizeObserver,
                element: this.elements.messagesSection
            });

            // Also watch for display changes using MutationObserver
            const displayObserver = new MutationObserver(() => {
                // Check width after display changes
                setTimeout(() => {
                    checkWidth();
                }, 100);
            });

            displayObserver.observe(this.elements.messagesSection, {
                attributes: true,
                attributeFilter: ['style'],
                attributeOldValue: false
            });

            // Store observer for cleanup
            this.trackedObservers.push({
                observer: displayObserver,
                element: this.elements.messagesSection
            });

            // Initial check
            setTimeout(() => {
                checkWidth();
            }, 200);
        } else {
            // Fallback for browsers without ResizeObserver
            // Use window resize event
            const handleResize = () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    checkWidth();
                }, 100);
            };

            window.addEventListener('resize', handleResize);

            // Store listener for cleanup
            if (!this.trackedListeners) {
                this.trackedListeners = [];
            }
            this.trackedListeners.push({
                element: window,
                event: 'resize',
                handler: handleResize
            });

            // Initial check
            setTimeout(() => {
                checkWidth();
            }, 200);
        }
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

        // Handle customer data button
        if (this.elements.customerDataBtn) {
            this.elements.customerDataBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.handleToolClick('customer-data');
            });
        }

        // Handle refresh emoji click
        if (this.elements.refreshEmoji) {
            this.elements.refreshEmoji.addEventListener('click', (event) => {
                event.stopPropagation();
                this.handleRefresh();
            });
        }

        // Handle environment button clicks (from popup menu)
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
            this.elements.messagePrevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.rotateToPreviousMessage();
            });
        }

        if (this.elements.messageNextBtn) {
            this.elements.messageNextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.rotateToNextMessage();
            });
        }

        // Setup pause-on-hover for message content
        if (this.elements.messageContent) {
            this.registerListener(this.elements.messageContent, 'mouseenter', () => {
                this.pauseMessageRotation();
            });

            this.registerListener(this.elements.messageContent, 'mouseleave', () => {
                this.resumeMessageRotation();
            });
        }

        // Add dropdown button to message index
        if (this.elements.messageIndex) {
            this.elements.messageIndex.style.cursor = 'pointer';
            this.elements.messageIndex.title = 'Click to see all messages';
            this.registerListener(this.elements.messageIndex, 'click', (e) => {
                e.stopPropagation();
                this.showMessageDropdown();
            });
        }

        // Handle close button
        const closeBtn = banner.querySelector('.exl-hl-banner-close-btn');
        if (closeBtn) {
            this.registerListener(closeBtn, 'click', (e) => {
                e.stopPropagation();
                this.handleBannerClose();
            });
        }

        // Handle popup trigger buttons
        banner.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-popup]');
            if (trigger) {
                const popupType = trigger.dataset.popup;
                this.showPopupMenu(popupType, trigger);
                event.stopPropagation();
                return;
            }

            // Handle popup menu item clicks
            const menuItem = event.target.closest('.exl-popup-menu-item');
            if (menuItem) {
                const toolName = menuItem.dataset.tool;
                const action = menuItem.dataset.action;

                // Check if menu item is disabled
                if (menuItem.disabled || menuItem.classList.contains('exl-disabled')) {
                    console.log('[PersistentBanner] Menu item is disabled, ignoring click');
                    event.stopPropagation();
                    return;
                }

                if (toolName) {
                    this.handleToolClick(toolName);
                } else if (action) {
                    this.handleAction(action);
                }

                this.hidePopupMenu();
                event.stopPropagation();
                return;
            }
        });

        // Close popup when clicking outside
        document.addEventListener('click', (event) => {
            if (this.activePopup && !event.target.closest('.exl-popup-menu') && !event.target.closest('.exl-popup-trigger')) {
                this.hidePopupMenu();
            }
        });

        // Add keyboard event handlers for banner buttons
        banner.addEventListener('keydown', (event) => {
            // Handle Enter/Space on buttons
            if (event.target.matches('button') && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                event.target.click();
            }

            // Handle Escape to close popups
            if (event.key === 'Escape' && this.activePopup) {
                this.hidePopupMenu();
            }
        });

        // Populate wiki shortcuts on init
        this.populateWikiShortcuts();
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
            case 'tools':
                // Handled by popup trigger click handler
                break;
            case 'action3':
                this.handleCaseDetailExtractor();
                break;
            case 'exit-tool':
                this.exitActionFocusedMode();
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
                const pageInfo = this.getPageInfo();
                if (pageInfo) {
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
                    this.showNotification('Unable to refresh: Page info not available', 'warning');
                }
                return;
            }

            // Check for fresh cached data first
            const cachedData = this.getCachedCaseData();
            if (cachedData && this.isDataFresh(cachedData)) {
                console.log('[PersistentBanner] Using cached data for refresh');
                await this.populateFromCachedData(cachedData);
                this.showNotification('Banner refreshed from cache', 'success');
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
                        subStatus: caseData.subStatus
                    });

                    if (caseData.custID || caseData.instID || caseData.server) {
                        this.customerMetadata = {
                            customerId: caseData.custID || null,
                            institutionId: caseData.instID || null,
                            server: caseData.server || null,
                            productServiceName: caseData.productServiceName || null,
                            institutionCode: caseData.exLibrisAccountNumber || null
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
                        subStatus: freshData.subStatus
                    });

                    if (freshData.custID || freshData.instID || freshData.server) {
                        this.customerMetadata = {
                            customerId: freshData.custID || null,
                            institutionId: freshData.instID || null,
                            server: freshData.server || null,
                            productServiceName: freshData.productServiceName || null,
                            institutionCode: freshData.instCode || freshData.institutionCode || null,
                            customerCode: freshData.exLibrisAccountNumber || null,
                            timezone: freshData.customerTimezone || freshData.timezone || null

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
            // Get fresh comments data from current page (await the async function)
            const data = await CaseCommentExtractor.extractCaseComments();

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
     * Handle opening the color picker for status colors
     * Opens the color picker modal for customizing case status colors on list pages
     */
    async handleOpenColorPicker() {
        console.log('[PersistentBanner] Opening color picker for status colors...');

        // Check if ColorPicker3D is available
        if (typeof ColorPicker3D === 'undefined') {
            this.showNotification('Color Picker module not loaded', 'error');
            return;
        }

        try {
            // Get current color (default to a neutral gray)
            const currentColor = 'rgb(128, 128, 128)';

            // Show the color picker modal
            const selectedColor = await this.showColorPickerModal({
                currentColor: currentColor
            });

            if (selectedColor) {
                console.log('[PersistentBanner] Color selected:', selectedColor);
                this.showNotification(`Color selected: ${selectedColor}`, 'success');

                // Copy color to clipboard for user convenience
                try {
                    await navigator.clipboard.writeText(selectedColor);
                    this.showNotification(`Color copied to clipboard: ${selectedColor}`, 'success');
                } catch (clipboardError) {
                    console.warn('[PersistentBanner] Could not copy to clipboard:', clipboardError);
                }
            } else {
                console.log('[PersistentBanner] Color picker cancelled');
            }
        } catch (error) {
            console.error('[PersistentBanner] Error opening color picker:', error);
            this.showNotification('Error opening color picker: ' + error.message, 'error');
        }
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

        // Update page type styling based on raw type
        const rawType = this.currentPage.type;
        this.elements.pageType.className = 'exl-banner-page-type';
        this.elements.pageType.classList.add(`exl-page-${rawType.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')}`);

        // For case pages and case comment pages, show case number instead of display name
        if (rawType === 'case_page' || rawType === 'case_comments') {
            const caseNumber = this.currentPage.caseNumber || '—';
            this.elements.pageType.textContent = caseNumber;
        } else {
            // Update page type with friendly display name
            const displayName = this.currentPage.displayType || this.getPageTypeDisplayName(this.currentPage.type);
            this.elements.pageType.textContent = displayName;
        }

        // FIRST: Check if we're on a case page or case comments
        // These pages NEVER show messages - they have their own data
        const isCasePage = rawType === 'case_page';
        const isCaseComments = rawType === 'case_comments';
        const metadataSection = this.elements.metadataSection;
        const messagesSection = this.elements.messagesSection;

        if (isCasePage || isCaseComments) {
            // Case page or case comments - show metadata and optionally messages
            // Check extraction state for case pages
            if (isCasePage) {
                const extractionState = this.isCaseDataExtractionComplete();

                if (extractionState.complete && extractionState.hasData) {
                    // Extraction complete - show case data
                    if (metadataSection) {
                        metadataSection.style.display = 'flex';
                    }
                    console.log('[PersistentBanner] Case data extraction complete - showing case data');
                } else if (extractionState.isExtracting) {
                    // Extraction in progress - show loading state (hide metadata only)
                    if (metadataSection) {
                        metadataSection.style.display = 'none';
                    }
                    console.log('[PersistentBanner] Case data extraction in progress - showing loading state');
                } else {
                    // No extraction started or no data yet - show empty state
                    if (metadataSection) {
                        metadataSection.style.display = 'flex'; // Show metadata section but with empty data
                    }
                    console.log('[PersistentBanner] Case data extraction not started or no data yet');
                }
            } else {
                // Case comments - show metadata section
                if (metadataSection) {
                    metadataSection.style.display = 'flex';
                }
            }

            // Update metadata fields (will show '—' if no data)
            this.updateMetadataFields();

            // Check if should show messages (messages can now appear on case pages)
            this.shouldShowMessages().then(showMessages => {
                if (showMessages) {
                    // Show messages
                    if (messagesSection) {
                        messagesSection.style.display = 'flex';
                        this.updateMessageDisplay();
                        this.startMessageRotation();
                        // Check width after showing section
                        setTimeout(() => this.checkMessageSectionWidth(), 100);
                    }
                } else {
                    // Don't show messages (feature disabled or no messages)
                    if (messagesSection) {
                        messagesSection.style.display = 'none';
                        this.stopMessageRotation();
                    }
                }
            }).catch(error => {
                console.error('[PersistentBanner] Error checking shouldShowMessages:', error);
                if (messagesSection) {
                    messagesSection.style.display = 'none';
                    this.stopMessageRotation();
                }
            });

        } else {
            // NOT a case page or case comments - show messages if enabled
            if (metadataSection) {
                metadataSection.style.display = 'none';
            }

            // Check if should show messages
            this.shouldShowMessages().then(showMessages => {
                if (showMessages) {
                    // Show messages
                    if (messagesSection) {
                        messagesSection.style.display = 'flex';
                        this.updateMessageDisplay();
                        this.startMessageRotation();
                        // Check width after showing section
                        setTimeout(() => this.checkMessageSectionWidth(), 100);
                    }
                } else {
                    // Don't show messages (feature disabled or no messages)
                    if (messagesSection) {
                        messagesSection.style.display = 'none';
                        this.stopMessageRotation();
                    }
                }
            }).catch(error => {
                console.error('[PersistentBanner] Error checking shouldShowMessages:', error);
                if (messagesSection) {
                    messagesSection.style.display = 'none';
                    this.stopMessageRotation();
                }
            });
        }

        // Update banner background based on case status
        this.updateBannerBackground();
    },

    /**
     * Update metadata fields in the banner
     * Separated for reuse in different contexts
     * Now hides empty fields and supports rotating secondary metadata
     */
    updateMetadataFields() {
        /**
         * Helper to update a metadata field and show/hide its container
         * @param {HTMLElement} element - The value element
         * @param {string} value - The value to display
         * @param {string} itemId - The ID of the parent item container
         * @returns {boolean} True if the field has a value
         */
        const updateField = (element, value, itemId) => {
            const hasValue = value && value !== '—' && value.trim() !== '';
            const displayValue = hasValue ? value : '—';
            
            if (element) {
                element.textContent = displayValue;
            }
            
            // Find and show/hide the parent item container
            if (itemId) {
                const item = document.getElementById(itemId);
                if (item) {
                    item.style.display = hasValue ? '' : 'none';
                }
            }
            
            return hasValue;
        };

        // Update case metadata with visibility control
        updateField(this.elements.subject, this.currentPage.subject, 'exl-banner-subject-item');
        
        // Combine status and substatus
        let statusValue = this.currentPage.status || '';
        if (this.currentPage.subStatus && this.currentPage.subStatus !== '—' && this.currentPage.subStatus.trim() !== '') {
            statusValue = statusValue ? `${statusValue} - ${this.currentPage.subStatus}` : this.currentPage.subStatus;
        }
        updateField(this.elements.status, statusValue, 'exl-banner-status-item');

        // Hide substatus field (combined with status)
        if (this.elements.substatusItem) {
            this.elements.substatusItem.style.display = 'none';
        }

        // Update customer metadata with visibility control
        updateField(this.elements.product, this.customerMetadata.productServiceName, 'exl-banner-product-item');
        updateField(this.elements.instCode, this.customerMetadata.institutionCode || this.customerMetadata.instCode, 'exl-banner-instcode-item');
        updateField(this.elements.custId, this.customerMetadata.custId || this.customerMetadata.customerId, 'exl-banner-custid-item');
        updateField(this.elements.instId, this.customerMetadata.instId || this.customerMetadata.institutionId, 'exl-banner-instid-item');
        updateField(this.elements.server, this.customerMetadata.server, 'exl-banner-server-item');
        updateField(this.elements.timezone, this.customerMetadata.timezone, 'exl-banner-timezone-item');

        // Update timezone and customer time
        this.updateTimezoneDisplay();
        this.updateCustomerTime();
        this.startCustomerTimeRefresh();

        // Check customer data completeness and show notification if needed
        this.checkAndShowCustomerDataNotification();

        // Schedule metadata rotation after 5 seconds if all rotatable fields have data
        this.scheduleMetadataRotation();
    },

    /**
     * Schedule metadata rotation to start after 5 seconds of all fields being populated
     */
    scheduleMetadataRotation() {
        // Clear any existing delay timer
        if (this.metadataRotation.startDelayTimer) {
            clearTimeout(this.metadataRotation.startDelayTimer);
            this.metadataRotation.startDelayTimer = null;
        }

        // Check if all rotatable fields have values
        const allPopulated = this.metadataRotation.rotatableFields.every(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field) return false;
            const strong = field.querySelector('strong');
            const value = strong?.textContent?.trim();
            return value && value !== '—' && value !== '';
        });

        if (!allPopulated) {
            console.log('[PersistentBanner] Not all rotatable fields populated, skipping rotation');
            this.stopMetadataRotation();
            return;
        }

        // Schedule rotation to start after 5 seconds
        console.log('[PersistentBanner] Scheduling metadata rotation in 5 seconds');
        this.metadataRotation.startDelayTimer = setTimeout(() => {
            this.startMetadataRotation();
        }, 5000);

        // Track the timer
        this.trackedTimers.push(this.metadataRotation.startDelayTimer);
    },

    /**
     * Start rotating metadata fields
     */
    startMetadataRotation() {
        // Don't start if already active
        if (this.metadataRotation.active) {
            return;
        }

        const metadataGrid = document.getElementById('exl-banner-metadata');
        if (!metadataGrid) {
            console.warn('[PersistentBanner] Metadata grid not found for rotation');
            return;
        }

        // Add rotating mode class to container
        metadataGrid.classList.add('rotating-mode');

        // Mark rotatable fields and create rotation indicator
        this.metadataRotation.rotatableFields.forEach((fieldId, index) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.classList.add('rotatable');
                if (index === 0) {
                    field.classList.add('active');
                }
                // Add click handler to stop rotation when user clicks a field
                const clickHandler = () => {
                    console.log('[PersistentBanner] User clicked rotating field, stopping rotation');
                    this.stopMetadataRotation();
                };
                field.addEventListener('click', clickHandler);
                // Track for cleanup
                this.trackedListeners.push({ element: field, event: 'click', handler: clickHandler });
            }
        });

        // Add rotation indicator dots if not already present
        if (!metadataGrid.querySelector('.exl-rotation-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'exl-rotation-indicator';
            this.metadataRotation.rotatableFields.forEach((_, index) => {
                const dot = document.createElement('span');
                dot.className = 'exl-rotation-dot' + (index === 0 ? ' active' : '');
                indicator.appendChild(dot);
            });
            // Insert after the last rotatable field
            const lastField = document.getElementById(this.metadataRotation.rotatableFields[this.metadataRotation.rotatableFields.length - 1]);
            if (lastField) {
                lastField.after(indicator);
            }
        }

        this.metadataRotation.currentIndex = 0;
        this.metadataRotation.active = true;

        // Start rotation timer
        this.metadataRotation.timer = setInterval(() => {
            this.rotateToNextMetadataField();
        }, this.metadataRotation.interval);

        // Track the timer
        this.trackedTimers.push(this.metadataRotation.timer);

        console.log('[PersistentBanner] Metadata rotation started');
    },

    /**
     * Rotate to the next metadata field
     */
    rotateToNextMetadataField() {
        const fields = this.metadataRotation.rotatableFields;
        const currentIndex = this.metadataRotation.currentIndex;
        const nextIndex = (currentIndex + 1) % fields.length;

        // Update field visibility
        const currentField = document.getElementById(fields[currentIndex]);
        const nextField = document.getElementById(fields[nextIndex]);

        if (currentField) {
            currentField.classList.remove('active');
        }
        if (nextField) {
            nextField.classList.add('active');
        }

        // Update indicator dots
        const metadataGrid = document.getElementById('exl-banner-metadata');
        const dots = metadataGrid?.querySelectorAll('.exl-rotation-dot');
        if (dots) {
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === nextIndex);
            });
        }

        this.metadataRotation.currentIndex = nextIndex;
    },

    /**
     * Stop rotating metadata fields and show all fields
     */
    stopMetadataRotation() {
        // Clear timers
        if (this.metadataRotation.timer) {
            clearInterval(this.metadataRotation.timer);
            this.metadataRotation.timer = null;
        }
        if (this.metadataRotation.startDelayTimer) {
            clearTimeout(this.metadataRotation.startDelayTimer);
            this.metadataRotation.startDelayTimer = null;
        }

        // Remove rotating mode
        const metadataGrid = document.getElementById('exl-banner-metadata');
        if (metadataGrid) {
            metadataGrid.classList.remove('rotating-mode');
            
            // Remove rotation indicator
            const indicator = metadataGrid.querySelector('.exl-rotation-indicator');
            if (indicator) {
                indicator.remove();
            }
        }

        // Remove rotatable classes from fields
        this.metadataRotation.rotatableFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.classList.remove('rotatable', 'active');
            }
        });

        this.metadataRotation.active = false;
        this.metadataRotation.currentIndex = 0;

        console.log('[PersistentBanner] Metadata rotation stopped');
    },

    /**
     * Get customer timezone from case data or lookup helper
     * @returns {Promise<string|null>} Timezone string or null
     */
    async getCustomerTimezone() {
        const caseData = this.caseToolkit?.caseData || (typeof CaseDataStore !== 'undefined'
            ? CaseDataStore.getCurrentData?.()
            : null);

        if (caseData?.customerTimezone) {
            return caseData.customerTimezone;
        }

        const identifiers = {
            institutionCode: this.customerMetadata.institutionCode || this.currentPage.institutionCode || null,
            customerId: this.customerMetadata.customerId || this.customerMetadata.custId || this.currentPage.custId || this.currentPage.customerId || null,
            instID: this.customerMetadata.institutionId || this.customerMetadata.instId || this.currentPage.instId || this.currentPage.institutionId || null,
            accountName: this.currentPage?.accountName || this.customerMetadata?.accountName || this.fullCaseMetadata?.accountName || null
        };

        if (typeof CustomerMasterManager !== 'undefined') {
            try {
                const timezoneInfo = await CustomerMasterManager.resolveTimezone(identifiers);
                if (timezoneInfo && timezoneInfo.timezone) {
                    return timezoneInfo.timezone;
                }
            } catch (error) {
                console.warn('[PersistentBanner] Error getting timezone from CustomerMasterManager:', error);
            }
        }

        return null;
    },

    /**
     * Update timezone display in metadata
     */
    async updateTimezoneDisplay() {
        if (!this.elements.timezone) return;

        // Get timezone if not already stored
        if (!this.customerMetadata.timezone) {
            this.customerMetadata.timezone = await this.getCustomerTimezone();
        }

        const timezone = this.customerMetadata.timezone;
        if (timezone) {
            // Format timezone for display (e.g., "America/New_York" -> "America/New York")
            const displayTimezone = timezone.replace(/_/g, ' ');
            this.elements.timezone.textContent = displayTimezone;
        } else {
            this.elements.timezone.textContent = '—';
        }
    },

    /**
     * Update customer time display
     */
    updateCustomerTime() {
        if (!this.elements.customerTime) return;

        const timezone = this.customerMetadata.timezone;
        if (!timezone) {
            this.elements.customerTime.textContent = '—';
            return;
        }

        try {
            // Get current time in customer timezone
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            const timeString = formatter.format(now);
            this.elements.customerTime.textContent = timeString;
        } catch (error) {
            console.warn('[PersistentBanner] Error formatting customer time:', error);
            this.elements.customerTime.textContent = '—';
        }
    },

    /**
     * Start customer time refresh interval (30 seconds)
     */
    startCustomerTimeRefresh() {
        // Clear existing interval
        if (this.customerTimeInterval) {
            clearInterval(this.customerTimeInterval);
            this.customerTimeInterval = null;
        }

        // Only start if we have a timezone
        if (!this.customerMetadata.timezone) {
            return;
        }

        // Update immediately
        this.updateCustomerTime();

        // Set up 30-second interval
        this.customerTimeInterval = setInterval(() => {
            this.updateCustomerTime();
        }, 30000);

        // Track interval for cleanup
        this.trackedTimers.push(this.customerTimeInterval);
    },

    /**
     * Stop customer time refresh interval
     */
    stopCustomerTimeRefresh() {
        if (this.customerTimeInterval) {
            clearInterval(this.customerTimeInterval);
            this.customerTimeInterval = null;
        }
    },

    /**
     * Check if customer data is complete and show notification if missing
     */
    checkAndShowCustomerDataNotification() {
        const completeness = this.checkCustomerDataCompleteness();

        if (completeness.missing) {
            // Show notification
            if (this.elements.customerDataNotification) {
                this.elements.customerDataNotification.style.display = 'flex';
            }

            // Hide missing metadata fields
            if (completeness.missingFields.includes('custID') && this.elements.custId) {
                this.elements.custId.closest('.exl-banner-meta-item')?.style.setProperty('display', 'none');
            }
            if (completeness.missingFields.includes('instID') && this.elements.instId) {
                this.elements.instId.closest('.exl-banner-meta-item')?.style.setProperty('display', 'none');
            }
            if (completeness.missingFields.includes('server') && this.elements.server) {
                this.elements.server.closest('.exl-banner-meta-item')?.style.setProperty('display', 'none');
            }
        } else {
            // Hide notification
            if (this.elements.customerDataNotification) {
                this.elements.customerDataNotification.style.display = 'none';
            }

            // Show all metadata fields
            if (this.elements.custId) {
                this.elements.custId.closest('.exl-banner-meta-item')?.style.setProperty('display', 'inline');
            }
            if (this.elements.instId) {
                this.elements.instId.closest('.exl-banner-meta-item')?.style.setProperty('display', 'inline');
            }
            if (this.elements.server) {
                this.elements.server.closest('.exl-banner-meta-item')?.style.setProperty('display', 'inline');
            }
        }
    },

    /**
     * Check if customer data is complete
     * Returns object with missing status, reason, and missing fields
     * @returns {Object} { missing: boolean, reason: string|null, missingFields: Array<string> }
     */
    checkCustomerDataCompleteness() {
        const institutionCode = this.customerMetadata.institutionCode || this.currentPage.institutionCode || this.customerMetadata.instCode || null;
        const accountCode = this.customerMetadata.accountCode || this.currentPage.accountCode || this.currentPage.exLibrisAccountNumber || null;
        const accountName = this.customerMetadata.accountName || this.currentPage.accountName || null;


        // if (!institutionCode && !accountName) {
        //     return { missing: false, reason: null, missingFields: [] };
        // }

        // Check critical fields
        const criticalFields = {
            instCode: null,
            institutionCode: this.customerMetadata.institutionCode,
            custID: this.customerMetadata.customerId,
            customerId: this.customerMetadata.customerId,
            instID: this.customerMetadata.institutionId,
            institutionId: this.customerMetadata.institutionId,
            server: this.customerMetadata.server,
            timezone: this.customerMetadata.timezone
        };

        const missingFields = [];
        for (const [field, value] of Object.entries(criticalFields)) {
            if (!value || value === '—') {
                missingFields.push(field);
            }
        }

        // If all critical fields are present, customer data is complete
        if (missingFields.length === 0) {
            return { missing: false, reason: null, missingFields: [] };
        }

        // Check if customer exists in CustomerMasterManager or UserCustomerDataManager
        let customerFound = false;

        // Check UserCustomerDataManager first (user-added data takes priority)
        if (typeof UserCustomerDataManager !== 'undefined') {
            const userCustomer = UserCustomerDataManager.findByInstitutionCode(institutionCode, accountName);
            if (userCustomer) {
                // Check if user customer has all critical fields
                const userHasAllFields = userCustomer.custID && userCustomer.instID && userCustomer.server;
                if (userHasAllFields) {
                    return { missing: false, reason: null, missingFields: [] };
                }
                customerFound = true;
            }
        }

        // // Check CustomerMasterManager
        // if (typeof CustomerMasterManager !== 'undefined') {
        //     const masterCustomer = CustomerMasterManager.findByInstitutionCode(institutionCode, accountName);
        //     if (masterCustomer) {
        //         // Check if master customer has all critical fields
        //         const masterHasAllFields = (masterCustomer.custID || masterCustomer.customerId) && 
        //                                    (masterCustomer.instID || masterCustomer.institutionId) && 
        //                                    masterCustomer.server;
        //         if (masterHasAllFields) {
        //             return { missing: false, reason: null, missingFields: [] };
        //         }
        //         customerFound = true;
        //     }
        // }

        if (typeof CustomerMasterManager !== 'undefined') {
            const masterCustomer = CustomerMasterManager.findByInstitutionCode(institutionCode, accountName);
            if (masterCustomer) {
                // Check if master customer has all critical fields
                const masterHasAllFields = (masterCustomer.custID || masterCustomer.customerId) &&
                    (masterCustomer.instID || masterCustomer.institutionId) &&
                    masterCustomer.server && masterCustomer.timezone && (masterCustomer.instCode || masterCustomer.institutionCode);
                if (masterHasAllFields) {
                    return { missing: false, reason: null, missingFields: [] };
                } else {
                    customerFound = true;
                }
            }
        }

        // Customer not found or missing critical fields
        return {
            missing: true,
            reason: customerFound ? 'incomplete' : 'not_found',
            missingFields
        };
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
                // Create gradient using the background color
                const backgroundGradient = this.createStatusGradient(statusConfig.background);
                this.elements.banner.style.background = backgroundGradient;

                // Update accent colors to match status (use base color for accents)
                this.updateAccentColors(statusConfig.base);

                console.log(`[PersistentBanner] Applied ${statusConfig.category} gradient and accent colors for status: ${this.currentPage.status}`);
            } else {
                // Unknown status - use default gradient and reset accents
                this.elements.banner.style.background = this.DEFAULT_GRADIENT;
                this.updateAccentColors(null);
                console.log(`[PersistentBanner] Unknown status "${this.currentPage.status}", using default gradient`);
            }
        } else {
            // Not a case page or no status - use default gradient and reset accents
            this.elements.banner.style.background = this.DEFAULT_GRADIENT;
            this.updateAccentColors(null);
        }
    },

    /**
     * Update accent colors (borders, buttons) to match status base color
     * Uses the base color for all accents (borders, button backgrounds, etc.)
     * @param {string|null} baseColor - Status base color in rgb() format, or null to reset
     */
    updateAccentColors(baseColor) {
        if (!this.elements.banner) return;

        // Update page type border-left color using base color
        if (this.elements.pageType) {
            if (baseColor) {
                this.elements.pageType.style.borderLeftColor = baseColor;
            } else {
                // Reset to default
                this.elements.pageType.style.borderLeftColor = '';
            }
        }

        // Update button colors (use base color for backgrounds)
        const buttons = this.elements.banner.querySelectorAll('.exl-banner-btn, .exl-popup-trigger');
        buttons.forEach(button => {
            if (baseColor) {
                // Use the base color as background, white text for legibility
                button.style.backgroundColor = baseColor;
                button.style.color = '#ffffff';
                button.style.borderColor = baseColor;
            } else {
                // Reset to default
                button.style.backgroundColor = '';
                button.style.color = '';
                button.style.borderColor = '';
            }
        });

        // Update popup menu item hover colors
        const popupItems = this.elements.banner.querySelectorAll('.exl-popup-menu-item:not(.exl-disabled)');
        popupItems.forEach(item => {
            if (baseColor) {
                // Store original hover handler or use CSS variable
                item.style.setProperty('--hover-color', baseColor);
            } else {
                item.style.removeProperty('--hover-color');
            }
        });
    },

    /**
     * Create gradient from background RGB color
     * Uses the background color (darker shade) for the gradient endpoint
     * @param {string} backgroundRgb - Background color in rgb() format
     * @returns {string} Linear gradient CSS
     */
    createStatusGradient(backgroundRgb) {
        // Extract RGB values from string like "rgb(109, 9, 41)"
        const rgbMatch = backgroundRgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!rgbMatch) {
            console.warn('[PersistentBanner] Invalid RGB format:', backgroundRgb);
            return this.DEFAULT_GRADIENT;
        }

        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);

        // Create gradient from default dark color to background status color
        // Default dark color: rgb(26, 26, 46)
        return `linear-gradient(135deg, rgb(26, 26, 46) 0%, rgb(${r}, ${g}, ${b}) 100%)`;
    },

    /**
     * Update navigation history UI
     */
    updateNavigationHistoryUI() {
        if (!this.elements.historyList) return;

        // Filter to only case pages (should already be filtered, but double-check)
        const caseHistory = this.navigationHistory.filter(item => item.type === 'case_page');

        if (caseHistory.length === 0) {
            this.elements.historyList.innerHTML = '<div class="exl-banner-history-placeholder">No navigation history yet</div>';
            return;
        }

        // Build history items (reverse order - newest first)
        const historyHTML = [...caseHistory].reverse().map((item, index) => {
            const relativeIndex = caseHistory.length - index;
            const institutionCode = item.institutionCode || '';
            const subject = item.subject || '';

            // Get status color for this history item
            let accentColor = null;
            let statusCategory = null;
            let backgroundColor = 'rgba(255, 255, 255, 0.05)'; // Default transparency

            if (item.status && this.STATUS_COLORS[item.status]) {
                const statusConfig = this.STATUS_COLORS[item.status];
                accentColor = statusConfig.base; // Use base for border-left accent
                statusCategory = statusConfig.category;

                // Use background color for the item background with appropriate opacity
                if (statusCategory === 'red' || statusCategory === 'orange') {
                    backgroundColor = this.rgbToRgba(statusConfig.background, 0.15);
                } else {
                    backgroundColor = this.rgbToRgba(statusConfig.background, 0.05);
                }
            }

            // Build tooltip with case details
            const tooltipParts = [];
            if (item.caseNumber) tooltipParts.push(`Case: ${item.caseNumber}`);
            if (item.institutionCode) tooltipParts.push(`Institution Code: ${item.institutionCode}`);
            if (item.subject) tooltipParts.push(`Subject: ${item.subject}`);
            if (item.description) tooltipParts.push(`Description: ${item.description}`);
            if (item.custID) tooltipParts.push(`CustID: ${item.custID}`);
            if (item.instID) tooltipParts.push(`InstID: ${item.instID}`);
            if (item.server) tooltipParts.push(`Server: ${item.server}`);
            if (item.status) tooltipParts.push(`Status: ${item.status}`);
            const tooltip = tooltipParts.join('\n');

            // Build style string for history item
            const itemStyle = `background-color: ${backgroundColor};${accentColor ? ` border-left-color: ${accentColor};` : ''}`;

            return `
                <div class="exl-banner-history-item" data-history-url="${item.url}" title="${tooltip || 'No details available'}" style="${itemStyle}">
                    <span class="exl-history-number">${relativeIndex}</span>
                    <div style="display: flex; flex-direction: column;">
                        <span class="exl-history-type">${institutionCode || 'N/A'}</span>
                        <span class="exl-history-details">${subject ? this.truncate(subject, 40) : 'No subject'}</span>
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
     * Convert rgb() color string to rgba() with specified opacity
     * @param {string} rgbString - RGB color string like "rgb(107, 9, 40)"
     * @param {number} opacity - Opacity value 0-1
     * @returns {string} RGBA color string
     */
    rgbToRgba(rgbString, opacity) {
        if (!rgbString || !rgbString.startsWith('rgb(')) {
            return `rgba(255, 255, 255, ${opacity})`;
        }

        // Extract RGB values: "rgb(107, 9, 40)" -> ["107", "9", "40"]
        const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const r = match[1];
            const g = match[2];
            const b = match[3];
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        return `rgba(255, 255, 255, ${opacity})`;
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

        // Track observer for cleanup
        this.registerObserver(observer);

        // Cleanup after 10 seconds
        this.registerTimer(setTimeout(() => observer.disconnect(), 10000), 'timeout');
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
     * Load messages from storage and build active messages list
     * @returns {Promise<void>}
     */
    async loadMessages() {
        return new Promise(async (resolve) => {
            chrome.storage.sync.get(['exlibris'], async (result) => {
                const messagesConfig = result.exlibris?.persistentBanner?.messages;

                if (!messagesConfig) {
                    this.activeMessages = [];
                    this.messageSettings = null;
                    resolve();
                    return;
                }

                this.messageSettings = messagesConfig;
                this.activeMessages = await this.getActiveMessages(messagesConfig);
                console.log(`[PersistentBanner] Loaded ${this.activeMessages.length} active messages`);
                resolve();
            });
        });
    },

    /**
     * Get combined list of enabled messages (default + custom)
     * Filters out messages marked as "noted" by the user
     * @param {Object} messagesConfig - Messages configuration object
     * @returns {Promise<Array>} Array of message objects with all properties
     */
    async getActiveMessages(messagesConfig) {
        const active = [];
        
        // Get noted messages from storage
        let notedMessages = {};
        try {
            const result = await chrome.storage.local.get(['exl_banner_noted_messages']);
            notedMessages = result.exl_banner_noted_messages || {};
        } catch (error) {
            Logger.error('[PersistentBanner] Error loading noted messages:', error);
        }

        // Add enabled default messages if default messages are enabled
        if (messagesConfig.defaultMessages?.enabled && messagesConfig.defaultMessages?.items) {
            messagesConfig.defaultMessages.items.forEach(msg => {
                // Skip if message is marked as "noted"
                if (notedMessages[msg.id]?.noted === true) {
                    return;
                }
                if (msg.enabled !== false && msg.text) {
                    active.push({
                        text: msg.text,
                        id: msg.id,
                        type: 'default',
                        hoverImage: msg.hoverImage || null,
                        description: msg.description || '',
                        pinnedCaseNumber: msg.pinnedCaseNumber || null,
                        pinnedCaseId: msg.pinnedCaseId || null,
                        pinnedCaseUrl: msg.pinnedCaseUrl || null
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
                        description: msg.description || '',
                        pinnedCaseNumber: msg.pinnedCaseNumber || null,
                        pinnedCaseId: msg.pinnedCaseId || null,
                        pinnedCaseUrl: msg.pinnedCaseUrl || null
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

        if (window.ExLibrisExtension.lastUrl !== null && window.ExLibrisExtension.lastUrl !== window.location.href) {
            this.stopMessageRotation(); // Clear any existing timer

            if (!this.messageSettings || !this.messageSettings.autoRotate) {
                return;
            }

            if (this.activeMessages.length <= 1) {
                return; // No need to rotate if only one or no messages
            }

            const interval = this.messageSettings.rotationInterval || 5000;

            this.messageRotationInterval = this.registerTimer(
                setInterval(() => {
                    this.rotateToNextMessage();
                }, interval),
                'interval'
            );

            console.log(`[PersistentBanner] Started message rotation (${interval}ms interval)`);
        }
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
     * @param {string} description - Optional description text to display below title
     * @param {boolean} showDescription - Whether to show the description (false in narrow mode)
     * @returns {string} HTML string for message display
     */
    renderMessage(messageText, description = null, showDescription = false) {
        if (!messageText) return '';

        // Split by newlines - no line limit (supports up to 4000 chars)
        const lines = messageText.split('\n');

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
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        let html = lines.map(line => {
            const escaped = escapeHtml(line.trim());
            return `<div class="${lineClass}">${escaped}</div>`;
        }).join('');

        // Add description if provided and not in narrow mode
        if (showDescription && description) {
            const truncatedDesc = description.length > 80 ? description.substring(0, 80) + '...' : description;
            const escapedDesc = escapeHtml(truncatedDesc);
            html += `<div class="message-description">${escapedDesc}</div>`;
        }

        return html;
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
            // Cleanup previous hover image listeners
            this.cleanupHoverImagePopup();

            // Check if we're in narrow mode (description should be hidden)
            const isNarrowMode = this.elements.messagesSection && 
                this.elements.messagesSection.classList.contains('narrow-mode');

            // Render message text with optional description (shown when not in narrow mode)
            this.elements.messageContent.innerHTML = this.renderMessage(
                currentMessage.text, 
                currentMessage.description, 
                !isNarrowMode
            );
            this.elements.messageIndex.textContent = `${this.currentMessageIndex + 1}/${this.activeMessages.length}`;

            // Setup hover image if available
            if (currentMessage.hoverImage) {
                this.setupHoverImage(
                    this.elements.messageContent,
                    currentMessage.hoverImage,
                    currentMessage.text
                );
            }

            // Store current message metadata for context menu
            this.currentDisplayedMessage = {
                id: currentMessage.id,
                text: currentMessage.text,
                hoverImage: currentMessage.hoverImage,
                description: currentMessage.description,
                pinnedCaseNumber: currentMessage.pinnedCaseNumber,
                pinnedCaseId: currentMessage.pinnedCaseId,
                pinnedCaseUrl: currentMessage.pinnedCaseUrl
            };

            // Attach context menu (right-click) handler
            const handleContextMenu = (e) => {
                this.showContextMenu(e, currentMessage.id);
            };
            this.registerListener(this.elements.messageContent, 'contextmenu', handleContextMenu);

            // Attach hover handlers for message preview popup
            const handleMouseEnter = (e) => {
                this.showMessageHoverPopup(currentMessage, e);
            };
            const handleMouseLeave = () => {
                this.hideMessageHoverPopup();
            };
            this.registerListener(this.elements.messageContent, 'mouseenter', handleMouseEnter);
            this.registerListener(this.elements.messageContent, 'mouseleave', handleMouseLeave);

            // Double-click to edit
            const handleDoubleClick = () => {
                this.showMessageEditPopup(currentMessage.id);
            };
            this.registerListener(this.elements.messageContent, 'dblclick', handleDoubleClick);
        }

        // Enable/disable navigation buttons
        if (this.elements.messagePrevBtn) {
            this.elements.messagePrevBtn.disabled = this.activeMessages.length <= 1;
        }
        if (this.elements.messageNextBtn) {
            this.elements.messageNextBtn.disabled = this.activeMessages.length <= 1;
        }

        // Update rotating sticky bar if there are rotating messages
        this.updateRotatingStickyBar();
    },

    /**
     * Check if should show messages (feature enabled + not case page/comments)
     * Explicitly excludes case pages and case comments - these pages have their own data
     * @returns {Promise<boolean>}
     */
    async shouldShowMessages() {
        // Check if feature is enabled
        const featureEnabled = await this.isBannerMessagesEnabled();
        if (!featureEnabled) {
            return false;
        }

        // Check if we have active messages
        if (this.activeMessages.length === 0) {
            return false;
        }

        // All checks passed - can show messages (including on case pages)
        return true;
    },

    /**
     * Clean up
     * Follows best practices: restore layout adjustments, proper cleanup order
     */
    cleanup() {
        // Restore Salesforce layout adjustments BEFORE removing banner
        // This prevents leaving an unpleasant gap
        this.applySalesforceLayoutAdjustments(false);

        // Stop polling
        this.stopDataPolling();

        // Clear data reception timeout
        if (this.dataReceptionTimeout) {
            clearTimeout(this.dataReceptionTimeout);
            this.dataReceptionTimeout = null;
        }

        // Stop periodic validation
        this.stopPeriodicValidation();

        this.stopUrlMonitoring();
        this.stopMessageRotation();
        this.stopRotatingStickyBar(); // Stop rotating sticky bar
        this.stopMetadataRotation(); // Stop metadata field rotation
        this.remove();

        // Close any open modals and dropdowns
        this.closeContextMenu();
        this.closeMessageDropdown();
        this.cleanupHoverImagePopup();
        this.closeMessageHoverPopup(); // Close message hover popup
        this.closeMessageEditPopup(); // Close message edit popup
        this.removeRotatingStickyBar(); // Remove rotating sticky bar
        if (this.editModal) this.editModal.remove();
        if (this.addImageModal) this.addImageModal.remove();
        if (this.viewImageModal) this.viewImageModal.remove();

        // Clean up all tracked resources (timers, listeners, observers)
        this.cleanupTrackedResources();

        // Remove storage change listener explicitly (in addition to tracked cleanup)
        if (this.storageChangeListener) {
            try {
                chrome.storage.onChanged.removeListener(this.storageChangeListener);
                this.storageChangeListener = null;
            } catch (error) {
                console.warn('[PersistentBanner] Error removing storage listener:', error);
            }
        }

        this.isInitialized = false;
        console.log('[PersistentBanner] Cleaned up');
    },

    /**
     * Populate environment buttons with Production and Sandbox links
     */
    populateEnvButtons() {
        if (!this.elements.envPopupContent) return;

        const { server, institutionCode, productServiceName } = this.customerMetadata;

        // Use institutionCode (not institutionId) for URLs
        if (!institutionCode) {
            console.warn('[PersistentBanner] Cannot populate env buttons - institutionCode not available');
            this.elements.envPopupContent.innerHTML = '<div class="exl-popup-menu-item" style="color: #999; cursor: default;">No environment data available</div>';
            this.environmentButtonsReady = false;
            this.updateEnvironmentButtonVisibility();
            return;
        }

        const buttonsHtml = [];

        // Production Back Office button
        buttonsHtml.push(`
            <button class="exl-popup-menu-item" 
                    data-env-url="https://${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true"
                    title="Open Production Back Office"
                    tabindex="0">
                <span class="exl-env-label">Prod</span> Back Office
            </button>
        `);

        // Production Live View button
        buttonsHtml.push(`
            <button class="exl-popup-menu-item" 
                    data-env-url="https://${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}"
                    title="Open Production Live View"
                    tabindex="0">
                <span class="exl-env-label">Prod</span> Live View
            </button>
        `);

        // SQA Environment buttons (always available)
        buttonsHtml.push(`
            <button class="exl-popup-menu-item" 
                    data-env-url="https://sqa-${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true"
                    title="Open SQA Back Office"
                    tabindex="0">
                <span class="exl-env-label">SQA</span> Back Office
            </button>
        `);

        buttonsHtml.push(`
            <button class="exl-popup-menu-item" 
                    data-env-url="https://sqa-${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}"
                    title="Open SQA Live View"
                    tabindex="0">
                <span class="exl-env-label">SQA</span> Live View
            </button>
        `);

        // Sandbox buttons - depends on product type
        if (productServiceName) {
            if (productServiceName.includes('esploro advanced')) {
                // Premium Sandbox Back Office
                buttonsHtml.push(`
                    <button class="exl-popup-menu-item" 
                            data-env-url="https://psb-${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true"
                            title="Open Premium Sandbox Back Office"
                            tabindex="0">
                        <span class="exl-env-label">PSB</span> Back Office
                    </button>
                `);

                // Premium Sandbox Live View
                buttonsHtml.push(`
                    <button class="exl-popup-menu-item" 
                            data-env-url="https://psb-${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}"
                            title="Open Premium Sandbox Live View"
                            tabindex="0">
                        <span class="exl-env-label">PSB</span> Live View
                    </button>
                `);
            } else if (productServiceName.includes('esploro standard')) {
                // Standard Sandbox Back Office
                buttonsHtml.push(`
                    <button class="exl-popup-menu-item" 
                            data-env-url="https://sb-${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true"
                            title="Open Sandbox Back Office"
                            tabindex="0">
                        <span class="exl-env-label">SB</span> Back Office
                    </button>
                `);

                // Standard Sandbox Live View
                buttonsHtml.push(`
                    <button class="exl-popup-menu-item" 
                            data-env-url="https://sb-${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}"
                            title="Open Sandbox Live View"
                            tabindex="0">
                        <span class="exl-env-label">SB</span> Live View
                    </button>
                `);
            }
        }

        this.elements.envPopupContent.innerHTML = buttonsHtml.join('');
        
        // Mark environment buttons as ready and update visibility
        this.environmentButtonsReady = true;
        this.updateEnvironmentButtonVisibility();
    },


    /**
     * Show popup menu
     * @param {string} popupType - 'tools' | 'wiki'
     * @param {HTMLElement} trigger - Button that triggered the popup
     */
    showPopupMenu(popupType, trigger) {
        // Hide any existing popup
        this.hidePopupMenu();

        let popup;
        if (popupType === 'tools') {
            popup = this.elements.toolsPopup;
        } else if (popupType === 'wiki') {
            popup = this.elements.wikiPopup;
        } else if (popupType === 'env') {
            popup = this.elements.envPopup;
            // Populate environment buttons when opening popup
            this.populateEnvButtons();
        } else {
            return;
        }

        if (!popup) return;

        // Get trigger button position
        const triggerRect = trigger.getBoundingClientRect();
        const bannerRect = this.elements.banner.getBoundingClientRect();

        // Position popup below the trigger button
        popup.style.position = 'fixed';
        popup.style.top = `${triggerRect.bottom + 4}px`;
        popup.style.left = `${triggerRect.left}px`;
        popup.style.display = 'block';
        popup.style.zIndex = '10000';

        this.activePopup = popupType;

        // Add click outside handler
        this.popupCloseHandler = (event) => {
            if (!popup.contains(event.target) && !trigger.contains(event.target)) {
                this.hidePopupMenu();
            }
        };

        // Use setTimeout to avoid immediate closure
        setTimeout(() => {
            document.addEventListener('click', this.popupCloseHandler, true);
        }, 0);
    },

    /**
     * Hide popup menu
     */
    hidePopupMenu() {
        if (this.elements.toolsPopup) {
            this.elements.toolsPopup.style.display = 'none';
        }
        if (this.elements.wikiPopup) {
            this.elements.wikiPopup.style.display = 'none';
        }
        if (this.elements.envPopup) {
            this.elements.envPopup.style.display = 'none';
        }

        if (this.popupCloseHandler) {
            document.removeEventListener('click', this.popupCloseHandler, true);
            this.popupCloseHandler = null;
        }

        this.activePopup = null;
    },

    /**
     * Populate Wiki Shortcuts popup with links from URLBuilder
     */
    populateWikiShortcuts() {
        if (!this.elements.wikiPopupContent) return;

        if (typeof URLBuilder === 'undefined' || typeof URLBuilder.getWikiLinks !== 'function') {
            console.warn('[PersistentBanner] URLBuilder.getWikiLinks not available');
            return;
        }

        const wikiLinks = URLBuilder.getWikiLinks();
        this.elements.wikiPopupContent.innerHTML = '';

        wikiLinks.forEach((link) => {
            const button = document.createElement('button');
            button.className = 'exl-popup-menu-item';
            button.textContent = link.label;
            button.title = link.url;
            button.setAttribute('tabindex', '0');
            button.addEventListener('click', () => {
                window.open(link.url, '_blank');
                this.hidePopupMenu();
            });
            this.elements.wikiPopupContent.appendChild(button);
        });
    },

    /**
     * Handle tool button click
     * @param {string} toolName - Name of the tool
     */
    async handleToolClick(toolName) {
        console.log('[PersistentBanner] Tool clicked:', toolName);

        // Execute tool actions directly (no focus mode)
        switch (toolName) {
            case 'customer-data':
                // Show customer data editor modal directly
                this.showCustomerDataEditorModal();
                break;
            case 'color-handler-settings':
                // Show color handler settings modal directly
                this.showColorHandlerSettingsModal();
                break;
            case 'timezone-inspector':
                // TODO: Implement timezone inspector
                console.log('[PersistentBanner] Timezone Inspector not yet implemented');
                break;
            case 'sql-wizard':
                // TODO: Implement SQL wizard
                console.log('[PersistentBanner] SQL Wizard not yet implemented');
                break;
            case 'text-formatter':
                // Text Formatter tool - uses TextFormatter module
                this.showTextFormatterModal();
                break;
            case 'message-manager':
                // Message Manager - shows edit messages panel
                this.showEditMessagesModal();
                break;
            default:
                console.warn('[PersistentBanner] Unknown tool:', toolName);
        }
    },

    /**
     * Get current case data for tools
     * @returns {Object|null}
     */
    getCurrentCaseData() {
        // Try to get from CaseDataStore first
        if (typeof CaseDataStore !== 'undefined' && CaseDataStore.getCurrentData) {
            const storeData = CaseDataStore.getCurrentData();
            if (storeData && storeData.data) {
                return storeData.data;
            }
        }

        // Fallback to displayed data
        return {
            caseId: this.displayedCaseId,
            caseNumber: this.displayedCaseNumber,
            subject: this.currentPage.subject,
            status: this.currentPage.status,
            subStatus: this.currentPage.subStatus,
            timezone: this.currentPage.timezone,
            instId: this.currentPage.instId,
            custId: this.currentPage.custId,
            ...this.customerMetadata
        };
    },

    /**
     * Show customer data editor modal (without focus mode)
     */
    showCustomerDataEditorModal() {
        // Remove any existing modal
        const existingModal = document.querySelector('.exl-tool-view[data-tool="customer-data"]');
        if (existingModal) {
            existingModal.remove();
        }

        // Create and append the modal
        const toolView = this.createCustomerDataEditorView();
        document.body.appendChild(toolView);
        toolView.style.display = 'block';

        // Add click-outside handler to close
        const clickOutsideHandler = (event) => {
            if (!toolView.contains(event.target) && !event.target.closest('.exl-popup-trigger') && !event.target.closest('.exl-customer-data-btn')) {
                toolView.remove();
                document.removeEventListener('click', clickOutsideHandler, true);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', clickOutsideHandler, true);
        }, 0);

        // Update back button to just close the modal
        const backBtn = toolView.querySelector('[data-action="exit-tool"]');
        if (backBtn) {
            backBtn.replaceWith(backBtn.cloneNode(true)); // Remove old listeners
            const newBackBtn = toolView.querySelector('[data-action="exit-tool"]');
            newBackBtn.addEventListener('click', () => {
                toolView.remove();
                document.removeEventListener('click', clickOutsideHandler, true);
            });
        }

        console.log('[PersistentBanner] Opened customer data editor modal');
    },

    /**
     * Show color handler settings modal (without focus mode)
     */
    async showColorHandlerSettingsModal() {
        // Remove any existing modal
        const existingModal = document.querySelector('.exl-tool-view[data-tool="color-handler-settings"]');
        if (existingModal) {
            existingModal.remove();
        }

        // Create and append the modal
        const toolView = await this.createColorHandlerSettingsView();
        document.body.appendChild(toolView);
        toolView.style.display = 'block';

        // Add click-outside handler to close
        const clickOutsideHandler = (event) => {
            if (!toolView.contains(event.target) && !event.target.closest('.exl-popup-trigger')) {
                toolView.remove();
                document.removeEventListener('click', clickOutsideHandler, true);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', clickOutsideHandler, true);
        }, 0);

        // Update back button to just close the modal
        const backBtn = toolView.querySelector('[data-action="exit-tool"]');
        if (backBtn) {
            backBtn.replaceWith(backBtn.cloneNode(true)); // Remove old listeners
            const newBackBtn = toolView.querySelector('[data-action="exit-tool"]');
            newBackBtn.addEventListener('click', () => {
                toolView.remove();
                document.removeEventListener('click', clickOutsideHandler, true);
            });
        }

        console.log('[PersistentBanner] Opened color handler settings modal');
    },

    /**
     * Enter action-focused mode for a tool
     * @param {string} toolName - Name of the tool
     * @param {Object} caseData - Case data to use
     */
    async enterActionFocusedMode(toolName, caseData) {
        if (!this.elements.banner) return;

        // Store original case data
        this.actionFocusedMode.active = true;
        this.actionFocusedMode.currentTool = toolName;
        this.actionFocusedMode.originalCaseId = caseData?.caseId || this.displayedCaseId;
        this.actionFocusedMode.originalCaseNumber = caseData?.caseNumber || this.displayedCaseNumber;
        this.actionFocusedMode.originalCaseData = caseData;

        // Add action-focused class to banner
        this.elements.banner.classList.add('action-focused');

        // Hide normal sections
        this.hideNormalSections();

        // Show tool view (await async tool view creation)
        await this.renderActionFocusedView(toolName);

        console.log('[PersistentBanner] Entered action-focused mode for:', toolName);
    },

    /**
     * Exit action-focused mode
     */
    exitActionFocusedMode() {
        if (!this.elements.banner) return;

        // Remove action-focused class
        this.elements.banner.classList.remove('action-focused');
        this.elements.banner.classList.remove('exl-banner-stale-warning');

        // Clear state
        this.actionFocusedMode.active = false;
        this.actionFocusedMode.currentTool = null;
        this.actionFocusedMode.originalCaseId = null;
        this.actionFocusedMode.originalCaseNumber = null;
        this.actionFocusedMode.originalCaseData = null;

        // Remove click-outside handler
        if (this.toolViewClickOutsideHandler) {
            document.removeEventListener('click', this.toolViewClickOutsideHandler, true);
            this.toolViewClickOutsideHandler = null;
        }

        // Hide tool views (search in body, not just banner)
        const toolViews = document.querySelectorAll('.exl-tool-view');
        toolViews.forEach(view => {
            view.style.display = 'none';
            // Remove from DOM if it's a modal overlay (appended to body)
            if (view.parentElement === document.body) {
                view.remove();
            }
        });

        // Show normal sections
        this.showNormalSections();

        console.log('[PersistentBanner] Exited action-focused mode');
    },

    /**
     * Hide normal banner sections when in action-focused mode
     */
    hideNormalSections() {
        const sectionsToHide = [
            '#exl-banner-page-type',
            '#exl-banner-subject',
            '#exl-banner-status',
            '#exl-banner-actions',
            '#exl-banner-history',
            '#exl-banner-messages',
            '#exl-banner-metadata-section'
        ];

        sectionsToHide.forEach(selector => {
            const element = this.elements.banner.querySelector(selector);
            if (element) {
                element.style.display = 'none';
            }
        });
    },

    /**
     * Show normal banner sections after exiting action-focused mode
     */
    showNormalSections() {
        const sectionsToShow = [
            { selector: '#exl-banner-page-type', display: 'block' },
            { selector: '#exl-banner-subject', display: 'block' },
            { selector: '#exl-banner-status', display: 'block' },
            { selector: '#exl-banner-actions', display: 'flex' },
            { selector: '#exl-banner-history', display: 'block' },
            { selector: '#exl-banner-messages', display: 'block' },
            { selector: '#exl-banner-metadata-section', display: 'block' }
        ];

        sectionsToShow.forEach(({ selector, display }) => {
            const element = this.elements.banner.querySelector(selector);
            if (element) {
                element.style.display = display;
            }
        });

        if (this.envMenuVisible && this.elements.envSection) {
            this.elements.envSection.style.display = 'flex';
        }
    },

    /**
     * Render action-focused view for a tool
     * @param {string} toolName - Name of the tool
     */
    async renderActionFocusedView(toolName) {
        if (!this.elements.banner) return;

        // Hide all tool views first (search in body, not just banner)
        const toolViews = document.querySelectorAll('.exl-tool-view');
        toolViews.forEach(view => view.style.display = 'none');

        // Find or create tool view (search in body)
        let toolView = document.querySelector(`.exl-tool-view[data-tool="${toolName}"]`);

        if (!toolView) {
            // Create tool view based on tool name
            if (toolName === 'customer-data') {
                toolView = this.createCustomerDataEditorView();
            } else if (toolName === 'color-handler-settings') {
                // createColorHandlerSettingsView is async, must await
                toolView = await this.createColorHandlerSettingsView();
            } else {
                toolView = this.createToolViewPlaceholder(toolName);
            }
            // Append to document body instead of banner to avoid height constraints
            document.body.appendChild(toolView);
        }

        // Show the tool view
        toolView.style.display = 'block';

        // Add click-outside handler to close overlay
        this.toolViewClickOutsideHandler = (event) => {
            if (!toolView.contains(event.target) && !event.target.closest('.exl-popup-trigger')) {
                // Close if clicking outside the tool view (but not on popup triggers)
                this.exitActionFocusedMode();
                this.updateBannerUI(); //AMIR amir 
            }
        };
        // Use setTimeout to avoid immediate closure
        setTimeout(() => {
            document.addEventListener('click', this.toolViewClickOutsideHandler, true);
        }, 0);
    },

    /**
     * Create placeholder tool view
     * @param {string} toolName - Name of the tool
     * @returns {HTMLElement}
     */
    createToolViewPlaceholder(toolName) {
        const toolView = document.createElement('div');
        toolView.className = 'exl-tool-view';
        toolView.setAttribute('data-tool', toolName);

        const toolLabels = {
            'timezone-inspector': 'Timezone Inspector',
            'sql-wizard': 'SQL Wizard',
            'customer-data': 'Add/Modify Customer Data'
        };

        toolView.innerHTML = `
            <div class="exl-tool-header">
                <h3>${toolLabels[toolName] || toolName}</h3>
                <button class="exl-back-btn" data-action="exit-tool">← Back</button>
            </div>
            <div class="exl-tool-content">
                <p>${toolLabels[toolName] || toolName} tool - specifications to be provided</p>
                <!-- Placeholder for future implementation -->
            </div>
        `;

        // Add back button handler
        const backBtn = toolView.querySelector('[data-action="exit-tool"]');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.exitActionFocusedMode();
                this.updateBannerUI(); //AMIR amir 
            });
        }

        return toolView;
    },

    /**
     * Create customer data editor view
     * @returns {HTMLElement}
     */
    createCustomerDataEditorView() {
        const toolView = document.createElement('div');
        toolView.className = 'exl-tool-view exl-customer-data-editor';
        toolView.setAttribute('data-tool', 'customer-data');

        // Get current case data
        const caseData = this.getCurrentCaseData();
        const caseNumber = caseData?.caseNumber || this.displayedCaseNumber || '—';
        const subject = caseData?.subject || this.currentPage.subject || '—';
        const accountName = caseData?.accountName || '—';
        const exLibrisAccountNumber = caseData?.exLibrisAccountNumber || this.customerMetadata.institutionCode || '—';

        // Get current customer data (from UserCustomerDataManager or CustomerMasterManager)
        let customerData = null;
        if (typeof UserCustomerDataManager !== 'undefined' && exLibrisAccountNumber && exLibrisAccountNumber !== '—') {
            customerData = UserCustomerDataManager.findByInstitutionCode(exLibrisAccountNumber, accountName);
        }
        if (!customerData && typeof CustomerMasterManager !== 'undefined' && exLibrisAccountNumber && exLibrisAccountNumber !== '—') {
            customerData = CustomerMasterManager.findByInstitutionCode(exLibrisAccountNumber, accountName);
        }

        // Merge with current metadata
        const currentData = {
            institutionCode: exLibrisAccountNumber !== '—' ? exLibrisAccountNumber : (customerData?.institutionCode || ''),
            custID: this.customerMetadata.customerId || customerData?.custID || '',
            instID: this.customerMetadata.institutionId || customerData?.instID || '',
            server: this.customerMetadata.server || customerData?.server || '',
            name: accountName !== '—' ? accountName : (customerData?.name || ''),
            portalCustomDomain: customerData?.portalCustomDomain || '',
            prefix: customerData?.prefix || '',
            status: customerData?.status || '',
            esploroEdition: customerData?.esploroEdition || '',
            sandboxEdition: customerData?.sandboxEdition || '',
            hasScopus: customerData?.hasScopus || '',
            comments: customerData?.comments || ''
        };

        toolView.innerHTML = `
            <div class="exl-tool-view-content-wrapper">
                <div class="exl-tool-header">
                    <h3>Add/Modify Customer Data</h3>
                    <div class="exl-tool-header-actions">
                        <button class="exl-banner-btn exl-export-btn" id="exl-customer-data-export" title="Export customer list">Export List</button>
                        <button class="exl-banner-btn exl-import-btn" id="exl-customer-data-import" title="Import customer list">Import List</button>
                        <button class="exl-back-btn" data-action="exit-tool">← Back</button>
                    </div>
                </div>
                <div class="exl-tool-content">
                <div class="exl-customer-data-section">
                    <h4>Case Information (Read-Only)</h4>
                    <div class="exl-customer-data-readonly">
                        <div class="exl-field-row">
                            <span class="exl-field-label">Case Number:</span>
                            <span class="exl-field-value">${caseNumber}</span>
                        </div>
                        <div class="exl-field-row">
                            <span class="exl-field-label">Subject:</span>
                            <span class="exl-field-value">${subject}</span>
                        </div>
                        <div class="exl-field-row">
                            <span class="exl-field-label">Account Name:</span>
                            <span class="exl-field-value">${accountName}</span>
                        </div>
                        <div class="exl-field-row">
                            <span class="exl-field-label">Ex Libris Account Number:</span>
                            <span class="exl-field-value">${exLibrisAccountNumber}</span>
                        </div>
                    </div>
                </div>
                <div class="exl-customer-data-section">
                    <h4>Customer Metadata (Editable)</h4>
                    <div class="exl-customer-data-fields" id="exl-customer-data-fields">
                        ${this.createEditableField('institutionCode', 'Institution Code', currentData.institutionCode, true)}
                        ${this.createEditableField('custID', 'Customer ID', currentData.custID, true)}
                        ${this.createEditableField('instID', 'Institution ID', currentData.instID, true)}
                        ${this.createEditableField('server', 'Server', currentData.server, true)}
                        ${this.createEditableField('name', 'Name', currentData.name, false)}
                        ${this.createEditableField('portalCustomDomain', 'Portal Custom Domain', currentData.portalCustomDomain, false)}
                        ${this.createEditableField('prefix', 'Prefix', currentData.prefix, false)}
                        ${this.createEditableField('status', 'Status', currentData.status, false)}
                        ${this.createEditableField('esploroEdition', 'Esploro Edition', currentData.esploroEdition, false)}
                        ${this.createEditableField('sandboxEdition', 'Sandbox Edition', currentData.sandboxEdition, false)}
                        ${this.createEditableField('hasScopus', 'Has Scopus', currentData.hasScopus, false)}
                        ${this.createEditableField('comments', 'Comments', currentData.comments, false)}
                    </div>
                    <div class="exl-customer-data-actions">
                        <button class="exl-banner-btn exl-save-btn" id="exl-customer-data-save">Save Customer</button>
                    </div>
                </div>
            </div>
            </div>
        `;

        // Wire up event handlers
        this.wireCustomerDataEditorEvents(toolView, currentData);

        return toolView;
    },

    /**
     * Create editable field HTML
     * @param {string} fieldName - Field name
     * @param {string} label - Field label
     * @param {string} value - Current value
     * @param {boolean} isRequired - Whether field is required
     * @returns {string} HTML string
     */
    createEditableField(fieldName, label, value, isRequired) {
        const displayValue = value || '—';
        const requiredClass = isRequired ? 'exl-field-required' : '';
        const requiredIndicator = isRequired ? ' <span class="exl-required-indicator">*</span>' : '';

        return `
            <div class="exl-editable-field ${requiredClass}" data-field="${fieldName}">
                <span class="exl-field-label">${label}:${requiredIndicator}</span>
                <div class="exl-field-display" data-field-display="${fieldName}">${displayValue}</div>
                <div class="exl-field-edit" data-field-edit="${fieldName}" style="display: none;">
                    <input type="text" class="exl-field-input" data-field-input="${fieldName}" value="${value || ''}" placeholder="Enter ${label.toLowerCase()}">
                    <button class="exl-field-save-btn" data-field-save="${fieldName}">Save</button>
                </div>
            </div>
        `;
    },

    /**
     * Wire up event handlers for customer data editor
     * @param {HTMLElement} toolView - Tool view element
     * @param {Object} initialData - Initial customer data
     */
    wireCustomerDataEditorEvents(toolView, initialData) {
        // Back button - just closes the modal
        const backBtn = toolView.querySelector('[data-action="exit-tool"]');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                toolView.remove();
            });
        }

        // Editable fields - click to edit
        const fieldDisplays = toolView.querySelectorAll('[data-field-display]');
        fieldDisplays.forEach(display => {
            display.addEventListener('click', () => {
                const fieldName = display.dataset.fieldDisplay;
                this.showFieldEditor(toolView, fieldName);
            });
        });

        // Save buttons for individual fields
        const fieldSaveBtns = toolView.querySelectorAll('[data-field-save]');
        fieldSaveBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const fieldName = btn.dataset.fieldSave;
                this.saveFieldValue(toolView, fieldName);
            });
        });

        // Input blur to save
        const fieldInputs = toolView.querySelectorAll('[data-field-input]');
        fieldInputs.forEach(input => {
            input.addEventListener('blur', () => {
                const fieldName = input.dataset.fieldInput;
                this.saveFieldValue(toolView, fieldName);
            });
        });

        // Save Customer button
        const saveBtn = toolView.querySelector('#exl-customer-data-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveCustomerData(toolView);
            });
        }

        // Export button
        const exportBtn = toolView.querySelector('#exl-customer-data-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportCustomerList();
            });
        }

        // Import button
        const importBtn = toolView.querySelector('#exl-customer-data-import');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.importCustomerList();
            });
        }
    },

    /**
     * Show field editor
     * @param {HTMLElement} toolView - Tool view element
     * @param {string} fieldName - Field name
     */
    showFieldEditor(toolView, fieldName) {
        const display = toolView.querySelector(`[data-field-display="${fieldName}"]`);
        const edit = toolView.querySelector(`[data-field-edit="${fieldName}"]`);
        const input = toolView.querySelector(`[data-field-input="${fieldName}"]`);

        if (display && edit && input) {
            display.style.display = 'none';
            edit.style.display = 'flex';
            // Force display with important via inline style
            edit.setAttribute('style', 'display: flex !important; align-items: center; gap: 8px; flex: 1;');
            input.focus();
            input.select();
        }
    },

    /**
     * Save field value
     * @param {HTMLElement} toolView - Tool view element
     * @param {string} fieldName - Field name
     */
    saveFieldValue(toolView, fieldName) {
        const display = toolView.querySelector(`[data-field-display="${fieldName}"]`);
        const edit = toolView.querySelector(`[data-field-edit="${fieldName}"]`);
        const input = toolView.querySelector(`[data-field-input="${fieldName}"]`);

        if (display && edit && input) {
            const newValue = input.value.trim();
            display.textContent = newValue || '—';
            display.style.display = 'block';
            // Hide edit mode
            edit.setAttribute('style', 'display: none !important;');
            // Update input value for later collection
            input.value = newValue;
        }
    },

    /**
     * Save customer data
     * @param {HTMLElement} toolView - Tool view element
     */
    async saveCustomerData(toolView) {
        if (typeof UserCustomerDataManager === 'undefined') {
            console.error('[PersistentBanner] UserCustomerDataManager not available');
            alert('Customer data manager not available. Please refresh the page.');
            return;
        }

        // Collect all field values (from inputs if visible, or from display if hidden)
        const customerData = {};
        const fieldInputs = toolView.querySelectorAll('[data-field-input]');
        fieldInputs.forEach(input => {
            const fieldName = input.dataset.fieldInput;
            // Get value from input (it may be hidden but value is preserved)
            let value = input.value.trim();

            // If input is hidden and empty, check the display element
            if (!value) {
                const display = toolView.querySelector(`[data-field-display="${fieldName}"]`);
                if (display && display.textContent !== '—') {
                    value = display.textContent.trim();
                }
            }

            if (value) {
                customerData[fieldName] = value;
            }
        });

        // Validate required fields
        if (!customerData.institutionCode) {
            alert('Institution Code is required.');
            return;
        }

        try {
            // Check if customer already exists
            const existing = UserCustomerDataManager.findByInstitutionCode(customerData.institutionCode);

            if (existing) {
                // Update existing
                await UserCustomerDataManager.update(customerData.institutionCode, customerData);
                console.log('[PersistentBanner] Updated customer:', customerData.institutionCode);
            } else {
                // Add new
                await UserCustomerDataManager.add(customerData);
                console.log('[PersistentBanner] Added customer:', customerData.institutionCode);
            }

            // Update customer metadata in banner
            this.customerMetadata.customerId = customerData.custID || this.customerMetadata.customerId;
            this.customerMetadata.institutionId = customerData.instID || this.customerMetadata.institutionId;
            this.customerMetadata.server = customerData.server || this.customerMetadata.server;
            this.customerMetadata.institutionCode = customerData.institutionCode || this.customerMetadata.institutionCode;

            // Refresh banner UI
            this.updateBannerUI();

            // Show success message
            alert('Customer data saved successfully!');
        } catch (error) {
            console.error('[PersistentBanner] Error saving customer data:', error);
            alert('Error saving customer data: ' + error.message);
        }
    },

    /**
     * Export customer list
     */
    exportCustomerList() {
        if (typeof UserCustomerDataManager === 'undefined') {
            console.error('[PersistentBanner] UserCustomerDataManager not available');
            alert('Customer data manager not available.');
            return;
        }

        try {
            const jsonData = UserCustomerDataManager.export();
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `user-customer-list-${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('[PersistentBanner] Exported customer list');
        } catch (error) {
            console.error('[PersistentBanner] Error exporting customer list:', error);
            alert('Error exporting customer list: ' + error.message);
        }
    },

    /**
     * Import customer list
     */
    importCustomerList() {
        if (typeof UserCustomerDataManager === 'undefined') {
            console.error('[PersistentBanner] UserCustomerDataManager not available');
            alert('Customer data manager not available.');
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const jsonData = JSON.parse(text);

                // Confirm import
                const overwrite = confirm('Import customer list? This will merge with existing data. Click OK to merge, or Cancel to cancel.');
                if (!overwrite) return;

                const result = await UserCustomerDataManager.import(jsonData, { overwrite: false });
                alert(`Import complete: ${result.valid} valid customers (${result.added} added, ${result.updated} updated)`);

                // Refresh banner UI
                this.updateBannerUI();
            } catch (error) {
                console.error('[PersistentBanner] Error importing customer list:', error);
                alert('Error importing customer list: ' + error.message);
            }
        };
        input.click();
    },

    /**
     * Show stale data warning when case changes in action-focused mode
     * @param {string} currentCaseNumber - Current case number
     */
    showStaleDataWarning(currentCaseNumber) {
        if (!this.elements.banner || !this.actionFocusedMode.active) return;

        const toolLabels = {
            'timezone-inspector': 'Timezone Inspector',
            'sql-wizard': 'SQL Wizard',
            'customer-data': 'Add/Modify Customer Data'
        };

        const toolName = toolLabels[this.actionFocusedMode.currentTool] || this.actionFocusedMode.currentTool;
        const originalCaseNumber = this.actionFocusedMode.originalCaseNumber;

        // Add warning class to banner
        this.elements.banner.classList.add('exl-banner-stale-warning');

        // Find or create warning message element
        let warningEl = this.elements.banner.querySelector('.exl-stale-warning-message');
        if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.className = 'exl-stale-warning-message';
            const toolView = this.elements.banner.querySelector('.exl-tool-view[style*="block"]');
            if (toolView) {
                toolView.insertBefore(warningEl, toolView.firstChild);
            } else {
                this.elements.banner.insertBefore(warningEl, this.elements.banner.firstChild);
            }
        }

        warningEl.textContent = `${toolName} is using data from case #${originalCaseNumber}. Please return to banner homepage to use data from currently viewed case #${currentCaseNumber}.`;
        warningEl.style.display = 'block';

        console.warn(`[PersistentBanner] Stale data warning: ${toolName} using case #${originalCaseNumber}, current case #${currentCaseNumber}`);
    },

    // =================================================================
    // COLOR HANDLER SETTINGS
    // =================================================================

    /**
     * Create color handler settings view
     * @returns {HTMLElement}
     */
    async createColorHandlerSettingsView() {
        const toolView = document.createElement('div');
        toolView.className = 'exl-tool-view exl-color-handler-settings';
        toolView.setAttribute('data-tool', 'color-handler-settings');

        // Load current configuration
        let config = {};
        if (typeof ColorHandlerConfig !== 'undefined') {
            config = await ColorHandlerConfig.loadConfig();
        } else {
            console.warn('[PersistentBanner] ColorHandlerConfig not available');
            config = {
                handleStatus: { statusGroups: {}, groupColors: {}, statusOverrides: {} },
                handleAnchor: { clarivateEmail: {}, nonClarivateEmail: {}, endNoteSupport: {} },
                handleCase: { thresholds: [] }
            };
        }

        toolView.innerHTML = `
            <div class="exl-tool-header">
                <h3>Color Handler Settings</h3>
                <div class="exl-tool-header-actions">
                    <button class="exl-banner-btn exl-reset-btn" id="exl-color-handler-reset" title="Reset all colors to defaults">Reset to Defaults</button>
                    <button class="exl-back-btn" data-action="exit-tool">← Back</button>
                </div>
            </div>
            <div class="exl-tool-content">
                <div class="exl-color-handler-section" id="exl-color-handler-status-section">
                    <h4>Status Highlighting</h4>
                    <div class="exl-status-groups" id="exl-status-groups">
                        ${this.renderStatusGroups(config.handleStatus)}
                    </div>
                </div>
                <div class="exl-color-handler-section" id="exl-color-handler-anchor-section">
                    <h4>Email Anchor Highlighting</h4>
                    <div class="exl-anchor-colors" id="exl-anchor-colors">
                        ${this.renderAnchorColors(config.handleAnchor)}
                    </div>
                </div>
                <div class="exl-color-handler-section" id="exl-color-handler-case-section">
                    <h4>Case Row Highlighting (Time-Based)</h4>
                    <div class="exl-case-thresholds" id="exl-case-thresholds">
                        ${this.renderCaseThresholds(config.handleCase)}
                    </div>
                </div>
            </div>
        `;

        // Wire up event handlers
        this.wireColorHandlerSettingsEvents(toolView, config);

        return toolView;
    },

    /**
     * Render status groups HTML
     * @param {Object} statusConfig - Status configuration
     * @returns {string} HTML string
     */
    renderStatusGroups(statusConfig) {
        const groups = ['URGENT', 'IMMEDIATE', 'ONGOING', 'IDLE', 'MONITOR', 'COMPLETED'];
        const defaultConfig = typeof ColorHandlerConfig !== 'undefined' ? ColorHandlerConfig.getDefaultConfig() : null;
        const defaultStatusGroups = defaultConfig ? defaultConfig.handleStatus.statusGroups : {};

        return groups.map(group => {
            const groupColors = statusConfig.groupColors[group] || { bg: 'rgb(128, 128, 128)', text: 'rgb(255, 255, 255)' };
            const statuses = statusConfig.statusGroups[group] || defaultStatusGroups[group] || [];

            return `
                <div class="exl-status-group" data-group="${group}">
                    <div class="exl-group-header">
                        <span class="exl-group-name">${group}</span>
                        <div class="exl-color-preview-wrapper">
                            <div class="exl-color-preview" style="background-color: ${groupColors.bg}; color: ${groupColors.text};" data-preview-group="${group}">Preview</div>
                            <button class="exl-edit-color-btn" data-edit-group-bg="${group}" title="Edit background color">Edit BG</button>
                            <button class="exl-edit-color-btn" data-edit-group-text="${group}" title="Edit text color">Edit Text</button>
                        </div>
                    </div>
                    <div class="exl-status-list">
                        ${statuses.map(status => `<span class="exl-status-item" data-status="${status}">${status}</span>`).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Render anchor colors HTML
     * @param {Object} anchorConfig - Anchor configuration
     * @returns {string} HTML string
     */
    renderAnchorColors(anchorConfig) {
        const defaultConfig = typeof ColorHandlerConfig !== 'undefined' ? ColorHandlerConfig.getDefaultConfig() : null;
        const defaultAnchor = defaultConfig ? defaultConfig.handleAnchor : {};

        return `
            <div class="exl-anchor-color-item" data-anchor-type="clarivateEmail">
                <span class="exl-anchor-label">Clarivate Email</span>
                <div class="exl-color-preview-wrapper">
                    <div class="exl-color-preview" style="background-color: ${anchorConfig.clarivateEmail?.bg || defaultAnchor.clarivateEmail?.bg || '#ffe8b5'};" data-preview-anchor="clarivateEmail-bg">Preview</div>
                    <button class="exl-edit-color-btn" data-edit-anchor-bg="clarivateEmail" title="Edit background color">Edit BG</button>
                    <button class="exl-edit-color-btn" data-edit-anchor-text="clarivateEmail" title="Edit text color">Edit Text</button>
                </div>
            </div>
            <div class="exl-anchor-color-item" data-anchor-type="nonClarivateEmail">
                <span class="exl-anchor-label">Non-Clarivate Email</span>
                <div class="exl-color-preview-wrapper">
                    <div class="exl-color-preview" style="background-color: ${anchorConfig.nonClarivateEmail?.bg || defaultAnchor.nonClarivateEmail?.bg || '#ffdac8'};" data-preview-anchor="nonClarivateEmail-bg">Preview</div>
                    <button class="exl-edit-color-btn" data-edit-anchor-bg="nonClarivateEmail" title="Edit background color">Edit BG</button>
                    <button class="exl-edit-color-btn" data-edit-anchor-text="nonClarivateEmail" title="Edit text color">Edit Text</button>
                </div>
            </div>
        `;
    },

    /**
     * Render case thresholds HTML
     * @param {Object} caseConfig - Case configuration
     * @returns {string} HTML string
     */
    renderCaseThresholds(caseConfig) {
        const thresholds = caseConfig.thresholds || [];
        const defaultConfig = typeof ColorHandlerConfig !== 'undefined' ? ColorHandlerConfig.getDefaultConfig() : null;
        const defaultThresholds = defaultConfig ? defaultConfig.handleCase.thresholds : [];

        const thresholdsToRender = thresholds.length > 0 ? thresholds : defaultThresholds;

        return thresholdsToRender.map((threshold, index) => `
            <div class="exl-case-threshold-item" data-threshold-index="${index}">
                <span class="exl-threshold-label">${threshold.label}</span>
                <div class="exl-color-preview-wrapper">
                    <div class="exl-color-preview" style="background-color: ${threshold.color};" data-preview-threshold="${index}">Preview</div>
                    <button class="exl-edit-color-btn" data-edit-threshold="${index}" title="Edit color">Edit Color</button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Wire up event handlers for color handler settings
     * @param {HTMLElement} toolView - Tool view element
     * @param {Object} config - Current configuration
     */
    wireColorHandlerSettingsEvents(toolView, config) {
        // Back button - just closes the modal
        const backBtn = toolView.querySelector('[data-action="exit-tool"]');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                toolView.remove();
            });
        }

        // Reset to defaults button
        const resetBtn = toolView.querySelector('#exl-color-handler-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                if (confirm('Reset all color configurations to defaults? This cannot be undone.')) {
                    if (typeof ColorHandlerConfig !== 'undefined') {
                        await ColorHandlerConfig.resetToDefaults();
                        this.showNotification('Color settings reset to defaults', 'success');
                        // Reload the modal
                        toolView.remove();
                        this.showColorHandlerSettingsModal();
                    }
                }
            });
        }

        // Status group color edit buttons
        toolView.querySelectorAll('[data-edit-group-bg], [data-edit-group-text]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const isBg = btn.hasAttribute('data-edit-group-bg');
                const group = isBg ? btn.dataset.editGroupBg : btn.dataset.editGroupText;
                const currentColor = config.handleStatus.groupColors[group] || {};
                const colorType = isBg ? 'bg' : 'text';
                const currentColorValue = currentColor[colorType] || (isBg ? 'rgb(128, 128, 128)' : 'rgb(255, 255, 255)');

                const selectedColor = await this.showColorPickerModal({ currentColor: currentColorValue });
                if (selectedColor) {
                    if (typeof ColorHandlerConfig !== 'undefined') {
                        const updatedConfig = await ColorHandlerConfig.loadConfig();
                        if (!updatedConfig.handleStatus.groupColors[group]) {
                            updatedConfig.handleStatus.groupColors[group] = {};
                        }
                        updatedConfig.handleStatus.groupColors[group][colorType] = selectedColor;
                        await ColorHandlerConfig.saveConfig(updatedConfig);
                        this.showNotification('Color updated', 'success');
                        // Update preview
                        const preview = toolView.querySelector(`[data-preview-group="${group}"]`);
                        if (preview) {
                            if (colorType === 'bg') {
                                preview.style.backgroundColor = selectedColor;
                            } else {
                                preview.style.color = selectedColor;
                            }
                        }
                        // Trigger re-highlighting if on case list page
                        this.triggerColorRefresh();
                    }
                }
            });
        });

        // Anchor color edit buttons
        toolView.querySelectorAll('[data-edit-anchor-bg], [data-edit-anchor-text]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const isBg = btn.hasAttribute('data-edit-anchor-bg');
                const anchorType = isBg ? btn.dataset.editAnchorBg : btn.dataset.editAnchorText;
                const colorType = isBg ? 'bg' : 'text';
                const currentColor = config.handleAnchor[anchorType] || {};
                const currentColorValue = currentColor[colorType] || (isBg ? '#ffffff' : 'rgb(0, 0, 0)');

                const selectedColor = await this.showColorPickerModal({ currentColor: currentColorValue });
                if (selectedColor) {
                    if (typeof ColorHandlerConfig !== 'undefined') {
                        const updatedConfig = await ColorHandlerConfig.loadConfig();
                        updatedConfig.handleAnchor[anchorType] = updatedConfig.handleAnchor[anchorType] || {};
                        updatedConfig.handleAnchor[anchorType][colorType] = selectedColor;
                        await ColorHandlerConfig.saveConfig(updatedConfig);
                        this.showNotification('Color updated', 'success');
                        // Update preview
                        const preview = toolView.querySelector(`[data-preview-anchor="${anchorType}-bg"]`);
                        if (preview && colorType === 'bg') {
                            preview.style.backgroundColor = selectedColor;
                        }
                        // Trigger re-highlighting
                        this.triggerColorRefresh();
                    }
                }
            });
        });

        // Case threshold color edit buttons
        toolView.querySelectorAll('[data-edit-threshold]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const thresholdIndex = parseInt(btn.dataset.editThreshold);
                const thresholds = config.handleCase.thresholds || [];
                const threshold = thresholds[thresholdIndex];
                if (!threshold) return;

                const selectedColor = await this.showColorPickerModal({ currentColor: threshold.color });
                if (selectedColor) {
                    if (typeof ColorHandlerConfig !== 'undefined') {
                        const updatedConfig = await ColorHandlerConfig.loadConfig();
                        updatedConfig.handleCase.thresholds[thresholdIndex].color = selectedColor;
                        await ColorHandlerConfig.saveConfig(updatedConfig);
                        this.showNotification('Color updated', 'success');
                        // Update preview
                        const preview = toolView.querySelector(`[data-preview-threshold="${thresholdIndex}"]`);
                        if (preview) {
                            preview.style.backgroundColor = selectedColor;
                        }
                        // Trigger re-highlighting if on case list page
                        this.triggerColorRefresh();
                    }
                }
            });
        });
    },

    /**
     * Show color picker modal
     * @param {Object} options - Options for color picker
     * @param {string} options.currentColor - Current color in RGB format
     * @returns {Promise<string|null>} Selected color or null if cancelled
     */
    showColorPickerModal(options = {}) {
        return new Promise((resolve) => {
            const { currentColor = 'rgb(128, 128, 128)' } = options;

            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'exl-color-picker-modal-overlay';
            overlay.id = 'exl-color-picker-modal-overlay';

            // Create modal container
            const modal = document.createElement('div');
            modal.className = 'exl-color-picker-modal';
            modal.innerHTML = `
                <div class="exl-modal-header">
                    <h3>Select Color</h3>
                    <button class="exl-modal-close" id="exl-color-picker-close">×</button>
                </div>
                <div class="exl-modal-content" id="exl-color-picker-content">
                    <!-- Color picker will be rendered here -->
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Initialize color picker
            let selectedColor = currentColor;
            if (typeof ColorPicker3D !== 'undefined') {
                const containerId = 'exl-color-picker-content';
                modal.querySelector('#exl-color-picker-content').id = 'exl-color-picker-container';
                ColorPicker3D.create('exl-color-picker-container', {
                    currentColor: currentColor,
                    onColorChange: (color) => {
                        selectedColor = color;
                    },
                    onApply: () => {
                        overlay.remove();
                        resolve(selectedColor);
                    },
                    onCancel: () => {
                        overlay.remove();
                        resolve(null);
                    }
                });
            } else {
                // Fallback simple color input
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = this.rgbToHex(currentColor);
                modal.querySelector('#exl-color-picker-content').appendChild(colorInput);
                const applyBtn = document.createElement('button');
                applyBtn.textContent = 'Apply';
                applyBtn.className = 'exl-btn-apply';
                applyBtn.addEventListener('click', () => {
                    overlay.remove();
                    resolve(this.hexToRgb(colorInput.value));
                });
                modal.querySelector('#exl-color-picker-content').appendChild(applyBtn);
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Cancel';
                cancelBtn.className = 'exl-btn-cancel';
                cancelBtn.addEventListener('click', () => {
                    overlay.remove();
                    resolve(null);
                });
                modal.querySelector('#exl-color-picker-content').appendChild(cancelBtn);
            }

            // Close button
            modal.querySelector('#exl-color-picker-close').addEventListener('click', () => {
                overlay.remove();
                resolve(null);
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    resolve(null);
                }
            });
        });
    },

    // ================================================
    // MESSAGE HOVER POPUP
    // ================================================

    /**
     * Show hover popup with message preview
     * @param {Object} message - The message object
     * @param {MouseEvent} event - The mouse event
     */
    showMessageHoverPopup(message, event) {
        if (!message) return;

        // Clear any existing timeout
        if (this.messageHoverTimeout) {
            clearTimeout(this.messageHoverTimeout);
            this.messageHoverTimeout = null;
        }

        // Create popup if not exists
        if (!this.messageHoverPopup) {
            this.messageHoverPopup = document.createElement('div');
            this.messageHoverPopup.className = 'exl-message-hover-popup';
            document.body.appendChild(this.messageHoverPopup);
        }

        // Build popup content
        let popupHtml = '';
        
        // Subject/title
        if (message.text) {
            popupHtml += `<div class="message-preview-title">${this.escapedHtml(message.text)}</div>`;
        }
        
        // Description - handle both string and structured object formats
        if (message.description) {
            if (typeof message.description === 'object') {
                // Structured description with what/how/where/scope
                popupHtml += '<div class="message-preview-details">';
                if (message.description.what) {
                    popupHtml += `<div class="message-detail-item"><span class="message-detail-label">What:</span> ${this.escapedHtml(message.description.what)}</div>`;
                }
                if (message.description.how) {
                    popupHtml += `<div class="message-detail-item"><span class="message-detail-label">How:</span> ${this.escapedHtml(message.description.how)}</div>`;
                }
                if (message.description.where) {
                    popupHtml += `<div class="message-detail-item"><span class="message-detail-label">Where:</span> ${this.escapedHtml(message.description.where)}</div>`;
                }
                if (message.description.scope) {
                    popupHtml += `<div class="message-detail-item"><span class="message-detail-label">Scope:</span> ${this.escapedHtml(message.description.scope)}</div>`;
                }
                popupHtml += '</div>';
            } else {
                // Simple string description (for custom messages)
                popupHtml += `<div class="message-preview-content">${this.escapedHtml(message.description)}</div>`;
            }
        }
        
        // Hover image
        if (message.hoverImage) {
            popupHtml += `<img class="message-preview-image" src="${this.escapedHtml(message.hoverImage)}" alt="Message image">`;
        }
        
        // Add "Noted" button for default feature messages (messages with structured description)
        if (message.id && message.id.startsWith('default_') && message.description && typeof message.description === 'object') {
            popupHtml += `<div class="message-preview-actions">
                <button class="message-noted-btn" data-message-id="${this.escapedHtml(message.id)}" title="Mark as noted and hide from banner">
                    <span class="noted-icon">✓</span> Noted
                </button>
            </div>`;
        }

        this.messageHoverPopup.innerHTML = popupHtml;
        
        // Add event listener for "Noted" button
        const notedBtn = this.messageHoverPopup.querySelector('.message-noted-btn');
        if (notedBtn) {
            notedBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageId = e.target.closest('.message-noted-btn').dataset.messageId;
                this.markMessageAsNoted(messageId);
                this.hideMessageHoverPopup();
            });
        }

        // Position popup near cursor
        const popupWidth = 350; // Increased width for detailed descriptions
        const popupHeight = 250; // Increased height for Noted button
        let left = event.clientX + 10;
        let top = event.clientY + 10;

        // Adjust if off-screen
        if (left + popupWidth > window.innerWidth) {
            left = event.clientX - popupWidth - 10;
        }
        if (top + popupHeight > window.innerHeight) {
            top = event.clientY - popupHeight - 10;
        }

        this.messageHoverPopup.style.left = `${left}px`;
        this.messageHoverPopup.style.top = `${top}px`;
        this.messageHoverPopup.classList.add('visible');
    },
    
    /**
     * Mark a default message as "noted" (hide from banner display)
     * @param {string} messageId - The message ID to mark as noted
     */
    async markMessageAsNoted(messageId) {
        if (!messageId) return;
        
        try {
            // Get current noted messages from storage
            const result = await chrome.storage.local.get(['exl_banner_noted_messages']);
            const notedMessages = result.exl_banner_noted_messages || {};
            
            // Mark this message as noted
            notedMessages[messageId] = {
                notedAt: Date.now(),
                noted: true
            };
            
            // Save to storage
            await chrome.storage.local.set({ exl_banner_noted_messages: notedMessages });
            
            Logger.info(`[PersistentBanner] Message "${messageId}" marked as noted`);
            
            // Refresh active messages to filter out noted ones
            await this.loadMessages();
            this.updateMessageDisplay();
            
        } catch (error) {
            Logger.error('[PersistentBanner] Error marking message as noted:', error);
        }
    },
    
    /**
     * Check if a message has been noted
     * @param {string} messageId - The message ID to check
     * @returns {Promise<boolean>} True if the message has been noted
     */
    async isMessageNoted(messageId) {
        if (!messageId) return false;
        
        try {
            const result = await chrome.storage.local.get(['exl_banner_noted_messages']);
            const notedMessages = result.exl_banner_noted_messages || {};
            return notedMessages[messageId]?.noted === true;
        } catch (error) {
            Logger.error('[PersistentBanner] Error checking if message is noted:', error);
            return false;
        }
    },

    /**
     * Hide message hover popup with delay
     */
    hideMessageHoverPopup() {
        if (this.messageHoverTimeout) {
            clearTimeout(this.messageHoverTimeout);
        }
        
        this.messageHoverTimeout = setTimeout(() => {
            if (this.messageHoverPopup) {
                this.messageHoverPopup.classList.remove('visible');
            }
        }, 200); // Small delay to allow moving to popup
    },

    /**
     * Close message hover popup immediately
     */
    closeMessageHoverPopup() {
        if (this.messageHoverTimeout) {
            clearTimeout(this.messageHoverTimeout);
            this.messageHoverTimeout = null;
        }
        if (this.messageHoverPopup) {
            this.messageHoverPopup.remove();
            this.messageHoverPopup = null;
        }
    },

    // ================================================
    // MESSAGE EDIT POPUP
    // ================================================

    /**
     * Show message edit popup
     * @param {string} messageId - The message ID to edit (optional)
     */
    showMessageEditPopup(messageId = null) {
        // Create popup if not exists
        if (!this.messageEditPopup) {
            this.createMessageEditPopup();
        }

        // Select the message if provided
        if (messageId) {
            this.selectedEditMessageId = messageId;
        } else if (this.activeMessages.length > 0) {
            this.selectedEditMessageId = this.activeMessages[0].id;
        }

        // Populate the popup
        this.populateMessageEditPopup();

        // Show popup
        this.messageEditPopup.classList.add('visible');
    },

    /**
     * Create the message edit popup DOM
     */
    createMessageEditPopup() {
        this.messageEditPopup = document.createElement('div');
        this.messageEditPopup.className = 'exl-message-edit-popup';
        this.messageEditPopup.innerHTML = `
            <div class="exl-message-edit-container">
                <!-- Left column - Message list -->
                <div class="exl-message-edit-list">
                    <div class="settings-header">Messages</div>
                    <div id="exl-message-edit-list-items"></div>
                </div>
                
                <!-- Middle column - Editor -->
                <div class="exl-message-edit-editor">
                    <div class="editor-header">
                        <span class="editor-title">Edit Message</span>
                        <div class="editor-actions">
                            <button class="exl-banner-btn" id="exl-message-edit-close" title="Close">✕</button>
                        </div>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 11px; color: #a0a0a0; display: block; margin-bottom: 4px;">Subject</label>
                        <input type="text" id="exl-message-edit-subject" placeholder="Message subject" 
                               style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); 
                                      border-radius: 4px; color: #fff; font-size: 12px; padding: 8px;">
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column;">
                        <label style="font-size: 11px; color: #a0a0a0; display: block; margin-bottom: 4px;">Description</label>
                        <textarea id="exl-message-edit-description" placeholder="Message description"></textarea>
                    </div>
                </div>
                
                <!-- Right column - Settings -->
                <div class="exl-message-edit-settings">
                    <div class="settings-header">Display Settings</div>
                    <div class="settings-group">
                        <div class="settings-label">Display Mode</div>
                        <div class="settings-value">
                            <button class="setting-btn" data-mode="hidden">Hidden</button>
                            <button class="setting-btn" data-mode="banner">Banner</button>
                            <button class="setting-btn" data-mode="rotating">Rotating</button>
                        </div>
                    </div>
                    <div class="settings-group">
                        <div class="settings-label">Image</div>
                        <div id="exl-message-edit-image-preview" style="margin-top: 8px;"></div>
                        <button class="setting-btn" id="exl-message-edit-add-image" style="margin-top: 8px;">Add Image</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.messageEditPopup);

        // Setup event listeners
        this.setupMessageEditPopupListeners();
    },

    /**
     * Setup event listeners for message edit popup
     */
    setupMessageEditPopupListeners() {
        if (!this.messageEditPopup) return;

        // Close button
        const closeBtn = this.messageEditPopup.querySelector('#exl-message-edit-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeMessageEditPopup());
        }

        // Subject input - debounced auto-save
        const subjectInput = this.messageEditPopup.querySelector('#exl-message-edit-subject');
        if (subjectInput) {
            let saveTimeout = null;
            subjectInput.addEventListener('input', () => {
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => this.saveMessageEdit(), 500);
            });
        }

        // Description textarea - debounced auto-save
        const descriptionInput = this.messageEditPopup.querySelector('#exl-message-edit-description');
        if (descriptionInput) {
            let saveTimeout = null;
            descriptionInput.addEventListener('input', () => {
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => this.saveMessageEdit(), 500);
            });
        }

        // Display mode buttons
        const modeButtons = this.messageEditPopup.querySelectorAll('[data-mode]');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.saveMessageEdit();
            });
        });
    },

    /**
     * Populate message edit popup with current data
     */
    populateMessageEditPopup() {
        if (!this.messageEditPopup) return;

        // Populate message list
        const listContainer = this.messageEditPopup.querySelector('#exl-message-edit-list-items');
        if (listContainer) {
            listContainer.innerHTML = '';
            this.activeMessages.forEach(msg => {
                const item = document.createElement('div');
                item.className = `exl-message-edit-list-item ${msg.id === this.selectedEditMessageId ? 'selected' : ''}`;
                item.innerHTML = `
                    <span class="message-icon">📝</span>
                    <span class="message-title">${this.escapeHtml(msg.text || 'Untitled')}</span>
                    ${msg.pinnedCaseNumber ? '<span class="message-pin">📌</span>' : ''}
                `;
                item.addEventListener('click', () => {
                    this.selectedEditMessageId = msg.id;
                    this.populateMessageEditPopup();
                });
                listContainer.appendChild(item);
            });
        }

        // Find selected message
        const selectedMessage = this.activeMessages.find(m => m.id === this.selectedEditMessageId);
        if (!selectedMessage) return;

        // Populate editor
        const subjectInput = this.messageEditPopup.querySelector('#exl-message-edit-subject');
        if (subjectInput) {
            subjectInput.value = selectedMessage.text || '';
        }

        const descriptionInput = this.messageEditPopup.querySelector('#exl-message-edit-description');
        if (descriptionInput) {
            descriptionInput.value = selectedMessage.description || '';
        }

        // Update display mode buttons
        const modeButtons = this.messageEditPopup.querySelectorAll('[data-mode]');
        modeButtons.forEach(btn => {
            const mode = btn.dataset.mode;
            btn.classList.toggle('active', mode === (selectedMessage.displayMode || 'banner'));
        });

        // Show image preview if exists
        const imagePreview = this.messageEditPopup.querySelector('#exl-message-edit-image-preview');
        if (imagePreview) {
            if (selectedMessage.hoverImage) {
                imagePreview.innerHTML = `<img src="${this.escapeHtml(selectedMessage.hoverImage)}" 
                                               style="max-width: 100%; max-height: 80px; border-radius: 4px;">`;
            } else {
                imagePreview.innerHTML = '<span style="color: #a0a0a0; font-size: 11px;">No image attached</span>';
            }
        }
    },

    /**
     * Save message edit (auto-save)
     */
    async saveMessageEdit() {
        if (!this.selectedEditMessageId || !this.messageEditPopup) return;

        const subjectInput = this.messageEditPopup.querySelector('#exl-message-edit-subject');
        const descriptionInput = this.messageEditPopup.querySelector('#exl-message-edit-description');
        const activeMode = this.messageEditPopup.querySelector('[data-mode].active');

        const messageIndex = this.activeMessages.findIndex(m => m.id === this.selectedEditMessageId);
        if (messageIndex === -1) return;

        // Update message
        this.activeMessages[messageIndex] = {
            ...this.activeMessages[messageIndex],
            text: subjectInput?.value || '',
            description: descriptionInput?.value || '',
            displayMode: activeMode?.dataset.mode || 'banner'
        };

        // Save to storage
        await this.saveMessages();

        // Update banner display
        this.updateMessageDisplay();

        // Update rotating sticky bar if needed
        this.updateRotatingStickyBar();

        console.log('[PersistentBanner] Message saved:', this.selectedEditMessageId);
    },

    /**
     * Close message edit popup
     */
    closeMessageEditPopup() {
        if (this.messageEditPopup) {
            this.messageEditPopup.classList.remove('visible');
        }
    },

    // ================================================
    // ROTATING STICKY BAR
    // ================================================

    /**
     * Create rotating sticky bar for messages with displayMode: 'rotating'
     */
    createRotatingStickyBar() {
        // Filter messages with displayMode 'rotating'
        this.rotatingStickyBarMessages = this.activeMessages.filter(m => m.displayMode === 'rotating');

        if (this.rotatingStickyBarMessages.length === 0) {
            this.removeRotatingStickyBar();
            return;
        }

        // Create bar if not exists
        if (!this.rotatingStickyBar) {
            this.rotatingStickyBar = document.createElement('div');
            this.rotatingStickyBar.className = 'exl-rotating-sticky-bar';
            this.rotatingStickyBar.innerHTML = '<span class="sticky-message"></span>';
            document.body.appendChild(this.rotatingStickyBar);

            // Add body class for layout adjustment
            document.body.classList.add('exl-sticky-bar-visible');

            // Pause on hover
            this.rotatingStickyBar.addEventListener('mouseenter', () => {
                this.rotatingStickyBar.classList.add('paused');
            });
            this.rotatingStickyBar.addEventListener('mouseleave', () => {
                this.rotatingStickyBar.classList.remove('paused');
            });

            // Click to show message edit
            this.rotatingStickyBar.addEventListener('click', () => {
                if (this.rotatingStickyBarMessages.length > 0) {
                    this.showMessageEditPopup(this.rotatingStickyBarMessages[this.rotatingStickyBarIndex].id);
                }
            });
        }

        // Set initial message
        this.updateRotatingStickyBarMessage();

        // Start rotation interval (if multiple messages)
        if (this.rotatingStickyBarMessages.length > 1) {
            this.startRotatingStickyBar();
        }
    },

    /**
     * Update the rotating sticky bar message
     */
    updateRotatingStickyBarMessage() {
        if (!this.rotatingStickyBar || this.rotatingStickyBarMessages.length === 0) return;

        const message = this.rotatingStickyBarMessages[this.rotatingStickyBarIndex];
        const messageSpan = this.rotatingStickyBar.querySelector('.sticky-message');
        if (messageSpan && message) {
            messageSpan.textContent = message.text || 'No message';
        }
    },

    /**
     * Start rotating sticky bar rotation
     */
    startRotatingStickyBar() {
        this.stopRotatingStickyBar();

        if (this.rotatingStickyBarMessages.length <= 1) return;

        // Rotate every 8 seconds
        this.rotatingStickyBarInterval = setInterval(() => {
            this.rotatingStickyBarIndex = (this.rotatingStickyBarIndex + 1) % this.rotatingStickyBarMessages.length;
            this.updateRotatingStickyBarMessage();
        }, 8000);
    },

    /**
     * Stop rotating sticky bar rotation
     */
    stopRotatingStickyBar() {
        if (this.rotatingStickyBarInterval) {
            clearInterval(this.rotatingStickyBarInterval);
            this.rotatingStickyBarInterval = null;
        }
    },

    /**
     * Remove rotating sticky bar
     */
    removeRotatingStickyBar() {
        this.stopRotatingStickyBar();
        if (this.rotatingStickyBar) {
            this.rotatingStickyBar.remove();
            this.rotatingStickyBar = null;
        }
        document.body.classList.remove('exl-sticky-bar-visible');
    },

    /**
     * Update rotating sticky bar (call when messages change)
     */
    updateRotatingStickyBar() {
        this.rotatingStickyBarMessages = this.activeMessages.filter(m => m.displayMode === 'rotating');
        
        if (this.rotatingStickyBarMessages.length === 0) {
            this.removeRotatingStickyBar();
        } else {
            this.createRotatingStickyBar();
        }
    },

    // ================================================
    // ENVIRONMENT BUTTON VISIBILITY
    // ================================================

    /**
     * Update environment button visibility
     * Only show when on case page and all buttons are ready
     */
    updateEnvironmentButtonVisibility() {
        const envButton = this.elements.banner?.querySelector('[data-popup="env"]');
        if (!envButton) return;

        // Check if we're on a case page
        const isCasePage = this.getCaseIdFromUrl() !== null;
        
        // Check if we have required metadata
        const hasRequiredMetadata = !!(
            this.customerMetadata?.institutionCode ||
            this.customerMetadata?.server
        );

        // Determine visibility
        const shouldShow = isCasePage && this.environmentButtonsReady && hasRequiredMetadata;

        envButton.style.display = shouldShow ? 'block' : 'none';
        console.log('[PersistentBanner] Environment button visibility:', {
            shouldShow,
            isCasePage,
            environmentButtonsReady: this.environmentButtonsReady,
            hasRequiredMetadata,
            institutionCode: this.customerMetadata?.institutionCode,
            server: this.customerMetadata?.server
        });
    },

    // ================================================
    // CACHED DATA FOR REFRESH
    // ================================================

    /**
     * Get cached case data from available sources
     * @returns {Object|null} Cached case data
     */
    getCachedCaseData() {
        if (window.ExLibrisExtension?.apiCaseData) {
            if (apiCaseData.id || apiCaseData.caseId) {
                return window.ExLibrisExtension.apiCaseData;
            }
        }

        // Source 1: Global extension state
        if (window.ExLibrisExtension?.caseData) {
            return window.ExLibrisExtension.caseData;
        }
        
        // Source 2: Global caseToolkit
        if (window.ExLibrisExtension?.caseToolkit?.caseData) {
            return window.ExLibrisExtension.caseToolkit.caseData;
        }
        
        // Source 3: CaseDataStore
        if (typeof CaseDataStore !== 'undefined' && typeof CaseDataStore.getCurrentData === 'function') {
            return CaseDataStore.getCurrentData();
        }

        return null;
    },

    /**
     * Check if cached data is fresh (within 30 seconds)
     * @param {Object} data - The cached data
     * @returns {boolean} True if data is fresh
     */
    isDataFresh(data) {
        if (!data) return false;
        
        const now = Date.now();
        const extractedAt = data.extractedAt || data.timestamp || 0;
        const ageMs = now - extractedAt;
        
        // Consider data fresh if less than 30 seconds old
        return ageMs < 30000;
    },

    /**
     * Populate banner from cached data
     * @param {Object} cachedData - The cached case data
     */
    async populateFromCachedData(cachedData) {
        if (!cachedData) return;

        console.log('[PersistentBanner] Populating from cached data:', cachedData.caseNumber);

        // Update page info
        await this.updateCurrentPage({
            type: 'Case',
            caseNumber: cachedData.caseNumber || null,
            subject: cachedData.subject || null,
            status: cachedData.status || null,
            subStatus: cachedData.subStatus || null
        });

        // Update customer metadata if available
        if (cachedData.custID || cachedData.instID || cachedData.server || cachedData.institutionCode) {
            this.customerMetadata = {
                customerId: cachedData.custID || cachedData.customerId || null,
                institutionId: cachedData.instID || cachedData.institutionId || null,
                server: cachedData.server || null,
                productServiceName: cachedData.productServiceName || null,
                institutionCode: cachedData.institutionCode || cachedData.exLibrisAccountNumber || null
            };
        }

        // Update timezone info if available
        if (cachedData.customerTimezone) {
            // Update timezone display
            if (this.elements.timezone) {
                this.elements.timezone.textContent = cachedData.customerTimezone;
            }
        }

        // Refresh the UI
        this.updateBannerUI();
        this.updateEnvironmentButtonVisibility();
    },

    /**
     * Trigger color refresh for highlighting functions
     */
    triggerColorRefresh() {
        // Dispatch custom event that content_script.js can listen to
        window.dispatchEvent(new CustomEvent('exl-color-config-changed'));
    },

    /**
     * Convert RGB to hex
     * @param {string} rgb - RGB string
     * @returns {string} Hex string
     */
    rgbToHex(rgb) {
        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const r = parseInt(match[1], 10);
            const g = parseInt(match[2], 10);
            const b = parseInt(match[3], 10);
            return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        }
        return '#000000';
    },

    /**
     * Convert hex to RGB
     * @param {string} hex - Hex string
     * @returns {string} RGB string
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            return `rgb(${r}, ${g}, ${b})`;
        }
        return 'rgb(0, 0, 0)';
    },
};
