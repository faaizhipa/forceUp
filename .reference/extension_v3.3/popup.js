// Get active tab URL
async function getActiveTabURL() {
  try {
    const tabs = await chrome.tabs.query({
      currentWindow: true,
      active: true
    });
    return tabs[0];
  } catch (err) {
    console.error('Error getting active tab:', err);
    return null;
  }
}

// Function to announce status changes for screen readers
function announceStatus(message) {
  const statusAnnouncer = document.getElementById('status-announcer');
  if (statusAnnouncer) {
    statusAnnouncer.textContent = message;
  }
}

// Function to send message to content script with retry
async function sendMessageToContentScript(tabId, message, retries = 3, delay = 100) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1}: Sending message to tab ${tabId}`, message);
      const response = await chrome.tabs.sendMessage(tabId, message);
      console.log(`Attempt ${i + 1}: Received response`, response);
      // Check if the response indicates success from the content script
      if (response && response.status === 'Theme applied') {
         return response; // Success
      } else if (response) {
         // Received a response, but not the expected success status
         console.warn(`Content script responded with status: ${response.status}`, response);
         // Depending on the desired behavior, you might treat this as success or failure.
         // For now, let's return the response for the caller to handle.
         return response;
      }
      // If response is null or undefined, it might indicate an issue, loop will retry.
      console.warn(`Attempt ${i + 1}: Received null or undefined response. Retrying...`);

    } catch (err) {
      // Specifically check for the "Receiving end does not exist" error
      if (err.message.includes("Receiving end does not exist") && i < retries - 1) {
        console.warn(`Attempt ${i + 1}: Connection error. Retrying in ${delay}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // Go to the next retry iteration
      } else {
        // Other error or last retry failed
        console.error(`Failed to send message after ${i + 1} attempts:`, err);
        // It's crucial to return null or throw the error so the caller knows it failed.
        return { status: 'error', error: err.message }; // Return an error object
      }
    }
     // Add a small delay before the next retry even if no error was thrown but response wasn't success
     if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
     }
  }
   // If all retries failed without throwing a different error
   console.error(`Failed to get successful confirmation after ${retries} attempts.`);
   return { status: 'error', error: 'No successful confirmation received from content script.' };
}

// Setup theme selection with visual options
const themeOptions = document.querySelectorAll('.theme-option');
const applyToSfdcButton = document.getElementById('applyThemeSfdc');
const applyToExtButton = document.getElementById('applyThemeExt');
let selectedOption = null;
let selectedTheme = {}; // Initialize as an empty object
let themeToApply = null;


// Simplified theme loading (alternative to messaging background.js)
async function loadAndApplyInitialTheme() {
  try {
    const data = await chrome.storage.sync.get({ themeObject: { theme: 'original', applyTo: 'sfdc' } });
    // Ensure selectedTheme is always a valid object, even if storage is corrupt
    selectedTheme = (typeof data.themeObject === 'object' && data.themeObject !== null)
                     ? data.themeObject
                     : { theme: 'original', applyTo: 'sfdc' }; // Fallback

    console.log('Theme loaded directly in popup:', selectedTheme);

    // --- UI Update ---
    document.querySelectorAll('.theme-option').forEach(option => {
        option.setAttribute('aria-checked', 'false');
        option.classList.remove('active');
    });
    const activeOption = document.querySelector(`.theme-option[data-theme="${selectedTheme.theme}"]`);
    if (activeOption && !activeOption.classList.contains('disabled')) {
      activeOption.setAttribute('aria-checked', 'true');
      activeOption.classList.add('active');
    } else {
        // If saved theme is disabled or not found, default to 'original' visually
        const originalOption = document.querySelector(`.theme-option[data-theme="original"]`);
        if(originalOption) {
            originalOption.setAttribute('aria-checked', 'true');
            originalOption.classList.add('active');
        }
        // Optionally reset selectedTheme if the saved one was invalid/disabled
        // selectedTheme = { theme: 'original', applyTo: 'sfdc' };
        // await chrome.storage.sync.set({ themeObject: selectedTheme }); // Resave default
    }

    // --- Apply Theme to Content Script on Load ---
    // Only apply if a theme is actually set (avoid null)
     if (selectedTheme.theme) {
         console.log('Applying initial SFDC theme:', selectedTheme.theme);
         const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
         if (tabs[0]?.id) {
             // Use the robust sendMessage function
             const response = await sendMessageToContentScript(tabs[0].id, {
                 action: 'applyTheme',
                 themeName: selectedTheme.theme
             });
             if (response?.status === 'Theme applied') {
                 console.log('Initial theme applied by content script.');
             } else {
                 console.warn('Content script did not confirm initial theme application or responded with error.', response?.error || 'Unknown issue');
             }
         } else {
             console.error('No active tab found for initial theme application.');
         }
     } else {
         console.warn('Initial theme name is null or empty, skipping application.');
     }

  } catch (error) {
    console.error('Error loading theme directly:', error);
    // Apply default theme visually on error
    selectedTheme = { theme: 'original', applyTo: 'sfdc' }; // Ensure state is default
    const defaultOption = document.querySelector('.theme-option[data-theme="original"]');
    if (defaultOption) {
        document.querySelectorAll('.theme-option').forEach(option => {
          option.setAttribute('aria-checked', 'false');
          option.classList.remove('active');
        });
        defaultOption.setAttribute('aria-checked', 'true');
        defaultOption.classList.add('active');
    }
  }
}

// Add event listeners for theme options
themeOptions.forEach(option => option.addEventListener('click', async function (event) { // Make handler async
  const clickedOption = event.currentTarget; // Use currentTarget to ensure it's the div
  themeToApply = clickedOption.getAttribute("data-theme"); // Assign to themeToApply
  console.log('Theme to apply:', themeToApply);

  if (clickedOption.classList.contains('disabled')) {
    console.warn('Disabled theme option clicked:', themeToApply);
    return; // Ignore clicks on disabled options
  }

  // --- UI Update ---
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.setAttribute('aria-checked', 'false');
    opt.classList.remove('active');
  });
  clickedOption.setAttribute('aria-checked', 'true');
  clickedOption.classList.add('active');

  // --- Update State and Storage ---
  // Ensure selectedTheme is an object
  if (typeof selectedTheme !== 'object' || selectedTheme === null) {
     selectedTheme = {};
  }
  selectedTheme.theme = themeToApply; // Use the correctly assigned themeToApply
  selectedTheme.applyTo = 'sfdc'; // Assuming this is always the target for this button

  try {
      // Save the full theme object
      await chrome.storage.sync.set({ themeObject: selectedTheme });
      console.log('Theme object saved:', selectedTheme);

      // --- Send Message to Content Script ---
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        // Use the updated sendMessageToContentScript function
        const response = await sendMessageToContentScript(tabs[0].id, {
          action: 'applyTheme',
          themeName: themeToApply // Send the correct theme name
        }); // Retries are built-in

        // Check the final response after retries
        if (response?.status === 'Theme applied') {
          console.log('Content script confirmed theme application.');
          // Feedback logic for success
          applyToSfdcButton.textContent = 'Applied!';
           setTimeout(() => {
             applyToSfdcButton.textContent = 'Apply to SFDC';
           }, 1000);
          announceStatus(`Theme ${themeToApply} applied to Salesforce.`);
        } else {
          // Handle failure or unexpected response after retries
          console.error('Content script did not confirm theme application or responded with error after retries.', response?.error || 'Unknown issue');
          applyToSfdcButton.textContent = 'Apply Failed'; // Indicate failure
          setTimeout(() => {
             applyToSfdcButton.textContent = 'Apply to SFDC';
          }, 2000);
          announceStatus(`Failed to apply theme ${themeToApply}. Error: ${response?.error || 'No confirmation'}`);
        }
      } else {
        console.error('No active tab found to send theme update.');
         announceStatus('Error: Could not find the active Salesforce tab.');
      }
  } catch (storageError) {
       console.error('Error saving theme to storage:', storageError);
       announceStatus('Error saving theme settings.');
  }
}));


// --- Initialize on DOM Load ---
document.addEventListener("DOMContentLoaded", async () => {
  const activeTab = await getActiveTabURL();
  if (!activeTab) {
    console.error('No active tab found');
    announceStatus('Error: Could not detect active tab.'); // User feedback
    return;
  }

  // More specific Salesforce URL checks might be needed
  const isSalesforce = activeTab.url && (
    activeTab.url.includes(".lightning.force.com") ||
    activeTab.url.includes(".salesforce.com") || // Added broader match
    activeTab.url.includes(".visualforce.com") // Added visualforce
    );


  if (isSalesforce) {
    console.log('Salesforce tab detected:', activeTab.url);
    await loadAndApplyInitialTheme(); // Use the updated function
    // Theme selection setup is now part of the forEach loop above
    setupBookmarkNavigation();
    setupTeamSettings();
    setupFeatureToggles();

    const clearCacheButton = document.getElementById('clear-cache');
    if (clearCacheButton) {
      clearCacheButton.addEventListener('click', async () => {
        announceStatus('Refreshing Salesforce tab...'); // User feedback
        if (activeTab?.id) {
          try {
            await chrome.tabs.reload(activeTab.id);
            // Consider closing the popup *after* reload starts, maybe with a slight delay
            setTimeout(() => window.close(), 100);
          } catch (err) {
            console.error('Error reloading tab:', err);
            announceStatus('Error refreshing tab.'); // User feedback
          }
        }
      });
    }
  } else {
      console.log('Not a Salesforce tab:', activeTab.url);
      // Optionally disable UI elements or show a message if not on Salesforce
      document.body.innerHTML = '<div style="padding: 20px; text-align: center;">This extension works on Salesforce pages.</div>'; // Example message
      announceStatus('This extension is designed for Salesforce.'); // User feedback
  }
});


// Team/BU Settings handler
function setupTeamSettings() {
  const saveButton = document.getElementById('saveButton');
  const selectionDropdown = document.getElementById('selectionDropdown');
  const teamPanel = document.getElementById('teamPanel');
  const teamLogo = document.getElementById('teamLogo');

  // Team-specific logo images (could be expanded to include all teams)
  const teamImages = {
    'EndNote': 'linear-gradient(135deg, #0077CC 0%, #005fa3 100%)',
    'WebOfScience': 'linear-gradient(135deg, #276DC3 0%, #1e5699 100%)',
    'ScholarOne': 'linear-gradient(135deg, #7D2239 0%, #5e1a2b 100%)',
    'LifeScience': 'linear-gradient(135deg, #4CAF50 0%, #3d8b40 100%)',
    'LifeScienceHDS': 'linear-gradient(135deg, #FF9800 0%, #c77700 100%)',
    'LifeSciencePS': 'linear-gradient(135deg, #9C27B0 0%, #7b1fa2 100%)',
    'AccountSupport': 'linear-gradient(135deg, #F44336 0%, #d32f2f 100%)'
  };

  // Default placeholder image for teams without specific logos
  const defaultTeamImage = 'linear-gradient(135deg, var(--accent) 0%, var(--secondary-color) 100%)';

  // Load saved team setting
  chrome.storage.sync.get('savedSelection', async (data) => {
    if (data.savedSelection) {
      selectionDropdown.value = data.savedSelection;
      showSavedState(data.savedSelection);
    }
  });

  // Save team setting
  saveButton.addEventListener('click', async () => {
    const selectedTeam = selectionDropdown.value;

    try {
      await chrome.storage.sync.set({ 'savedSelection': selectedTeam });

      // Get active tab and send message
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        // Use the robust message sender for this too, if applicable,
        // though it's less likely to fail than theme application during load.
        // For now, keeping the direct call.
        await chrome.tabs.sendMessage(tabs[0].id, {
          message: 'saveSelection', // Assuming content script listens for this
          data: selectedTeam
        }).catch(err => console.warn("Could not notify content script of team change:", err)); // Add catch
      }

      // Show confirmation and visual feedback
      announceStatus(`Team setting saved as ${selectedTeam}`);
      saveButton.textContent = 'Saved!';
      saveButton.classList.add('saved');
      showSavedState(selectedTeam);

      setTimeout(() => {
        saveButton.textContent = 'Save';
        saveButton.classList.remove('saved');
      }, 2000);

      // Consider making the refresh less intrusive or conditional
      // setTimeout(() => {
      //   alert(`Please refresh CForce (Salesforce Website) for team settings to fully apply. Thanks 😊`);
      // }, 500);

    } catch (err) {
      console.error('Error saving team setting:', err);
      announceStatus('Error saving team setting');
    }
  });

  // Function to show the saved state with animations
  function showSavedState(team) {
    // Add the saved state class to trigger animations
    teamPanel.classList.add('saved-state');

    // Set the team logo background
    if (teamImages[team]) {
      // Use gradient if available
      teamLogo.style.backgroundImage = teamImages[team];
    } else {
      // Use default gradient as fallback
      teamLogo.style.backgroundImage = defaultTeamImage;
    }

    // Set team-specific colors if needed
    switch (team) {
      case 'EndNote':
        teamLogo.style.backgroundColor = '#0077CC';
        break;
      case 'WebOfScience':
        teamLogo.style.backgroundColor = '#276DC3';
        break;
      case 'ScholarOne':
        teamLogo.style.backgroundColor = '#7D2239';
        break;
      case 'LifeScience':
        teamLogo.style.backgroundColor = '#4CAF50';
        break;
      case 'LifeScienceHDS':
        teamLogo.style.backgroundColor = '#FF9800';
        break;
      case 'LifeSciencePS':
        teamLogo.style.backgroundColor = '#9C27B0';
        break;
      case 'AccountSupport':
        teamLogo.style.backgroundColor = '#F44336';
        break;
      default:
        teamLogo.style.backgroundColor = 'var(--accent)';
    }
  }

  // Add keyboard support
  selectionDropdown.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveButton.click();
    }
  });
}

// Setup navigation between bookmark tabs
function setupBookmarkNavigation() {
  const navLinks = document.querySelectorAll('.navigation a');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      if (link.classList.contains('disabled')) {
          e.preventDefault(); // Prevent navigation for disabled links
          return;
      }
      e.preventDefault();

      // Remove current from all links
      navLinks.forEach(navLink => {
        navLink.setAttribute('aria-current', 'false');
      });

      // Set current on clicked link
      link.setAttribute('aria-current', 'page');

      // Scroll to the section (This part might not be relevant if content isn't scrollable sections)
      // const targetId = link.getAttribute('href').substring(1);
      // const targetElement = document.getElementById(targetId);
      // if (targetElement) {
      //   targetElement.scrollIntoView({ behavior: 'smooth' });
      // }

       // Logic to show/hide content sections based on the link clicked would go here
       // For now, just logging the action
       console.log(`Navigation to: ${link.getAttribute('href')}`);
       announceStatus(`Navigated to ${link.textContent} section.`);


    });
  });
}

// Setup feature toggles handler
function setupFeatureToggles() {
  const featureToggles = {
    highlightCases: document.getElementById('highlightCases'),
    emailValidation: document.getElementById('emailValidation'),
    statusHighlighting: document.getElementById('statusHighlighting'),
    esploroDataDisplay: document.getElementById('esploroDataDisplay'),
    caseCommentExtractor: document.getElementById('caseCommentExtractor'),
    vitalFieldsDisplay: document.getElementById('vitalFieldsDisplay')
  };

  const saveButtonFeatures = document.getElementById('saveButtonFeatures');

   // ** ADD NEW FEATURE FLAG ** Default settings including the new flag
  const defaultFeatures = {
    highlightCases: true,
    emailValidation: true,
    statusHighlighting: true,
    esploroDataDisplay: false,
    caseCommentExtractor: true,
    vitalFieldsDisplay: true // Default value for the new feature
  };


  // Load saved settings, merging with defaults
  chrome.storage.sync.get({ featureSettings: defaultFeatures }, async (data) => {
      // Merge stored settings with defaults to ensure new flags are present
      const currentSettings = { ...defaultFeatures, ...(data.featureSettings || {}) };
      Object.keys(featureToggles).forEach(feature => {
        if (featureToggles[feature]) {
          featureToggles[feature].checked = currentSettings[feature];
        }
      });
      // Optionally re-save if merging introduced new defaults
      await chrome.storage.sync.set({ featureSettings: currentSettings });
  });

  // Save settings when button is clicked
  if (saveButtonFeatures) {
    saveButtonFeatures.addEventListener('click', async () => { // Make async
      const settings = {};
      Object.keys(featureToggles).forEach(feature => {
        if (featureToggles[feature]) {
          settings[feature] = featureToggles[feature].checked;
        } else {
           // If a toggle doesn't exist in HTML but is in defaults, keep its default/saved value
           // This requires loading the full current settings first
           chrome.storage.sync.get({ featureSettings: defaultFeatures }, (data) => {
               const currentSettings = { ...defaultFeatures, ...(data.featureSettings || {}) };
               if (currentSettings.hasOwnProperty(feature)) {
                   settings[feature] = currentSettings[feature];
               }
           });
        }
      });

       // Ensure all default keys are present before saving
      const finalSettings = { ...defaultFeatures, ...settings };


      try {
          // Save the settings to storage
          await chrome.storage.sync.set({ featureSettings: finalSettings });
          console.log('Feature settings updated:', finalSettings);

          // Send message to content script to update settings
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) {
              // Use robust sender
              const response = await sendMessageToContentScript(tabs[0].id, {
                  action: 'updateFeatureSettings', // Ensure content script handles this action
                  settings: finalSettings
              });
              if (response?.status === 'success') { // Assuming content script sends {status: 'success'}
                  console.log("Content script confirmed feature settings update.");
              } else {
                   console.warn("Content script did not confirm feature settings update or responded with error.", response);
              }
          } else {
               console.error("No active tab found to send feature settings update.");
          }

          // Show feedback
          saveButtonFeatures.textContent = 'Saved!';
          setTimeout(() => {
              saveButtonFeatures.textContent = 'Save';
          }, 2000);
          announceStatus('Feature settings saved');

      } catch (error) {
           console.error('Error saving or sending feature settings:', error);
           announceStatus('Error saving feature settings.');
      }
    });
  }
}