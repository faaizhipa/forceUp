/**
 * Case List Processor Module
 * 
 * Handles case list table detection, enhancement, and processing functionality
 * including age-based highlighting and status badges.
 */

import { querySelectorDeepAll } from '../utils/domUtils.js';
import { highlightRow, generateStatusStyle } from '../ui/styleUtils.js';
import { 
    calculateTimeDifferenceInMinutes, 
    getEarlierDate,
    isValidDateFormat,
    isValidDateFormat2,
    isValidDateFormatDDMMnoAMPM,
    isValidDateFormatMMDDnoAMPM,
    convertDateFormat,
    convertDateFormat2,
    convertDateFormatDDMMwithAMPM,
    convertDateFormatMMDDwithAMPM
} from '../utils/dateUtils.js';

/**
 * Attempts to locate the case list table across different Lightning DOM variants.
 * @returns {HTMLTableElement|null} The detected case list table or null if not found.
 */
export function findCaseListTable() {
    const potentialTables = querySelectorDeepAll('table.slds-table');
    for (const table of potentialTables) {
        if (!table.tBodies || table.tBodies.length === 0) continue;

        const headerCells = table.querySelectorAll('thead th');
        const headerText = Array.from(headerCells).map(th => th.textContent.trim().toLowerCase()).join(' ');
        if (!headerText) continue;

        const containsCaseColumns = headerText.includes('case') || headerText.includes('status') || headerText.includes('subject');
        if (containsCaseColumns) {
            return table;
        }
    }

    return null;
}

/**
 * Applies case list enhancements and wires observers to keep them updated on row changes.
 * @param {HTMLTableElement} table The table element representing the case list.
 */
export function processCaseListTable(table) {
    if (table.dataset.caseListEnhanced === 'true' || table.dataset.caseListEnhanced === 'waiting') {
        return;
    }

    const tbody = table.querySelector('tbody');
    if (!tbody) {
        table.dataset.caseListEnhanced = 'waiting';
        const pendingObserver = new MutationObserver((mutations, pendingObs) => {
            const innerTbody = table.querySelector('tbody');
            if (innerTbody) {
                pendingObs.disconnect();
                delete table.dataset.caseListEnhanced;
                processCaseListTable(table);
            }
        });
        pendingObserver.observe(table, { childList: true, subtree: true });
        return;
    }

    handleCases(table);
    handleStatus(table);

    const observer = new MutationObserver(() => {
        handleCases(table);
        handleStatus(table);
    });

    observer.observe(tbody, { childList: true, subtree: true });
    table.dataset.caseListEnhanced = 'true';
}

/**
 * Iterates through the rows of a case list table, calculates the age of each case,
 * and applies a background highlight color based on its age.
 * @param {HTMLTableElement} table The case list table element to process.
 */
export function handleCases(table) {
    const rows = table.querySelector('tbody').querySelectorAll('tr');
    for (let row of rows) {
        const dateArray = [];
        const dateElements = row.querySelectorAll("td span span");
        dateElements.forEach(element => {
            const textContent = element.textContent;
            if (isValidDateFormat(textContent)) {
                dateArray.push(convertDateFormat(textContent));
            } else if (isValidDateFormat2(textContent)) {
                dateArray.push(convertDateFormat2(textContent));
            } else if (isValidDateFormatDDMMnoAMPM(textContent)) {
                const addAMPM = convertDateFormatDDMMwithAMPM(textContent);
                dateArray.push(convertDateFormat(addAMPM));
            } else if (isValidDateFormatMMDDnoAMPM(textContent)) {
                const addAMPM = convertDateFormatMMDDwithAMPM(textContent);
                dateArray.push(convertDateFormat(addAMPM));
            }
        });

        if (dateArray.length > 0) {
            let earlierDate = dateArray.length === 2 ? getEarlierDate(dateArray[0], dateArray[1]) : new Date(dateArray[0]);
            const caseMinutes = calculateTimeDifferenceInMinutes(earlierDate);

            if (caseMinutes > 90) {
                highlightRow(row, "rgb(255, 220, 230)"); // Light Red
            } else if (caseMinutes > 60) {
                highlightRow(row, "rgb(255, 232, 184)"); // Light Orange
            } else if (caseMinutes > 30) {
                highlightRow(row, "rgb(209, 247, 196)"); // Light Green
            } else {
                highlightRow(row, "rgb(194, 244, 233)"); // Light Blue
            }
        }
    }
}

/**
 * Iterates through the cells of a case list table and applies a colored badge
 * to any cell containing a known case status text.
 * @param {HTMLTableElement} table The case list table element to process.
 */
export function handleStatus(table) {
    const rows = table.querySelector('tbody').querySelectorAll('tr');
    for (let row of rows) {
        let cells = row.querySelectorAll('td span span');
        for (let cell of cells) {
            let cellText = cell.textContent.trim();
            if (cellText === "New Email Received" || cellText === "Re-opened" || cellText === "Completed by Resolver Group" || cellText === "New" || cellText === "Update Received") {
                cell.setAttribute("style", generateStatusStyle("rgb(191, 39, 75)"));
            } else if (cellText === "Pending Action" || cellText === "Initial Response Sent" || cellText === "In Progress") {
                cell.setAttribute("style", generateStatusStyle("rgb(247, 114, 56)"));
            } else if (cellText === "Assigned to Resolver Group" || cellText === "Pending Internal Response") {
                cell.setAttribute("style", generateStatusStyle("rgb(140, 77, 253)"));
            } else if (cellText === "Solution Delivered to Customer") {
                cell.setAttribute("style", generateStatusStyle("rgb(45, 200, 64)"));
            } else if (cellText === "Closed" || cellText === "Pending Customer Response") {
                cell.setAttribute("style", generateStatusStyle("rgb(103, 103, 103)"));
            } else if (cellText === "Pending System Update - Defect" || cellText === "Pending System Update - Enhancement") {
                cell.setAttribute("style", generateStatusStyle("rgb(251, 178, 22)"));
            }
        }
    }
}