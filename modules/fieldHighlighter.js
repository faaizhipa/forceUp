/**
 * Field Highlighter Module
 * Highlights case fields based on their completion status
 */

const FieldHighlighter = {
  // Color schemes
  colors: {
    emptyInput: 'rgb(191, 39, 75)',
    emptyContainer: 'rgb(255, 220, 230)',
    filledInput: 'rgb(251, 178, 22)',
    filledContainer: 'rgb(255, 232, 184)',
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
      input: 'records-record-layout-item[field-label="Category"] .test-id__field-value'
    },
    subCategory: {
      container: 'records-record-layout-item[field-label="Sub-Category"]',
      input: 'records-record-layout-item[field-label="Sub-Category"] .test-id__field-value'
    },
    description: {
      container: 'records-record-layout-item[field-label="Description"]',
      input: 'records-record-layout-item[field-label="Description"] .test-id__field-value'
    },
    status: {
      container: 'records-record-layout-item[field-label="Status"]',
      input: 'records-record-layout-item[field-label="Status"] .test-id__field-value'
    },
    jiraSection: {
      container: 'flexipage-component2[data-component-id="flexipage_fieldSection6"]'
    },
    rootCause: {
      container: 'div[data-target-selection-name$="Problem_Root_Cause__c"]',
      input: 'div[data-target-selection-name$="Problem_Root_Cause__c"] .test-id__field-value'
    },
    primaryJira: {
      container: 'div[data-target-selection-name$="Primary_Jira__c"]',
      input: 'div[data-target-selection-name$="Primary_Jira__c"] .test-id__field-value'
    },
    jiraStatus: {
      container: 'div[data-target-selection-name$="Jira_Status__c"]',
      input: 'div[data-target-selection-name$="Jira_Status__c"] .test-id__field-value'
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
    const isEmpty = this.isEmpty(input);

    if (isEmpty) {
      // Red highlight for empty fields
      if (input) {
        input.style.backgroundColor = this.colors.emptyInput;
        input.style.color = 'white';
        input.style.padding = '4px 8px';
        input.style.borderRadius = '4px';
      }
      container.style.backgroundColor = this.colors.emptyContainer;
      container.style.padding = '8px';
      container.style.borderRadius = '6px';
      container.style.border = `2px solid ${this.colors.emptyInput}`;
      console.log('[FieldHighlighter] Applied RED highlight for empty field:', fieldSelector.container);
    } else {
      // Yellow highlight for filled fields
      if (input) {
        input.style.backgroundColor = this.colors.filledInput;
        input.style.color = 'white';
        input.style.padding = '4px 8px';
        input.style.borderRadius = '4px';
      }
      container.style.backgroundColor = this.colors.filledContainer;
      container.style.padding = '8px';
      container.style.borderRadius = '6px';
      container.style.border = `2px solid ${this.colors.filledInput}`;
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
  },

  /**
   * Highlights all configured fields
   */
  highlightAllFields() {
    console.log('[FieldHighlighter] highlightAllFields() called');
    
    // Highlight main fields
    this.highlightField(this.fieldSelectors.category);
    this.highlightField(this.fieldSelectors.subCategory);
    this.highlightField(this.fieldSelectors.description);
    this.highlightField(this.fieldSelectors.status);

    // Highlight Jira section fields
    this.highlightField(this.fieldSelectors.rootCause);
    this.highlightField(this.fieldSelectors.primaryJira);
    this.highlightField(this.fieldSelectors.jiraStatus);
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
    // Initial highlight
    this.highlightAllFields();

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
    this.observer = new MutationObserver(debouncedHighlight);

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Store debounce timer for cleanup
    this.debounceTimer = debounceTimer;

    console.log('[FieldHighlighter] Initialized with debouncing');
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
    console.log('[FieldHighlighter] Cleaned up');
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FieldHighlighter;
}
