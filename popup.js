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
 * NOTE: exlibris defaults must match SettingsManager.DEFAULT_SETTINGS exactly
 */
function getDefaultSettings() {
  return {
    savedSelection: 'EndNote',
    exlibris: {
      features: {
        fieldHighlighting: true,
        contextMenu: true,
        multiTabSync: true,
        caseCommentMemory: false,  // Matches SettingsManager default
        characterCounter: true,
        dynamicMenu: false,  // Matches SettingsManager default
        persistentBanner: false,  // Matches SettingsManager default
        highlighterEnabled: true
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
  // Use explicit boolean checks to match SettingsManager.isFeatureEnabled() logic
  // SettingsManager.isFeatureEnabled() returns true if value !== false
  if (settings.exlibris?.features) {
    document.getElementById('featureHighlighting').checked = settings.exlibris.features.fieldHighlighting !== false;
    document.getElementById('featureContextMenu').checked = settings.exlibris.features.contextMenu !== false;
    document.getElementById('featureMultiTab').checked = settings.exlibris.features.multiTabSync !== false;
    document.getElementById('featureCommentMemory').checked = settings.exlibris.features.caseCommentMemory !== false;
    document.getElementById('featureCharCounter').checked = settings.exlibris.features.characterCounter !== false;
    document.getElementById('featureDynamicMenu').checked = settings.exlibris.features.dynamicMenu !== false;
    document.getElementById('featurePersistentBanner').checked = settings.exlibris.features.persistentBanner !== false;
    document.getElementById('featureHighlighter').checked = settings.exlibris.features.highlighterEnabled === true;
  } else {
    // If exlibris.features doesn't exist, use defaults from SettingsManager
    const defaults = getDefaultSettings();
    document.getElementById('featureHighlighting').checked = defaults.exlibris.features.fieldHighlighting !== false;
    document.getElementById('featureContextMenu').checked = defaults.exlibris.features.contextMenu !== false;
    document.getElementById('featureMultiTab').checked = defaults.exlibris.features.multiTabSync !== false;
    document.getElementById('featureCommentMemory').checked = defaults.exlibris.features.caseCommentMemory !== false;
    document.getElementById('featureCharCounter').checked = defaults.exlibris.features.characterCounter !== false;
    document.getElementById('featureDynamicMenu').checked = defaults.exlibris.features.dynamicMenu !== false;
    document.getElementById('featurePersistentBanner').checked = defaults.exlibris.features.persistentBanner !== false;
    document.getElementById('featureHighlighter').checked = defaults.exlibris.features.highlighterEnabled === true;
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
        dynamicMenu: document.getElementById('featureDynamicMenu').checked,
        persistentBanner: document.getElementById('featurePersistentBanner').checked,
        highlighterEnabled: document.getElementById('featureHighlighter').checked
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

  // ========== GOOGLE DRIVE BACKUP BUTTONS ==========

  // Timeout for backup/restore operations (60 seconds)
  const BACKUP_TIMEOUT_MS = 60000;
  // Delay before showing setup modal after successful backup
  const MODAL_DELAY_MS = 500;

  // Backup now button handler is defined later with modal logic

  // Restore now button
  document.getElementById('restore-now').addEventListener('click', async () => {
    if (!confirm('Restore data from Google Drive? This will overwrite your current settings and data.')) {
      return;
    }
    
    const statusEl = document.getElementById('backup-status');
    const button = document.getElementById('restore-now');
    
    button.disabled = true;
    button.textContent = 'Restoring...';
    statusEl.textContent = 'Starting restore...';
    
    let responseReceived = false;
    const timeoutId = setTimeout(() => {
      if (!responseReceived) {
        statusEl.textContent = 'Error: Restore request timed out';
        button.disabled = false;
        button.textContent = 'Restore from Google Drive';
      }
    }, BACKUP_TIMEOUT_MS);
    
    try {
      chrome.runtime.sendMessage({ type: 'RUN_DRIVE_RESTORE' }, async (response) => {
        responseReceived = true;
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          statusEl.textContent = 'Error: ' + chrome.runtime.lastError.message;
          console.error('Restore error:', chrome.runtime.lastError);
        } else if (response && response.ok) {
          statusEl.textContent = '✓ ' + (response.message || 'Restore completed successfully');
          showSuccess('Restore completed! Reloading settings...');
          
          // Reload settings after restore
          const settings = await loadSettings();
          populateUI(settings);
          updateStorageInfo();
        } else {
          statusEl.textContent = '✗ ' + (response?.error || 'Restore failed');
        }
        
        button.disabled = false;
        button.textContent = 'Restore from Google Drive';
      });
    } catch (error) {
      responseReceived = true;
      clearTimeout(timeoutId);
      statusEl.textContent = 'Error: ' + error.message;
      button.disabled = false;
      button.textContent = 'Restore from Google Drive';
    }
  });

  // Inject Salesforce backup button
  document.getElementById('inject-sf-backup').addEventListener('click', async () => {
    const statusEl = document.getElementById('backup-status');
    
    try {
      // Get the active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      if (!tab) {
        statusEl.textContent = 'Error: No active tab found';
        return;
      }
      
      // Check if it's a Salesforce page using proper URL parsing
      let isSalesforce = false;
      try {
        if (tab.url) {
          const url = new URL(tab.url);
          const hostname = url.hostname.toLowerCase();
          // Check if the hostname ends with salesforce.com or lightning.force.com
          isSalesforce = hostname.endsWith('.salesforce.com') ||
                        hostname.endsWith('.lightning.force.com') ||
                        hostname === 'salesforce.com' ||
                        hostname === 'lightning.force.com';
        }
      } catch (e) {
        // Invalid URL
        isSalesforce = false;
      }
      
      if (!isSalesforce) {
        statusEl.textContent = 'Error: Please navigate to a Salesforce page first';
        return;
      }
      
      statusEl.textContent = 'Injecting button...';
      
      // Timeout for inject operation (10 seconds)
      let injectResponseReceived = false;
      const injectTimeoutId = setTimeout(() => {
        if (!injectResponseReceived) {
          statusEl.textContent = 'Error: Inject request timed out. Try refreshing the page.';
        }
      }, 10000);
      
      // Send message to content script
      chrome.tabs.sendMessage(tab.id, { type: 'INIT_SF_BACKUP_BUTTON' }, (response) => {
        injectResponseReceived = true;
        clearTimeout(injectTimeoutId);
        
        if (chrome.runtime.lastError) {
          // Content script might not be loaded on this page
          statusEl.textContent = 'Error: Could not reach Salesforce page. Try refreshing the page.';
          console.error('Inject error:', chrome.runtime.lastError);
        } else if (response && response.ok) {
          statusEl.textContent = '✓ Backup button added to Salesforce page';
          showSuccess('Button injected!');
        } else {
          statusEl.textContent = 'Error: ' + (response?.error || 'Failed to inject button');
        }
      });
    } catch (error) {
      statusEl.textContent = 'Error: ' + error.message;
    }
  });

  // ========== BACKUP SCHEDULE SETTINGS ==========

  // Load backup schedule settings
  async function loadBackupSchedule() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['backupSchedule'], (result) => {
        resolve(result.backupSchedule || {
          enabled: false,
          frequency: 'daily',
          lunchtimeHour: 12,
          timezone: 'Asia/Kuala_Lumpur',
          hasBeenSetup: false
        });
      });
    });
  }

  // Save backup schedule settings
  async function saveBackupSchedule(schedule) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ backupSchedule: schedule }, () => {
        // Notify background script to update alarm
        chrome.runtime.sendMessage({ 
          type: 'UPDATE_BACKUP_SCHEDULE', 
          schedule: schedule 
        }, (response) => {
          resolve(response);
        });
      });
    });
  }

  // Populate backup schedule UI
  async function populateBackupScheduleUI() {
    const schedule = await loadBackupSchedule();
    document.getElementById('autoBackupEnabled').checked = schedule.enabled;
    document.getElementById('backupFrequency').value = schedule.frequency || 'daily';
    document.getElementById('lunchtimeHour').value = String(schedule.lunchtimeHour || 12);
    document.getElementById('backupTimezone').value = schedule.timezone || 'Asia/Kuala_Lumpur';
    
    // Show next backup time if enabled
    updateBackupScheduleStatus(schedule);
  }

  function updateBackupScheduleStatus(schedule) {
    const statusEl = document.getElementById('backup-schedule-status');
    if (schedule.enabled) {
      const freq = schedule.frequency === 'daily' ? 'Daily' : 'Weekly (Monday)';
      statusEl.textContent = `✓ ${freq} backups enabled at ${schedule.lunchtimeHour}:00`;
    } else {
      statusEl.textContent = 'Automatic backups are disabled';
    }
  }

  // Initialize backup schedule UI
  populateBackupScheduleUI();

  // Save backup schedule button
  document.getElementById('saveBackupSchedule').addEventListener('click', async () => {
    const schedule = {
      enabled: document.getElementById('autoBackupEnabled').checked,
      frequency: document.getElementById('backupFrequency').value,
      lunchtimeHour: parseInt(document.getElementById('lunchtimeHour').value, 10),
      timezone: document.getElementById('backupTimezone').value,
      hasBeenSetup: true
    };
    
    await saveBackupSchedule(schedule);
    updateBackupScheduleStatus(schedule);
    showSuccess('Backup schedule saved!');
  });

  // ========== BACKUP SETUP MODAL ==========

  function showBackupSetupModal() {
    document.getElementById('backupSetupModal').classList.add('active');
  }

  function hideBackupSetupModal() {
    document.getElementById('backupSetupModal').classList.remove('active');
  }

  // Modal skip button
  document.getElementById('modalSkipBackup').addEventListener('click', async () => {
    // Mark as setup but not enabled
    const schedule = await loadBackupSchedule();
    schedule.hasBeenSetup = true;
    schedule.enabled = false;
    await saveBackupSchedule(schedule);
    hideBackupSetupModal();
    populateBackupScheduleUI();
  });

  // Modal enable button
  document.getElementById('modalEnableBackup').addEventListener('click', async () => {
    const schedule = {
      enabled: true,
      frequency: document.getElementById('modalBackupFrequency').value,
      lunchtimeHour: parseInt(document.getElementById('modalLunchtimeHour').value, 10),
      timezone: document.getElementById('modalBackupTimezone').value,
      hasBeenSetup: true
    };
    
    await saveBackupSchedule(schedule);
    hideBackupSetupModal();
    populateBackupScheduleUI();
    showSuccess('Automatic backups enabled!');
  });

  // Backup now button with modal logic for first-time setup
  document.getElementById('backup-now').addEventListener('click', async () => {
    const statusEl = document.getElementById('backup-status');
    const button = document.getElementById('backup-now');
    const schedule = await loadBackupSchedule();
    
    button.disabled = true;
    button.textContent = 'Backing up...';
    statusEl.textContent = 'Starting backup...';
    
    let responseReceived = false;
    const timeoutId = setTimeout(() => {
      if (!responseReceived) {
        statusEl.textContent = 'Error: Backup request timed out';
        button.disabled = false;
        button.textContent = 'Backup now to Google Drive';
      }
    }, BACKUP_TIMEOUT_MS);
    
    try {
      chrome.runtime.sendMessage({ type: 'RUN_DRIVE_BACKUP_FROM_POPUP' }, (response) => {
        responseReceived = true;
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          statusEl.textContent = 'Error: ' + chrome.runtime.lastError.message;
          console.error('Backup error:', chrome.runtime.lastError);
        } else if (response && response.ok) {
          statusEl.textContent = '✓ ' + (response.message || 'Backup completed successfully');
          showSuccess('Backup completed!');
          
          // Show setup modal if this is first time
          if (!schedule.hasBeenSetup) {
            setTimeout(() => {
              showBackupSetupModal();
            }, MODAL_DELAY_MS);
          }
        } else {
          statusEl.textContent = '✗ ' + (response?.error || 'Backup failed');
        }
        
        button.disabled = false;
        button.textContent = 'Backup now to Google Drive';
      });
    } catch (error) {
      responseReceived = true;
      clearTimeout(timeoutId);
      statusEl.textContent = 'Error: ' + error.message;
      button.disabled = false;
      button.textContent = 'Backup now to Google Drive';
    }
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
  document.getElementById('exportButton').addEventListener('click', async () => {
    // Get settings from chrome.storage.sync
    const syncData = currentSettings;
    
    // Get all data from chrome.storage.local (includes highlights, notes, bookmarks)
    const localData = await new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => resolve(result));
    });
    
    // Combine both into export package
    const exportData = {
      version: '4.0',
      exportDate: new Date().toISOString(),
      settings: syncData,
      data: localData
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cforce-extension-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Settings and data exported');
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
          const importData = JSON.parse(event.target.result);
          
          // Handle legacy format (just settings) or new format (settings + data)
          if (importData.settings && importData.data) {
            // New format with both settings and data
            await saveSettings(importData.settings);
            
            // Restore all local data (highlights, notes, bookmarks, cache, etc.)
            await new Promise((resolve) => {
              chrome.storage.local.set(importData.data, () => resolve());
            });
            
            populateUI(importData.settings);
            showSuccess('Settings and data imported successfully');
          } else {
            // Legacy format (just settings)
            await saveSettings(importData);
            populateUI(importData);
            showSuccess('Settings imported successfully');
          }
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
