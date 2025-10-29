/**
 * Button Factory Module
 * 
 * Handles creation and management of Lightning Web Component buttons
 * and button groups for Salesforce case pages.
 */

/**
 * Creates a `lightning-button` element for a single action.
 * @param {object} buttonInfo An object containing the button's configuration.
 * @param {string} buttonInfo.label The text label to display on the button.
 * @param {string} buttonInfo.url The URL to open in a new tab when the button is clicked.
 * @returns {HTMLElement} The created `lightning-button` element.
 */
export function createButton(buttonInfo) {
    const button = document.createElement('lightning-button');
    button.variant = 'neutral';
    button.label = buttonInfo.label;
    button.onclick = () => window.open(buttonInfo.url, '_blank');
    return button;
}

/**
 * Creates a `lightning-button-menu` element, which acts as a dropdown menu for a group of related links.
 * @param {string} groupLabel The label for the main dropdown button.
 * @param {Array<object>} items An array of item objects, each with `label` and `url` properties.
 * @returns {HTMLElement} The created `lightning-button-menu` element.
 */
export function createButtonGroup(groupLabel, items) {
    const buttonMenu = document.createElement('lightning-button-menu');
    buttonMenu.alternativeText = groupLabel;
    buttonMenu.label = groupLabel;
    
    items.forEach(item => {
        const menuItem = document.createElement('lightning-menu-item');
        menuItem.label = item.label;
        menuItem.value = item.url;
        menuItem.addEventListener('select', () => window.open(item.url, '_blank'));
        buttonMenu.appendChild(menuItem);
    });
    
    return buttonMenu;
}

/**
 * Creates a button or button group based on the provided configuration.
 * @param {object} btnInfo Button configuration object.
 * @param {string} btnInfo.type Either 'button' or 'group'.
 * @param {string} btnInfo.label Button label or group label.
 * @param {string} [btnInfo.url] URL for single buttons.
 * @param {Array<object>} [btnInfo.items] Items array for button groups.
 * @returns {HTMLElement} The created button or button group element.
 */
export function createButtonElement(btnInfo) {
    if (btnInfo.type === 'button') {
        return createButton(btnInfo);
    } else if (btnInfo.type === 'group') {
        return createButtonGroup(btnInfo.label, btnInfo.items);
    }
    throw new Error(`Unknown button type: ${btnInfo.type}`);
}

/**
 * Generates button data configuration for a case.
 * @param {object} caseData Case data containing server, institutionCode, etc.
 * @param {string} buttonStyle Style preference ('Formal', 'Casual', 'Abbreviated').
 * @returns {Promise<Array<object>>} Promise resolving to array of button configurations.
 */
export async function getButtonData(caseData, buttonStyle) {
    const { server, institutionCode, productServiceName, exLibrisAccountNumber } = caseData;

    const settings = await new Promise(resolve => 
        chrome.storage.sync.get('settings', data => resolve(data.settings || {}))
    );
    const useScraped = settings.useScrapedList;

        // Import default customer list
        const { DEFAULT_CUSTOMER_LIST } = await import('../data/customerData.js');    const customerList = await new Promise(resolve => {
        if (useScraped) {
            chrome.storage.local.get('scrapedCustomerList', (data) => {
                resolve(data.scrapedCustomerList || DEFAULT_CUSTOMER_LIST);
            });
        } else {
            resolve(DEFAULT_CUSTOMER_LIST);
        }
    });

    const customer = customerList.find(c => c.institutionCode === institutionCode && c.server === server);

    const labels = {
        Formal: { lv: 'Portal', bo: 'Repository', erp: 'Researchers Profile' },
        Casual: { lv: 'Live View', bo: 'Back Office', erp: 'Profiles' },
        Abbreviated: { lv: 'LV', bo: 'BO', erp: 'ERP' }
    };
    const currentLabels = labels[buttonStyle] || labels.Abbreviated;

    let buttons = [];

    // Core buttons
    buttons.push({ 
        type: 'button', 
        label: currentLabels.lv, 
        url: `https://${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}` 
    });
    
    buttons.push({ 
        type: 'button', 
        label: currentLabels.bo, 
        url: `https://${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true` 
    });

    // Sandbox buttons based on product service
    if (productServiceName === 'esploro advanced') {
        buttons.push({ 
            type: 'group', 
            label: 'Sandbox (PSB)', 
            items: [
                { label: 'PSB LV', url: `https://psb-${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}` },
                { label: 'PSB BO', url: `https://psb-${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true` }
            ]
        });
    } else if (productServiceName === 'esploro standard') {
        buttons.push({ 
            type: 'group', 
            label: 'Sandbox (SB)', 
            items: [
                { label: 'SB LV', url: `https://sb-${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}` },
                { label: 'SB BO', url: `https://sb-${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true` }
            ]
        });
    }

    // SQA buttons
    buttons.push({ 
        type: 'group', 
        label: 'SQA', 
        items: [
            { label: 'SQA LV', url: `https://sqa-${server}.alma.exlibrisgroup.com/esploro/?institution=${institutionCode}` },
            { label: 'SQA BO', url: `https://sqa-${server}.alma.exlibrisgroup.com/mng/login?institute=${institutionCode}&productCode=esploro&debug=true` }
        ]
    });

    // Tools group
    buttons.push({ 
        type: 'group', 
        label: 'Tools', 
        items: [
            { label: 'Kibana', url: getKibanaUrl(server) },
            { label: 'Wiki', url: 'https://wiki.clarivate.io/pages/viewpage.action?spaceKey=ESP&title=Kibana+-+Log+Searching+Tool' }
        ]
    });

    // SQL group
    buttons.push({ 
        type: 'group', 
        label: 'SQL', 
        items: [
            { label: 'SQL Wiki', url: 'https://wiki.clarivate.io/spaces/ESP/pages/505330963/SQL+Course' },
            { label: 'SQL Alma', url: 'https://wiki.clarivate.io/display/ESP/SQL+Knowledgebase' },
            { label: 'SQL Esploro', url: 'https://wiki.clarivate.io/spaces/ESP/pages/505334550/Esploro+SQL+Queries' }
        ]
    });

    // Additional buttons
    buttons.push({ 
        type: 'button', 
        label: 'System Status', 
        url: 'https://status.exlibrisgroup.com/system_status' 
    });

    buttons.push({ 
        type: 'button', 
        label: 'Customer JIRA', 
        url: `https://jira.clarivate.io/issues/?jql=project%20%3D%20URM%20AND%20%22Customer%20Code%22%20~%20${exLibrisAccountNumber}%20AND%20%22Platform%20Product%22%20%3D%20Esploro%20order%20by%20lastViewed%20DESC` 
    });

    return buttons;
}

/**
 * Gets the appropriate Kibana URL for a given server.
 * @param {string} server Server identifier.
 * @returns {string} Kibana URL.
 */
function getKibanaUrl(server) {
    // This would contain the actual Kibana URL logic
    return `https://kibana.exlibrisgroup.com/${server}`;
}