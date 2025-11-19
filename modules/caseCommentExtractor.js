/**
 * Case Comment Extractor Module
 * Extracts case comments from Salesforce Lightning and formats them as XML or TSV
 * 
 * @module caseCommentExtractor
 */

const CaseCommentExtractor = (() => {
    'use strict';

    // Private state
    let buttonsInjected = false;
    let extractorObserver = null;
    let currentCaseId = null; // Track current case to detect navigation

    /**
     * Gets the current case ID from URL
     * Supports both case detail page and case comments full view page
     * @returns {string|null} Case ID or null
     */
    function getCurrentCaseId() {
        // Match case detail page: /Case/[ID] or /lightning/r/Case/[ID]
        const caseDetailMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
        if (caseDetailMatch) {
            return caseDetailMatch[1];
        }
        
        // Match case comments full view page: /lightning/r/Case/[ID]/related/CaseComments/view
        const caseCommentsMatch = window.location.pathname.match(/\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})\/related\/CaseComments\/view/i);
        if (caseCommentsMatch) {
            return caseCommentsMatch[1];
        }
        
        return null;
    }

    /**
     * Escapes special XML characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeXML(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Formats date to DD/MM/YYYY HH:MM format
     * @param {string} dateStr - Date string to format
     * @returns {string} Formatted date
     */
    function formatCommentDate(dateStr) {
        if (!dateStr || dateStr === 'N/A') return 'N/A';
        
        try {
            // Remove commas and try standard parsing first
            let date = new Date(dateStr.replace(/,/g, ''));
            
            // If standard parsing fails, try manual parsing
            if (isNaN(date.getTime())) {
                // Try DD/MM/YYYY HH:MM (24hr)
                const parts24 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
                if (parts24) {
                    const day = parseInt(parts24[1], 10);
                    const month = parseInt(parts24[2], 10);
                    const year = parseInt(parts24[3], 10);
                    const hours = parseInt(parts24[4], 10);
                    const minutes = parseInt(parts24[5], 10);
                    date = new Date(year, month - 1, day, hours, minutes);
                } else {
                    // Try DD/MM/YYYY HH:MM AM/PM
                    const parts12 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
                    if (parts12) {
                        const day = parseInt(parts12[1], 10);
                        const month = parseInt(parts12[2], 10);
                        const year = parseInt(parts12[3], 10);
                        let hours = parseInt(parts12[4], 10);
                        const minutes = parseInt(parts12[5], 10);
                        const ampm = parts12[6].toUpperCase();
                        
                        if (ampm === 'PM' && hours < 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;
                        
                        date = new Date(year, month - 1, day, hours, minutes);
                    }
                }
            }
            
            if (isNaN(date?.getTime())) {
                console.warn(`Could not parse date: "${dateStr}". Returning original.`);
                return dateStr;
            }
            
            // Format to DD/MM/YYYY HH:MM (24hr format)
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (e) {
            console.error(`Error formatting date "${dateStr}":`, e);
            return dateStr;
        }
    }

    /**
     * Shows a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type (success, error, warning, info)
     */
    function showToast(message, type = 'success') {
        console.log(`Toast (${type}): ${message}`);
        
        // Try using Salesforce native toast first
        if (typeof $A !== 'undefined' && $A.get) {
            try {
                const toastEvent = $A.get('e.force:showToast');
                if (toastEvent) {
                    toastEvent.setParams({
                        title: type.charAt(0).toUpperCase() + type.slice(1),
                        message: message,
                        type: type,
                        mode: type === 'error' ? 'sticky' : 'dismissible'
                    });
                    toastEvent.fire();
                    console.log('Native Salesforce toast fired.');
                    return;
                }
            } catch (e) {
                console.error('Error firing native Salesforce toast:', e);
            }
        }
        
        // Custom fallback toast
        const toastId = `custom-toast-${Date.now()}`;
        const toast = document.createElement('div');
        toast.id = toastId;
        
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '4px',
            color: 'white',
            zIndex: '9999',
            fontSize: '14px',
            maxWidth: '350px',
            boxShadow: '0 3px 6px rgba(0,0,0,0.16)',
            opacity: '1',
            transition: 'opacity 0.5s ease-out'
        });
        
        switch (type) {
            case 'success':
                toast.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                toast.style.backgroundColor = '#F44336';
                break;
            case 'warning':
                toast.style.backgroundColor = '#FFC107';
                toast.style.color = '#000';
                break;
            default:
                toast.style.backgroundColor = '#2196F3';
        }
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            const el = document.getElementById(toastId);
            if (el) {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 500);
            }
        }, 3500);
    }

    /**
     * Copies text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                console.log('Text copied using navigator.clipboard');
                return true;
            } else {
                console.log('Attempting fallback copy...');
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (successful) {
                    console.log('Fallback copy successful');
                    return true;
                } else {
                    console.error('Fallback copy failed');
                    return false;
                }
            }
        } catch (err) {
            console.error('Failed to copy text:', err);
            return false;
        }
    }

    /**
     * Extracts case metadata from the page
     * Uses PageContextValidator to ensure data matches current page (prevents stale data)
     * @returns {Promise<Object>} Case metadata (validated against current page context)
     */
    async function extractCaseMetadata() {
        const metadata = {};
        
        // Extract Case ID from URL FIRST (source of truth)
        let urlMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
        metadata.caseId = urlMatch?.[1] || null;
        
        // Extract Case Number
        const caseNumberElement = document.querySelector('lightning-formatted-text[data-output-element-id="output-field"][slot="output"]');
        let caseNumber = caseNumberElement?.textContent.trim() || '';
        
        // Fallback: Extract from page title
        if (!caseNumber) {
            const titleElement = document.querySelector('title');
            const titleText = titleElement?.textContent.trim() || '';
            if (/^\d{8}/.test(titleText)) {
                caseNumber = titleText.substring(0, 8);
            }
        }
        
        // Additional fallback: Try to extract from breadcrumb or header on comments page
        if (!caseNumber) {
            const breadcrumbLinks = document.querySelectorAll('nav[role="navigation"] a, .breadcrumb a');
            for (const link of breadcrumbLinks) {
                const linkText = link.textContent.trim();
                if (/^\d{8}$/.test(linkText)) {
                    caseNumber = linkText;
                    break;
                }
            }
        }
        
        metadata.caseNumber = caseNumber || null;
        
        // GUARDRAIL: Validate extracted metadata against current page context
        // This prevents stale data from being used when navigating between cases
        if (typeof PageContextValidator !== 'undefined' && 
            typeof PageContextValidator.validateExtractedData === 'function') {
            try {
                const validatedMetadata = await PageContextValidator.validateExtractedData(metadata, {
                    waitForTitle: false, // Don't wait during extraction (we're extracting fresh)
                    requireCaseId: true,
                    requireCaseNumber: false // Case number might not be available immediately
                });
                
                if (!validatedMetadata) {
                    console.warn('[CaseCommentExtractor] Metadata validation failed, returning null');
                    return null;
                }
                
                // Use validated metadata (ensures caseId and caseNumber match current page)
                metadata.caseId = validatedMetadata.caseId || 'N/A';
                metadata.caseNumber = validatedMetadata.caseNumber || 'N/A';
                console.log('[CaseCommentExtractor] Metadata validated successfully');
            } catch (error) {
                console.error('[CaseCommentExtractor] Error during metadata validation:', error);
                // On validation error, still return metadata but log the error
                // This provides graceful degradation
            }
        } else {
            // Fallback: Simple validation if PageContextValidator not available
            if (!metadata.caseId || metadata.caseId === 'N/A') {
                console.warn('[CaseCommentExtractor] No case ID available, cannot validate');
                return null;
            }
        }
        
        // Extract subject
        const subjectElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Subject"] lightning-formatted-text[slot="outputField"]');
        metadata.subject = subjectElement?.textContent.trim() || 'N/A';
        
        // Extract description
        const descriptionElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Description"] lightning-formatted-text[slot="outputField"]');
        metadata.description = descriptionElement?.textContent.trim() || 'N/A';
        
        // Extract other metadata fields
        const metadataFields = {
            'Priority': 'priority',
            'Status': 'status',
            'Contact Name': 'contactName',
            'Account Name': 'accountName'
        };
        
        document.querySelectorAll('records-record-layout-item, div.forcePageBlockItem').forEach((item) => {
            // Skip non-visible items to avoid getting metadata from hidden/cached cases
            if (!isElementVisible(item)) {
                return;
            }
            
            const labelElement = item.querySelector('.slds-form-element__label, .test-id__field-label, label');
            if (labelElement) {
                const labelText = labelElement.textContent.trim();
                if (metadataFields[labelText]) {
                    const valueElement = item.querySelector(
                        '.slds-form-element__static lightning-formatted-text, ' +
                        '.slds-form-element__control output lightning-formatted-text, ' +
                        '.forceOutputLookup a span, .forceOutputLookup a, ' +
                        '.forceOutputPicklist span, ' +
                        'lightning-formatted-date-time, ' +
                        'lightning-formatted-rich-text span, ' +
                        '.test-id__field-value span, .test-id__field-value a, ' +
                        'span.uiOutputText'
                    );
                    
                    if (valueElement) {
                        let value = valueElement.textContent.trim();
                        
                        // Clean up lookup field values
                        if (labelText === 'Contact Name' || labelText === 'Account Name') {
                            if (value.startsWith('Open ') && value.includes(' Preview')) {
                                value = value.substring(value.indexOf(' ') + 1, value.lastIndexOf(' Preview')).trim();
                            } else if (valueElement.tagName === 'A' && valueElement.hasAttribute('title')) {
                                value = valueElement.getAttribute('title');
                            }
                        }
                        
                        metadata[metadataFields[labelText]] = value;
                    } else {
                        metadata[metadataFields[labelText]] = '';
                    }
                }
            }
        });
        
        console.log('Extracted metadata:', metadata);
        return metadata;
    }

    /**
     * Finds the case comments table on the page (only visible tables)
     * Supports both case detail page and case comments full view page
     * @returns {Element|null} The comments table element or null
     */
    function findCommentsTable() {
        // Try multiple selectors for the Comments tab/section
        const containerSelectors = [
            // Case Comments full view page - list view manager
            'div.forceListViewManager',
            'div.test-listViewManager',
            'lst-list-view-manager',
            // Standard related list containers (case detail page)
            'article.slds-card[title*="Case Comments"]',
            'div.forceRelatedListContainer[title*="Case Comments"]',
            'div[aria-label*="Case Comments"]',
            '#CaseComments_body',
            '.related_list_container[id*="CaseComments"]',
            // Broader fallback - look for any container with Case Comments header
            'div.slds-card:has(h2:contains("Case Comments"))',
            'div.slds-card:has(span[title="Case Comments"])',
            // Look for list-view-manager-header with Case Comments
            'lst-list-view-manager-header:has(span[title="Case Comments"])'
        ];
        
        let commentsContainer = null;
        for (const selector of containerSelectors) {
            try {
                // Use querySelectorAll and check title/text content for :has() compatibility
                if (selector.includes(':has(') || selector.includes(':contains(')) {
                    // Manual check for "Case Comments" text
                    const candidates = document.querySelectorAll('div.slds-card, div.forceListViewManager, lst-list-view-manager-header, lst-list-view-manager');
                    for (const candidate of candidates) {
                        // Skip non-visible candidates
                        if (!isElementVisible(candidate)) {
                            console.log('[CaseCommentExtractor] Skipping non-visible candidate container');
                            continue;
                        }
                        
                        const text = candidate.textContent || '';
                        const title = candidate.getAttribute('title') || '';
                        if (text.includes('Case Comments') || title.includes('Case Comments')) {
                            commentsContainer = candidate;
                            console.log('[CaseCommentExtractor] Comments container found with text/title match (visible)');
                            break;
                        }
                    }
                } else {
                    // Get all matching elements and find the visible one
                    const candidates = document.querySelectorAll(selector);
                    for (const candidate of candidates) {
                        if (isElementVisible(candidate)) {
                            commentsContainer = candidate;
                            console.log('[CaseCommentExtractor] Comments container found with selector (visible):', selector);
                            break;
                        }
                    }
                }
                
                if (commentsContainer) {
                    break;
                }
            } catch (e) {
                console.warn(`[CaseCommentExtractor] Selector "${selector}" failed:`, e);
            }
        }
        
        if (!commentsContainer) {
            console.error('Case Comments container not found. Trying broader search...');
            // Last resort: find any visible table with comment-related columns
            const allTables = document.querySelectorAll('table[role="grid"], table.slds-table');
            for (const table of allTables) {
                // Only check visible tables
                if (!isElementVisible(table)) {
                    console.log('[CaseCommentExtractor] Skipping non-visible table');
                    continue;
                }
                
                const headers = Array.from(table.querySelectorAll('thead th'));
                const headerTexts = headers.map(h => (h.textContent || '').trim().toLowerCase());
                if (headerTexts.includes('comment') || (headerTexts.includes('user') && headerTexts.includes('public'))) {
                    console.log('Found visible table with comment-related headers (fallback)');
                    return table;
                }
            }
            return null;
        }
        
        // Find the table within the container - try multiple selectors
        const tableSelectors = [
            'table.slds-table',
            'table.list',
            'table.forceRecordLayout',
            'table.uiVirtualDataTable',
            'table[role="grid"]'
        ];
        
        let commentsTable = null;
        for (const selector of tableSelectors) {
            const tables = commentsContainer.querySelectorAll(selector);
            for (const table of tables) {
                if (isElementVisible(table)) {
                    commentsTable = table;
                    console.log('Comments table found with selector (visible):', selector);
                    break;
                }
            }
            if (commentsTable) break;
        }
        
        if (!commentsTable) {
            console.warn('Case Comments table not found in container. Might be empty or using different structure.');
            return null;
        }
        
        console.log('Visible comments table found:', commentsTable);
        return commentsTable;
    }

    /**
     * Extracts comments from the table
     * @param {Element} table - The comments table element
     * @returns {Array} Array of comment objects
     */
    function extractCommentsFromTable(table) {
        const comments = [];
        const rows = table.querySelectorAll('tbody tr');
        console.log(`Found ${rows.length} comment rows.`);
        
        rows.forEach((row, index) => {
            // Helper to get cell text by label or index
            const getCellText = (label, cellIndex) => {
                const cell = row.querySelector(`th[data-label="${label}"], td[data-label="${label}"]`) || row.cells[cellIndex];
                if (!cell) return 'N/A';
                
                const innerElement = cell.querySelector(
                    'a, span, lightning-formatted-text, lightning-formatted-date-time, ' +
                    'lightning-formatted-rich-text span, div.feedBodyInner, .forceListViewManagerGridWrapText'
                );
                
                return innerElement?.textContent?.trim() || cell?.textContent?.trim() || 'N/A';
            };
            
            // Helper to get public status (checkbox)
            const getPublicStatus = () => {
                const cell = row.querySelector('th[data-label="Public"], td[data-label="Public"]') || row.cells[2];
                if (!cell) return 'No';
                
                const img = cell.querySelector('img');
                if (img) {
                    const title = img.getAttribute('title')?.toLowerCase();
                    const alt = img.getAttribute('alt')?.toLowerCase();
                    return (title === 'true' || title === 'checked' || alt === 'true' || alt === 'checked') ? 'Yes' : 'No';
                }
                
                const checkbox = cell.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    return checkbox.checked ? 'Yes' : 'No';
                }
                
                return cell.textContent.trim().toLowerCase() === 'true' ? 'Yes' : 'No';
            };
            
            // Extract comment fields (adjust indices based on actual table structure)
            const author = getCellText('Created By', 1);
            const isPublic = getPublicStatus();
            const date = getCellText('Created Date', 3);
            const commentText = getCellText('Comment Body', 4);
            
            comments.push({ author, isPublic, date, commentText });
        });
        
        if (comments.length === 0 && rows.length > 0) {
            console.warn('Found comment rows but failed to extract data. Check selectors.');
        }
        
        return comments;
    }

    /**
     * Main extraction function
     * @returns {Promise<Object|null>} Extracted case data or null
     */
    async function extractCaseComments() {
        console.log('Attempting to extract case comments...');
        
        const metadata = await extractCaseMetadata();
        
        // If metadata validation failed, return null
        if (!metadata) {
            console.warn('[CaseCommentExtractor] Cannot extract comments: metadata validation failed');
            return null;
        }
        
        const commentsTable = findCommentsTable();
        
        if (!commentsTable) {
            return { caseNumber: metadata.caseNumber, metadata, comments: [] };
        }
        
        const comments = extractCommentsFromTable(commentsTable);
        
        return {
            caseNumber: metadata.caseNumber,
            metadata,
            comments
        };
    }

    /**
     * Generates XML format from extracted data
     * @param {Object} data - Extracted case data
     * @returns {string} XML formatted string
     */
    function generateXML(data) {
        if (!data || !data.comments) return '<error>No data extracted</error>';
        
        const getMeta = (key) => data.metadata?.[key] || '';
        const escape = escapeXML;
        
        let xml = '<case>\n';
        xml += '  <metadata>\n';
        xml += `    <caseId>${escape(getMeta('caseId'))}</caseId>\n`;
        xml += `    <caseNumber>${escape(getMeta('caseNumber'))}</caseNumber>\n`;
        xml += `    <subject>${escape(getMeta('subject'))}</subject>\n`;
        xml += `    <description>${escape(getMeta('description'))}</description>\n`;
        xml += `    <priority>${escape(getMeta('priority'))}</priority>\n`;
        xml += `    <status>${escape(getMeta('status'))}</status>\n`;
        xml += `    <contactName>${escape(getMeta('contactName'))}</contactName>\n`;
        xml += `    <accountName>${escape(getMeta('accountName'))}</accountName>\n`;
        xml += '  </metadata>\n';
        xml += '  <updates>\n';
        
        // Sort comments by date (ascending - oldest to newest)
        const sortedComments = [...data.comments].sort((a, b) => {
            try {
                const parseDateString = (dateStr) => {
                    if (!dateStr || dateStr === 'N/A') return null;
                    
                    // Try parsing original date string directly
                    let date = new Date(dateStr.replace(/,/g, ''));
                    if (!isNaN(date.getTime())) return date;
                    
                    // Try DD/MM/YYYY HH:MM format (24hr)
                    const parts24 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
                    if (parts24) {
                        return new Date(parts24[3], parts24[2] - 1, parts24[1], parts24[4], parts24[5]);
                    }
                    
                    // Try DD/MM/YYYY HH:MM AM/PM format
                    const parts12 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
                    if (parts12) {
                        let hours = parseInt(parts12[4], 10);
                        const ampm = parts12[6].toUpperCase();
                        if (ampm === 'PM' && hours < 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;
                        return new Date(parts12[3], parts12[2] - 1, parts12[1], hours, parts12[5]);
                    }
                    
                    return null;
                };
                
                const dateA = parseDateString(a.date);
                const dateB = parseDateString(b.date);
                
                // Sort ascending (oldest first)
                if (dateA && dateB) return dateA - dateB;
                if (dateA) return -1; // Valid dates before invalid
                if (dateB) return 1;
                return 0;
            } catch (e) {
                console.warn('Error sorting comments by date:', e);
                return 0;
            }
        });
        
        sortedComments.forEach((comment) => {
            xml += `    <comment public="${comment.isPublic === 'Yes' ? 'true' : 'false'}">\n`;
            xml += `      <author>${escape(comment.author)}</author>\n`;
            xml += `      <date>${escape(formatCommentDate(comment.date))}</date>\n`;
            xml += `      <text>${escape(comment.commentText)}</text>\n`;
            xml += '    </comment>\n';
        });
        
        xml += '  </updates>\n</case>';
        return xml;
    }

    /**
     * Generates TSV table format from extracted data
     * @param {Object} data - Extracted case data
     * @returns {string} TSV formatted string
     */
    function generateTable(data) {
        if (!data || !data.comments) return 'No data available';
        
        const getMeta = (key) => data.metadata?.[key] || 'N/A';
        
        let table = `Case ID:\t${getMeta('caseId')}\n`;
        table += `Case Number:\t${getMeta('caseNumber')}\n`;
        table += `Subject:\t${getMeta('subject')}\n`;
        table += `Description:\t${getMeta('description')}\n`;
        table += `Contact:\t${getMeta('contactName')}\n`;
        table += `Account:\t${getMeta('accountName')}\n`;
        table += `Status:\t${getMeta('status')}\n`;
        table += '\n';
        table += 'Author\tPublic\tDate\tComment\n';
        
        // Sort comments by date (ascending - oldest to newest)
        const sortedComments = [...data.comments].sort((a, b) => {
            try {
                const parseDateString = (dateStr) => {
                    if (!dateStr || dateStr === 'N/A') return null;
                    
                    // Try parsing original date string directly
                    let date = new Date(dateStr.replace(/,/g, ''));
                    if (!isNaN(date.getTime())) return date;
                    
                    // Try DD/MM/YYYY HH:MM format (24hr)
                    const parts24 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
                    if (parts24) {
                        return new Date(parts24[3], parts24[2] - 1, parts24[1], parts24[4], parts24[5]);
                    }
                    
                    // Try DD/MM/YYYY HH:MM AM/PM format
                    const parts12 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
                    if (parts12) {
                        let hours = parseInt(parts12[4], 10);
                        const ampm = parts12[6].toUpperCase();
                        if (ampm === 'PM' && hours < 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;
                        return new Date(parts12[3], parts12[2] - 1, parts12[1], hours, parts12[5]);
                    }
                    
                    return null;
                };
                
                const dateA = parseDateString(a.date);
                const dateB = parseDateString(b.date);
                
                // Sort ascending (oldest first)
                if (dateA && dateB) return dateA - dateB;
                if (dateA) return -1; // Valid dates before invalid
                if (dateB) return 1;
                return 0;
            } catch (e) {
                console.warn('Error sorting comments by date:', e);
                return 0;
            }
        });
        
        sortedComments.forEach((comment) => {
            const escapedComment = (comment.commentText || '').replace(/\t/g, ' ').replace(/\n/g, ' ');
            const formattedDate = formatCommentDate(comment.date);
            table += `${comment.author || 'N/A'}\t${comment.isPublic}\t${formattedDate}\t${escapedComment}\n`;
        });
        
        return table;
    }

    /**
     * Creates and injects copy buttons into the action bar
     * @param {Element} actionContainer - The action bar container
     */
    function addCopyButtons(actionContainer) {
        if (!actionContainer || actionContainer.querySelector('[data-cc-extractor="true"]')) {
            return;
        }
        
        console.log('Adding copy buttons to:', actionContainer);
        
        const createButton = (text, title) => {
            const li = document.createElement('li');
            li.className = 'slds-button slds-button--neutral slds-button_neutral';
            li.setAttribute('data-cc-extractor', 'true');
            
            const a = document.createElement('a');
            a.href = 'javascript:void(0);';
            a.title = title;
            a.className = 'forceActionLink';
            a.setAttribute('role', 'button');
            
            const div = document.createElement('div');
            div.title = title;
            div.textContent = text;
            
            a.appendChild(div);
            li.appendChild(a);
            return li;
        };
        
        // Create Copy Table button
        const copyTableButton = createButton('Copy Table', 'Copy comments as TSV');
        copyTableButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const data = await extractCaseComments();
            if (data && data.comments.length > 0) {
                const tableText = generateTable(data);
                const success = await copyToClipboard(tableText);
                showToast(
                    success ? 'Table copied to clipboard' : 'Copy failed',
                    success ? 'success' : 'error'
                );
            } else {
                showToast(
                    data ? 'No comments found' : 'Extraction failed',
                    'warning'
                );
            }
        });
        
        // Create Copy XML button
        const copyXMLButton = createButton('Copy XML', 'Copy comments as XML');
        copyXMLButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const data = await extractCaseComments();
            if (data && data.comments.length > 0) {
                const xmlText = generateXML(data);
                const success = await copyToClipboard(xmlText);
                showToast(
                    success ? 'XML copied to clipboard' : 'Copy failed',
                    success ? 'success' : 'error'
                );
            } else {
                showToast(
                    data ? 'No comments found' : 'Extraction failed',
                    'warning'
                );
            }
        });
        
        // Append buttons to the action container
        actionContainer.appendChild(copyTableButton);
        actionContainer.appendChild(copyXMLButton);
        
        console.log('Copy buttons added successfully.');
    }

    /**
     * Checks if an element is visible
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} True if element is visible
     */
    function isElementVisible(element) {
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
    }

    /**
     * Attempts to find and inject buttons into the action bar
     * Supports both case detail page and case comments full view page
     * @returns {boolean} Success status
     */
    function tryInjectButtons() {
        // Try multiple selectors for the action bar container
        const actionBarSelectors = [
            // Primary: Standard action bar (next to "New" button)
            '.branding-actions.slds-button-group[data-aura-class="oneActionsRibbon forceActionsContainer"]',
            // Case Comments full view page: List view action bar
            'lst-list-view-manager-header .slds-button-group',
            // Case Comments full view page: Alternative list view header
            'div.forceListViewManagerHeader .slds-button-group',
            // Fallback 1: Alternative action container
            '.branding-actions.slds-button-group',
            // Fallback 2: Any button group in the header area
            '.slds-page-header__detail-row .slds-button-group',
            // Fallback 3: Related list action bar
            'div[class*="forceRelatedListViewManager"] .slds-button-group',
            // Fallback 4: Case Comments related list action bar
            'article[aria-label*="Case Comments"] .slds-button-group',
            // Fallback 5: List view manager button groups
            'div.forceListViewManager .slds-button-group',
            // Fallback 6: Any action buttons container in list view
            'lst-list-view-manager .actionsContainer .slds-button-group'
        ];

        for (const selector of actionBarSelectors) {
            // Get ALL matching elements (not just the first one)
            const actionContainers = document.querySelectorAll(selector);
            
            for (const actionContainer of actionContainers) {
                // Skip if not visible
                if (!isElementVisible(actionContainer)) {
                    console.log('[CaseCommentExtractor] Skipping non-visible action container:', selector);
                    continue;
                }
                
                // Check if buttons already exist in this container
                if (actionContainer.querySelector('[data-cc-extractor="true"]')) {
                    console.log('[CaseCommentExtractor] Buttons already injected in visible container');
                    buttonsInjected = true;
                    return true;
                }
                
                console.log('[CaseCommentExtractor] Found visible action container with selector:', selector);
                addCopyButtons(actionContainer);
                buttonsInjected = true;
                return true;
            }
        }
        
        console.log('[CaseCommentExtractor] No suitable visible action container found');
        return false;
    }

    /**
     * Initializes the case comment extractor
     * Sets up observers to inject buttons when the page is ready
     * Supports both case detail page and case comments full view page
     */
    function initialize() {
        // Get the current case ID
        const caseId = getCurrentCaseId();
        
        // Check if we're on a case page (either detail or comments view)
        if (!caseId) {
            console.log('[CaseCommentExtractor] Not on a case page, skipping initialization.');
            return;
        }
        
        // Determine page type for logging
        const isCommentsPage = window.location.pathname.includes('/related/CaseComments/view');
        const pageType = isCommentsPage ? 'case comments full view' : 'case detail';
        
        // Check if we've navigated to a different case
        if (currentCaseId && currentCaseId !== caseId) {
            console.log(`[CaseCommentExtractor] Navigated from case ${currentCaseId} to ${caseId}, cleaning up...`);
            cleanup();
        }
        
        // Update current case ID
        currentCaseId = caseId;
        
        console.log(`[CaseCommentExtractor] Initializing for case ${caseId} on ${pageType} page...`);
        
        // Try to inject buttons immediately
        if (tryInjectButtons()) {
            console.log('Buttons injected successfully on first attempt.');
            return;
        }
        
        // Set up observer if immediate injection failed
        if (extractorObserver) extractorObserver.disconnect();
        buttonsInjected = false;
        
        extractorObserver = new MutationObserver((mutations, obs) => {
            // Check if we're still on the same case
            const currentId = getCurrentCaseId();
            if (currentId !== currentCaseId) {
                console.log('Case changed during observation, reinitializing...');
                obs.disconnect();
                extractorObserver = null;
                initialize(); // Re-initialize for new case
                return;
            }
            
            if (tryInjectButtons()) {
                obs.disconnect();
                extractorObserver = null;
                console.log('Buttons injected after DOM changes.');
            }
        });
        
        // Observe the entire case view container for tab changes
        const observeTarget = document.querySelector('.oneConsole') || document.body;
        if (observeTarget) {
            extractorObserver.observe(observeTarget, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'data-aura-rendered-by']
            });
            console.log('Observer set up to watch for action bar.');
        }
    }

    /**
     * Cleanup function to remove buttons and disconnect observers
     */
    function cleanup() {
        // Remove injected buttons
        const injectedButtons = document.querySelectorAll('[data-cc-extractor="true"]');
        injectedButtons.forEach(button => button.remove());
        
        buttonsInjected = false;
        
        // Disconnect observer
        if (extractorObserver) {
            extractorObserver.disconnect();
            extractorObserver = null;
        }
        
        console.log('Case Comment Extractor cleaned up.');
    }

    /**
     * Sets up URL change monitoring to reinitialize on case navigation
     */
    function setupNavigationMonitoring() {
        // Monitor for URL changes (SPA navigation)
        let lastUrl = window.location.href;
        
        const checkUrlChange = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                
                const newCaseId = getCurrentCaseId();
                
                // If case ID changed or we left a case page
                if (newCaseId !== currentCaseId) {
                    if (currentCaseId) {
                        console.log(`Navigation detected: ${currentCaseId} → ${newCaseId || 'non-case page'}`);
                        cleanup();
                    }
                    
                    if (newCaseId) {
                        // New case page detected
                        setTimeout(() => initialize(), 500);
                    } else {
                        // Left case page
                        currentCaseId = null;
                    }
                }
            }
        };
        
        // Use MutationObserver to detect URL changes in SPA
        const urlObserver = new MutationObserver(checkUrlChange);
        urlObserver.observe(document.querySelector('title') || document.head, {
            childList: true,
            subtree: true
        });
        
        // Also listen for popstate (browser back/forward)
        window.addEventListener('popstate', checkUrlChange);
        
        console.log('Navigation monitoring set up for Case Comment Extractor.');
    }

    // Public API
    return {
        initialize,
        cleanup,
        extractCaseComments,
        generateXML,
        generateTable,
        setupNavigationMonitoring
    };
})();
