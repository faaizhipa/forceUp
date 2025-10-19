/**
 * @file This script handles saving a user's selection from a dropdown menu in the extension's UI.
 * @description It persists the selection to `chrome.storage.sync` for persistence across sessions
 * and sends a message to the background script to notify it of the change, allowing other parts
 * of the extension to react to the new setting.
 * @author Jules
 */

/**
 * Attaches a 'click' event listener to the 'saveButton' when the DOM is fully loaded.
 * @description This ensures that the save functionality is active as soon as the UI is ready for
 * user interaction. The listener is attached once the DOM content is parsed, preventing errors
 * from attempting to access elements that do not yet exist.
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('saveButton').addEventListener('click', save);
  });
  
/**
 * Retrieves the selected value from the 'selectionDropdown' element and triggers the save process.
 * @description This function acts as the handler for the 'saveButton' click event. It reads the
 * current value from the dropdown and passes it to the `saveSelection` function to be persisted.
 * @returns {void}
 */
function save() {
  const selectedValue = document.getElementById('selectionDropdown').value;
  saveSelection(selectedValue);
}

/**
 * Saves the user's selected value to `chrome.storage.sync` and sends a message to the background script.
 * @description This function performs two key actions:
 * 1. It uses `chrome.storage.sync.set` to save the selection, which will persist it and sync it
 *    across the user's devices.
 * 2. It uses `chrome.runtime.sendMessage` to inform the background script of the change, allowing
 *    it to take immediate action if necessary.
 * @param {string} selectedValue The value selected by the user in the dropdown menu.
 * @returns {void}
 */
function saveSelection(selectedValue) {
  // Save the selection to synchronized storage.
  chrome.storage.sync.set({ 'savedSelection': selectedValue }, function() {
    console.log('Selection saved to chrome.storage.sync: ' + selectedValue);
  });

  // Send a message to the background script to notify it of the change.
  chrome.runtime.sendMessage({
      message: 'saveSelection',
      data: selectedValue
    }, function(response) {
      // The response from the background script is logged for debugging purposes.
      console.log('Response from background script after saving selection:', response);
  });
}
