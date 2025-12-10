/**
 * Global Sync Widget Module
 * Main timezone widget component for Chrome Extension MV3
 * 
 * @module GlobalSyncWidget
 * @requires TimezoneUtils
 * 
 * @param {Object} config - Widget configuration
 * @param {string} config.localTimezone - User's local timezone (IANA identifier)
 * @param {string} config.customerTimezone - Customer/target timezone (IANA identifier)
 * @param {string[]} [config.favoriteTimezones] - Optional array of additional timezone identifiers
 */

const GlobalSyncWidget = (() => {
  'use strict';

  // ============================================================================
  // Constants
  // ============================================================================

  const WIDGET_ID = 'global-sync-widget';
  const UPDATE_INTERVAL_MS = 1000;
  const DRAG_STEP_MINUTES = 10;
  const MIN_DURATION_MINUTES = 30;

  const STYLES = `
    :root {
      color-scheme: light dark;
      --gsw-font-sans: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --gsw-font-mono: 'IBM Plex Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      --gsw-radius-sm: 6px;
      --gsw-radius-md: 10px;
      --gsw-radius-lg: 14px;
      --gsw-shadow: 0 15px 40px rgba(15, 23, 42, 0.35);
      --gsw-ring: 0 0 0 2px rgba(99, 102, 241, 0.45);

      --gsw-bg: #0f172a;
      --gsw-bg-muted: #18223b;
      --gsw-bg-elevated: #1c2540;
      --gsw-card: #1f2a44;
      --gsw-border: rgba(255, 255, 255, 0.08);
      --gsw-foreground: #f8fafc;
      --gsw-foreground-muted: #cbd5f5;
      --gsw-accent: #6366f1;
      --gsw-accent-strong: #8b5cf6;
      --gsw-success: #22c55e;
      --gsw-warning: #facc15;
      --gsw-neutral: #94a3b8;
    }

    :root[data-theme='light'] {
      --gsw-bg: #f8fafc;
      --gsw-bg-muted: #eef2ff;
      --gsw-bg-elevated: #ffffff;
      --gsw-card: #ffffff;
      --gsw-border: rgba(15, 23, 42, 0.08);
      --gsw-foreground: #0f172a;
      --gsw-foreground-muted: #475569;
      --gsw-accent: #4f46e5;
      --gsw-accent-strong: #7c3aed;
      --gsw-shadow: 0 20px 45px rgba(15, 23, 42, 0.15);
    }

    .gsw-container {
      font-family: var(--gsw-font-sans);
      background: var(--gsw-card);
      color: var(--gsw-foreground);
      border-radius: var(--gsw-radius-lg);
      padding: 16px;
      box-shadow: var(--gsw-shadow);
      min-width: 320px;
      max-width: 640px;
      border: 1px solid var(--gsw-border);
    }

    .gsw-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--gsw-border);
    }

    .gsw-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--gsw-foreground);
      letter-spacing: 0.02em;
    }

    .gsw-tabs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px;
      background: var(--gsw-bg-muted);
      padding: 4px;
      border-radius: var(--gsw-radius-md);
    }

    .gsw-tab {
      padding: 8px 12px;
      font-size: 12px;
      border: none;
      background: transparent;
      color: var(--gsw-foreground-muted);
      cursor: pointer;
      border-radius: var(--gsw-radius-sm);
      transition: all 0.2s ease;
      font-weight: 600;
    }

    .gsw-tab:hover {
      color: var(--gsw-foreground);
    }

    .gsw-tab.active {
      background: var(--gsw-card);
      color: var(--gsw-foreground);
      box-shadow: inset 0 0 0 1px var(--gsw-border);
    }

    .gsw-timezone-row {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--gsw-border);
      gap: 12px;
    }

    .gsw-timezone-row:last-child {
      border-bottom: none;
    }

    .gsw-status-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      flex-shrink: 0;
    }

    .gsw-status-business { background: var(--gsw-success); }
    .gsw-status-awake { background: var(--gsw-warning); }
    .gsw-status-sleep { background: var(--gsw-neutral); }

    .gsw-timezone-info {
      flex: 1;
      min-width: 0;
    }

    .gsw-timezone-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--gsw-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .gsw-timezone-label {
      font-size: 11px;
      color: var(--gsw-foreground-muted);
      margin-top: 2px;
    }

    .gsw-time-display {
      text-align: right;
      min-width: 110px;
    }

    .gsw-time {
      font-size: 18px;
      font-weight: 700;
      font-family: var(--gsw-font-mono);
      color: var(--gsw-foreground);
    }

    .gsw-date {
      font-size: 11px;
      color: var(--gsw-foreground-muted);
      margin-top: 2px;
    }

    .gsw-hour-grid {
      display: grid;
      grid-template-columns: repeat(24, 1fr);
      gap: 1px;
      margin-top: 8px;
      border-radius: 6px;
      overflow: hidden;
      background: var(--gsw-bg-muted);
      border: 1px solid var(--gsw-border);
    }

    .gsw-hour-block {
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      cursor: pointer;
      transition: opacity 0.2s ease, transform 0.1s ease;
      color: var(--gsw-foreground);
    }

    .gsw-hour-block:hover {
      opacity: 0.85;
      transform: translateY(-1px);
    }

    .gsw-hour-block.gsw-status-business { background: rgba(34, 197, 94, 0.25); }
    .gsw-hour-block.gsw-status-awake { background: rgba(250, 204, 21, 0.22); }
    .gsw-hour-block.gsw-status-sleep { background: rgba(148, 163, 184, 0.2); }

    .gsw-hour-block.current {
      box-shadow: inset 0 0 0 2px var(--gsw-accent);
      color: var(--gsw-accent-strong);
      font-weight: 700;
    }

    .gsw-meeting-block {
      position: absolute;
      height: 100%;
      background: rgba(99, 102, 241, 0.55);
      border: 2px solid var(--gsw-accent);
      border-radius: 4px;
      cursor: move;
    }

    .gsw-meeting-handle {
      position: absolute;
      width: 8px;
      height: 100%;
      cursor: ew-resize;
      background: rgba(255, 255, 255, 0.35);
    }

    .gsw-meeting-handle.left { left: 0; border-radius: 4px 0 0 4px; }
    .gsw-meeting-handle.right { right: 0; border-radius: 0 4px 4px 0; }

    .gsw-scheduler-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .gsw-duration {
      font-size: 12px;
      color: var(--gsw-foreground-muted);
    }

    .gsw-copy-btn {
      padding: 6px 12px;
      font-size: 11px;
      border: 1px solid var(--gsw-border);
      background: transparent;
      color: var(--gsw-foreground);
      cursor: pointer;
      border-radius: var(--gsw-radius-sm);
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }

    .gsw-copy-btn:hover {
      background: var(--gsw-bg-muted);
      color: var(--gsw-foreground);
    }

    .gsw-copy-btn svg {
      width: 14px;
      height: 14px;
    }
  `;

  // ============================================================================
  // State
  // ============================================================================

  let _state = {
    isInitialized: false,
    container: null,
    config: null,
    currentTime: new Date(),
    simulationTime: null,
    activeTab: 'converter',
    meetingStart: null,
    meetingEnd: null,
    intervalId: null
  };

  // ============================================================================
  // Private Helper Functions
  // ============================================================================

  /**
   * Validates the widget configuration
   * @param {Object} config - Configuration object
   * @returns {boolean} Whether config is valid
   */
  function _validateConfig(config) {
    if (!config) {
      console.error('[GlobalSyncWidget] Config is required');
      return false;
    }

    if (!config.localTimezone || typeof config.localTimezone !== 'string') {
      console.error('[GlobalSyncWidget] localTimezone is required and must be a string');
      return false;
    }

    if (!config.customerTimezone || typeof config.customerTimezone !== 'string') {
      console.error('[GlobalSyncWidget] customerTimezone is required and must be a string');
      return false;
    }

    if (config.favoriteTimezones && !Array.isArray(config.favoriteTimezones)) {
      console.error('[GlobalSyncWidget] favoriteTimezones must be an array');
      return false;
    }

    return true;
  }

  /**
   * Gets all zones to display
   * @returns {Array} Zone objects
   */
  function _getZones() {
    if (!_state.config) return [];

    const zones = [
      { 
        id: 'local',
        timezone: _state.config.localTimezone, 
        label: 'My Location',
        isLocal: true 
      },
      { 
        id: 'customer',
        timezone: _state.config.customerTimezone, 
        label: 'Customer',
        isCustomer: true 
      }
    ];

    // Add favorites (deduplicated)
    const seen = new Set([_state.config.localTimezone, _state.config.customerTimezone]);
    
    if (_state.config.favoriteTimezones) {
      _state.config.favoriteTimezones.forEach((tz, index) => {
        if (!seen.has(tz)) {
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
   * Injects widget styles
   */
  function _injectStyles() {
    if (document.getElementById('gsw-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'gsw-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  /**
   * Creates a status dot element
   * @param {'business'|'awake'|'sleep'} status - Status type
   * @returns {HTMLElement} Status dot element
   */
  function _createStatusDot(status) {
    const dot = document.createElement('div');
    dot.className = `gsw-status-dot gsw-status-${status}`;
    return dot;
  }

  /**
   * Renders a timezone row
   * @param {Object} zone - Zone object
   * @returns {HTMLElement} Row element
   */
  function _renderTimezoneRow(zone) {
    if (typeof TimezoneUtils === 'undefined') {
      console.error('[GlobalSyncWidget] TimezoneUtils is not loaded');
      return document.createElement('div');
    }

    const time = _state.simulationTime || _state.currentTime;
    const conversion = TimezoneUtils.convertTime(time, zone.timezone);
    
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
    const abbr = TimezoneUtils.getTimezoneAbbreviation(time, zone.timezone);
    const offset = TimezoneUtils.getTimezoneOffset(time, zone.timezone);
    label.textContent = `${zone.timezone} • ${abbr || offset}`;
    info.appendChild(label);

    row.appendChild(info);

    // Time display
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'gsw-time-display';

    const timeEl = document.createElement('div');
    timeEl.className = 'gsw-time';
    timeEl.textContent = TimezoneUtils.formatTimeForDisplay(time, zone.timezone);
    timeDisplay.appendChild(timeEl);

    const dateEl = document.createElement('div');
    dateEl.className = 'gsw-date';
    dateEl.textContent = TimezoneUtils.formatDateForDisplay(time, zone.timezone);
    timeDisplay.appendChild(dateEl);

    row.appendChild(timeDisplay);

    return row;
  }

  /**
   * Renders the hour grid for a timezone
   * @param {Object} zone - Zone object
   * @returns {HTMLElement} Grid element
   */
  function _renderHourGrid(zone) {
    if (typeof TimezoneUtils === 'undefined') {
      return document.createElement('div');
    }

    const time = _state.simulationTime || _state.currentTime;
    const currentHour = TimezoneUtils.getHourInTimezone(time, zone.timezone);
    
    const grid = document.createElement('div');
    grid.className = 'gsw-hour-grid';
    grid.dataset.timezone = zone.timezone;

    for (let hour = 0; hour < 24; hour++) {
      const status = TimezoneUtils.getTimeStatus(hour);
      const block = document.createElement('div');
      block.className = `gsw-hour-block gsw-status-${status}`;
      if (hour === currentHour) {
        block.classList.add('current');
      }
      block.textContent = hour.toString().padStart(2, '0');
      block.dataset.hour = hour;
      
      block.addEventListener('click', () => {
        _handleHourClick(zone.timezone, hour);
      });

      grid.appendChild(block);
    }

    return grid;
  }

  /**
   * Handles hour click for scheduling
   * @param {string} timezone - Timezone identifier
   * @param {number} hour - Hour clicked
   */
  function _handleHourClick(timezone, hour) {
    if (typeof TimezoneUtils === 'undefined') return;

    // Create a date at the clicked hour in the timezone
    const now = _state.simulationTime || _state.currentTime;
    const components = TimezoneUtils.getTimeComponents(now, timezone);
    
    const newStart = TimezoneUtils.createDateInTimezone(
      timezone,
      components.year,
      components.month,
      components.day,
      hour,
      0
    );

    _state.meetingStart = newStart;
    _state.meetingEnd = new Date(newStart.getTime() + 60 * 60 * 1000); // 1 hour default

    _render();
  }

  /**
   * Renders the tab content
   * @returns {HTMLElement} Content element
   */
  function _renderContent() {
    const content = document.createElement('div');
    content.className = 'gsw-content';

    const zones = _getZones();

    if (_state.activeTab === 'converter') {
      // Time Converter view
      zones.forEach(zone => {
        content.appendChild(_renderTimezoneRow(zone));
      });
    } else {
      // Meeting Scheduler view
      const header = document.createElement('div');
      header.className = 'gsw-scheduler-header';

      if (_state.meetingStart && _state.meetingEnd) {
        const duration = (_state.meetingEnd - _state.meetingStart) / 60000;
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        
        const durationEl = document.createElement('div');
        durationEl.className = 'gsw-duration';
        durationEl.textContent = `Duration: ${hours > 0 ? hours + 'h ' : ''}${mins > 0 ? mins + 'm' : ''}`;
        header.appendChild(durationEl);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'gsw-copy-btn';
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        copyBtn.addEventListener('click', _handleCopy);
        header.appendChild(copyBtn);
      }

      content.appendChild(header);

      zones.forEach(zone => {
        const row = _renderTimezoneRow(zone);
        row.appendChild(_renderHourGrid(zone));
        content.appendChild(row);
      });
    }

    return content;
  }

  /**
   * Handles copy action
   */
  function _handleCopy() {
    if (!_state.meetingStart || typeof TimezoneUtils === 'undefined') return;

    const zones = _getZones();
    const lines = zones.map(zone => {
      const time = TimezoneUtils.formatInTimeZone(_state.meetingStart, zone.timezone, 'h:mm a');
      const date = TimezoneUtils.formatInTimeZone(_state.meetingStart, zone.timezone, 'EEE, MMM d');
      const abbr = TimezoneUtils.getTimezoneAbbreviation(_state.meetingStart, zone.timezone);
      return `${zone.label}: ${time} ${abbr} (${date})`;
    });

    const text = lines.join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      // Show feedback
      const copyBtn = _state.container.querySelector('.gsw-copy-btn');
      if (copyBtn) {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
      }
    }).catch(err => {
      console.error('[GlobalSyncWidget] Failed to copy:', err);
    });
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
    if (!_state.simulationTime) {
      _render();
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Initializes the widget
   * @param {HTMLElement|string} targetElement - Container element or selector
   * @param {Object} config - Widget configuration
   * @param {string} config.localTimezone - User's local timezone
   * @param {string} config.customerTimezone - Customer timezone
   * @param {string[]} [config.favoriteTimezones] - Optional favorite timezones
   * @returns {boolean} Success status
   */
  function init(targetElement, config) {
    // Check dependencies
    if (typeof TimezoneUtils === 'undefined') {
      console.error('[GlobalSyncWidget] TimezoneUtils module is required but not loaded');
      return false;
    }

    // Validate config
    if (!_validateConfig(config)) {
      return false;
    }

    // Get container
    const container = typeof targetElement === 'string' 
      ? document.querySelector(targetElement) 
      : targetElement;

    if (!container) {
      console.error('[GlobalSyncWidget] Target element not found');
      return false;
    }

    // Store state
    _state.container = container;
    _state.config = {
      localTimezone: config.localTimezone,
      customerTimezone: config.customerTimezone,
      favoriteTimezones: config.favoriteTimezones || []
    };
    _state.currentTime = new Date();

    // Initialize meeting times
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    _state.meetingStart = now;
    _state.meetingEnd = new Date(now.getTime() + 60 * 60 * 1000);

    // Setup container
    container.id = WIDGET_ID;
    container.className = 'gsw-container';

    // Inject styles
    _injectStyles();

    // Initial render
    _render();

    // Start time updates
    if (_state.intervalId) {
      clearInterval(_state.intervalId);
    }
    _state.intervalId = setInterval(_updateTime, UPDATE_INTERVAL_MS);

    _state.isInitialized = true;
    console.log('[GlobalSyncWidget] Initialized successfully');
    
    return true;
  }

  /**
   * Updates the widget configuration
   * @param {Object} config - New configuration
   */
  function updateConfig(config) {
    if (!_state.isInitialized) {
      console.error('[GlobalSyncWidget] Widget not initialized');
      return;
    }

    if (config.localTimezone) {
      _state.config.localTimezone = config.localTimezone;
    }
    if (config.customerTimezone) {
      _state.config.customerTimezone = config.customerTimezone;
    }
    if (config.favoriteTimezones) {
      _state.config.favoriteTimezones = config.favoriteTimezones;
    }

    _render();
  }

  /**
   * Sets a simulation time (for testing)
   * @param {Date|null} time - Simulation time or null to use real time
   */
  function setSimulationTime(time) {
    _state.simulationTime = time;
    _render();
  }

  /**
   * Gets the current meeting times
   * @returns {Object} {start, end}
   */
  function getMeetingTimes() {
    return {
      start: _state.meetingStart,
      end: _state.meetingEnd
    };
  }

  /**
   * Sets the meeting times
   * @param {Date} start - Start time
   * @param {Date} end - End time
   */
  function setMeetingTimes(start, end) {
    _state.meetingStart = start;
    _state.meetingEnd = end;
    _render();
  }

  /**
   * Destroys the widget and cleans up
   */
  function destroy() {
    if (_state.intervalId) {
      clearInterval(_state.intervalId);
      _state.intervalId = null;
    }

    if (_state.container) {
      _state.container.innerHTML = '';
      _state.container = null;
    }

    _state.isInitialized = false;
    console.log('[GlobalSyncWidget] Destroyed');
  }

  /**
   * Gets the current state (for debugging)
   * @returns {Object} Current state
   */
  function getState() {
    return { ..._state };
  }

  // ============================================================================
  // Module Export
  // ============================================================================

  return {
    init,
    updateConfig,
    setSimulationTime,
    getMeetingTimes,
    setMeetingTimes,
    destroy,
    getState
  };
})();

// CommonJS export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlobalSyncWidget;
}
