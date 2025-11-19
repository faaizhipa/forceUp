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
   * Creates timezone converter display (expandable/collapsible)
   * Replaces the old createRefreshInfo method
   * @param {Object} refreshInfo - Analytics refresh info from URLBuilder
   * @param {Object} caseData - Case data object
   * @returns {HTMLElement}
   */
  async createTimezoneConverter(refreshInfo, caseData) {
    const container = document.createElement('div');
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

    // Resolve timezones
    let caseTimezoneInfo, userTimezoneInfo;
    try {
      if (typeof TimezoneConverter !== 'undefined') {
        caseTimezoneInfo = await TimezoneConverter.resolveCaseTimezone(caseData);
        userTimezoneInfo = await TimezoneConverter.resolveUserTimezone();
      } else {
        // Fallback if TimezoneConverter not available
        caseTimezoneInfo = { timezone: 'UTC', displayName: 'UTC', isAuto: false };
        userTimezoneInfo = { 
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, 
          displayName: 'Local', 
          isAuto: true 
        };
      }
    } catch (error) {
      console.error('[DynamicMenu] Error resolving timezones:', error);
      caseTimezoneInfo = { timezone: 'UTC', displayName: 'UTC', isAuto: false };
      userTimezoneInfo = { 
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, 
        displayName: 'Local', 
        isAuto: true 
      };
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
          userTimezoneInfo.timezone
        );
        summary.innerHTML = `
          <span><strong>${availableDates.find(d => d.value === selectedValue)?.label || 'Selected Date'}:</strong></span>
          <span>Case: ${conversions.case.time}</span>
          <span>User: ${conversions.user.time}</span>
          <span>UTC: ${conversions.utc.time}</span>
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

    // Function to update timezone displays
    const updateTimezoneDisplays = () => {
      timezonesContainer.innerHTML = '';

      if (typeof TimezoneConverter !== 'undefined') {
        const conversions = TimezoneConverter.convertToAllTimezones(
          selectedDate,
          caseTimezoneInfo.timezone,
          userTimezoneInfo.timezone
        );

        // Case timezone
        const caseTzDiv = createTimezoneDisplay(
          `Case Timezone (${caseTimezoneInfo.displayName})`,
          conversions.case,
          caseTimezoneInfo.isAuto
        );
        timezonesContainer.appendChild(caseTzDiv);

        // User timezone
        const userTzDiv = createTimezoneDisplay(
          `Your Timezone (${userTimezoneInfo.displayName})${userTimezoneInfo.isAuto ? ' (auto)' : ''}`,
          conversions.user,
          userTimezoneInfo.isAuto
        );
        timezonesContainer.appendChild(userTzDiv);

        // UTC
        const utcTzDiv = createTimezoneDisplay(
          'UTC',
          conversions.utc,
          false
        );
        timezonesContainer.appendChild(utcTzDiv);
      } else {
        // Fallback display
        const fallbackDiv = document.createElement('div');
        fallbackDiv.style.cssText = `
          padding: 8px;
          background: #f8f9fa;
          border-radius: 4px;
          font-size: 11px;
          color: #666;
        `;
        fallbackDiv.textContent = 'Timezone converter not available';
        timezonesContainer.appendChild(fallbackDiv);
      }
    };

    // Helper to create timezone display
    const createTimezoneDisplay = (label, conversion, isAuto) => {
      const tzDiv = document.createElement('div');
      tzDiv.style.cssText = `
        padding: 10px;
        background: #f8f9fa;
        border-radius: 4px;
        border-left: 3px solid #0176d3;
      `;

      const labelDiv = document.createElement('div');
      labelDiv.textContent = label;
      labelDiv.style.cssText = `
        font-size: 11px;
        font-weight: 600;
        color: #666;
        margin-bottom: 8px;
      `;

      const dateDiv = document.createElement('div');
      dateDiv.textContent = `Date: ${conversion.dateStr}`;
      dateDiv.style.cssText = `
        font-size: 12px;
        color: #333;
        margin-bottom: 4px;
      `;

      const timeDiv = document.createElement('div');
      timeDiv.textContent = `Time: ${conversion.time}`;
      timeDiv.style.cssText = `
        font-size: 13px;
        font-weight: 600;
        color: #0176d3;
      `;

      tzDiv.appendChild(labelDiv);
      tzDiv.appendChild(dateDiv);
      tzDiv.appendChild(timeDiv);

      if (isAuto) {
        const autoIndicator = document.createElement('div');
        autoIndicator.textContent = '(auto-detected)';
        autoIndicator.style.cssText = `
          font-size: 10px;
          color: #ff6b35;
          margin-top: 4px;
          font-style: italic;
        `;
        tzDiv.appendChild(autoIndicator);
      }

      return tzDiv;
    };

    // Initial render
    updateTimezoneDisplays();

    // Dropdown change handler
    dropdown.addEventListener('change', (e) => {
      const selectedOption = availableDates.find(d => d.value === e.target.value);
      if (selectedOption) {
        selectedDate = selectedOption.date;
        selectedValue = selectedOption.value;
        updateSummary();
        updateTimezoneDisplays();
      }
    });

    // Expand/collapse handler
    let isExpanded = false;
    const toggleExpand = () => {
      isExpanded = !isExpanded;
      expandedContent.style.display = isExpanded ? 'block' : 'none';
      expandIcon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
      header.setAttribute('aria-expanded', isExpanded.toString());
    };

    header.addEventListener('click', toggleExpand);
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleExpand();
      }
    });

    // Assemble container
    expandedContent.appendChild(dropdownContainer);
    expandedContent.appendChild(timezonesContainer);

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
    this.removeAllMenus();
    await this.injectMenu(buttonGroups, caseData);
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DynamicMenu;
}
