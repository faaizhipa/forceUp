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
    wasAutoRotating: false,
    
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

    // Subscriptions
    contextUnsubscribe: null,
    storeUnsubscribe: null,

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

    // =================================================================
    // UTILITY METHODS - Image Compression & Validation
    // =================================================================

    /**
     * Compress base64 image to specified max width while maintaining aspect ratio
     * @param {string} base64String - Base64 image string (with or without data URI prefix)
     * @param {number} maxWidth - Maximum width in pixels (default 700)
     * @param {number} quality - JPEG quality 0-1 (default 0.85)
     * @returns {Promise<string>} Compressed base64 string
     */
    async compressBase64Image(base64String, maxWidth = 700, quality = 0.85) {
        return new Promise((resolve, reject) => {
            try {
                const img = new Image();
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate new dimensions maintaining aspect ratio
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw scaled image
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Export as JPEG base64
                    const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                    
                    console.log(`[PersistentBanner] Image compressed: ${img.width}x${img.height} → ${width}x${height}, Quality: ${quality}`);
                    
                    resolve(compressedBase64);
                };
                
                img.onerror = () => {
                    reject(new Error('Failed to load image for compression'));
                };
                
                // Handle both with and without data URI prefix
                img.src = base64String.startsWith('data:') ? base64String : `data:image/png;base64,${base64String}`;
                
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Validate and compress image, checking size constraints
     * @param {string} base64String - Base64 image string
     * @returns {Promise<{valid: boolean, compressed: string|null, error: string|null, originalSize: number, compressedSize: number}>}
     */
    async validateAndCompressImage(base64String) {
        try {
            const originalSize = typeof StorageQuotaManager !== 'undefined' 
                ? StorageQuotaManager.estimateSize(base64String) 
                : base64String.length * 2;
            
            // Compress image
            const compressed = await this.compressBase64Image(base64String, 700, 0.85);
            
            const compressedSize = typeof StorageQuotaManager !== 'undefined'
                ? StorageQuotaManager.estimateSize(compressed)
                : compressed.length * 2;
            
            // Check 200KB limit for compressed image
            const MAX_IMAGE_SIZE = 200 * 1024; // 200KB
            
            if (compressedSize > MAX_IMAGE_SIZE) {
                return {
                    valid: false,
                    compressed: null,
                    error: `Compressed image too large: ${(compressedSize / 1024).toFixed(1)}KB (max 200KB). Try a smaller image.`,
                    originalSize,
                    compressedSize
                };
            }
            
            console.log(`[PersistentBanner] Image validation passed: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB`);
            
            return {
                valid: true,
                compressed,
                error: null,
                originalSize,
                compressedSize
            };
            
        } catch (error) {
            console.error('[PersistentBanner] Image validation failed:', error);
            return {
                valid: false,
                compressed: null,
                error: error.message || 'Failed to process image',
                originalSize: 0,
                compressedSize: 0
            };
        }
    },

    /**
     * Convert image URL to base64
     * @param {string} imageUrl - Image URL
     * @returns {Promise<string>} Base64 string
     */
    async imageUrlToBase64(imageUrl) {
        return new Promise((resolve, reject) => {
            try {
                const img = new Image();
                img.crossOrigin = 'Anonymous'; // Attempt to handle CORS
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                };
                
                img.onerror = () => {
                    reject(new Error('Failed to load image from URL. Check CORS or URL validity.'));
                };
                
                img.src = imageUrl;
                
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Extract image from clipboard paste event
     * @param {ClipboardEvent} event - Paste event
     * @returns {Promise<string|null>} Base64 string or null
     */
    async extractImageFromClipboard(event) {
        try {
            const items = event.clipboardData?.items;
            if (!items) return null;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                }
            }
            
            return null;
        } catch (error) {
            console.error('[PersistentBanner] Clipboard extraction failed:', error);
            return null;
        }
    },

    /**
     * Validate message text
     * @param {string} text - Message text
     * @returns {{valid: boolean, error: string|null}}
     */
    validateMessageText(text) {
        if (!text || !text.trim()) {
            return { valid: false, error: 'Message cannot be empty' };
        }
        
        if (text.length > 4000) {
            return { valid: false, error: 'Message cannot exceed 4000 characters' };
        }
        
        return { valid: true, error: null };
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
     * @returns {Promise<void>}
     */
    async loadMessagesFromLocal() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['exl_bannerMessages'], (result) => {
                const messagesConfig = result.exl_bannerMessages;
                
                if (!messagesConfig) {
                    this.activeMessages = [];
                    this.messageSettings = null;
                    console.log('[PersistentBanner] No messages found in local storage');
                    resolve();
                    return;
                }
                
                this.messageSettings = messagesConfig;
                this.activeMessages = this.getActiveMessages(messagesConfig);
                
                // Check for pinned message matching current case
                this.prioritizePinnedMessage();
                
                console.log(`[PersistentBanner] Loaded ${this.activeMessages.length} active messages from local storage`);
                resolve();
            });
        });
    },

    /**
     * Save messages to chrome.storage.local
     * @param {Object} messagesConfig - Messages configuration
     * @returns {Promise<boolean>} Success status
     */
    async saveMessagesToLocal(messagesConfig) {
        return new Promise((resolve) => {
            // Add timestamp for conflict detection
            const configWithTimestamp = {
                ...messagesConfig,
                lastModified: Date.now()
            };
            
            // Check quota before saving
            if (typeof StorageQuotaManager !== 'undefined') {
                StorageQuotaManager.canStoreBannerMessage(configWithTimestamp).then((canStore) => {
                    if (!canStore) {
                        console.warn('[PersistentBanner] Storage quota exceeded, cannot save messages');
                        resolve(false);
                        return;
                    }
                    
                    chrome.storage.local.set({ exl_bannerMessages: configWithTimestamp }, () => {
                        console.log('[PersistentBanner] Messages saved to local storage with timestamp:', configWithTimestamp.lastModified);
                        resolve(true);
                    });
                });
            } else {
                // Fallback if StorageQuotaManager not available
                chrome.storage.local.set({ exl_bannerMessages: configWithTimestamp }, () => {
                    console.log('[PersistentBanner] Messages saved to local storage (quota check skipped) with timestamp:', configWithTimestamp.lastModified);
                    resolve(true);
                });
            }
        });
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
     */
    async init() {
        if (this.isInitialized) {
            console.log('[PersistentBanner] Already initialized');
            return;
        }

        // Check if banner should be shown (includes feature enabled + dismissal checks)
        if (!this.shouldShowBanner()) {
            console.log('[PersistentBanner] Banner should not be shown (disabled or dismissed)');
            return;
        }

        console.log('[PersistentBanner] Initializing...');
        
        // Inject CSS animations for modals
        this.injectModalStyles();
        
        // Load navigation history from sessionStorage
        this.loadNavigationHistory();
        
        // Create and inject banner
        this.createBanner();
        
        // Observe DOM for the right injection point
        this.observeForInjection();
        
        // Start URL monitoring to detect navigation changes
        this.startUrlMonitoring();
        
        // Subscribe to case context + data store updates
        this.setupContextSubscriptions();
        
        // Listen for CasePageDataExtractor events
        this.setupCaseDataListener();
        
        // Listen for settings changes
        this.setupSettingsListener();
        
        // Start periodic validation for stale data prevention
        this.startPeriodicValidation();
        
        // Migrate legacy messages from sync storage if needed
        await this.migrateLegacyMessagesFromSync();
        
        // Load messages for rotation from local storage
        await this.loadMessagesFromLocal();
        
        // Setup storage change listener for cross-tab synchronization
        this.setupStorageChangeListener();
        
        // Setup message listener for popup toggle commands
        this.setupPopupMessageListener();
        
        // Check initial state - if on case page, check extraction status
        this.checkInitialState();
        
        this.isInitialized = true;
        console.log('[PersistentBanner] Initialized');
    },
    
    /**
     * Setup message listener for popup toggle commands
     * Handles {action: 'toggleBanner', enabled: true/false} messages from popup
     */
    setupPopupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'toggleBanner') {
                console.log('[PersistentBanner] Received toggleBanner message:', message);
                
                if (message.enabled === true) {
                    // Restore banner
                    this.undoBannerDismissal();
                } else if (message.enabled === false) {
                    // Hide banner
                    this.handleBannerClose();
                }
                
                sendResponse({ success: true });
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
        this.registerListener(chrome.storage.onChanged, this.storageChangeListener);
        
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
        // Check if feature is enabled
        const isEnabled = this.isFeatureEnabled();
        if (!isEnabled) {
            console.log('[PersistentBanner] Feature disabled in settings');
            return false;
        }
        
        // Check if dismissed for current session
        const domain = this.getCurrentDomain();
        const isDismissed = sessionStorage.getItem(`exl_banner_dismissed_${domain}`) === 'true';
        
        if (isDismissed) {
            console.log('[PersistentBanner] Banner dismissed for session on domain:', domain);
            return false;
        }
        
        // Check if domain is enabled (for multi-site activation)
        if (typeof SiteActivationManager !== 'undefined' && typeof SiteActivationManager.isBannerEnabled === 'function') {
            const isEnabledForDomain = SiteActivationManager.isBannerEnabled(domain);
            if (!isEnabledForDomain) {
                console.log('[PersistentBanner] Banner disabled for domain:', domain);
                return false;
            }
        }
        
        return true;
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
                        console.warn(`[PersistentBanner] Cannot display data: validation failed`);
                        // Clear stale data if validation fails
                        this.clearCaseData();
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
            this.contextUnsubscribe = CaseContextWatcher.subscribe(({ context }) => {
                this.handleContextUpdate(context);
            });
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
    },

    /**
     * Handle context watcher updates
     * @param {Object|null} context
     */
    handleContextUpdate(context) {
        if (!context || !context.caseId) {
            console.log('[PersistentBanner] Context indicates non-case page, clearing state');
            this.clearCaseData();
            this.currentPage = {
                type: 'Unknown',
                caseNumber: null,
                subject: null,
                status: null,
                subStatus: null,
                url: window.location.href,
                timestamp: new Date().toISOString()
            };
            this.updateBannerUI();
            return;
        }

        const caseChanged = context.caseId !== this.currentCaseId;
        this.currentCaseId = context.caseId;

        if (context.caseNumber) {
            this.currentPage.caseNumber = context.caseNumber;
        }

        if (caseChanged) {
            console.log(`[PersistentBanner] Case context changed to ${context.caseNumber || 'unknown'} (${context.caseId})`);
            this.clearCaseData(true);
        }
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
                this.clearCaseData(true);
                this.updateBannerUI();
            }
            return;
        }

        if (data.caseId && this.currentCaseId && data.caseId !== this.currentCaseId) {
            console.warn('[PersistentBanner] Ignoring store data for different case', data.caseId, this.currentCaseId);
            return;
        }

        this.displayedCaseId = data.caseId || this.currentCaseId || null;
        this.displayedCaseNumber = data.caseNumber || this.displayedCaseNumber;

        this.currentPage.caseNumber = data.caseNumber || this.currentPage.caseNumber;
        this.currentPage.subject = data.subject || this.currentPage.subject;
        this.currentPage.status = data.status || this.currentPage.status;
        this.currentPage.subStatus = data.subStatus || this.currentPage.subStatus;
        this.currentPage.type = 'case_page';
        this.currentPage.displayType = this.getPageTypeDisplayName('case_page');

        this.customerMetadata = {
            customerId: data.custID || data.customerId || null,
            institutionId: data.instID || data.institutionId || null,
            server: data.server || this.customerMetadata.server,
            productServiceName: data.productServiceName || this.customerMetadata.productServiceName,
            institutionCode: data.institutionCode || data.exLibrisAccountNumber || this.customerMetadata.institutionCode
        };

        this.updateBannerUI();
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
    clearCaseData(preserveContext = false) {
        console.log('[PersistentBanner] Clearing case-specific data');
        
        // Clear current case ID
        if (!preserveContext) {
            this.currentCaseId = null;
        }
        
        // Clear displayed case tracking
        this.displayedCaseId = null;
        this.displayedCaseNumber = null;
        
        // Clear customer metadata
        this.customerMetadata = {
            customerId: null,
            institutionId: null,
            server: null,
            productServiceName: null,
            institutionCode: null
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
                            return;
                        }
                    } else {
                        // No current context - clear stale data
                        console.warn(`[PersistentBanner] Cannot update page: ${validation.reason} (no current context)`);
                        this.clearCaseData();
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
            <button class="exl-hl-banner-close-btn" title="Hide banner for this session">×</button>
            <div class="exl-banner-container">
                <div class="exl-banner-section exl-banner-page-info">
                    <div class="exl-banner-label">Current Page</div>
                    <div class="exl-banner-page-type" id="exl-banner-page-type">—</div>
                </div>
                
                <div class="exl-banner-section exl-banner-metadata" id="exl-banner-metadata-section">
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
                    <button class="exl-banner-btn" data-action="refresh" title="Refresh banner data from current page">🔄 Refresh</button>
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
                            institutionCode: freshData.exLibrisAccountNumber || null
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
                    // Extraction in progress - show loading state (hide both)
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
     */
    updateMetadataFields() {
        // Update case metadata
        if (this.elements.caseNumber) {
            this.elements.caseNumber.textContent = this.currentPage.caseNumber || '—';
        }
        if (this.elements.subject) {
            this.elements.subject.textContent = this.currentPage.subject || '—';
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
        const hasEnvData = this.customerMetadata.customerId && 
                          this.customerMetadata.institutionId && 
                          this.customerMetadata.server;
        
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
        return new Promise((resolve) => {
            chrome.storage.sync.get(['exlibris'], (result) => {
                const messagesConfig = result.exlibris?.persistentBanner?.messages;
                
                if (!messagesConfig) {
                    this.activeMessages = [];
                    this.messageSettings = null;
                    resolve();
                    return;
                }
                
                this.messageSettings = messagesConfig;
                this.activeMessages = this.getActiveMessages(messagesConfig);
                console.log(`[PersistentBanner] Loaded ${this.activeMessages.length} active messages`);
                resolve();
            });
        });
    },

    /**
     * Get combined list of enabled messages (default + custom)
     * @param {Object} messagesConfig - Messages configuration object
     * @returns {Array} Array of message objects with all properties
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
            // Cleanup previous hover image listeners
            this.cleanupHoverImagePopup();
            
            // Render message text
            this.elements.messageContent.innerHTML = this.renderMessage(currentMessage.text);
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
        }
        
        // Enable/disable navigation buttons
        if (this.elements.messagePrevBtn) {
            this.elements.messagePrevBtn.disabled = this.activeMessages.length <= 1;
        }
        if (this.elements.messageNextBtn) {
            this.elements.messageNextBtn.disabled = this.activeMessages.length <= 1;
        }
    },

    /**
     * Check if should show messages (feature enabled + not case page/comments)
     * Explicitly excludes case pages and case comments - these pages have their own data
     * @returns {Promise<boolean>}
     */
    async shouldShowMessages() {
        // FIRST: Explicit early return for case pages and case comments
        // These pages NEVER show messages - they have their own data to display
        const pageType = this.currentPage.type; // Should be raw type after normalization
        const isCasePage = pageType === 'case_page';
        const isCaseComments = pageType === 'case_comments';
        
        if (isCasePage || isCaseComments) {
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
        this.remove();
        
        // Close any open modals and dropdowns
        this.closeContextMenu();
        this.closeMessageDropdown();
        this.cleanupHoverImagePopup();
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
