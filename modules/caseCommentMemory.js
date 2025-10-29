/**
 * Case Comment Memory Module
 * Auto-saves case comments and maintains history
 */

const CaseCommentMemory = {
  storageKey: 'caseCommentMemory',
  maxHistoryPerCase: 10,
  inactivityTimeout: 5 * 60 * 1000, // 5 minutes
  activeEntries: new Map(), // caseId -> { text, timestamp, timerId, isActive }
  saveThrottleTimers: new Map(),

  /**
   * Initializes the comment memory system for a case
   * @param {string} caseId
   */
  async init(caseId) {
    if (!caseId) return;

    console.log(`[CaseCommentMemory] Initializing for case ${caseId}`);

    // Load existing history
    await this.loadHistory(caseId);

    // Set up monitoring with tab detection
    await this.setupMonitoring(caseId);
  },

  /**
   * Sets up all monitoring including tab changes
   * @param {string} caseId
   */
  async setupMonitoring(caseId) {
    // Try to set up textarea monitoring immediately if Communication tab is active
    if (this.isCommunicationTabActive()) {
      await this.monitorTextarea(caseId);
    }

    // Monitor for tab changes
    this.monitorTabChanges(caseId);

    // Monitor for textarea appearance (in case it's added dynamically)
    this.monitorTextareaAppearance(caseId);
  },

  /**
   * Monitors for tab changes to re-inject buttons
   * @param {string} caseId
   */
  monitorTabChanges(caseId) {
    // Find the tab bar
    const tabBar = document.querySelector('ul.slds-tabs_default__nav[role="tablist"]');
    if (!tabBar) {
      console.warn('[CaseCommentMemory] Tab bar not found, retrying...');
      setTimeout(() => this.monitorTabChanges(caseId), 1000);
      return;
    }

    // Listen for clicks on Communication tab
    const commTab = tabBar.querySelector('li[data-label="Communication"]');
    if (commTab) {
      const link = commTab.querySelector('a');
      if (link) {
        link.addEventListener('click', async () => {
          console.log('[CaseCommentMemory] Communication tab clicked');
          // Wait a bit for tab content to load
          setTimeout(async () => {
            await this.monitorTextarea(caseId);
          }, 500);
        });
      }
    }

    // Use MutationObserver to detect tab activation
    const observer = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target;
          if (target.classList.contains('slds-is-active') && 
              target.getAttribute('data-label') === 'Communication') {
            console.log('[CaseCommentMemory] Communication tab became active');
            setTimeout(async () => {
              await this.monitorTextarea(caseId);
            }, 500);
          }
        }
      }
    });

    const tabs = tabBar.querySelectorAll('li.slds-tabs_default__item');
    tabs.forEach(tab => {
      observer.observe(tab, { attributes: true });
    });

    console.log('[CaseCommentMemory] Tab change monitoring set up');
  },

  /**
   * Monitors for textarea appearance in the DOM
   * Only starts monitoring after specific buttons are clicked
   * @param {string} caseId
   */
  monitorTextareaAppearance(caseId) {
    let observer = null;
    
    // Function to start monitoring for textarea
    const startTextareaMonitoring = () => {
      console.log('[CaseCommentMemory] Button clicked, starting textarea monitoring');
      
      // Create observer if it doesn't exist
      if (!observer) {
        observer = new MutationObserver(async (mutations) => {
          // Check if Communication tab is active
          if (!this.isCommunicationTabActive()) return;

          // Check if textarea is now available
          const textarea = this.getTextarea();
          if (textarea && !textarea.dataset.caseCommentMemoryInitialized) {
            console.log('[CaseCommentMemory] Textarea appeared, setting up monitoring');
            await this.monitorTextarea(caseId);
            // Once textarea is set up, disconnect observer
            observer.disconnect();
            observer = null;
          }
        });

        // Observe the main content area
        const mainContent = document.querySelector('.slds-template__content') || document.body;
        observer.observe(mainContent, {
          childList: true,
          subtree: true
        });
      }
    };

    // Function to attach click listeners to target buttons
    const attachButtonListeners = () => {
      const createButton = document.querySelector('button[title="Create new..."]');
      const adButton = document.querySelector('button[title="Ad"]');

      if (createButton && !createButton.dataset.caseCommentListenerAttached) {
        createButton.addEventListener('click', startTextareaMonitoring);
        createButton.dataset.caseCommentListenerAttached = 'true';
        console.log('[CaseCommentMemory] Listener attached to "Create new..." button');
      }

      if (adButton && !adButton.dataset.caseCommentListenerAttached) {
        adButton.addEventListener('click', startTextareaMonitoring);
        adButton.dataset.caseCommentListenerAttached = 'true';
        console.log('[CaseCommentMemory] Listener attached to "Ad" button');
      }

      // If buttons not found yet, retry
      if (!createButton || !adButton) {
        setTimeout(attachButtonListeners, 500);
      }
    };

    // Start attaching button listeners
    attachButtonListeners();

    console.log('[CaseCommentMemory] Textarea appearance monitoring configured (waiting for button clicks)');
  },

  /**
   * Gets the textarea element
   * @returns {HTMLTextAreaElement|null}
   */
  getTextarea() {
    // Try multiple selectors
    return document.querySelector('textarea[name="inputComment"]') ||
           document.querySelector('lightning-textarea[data-id="inputComment"] textarea') ||
           document.querySelector('textarea[id*="input-"]');
  },

  /**
   * Checks if Communication tab is active
   * @returns {boolean}
   */
  isCommunicationTabActive() {
    const activeTab = document.querySelector('li.slds-tabs_default__item.slds-is-active[data-label="Communication"]');
    return !!activeTab;
  },

  /**
   * Waits for Communication tab to be active and textarea to be available
   * @returns {Promise<HTMLTextAreaElement>}
   */
  waitForCommunicationTab() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkTab = () => {
        attempts++;
        
        if (this.isCommunicationTabActive()) {
          const textarea = this.getTextarea();
          if (textarea) {
            resolve(textarea);
            return;
          }
        }
        
        if (attempts >= maxAttempts) {
          reject(new Error('Communication tab or textarea not found'));
          return;
        }
        
        setTimeout(checkTab, 200);
      };
      
      checkTab();
    });
  },

  /**
   * Monitors textarea for changes
   * @param {string} caseId
   */
  async monitorTextarea(caseId) {
    const textarea = this.getTextarea();
    if (!textarea) {
      console.warn('[CaseCommentMemory] Textarea not found yet');
      return;
    }

    // Check if already initialized for this textarea
    if (textarea.dataset.caseCommentMemoryInitialized === 'true') {
      console.log('[CaseCommentMemory] Textarea already initialized, skipping');
      return;
    }

    // Mark as initialized
    textarea.dataset.caseCommentMemoryInitialized = 'true';
    console.log('[CaseCommentMemory] Setting up textarea monitoring');

    // Check if there's an active entry for this case
    const activeEntry = this.activeEntries.get(caseId);
    if (activeEntry && activeEntry.isActive && activeEntry.text) {
      // Restore the last saved text
      textarea.value = activeEntry.text;
      console.log('[CaseCommentMemory] Restored previous text to textarea');
    }

    // Listen for focus (activation)
    textarea.addEventListener('focus', () => {
      this.activateEntry(caseId, textarea);
    });

    // Listen for input changes
    textarea.addEventListener('input', () => {
      this.handleTextChange(caseId, textarea);
    });

    // Listen for save button click
    this.monitorSaveButton(caseId);

    // Add restore button
    await this.addRestoreButton(caseId);

    // Listen for page visibility changes
    if (!document.hasVisibilityChangeListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pauseEntry(caseId);
        } else {
          this.resumeEntry(caseId);
        }
      });
      document.hasVisibilityChangeListener = true;
    }

    console.log('[CaseCommentMemory] Textarea monitoring fully set up');
  },

  /**
   * Activates a new entry or resumes existing one
   * @param {string} caseId
   * @param {HTMLTextAreaElement} textarea
   */
  activateEntry(caseId, textarea) {
    const currentText = textarea.value.trim();

    let entry = this.activeEntries.get(caseId);

    if (!entry || !entry.isActive) {
      // Create new active entry
      entry = {
        text: currentText,
        timestamp: Date.now(),
        timerId: null,
        isActive: true
      };
      this.activeEntries.set(caseId, entry);
    }

    // Reset inactivity timer
    this.resetInactivityTimer(caseId);

    console.log(`[CaseCommentMemory] Entry activated for case ${caseId}`);
  },

  /**
   * Handles text changes in textarea
   * @param {string} caseId
   * @param {HTMLTextAreaElement} textarea
   */
  handleTextChange(caseId, textarea) {
    const text = textarea.value;

    // Check if user cleared the field manually
    if (text.trim() === '' && this.activeEntries.has(caseId)) {
      const entry = this.activeEntries.get(caseId);
      if (entry.text.trim() !== '') {
        // User cleared the field - close entry
        this.closeEntry(caseId, entry.text);
        return;
      }
    }

    // Throttle saves to avoid excessive storage writes
    this.throttledSave(caseId, text);

    // Reset inactivity timer
    this.resetInactivityTimer(caseId);
  },

  /**
   * Throttled save to storage
   * @param {string} caseId
   * @param {string} text
   */
  throttledSave(caseId, text) {
    // Clear existing timer
    if (this.saveThrottleTimers.has(caseId)) {
      clearTimeout(this.saveThrottleTimers.get(caseId));
    }

    // Set new timer (save after 500ms of no activity)
    const timerId = setTimeout(() => {
      this.saveActiveEntry(caseId, text);
      this.saveThrottleTimers.delete(caseId);
    }, 500);

    this.saveThrottleTimers.set(caseId, timerId);
  },

  /**
   * Saves the active entry
   * @param {string} caseId
   * @param {string} text
   */
  saveActiveEntry(caseId, text) {
    if (!this.activeEntries.has(caseId)) return;

    const entry = this.activeEntries.get(caseId);
    entry.text = text;
    entry.timestamp = Date.now();

    console.log(`[CaseCommentMemory] Auto-saved for case ${caseId}: ${text.substring(0, 50)}...`);
  },

  /**
   * Resets the inactivity timer
   * @param {string} caseId
   */
  resetInactivityTimer(caseId) {
    const entry = this.activeEntries.get(caseId);
    if (!entry) return;

    // Clear existing timer
    if (entry.timerId) {
      clearTimeout(entry.timerId);
    }

    // Set new timer
    entry.timerId = setTimeout(() => {
      this.closeEntry(caseId, entry.text);
    }, this.inactivityTimeout);
  },

  /**
   * Pauses entry when page becomes hidden
   * @param {string} caseId
   */
  pauseEntry(caseId) {
    const entry = this.activeEntries.get(caseId);
    if (!entry) return;

    // Save current state
    this.saveToHistory(caseId, entry.text, false); // Don't close yet

    console.log(`[CaseCommentMemory] Entry paused for case ${caseId}`);
  },

  /**
   * Resumes entry when page becomes visible
   * @param {string} caseId
   */
  resumeEntry(caseId) {
    const entry = this.activeEntries.get(caseId);
    if (!entry) return;

    // Check if textarea still has the same value
    const textarea = this.getTextarea();
    if (textarea && textarea.value === entry.text) {
      // Resume the entry
      entry.isActive = true;
      this.resetInactivityTimer(caseId);
      console.log(`[CaseCommentMemory] Entry resumed for case ${caseId}`);
    }
  },

  /**
   * Closes an entry and moves it to history
   * @param {string} caseId
   * @param {string} text
   */
  closeEntry(caseId, text) {
    if (text.trim() === '') {
      // Don't save empty entries
      this.activeEntries.delete(caseId);
      return;
    }

    this.saveToHistory(caseId, text, true);
    this.activeEntries.delete(caseId);

    console.log(`[CaseCommentMemory] Entry closed for case ${caseId}`);
  },

  /**
   * Saves text to history
   * @param {string} caseId
   * @param {string} text
   * @param {boolean} closeEntry
   */
  async saveToHistory(caseId, text, closeEntry = false) {
    if (text.trim() === '') return;

    try {
      const data = await this.getAllData();

      if (!data[caseId]) {
        data[caseId] = [];
      }

      // Add to history
      data[caseId].unshift({
        text: text,
        timestamp: Date.now(),
        closed: closeEntry
      });

      // Limit history size
      if (data[caseId].length > this.maxHistoryPerCase) {
        data[caseId] = data[caseId].slice(0, this.maxHistoryPerCase);
      }

      // Save to storage
      await this.saveAllData(data);

      console.log(`[CaseCommentMemory] Saved to history for case ${caseId}`);
    } catch (error) {
      console.error('[CaseCommentMemory] Error saving to history:', error);
    }
  },

  /**
   * Gets history for a case
   * @param {string} caseId
   * @returns {Promise<Array>}
   */
  async getHistory(caseId) {
    const data = await this.getAllData();
    return data[caseId] || [];
  },

  /**
   * Loads history from storage
   * @param {string} caseId
   */
  async loadHistory(caseId) {
    const history = await this.getHistory(caseId);
    console.log(`[CaseCommentMemory] Loaded ${history.length} entries for case ${caseId}`);
  },

  /**
   * Gets all data from storage
   * @returns {Promise<Object>}
   */
  async getAllData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(this.storageKey, (result) => {
        resolve(result[this.storageKey] || {});
      });
    });
  },

  /**
   * Saves all data to storage
   * @param {Object} data
   */
  async saveAllData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.storageKey]: data }, resolve);
    });
  },

  /**
   * Monitors save button for clicks
   * @param {string} caseId
   */
  monitorSaveButton(caseId) {
    // Use MutationObserver to watch for save button
    const observer = new MutationObserver(() => {
      const saveButton = this.findSaveButton();
      if (saveButton && !saveButton.dataset.commentMemoryListener) {
        saveButton.dataset.commentMemoryListener = 'true';
        saveButton.addEventListener('click', () => {
          const textarea = this.getTextarea();
          if (textarea) {
            this.closeEntry(caseId, textarea.value);
          }
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Try to find it immediately
    const saveButton = this.findSaveButton();
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        const textarea = this.getTextarea();
        if (textarea) {
          this.closeEntry(caseId, textarea.value);
        }
      });
    }
  },

  /**
   * Finds the save button
   * @returns {HTMLElement|null}
   */
  findSaveButton() {
    // Look for "Add New Comment" button (the actual submit button)
    const buttons = document.querySelectorAll('button[type="submit"]');
    for (let button of buttons) {
      if (button.textContent.includes('Add New Comment')) {
        return button;
      }
    }

    // Fallback: look for any button with these texts
    const allButtons = document.querySelectorAll('button');
    for (let button of allButtons) {
      const text = button.textContent.trim();
      if (text === 'Add New Comment' ||
          text === 'Save' ||
          text === 'Submit') {
        return button;
      }
    }
    
    return null;
  },

  /**
   * Creates preview modal
   * @param {Object} entry - History entry
   * @param {Function} onRestore - Callback for restore action
   * @returns {HTMLElement}
   */
  createPreviewModal(entry, onRestore) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Preview Comment';
    title.style.cssText = `
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      color: #666;
    `;
    closeBtn.onclick = () => modal.remove();

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.cssText = `
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    `;

    const timestamp = document.createElement('div');
    timestamp.textContent = `Saved: ${new Date(entry.timestamp).toLocaleString()}`;
    timestamp.style.cssText = `
      font-size: 12px;
      color: #666;
      margin-bottom: 12px;
    `;

    const preview = document.createElement('pre');
    preview.textContent = entry.text;
    preview.style.cssText = `
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      margin: 0;
    `;

    const stats = document.createElement('div');
    stats.style.cssText = `
      margin-top: 12px;
      font-size: 12px;
      color: #666;
    `;
    const charCount = entry.text.length;
    const wordCount = entry.text.trim().split(/\s+/).length;
    stats.textContent = `${charCount} characters • ${wordCount} words`;

    body.appendChild(timestamp);
    body.appendChild(preview);
    body.appendChild(stats);

    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 16px 20px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'slds-button slds-button_neutral';
    cancelBtn.onclick = () => modal.remove();

    const restoreBtn = document.createElement('button');
    restoreBtn.textContent = 'Restore This Comment';
    restoreBtn.className = 'slds-button slds-button_brand';
    restoreBtn.onclick = () => {
      onRestore();
      modal.remove();
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(restoreBtn);

    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    modal.appendChild(content);

    return modal;
  },

  /**
   * Creates restore UI button
   * @param {string} caseId
   * @returns {HTMLElement}
   */
  async createRestoreButton(caseId) {
    const history = await this.getHistory(caseId);

    if (history.length === 0) {
      console.log('[CaseCommentMemory] No history available, skipping button creation');
      return null;
    }

    const container = document.createElement('div');
    container.className = 'case-comment-restore';
    container.setAttribute('data-case-comment-restore-button', 'true');
    container.style.cssText = `
      display: inline-block;
      position: relative;
    `;

    const button = document.createElement('button');
    button.innerHTML = '💾 Restore (<span class="restore-count">' + history.length + '</span>)';
    button.className = 'slds-button slds-button_neutral';
    button.style.cssText = `
      font-size: 12px;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    button.title = `${history.length} saved comment${history.length > 1 ? 's' : ''} available`;
    button.type = 'button'; // Prevent form submission

    const dropdown = document.createElement('div');
    dropdown.className = 'restore-dropdown';
    dropdown.style.cssText = `
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      background: white;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 350px;
      max-height: 400px;
      overflow-y: auto;
      z-index: 1000;
      margin-top: 4px;
    `;

    // Add header
    const dropdownHeader = document.createElement('div');
    dropdownHeader.style.cssText = `
      padding: 10px 12px;
      border-bottom: 1px solid #e0e0e0;
      background: #f9f9f9;
      font-weight: 600;
      font-size: 12px;
      color: #333;
      border-radius: 6px 6px 0 0;
    `;
    dropdownHeader.textContent = `Saved Comments (${history.length})`;
    dropdown.appendChild(dropdownHeader);

    // Add history items
    history.forEach((entry, index) => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 10px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f0f0f0;
        transition: background 0.15s;
      `;

      const headerRow = document.createElement('div');
      headerRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      `;

      const timestamp = document.createElement('span');
      timestamp.textContent = new Date(entry.timestamp).toLocaleString();
      timestamp.style.cssText = `
        font-size: 11px;
        color: #666;
      `;

      const actions = document.createElement('div');
      actions.style.cssText = `
        display: flex;
        gap: 6px;
      `;

      const previewBtn = document.createElement('button');
      previewBtn.textContent = '👁️ Preview';
      previewBtn.style.cssText = `
        font-size: 10px;
        padding: 2px 6px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
      `;
      previewBtn.onclick = (e) => {
        e.stopPropagation();
        const modal = this.createPreviewModal(entry, () => {
          const textarea = this.getTextarea();
          if (textarea) {
            textarea.value = entry.text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        document.body.appendChild(modal);
        dropdown.style.display = 'none';
      };

      actions.appendChild(previewBtn);
      headerRow.appendChild(timestamp);
      headerRow.appendChild(actions);

      const preview = document.createElement('div');
      const previewText = entry.text.substring(0, 80) + (entry.text.length > 80 ? '...' : '');
      preview.textContent = previewText;
      preview.style.cssText = `
        font-size: 12px;
        color: #333;
        line-height: 1.4;
      `;

      const stats = document.createElement('div');
      stats.style.cssText = `
        font-size: 10px;
        color: #999;
        margin-top: 4px;
      `;
      const charCount = entry.text.length;
      stats.textContent = `${charCount} characters`;

      item.appendChild(headerRow);
      item.appendChild(preview);
      item.appendChild(stats);

      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f8f9fa';
      });

      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = '';
      });

      item.addEventListener('click', (e) => {
        if (e.target === previewBtn) return;
        const textarea = this.getTextarea();
        if (textarea) {
          textarea.value = entry.text;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        dropdown.style.display = 'none';
      });

      dropdown.appendChild(item);
    });

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      dropdown.style.display = 'none';
    });

    container.appendChild(button);
    container.appendChild(dropdown);

    return container;
  },

  /**
   * Adds restore button to UI
   * @param {string} caseId
   */
  async addRestoreButton(caseId) {
    const textarea = this.getTextarea();
    if (!textarea) {
      console.warn('[CaseCommentMemory] Textarea not found for restore button');
      return;
    }

    // Check if button already exists
    if (document.querySelector('[data-case-comment-restore-button]')) {
      console.log('[CaseCommentMemory] Restore button already exists');
      return;
    }

    // Find the button container (div with slds-float_right class)
    const buttonContainer = document.querySelector('.slds-clearfix .slds-float_right');
    if (!buttonContainer) {
      console.warn('[CaseCommentMemory] Button container not found, trying alternative...');
      
      // Alternative: find "Add New Comment" button and insert before it
      const saveButton = this.findSaveButton();
      if (saveButton && saveButton.parentElement) {
        const restoreButton = await this.createRestoreButton(caseId);
        if (restoreButton) {
          restoreButton.style.marginRight = '8px';
          saveButton.parentElement.insertBefore(restoreButton, saveButton);
          console.log('[CaseCommentMemory] Restore button added (alternative method)');
        }
      }
      return;
    }

    const restoreButton = await this.createRestoreButton(caseId);
    if (restoreButton) {
      restoreButton.style.marginRight = '8px';
      // Insert before the "Add New Comment" button
      const saveButtonWrapper = buttonContainer.querySelector('lightning-button');
      if (saveButtonWrapper) {
        buttonContainer.insertBefore(restoreButton, saveButtonWrapper);
      } else {
        buttonContainer.insertBefore(restoreButton, buttonContainer.firstChild);
      }
      console.log('[CaseCommentMemory] Restore button added successfully');
    }
  },

  /**
   * Cleans up the module
   */
  cleanup() {
    // Clear all timers
    for (const [caseId, entry] of this.activeEntries.entries()) {
      if (entry.timerId) {
        clearTimeout(entry.timerId);
      }
    }

    for (const timerId of this.saveThrottleTimers.values()) {
      clearTimeout(timerId);
    }

    // Clear maps
    this.activeEntries.clear();
    this.saveThrottleTimers.clear();

    console.log('[CaseCommentMemory] Cleaned up');
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaseCommentMemory;
}
