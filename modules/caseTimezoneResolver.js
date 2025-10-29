/**
 * CaseTimezoneResolver Module
 * Integrates AccountAddressExtractor with AddressTimezoneResolver
 * to automatically detect and update timezone when hovering over Account links
 */

const CaseTimezoneResolver = {
    isInitialized: false,
    currentCaseAccountName: null,
    resolvedTimezone: null,

    /**
     * Initialize the timezone resolver
     * @param {string} accountName - Current case's account name
     */
    init(accountName = null) {
        if (this.isInitialized) {
            return;
        }

        console.log('[CaseTimezoneResolver] Initializing...');
        this.currentCaseAccountName = accountName;

        // Initialize AccountAddressExtractor
        if (typeof AccountAddressExtractor !== 'undefined') {
            AccountAddressExtractor.init();
        } else {
            console.warn('[CaseTimezoneResolver] AccountAddressExtractor module not loaded');
        }

        // Listen for address extraction events
        document.addEventListener('exlibris:addressExtracted', (event) => {
            this.handleAddressExtracted(event.detail);
        });

        this.isInitialized = true;
        console.log('[CaseTimezoneResolver] Initialized');
    },

    /**
     * Handle when address is extracted from hover panel
     * @param {Object} detail - Event detail with accountName and address
     */
    async handleAddressExtracted(detail) {
        const { accountName, address } = detail;

        console.log('[CaseTimezoneResolver] Address extracted for:', accountName);

        // Always resolve and update the detected timezone
        await this.resolveAndUpdateTimezone(address, accountName);
    },

    /**
     * Resolve timezone from address and update UI
     * @param {Object} address
     * @param {string} accountName
     */
    async resolveAndUpdateTimezone(address, accountName) {
        if (!address) {
            console.warn('[CaseTimezoneResolver] No address provided');
            return;
        }

        try {
            // Resolve timezone using AddressTimezoneResolver
            let timezone = null;
            
            if (typeof AccountAddressExtractor !== 'undefined') {
                timezone = await AccountAddressExtractor.resolveTimezoneFromAddress(address);
            } else if (typeof AddressTimezoneResolver !== 'undefined') {
                timezone = await AddressTimezoneResolver.resolveTimezone(address);
            }

            if (timezone) {
                this.resolvedTimezone = timezone;
                console.log('[CaseTimezoneResolver] Resolved timezone:', timezone);

                // Update FlexipagePanelInjector
                this.updateFlexipagePanel(timezone);

                // Notify DynamicMenu
                this.notifyTimezoneResolved(timezone, accountName);

                // Show success message
                if (typeof FlexipagePanelInjector !== 'undefined') {
                    FlexipagePanelInjector.setStatusMessage(
                        `Timezone auto-detected from ${accountName}: ${timezone}`,
                        'success'
                    );
                }
            } else {
                console.warn('[CaseTimezoneResolver] Could not resolve timezone from address');
            }
        } catch (error) {
            console.error('[CaseTimezoneResolver] Error resolving timezone:', error);
        }
    },

    /**
     * Update Flexipage panel with resolved timezone
     * @param {string} timezone
     */
    updateFlexipagePanel(timezone) {
        if (typeof FlexipagePanelInjector !== 'undefined') {
            FlexipagePanelInjector.updateContext({ detectedTimezone: timezone });
            console.log('[CaseTimezoneResolver] Updated Flexipage panel with detected timezone:', timezone);
        }
    },

    /**
     * Notify other modules that timezone was resolved
     * @param {string} timezone
     * @param {string} accountName
     */
    notifyTimezoneResolved(timezone, accountName) {
        const event = new CustomEvent('exlibris:timezoneResolved', {
            detail: {
                timezone,
                accountName,
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(event);
    },

    /**
     * Manually trigger timezone resolution for current account
     * @param {string} accountName
     */
    async resolveForAccount(accountName) {
        console.log('[CaseTimezoneResolver] Manually resolving timezone for:', accountName);

        // Check cache first
        if (typeof AccountAddressExtractor !== 'undefined') {
            const cachedAddress = AccountAddressExtractor.getCachedAddress(accountName);
            if (cachedAddress) {
                console.log('[CaseTimezoneResolver] Using cached address');
                await this.resolveAndUpdateTimezone(cachedAddress, accountName);
                return;
            }
        }

        // Prompt user to hover over account name
        if (typeof FlexipagePanelInjector !== 'undefined') {
            FlexipagePanelInjector.setStatusMessage(
                `Please hover over the Account Name "${accountName}" to detect timezone`,
                'info'
            );
        }

        alert(`To auto-detect timezone:\n\n1. Hover your mouse over the Account Name "${accountName}"\n2. Wait for the preview panel to appear\n3. The timezone will be automatically detected and updated`);
    },

    /**
     * Get currently resolved timezone
     * @returns {string|null}
     */
    getResolvedTimezone() {
        return this.resolvedTimezone;
    },

    /**
     * Set the current case's account name
     * @param {string} accountName
     */
    setCurrentAccountName(accountName) {
        this.currentCaseAccountName = accountName;
        console.log('[CaseTimezoneResolver] Current account name set to:', accountName);
    },

    /**
     * Clean up
     */
    cleanup() {
        this.resolvedTimezone = null;
        this.currentCaseAccountName = null;
        this.isInitialized = false;
        
        if (typeof AccountAddressExtractor !== 'undefined') {
            AccountAddressExtractor.cleanup();
        }
        
        console.log('[CaseTimezoneResolver] Cleaned up');
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CaseTimezoneResolver;
}
