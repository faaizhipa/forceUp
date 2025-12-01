/**
 * PersistentBannerCforce - Simplified Persistent Banner for Clarivate/cforce Pages
 * 
 * A minimal banner showing only:
 * - Messages section
 * - Timezone fields (from Primary Metadata)
 * - Tools section (Color Picker, Text Formatter)
 * 
 * @module PersistentBannerCforce
 * @version 1.0.0
 */

const PersistentBannerCforce = {
    // ========== STATE ==========
    isInitialized: false,
    bannerId: 'exl-persistent-banner-cforce',
    elements: {},
    
    // Message state
    messageRotationInterval: null,
    currentMessageIndex: 0,
    activeMessages: [],
    messageSettings: null,
    
    // Timezone state
    customerTimezone: null,
    customerTimeInterval: null,
    
    // Popup state
    activePopup: null,
    popupCloseHandler: null,
    
    // Color picker state
    colorPickerModal: null,
    
    // Message hover/edit state
    messageHoverPopup: null,
    messageContextMenu: null,
    editModal: null,
    
    // Tracked resources for cleanup
    trackedTimers: [],
    trackedListeners: [],
    trackedObservers: [],
    
    // ========== INITIALIZATION ==========
    
    /**
     * Initialize the Clarivate banner
     */
    async init() {
        if (this.isInitialized) {
            console.log('[PersistentBannerCforce] Already initialized');
            return;
        }
        
        try {
            console.log('[PersistentBannerCforce] Initializing...');
            
            // Load message settings
            await this.loadMessageSettings();
            
            // Create and inject banner
            const banner = this.createBanner();
            document.body.appendChild(banner);
            document.body.classList.add('exl-banner-active-cforce');
            
            // Cache elements
            this.cacheElements();
            
            // Wire up event handlers
            this.wireEventHandlers();
            
            // Load messages
            await this.loadMessages();
            
            // Setup storage change listener for cross-banner sync
            this.setupStorageListener();
            
            // Start customer time update
            this.startCustomerTimeUpdate();
            
            this.isInitialized = true;
            console.log('[PersistentBannerCforce] Initialized successfully');
            
        } catch (error) {
            console.error('[PersistentBannerCforce] Initialization failed:', error);
        }
    },
    
    /**
     * Create the banner DOM structure
     */
    createBanner() {
        const banner = document.createElement('div');
        banner.id = this.bannerId;
        banner.className = 'exl-persistent-banner-cforce';
        
        banner.innerHTML = `
            <div class="exl-banner-container-cforce">
                <!-- Timezone Section -->
                <div class="exl-banner-section-cforce exl-banner-timezone-cforce">
                    <div class="exl-banner-label-cforce">Time<br>Zone</div>
                    <div class="exl-banner-timezone-grid-cforce">
                        <span class="exl-banner-meta-item-cforce">
                            <span class="exl-meta-label-cforce">Timezone:</span>
                            <strong id="exl-banner-timezone-cforce">—</strong>
                        </span>
                        <span class="exl-banner-meta-item-cforce">
                            <span class="exl-meta-label-cforce">Customer Time:</span>
                            <strong id="exl-banner-customer-time-cforce">—</strong>
                        </span>
                    </div>
                </div>
                
                <!-- Messages Section -->
                <div class="exl-banner-section-cforce exl-banner-messages-cforce" id="exl-banner-messages-cforce">
                    <div class="exl-banner-label-cforce">Messages</div>
                    <div class="exl-banner-message-content-cforce" id="exl-banner-message-content-cforce">
                        <span class="message-placeholder">No messages</span>
                    </div>
                    <div class="exl-banner-message-nav-cforce">
                        <button class="exl-banner-nav-btn-cforce" id="exl-message-prev-cforce" title="Previous message" tabindex="0">◀</button>
                        <span class="exl-banner-message-index-cforce" id="exl-message-index-cforce">0/0</span>
                        <button class="exl-banner-nav-btn-cforce" id="exl-message-next-cforce" title="Next message" tabindex="0">▶</button>
                    </div>
                </div>
                
                <!-- Tools Section -->
                <div class="exl-banner-section-cforce exl-banner-actions-cforce">
                    <button class="exl-banner-btn-cforce exl-popup-trigger-cforce" data-popup="tools" title="Open Tools menu" tabindex="0">Tools</button>
                </div>
                
                <!-- Tools Popup Menu -->
                <div class="exl-popup-menu-cforce" id="exl-tools-popup-cforce" style="display: none;">
                    <div class="exl-popup-menu-content-cforce">
                        <button class="exl-popup-menu-item-cforce" data-tool="color-settings" title="Configure status colors" tabindex="0">Color Settings</button>
                        <button class="exl-popup-menu-item-cforce" data-tool="text-formatter" title="Text formatting options" tabindex="0">Text Formatter</button>
                        <div class="exl-popup-menu-divider-cforce"></div>
                        <button class="exl-popup-menu-item-cforce" data-tool="manage-messages" title="Manage banner messages" tabindex="0">Manage Messages</button>
                    </div>
                </div>
            </div>
        `;
        
        this.elements.banner = banner;
        return banner;
    },
    
    /**
     * Cache element references
     */
    cacheElements() {
        const banner = this.elements.banner;
        
        this.elements.timezoneDisplay = banner.querySelector('#exl-banner-timezone-cforce');
        this.elements.customerTimeDisplay = banner.querySelector('#exl-banner-customer-time-cforce');
        this.elements.messagesSection = banner.querySelector('#exl-banner-messages-cforce');
        this.elements.messageContent = banner.querySelector('#exl-banner-message-content-cforce');
        this.elements.messageIndex = banner.querySelector('#exl-message-index-cforce');
        this.elements.prevBtn = banner.querySelector('#exl-message-prev-cforce');
        this.elements.nextBtn = banner.querySelector('#exl-message-next-cforce');
        this.elements.toolsPopup = banner.querySelector('#exl-tools-popup-cforce');
    },
    
    /**
     * Wire up event handlers
     */
    wireEventHandlers() {
        const banner = this.elements.banner;
        
        // Popup triggers
        banner.querySelectorAll('.exl-popup-trigger-cforce').forEach(btn => {
            const handler = (e) => {
                e.stopPropagation();
                const popupType = btn.dataset.popup;
                this.togglePopup(popupType);
            };
            btn.addEventListener('click', handler);
            this.trackedListeners.push({ element: btn, event: 'click', handler });
        });
        
        // Message navigation
        if (this.elements.prevBtn) {
            const prevHandler = () => this.showPreviousMessage();
            this.elements.prevBtn.addEventListener('click', prevHandler);
            this.trackedListeners.push({ element: this.elements.prevBtn, event: 'click', handler: prevHandler });
        }
        
        if (this.elements.nextBtn) {
            const nextHandler = () => this.showNextMessage();
            this.elements.nextBtn.addEventListener('click', nextHandler);
            this.trackedListeners.push({ element: this.elements.nextBtn, event: 'click', handler: nextHandler });
        }
        
        // Tool menu items
        banner.querySelectorAll('.exl-popup-menu-item-cforce').forEach(item => {
            const handler = (e) => {
                e.stopPropagation();
                const tool = item.dataset.tool;
                this.handleToolAction(tool);
                this.closeAllPopups();
            };
            item.addEventListener('click', handler);
            this.trackedListeners.push({ element: item, event: 'click', handler });
        });
        
        // Close popups on outside click
        this.popupCloseHandler = (e) => {
            if (this.activePopup && !e.target.closest('.exl-popup-menu-cforce') && !e.target.closest('.exl-popup-trigger-cforce')) {
                this.closeAllPopups();
            }
        };
        document.addEventListener('click', this.popupCloseHandler);
        this.trackedListeners.push({ element: document, event: 'click', handler: this.popupCloseHandler });
        
        // Escape key to close popups
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeAllPopups();
                this.closeColorPicker();
                this.closeMessageHoverPopup();
                this.closeMessageContextMenu();
                this.closeEditModal();
            }
        };
        document.addEventListener('keydown', escHandler);
        this.trackedListeners.push({ element: document, event: 'keydown', handler: escHandler });
        
        // Message hover and context menu handlers
        if (this.elements.messageContent) {
            // Hover handler
            const hoverHandler = (e) => this.showMessageHoverPopup(e);
            this.elements.messageContent.addEventListener('mouseenter', hoverHandler);
            this.trackedListeners.push({ element: this.elements.messageContent, event: 'mouseenter', handler: hoverHandler });
            
            const leaveHandler = () => {
                // Delay to allow moving to hover popup
                setTimeout(() => {
                    if (!this.messageHoverPopup?.matches(':hover')) {
                        this.closeMessageHoverPopup();
                    }
                }, 200);
            };
            this.elements.messageContent.addEventListener('mouseleave', leaveHandler);
            this.trackedListeners.push({ element: this.elements.messageContent, event: 'mouseleave', handler: leaveHandler });
            
            // Context menu handler
            const contextHandler = (e) => this.showMessageContextMenu(e);
            this.elements.messageContent.addEventListener('contextmenu', contextHandler);
            this.trackedListeners.push({ element: this.elements.messageContent, event: 'contextmenu', handler: contextHandler });
        }
    },
    
    // ========== POPUP MANAGEMENT ==========
    
    /**
     * Toggle popup visibility
     */
    togglePopup(popupType) {
        const popupId = `exl-${popupType}-popup-cforce`;
        const popup = this.elements.banner.querySelector(`#${popupId}`);
        
        if (!popup) return;
        
        const isOpen = popup.style.display !== 'none';
        
        // Close all popups first
        this.closeAllPopups();
        
        // Open if it was closed
        if (!isOpen) {
            popup.style.display = 'block';
            this.activePopup = popup;
        }
    },
    
    /**
     * Close all popups
     */
    closeAllPopups() {
        this.elements.banner.querySelectorAll('.exl-popup-menu-cforce').forEach(popup => {
            popup.style.display = 'none';
        });
        this.activePopup = null;
    },
    
    // ========== TOOL ACTIONS ==========
    
    /**
     * Handle tool action
     */
    handleToolAction(tool) {
        switch (tool) {
            case 'color-settings':
                this.openColorSettings();
                break;
            case 'text-formatter':
                this.openTextFormatter();
                break;
            case 'manage-messages':
                this.openMessageManager();
                break;
            default:
                console.log('[PersistentBannerCforce] Unknown tool:', tool);
        }
    },
    
    /**
     * Open color settings modal
     */
    openColorSettings() {
        // Use ColorPicker3D if available
        if (typeof ColorPicker3D !== 'undefined' && ColorPicker3D.show) {
            ColorPicker3D.show();
            return;
        }
        
        // Fallback: Create simple color picker modal
        this.createColorPickerModal();
    },
    
    /**
     * Create fallback color picker modal
     */
    createColorPickerModal() {
        // Remove existing modal
        this.closeColorPicker();
        
        const modal = document.createElement('div');
        modal.className = 'exl-color-picker-modal-cforce';
        modal.id = 'exl-color-picker-modal-cforce';
        
        // Get current colors from ColorHandlerConfig
        const colors = this.getStatusColors();
        
        let colorOptionsHTML = '';
        Object.entries(colors).forEach(([status, color]) => {
            colorOptionsHTML += `
                <div class="exl-color-option-cforce" data-status="${status}">
                    <div class="exl-color-preview-cforce" style="background-color: ${color}" data-color="${color}"></div>
                    <span class="exl-color-label-cforce">${status}</span>
                    <input type="text" class="exl-color-input-cforce" value="${color}" data-status="${status}">
                </div>
            `;
        });
        
        modal.innerHTML = `
            <div class="exl-color-picker-container-cforce">
                <div class="exl-color-picker-header-cforce">
                    <span class="exl-color-picker-title-cforce">Status Color Settings</span>
                    <button class="exl-color-picker-close-cforce" title="Close">&times;</button>
                </div>
                <div class="exl-color-options-list">
                    ${colorOptionsHTML}
                </div>
                <button class="exl-color-reset-btn-cforce">Reset to Defaults</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.colorPickerModal = modal;
        
        // Wire up color picker events
        this.wireColorPickerEvents(modal);
    },
    
    /**
     * Wire color picker events
     */
    wireColorPickerEvents(modal) {
        // Close button
        const closeBtn = modal.querySelector('.exl-color-picker-close-cforce');
        closeBtn.addEventListener('click', () => this.closeColorPicker());
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeColorPicker();
            }
        });
        
        // Color inputs
        modal.querySelectorAll('.exl-color-input-cforce').forEach(input => {
            input.addEventListener('change', (e) => {
                const status = e.target.dataset.status;
                const newColor = e.target.value;
                this.updateStatusColor(status, newColor);
                
                // Update preview
                const preview = e.target.closest('.exl-color-option-cforce').querySelector('.exl-color-preview-cforce');
                if (preview) {
                    preview.style.backgroundColor = newColor;
                }
            });
        });
        
        // Color preview click (open native picker)
        modal.querySelectorAll('.exl-color-preview-cforce').forEach(preview => {
            preview.addEventListener('click', () => {
                const input = preview.closest('.exl-color-option-cforce').querySelector('.exl-color-input-cforce');
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = this.rgbToHex(preview.style.backgroundColor);
                colorInput.addEventListener('change', (e) => {
                    input.value = e.target.value;
                    input.dispatchEvent(new Event('change'));
                });
                colorInput.click();
            });
        });
        
        // Reset button
        const resetBtn = modal.querySelector('.exl-color-reset-btn-cforce');
        resetBtn.addEventListener('click', () => {
            this.resetColorsToDefaults();
            this.closeColorPicker();
            this.createColorPickerModal(); // Reopen with defaults
        });
    },
    
    /**
     * Close color picker modal
     */
    closeColorPicker() {
        if (this.colorPickerModal) {
            this.colorPickerModal.remove();
            this.colorPickerModal = null;
        }
    },
    
    // ========== MESSAGE HOVER POPUP ==========
    
    /**
     * Show message hover popup with full message details
     */
    showMessageHoverPopup(event) {
        if (this.activeMessages.length === 0) return;
        
        // Close existing popup
        this.closeMessageHoverPopup();
        
        const message = this.activeMessages[this.currentMessageIndex];
        if (!message) return;
        
        const popup = document.createElement('div');
        popup.className = 'exl-message-hover-popup-cforce';
        popup.innerHTML = `
            <div class="exl-message-hover-header-cforce">
                <span class="exl-message-hover-title-cforce">Message Details</span>
                <button class="exl-message-hover-close-cforce" title="Close">&times;</button>
            </div>
            <div class="exl-message-hover-body-cforce">
                <div class="exl-message-hover-text-cforce">${this.escapeHtml(message.text || '')}</div>
                ${message.description ? `<div class="exl-message-hover-desc-cforce">${this.escapeHtml(message.description)}</div>` : ''}
            </div>
            <div class="exl-message-hover-footer-cforce">
                <span class="exl-message-hover-info-cforce">${this.currentMessageIndex + 1} of ${this.activeMessages.length}</span>
                <button class="exl-message-hover-edit-cforce" title="Edit message">Edit</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        this.messageHoverPopup = popup;
        
        // Position popup near message area
        const messageRect = this.elements.messageContent.getBoundingClientRect();
        popup.style.left = `${messageRect.left}px`;
        popup.style.top = `${messageRect.bottom + 8}px`;
        
        // Wire events
        popup.querySelector('.exl-message-hover-close-cforce').addEventListener('click', () => {
            this.closeMessageHoverPopup();
        });
        
        popup.querySelector('.exl-message-hover-edit-cforce').addEventListener('click', () => {
            this.closeMessageHoverPopup();
            this.showEditModal(this.currentMessageIndex);
        });
        
        // Keep popup open while hovering over it
        popup.addEventListener('mouseleave', () => {
            this.closeMessageHoverPopup();
        });
    },
    
    /**
     * Close message hover popup
     */
    closeMessageHoverPopup() {
        if (this.messageHoverPopup) {
            this.messageHoverPopup.remove();
            this.messageHoverPopup = null;
        }
    },
    
    // ========== MESSAGE CONTEXT MENU ==========
    
    /**
     * Show message context menu on right-click
     */
    showMessageContextMenu(event) {
        event.preventDefault();
        
        if (this.activeMessages.length === 0) return;
        
        // Close existing context menu
        this.closeMessageContextMenu();
        
        const menu = document.createElement('div');
        menu.className = 'exl-message-context-menu-cforce';
        menu.innerHTML = `
            <div class="exl-context-menu-item-cforce" data-action="edit">
                <span class="exl-context-icon-cforce">✏️</span>
                <span>Edit Message</span>
            </div>
            <div class="exl-context-menu-item-cforce" data-action="copy">
                <span class="exl-context-icon-cforce">📋</span>
                <span>Copy Text</span>
            </div>
            <div class="exl-context-menu-divider-cforce"></div>
            <div class="exl-context-menu-item-cforce" data-action="add">
                <span class="exl-context-icon-cforce">➕</span>
                <span>Add New Message</span>
            </div>
            <div class="exl-context-menu-item-cforce exl-context-danger-cforce" data-action="delete">
                <span class="exl-context-icon-cforce">🗑️</span>
                <span>Delete Message</span>
            </div>
            <div class="exl-context-menu-divider-cforce"></div>
            <div class="exl-context-menu-item-cforce" data-action="manage">
                <span class="exl-context-icon-cforce">⚙️</span>
                <span>Manage All Messages</span>
            </div>
        `;
        
        document.body.appendChild(menu);
        this.messageContextMenu = menu;
        
        // Position menu at click location
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        
        // Adjust if menu would go off-screen
        const menuRect = menu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
        }
        if (menuRect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
        }
        
        // Wire menu item events
        menu.querySelectorAll('.exl-context-menu-item-cforce').forEach(item => {
            item.addEventListener('click', async () => {
                const action = item.dataset.action;
                this.closeMessageContextMenu();
                
                switch (action) {
                    case 'edit':
                        this.showEditModal(this.currentMessageIndex);
                        break;
                    case 'copy':
                        const message = this.activeMessages[this.currentMessageIndex];
                        if (message) {
                            await this.copyToClipboard(message.text);
                        }
                        break;
                    case 'add':
                        this.showEditModal(-1); // -1 indicates new message
                        break;
                    case 'delete':
                        this.deleteCurrentMessage();
                        break;
                    case 'manage':
                        this.openMessageManager();
                        break;
                }
            });
        });
        
        // Close on outside click
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                this.closeMessageContextMenu();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
        }, 0);
    },
    
    /**
     * Close message context menu
     */
    closeMessageContextMenu() {
        if (this.messageContextMenu) {
            this.messageContextMenu.remove();
            this.messageContextMenu = null;
        }
    },
    
    // ========== MESSAGE EDIT MODAL ==========
    
    /**
     * Show edit modal for message
     * @param {number} index - Message index, or -1 for new message
     */
    showEditModal(index) {
        this.closeEditModal();
        
        const isNew = index === -1;
        const message = isNew ? { text: '', description: '', enabled: true } : this.activeMessages[index];
        
        if (!message) return;
        
        const modal = document.createElement('div');
        modal.className = 'exl-modal-overlay-cforce';
        modal.id = 'exl-message-edit-modal-cforce';
        
        modal.innerHTML = `
            <div class="exl-modal-content-cforce exl-message-edit-modal-cforce">
                <div class="exl-modal-header-cforce">
                    <span class="exl-modal-title-cforce">${isNew ? 'Add New Message' : 'Edit Message'}</span>
                    <button class="exl-modal-close-cforce" title="Close">&times;</button>
                </div>
                <div class="exl-modal-body-cforce">
                    <div class="exl-form-group-cforce">
                        <label class="exl-form-label-cforce">Message Text:</label>
                        <textarea class="exl-form-textarea-cforce" id="exl-edit-message-text-cforce" rows="4" placeholder="Enter message text...">${this.escapeHtml(message.text || '')}</textarea>
                    </div>
                    <div class="exl-form-group-cforce">
                        <label class="exl-form-label-cforce">Description (optional):</label>
                        <input type="text" class="exl-form-input-cforce" id="exl-edit-message-desc-cforce" placeholder="Brief description..." value="${this.escapeHtml(message.description || '')}">
                    </div>
                    <div class="exl-form-group-cforce">
                        <label class="exl-form-checkbox-cforce">
                            <input type="checkbox" id="exl-edit-message-enabled-cforce" ${message.enabled !== false ? 'checked' : ''}>
                            <span>Enabled</span>
                        </label>
                    </div>
                </div>
                <div class="exl-modal-actions-cforce">
                    <button class="exl-btn-cforce exl-btn-secondary-cforce" id="exl-edit-cancel-cforce">Cancel</button>
                    <button class="exl-btn-cforce exl-btn-primary-cforce" id="exl-edit-save-cforce">Save</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.editModal = modal;
        
        // Wire events
        modal.querySelector('.exl-modal-close-cforce').addEventListener('click', () => {
            this.closeEditModal();
        });
        
        modal.querySelector('#exl-edit-cancel-cforce').addEventListener('click', () => {
            this.closeEditModal();
        });
        
        modal.querySelector('#exl-edit-save-cforce').addEventListener('click', async () => {
            const text = modal.querySelector('#exl-edit-message-text-cforce').value.trim();
            const description = modal.querySelector('#exl-edit-message-desc-cforce').value.trim();
            const enabled = modal.querySelector('#exl-edit-message-enabled-cforce').checked;
            
            if (!text) {
                alert('Message text is required.');
                return;
            }
            
            await this.saveMessage(index, { text, description, enabled });
            this.closeEditModal();
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeEditModal();
            }
        });
        
        // Focus textarea
        modal.querySelector('#exl-edit-message-text-cforce').focus();
    },
    
    /**
     * Close edit modal
     */
    closeEditModal() {
        if (this.editModal) {
            this.editModal.remove();
            this.editModal = null;
        }
    },
    
    /**
     * Save message to storage
     * @param {number} index - Message index, or -1 for new
     * @param {Object} messageData - Message data
     */
    async saveMessage(index, messageData) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['exl_bannerMessages'], (result) => {
                const messages = result.exl_bannerMessages || [];
                
                if (index === -1) {
                    // Add new message
                    messages.push({
                        id: Date.now().toString(),
                        ...messageData,
                        createdAt: new Date().toISOString()
                    });
                } else {
                    // Update existing message
                    const existingId = this.activeMessages[index]?.id;
                    const globalIndex = messages.findIndex(m => m.id === existingId);
                    if (globalIndex !== -1) {
                        messages[globalIndex] = {
                            ...messages[globalIndex],
                            ...messageData,
                            updatedAt: new Date().toISOString()
                        };
                    }
                }
                
                chrome.storage.local.set({ exl_bannerMessages: messages }, () => {
                    this.loadMessages();
                    resolve();
                });
            });
        });
    },
    
    /**
     * Delete current message
     */
    async deleteCurrentMessage() {
        if (this.activeMessages.length === 0) return;
        
        const message = this.activeMessages[this.currentMessageIndex];
        if (!message) return;
        
        if (!confirm(`Delete this message?\n\n"${message.text.substring(0, 50)}${message.text.length > 50 ? '...' : ''}"`)) {
            return;
        }
        
        return new Promise((resolve) => {
            chrome.storage.local.get(['exl_bannerMessages'], (result) => {
                let messages = result.exl_bannerMessages || [];
                messages = messages.filter(m => m.id !== message.id);
                
                chrome.storage.local.set({ exl_bannerMessages: messages }, () => {
                    this.currentMessageIndex = Math.max(0, this.currentMessageIndex - 1);
                    this.loadMessages();
                    resolve();
                });
            });
        });
    },
    
    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            console.log('[PersistentBannerCforce] Copied to clipboard');
        } catch (error) {
            console.error('[PersistentBannerCforce] Copy failed:', error);
        }
    },
    
    // ========== SHOW COLOR PICKER MODAL (Public API) ==========
    
    /**
     * Show color picker modal (public method for external use)
     * @param {Object} options - Options for color picker
     * @param {string} options.currentColor - Current color in RGB format
     * @returns {Promise<string|null>} Selected color or null if cancelled
     */
    showColorPickerModal(options = {}) {
        return new Promise((resolve) => {
            const { currentColor = 'rgb(128, 128, 128)' } = options;
            
            // Try ColorPicker3D first
            if (typeof ColorPicker3D !== 'undefined' && ColorPicker3D.show) {
                ColorPicker3D.show({
                    initialColor: currentColor,
                    onSelect: (color) => resolve(color),
                    onCancel: () => resolve(null)
                });
                return;
            }
            
            // Fallback: Create simple color picker
            const overlay = document.createElement('div');
            overlay.className = 'exl-modal-overlay-cforce';
            overlay.id = 'exl-color-picker-overlay-cforce';
            
            const modal = document.createElement('div');
            modal.className = 'exl-modal-content-cforce';
            modal.style.maxWidth = '320px';
            modal.innerHTML = `
                <div class="exl-modal-header-cforce">
                    <span class="exl-modal-title-cforce">Select Color</span>
                    <button class="exl-modal-close-cforce" id="exl-color-modal-close-cforce">&times;</button>
                </div>
                <div class="exl-modal-body-cforce" style="text-align: center; padding: 20px;">
                    <input type="color" id="exl-color-modal-input-cforce" value="${this.rgbToHex(currentColor)}" style="width: 100px; height: 60px; border: none; cursor: pointer;">
                    <p style="margin: 12px 0 0; font-size: 12px; color: #888;">Click to choose a color</p>
                </div>
                <div class="exl-modal-actions-cforce">
                    <button class="exl-btn-cforce exl-btn-secondary-cforce" id="exl-color-modal-cancel-cforce">Cancel</button>
                    <button class="exl-btn-cforce exl-btn-primary-cforce" id="exl-color-modal-apply-cforce">Apply</button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            const colorInput = modal.querySelector('#exl-color-modal-input-cforce');
            
            // Close button
            modal.querySelector('#exl-color-modal-close-cforce').addEventListener('click', () => {
                overlay.remove();
                resolve(null);
            });
            
            // Cancel button
            modal.querySelector('#exl-color-modal-cancel-cforce').addEventListener('click', () => {
                overlay.remove();
                resolve(null);
            });
            
            // Apply button
            modal.querySelector('#exl-color-modal-apply-cforce').addEventListener('click', () => {
                const hex = colorInput.value;
                overlay.remove();
                resolve(this.hexToRgb(hex));
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
    
    /**
     * Convert hex to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result 
            ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`
            : 'rgb(128, 128, 128)';
    },
    
    /**
     * Get status colors from ColorHandlerConfig or defaults
     */
    getStatusColors() {
        if (typeof ColorHandlerConfig !== 'undefined' && ColorHandlerConfig.getStatusColors) {
            return ColorHandlerConfig.getStatusColors();
        }
        
        // Default colors
        return {
            'New': 'rgb(206, 58, 85)',
            'In Progress': 'rgb(234, 118, 62)',
            'Pending': 'rgb(55, 148, 255)',
            'Closed': 'rgb(55, 148, 255)',
            'Resolved': 'rgb(0, 128, 0)'
        };
    },
    
    /**
     * Update status color
     */
    updateStatusColor(status, color) {
        if (typeof ColorHandlerConfig !== 'undefined' && ColorHandlerConfig.setStatusColor) {
            ColorHandlerConfig.setStatusColor(status, color);
        }
        console.log('[PersistentBannerCforce] Updated color for', status, 'to', color);
    },
    
    /**
     * Reset colors to defaults
     */
    resetColorsToDefaults() {
        if (typeof ColorHandlerConfig !== 'undefined' && ColorHandlerConfig.resetToDefaults) {
            ColorHandlerConfig.resetToDefaults();
        }
        console.log('[PersistentBannerCforce] Colors reset to defaults');
    },
    
    /**
     * Convert RGB to Hex
     */
    rgbToHex(rgb) {
        if (rgb.startsWith('#')) return rgb;
        
        const match = rgb.match(/\d+/g);
        if (!match || match.length < 3) return '#000000';
        
        const r = parseInt(match[0]).toString(16).padStart(2, '0');
        const g = parseInt(match[1]).toString(16).padStart(2, '0');
        const b = parseInt(match[2]).toString(16).padStart(2, '0');
        
        return `#${r}${g}${b}`;
    },
    
    /**
     * Open text formatter
     */
    openTextFormatter() {
        // Create text formatter modal
        this.createTextFormatterModal();
    },
    
    /**
     * Create text formatter modal
     */
    createTextFormatterModal() {
        // Remove existing modal
        const existing = document.getElementById('exl-text-formatter-modal-cforce');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.className = 'exl-modal-overlay-cforce';
        modal.id = 'exl-text-formatter-modal-cforce';
        
        // Get available styles from TextFormatter or use defaults
        const styles = typeof TextFormatter !== 'undefined' && TextFormatter.characterMaps
            ? Object.keys(TextFormatter.characterMaps).filter(s => s !== 'normal')
            : ['bold', 'boldItalic', 'italic', 'boldSerif', 'code'];
        
        let styleOptionsHTML = styles.map(style => {
            const displayName = style.replace(/([A-Z])/g, ' $1').trim();
            const sampleText = this.convertSampleText('Sample Text', style);
            return `
                <button class="exl-text-style-btn-cforce" data-style="${style}" title="${displayName}">
                    <span class="exl-style-preview-cforce">${sampleText}</span>
                    <span class="exl-style-name-cforce">${displayName}</span>
                </button>
            `;
        }).join('');
        
        // Get bullet symbols
        const symbols = typeof TextFormatter !== 'undefined' && TextFormatter.symbols
            ? TextFormatter.symbols
            : ['▪', '∘', '▫', '►', '▻', '▸', '▹', '▿', '▾', '⋯', '⋮'];
        
        let symbolsHTML = symbols.map(sym => `
            <button class="exl-symbol-btn-cforce" data-symbol="${sym}" title="Insert ${sym}">${sym}</button>
        `).join('');
        
        modal.innerHTML = `
            <div class="exl-modal-content-cforce exl-text-formatter-modal-cforce">
                <div class="exl-modal-header-cforce">
                    <span class="exl-modal-title-cforce">Text Formatter</span>
                    <button class="exl-modal-close-cforce" title="Close">&times;</button>
                </div>
                <div class="exl-modal-body-cforce">
                    <!-- Input Section -->
                    <div class="exl-form-group-cforce">
                        <label class="exl-form-label-cforce">Input Text:</label>
                        <textarea class="exl-form-textarea-cforce" id="exl-formatter-input-cforce" rows="3" placeholder="Enter text to format..."></textarea>
                    </div>
                    
                    <!-- Style Buttons -->
                    <div class="exl-form-group-cforce">
                        <label class="exl-form-label-cforce">Apply Style:</label>
                        <div class="exl-style-buttons-cforce">
                            ${styleOptionsHTML}
                        </div>
                    </div>
                    
                    <!-- Symbols -->
                    <div class="exl-form-group-cforce">
                        <label class="exl-form-label-cforce">Insert Symbol:</label>
                        <div class="exl-symbol-buttons-cforce">
                            ${symbolsHTML}
                        </div>
                    </div>
                    
                    <!-- Output Section -->
                    <div class="exl-form-group-cforce">
                        <label class="exl-form-label-cforce">Formatted Output:</label>
                        <textarea class="exl-form-textarea-cforce" id="exl-formatter-output-cforce" rows="3" readonly placeholder="Formatted text will appear here..."></textarea>
                    </div>
                    
                    <!-- Actions -->
                    <div class="exl-modal-actions-cforce">
                        <button class="exl-btn-cforce exl-btn-secondary-cforce" id="exl-formatter-clear-cforce">Clear</button>
                        <button class="exl-btn-cforce exl-btn-primary-cforce" id="exl-formatter-copy-cforce">Copy Output</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Wire up events
        this.wireTextFormatterEvents(modal);
    },
    
    /**
     * Convert sample text for style preview
     */
    convertSampleText(text, style) {
        if (typeof TextFormatter !== 'undefined' && TextFormatter.convertToStyle) {
            return TextFormatter.convertToStyle(text, style);
        }
        return text;
    },
    
    /**
     * Wire text formatter events
     */
    wireTextFormatterEvents(modal) {
        const inputEl = modal.querySelector('#exl-formatter-input-cforce');
        const outputEl = modal.querySelector('#exl-formatter-output-cforce');
        const closeBtn = modal.querySelector('.exl-modal-close-cforce');
        const clearBtn = modal.querySelector('#exl-formatter-clear-cforce');
        const copyBtn = modal.querySelector('#exl-formatter-copy-cforce');
        
        // Close button
        closeBtn.addEventListener('click', () => modal.remove());
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        // Style buttons
        modal.querySelectorAll('.exl-text-style-btn-cforce').forEach(btn => {
            btn.addEventListener('click', () => {
                const style = btn.dataset.style;
                const inputText = inputEl.value;
                
                if (!inputText.trim()) {
                    outputEl.value = '';
                    return;
                }
                
                const formatted = this.convertSampleText(inputText, style);
                outputEl.value = formatted;
            });
        });
        
        // Symbol buttons
        modal.querySelectorAll('.exl-symbol-btn-cforce').forEach(btn => {
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
                alert('Nothing to copy. Please format some text first.');
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
                console.error('[PersistentBannerCforce] Copy failed:', error);
                alert('Failed to copy. Please copy manually.');
            }
        });
        
        // Focus input
        inputEl.focus();
    },
    
    /**
     * Open message manager
     */
    openMessageManager() {
        // Create message manager modal
        const existing = document.getElementById('exl-message-manager-modal-cforce');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.className = 'exl-modal-overlay-cforce';
        modal.id = 'exl-message-manager-modal-cforce';
        
        modal.innerHTML = `
            <div class="exl-modal-content-cforce exl-message-manager-modal-cforce">
                <div class="exl-modal-header-cforce">
                    <span class="exl-modal-title-cforce">Message Manager</span>
                    <button class="exl-modal-close-cforce" title="Close">&times;</button>
                </div>
                <div class="exl-modal-body-cforce">
                    <div class="exl-message-list-cforce" id="exl-message-list-cforce">
                        <!-- Messages will be populated here -->
                    </div>
                </div>
                <div class="exl-modal-actions-cforce">
                    <button class="exl-btn-cforce exl-btn-secondary-cforce" id="exl-msg-manager-add-cforce">➕ Add Message</button>
                    <button class="exl-btn-cforce exl-btn-secondary-cforce" id="exl-msg-manager-close-cforce">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Populate message list
        this.populateMessageManagerList(modal);
        
        // Wire events
        modal.querySelector('.exl-modal-close-cforce').addEventListener('click', () => modal.remove());
        modal.querySelector('#exl-msg-manager-close-cforce').addEventListener('click', () => modal.remove());
        modal.querySelector('#exl-msg-manager-add-cforce').addEventListener('click', () => {
            modal.remove();
            this.showEditModal(-1);
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },
    
    /**
     * Populate message manager list
     */
    populateMessageManagerList(modal) {
        const listContainer = modal.querySelector('#exl-message-list-cforce');
        
        chrome.storage.local.get(['exl_bannerMessages'], (result) => {
            const messages = result.exl_bannerMessages || [];
            
            if (messages.length === 0) {
                listContainer.innerHTML = `
                    <div class="exl-message-empty-cforce">
                        <p>No messages yet.</p>
                        <p>Click "Add Message" to create your first message.</p>
                    </div>
                `;
                return;
            }
            
            listContainer.innerHTML = messages.map((msg, index) => `
                <div class="exl-message-item-cforce" data-index="${index}" data-id="${msg.id}">
                    <div class="exl-message-item-content-cforce">
                        <div class="exl-message-item-text-cforce">${this.escapeHtml(msg.text.substring(0, 80))}${msg.text.length > 80 ? '...' : ''}</div>
                        ${msg.description ? `<div class="exl-message-item-desc-cforce">${this.escapeHtml(msg.description)}</div>` : ''}
                    </div>
                    <div class="exl-message-item-actions-cforce">
                        <label class="exl-message-toggle-cforce">
                            <input type="checkbox" data-action="toggle" ${msg.enabled !== false ? 'checked' : ''}>
                            <span>Enabled</span>
                        </label>
                        <button class="exl-btn-icon-cforce" data-action="edit" title="Edit">✏️</button>
                        <button class="exl-btn-icon-cforce exl-btn-danger-cforce" data-action="delete" title="Delete">🗑️</button>
                    </div>
                </div>
            `).join('');
            
            // Wire item events
            listContainer.querySelectorAll('.exl-message-item-cforce').forEach((item) => {
                const messageId = item.dataset.id;
                
                // Toggle enabled
                const toggle = item.querySelector('[data-action="toggle"]');
                toggle?.addEventListener('change', (e) => {
                    this.toggleMessageEnabled(messageId, e.target.checked);
                });
                
                // Edit button
                const editBtn = item.querySelector('[data-action="edit"]');
                editBtn?.addEventListener('click', () => {
                    const msgIndex = this.activeMessages.findIndex(m => m.id === messageId);
                    modal.remove();
                    this.showEditModal(msgIndex >= 0 ? msgIndex : parseInt(item.dataset.index));
                });
                
                // Delete button
                const deleteBtn = item.querySelector('[data-action="delete"]');
                deleteBtn?.addEventListener('click', () => {
                    this.deleteMessageById(messageId, modal);
                });
            });
        });
    },
    
    /**
     * Toggle message enabled state
     */
    toggleMessageEnabled(messageId, enabled) {
        chrome.storage.local.get(['exl_bannerMessages'], (result) => {
            const messages = result.exl_bannerMessages || [];
            const index = messages.findIndex(m => m.id === messageId);
            
            if (index !== -1) {
                messages[index].enabled = enabled;
                chrome.storage.local.set({ exl_bannerMessages: messages }, () => {
                    this.loadMessages();
                });
            }
        });
    },
    
    /**
     * Delete message by ID
     */
    deleteMessageById(messageId, modal) {
        if (!confirm('Delete this message?')) return;
        
        chrome.storage.local.get(['exl_bannerMessages'], (result) => {
            let messages = result.exl_bannerMessages || [];
            messages = messages.filter(m => m.id !== messageId);
            
            chrome.storage.local.set({ exl_bannerMessages: messages }, () => {
                this.loadMessages();
                if (modal) {
                    this.populateMessageManagerList(modal);
                }
            });
        });
    },
    
    // ========== MESSAGE MANAGEMENT ==========
    
    /**
     * Load message settings from storage
     */
    async loadMessageSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['bannerMessageSettings'], (result) => {
                this.messageSettings = result.bannerMessageSettings || {
                    rotationEnabled: true,
                    rotationInterval: 5000,
                    showDescriptions: true
                };
                resolve();
            });
        });
    },
    
    /**
     * Load messages from storage
     */
    async loadMessages() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['exl_bannerMessages'], (result) => {
                const messages = result.exl_bannerMessages || [];
                this.activeMessages = messages.filter(m => m.enabled !== false);
                this.updateMessageDisplay();
                
                // Start rotation if enabled and multiple messages
                if (this.messageSettings?.rotationEnabled && this.activeMessages.length > 1) {
                    this.startMessageRotation();
                }
                
                resolve();
            });
        });
    },
    
    /**
     * Setup storage listener for cross-banner message sync
     */
    setupStorageListener() {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            // Listen for message changes in local storage
            if (areaName === 'local' && changes.exl_bannerMessages) {
                console.log('[PersistentBannerCforce] Messages changed in storage, reloading...');
                this.loadMessages();
            }
            
            // Listen for settings changes in sync storage
            if (areaName === 'sync' && changes.bannerMessageSettings) {
                console.log('[PersistentBannerCforce] Message settings changed, reloading...');
                this.loadMessageSettings().then(() => {
                    this.loadMessages();
                });
            }
        });
    },
    
    /**
     * Update message display
     */
    updateMessageDisplay() {
        if (!this.elements.messageContent) return;
        
        if (this.activeMessages.length === 0) {
            this.elements.messageContent.innerHTML = '<span class="message-placeholder">No messages</span>';
            this.elements.messageIndex.textContent = '0/0';
            this.elements.prevBtn.disabled = true;
            this.elements.nextBtn.disabled = true;
            return;
        }
        
        const message = this.activeMessages[this.currentMessageIndex];
        if (!message) return;
        
        // Render message
        const showDesc = this.messageSettings?.showDescriptions !== false;
        this.elements.messageContent.innerHTML = this.renderMessage(message.text, message.description, showDesc);
        
        // Update index
        this.elements.messageIndex.textContent = `${this.currentMessageIndex + 1}/${this.activeMessages.length}`;
        
        // Update nav buttons
        this.elements.prevBtn.disabled = this.activeMessages.length <= 1;
        this.elements.nextBtn.disabled = this.activeMessages.length <= 1;
    },
    
    /**
     * Render message HTML
     * Uses PersistentBannerBase.BannerMessageManager for rendering
     */
    renderMessage(text, description = '', showDescription = true) {
        return PersistentBannerBase.BannerMessageManager.renderMessageHtml(text, description, showDescription, 'cforce');
    },
    
    /**
     * Escape HTML entities
     * Delegates to PersistentBannerBase.BannerMessageManager
     */
    escapeHtml(text) {
        return PersistentBannerBase.BannerMessageManager.escapeHtml(text);
    },
    
    /**
     * Show previous message
     */
    showPreviousMessage() {
        if (this.activeMessages.length <= 1) return;
        
        this.currentMessageIndex = (this.currentMessageIndex - 1 + this.activeMessages.length) % this.activeMessages.length;
        this.updateMessageDisplay();
        
        // Reset rotation timer
        this.restartMessageRotation();
    },
    
    /**
     * Show next message
     */
    showNextMessage() {
        if (this.activeMessages.length <= 1) return;
        
        this.currentMessageIndex = (this.currentMessageIndex + 1) % this.activeMessages.length;
        this.updateMessageDisplay();
        
        // Reset rotation timer
        this.restartMessageRotation();
    },
    
    /**
     * Start message rotation
     */
    startMessageRotation() {
        this.stopMessageRotation();
        
        const interval = this.messageSettings?.rotationInterval || 5000;
        this.messageRotationInterval = setInterval(() => {
            this.showNextMessage();
        }, interval);
        
        this.trackedTimers.push(this.messageRotationInterval);
    },
    
    /**
     * Stop message rotation
     */
    stopMessageRotation() {
        if (this.messageRotationInterval) {
            clearInterval(this.messageRotationInterval);
            this.messageRotationInterval = null;
        }
    },
    
    /**
     * Restart message rotation
     */
    restartMessageRotation() {
        if (this.messageSettings?.rotationEnabled && this.activeMessages.length > 1) {
            this.startMessageRotation();
        }
    },
    
    // ========== TIMEZONE MANAGEMENT ==========
    
    /**
     * Update timezone display
     */
    updateTimezone(timezone) {
        this.customerTimezone = timezone;
        
        if (this.elements.timezoneDisplay) {
            this.elements.timezoneDisplay.textContent = timezone || '—';
        }
        
        // Update customer time
        this.updateCustomerTime();
    },
    
    /**
     * Update customer time display
     * Uses PersistentBannerBase.BannerTimezoneManager for formatting
     */
    updateCustomerTime() {
        if (!this.elements.customerTimeDisplay) return;
        
        const formattedTime = PersistentBannerBase.BannerTimezoneManager.formatCustomerTime(this.customerTimezone);
        this.elements.customerTimeDisplay.textContent = formattedTime;
    },
    
    /**
     * Start customer time update interval
     */
    startCustomerTimeUpdate() {
        // Update immediately
        this.updateCustomerTime();
        
        // Update every minute
        this.customerTimeInterval = setInterval(() => {
            this.updateCustomerTime();
        }, 60000);
        
        this.trackedTimers.push(this.customerTimeInterval);
    },
    
    // ========== CLEANUP ==========
    
    /**
     * Cleanup and destroy the banner
     */
    cleanup() {
        console.log('[PersistentBannerCforce] Cleaning up...');
        
        // Stop timers
        this.trackedTimers.forEach(timer => {
            clearInterval(timer);
            clearTimeout(timer);
        });
        this.trackedTimers = [];
        
        // Remove event listeners
        this.trackedListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.trackedListeners = [];
        
        // Disconnect observers
        this.trackedObservers.forEach(observer => {
            observer.disconnect();
        });
        this.trackedObservers = [];
        
        // Close modals
        this.closeColorPicker();
        this.closeAllPopups();
        
        // Remove banner
        if (this.elements.banner) {
            this.elements.banner.remove();
        }
        
        // Remove body class
        document.body.classList.remove('exl-banner-active-cforce');
        
        this.isInitialized = false;
        console.log('[PersistentBannerCforce] Cleanup complete');
    }
};

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersistentBannerCforce;
}
