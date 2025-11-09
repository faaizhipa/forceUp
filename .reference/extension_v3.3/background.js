// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Handle saving team selection
  if (request.message === 'saveSelection') {
    // Save the selection to storage
    try {
      chrome.storage.sync.set({ 'savedSelection': request.data }, function() {
        console.log('Selection saved: ' + request.data);
        sendResponse({ status: true });
      });
    } catch (error) {
      console.error('Error saving selection:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  } 
  // Handle retrieving saved team selection
  else if (request.message === 'getSavedSelection') {
    try {
      // Send the saved selection to the content script
      chrome.storage.sync.get('savedSelection', function(items) {
        sendResponse({ status: true, data: items.savedSelection || null });
      });
    } catch (error) {
      console.error('Error getting saved selection:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  }
  // Handle theme updates
  else if (request.action === 'updateTheme') {
    try {
      chrome.storage.sync.set({ 'themeObject': request.data }, function() {
        console.log('Theme saved: ' + request.data);
        sendResponse({ status: true, data: request.data });
      });
    } catch (error) {
      console.error('Error saving theme:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  }
  // Handle retrieving the current theme
  else if (request.action === 'getCurrentTheme') {
    try {
      chrome.storage.sync.get('themeObject', function(items) {
        sendResponse({ status: true, data: items.theme});
      });
    } catch (error) {
      console.error('Error saving theme:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  }
  // get theme from storage
  else if (request.message === 'getThemeSettings') {
    try {
      chrome.storage.sync.get('themeObject', function(items) {
        sendResponse({ status: true, data: items.themeObject });
      });
    } catch (error) {
      console.error('Error getting theme:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  }
  // Update the theme settings
  else if (request.message === 'updateThemeSettings') {
    try {
      chrome.storage.sync.set({ 'themeObject': request.data }, function() {
        console.log('Theme settings saved:', request.data);
        sendResponse({ status: true });
      });
    } catch (error) {
      console.error('Error saving theme settings:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  }
  // Handle feature settings updates
  else if (request.message === 'updateFeatureSettings') {
    try {
      chrome.storage.sync.set({ 'featureSettings': request.settings }, function() {
        console.log('Feature settings saved:', request.settings);
        sendResponse({ status: true });
      });
    } catch (error) {
      console.error('Error saving feature settings:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  }
  // Handle retrieving feature settings
  else if (request.message === 'getFeatureSettings') {
    try {
      chrome.storage.sync.get('featureSettings', function(items) {
        sendResponse({ status: true, data: items.featureSettings || null });
      });
    } catch (error) {
      console.error('Error getting feature settings:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  }
  // Handle retrieving the current tab URL
  else if (request.message === 'getCurrentTabUrl') {
    try {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        sendResponse({ status: true, data: tabs[0].url });
      });
    } catch (error) {
      console.error('Error getting current tab URL:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  }
  // Handle retrieving the current tab ID
  else if (request.message === 'getCurrentTabId') {
    try {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        sendResponse({ status: true, data: tabs[0].id });
      });
    } catch (error) {
      console.error('Error getting current tab ID:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  }
  // Forward message to active tab's content script
  else if (request.message === 'forwardToContentScript') {
    try {
      // Forward message to active tab's content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          message: request.data.message,
          data: request.data.payload
        }, function(response) {
          sendResponse(response);
        });
      });
    } catch (error) {
      console.error('Error forwarding message to content script:', error);
      sendResponse({ status: false, error: error.message });
    }
    return true; // Keep message channel open
  }
  return true;
});