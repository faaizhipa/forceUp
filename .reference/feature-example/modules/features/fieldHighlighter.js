/**
 * Field Highlighter Module
 * 
 * Handles highlighting of case fields based on their content status,
 * providing visual indicators for data completeness.
 */

/**
 * Configuration for fields to highlight on case pages.
 */
const FIELD_HIGHLIGHT_CONFIG = [
    { selector: 'records-record-layout-item[field-label="Category"]', inputSelector: '.test-id__field-value' },
    { selector: 'records-record-layout-item[field-label="Sub-Category"]', inputSelector: '.test-id__field-value' },
    { selector: 'records-record-layout-item[field-label="Description"]', inputSelector: '.test-id__field-value' },
    { selector: 'records-record-layout-item[field-label="Status"]', inputSelector: '.test-id__field-value' }
];

/**
 * Color scheme for field highlighting.
 */
const HIGHLIGHT_COLORS = {
    empty: {
        input: 'rgb(191, 39, 75)',       // Red for empty fields
        container: 'rgb(255, 220, 230)'  // Light red background
    },
    filled: {
        input: 'rgb(251, 178, 22)',      // Yellow for filled fields
        container: 'rgb(255, 232, 184)'  // Light yellow background
    }
};

/**
 * Applies colored highlights to key fields on the Salesforce Case page.
 * @description Fields are highlighted red if empty and yellow if filled, providing a quick
 * visual indicator of the case's data completeness and guiding the user to fill out
 * important information.
 */
export function highlightFields() {
    FIELD_HIGHLIGHT_CONFIG.forEach(field => {
        const container = document.querySelector(field.selector);
        if (container) {
            const inputElement = container.querySelector(field.inputSelector);
            const value = inputElement ? inputElement.textContent.trim() : '';

            const isEmpty = value === '' || value === '---';
            const colorScheme = isEmpty ? HIGHLIGHT_COLORS.empty : HIGHLIGHT_COLORS.filled;

            // Apply container highlighting
            container.style.backgroundColor = colorScheme.container;
            
            // Apply input element highlighting
            if (inputElement) {
                inputElement.style.backgroundColor = colorScheme.input;
                inputElement.style.color = 'white';
                inputElement.style.padding = '2px 4px';
                inputElement.style.borderRadius = '3px';
            }
        }
    });
}

/**
 * Highlights a specific field with custom colors.
 * @param {string} fieldLabel The field label to target.
 * @param {boolean} isEmpty Whether the field should be highlighted as empty.
 * @param {object} [customColors] Custom color scheme to use.
 */
export function highlightSpecificField(fieldLabel, isEmpty = false, customColors = null) {
    const colors = customColors || HIGHLIGHT_COLORS;
    const colorScheme = isEmpty ? colors.empty : colors.filled;
    
    const selector = `records-record-layout-item[field-label="${fieldLabel}"]`;
    const container = document.querySelector(selector);
    
    if (container) {
        const inputElement = container.querySelector('.test-id__field-value');
        
        container.style.backgroundColor = colorScheme.container;
        
        if (inputElement) {
            inputElement.style.backgroundColor = colorScheme.input;
            inputElement.style.color = 'white';
            inputElement.style.padding = '2px 4px';
            inputElement.style.borderRadius = '3px';
        }
    }
}

/**
 * Removes highlighting from all configured fields.
 */
export function clearFieldHighlighting() {
    FIELD_HIGHLIGHT_CONFIG.forEach(field => {
        const container = document.querySelector(field.selector);
        if (container) {
            container.style.backgroundColor = '';
            
            const inputElement = container.querySelector(field.inputSelector);
            if (inputElement) {
                inputElement.style.backgroundColor = '';
                inputElement.style.color = '';
                inputElement.style.padding = '';
                inputElement.style.borderRadius = '';
            }
        }
    });
}

/**
 * Adds a new field to the highlighting configuration.
 * @param {object} fieldConfig Field configuration object.
 * @param {string} fieldConfig.selector CSS selector for the field container.
 * @param {string} fieldConfig.inputSelector CSS selector for the input element within the container.
 */
export function addFieldToHighlighting(fieldConfig) {
    if (!FIELD_HIGHLIGHT_CONFIG.find(f => f.selector === fieldConfig.selector)) {
        FIELD_HIGHLIGHT_CONFIG.push(fieldConfig);
    }
}

/**
 * Gets the current field highlighting configuration.
 * @returns {Array<object>} Array of field configuration objects.
 */
export function getFieldHighlightConfig() {
    return [...FIELD_HIGHLIGHT_CONFIG];
}