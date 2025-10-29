/**
 * FlexipagePanelInjector Module
 * Injects a two-stage workspace into the Salesforce flexipage header
 * Handles idempotent injection, SPA navigation, and staged enablement flows
 */

const FlexipagePanelInjector = {
    panelId: 'exl-flexipage-panel',
    slot1Id: 'exl-panel-slot1',
    slot2Id: 'exl-panel-slot2',
    statusId: 'exl-panel-status',
    slot2MessageId: 'exl-slot2-message',
    slot2BodyId: 'exl-slot2-body',
    observer: null,
    eventHandlers: new Map(),
    customActionHandler: null,
    elements: {},
    state: {
        slot2Expanded: false,
        preparation: 'initial'
    },

    /**
     * Ensure panel is injected (idempotent)
     * @returns {boolean} True if injection successful or already present
     */
    ensureInjected() {
        if (document.getElementById(this.panelId)) {
            console.log('[EXL] FlexipagePanelInjector: Panel already present');
            return true;
        }

        const header = this.findFlexipageHeader();

        if (!header) {
            console.warn('[EXL] FlexipagePanelInjector: Header not found, will retry');
            this.watchForHeader();
            return false;
        }

        this.state = { slot2Expanded: false, preparation: 'initial' };
        this.customActionHandler = null;

        const panel = this.createPanel();
        
        // Wrap panel in a slot element for proper encapsulation
        const slotWrapper = document.createElement('slot');
        slotWrapper.setAttribute('name', 'exlibris-panel-slot');
        slotWrapper.appendChild(panel);
        
        header.appendChild(slotWrapper);
        this.cacheElements(panel);
        this.setPreparationState('initial');
        this.setSlot2Message('Prepare tools to unlock the full workspace.');

        console.log('[EXL] FlexipagePanelInjector: Panel injected successfully');
        return true;
    },

    /**
     * Find flexipage header element - targets div.secondaryFields container
     * @returns {Element|null}
     */
    findFlexipageHeader() {
        // Primary strategy: Target div.secondaryFields within records-highlights2
        const secondaryFields = document.querySelector('records-highlights2 div.secondaryFields');
        if (secondaryFields) {
            console.log('[EXL] FlexipagePanelInjector: Found div.secondaryFields in records-highlights2');
            return secondaryFields;
        }

        // Secondary strategy: Find records-highlights-details-item and get its parent slot
        const detailsItem = document.querySelector('records-highlights-details-item');
        if (detailsItem) {
            const parentSlot = detailsItem.parentElement;
            
            if (parentSlot && parentSlot.tagName === 'SLOT') {
                console.log('[EXL] FlexipagePanelInjector: Found parent slot of records-highlights-details-item');
                return parentSlot.parentElement; // The div.secondaryFields
            }
        }

        // Fallback selectors
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
                console.log(`[EXL] FlexipagePanelInjector: Found header with fallback selector: ${selector}`);
                return element;
            }
        }

        return null;
    },

    /**
     * Create panel element with two slots
     * @returns {Element}
     */
    createPanel() {
        const panel = document.createElement('div');
        panel.id = this.panelId;
        panel.className = 'exl-panel';

        const slot1 = this.createSlot1();
        const slot2 = this.createSlot2();

        panel.appendChild(slot1);
        panel.appendChild(slot2);

        this.wireEventHandlers(panel);

        return panel;
    },

    /**
     * Create Slot 1 (buttons and metadata)
     * @returns {Element}
     */
    createSlot1() {
        const slot1 = document.createElement('div');
        slot1.id = this.slot1Id;
        slot1.className = 'exl-panel-slot1';

        slot1.innerHTML = `
            <div class="exl-panel-header">
                <div class="exl-button-group exl-panel-actions">
                    <div class="exl-panel-status" id="${this.statusId}" data-status-type="info">Initializing workspace...</div>
                    <button class="exl-btn" data-action="prepare-tools">Prepare Tools</button>
                    <button class="exl-btn exl-btn--secondary" data-action="enable-full" aria-expanded="false" disabled>Enable Full Feature</button>
                    <button class="exl-btn exl-btn--secondary" data-action="get-timezone" disabled>Get Timezones</button>
                </div>
            </div>
            <div class="exl-data-display exl-metadata-primary">
                <span class="exl-data-item">Case <span id="exl-case-number" class="exl-data-value">—</span></span>
                <span class="exl-data-item">Subject <span id="exl-case-subject" class="exl-data-value">—</span></span>
                <span class="exl-data-item">Status <span id="exl-status" class="exl-data-value">—</span></span>
                <span class="exl-data-item">Substatus <span id="exl-sub-status" class="exl-data-value">—</span></span>
            </div>
            <div class="exl-data-display exl-metadata-secondary">
                <span class="exl-data-item">Category <span id="exl-category" class="exl-data-value">—</span></span>
                <span class="exl-data-item">Subcategory <span id="exl-sub-category" class="exl-data-value">—</span></span>
                <span class="exl-data-item">Customer <span id="exl-customerid" class="exl-data-value">—</span></span>
                <span class="exl-data-item">Institution <span id="exl-institutionid" class="exl-data-value">—</span></span>
                <span class="exl-data-item">Server <span id="exl-server" class="exl-data-value">—</span></span>
                <span class="exl-data-item">Your Timezone <span id="exl-timezone" class="exl-data-value">—</span></span>
                <span class="exl-data-item">Detected Timezone <span id="exl-detected-timezone" class="exl-data-value" title="Hover over Account Name to detect">—</span></span>
                <span class="exl-data-item">Analysis <span id="exl-analysis-note" class="exl-data-value">—</span></span>
            </div>
        `;

        return slot1;
    },

    /**
     * Create Slot 2 (expandable content)
     * @returns {Element}
     */
    createSlot2() {
        const slot2 = document.createElement('div');
        slot2.id = this.slot2Id;
        slot2.className = 'exl-panel-slot2';
        slot2.setAttribute('aria-expanded', 'false');

        slot2.innerHTML = `
            <div class="exl-slot2-content">
                <p class="exl-slot2-message" id="${this.slot2MessageId}">Full feature workspace locked.</p>
                <div id="${this.slot2BodyId}"></div>
            </div>
        `;

        return slot2;
    },

    /**
     * Cache frequently used elements
     * @param {Element} panel
     */
    cacheElements(panel) {
        this.elements.panel = panel;
        this.elements.slot1 = panel.querySelector(`#${this.slot1Id}`);
        this.elements.slot2 = panel.querySelector(`#${this.slot2Id}`);
        this.elements.status = panel.querySelector(`#${this.statusId}`);
        this.elements.slot2Message = panel.querySelector(`#${this.slot2MessageId}`);
        this.elements.slot2Body = panel.querySelector(`#${this.slot2BodyId}`);
    },

    /**
     * Wire event handlers for panel
     * @param {Element} panel
     */
    wireEventHandlers(panel) {
        const handleClick = (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            this.handleAction(action);
        };

        panel.addEventListener('click', handleClick);
        this.eventHandlers.set(panel, handleClick);
    },

    /**
     * Register a custom action handler (returns true when handled)
     * @param {Function} handler
     */
    registerActionHandler(handler) {
        this.customActionHandler = handler;
    },

    /**
     * Handle button action
     * @param {string} action
     */
    async handleAction(action) {
        console.log(`[EXL] FlexipagePanelInjector: Action triggered: ${action}`);

        try {
            if (this.customActionHandler) {
                const handled = await this.customActionHandler(action, this);
                if (handled) {
                    return;
                }
            }

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
        } catch (error) {
            console.error(`[EXL] FlexipagePanelInjector: Error handling action ${action}:`, error);
            this.setStatusMessage('An unexpected error occurred. Check console for details.', 'error');
        }
    },

    /**
     * Handle "Enable Full Feature" action
     */
    async handleEnableFull() {
        if (this.state.preparation !== 'ready') {
            this.setStatusMessage('Prepare tools before enabling the full workspace.', 'warning');
            return;
        }

        const expanded = this.toggleSlot2();
        const label = expanded ? 'Hide Full Feature' : 'Enable Full Feature';
        this.setButtonState('enable-full', { label, expanded });

        if (expanded) {
            this.setStatusMessage('Full feature workspace expanded.', 'success');
        } else {
            this.setStatusMessage('Full feature workspace collapsed.', 'info');
        }
    },

    /**
     * Handle "Get Implementation Status" action
     */
    async handleGetStatus() {
        if (typeof ImplementationStatus === 'undefined') {
            this.setStatusMessage('ImplementationStatus module not loaded.', 'error');
            return;
        }

        this.setButtonState('get-status', { loading: true, loadingLabel: 'Checking…' });

        try {
            const status = await ImplementationStatus.check();
            const message = `Status: ${status.status}\nNotes: ${status.notes || 'No additional notes.'}`;
            alert(message);
        } catch (error) {
            console.error('[EXL] FlexipagePanelInjector: Implementation status error', error);
            this.setStatusMessage('Unable to retrieve implementation status.', 'error');
        } finally {
            this.setButtonState('get-status', { loading: false });
        }
    },

    /**
     * Handle "Get Timezones" action
     */
    async handleGetTimezone() {
        if (typeof TimezoneDetector === 'undefined') {
            this.setStatusMessage('TimezoneDetector module not loaded.', 'error');
            return;
        }

        this.setButtonState('get-timezone', { loading: true, loadingLabel: 'Detecting…' });

        try {
            const formatted = TimezoneDetector.getFormattedTimezone();
            const time = TimezoneDetector.getCurrentTime();
            this.updateContext({ timezone: formatted });
            alert(`Timezone: ${formatted}\nCurrent Time: ${time}`);
        } catch (error) {
            console.error('[EXL] FlexipagePanelInjector: Timezone detection error', error);
            this.setStatusMessage('Unable to detect timezone.', 'error');
        } finally {
            this.setButtonState('get-timezone', { loading: false });
        }
    },

    /**
     * Handle "Scroll to Bottom" action
     */
    async handleScrollBottom() {
        if (typeof ScrollController === 'undefined') {
            this.setStatusMessage('ScrollController module not loaded.', 'error');
            return;
        }

        this.setButtonState('scroll-bottom', { loading: true, loadingLabel: 'Scrolling…' });

        try {
            const stats = await ScrollController.toBottom();
            alert(`Scrolled: ${stats.totalScrolled}px in ${stats.iterations} iterations\nDuration: ${stats.duration.toFixed(0)}ms`);
        } catch (error) {
            console.error('[EXL] FlexipagePanelInjector: Scroll error', error);
            this.setStatusMessage('Unable to scroll to bottom.', 'error');
        } finally {
            this.setButtonState('scroll-bottom', { loading: false });
        }
    },

    /**
     * Sets the preparation state and adjusts UI controls
     * @param {'initial'|'working'|'ready'|'error'} state
     * @param {Object} options
     */
    setPreparationState(state, options = {}) {
        this.state.preparation = state;

        switch (state) {
            case 'initial':
                this.setStatusMessage(options.message || 'This case page is currently half-loaded. Please click "Prepare Tools" to fully load the page and enable full feature.', 'info');
                this.setButtonState('prepare-tools', { disabled: false, loading: false, label: 'Prepare Tools' });
                this.setButtonState('enable-full', { disabled: true, expanded: false, label: 'Enable Full Feature' });
                this.setButtonState('get-timezone', { disabled: true });
                this.toggleSlot2(false);
                break;

            case 'working':
                this.setStatusMessage(options.message || 'Preparing toolkit...', 'warning');
                this.setButtonState('prepare-tools', {
                    disabled: true,
                    loading: true,
                    loadingLabel: options.buttonLabel || 'Preparing…'
                });
                this.setButtonState('enable-full', { disabled: true });
                this.setButtonState('get-timezone', { disabled: true });
                break;

            case 'ready':
                this.setStatusMessage(options.message || 'Toolkit ready. Toggle Enable Full Feature to reveal additional details.', 'success');
                this.setButtonState('prepare-tools', { disabled: true, loading: false, label: 'Prepared' });
                this.setButtonState('enable-full', { disabled: false, label: 'Enable Full Feature', expanded: false });
                this.setButtonState('get-timezone', { disabled: false });
                break;

            case 'error':
                this.setStatusMessage(options.message || 'Toolkit preparation failed. Try again.', 'error');
                this.setButtonState('prepare-tools', { disabled: false, loading: false, label: 'Prepare Tools' });
                this.setButtonState('enable-full', { disabled: true, expanded: false, label: 'Enable Full Feature' });
                this.setButtonState('get-timezone', { disabled: true });
                this.toggleSlot2(false);
                break;

            default:
                console.warn('[EXL] FlexipagePanelInjector: Unknown preparation state', state);
        }
    },

    /**
     * Update status banner message
     * @param {string} message
     * @param {'info'|'success'|'warning'|'error'} type
     */
    setStatusMessage(message, type = 'info') {
        const statusEl = this.elements.status;
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.setAttribute('data-status-type', type);
    },

    /**
     * Update button state
     * @param {string} action
     * @param {Object} options
     */
    setButtonState(action, options = {}) {
        const button = this.getButton(action);
        if (!button) return;

        if (!button.dataset.defaultLabel) {
            button.dataset.defaultLabel = button.textContent;
        }

        if (typeof options.disabled === 'boolean') {
            button.disabled = options.disabled;
            button.setAttribute('aria-disabled', options.disabled ? 'true' : 'false');
        }

        if (typeof options.expanded === 'boolean') {
            button.setAttribute('aria-expanded', options.expanded ? 'true' : 'false');
        }

        if (options.label) {
            button.textContent = options.label;
        } else if (!options.loading && button.dataset.defaultLabel) {
            // Restore default label when not loading and label not provided
            button.textContent = button.textContent || button.dataset.defaultLabel;
        }

        if (typeof options.loading === 'boolean') {
            if (options.loading) {
                button.classList.add('exl-btn--loading');
                button.dataset.loadingLabel = options.loadingLabel || 'Working…';
                button.textContent = button.dataset.loadingLabel;
                button.setAttribute('aria-busy', 'true');
            } else {
                button.classList.remove('exl-btn--loading');
                button.removeAttribute('aria-busy');
                const label = options.label || button.dataset.defaultLabel || button.textContent;
                button.textContent = label;
            }
        }
    },

    /**
     * Update data fields in the panel
     * @param {Object} data
     */
    updateContext(data = {}) {
        const fieldMap = {
            caseNumber: 'exl-case-number',
            subject: 'exl-case-subject',
            status: 'exl-status',
            subStatus: 'exl-sub-status',
            customerId: 'exl-customerid',
            institutionId: 'exl-institutionid',
            server: 'exl-server',
            timezone: 'exl-timezone',
            detectedTimezone: 'exl-detected-timezone',
            category: 'exl-category',
            subCategory: 'exl-sub-category',
            analysisNote: 'exl-analysis-note'
        };

        Object.entries(fieldMap).forEach(([key, elementId]) => {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                this.updateField(elementId, data[key]);
            }
        });
    },

    /**
     * Populate baseline metadata into the panel
     * @param {Object} metadata
     */
    setInitialMetadata(metadata = {}) {
        this.updateContext({
            category: metadata.category,
            subCategory: metadata.subCategory,
            analysisNote: metadata.analysisNote
        });
    },

    /**
     * Render case summary content into Slot 2
     * @param {Object} caseData
     */
    setCaseSummary(caseData = {}) {
        const body = this.getSlot2Body();
        if (!body) return;

        body.innerHTML = '';

        const summarySection = this.createSection('Case Summary', [
            { label: 'Subject', value: caseData.subject },
            { label: 'Description', value: caseData.description, multiline: true },
            { label: 'Analysis Note', value: caseData.analysisNote, multiline: true }
        ]);

        const contactSection = this.createSection('Contacts', [
            { label: 'Contact', value: caseData.contactName },
            { label: 'Account', value: caseData.accountName }
        ]);

        const routingSection = this.createSection('Routing & Status', [
            { label: 'Category', value: caseData.category },
            { label: 'Subcategory', value: caseData.subCategory },
            { label: 'Status', value: caseData.status },
            { label: 'Substatus', value: caseData.subStatus }
        ]);

        [summarySection, contactSection, routingSection]
            .filter(Boolean)
            .forEach((section) => body.appendChild(section));
    },

    /**
     * Create a slot section with definition list
     * @param {string} title
     * @param {Array} items
     * @returns {HTMLElement|null}
     */
    createSection(title, items = []) {
        const validItems = items.filter((item) => item.value);
        if (validItems.length === 0) {
            return null;
        }

        const section = document.createElement('section');
        section.className = 'exl-slot2-section';

        const heading = document.createElement('h3');
        heading.textContent = title;
        section.appendChild(heading);

        const list = document.createElement('dl');
        list.className = 'exl-case-dl';

        validItems.forEach(({ label, value, multiline }) => {
            const dt = document.createElement('dt');
            dt.textContent = label;

            const dd = document.createElement('dd');

            if (multiline) {
                const lines = this.normalizeMultiline(value);
                lines.forEach((line, index) => {
                    const span = document.createElement('span');
                    span.textContent = line;
                    dd.appendChild(span);
                    if (index < lines.length - 1) {
                        dd.appendChild(document.createElement('br'));
                    }
                });
            } else {
                dd.textContent = value;
            }

            list.appendChild(dt);
            list.appendChild(dd);
        });

        section.appendChild(list);
        return section;
    },

    /**
     * Normalizes multiline text into array of lines
     * @param {string} value
     * @returns {string[]}
     */
    normalizeMultiline(value) {
        if (!value) return [];
        return String(value)
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    },

    /**
     * Update a specific field by id
     * @param {string} elementId
     * @param {*} value
     */
    updateField(elementId, value) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (value === undefined || value === null || value === '') {
            element.textContent = '—';
            element.removeAttribute('title');
            return;
        }

        const text = typeof value === 'string' ? value.trim() : String(value);
        element.textContent = text;
        element.title = text;
    },

    /**
     * Set slot 2 banner message
     * @param {string} message
     */
    setSlot2Message(message) {
        const el = this.elements.slot2Message;
        if (el) {
            el.textContent = message;
        }
    },

    /**
     * Returns Slot 2 body element
     * @returns {HTMLElement|null}
     */
    getSlot2Body() {
        return this.elements.slot2Body || document.getElementById(this.slot2BodyId);
    },

    /**
     * Toggle Slot 2 visibility
     * @param {boolean} [expanded]
     * @returns {boolean} New state
     */
    toggleSlot2(expanded) {
        const slot2 = this.elements.slot2 || document.getElementById(this.slot2Id);
        if (!slot2) {
            return false;
        }

        const nextState = typeof expanded === 'boolean' ? expanded : !this.state.slot2Expanded;
        this.state.slot2Expanded = nextState;

        slot2.setAttribute('aria-expanded', nextState ? 'true' : 'false');

        return nextState;
    },

    /**
     * Retrieve button element by action
     * @param {string} action
     * @returns {HTMLElement|null}
     */
    getButton(action) {
        if (!this.elements.panel) {
            return document.querySelector(`#${this.panelId} [data-action="${action}"]`);
        }

        return this.elements.panel.querySelector(`[data-action="${action}"]`);
    },

    /**
     * Watch for header to appear (delayed injection)
     */
    watchForHeader() {
        if (this.observer) {
            return;
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
            const handler = this.eventHandlers.get(panel);
            if (handler) {
                panel.removeEventListener('click', handler);
                this.eventHandlers.delete(panel);
            }

            panel.remove();
            console.log('[EXL] FlexipagePanelInjector: Panel removed');
        }

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        this.elements = {};
        this.customActionHandler = null;
        this.state = { slot2Expanded: false, preparation: 'initial' };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlexipagePanelInjector;
}
