/**
 * Case Identifiers Module
 * Provides utilities for extracting case IDs and numbers from URLs and DOM
 *
 * @module caseIdentifiers
 */

const CaseIdentifiers = (() => {
    'use strict';

    /**
     * Gets the current case ID from URL
     * Supports both case detail page and case comments full view page
     * @returns {string|null} Case ID or null
     */
    function getCaseIdFromUrl() {
        const pathname = window.location.pathname;

        // Match case detail page: /Case/[ID] or /lightning/r/Case/[ID]
        const caseDetailMatch = pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
        if (caseDetailMatch) {
            return caseDetailMatch[1];
        }

        // Match case comments full view page: /lightning/r/Case/[ID]/related/CaseComments/view
        const caseCommentsMatch = pathname.match(/\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})\/related\/CaseComments\/view/i);
        if (caseCommentsMatch) {
            return caseCommentsMatch[1];
        }

        return null;
    }

    /**
     * Gets the case number from the page header
     * @returns {string|null} Case number or null
     */
    function getCaseNumberFromHeader() {
        // Try primary field (Lightning)
        const headerField = document.querySelector('slot[name="primaryField"] lightning-formatted-text, records-formula-output[slot="primaryField"] lightning-formatted-text');
        if (headerField) {
            const headerText = (headerField.textContent || '').trim();
            const numberMatch = headerText.match(/^([0-9]{6,})/);
            return numberMatch ? numberMatch[1] : headerText;
        }

        // Try output field element
        const caseNumberElement = document.querySelector('lightning-formatted-text[data-output-element-id="output-field"][slot="output"]');
        if (caseNumberElement) {
            const caseNumber = caseNumberElement.textContent.trim();
            if (caseNumber && /^\d{6,}/.test(caseNumber)) {
                return caseNumber;
            }
        }

        // Fallback: Extract from page title
        const titleElement = document.querySelector('title');
        if (titleElement) {
            const titleText = titleElement.textContent.trim();
            if (/^\d{6,}/.test(titleText)) {
                // Extract number from title (e.g., "12345678 - Subject")
                const match = titleText.match(/^(\d{6,})/);
                return match ? match[1] : null;
            }
        }

        // Additional fallback: Try to extract from breadcrumb or header on comments page
        const breadcrumbLinks = document.querySelectorAll('nav[role="navigation"] a, .breadcrumb a');
        for (const link of breadcrumbLinks) {
            const linkText = link.textContent.trim();
            if (/^\d{6,}$/.test(linkText)) {
                return linkText;
            }
        }

        return null;
    }

    /**
     * Checks if the current page is a case page
     * @returns {boolean} True if on a case page
     */
    function isCasePage() {
        return getCaseIdFromUrl() !== null;
    }

    /**
     * Gets comprehensive case identification data
     * @returns {Object} { caseId: string|null, caseNumber: string|null }
     */
    function getCaseInfo() {
        return {
            caseId: getCaseIdFromUrl(),
            caseNumber: getCaseNumberFromHeader()
        };
    }

    // Public API
    return {
        getCaseIdFromUrl,
        getCaseNumberFromHeader,
        isCasePage,
        getCaseInfo
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CaseIdentifiers;
}
