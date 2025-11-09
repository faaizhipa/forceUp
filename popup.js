/**
 * Popup Script for CForce Extension
 * Handles settings UI and persistence
 */

let currentSettings = null;

async function getActiveTabURL() {
  const tabs = await chrome.tabs.query({
    currentWindow: true,
    active: true
  });
  return tabs[0];
}

/**
 * Loads settings from storage
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (items) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading settings:', chrome.runtime.lastError);
        resolve(getDefaultSettings());
        return;
      }
      
      // Merge with defaults
      const settings = mergeWithDefaults(items);
      currentSettings = settings;
      resolve(settings);
    });
  });
}

/**
 * Saves settings to storage
 */
async function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving settings:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }
      currentSettings = settings;
      console.log('Settings saved:', settings);
      resolve();
    });
  });
}

/**
 * Gets default settings
 */
function getDefaultSettings() {
  return {
    savedSelection: 'EndNote',
    exlibris: {
      features: {
        fieldHighlighting: true,
        contextMenu: true,
        multiTabSync: true,
        caseCommentMemory: true,
        characterCounter: true,
        dynamicMenu: true
      },
      ui: {
        buttonLabelStyle: 'casual',
        timezone: 'auto',
        menuLocations: {
          cardActions: false,
          headerDetails: true
        }
      },
      shortcuts: {
        enabled: true
      }
    },
    userPreferences: {
      shift: {
        timezone: 'Asia/Kuala_Lumpur',
        startHour: 21,
        startMinute: 0,
        endHour: 6,
        endMinute: 0,
        isOvernightShift: true
      },
      userTimezone: {
        auto: true,
        manual: null
      },
      salesforceTimezone: {
        auto: true,
        manual: null
      },
      irt: {
        useTeamDefaults: true,
        customMinutes: null
      },
      formatting: {
        dateFormat: 'auto',
        timeFormat: '24h'
      },
      meta: {
        isFirstRun: true,
        setupCompleted: false,
        warningDismissed: false
      }
    }
  };
}

/**
 * Merges settings with defaults
 */
function mergeWithDefaults(settings) {
  const defaults = getDefaultSettings();
  
  // Deep merge
  const merged = { ...defaults };
  
  if (settings.savedSelection) {
    merged.savedSelection = settings.savedSelection;
  }
  
  if (settings.exlibris) {
    merged.exlibris = {
      ...defaults.exlibris,
      ...settings.exlibris,
      features: { ...defaults.exlibris.features, ...(settings.exlibris.features || {}) },
      ui: { ...defaults.exlibris.ui, ...(settings.exlibris.ui || {}) },
      shortcuts: { ...defaults.exlibris.shortcuts, ...(settings.exlibris.shortcuts || {}) }
    };
    
    if (settings.exlibris.ui?.menuLocations) {
      merged.exlibris.ui.menuLocations = {
        ...defaults.exlibris.ui.menuLocations,
        ...settings.exlibris.ui.menuLocations
      };
    }
  }

  if (settings.userPreferences) {
    merged.userPreferences = {
      ...defaults.userPreferences,
      ...settings.userPreferences,
      shift: { ...defaults.userPreferences.shift, ...(settings.userPreferences.shift || {}) },
      userTimezone: { ...defaults.userPreferences.userTimezone, ...(settings.userPreferences.userTimezone || {}) },
      salesforceTimezone: { ...defaults.userPreferences.salesforceTimezone, ...(settings.userPreferences.salesforceTimezone || {}) },
      irt: { ...defaults.userPreferences.irt, ...(settings.userPreferences.irt || {}) },
      formatting: { ...defaults.userPreferences.formatting, ...(settings.userPreferences.formatting || {}) },
      meta: { ...defaults.userPreferences.meta, ...(settings.userPreferences.meta || {}) }
    };
  }
  
  return merged;
}

/**
 * Populates UI with current settings
 */
function populateUI(settings) {
  // General tab
  document.getElementById('selectionDropdown').value = settings.savedSelection || 'EndNote';
  
  // Ex Libris features
  if (settings.exlibris?.features) {
    document.getElementById('featureHighlighting').checked = settings.exlibris.features.fieldHighlighting !== false;
    document.getElementById('featureContextMenu').checked = settings.exlibris.features.contextMenu !== false;
    document.getElementById('featureMultiTab').checked = settings.exlibris.features.multiTabSync !== false;
    document.getElementById('featureCommentMemory').checked = settings.exlibris.features.caseCommentMemory !== false;
    document.getElementById('featureCharCounter').checked = settings.exlibris.features.characterCounter !== false;
    document.getElementById('featureDynamicMenu').checked = settings.exlibris.features.dynamicMenu !== false;
  }
  
  // UI preferences
  if (settings.exlibris?.ui) {
    document.getElementById('labelStyleSelect').value = settings.exlibris.ui.buttonLabelStyle || 'casual';
    document.getElementById('timezoneSelect').value = settings.exlibris.ui.timezone || 'auto';
    
    if (settings.exlibris.ui.menuLocations) {
      document.getElementById('menuCardActions').checked = settings.exlibris.ui.menuLocations.cardActions || false;
      document.getElementById('menuHeaderDetails').checked = settings.exlibris.ui.menuLocations.headerDetails !== false;
    }
  }
  
  // Shortcuts
  if (settings.exlibris?.shortcuts) {
    document.getElementById('shortcutsEnabled').checked = settings.exlibris.shortcuts.enabled !== false;
  }

  // User Preferences tab
  if (settings.userPreferences) {
    const prefs = settings.userPreferences;
    
    // Shift configuration
    if (prefs.shift) {
      document.getElementById('shiftTimezone').value = prefs.shift.timezone || 'Asia/Kuala_Lumpur';
      const startTime = `${String(prefs.shift.startHour || 21).padStart(2, '0')}:${String(prefs.shift.startMinute || 0).padStart(2, '0')}`;
      const endTime = `${String(prefs.shift.endHour || 6).padStart(2, '0')}:${String(prefs.shift.endMinute || 0).padStart(2, '0')}`;
      document.getElementById('shiftStartTime').value = startTime;
      document.getElementById('shiftEndTime').value = endTime;
      document.getElementById('isOvernightShift').checked = prefs.shift.isOvernightShift !== false;
    }

    // Timezone settings
    if (prefs.userTimezone) {
      document.getElementById('userTimezone').value = prefs.userTimezone.auto ? 'auto' : (prefs.userTimezone.manual || 'auto');
    }
    if (prefs.salesforceTimezone) {
      document.getElementById('salesforceTimezone').value = prefs.salesforceTimezone.auto ? 'auto' : (prefs.salesforceTimezone.manual || 'auto');
    }

    // IRT settings
    if (prefs.irt) {
      document.getElementById('useTeamDefaults').checked = prefs.irt.useTeamDefaults !== false;
      if (prefs.irt.customMinutes) {
        document.getElementById('customIRT').value = prefs.irt.customMinutes;
      }
      document.getElementById('customIRT').disabled = prefs.irt.useTeamDefaults !== false;
    }

    // Formatting
    if (prefs.formatting) {
      document.getElementById('dateFormat').value = prefs.formatting.dateFormat || 'auto';
      document.getElementById('timeFormat').value = prefs.formatting.timeFormat || '24h';
    }
  }

  // Add listener for useTeamDefaults checkbox to enable/disable custom IRT
  document.getElementById('useTeamDefaults').addEventListener('change', (e) => {
    document.getElementById('customIRT').disabled = e.target.checked;
  });
}

/**
 * Gets settings from UI
 */
function getSettingsFromUI() {
  // Parse shift times
  const shiftStart = document.getElementById('shiftStartTime').value.split(':');
  const shiftEnd = document.getElementById('shiftEndTime').value.split(':');
  
  // Determine timezone values
  const userTzValue = document.getElementById('userTimezone').value;
  const sfTzValue = document.getElementById('salesforceTimezone').value;

  const settings = {
    savedSelection: document.getElementById('selectionDropdown').value,
    exlibris: {
      features: {
        fieldHighlighting: document.getElementById('featureHighlighting').checked,
        contextMenu: document.getElementById('featureContextMenu').checked,
        multiTabSync: document.getElementById('featureMultiTab').checked,
        caseCommentMemory: document.getElementById('featureCommentMemory').checked,
        characterCounter: document.getElementById('featureCharCounter').checked,
        dynamicMenu: document.getElementById('featureDynamicMenu').checked
      },
      ui: {
        buttonLabelStyle: document.getElementById('labelStyleSelect').value,
        timezone: document.getElementById('timezoneSelect').value,
        menuLocations: {
          cardActions: document.getElementById('menuCardActions').checked,
          headerDetails: document.getElementById('menuHeaderDetails').checked
        }
      },
      shortcuts: {
        enabled: document.getElementById('shortcutsEnabled').checked
      }
    },
    userPreferences: {
      shift: {
        timezone: document.getElementById('shiftTimezone').value,
        startHour: parseInt(shiftStart[0], 10),
        startMinute: parseInt(shiftStart[1], 10),
        endHour: parseInt(shiftEnd[0], 10),
        endMinute: parseInt(shiftEnd[1], 10),
        isOvernightShift: document.getElementById('isOvernightShift').checked
      },
      userTimezone: {
        auto: userTzValue === 'auto',
        manual: userTzValue !== 'auto' ? userTzValue : null
      },
      salesforceTimezone: {
        auto: sfTzValue === 'auto',
        manual: sfTzValue !== 'auto' ? sfTzValue : null
      },
      irt: {
        useTeamDefaults: document.getElementById('useTeamDefaults').checked,
        customMinutes: document.getElementById('customIRT').value ? parseInt(document.getElementById('customIRT').value, 10) : null
      },
      formatting: {
        dateFormat: document.getElementById('dateFormat').value,
        timeFormat: document.getElementById('timeFormat').value
      },
      meta: {
        isFirstRun: false,
        setupCompleted: true,
        warningDismissed: true,
        lastUpdated: new Date().toISOString()
      }
    }
  };
  
  return settings;
}

/**
 * Gets storage info
 */
async function updateStorageInfo() {
  chrome.storage.sync.getBytesInUse(null, (bytes) => {
    const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400;
    const percentage = Math.round((bytes / maxBytes) * 100);
    const kb = (bytes / 1024).toFixed(2);
    const maxKb = (maxBytes / 1024).toFixed(0);
    
    document.getElementById('storageInfo').textContent = 
      `Using ${kb} KB / ${maxKb} KB (${percentage}%)`;
  });
}

/**
 * Shows success message
 */
function showSuccess(message) {
  // Create temporary success message
  const successDiv = document.createElement('div');
  successDiv.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: #4caf50;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 13px;
    z-index: 10000;
    animation: fadeOut 2s forwards;
  `;
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
  
  setTimeout(() => successDiv.remove(), 2000);
}

// Initialize on load
document.addEventListener("DOMContentLoaded", async () => {
  const activeTab = await getActiveTabURL();
  
  // Set About tab version from manifest dynamically
  try {
    const manifest = chrome.runtime.getManifest();
    const versionEl = document.getElementById('versionValue');
    if (versionEl && manifest?.version) {
      versionEl.textContent = manifest.version;
    }
  } catch (_) {
    // ignore if not available
  }
  
  // Check if on Salesforce
  const isSalesforce = activeTab.url.includes("clarivateanalytics.lightning.force.com") || 
                      activeTab.url.includes("clarivateanalytics--preprod.sandbox.lightning.force.com") || 
                      activeTab.url.includes("proquestllc.lightning.force.com");
  
  if (!isSalesforce) {
    document.getElementById('notInSFDC').style.display = 'block';
    document.getElementById('settingsContainer').style.display = 'none';
    return;
  }
  
  // Load and populate settings
  const settings = await loadSettings();
  populateUI(settings);
  updateStorageInfo();
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      
      // Activate clicked tab
      tab.classList.add('active');
      const tabName = tab.getAttribute('data-tab');
      document.querySelector(`.tab-content[data-tab="${tabName}"]`).classList.add('active');
    });
  });
  
  // Save team button
  document.getElementById('saveTeamButton').addEventListener('click', async () => {
    const settings = getSettingsFromUI();
    await saveSettings(settings);
    showSuccess('Team setting saved! Please refresh Salesforce.');
  });

  // Save preferences button
  document.getElementById('savePreferencesButton').addEventListener('click', async () => {
    const settings = getSettingsFromUI();
    await saveSettings(settings);
    showSuccess('Preferences saved! Please refresh Salesforce.');
  });

  // Reset preferences button
  document.getElementById('resetPreferencesButton').addEventListener('click', async () => {
    if (confirm('Reset preferences to defaults? This will reset shift times, timezones, and IRT settings.')) {
      const defaults = getDefaultSettings();
      currentSettings.userPreferences = defaults.userPreferences;
      await saveSettings(currentSettings);
      populateUI(currentSettings);
      showSuccess('Preferences reset to defaults');
    }
  });
  
  // Save Ex Libris button
  document.getElementById('saveExLibrisButton').addEventListener('click', async () => {
    const settings = getSettingsFromUI();
    await saveSettings(settings);
    showSuccess('Ex Libris settings saved! Please refresh Salesforce.');
  });
  
  // Save shortcuts button
  document.getElementById('saveShortcutsButton').addEventListener('click', async () => {
    const settings = getSettingsFromUI();
    await saveSettings(settings);
    showSuccess('Shortcuts settings saved!');
  });
  
  // Clear cache button
  document.getElementById('clearCacheButton').addEventListener('click', async () => {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(key => 
        key.startsWith('caseData_') || key === 'caseDataCache'
      );
      
      if (keysToRemove.length === 0) {
        showSuccess('Cache is already empty');
        return;
      }
      
      chrome.storage.local.remove(keysToRemove, () => {
        showSuccess(`Cleared ${keysToRemove.length} cache entries`);
        updateStorageInfo();
      });
    });
  });
  
  // Reset button
  document.getElementById('resetButton').addEventListener('click', async () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      const defaults = getDefaultSettings();
      await saveSettings(defaults);
      populateUI(defaults);
      showSuccess('Settings reset to defaults');
    }
  });
  
  // Export button
  document.getElementById('exportButton').addEventListener('click', () => {
    const json = JSON.stringify(currentSettings, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cforce-extension-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Settings exported');
  });
  
  // Import button
  document.getElementById('importButton').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const settings = JSON.parse(event.target.result);
          await saveSettings(settings);
          populateUI(settings);
          showSuccess('Settings imported successfully');
        } catch (error) {
          alert('Error importing settings: Invalid JSON file');
          console.error('Import error:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
});
