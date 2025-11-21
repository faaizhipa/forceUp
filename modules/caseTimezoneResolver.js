/**
 * Case Timezone Resolver Module
 * Automatically detects and resolves timezone from account addresses
 * Integrates with TimezoneStorage for caching
 * Triggered by FlexipagePanelInjector, cleaned up by PageIdentifier
 */

const CaseTimezoneResolver = {
    // State
    isInitialized: false,
    isResolved: false,
    accountName: null,
    
    // DOM Elements
    targetDiv: null,
    accountNamePElement: null,
    timezoneSpan: null,
    
    // Event Handlers
    mouseoverHandler: null,
    mouseoutHandler: null,
    
    // Timers & Observers
    countdownTimer: null,
    countdownSeconds: 5,
    hoverObserver: null,
    
    // Background Colors
    COLORS: {
        WAITING: '#ffeab6',
        ACTIVE: '#fed66d',
        ERROR: '#ffdce6',
        TRANSPARENT: ''
    },

    /**
     * Initialize the timezone resolver
     * Called by FlexipagePanelInjector.ensureInjected()
     * @param {Object} [caseData] - Optional case data with custID, instID, institutionCode, etc.
     */
    async init(caseData) {
        if (this.isInitialized) {
            console.log('[CaseTimezoneResolver] Already initialized, skipping');
            return;
        }

        console.log('[CaseTimezoneResolver] Initializing...');

        try {
            // Step 1: Wait for panel to be injected and visible
            const found = await this.waitForPanel();
            if (!found) {
                console.warn('[CaseTimezoneResolver] Could not find target elements after waiting');
                return;
            }

            // Step 2: Extract account name
            this.accountName = this.extractAccountName();
            if (!this.accountName) {
                console.warn('[CaseTimezoneResolver] Could not extract account name');
                return;
            }

            console.log('[CaseTimezoneResolver] Account Name:', this.accountName);

            // Step 3: Get case data if not provided (try to get from CasePageDataExtractor)
            let identifiers = {
                accountName: this.accountName
            };

            if (caseData) {
                identifiers.institutionCode = caseData.exLibrisAccountNumber || caseData.institutionCode;
                identifiers.customerId = caseData.custID;
                identifiers.instID = caseData.instID;
                identifiers.accountCode = caseData.exLibrisAccountNumber;
            } else if (typeof CasePageDataExtractor !== 'undefined') {
                // Try to get case data from CasePageDataExtractor
                const extractedData = CasePageDataExtractor.getLastExtractedData();
                if (extractedData) {
                    identifiers.institutionCode = extractedData.exLibrisAccountNumber || extractedData.institutionCode;
                    identifiers.customerId = extractedData.custID;
                    identifiers.instID = extractedData.instID;
                    identifiers.accountCode = extractedData.exLibrisAccountNumber;
                }
            }

            // Step 4: Check cache with all available identifiers
            await this.checkCachedTimezone(identifiers, this.targetDiv);

            this.isInitialized = true;
            console.log('[CaseTimezoneResolver] Initialization complete');

        } catch (error) {
            console.error('[CaseTimezoneResolver] Error during initialization:', error);
        }
    },

    /**
     * Wait for the panel to be injected and visible
     * @param {number} maxAttempts - Maximum number of retry attempts
     * @param {number} delayMs - Delay between attempts in milliseconds
     * @returns {Promise<boolean>} - True if panel found, false otherwise
     */
    async waitForPanel(maxAttempts = 20, delayMs = 300) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (this.findTargetElements()) {
                console.log(`[CaseTimezoneResolver] Panel found after ${attempt} attempt(s)`);
                return true;
            }
            
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        
        console.log('[CaseTimezoneResolver] Panel not found after', maxAttempts, 'attempts - may not be injected yet');
        return false;
    },    /**
     * Find target elements in the DOM
     * @returns {boolean} True if all elements found
     */
    findTargetElements() {
        try {
            // Find the visible slot[name=\"exlibris-panel-slot\"]
            const panelSlots = document.querySelectorAll('slot[name=\"exlibris-panel-slot\"]');
            let visiblePanelSlot = null;

            for (const slot of panelSlots) {
                if (this.isElementVisible(slot)) {
                    visiblePanelSlot = slot;
                    break;
                }
            }

            if (!visiblePanelSlot) {
                return false;
            }

            // Get parent div of the slot
            const parentDiv = visiblePanelSlot.parentElement;
            if (!parentDiv) {
                console.warn('[CaseTimezoneResolver] Could not find parent div');
                return false;
            }

            // Get first child slot (sibling of injected slot)
            const firstChildSlot = parentDiv.querySelector('slot:first-child');
            if (!firstChildSlot) {
                console.warn('[CaseTimezoneResolver] Could not find first child slot');
                return false;
            }

            // Find p element with text content \"Account Name\"
            const pElements = firstChildSlot.querySelectorAll('p');
            let accountNameP = null;

            for (const p of pElements) {
                if (p.textContent.trim() === 'Account Name') {
                    accountNameP = p;
                    break;
                }
            }

            if (!accountNameP) {
                console.warn('[CaseTimezoneResolver] Could not find \"Account Name\" p element');
                return false;
            }

            // Get parent div of p element (this is our targetDiv)
            this.targetDiv = accountNameP.parentElement;
            this.accountNamePElement = accountNameP;

            // Find timezone span (should be in the panel)
            this.timezoneSpan = document.querySelector('span#exl-detected-timezone');

            console.log('[CaseTimezoneResolver] Target elements found successfully');
            return true;

        } catch (error) {
            console.error('[CaseTimezoneResolver] Error finding target elements:', error);
            return false;
        }
    },

    /**
     * Check if element is visible
     * @param {Element} element
     * @returns {boolean}
     */
    isElementVisible(element) {
        if (!element) return false;
        
        let el = element;
        while (el && el !== document.body) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            el = el.parentElement;
        }
        
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    },

    /**
     * Extract account name from the anchor tag
     * @returns {string|null}
     */
    extractAccountName() {
        try {
            if (!this.targetDiv) return null;

            const anchor = this.targetDiv.querySelector('a');
            if (!anchor) {
                console.warn('[CaseTimezoneResolver] Could not find anchor tag in targetDiv');
                return null;
            }

            const accountName = anchor.textContent.trim();
            console.log('[CaseTimezoneResolver] Extracted account name:', accountName);
            return accountName;

        } catch (error) {
            console.error('[CaseTimezoneResolver] Error extracting account name:', error);
            return null;
        }
    },

    /**
     * Check cached timezone in storage
     * Best practice priority: TimezoneStorage (which checks InstitutionTimezoneManager) > Direct InstitutionTimezoneManager check
     * @param {Object|string} identifiers - Object with accountName, institutionCode, customerId, instID, or just accountName string
     * @param {Element} targetDiv
     */
    async checkCachedTimezone(identifiers, targetDiv) {
        // Handle legacy string parameter
        const lookupParams = typeof identifiers === 'string' 
            ? { accountName: identifiers }
            : identifiers;

        console.log('[CaseTimezoneResolver] Checking cache for:', lookupParams);

        try {
            // STEP 1: Try TimezoneStorage first (it checks InstitutionTimezoneManager internally)
            if (typeof TimezoneStorage !== 'undefined') {
                try {
                    const cached = await TimezoneStorage.getTimezone(lookupParams);

                    if (cached && cached.timezone) {
                        // CACHE HIT
                        console.log('[CaseTimezoneResolver] Cache hit! Timezone:', cached.timezone, 'Source:', cached.source);
                        this.updateUI(cached.timezone);
                        this.isResolved = true;
                        // Do NOT attach event listeners
                        // Process is complete
                        return;
                    }
                } catch (error) {
                    console.warn('[CaseTimezoneResolver] Error checking TimezoneStorage:', error);
                    // Continue to fallback check
                }
            }

            // STEP 2: Fallback - Direct InstitutionTimezoneManager check if TimezoneStorage unavailable or missed
            // This ensures we still get timezone from the database even if storage lookup fails
            if (typeof InstitutionTimezoneManager !== 'undefined' && lookupParams.institutionCode) {
                try {
                    const institutionResult = InstitutionTimezoneManager.getTimezone({
                        orgCode: lookupParams.institutionCode || lookupParams.accountCode,
                        customerId: lookupParams.customerId,
                        institutionId: lookupParams.instID
                    });

                    if (institutionResult && institutionResult.timezone) {
                        console.log('[CaseTimezoneResolver] Found timezone via direct InstitutionTimezoneManager check:', institutionResult.timezone);
                        this.updateUI(institutionResult.timezone);
                        this.isResolved = true;
                        
                        // Optionally save to storage for future quick lookup
                        if (typeof TimezoneStorage !== 'undefined') {
                            try {
                                await TimezoneStorage.storeTimezone({
                                    timezone: institutionResult.timezone,
                                    accountName: lookupParams.accountName,
                                    accountCode: lookupParams.accountCode,
                                    institutionCode: lookupParams.institutionCode,
                                    customerId: lookupParams.customerId,
                                    instID: lookupParams.instID,
                                    source: 'institution_database'
                                });
                            } catch (saveError) {
                                console.warn('[CaseTimezoneResolver] Could not save to storage:', saveError);
                            }
                        }
                        return;
                    }
                } catch (error) {
                    console.warn('[CaseTimezoneResolver] Error checking InstitutionTimezoneManager:', error);
                    // Continue to cache miss state
                }
            }

            // CACHE MISS - No timezone found in any source
            console.log('[CaseTimezoneResolver] Cache miss, setting up detection');
            this.applyCacheMissState();

        } catch (error) {
            console.error('[CaseTimezoneResolver] Unexpected error checking cache:', error);
            this.applyCacheMissState();
        }
    },

    /**
     * Apply cache miss state (waiting for hover)
     */
    applyCacheMissState() {
        if (!this.targetDiv) return;

        // Set waiting background color
        this.targetDiv.style.backgroundColor = this.COLORS.WAITING;

        // Attach event listeners
        this.mouseoverHandler = (event) => this.onMouseOver(event);
        this.mouseoutHandler = (event) => this.onMouseOut(event);

        this.targetDiv.addEventListener('mouseover', this.mouseoverHandler);
        this.targetDiv.addEventListener('mouseout', this.mouseoutHandler);

        console.log('[CaseTimezoneResolver] Waiting state applied, listeners attached');
    },

    /**
     * Handle mouseover event
     * @param {Event} event
     */
    onMouseOver(event) {
        console.log('[CaseTimezoneResolver] Mouse over detected');

        // If already resolved, cleanup and exit
        if (this.isResolved) {
            console.log('[CaseTimezoneResolver] Already resolved, cleaning up');
            this.cleanup();
            return;
        }

        // Set active background color
        this.targetDiv.style.backgroundColor = this.COLORS.ACTIVE;

        // Start countdown timer
        this.startCountdownTimer();

        // Start hover panel observer
        this.startHoverPanelObserver();
    },

    /**
     * Handle mouseout event
     * @param {Event} event
     */
    onMouseOut(event) {
        console.log('[CaseTimezoneResolver] Mouse out detected');

        if (this.isResolved) {
            // If resolved, cleanup
            console.log('[CaseTimezoneResolver] Resolved, cleaning up on mouseout');
            this.cleanup();
        } else {
            // If not resolved, abort and restore waiting state
            console.log('[CaseTimezoneResolver] Not resolved, aborting detection');
            this.abortDetection();
        }
    },

    /**
     * Abort detection and restore waiting state
     */
    abortDetection() {
        // Stop countdown timer
        this.stopCountdownTimer();

        // Stop hover panel observer
        this.stopHoverPanelObserver();

        // Restore p element text
        if (this.accountNamePElement) {
            this.accountNamePElement.textContent = 'Account Name';
        }

        // Restore waiting background color
        if (this.targetDiv) {
            this.targetDiv.style.backgroundColor = this.COLORS.WAITING;
        }

        console.log('[CaseTimezoneResolver] Detection aborted, waiting state restored');
    },

    /**
     * Start countdown timer
     */
    startCountdownTimer() {
        this.countdownSeconds = 5;
        
        this.countdownTimer = setInterval(() => {
            this.countdownSeconds--;

            // Update p element text
            if (this.accountNamePElement) {
                this.accountNamePElement.textContent = `Detecting... ${this.countdownSeconds}s`;
            }

            // 2-second check
            if (this.countdownSeconds === 2) {
                this.checkForExistingHoverPanel();
            }

            // Countdown complete
            if (this.countdownSeconds <= 0) {
                this.handleCountdownComplete();
            }

        }, 1000);

        console.log('[CaseTimezoneResolver] Countdown timer started');
    },

    /**
     * Stop countdown timer
     */
    stopCountdownTimer() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
            console.log('[CaseTimezoneResolver] Countdown timer stopped');
        }
    },

    /**
     * Check if hover panel already exists (observer may have missed it)
     */
    checkForExistingHoverPanel() {
        console.log('[CaseTimezoneResolver] 2-second check: Looking for existing hover panel');

        if (this.isResolved) {
            console.log('[CaseTimezoneResolver] Already resolved, skipping check');
            return;
        }

        const hoverPanel = document.querySelector('div[name=\"dialog\"]');
        if (hoverPanel) {
            console.log('[CaseTimezoneResolver] Found existing hover panel, extracting address');
            setTimeout(() => {
                this.extractAddressFromPanel(hoverPanel);
            }, 500);
        }
    },

    /**
     * Handle countdown completion
     */
    handleCountdownComplete() {
        console.log('[CaseTimezoneResolver] Countdown complete');

        this.stopCountdownTimer();

        if (!this.isResolved) {
            // Timezone not resolved - show error state
            console.log('[CaseTimezoneResolver] Timezone not resolved, showing error state');
            
            if (this.targetDiv) {
                this.targetDiv.style.backgroundColor = this.COLORS.ERROR;
            }

            if (this.accountNamePElement) {
                this.accountNamePElement.textContent = 'Retry: Hover over the Account Name again';
            }

            // Stop observer
            this.stopHoverPanelObserver();
        }
        // If resolved, resolveTimezoneFromAddress will handle cleanup
    },

    /**
     * Start hover panel observer
     */
    startHoverPanelObserver() {
        console.log('[CaseTimezoneResolver] Starting hover panel observer');

        // Target container
        const container = document.querySelector('body > div.desktop.container.forceStyle.oneOne.navexDesktopLayoutContainer.lafAppLayoutHost.forceAccess > div.DESKTOP.uiContainerManager');

        if (!container) {
            console.warn('[CaseTimezoneResolver] Could not find observer target container');
            return;
        }

        this.hoverObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && node.tagName === 'DIV' && node.getAttribute('name') === 'dialog') {
                        console.log('[CaseTimezoneResolver] Hover panel detected!');
                        
                        // Wait for content to load
                        setTimeout(() => {
                            this.extractAddressFromPanel(node);
                        }, 500);

                        return;
                    }
                }
            }
        });

        this.hoverObserver.observe(container, {
            childList: true,
            subtree: false
        });

        console.log('[CaseTimezoneResolver] Hover panel observer started');
    },

    /**
     * Stop hover panel observer
     */
    stopHoverPanelObserver() {
        if (this.hoverObserver) {
            this.hoverObserver.disconnect();
            this.hoverObserver = null;
            console.log('[CaseTimezoneResolver] Hover panel observer stopped');
        }
    },

    /**
     * Extract address from hover panel
     * @param {Element} panel
     */
    async extractAddressFromPanel(panel) {
        console.log('[CaseTimezoneResolver] Extracting address from panel');

        try {
            // Use AccountAddressExtractor if available
            let address = null;

            if (typeof AccountAddressExtractor !== 'undefined') {
                // Trigger extraction
                const extractedData = await AccountAddressExtractor.extractFromHoverPanel(panel);
                if (extractedData && extractedData.address) {
                    address = extractedData.address;
                }
            } else {
                console.warn('[CaseTimezoneResolver] AccountAddressExtractor not available');
            }

            if (address) {
                console.log('[CaseTimezoneResolver] Address extracted:', address);
                await this.resolveTimezoneFromAddress(address, this.accountName);
            } else {
                console.warn('[CaseTimezoneResolver] Could not extract address from panel');
            }

        } catch (error) {
            console.error('[CaseTimezoneResolver] Error extracting address:', error);
        }
    },

    /**
     * Resolve timezone using best practice priority:
     * 1. InstitutionTimezoneManager (if case data available)
     * 2. Address resolution (fallback)
     * CRITICAL: This is the ONLY place that writes to TimezoneStorage
     * @param {Object} address
     * @param {string} accountName
     */
    async resolveTimezoneFromAddress(address, accountName) {
        console.log('[CaseTimezoneResolver] Resolving timezone from address');

        if (this.isResolved) {
            console.log('[CaseTimezoneResolver] Already resolved, skipping');
            return;
        }

        try {
            let timezone = null;
            let source = 'case_address_hover';

            // STEP 1: Check InstitutionTimezoneManager first (best practice - most reliable source)
            // This avoids unnecessary address resolution if timezone is already in the database
            if (typeof InstitutionTimezoneManager !== 'undefined') {
                try {
                    // Get case data if available
                    let caseData = null;
                    if (typeof CasePageDataExtractor !== 'undefined') {
                        caseData = CasePageDataExtractor.getLastExtractedData();
                    }

                    if (caseData) {
                        const institutionResult = InstitutionTimezoneManager.getTimezone({
                            orgCode: caseData.institutionCode || caseData.exLibrisAccountNumber,
                            customerId: caseData.custID,
                            institutionId: caseData.instID
                        });

                        if (institutionResult && institutionResult.timezone) {
                            timezone = institutionResult.timezone;
                            source = 'institution_database';
                            console.log('[CaseTimezoneResolver] Timezone found in InstitutionTimezoneManager:', timezone);
                            
                            // Save to storage for future quick lookup
                            if (typeof TimezoneStorage !== 'undefined') {
                                await TimezoneStorage.storeTimezone({
                                    timezone,
                                    accountName,
                                    accountCode: caseData.exLibrisAccountNumber,
                                    institutionCode: caseData.institutionCode,
                                    customerId: caseData.custID,
                                    instID: caseData.instID,
                                    source: source
                                });
                                console.log('[CaseTimezoneResolver] Timezone saved to storage from InstitutionTimezoneManager');
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[CaseTimezoneResolver] Error checking InstitutionTimezoneManager:', error);
                    // Continue to address resolution fallback
                }
            }

            // STEP 2: Fallback to address resolution if InstitutionTimezoneManager didn't find it
            if (!timezone) {
                console.log('[CaseTimezoneResolver] InstitutionTimezoneManager lookup failed, falling back to address resolution');
                
                // Resolve timezone using AddressTimezoneResolver
                if (typeof AddressTimezoneResolver !== 'undefined') {
                    timezone = await AddressTimezoneResolver.resolveTimezone(address);
                } else if (typeof AccountAddressExtractor !== 'undefined' && AccountAddressExtractor.resolveTimezoneFromAddress) {
                    timezone = await AccountAddressExtractor.resolveTimezoneFromAddress(address);
                } else {
                    console.warn('[CaseTimezoneResolver] No timezone resolver available');
                }

                if (timezone) {
                    source = 'case_address_hover';
                    console.log('[CaseTimezoneResolver] Timezone resolved from address:', timezone);

                    // SAVE TO STORAGE (CRITICAL - ONLY WRITE LOCATION)
                    if (typeof TimezoneStorage !== 'undefined') {
                        // Try to get case data for better storage
                        let caseData = null;
                        if (typeof CasePageDataExtractor !== 'undefined') {
                            caseData = CasePageDataExtractor.getLastExtractedData();
                        }

                        await TimezoneStorage.storeTimezone({
                            timezone,
                            accountName,
                            accountCode: caseData ? caseData.exLibrisAccountNumber : null,
                            institutionCode: caseData ? caseData.institutionCode : null,
                            customerId: caseData ? caseData.custID : null,
                            instID: caseData ? caseData.instID : null,
                            source: source
                        });
                        console.log('[CaseTimezoneResolver] Timezone saved to storage from address resolution');
                    } else {
                        console.warn('[CaseTimezoneResolver] TimezoneStorage not available, cannot save');
                    }
                }
            }

            if (!timezone) {
                console.warn('[CaseTimezoneResolver] Could not resolve timezone from any source');
                return;
            }

            // Update UI
            this.updateUI(timezone);

            // Mark as resolved
            this.isResolved = true;

            // Cleanup
            this.cleanup();

        } catch (error) {
            console.error('[CaseTimezoneResolver] Error resolving timezone:', error);
            // Show error state to user
            if (this.targetDiv) {
                this.targetDiv.style.backgroundColor = this.COLORS.ERROR;
            }
            if (this.accountNamePElement) {
                this.accountNamePElement.textContent = 'Error: Could not resolve timezone';
            }
        }
    },

    /**
     * Update UI with timezone
     * @param {string} timezone
     */
    updateUI(timezone) {
        console.log('[CaseTimezoneResolver] Updating UI with timezone:', timezone);

        if (this.timezoneSpan) {
            this.timezoneSpan.textContent = timezone;
        } else {
            // Try to find it again
            this.timezoneSpan = document.querySelector('span#exl-detected-timezone');
            if (this.timezoneSpan) {
                this.timezoneSpan.textContent = timezone;
            } else {
                console.warn('[CaseTimezoneResolver] Could not find timezone span element');
            }
        }
    },

    /**
     * Cleanup - stop timers, remove listeners, reset state
     * Called by PageIdentifier on URL change
     */
    cleanup() {
        console.log('[CaseTimezoneResolver] Cleaning up...');

        // Stop countdown timer
        this.stopCountdownTimer();

        // Stop hover panel observer
        this.stopHoverPanelObserver();

        // Remove event listeners
        if (this.targetDiv && this.mouseoverHandler) {
            this.targetDiv.removeEventListener('mouseover', this.mouseoverHandler);
            this.targetDiv.removeEventListener('mouseout', this.mouseoutHandler);
        }

        // Reset background colors
        if (this.targetDiv) {
            this.targetDiv.style.backgroundColor = this.COLORS.TRANSPARENT;
        }

        // Restore p element text
        if (this.accountNamePElement && this.accountNamePElement.textContent !== 'Account Name') {
            this.accountNamePElement.textContent = 'Account Name';
        }

        // Reset state
        this.isInitialized = false;
        this.isResolved = false;
        this.accountName = null;
        this.targetDiv = null;
        this.accountNamePElement = null;
        this.timezoneSpan = null;
        this.mouseoverHandler = null;
        this.mouseoutHandler = null;

        console.log('[CaseTimezoneResolver] Cleanup complete');
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CaseTimezoneResolver;
}
