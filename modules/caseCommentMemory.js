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
  urlCheckInterval: null,
  isInitialized: false,

  init() {
    // Prevent duplicate initialization
    if (this.isInitialized) {
      console.log('[CaseCommentMemory] Already initialized, skipping');
      return;
    }
    
    console.log('[CaseCommentMemory] Module initializing');
    this.isInitialized = true;
    this.startUrlMonitoring();
    this.handleUrlChange(window.location.href);
  },

  startUrlMonitoring() {
    // Clear any existing interval
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
    }
    
    this.urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.currentUrl) {
        this.handleUrlChange(currentUrl);
      }
    }, 500);
    console.log('[CaseCommentMemory] URL monitoring started');
  },

  async handleUrlChange(url) {
    console.log(`[CaseCommentMemory] URL changed: ${url}`);
    const pageInfo = this.identifyPage(url);
    
    if (!pageInfo.isRelevant) {
      console.log('[CaseCommentMemory] Not a relevant page');
      return;
    }

    console.log(`[CaseCommentMemory] Page: ${pageInfo.type}, Case: ${pageInfo.caseNumber}`);
    this.cleanup();
    this.currentUrl = url;
    this.currentCaseId = pageInfo.caseNumber;
    await this.checkPageAndLoadMemory(pageInfo);
  },

  identifyPage(url) {
    const caseViewMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/view/);
    if (caseViewMatch) {
      return { isRelevant: true, type: 'case_view', caseNumber: this.extractCaseNumber(url) };
    }
    const commentViewMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/related\/CaseComments\/view/);
    if (commentViewMatch) {
      return { isRelevant: true, type: 'comment_full_view', caseNumber: this.extractCaseNumber(url) };
    }
    return { isRelevant: false, type: null, caseNumber: null };
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

  async findButtonsAndAttachObserver(caseNumber) {
    console.log('[CaseCommentMemory] Step 4: Finding buttons');
    const createNewButton = document.querySelector('button[title=\"Create new...\"]');
    const addButton = document.querySelector('button[title=\"Ad\"]');
    
    if (createNewButton || addButton) {
      console.log('[CaseCommentMemory] Found Create new/Add button');
      this.attachRestoreButtonObserver(caseNumber, createNewButton || addButton);
      return;
    }

    const addNewCommentButton = this.findAddNewCommentButton();
    if (addNewCommentButton) {
      console.log('[CaseCommentMemory] Found Add New Comment button');
      await this.handleAddNewCommentButton(caseNumber, addNewCommentButton);
    } else {
      console.warn('[CaseCommentMemory] No buttons found, will retry');
      setTimeout(() => this.findButtonsAndAttachObserver(caseNumber), 1000);
    }
  },

  findAddNewCommentButton() {
    const buttons = document.querySelectorAll('button[type="submit"]');
    for (const button of buttons) {
      if (button.textContent.includes('Add New Comment')) {
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

  async handleAddNewCommentButton(caseNumber, addNewButton) {
    const textarea = this.getTextarea();
    if (!textarea) {
      console.warn('[CaseCommentMemory] Textarea not found');
      return;
    }
    if (textarea.dataset.caseCommentMemoryInitialized === 'true') {
      console.log('[CaseCommentMemory] Already initialized');
      return;
    }
    textarea.dataset.caseCommentMemoryInitialized = 'true';
    console.log('[CaseCommentMemory] Setting up character count and restore button');
    this.insertCharacterCounter(textarea);
    const history = await this.getHistory(caseNumber);
    if (history.length > 0) {
      console.log(`[CaseCommentMemory] Memory exists (${history.length} entries)`);
      await this.addRestoreButton(caseNumber, addNewButton);
    } else {
      console.log('[CaseCommentMemory] No memory exists');
      this.addDisabledRestoreButton(addNewButton);
    }
    await this.monitorTextarea(caseNumber, textarea);
  },

  getTextarea() {
    return document.querySelector('textarea[name=\"inputComment\"]') ||
           document.querySelector('lightning-textarea[data-id=\"inputComment\"] textarea') ||
           document.querySelector('textarea[id*=\"input-\"]');
  },

  insertCharacterCounter(textarea) {
    if (document.querySelector('.exl-character-counter')) {
      console.log('[CaseCommentMemory] Character counter already exists');
      return;
    }
    const buttonContainer = textarea.closest('.slds-form-element__control')?.nextElementSibling ||
                           textarea.parentElement?.querySelector('.slds-col_bump-left');
    if (!buttonContainer) {
      console.warn('[CaseCommentMemory] Could not find button container');
      return;
    }
    const counter = document.createElement('div');
    counter.className = 'exl-character-counter';
    counter.style.cssText = 'margin-left: 10px; font-size: 12px; color: #706e6b;';
    counter.textContent = `Characters: ${textarea.value.length}`;
    buttonContainer.insertBefore(counter, buttonContainer.firstChild);
    textarea.addEventListener('input', () => {
      counter.textContent = `Characters: ${textarea.value.length}`;
    });
    console.log('[CaseCommentMemory] Character counter inserted');
  },

  addDisabledRestoreButton(addNewButton) {
    if (document.querySelector('.exl-restore-button')) return;
    const buttonContainer = addNewButton.parentElement;
    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'slds-button slds-button_neutral exl-restore-button';
    restoreBtn.textContent = 'Restore Comment';
    restoreBtn.disabled = true;
    restoreBtn.style.marginLeft = '8px';
    buttonContainer.insertBefore(restoreBtn, addNewButton);
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
    textarea.addEventListener('input', () => this.handleTextChange(caseNumber, textarea));
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
    const allData = await this.getAllData();
    if (!allData[caseNumber]) allData[caseNumber] = [];
    allData[caseNumber].unshift({ text: text, timestamp: Date.now(), id: Date.now().toString() });
    if (allData[caseNumber].length > this.maxHistoryPerCase) {
      allData[caseNumber] = allData[caseNumber].slice(0, this.maxHistoryPerCase);
    }
    await this.saveAllData(allData);
    console.log(`[CaseCommentMemory] Saved to history for case ${caseNumber}`);
  },

  async getHistory(caseNumber) {
    const allData = await this.getAllData();
    return allData[caseNumber] || [];
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

  async addRestoreButton(caseNumber, addNewButton) {
    const existing = document.querySelector('.exl-restore-button');
    if (existing) {
      console.log('[CaseCommentMemory] Restore button already exists');
      return;
    }
    const history = await this.getHistory(caseNumber);
    if (history.length === 0) {
      this.addDisabledRestoreButton(addNewButton);
      return;
    }
    const buttonContainer = addNewButton.parentElement;
    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'slds-button slds-button_neutral exl-restore-button';
    restoreBtn.textContent = `Restore Comment (${history.length})`;
    restoreBtn.style.marginLeft = '8px';
    restoreBtn.addEventListener('click', () => this.showRestoreDialog(caseNumber));
    buttonContainer.insertBefore(restoreBtn, addNewButton);
    console.log('[CaseCommentMemory] Restore button added');
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
          const counter = document.querySelector('.exl-character-counter');
          if (counter) counter.textContent = `Characters: ${entry.text.length}`;
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
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaseCommentMemory;
}
