/**
 * Wiki Scraper Module
 * 
 * Handles scraping customer data from Confluence wiki tables
 * and converting them to structured data for storage.
 */

/**
 * Scrapes customer data from a Confluence wiki table and saves it to storage.
 * @description Locates a specific table structure containing Institution Code, CustID, and Name columns,
 * converts it to a structured data array, and saves it to chrome.storage.local.
 * @returns {Promise<boolean>} Promise resolving to true if successful, false otherwise.
 */
export async function scrapeCustomerData() {
    try {
        const tableElement = document.evaluate(
            '//table[contains(@class,"confluenceTable")][.//th[contains(., "Institution Code") and contains(., "CustID") and contains(., "Name")]]', 
            document, 
            null, 
            XPathResult.FIRST_ORDERED_NODE_TYPE, 
            null
        ).singleNodeValue;
        
        if (tableElement) {
            const tableData = convertTableToObject(tableElement);
            
            return new Promise((resolve) => {
                chrome.storage.local.set({ 'scrapedCustomerList': tableData }, () => {
                    console.log('[Wiki Scraper] Customer list updated successfully!');
                    resolve(true);
                });
            });
        } else {
            console.warn('[Wiki Scraper] Could not find customer data table to update.');
            return false;
        }
    } catch (error) {
        console.error('[Wiki Scraper] Error scraping customer data:', error);
        return false;
    }
}

/**
 * Converts an HTML table element from the wiki into a structured array of JavaScript objects.
 * @description Maps table headers to specific object keys for consistency and iterates
 * through each row, creating an object that represents that customer.
 * @param {HTMLTableElement} table The HTML table element to convert.
 * @returns {Array<object>} An array of objects, where each object represents a row in the table.
 */
export function convertTableToObject(table) {
    const headerMap = {
        '#': 'id',
        'Institution Code': 'institutionCode', 
        'Server': 'server', 
        'CustID': 'custID', 
        'InstID': 'instID',
        'Portal Custom Domain': 'portalCustomDomain', 
        'prefix': 'prefix', 
        'Name\u00a0': 'name', 
        'Status': 'status',
        'Esploro Edition': 'esploroEdition', 
        'Sandbox Edition': 'sandboxEdition', 
        'Has Scopus?': 'hasScopus',
        'ETD_admin integration': 'etdAdminIntegration', 
        'Comments': 'comments', 
        'OTB domain': 'otbDomain',
        'Direct link to SQA environment (requires VPN)': 'directLinkToSqaEnvironment',
        'SQA portal link': 'sqaPortalLink', 
        'One Trust': 'oneTrust', 
        'Discovery (Alma)': 'discoveryAlma'
    };

    const rows = table.querySelectorAll('tbody tr');
    if (rows.length < 2) return [];

    const headers = Array.from(rows[0].querySelectorAll('td')).map(cell => 
        headerMap[cell.textContent.trim()] || cell.textContent.trim()
    );

    const dataRows = Array.from(rows).slice(1);

    return dataRows.map(row => {
        const rowObject = {};
        const cells = row.querySelectorAll('td');
        
        headers.forEach((header, index) => {
            const cell = cells[index];
            if (cell) {
                let cellText = cell.innerText.trim();
                const link = cell.querySelector('a');
                
                // Extract URLs for specific link fields
                if (link && (header === 'portalCustomDomain' || header === 'sqaPortalLink' || header === 'directLinkToSqaEnvironment')) {
                    cellText = link.href;
                }
                
                rowObject[header] = cellText;
            } else {
                rowObject[header] = '';
            }
        });
        
        return rowObject;
    });
}

/**
 * Retrieves cached customer data from storage.
 * @returns {Promise<Array<object>>} Promise resolving to array of customer objects.
 */
export async function getCachedCustomerData() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['scrapedCustomerList'], (result) => {
            resolve(result.scrapedCustomerList || []);
        });
    });
}

/**
 * Searches customer data for a specific institution or customer ID.
 * @param {string} searchTerm Search term to match against institution code, name, or customer ID.
 * @returns {Promise<Array<object>>} Promise resolving to array of matching customers.
 */
export async function searchCustomerData(searchTerm) {
    const customerData = await getCachedCustomerData();
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return customerData.filter(customer => 
        customer.institutionCode?.toLowerCase().includes(lowerSearchTerm) ||
        customer.name?.toLowerCase().includes(lowerSearchTerm) ||
        customer.custID?.toLowerCase().includes(lowerSearchTerm)
    );
}