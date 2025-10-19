/**
 * @file This script manages the functionality of the extension's popup window (`popup.html`).
 * @description It handles loading and saving user settings to `chrome.storage.sync`, populating
 * UI elements like dropdown menus, and initializing event listeners for user interaction.
 * It also conditionally shows or hides the settings view based on whether the user is currently
 * on a valid Salesforce page, providing a context-aware user experience.
 * @author Jules
 */

/**
 * Populates the timezone dropdown menu with a predefined list of common timezones.
 * @description This ensures the user has a consistent and relevant list of options to choose from
 * for displaying time-sensitive information. The list is hardcoded for simplicity and relevance
 * to the expected user base.
 * @returns {void}
 */
function populateTimezones() {
    const timezones = [
        'UTC', 'GMT', 'US/Pacific', 'US/Mountain', 'US/Central', 'US/Eastern',
        'Europe/London', 'Europe/Berlin', 'Europe/Moscow',
        'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney'
    ];
    const select = document.getElementById('timezone');
    timezones.forEach(tz => {
        const option = document.createElement('option');
        option.value = tz;
        option.textContent = tz;
        select.appendChild(option);
    });
}

/**
 * Gathers all current settings from the popup's form elements and saves them to `chrome.storage.sync`.
 * @description This function is the single point of contact for persisting user preferences. It reads
 * the values from all inputs, checkboxes, and select elements, bundles them into a single `settings`
 * object, and uses the `chrome.storage.sync` API to save them. This allows settings to be persisted
 * across browser sessions and synced across devices where the user is logged in. A confirmation
 * alert is shown to the user upon successful save.
 * @returns {void}
 */
function saveSettings() {
    const teamSelection = document.getElementById('team-selection').value;
    const injectionLocations = {
        card: document.getElementById('inject-card').checked,
        header: document.getElementById('inject-header').checked
    };
    const buttonStyle = document.getElementById('button-style').value;
    const timezone = document.getElementById('timezone').value;
    const useScrapedList = document.getElementById('use-scraped-list').checked;

    chrome.storage.sync.set({
        settings: {
            teamSelection,
            injectionLocations,
            buttonStyle,
            timezone,
            useScrapedList
        }
    }, () => {
        // Notify the user that settings are saved and a page refresh may be needed.
        alert('Settings saved! Please refresh your Salesforce page for changes to take effect.');
    });
}

/**
 * Retrieves user settings from `chrome.storage.sync` and populates the popup's form fields.
 * @description This ensures that when a user opens the popup, they see their most recently saved
 * configuration. It gracefully handles cases where no settings have been saved yet, in which
 * case the form elements will retain their default values from the HTML.
 * @returns {void}
 */
function loadSettings() {
    chrome.storage.sync.get('settings', (data) => {
        if (data.settings) {
            const { teamSelection, injectionLocations, buttonStyle, timezone, useScrapedList } = data.settings;
            if (teamSelection) {
                document.getElementById('team-selection').value = teamSelection;
            }
            if (injectionLocations) {
                document.getElementById('inject-card').checked = injectionLocations.card;
                document.getElementById('inject-header').checked = injectionLocations.header;
            }
            if (buttonStyle) {
                document.getElementById('button-style').value = buttonStyle;
            }
            if (timezone) {
                document.getElementById('timezone').value = timezone;
            }
            if (useScrapedList) {
                document.getElementById('use-scraped-list').checked = useScrapedList;
            }
        }
    });
}

/**
 * Initializes the popup's functionality when the DOM is fully loaded.
 * @description This is the main entry point for the popup script. It asynchronously queries the
 * Chrome Tabs API to get the URL of the active tab. Based on the URL, it either displays the
 * main settings view (for Salesforce pages) or a notice view (for all other pages). For the
 * settings view, it triggers the population of UI elements and attaches all necessary event listeners.
 * @returns {Promise<void>} A promise that resolves when the popup initialization is complete.
 */
async function initializePopup() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    // Check if the current tab is a valid Salesforce page before showing the settings.
    if (activeTab.url && (activeTab.url.includes('.force.com') || activeTab.url.includes('.salesforce.com'))) {
        document.getElementById('settings-view').style.display = 'block';
        document.getElementById('notice-view').style.display = 'none';

        // Populate dynamic UI elements, load saved settings, and attach event listeners.
        populateTimezones();
        loadSettings();
        document.getElementById('saveButton').addEventListener('click', saveSettings);
        document.getElementById('update-customer-list').addEventListener('click', () => {
            // Open the customer list wiki page in a new tab to allow the user to trigger a scrape.
            chrome.tabs.create({ url: 'https://wiki.clarivate.io/spaces/EXLPS/pages/506201574/Esploro+Customers' });
        });
    } else {
        // If not on a Salesforce page, show a helpful message to the user.
        document.getElementById('settings-view').style.display = 'none';
        document.getElementById('notice-view').style.display = 'block';
    }
}

/**
 * Attaches the main `initializePopup` function to the 'DOMContentLoaded' event.
 * @description This is standard practice to ensure that the script does not attempt to
 * manipulate the DOM before it has been fully constructed, preventing race conditions and errors.
 */
document.addEventListener('DOMContentLoaded', initializePopup);
