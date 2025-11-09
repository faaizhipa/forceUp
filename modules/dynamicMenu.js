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
  injectMenu(buttonGroups, caseData) {
    if (this.injectionSettings.cardActions) {
      this.injectIntoCardActions(buttonGroups, caseData);
    }

    if (this.injectionSettings.headerDetails) {
      this.injectIntoHeaderDetails(buttonGroups, caseData);
    }
  },

  /**
   * Injects menu into lightning-card actions slot
   * @param {Object} buttonGroups
   * @param {Object} caseData
   */
  injectIntoCardActions(buttonGroups, caseData) {
    const cardSlot = document.querySelector('lightning-card slot[name="actions"]');
    if (!cardSlot || cardSlot.querySelector('.exlibris-custom-menu')) return;

    const menuContainer = this.createMenuContainer('card');
    this.populateMenu(menuContainer, buttonGroups, caseData);

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
  injectIntoHeaderDetails(buttonGroups, caseData) {
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
    this.populateMenu(menuContainer, buttonGroups, caseData);

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
        this.injectIntoHeaderDetails(this.lastButtonGroups, this.lastCaseData);
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
  populateMenu(container, buttonGroups, caseData) {
    const readiness = this.evaluateReadiness(caseData);

    if (buttonGroups.analyticsRefresh) {
      const refreshInfo = this.createRefreshInfo(buttonGroups.analyticsRefresh);
      container.appendChild(refreshInfo);
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
   * Creates analytics refresh info display
   * @param {Object} refreshInfo
   * @returns {HTMLElement}
   */
  createRefreshInfo(refreshInfo) {
    const container = document.createElement('div');
    container.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 6px;
      margin-bottom: 12px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Next Analytics Refresh';
    title.style.cssText = `
      font-weight: bold;
      font-size: 12px;
      color: #666;
      margin-bottom: 6px;
    `;

    const times = document.createElement('div');
    times.style.cssText = `
      display: flex;
      gap: 16px;
      font-size: 13px;
    `;

    const utcTime = document.createElement('div');
    utcTime.innerHTML = `<strong>UTC:</strong> ${refreshInfo.utc}`;

    const localTime = document.createElement('div');
    localTime.innerHTML = `<strong>Local:</strong> ${refreshInfo.local}`;

    if (refreshInfo.isAuto) {
      localTime.style.position = 'relative';
      const autoIndicator = document.createElement('span');
      autoIndicator.textContent = '(auto)';
      autoIndicator.style.cssText = `
        color: #ff6b35;
        font-size: 11px;
        margin-left: 6px;
        cursor: help;
      `;
      autoIndicator.title = 'Timezone automatically detected. Set your timezone in the extension popup for consistency.';
      localTime.appendChild(autoIndicator);
    }

    times.appendChild(utcTime);
    times.appendChild(localTime);

    container.appendChild(title);
    container.appendChild(times);

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
  refresh(buttonGroups, caseData) {
    this.removeAllMenus();
    this.injectMenu(buttonGroups, caseData);
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DynamicMenu;
}
