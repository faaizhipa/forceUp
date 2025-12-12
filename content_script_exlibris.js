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

(function () {
  "use strict";

  // ========== MAIN CONTROLLER ==========

  const ExLibrisExtension = {
    currentPage: null,
    currentCaseId: null,
    lastUrl: window.location.href, // Track last URL for navigation detection
    isInitialized: false,
    initializationDebounceTimer: null,
    isInitializing: false,

    // Legacy API data (deprecated - kept for backwards compatibility)
    // New data flow uses InterceptorCacheManager via EXLIBRIS_DATA_UPDATED event
    apiCaseData: null,
    apiCaseDataTimestamp: null,
    apiCaseDataRaw: null,

    caseToolkit: {
      metadata: null,
      caseData: null,
      menuConfig: null,
      buttonGroups: null,
      prepared: false,
      preparedAt: null,
      scrollStats: null,
    },
    settings: {
      menuLocations: {
        cardActions: false,
        headerDetails: true,
      },
      buttonLabelStyle: "casual", // 'formal', 'casual', 'abbreviated'
      timezone: null, // null = auto-detect
      highlightingEnabled: true,
    },

    /**
     * Initializes the extension
     */
    async init() {
      console.log("[ExLibris Extension] Initializing...");

      // Initialize Logger first
      if (typeof Logger !== "undefined") {
        Logger.init({ debugMode: false }); // Set to true for debug logging
        Logger.info("Logger initialized");
      }

      // Determine session type using Navigation Timing API

      const navEntry = performance.getEntriesByType("navigation")[0];
      const isNewSession = !sessionStorage.getItem("session_active");

      if (isNewSession) {
        console.log(
          "[HOW THIS PAGE INIT]This is a completely new tab/window session."
        );
        sessionStorage.setItem("session_active", "true");
      } else if (navEntry.type === "reload") {
        console.log(
          "[HOW THIS PAGE INIT] This is a refresh within an existing tab session."
        );
      } else if (
        navEntry.type === "navigate" ||
        navEntry.type === "back_forward"
      ) {
        console.log(
          "[HOW THIS PAGE INIT]This is navigation within the same tab, but not a simple refresh."
        );
      }

      // NOTE: Legacy _pendingApiCaseData pattern removed
      // New data flow uses InterceptorCacheManager via EXLIBRIS_DATA_UPDATED event

      // NOTE: window._pendingFectchedCaseData pattern removed
      // interceptor.js runs in MAIN world, content scripts in ISOLATED world
      // Cross-world window access doesn't work - use event-based communication instead

      // Initialize SettingsManager first
      if (typeof SettingsManager !== "undefined") {
        await SettingsManager.init();
        this.settings = SettingsManager.get();
        console.log("[ExLibris Extension] SettingsManager initialized");
      } else {
        console.warn(
          "[ExLibris Extension] SettingsManager not loaded, using defaults"
        );
      }

      // Initialize CustomerMasterManager (unified customer data and timezone resolution)
      if (typeof CustomerMasterManager !== "undefined") {
        await CustomerMasterManager.init();
        console.log("[ExLibris Extension] CustomerMasterManager initialized");
      } else {
        console.warn("[ExLibris Extension] CustomerMasterManager not loaded");
      }

      // Initialize NavigationObserver for SPA navigation
      if (typeof NavigationObserver !== "undefined") {
        NavigationObserver.start();
        NavigationObserver.onRouteChange((url) => {
          Logger?.info("Navigation detected:", url);
          // Re-identify page type and reinitialize features
          this.handleNavigationChange(url);
        });
        Logger?.info("NavigationObserver initialized");
      }

      // Listen for pageInfoInitializer updates (from document_start initialization)
      // This provides early page identification before DOM is fully ready
      document.addEventListener("exLibrisPageInfoUpdated", (event) => {
        const { pageInfo, source, previousPageInfo } = event.detail || {};
        Logger?.info("Received exLibrisPageInfoUpdated event:", {
          type: pageInfo?.type,
          source,
          changed: previousPageInfo?.type !== pageInfo?.type,
        });

        // Only trigger page change if page type actually changed
        if (
          pageInfo &&
          (!previousPageInfo || previousPageInfo.type !== pageInfo.type)
        ) {
          this.handlePageChange(pageInfo);
        }
      });

      // Initialize CaseContextWatcher (depends on NavigationObserver signals)
      if (typeof CaseContextWatcher !== "undefined") {
        CaseContextWatcher.init();
        console.log("[ExLibris Extension] CaseContextWatcher initialized");
      } else {
        console.warn("[ExLibris Extension] CaseContextWatcher not loaded");
      }

      if (typeof CaseDataStore !== "undefined") {
        CaseDataStore.init();
        console.log("[ExLibris Extension] CaseDataStore initialized");
      } else {
        console.warn("[ExLibris Extension] CaseDataStore not loaded");
      }

      // Legacy caseDataFromApi listener (deprecated - kept for backwards compatibility)
      document.addEventListener("caseDataFromApi", (event) => {
        const { data, timestamp } = event.detail;
        this.apiCaseData = data;
        this.apiCaseDataTimestamp = timestamp;
        console.log(
          "[ExLibris Extension] Received legacy API case data via event:",
          {
            caseNumber: data?.CaseNumber,
            fieldCount: Object.keys(data || {}).length,
          }
        );
      });

      // Listen for EXLIBRIS_DATA_UPDATED events from interceptor.js (MAIN world)
      // IMPORTANT: interceptor.js dispatches on window, so we must listen on window
      window.addEventListener("EXLIBRIS_DATA_UPDATED", async (event) => {
        const rawCaseData = event.detail;
        console.log(
          "[ExLibris Extension] Received interceptor data:",
          rawCaseData?.CaseNumber
        );

        // Store and enrich via InterceptorCacheManager
        if (
          rawCaseData?.CaseNumber &&
          typeof InterceptorCacheManager !== "undefined"
        ) {
          try {
            const enrichedData = await InterceptorCacheManager.store(
              rawCaseData.CaseNumber,
              rawCaseData
            );
            console.log(
              "[ExLibris Extension] Cached enriched interceptor data for case:",
              rawCaseData.CaseNumber
            );
          } catch (error) {
            console.error(
              "[ExLibris Extension] Failed to cache interceptor data:",
              error
            );
          }
        }

        // Send to popup/background script
        try {
          chrome.runtime.sendMessage({
            type: "CASE_DATA_CAPTURED",
            payload: rawCaseData,
          });
        } catch (error) {
          // Ignore if popup is not open
        }
      });

      // Listen for caseDataMismatch events to trigger re-extraction
      document.addEventListener("caseDataMismatch", async (event) => {
        const {
          reason,
          dataCaseId,
          dataCaseNumber,
          extractedCaseId,
          extractedCaseNumber,
        } = event.detail;
        console.warn("[ExLibris Extension] caseDataMismatch event received:", {
          reason,
          dataCaseId,
          dataCaseNumber,
          extractedCaseId,
          extractedCaseNumber,
        });

        // Reset extraction state in extractors
        if (
          typeof CaseDataExtractor !== "undefined" &&
          CaseDataExtractor.resetExtractionState
        ) {
          CaseDataExtractor.resetExtractionState();
        }

        if (
          typeof CasePageDataExtractor !== "undefined" &&
          CasePageDataExtractor.resetExtractionState
        ) {
          CasePageDataExtractor.resetExtractionState();
        }

        // Trigger automatic re-extraction
        if (
          typeof CasePageDataExtractor !== "undefined" &&
          CasePageDataExtractor.extractNow
        ) {
          console.log(
            "[ExLibris Extension] Triggering automatic re-extraction after mismatch"
          );
          // Small delay to allow state reset
          setTimeout(async () => {
            try {
              await CasePageDataExtractor.extractNow(true); // Force re-extraction
            } catch (error) {
              console.error(
                "[ExLibris Extension] Error during re-extraction:",
                error
              );
            }
          }, 500);
        } else {
          // Fallback: dispatch event for modules to handle
          const reextractionEvent = new CustomEvent(
            "caseDataReextractionRequested",
            {
              detail: { reason, extractedCaseId, extractedCaseNumber },
              bubbles: true,
              composed: true,
            }
          );
          document.dispatchEvent(reextractionEvent);
        }
      });

      // Initialize ContextMenuHandler
      if (
        typeof ContextMenuHandler !== "undefined" &&
        SettingsManager.isFeatureEnabled("contextMenu")
      ) {
        ContextMenuHandler.init();
        console.log("[ExLibris Extension] ContextMenuHandler initialized");

        // Context menus are created once by background.js on install/update
        // No need to request creation here
      } else {
        console.warn(
          "[ExLibris Extension] ContextMenuHandler not loaded or disabled"
        );
      }

      // Initialize KeyboardShortcuts
      if (typeof KeyboardShortcuts !== "undefined") {
        KeyboardShortcuts.init(this.settings);
        console.log("[ExLibris Extension] KeyboardShortcuts initialized");
      } else {
        console.warn("[ExLibris Extension] KeyboardShortcuts not loaded");
      }

      // Initialize PersistentBanner
      if (typeof PersistentBanner !== "undefined") {
        PersistentBanner.init();
        console.log("[ExLibris Extension] PersistentBanner initialized");
      } else {
        console.warn("[ExLibris Extension] PersistentBanner not loaded");
      }

      // Initialize CasePageDataExtractor to automatically extract case data on page load
      if (typeof CasePageDataExtractor !== "undefined") {
        CasePageDataExtractor.init();
        console.log("[ExLibris Extension] CasePageDataExtractor initialized");
      } else {
        console.warn("[ExLibris Extension] CasePageDataExtractor not loaded");
      }

      // Initialize UserPreferences
      if (typeof UserPreferences !== "undefined") {
        const userPrefs = await UserPreferences.load();
        console.log("[ExLibris Extension] UserPreferences initialized");

        // Check if configuration warning banner should be shown
        if (typeof ConfigurationWarningBanner !== "undefined") {
          const shouldShowWarning = await UserPreferences.shouldShowWarning();
          if (shouldShowWarning) {
            // Delay banner slightly to ensure page is fully loaded
            setTimeout(async () => {
              await ConfigurationWarningBanner.checkAndShow();
              console.log(
                "[ExLibris Extension] Configuration warning banner shown"
              );
            }, 2000);
          }
        }
      } else {
        console.warn("[ExLibris Extension] UserPreferences not loaded");
      }

      // Load settings (legacy support)
      await this.loadSettings();

      this.isInitialized = true;

      // Start monitoring page changes
      this.startPageMonitoring();

      // Listen for messages from popup/background
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
          this.handleMessage(request, sender, sendResponse);
          return true; // Keep channel open for async response
        } catch (error) {
          if (
            error.message &&
            error.message.includes("Extension context invalidated")
          ) {
            console.warn(
              "[ExLibris Extension] Extension context invalidated - reload page to restore functionality"
            );
          } else {
            console.error(
              "[ExLibris Extension] Error handling message:",
              error
            );
          }
          return false;
        }
      });

      console.log("[ExLibris Extension] Initialized");
    },

    /**
     * Loads settings from storage
     */
    async loadSettings() {
      return new Promise((resolve) => {
        try {
          chrome.storage.sync.get("exlibrisSettings", (result) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[ExLibris Extension] Could not load settings:",
                chrome.runtime.lastError.message
              );
              resolve();
              return;
            }
            if (result.exlibrisSettings) {
              this.settings = { ...this.settings, ...result.exlibrisSettings };
            }
            resolve();
          });
        } catch (error) {
          console.warn(
            "[ExLibris Extension] Error loading settings:",
            error.message
          );
          resolve();
        }
      });
    },

    /**
     * Starts monitoring for page changes
     */
    startPageMonitoring() {
      if (typeof PageIdentifier === "undefined") {
        console.warn("[ExLibris Extension] PageIdentifier module not loaded");
        return;
      }

      PageIdentifier.monitorPageChanges((pageInfo) => {
        this.handlePageChange(pageInfo);
      });
    },

    /**
     * Handles page changes with debouncing to prevent duplicate initializations
     * @param {Object} pageInfo
     */
    async handlePageChange(pageInfo) {
      // Prevent duplicate initialization attempts
      if (this.isInitializing) {
        console.log(
          "[ExLibris Extension] Initialization already in progress, skipping duplicate call"
        );
        return;
      }

      // Debounce rapid page change events
      if (this.initializationDebounceTimer) {
        clearTimeout(this.initializationDebounceTimer);
      }

      this.initializationDebounceTimer = setTimeout(async () => {
        await this.performPageInitialization(pageInfo);
      }, 100);
    },

    /**
     * Performs the actual page initialization (called after debounce)
     * @param {Object} pageInfo
     */
    async performPageInitialization(pageInfo) {
      this.isInitializing = true;

      try {
        const sameUrl = pageInfo.url === this.lastUrl;
        const samePageIdentity =
          sameUrl &&
          this.currentPage &&
          pageInfo.type === this.currentPage.type &&
          pageInfo.caseId === this.currentCaseId;
        if (samePageIdentity) {
          console.log(
            "[ExLibris Extension] Page same as last URL and page identity, skipping initialization"
          );
          return;
        }
        console.log("[ExLibris Extension] Page changed:", pageInfo);

        // Track URL to detect actual navigation
        const newUrl = window.location.href;
        const urlChanged = this.lastUrl && this.lastUrl !== newUrl;
        this.lastUrl = newUrl;

        this.currentPage = pageInfo;
        this.currentCaseId = pageInfo.caseId;

        // Update persistent banner with initial info (don't cleanup - it persists)
        if (typeof PersistentBanner !== "undefined") {
          // Ensure banner is initialized if not already
          if (!PersistentBanner.isInitialized) {
            await PersistentBanner.init();
          }

          // Convert internal page type to friendly display name
          const displayType = PersistentBanner.getPageTypeDisplayName(
            pageInfo.type
          );

          await PersistentBanner.updateCurrentPage({
            type: displayType,
            caseNumber: null, // Will be updated when case data is extracted
            subject: null,
            status: null,
            subStatus: null,
          });
          if (urlChanged) {
            console.log(
              "[ExLibris Extension] URL changed, waiting for page to settle..."
            );
            // Clear any existing features (but NOT PersistentBanner - it persists)
            console.log(
              "[ExLibris Extension] Cleaning up previous page features (URL changed: " +
                urlChanged +
                ")"
            );
            this.cleanup();
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }

        // If URL changed, add a delay to allow DOM to settle

        // Initialize features based on page type
        console.log("[ExLibris Extension] Checking page type:", pageInfo.type);
        console.log(
          "[ExLibris Extension] CASES_LIST constant:",
          PageIdentifier.pageTypes.CASES_LIST
        );
        console.log(
          "[ExLibris Extension] Match?",
          pageInfo.type === PageIdentifier.pageTypes.CASES_LIST
        );

        if (pageInfo.type === PageIdentifier.pageTypes.CASE_PAGE) {
          await this.initializeCasePageFeatures();
        } else if (pageInfo.type === PageIdentifier.pageTypes.CASE_COMMENTS) {
          await this.initializeCaseCommentsFeatures();
        } else if (pageInfo.type === PageIdentifier.pageTypes.CASES_LIST) {
          await this.initializeCaseListFeatures();
        } else {
          // Silently skip unsupported page types (reports, dashboards, etc.)
          console.log(
            "[ExLibris Extension] Page type not supported for features:",
            pageInfo.type
          );
        }
      } finally {
        this.isInitializing = false;
      }
    },

    /**
     * Initializes features for case pages
     */
    async initializeCasePageFeatures() {
      console.log("[ExLibris Extension] Initializing case page features...");

      await this.waitForElements();

      // Reset staged toolkit context
      const buttonStyle =
        this.settings?.exlibris?.ui?.buttonLabelStyle ||
        this.settings.buttonLabelStyle ||
        "casual";
      const timezoneSetting =
        this.settings?.exlibris?.ui?.timezone || this.settings.timezone || null;
      const menuLocations =
        this.settings?.exlibris?.ui?.menuLocations ||
        this.settings.menuLocations;

      this.caseToolkit = {
        metadata: null,
        caseData: null,
        menuConfig: {
          buttonStyle,
          timezone: timezoneSetting,
          menuLocations,
        },
        buttonGroups: null,
        prepared: false,
        preparedAt: null,
        scrollStats: null,
      };

      const initialMetadata =
        typeof CaseDataExtractor !== "undefined" &&
        typeof CaseDataExtractor.getInitialMetadata === "function"
          ? CaseDataExtractor.getInitialMetadata()
          : null;

      const resolvedTimezone = this.resolveActiveTimezone(timezoneSetting);

      // DO NOT auto-inject panel on page load
      // Panel will only be injected when user clicks "Show Panel" button in banner
      console.log(
        '[ExLibris Extension] Panel injection disabled on page load. Use banner "Show Panel" button to inject panel.'
      );

      // Initialize field highlighting
      const highlightingEnabled =
        this.settings?.exlibris?.features?.fieldHighlighting !== false &&
        this.settings?.highlightingEnabled !== false;
      console.log(
        "[ExLibris Extension] FieldHighlighter initialization check:",
        {
          highlightingEnabled: highlightingEnabled,
          moduleLoaded: typeof FieldHighlighter !== "undefined",
          featureEnabled: SettingsManager.isFeatureEnabled("fieldHighlighting"),
        }
      );

      if (
        highlightingEnabled &&
        typeof FieldHighlighter !== "undefined" &&
        SettingsManager.isFeatureEnabled("fieldHighlighting")
      ) {
        console.log("[ExLibris Extension] Initializing FieldHighlighter...");
        FieldHighlighter.init();
      } else {
        console.log(
          "[ExLibris Extension] FieldHighlighter NOT initialized - condition failed"
        );
      }

      if (typeof handleAnchors === "function") {
        handleAnchors();
        this.observeCommunicationTab();
      }

      // Fetch full case data
      const caseData = await this.getCaseData(this.currentCaseId);
      if (!caseData) {
        console.warn("[ExLibris Extension] Could not extract case data");
        return;
      }

      this.caseToolkit.metadata = initialMetadata;
      this.caseToolkit.caseData = caseData;

      // Update persistent banner with case data
      if (typeof PersistentBanner !== "undefined") {
        await PersistentBanner.updateCurrentPage({
          type: "Case",
          caseNumber: caseData.caseNumber,
          subject: caseData.subject,
          status: caseData.status,
          subStatus: caseData.subStatus,
        });
      }

      // Initialize case comment memory (handles its own initialization via URL monitoring)
      if (
        typeof CaseCommentMemory !== "undefined" &&
        SettingsManager.isFeatureEnabled("caseCommentMemory")
      ) {
        CaseCommentMemory.init();
      }

      if (
        typeof CharacterCounter !== "undefined" &&
        SettingsManager.isFeatureEnabled("characterCounter")
      ) {
        CharacterCounter.init();
      }

      if (
        typeof MultiTabSync !== "undefined" &&
        SettingsManager.isFeatureEnabled("multiTabSync")
      ) {
        MultiTabSync.init(this.currentCaseId);
        console.log("[ExLibris Extension] MultiTabSync initialized");
      }

      // Enable Case Comment Extractor on Communications tab
      this.ensureCaseCommentExtractor({
        type: PageIdentifier?.pageTypes?.CASE_PAGE,
        view: PageIdentifier?.detectCasePageView?.() || this.currentPage?.view,
      });

      console.log("[ExLibris Extension] Case page features initialized");
    },

    /**
     * Initializes features for case comments page
     */
    async initializeCaseCommentsFeatures() {
      console.log(
        "[ExLibris Extension] Initializing case comments page features..."
      );

      await this.waitForElements();

      // Initialize case comment memory (handles its own initialization via URL monitoring)
      if (
        typeof CaseCommentMemory !== "undefined" &&
        SettingsManager.isFeatureEnabled("caseCommentMemory")
      ) {
        CaseCommentMemory.init();
      }

      // Initialize character counter
      if (
        typeof CharacterCounter !== "undefined" &&
        SettingsManager.isFeatureEnabled("characterCounter")
      ) {
        CharacterCounter.init();
      }

      // Ensure Case Comment Extractor is active on comments view
      this.ensureCaseCommentExtractor({
        type: PageIdentifier?.pageTypes?.CASE_COMMENTS,
        view: "case_comments",
      });
    },

    /**
     * Initializes or cleans up CaseCommentExtractor based on page context
     * @param {Object} pageInfo
     */
    ensureCaseCommentExtractor(pageInfo) {
      if (typeof CaseCommentExtractor === "undefined") {
        return;
      }

      const isCaseCommentsPage =
        pageInfo?.type === PageIdentifier?.pageTypes?.CASE_COMMENTS;
      const isCommunicationTab =
        pageInfo?.type === PageIdentifier?.pageTypes?.CASE_PAGE &&
        pageInfo?.view === "communication";

      if (isCaseCommentsPage || isCommunicationTab) {
        CaseCommentExtractor.initialize();
        if (
          typeof CaseCommentExtractor.setupNavigationMonitoring === "function"
        ) {
          CaseCommentExtractor.setupNavigationMonitoring();
        }
        return;
      }

      if (typeof CaseCommentExtractor.cleanup === "function") {
        CaseCommentExtractor.cleanup();
      }
    },

    /**
     * Initializes features for case list page
     */
    async initializeCaseListFeatures() {
      console.log(
        "[ExLibris Extension] ========== INITIALIZING CASE LIST FEATURES =========="
      );

      console.log("[ExLibris Extension] Checking function availability:");
      console.log("  - handleCases:", typeof handleCases);
      console.log("  - handleStatus:", typeof handleStatus);
      console.log("  - handleAnchors:", typeof handleAnchors);

      // Wait for table to load
      console.log("[ExLibris Extension] Waiting for case list table...");
      await this.waitForCaseListTable();
      console.log("[ExLibris Extension] Table found!");

      // Run legacy case list functions from content_script.js

      // 1. Case row highlighting based on age (green -> yellow -> orange -> red)
      if (typeof handleCases === "function") {
        handleCases();
        console.log("[ExLibris Extension] Case row highlighting applied");
      } else {
        console.warn("[ExLibris Extension] handleCases function not available");
      }

      // 2. Status badge highlighting (New Email Received, In Progress, etc.)
      if (typeof handleStatus === "function") {
        handleStatus();
        console.log("[ExLibris Extension] Status badge highlighting applied");
      } else {
        console.warn(
          "[ExLibris Extension] handleStatus function not available"
        );
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
          const table = document.querySelector("table tbody");
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
      const table = document.querySelector("table");
      if (!table) return;

      // Disconnect existing observer if any
      if (this.caseListObserver) {
        this.caseListObserver.disconnect();
      }

      this.caseListObserver = new MutationObserver(() => {
        // Re-apply highlighting functions when table changes (sorting, filtering, pagination)
        if (typeof handleCases === "function") {
          handleCases();
        }
        if (typeof handleStatus === "function") {
          handleStatus();
        }
      });

      this.caseListObserver.observe(table, {
        childList: true,
        subtree: true,
      });

      console.log(
        "[ExLibris Extension] Case list observer initialized (handleCases, handleStatus)"
      );
    },

    /**
     * Observes Communication tab for changes and re-validates email "From" field
     */
    observeCommunicationTab() {
      // Watch for changes in the communication/email area
      const emailContainer =
        document.querySelector(".standardField.uiMenu") || document.body;

      // Disconnect existing observer if any
      if (this.communicationObserver) {
        this.communicationObserver.disconnect();
      }

      this.communicationObserver = new MutationObserver(() => {
        // Re-validate email "From" field when content changes
        if (typeof handleAnchors === "function") {
          handleAnchors();
        }
      });

      this.communicationObserver.observe(emailContainer, {
        childList: true,
        subtree: true,
      });

      console.log(
        "[ExLibris Extension] Communication tab observer initialized (handleAnchors)"
      );
    },

    /**
     * Gets case data (from cache or by extraction)
     * @param {string} caseId
     * @returns {Promise<Object>}
     */
    async getCaseData(caseId, options = {}) {
      const { forceRefresh = false } = options;

      if (!forceRefresh && typeof CaseDataStore !== "undefined") {
        const stored = CaseDataStore.getCurrentData();
        if (stored && (!caseId || stored.caseId === caseId)) {
          console.log("[ExLibris Extension] Using CaseDataStore data");
          return stored;
        }
      }

      if (typeof CaseContextWatcher !== "undefined") {
        await CaseContextWatcher.getStableContext?.({
          requireCase: true,
          timeout: 4000,
        });
      }

      if (typeof CaseDataExtractor === "undefined") {
        console.warn(
          "[ExLibris Extension] CaseDataExtractor module not loaded"
        );
        return null;
      }

      console.log("[ExLibris Extension] Extracting case data...");
      const caseData = await CaseDataExtractor.getData();

      if (caseData && typeof CaseDataStore !== "undefined") {
        await CaseDataStore.setCurrentData(caseData, "content-script");
      }

      return caseData;
    },

    /**
     * Gets last modified date from page
     * @returns {string|null}
     */
    getLastModifiedDate() {
      if (typeof CaseDataExtractor !== "undefined") {
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
          const hasRecordLayout = document.querySelector(
            "records-record-layout-item"
          );
          const hasHighlights = document.querySelector(".highlights");

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
     * Resolve the active timezone based on settings or browser detection
     * @param {string|null} preferred
     * @returns {string|null}
     */
    resolveActiveTimezone(preferred) {
      if (preferred && preferred !== "auto") {
        return preferred;
      }

      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return detected || null;
      } catch (error) {
        console.warn(
          "[ExLibris Extension] Unable to detect timezone automatically.",
          error
        );
        return null;
      }
    },

    /**
     * Handles messages from popup or background script
     * @param {Object} request
     * @param {Object} sender
     * @param {Function} sendResponse
     */
    handleMessage(request, sender, sendResponse) {
      console.log("[ExLibris Extension] Received message:", request);

      if (request.action === "updateSettings") {
        this.settings = { ...this.settings, ...request.settings };
        this.refresh();
        sendResponse({ success: true });
      } else if (request.action === "getCaseData") {
        this.getCaseData(this.currentCaseId).then((data) => {
          sendResponse({ success: true, data });
        });
      } else if (request.action === "refresh") {
        this.refresh();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Unknown action" });
      }
    },

    /**
     * Refreshes all features
     */
    async refresh() {
      console.log("[ExLibris Extension] Refreshing...");

      if (this.currentPage) {
        await this.handlePageChange(this.currentPage);
      }
    },

    /**
     * Handles navigation changes detected by NavigationObserver
     * @param {string} url - New URL
     */
    async handleNavigationChange(url) {
      Logger?.info("Handling navigation to:", url);

      // Clear legacy API data on navigation (for backwards compatibility)
      // New data flow uses InterceptorCacheManager which handles its own cache
      // Note: We do NOT clear apiCaseData on navigation
      // ONLY ALLOW FOR REPLACEMENT - apiCaseData should only be replaced with new data, never deleted
      // This prevents the primary metadata section from showing only subject with hyphens for other fields
      // New data flow uses InterceptorCacheManager which handles its own cache and will replace data
      // Deleting here causes metadata loss before new data arrives
      // this.apiCaseData = null;  // REMOVED - causes metadata loss
      // this.apiCaseDataTimestamp = null;  // REMOVED - causes metadata loss
      console.log(
        "[ExLibris Extension] Navigation detected - apiCaseData will be replaced with fresh data when available"
      );

      // Teardown existing features
      this.cleanup();

      // Re-identify page type
      // Priority 1: Use window.exLibrisPageInfo if available (from pageInfoInitializer.js)
      // Priority 2: Fall back to PageIdentifier.identifyPage()
      let pageInfo = null;

      if (window.exLibrisPageInfo?.ready && window.exLibrisPageInfo?.current) {
        pageInfo = window.exLibrisPageInfo.current;
        Logger?.info("Using window.exLibrisPageInfo:", pageInfo?.type);
      } else if (typeof PageIdentifier !== "undefined") {
        pageInfo = PageIdentifier.identifyPage(url);
        Logger?.info("Using PageIdentifier.identifyPage():", pageInfo?.type);
      }

      if (pageInfo) {
        await this.handlePageChange(pageInfo);
      }
    },

    /**
     * Cleans up existing features
     */
    cleanup() {
      this.caseToolkit = {
        metadata: null,
        caseData: null,
        menuConfig: null,
        buttonGroups: null,
        prepared: false,
        preparedAt: null,
        scrollStats: null,
      };

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
      if (typeof FieldHighlighter !== "undefined" && FieldHighlighter.cleanup) {
        FieldHighlighter.cleanup();
      }

      // Remove character counter
      if (typeof CharacterCounter !== "undefined") {
        CharacterCounter.remove();
      }

      // Cleanup modules if they have cleanup methods
      if (
        typeof CaseDataExtractor !== "undefined" &&
        CaseDataExtractor.cleanup
      ) {
        CaseDataExtractor.cleanup();
      }

      // Cleanup CaseCommentMemory
      if (
        typeof CaseCommentMemory !== "undefined" &&
        CaseCommentMemory.cleanup
      ) {
        CaseCommentMemory.cleanup();
      }

      // Cleanup CaseCommentExtractor
      if (
        typeof CaseCommentExtractor !== "undefined" &&
        CaseCommentExtractor.cleanup
      ) {
        CaseCommentExtractor.cleanup();
      }

      // Cleanup MultiTabSync
      if (typeof MultiTabSync !== "undefined" && MultiTabSync.cleanup) {
        MultiTabSync.cleanup();
      }

      // NOTE: Do NOT cleanup PersistentBanner here - it should persist across SPA navigation
      // PersistentBanner is only cleaned up when:
      // 1. Feature is disabled (via settings listener)
      // 2. Extension is destroyed (via destroy() method)
    },

    /**
     * Complete cleanup (called on unload)
     */
    destroy() {
      console.log("[ExLibris Extension] Destroying...");

      this.cleanup();

      // Cleanup all modules
      if (
        typeof CustomerMasterManager !== "undefined" &&
        CustomerMasterManager.cleanup
      ) {
        CustomerMasterManager.cleanup();
      }
      if (
        typeof CaseCommentMemory !== "undefined" &&
        CaseCommentMemory.cleanup
      ) {
        CaseCommentMemory.cleanup();
      }
      if (
        typeof ContextMenuHandler !== "undefined" &&
        ContextMenuHandler.cleanup
      ) {
        ContextMenuHandler.cleanup();
      }
      if (typeof MultiTabSync !== "undefined" && MultiTabSync.cleanup) {
        MultiTabSync.cleanup();
      }
      if (
        typeof NavigationObserver !== "undefined" &&
        NavigationObserver.stop
      ) {
        NavigationObserver.stop();
      }
      if (
        typeof FlexipagePanelInjector !== "undefined" &&
        FlexipagePanelInjector.teardown
      ) {
        FlexipagePanelInjector.teardown();
      }

      // Cleanup PersistentBanner (only on extension destroy/unload)
      // This will restore layout adjustments properly
      if (typeof PersistentBanner !== "undefined" && PersistentBanner.cleanup) {
        PersistentBanner.cleanup();
      }

      this.isInitialized = false;
    },
  };

  // ========== INITIALIZATION ==========

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ExLibrisExtension.init();
    });
  } else {
    ExLibrisExtension.init();
  }

  // Make available globally for debugging
  window.ExLibrisExtension = ExLibrisExtension;
})();
