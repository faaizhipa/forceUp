/**
 * Dynamic Menu Module
 * Injects custom buttons into Salesforce case pages
 */

const TimezoneDisplayUtils = {
  async resolveCaseTimezone(caseData) {
    try {
      if (caseData?.customerTimezone) {
        return {
          timezone: caseData.customerTimezone,
          displayName: formatTimezoneLabel(caseData.customerTimezone),
          isAuto: false
        };
      }

      if (typeof CustomerDataManager !== 'undefined' && typeof CustomerDataManager.getCustomerTimezone === 'function') {
        const result = await CustomerDataManager.getCustomerTimezone({
          institutionCode: caseData?.institutionCode || caseData?.exLibrisAccountNumber,
          customerId: caseData?.custID || caseData?.customerId,
          instID: caseData?.instID || caseData?.institutionId,
          accountName: caseData?.accountName
        });

        if (result && result.timezone) {
          return {
            timezone: result.timezone,
            displayName: formatTimezoneLabel(result.timezone),
            isAuto: false
          };
        }
      }
    } catch (error) {
      console.warn('[DynamicMenu] Error resolving case timezone:', error);
    }

    return { timezone: 'UTC', displayName: 'UTC', isAuto: false };
  },

  async resolveUserTimezone() {
    let preference = null;
    if (typeof SettingsManager !== 'undefined' && typeof SettingsManager.get === 'function') {
      const settings = SettingsManager.get();
      preference = settings?.exlibris?.ui?.timezone || settings?.timezone;
    }

    const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezone = preference && preference !== 'auto' ? preference : fallback;
    return {
      timezone,
      displayName: formatTimezoneLabel(timezone),
      isAuto: !preference || preference === 'auto'
    };
  },

  getAvailableDates(caseData, refreshInfo) {
    const dates = [];

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
        dates.push({
          label: 'Next Analytics Refresh',
          value: 'analytics_refresh',
          date: refreshTime
        });
      }
    }

    const addCaseDate = (label, value, rawDate) => {
      const parsed = parseSalesforceDate(rawDate);
      if (parsed) {
        dates.push({ label, value, date: parsed });
      }
    };

    addCaseDate('Case Created Date', 'case_created', caseData?.caseCreatedDate);
    addCaseDate('Case Closed Date', 'case_closed', caseData?.caseClosedOn);
    addCaseDate('Case Last Modified', 'case_modified', caseData?.lastModifiedDate);

    return dates;
  },

  convertToAllTimezones(date, caseTimezone, userTimezone) {
    return {
      case: formatConversion(date, caseTimezone),
      user: formatConversion(date, userTimezone),
      utc: formatConversion(date, 'UTC')
    };
  }
};

function formatTimezoneLabel(timezone) {
  if (!timezone) return 'UTC';
  return timezone.replace(/_/g, ' ');
}

function formatConversion(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    dateStyle: 'medium'
  });

  return {
    timezone,
    time: formatter.format(date),
    dateStr: dateFormatter.format(date),
    offset: formatOffset(date, timezone)
  };
}

function formatOffset(date, timezone) {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = tzDate - utcDate;
    const sign = offsetMs >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMs);
    const hours = Math.floor(abs / (1000 * 60 * 60));
    const minutes = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));
    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } catch (error) {
    console.warn('[DynamicMenu] Error computing offset:', error);
    return '+00:00';
  }
}

function parseSalesforceDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*,?\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match) {
    let [, month, day, year, hour, minute, meridiem ] = match;
    hour = parseInt(hour, 10);
    minute = parseInt(minute, 10);
    if (/PM/i.test(meridiem) && hour < 12) hour += 12;
    if (/AM/i.test(meridiem) && hour === 12) hour = 0;
    return new Date(`${year}-${month}-${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
  }

  return null;
}

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
   * Creates timezone converter UI widget
   * @param {Object} refreshInfo
   * @param {Object} caseData
   * @returns {Promise<HTMLElement>}
   */
  async createTimezoneConverter(refreshInfo, caseData) {
    const container = document.createElement('div');
    container.className = 'exlibris-timezone-converter';
    container.style.cssText = `
      margin-bottom: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #fff;
    `;

    // Header (clickable to expand/collapse)
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8f9fa;
      border-bottom: 1px solid #ddd;
    `;
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', 'false');

    const headerText = document.createElement('span');
    headerText.textContent = 'Timezone Converter';
    headerText.style.cssText = 'font-weight: 600; font-size: 13px;';

    const expandIcon = document.createElement('span');
    expandIcon.textContent = '▼';
    expandIcon.style.cssText = `
      font-size: 10px;
      transition: transform 0.2s;
      color: #666;
    `;

    header.appendChild(headerText);
    header.appendChild(expandIcon);

    // Summary (always visible)
    const summary = document.createElement('div');
    summary.style.cssText = `
      padding: 8px 12px;
      font-size: 12px;
      color: #666;
    `;

    // Expanded content (hidden by default)
    const expandedContent = document.createElement('div');
    expandedContent.style.cssText = `
      display: none;
      padding: 12px;
    `;

    // Resolve timezones
    const caseTimezoneResult = await TimezoneDisplayUtils.resolveCaseTimezone(caseData);
    const userTimezoneResult = await TimezoneDisplayUtils.resolveUserTimezone();
    const caseTimezone = caseTimezoneResult.timezone;
    const userTimezone = userTimezoneResult.timezone;

    // Get available dates
    const availableDates = TimezoneDisplayUtils.getAvailableDates(caseData, refreshInfo);
    let selectedDate = availableDates.length > 0 ? availableDates[0].date : new Date();
    let selectedValue = availableDates.length > 0 ? availableDates[0].value : 'now';

    // Dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.style.cssText = 'margin-bottom: 12px;';

    const dropdownLabel = document.createElement('label');
    dropdownLabel.textContent = 'Select Date:';
    dropdownLabel.style.cssText = `
      display: block;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #333;
    `;

    const dropdown = document.createElement('select');
    dropdown.style.cssText = `
      width: 100%;
      padding: 6px;
      font-size: 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
    `;

    availableDates.forEach((date) => {
      const option = document.createElement('option');
      option.value = date.value;
      option.textContent = date.label;
      dropdown.appendChild(option);
    });

    dropdownContainer.appendChild(dropdownLabel);
    dropdownContainer.appendChild(dropdown);

    // Timezones container
    const timezonesContainer = document.createElement('div');
    timezonesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    // Update functions
    const updateSummary = () => {
      const conversions = TimezoneDisplayUtils.convertToAllTimezones(selectedDate, caseTimezone, userTimezone);
      summary.textContent = `${conversions.case.time} (Case) | ${conversions.user.time} (User) | ${conversions.utc.time} (UTC)`;
    };

    const updateTimezoneDisplays = () => {
      timezonesContainer.innerHTML = '';
      const conversions = TimezoneDisplayUtils.convertToAllTimezones(selectedDate, caseTimezone, userTimezone);

      const createTimezoneDisplay = (label, conversion, isAuto = false) => {
        const tzDiv = document.createElement('div');
        tzDiv.style.cssText = `
          padding: 8px;
          background: #f8f9fa;
          border-radius: 4px;
          border-left: 3px solid #0070d2;
        `;

        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.cssText = `
          font-weight: 600;
          font-size: 12px;
          margin-bottom: 4px;
          color: #333;
        `;

        const timeEl = document.createElement('div');
        timeEl.textContent = conversion.time;
        timeEl.style.cssText = `
          font-size: 14px;
          color: #000;
          margin-bottom: 2px;
        `;

        const offsetEl = document.createElement('div');
        offsetEl.textContent = `${conversion.timezone} (${conversion.offset})`;
        offsetEl.style.cssText = `
          font-size: 11px;
          color: #666;
        `;

        tzDiv.appendChild(labelEl);
        tzDiv.appendChild(timeEl);
        tzDiv.appendChild(offsetEl);

        if (isAuto) {
          const autoIndicator = document.createElement('div');
          autoIndicator.textContent = 'Auto-detected';
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

      timezonesContainer.appendChild(createTimezoneDisplay('Case Timezone', conversions.case));
      timezonesContainer.appendChild(createTimezoneDisplay('Your Timezone', conversions.user, userTimezoneResult.isAuto));
      timezonesContainer.appendChild(createTimezoneDisplay('UTC', conversions.utc));
    };

    // Initial render
    updateSummary();
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
