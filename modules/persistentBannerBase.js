/**
 * PersistentBannerBase - Shared utilities for PersistentBanner and PersistentBannerCforce
 * 
 * This module provides common functionality extracted from both banner implementations:
 * - BannerMessageManager: Message storage, loading, saving, rotation
 * - BannerTimezoneManager: Timezone display and customer time formatting
 * - BannerPopupManager: Modal/popup creation, positioning, lifecycle
 * - BannerImageManager: Image compression, validation, clipboard extraction
 * - BannerStorageSync: Cross-tab synchronization via storage listeners
 * 
 * @module persistentBannerBase
 */

const PersistentBannerBase = {
    // =================================================================
    // STORAGE KEYS
    // =================================================================
    STORAGE_KEYS: {
        MESSAGES: 'exl_bannerMessages',
        MESSAGES_MIGRATED: 'exl_bannerMessages_migrated',
        SETTINGS: 'bannerMessageSettings'
    },

    // =================================================================
    // BANNER MESSAGE MANAGER
    // =================================================================
    BannerMessageManager: {
        /**
         * Load messages from chrome.storage.local
         * @returns {Promise<Object>} Messages configuration
         */
        async loadMessages() {
            return new Promise((resolve) => {
                chrome.storage.local.get([PersistentBannerBase.STORAGE_KEYS.MESSAGES], (result) => {
                    const messagesConfig = result[PersistentBannerBase.STORAGE_KEYS.MESSAGES];
                    
                    if (!messagesConfig) {
                        console.log('[BannerMessageManager] No messages found in storage');
                        resolve(null);
                        return;
                    }
                    
                    console.log('[BannerMessageManager] Loaded messages from storage');
                    resolve(messagesConfig);
                });
            });
        },

        /**
         * Save messages to chrome.storage.local
         * @param {Object} messagesConfig - Messages configuration
         * @returns {Promise<boolean>} Success status
         */
        async saveMessages(messagesConfig) {
            return new Promise((resolve) => {
                const configWithTimestamp = {
                    ...messagesConfig,
                    lastModified: Date.now()
                };

                // Check quota if StorageQuotaManager is available
                if (typeof StorageQuotaManager !== 'undefined') {
                    StorageQuotaManager.canStoreBannerMessage(configWithTimestamp).then((canStore) => {
                        if (!canStore) {
                            console.warn('[BannerMessageManager] Storage quota exceeded');
                            resolve(false);
                            return;
                        }

                        chrome.storage.local.set({ 
                            [PersistentBannerBase.STORAGE_KEYS.MESSAGES]: configWithTimestamp 
                        }, () => {
                            console.log('[BannerMessageManager] Messages saved, timestamp:', configWithTimestamp.lastModified);
                            resolve(true);
                        });
                    });
                } else {
                    chrome.storage.local.set({ 
                        [PersistentBannerBase.STORAGE_KEYS.MESSAGES]: configWithTimestamp 
                    }, () => {
                        console.log('[BannerMessageManager] Messages saved (quota check skipped)');
                        resolve(true);
                    });
                }
            });
        },

        /**
         * Load message settings from chrome.storage.sync
         * @returns {Promise<Object>} Message settings
         */
        async loadSettings() {
            return new Promise((resolve) => {
                chrome.storage.sync.get([PersistentBannerBase.STORAGE_KEYS.SETTINGS], (result) => {
                    const settings = result[PersistentBannerBase.STORAGE_KEYS.SETTINGS] || {
                        enabled: true,
                        rotationEnabled: true,
                        rotationInterval: 5000,
                        showDescriptions: true
                    };
                    resolve(settings);
                });
            });
        },

        /**
         * Get active messages based on configuration
         * @param {Object} messagesConfig - Messages configuration
         * @param {Object} settings - Message settings
         * @returns {Array} Active messages array
         */
        getActiveMessages(messagesConfig, settings) {
            if (!messagesConfig) return [];
            
            const activeMessages = [];
            
            // Add default messages if enabled
            if (messagesConfig.defaultMessages?.enabled && messagesConfig.defaultMessages?.items) {
                messagesConfig.defaultMessages.items.forEach(msg => {
                    if (msg.enabled !== false) {
                        activeMessages.push({
                            ...msg,
                            type: 'default'
                        });
                    }
                });
            }
            
            // Add custom messages
            if (messagesConfig.customMessages) {
                messagesConfig.customMessages.forEach(msg => {
                    if (msg.enabled !== false && !msg.noted) {
                        activeMessages.push({
                            ...msg,
                            type: 'custom'
                        });
                    }
                });
            }
            
            return activeMessages;
        },

        /**
         * Generate a unique message ID
         * @returns {string} Unique ID
         */
        generateId() {
            return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },

        /**
         * Validate message text
         * @param {string} text - Message text
         * @param {number} maxLength - Maximum length (default 20000)
         * @returns {{valid: boolean, error: string|null}}
         */
        validateText(text, maxLength = 20000) {
            if (!text || !text.trim()) {
                return { valid: false, error: 'Message cannot be empty' };
            }
            
            if (text.length > maxLength) {
                return { valid: false, error: `Message cannot exceed ${maxLength} characters` };
            }
            
            return { valid: true, error: null };
        },

        /**
         * Escape HTML entities
         * @param {string} text - Text to escape
         * @returns {string} Escaped text
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        /**
         * Render message HTML with optional description
         * @param {string} text - Message text
         * @param {string} description - Optional description
         * @param {boolean} showDescription - Whether to show description
         * @param {string} cssPrefix - CSS class prefix ('exl' or 'exl-cforce')
         * @returns {string} HTML string
         */
        renderMessageHtml(text, description = '', showDescription = true, cssPrefix = 'exl') {
            let html = '';
            
            // Split by newlines for multiline support
            const lines = (text || '').split('\n').filter(line => line.trim());
            
            lines.forEach((line, index) => {
                html += `<span class="${cssPrefix}-message-line">${this.escapeHtml(line)}</span>`;
                if (index < lines.length - 1) {
                    html += '<br>';
                }
            });
            
            // Add description if available and enabled
            if (showDescription && description) {
                const truncatedDesc = description.length > 60 
                    ? description.substring(0, 60) + '...' 
                    : description;
                html += `<span class="${cssPrefix}-message-description" title="${this.escapeHtml(description)}">${this.escapeHtml(truncatedDesc)}</span>`;
            }
            
            return html;
        }
    },

    // =================================================================
    // BANNER TIMEZONE MANAGER
    // =================================================================
    BannerTimezoneManager: {
        /**
         * Format customer time for display
         * @param {string} timezone - IANA timezone string
         * @param {Date} date - Date to format (defaults to now)
         * @returns {string} Formatted time string or '—' if invalid
         */
        formatCustomerTime(timezone, date = new Date()) {
            if (!timezone || timezone === '—' || timezone === 'Unknown') {
                return '—';
            }
            
            try {
                const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
                return formatter.format(date);
            } catch (error) {
                console.warn('[BannerTimezoneManager] Invalid timezone:', timezone);
                return '—';
            }
        },

        /**
         * Get timezone display name
         * @param {string} timezone - IANA timezone string
         * @returns {string} Display name or original timezone
         */
        getTimezoneDisplayName(timezone) {
            if (!timezone || timezone === '—') return '—';
            
            try {
                // Get abbreviated name
                const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone,
                    timeZoneName: 'short'
                });
                const parts = formatter.formatToParts(new Date());
                const tzPart = parts.find(p => p.type === 'timeZoneName');
                return tzPart ? tzPart.value : timezone;
            } catch (error) {
                return timezone;
            }
        },

        /**
         * Get timezone offset string
         * @param {string} timezone - IANA timezone string
         * @param {Date} date - Date for offset calculation
         * @returns {string} Offset string like '+05:30' or '—'
         */
        getTimezoneOffset(timezone, date = new Date()) {
            if (!timezone || timezone === '—') return '—';
            
            try {
                const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone,
                    timeZoneName: 'longOffset'
                });
                const parts = formatter.formatToParts(date);
                const tzPart = parts.find(p => p.type === 'timeZoneName');
                if (tzPart) {
                    // Extract offset from "GMT+05:30" format
                    const match = tzPart.value.match(/GMT([+-]\d{1,2}:\d{2})/);
                    return match ? match[1] : tzPart.value;
                }
                return '—';
            } catch (error) {
                return '—';
            }
        },

        /**
         * Resolve timezone from case data using CustomerMasterManager
         * @param {Object} caseData - Case data with account info
         * @returns {Promise<string>} Resolved timezone or 'UTC'
         */
        async resolveTimezone(caseData) {
            if (!caseData) return 'UTC';
            
            // Check if timezone already in case data
            if (caseData.customerTimezone && caseData.customerTimezone !== '—') {
                return caseData.customerTimezone;
            }
            
            // Try CustomerMasterManager
            if (typeof CustomerMasterManager !== 'undefined' && CustomerMasterManager.isInitialized) {
                const identifiers = {
                    accountName: caseData.accountName,
                    institutionCode: caseData.institutionCode || caseData.exLibrisAccountNumber,
                    accountCode: caseData.accountCode
                };
                
                const resolved = await CustomerMasterManager.resolveTimezone(identifiers);
                if (resolved && resolved !== 'Unknown') {
                    return resolved;
                }
            }
            
            return 'UTC';
        }
    },

    // =================================================================
    // BANNER POPUP MANAGER
    // =================================================================
    BannerPopupManager: {
        activePopups: [],

        /**
         * Create a modal overlay
         * @param {Object} options - Modal options
         * @returns {HTMLElement} Modal overlay element
         */
        createModalOverlay(options = {}) {
            const {
                zIndex = 999998,
                blur = true,
                closeOnOutsideClick = true,
                onClose = null
            } = options;

            const overlay = document.createElement('div');
            overlay.className = 'exl-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                ${blur ? 'backdrop-filter: blur(3px);' : ''}
                z-index: ${zIndex};
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.2s ease;
            `;

            if (closeOnOutsideClick) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        this.closePopup(overlay);
                        if (onClose) onClose();
                    }
                });
            }

            this.activePopups.push(overlay);
            return overlay;
        },

        /**
         * Create a modal content container
         * @param {Object} options - Content options
         * @returns {HTMLElement} Modal content element
         */
        createModalContent(options = {}) {
            const {
                width = '500px',
                maxWidth = '90vw',
                maxHeight = '80vh',
                padding = '24px',
                borderRadius = '8px'
            } = options;

            const content = document.createElement('div');
            content.className = 'exl-modal-content';
            content.style.cssText = `
                background: white;
                border-radius: ${borderRadius};
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                width: ${width};
                max-width: ${maxWidth};
                max-height: ${maxHeight};
                overflow-y: auto;
                padding: ${padding};
                animation: slideUp 0.2s ease;
            `;

            return content;
        },

        /**
         * Create a positioned popup (for hover/context menus)
         * @param {Object} options - Popup options
         * @returns {HTMLElement} Popup element
         */
        createPositionedPopup(options = {}) {
            const {
                x = 0,
                y = 0,
                zIndex = 999999,
                className = 'exl-popup'
            } = options;

            const popup = document.createElement('div');
            popup.className = className;
            popup.style.cssText = `
                position: fixed;
                top: ${y}px;
                left: ${x}px;
                z-index: ${zIndex};
                background: white;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            `;

            this.activePopups.push(popup);
            return popup;
        },

        /**
         * Position popup within viewport bounds
         * @param {HTMLElement} popup - Popup element
         * @param {number} x - Target X position
         * @param {number} y - Target Y position
         * @param {Object} options - Positioning options
         */
        positionWithinViewport(popup, x, y, options = {}) {
            const {
                padding = 10,
                preferAbove = false
            } = options;

            // First, add to DOM if not already
            if (!popup.parentNode) {
                document.body.appendChild(popup);
            }

            const rect = popup.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let finalX = x;
            let finalY = y;

            // Horizontal adjustment
            if (finalX + rect.width > viewportWidth - padding) {
                finalX = viewportWidth - rect.width - padding;
            }
            if (finalX < padding) {
                finalX = padding;
            }

            // Vertical adjustment
            if (preferAbove && y - rect.height - padding >= 0) {
                finalY = y - rect.height - padding;
            } else if (finalY + rect.height > viewportHeight - padding) {
                finalY = viewportHeight - rect.height - padding;
            }
            if (finalY < padding) {
                finalY = padding;
            }

            popup.style.top = `${finalY}px`;
            popup.style.left = `${finalX}px`;
        },

        /**
         * Close a specific popup
         * @param {HTMLElement} popup - Popup to close
         * @param {boolean} animate - Whether to animate close
         */
        closePopup(popup, animate = true) {
            if (!popup) return;

            const removePopup = () => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
                const index = this.activePopups.indexOf(popup);
                if (index !== -1) {
                    this.activePopups.splice(index, 1);
                }
            };

            if (animate) {
                popup.style.opacity = '0';
                setTimeout(removePopup, 200);
            } else {
                removePopup();
            }
        },

        /**
         * Close all active popups
         */
        closeAllPopups() {
            [...this.activePopups].forEach(popup => {
                this.closePopup(popup, false);
            });
            this.activePopups = [];
        },

        /**
         * Show a notification toast
         * @param {string} message - Message to display
         * @param {string} type - Type: 'success', 'error', 'info', 'warning'
         * @param {number} duration - Display duration in ms
         */
        showNotification(message, type = 'info', duration = 3000) {
            const colors = {
                success: { bg: '#4caf50', text: '#fff' },
                error: { bg: '#f44336', text: '#fff' },
                warning: { bg: '#ff9800', text: '#fff' },
                info: { bg: '#2196f3', text: '#fff' }
            };

            const color = colors[type] || colors.info;

            const notification = document.createElement('div');
            notification.className = 'exl-notification';
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: ${color.bg};
                color: ${color.text};
                padding: 12px 20px;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                z-index: 999999;
                font-size: 14px;
                animation: slideUp 0.2s ease;
            `;
            notification.textContent = message;

            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.2s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 200);
            }, duration);
        }
    },

    // =================================================================
    // BANNER IMAGE MANAGER
    // =================================================================
    BannerImageManager: {
        MAX_IMAGE_SIZE: 200 * 1024, // 200KB
        DEFAULT_MAX_WIDTH: 700,
        DEFAULT_QUALITY: 0.85,

        /**
         * Compress base64 image
         * @param {string} base64String - Base64 image string
         * @param {number} maxWidth - Maximum width in pixels
         * @param {number} quality - JPEG quality 0-1
         * @returns {Promise<string>} Compressed base64 string
         */
        async compressImage(base64String, maxWidth = this.DEFAULT_MAX_WIDTH, quality = this.DEFAULT_QUALITY) {
            return new Promise((resolve, reject) => {
                try {
                    const img = new Image();

                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        let width = img.width;
                        let height = img.height;

                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);

                        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                        console.log(`[BannerImageManager] Compressed: ${img.width}x${img.height} → ${width}x${height}`);
                        resolve(compressedBase64);
                    };

                    img.onerror = () => {
                        reject(new Error('Failed to load image for compression'));
                    };

                    img.src = base64String.startsWith('data:') 
                        ? base64String 
                        : `data:image/png;base64,${base64String}`;

                } catch (error) {
                    reject(error);
                }
            });
        },

        /**
         * Validate and compress image
         * @param {string} base64String - Base64 image string
         * @returns {Promise<Object>} Validation result
         */
        async validateAndCompress(base64String) {
            try {
                const originalSize = typeof StorageQuotaManager !== 'undefined'
                    ? StorageQuotaManager.estimateSize(base64String)
                    : base64String.length * 2;

                const compressed = await this.compressImage(base64String);

                const compressedSize = typeof StorageQuotaManager !== 'undefined'
                    ? StorageQuotaManager.estimateSize(compressed)
                    : compressed.length * 2;

                if (compressedSize > this.MAX_IMAGE_SIZE) {
                    return {
                        valid: false,
                        compressed: null,
                        error: `Compressed image too large: ${(compressedSize / 1024).toFixed(1)}KB (max ${this.MAX_IMAGE_SIZE / 1024}KB)`,
                        originalSize,
                        compressedSize
                    };
                }

                return {
                    valid: true,
                    compressed,
                    error: null,
                    originalSize,
                    compressedSize
                };

            } catch (error) {
                console.error('[BannerImageManager] Validation failed:', error);
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
        async urlToBase64(imageUrl) {
            return new Promise((resolve, reject) => {
                try {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';

                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/jpeg', 0.9));
                    };

                    img.onerror = () => {
                        reject(new Error('Failed to load image from URL'));
                    };

                    img.src = imageUrl;

                } catch (error) {
                    reject(error);
                }
            });
        },

        /**
         * Extract image from clipboard
         * @param {ClipboardEvent} event - Paste event
         * @returns {Promise<string|null>} Base64 string or null
         */
        async extractFromClipboard(event) {
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
                console.error('[BannerImageManager] Clipboard extraction failed:', error);
                return null;
            }
        }
    },

    // =================================================================
    // BANNER STORAGE SYNC
    // =================================================================
    BannerStorageSync: {
        listeners: [],

        /**
         * Setup storage change listener for cross-tab sync
         * @param {Function} onMessagesChange - Callback when messages change
         * @param {Function} onSettingsChange - Callback when settings change
         * @returns {Function} Unsubscribe function
         */
        setupListener(onMessagesChange, onSettingsChange) {
            const handler = (changes, areaName) => {
                // Messages changed in local storage
                if (areaName === 'local' && changes[PersistentBannerBase.STORAGE_KEYS.MESSAGES]) {
                    console.log('[BannerStorageSync] Messages changed in another tab');
                    if (onMessagesChange) {
                        onMessagesChange(changes[PersistentBannerBase.STORAGE_KEYS.MESSAGES].newValue);
                    }
                }

                // Settings changed in sync storage
                if (areaName === 'sync' && changes[PersistentBannerBase.STORAGE_KEYS.SETTINGS]) {
                    console.log('[BannerStorageSync] Settings changed');
                    if (onSettingsChange) {
                        onSettingsChange(changes[PersistentBannerBase.STORAGE_KEYS.SETTINGS].newValue);
                    }
                }
            };

            chrome.storage.onChanged.addListener(handler);
            this.listeners.push(handler);

            // Return unsubscribe function
            return () => {
                chrome.storage.onChanged.removeListener(handler);
                const index = this.listeners.indexOf(handler);
                if (index !== -1) {
                    this.listeners.splice(index, 1);
                }
            };
        },

        /**
         * Remove all storage listeners
         */
        removeAllListeners() {
            this.listeners.forEach(handler => {
                chrome.storage.onChanged.removeListener(handler);
            });
            this.listeners = [];
        }
    },

    // =================================================================
    // BANNER CLEANUP TRACKER
    // =================================================================
    BannerCleanupTracker: {
        /**
         * Create a new cleanup tracker instance
         * @returns {Object} Cleanup tracker with methods
         */
        create() {
            return {
                timers: [],
                listeners: [],
                observers: [],

                /**
                 * Register a timer
                 * @param {number} timerId - Timer ID
                 * @param {string} type - 'timeout' or 'interval'
                 * @returns {number} Timer ID
                 */
                registerTimer(timerId, type = 'interval') {
                    this.timers.push({ id: timerId, type });
                    return timerId;
                },

                /**
                 * Register an event listener
                 * @param {Element} element - DOM element
                 * @param {string} event - Event name
                 * @param {Function} handler - Event handler
                 * @param {Object} options - Event options
                 */
                registerListener(element, event, handler, options = {}) {
                    element.addEventListener(event, handler, options);
                    this.listeners.push({ element, event, handler, options });
                },

                /**
                 * Register a MutationObserver
                 * @param {MutationObserver} observer - Observer instance
                 */
                registerObserver(observer) {
                    this.observers.push(observer);
                },

                /**
                 * Cleanup all tracked resources
                 */
                cleanup() {
                    // Clear timers
                    this.timers.forEach(({ id, type }) => {
                        if (type === 'interval') {
                            clearInterval(id);
                        } else {
                            clearTimeout(id);
                        }
                    });
                    this.timers = [];

                    // Remove listeners
                    this.listeners.forEach(({ element, event, handler, options }) => {
                        element.removeEventListener(event, handler, options);
                    });
                    this.listeners = [];

                    // Disconnect observers
                    this.observers.forEach(observer => {
                        observer.disconnect();
                    });
                    this.observers = [];

                    console.log('[BannerCleanupTracker] Cleaned up all resources');
                }
            };
        }
    },

    // =================================================================
    // COLOR UTILITIES (shared between both banners)
    // =================================================================
    ColorUtils: {
        /**
         * Convert hex color to RGB
         * @param {string} hex - Hex color string
         * @returns {{r: number, g: number, b: number}|null}
         */
        hexToRgb(hex) {
            if (!hex) return null;
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        },

        /**
         * Get contrasting text color (black or white)
         * @param {string} bgColor - Background hex color
         * @returns {string} '#000000' or '#ffffff'
         */
        getContrastColor(bgColor) {
            const rgb = this.hexToRgb(bgColor);
            if (!rgb) return '#000000';
            
            // Calculate luminance
            const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
            return luminance > 0.5 ? '#000000' : '#ffffff';
        },

        /**
         * Get status colors based on case status
         * @param {string} status - Case status
         * @returns {{bg: string, text: string}} Background and text colors
         */
        getStatusColors(status) {
            const STATUS_COLORS = {
                'New': { bg: '#4a90d9', text: '#ffffff' },
                'Open': { bg: '#4a90d9', text: '#ffffff' },
                'In Progress': { bg: '#f39c12', text: '#ffffff' },
                'Escalated': { bg: '#e74c3c', text: '#ffffff' },
                'Pending Customer': { bg: '#9b59b6', text: '#ffffff' },
                'Pending Internal': { bg: '#3498db', text: '#ffffff' },
                'Resolved': { bg: '#27ae60', text: '#ffffff' },
                'Closed': { bg: '#95a5a6', text: '#ffffff' },
                'default': { bg: '#6c757d', text: '#ffffff' }
            };

            return STATUS_COLORS[status] || STATUS_COLORS['default'];
        }
    }
};

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersistentBannerBase;
}
