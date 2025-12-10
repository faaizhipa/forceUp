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
  let timezoneMeta = [];
  let activeBand = null;
  let selectedTimezone = '';
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
    explorerSearch: document.getElementById('explorer-search'),
    explorerList: document.getElementById('explorer-list'),
    bandMap: document.getElementById('tz-band-map'),
    setLocalBtn: document.getElementById('set-local-btn'),
    setCustomerBtn: document.getElementById('set-customer-btn'),
    addExplorerFavBtn: document.getElementById('add-fav-btn'),
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
        toggleFavoriteInput(false);
      });
      elements.timezoneDropdown.appendChild(option);
    });

    elements.timezoneDropdown.classList.add('active');
  }

  function toggleFavoriteInput(show) {
    elements.addFavoriteContainer.classList.toggle('hidden', !show);
    elements.addFavoriteBtn.classList.toggle('hidden', show);
  }

  function parseOffsetMinutes(offsetLabel) {
    const match = offsetLabel.match(/UTC([+-])(\d{1,2})(?::(\d{2}))?/i);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    const hours = parseInt(match[2], 10) || 0;
    const minutes = parseInt(match[3] || '0', 10) || 0;
    return sign * ((hours * 60) + minutes);
  }

  function buildTimezoneMeta() {
    const now = new Date();
    timezoneMeta = allTimezones.map(tz => {
      const offsetLabel = TimezoneUtils?.getTimezoneOffset(now, tz) || 'UTC';
      return {
        id: tz,
        label: tz.replace(/_/g, ' '),
        abbr: TimezoneUtils?.getTimezoneAbbreviation(now, tz) || '',
        offsetLabel,
        offsetMinutes: parseOffsetMinutes(offsetLabel),
        searchText: `${tz} ${tz.replace(/_/g, ' ')} ${offsetLabel}`.toLowerCase()
      };
    }).sort((a, b) => {
      if (a.offsetMinutes !== b.offsetMinutes) {
        return a.offsetMinutes - b.offsetMinutes;
      }
      return a.label.localeCompare(b.label);
    });
  }

  function getBandHour(offsetMinutes) {
    return Math.round(offsetMinutes / 60);
  }

  function renderBandMap() {
    elements.bandMap.innerHTML = '';
    const bands = [];

    for (let hour = -12; hour <= 14; hour++) {
      bands.push(hour);
    }

    bands.forEach(hour => {
      const count = timezoneMeta.filter(tz => getBandHour(tz.offsetMinutes) === hour).length;
      const band = document.createElement('div');
      band.className = 'tz-band';
      if (activeBand === hour) {
        band.classList.add('active');
      }
      band.dataset.band = hour.toString();
      band.innerHTML = `
        <span>${hour >= 0 ? '+' : ''}${hour}</span>
        <small>${count}</small>
      `;
      band.addEventListener('click', () => {
        activeBand = activeBand === hour ? null : hour;
        renderBandMap();
        renderExplorerList();
      });
      elements.bandMap.appendChild(band);
    });
  }

  function getFilteredExplorerList() {
    const term = elements.explorerSearch.value.trim().toLowerCase();

    return timezoneMeta.filter(tz => {
      const matchesBand = activeBand === null || getBandHour(tz.offsetMinutes) === activeBand;
      const matchesTerm = term === '' || tz.searchText.includes(term) || tz.offsetLabel.toLowerCase().includes(term);
      return matchesBand && matchesTerm;
    });
  }

  function setSelectedTimezone(tz) {
    selectedTimezone = tz;
    renderExplorerList();
  }

  function renderExplorerList() {
    const list = getFilteredExplorerList();
    elements.explorerList.innerHTML = '';

    list.forEach(item => {
      const row = document.createElement('div');
      row.className = 'explorer-item';
      if (item.id === selectedTimezone) {
        row.classList.add('active');
      }
      row.innerHTML = `
        <div>
          <div class="label">${item.label}</div>
          <div class="meta">${item.offsetLabel}${item.abbr ? ` • ${item.abbr}` : ''}</div>
        </div>
        <div class="meta">UTC ${item.offsetMinutes >= 0 ? '+' : ''}${(item.offsetMinutes / 60).toFixed(1).replace('.0', '')}</div>
      `;
      row.addEventListener('click', () => setSelectedTimezone(item.id));
      elements.explorerList.appendChild(row);
    });
  }

  function primeExplorerSelection() {
    selectedTimezone = config.customerTimezone || config.localTimezone || '';
    elements.explorerSearch.value = '';
    activeBand = null;
    renderBandMap();
    renderExplorerList();
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
    primeExplorerSelection();
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
      toggleFavoriteInput(true);
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
          toggleFavoriteInput(false);
        }
      }, 200);
    });

    elements.explorerSearch.addEventListener('input', () => {
      renderExplorerList();
    });

    elements.setLocalBtn.addEventListener('click', () => {
      if (!selectedTimezone) return;
      elements.localTimezoneSelect.value = selectedTimezone;
      config.localTimezone = selectedTimezone;
    });

    elements.setCustomerBtn.addEventListener('click', () => {
      if (!selectedTimezone) return;
      elements.customerTimezoneSelect.value = selectedTimezone;
      config.customerTimezone = selectedTimezone;
    });

    elements.addExplorerFavBtn.addEventListener('click', () => {
      if (!selectedTimezone || config.favoriteTimezones.includes(selectedTimezone)) return;
      config.favoriteTimezones.push(selectedTimezone);
      renderFavoritesList();
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

    // Pre-compute explorer metadata
    buildTimezoneMeta();

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
