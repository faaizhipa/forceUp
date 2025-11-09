// Listen for the save button click
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('saveButton').addEventListener('click', save);
  });
  
  function save() {
    const selectedValue = document.getElementById('selectionDropdown').value;
    saveSelection(selectedValue);
  }
  
  // Function to save the selection to chrome.storage
  function saveSelection(selectedValue) {
    chrome.storage.sync.set({ 'savedSelection': selectedValue }, function() {
      console.log('Selection saved: ' + selectedValue);
    });
    chrome.runtime.sendMessage({
        message: 'saveSelection',
        data: selectedValue
      }, function(response) {
        console.log('Selection saved response:', response);
    });
  }
