/**
 * Field Highlighter Module
 * Highlights case fields based on their completion status
 */

const FieldHighlighter = {
  // Color schemes
  colors: {
    emptyInput: 'rgba(163, 22, 55, 1)',
    emptyContainer: 'rgba(253, 234, 239, 1)',
    filledInput: 'rgba(230, 165, 25, 1)',
    filledContainer: 'rgba(252, 243, 225, 1)',
    // Additional colors for other highlighting needs
    lightBlue: 'rgb(194, 244, 233)',
    lightGreen: 'rgb(209, 247, 196)',
    lightOrange: 'rgb(255, 232, 184)',
    lightRed: 'rgb(255, 220, 230)',
    normalRed: 'rgb(191, 39, 75)',
    normalOrange: 'rgb(247, 114, 56)',
    normalPurple: 'rgb(140, 77, 253)',
    normalGreen: 'rgb(45, 200, 64)',
    normalGray: 'rgb(103, 103, 103)',
    normalYellow: 'rgb(251, 178, 22)'
  },

  // Field selectors
  fieldSelectors: {
    category: {
      container: 'records-record-layout-item[field-label="Category"]',
      input: 'records-record-layout-item[field-label="Category"] .test-id__field-value',
      label: 'records-record-layout-item[field-label="Category"] div div span'
    },
    subCategory: {
      container: 'records-record-layout-item[field-label="Sub-Category"]',
      input: 'records-record-layout-item[field-label="Sub-Category"] .test-id__field-value',
      label: 'records-record-layout-item[field-label="Sub-Category"] div div span'
    },
    description: {
      container: 'records-record-layout-item[field-label="Description"]',
      input: 'records-record-layout-item[field-label="Description"] .test-id__field-value',
      label: 'records-record-layout-item[field-label="Description"] div div span'
    },
    status: {
      container: 'records-record-layout-item[field-label="Status"]',
      input: 'records-record-layout-item[field-label="Status"] .test-id__field-value',
      label: 'records-record-layout-item[field-label="Status"] div div span'
    },
    jiraSection: {
      container: 'flexipage-component2[data-component-id="flexipage_fieldSection6"]'
    },
    rootCause: {
      container: 'div[data-target-selection-name$="Problem_Root_Cause__c"]',
      input: 'div[data-target-selection-name$="Problem_Root_Cause__c"] .test-id__field-value',
      label: 'div[data-target-selection-name$="Problem_Root_Cause__c"] div div span'
    },
    primaryJira: {
      container: 'div[data-target-selection-name$="Primary_Jira__c"]',
      input: 'div[data-target-selection-name$="Primary_Jira__c"] .test-id__field-value',
      label: 'div[data-target-selection-name$="Primary_Jira__c"] div div span'
    },
    jiraStatus: {
      container: 'div[data-target-selection-name$="Jira_Status__c"]',
      input: 'div[data-target-selection-name$="Jira_Status__c"] .test-id__field-value',
      label: 'div[data-target-selection-name$="Jira_Status__c"] div div span'
    }
  },

  /**
   * Checks if a field value is empty
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isEmpty(element) {
    if (!element) return true;
    const text = element.textContent.trim();
    return text === '' || text === '--' || text === 'None' || text === '-';
  },

  /**
   * Applies label styling
   * @param {HTMLElement} label - Label element
   * @param {string} backgroundColor - Background color to apply
   */
  styleLabelElement(label, backgroundColor) {
    if (!label) return;
    
    // label.style.color = 'white';
    // label.style.backgroundColor = backgroundColor;
    // label.style.fontWeight = 'bold';
    // label.style.padding = '4px 8px';
    // label.style.borderRadius = '4px';
  },

  /**
   * Applies highlight to a single field
   * @param {Object} fieldSelector - Object with container and input selectors
   */
  highlightField(fieldSelector) {
    const container = document.querySelector(fieldSelector.container);
    if (!container) {
      console.log('[FieldHighlighter] Container not found for selector:', fieldSelector.container);
      return;
    }

    const input = document.querySelector(fieldSelector.input);
    const label = fieldSelector.label ? document.querySelector(fieldSelector.label) : null;
    const isEmpty = this.isEmpty(input);

    if (isEmpty) {
      // Red highlight for empty fields
      container.style.backgroundColor = this.colors.emptyContainer;
      this.styleLabelElement(label, this.colors.emptyInput);
      console.log('[FieldHighlighter] Applied RED highlight for empty field:', fieldSelector.container);
    } else {
      // Yellow highlight for filled fields
      container.style.backgroundColor = this.colors.filledContainer;
      this.styleLabelElement(label, this.colors.filledInput);
      console.log('[FieldHighlighter] Applied YELLOW highlight for filled field:', fieldSelector.container);
    }
  },

  /**
   * Removes highlight from a field
   * @param {Object} fieldSelector
   */
  removeHighlight(fieldSelector) {
    const container = document.querySelector(fieldSelector.container);
    const input = document.querySelector(fieldSelector.input);
    const label = fieldSelector.label ? document.querySelector(fieldSelector.label) : null;

    if (container) {
      container.style.backgroundColor = '';
      container.style.padding = '';
      container.style.borderRadius = '';
      container.style.border = '';
    }

    if (input) {
      input.style.backgroundColor = '';
      input.style.color = '';
      input.style.padding = '';
      input.style.borderRadius = '';
    }

    if (label) {
      label.style.color = '';
      label.style.backgroundColor = '';
      label.style.fontWeight = '';
      label.style.padding = '';
      label.style.borderRadius = '';
    }
  },

  // Cache for last known field values to avoid unnecessary re-highlighting
  lastFieldValues: {},

  /**
   * Checks if field values have changed since last highlight
   * @param {Object} fieldSelector - Field selector object
   * @returns {boolean} True if field value changed or field wasn't previously cached
   */
  hasFieldValueChanged(fieldSelector) {
    const input = document.querySelector(fieldSelector.input);
    if (!input) {
      // Field not found - remove from cache if it was there
      if (this.lastFieldValues[fieldSelector.container]) {
        delete this.lastFieldValues[fieldSelector.container];
        return true; // Field disappeared, might need to remove highlight
      }
      return false; // Field still not found, no change
    }

    const currentValue = input.textContent.trim();
    const lastValue = this.lastFieldValues[fieldSelector.container];

    if (currentValue !== lastValue) {
      // Value changed - update cache
      this.lastFieldValues[fieldSelector.container] = currentValue;
      return true;
    }

    return false; // No change
  },

  /**
   * Highlights all configured fields
   * Only re-highlights if field values have changed
   */
  highlightAllFields(force = false) {
    if (!force) {
      // Check if any field values have changed
      let hasChanges = false;
      const allFields = [
        this.fieldSelectors.category,
        this.fieldSelectors.subCategory,
        this.fieldSelectors.description,
        this.fieldSelectors.status,
        this.fieldSelectors.rootCause,
        this.fieldSelectors.primaryJira,
        this.fieldSelectors.jiraStatus
      ];

      for (const field of allFields) {
        if (this.hasFieldValueChanged(field)) {
          hasChanges = true;
          break; // At least one field changed, need to re-highlight
        }
      }

      if (!hasChanges && Object.keys(this.lastFieldValues).length > 0) {
        // No changes detected and we have cached values - skip highlighting
        return;
      }
    }

    console.log('[FieldHighlighter] highlightAllFields() called', force ? '(forced)' : '');
    
    // Highlight main fields
    this.highlightField(this.fieldSelectors.category);
    this.highlightField(this.fieldSelectors.subCategory);
    this.highlightField(this.fieldSelectors.description);
    this.highlightField(this.fieldSelectors.status);

    // Highlight Jira section fields
    this.highlightField(this.fieldSelectors.rootCause);
    this.highlightField(this.fieldSelectors.primaryJira);
    this.highlightField(this.fieldSelectors.jiraStatus);

    // Update cache after highlighting
    this.updateFieldValueCache();
  },

  /**
   * Updates the cache of field values
   */
  updateFieldValueCache() {
    const allFields = [
      this.fieldSelectors.category,
      this.fieldSelectors.subCategory,
      this.fieldSelectors.description,
      this.fieldSelectors.status,
      this.fieldSelectors.rootCause,
      this.fieldSelectors.primaryJira,
      this.fieldSelectors.jiraStatus
    ];

    for (const field of allFields) {
      const input = document.querySelector(field.input);
      if (input) {
        this.lastFieldValues[field.container] = input.textContent.trim();
      }
    }
  },

  /**
   * Removes all highlights
   */
  removeAllHighlights() {
    this.removeHighlight(this.fieldSelectors.category);
    this.removeHighlight(this.fieldSelectors.subCategory);
    this.removeHighlight(this.fieldSelectors.description);
    this.removeHighlight(this.fieldSelectors.status);
    this.removeHighlight(this.fieldSelectors.rootCause);
    this.removeHighlight(this.fieldSelectors.primaryJira);
    this.removeHighlight(this.fieldSelectors.jiraStatus);
  },

  /**
   * Initializes field highlighting with observer
   */
  init() {
    // Clear field value cache
    this.lastFieldValues = {};
    
    // Initial highlight (force to ensure cache is populated)
    this.highlightAllFields(true);

    // Debounced highlight function
    let debounceTimer = null;
    const debouncedHighlight = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        this.highlightAllFields();
      }, 300); // 300ms debounce
    };

    // Observer for dynamic content changes
    // Only observe changes to specific field containers, not the entire document
    // This prevents unnecessary highlighting when unrelated DOM changes occur
    this.observer = new MutationObserver((mutations) => {
      // Check if mutations are relevant to our fields
      const relevantMutation = mutations.some(mutation => {
        // Check if mutation is within a field container
        for (const selector of Object.values(this.fieldSelectors)) {
          const container = document.querySelector(selector.container);
          if (container && (container.contains(mutation.target) || mutation.target.contains(container))) {
            return true;
          }
        }
        // Check if mutation added/removed a field container
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType === Node.ELEMENT_NODE) {
            for (const selector of Object.values(this.fieldSelectors)) {
              if (addedNode.matches && addedNode.matches(selector.container)) {
                return true;
              }
              if (addedNode.querySelector && addedNode.querySelector(selector.container)) {
                return true;
              }
            }
          }
        }
        return false;
      });

      if (relevantMutation) {
        debouncedHighlight();
      }
    });

    // Observe the document body but filter mutations
    // Also watch for the field containers themselves
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false, // Don't watch attribute changes (too noisy)
      characterData: false // Don't watch text changes (too noisy)
    });

    // Store debounce timer for cleanup
    this.debounceTimer = debounceTimer;

    console.log('[FieldHighlighter] Initialized with filtered mutation observer');
  },

  /**
   * Cleans up the module
   */
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.removeAllHighlights();
    
    // Clear field value cache
    this.lastFieldValues = {};
    
    console.log('[FieldHighlighter] Cleaned up');
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FieldHighlighter;
}
