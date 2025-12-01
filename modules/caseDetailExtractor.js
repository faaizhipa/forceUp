/**
 * Case Detail Extractor Module
 * Extracts case details and formats them as XML or TSV
 * 
 * @module caseDetailExtractor
 */

const CaseDetailExtractor = (() => {
    'use strict';

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
     * Extracts case details from the page
     * Uses already-processed case data from ExLibrisExtension if available
     * Falls back to customer list data when case data is incomplete
     * @returns {Promise<Object>} Case details
     */
    async function extractCaseDetails() {
        const details = {};
        
        // Extract Case ID from URL FIRST (before checking cache)
        const urlMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
        const currentCaseId = urlMatch?.[1] || null;
        details.caseId = currentCaseId;
        
        // Try to get already-processed case data from the main extension
        // BUT validate it matches the current case to prevent stale data
        let caseData = null;
        if (typeof window.ExLibrisExtension !== 'undefined' && 
            window.ExLibrisExtension.caseToolkit?.caseData) {
            
            const cachedData = window.ExLibrisExtension.caseToolkit.caseData;
            
            // GUARDRAIL: Validate cached data using shared validation function
            if (typeof PageContextValidator !== 'undefined' && 
                typeof PageContextValidator.validateExtractedData === 'function') {
                
                try {
                    const validatedData = await PageContextValidator.validateExtractedData(cachedData, {
                        waitForTitle: false, // Don't wait during extraction
                        requireCaseId: true,
                        requireCaseNumber: false
                    });
                    
                    if (validatedData) {
                        caseData = cachedData; // Use cached data (it's validated)
                        console.log('[CaseDetailExtractor] Cached data validated by PageContextValidator');
                    } else {
                        console.warn('[CaseDetailExtractor] Cached data validation failed, will extract fresh');
                    }
                } catch (error) {
                    console.error('[CaseDetailExtractor] Error during cache validation:', error);
                    // Fall through to extract fresh data
                }
            } else {
                // Fallback: Simple case ID validation if PageContextValidator not available
                if (currentCaseId && 
                    cachedData.caseId === currentCaseId &&
                    window.ExLibrisExtension.currentCaseId === currentCaseId) {
                    caseData = cachedData;
                    console.log('[CaseDetailExtractor] Cached data validated by case ID match');
                } else {
                    console.warn('[CaseDetailExtractor] Cached data case ID mismatch:', {
                        cachedCaseId: cachedData.caseId,
                        currentCaseId: currentCaseId,
                        globalCaseId: window.ExLibrisExtension.currentCaseId
                    });
                }
            }
            
            if (caseData) {
                console.log('[CaseDetailExtractor] Using validated cached case data from ExLibrisExtension');
                
                // Check if cached data is missing server information
                if (!caseData.server) {
                    console.log('[CaseDetailExtractor] Cache incomplete (missing server). Triggering prepareTools...');
                    
                    // Trigger prepareTools to get complete data
                    if (typeof window.ExLibrisExtension.handlePrepareToolsAction === 'function') {
                        try {
                            await window.ExLibrisExtension.handlePrepareToolsAction();
                            
                            // Re-read the cache after prepareTools completes
                            if (window.ExLibrisExtension.caseToolkit?.caseData) {
                                const updatedData = window.ExLibrisExtension.caseToolkit.caseData;
                                
                                // Re-validate after prepareTools (case might have changed)
                                if (typeof PageContextValidator !== 'undefined' && 
                                    typeof PageContextValidator.validateExtractedData === 'function') {
                                    const reValidated = await PageContextValidator.validateExtractedData(updatedData, {
                                        waitForTitle: false,
                                        requireCaseId: true,
                                        requireCaseNumber: false
                                    });
                                    
                                    if (reValidated) {
                                        caseData = updatedData;
                                        console.log('[CaseDetailExtractor] Cache updated after prepareTools. Server:', caseData.server);
                                    } else {
                                        console.warn('[CaseDetailExtractor] Case changed during prepareTools, ignoring updated cache');
                                    }
                                } else {
                                    // Fallback validation
                                    if (currentCaseId && updatedData.caseId === currentCaseId) {
                                        caseData = updatedData;
                                        console.log('[CaseDetailExtractor] Cache updated after prepareTools. Server:', caseData.server);
                                    } else {
                                        console.warn('[CaseDetailExtractor] Case changed during prepareTools, ignoring updated cache');
                                    }
                                }
                            }
                        } catch (error) {
                            console.warn('[CaseDetailExtractor] prepareTools failed, continuing with available data:', error);
                        }
                    }
                }
            }
        }
        
        // If no valid cached data, extract fresh
        if (!caseData && typeof CaseDataExtractor !== 'undefined') {
            // Fallback: extract fresh data
            try {
                console.log('[CaseDetailExtractor] No valid cached data, extracting fresh...');
                caseData = await CaseDataExtractor.getData();
                
                // GUARDRAIL: Validate extracted fresh data
                if (caseData && typeof PageContextValidator !== 'undefined' && 
                    typeof PageContextValidator.validateExtractedData === 'function') {
                    const validatedData = await PageContextValidator.validateExtractedData(caseData, {
                        waitForTitle: false,
                        requireCaseId: true,
                        requireCaseNumber: false
                    });
                    
                    if (validatedData) {
                        caseData = validatedData; // Use validated data
                    } else {
                        console.warn('[CaseDetailExtractor] Extracted fresh data validation failed');
                        // Still use the data but log the warning
                    }
                }
            } catch (error) {
                console.warn('[CaseDetailExtractor] Could not extract case data:', error);
            }
        }
        
        // Ensure caseId is set (use URL as source of truth)
        if (!details.caseId && caseData?.caseId) {
            details.caseId = caseData.caseId;
        }
        
        // Use case data if available, otherwise extract from DOM
        details.caseNumber = caseData?.caseNumber || null;
        details.subject = caseData?.subject || null;
        details.description = caseData?.description || null;
        details.priority = caseData?.priority || null;
        details.status = caseData?.status || null;
        details.contactName = caseData?.contactName || null;
        details.accountName = caseData?.accountName || null;
        
        // If case data is not available, try extracting from DOM as fallback
        if (!caseData) {
            console.log('[CaseDetailExtractor] Extracting from DOM as fallback...');
            
            if (!details.caseNumber) {
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
                details.caseNumber = caseNumber || null;
            }
            
            if (!details.subject) {
                const subjectElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Subject"] lightning-formatted-text[slot="outputField"]');
                details.subject = subjectElement?.textContent.trim() || null;
            }
            
            if (!details.description) {
                const descriptionElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Description"] lightning-formatted-text[slot="outputField"]');
                details.description = descriptionElement?.textContent.trim() || null;
            }
            
            if (!details.priority) {
                const priorityElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Priority"] lightning-formatted-text[slot="outputField"]');
                details.priority = priorityElement?.textContent.trim() || null;
            }
            
            if (!details.status) {
                const statusElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Status"] lightning-formatted-text[slot="outputField"]');
                details.status = statusElement?.textContent.trim() || null;
            }
            
            if (!details.contactName) {
                const contactElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.ContactId"] a[data-reftype="recordId"]');
                details.contactName = contactElement?.textContent.trim() || null;
            }
            
            if (!details.accountName) {
                const accountElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.AccountId"] a[data-reftype="recordId"]');
                details.accountName = accountElement?.textContent.trim() || null;
            }
        }
        
        // Extract Account Code (try from case data first, then DOM)
        details.accountCode = caseData?.exLibrisAccountNumber || null;
        if (!details.accountCode) {
            const accountCodeElement = document.querySelector('div[data-target-selection-name*="Ex_Libris_Account_Number"] lightning-formatted-text[slot="outputField"]');
            details.accountCode = accountCodeElement?.textContent.trim() || null;
        }
        
        // Get customer/institution data from processed case data
        details.institutionCode = caseData?.institutionCode || null;
        details.institutionId = caseData?.instID || null;
        details.customerId = caseData?.custID || null;
        details.customerPrefix = caseData?.customerName || null;
        details.esploroEdition = caseData?.edition || null;
        details.server = caseData?.server || null;
        
        // FALLBACK: If we have accountCode or institutionCode but missing server/IDs, 
        // look up customer data directly via CustomerMasterManager
        let customerRecord = null;
        if (typeof CustomerMasterManager !== 'undefined') {
            // Try to find customer by institution code
            if (details.institutionCode) {
                customerRecord = CustomerMasterManager.findByInstitutionCode(details.institutionCode);
            }
            // If not found, try deriving from account code
            else if (details.accountCode) {
                let formattedCode = details.accountCode.trim();
                if (/FLVC/i.test(formattedCode)) {
                    formattedCode = formattedCode.replace(/FLVC/gi, 'FALSC');
                }
                if (/-/.test(formattedCode)) {
                    formattedCode = formattedCode.replace(/-/g, '_');
                }
                if (!formattedCode.includes('_')) {
                    formattedCode = `${formattedCode}_INST`;
                }
                customerRecord = CustomerMasterManager.findByInstitutionCode(formattedCode);
                if (customerRecord) {
                    details.institutionCode = customerRecord.institutionCode;
                }
            }
            // If still not found, try searching by account name
            else if (details.accountName) {
                customerRecord = CustomerMasterManager.findByAccountName(details.accountName);
                if (customerRecord) {
                    details.institutionCode = customerRecord.institutionCode;
                }
            }
            
            // Apply customer record data to fill in missing fields
            if (customerRecord) {
                console.log(`[CaseDetailExtractor] Found customer record: ${customerRecord.accountName || 'unknown'}`);
                
                if (!details.institutionId && customerRecord.institutionId) {
                    details.institutionId = customerRecord.institutionId;
                }
                if (!details.customerId && customerRecord.customerId) {
                    details.customerId = customerRecord.customerId;
                }
                if (!details.customerPrefix && customerRecord.accountName) {
                    details.customerPrefix = customerRecord.accountName;
                }
                if (!details.server && customerRecord.server) {
                    details.server = customerRecord.server.toLowerCase();
                    console.log(`[CaseDetailExtractor] Using server from customer record: ${details.server}`);
                }
            }
        }
        
        // Build Kibana/server log link using URLBuilder if available
        if (details.server && typeof URLBuilder !== 'undefined') {
            details.serverLogLink = URLBuilder.getKibanaURL(details);
            console.log('[CaseDetailExtractor] Kibana URL from URLBuilder:', details.serverLogLink);
        } else if (details.server) {
            // Fallback to old format if URLBuilder not available
            details.serverLogLink = `https://kibana-${details.server}.obs.exlibrisgroup.com/`;
            console.log('[CaseDetailExtractor] Kibana URL (fallback):', details.serverLogLink);
        } else {
            details.serverLogLink = null;
            console.log('[CaseDetailExtractor] No server available, Kibana URL is null');
        }
        
        // Build environment URLs using URLBuilder if we have the necessary data
        details.environmentUrls = {
            production: {
                researchManagement: null,
                researchPortal: null,
                customPortalUrl: null
            },
            sandbox: {
                researchManagement: null,
                researchPortal: null
            },
            sqa: {
                researchManagement: null,
                researchPortal: null
            }
        };
        
        // Build URLs - use details object which already has all the data merged
        // Check if we have the minimum required data (institutionCode and server)
        console.log('[CaseDetailExtractor] Checking URL building requirements:', {
            institutionCode: details.institutionCode,
            server: details.server,
            URLBuilderAvailable: typeof URLBuilder !== 'undefined'
        });
        
        if (details.institutionCode && details.server && typeof URLBuilder !== 'undefined') {
            try {
                console.log('[CaseDetailExtractor] Building URLs with URLBuilder...');
                
                // Production URLs - use correct method names
                const prodLV = URLBuilder.buildLiveViewURL(details);
                const prodBO = URLBuilder.buildBackOfficeURL(details);
                
                console.log('[CaseDetailExtractor] Production URLs:', { prodLV, prodBO });
                
                if (prodLV) {
                    details.environmentUrls.production.researchPortal = prodLV;
                }
                if (prodBO) {
                    details.environmentUrls.production.researchManagement = prodBO;
                }
                
                // Get custom portal domain from customer record or caseData
                const customDomain = customerRecord?.portalCustomDomain || caseData?.portalCustomDomain;
                if (customDomain) {
                    details.environmentUrls.production.customPortalUrl = customDomain;
                    console.log('[CaseDetailExtractor] Custom portal domain:', customDomain);
                }
                
                // Sandbox and SQA URLs
                const sandboxButtons = URLBuilder.buildSandboxURLs(details);
                console.log('[CaseDetailExtractor] Sandbox buttons:', sandboxButtons);
                
                sandboxButtons.forEach(btn => {
                    if (btn.tooltip?.includes('Sandbox') && btn.tooltip?.includes('Live View')) {
                        details.environmentUrls.sandbox.researchPortal = btn.url;
                    } else if (btn.tooltip?.includes('Sandbox') && btn.tooltip?.includes('Back Office')) {
                        details.environmentUrls.sandbox.researchManagement = btn.url;
                    } else if (btn.tooltip?.includes('SQA') && btn.tooltip?.includes('Live View')) {
                        details.environmentUrls.sqa.researchPortal = btn.url;
                    } else if (btn.tooltip?.includes('SQA') && btn.tooltip?.includes('Back Office')) {
                        details.environmentUrls.sqa.researchManagement = btn.url;
                    }
                });
                
                console.log('[CaseDetailExtractor] Final environment URLs:', details.environmentUrls);
            } catch (error) {
                console.error('[CaseDetailExtractor] Error building URLs:', error);
            }
        } else {
            console.warn('[CaseDetailExtractor] Cannot build URLs - missing data:', {
                hasInstitutionCode: !!details.institutionCode,
                hasServer: !!details.server,
                hasURLBuilder: typeof URLBuilder !== 'undefined'
            });
        }
        
        console.log('Extracted case details:', details);
        return details;
    }

    /**
     * Generates XML format from extracted details
     * @param {Object} details - Extracted case details
     * @returns {string} XML formatted string
     */
    function generateXML(details) {
        if (!details) return '<error>No data extracted</error>';
        
        const escape = escapeXML;
        const val = (key) => details[key] || 'null';
        const urlVal = (path) => {
            const keys = path.split('.');
            let value = details;
            for (const key of keys) {
                value = value?.[key];
                if (!value) return 'null';
            }
            return value;
        };
        
        let xml = '<case>\n';
        xml += `  <caseId>${escape(val('caseId'))}</caseId>\n`;
        xml += `  <caseNumber>${escape(val('caseNumber'))}</caseNumber>\n`;
        xml += `  <subject>${escape(val('subject'))}</subject>\n`;
        xml += `  <description>${escape(val('description'))}</description>\n`;
        xml += `  <priority>${escape(val('priority'))}</priority>\n`;
        xml += `  <status>${escape(val('status'))}</status>\n`;
        xml += `  <contactName>${escape(val('contactName'))}</contactName>\n`;
        xml += `  <accountName>${escape(val('accountName'))}</accountName>\n`;
        xml += `  <accountCode>${escape(val('accountCode'))}</accountCode>\n`;
        xml += `  <institutionCode>${escape(val('institutionCode'))}</institutionCode>\n`;
        xml += `  <institutionId>${escape(val('institutionId'))}</institutionId>\n`;
        xml += `  <customerId>${escape(val('customerId'))}</customerId>\n`;
        xml += `  <customerPrefix>${escape(val('customerPrefix'))}</customerPrefix>\n`;
        xml += `  <esploroEdition>${escape(val('esploroEdition'))}</esploroEdition>\n`;
        xml += `  <server>${escape(val('server'))}</server>\n`;
        xml += `  <serverLogLink>${escape(val('serverLogLink'))}</serverLogLink>\n`;
        xml += `  <environments>\n`;
        xml += `    <production>\n`;
        xml += `      <researchManagement>\n`;
        xml += `        <url>${escape(urlVal('environmentUrls.production.researchManagement'))}</url>\n`;
        xml += `      </researchManagement>\n`;
        xml += `      <researchPortal>\n`;
        xml += `        <url>${escape(urlVal('environmentUrls.production.researchPortal'))}</url>\n`;
        xml += `        <customUrl>${escape(urlVal('environmentUrls.production.customPortalUrl'))}</customUrl>\n`;
        xml += `      </researchPortal>\n`;
        xml += `    </production>\n`;
        xml += `    <sandbox>\n`;
        xml += `      <researchManagement>\n`;
        xml += `        <url>${escape(urlVal('environmentUrls.sandbox.researchManagement'))}</url>\n`;
        xml += `      </researchManagement>\n`;
        xml += `      <researchPortal>\n`;
        xml += `        <url>${escape(urlVal('environmentUrls.sandbox.researchPortal'))}</url>\n`;
        xml += `      </researchPortal>\n`;
        xml += `    </sandbox>\n`;
        xml += `    <sqa>\n`;
        xml += `      <researchManagement>\n`;
        xml += `        <url>${escape(urlVal('environmentUrls.sqa.researchManagement'))}</url>\n`;
        xml += `      </researchManagement>\n`;
        xml += `      <researchPortal>\n`;
        xml += `        <url>${escape(urlVal('environmentUrls.sqa.researchPortal'))}</url>\n`;
        xml += `      </researchPortal>\n`;
        xml += `    </sqa>\n`;
        xml += `  </environments>\n`;
        xml += '</case>';
        
        return xml;
    }

    /**
     * Generates TSV format from extracted details
     * @param {Object} details - Extracted case details
     * @returns {string} TSV formatted string
     */
    function generateTSV(details) {
        if (!details) return 'No data available';
        
        const val = (key) => {
            const value = details[key];
            if (value === null || value === undefined) return 'null';
            return String(value);
        };
        const urlVal = (path) => {
            const keys = path.split('.');
            let value = details;
            for (const key of keys) {
                value = value?.[key];
                if (!value) return 'null';
            }
            return value;
        };
        
        let tsv = 'Field\tValue\n';
        tsv += `Case ID\t${val('caseId')}\n`;
        tsv += `Case Number\t${val('caseNumber')}\n`;
        tsv += `Subject\t${val('subject')}\n`;
        tsv += `Description\t${val('description').replace(/\t/g, ' ').replace(/\n/g, ' ')}\n`;
        tsv += `Priority\t${val('priority')}\n`;
        tsv += `Status\t${val('status')}\n`;
        tsv += `Contact Name\t${val('contactName')}\n`;
        tsv += `Account Name\t${val('accountName')}\n`;
        tsv += `Account Code\t${val('accountCode')}\n`;
        tsv += `Institution Code\t${val('institutionCode')}\n`;
        tsv += `Institution ID\t${val('institutionId')}\n`;
        tsv += `Customer ID\t${val('customerId')}\n`;
        tsv += `Customer Prefix\t${val('customerPrefix')}\n`;
        tsv += `Esploro Edition\t${val('esploroEdition')}\n`;
        tsv += `Server\t${val('server')}\n`;
        tsv += `Server Log Link\t${val('serverLogLink')}\n`;
        tsv += '\n';
        tsv += 'Environment URLs:\n';
        tsv += `Production - Research Management\t${urlVal('environmentUrls.production.researchManagement')}\n`;
        tsv += `Production - Research Portal\t${urlVal('environmentUrls.production.researchPortal')}\n`;
        tsv += `Production - Custom Portal URL\t${urlVal('environmentUrls.production.customPortalUrl')}\n`;
        tsv += `Sandbox - Research Management\t${urlVal('environmentUrls.sandbox.researchManagement')}\n`;
        tsv += `Sandbox - Research Portal\t${urlVal('environmentUrls.sandbox.researchPortal')}\n`;
        tsv += `SQA - Research Management\t${urlVal('environmentUrls.sqa.researchManagement')}\n`;
        tsv += `SQA - Research Portal\t${urlVal('environmentUrls.sqa.researchPortal')}\n`;
        
        return tsv;
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
     * Extracts and copies case details as XML
     * @returns {Promise<Object>} Result object with success status and message
     */
    async function copyAsXML() {
        const details = await extractCaseDetails();
        const xml = generateXML(details);
        const success = await copyToClipboard(xml);
        
        return {
            success,
            message: success ? 'Case details (XML) copied to clipboard' : 'Failed to copy XML',
            data: xml
        };
    }

    /**
     * Extracts and copies case details as TSV
     * @returns {Promise<Object>} Result object with success status and message
     */
    async function copyAsTSV() {
        const details = await extractCaseDetails();
        const tsv = generateTSV(details);
        const success = await copyToClipboard(tsv);
        
        return {
            success,
            message: success ? 'Case details (TSV) copied to clipboard' : 'Failed to copy TSV',
            data: tsv
        };
    }

    // Public API
    return {
        extractCaseDetails,
        generateXML,
        generateTSV,
        copyAsXML,
        copyAsTSV,
        copyToClipboard
    };
})();
