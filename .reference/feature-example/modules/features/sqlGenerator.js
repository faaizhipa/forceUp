/**
 * SQL Generator Module
 * 
 * Provides an expandable SQL query generation tool for case pages.
 * Features include:
 * - Entity-based query templates (Researcher, User, Organization)
 * - Dynamic case data population (customer ID, institution code)
 * - Expandable UI interface within the main header card
 * - Copy-to-clipboard functionality
 * - Pre-formatted queries for common Esploro database operations
 * 
 * @module SqlGenerator
 */

import { EventBus } from '../core/eventBus.js';

/**
 * SQL query templates for different entities
 * @const {object}
 */
const QUERY_TEMPLATES = {
    'Researcher': (custId, instId) => 
        `SELECT h.USER_NAME, h.FIRST_NAME, h.LAST_NAME, rp.POSITION, rp.URL_IDENTIFIER 
FROM HFRUSER h 
JOIN RESEARCH_PERSON rp ON h.ID = rp.USER_ID 
WHERE h.CUSTOMERID = ${custId} AND h.INSTITUTIONID = ${instId};`,

    'User': (custId, instId) => 
        `SELECT ID, USER_NAME, FIRST_NAME, LAST_NAME, STATUS 
FROM HFRUSER 
WHERE CUSTOMERID = ${custId} AND INSTITUTIONID = ${instId};`,

    'Organization': (custId, instId) => 
        `SELECT ID, ORGANIZATION_NAME, ORGANIZATION_CODE, ORGANIZATION_TYPE, STATUS 
FROM RESEARCH_ORGANIZATION 
WHERE CUSTOMERID = ${custId} AND INSTITUTIONID = ${instId};`,

    'Research Output': (custId, instId) => 
        `SELECT ro.ID, ro.TITLE, ro.DOI, ro.PUBLICATION_DATE, ro.STATUS 
FROM RESEARCH_OUTPUT ro 
WHERE ro.CUSTOMERID = ${custId} AND ro.INSTITUTIONID = ${instId} 
ORDER BY ro.PUBLICATION_DATE DESC;`,

    'Asset': (custId, instId) => 
        `SELECT a.ID, a.TITLE, a.ASSET_TYPE, a.STATUS, a.CREATED_DATE 
FROM ASSET a 
WHERE a.CUSTOMERID = ${custId} AND a.INSTITUTIONID = ${instId} 
ORDER BY a.CREATED_DATE DESC;`
};

/**
 * Entity options for the dropdown selector
 * @const {Array<object>}
 */
const ENTITY_OPTIONS = [
    { value: '', label: 'Select Entity...', disabled: true },
    { value: 'Researcher', label: 'Researcher' },
    { value: 'User', label: 'User' }, 
    { value: 'Organization', label: 'Organization' },
    { value: 'Research Output', label: 'Research Output' },
    { value: 'Asset', label: 'Asset' }
];

/**
 * CSS styles for the SQL generator container
 * @const {string}
 */
const CONTAINER_STYLES = `
    padding: 15px;
    border: 1px solid #e0e5ee;
    border-radius: 4px;
    margin: 10px 0;
    background: #f8f9fa;
`;

/**
 * CSS styles for the SQL output textarea
 * @const {string}
 */
const TEXTAREA_STYLES = `
    width: 100%;
    height: 120px;
    margin-top: 10px;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    resize: vertical;
    background: white;
`;

/**
 * CSS styles for the entity selector dropdown
 * @const {string}
 */
const SELECT_STYLES = `
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    margin-right: 10px;
`;

/**
 * CSS styles for action buttons
 * @const {string}
 */
const BUTTON_STYLES = `
    padding: 6px 12px;
    border: 1px solid #0070d2;
    border-radius: 4px;
    background: #0070d2;
    color: white;
    cursor: pointer;
    font-size: 12px;
    margin-left: 5px;
`;

/**
 * SqlGenerator class manages SQL query generation functionality
 */
export class SqlGenerator {
    constructor() {
        this.eventBus = null;
        this.initialized = false;
        this.caseData = null;
        this.container = null;
        this.isExpanded = false;
    }

    /**
     * Initialize the SQL generator module
     * @param {EventBus} eventBus - Event bus instance
     * @param {object} caseData - Case data object containing customer and institution info
     */
    async initialize(eventBus, caseData = null) {
        try {
            this.eventBus = eventBus;
            this.caseData = caseData;

            await this.createSqlGeneratorUI();
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('[SqlGenerator] Initialized successfully');
        } catch (error) {
            console.error('[SqlGenerator] Initialization failed:', error);
        }
    }

    /**
     * Create and inject the SQL generator UI
     * @private
     */
    async createSqlGeneratorUI() {
        // Find the main header card
        const headerCard = document.querySelector('lightning-card.slds-card');
        if (!headerCard) {
            console.warn('[SqlGenerator] Header card not found');
            return;
        }

        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'sql-generator-container';
        this.container.style.cssText = CONTAINER_STYLES;

        // Create the UI structure
        this.container.innerHTML = this.createUIHTML();

        // Inject into the header card
        headerCard.appendChild(this.container);

        console.log('[SqlGenerator] UI created and injected');
    }

    /**
     * Generate the HTML structure for the SQL generator UI
     * @returns {string} HTML string for the UI
     * @private
     */
    createUIHTML() {
        const entityOptions = ENTITY_OPTIONS.map(option => 
            `<option value="${option.value}" ${option.disabled ? 'disabled' : ''}>${option.label}</option>`
        ).join('');

        return `
            <div class="sql-generator-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                <h3 style="margin: 0; color: #0070d2; font-size: 16px;">⚡ SQL Generator</h3>
                <span id="sql-toggle-icon" style="font-size: 18px; color: #0070d2;">▼</span>
            </div>
            
            <div id="sql-generator-content" style="display: none; margin-top: 15px;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Select Entity:</label>
                    <div style="display: flex; align-items: center;">
                        <select id="sql-entity-select" style="${SELECT_STYLES}">
                            ${entityOptions}
                        </select>
                        <button id="sql-copy-btn" style="${BUTTON_STYLES}" title="Copy to clipboard">Copy</button>
                        <button id="sql-clear-btn" style="${BUTTON_STYLES}; background: #dc3545; border-color: #dc3545;" title="Clear output">Clear</button>
                    </div>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Generated SQL Query:</label>
                    <textarea id="sql-output" style="${TEXTAREA_STYLES}" readonly placeholder="Select an entity above to generate SQL query..."></textarea>
                </div>
                
                <div style="margin-top: 10px; font-size: 11px; color: #666;">
                    <strong>Note:</strong> Queries are pre-populated with case data (Customer ID: ${this.getCustId()}, Institution ID: ${this.getInstId()})
                </div>
            </div>
        `;
    }

    /**
     * Set up event listeners for the SQL generator UI
     * @private
     */
    setupEventListeners() {
        const header = this.container.querySelector('.sql-generator-header');
        const content = document.getElementById('sql-generator-content');
        const toggleIcon = document.getElementById('sql-toggle-icon');
        const entitySelect = document.getElementById('sql-entity-select');
        const sqlOutput = document.getElementById('sql-output');
        const copyBtn = document.getElementById('sql-copy-btn');
        const clearBtn = document.getElementById('sql-clear-btn');

        // Toggle expand/collapse
        header.addEventListener('click', () => {
            this.isExpanded = !this.isExpanded;
            content.style.display = this.isExpanded ? 'block' : 'none';
            toggleIcon.textContent = this.isExpanded ? '▲' : '▼';
            
            if (this.eventBus) {
                this.eventBus.emit('sqlGeneratorToggled', { expanded: this.isExpanded });
            }
        });

        // Entity selection change
        entitySelect.addEventListener('change', () => {
            const entity = entitySelect.value;
            if (entity) {
                const query = this.generateQuery(entity);
                sqlOutput.value = query;
                
                if (this.eventBus) {
                    this.eventBus.emit('sqlQueryGenerated', { entity, query });
                }
            }
        });

        // Copy to clipboard
        copyBtn.addEventListener('click', async () => {
            if (sqlOutput.value.trim()) {
                try {
                    await navigator.clipboard.writeText(sqlOutput.value);
                    this.showToast('SQL query copied to clipboard!', 'success');
                } catch (error) {
                    console.error('[SqlGenerator] Copy failed:', error);
                    this.showToast('Failed to copy query', 'error');
                }
            } else {
                this.showToast('No query to copy', 'warning');
            }
        });

        // Clear output
        clearBtn.addEventListener('click', () => {
            sqlOutput.value = '';
            entitySelect.value = '';
            this.showToast('Query cleared', 'info');
        });
    }

    /**
     * Generate SQL query for the specified entity
     * @param {string} entity - Entity type to generate query for
     * @returns {string} Generated SQL query
     * @private
     */
    generateQuery(entity) {
        const template = QUERY_TEMPLATES[entity];
        if (!template) {
            return `-- Query template not found for entity: ${entity}`;
        }

        const custId = this.getCustId();
        const instId = this.getInstId();

        if (!custId || !instId) {
            return `-- Missing case data. Please ensure you're on a case page with customer information.
-- Required: Customer ID (exLibrisAccountNumber) and Institution Code
-- Current: Customer ID = ${custId || 'NOT_FOUND'}, Institution Code = ${instId || 'NOT_FOUND'}`;
        }

        try {
            return template(custId, instId);
        } catch (error) {
            console.error('[SqlGenerator] Query generation failed:', error);
            return `-- Error generating query for ${entity}: ${error.message}`;
        }
    }

    /**
     * Get customer ID from case data
     * @returns {string|null} Customer ID or null if not found
     * @private
     */
    getCustId() {
        if (this.caseData && this.caseData.exLibrisAccountNumber) {
            return this.caseData.exLibrisAccountNumber;
        }
        
        // Fallback: try to extract from DOM
        const custIdElement = document.querySelector('records-record-layout-item[field-label="Ex Libris Account Number"] .test-id__field-value');
        return custIdElement ? custIdElement.textContent.trim() : null;
    }

    /**
     * Get institution ID from case data  
     * @returns {string|null} Institution ID or null if not found
     * @private
     */
    getInstId() {
        if (this.caseData && this.caseData.institutionCode) {
            return this.caseData.institutionCode;
        }
        
        // Fallback: try to extract from DOM
        const instIdElement = document.querySelector('records-record-layout-item[field-label="Institution Code"] .test-id__field-value');
        return instIdElement ? instIdElement.textContent.trim() : null;
    }

    /**
     * Show a temporary toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type (success, error, warning, info)
     * @private
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = {
            success: '#28a745',
            error: '#dc3545', 
            warning: '#ffc107',
            info: '#17a2b8'
        };

        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    /**
     * Update case data (useful when case data changes)
     * @param {object} newCaseData - Updated case data object
     */
    updateCaseData(newCaseData) {
        this.caseData = newCaseData;
        
        // Update the note in the UI if it exists
        const noteElement = this.container.querySelector('div[style*="font-size: 11px"]');
        if (noteElement) {
            noteElement.innerHTML = `
                <strong>Note:</strong> Queries are pre-populated with case data (Customer ID: ${this.getCustId()}, Institution ID: ${this.getInstId()})
            `;
        }

        console.log('[SqlGenerator] Case data updated');
    }

    /**
     * Add a custom query template
     * @param {string} entityName - Name of the entity
     * @param {Function} queryTemplate - Function that returns SQL query string
     */
    addCustomQuery(entityName, queryTemplate) {
        QUERY_TEMPLATES[entityName] = queryTemplate;
        
        // Update the dropdown if UI is already created
        const entitySelect = document.getElementById('sql-entity-select');
        if (entitySelect) {
            const option = document.createElement('option');
            option.value = entityName;
            option.textContent = entityName;
            entitySelect.appendChild(option);
        }

        console.log(`[SqlGenerator] Added custom query template: ${entityName}`);
    }

    /**
     * Get the current state of the generator
     * @returns {object} Current state information
     */
    getState() {
        return {
            initialized: this.initialized,
            expanded: this.isExpanded,
            hasCaseData: !!this.caseData,
            custId: this.getCustId(),
            instId: this.getInstId(),
            availableEntities: Object.keys(QUERY_TEMPLATES)
        };
    }

    /**
     * Clean up resources and remove UI elements
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.initialized = false;
        this.caseData = null;
        this.container = null;
        this.isExpanded = false;
        
        console.log('[SqlGenerator] Destroyed');
    }

    /**
     * Check if module is initialized
     * @returns {boolean} Initialization status
     */
    isInitialized() {
        return this.initialized;
    }
}

// Create singleton instance
export const sqlGenerator = new SqlGenerator();
export default sqlGenerator;