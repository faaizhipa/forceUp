/**
 * Timezone Popup Widget Module
 * Wraps GlobalSyncWidget functionality into a popup modal
 * triggered from the PersistentBanner timezone field
 * 
 * @module TimezonePopupWidget
 * @requires TimezoneUtils
 * @requires UserPreferences
 */

const TimezonePopupWidget = (function() {
  'use strict';

  // ============================================================================
  // Constants
  // ============================================================================

  const POPUP_ID = 'exl-timezone-popup';
  const OVERLAY_ID = 'exl-timezone-popup-overlay';
  const CONTAINER_ID = 'exl-timezone-popup-container';
  const WIDGET_CONTAINER_ID = 'exl-timezone-widget-container';
  const UPDATE_INTERVAL_MS = 1000;
  const DRAG_STEP_MINUTES = 10;

  const DEFAULT_AWAKE_START = 7;
  const DEFAULT_AWAKE_END = 23;
  const DEFAULT_BUSINESS_START = 9;
  const DEFAULT_BUSINESS_END = 17;

  const STATUS_COLORS = {
    business: '#22c55e', // Green
    awake: '#eab308',    // Yellow
    sleep: '#6b7280'     // Gray
  };

  // ============================================================================
  // State
  // ============================================================================

  let _state = {
    isInitialized: false,
    isVisible: false,
    container: null,
    overlay: null,
    popup: null,
    config: {
      localTimezone: null,
      customerTimezone: null,
      favoriteTimezones: []
    },
    currentTime: new Date(),
    simulationTime: null,
    activeTab: 'converter',
    meetingStart: null,
    meetingEnd: null,
    intervalId: null,
    cleanupHandlers: []
  };

  // ============================================================================
  // Timezone Utility Functions (Embedded)
  // ============================================================================

  /**
   * Pads a number with leading zeros
   */
  function _padZero(num, size = 2) {
    return num.toString().padStart(size, '0');
  }

  /**
   * Gets the day of week name
   */
  function _getDayName(dayIndex, short = false) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return short ? shortDays[dayIndex] : days[dayIndex];
  }

  /**
   * Gets the month name
   */
  function _getMonthName(monthIndex, short = false) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return short ? shortMonths[monthIndex] : months[monthIndex];
  }

  /**
   * Gets the browser's current timezone
   */
  function getBrowserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.error('[TimezonePopupWidget] Failed to get browser timezone:', error);
      return 'UTC';
    }
  }

  /**
   * Gets the timezone abbreviation (e.g., "EST", "PST")
   */
  function getTimezoneAbbreviation(date, timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(date);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart?.value || '';
    } catch (error) {
      console.warn('[TimezonePopupWidget] Failed to get timezone abbreviation:', error);
      return '';
    }
  }

  /**
   * Gets the timezone offset string (e.g., "UTC-05:00")
   */
  function getTimezoneOffset(date, timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
      });
      const parts = formatter.formatToParts(date);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart?.value?.replace('GMT', 'UTC') || 'UTC';
    } catch (error) {
      console.warn('[TimezonePopupWidget] Failed to get timezone offset:', error);
      return 'UTC';
    }
  }

  /**
   * Gets the hour in a specific timezone
   */
  function getHourInTimezone(date, timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
      });
      const hourStr = formatter.format(date);
      return parseInt(hourStr, 10) % 24;
    } catch (error) {
      console.error('[TimezonePopupWidget] Failed to get hour in timezone:', error);
      return 0;
    }
  }

  /**
   * Gets the time components in a specific timezone
   */
  function getTimeComponents(date, timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        weekday: 'short'
      });
      
      const parts = formatter.formatToParts(date);
      const get = (type) => parts.find(p => p.type === type)?.value || '0';
      
      return {
        year: parseInt(get('year'), 10),
        month: parseInt(get('month'), 10) - 1,
        day: parseInt(get('day'), 10),
        hour: parseInt(get('hour'), 10) % 24,
        minute: parseInt(get('minute'), 10),
        second: parseInt(get('second'), 10),
        dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
      };
    } catch (error) {
      console.error('[TimezonePopupWidget] Failed to get time components:', error);
      return { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, dayOfWeek: 0 };
    }
  }

  /**
   * Formats a date in a specific timezone
   */
  function formatInTimeZone(date, timezone, formatStr = 'HH:mm') {
    try {
      const components = getTimeComponents(date, timezone);
      const { year, month, day, hour, minute, second, dayOfWeek } = components;
      
      let result = formatStr;
      
      // Year
      result = result.replace('yyyy', year.toString());
      result = result.replace('yy', (year % 100).toString().padStart(2, '0'));
      
      // Month
      result = result.replace('MMMM', _getMonthName(month));
      result = result.replace('MMM', _getMonthName(month, true));
      result = result.replace('MM', _padZero(month + 1));
      
      // Day
      result = result.replace('dd', _padZero(day));
      
      // Day of week
      result = result.replace('EEEE', _getDayName(dayOfWeek));
      result = result.replace('EEE', _getDayName(dayOfWeek, true));
      
      // Hour (24-hour)
      result = result.replace('HH', _padZero(hour));
      
      // Hour (12-hour)
      const hour12 = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
      result = result.replace('hh', _padZero(hour12));
      result = result.replace(/(?<!h)h(?!h)/, hour12.toString());
      
      // AM/PM
      result = result.replace('a', hour < 12 ? 'AM' : 'PM');
      
      // Minutes
      result = result.replace('mm', _padZero(minute));
      
      // Seconds
      result = result.replace('ss', _padZero(second));
      
      return result;
    } catch (error) {
      console.error('[TimezonePopupWidget] Failed to format date:', error);
      return '';
    }
  }

  /**
   * Formats time for display (HH:mm)
   */
  function formatTimeForDisplay(date, timezone) {
    return formatInTimeZone(date, timezone, 'HH:mm');
  }

  /**
   * Formats date for display (EEE, MMM d)
   */
  function formatDateForDisplay(date, timezone) {
    return formatInTimeZone(date, timezone, 'EEE, MMM d');
  }

  /**
   * Gets the status type based on hour
   */
  function getTimeStatus(hour, awakeStart = DEFAULT_AWAKE_START, awakeEnd = DEFAULT_AWAKE_END, 
                         businessStart = DEFAULT_BUSINESS_START, businessEnd = DEFAULT_BUSINESS_END) {
    if (hour >= businessStart && hour < businessEnd) {
      return 'business';
    }
    if ((hour >= awakeStart && hour < businessStart) || (hour >= businessEnd && hour <= awakeEnd)) {
      return 'awake';
    }
    return 'sleep';
  }

  /**
   * Converts time to a target timezone
   */
  function convertTime(sourceDate, targetTimezone, config = {}) {
    const hour = getHourInTimezone(sourceDate, targetTimezone);
    const status = getTimeStatus(
      hour,
      config.awakeStart,
      config.awakeEnd,
      config.businessStart,
      config.businessEnd
    );

    return {
      timezone: targetTimezone,
      date: sourceDate,
      formatted: formatTimeForDisplay(sourceDate, targetTimezone),
      hour,
      status
    };
  }

  // ============================================================================
  // Private Helper Functions
  // ============================================================================

  /**
   * Gets all zones to display
   */
  function _getZones() {
    if (!_state.config) return [];

    const zones = [];
    
    // Add local timezone (user's timezone)
    if (_state.config.localTimezone) {
      zones.push({ 
        id: 'local',
        timezone: _state.config.localTimezone, 
        label: 'My Location',
        isLocal: true 
      });
    }

    // Add customer timezone
    if (_state.config.customerTimezone) {
      zones.push({ 
        id: 'customer',
        timezone: _state.config.customerTimezone, 
        label: 'Customer',
        isCustomer: true 
      });
    }

    // Add favorites (deduplicated)
    const seen = new Set([_state.config.localTimezone, _state.config.customerTimezone].filter(Boolean));
    
    if (_state.config.favoriteTimezones && Array.isArray(_state.config.favoriteTimezones)) {
      _state.config.favoriteTimezones.forEach((tz, index) => {
        if (tz && !seen.has(tz)) {
          seen.add(tz);
          zones.push({
            id: `fav-${index}`,
            timezone: tz,
            label: tz.split('/').pop()?.replace(/_/g, ' ') || tz
          });
        }
      });
    }

    return zones;
  }

  /**
   * Creates a status dot element
   */
  function _createStatusDot(status) {
    const dot = document.createElement('div');
    dot.className = `gsw-status-dot gsw-status-${status}`;
    return dot;
  }

  /**
   * Renders a timezone row
   */
  function _renderTimezoneRow(zone) {
    const time = _state.simulationTime || _state.currentTime;
    const conversion = convertTime(time, zone.timezone);
    
    const row = document.createElement('div');
    row.className = 'gsw-timezone-row';
    row.dataset.timezone = zone.timezone;

    // Status dot
    row.appendChild(_createStatusDot(conversion.status));

    // Timezone info
    const info = document.createElement('div');
    info.className = 'gsw-timezone-info';
    
    const name = document.createElement('div');
    name.className = 'gsw-timezone-name';
    name.textContent = zone.label;
    info.appendChild(name);

    const label = document.createElement('div');
    label.className = 'gsw-timezone-label';
    const abbr = getTimezoneAbbreviation(time, zone.timezone);
    const offset = getTimezoneOffset(time, zone.timezone);
    label.textContent = `${zone.timezone} • ${abbr || offset}`;
    info.appendChild(label);

    row.appendChild(info);

    // Time display
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'gsw-time-display';

    const timeEl = document.createElement('div');
    timeEl.className = 'gsw-time';
    timeEl.textContent = formatTimeForDisplay(time, zone.timezone);
    timeDisplay.appendChild(timeEl);

    const dateEl = document.createElement('div');
    dateEl.className = 'gsw-date';
    dateEl.textContent = formatDateForDisplay(time, zone.timezone);
    timeDisplay.appendChild(dateEl);

    row.appendChild(timeDisplay);

    return row;
  }

  /**
   * Renders the hour grid for a timezone
   */
  function _renderHourGrid(zone) {
    const time = _state.simulationTime || _state.currentTime;
    const currentHour = getHourInTimezone(time, zone.timezone);
    
    const grid = document.createElement('div');
    grid.className = 'gsw-hour-grid';
    grid.dataset.timezone = zone.timezone;

    for (let hour = 0; hour < 24; hour++) {
      const status = getTimeStatus(hour);
      const block = document.createElement('div');
      block.className = `gsw-hour-block gsw-status-${status}`;
      if (hour === currentHour) {
        block.classList.add('current');
      }
      block.textContent = hour.toString().padStart(2, '0');
      block.dataset.hour = hour;

      grid.appendChild(block);
    }

    return grid;
  }

  /**
   * Renders the tab content
   */
  function _renderContent() {
    const content = document.createElement('div');
    content.className = 'gsw-content';

    const zones = _getZones();

    if (zones.length === 0) {
      const noData = document.createElement('div');
      noData.className = 'gsw-no-data';
      noData.textContent = 'No timezone data available. Customer timezone not detected.';
      content.appendChild(noData);
      return content;
    }

    if (_state.activeTab === 'converter') {
      // Time Converter view
      zones.forEach(zone => {
        content.appendChild(_renderTimezoneRow(zone));
      });
    } else {
      // Scheduler view with hour grids
      zones.forEach(zone => {
        const row = _renderTimezoneRow(zone);
        row.appendChild(_renderHourGrid(zone));
        content.appendChild(row);
      });
    }

    return content;
  }

  /**
   * Renders the widget
   */
  function _render() {
    if (!_state.container) return;

    _state.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'gsw-header';

    const title = document.createElement('div');
    title.className = 'gsw-title';
    title.textContent = 'Time Zones';
    header.appendChild(title);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'gsw-tabs';

    const converterTab = document.createElement('button');
    converterTab.className = `gsw-tab ${_state.activeTab === 'converter' ? 'active' : ''}`;
    converterTab.textContent = 'Converter';
    converterTab.addEventListener('click', () => {
      _state.activeTab = 'converter';
      _render();
    });
    tabs.appendChild(converterTab);

    const schedulerTab = document.createElement('button');
    schedulerTab.className = `gsw-tab ${_state.activeTab === 'scheduler' ? 'active' : ''}`;
    schedulerTab.textContent = 'Scheduler';
    schedulerTab.addEventListener('click', () => {
      _state.activeTab = 'scheduler';
      _render();
    });
    tabs.appendChild(schedulerTab);

    header.appendChild(tabs);
    _state.container.appendChild(header);

    // Content
    _state.container.appendChild(_renderContent());
  }

  /**
   * Updates the current time
   */
  function _updateTime() {
    _state.currentTime = new Date();
    if (!_state.simulationTime && _state.isVisible) {
      _render();
    }
  }

  /**
   * Creates the popup overlay and container
   */
  function _createPopup() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'exl-timezone-popup-overlay';
    
    // Create popup container
    const popup = document.createElement('div');
    popup.id = POPUP_ID;
    popup.className = 'exl-timezone-popup';
    
    // Create header with close button
    const popupHeader = document.createElement('div');
    popupHeader.className = 'exl-timezone-popup-header';
    
    const popupTitle = document.createElement('h3');
    popupTitle.className = 'exl-timezone-popup-title';
    popupTitle.textContent = 'Timezone Comparison';
    popupHeader.appendChild(popupTitle);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'exl-timezone-popup-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close (Esc)';
    closeBtn.addEventListener('click', hide);
    popupHeader.appendChild(closeBtn);
    
    popup.appendChild(popupHeader);
    
    // Create widget container
    const widgetContainer = document.createElement('div');
    widgetContainer.id = WIDGET_CONTAINER_ID;
    widgetContainer.className = 'gsw-container';
    popup.appendChild(widgetContainer);
    
    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
    
    // Store references
    _state.overlay = overlay;
    _state.popup = popup;
    _state.container = widgetContainer;
    
    // Event handlers
    overlay.addEventListener('click', hide);
    
    // Keyboard handler for Escape
    const keyHandler = (e) => {
      if (e.key === 'Escape' && _state.isVisible) {
        hide();
      }
    };
    document.addEventListener('keydown', keyHandler);
    _state.cleanupHandlers.push(() => document.removeEventListener('keydown', keyHandler));
    
    // Prevent popup clicks from closing
    popup.addEventListener('click', (e) => e.stopPropagation());
  }

  /**
   * Injects widget styles
   */
  function _injectStyles() {
    if (document.getElementById('exl-timezone-popup-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'exl-timezone-popup-styles';
    styles.textContent = `
      /* Timezone Popup Overlay */
      .exl-timezone-popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 10000;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease, visibility 0.2s ease;
      }
      
      .exl-timezone-popup-overlay.visible {
        opacity: 1;
        visibility: visible;
      }
      
      /* Timezone Popup Container */
      .exl-timezone-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        width: 30vw;
        min-width: 400px;
        max-width: 600px;
        max-height: 80vh;
        background: #1a1a2e;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        z-index: 10001;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .exl-timezone-popup.visible {
        opacity: 1;
        visibility: visible;
        transform: translate(-50%, -50%) scale(1);
      }
      
      /* Popup Header */
      .exl-timezone-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #2d2d44;
        flex-shrink: 0;
      }
      
      .exl-timezone-popup-title {
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        margin: 0;
      }
      
      .exl-timezone-popup-close {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        color: #888;
        font-size: 24px;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s, color 0.2s;
      }
      
      .exl-timezone-popup-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
      
      /* Widget Container Styles */
      .exl-timezone-popup .gsw-container {
        padding: 16px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }

      .gsw-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #2d2d44;
      }

      .gsw-title {
        font-size: 14px;
        font-weight: 600;
        color: #fff;
      }

      .gsw-tabs {
        display: flex;
        gap: 4px;
        background: #2d2d44;
        padding: 4px;
        border-radius: 8px;
      }

      .gsw-tab {
        padding: 6px 12px;
        font-size: 12px;
        border: none;
        background: transparent;
        color: #a0a0a0;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
      }

      .gsw-tab:hover {
        color: #fff;
      }

      .gsw-tab.active {
        background: #4a4a6a;
        color: #fff;
      }

      .gsw-timezone-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        padding: 10px 0;
        border-bottom: 1px solid #2d2d44;
      }

      .gsw-timezone-row:last-child {
        border-bottom: none;
      }

      .gsw-status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-right: 10px;
        flex-shrink: 0;
      }

      .gsw-status-business { background: #22c55e; }
      .gsw-status-awake { background: #eab308; }
      .gsw-status-sleep { background: #6b7280; }

      .gsw-timezone-info {
        flex: 1;
        min-width: 0;
      }

      .gsw-timezone-name {
        font-size: 13px;
        font-weight: 500;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .gsw-timezone-label {
        font-size: 11px;
        color: #888;
        margin-top: 2px;
      }

      .gsw-time-display {
        text-align: right;
        min-width: 100px;
      }

      .gsw-time {
        font-size: 18px;
        font-weight: 600;
        font-family: 'SF Mono', Monaco, monospace;
        color: #fff;
      }

      .gsw-date {
        font-size: 11px;
        color: #888;
        margin-top: 2px;
      }

      .gsw-hour-grid {
        display: grid;
        grid-template-columns: repeat(24, 1fr);
        gap: 1px;
        margin-top: 8px;
        border-radius: 4px;
        overflow: hidden;
        width: 100%;
      }

      .gsw-hour-block {
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        color: rgba(255, 255, 255, 0.7);
        cursor: default;
        transition: opacity 0.2s;
      }

      .gsw-hour-block:hover {
        opacity: 0.8;
      }

      .gsw-hour-block.gsw-status-business { background: rgba(34, 197, 94, 0.4); }
      .gsw-hour-block.gsw-status-awake { background: rgba(234, 179, 8, 0.3); }
      .gsw-hour-block.gsw-status-sleep { background: rgba(107, 114, 128, 0.3); }

      .gsw-hour-block.current {
        border: 2px solid #fff;
        font-weight: bold;
      }

      .gsw-content {
        color: #e0e0e0;
      }

      .gsw-no-data {
        padding: 20px;
        text-align: center;
        color: #888;
        font-style: italic;
      }
      
      /* Clickable timezone field in banner */
      #exl-banner-timezone-item {
        cursor: pointer;
        transition: background-color 0.2s ease;
        border-radius: 4px;
        padding: 2px 4px;
        margin: -2px -4px;
      }
      
      #exl-banner-timezone-item:hover {
        background-color: rgba(255, 255, 255, 0.15);
      }
      
      #exl-banner-timezone-item:hover #exl-banner-timezone {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * Gets local timezone from UserPreferences or browser
   */
  async function _getLocalTimezone() {
    try {
      if (typeof UserPreferences !== 'undefined') {
        const prefs = await UserPreferences.get();
        if (prefs && prefs.userTimezone) {
          if (!prefs.userTimezone.auto && prefs.userTimezone.manual) {
            return prefs.userTimezone.manual;
          }
          if (prefs.userTimezone.detected) {
            return prefs.userTimezone.detected;
          }
        }
      }
    } catch (error) {
      console.warn('[TimezonePopupWidget] Error getting user preferences:', error);
    }
    return getBrowserTimezone();
  }

  /**
   * Gets favorite timezones from UserPreferences or SettingsManager
   */
  async function _getFavoriteTimezones() {
    try {
      // Try UserPreferences first
      if (typeof UserPreferences !== 'undefined') {
        const prefs = await UserPreferences.get();
        if (prefs && prefs.favoriteTimezones && Array.isArray(prefs.favoriteTimezones)) {
          return prefs.favoriteTimezones;
        }
      }
      
      // Try SettingsManager as fallback
      if (typeof SettingsManager !== 'undefined') {
        const settings = SettingsManager.get();
        if (settings && settings.exlibris && settings.exlibris.favoriteTimezones) {
          return settings.exlibris.favoriteTimezones;
        }
      }
    } catch (error) {
      console.warn('[TimezonePopupWidget] Error getting favorite timezones:', error);
    }
    return [];
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Initializes the popup widget (creates DOM but doesn't show)
   */
  async function init() {
    if (_state.isInitialized) {
      console.log('[TimezonePopupWidget] Already initialized');
      return true;
    }

    try {
      _injectStyles();
      _createPopup();
      
      // Get local timezone
      _state.config.localTimezone = await _getLocalTimezone();
      
      // Get favorites
      _state.config.favoriteTimezones = await _getFavoriteTimezones();
      
      _state.isInitialized = true;
      console.log('[TimezonePopupWidget] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[TimezonePopupWidget] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Shows the popup with the specified customer timezone
   * @param {string} customerTimezone - The customer's IANA timezone identifier
   */
  async function show(customerTimezone) {
    if (!_state.isInitialized) {
      await init();
    }

    // Update customer timezone
    _state.config.customerTimezone = customerTimezone;
    
    // Refresh local timezone and favorites in case they changed
    _state.config.localTimezone = await _getLocalTimezone();
    _state.config.favoriteTimezones = await _getFavoriteTimezones();

    // Reset to converter tab
    _state.activeTab = 'converter';
    _state.currentTime = new Date();

    // Render widget
    _render();

    // Show popup
    _state.overlay.classList.add('visible');
    _state.popup.classList.add('visible');
    _state.isVisible = true;

    // Start time updates
    if (_state.intervalId) {
      clearInterval(_state.intervalId);
    }
    _state.intervalId = setInterval(_updateTime, UPDATE_INTERVAL_MS);

    console.log('[TimezonePopupWidget] Showing popup with customer timezone:', customerTimezone);
  }

  /**
   * Hides the popup
   */
  function hide() {
    if (!_state.isVisible) return;

    _state.overlay.classList.remove('visible');
    _state.popup.classList.remove('visible');
    _state.isVisible = false;

    // Stop time updates
    if (_state.intervalId) {
      clearInterval(_state.intervalId);
      _state.intervalId = null;
    }

    console.log('[TimezonePopupWidget] Popup hidden');
  }

  /**
   * Toggles the popup visibility
   * @param {string} customerTimezone - The customer's IANA timezone identifier
   */
  async function toggle(customerTimezone) {
    if (_state.isVisible) {
      hide();
    } else {
      await show(customerTimezone);
    }
  }

  /**
   * Updates the configuration
   * @param {Object} config - Configuration updates
   */
  function updateConfig(config) {
    if (config.localTimezone) {
      _state.config.localTimezone = config.localTimezone;
    }
    if (config.customerTimezone) {
      _state.config.customerTimezone = config.customerTimezone;
    }
    if (config.favoriteTimezones) {
      _state.config.favoriteTimezones = config.favoriteTimezones;
    }

    if (_state.isVisible) {
      _render();
    }
  }

  /**
   * Destroys the popup widget and cleans up
   */
  function destroy() {
    hide();

    // Clean up event handlers
    _state.cleanupHandlers.forEach(fn => fn());
    _state.cleanupHandlers = [];

    // Remove DOM elements
    if (_state.overlay) {
      _state.overlay.remove();
      _state.overlay = null;
    }
    if (_state.popup) {
      _state.popup.remove();
      _state.popup = null;
    }
    _state.container = null;

    // Remove styles
    const styles = document.getElementById('exl-timezone-popup-styles');
    if (styles) {
      styles.remove();
    }

    _state.isInitialized = false;
    console.log('[TimezonePopupWidget] Destroyed');
  }

  /**
   * Checks if the popup is currently visible
   * @returns {boolean}
   */
  function isVisible() {
    return _state.isVisible;
  }

  /**
   * Gets the current state (for debugging)
   * @returns {Object}
   */
  function getState() {
    return { ..._state };
  }

  // ============================================================================
  // Module Export
  // ============================================================================

  return {
    init,
    show,
    hide,
    toggle,
    updateConfig,
    destroy,
    isVisible,
    getState
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezonePopupWidget;
}
