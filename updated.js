// updated.js - Landing page script

document.addEventListener('DOMContentLoaded', () => {
  // Get manifest version and display it
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.getElementById('version');
  if (versionElement) {
    versionElement.textContent = `Version ${manifest.version}`;
  }

  // Open extension popup
  document.getElementById('openPopup')?.addEventListener('click', () => {
    chrome.action.openPopup();
  });

  // Close tab
  document.getElementById('closeTab')?.addEventListener('click', () => {
    window.close();
  });

  // Support link (you can customize this URL)
  document.getElementById('supportLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    // Open GitHub repo or documentation page
    // For now, just show an alert
    alert('Documentation coming soon! Check the extension popup menu to explore all features.');
  });
});
