/**
 * Ex Libris Enhanced Content Script
 * Main integration file for all Ex Libris/Esploro features
 *
 * This script runs on Salesforce pages and provides:
 * - Page identification
 * - Field highlighting
 * - Dynamic menu injection
 * - Case comment enhancements
 * - Data extraction and caching
 */

// Import note: In production, these modules should be loaded via manifest.json
// For now, they will be loaded as separate script files

(function() {
  'use strict';

  // ========== MAIN CONTROLLER ==========

  const ExLibrisExtension = {
    currentPage: null,
    currentCaseId: null,
    isInitialized: false,
    settings: {
      menuLocations: {
        cardActions: false,
        headerDetails: true
      },
      buttonLabelStyle: 'casual', // 'formal', 'casual', 'abbreviated'
      timezone: null, // null = auto-detect
      highlightingEnabled: true
    },

    /**
     * Initializes the extension
     */
    async init() {
      console.log('[ExLibris Extension] Initializing...');

      // Initialize SettingsManager first
      if (typeof SettingsManager !== 'undefined') {
        await SettingsManager.init();
        this.settings = SettingsManager.get();
        console.log('[ExLibris Extension] SettingsManager initialized');
      } else {
        console.warn('[ExLibris Extension] SettingsManager not loaded, using defaults');
      }

      // Initialize CustomerDataManager
      if (typeof CustomerDataManager !== 'undefined') {
        await CustomerDataManager.init();
        console.log('[ExLibris Extension] CustomerDataManager initialized');
      } else {
        console.warn('[ExLibris Extension] CustomerDataManager not loaded');
      }

      // Initialize CacheManager
      if (typeof CacheManager !== 'undefined') {
        await CacheManager.init();
        console.log('[ExLibris Extension] CacheManager initialized');
      } else {
        console.warn('[ExLibris Extension] CacheManager not loaded');
      }

      // Initialize ContextMenuHandler
      if (typeof ContextMenuHandler !== 'undefined' && 
          SettingsManager.isFeatureEnabled('contextMenu')) {
        ContextMenuHandler.init();
        console.log('[ExLibris Extension] ContextMenuHandler initialized');

        // Request context menu creation
        chrome.runtime.sendMessage({ action: 'createContextMenus' });
      } else {
        console.warn('[ExLibris Extension] ContextMenuHandler not loaded or disabled');
      }

      // Initialize KeyboardShortcuts
      if (typeof KeyboardShortcuts !== 'undefined') {
        KeyboardShortcuts.init(this.settings);
        console.log('[ExLibris Extension] KeyboardShortcuts initialized');
      } else {
        console.warn('[ExLibris Extension] KeyboardShortcuts not loaded');
      }

      // Load settings (legacy support)
      await this.loadSettings();

      this.isInitialized = true;

      // Start monitoring page changes
      this.startPageMonitoring();

      // Listen for messages from popup/background
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true; // Keep channel open for async response
      });

      console.log('[ExLibris Extension] Initialized');
    },

    /**
     * Loads settings from storage
     */
    async loadSettings() {
      return new Promise((resolve) => {
        chrome.storage.sync.get('exlibrisSettings', (result) => {
          if (result.exlibrisSettings) {
            this.settings = { ...this.settings, ...result.exlibrisSettings };
          }
          resolve();
        });
      });
    },

    /**
     * Starts monitoring for page changes
     */
    startPageMonitoring() {
      if (typeof PageIdentifier === 'undefined') {
        console.warn('[ExLibris Extension] PageIdentifier module not loaded');
        return;
      }

      PageIdentifier.monitorPageChanges((pageInfo) => {
        this.handlePageChange(pageInfo);
      });
    },

    /**
     * Handles page changes
     * @param {Object} pageInfo
     */
    async handlePageChange(pageInfo) {
      console.log('[ExLibris Extension] Page changed:', pageInfo);

      this.currentPage = pageInfo;
      this.currentCaseId = pageInfo.caseId;

      // Clear any existing features
      this.cleanup();

      // Initialize features based on page type
      console.log('[ExLibris Extension] Checking page type:', pageInfo.type);
      console.log('[ExLibris Extension] CASES_LIST constant:', PageIdentifier.pageTypes.CASES_LIST);
      console.log('[ExLibris Extension] Match?', pageInfo.type === PageIdentifier.pageTypes.CASES_LIST);
      
      if (pageInfo.type === PageIdentifier.pageTypes.CASE_PAGE) {
        await this.initializeCasePageFeatures();
      } else if (pageInfo.type === PageIdentifier.pageTypes.CASE_COMMENTS) {
        await this.initializeCaseCommentsFeatures();
      } else if (pageInfo.type === PageIdentifier.pageTypes.CASES_LIST) {
        await this.initializeCaseListFeatures();
      } else {
        console.warn('[ExLibris Extension] Unknown page type, no features initialized');
      }
    },

    /**
     * Initializes features for case pages
     */
    async initializeCasePageFeatures() {
      console.log('[ExLibris Extension] Initializing case page features...');

      // Wait for page to fully load
      await this.waitForElements();

      // Get or fetch case data
      const caseData = await this.getCaseData(this.currentCaseId);

      if (!caseData) {
        console.warn('[ExLibris Extension] Could not extract case data');
        return;
      }

      // Initialize field highlighting
      if (this.settings.highlightingEnabled && 
          typeof FieldHighlighter !== 'undefined' &&
          SettingsManager.isFeatureEnabled('fieldHighlighting')) {
        FieldHighlighter.init();
      }

      // Email "From" field validation (Communication tab)
      // Highlights red for non-Clarivate emails, orange for wrong department
      if (typeof handleAnchors === 'function') {
        handleAnchors();
        console.log('[ExLibris Extension] Email validation applied');
        
        // Set up observer to re-validate when communication tab content changes
        this.observeCommunicationTab();
      }

      // Initialize dynamic menu
      if (typeof URLBuilder !== 'undefined' && 
          typeof DynamicMenu !== 'undefined' &&
          SettingsManager.isFeatureEnabled('dynamicMenu')) {
        const buttonStyle = this.settings?.exlibris?.ui?.buttonLabelStyle || this.settings.buttonLabelStyle || 'casual';
        const timezone = this.settings?.exlibris?.ui?.timezone || this.settings.timezone || null;
        const menuLocations = this.settings?.exlibris?.ui?.menuLocations || this.settings.menuLocations;

        const buttonGroups = URLBuilder.buildAllButtons(
          caseData,
          buttonStyle,
          timezone
        );

        DynamicMenu.setSettings(menuLocations);
        DynamicMenu.injectMenu(buttonGroups, caseData);
      }

      // Initialize case comment memory
      if (typeof CaseCommentMemory !== 'undefined' &&
          SettingsManager.isFeatureEnabled('caseCommentMemory')) {
        CaseCommentMemory.init(this.currentCaseId);
        CaseCommentMemory.addRestoreButton(this.currentCaseId);
      }

      // Initialize character counter
      if (typeof CharacterCounter !== 'undefined' &&
          SettingsManager.isFeatureEnabled('characterCounter')) {
        CharacterCounter.init();
      }

      // Initialize multi-tab sync
      if (typeof MultiTabSync !== 'undefined' &&
          SettingsManager.isFeatureEnabled('multiTabSync')) {
        MultiTabSync.init(this.currentCaseId);
        console.log('[ExLibris Extension] MultiTabSync initialized');
      }

      console.log('[ExLibris Extension] Case page features initialized');
    },

    /**
     * Initializes features for case comments page
     */
    async initializeCaseCommentsFeatures() {
      console.log('[ExLibris Extension] Initializing case comments page features...');

      await this.waitForElements();

      // Initialize case comment memory
      if (typeof CaseCommentMemory !== 'undefined' &&
          SettingsManager.isFeatureEnabled('caseCommentMemory')) {
        CaseCommentMemory.init(this.currentCaseId);
        CaseCommentMemory.addRestoreButton(this.currentCaseId);
      }

      // Initialize character counter
      if (typeof CharacterCounter !== 'undefined' &&
          SettingsManager.isFeatureEnabled('characterCounter')) {
        CharacterCounter.init();
      }
    },

    /**
     * Initializes features for case list page
     */
    async initializeCaseListFeatures() {
      console.log('[ExLibris Extension] ========== INITIALIZING CASE LIST FEATURES ==========');
      
      console.log('[ExLibris Extension] Checking function availability:');
      console.log('  - handleCases:', typeof handleCases);
      console.log('  - handleStatus:', typeof handleStatus);
      console.log('  - handleAnchors:', typeof handleAnchors);

      // Wait for table to load
      console.log('[ExLibris Extension] Waiting for case list table...');
      await this.waitForCaseListTable();
      console.log('[ExLibris Extension] Table found!');

      // Run legacy case list functions from content_script.js
      
      // 1. Case row highlighting based on age (green -> yellow -> orange -> red)
      if (typeof handleCases === 'function') {
        handleCases();
        console.log('[ExLibris Extension] Case row highlighting applied');
      } else {
        console.warn('[ExLibris Extension] handleCases function not available');
      }
      
      // 2. Status badge highlighting (New Email Received, In Progress, etc.)
      if (typeof handleStatus === 'function') {
        handleStatus();
        console.log('[ExLibris Extension] Status badge highlighting applied');
      } else {
        console.warn('[ExLibris Extension] handleStatus function not available');
      }

      // Set up observer to re-apply all highlighting when table changes
      this.observeCaseListChanges();
    },

    /**
     * Waits for case list table to be present
     * @returns {Promise<void>}
     */
    async waitForCaseListTable() {
      return new Promise((resolve) => {
        const checkTable = () => {
          const table = document.querySelector('table tbody');
          if (table) {
            resolve();
          } else {
            setTimeout(checkTable, 100);
          }
        };
        checkTable();
      });
    },

    /**
     * Observes case list table for changes and re-applies highlighting
     */
    observeCaseListChanges() {
      const table = document.querySelector('table');
      if (!table) return;

      // Disconnect existing observer if any
      if (this.caseListObserver) {
        this.caseListObserver.disconnect();
      }

      this.caseListObserver = new MutationObserver(() => {
        // Re-apply highlighting functions when table changes (sorting, filtering, pagination)
        if (typeof handleCases === 'function') {
          handleCases();
        }
        if (typeof handleStatus === 'function') {
          handleStatus();
        }
      });

      this.caseListObserver.observe(table, {
        childList: true,
        subtree: true
      });

      console.log('[ExLibris Extension] Case list observer initialized (handleCases, handleStatus)');
    },

    /**
     * Observes Communication tab for changes and re-validates email "From" field
     */
    observeCommunicationTab() {
      // Watch for changes in the communication/email area
      const emailContainer = document.querySelector('.standardField.uiMenu') || document.body;
      
      // Disconnect existing observer if any
      if (this.communicationObserver) {
        this.communicationObserver.disconnect();
      }

      this.communicationObserver = new MutationObserver(() => {
        // Re-validate email "From" field when content changes
        if (typeof handleAnchors === 'function') {
          handleAnchors();
        }
      });

      this.communicationObserver.observe(emailContainer, {
        childList: true,
        subtree: true
      });

      console.log('[ExLibris Extension] Communication tab observer initialized (handleAnchors)');
    },

    /**
     * Gets case data (from cache or by extraction)
     * @param {string} caseId
     * @returns {Promise<Object>}
     */
    async getCaseData(caseId) {
      // Check CacheManager first
      if (typeof CacheManager !== 'undefined') {
        // CacheManager internally validates last-modified; only pass caseId
        const cached = await CacheManager.get(caseId);
        
        if (cached) {
          console.log('[ExLibris Extension] Using cached case data from CacheManager');
          return cached;
        }
      }

      // Extract fresh data
      if (typeof CaseDataExtractor === 'undefined') {
        console.warn('[ExLibris Extension] CaseDataExtractor module not loaded');
        return null;
      }

      console.log('[ExLibris Extension] Extracting case data...');
      const caseData = await CaseDataExtractor.getData();

      // Cache it in CacheManager
      if (typeof CacheManager !== 'undefined' && caseData) {
        await CacheManager.set(caseId, caseData);
      }

      return caseData;
    },

    /**
     * Gets last modified date from page
     * @returns {string|null}
     */
    getLastModifiedDate() {
      if (typeof CaseDataExtractor !== 'undefined') {
        return CaseDataExtractor.getLastModifiedDate();
      }
      return null;
    },

    /**
     * Waits for key elements to be present in DOM
     * @returns {Promise<void>}
     */
    waitForElements() {
      return new Promise((resolve) => {
        const checkElements = () => {
          // Check for key elements that indicate page is ready
          const hasRecordLayout = document.querySelector('records-record-layout-item');
          const hasHighlights = document.querySelector('.highlights');

          if (hasRecordLayout || hasHighlights) {
            resolve();
          } else {
            setTimeout(checkElements, 500);
          }
        };

        checkElements();
      });
    },

    /**
     * Handles messages from popup or background script
     * @param {Object} request
     * @param {Object} sender
     * @param {Function} sendResponse
     */
    handleMessage(request, sender, sendResponse) {
      console.log('[ExLibris Extension] Received message:', request);

      if (request.action === 'updateSettings') {
        this.settings = { ...this.settings, ...request.settings };
        this.refresh();
        sendResponse({ success: true });
      }
      else if (request.action === 'getCaseData') {
        this.getCaseData(this.currentCaseId).then(data => {
          sendResponse({ success: true, data });
        });
      }
      else if (request.action === 'refresh') {
        this.refresh();
        sendResponse({ success: true });
      }
      else {
        sendResponse({ success: false, error: 'Unknown action' });
      }
    },

    /**
     * Refreshes all features
     */
    async refresh() {
      console.log('[ExLibris Extension] Refreshing...');

      if (this.currentPage) {
        await this.handlePageChange(this.currentPage);
      }
    },

    /**
     * Cleans up existing features
     */
    cleanup() {
      // Disconnect case list observer
      if (this.caseListObserver) {
        this.caseListObserver.disconnect();
        this.caseListObserver = null;
      }

      // Disconnect communication tab observer
      if (this.communicationObserver) {
        this.communicationObserver.disconnect();
        this.communicationObserver = null;
      }

      // Remove highlights
      if (typeof FieldHighlighter !== 'undefined' && FieldHighlighter.cleanup) {
        FieldHighlighter.cleanup();
      }

      // Remove menus
      if (typeof DynamicMenu !== 'undefined') {
        DynamicMenu.removeAllMenus();
      }

      // Remove character counter
      if (typeof CharacterCounter !== 'undefined') {
        CharacterCounter.remove();
      }

      // Cleanup modules if they have cleanup methods
      if (typeof CaseDataExtractor !== 'undefined' && CaseDataExtractor.cleanup) {
        CaseDataExtractor.cleanup();
      }

      // Cleanup CaseCommentMemory
      if (typeof CaseCommentMemory !== 'undefined' && CaseCommentMemory.cleanup) {
        CaseCommentMemory.cleanup();
      }

      // Cleanup MultiTabSync
      if (typeof MultiTabSync !== 'undefined' && MultiTabSync.cleanup) {
        MultiTabSync.cleanup();
      }
    },

    /**
     * Complete cleanup (called on unload)
     */
    destroy() {
      console.log('[ExLibris Extension] Destroying...');
      
      this.cleanup();

      // Cleanup all modules
      if (typeof CustomerDataManager !== 'undefined' && CustomerDataManager.cleanup) {
        CustomerDataManager.cleanup();
      }
      if (typeof CacheManager !== 'undefined' && CacheManager.cleanup) {
        CacheManager.cleanup();
      }
      if (typeof CaseCommentMemory !== 'undefined' && CaseCommentMemory.cleanup) {
        CaseCommentMemory.cleanup();
      }
      if (typeof ContextMenuHandler !== 'undefined' && ContextMenuHandler.cleanup) {
        ContextMenuHandler.cleanup();
      }
      if (typeof MultiTabSync !== 'undefined' && MultiTabSync.cleanup) {
        MultiTabSync.cleanup();
      }
      
      this.isInitialized = false;
    }
  };

  // ========== INITIALIZATION ==========

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ExLibrisExtension.init();
    });
  } else {
    ExLibrisExtension.init();
  }

  // Make available globally for debugging
  window.ExLibrisExtension = ExLibrisExtension;

})();
