/**
 * Unknown Customer Manager Module
 * Handles detection and management of customers not in the customer list
 * Prompts user to add unknown customers and collects necessary data
 */

const UnknownCustomerManager = {
    isInitialized: false,
    pendingReviews: [],
    activePrompt: null,

    /**
     * Initialize the unknown customer manager
     */
    init() {
        if (this.isInitialized) {
            return;
        }

        console.log('[UnknownCustomerManager] Initializing...');

        // Listen for unknown customer detection events
        document.addEventListener('exlibris:unknownCustomerDetected', (event) => {
            this.handleUnknownCustomerDetected(event.detail);
        });

        // Check for existing unknown customers on init
        this.checkPendingReviews();

        this.isInitialized = true;
        console.log('[UnknownCustomerManager] Initialized');
    },

    /**
     * Check for unknown customers pending review
     */
    async checkPendingReviews() {
        if (typeof TimezoneStorage === 'undefined') {
            console.warn('[UnknownCustomerManager] TimezoneStorage not loaded');
            return;
        }

        try {
            const result = await TimezoneStorage.checkUnknownCustomers();
            
            if (result.hasUnknown) {
                this.pendingReviews = result.customers;
                console.log(`[UnknownCustomerManager] Found ${result.count} unknown customers pending review`);
                
                // Notify FlexipagePanelInjector to show indicator
                this.notifyPendingReviews(result.count);
            }
        } catch (error) {
            console.error('[UnknownCustomerManager] Error checking pending reviews:', error);
        }
    },

    /**
     * Handle when an unknown customer is detected
     * @param {Object} detail - Event detail with customer info
     */
    async handleUnknownCustomerDetected(detail) {
        console.log('[UnknownCustomerManager] Unknown customer detected:', detail);

        // Add to pending reviews
        this.pendingReviews.push(detail);

        // Notify user via FlexipagePanelInjector
        this.promptUserToAddCustomer(detail);
    },

    /**
     * Prompt user to add unknown customer to list
     * @param {Object} customerData - Customer data
     */
    promptUserToAddCustomer(customerData) {
        if (typeof FlexipagePanelInjector === 'undefined') {
            console.warn('[UnknownCustomerManager] FlexipagePanelInjector not loaded');
            return;
        }

        const lookupKey = customerData.institutionCode || customerData.accountCode || customerData.accountName;
        
        // Show message in FlexipagePanelInjector
        FlexipagePanelInjector.setStatusMessage(
            `Unknown customer detected: ${lookupKey}. Would you like to add this customer to the list?`,
            'warning'
        );

        // Add action button to FlexipagePanelInjector
        this.addReviewButton(customerData);
    },

    /**
     * Add review button to FlexipagePanelInjector
     * @param {Object} customerData - Customer data
     */
    addReviewButton(customerData) {
        if (typeof FlexipagePanelInjector === 'undefined') {
            return;
        }

        // Create button in Slot 1 (preparation area)
        const buttonData = {
            action: 'reviewUnknownCustomer',
            label: 'Review Unknown Customer',
            title: 'Add this customer to your customer list',
            className: 'slds-button slds-button_brand',
            handler: () => this.startCustomerDataCollection(customerData)
        };

        FlexipagePanelInjector.addButtonToSlot1(buttonData);
    },

    /**
     * Start the customer data collection process
     * @param {Object} customerData - Initial customer data
     */
    async startCustomerDataCollection(customerData) {
        console.log('[UnknownCustomerManager] Starting customer data collection');

        if (typeof FlexipagePanelInjector === 'undefined') {
            console.warn('[UnknownCustomerManager] FlexipagePanelInjector not loaded');
            return;
        }

        // Show confirmation dialog
        const lookupKey = customerData.institutionCode || customerData.accountCode || customerData.accountName;
        const confirmed = confirm(
            `Add "${lookupKey}" to customer list?\n\n` +
            `This will:\n` +
            `1. Scroll down to extract full case data\n` +
            `2. Collect account information\n` +
            `3. Generate institution code and URLs\n` +
            `4. Add customer to your list\n\n` +
            `Continue?`
        );

        if (!confirmed) {
            console.log('[UnknownCustomerManager] User cancelled customer addition');
            return;
        }

        // Update FlexipagePanelInjector status
        FlexipagePanelInjector.setStatusMessage(
            'Collecting customer data...',
            'info'
        );

        // Execute data collection workflow
        await this.executeDataCollectionWorkflow(customerData);
    },

    /**
     * Execute the data collection workflow (similar to "Prepare Tools")
     * @param {Object} customerData - Initial customer data
     */
    async executeDataCollectionWorkflow(customerData) {
        try {
            // Step 1: Scroll down to load all case data
            FlexipagePanelInjector.setStatusMessage('Step 1/4: Scrolling to load case data...', 'info');
            await this.scrollAndWait('down');

            // Step 2: Extract case data
            FlexipagePanelInjector.setStatusMessage('Step 2/4: Extracting case data...', 'info');
            const caseData = await this.extractCaseData();

            // Step 3: Scroll back to top
            FlexipagePanelInjector.setStatusMessage('Step 3/4: Scrolling back to view...', 'info');
            await this.scrollAndWait('up');

            // Step 4: Process and save customer data
            FlexipagePanelInjector.setStatusMessage('Step 4/4: Processing customer data...', 'info');
            await this.processAndSaveCustomer(customerData, caseData);

        } catch (error) {
            console.error('[UnknownCustomerManager] Error in data collection workflow:', error);
            FlexipagePanelInjector.setStatusMessage(
                `Error collecting customer data: ${error.message}`,
                'error'
            );
        }
    },

    /**
     * Scroll and wait for content to load
     * @param {string} direction - 'up' or 'down'
     */
    async scrollAndWait(direction) {
        if (typeof ScrollController !== 'undefined') {
            await ScrollController.scrollToPosition(direction === 'down' ? 'bottom' : 'top');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for content to load
        } else {
            console.warn('[UnknownCustomerManager] ScrollController not loaded');
        }
    },

    /**
     * Extract case data for customer information
     * @returns {Promise<Object>} Extracted case data
     */
    async extractCaseData() {
        let caseData = {};

        // Try CaseDetailExtractor
        if (typeof CaseDetailExtractor !== 'undefined') {
            caseData = await CaseDetailExtractor.extractCaseDetails();
            console.log('[UnknownCustomerManager] Extracted case data:', caseData);
        } else if (typeof CaseDataExtractor !== 'undefined') {
            caseData = CaseDataExtractor.extractFromPage();
            console.log('[UnknownCustomerManager] Extracted case data (legacy):', caseData);
        }

        return caseData;
    },

    /**
     * Process and save customer data
     * @param {Object} customerData - Initial customer data
     * @param {Object} caseData - Extracted case data
     */
    async processAndSaveCustomer(customerData, caseData) {
        try {
            // Build complete customer record
            const newCustomer = {
                accountName: caseData.accountName || customerData.accountName,
                accountCode: caseData.accountCode || customerData.accountCode,
                institutionCode: this.generateInstitutionCode(caseData),
                timezone: customerData.timezone,
                // These may be unknown
                server: caseData.server || 'unknown',
                custID: caseData.custID || 'unknown',
                instID: caseData.instID || 'unknown',
                portalCustomDomain: caseData.portalCustomDomain || '',
                name: caseData.accountName || customerData.accountName,
                status: 'Pending Review',
                esploroEdition: caseData.esploroEdition || 'Unknown',
                addedBy: 'extension',
                addedDate: new Date().toISOString(),
                needsReview: true
            };

            console.log('[UnknownCustomerManager] New customer record:', newCustomer);

            // Show summary to user
            const summary = this.generateCustomerSummary(newCustomer);
            const proceed = confirm(summary);

            if (!proceed) {
                FlexipagePanelInjector.setStatusMessage('Customer addition cancelled', 'warning');
                return;
            }

            // Save to storage
            if (typeof TimezoneStorage !== 'undefined') {
                await TimezoneStorage.promoteUnknownCustomer(newCustomer);
            }

            // Optionally add to CustomerDataManager (if it supports adding customers)
            // This would require extending CustomerDataManager with an addCustomer method

            FlexipagePanelInjector.setStatusMessage(
                `Customer "${newCustomer.name}" added successfully! Institution Code: ${newCustomer.institutionCode}`,
                'success'
            );

            // Remove from pending reviews
            this.removePendingReview(customerData);

        } catch (error) {
            console.error('[UnknownCustomerManager] Error saving customer:', error);
            throw error;
        }
    },

    /**
     * Generate institution code from case data
     * @param {Object} caseData - Case data
     * @returns {string} Generated institution code
     */
    generateInstitutionCode(caseData) {
        const accountName = caseData.accountName || caseData.accountCode || 'UNKNOWN';
        
        // Extract meaningful parts from account name
        const parts = accountName.split(/[\s-_,]+/);
        let code = '';

        if (parts.length > 1) {
            // Multi-word: Take first letters
            code = parts.slice(0, 3).map(p => p.charAt(0).toUpperCase()).join('');
        } else {
            // Single word: Take first 3-5 letters
            code = accountName.substring(0, Math.min(5, accountName.length)).toUpperCase();
        }

        // Add _INST suffix (common pattern)
        code = code + '_INST';

        console.log(`[UnknownCustomerManager] Generated institution code: ${code}`);
        return code;
    },

    /**
     * Generate customer summary for user confirmation
     * @param {Object} customer - Customer record
     * @returns {string} Summary text
     */
    generateCustomerSummary(customer) {
        return `Add this customer to your list?\n\n` +
               `Name: ${customer.name}\n` +
               `Institution Code: ${customer.institutionCode}\n` +
               `Timezone: ${customer.timezone}\n` +
               `Server: ${customer.server}\n` +
               `Customer ID: ${customer.custID}\n` +
               `Institution ID: ${customer.instID}\n\n` +
               `Note: Customer/Institution IDs may need to be updated manually if unknown.\n\n` +
               `Proceed with adding this customer?`;
    },

    /**
     * Remove customer from pending reviews
     * @param {Object} customerData - Customer data to remove
     */
    removePendingReview(customerData) {
        const lookupKey = customerData.institutionCode || customerData.accountCode || customerData.accountName;
        this.pendingReviews = this.pendingReviews.filter(c => {
            const key = c.institutionCode || c.accountCode || c.accountName;
            return key !== lookupKey;
        });
        
        console.log('[UnknownCustomerManager] Removed from pending reviews:', lookupKey);
        this.checkPendingReviews(); // Update count
    },

    /**
     * Notify FlexipagePanelInjector about pending reviews
     * @param {number} count - Number of pending reviews
     */
    notifyPendingReviews(count) {
        const event = new CustomEvent('exlibris:pendingCustomerReviews', {
            detail: {
                count,
                customers: this.pendingReviews
            }
        });
        document.dispatchEvent(event);
        
        console.log(`[UnknownCustomerManager] Notified ${count} pending reviews`);
    },

    /**
     * Get all pending reviews
     * @returns {Array} Pending customer reviews
     */
    getPendingReviews() {
        return this.pendingReviews;
    },

    /**
     * Clean up
     */
    cleanup() {
        this.pendingReviews = [];
        this.activePrompt = null;
        this.isInitialized = false;
        console.log('[UnknownCustomerManager] Cleaned up');
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnknownCustomerManager;
}
