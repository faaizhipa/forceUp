/**
 * AccountAddressExtractor Module
 * Extracts customer address from hover panel or Account page to determine timezone
 */

const AccountAddressExtractor = {
    hoverPanelObserver: null,
    addressCache: new Map(),
    lastExtractedAddress: null,

    /**
     * Initialize the address extractor
     */
    init() {
        console.log('[AccountAddressExtractor] Initializing...');
        this.observeHoverPanels();
    },

    /**
     * Watch for hover panels (previews) to appear in the DOM
     */
    observeHoverPanels() {
        // Disconnect existing observer if any
        if (this.hoverPanelObserver) {
            this.hoverPanelObserver.disconnect();
        }

        this.hoverPanelObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if it's a hover panel for Account preview
                        if (node.classList?.contains('forceHoverPanel')) {
                            this.handleHoverPanelAppeared(node);
                        }
                        
                        // Also check children
                        const hoverPanel = node.querySelector?.('.forceHoverPanel');
                        if (hoverPanel) {
                            this.handleHoverPanelAppeared(hoverPanel);
                        }
                    }
                });
            });
        });

        this.hoverPanelObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('[AccountAddressExtractor] Hover panel observer initialized');
    },

    /**
     * Handle when a hover panel appears
     * @param {Element} panel
     */
    handleHoverPanelAppeared(panel) {
        // Wait a moment for content to render
        setTimeout(() => {
            const address = this.extractAddressFromPanel(panel);
            if (address) {
                const accountName = this.extractAccountNameFromPanel(panel);
                console.log('[AccountAddressExtractor] Extracted address from hover panel:', accountName, address);
                
                this.lastExtractedAddress = {
                    accountName,
                    address,
                    timestamp: new Date().toISOString()
                };

                // Cache the address
                if (accountName) {
                    this.addressCache.set(accountName, address);
                }

                // Notify listeners if any
                this.notifyAddressExtracted(accountName, address);
            }
        }, 300);
    },

    /**
     * Extract account name from hover panel
     * @param {Element} panel
     * @returns {string|null}
     */
    extractAccountNameFromPanel(panel) {
        // Look for the account name in the header
        const headerSelectors = [
            '.primaryField.highlightsH2',
            'h2.primaryField',
            '.primaryFieldWrapper h2'
        ];

        for (const selector of headerSelectors) {
            const element = panel.querySelector(selector);
            if (element) {
                return element.textContent?.trim() || null;
            }
        }

        return null;
    },

    /**
     * Extract address from hover panel
     * @param {Element} panel
     * @returns {Object|null}
     */
    extractAddressFromPanel(panel) {
        // Find the Address field in the secondary fields
        const addressField = this.findAddressField(panel);
        if (!addressField) {
            return null;
        }

        // Extract address components
        const addressLines = addressField.querySelectorAll('.forceOutputAddressText, .slds-truncate');
        if (addressLines.length === 0) {
            return null;
        }

        const lines = Array.from(addressLines)
            .map(line => line.textContent?.trim())
            .filter(line => line && line.length > 0);

        if (lines.length === 0) {
            return null;
        }

        // Parse address components (typical format: street, city+zip, state, country)
        const address = {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: '',
            fullAddress: lines.join(', ')
        };

        // Parse based on typical Salesforce address format
        if (lines.length >= 1) {
            address.street = lines[0];
        }
        
        if (lines.length >= 2) {
            // City and postal code are usually together: "37203-2408 Nashville"
            const cityZipMatch = lines[1].match(/^(\d{5}(?:-\d{4})?)\s+(.+)$/);
            if (cityZipMatch) {
                address.postalCode = cityZipMatch[1];
                address.city = cityZipMatch[2];
            } else {
                address.city = lines[1];
            }
        }

        if (lines.length >= 3) {
            address.state = lines[2];
        }

        if (lines.length >= 4) {
            address.country = lines[3];
        }

        return address;
    },

    /**
     * Find address field in the panel
     * @param {Element} panel
     * @returns {Element|null}
     */
    findAddressField(panel) {
        // Look for the address field wrapper
        const fieldItems = panel.querySelectorAll('.forceListRecordItem, .secondaryFieldGrid');
        
        for (const item of fieldItems) {
            const label = item.querySelector('.recordCellLabel, .slds-item_label');
            if (label && label.textContent?.trim() === 'Address') {
                return item.querySelector('.recordCellDetail, .slds-item_detail, .forceOutputAddress');
            }
        }

        return null;
    },

    /**
     * Extract address directly from Account page (if navigated there)
     * @returns {Object|null}
     */
    extractAddressFromAccountPage() {
        // Check if we're on an Account page
        if (!window.location.href.includes('/lightning/r/Account/')) {
            return null;
        }

        // Find Address field in highlights panel or record details
        const selectors = [
            'records-highlights-details-item',
            'force-record-layout-item'
        ];

        for (const selector of selectors) {
            const items = document.querySelectorAll(selector);
            for (const item of items) {
                const label = item.querySelector('p.slds-text-title');
                if (label && label.textContent?.trim() === 'Address') {
                    const formattedAddress = item.querySelector('lightning-formatted-address');
                    if (formattedAddress) {
                        return this.parseFormattedAddress(formattedAddress);
                    }
                }
            }
        }

        return null;
    },

    /**
     * Parse lightning-formatted-address element
     * @param {Element} formattedAddress
     * @returns {Object}
     */
    parseFormattedAddress(formattedAddress) {
        const divs = formattedAddress.querySelectorAll('div.slds-truncate');
        const lines = Array.from(divs)
            .map(div => div.textContent?.trim())
            .filter(line => line && line.length > 0);

        const address = {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: '',
            fullAddress: lines.join(', ')
        };

        if (lines.length >= 1) address.street = lines[0];
        if (lines.length >= 2) {
            const cityZipMatch = lines[1].match(/^(\d{5}(?:-\d{4})?)\s+(.+)$/);
            if (cityZipMatch) {
                address.postalCode = cityZipMatch[1];
                address.city = cityZipMatch[2];
            } else {
                address.city = lines[1];
            }
        }
        if (lines.length >= 3) address.state = lines[2];
        if (lines.length >= 4) address.country = lines[3];

        return address;
    },

    /**
     * Resolve timezone from address using AddressTimezoneResolver
     * @param {Object} address
     * @returns {Promise<string|null>}
     */
    async resolveTimezoneFromAddress(address) {
        if (!address) {
            return null;
        }

        if (typeof AddressTimezoneResolver === 'undefined') {
            console.warn('[AccountAddressExtractor] AddressTimezoneResolver module not loaded');
            return null;
        }

        try {
            const timezone = await AddressTimezoneResolver.resolveTimezone(address);
            console.log('[AccountAddressExtractor] Resolved timezone:', timezone);
            return timezone;
        } catch (error) {
            console.error('[AccountAddressExtractor] Error resolving timezone:', error);
            return null;
        }
    },

    /**
     * Get cached address for account
     * @param {string} accountName
     * @returns {Object|null}
     */
    getCachedAddress(accountName) {
        return this.addressCache.get(accountName) || null;
    },

    /**
     * Get last extracted address
     * @returns {Object|null}
     */
    getLastExtractedAddress() {
        return this.lastExtractedAddress;
    },

    /**
     * Notify listeners when address is extracted
     * @param {string} accountName
     * @param {Object} address
     */
    notifyAddressExtracted(accountName, address) {
        // Dispatch custom event for other modules to listen
        const event = new CustomEvent('exlibris:addressExtracted', {
            detail: {
                accountName,
                address,
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(event);
    },

    /**
     * Clean up
     */
    cleanup() {
        if (this.hoverPanelObserver) {
            this.hoverPanelObserver.disconnect();
            this.hoverPanelObserver = null;
        }
        this.addressCache.clear();
        this.lastExtractedAddress = null;
        console.log('[AccountAddressExtractor] Cleaned up');
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccountAddressExtractor;
}
