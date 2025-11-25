/**
 * Field Highlighter Module
 * Highlights case fields based on their completion status
 */

const FieldHighlighter = {
  navigationListenerRegistered: false,

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

  isElementVisible(element) {
    if (!element) return false;
    let node = element;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      node = node.parentElement;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  findVisibleElement(selector, within = null) {
    if (!selector) return null;
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (within && !within.contains(el)) continue;
      if (this.isElementVisible(el)) return el;
    }
    return null;
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
    const container = this.findVisibleElement(fieldSelector.container);
    if (!container) {
      console.log('[FieldHighlighter] Container not found for selector:', fieldSelector.container);
      return;
    }

    const input = this.findVisibleElement(fieldSelector.input, container);
    const label = fieldSelector.label ? this.findVisibleElement(fieldSelector.label, container) : null;
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
    const containers = document.querySelectorAll(fieldSelector.container);
    containers.forEach(container => {
      container.style.backgroundColor = '';
      container.style.padding = '';
      container.style.borderRadius = '';
      container.style.border = '';
    });

    const inputs = document.querySelectorAll(fieldSelector.input);
    inputs.forEach(input => {
      input.style.backgroundColor = '';
      input.style.color = '';
      input.style.padding = '';
      input.style.borderRadius = '';
    });

    if (fieldSelector.label) {
      const labels = document.querySelectorAll(fieldSelector.label);
      labels.forEach(label => {
      label.style.color = '';
      label.style.backgroundColor = '';
      label.style.fontWeight = '';
      label.style.padding = '';
      label.style.borderRadius = '';
      });
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
    this.setupNavigationListeners();

    // Debounced highlight function
    let debounceTimer = null;
    const debouncedHighlight = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        this.highlightAllFields();
      }, 1500); // 1500ms debounce - reduced frequency to avoid excessive DOM queries
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

  setupNavigationListeners() {
    if (this.navigationListenerRegistered) return;

    const handleNavigation = () => {
      this.removeAllHighlights();
      this.highlightAllFields();
    };

    if (typeof PageIdentifier !== 'undefined' && typeof PageIdentifier.monitorPageChanges === 'function') {
      PageIdentifier.monitorPageChanges(() => handleNavigation());
      this.navigationListenerRegistered = true;
      return;
    }

    if (typeof NavigationObserver !== 'undefined' && typeof NavigationObserver.onRouteChange === 'function') {
      NavigationObserver.onRouteChange(() => handleNavigation());
      this.navigationListenerRegistered = true;
    }
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
