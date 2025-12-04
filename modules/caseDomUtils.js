/**
 * CaseDomUtils Module
 * Shared helpers for reliably selecting case header data from the visible highlights panel
 */

const CaseDomUtils = {
  /**
   * Gets the currently visible highlights panel container
   * Uses best-practice selector that ensures we only read from the active tab + visible layout
   * @returns {Element|null}
   */
  getVisibleHighlightsContainer() {
    const selector = 'section.tabContent.active .forcegenerated-record-layout2[style*="display: block"] div.highlights';
    const container = document.querySelector(selector);
    if (container) {
      return container;
    }

    // Fallback to the standard highlights container if visibility attributes are missing
    return document.querySelector('div.highlights.slds-page-header_record-home');
  },

  /**
   * Gets the lightning-formatted-text element that contains the case header (number + subject)
   * @returns {Element|null}
   */
  getVisibleCaseHeaderElement() {
    const container = this.getVisibleHighlightsContainer();
    if (!container || this.isElementVisible(container) === false) {
      return null;
    }

    const headerSelector = '.slds-page-header__title lightning-formatted-text';
    const header = container.querySelector(headerSelector);
    return header || null;
  },

  /**
   * Gets the raw text for the case header (case number + subject)
   * @returns {string|null}
   */
  getVisibleCaseHeaderText() {
    const headerElement = this.getVisibleCaseHeaderElement();
    if (!headerElement || this.isElementVisible(headerElement) === false) {
      return null;
    }

    const text = headerElement.textContent || '';
    return text.trim() || null;
  },

  /**
   * Extracts the case number from a header string
   * @param {string|null} headerText
   * @returns {string|null}
   */
  extractCaseNumberFromHeader(headerText) {
    if (!headerText) {
      return null;
    }

    const match = headerText.match(/^([0-9]{6,})/);
    return match ? match[1] : null;
  },

  /**
   * Extracts the subject portion from a header string
   * @param {string|null} headerText
   * @returns {string|null}
   */
  extractSubjectFromHeader(headerText) {
    if (!headerText) {
      return null;
    }

    const parts = headerText.split(' - ');
    if (parts.length > 1) {
      return parts.slice(1).join(' - ').trim() || null;
    }
    return null;
  },

  /**
   * Convenience helper to get the visible case number directly
   * @returns {string|null}
   */
  getVisibleCaseNumber() {
    const header = this.getVisibleCaseHeaderText();
    return this.extractCaseNumberFromHeader(header);
  },

  /**
   * Convenience helper to get the visible case subject directly
   * @returns {string|null}
   */
  getVisibleCaseSubject() {
    const header = this.getVisibleCaseHeaderText();
    return this.extractSubjectFromHeader(header);
  },

  /**
   * Checks if an element is visible
   * Checks display:none, visibility:hidden, and element dimensions
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if element is visible
   */
  isElementVisible(element) {
    if (!element) return false;
    
    // Check if element or any parent has display:none or visibility:hidden
    let current = element;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      current = current.parentElement;
    }
    
    // Check if element has dimensions
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  /**
   * Gets the first visible element from a list of candidates
   * @param {NodeList|Array<Element>} candidates - List of candidate elements
   * @returns {Element|null} First visible element or null
   */
  getFirstVisibleElement(candidates) {
    if (!candidates || candidates.length === 0) {
      return null;
    }
    
    for (const candidate of candidates) {
      if (this.isElementVisible(candidate)) {
        return candidate;
      }
    }
    
    return null;
  },

  /**
   * Query selector with visibility filtering
   * Returns the first visible matching element
   * @param {string} selector - CSS selector
   * @param {Element} root - Root element to search from (default: document.body)
   * @returns {Element|null} First visible matching element or null
   */
  queryVisibleSelector(selector, root = document.body) {
    const candidates = root.querySelectorAll(selector);
    return this.getFirstVisibleElement(candidates);
  }
};

// Export for testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaseDomUtils;
}

