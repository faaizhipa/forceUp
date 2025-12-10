/**
 * Popup Script for CForce Extension
 * Handles settings UI and persistence
 */

let currentSettings = null;

const ROTATION_INTERVAL_SECONDS = {
  min: 3,
  max: 60,
  default: 5
};

function clampRotationSeconds(value) {
  if (!Number.isFinite(value)) {
    return ROTATION_INTERVAL_SECONDS.default;
  }

  return Math.min(
    ROTATION_INTERVAL_SECONDS.max,
    Math.max(ROTATION_INTERVAL_SECONDS.min, value)
  );
}

function isLocalDbAvailable() {
  return typeof LocalDb !== 'undefined' && typeof LocalDb.exportEntities === 'function';
}

function safeSyncGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(keys, (result) => {
        if (chrome.runtime?.lastError) {
          console.warn('[Popup] sync.get failed:', chrome.runtime.lastError);
          resolve({});
          return;
        }
        resolve(result || {});
      });
    } catch (error) {
      console.warn('[Popup] sync.get threw:', error);
      resolve({});
    }
  });
}

function safeSyncSet(items) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set(items, () => {
        if (chrome.runtime?.lastError) {
          console.warn('[Popup] sync.set failed:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (error) {
      console.warn('[Popup] sync.set threw:', error);
      resolve(false);
    }
  });
}

function safeLocalGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime?.lastError) {
          console.warn('[Popup] local.get failed:', chrome.runtime.lastError);
          resolve({});
          return;
        }
        resolve(result || {});
      });
    } catch (error) {
      console.warn('[Popup] local.get threw:', error);
      resolve({});
    }
  });
}

function safeLocalSet(items) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime?.lastError) {
          console.warn('[Popup] local.set failed:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (error) {
      console.warn('[Popup] local.set threw:', error);
      resolve(false);
    }
  });
}

function safeLocalRemove(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime?.lastError) {
          console.warn('[Popup] local.remove failed:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (error) {
      console.warn('[Popup] local.remove threw:', error);
      resolve(false);
    }
  });
}

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
  let settings = null;

  if (isLocalDbAvailable()) {
    try {
      const stored = await LocalDb.getSetting('popup_settings');
      if (stored && stored.value) {
        settings = stored.value;
      }
    } catch (error) {
      console.warn('[Popup] LocalDb settings load failed, falling back to sync:', error);
    }
  }

  if (!settings) {
    const items = await safeSyncGet(null);
    settings = items || {};
  }

  const merged = mergeWithDefaults(settings || {});
  currentSettings = merged;

  if (isLocalDbAvailable()) {
    try {
      await LocalDb.putSetting({ key: 'popup_settings', value: merged, updatedAt: Date.now() });
    } catch (error) {
      console.warn('[Popup] LocalDb settings persist failed during load:', error);
    }
  }

  return merged;
}

/**
 * Saves settings to storage
 * Ensures all feature values are explicit booleans
 */
async function saveSettings(settings) {
  // Normalize feature values to explicit booleans before saving
  if (settings.exlibris?.features) {
    for (const featureName in settings.exlibris.features) {
      const value = settings.exlibris.features[featureName];
      // Ensure it's a boolean (not undefined, null, or other type)
      if (typeof value !== 'boolean') {
        settings.exlibris.features[featureName] = Boolean(value);
      }
    }
  }
  
  const saved = await safeSyncSet(settings);
  if (saved) {
    currentSettings = settings;
    console.log('Settings saved:', settings);
  }

  if (isLocalDbAvailable()) {
    try {
      await LocalDb.putSetting({ key: 'popup_settings', value: settings, updatedAt: Date.now() });
    } catch (error) {
      console.warn('[Popup] LocalDb settings save failed:', error);
    }
  }
  return saved;
}

/**
 * Gets default settings
 * Must match SettingsManager.DEFAULT_SETTINGS exactly
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
        dynamicMenu: true,
        persistentBanner: true,
        highlighterEnabled: true,
        bannerMessages: true
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
      },
      persistentBanner: {
        messages: {
          enabled: true,
          defaultMessages: {
            enabled: true,
            items: [
              { id: 'default_1', text: 'Field Highlighting', enabled: true },
              { id: 'default_2', text: 'Context Menu Formatting', enabled: true },
              { id: 'default_3', text: 'Multi-Tab Warning', enabled: true },
              { id: 'default_4', text: 'Auto-Save Comments', enabled: true },
              { id: 'default_5', text: 'Character Counter', enabled: true },
              { id: 'default_6', text: 'Dynamic Buttons', enabled: true },
              { id: 'default_7', text: 'Persistent Banner', enabled: true },
              { id: 'default_8', text: 'Text Highlighter & Sticky Notes', enabled: true }
            ]
          },
          customMessages: [],
          rotationInterval: ROTATION_INTERVAL_SECONDS.default * 1000,
          autoRotate: true
        }
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
    
    // Migrate undefined/null feature values to explicit booleans (matching SettingsManager)
    if (merged.exlibris.features) {
      const defaultFeatures = defaults.exlibris.features;
      for (const featureName in defaultFeatures) {
        const currentValue = merged.exlibris.features[featureName];
        // If value is undefined or null, use default
        if (currentValue === undefined || currentValue === null) {
          merged.exlibris.features[featureName] = defaultFeatures[featureName];
        }
        // Ensure it's a boolean
        else if (typeof currentValue !== 'boolean') {
          merged.exlibris.features[featureName] = Boolean(currentValue);
        }
      }
    }
    
    // Merge persistentBanner.messages if it exists
    if (settings.exlibris.persistentBanner) {
      merged.exlibris.persistentBanner = {
        ...defaults.exlibris.persistentBanner,
        ...settings.exlibris.persistentBanner,
        messages: {
          ...defaults.exlibris.persistentBanner.messages,
          ...(settings.exlibris.persistentBanner.messages || {}),
          defaultMessages: {
            ...defaults.exlibris.persistentBanner.messages.defaultMessages,
            ...(settings.exlibris.persistentBanner.messages?.defaultMessages || {}),
            items: settings.exlibris.persistentBanner.messages?.defaultMessages?.items || 
                   defaults.exlibris.persistentBanner.messages.defaultMessages.items
          },
          customMessages: settings.exlibris.persistentBanner.messages?.customMessages || []
        }
      };
    } else {
      // Ensure persistentBanner structure exists
      merged.exlibris.persistentBanner = defaults.exlibris.persistentBanner;
    }
    
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
  // Use consistent check logic: !== false (undefined/true = enabled, false = disabled)
  if (settings.exlibris?.features) {
    document.getElementById('featureHighlighting').checked = settings.exlibris.features.fieldHighlighting !== false;
    document.getElementById('featureContextMenu').checked = settings.exlibris.features.contextMenu !== false;
    document.getElementById('featureMultiTab').checked = settings.exlibris.features.multiTabSync !== false;
    document.getElementById('featureCommentMemory').checked = settings.exlibris.features.caseCommentMemory !== false;
    document.getElementById('featureCharCounter').checked = settings.exlibris.features.characterCounter !== false;
    document.getElementById('featureDynamicMenu').checked = settings.exlibris.features.dynamicMenu !== false;
    document.getElementById('featurePersistentBanner').checked = settings.exlibris.features.persistentBanner !== false;
    document.getElementById('featureHighlighter').checked = settings.exlibris.features.highlighterEnabled !== false;
    document.getElementById('featureBannerMessages').checked = settings.exlibris.features.bannerMessages !== false;
  }
  
  // Banner Messages settings
  if (settings.exlibris?.persistentBanner?.messages) {
    const messages = settings.exlibris.persistentBanner.messages;
    document.getElementById('bannerMessagesEnabled').checked = messages.enabled !== false;
    const rotationSeconds = clampRotationSeconds(
      Math.round((messages.rotationInterval || ROTATION_INTERVAL_SECONDS.default * 1000) / 1000)
    );
    document.getElementById('messageRotationInterval').value = rotationSeconds;
    document.getElementById('messageAutoRotate').checked = messages.autoRotate !== false;
    document.getElementById('defaultMessagesEnabled').checked = messages.defaultMessages?.enabled !== false;
    
    // Toggle settings panel visibility
    toggleBannerMessagesSettings(messages.enabled !== false);
    
    // Populate default messages
    if (messages.defaultMessages?.items) {
      renderDefaultMessages(messages.defaultMessages.items);
    }
    
    // Populate custom messages
    if (messages.customMessages) {
      renderCustomMessages(messages.customMessages);
    }
  } else {
    // Default state
    toggleBannerMessagesSettings(true);
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
  
  // Add listener for banner messages enabled toggle
  document.getElementById('bannerMessagesEnabled').addEventListener('change', (e) => {
    toggleBannerMessagesSettings(e.target.checked);
  });
}

/**
 * Toggle banner messages settings panel visibility
 * @param {boolean} enabled
 */
function toggleBannerMessagesSettings(enabled) {
  const panel = document.getElementById('bannerMessagesSettings');
  if (panel) {
    panel.style.display = enabled ? 'block' : 'none';
  }
}

/**
 * Get message settings from UI
 * @returns {Object} Message settings object
 */
function getMessageSettingsFromUI() {
  const defaultMessagesList = document.getElementById('defaultMessagesList');
  const customMessagesList = document.getElementById('customMessagesList');
  
  // Collect default messages state
  const defaultItems = [];
  if (defaultMessagesList) {
    defaultMessagesList.querySelectorAll('[data-message-id]').forEach(item => {
      const id = item.dataset.messageId;
      const checkbox = item.querySelector('input[type="checkbox"]');
      const text = item.querySelector('.message-text')?.textContent || '';
      if (id && id.startsWith('default_')) {
        defaultItems.push({
          id: id,
          text: text,
          enabled: checkbox ? checkbox.checked : true
        });
      }
    });
  }
  
  // Collect custom messages
  const customMessages = [];
  if (customMessagesList) {
    customMessagesList.querySelectorAll('[data-message-id]').forEach(item => {
      const id = item.dataset.messageId;
      const textarea = item.querySelector('.message-textarea');
      const descriptionArea = item.querySelector('.message-description');
      const enabledCheckbox = item.querySelector('input[type="checkbox"]');
      const imagePreview = item.querySelector('.image-preview');
      
      if (id && id.startsWith('custom_') && textarea) {
        const message = {
          id: id,
          text: textarea.value.trim(),
          enabled: enabledCheckbox ? enabledCheckbox.checked : true,
          description: descriptionArea ? descriptionArea.value.trim() : '',
          hoverImage: imagePreview ? imagePreview.src : null,
          pinnedCaseNumber: item.dataset.pinnedCaseNumber || null,
          pinnedCaseId: item.dataset.pinnedCaseId || null,
          pinnedCaseUrl: item.dataset.pinnedCaseUrl || null
        };
        customMessages.push(message);
      }
    });
  }
  
  return {
    enabled: document.getElementById('bannerMessagesEnabled').checked,
    defaultMessages: {
      enabled: document.getElementById('defaultMessagesEnabled').checked,
      items: defaultItems
    },
    customMessages: customMessages,
    rotationInterval: clampRotationSeconds(
      parseInt(document.getElementById('messageRotationInterval').value, 10)
    ) * 1000,
    autoRotate: document.getElementById('messageAutoRotate').checked
  };
}

/**
 * Render default messages (toggle only, cannot edit text)
 * @param {Array} messages - Array of default message objects
 */
function renderDefaultMessages(messages) {
  const container = document.getElementById('defaultMessagesList');
  if (!container) return;
  
  if (!messages || messages.length === 0) {
    container.innerHTML = '<p class="info-text">No default messages available</p>';
    return;
  }
  
  container.innerHTML = messages.map(msg => `
    <div class="message-item" data-message-id="${msg.id}">
      <label class="message-toggle">
        <input type="checkbox" ${msg.enabled !== false ? 'checked' : ''}>
        <span class="message-text">${escapeHtml(msg.text)}</span>
      </label>
    </div>
  `).join('');
}

/**
 * Render custom messages (editable)
 * @param {Array} messages - Array of custom message objects
 */
function renderCustomMessages(messages) {
  const container = document.getElementById('customMessagesList');
  if (!container) return;
  
  if (!messages || messages.length === 0) {
    container.innerHTML = '<p class="info-text">No custom messages. Click "Add Message" to create one.</p>';
    return;
  }
  
  container.innerHTML = messages.map(msg => {
    const charCount = (msg.text || '').length;
    const hasImage = msg.hoverImage ? true : false;
    const isPinned = msg.pinnedCaseNumber ? true : false;
    
    return `
    <div class="message-item custom-message" data-message-id="${msg.id}" style="border: 2px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 15px; margin-bottom: 15px; background: rgba(255,255,255,0.05);">
      <div class="message-controls" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <label class="message-toggle" style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" ${msg.enabled !== false ? 'checked' : ''}>
          <span>Enabled</span>
        </label>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${isPinned ? `<span style="font-size: 12px; padding: 2px 8px; background: rgba(224,120,0,0.2); border-radius: 4px; color: #ffa500;">📌 ${escapeHtml(msg.pinnedCaseNumber)}</span>` : ''}
          <button class="button-small delete-message-btn" data-message-id="${msg.id}" title="Delete message">Delete</button>
        </div>
      </div>
      
      <label style="display: block; margin-bottom: 5px; font-size: 12px; opacity: 0.9;">Message Text (4000 chars max)</label>
      <textarea class="message-textarea" rows="4" maxlength="4000" placeholder="Enter message text..." style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.2); color: white; font-family: inherit; resize: vertical;">${escapeHtml(msg.text || '')}</textarea>
      <div class="char-counter" style="text-align: right; font-size: 11px; margin-top: 3px; opacity: 0.7;">${charCount}/4000</div>
      
      <label style="display: block; margin: 10px 0 5px 0; font-size: 12px; opacity: 0.9;">Description (optional)</label>
      <textarea class="message-description" rows="2" placeholder="Add a description for this message..." style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.2); color: white; font-family: inherit; resize: vertical;">${escapeHtml(msg.description || '')}</textarea>
      
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
        <label style="display: block; margin-bottom: 5px; font-size: 12px; opacity: 0.9;">Hover Image</label>
        ${hasImage ? `
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <img class="image-preview" src="${msg.hoverImage}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 2px solid rgba(255,255,255,0.3);">
            <div style="flex: 1; font-size: 12px; opacity: 0.8;">
              <div>Image attached</div>
              <div style="font-size: 10px; margin-top: 2px;">${Math.round(msg.hoverImage.length * 0.75 / 1024)} KB</div>
            </div>
            <button class="button-small remove-image-btn" data-message-id="${msg.id}" style="background: rgba(200,0,0,0.3); border: 1px solid rgba(255,255,255,0.3);">Remove</button>
          </div>
        ` : ''}
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <input type="file" class="image-upload" data-message-id="${msg.id}" accept="image/*" style="display: none;">
          <button class="button-small upload-image-btn" data-message-id="${msg.id}" style="font-size: 11px; padding: 4px 8px;">📤 Upload</button>
          <input type="text" class="image-url-input" data-message-id="${msg.id}" placeholder="Or paste image URL..." style="flex: 1; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.2); color: white; font-size: 11px; min-width: 150px;">
          <button class="button-small load-url-btn" data-message-id="${msg.id}" style="font-size: 11px; padding: 4px 8px;">Load URL</button>
        </div>
        <div class="image-status" data-message-id="${msg.id}" style="font-size: 11px; margin-top: 5px; opacity: 0.7;"></div>
      </div>
    </div>
  `;
  }).join('');
  
  // Attach event handlers
  attachMessageEventHandlers(container);
}

/**
 * Add new custom message
 */
function addCustomMessage() {
  const container = document.getElementById('customMessagesList');
  if (!container) return;
  
  const newId = 'custom_' + Date.now();
  const newMessage = {
    id: newId,
    text: '',
    enabled: true,
    description: '',
    hoverImage: null,
    pinnedCaseNumber: null,
    pinnedCaseId: null,
    pinnedCaseUrl: null
  };
  
  // Get current messages from UI
  const currentMessages = getCurrentMessagesFromUI();
  
  // Add new message
  currentMessages.push(newMessage);
  renderCustomMessages(currentMessages);
  
  // Focus on the new textarea
  const newItem = container.querySelector(`[data-message-id="${newId}"]`);
  if (newItem) {
    const textarea = newItem.querySelector('textarea');
    if (textarea) {
      textarea.focus();
    }
  }
}

/**
 * Delete custom message
 * @param {string} messageId - ID of message to delete
 */
function deleteCustomMessage(messageId) {
  if (!confirm('Delete this custom message?')) return;
  
  const container = document.getElementById('customMessagesList');
  if (!container) return;
  
  const item = container.querySelector(`[data-message-id="${messageId}"]`);
  if (item) {
    item.remove();
  }
  
  // Update placeholder if no messages left
  if (container.querySelectorAll('[data-message-id]').length === 0) {
    container.innerHTML = '<p class="info-text">No custom messages. Click "Add Message" to create one.</p>';
  }
}

/**
 * Validate message text
 * @param {string} text - Message text to validate
 * @returns {Object} { valid: boolean, error: string|null }
 */
function validateMessageText(text) {
  if (!text || !text.trim()) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (text.length > 4000) {
    return { valid: false, error: 'Message cannot exceed 4000 characters' };
  }
  
  return { valid: true, error: null, length: text.length };
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Attach event handlers for message items
 * @param {HTMLElement} container - Container element
 */
function attachMessageEventHandlers(container) {
  // Delete buttons
  container.querySelectorAll('.delete-message-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.messageId;
      deleteCustomMessage(id);
    });
  });

  // Character counters for textareas
  container.querySelectorAll('.message-textarea').forEach(textarea => {
    const item = textarea.closest('[data-message-id]');
    const counter = item.querySelector('.char-counter');
    
    textarea.addEventListener('input', () => {
      if (counter) {
        counter.textContent = `${textarea.value.length}/4000`;
      }
    });
  });

  // Upload image buttons
  container.querySelectorAll('.upload-image-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const messageId = btn.dataset.messageId;
      const fileInput = container.querySelector(`.image-upload[data-message-id="${messageId}"]`);
      if (fileInput) {
        fileInput.click();
      }
    });
  });

  // File input handlers
  container.querySelectorAll('.image-upload').forEach(input => {
    input.addEventListener('change', (e) => {
      const messageId = input.dataset.messageId;
      const file = e.target.files[0];
      if (file) {
        handleImageUpload(file, messageId);
      }
    });
  });

  // Load URL buttons
  container.querySelectorAll('.load-url-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const messageId = btn.dataset.messageId;
      const urlInput = container.querySelector(`.image-url-input[data-message-id="${messageId}"]`);
      if (urlInput && urlInput.value.trim()) {
        handleImageUrl(urlInput.value.trim(), messageId);
      }
    });
  });

  // Remove image buttons
  container.querySelectorAll('.remove-image-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const messageId = btn.dataset.messageId;
      removeMessageImage(messageId);
    });
  });
}

/**
 * Handle image file upload
 * @param {File} file - Image file
 * @param {string} messageId - Message ID
 */
function handleImageUpload(file, messageId) {
  const statusEl = document.querySelector(`.image-status[data-message-id="${messageId}"]`);
  
  if (!file.type.startsWith('image/')) {
    if (statusEl) statusEl.textContent = '❌ Please select an image file';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      if (statusEl) statusEl.textContent = '⏳ Compressing...';
      const compressed = await compressImage(e.target.result);
      updateMessageImage(messageId, compressed);
      if (statusEl) statusEl.textContent = '✅ Image added successfully';
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
    } catch (error) {
      console.error('Image upload error:', error);
      if (statusEl) statusEl.textContent = '❌ Failed to process image';
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Handle image URL load
 * @param {string} url - Image URL
 * @param {string} messageId - Message ID
 */
async function handleImageUrl(url, messageId) {
  const statusEl = document.querySelector(`.image-status[data-message-id="${messageId}"]`);
  
  try {
    if (statusEl) statusEl.textContent = '⏳ Loading...';
    
    const response = await fetch(url);
    const blob = await response.blob();
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (statusEl) statusEl.textContent = '⏳ Compressing...';
        const compressed = await compressImage(e.target.result);
        updateMessageImage(messageId, compressed);
        if (statusEl) statusEl.textContent = '✅ Image added successfully';
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
      } catch (error) {
        console.error('Image compression error:', error);
        if (statusEl) statusEl.textContent = '❌ Failed to compress image';
      }
    };
    reader.readAsDataURL(blob);
    
  } catch (error) {
    console.error('Image URL error:', error);
    if (statusEl) statusEl.textContent = '❌ Failed to load image from URL';
  }
}

/**
 * Compress image to meet size requirements
 * @param {string} base64 - Base64 image data
 * @returns {Promise<string>} Compressed base64 image
 */
function compressImage(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate dimensions (max 700px width)
      let width = img.width;
      let height = img.height;
      const maxWidth = 700;
      
      if (width > maxWidth) {
        height = (height / width) * maxWidth;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Export as JPEG with 0.85 quality
      const compressed = canvas.toDataURL('image/jpeg', 0.85);
      
      // Check size (200KB limit)
      const sizeKB = Math.round(compressed.length * 0.75 / 1024);
      if (sizeKB > 200) {
        reject(new Error(`Image too large: ${sizeKB} KB (max 200 KB)`));
        return;
      }
      
      resolve(compressed);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
}

/**
 * Update message with new image
 * @param {string} messageId - Message ID
 * @param {string} imageData - Base64 image data
 */
function updateMessageImage(messageId, imageData) {
  const container = document.getElementById('customMessagesList');
  if (!container) return;
  
  const item = container.querySelector(`[data-message-id="${messageId}"]`);
  if (!item) return;
  
  // Store image data temporarily
  item.dataset.tempImage = imageData;
  
  // Re-render to show preview
  const allMessages = getCurrentMessagesFromUI();
  const message = allMessages.find(m => m.id === messageId);
  if (message) {
    message.hoverImage = imageData;
    renderCustomMessages(allMessages);
  }
}

/**
 * Remove image from message
 * @param {string} messageId - Message ID
 */
function removeMessageImage(messageId) {
  const allMessages = getCurrentMessagesFromUI();
  const message = allMessages.find(m => m.id === messageId);
  if (message) {
    message.hoverImage = null;
    renderCustomMessages(allMessages);
  }
}

/**
 * Get current messages from UI
 * @returns {Array} Array of message objects
 */
function getCurrentMessagesFromUI() {
  const container = document.getElementById('customMessagesList');
  if (!container) return [];
  
  const messages = [];
  container.querySelectorAll('[data-message-id]').forEach(item => {
    const id = item.dataset.messageId;
    const textarea = item.querySelector('.message-textarea');
    const descriptionArea = item.querySelector('.message-description');
    const enabledCheckbox = item.querySelector('input[type="checkbox"]');
    const imagePreview = item.querySelector('.image-preview');
    
    if (id && textarea) {
      messages.push({
        id: id,
        text: textarea.value.trim(),
        enabled: enabledCheckbox ? enabledCheckbox.checked : true,
        description: descriptionArea ? descriptionArea.value.trim() : '',
        hoverImage: imagePreview ? imagePreview.src : (item.dataset.tempImage || null),
        pinnedCaseNumber: item.dataset.pinnedCaseNumber || null,
        pinnedCaseId: item.dataset.pinnedCaseId || null,
        pinnedCaseUrl: item.dataset.pinnedCaseUrl || null
      });
    }
  });
  
  return messages;
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
        highlighterEnabled: document.getElementById('featureHighlighter').checked,
        bannerMessages: document.getElementById('featureBannerMessages').checked
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
      },
      persistentBanner: {
        messages: getMessageSettingsFromUI()
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
  try {
    chrome.storage.sync.getBytesInUse(null, (bytes) => {
      if (chrome.runtime?.lastError) {
        console.warn('[Popup] getBytesInUse failed:', chrome.runtime.lastError);
        return;
      }
      const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400;
      const percentage = Math.round((bytes / maxBytes) * 100);
      const kb = (bytes / 1024).toFixed(2);
      const maxKb = (maxBytes / 1024).toFixed(0);
      
      document.getElementById('storageInfo').textContent = 
        `Using ${kb} KB / ${maxKb} KB (${percentage}%)`;
    });
  } catch (error) {
    console.warn('[Popup] getBytesInUse threw:', error);
  }
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

/**
 * Load highlighter banner activation UI
 * Shows current URL dismissal status and allows reactivation
 */
async function loadHighlighterBannerActivationUI() {
  const urlEl = document.getElementById('highlighter-banner-url');
  const statusEl = document.getElementById('highlighter-banner-status');
  const toggleBtn = document.getElementById('toggle-highlighter-banner-btn');

  if (!urlEl || !statusEl || !toggleBtn) {
    console.warn('[Popup] Highlighter banner UI elements not found');
    return;
  }

  try {
    const activeTab = await getActiveTabURL();
    const currentUrl = activeTab.url || '';

    // Display URL (truncated if too long)
    if (currentUrl.length > 60) {
      urlEl.textContent = currentUrl.substring(0, 57) + '...';
      urlEl.title = currentUrl; // Full URL on hover
    } else {
      urlEl.textContent = currentUrl || 'N/A';
      urlEl.title = currentUrl || '';
    }

    // Check if banner should be shown (using new logic)
    // We need to check: default domains, whitelist, and dismissals
    const isDefaultDomain = await new Promise((resolve) => {
      try {
        const hostname = new URL(currentUrl).hostname.toLowerCase().replace(/^www\./, '');
        const defaultDomains = [
          'support.clarivate.com',
          'developers.exlibrisgroup.com',
          'knowledge.exlibrisgroup.com',
          'wiki.clarivate.io'
        ];
        resolve(defaultDomains.some(domain => {
          const checkDomain = domain.toLowerCase().replace(/^www\./, '');
          return hostname === checkDomain || hostname.endsWith('.' + checkDomain);
        }));
      } catch (e) {
        resolve(false);
      }
    });

    const whitelistResult = await safeLocalGet(['exl_hl_banner_whitelist']);
    const whitelist = whitelistResult.exl_hl_banner_whitelist || { domains: [], urls: [] };
    const isInWhitelist = (() => {
      try {
        const urlObj = new URL(currentUrl);
        const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
        const urlPath = urlObj.href;
        
        if (whitelist.urls.includes(urlPath)) {
          return true;
        }
        
        return whitelist.domains.some(domain => {
          const checkDomain = domain.toLowerCase().replace(/^www\./, '');
          return hostname === checkDomain || hostname.endsWith('.' + checkDomain);
        });
      } catch (_) {
        return false;
      }
    })();

    // Check if dismissed
    const domain = new URL(currentUrl).hostname.toLowerCase().replace(/^www\./, '');
    const dismissalResult = await safeLocalGet(['exl_hl_banner_dismissals', 'exl_hl_banner_page_dismissals']);
    const dismissals = dismissalResult.exl_hl_banner_dismissals || {};
    const pageDismissals = dismissalResult.exl_hl_banner_page_dismissals || {};
    const isDismissed = Boolean(pageDismissals[currentUrl] || (dismissals[domain] && dismissals[domain].dismissed));

    // Banner should show if: (isDefault OR inWhitelist) AND not dismissed
    const shouldShow = (isDefaultDomain || isInWhitelist) && !isDismissed;

    // Update UI based on status
    updateHighlighterBannerUI(shouldShow);

    // Attach toggle button handler
    toggleBtn.onclick = async () => {
      const showBanner = !shouldShow; // Toggle: if not showing, show it; if showing, hide it

      try {
        // Send message to content script to toggle banner
        chrome.tabs.sendMessage(activeTab.id, {
          action: 'toggleBanner',
          url: currentUrl,
          show: showBanner
        }, async (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[Popup] Could not send message to highlighter content script:', chrome.runtime.lastError);
            // Still update storage even if message fails
            if (showBanner) {
              // Clear dismissals to show banner
              await clearBannerDismissals(domain, currentUrl);
              updateHighlighterBannerUI(true);
            } else {
              // Dismiss banner
              await dismissBannerInPopup(domain, currentUrl);
              updateHighlighterBannerUI(false);
            }
            showSuccess(showBanner ? 'Banner will be shown when you navigate or refresh' : 'Banner will be hidden when you navigate or refresh');
            return;
          }
          
          if (response && response.success) {
            if (showBanner) {
              await clearBannerDismissals(domain, currentUrl);
            } else {
              await dismissBannerInPopup(domain, currentUrl);
            }
            updateHighlighterBannerUI(showBanner);
            showSuccess(showBanner ? 'Banner restored!' : 'Banner hidden');
          }
        });
      } catch (error) {
        console.error('[Popup] Error toggling highlighter banner:', error);
        showSuccess('Error: ' + error.message);
      }
    };

  } catch (error) {
    console.error('[Popup] Error loading highlighter banner activation UI:', error);
    if (urlEl) urlEl.textContent = 'Error';
    if (statusEl) {
      statusEl.textContent = '●Error';
      statusEl.className = 'status-badge status-inactive';
    }
    if (toggleBtn) toggleBtn.disabled = true;
  }
}

/**
 * Update highlighter banner activation UI elements
 * @param {boolean} visible - Whether banner is visible (not dismissed)
 */
function updateHighlighterBannerUI(visible) {
  const statusEl = document.getElementById('highlighter-banner-status');
  const toggleBtn = document.getElementById('toggle-highlighter-banner-btn');

  if (!statusEl || !toggleBtn) return;

  if (visible) {
    statusEl.textContent = '●Visible';
    statusEl.className = 'status-badge status-active';
    toggleBtn.textContent = 'Hide Banner';
    toggleBtn.setAttribute('data-enabled', 'true');
  } else {
    statusEl.textContent = '●Hidden';
    statusEl.className = 'status-badge status-inactive';
    toggleBtn.textContent = 'Show Banner';
    toggleBtn.setAttribute('data-enabled', 'false');
  }
}

/**
 * Load and display banner whitelist UI
 */
async function loadBannerWhitelistUI() {
  const listContainer = document.getElementById('whitelistedSitesList');
  const addBtn = document.getElementById('addSiteBtn');
  const addCurrentBtn = document.getElementById('addCurrentSiteBtn');
  const addInput = document.getElementById('addSiteInput');
  const addTypeSelect = document.getElementById('addSiteType');

  if (!listContainer || !addBtn || !addCurrentBtn || !addInput || !addTypeSelect) {
    console.warn('[Popup] Banner whitelist UI elements not found');
    return;
  }

  // Load and render whitelist
  await renderBannerWhitelist();

  // Add site button handler
  addBtn.addEventListener('click', async () => {
    const value = addInput.value.trim();
    const type = addTypeSelect.value;

    if (!value) {
      showSuccess('Please enter a domain or URL');
      return;
    }

    // Validate and add
    const success = await addToBannerWhitelist(type, value);
    if (success) {
      addInput.value = '';
      await renderBannerWhitelist();
      showSuccess(`Added ${type}: ${value}`);
    } else {
      showSuccess('Error adding site');
    }
  });

  // Add current site button handler
  addCurrentBtn.addEventListener('click', async () => {
    try {
      const activeTab = await getActiveTabURL();
      const currentUrl = activeTab.url || '';

      if (!currentUrl) {
        showSuccess('Could not get current URL');
        return;
      }

      // Ask user if they want to add as domain or URL
      const choice = confirm(
        `Add current site?\n\n` +
        `OK = Add as Domain (all pages on ${new URL(currentUrl).hostname})\n` +
        `Cancel = Add as URL (only this page)`
      );

      const type = choice ? 'domain' : 'url';
      const value = choice ? new URL(currentUrl).hostname.replace(/^www\./, '') : currentUrl;

      const success = await addToBannerWhitelist(type, value);
      if (success) {
        await renderBannerWhitelist();
        showSuccess(`Added current site as ${type}`);
      } else {
        showSuccess('Error adding current site');
      }
    } catch (error) {
      console.error('[Popup] Error adding current site:', error);
      showSuccess('Error: ' + error.message);
    }
  });

  // Allow Enter key to add
  addInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addBtn.click();
    }
  });
}

/**
 * Render banner whitelist
 */
async function renderBannerWhitelist() {
  const listContainer = document.getElementById('whitelistedSitesList');
  if (!listContainer) return;

  try {
    const whitelistResult = await safeLocalGet(['exl_hl_banner_whitelist']);
    const whitelist = whitelistResult.exl_hl_banner_whitelist || { domains: [], urls: [] };

    if (whitelist.domains.length === 0 && whitelist.urls.length === 0) {
      listContainer.innerHTML = '<p class="info-text" style="font-size: 11px; margin: 0;">No sites added yet. Add domains or URLs to enable the banner on those sites.</p>';
      return;
    }

    let html = '';

    // Render domains
    if (whitelist.domains.length > 0) {
      html += '<div style="margin-bottom: 12px;"><strong style="font-size: 12px; color: rgba(255,255,255,0.9);">Domains:</strong>';
      whitelist.domains.forEach(domain => {
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-top: 6px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <span style="font-size: 11px; font-family: monospace; color: rgba(255,255,255,0.9);">${domain}</span>
            <button class="button-small" data-type="domain" data-value="${domain}" style="padding: 4px 8px; font-size: 11px;">Remove</button>
          </div>
        `;
      });
      html += '</div>';
    }

    // Render URLs
    if (whitelist.urls.length > 0) {
      html += '<div><strong style="font-size: 12px; color: rgba(255,255,255,0.9);">URLs:</strong>';
      whitelist.urls.forEach(url => {
        const displayUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-top: 6px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <span style="font-size: 11px; font-family: monospace; color: rgba(255,255,255,0.9);" title="${url}">${displayUrl}</span>
            <button class="button-small" data-type="url" data-value="${url}" style="padding: 4px 8px; font-size: 11px;">Remove</button>
          </div>
        `;
      });
      html += '</div>';
    }

    listContainer.innerHTML = html;

    // Attach remove handlers
    listContainer.querySelectorAll('button[data-type]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.type;
        const value = btn.dataset.value;
        
        const success = await removeFromBannerWhitelist(type, value);
        if (success) {
          await renderBannerWhitelist();
          showSuccess(`Removed ${type}: ${value}`);
        } else {
          showSuccess('Error removing site');
        }
      });
    });
  } catch (error) {
    console.error('[Popup] Error rendering whitelist:', error);
    listContainer.innerHTML = '<p class="info-text" style="font-size: 11px; margin: 0; color: rgba(255,0,0,0.7);">Error loading whitelist</p>';
  }
}

/**
 * Add site to banner whitelist
 * @param {string} type - 'domain' or 'url'
 * @param {string} value - Domain or URL to add
 * @returns {Promise<boolean>} True if successful
 */
async function addToBannerWhitelist(type, value) {
  const whitelistResult = await safeLocalGet(['exl_hl_banner_whitelist']);
  const whitelist = whitelistResult.exl_hl_banner_whitelist || { domains: [], urls: [] };
  try {
    if (type === 'domain') {
      const domain = value.toLowerCase().replace(/^www\./, '').replace(/^https?:\/\//, '').split('/')[0];
      if (!domain) {
        return false;
      }
      if (!whitelist.domains.includes(domain)) {
        whitelist.domains.push(domain);
      }
    } else if (type === 'url') {
      let url = value.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      try {
        new URL(url);
        if (!whitelist.urls.includes(url)) {
          whitelist.urls.push(url);
        }
      } catch (_) {
        return false;
      }
    }
    await safeLocalSet({ exl_hl_banner_whitelist: whitelist });
    return true;
  } catch (error) {
    console.error('[Popup] Error adding to whitelist:', error);
    return false;
  }
}

/**
 * Remove site from banner whitelist
 * @param {string} type - 'domain' or 'url'
 * @param {string} value - Domain or URL to remove
 * @returns {Promise<boolean>} True if successful
 */
async function removeFromBannerWhitelist(type, value) {
  const whitelistResult = await safeLocalGet(['exl_hl_banner_whitelist']);
  const whitelist = whitelistResult.exl_hl_banner_whitelist || { domains: [], urls: [] };
  try {
    if (type === 'domain') {
      whitelist.domains = whitelist.domains.filter(d => d !== value);
    } else if (type === 'url') {
      whitelist.urls = whitelist.urls.filter(u => u !== value);
    }
    await safeLocalSet({ exl_hl_banner_whitelist: whitelist });
    return true;
  } catch (error) {
    console.error('[Popup] Error removing from whitelist:', error);
    return false;
  }
}

/**
 * Clear banner dismissals (reactivate banner)
 * @param {string} domain - Domain
 * @param {string} url - Full URL
 */
async function clearBannerDismissals(domain, url) {

      // LocalDb export
      const localDbExportButton = document.getElementById('localDbExportButton');
      if (localDbExportButton) {
        localDbExportButton.addEventListener('click', async () => {
          if (!isLocalDbAvailable()) {
            alert('LocalDb is not available in this context.');
            return;
          }

          try {
            const payload = await LocalDb.exportEntities();
            const json = JSON.stringify(payload, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'exlibris-localdb-backup.json';
            a.click();
            URL.revokeObjectURL(url);
            showSuccess('LocalDb data exported (highlights, notes, bookmarks, collections, settings).');
          } catch (error) {
            console.error('LocalDb export failed:', error);
            alert('Unable to export LocalDb data. See console for details.');
          }
        });
      }

      // LocalDb import
      const localDbImportButton = document.getElementById('localDbImportButton');
      if (localDbImportButton) {
        localDbImportButton.addEventListener('click', () => {
          if (!isLocalDbAvailable()) {
            alert('LocalDb is not available in this context.');
            return;
          }

          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'application/json';
          input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
              try {
                const payload = JSON.parse(event.target.result);
                const merge = true; // Merge to avoid accidental destructive overwrite
                const imported = await LocalDb.importEntities(payload, { merge });
                if (imported) {
                  showSuccess('LocalDb import complete. Refresh Salesforce pages to see updates.');
                } else {
                  alert('Import file is not a valid LocalDb export.');
                }
              } catch (error) {
                console.error('LocalDb import failed:', error);
                alert('Unable to import LocalDb data. Ensure the file is a valid JSON export.');
              }
            };
            reader.readAsText(file);
          };
          input.click();
        });
      }

      // LocalDb Google Drive backup
      const localDbDriveStatus = document.getElementById('localDbDriveStatus');
      const setDriveStatus = (msg, isError = false) => {
        if (!localDbDriveStatus) return;
        localDbDriveStatus.textContent = msg || '';
        localDbDriveStatus.style.color = isError ? '#d93025' : 'inherit';
      };

      const localDbDriveBackupButton = document.getElementById('localDbDriveBackupButton');
      if (localDbDriveBackupButton) {
        localDbDriveBackupButton.addEventListener('click', async () => {
          if (!isLocalDbAvailable()) {
            alert('LocalDb is not available in this context.');
            return;
          }

          try {
            setDriveStatus('Backing up LocalDb to Google Drive...');
            await GoogleDrive.getAuthToken(true);
            const payload = await LocalDb.exportEntities();
            await GoogleDrive.performLocalDbBackup(payload);
            setDriveStatus('LocalDb backup saved to Google Drive.');
          } catch (error) {
            console.error('LocalDb Drive backup failed:', error);
            setDriveStatus(`Backup failed: ${error.message}`, true);
          }
        });
      }

      // LocalDb Google Drive reveal (open backup file in Drive UI if possible)
      const localDbDriveRevealButton = document.getElementById('localDbDriveRevealButton');
      if (localDbDriveRevealButton) {
        localDbDriveRevealButton.addEventListener('click', async () => {
          if (!isLocalDbAvailable()) {
            alert('LocalDb is not available in this context.');
            return;
          }

          try {
            setDriveStatus('Locating Google Drive backup...');
            const token = await GoogleDrive.getAuthToken(true);
            if (!token) {
              setDriveStatus('Google Drive authentication failed.', true);
              return;
            }

            const fileId = await GoogleDrive.findFileInAppData(token, 'exl_localdb_backup.json');
            if (!fileId) {
              setDriveStatus('No Google Drive backup found. Run a backup first.');
              return;
            }

            const link = await GoogleDrive.getWebViewLink(fileId);
            if (link) {
              setDriveStatus('Opening Google Drive backup...');
              chrome.tabs.create({ url: link });
            } else {
              setDriveStatus('Backup exists in Drive app data; Google Drive does not expose a view link, but the backup is present.');
            }
          } catch (error) {
            console.error('LocalDb Drive reveal failed:', error);
            setDriveStatus(`Reveal failed: ${error.message}`, true);
          }
        });
      }

      // LocalDb Google Drive restore (merge)
      const localDbDriveRestoreButton = document.getElementById('localDbDriveRestoreButton');
      if (localDbDriveRestoreButton) {
        localDbDriveRestoreButton.addEventListener('click', async () => {
          if (!isLocalDbAvailable()) {
            alert('LocalDb is not available in this context.');
            return;
          }

          try {
            setDriveStatus('Restoring LocalDb from Google Drive (merge)...');
            await GoogleDrive.getAuthToken(true);
            await GoogleDrive.restoreLocalDbBackup({ merge: true });
            setDriveStatus('LocalDb restore complete (merged). Refresh Salesforce pages to see updates.');
          } catch (error) {
            console.error('LocalDb Drive restore failed:', error);
            setDriveStatus(`Restore failed: ${error.message}`, true);
          }
        });
      }
  const dismissalResult = await safeLocalGet(['exl_hl_banner_page_dismissals', 'exl_hl_banner_dismissals']);
  const pageDismissals = dismissalResult.exl_hl_banner_page_dismissals || {};
  const dismissals = dismissalResult.exl_hl_banner_dismissals || {};

  delete pageDismissals[url];

  if (dismissals[domain]) {
    dismissals[domain].dismissed = false;
    dismissals[domain].count = 0;
    dismissals[domain].modalShown = false;
  }

  await safeLocalSet({
    exl_hl_banner_page_dismissals: pageDismissals,
    exl_hl_banner_dismissals: dismissals
  });
}

/**
 * Dismiss banner (for popup toggle)
 * @param {string} domain - Domain
 * @param {string} url - Full URL
 */
async function dismissBannerInPopup(domain, url) {
  const dismissalResult = await safeLocalGet(['exl_hl_banner_dismissals']);
  const dismissals = dismissalResult.exl_hl_banner_dismissals || {};

  if (!dismissals[domain]) {
    dismissals[domain] = {};
  }

  dismissals[domain].dismissed = true;
  dismissals[domain].count = 0;

  await safeLocalSet({ exl_hl_banner_dismissals: dismissals });
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
  
  // Load highlighter banner activation UI
  await loadHighlighterBannerActivationUI();
  
  // Load banner whitelist management UI
  await loadBannerWhitelistUI();
  
  // Setup storage change listener for cross-tab synchronization
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    // Listen for banner messages changes from other tabs
    if (areaName === 'local' && changes.exl_bannerMessages) {
      console.log('[Popup] Banner messages changed in another tab, updating UI...');
      
      // Debounced UI update to prevent rapid-fire
      if (window.debouncedPopupUpdate) {
        window.debouncedPopupUpdate();
      } else {
        // Create debounced function
        window.debouncedPopupUpdate = (() => {
          let timeout;
          return () => {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
              // Reload custom messages section
              const newValue = changes.exl_bannerMessages.newValue;
              if (newValue && newValue.customMessages) {
                // Update the UI with new messages
                const container = document.getElementById('customMessagesContainer');
                if (container) {
                  renderCustomMessages(newValue.customMessages);
                  console.log('[Popup] UI updated with messages from another tab');
                }
              }
            }, 250);
          };
        })();
        window.debouncedPopupUpdate();
      }
    }
    
    // Listen for settings changes (sync storage)
    if (areaName === 'sync') {
      console.log('[Popup] Settings changed in another tab, reloading...');
      const newSettings = await loadSettings();
      populateUI(newSettings);
    }
  });
  
  console.log('[Popup] Storage change listener registered for cross-tab sync');
  
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
  
  // Add custom message button
  const addCustomMessageBtn = document.getElementById('addCustomMessageBtn');
  if (addCustomMessageBtn) {
    addCustomMessageBtn.addEventListener('click', () => {
      addCustomMessage();
    });
  }
  
  // Save shortcuts button
  document.getElementById('saveShortcutsButton').addEventListener('click', async () => {
    const settings = getSettingsFromUI();
    await saveSettings(settings);
    showSuccess('Shortcuts settings saved!');
  });
  
  // Clear cache button
  document.getElementById('clearCacheButton').addEventListener('click', async () => {
    const items = await safeLocalGet(null);
    const keysToRemove = Object.keys(items).filter(key => 
      key.startsWith('caseData_') || key === 'caseDataCache'
    );
    
    if (keysToRemove.length === 0) {
      showSuccess('Cache is already empty');
      return;
    }
    
    const removed = await safeLocalRemove(keysToRemove);
    if (removed) {
      showSuccess(`Cleared ${keysToRemove.length} cache entries`);
      updateStorageInfo();
    } else {
      showSuccess('Unable to clear cache (storage unavailable)');
    }
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
    const manifest = chrome.runtime.getManifest();
    const syncData = currentSettings;

    let workspacePayload = null;
    if (typeof DataMigration !== 'undefined' && DataMigration.exportAllData) {
      workspacePayload = await DataMigration.exportAllData({ includeBackups: true });
    }

    const exportData = {
      version: manifest?.version || 'unknown',
      exportDate: new Date().toISOString(),
      settings: syncData,
      workspace: workspacePayload?.data || {},
      workspaceBackupCount: workspacePayload?.backupCount || 0
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cforce-extension-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Workspace data exported (highlights, notes, bookmarks, layers).');
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

          const settingsPayload = importData.settings || (importData.exlibris ? importData : null);
          if (settingsPayload) {
            await saveSettings(settingsPayload);
            populateUI(settingsPayload);
          }

          const workspacePayload = importData.workspace || importData.data;
          if (workspacePayload && Object.keys(workspacePayload).length > 0) {
            if (typeof DataMigration !== 'undefined' && DataMigration.clearWorkspaceData) {
              await DataMigration.clearWorkspaceData({ includeBackups: true });
            }
            await new Promise((resolve) => {
              chrome.storage.local.set(workspacePayload, () => resolve());
            });
            showSuccess('Workspace data imported. Refresh Salesforce to reload highlights.');
          } else if (!importData.settings) {
            alert('Import file does not contain workspace or settings data.');
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

  // LocalDb export
  const localDbExportButton = document.getElementById('localDbExportButton');
  if (localDbExportButton) {
    localDbExportButton.addEventListener('click', async () => {
      if (!isLocalDbAvailable()) {
        alert('LocalDb is not available in this context.');
        return;
      }

      try {
        const payload = await LocalDb.exportEntities();
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exlibris-localdb-backup.json';
        a.click();
        URL.revokeObjectURL(url);
        showSuccess('LocalDb data exported (highlights, notes, bookmarks, collections, settings).');
      } catch (error) {
        console.error('LocalDb export failed:', error);
        alert('Unable to export LocalDb data. See console for details.');
      }
    });
  }

  // LocalDb import
  const localDbImportButton = document.getElementById('localDbImportButton');
  if (localDbImportButton) {
    localDbImportButton.addEventListener('click', () => {
      if (!isLocalDbAvailable()) {
        alert('LocalDb is not available in this context.');
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const payload = JSON.parse(event.target.result);
            const merge = true; // Merge to avoid accidental destructive overwrite
            const imported = await LocalDb.importEntities(payload, { merge });
            if (imported) {
              showSuccess('LocalDb import complete. Refresh Salesforce pages to see updates.');
            } else {
              alert('Import file is not a valid LocalDb export.');
            }
          } catch (error) {
            console.error('LocalDb import failed:', error);
            alert('Unable to import LocalDb data. Ensure the file is a valid JSON export.');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  // LocalDb Google Drive backup
  const localDbDriveStatus = document.getElementById('localDbDriveStatus');
  const setDriveStatus = (msg, isError = false) => {
    if (!localDbDriveStatus) return;
    localDbDriveStatus.textContent = msg || '';
    localDbDriveStatus.style.color = isError ? '#d93025' : 'inherit';
  };

  const localDbDriveBackupButton = document.getElementById('localDbDriveBackupButton');
  if (localDbDriveBackupButton) {
    localDbDriveBackupButton.addEventListener('click', async () => {
      if (!isLocalDbAvailable()) {
        alert('LocalDb is not available in this context.');
        return;
      }

      try {
        setDriveStatus('Backing up LocalDb to Google Drive...');
        await GoogleDrive.getAuthToken(true);
        const payload = await LocalDb.exportEntities();
        await GoogleDrive.performLocalDbBackup(payload);
        setDriveStatus('LocalDb backup saved to Google Drive.');
      } catch (error) {
        console.error('LocalDb Drive backup failed:', error);
        setDriveStatus(`Backup failed: ${error.message}`, true);
      }
    });
  }

  // LocalDb Google Drive restore (merge)
  const localDbDriveRestoreButton = document.getElementById('localDbDriveRestoreButton');
  if (localDbDriveRestoreButton) {
    localDbDriveRestoreButton.addEventListener('click', async () => {
      if (!isLocalDbAvailable()) {
        alert('LocalDb is not available in this context.');
        return;
      }

      try {
        setDriveStatus('Restoring LocalDb from Google Drive (merge)...');
        await GoogleDrive.getAuthToken(true);
        await GoogleDrive.restoreLocalDbBackup({ merge: true });
        setDriveStatus('LocalDb restore complete (merged). Refresh Salesforce pages to see updates.');
      } catch (error) {
        console.error('LocalDb Drive restore failed:', error);
        setDriveStatus(`Restore failed: ${error.message}`, true);
      }
    });
  }
});
