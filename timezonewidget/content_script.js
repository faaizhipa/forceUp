/**
 * Content Script
 * Injects and manages the Global Sync Widget on web pages
 * 
 * @description Entry point for content script injection.
 * Handles initialization, message passing, and cleanup.
 */

(function() {
  'use strict';

  // ============================================================================
  // Constants
  // ============================================================================

  const WIDGET_CONTAINER_ID = 'gsw-injected-container';
  const TOGGLE_BUTTON_ID = 'gsw-toggle-button';
  const DEBOUNCE_DELAY = 250;

  // ============================================================================
  // State
  // ============================================================================

  // Global state object for SPA persistence
  window.GlobalSyncExtension = window.GlobalSyncExtension || {
    isInitialized: false,
    isVisible: false,
    config: null,
    lastUrl: null
  };

  const state = window.GlobalSyncExtension;

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Debounce function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Checks if TimezoneUtils is available
   * @returns {boolean}
   */
  function isTimezoneUtilsLoaded() {
    return typeof TimezoneUtils !== 'undefined';
  }

  /**
   * Checks if GlobalSyncWidget is available
   * @returns {boolean}
   */
  function isWidgetLoaded() {
    return typeof GlobalSyncWidget !== 'undefined';
  }

  // ============================================================================
  // Widget Management
  // ============================================================================

  /**
   * Creates the toggle button
   * @returns {HTMLElement}
   */
  function createToggleButton() {
    const existing = document.getElementById(TOGGLE_BUTTON_ID);
    if (existing) return existing;

    const button = document.createElement('button');
    button.id = TOGGLE_BUTTON_ID;
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    `;
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border: none;
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.5)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.4)';
    });

    button.addEventListener('click', toggleWidget);

    document.body.appendChild(button);
    return button;
  }

  /**
   * Creates the widget container
   * @returns {HTMLElement}
   */
  function createWidgetContainer() {
    const existing = document.getElementById(WIDGET_CONTAINER_ID);
    if (existing) return existing;

    const container = document.createElement('div');
    container.id = WIDGET_CONTAINER_ID;
    container.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      z-index: 999999;
      display: none;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.2s, transform 0.2s;
    `;

    document.body.appendChild(container);
    return container;
  }

  /**
   * Toggles widget visibility
   */
  function toggleWidget() {
    const container = document.getElementById(WIDGET_CONTAINER_ID);
    if (!container) return;

    state.isVisible = !state.isVisible;

    if (state.isVisible) {
      container.style.display = 'block';
      // Trigger reflow
      container.offsetHeight;
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    } else {
      container.style.opacity = '0';
      container.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (!state.isVisible) {
          container.style.display = 'none';
        }
      }, 200);
    }
  }

  /**
   * Initializes the widget with configuration
   * @param {Object} config - Widget configuration
   */
  function initializeWidget(config) {
    if (!isWidgetLoaded()) {
      console.error('[ContentScript] GlobalSyncWidget module not loaded');
      return;
    }

    if (!isTimezoneUtilsLoaded()) {
      console.error('[ContentScript] TimezoneUtils module not loaded');
      return;
    }

    const container = createWidgetContainer();
    createToggleButton();

    // Initialize the widget
    const success = GlobalSyncWidget.init(container, {
      localTimezone: config.localTimezone,
      customerTimezone: config.customerTimezone,
      favoriteTimezones: config.favoriteTimezones || []
    });

    if (success) {
      state.isInitialized = true;
      state.config = config;
      console.log('[ContentScript] Widget initialized with config:', config);
    } else {
      console.error('[ContentScript] Failed to initialize widget');
    }
  }

  /**
   * Fetches configuration from background script
   * @returns {Promise<Object>}
   */
  async function fetchConfig() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getConfig' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.success) {
          resolve(response.config);
        } else {
          reject(new Error(response?.error || 'Failed to get config'));
        }
      });
    });
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  /**
   * Handles messages from background script
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[ContentScript] Received message:', message.action);

    switch (message.action) {
      case 'configUpdated':
        if (state.isInitialized && isWidgetLoaded()) {
          GlobalSyncWidget.updateConfig(message.config);
          state.config = { ...state.config, ...message.config };
        }
        sendResponse({ success: true });
        break;

      case 'showWidget':
        if (!state.isVisible) {
          toggleWidget();
        }
        sendResponse({ success: true });
        break;

      case 'hideWidget':
        if (state.isVisible) {
          toggleWidget();
        }
        sendResponse({ success: true });
        break;

      case 'getState':
        sendResponse({ 
          success: true, 
          state: {
            isInitialized: state.isInitialized,
            isVisible: state.isVisible,
            config: state.config
          }
        });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // Async response
  });

  // ============================================================================
  // Navigation Detection
  // ============================================================================

  /**
   * Handles URL changes (for SPA support)
   */
  const handleNavigation = debounce(() => {
    const currentUrl = window.location.href;
    
    if (currentUrl !== state.lastUrl) {
      state.lastUrl = currentUrl;
      console.log('[ContentScript] Navigation detected:', currentUrl);
      
      // Re-check if widget elements exist
      if (state.isInitialized) {
        const container = document.getElementById(WIDGET_CONTAINER_ID);
        const button = document.getElementById(TOGGLE_BUTTON_ID);
        
        if (!container || !button) {
          console.log('[ContentScript] Widget elements missing, reinitializing...');
          if (state.config) {
            initializeWidget(state.config);
          }
        }
      }
    }
  }, DEBOUNCE_DELAY);

  // Monitor for SPA navigation
  const originalPushState = history.pushState;
  history.pushState = function() {
    originalPushState.apply(this, arguments);
    handleNavigation();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    handleNavigation();
  };

  window.addEventListener('popstate', handleNavigation);
  window.addEventListener('hashchange', handleNavigation);

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Main initialization function
   */
  async function init() {
    // Prevent double initialization
    if (state.isInitialized) {
      console.log('[ContentScript] Already initialized');
      return;
    }

    console.log('[ContentScript] Initializing...');
    state.lastUrl = window.location.href;

    try {
      // Fetch configuration from background
      const config = await fetchConfig();
      console.log('[ContentScript] Config loaded:', config);

      // Initialize widget
      initializeWidget(config);

    } catch (error) {
      console.error('[ContentScript] Initialization failed:', error);
      
      // Fallback to browser timezone
      const fallbackConfig = {
        localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        customerTimezone: 'America/New_York',
        favoriteTimezones: []
      };
      
      initializeWidget(fallbackConfig);
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Cleanup function for when content script is unloaded
   */
  function cleanup() {
    if (isWidgetLoaded() && state.isInitialized) {
      GlobalSyncWidget.destroy();
    }

    const container = document.getElementById(WIDGET_CONTAINER_ID);
    const button = document.getElementById(TOGGLE_BUTTON_ID);
    
    if (container) container.remove();
    if (button) button.remove();

    state.isInitialized = false;
    state.isVisible = false;
    
    console.log('[ContentScript] Cleaned up');
  }

  // Handle page unload
  window.addEventListener('beforeunload', cleanup);

  // ============================================================================
  // Start
  // ============================================================================

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
