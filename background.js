/**
 * @file This script runs in the background of the Chrome extension, acting as the central controller.
 * @description It is responsible for monitoring browser navigation to identify and classify Salesforce pages,
 * sending this information to the content script, and managing settings persistence via `chrome.storage`.
 * This script is crucial for initializing the extension's features at the right time and on the right pages.
 * @author Jules
 * @see {@link https://developer.chrome.com/docs/extensions/mv3/background_pages/}
 */

// --- Page Identification Logic ---

/**
 * Identifies the type of Salesforce or related page based on its URL.
 * @description This function contains the core URL matching rules. It is the single source of truth
 * for determining what kind of page the user is currently viewing, which in turn decides which
 * features the content script should activate.
 * @param {string} url The full URL of the web page to be identified.
 * @returns {string|null} A string representing the identified page type (e.g., 'Case_Page', 'Cases_List_Page')
 * or `null` if the URL does not match any known patterns.
 */
function getPageType(url) {
    if (url.includes('/lightning/r/Case/') && url.endsWith('/view')) {
        return 'Case_Page';
    }
    if (url.includes('/lightning/r/Case/') && url.includes('/related/CaseComments/view')) {
        return 'Case_Comments_Page';
    }
    if (url.includes('/lightning/o/Case/list')) {
        return 'Cases_List_Page';
    }
    if (url.includes('/lightning/o/Report/home')) {
        return 'Reports_Home_Page';
    }
    if (url.includes('/lightning/r/Report/') && url.endsWith('/view')) {
        return 'Report_Page';
    }
    if (url.includes('/one/one.app#') && url.includes('forceSearch:searchPageDesktop')) {
        return 'Search_Page';
    }
    if (url.includes('wiki.clarivate.io/spaces/EXLPS/pages/506201574/Esploro+Customers')) {
        return 'Esploro_Customers_Wiki';
    }
    return null;
}

// --- Event Listeners ---

/**
 * Listens for updates to any tab, such as a URL change from a full page reload.
 * @description When a tab completes loading with a new URL, this listener triggers the page identification
 * logic. If a known page type is detected, it sends a message to the content script in that tab,
 * initiating the feature injection process.
 * @param {number} tabId The unique identifier of the tab that was updated.
 * @param {object} changeInfo An object containing details about what changed in the tab. We are interested in `changeInfo.url`.
 * @param {object} tab An object containing the full, updated state of the tab.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // We only proceed if the URL has changed and the tab is completely loaded to avoid running on intermediate states.
    if (changeInfo.url && tab.status === 'complete') {
        const pageType = getPageType(tab.url);
        if (pageType) {
            // A known page type was identified, so we send a message to the content script.
            chrome.tabs.sendMessage(tabId, {
                message: 'pageTypeIdentified',
                pageType: pageType
            });
        }
    }
});


/**
 * Listens for history state updates, which are common in Single Page Applications (SPAs) like Salesforce Lightning.
 * @description This is a critical listener for detecting client-side navigation that does not trigger a full page
 * reload (e.g., navigating between different cases). It ensures the extension can react to these
 * "soft" navigations in the same way it handles full page loads.
 * @param {object} details An object containing details about the navigation event.
 * @param {number} details.tabId The ID of the tab where the navigation occurred.
 * @param {string} details.url The new URL after the history state update.
 */
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    // We filter for Salesforce and specific wiki URLs to ensure we only act on relevant pages.
    if (details.url && (details.url.includes('.lightning.force.com') || details.url.includes('.salesforce.com') || details.url.includes('wiki.clarivate.io'))) {
        const pageType = getPageType(details.url);
        if (pageType) {
            // A known page type was identified, so we send a message to the content script.
            chrome.tabs.sendMessage(details.tabId, {
                message: 'pageTypeIdentified',
                pageType: pageType
            });
        }
    }
});


// --- Message Handling for Settings ---

/**
 * Listens for incoming messages from other parts of the extension (popup and content scripts).
 * @description This acts as a central message hub. It is primarily used for handling the saving and
 * retrieving of user settings from `chrome.storage`, ensuring a clear separation of concerns
 * where the background script manages all storage interactions.
 * @param {object} request The message object sent by the other script. It must contain a `message` property identifying the action.
 * @param {object} sender An object with information about the script that sent the message.
 * @param {function} sendResponse A callback function to send a response back to the message sender.
 * This is used for asynchronous operations like fetching data from storage.
 * @returns {boolean} Returns `true` to indicate that the `sendResponse` function will be called asynchronously.
 * This is required when the response is not sent in the same execution cycle.
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.message === 'saveSelection') {
      // Handles the 'saveSelection' message to persist data to synchronized storage.
      chrome.storage.sync.set({ 'savedSelection': request.data }, function() {
        console.log('Selection saved: ' + request.data);
      });
    } else if (request.message === 'getSavedSelection') {
      // Handles the 'getSavedSelection' message to retrieve persisted data from storage.
      chrome.storage.sync.get('savedSelection', function(items) {
        if (chrome.runtime.lastError) {
          // If there was an error during storage access, send a failure response.
          sendResponse({ status: false, error: chrome.runtime.lastError });
        } else {
          // Otherwise, send a success response with the retrieved data.
          sendResponse({ status: true, data: items.savedSelection });
        }
      });
      // Return true because we are sending the response asynchronously after the storage call completes.
      return true;
    }
});