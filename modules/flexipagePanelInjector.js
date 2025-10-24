/**
 * FlexipagePanelInjector Module
 * Injects two-slot panel into Salesforce flexipage header
 * Handles idempotent injection and SPA navigation
 */

const FlexipagePanelInjector = {
    panelId: 'exl-flexipage-panel',
    slot1Id: 'exl-panel-slot1',
    slot2Id: 'exl-panel-slot2',
    observer: null,
    eventHandlers: new Map(),

    /**
     * Ensure panel is injected (idempotent)
     * @returns {boolean} True if injection successful or already present
     */
    ensureInjected() {
        // Check if already injected
        if (document.getElementById(this.panelId)) {
            console.log('[EXL] FlexipagePanelInjector: Panel already present');
            return true;
        }

        // Find injection point
        const header = this.findFlexipageHeader();

        if (!header) {
            console.warn('[EXL] FlexipagePanelInjector: Header not found, will retry');
            this.watchForHeader();
            return false;
        }

        // Create and inject panel
        const panel = this.createPanel();
        header.appendChild(panel);

        console.log('[EXL] FlexipagePanelInjector: Panel injected successfully');
        return true;
    },

    /**
     * Find flexipage header element
     * @returns {Element|null} Header element or null
     */
    findFlexipageHeader() {
        // Try multiple selectors for robustness
        const selectors = [
            '.highlights .slds-page-header__detail-row',
            '.slds-page-header',
            '[data-aura-class="forceRecordLayout"]',
            'one-record-home-flexipage2',
            '.forcePageBlockSectionRow'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                console.log(`[EXL] FlexipagePanelInjector: Found header with selector: ${selector}`);
                return element;
            }
        }

        return null;
    },

    /**
     * Create panel element with two slots
     * @returns {Element} Panel element
     */
    createPanel() {
        const panel = document.createElement('div');
        panel.id = this.panelId;
        panel.className = 'exl-panel';

        // Create Slot 1 (control buttons and data display)
        const slot1 = this.createSlot1();
        panel.appendChild(slot1);

        // Create Slot 2 (expandable content)
        const slot2 = this.createSlot2();
        panel.appendChild(slot2);

        // Wire event handlers
        this.wireEventHandlers(panel);

        return panel;
    },

    /**
     * Create Slot 1 (buttons and data)
     * @returns {Element} Slot 1 element
     */
    createSlot1() {
        const slot1 = document.createElement('div');
        slot1.id = this.slot1Id;
        slot1.className = 'exl-panel-slot1';

        slot1.innerHTML = `
            <div class="exl-button-group">
                <button class="exl-btn" data-action="enable-full">Enable Full Feature</button>
                <button class="exl-btn" data-action="get-status">Get Implementation Status</button>
                <button class="exl-btn" data-action="get-timezone">Get Timezones</button>
                <button class="exl-btn" data-action="scroll-bottom">Scroll to Bottom</button>
            </div>
            <div class="exl-data-display">
                <span class="exl-data-item">CUSTOMERID: <span id="exl-customerid" class="exl-data-value">—</span></span>
                <span class="exl-data-item">INSTITUTIONID: <span id="exl-institutionid" class="exl-data-value">—</span></span>
                <span class="exl-data-item">SERVER: <span id="exl-server" class="exl-data-value">—</span></span>
                <span class="exl-data-item">TIMEZONE: <span id="exl-timezone" class="exl-data-value">—</span></span>
            </div>
        `;

        return slot1;
    },

    /**
     * Create Slot 2 (expandable content)
     * @returns {Element} Slot 2 element
     */
    createSlot2() {
        const slot2 = document.createElement('div');
        slot2.id = this.slot2Id;
        slot2.className = 'exl-panel-slot2';
        slot2.setAttribute('aria-expanded', 'false');
        slot2.style.display = 'none';

        slot2.innerHTML = `
            <div class="exl-slot2-content">
                <h3>Additional Information</h3>
                <p>Expandable content will appear here.</p>
            </div>
        `;

        return slot2;
    },

    /**
     * Wire event handlers for panel
     * @param {Element} panel - Panel element
     */
    wireEventHandlers(panel) {
        const handleClick = (e) => {
            if (e.target.matches('[data-action]')) {
                const action = e.target.dataset.action;
                this.handleAction(action);
            }
        };

        panel.addEventListener('click', handleClick);
        this.eventHandlers.set(panel, handleClick);
    },

    /**
     * Handle button action
     * @param {string} action - Action identifier
     */
    async handleAction(action) {
        console.log(`[EXL] FlexipagePanelInjector: Action triggered: ${action}`);

        try {
            switch (action) {
                case 'enable-full':
                    await this.handleEnableFull();
                    break;
                case 'get-status':
                    await this.handleGetStatus();
                    break;
                case 'get-timezone':
                    await this.handleGetTimezone();
                    break;
                case 'scroll-bottom':
                    await this.handleScrollBottom();
                    break;
                default:
                    console.warn(`[EXL] FlexipagePanelInjector: Unknown action: ${action}`);
            }
        } catch (err) {
            console.error(`[EXL] FlexipagePanelInjector: Error handling action ${action}:`, err);
        }
    },

    /**
     * Handle "Enable Full Feature" action
     */
    async handleEnableFull() {
        console.log('[EXL] FlexipagePanelInjector: Enable Full Feature');
        // TODO: Implement full feature activation
        alert('Full feature activation not yet implemented');
    },

    /**
     * Handle "Get Implementation Status" action
     */
    async handleGetStatus() {
        console.log('[EXL] FlexipagePanelInjector: Get Implementation Status');
        
        if (typeof ImplementationStatus !== 'undefined') {
            const status = await ImplementationStatus.check();
            alert(`Status: ${status.status}\nNotes: ${status.notes}`);
        } else {
            alert('ImplementationStatus module not loaded');
        }
    },

    /**
     * Handle "Get Timezones" action
     */
    async handleGetTimezone() {
        console.log('[EXL] FlexipagePanelInjector: Get Timezones');
        
        if (typeof TimezoneDetector !== 'undefined') {
            const tz = TimezoneDetector.detect();
            const formatted = TimezoneDetector.getFormattedTimezone();
            const time = TimezoneDetector.getCurrentTime();
            
            this.updateContext({ timezone: formatted });
            alert(`Timezone: ${formatted}\nCurrent Time: ${time}`);
        } else {
            alert('TimezoneDetector module not loaded');
        }
    },

    /**
     * Handle "Scroll to Bottom" action
     */
    async handleScrollBottom() {
        console.log('[EXL] FlexipagePanelInjector: Scroll to Bottom');
        
        if (typeof ScrollController !== 'undefined') {
            const stats = await ScrollController.toBottom();
            alert(`Scrolled: ${stats.totalScrolled}px in ${stats.iterations} iterations\nDuration: ${stats.duration.toFixed(0)}ms`);
        } else {
            alert('ScrollController module not loaded');
        }
    },

    /**
     * Update context data display
     * @param {Object} data - { customerId, institutionId, server, timezone }
     */
    updateContext(data) {
        const { customerId, institutionId, server, timezone } = data;

        const updateField = (id, value) => {
            const element = document.getElementById(id);
            if (element && value !== undefined) {
                element.textContent = value;
            }
        };

        updateField('exl-customerid', customerId);
        updateField('exl-institutionid', institutionId);
        updateField('exl-server', server);
        updateField('exl-timezone', timezone);
    },

    /**
     * Toggle Slot 2 visibility
     * @param {boolean} expanded - True to expand, false to collapse
     */
    toggleSlot2(expanded) {
        const slot2 = document.getElementById(this.slot2Id);
        
        if (slot2) {
            if (expanded) {
                slot2.style.display = 'block';
                slot2.setAttribute('aria-expanded', 'true');
            } else {
                slot2.style.display = 'none';
                slot2.setAttribute('aria-expanded', 'false');
            }
        }
    },

    /**
     * Watch for header to appear (delayed injection)
     */
    watchForHeader() {
        if (this.observer) {
            return; // Already watching
        }

        this.observer = new MutationObserver(() => {
            const header = this.findFlexipageHeader();
            
            if (header) {
                console.log('[EXL] FlexipagePanelInjector: Header appeared, injecting now');
                this.ensureInjected();
                this.observer.disconnect();
                this.observer = null;
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('[EXL] FlexipagePanelInjector: Watching for header...');
    },

    /**
     * Teardown panel and cleanup
     */
    teardown() {
        const panel = document.getElementById(this.panelId);
        
        if (panel) {
            // Remove event listeners
            const handler = this.eventHandlers.get(panel);
            if (handler) {
                panel.removeEventListener('click', handler);
                this.eventHandlers.delete(panel);
            }
            
            // Remove panel
            panel.remove();
            console.log('[EXL] FlexipagePanelInjector: Panel removed');
        }

        // Disconnect observer
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlexipagePanelInjector;
}
