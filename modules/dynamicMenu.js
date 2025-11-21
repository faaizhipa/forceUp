/**
 * Dynamic Menu Module
 * Injects custom buttons into Salesforce case pages
 */

const DynamicMenu = {
  injectionSettings: {
    cardActions: false,
    headerDetails: true
  },

  headerObserver: null,
  lastButtonGroups: null,
  lastCaseData: null,

  /**
   * Sets injection settings from user preferences
   * @param {Object} settings
   */
  setSettings(settings) {
    this.injectionSettings = { ...this.injectionSettings, ...settings };
  },

  /**
   * Injects menu into configured locations
   * @param {Object} buttonGroups
   * @param {Object} caseData
   */
  async injectMenu(buttonGroups, caseData) {
    if (this.injectionSettings.cardActions) {
      await this.injectIntoCardActions(buttonGroups, caseData);
    }

    if (this.injectionSettings.headerDetails) {
      await this.injectIntoHeaderDetails(buttonGroups, caseData);
    }
  },

  /**
   * Injects menu into lightning-card actions slot
   * @param {Object} buttonGroups
   * @param {Object} caseData
   */
  async injectIntoCardActions(buttonGroups, caseData) {
    const cardSlot = document.querySelector('lightning-card slot[name="actions"]');
    if (!cardSlot || cardSlot.querySelector('.exlibris-custom-menu')) return;

    const menuContainer = this.createMenuContainer('card');
    await this.populateMenu(menuContainer, buttonGroups, caseData);

    // Wrap menu in a slot element for proper encapsulation
    const slotWrapper = document.createElement('slot');
    slotWrapper.setAttribute('name', 'exlibris-menu-slot');
    slotWrapper.appendChild(menuContainer);

    cardSlot.appendChild(slotWrapper);
  },

  /**
   * Injects menu into header details section
   * @param {Object} buttonGroups
   * @param {Object} caseData
   */
  async injectIntoHeaderDetails(buttonGroups, caseData) {
    // Primary strategy: Target div.secondaryFields within records-highlights2
    let container = document.querySelector('records-highlights2 div.secondaryFields');
    
    // Secondary strategy: Find records-highlights-details-item and get its parent slot
    if (!container) {
      const detailsItem = document.querySelector('records-highlights-details-item');
      if (detailsItem) {
        const parentSlot = detailsItem.parentElement;
        if (parentSlot && parentSlot.tagName === 'SLOT') {
          container = parentSlot.parentElement; // The div.secondaryFields
        }
      }
    }

    if (!container) {
      console.warn('[DynamicMenu] Could not find suitable container for injection');
      return;
    }

    // Check if already injected
    if (container.querySelector('.exlibris-custom-menu')) {
      console.log('[DynamicMenu] Menu already exists in container');
      return;
    }

    const menuContainer = this.createMenuContainer('header');
    await this.populateMenu(menuContainer, buttonGroups, caseData);

    // Wrap menu in a slot element for proper encapsulation
    const slotWrapper = document.createElement('slot');
    slotWrapper.setAttribute('name', 'exlibris-menu-slot');
    slotWrapper.appendChild(menuContainer);

    container.appendChild(slotWrapper);

    // Store data for potential re-injection
    this.lastButtonGroups = buttonGroups;
    this.lastCaseData = caseData;

    // Attach observer to the container
    this.observeHeaderSection(container);
  },

  /**
   * Observes header section for DOM changes and re-injects menu if needed
   * @param {Element} headerSlot
   */
  observeHeaderSection(headerSlot) {
    // Disconnect existing observer if any
    if (this.headerObserver) {
      this.headerObserver.disconnect();
      this.headerObserver = null;
    }

    // Find the parent header container to observe
    const headerContainer = headerSlot.closest('.secondaryFields') || headerSlot.parentElement;
    if (!headerContainer) {
      console.warn('[DynamicMenu] Could not find header container to observe');
      return;
    }

    this.headerObserver = new MutationObserver(() => {
      // Check if our menu still exists
      const menuExists = headerSlot.querySelector('.exlibris-custom-menu');

      // Disconnect current observer
      if (this.headerObserver) {
        this.headerObserver.disconnect();
        this.headerObserver = null;
      }

      if (!menuExists && this.lastButtonGroups && this.lastCaseData) {
        console.log('[DynamicMenu] Menu removed by DOM change, re-injecting...');
        this.injectIntoHeaderDetails(this.lastButtonGroups, this.lastCaseData).catch(err => {
          console.error('[DynamicMenu] Error re-injecting menu:', err);
        });
      } else {
        // Menu still exists, reattach observer
        this.observeHeaderSection(headerSlot);
      }
    });

    this.headerObserver.observe(headerContainer, {
      childList: true,
      subtree: true
    });

    console.log('[DynamicMenu] Header section observer attached');
  },

  /**
   * Creates menu container element
   * @param {string} location
   * @returns {HTMLElement}
   */
  createMenuContainer(location) {
    const container = document.createElement('div');
    container.className = `exlibris-custom-menu exlibris-menu-${location}`;

    if (location === 'header') {
      container.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
        padding: 12px;
        background: #f3f3f3;
        border-radius: 8px;
        width: 100%;
      `;
    } else {
      container.style.cssText = `
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      `;
    }

    return container;
  },

  /**
   * Populates menu with buttons
   * @param {HTMLElement} container
   * @param {Object} buttonGroups
   * @param {Object} caseData
   */
  async populateMenu(container, buttonGroups, caseData) {
    const readiness = this.evaluateReadiness(caseData);

    if (buttonGroups.analyticsRefresh) {
      const timezoneConverter = await this.createTimezoneConverter(buttonGroups.analyticsRefresh, caseData);
      container.appendChild(timezoneConverter);
    }

    if (buttonGroups.production) {
      container.appendChild(this.createButtonGroup('Production', buttonGroups.production, readiness.production));
    }

    if (buttonGroups.sandbox && buttonGroups.sandbox.length > 0) {
      container.appendChild(this.createButtonGroup('Sandboxes', buttonGroups.sandbox, readiness.sandbox));
    }

    if (buttonGroups.tools) {
      container.appendChild(this.createButtonGroup('Tools', buttonGroups.tools, readiness.tools));
    }

    if (buttonGroups.sql) {
      container.appendChild(this.createButtonGroup('SQL Resources', buttonGroups.sql, readiness.sql));
    }

    if (buttonGroups.misc) {
      container.appendChild(this.createButtonGroup('Other', buttonGroups.misc, readiness.misc));
    }
  },

  /**
   * Determines readiness state for each menu group
   * @param {Object} caseData
   * @returns {Object}
   */
  evaluateReadiness(caseData = {}) {
    const hasServer = Boolean(caseData.server);
    const hasInstitutionCode = Boolean(caseData.institutionCode);
    const hasServerRegion = Boolean(caseData.serverRegion);
    const hasIdentifiers = Boolean(caseData.exLibrisAccountNumber) || (Boolean(caseData.custID) && Boolean(caseData.instID));

    return {
      production: {
        ready: hasServer && hasInstitutionCode,
        reason: 'Requires server and institution code. Run Prepare Tools first.'
      },
      sandbox: {
        ready: hasServer && hasInstitutionCode,
        reason: 'Requires server and institution code. Run Prepare Tools first.'
      },
      tools: {
        ready: hasServerRegion,
        reason: 'Requires server region details. Run Prepare Tools first.'
      },
      sql: {
        ready: true,
        reason: ''
      },
      misc: {
        ready: hasIdentifiers,
        reason: 'Requires customer identifiers. Run Prepare Tools first.'
      }
    };
  },

  /**
   * State tracking for timezone converter cleanup
   */
  timezoneConverterState: {
    container: null,
    listeners: [],
    timers: [],
    observers: [],
    isActive: false,
    rangeState: {
      isDragging: false,
      startTime: null,
      endTime: null,
      activeTimezone: null,
      startPos: null,
      endPos: null
    }
  },

  /**
   * Cleanup timezone converter resources
   */
  cleanupTimezoneConverter() {
    if (!this.timezoneConverterState.isActive) return;

    // Remove all event listeners
    this.timezoneConverterState.listeners.forEach(({element, event, handler, options}) => {
      try {
        if (element && element.removeEventListener) {
          element.removeEventListener(event, handler, options);
        }
      } catch (error) {
        console.warn('[DynamicMenu] Error removing listener:', error);
      }
    });
    this.timezoneConverterState.listeners = [];

    // Clear all timers
    this.timezoneConverterState.timers.forEach(({type, id}) => {
      try {
        if (type === 'interval') clearInterval(id);
        else if (type === 'timeout') clearTimeout(id);
        else if (type === 'animationFrame') cancelAnimationFrame(id);
      } catch (error) {
        console.warn('[DynamicMenu] Error clearing timer:', error);
      }
    });
    this.timezoneConverterState.timers = [];

    // Disconnect all observers
    this.timezoneConverterState.observers.forEach(observer => {
      try {
        if (observer && observer.disconnect) observer.disconnect();
      } catch (error) {
        console.warn('[DynamicMenu] Error disconnecting observer:', error);
      }
    });
    this.timezoneConverterState.observers = [];

    // Remove DOM elements
    if (this.timezoneConverterState.container && this.timezoneConverterState.container.parentNode) {
      this.timezoneConverterState.container.remove();
    }
    this.timezoneConverterState.container = null;

    // Reset state
    this.timezoneConverterState.isActive = false;
    this.timezoneConverterState.rangeState = {
      isDragging: false,
      startTime: null,
      endTime: null,
      activeTimezone: null,
      startPos: null,
      endPos: null
    };
  },

  /**
   * Track event listener for cleanup
   */
  trackListener(element, event, handler, options) {
    element.addEventListener(event, handler, options);
    this.timezoneConverterState.listeners.push({element, event, handler, options});
  },

  /**
   * Track timer for cleanup
   */
  trackTimer(type, id) {
    this.timezoneConverterState.timers.push({type, id});
  },

  /**
   * Creates timezone converter display (expandable/collapsible with sliders)
   * Replaces the old createRefreshInfo method
   * @param {Object} refreshInfo - Analytics refresh info from URLBuilder
   * @param {Object} caseData - Case data object
   * @returns {HTMLElement}
   */
  async createTimezoneConverter(refreshInfo, caseData) {
    // Cleanup any existing converter
    this.cleanupTimezoneConverter();

    // Mark as active
    this.timezoneConverterState.isActive = true;
    this.timezoneConverterState.container = document.createElement('div');
    const container = this.timezoneConverterState.container;
    container.className = 'exlibris-timezone-converter';
    container.style.cssText = `
      width: 100%;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: hidden;
      transition: all 0.3s ease;
    `;

    // Resolve all four timezones
    let caseTimezoneInfo, userTimezoneInfo, serverTimezoneInfo;
    try {
      if (typeof TimezoneConverter !== 'undefined') {
        caseTimezoneInfo = await TimezoneConverter.resolveCaseTimezone(caseData);
        userTimezoneInfo = await TimezoneConverter.resolveUserTimezone();
        serverTimezoneInfo = TimezoneConverter.resolveServerTimezone(caseData?.serverRegion);
      } else {
        // Fallback if TimezoneConverter not available
        caseTimezoneInfo = { timezone: 'UTC', displayName: 'UTC', isAuto: false };
        userTimezoneInfo = { 
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, 
          displayName: 'Local', 
          isAuto: true 
        };
        serverTimezoneInfo = { timezone: 'UTC', displayName: 'UTC', isAuto: true };
      }
    } catch (error) {
      console.error('[DynamicMenu] Error resolving timezones:', error);
      caseTimezoneInfo = { timezone: 'UTC', displayName: 'UTC', isAuto: false };
      userTimezoneInfo = { 
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, 
        displayName: 'Local', 
        isAuto: true 
      };
      serverTimezoneInfo = { timezone: 'UTC', displayName: 'UTC', isAuto: true };
    }

    // Get available dates
    let availableDates = [];
    if (typeof TimezoneConverter !== 'undefined') {
      availableDates = TimezoneConverter.getAvailableDates(caseData, refreshInfo);
    } else {
      // Fallback: just analytics refresh
      if (refreshInfo && refreshInfo.utc) {
        const utcMatch = refreshInfo.utc.match(/(\d{2}):(\d{2})/);
        if (utcMatch) {
          const now = new Date();
          const [hours, minutes] = utcMatch.slice(1).map(Number);
          const refreshTime = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            hours,
            minutes
          ));
          if (refreshTime < now) {
            refreshTime.setUTCDate(refreshTime.getUTCDate() + 1);
          }
          availableDates.push({
            label: 'Next Analytics Refresh',
            value: 'analytics_refresh',
            date: refreshTime
          });
        }
      }
    }

    if (availableDates.length === 0) {
      // No dates available, show error state
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        padding: 10px;
        color: #666;
        font-size: 12px;
        text-align: center;
      `;
      errorDiv.textContent = 'No date information available';
      container.appendChild(errorDiv);
      return container;
    }

    // Default to first date (Analytics Refresh)
    let selectedDate = availableDates[0].date;
    let selectedValue = availableDates[0].value;

    // Header (clickable to expand/collapse)
    const header = document.createElement('div');
    header.className = 'exlibris-tz-header';
    header.style.cssText = `
      padding: 10px 12px;
      background: #f8f9fa;
      border-bottom: 1px solid #ddd;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    `;
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', 'false');
    header.setAttribute('tabindex', '0');

    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: bold;
      font-size: 12px;
      color: #666;
    `;

    const icon = document.createElement('span');
    icon.textContent = '🌍';
    icon.style.fontSize = '14px';

    const title = document.createElement('span');
    title.textContent = 'Time Converter';

    const expandIcon = document.createElement('span');
    expandIcon.textContent = '▼';
    expandIcon.className = 'exlibris-tz-expand-icon';
    expandIcon.style.cssText = `
      font-size: 10px;
      color: #999;
      transition: transform 0.3s ease;
    `;

    headerLeft.appendChild(icon);
    headerLeft.appendChild(title);
    header.appendChild(headerLeft);
    header.appendChild(expandIcon);

    // Collapsed summary
    const summary = document.createElement('div');
    summary.className = 'exlibris-tz-summary';
    summary.style.cssText = `
      padding: 8px 12px;
      font-size: 11px;
      color: #666;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    `;

    // Update summary function
    const updateSummary = () => {
      if (typeof TimezoneConverter !== 'undefined') {
        const conversions = TimezoneConverter.convertToAllTimezones(
          selectedDate,
          caseTimezoneInfo.timezone,
          userTimezoneInfo.timezone,
          serverTimezoneInfo.timezone
        );
        summary.innerHTML = `
          <span><strong>${availableDates.find(d => d.value === selectedValue)?.label || 'Selected Date'}:</strong></span>
          <span>Case: ${conversions.case.time24}</span>
          <span>User: ${conversions.user.time24}</span>
          <span>Server: ${conversions.server.time24}</span>
          <span>UTC: ${conversions.utc.time24}</span>
        `;
      } else {
        // Fallback
        summary.innerHTML = `
          <span><strong>${availableDates.find(d => d.value === selectedValue)?.label || 'Selected Date'}</strong></span>
        `;
      }
    };

    updateSummary();

    // Expanded content (initially hidden)
    const expandedContent = document.createElement('div');
    expandedContent.className = 'exlibris-tz-expanded';
    expandedContent.style.cssText = `
      display: none;
      padding: 12px;
    `;

    // Date selection dropdown
    const dropdownContainer = document.createElement('div');
    dropdownContainer.style.cssText = `
      margin-bottom: 16px;
    `;

    const dropdownLabel = document.createElement('label');
    dropdownLabel.textContent = 'Select Date/Time:';
    dropdownLabel.style.cssText = `
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #666;
      margin-bottom: 6px;
    `;

    const dropdown = document.createElement('select');
    dropdown.className = 'exlibris-tz-date-select';
    dropdown.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
      background: #fff;
      cursor: pointer;
    `;

    availableDates.forEach((dateOption) => {
      const option = document.createElement('option');
      option.value = dateOption.value;
      option.textContent = dateOption.label;
      dropdown.appendChild(option);
    });

    dropdownContainer.appendChild(dropdownLabel);
    dropdownContainer.appendChild(dropdown);

    // Timezone displays container
    const timezonesContainer = document.createElement('div');
    timezonesContainer.className = 'exlibris-tz-displays';
    timezonesContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // Store timezone info for slider creation
    const timezoneConfigs = [
      { key: 'case', info: caseTimezoneInfo, label: 'Case Timezone', isAuto: caseTimezoneInfo.isAuto },
      { key: 'user', info: userTimezoneInfo, label: 'Your Timezone', isAuto: userTimezoneInfo.isAuto },
      { key: 'server', info: serverTimezoneInfo, label: 'Server Timezone', isAuto: serverTimezoneInfo.isAuto },
      { key: 'utc', info: { timezone: 'UTC', displayName: 'UTC' }, label: 'UTC', isAuto: false }
    ];

    // Current time state (in UTC milliseconds)
    let currentTimeMs = selectedDate.getTime();
    
    // Range state
    const rangeState = this.timezoneConverterState.rangeState;
    let rangeStartMs = null;
    let rangeEndMs = null;
    let activeRangeTimezone = null;

    // Helper: Convert time in milliseconds to hours (0-24)
    const msToHours = (ms) => {
      const date = new Date(ms);
      return date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    };

    // Helper: Convert hours (0-24) to milliseconds for a given date
    const hoursToMs = (hours, baseDate) => {
      const date = new Date(baseDate);
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      const s = Math.floor(((hours - h) * 60 - m) * 60);
      date.setUTCHours(h, m, s, 0);
      return date.getTime();
    };

    // Helper: Snap time to interval based on velocity
    const snapTime = (timeMs, lastTimeMs, intervalSlow = 5, intervalFast = 15) => {
      if (!lastTimeMs) return timeMs;
      const velocity = Math.abs(timeMs - lastTimeMs);
      const interval = velocity > 60000 ? intervalFast : intervalSlow; // Fast if > 1 minute change
      const minutes = new Date(timeMs).getUTCMinutes();
      const snappedMinutes = Math.round(minutes / interval) * interval;
      const snapped = new Date(timeMs);
      snapped.setUTCMinutes(snappedMinutes, 0, 0);
      return snapped.getTime();
    };

    // Helper: Format duration
    const formatDuration = (startMs, endMs) => {
      const diff = Math.abs(endMs - startMs);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    };

    // Function to update all sliders
    const updateAllSliders = () => {
      if (typeof TimezoneConverter === 'undefined') return;

      const conversions = TimezoneConverter.convertToAllTimezones(
        new Date(currentTimeMs),
        caseTimezoneInfo.timezone,
        userTimezoneInfo.timezone,
        serverTimezoneInfo.timezone
      );

      timezoneConfigs.forEach(({ key }) => {
        const slider = container.querySelector(`[data-timezone="${key}"] .exlibris-tz-slider`);
        const timeInput = container.querySelector(`[data-timezone="${key}"] .exlibris-tz-time-input`);
        const timeDisplay = container.querySelector(`[data-timezone="${key}"] .exlibris-tz-time-display`);
        const ampmDisplay = container.querySelector(`[data-timezone="${key}"] .exlibris-tz-ampm`);

        if (slider && conversions[key]) {
          // Update slider position (0-100% based on 24 hours)
          const hours = msToHours(currentTimeMs);
          const percent = (hours / 24) * 100;
          slider.value = percent;

          // Update time display
          if (timeDisplay) {
            timeDisplay.textContent = conversions[key].time24;
          }
          if (ampmDisplay) {
            ampmDisplay.textContent = conversions[key].ampm;
          }
          if (timeInput) {
            timeInput.value = conversions[key].time24;
          }
        }
      });

      // Update range visualization if active
      if (rangeStartMs !== null && rangeEndMs !== null && activeRangeTimezone) {
        updateRangeVisualization();
      }
    };

    // Function to create slider for a timezone
    const createTimezoneSlider = ({ key, info, label, isAuto }) => {
      const sliderWrapper = document.createElement('div');
      sliderWrapper.className = 'exlibris-tz-slider-wrapper';
      sliderWrapper.setAttribute('data-timezone', key);
      sliderWrapper.style.cssText = `
        margin-bottom: 20px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        border-left: 3px solid #0176d3;
      `;

      // Label
      const labelDiv = document.createElement('div');
      labelDiv.style.cssText = `
        font-size: 11px;
        font-weight: 600;
        color: #666;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      const labelText = document.createElement('span');
      labelText.textContent = `${label} (${info.displayName})`;
      if (isAuto) {
        const autoBadge = document.createElement('span');
        autoBadge.textContent = '(auto)';
        autoBadge.style.cssText = 'font-size: 9px; color: #ff6b35; font-style: italic;';
        labelText.appendChild(autoBadge);
      }
      labelDiv.appendChild(labelText);

      // Time display and input row
      const timeRow = document.createElement('div');
      timeRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      `;

      const timeDisplay = document.createElement('div');
      timeDisplay.className = 'exlibris-tz-time-display';
      timeDisplay.style.cssText = `
        font-size: 16px;
        font-weight: 600;
        color: #0176d3;
        min-width: 80px;
      `;

      const ampmDisplay = document.createElement('div');
      ampmDisplay.className = 'exlibris-tz-ampm';
      ampmDisplay.style.cssText = `
        font-size: 12px;
        color: #666;
        min-width: 30px;
      `;

      const timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.className = 'exlibris-tz-time-input';
      timeInput.step = '60';
      timeInput.style.cssText = `
        padding: 4px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 12px;
        width: 100px;
      `;

      timeRow.appendChild(timeDisplay);
      timeRow.appendChild(ampmDisplay);
      timeRow.appendChild(timeInput);

      // Slider container with gradient background
      const sliderContainer = document.createElement('div');
      sliderContainer.className = 'exlibris-tz-slider-container';
      sliderContainer.style.cssText = `
        position: relative;
        height: 40px;
        margin: 8px 0;
        border-radius: 4px;
        overflow: hidden;
        background: linear-gradient(to right, 
          #87CEEB 0%, 
          #87CEEB 25%, 
          #FFD700 25%, 
          #FFD700 50%, 
          #FFD700 75%, 
          #1a1a2e 75%, 
          #1a1a2e 100%
        );
        cursor: pointer;
      `;

      // Range highlight overlay (initially hidden)
      const rangeHighlight = document.createElement('div');
      rangeHighlight.className = 'exlibris-tz-range-highlight';
      rangeHighlight.style.cssText = `
        position: absolute;
        top: 0;
        height: 100%;
        background: rgba(1, 118, 211, 0.3);
        border-left: 2px solid #0176d3;
        border-right: 2px solid #0176d3;
        pointer-events: none;
        display: none;
        z-index: 1;
      `;

      // Range popups container
      const popupsContainer = document.createElement('div');
      popupsContainer.className = 'exlibris-tz-range-popups';
      popupsContainer.style.cssText = `
        position: absolute;
        top: -50px;
        left: 0;
        width: 100%;
        height: 40px;
        pointer-events: none;
        z-index: 2;
      `;

      const startPopup = document.createElement('div');
      startPopup.className = 'exlibris-tz-popup exlibris-tz-popup-start';
      startPopup.style.cssText = `
        position: absolute;
        background: #0176d3;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        white-space: nowrap;
        display: none;
        transform: translateX(-50%);
      `;

      const durationPopup = document.createElement('div');
      durationPopup.className = 'exlibris-tz-popup exlibris-tz-popup-duration';
      durationPopup.style.cssText = `
        position: absolute;
        background: #ff6b35;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        white-space: nowrap;
        display: none;
        transform: translateX(-50%);
      `;

      const endPopup = document.createElement('div');
      endPopup.className = 'exlibris-tz-popup exlibris-tz-popup-end';
      endPopup.style.cssText = `
        position: absolute;
        background: #0176d3;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        white-space: nowrap;
        display: none;
        transform: translateX(-50%);
      `;

      popupsContainer.appendChild(startPopup);
      popupsContainer.appendChild(durationPopup);
      popupsContainer.appendChild(endPopup);

      // Slider input
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'exlibris-tz-slider';
      slider.min = '0';
      slider.max = '100';
      slider.step = '0.01';
      slider.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: pointer;
        z-index: 3;
      `;

      sliderContainer.appendChild(rangeHighlight);
      sliderContainer.appendChild(popupsContainer);
      sliderContainer.appendChild(slider);

      // Assemble
      sliderWrapper.appendChild(labelDiv);
      sliderWrapper.appendChild(timeRow);
      sliderWrapper.appendChild(sliderContainer);

      // Event handlers
      let lastSliderValue = null;
      let isDragging = false;
      let rangeDragStart = null;
      let lastMouseX = null;
      let lastMoveTime = Date.now();

      // Slider change handler
      const handleSliderChange = (e) => {
        const percent = parseFloat(e.target.value);
        const hours = (percent / 100) * 24;
        const newTimeMs = hoursToMs(hours, new Date(currentTimeMs));
        
        // Snap based on velocity
        if (lastSliderValue !== null) {
          const velocity = Math.abs(percent - lastSliderValue);
          const snappedMs = snapTime(newTimeMs, currentTimeMs);
          currentTimeMs = snappedMs;
        } else {
          currentTimeMs = newTimeMs;
        }
        
        lastSliderValue = percent;
        updateAllSliders();
        updateSummary();
      };

      // Time input change handler
      const handleTimeInputChange = (e) => {
        const [hours, minutes] = e.target.value.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          // Convert input time to UTC based on this timezone
          const localDate = new Date(new Date(currentTimeMs).toLocaleString('en-US', { timeZone: info.timezone }));
          localDate.setHours(hours, minutes, 0, 0);
          
          // Convert back to UTC
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: info.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          const parts = formatter.formatToParts(localDate);
          // This is complex - for now, use a simpler approach
          currentTimeMs = hoursToMs(hours + minutes / 60, new Date(currentTimeMs));
          updateAllSliders();
          updateSummary();
        }
      };

      // Range selection handlers
      const handleRangeStart = (e) => {
        if (e.button !== 0) return; // Only left mouse button
        e.preventDefault();
        isDragging = true;
        rangeDragStart = e.clientX || e.touches?.[0]?.clientX;
        activeRangeTimezone = key;
        rangeStartMs = currentTimeMs;
        rangeEndMs = currentTimeMs;
        lastMouseX = rangeDragStart;
        lastMoveTime = Date.now();
        
        const rect = sliderContainer.getBoundingClientRect();
        const percent = ((rangeDragStart - rect.left) / rect.width) * 100;
        const hours = (percent / 100) * 24;
        rangeStartMs = hoursToMs(hours, new Date(currentTimeMs));
        rangeEndMs = rangeStartMs;
        
        updateRangeVisualization();
      };

      const handleRangeMove = (e) => {
        if (!isDragging || activeRangeTimezone !== key) return;
        e.preventDefault();
        
        const mouseX = e.clientX || e.touches?.[0]?.clientX;
        if (mouseX === null || mouseX === undefined) return;
        
        const rect = sliderContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((mouseX - rect.left) / rect.width) * 100));
        const hours = (percent / 100) * 24;
        let newEndMs = hoursToMs(hours, new Date(currentTimeMs));
        
        // Snap based on velocity
        const now = Date.now();
        const timeSinceLastMove = now - lastMoveTime;
        const velocity = Math.abs(mouseX - lastMouseX) / (timeSinceLastMove || 1);
        const snapInterval = velocity > 2 ? 15 : 5; // Fast if > 2px/ms
        
        const minutes = new Date(newEndMs).getUTCMinutes();
        const snappedMinutes = Math.round(minutes / snapInterval) * snapInterval;
        const snapped = new Date(newEndMs);
        snapped.setUTCMinutes(snappedMinutes, 0, 0);
        newEndMs = snapped.getTime();
        
        rangeEndMs = newEndMs;
        lastMouseX = mouseX;
        lastMoveTime = now;
        
        updateRangeVisualization();
      };

      const handleRangeEnd = (e) => {
        if (!isDragging || activeRangeTimezone !== key) return;
        isDragging = false;
        
        // Finalize range
        if (rangeStartMs !== null && rangeEndMs !== null) {
          // Ensure start < end
          if (rangeStartMs > rangeEndMs) {
            [rangeStartMs, rangeEndMs] = [rangeEndMs, rangeStartMs];
          }
          showRangeSummary();
        }
        
        activeRangeTimezone = null;
      };

      // Attach event handlers with tracking
      this.trackListener(slider, 'input', handleSliderChange);
      this.trackListener(slider, 'change', handleSliderChange);
      this.trackListener(timeInput, 'change', handleTimeInputChange);
      this.trackListener(sliderContainer, 'mousedown', handleRangeStart);
      this.trackListener(sliderContainer, 'touchstart', handleRangeStart);
      this.trackListener(document, 'mousemove', handleRangeMove);
      this.trackListener(document, 'touchmove', handleRangeMove);
      this.trackListener(document, 'mouseup', handleRangeEnd);
      this.trackListener(document, 'touchend', handleRangeEnd);
      this.trackListener(document, 'mouseleave', handleRangeEnd);

      return sliderWrapper;
    };

    // Function to update range visualization
    const updateRangeVisualization = () => {
      if (rangeStartMs === null || rangeEndMs === null || !activeRangeTimezone) return;

      timezoneConfigs.forEach(({ key, info }) => {
        const sliderWrapper = container.querySelector(`[data-timezone="${key}"]`);
        if (!sliderWrapper) return;

        const sliderContainer = sliderWrapper.querySelector('.exlibris-tz-slider-container');
        const rangeHighlight = sliderWrapper.querySelector('.exlibris-tz-range-highlight');
        const startPopup = sliderWrapper.querySelector('.exlibris-tz-popup-start');
        const durationPopup = sliderWrapper.querySelector('.exlibris-tz-popup-duration');
        const endPopup = sliderWrapper.querySelector('.exlibris-tz-popup-end');

        if (!sliderContainer || !rangeHighlight) return;

        // Convert range times to this timezone
        const conversionsStart = TimezoneConverter.convertToAllTimezones(
          new Date(rangeStartMs),
          caseTimezoneInfo.timezone,
          userTimezoneInfo.timezone,
          serverTimezoneInfo.timezone
        );
        const conversionsEnd = TimezoneConverter.convertToAllTimezones(
          new Date(rangeEndMs),
          caseTimezoneInfo.timezone,
          userTimezoneInfo.timezone,
          serverTimezoneInfo.timezone
        );

        const startHours = msToHours(rangeStartMs);
        const endHours = msToHours(rangeEndMs);
        const startPercent = (startHours / 24) * 100;
        const endPercent = (endHours / 24) * 100;

        // Show range highlight
        rangeHighlight.style.display = 'block';
        rangeHighlight.style.left = `${Math.min(startPercent, endPercent)}%`;
        rangeHighlight.style.width = `${Math.abs(endPercent - startPercent)}%`;

        // Update popups
        if (key === activeRangeTimezone) {
          startPopup.textContent = conversionsStart[key].time24;
          startPopup.style.display = 'block';
          startPopup.style.left = `${startPercent}%`;

          durationPopup.textContent = formatDuration(rangeStartMs, rangeEndMs);
          durationPopup.style.display = 'block';
          durationPopup.style.left = `${(startPercent + endPercent) / 2}%`;

          endPopup.textContent = conversionsEnd[key].time24;
          endPopup.style.display = 'block';
          endPopup.style.left = `${endPercent}%`;
        } else {
          // Show range in other timezones
          const tzStartHours = msToHours(new Date(conversionsStart[key].date).getTime());
          const tzEndHours = msToHours(new Date(conversionsEnd[key].date).getTime());
          const tzStartPercent = (tzStartHours / 24) * 100;
          const tzEndPercent = (tzEndHours / 24) * 100;

          rangeHighlight.style.left = `${Math.min(tzStartPercent, tzEndPercent)}%`;
          rangeHighlight.style.width = `${Math.abs(tzEndPercent - tzStartPercent)}%`;
        }
      });
    };

    // Function to show range summary panel
    const showRangeSummary = () => {
      // Remove existing summary if any
      const existingSummary = container.querySelector('.exlibris-tz-range-summary');
      if (existingSummary) existingSummary.remove();

      if (rangeStartMs === null || rangeEndMs === null) return;

      const summaryPanel = document.createElement('div');
      summaryPanel.className = 'exlibris-tz-range-summary';
      summaryPanel.style.cssText = `
        margin-top: 16px;
        padding: 12px;
        background: #e8f4f8;
        border-radius: 6px;
        border: 1px solid #0176d3;
      `;

      const title = document.createElement('div');
      title.textContent = 'Time Range Summary';
      title.style.cssText = `
        font-size: 12px;
        font-weight: 600;
        color: #0176d3;
        margin-bottom: 8px;
      `;

      const conversionsStart = TimezoneConverter.convertToAllTimezones(
        new Date(rangeStartMs),
        caseTimezoneInfo.timezone,
        userTimezoneInfo.timezone,
        serverTimezoneInfo.timezone
      );
      const conversionsEnd = TimezoneConverter.convertToAllTimezones(
        new Date(rangeEndMs),
        caseTimezoneInfo.timezone,
        userTimezoneInfo.timezone,
        serverTimezoneInfo.timezone
      );

      const duration = formatDuration(rangeStartMs, rangeEndMs);

      const content = document.createElement('div');
      content.style.cssText = `
        font-size: 11px;
        color: #333;
        line-height: 1.6;
      `;

      timezoneConfigs.forEach(({ key, label }) => {
        const row = document.createElement('div');
        row.style.cssText = 'margin-bottom: 4px;';
        row.innerHTML = `
          <strong>${label}:</strong> 
          ${conversionsStart[key].dateStr} ${conversionsStart[key].time24} - 
          ${conversionsEnd[key].dateStr} ${conversionsEnd[key].time24} 
          (${duration})
        `;
        content.appendChild(row);
      });

      summaryPanel.appendChild(title);
      summaryPanel.appendChild(content);
      timezonesContainer.appendChild(summaryPanel);
    };

    // Create sliders for all timezones
    timezoneConfigs.forEach(config => {
      const slider = createTimezoneSlider(config);
      timezonesContainer.appendChild(slider);
    });

    // Initial render
    updateAllSliders();

    // Time formatting dropdown and copy button
    const formatContainer = document.createElement('div');
    formatContainer.style.cssText = `
      margin-top: 16px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 6px;
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    const formatLabel = document.createElement('label');
    formatLabel.textContent = 'Copy Format:';
    formatLabel.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: #666;
    `;

    const formatSelect = document.createElement('select');
    formatSelect.className = 'exlibris-tz-format-select';
    formatSelect.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
      background: #fff;
      cursor: pointer;
    `;

    const formatOptions = [
      { value: 'kibana', label: 'Kibana (Nov 17, 2025 @ 23:30:00.000)' },
      { value: 'iso8601', label: 'ISO 8601 (2025-11-17T23:30:00.000Z)' },
      { value: 'unix', label: 'Unix Timestamp (seconds)' },
      { value: 'unix_ms', label: 'Unix Timestamp (milliseconds)' },
      { value: 'time24', label: '24-hour Time (HH:MM:SS)' },
      { value: 'time12', label: '12-hour Time (HH:MM:SS AM/PM)' }
    ];

    formatOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      formatSelect.appendChild(option);
    });

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.style.cssText = `
      padding: 6px 12px;
      background: #0176d3;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    `;

    const handleCopy = () => {
      if (typeof TimezoneConverter === 'undefined') return;

      const format = formatSelect.value;
      const date = new Date(currentTimeMs);
      let textToCopy = '';

      switch (format) {
        case 'kibana':
          textToCopy = TimezoneConverter.formatToKibana(date, 'UTC');
          break;
        case 'iso8601':
          textToCopy = TimezoneConverter.formatToISO8601(date, 'UTC');
          break;
        case 'unix':
          textToCopy = TimezoneConverter.formatToUnixTimestamp(date);
          break;
        case 'unix_ms':
          textToCopy = TimezoneConverter.formatToUnixTimestampMs(date);
          break;
        case 'time24':
          const conv = TimezoneConverter.convertToAllTimezones(
            date,
            caseTimezoneInfo.timezone,
            userTimezoneInfo.timezone,
            serverTimezoneInfo.timezone
          );
          textToCopy = `Case: ${conv.case.time24}, User: ${conv.user.time24}, Server: ${conv.server.time24}, UTC: ${conv.utc.time24}`;
          break;
        case 'time12':
          const conv12 = TimezoneConverter.convertToAllTimezones(
            date,
            caseTimezoneInfo.timezone,
            userTimezoneInfo.timezone,
            serverTimezoneInfo.timezone
          );
          textToCopy = `Case: ${conv12.case.time}, User: ${conv12.user.time}, Server: ${conv12.server.time}, UTC: ${conv12.utc.time}`;
          break;
        default:
          textToCopy = date.toISOString();
      }

      // Copy to clipboard
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 2000);
      }).catch(err => {
        console.error('[DynamicMenu] Failed to copy:', err);
        copyButton.textContent = 'Error';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 2000);
      });
    };

    formatContainer.appendChild(formatLabel);
    formatContainer.appendChild(formatSelect);
    formatContainer.appendChild(copyButton);

    // Dropdown change handler
    const handleDropdownChange = (e) => {
      const selectedOption = availableDates.find(d => d.value === e.target.value);
      if (selectedOption) {
        selectedDate = selectedOption.date;
        selectedValue = selectedOption.value;
        currentTimeMs = selectedDate.getTime();
        updateSummary();
        updateAllSliders();
      }
    };

    this.trackListener(dropdown, 'change', handleDropdownChange);
    this.trackListener(copyButton, 'click', handleCopy);

    // Expand/collapse handler
    let isExpanded = false;
    const toggleExpand = () => {
      isExpanded = !isExpanded;
      expandedContent.style.display = isExpanded ? 'block' : 'none';
      expandIcon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
      header.setAttribute('aria-expanded', isExpanded.toString());
    };

    const handleHeaderClick = () => toggleExpand();
    const handleHeaderKeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleExpand();
      }
    };

    this.trackListener(header, 'click', handleHeaderClick);
    this.trackListener(header, 'keydown', handleHeaderKeydown);

    // Assemble container
    expandedContent.appendChild(dropdownContainer);
    expandedContent.appendChild(timezonesContainer);
    expandedContent.appendChild(formatContainer);

    container.appendChild(header);
    container.appendChild(summary);
    container.appendChild(expandedContent);

    return container;
  },

  /**
   * Creates a button group with optional readiness gating
   * @param {string} label
   * @param {Array} buttons
   * @param {Object} readiness
   * @returns {HTMLElement}
   */
  createButtonGroup(label, buttons = [], readiness = { ready: true }) {
    const group = document.createElement('div');
    group.style.cssText = `
      display: inline-block;
      margin-right: 12px;
      margin-bottom: 8px;
    `;

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.style.cssText = `
      font-size: 11px;
      color: #666;
      margin-bottom: 4px;
      font-weight: 600;
    `;

    const buttonList = document.createElement('ul');
    buttonList.className = 'slds-button-group-list';
    buttonList.setAttribute('role', 'presentation');
    buttonList.style.cssText = `
      display: flex;
      gap: 4px;
      list-style: none;
      padding: 0;
      margin: 0;
    `;

    const ready = readiness.ready !== false;
    const reason = readiness.reason || 'Data not ready yet.';

    buttons.forEach((btn) => {
      const li = document.createElement('li');
      li.className = 'visible';
      li.setAttribute('role', 'presentation');

      const button = this.createButton(btn.label, btn.url, btn.tooltip || btn.label, {
        disabled: !ready || !btn.url,
        reason
      });

      li.appendChild(button);
      buttonList.appendChild(li);
    });

    group.appendChild(labelEl);
    group.appendChild(buttonList);

    if (!ready) {
      const lockMessage = document.createElement('div');
      lockMessage.textContent = reason;
      lockMessage.style.cssText = `
        font-size: 11px;
        color: #b85c00;
        margin-top: 4px;
      `;
      group.appendChild(lockMessage);
    }

    return group;
  },

  /**
   * Creates a single button element
   * @param {string} label
   * @param {string} url
   * @param {string} tooltip
   * @param {Object} options
   * @returns {HTMLElement}
   */
  createButton(label, url, tooltip, options = {}) {
    const button = document.createElement('button');
    button.className = 'slds-button slds-button_neutral';
    button.textContent = label;
    button.title = tooltip;
    button.type = 'button';
    button.style.cssText = `
      font-size: 12px;
      padding: 6px 12px;
      white-space: nowrap;
    `;

    if (!url || options.disabled) {
      button.disabled = true;
      button.title = options.reason || tooltip;
      button.classList.add('exl-menu-button--disabled');
    } else {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        window.open(url, '_blank');
      });
    }

    return button;
  },

  /**
   * Removes all injected menus
   */
  removeAllMenus() {
    // Disconnect observer before removing menus
    if (this.headerObserver) {
      this.headerObserver.disconnect();
      this.headerObserver = null;
    }

    const menus = document.querySelectorAll('.exlibris-custom-menu');
    menus.forEach((menu) => menu.remove());

    // Clear cached data
    this.lastButtonGroups = null;
    this.lastCaseData = null;
  },

  /**
   * Re-injects menu after DOM changes
   * @param {Object} buttonGroups
   * @param {Object} caseData
   */
  async refresh(buttonGroups, caseData) {
    // Cleanup timezone converter before removing menus
    this.cleanupTimezoneConverter();
    this.removeAllMenus();
    await this.injectMenu(buttonGroups, caseData);
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DynamicMenu;
}
