/**
 * Popup Script
 * Handles the extension popup UI and settings
 */

(function() {
  'use strict';

  // ============================================================================
  // State
  // ============================================================================

  let config = {
    localTimezone: '',
    customerTimezone: '',
    favoriteTimezones: []
  };

  let allTimezones = [];
  let isSettingsMode = false;

  // ============================================================================
  // DOM Elements
  // ============================================================================

  const elements = {
    widgetContainer: document.getElementById('widget-container'),
    settingsPanel: document.getElementById('settings-panel'),
    toggleSettingsBtn: document.getElementById('toggle-settings'),
    localTimezoneSelect: document.getElementById('local-timezone'),
    customerTimezoneSelect: document.getElementById('customer-timezone'),
    favoritesList: document.getElementById('favorites-list'),
    addFavoriteBtn: document.getElementById('add-favorite-btn'),
    addFavoriteContainer: document.getElementById('add-favorite-container'),
    favoriteSearch: document.getElementById('favorite-search'),
    timezoneDropdown: document.getElementById('timezone-dropdown'),
    saveBtn: document.getElementById('save-btn'),
    cancelBtn: document.getElementById('cancel-btn')
  };

  // ============================================================================
  // Timezone Helpers
  // ============================================================================

  /**
   * Populates timezone select options
   * @param {HTMLSelectElement} select - Select element
   * @param {string} selectedValue - Currently selected value
   */
  function populateTimezoneSelect(select, selectedValue) {
    select.innerHTML = '';
    
    allTimezones.forEach(tz => {
      const option = document.createElement('option');
      option.value = tz;
      option.textContent = tz.replace(/_/g, ' ');
      if (tz === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  /**
   * Renders the favorites list
   */
  function renderFavoritesList() {
    elements.favoritesList.innerHTML = '';
    
    config.favoriteTimezones.forEach(tz => {
      const item = document.createElement('div');
      item.className = 'favorite-item';
      item.innerHTML = `
        <span>${tz.replace(/_/g, ' ')}</span>
        <button data-timezone="${tz}">Remove</button>
      `;
      
      item.querySelector('button').addEventListener('click', () => {
        config.favoriteTimezones = config.favoriteTimezones.filter(t => t !== tz);
        renderFavoritesList();
      });
      
      elements.favoritesList.appendChild(item);
    });
  }

  /**
   * Filters and shows timezone dropdown
   * @param {string} query - Search query
   */
  function filterTimezones(query) {
    const filtered = allTimezones.filter(tz => 
      tz.toLowerCase().includes(query.toLowerCase()) &&
      !config.favoriteTimezones.includes(tz)
    ).slice(0, 20);

    elements.timezoneDropdown.innerHTML = '';
    
    if (filtered.length === 0) {
      elements.timezoneDropdown.classList.remove('active');
      return;
    }

    filtered.forEach(tz => {
      const option = document.createElement('div');
      option.className = 'timezone-option';
      option.textContent = tz.replace(/_/g, ' ');
      option.addEventListener('click', () => {
        config.favoriteTimezones.push(tz);
        renderFavoritesList();
        elements.favoriteSearch.value = '';
        elements.timezoneDropdown.classList.remove('active');
        elements.addFavoriteContainer.style.display = 'none';
        elements.addFavoriteBtn.style.display = 'block';
      });
      elements.timezoneDropdown.appendChild(option);
    });

    elements.timezoneDropdown.classList.add('active');
  }

  // ============================================================================
  // Mode Switching
  // ============================================================================

  /**
   * Shows settings mode
   */
  function showSettings() {
    isSettingsMode = true;
    elements.widgetContainer.style.display = 'none';
    elements.settingsPanel.classList.add('active');
    elements.toggleSettingsBtn.textContent = 'Widget';
    
    // Populate selects
    populateTimezoneSelect(elements.localTimezoneSelect, config.localTimezone);
    populateTimezoneSelect(elements.customerTimezoneSelect, config.customerTimezone);
    renderFavoritesList();
  }

  /**
   * Shows widget mode
   */
  function showWidget() {
    isSettingsMode = false;
    elements.widgetContainer.style.display = 'block';
    elements.settingsPanel.classList.remove('active');
    elements.toggleSettingsBtn.textContent = 'Settings';
    
    // Initialize widget
    if (typeof GlobalSyncWidget !== 'undefined') {
      GlobalSyncWidget.init(elements.widgetContainer, {
        localTimezone: config.localTimezone,
        customerTimezone: config.customerTimezone,
        favoriteTimezones: config.favoriteTimezones
      });
    }
  }

  // ============================================================================
  // Storage
  // ============================================================================

  /**
   * Loads configuration from storage
   */
  async function loadConfig() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getConfig' }, (response) => {
        if (response && response.success) {
          config = response.config;
        } else {
          // Fallback
          config = {
            localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            customerTimezone: 'America/New_York',
            favoriteTimezones: []
          };
        }
        resolve(config);
      });
    });
  }

  /**
   * Saves configuration to storage
   */
  async function saveConfig() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ 
        action: 'saveConfig', 
        config: config 
      }, (response) => {
        resolve(response?.success || false);
      });
    });
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Sets up event listeners
   */
  function setupEventListeners() {
    // Toggle between widget and settings
    elements.toggleSettingsBtn.addEventListener('click', () => {
      if (isSettingsMode) {
        showWidget();
      } else {
        showSettings();
      }
    });

    // Add favorite button
    elements.addFavoriteBtn.addEventListener('click', () => {
      elements.addFavoriteContainer.style.display = 'block';
      elements.addFavoriteBtn.style.display = 'none';
      elements.favoriteSearch.focus();
    });

    // Favorite search input
    elements.favoriteSearch.addEventListener('input', (e) => {
      filterTimezones(e.target.value);
    });

    elements.favoriteSearch.addEventListener('blur', () => {
      // Delay to allow click on dropdown
      setTimeout(() => {
        elements.timezoneDropdown.classList.remove('active');
        if (elements.favoriteSearch.value === '') {
          elements.addFavoriteContainer.style.display = 'none';
          elements.addFavoriteBtn.style.display = 'block';
        }
      }, 200);
    });

    // Save button
    elements.saveBtn.addEventListener('click', async () => {
      config.localTimezone = elements.localTimezoneSelect.value;
      config.customerTimezone = elements.customerTimezoneSelect.value;
      
      await saveConfig();
      showWidget();
    });

    // Cancel button
    elements.cancelBtn.addEventListener('click', async () => {
      // Reload original config
      await loadConfig();
      showWidget();
    });
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async function init() {
    console.log('[Popup] Initializing...');

    // Get all timezones
    if (typeof TimezoneUtils !== 'undefined') {
      allTimezones = TimezoneUtils.getAllTimezones();
    } else {
      // Fallback
      try {
        allTimezones = Intl.supportedValuesOf('timeZone');
      } catch {
        allTimezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
      }
    }

    // Load config
    await loadConfig();
    
    // Setup events
    setupEventListeners();

    // Show widget
    showWidget();

    console.log('[Popup] Initialized with config:', config);
  }

  // Start
  document.addEventListener('DOMContentLoaded', init);

})();
