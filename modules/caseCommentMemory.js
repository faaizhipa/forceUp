/**
 * Case Comment Memory Module - Complete Rewrite
 * Auto-saves case comments and maintains history
 * 
 * URL-driven workflow with proper state management
 */

const CaseCommentMemory = {
  storageKey: 'caseCommentMemory',
  maxHistoryPerCase: 10,
  inactivityTimeout: 5 * 60 * 1000,
  activeEntries: new Map(),
  saveThrottleTimers: new Map(),
  currentCaseId: null,
  currentUrl: null,
  observers: [],
  isInitialized: false,
  characterCounterObserver: null,
  currentStorageKey: null,

  init() {
    // Prevent duplicate initialization
    if (this.isInitialized) {
      console.log('[CaseCommentMemory] Already initialized, skipping');
      return;
    }
    
    console.log('[CaseCommentMemory] Module initializing');
    this.isInitialized = true;
    
    // Use PageIdentifier to monitor page changes instead of polling
    if (typeof PageIdentifier !== 'undefined' && typeof PageIdentifier.monitorPageChanges === 'function') {
      console.log('[CaseCommentMemory] Using PageIdentifier for page monitoring');
      PageIdentifier.monitorPageChanges((pageInfo) => {
        this.handlePageChange(pageInfo);
      });
    } else {
      console.warn('[CaseCommentMemory] PageIdentifier not available, module will not function');
    }
  },

  async handlePageChange(pageInfo) {
    // Only handle case detail pages and case comment full view pages
    const url = window.location.href;
    const isCaseView = pageInfo.type === 'case_detail' && url.includes('/view');
    const isCommentView = url.includes('/related/CaseComments/view');
    
    if (!isCaseView && !isCommentView) {
      // Not a relevant page, cleanup and exit
      this.cleanup();
      this.currentUrl = null;
      this.currentCaseId = null;
      return;
    }

    console.log(`[CaseCommentMemory] Page changed: ${pageInfo.type}, URL: ${url}`);
    
    // Extract case number from page
    const caseNumber = this.extractCaseNumber(url);
    if (!caseNumber) {
      console.warn('[CaseCommentMemory] Could not determine case number');
      return;
    }

    const resolvedIdentifier = this.resolveCaseIdentifier(caseNumber);

    // Cleanup previous state before handling new page
    this.cleanup();
    this.currentUrl = url;
    this.currentCaseId = resolvedIdentifier || caseNumber;
    this.currentStorageKey = null;
    
    // Determine page type and handle accordingly
    const pageType = isCommentView ? 'comment_full_view' : 'case_view';
    await this.checkPageAndLoadMemory({ type: pageType, caseNumber: this.currentCaseId });
  },

  extractCaseNumber(url) {
    const titleElement = document.querySelector('title');
    if (titleElement) {
      const titleMatch = titleElement.textContent.match(/^(\d{8})/);
      if (titleMatch) return titleMatch[1];
    }
    const header = document.querySelector('slot[name=\"primaryField\"] lightning-formatted-text');
    if (header) {
      const headerMatch = header.textContent.match(/^(\d{8})/);
      if (headerMatch) return headerMatch[1];
    }
    const urlMatch = url.match(/\/Case\/([^\/]+)/);
    if (urlMatch) return urlMatch[1];
    return null;
  },

  getCaseIdFromUrl() {
    const pathMatch = window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})/i);
    if (pathMatch) return pathMatch[1];
    const lightningMatch = window.location.pathname.match(/\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})/i);
    if (lightningMatch) return lightningMatch[1];
    return null;
  },

  resolveCaseIdentifier(fallback) {
    const caseId = this.getCaseIdFromUrl();
    if (caseId && caseId !== fallback) {
      console.log(`[CaseCommentMemory] Using case ID from URL (${caseId}) instead of fallback (${fallback})`);
      return caseId;
    }
    return fallback;
  },

  async resolveHistory(caseIdentifier) {
    const allData = await this.getAllData();
    const urlCaseId = this.getCaseIdFromUrl();
    const candidates = [];
    if (urlCaseId) candidates.push(urlCaseId);
    if (caseIdentifier && !candidates.includes(caseIdentifier)) {
      candidates.push(caseIdentifier);
    }
    for (const key of candidates) {
      if (key && allData[key]) {
        return { key, history: allData[key] };
      }
    }
    const primaryKey = candidates[0] || caseIdentifier || urlCaseId || null;
    return { key: primaryKey, history: primaryKey && allData[primaryKey] ? allData[primaryKey] : [] };
  },

  async checkPageAndLoadMemory(pageInfo) {
    const caseNumber = pageInfo.caseNumber;
    if (!caseNumber) {
      console.warn('[CaseCommentMemory] Could not determine case number');
      return;
    }
    const history = await this.getHistory(caseNumber);
    console.log(`[CaseCommentMemory] Case ${caseNumber} has ${history.length} saved comments in memory`);
    
    if (pageInfo.type === 'case_view') {
      await this.handleCaseView(caseNumber);
    } else if (pageInfo.type === 'comment_full_view') {
      await this.handleCommentView(caseNumber);
    }
  },

  async handleCaseView(caseNumber) {
    console.log('[CaseCommentMemory] Handling case view page');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (this.isCommunicationTabActive()) {
      console.log('[CaseCommentMemory] Communication tab is active');
      await this.proceedToStep3(caseNumber);
    } else {
      console.log('[CaseCommentMemory] Communication tab not active, attaching trigger');
      this.attachCommunicationTabTrigger(caseNumber);
    }
  },

  async handleCommentView(caseNumber) {
    console.log('[CaseCommentMemory] Handling comment full page view');
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.findButtonsAndAttachObserver(caseNumber);
  },

  async proceedToStep3(caseNumber) {
    console.log('[CaseCommentMemory] Step 3: Querying for Case Comments tab');
    const targetTab = document.querySelector('#tab-38 > slot > flexipage-component2:nth-child(1) > slot > flexipage-aura-wrapper > div > div > div > div > ul > li.tabs__item.active.uiTabItem');
    
    if (targetTab && targetTab.classList.contains('active')) {
      const anchor = targetTab.querySelector('a[title=\"Case Comments\"]');
      if (anchor) {
        console.log('[CaseCommentMemory] Case Comments tab is active');
        await this.findButtonsAndAttachObserver(caseNumber);
        return;
      }
    }
    
    console.log('[CaseCommentMemory] Using fallback: checking all tab items');
    this.findAndAttachCaseCommentsTab(caseNumber);
  },

  findAndAttachCaseCommentsTab(caseNumber) {
    const tabContainers = document.querySelectorAll('ul.tabs__nav, ul[role=\"tablist\"]');
    
    for (const ul of tabContainers) {
      const tabs = ul.querySelectorAll('li');
      for (const tab of tabs) {
        const anchor = tab.querySelector('a[title=\"Case Comments\"]');
        if (anchor) {
          console.log('[CaseCommentMemory] Found Case Comments tab');
          if (tab.classList.contains('active')) {
            this.findButtonsAndAttachObserver(caseNumber);
          } else {
            anchor.addEventListener('click', async () => {
              console.log('[CaseCommentMemory] Case Comments tab clicked');
              await new Promise(resolve => setTimeout(resolve, 800));
              await this.findButtonsAndAttachObserver(caseNumber);
            }, { once: false });
          }
          return;
        }
      }
    }
    console.warn('[CaseCommentMemory] Could not find Case Comments tab');
  },

  attachCommunicationTabTrigger(caseNumber) {
    const commTab = document.querySelector('li[data-label=\"Communication\"]');
    if (commTab) {
      const link = commTab.querySelector('a');
      if (link) {
        console.log('[CaseCommentMemory] Attached trigger to Communication tab');
        link.addEventListener('click', async () => {
          console.log('[CaseCommentMemory] Communication tab clicked');
          await new Promise(resolve => setTimeout(resolve, 800));
          await this.proceedToStep3(caseNumber);
        }, { once: false });
      }
    } else {
      console.warn('[CaseCommentMemory] Could not find Communication tab');
    }
  },

  isCommunicationTabActive() {
    const activeTab = document.querySelector('li.slds-tabs_default__item.slds-is-active[data-label=\"Communication\"]');
    return !!activeTab;
  },

  /**
   * Check if element is visible
   * @param {Element} element
   * @returns {boolean}
   */
  isElementVisible(element) {
    if (!element) return false;
    
    // Check element and all parents for display:none or visibility:hidden
    let el = element;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      el = el.parentElement;
    }
    
    // Check element has dimensions
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  findCaseCommentsContainer() {
    const explicitTableSelector = '#tab-12 > slot > flexipage-component2:nth-child(2) > slot > lst-related-list-single-container > laf-progressive-container > slot > lst-related-list-single-aura-wrapper > div > div > div > div > div > div > div.slds-col.slds-no-space.forceListViewManagerPrimaryDisplayManager > div.autoHeight.col-3-wrap.hideSelection.forceListViewManagerGrid > div.listViewContent.slds-table--header-fixed_container.slds-table_header-fixed_container > div.uiScroller.scroller-wrapper.scroll-bidirectional.native > div > div > table';
    const explicitTable = document.querySelector(explicitTableSelector);
    if (explicitTable && this.isElementVisible(explicitTable)) {
      return explicitTable.closest('div.forceListViewManager') ||
             explicitTable.closest('lst-related-list-single-container') ||
             explicitTable.closest('.slds-card') ||
             explicitTable.parentElement;
    }

    const selectors = [
      'div.forceListViewManager',
      'div.test-listViewManager',
      'lst-list-view-manager',
      'lst-related-list-single-container',
      'div.forceRelatedListSingleContainer',
      'div[aria-label*="Case Comments"]',
      '.related_list_container[id*="CaseComments"]',
      '.slds-card',
      '.listViewContent'
    ];

    const matchesCaseComments = (element) => {
      if (!element) return false;
      const sources = [
        element.getAttribute('title'),
        element.getAttribute('aria-label'),
        element.getAttribute('data-label'),
        element.textContent ? element.textContent.substring(0, 500) : ''
      ].filter(Boolean).map(str => str.trim().toLowerCase());
      return sources.some(text => text.includes('case comments'));
    };

    for (const selector of selectors) {
      const candidates = document.querySelectorAll(selector);
      for (const candidate of candidates) {
        if (!this.isElementVisible(candidate)) continue;
        if (matchesCaseComments(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  },

  findCaseCommentsActionContainer(container = null) {
    const root = container || this.findCaseCommentsContainer();
    if (!root) return null;

    const selectors = [
      '.branding-actions.slds-button-group',
      '.actionsWrapper .branding-actions',
      '.slds-button-group.forceActionsContainer',
      '.slds-button-group[data-target-selection-name]',
      '.slds-card__header .slds-button-group',
      '.slds-page-header .slds-button-group',
      'lst-list-view-manager-header .slds-button-group'
    ];

    const searchRoots = [
      root,
      root.parentElement,
      root.closest('.slds-card'),
      root.closest('.container'),
      root.closest('flexipage-component2')
    ].filter(Boolean);

    for (const searchRoot of searchRoots) {
      for (const selector of selectors) {
        const nodes = searchRoot.querySelectorAll(selector);
        for (const node of nodes) {
          if (!this.isElementVisible(node)) continue;
          return node;
        }
      }
    }

    return null;
  },

  findCaseCommentsLayoutContext() {
    const container = this.findCaseCommentsContainer();
    if (!container) return null;
    const textarea = this.getTextarea();
    const buttonContainer = this.findCaseCommentsActionContainer(container);
    if (textarea && this.isElementVisible(textarea) && buttonContainer) {
      return { container, textarea, buttonContainer };
    }
    return null;
  },

  async trySetupFromCharacterCounter(caseNumber) {
    const counter = document.querySelector('.case-comment-character-counter');
    if (counter && this.isElementVisible(counter)) {
      await this.setupFromCharacterCounter(counter, caseNumber);
      return true;
    }

    if (this.characterCounterObserver) {
      this.characterCounterObserver.disconnect();
    }

    this.characterCounterObserver = new MutationObserver(async () => {
      const detected = document.querySelector('.case-comment-character-counter');
      if (detected && this.isElementVisible(detected)) {
        if (this.characterCounterObserver) {
          this.characterCounterObserver.disconnect();
          this.characterCounterObserver = null;
        }
        await this.setupFromCharacterCounter(detected, caseNumber);
      }
    });

    this.characterCounterObserver.observe(document.body, { childList: true, subtree: true });
    return false;
  },

  async setupFromCharacterCounter(counterElement, caseNumber) {
    const lightningButton = counterElement.closest('lightning-button') || counterElement.parentElement;
    const addNewButton = lightningButton?.querySelector('button');
    const layoutContext = {
      textarea: this.getTextarea(),
      buttonContainer: lightningButton || counterElement.parentElement || this.findCaseCommentsActionContainer()
    };

    if (!layoutContext.buttonContainer) {
      console.warn('[CaseCommentMemory] Character counter detected but no button container found');
      return;
    }

    console.log('[CaseCommentMemory] Character counter detected, initializing restore button via counter context');
    await this.handleAddNewCommentButton(caseNumber, addNewButton || null, layoutContext);
  },

  async findButtonsAndAttachObserver(caseNumber) {
    console.log('[CaseCommentMemory] Step 4: Finding buttons');

    if (await this.trySetupFromCharacterCounter(caseNumber)) {
      return;
    }
    
    // Check for "Create new..." button (with visibility check)
    let createNewButton = null;
    const createNewButtons = document.querySelectorAll('button[title=\"Create new...\"]');
    for (const button of createNewButtons) {
      if (this.isElementVisible(button)) {
        createNewButton = button;
        break;
      }
    }
    
    // Check for "Ad" button (with visibility check)
    let addButton = null;
    const addButtons = document.querySelectorAll('button[title=\"Ad\"]');
    for (const button of addButtons) {
      if (this.isElementVisible(button)) {
        addButton = button;
        break;
      }
    }
    
    // Also check for "New" button in actions wrapper (with visibility check)
    let newButton = null;
    const actionLinks = document.querySelectorAll('div.slds-align_absolute-center > div > ul > li > a');
    for (const link of actionLinks) {
      if (!this.isElementVisible(link)) continue;
      
      const divElement = link.querySelector('div');
      if (divElement && divElement.textContent.trim() === 'New') {
        newButton = link;
        break;
      }
    }
    
    if (createNewButton || addButton || newButton) {
      console.log('[CaseCommentMemory] Found visible Create new/Add/New button');
      this.attachRestoreButtonObserver(caseNumber, createNewButton || addButton || newButton);
      return;
    }

    const addNewCommentButton = this.findAddNewCommentButton();
    if (addNewCommentButton) {
      console.log('[CaseCommentMemory] Found Add New Comment button');
      await this.handleAddNewCommentButton(caseNumber, addNewCommentButton);
      return;
    }

    const layoutContext = this.findCaseCommentsLayoutContext();
    if (layoutContext) {
      console.log('[CaseCommentMemory] Using Case Comments layout context as fallback');
      await this.handleAddNewCommentButton(caseNumber, null, layoutContext);
      return;
    }

    console.warn('[CaseCommentMemory] No visible buttons found, will retry');
    setTimeout(() => this.findButtonsAndAttachObserver(caseNumber), 1000);
  },

  findAddNewCommentButton() {
    const scope = this.findCaseCommentsContainer() || document;
    const buttons = scope.querySelectorAll('button[type="submit"], lightning-button button');
    for (const button of buttons) {
      if (this.isElementVisible(button) && button.textContent.includes('Add New Comment')) {
        return button;
      }
    }
    return null;
  },

  attachRestoreButtonObserver(caseNumber, button) {
    if (button.dataset.caseCommentObserverAttached) {
      console.log('[CaseCommentMemory] Observer already attached');
      return;
    }
    button.dataset.caseCommentObserverAttached = 'true';
    button.addEventListener('click', async () => {
      console.log('[CaseCommentMemory] Create new/Add button clicked');
      await new Promise(resolve => setTimeout(resolve, 500));
      const textarea = this.getTextarea();
      const addNewButton = this.findAddNewCommentButton();
      if (textarea && addNewButton) {
        await this.handleAddNewCommentButton(caseNumber, addNewButton);
      }
    });
    console.log('[CaseCommentMemory] Observer attached to button');
  },

  async handleAddNewCommentButton(caseNumber, addNewButton, layoutContext = null) {
    const context = layoutContext || this.findCaseCommentsLayoutContext();
    const textarea = context?.textarea || this.getTextarea();
    if (!textarea) {
      console.warn('[CaseCommentMemory] Textarea not found');
      return;
    }
    if (textarea.dataset.caseCommentMemoryInitialized === 'true') {
      console.log('[CaseCommentMemory] Already initialized');
      return;
    }
    textarea.dataset.caseCommentMemoryInitialized = 'true';
    const resolvedCaseId = this.resolveCaseIdentifier(caseNumber) || caseNumber;
    console.log('[CaseCommentMemory] Preparing restore controls');
    const buttonContainer = this.getButtonContainer(textarea, addNewButton, context);
    if (!buttonContainer) {
      console.warn('[CaseCommentMemory] Unable to locate button container');
      return;
    }
    this.ensureButtonContainerLayout(buttonContainer);
    const history = await this.getHistory(resolvedCaseId, true);
    if (history.length > 0) {
      console.log(`[CaseCommentMemory] Memory exists (${history.length} entries)`);
      await this.addRestoreButton(resolvedCaseId, buttonContainer);
    } else {
      console.log('[CaseCommentMemory] No memory exists');
      this.addDisabledRestoreButton(buttonContainer);
    }
    await this.monitorTextarea(resolvedCaseId, textarea);
  },

  getTextarea() {
    return document.querySelector('textarea[name=\"inputComment\"]') ||
           document.querySelector('lightning-textarea[data-id=\"inputComment\"] textarea') ||
           document.querySelector('textarea[id*=\"input-\"]');
  },

  getButtonContainer(textarea, actionButton, layoutContext) {
    if (layoutContext?.buttonContainer) {
      return layoutContext.buttonContainer;
    }
    if (actionButton && actionButton.parentElement) {
      return actionButton.parentElement;
    }
    const fallback =
      textarea.closest('.slds-form-element__control')?.nextElementSibling ||
      textarea.parentElement?.querySelector('.slds-col_bump-left') ||
      textarea.closest('.slds-grid')?.querySelector('.slds-grid_align-end') ||
      textarea.parentElement?.parentElement ||
      textarea.parentElement;

    if (fallback) {
      return fallback;
    }

    return this.findCaseCommentsActionContainer();
  },

  ensureButtonContainerLayout(container) {
    if (!container || container.tagName === 'UL' || container.tagName === 'OL') return;
    const computed = window.getComputedStyle(container);
    if (computed.display !== 'flex') {
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.gap = '8px';
    }
  },

  createRestoreButtonElements(buttonContainer) {
    const isList = buttonContainer && (buttonContainer.tagName === 'UL' || buttonContainer.tagName === 'OL');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slds-button slds-button_neutral exl-restore-button';
    button.style.marginLeft = isList ? '0' : '8px';

    let wrapper;
    if (isList) {
      wrapper = document.createElement('li');
      wrapper.className = 'slds-button slds-button_neutral exl-restore-button-wrapper';
      wrapper.appendChild(button);
    } else {
      wrapper = button;
      wrapper.classList.add('exl-restore-button-wrapper');
    }

    return { wrapper, button };
  },

  insertRestoreElement(buttonContainer, element) {
    if (!buttonContainer || !element) return;
    if (buttonContainer.firstChild) {
      buttonContainer.insertBefore(element, buttonContainer.firstChild);
    } else {
      buttonContainer.appendChild(element);
    }
  },

  addDisabledRestoreButton(buttonContainer) {
    if (!buttonContainer) return;
    if (buttonContainer.querySelector('.exl-restore-button-wrapper')) return;
    const { wrapper, button } = this.createRestoreButtonElements(buttonContainer);
    button.textContent = 'Restore Comment';
    button.disabled = true;
    this.insertRestoreElement(buttonContainer, wrapper);
    console.log('[CaseCommentMemory] Disabled restore button added');
  },

  async monitorTextarea(caseNumber, textarea) {
    console.log('[CaseCommentMemory] Setting up textarea monitoring');
    const activeEntry = this.activeEntries.get(caseNumber);
    if (activeEntry && activeEntry.isActive && activeEntry.text) {
      textarea.value = activeEntry.text;
      console.log('[CaseCommentMemory] Restored previous text');
    }
    
    textarea.addEventListener('focus', () => this.activateEntry(caseNumber, textarea));
    
    // Debounce text change handler to reduce storage writes
    const debouncedHandleTextChange = DebounceUtils.debounce(() => {
      this.handleTextChange(caseNumber, textarea);
    }, 300); // Wait 300ms after user stops typing
    
    textarea.addEventListener('input', debouncedHandleTextChange);
    this.monitorSaveButton(caseNumber);
    console.log('[CaseCommentMemory] Textarea monitoring set up');
  },

  activateEntry(caseNumber, textarea) {
    const currentText = textarea.value.trim();
    let entry = this.activeEntries.get(caseNumber);
    if (!entry || !entry.isActive) {
      entry = { text: currentText, timestamp: Date.now(), timerId: null, isActive: true };
      this.activeEntries.set(caseNumber, entry);
    }
    this.resetInactivityTimer(caseNumber);
    console.log(`[CaseCommentMemory] Entry activated for case ${caseNumber}`);
  },

  handleTextChange(caseNumber, textarea) {
    const text = textarea.value;
    if (text.trim() === '' && this.activeEntries.has(caseNumber)) {
      const entry = this.activeEntries.get(caseNumber);
      if (entry.text.trim() !== '') {
        this.closeEntry(caseNumber, entry.text);
        return;
      }
    }
    this.throttledSave(caseNumber, text);
    this.resetInactivityTimer(caseNumber);
  },

  throttledSave(caseNumber, text) {
    if (this.saveThrottleTimers.has(caseNumber)) {
      clearTimeout(this.saveThrottleTimers.get(caseNumber));
    }
    const timerId = setTimeout(() => {
      this.saveActiveEntry(caseNumber, text);
      this.saveThrottleTimers.delete(caseNumber);
    }, 500);
    this.saveThrottleTimers.set(caseNumber, timerId);
  },

  saveActiveEntry(caseNumber, text) {
    const entry = this.activeEntries.get(caseNumber);
    if (!entry) return;
    entry.text = text;
    entry.timestamp = Date.now();
    console.log(`[CaseCommentMemory] Auto-saved for case ${caseNumber} (${text.length} chars)`);
  },

  resetInactivityTimer(caseNumber) {
    const entry = this.activeEntries.get(caseNumber);
    if (!entry) return;
    if (entry.timerId) clearTimeout(entry.timerId);
    entry.timerId = setTimeout(() => this.pauseEntry(caseNumber), this.inactivityTimeout);
  },

  async pauseEntry(caseNumber) {
    const entry = this.activeEntries.get(caseNumber);
    if (!entry || !entry.isActive) return;
    if (entry.text.trim() !== '') {
      await this.saveToHistory(caseNumber, entry.text);
      console.log(`[CaseCommentMemory] Entry paused and saved to history for case ${caseNumber}`);
    }
    entry.isActive = false;
  },

  async closeEntry(caseNumber, text) {
    if (text.trim() !== '') {
      await this.saveToHistory(caseNumber, text);
    }
    this.activeEntries.delete(caseNumber);
    console.log(`[CaseCommentMemory] Entry closed for case ${caseNumber}`);
  },

  monitorSaveButton(caseNumber) {
    const saveButton = this.findAddNewCommentButton();
    if (saveButton && !saveButton.dataset.caseCommentSaveMonitored) {
      saveButton.dataset.caseCommentSaveMonitored = 'true';
      saveButton.addEventListener('click', () => {
        const entry = this.activeEntries.get(caseNumber);
        if (entry && entry.text.trim() !== '') {
          this.closeEntry(caseNumber, entry.text);
        }
      });
    }
  },

  async saveToHistory(caseNumber, text) {
    if (!text.trim()) return;
    const caseKey = this.currentStorageKey || this.resolveCaseIdentifier(caseNumber) || caseNumber;
    if (!caseKey) return;
    const allData = await this.getAllData();
    if (!allData[caseKey]) allData[caseKey] = [];
    allData[caseKey].unshift({ text: text, timestamp: Date.now(), id: Date.now().toString() });
    if (allData[caseKey].length > this.maxHistoryPerCase) {
      allData[caseKey] = allData[caseKey].slice(0, this.maxHistoryPerCase);
    }
    await this.saveAllData(allData);
    console.log(`[CaseCommentMemory] Saved to history for case ${caseKey}`);
  },

  async getHistory(caseIdentifier, trackKey = false) {
    const resolved = await this.resolveHistory(caseIdentifier);
    if (trackKey && resolved.key) {
      this.currentStorageKey = resolved.key;
    }
    return resolved.history;
  },

  async getAllData() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.storageKey], (result) => {
        resolve(result[this.storageKey] || {});
      });
    });
  },

  async saveAllData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.storageKey]: data }, resolve);
    });
  },

  async addRestoreButton(caseNumber, buttonContainer) {
    if (!buttonContainer) return;
    const history = await this.getHistory(caseNumber);
    if (history.length === 0) {
      this.addDisabledRestoreButton(buttonContainer);
      return;
    }

    let wrapper = buttonContainer.querySelector('.exl-restore-button-wrapper');
    let restoreBtn = wrapper?.querySelector('.exl-restore-button');

    if (!wrapper || !restoreBtn) {
      const created = this.createRestoreButtonElements(buttonContainer);
      wrapper = created.wrapper;
      restoreBtn = created.button;
      restoreBtn.addEventListener('click', () => this.showRestoreDialog(caseNumber));
      this.insertRestoreElement(buttonContainer, wrapper);
    }

    restoreBtn.disabled = false;
    restoreBtn.textContent = `Restore Comment (${history.length})`;
    console.log('[CaseCommentMemory] Restore button added/updated');
  },

  async showRestoreDialog(caseNumber) {
    const history = await this.getHistory(caseNumber);
    if (history.length === 0) {
      alert('No saved comments found for this case.');
      return;
    }
    const modal = document.createElement('div');
    modal.className = 'exl-restore-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: white; border-radius: 8px; padding: 20px; max-width: 600px; max-height: 80%; overflow-y: auto; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);';
    const title = document.createElement('h2');
    title.textContent = 'Restore Comment';
    title.style.marginBottom = '16px';
    const list = document.createElement('div');
    list.style.cssText = 'margin-bottom: 16px;';
    history.forEach((entry, index) => {
      const item = document.createElement('div');
      item.style.cssText = 'border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 8px; cursor: pointer;';
      item.innerHTML = `<div style="font-size: 12px; color: #666; margin-bottom: 4px;">${new Date(entry.timestamp).toLocaleString()}</div><div style="white-space: pre-wrap; word-break: break-word;">${this.escapeHtml(entry.text.substring(0, 200))}${entry.text.length > 200 ? '...' : ''}</div>`;
      item.addEventListener('click', () => {
        const textarea = this.getTextarea();
        if (textarea) {
          textarea.value = entry.text;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.body.removeChild(modal);
      });
      list.appendChild(item);
    });
    const closeBtn = document.createElement('button');
    closeBtn.className = 'slds-button slds-button_neutral';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => document.body.removeChild(modal));
    modalContent.appendChild(title);
    modalContent.appendChild(list);
    modalContent.appendChild(closeBtn);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  cleanup() {
    console.log('[CaseCommentMemory] Cleaning up previous state');
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.saveThrottleTimers.forEach(timer => clearTimeout(timer));
    this.saveThrottleTimers.clear();
    this.activeEntries.forEach((entry, caseId) => {
      if (entry.timerId) clearTimeout(entry.timerId);
    });
    if (this.characterCounterObserver) {
      this.characterCounterObserver.disconnect();
      this.characterCounterObserver = null;
    }
    this.currentStorageKey = null;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaseCommentMemory;
}
