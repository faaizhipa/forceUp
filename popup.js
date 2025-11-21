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
          rotationInterval: 5000,
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
    document.getElementById('messageRotationInterval').value = messages.rotationInterval || 5000;
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
      const textarea = item.querySelector('textarea');
      const enabledCheckbox = item.querySelector('input[type="checkbox"]');
      if (id && id.startsWith('custom_') && textarea) {
        const imageInput = item.querySelector('.image-url-input');
        const imagePreview = item.querySelector('.image-preview img');
        const hoverImage = imagePreview ? imagePreview.src : (imageInput ? imageInput.value.trim() || null : null);
        
        customMessages.push({
          id: id,
          text: textarea.value.trim(),
          enabled: enabledCheckbox ? enabledCheckbox.checked : true,
          hoverImage: hoverImage,
          description: ''
        });
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
    rotationInterval: parseInt(document.getElementById('messageRotationInterval').value, 10) * 1000, // Convert to milliseconds
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
  
  container.innerHTML = messages.map(msg => `
    <div class="message-item custom-message" data-message-id="${msg.id}">
      <div class="message-controls">
        <label class="message-toggle">
          <input type="checkbox" ${msg.enabled !== false ? 'checked' : ''}>
          <span>Enabled</span>
        </label>
        <button class="button-small delete-message-btn" data-message-id="${msg.id}" title="Delete message">Delete</button>
      </div>
      <textarea class="message-textarea" rows="3" maxlength="240" placeholder="Enter message (max 3 lines, use Enter for new line)">${escapeHtml(msg.text || '')}</textarea>
      <div class="message-image-section">
        <label>Hover Image:</label>
        <div class="image-upload-controls">
          <input type="file" accept="image/*" class="image-file-input" data-message-id="${msg.id}" style="display: none;">
          <input type="text" class="image-url-input" placeholder="Image URL" data-message-id="${msg.id}" value="${msg.hoverImage && !msg.hoverImage.startsWith('data:') ? escapeHtml(msg.hoverImage) : ''}">
          <button class="button-small upload-image-btn" data-message-id="${msg.id}" title="Upload from file">📁</button>
          <button class="button-small paste-image-btn" data-message-id="${msg.id}" title="Paste from clipboard">📋</button>
          ${msg.hoverImage ? `<button class="button-small remove-image-btn" data-message-id="${msg.id}" title="Remove image">✕</button>` : ''}
        </div>
        ${msg.hoverImage ? `<div class="image-preview"><img src="${msg.hoverImage}" alt="Preview" /></div>` : ''}
      </div>
    </div>
  `).join('');
  
  // Attach delete handlers
  container.querySelectorAll('.delete-message-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.messageId;
      deleteCustomMessage(id);
    });
  });
  
  // Attach image upload handlers
  container.querySelectorAll('.upload-image-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.messageId;
      const fileInput = container.querySelector(`.image-file-input[data-message-id="${id}"]`);
      if (fileInput) fileInput.click();
    });
  });
  
  container.querySelectorAll('.image-file-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleImageUpload(e.target.dataset.messageId, file);
      }
    });
  });
  
  container.querySelectorAll('.image-url-input').forEach(input => {
    input.addEventListener('blur', async (e) => {
      const url = e.target.value.trim();
      if (url) {
        await handleImageUrl(e.target.dataset.messageId, url);
      }
    });
  });
  
  container.querySelectorAll('.paste-image-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.messageId;
      await handleImagePaste(id);
    });
  });
  
  container.querySelectorAll('.remove-image-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.messageId;
      await handleImageRemove(id);
    });
  });
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
    hoverImage: null,
    description: ''
  };
  
  // Get current messages
  const currentMessages = [];
  container.querySelectorAll('[data-message-id]').forEach(item => {
    const id = item.dataset.messageId;
    const textarea = item.querySelector('textarea');
    const enabledCheckbox = item.querySelector('input[type="checkbox"]');
    if (id && id.startsWith('custom_') && textarea) {
      currentMessages.push({
        id: id,
        text: textarea.value.trim(),
        enabled: enabledCheckbox ? enabledCheckbox.checked : true
      });
    }
  });
  
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
 * Handle image file upload
 * @param {string} messageId - Message ID
 * @param {File} file - File object
 */
async function handleImageUpload(messageId, file) {
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }
  
  if (file.size > 2 * 1024 * 1024) {
    alert('Image size must be less than 2MB');
    return;
  }
  
  try {
    const base64 = await fileToBase64(file);
    await saveImageToMessage(messageId, base64);
    // Reload settings and re-render
    const settings = await loadSettings();
    const messages = settings.exlibris?.features?.persistentBanner?.messages?.customMessages || [];
    renderCustomMessages(messages);
  } catch (error) {
    console.error('Error uploading image:', error);
    alert('Error uploading image: ' + error.message);
  }
}

/**
 * Handle image URL
 * @param {string} messageId - Message ID
 * @param {string} url - Image URL
 */
async function handleImageUrl(messageId, url) {
  if (!url) return;
  
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    alert('Invalid URL');
    return;
  }
  
  await saveImageToMessage(messageId, url);
  // Reload settings and re-render
  const settings = await loadSettings();
  const messages = settings.exlibris?.features?.persistentBanner?.messages?.customMessages || [];
  renderCustomMessages(messages);
}

/**
 * Handle image paste from clipboard
 * @param {string} messageId - Message ID
 */
async function handleImagePaste(messageId) {
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
        const blob = await item.getType('image/png') || await item.getType('image/jpeg');
        const file = new File([blob], 'pasted-image.png', { type: blob.type });
        await handleImageUpload(messageId, file);
        return;
      }
    }
    alert('No image found in clipboard');
  } catch (error) {
    console.error('Error pasting image:', error);
    alert('Error pasting image. Please try copying an image first.');
  }
}

/**
 * Handle image removal
 * @param {string} messageId - Message ID
 */
async function handleImageRemove(messageId) {
  await saveImageToMessage(messageId, null);
  // Reload settings and re-render
  const settings = await loadSettings();
  const messages = settings.exlibris?.features?.persistentBanner?.messages?.customMessages || [];
  renderCustomMessages(messages);
}

/**
 * Save image to message in settings
 * @param {string} messageId - Message ID
 * @param {string|null} imageData - Base64 string or URL, or null to remove
 */
async function saveImageToMessage(messageId, imageData) {
  const settings = await loadSettings();
  const messagesConfig = settings.exlibris?.features?.persistentBanner?.messages;
  
  if (!messagesConfig) return;
  
  const customIndex = messagesConfig.customMessages?.findIndex(m => m.id === messageId);
  if (customIndex !== undefined && customIndex >= 0) {
    if (!messagesConfig.customMessages[customIndex]) {
      messagesConfig.customMessages[customIndex] = { id: messageId };
    }
    messagesConfig.customMessages[customIndex].hoverImage = imageData;
  }
  
  await saveSettings(settings);
}

/**
 * Convert file to base64
 * @param {File} file - File object
 * @returns {Promise<string>} Base64 string
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  
  const lines = text.split('\n');
  if (lines.length > 3) {
    return { valid: false, error: 'Message cannot exceed 3 lines' };
  }
  
  if (text.length > 240) {
    return { valid: false, error: 'Message cannot exceed 240 characters' };
  }
  
  return { valid: true, error: null };
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
