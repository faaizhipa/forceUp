/**
 * Customer Data Module
 * 
 * Manages Ex Libris/Esploro customer information including default data
 * and integration with scraped data from Confluence wiki.
 */

/**
 * Default customer data extracted from original extension.
 */
export const DEFAULT_CUSTOMER_LIST = [
    {
        id: '0',
        institutionCode: 'TR_INTEGRATION_INST',
        server: 'na05',
        custID: '550',
        instID: '561',
        portalCustomDomain: 'https://tr-integration-researchportal.esploro.exlibrisgroup.com/esploro/',
        prefix: '',
        name: 'Test Environment',
        status: 'Active',
        esploroEdition: 'Advanced',
        sandboxEdition: '',
        hasScopus: '',
        comments: 'Support Test environment',
        otbDomain: '',
        directLinkToSqaEnvironment: 'Link to environment:\nhttps://na05.alma.exlibrisgroup.com/mng/login?institute=TR_INTEGRATION_INST&productCode=esploro&debug=true&auth=local\nUser: esploro_impl\npassword: a12345678A',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
    },
    {
        id: '1',
        institutionCode: '61SCU_INST',
        server: 'ap02',
        custID: '2350',
        instID: '2368',
        portalCustomDomain: 'http://researchportal.scu.edu.au',
        prefix: 'scu',
        name: 'Southern Cross University',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: 'https://sqa-ap02.alma.exlibrisgroup.com/mng/login?institute=61SCU_INST&productCode=esploro&debug=true',
        sqaPortalLink: 'https://sqa-ap02.alma.exlibrisgroup.com/esploro/?institution=61SCU_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
    },
    {
        id: '2',
        institutionCode: '61USC_INST',
        server: 'ap02',
        custID: '2620',
        instID: '2621',
        portalCustomDomain: 'http://research.usc.edu.au',
        prefix: 'usc',
        name: 'University of the Sunshine Coast',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: 'https://sqa-ap02.alma.exlibrisgroup.com/mng/login?institute=61USC_INST&productCode=esploro&debug=true',
        sqaPortalLink: 'https://sqa-ap02.alma.exlibrisgroup.com/esploro/?institution=61USC_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
    },
    {
        id: '3',
        institutionCode: '44SUR_INST',
        server: 'eu00',
        custID: '2345',
        instID: '2346',
        portalCustomDomain: 'http://openresearch.surrey.ac.uk',
        prefix: 'surrey',
        name: 'University of Surrey',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: 'https://sqa02-eu00.alma.exlibrisgroup.com/mng/login?institute=44SUR_INST&productCode=esploro&debug=true',
        sqaPortalLink: 'https://sqa-eu00.alma.exlibrisgroup.com/esploro/?institution=44SUR_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
    },
    {
        id: '4',
        institutionCode: '39UBZ_INST',
        server: 'eu00',
        custID: '1230',
        instID: '1241',
        portalCustomDomain: 'http://bia.unibz.it',
        prefix: 'unibz',
        name: 'Libera Università di Bolzano',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: 'https://sqa02-eu00.alma.exlibrisgroup.com/mng/login?institute=39UBZ_INST&productCode=esploro&debug=true',
        sqaPortalLink: 'https://sqa-eu00.alma.exlibrisgroup.com/esploro/?institution=39UBZ_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
    }
];

/**
 * Gets customer data with fallback to scraped data if available.
 * @param {boolean} useScraped Whether to prefer scraped data over default.
 * @returns {Promise<Array>} Promise resolving to customer data array.
 */
export async function getCustomerData(useScraped = false) {
    if (!useScraped) {
        return DEFAULT_CUSTOMER_LIST;
    }

    try {
        // Try to get scraped data from storage
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['scrapedCustomerList'], (data) => {
                resolve(data.scrapedCustomerList);
            });
        });

        return result && result.length > 0 ? result : DEFAULT_CUSTOMER_LIST;
    } catch (error) {
        console.error('[Customer Data] Error getting scraped data:', error);
        return DEFAULT_CUSTOMER_LIST;
    }
}

/**
 * Finds a customer by institution code and server.
 * @param {string} institutionCode Institution code to search for.
 * @param {string} server Server to search for.
 * @param {boolean} useScraped Whether to use scraped data.
 * @returns {Promise<object|null>} Promise resolving to customer object or null.
 */
export async function findCustomer(institutionCode, server, useScraped = false) {
    const customerList = await getCustomerData(useScraped);
    return customerList.find(c => 
        c.institutionCode === institutionCode && 
        c.server === server
    ) || null;
}

/**
 * Finds customers by partial name or institution code search.
 * @param {string} searchTerm Search term to match against.
 * @param {boolean} useScraped Whether to use scraped data.
 * @returns {Promise<Array>} Promise resolving to matching customers.
 */
export async function searchCustomers(searchTerm, useScraped = false) {
    const customerList = await getCustomerData(useScraped);
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return customerList.filter(customer => 
        customer.institutionCode?.toLowerCase().includes(lowerSearchTerm) ||
        customer.name?.toLowerCase().includes(lowerSearchTerm) ||
        customer.custID?.toLowerCase().includes(lowerSearchTerm) ||
        customer.prefix?.toLowerCase().includes(lowerSearchTerm)
    );
}

/**
 * Gets all unique servers from customer data.
 * @param {boolean} useScraped Whether to use scraped data.
 * @returns {Promise<Array<string>>} Promise resolving to unique server list.
 */
export async function getUniqueServers(useScraped = false) {
    const customerList = await getCustomerData(useScraped);
    const servers = new Set();
    
    customerList.forEach(customer => {
        if (customer.server) {
            servers.add(customer.server);
        }
    });
    
    return Array.from(servers).sort();
}

/**
 * Gets customers by server.
 * @param {string} server Server to filter by.
 * @param {boolean} useScraped Whether to use scraped data.
 * @returns {Promise<Array>} Promise resolving to customers on the server.
 */
export async function getCustomersByServer(server, useScraped = false) {
    const customerList = await getCustomerData(useScraped);
    return customerList.filter(customer => customer.server === server);
}

/**
 * Gets statistics about the customer data.
 * @param {boolean} useScraped Whether to use scraped data.
 * @returns {Promise<object>} Promise resolving to statistics object.
 */
export async function getCustomerStatistics(useScraped = false) {
    const customerList = await getCustomerData(useScraped);
    
    const stats = {
        totalCustomers: customerList.length,
        byServer: {},
        byEdition: {},
        withScopus: 0,
        completed: 0
    };
    
    customerList.forEach(customer => {
        // Server stats
        if (customer.server) {
            stats.byServer[customer.server] = (stats.byServer[customer.server] || 0) + 1;
        }
        
        // Edition stats
        if (customer.esploroEdition) {
            stats.byEdition[customer.esploroEdition] = (stats.byEdition[customer.esploroEdition] || 0) + 1;
        }
        
        // Scopus stats
        if (customer.hasScopus?.toLowerCase() === 'yes') {
            stats.withScopus++;
        }
        
        // Status stats
        if (customer.status?.toLowerCase() === 'completed') {
            stats.completed++;
        }
    });
    
    return stats;
}

/**
 * Validates customer data structure.
 * @param {object} customer Customer object to validate.
 * @returns {object} Validation result with isValid and errors.
 */
export function validateCustomer(customer) {
    const errors = [];
    const requiredFields = ['institutionCode', 'server', 'custID'];
    
    requiredFields.forEach(field => {
        if (!customer[field]) {
            errors.push(`Missing required field: ${field}`);
        }
    });
    
    // Validate server format
    if (customer.server && !/^[a-z]{2}\d{2}$/.test(customer.server)) {
        errors.push('Server should match pattern: 2 letters + 2 digits (e.g., na05, ap02)');
    }
    
    // Validate institution code
    if (customer.institutionCode && !customer.institutionCode.includes('_INST')) {
        errors.push('Institution code should end with _INST');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Updates the customer data cache with new scraped data.
 * @param {Array} newCustomerData New customer data to store.
 * @returns {Promise<void>} Promise resolving when data is stored.
 */
export async function updateCustomerCache(newCustomerData) {
    try {
        // Validate all customers before storing
        const invalidCustomers = [];
        newCustomerData.forEach((customer, index) => {
            const validation = validateCustomer(customer);
            if (!validation.isValid) {
                invalidCustomers.push({ index, errors: validation.errors });
            }
        });
        
        if (invalidCustomers.length > 0) {
            console.warn('[Customer Data] Some customers have validation errors:', invalidCustomers);
        }
        
        await new Promise((resolve, reject) => {
            chrome.storage.local.set({ scrapedCustomerList: newCustomerData }, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
        
        console.log(`[Customer Data] Updated cache with ${newCustomerData.length} customers`);
    } catch (error) {
        console.error('[Customer Data] Error updating cache:', error);
        throw error;
    }
}