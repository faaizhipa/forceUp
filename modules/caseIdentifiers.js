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
     * Supports:
     * - Case detail page: /Case/[ID] or /lightning/r/Case/[ID]
     * - Case comments full view page: /lightning/r/Case/[ID]/related/CaseComments/view
     * - Child case viewed in parent context: ?ws=%2Flightning%2Fr%2FCase%2F[CHILD_ID]%2Fview
     *
     * Priority: ws parameter (actual case) > pathname (parent/original case)
     * @returns {string|null} Case ID or null
     */
    function getCaseIdFromUrl() {
        // PRIORITY 1: Check ws (workspace) parameter for actual case being viewed
        // This handles child cases viewed within parent case context
        // Example: /lightning/r/Case/PARENT_ID/view?ws=%2Flightning%2Fr%2FCase%2FCHILD_ID%2Fview
        const urlParams = new URLSearchParams(window.location.search);
        const wsParam = urlParams.get('ws');

        if (wsParam) {
            // ws parameter is URL-encoded: %2F = /, %2Flightning%2Fr%2FCase%2F[ID]%2Fview
            // Decode and extract case ID from workspace path
            const decodedWs = decodeURIComponent(wsParam);
            const wsMatch = decodedWs.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
            if (wsMatch) {
                console.log('[CaseIdentifiers] Case ID extracted from ws parameter:', wsMatch[1]);
                return wsMatch[1];
            }
        }

        // PRIORITY 2: Check pathname for case detail page
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
