/**
 * Multi-Tab Sync Module
 * Warns users when the same case is open in multiple tabs
 * Prevents data loss from simultaneous editing
 */

const MultiTabSync = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  
  let isInitialized = false;
  let currentCaseId = null;
  let broadcastChannel = null;
  let warningBanner = null;
  let otherTabs = new Map(); // tabId -> { caseId, timestamp }
  let heartbeatInterval = null;

  const HEARTBEAT_INTERVAL = 3000; // 3 seconds
  const TAB_TIMEOUT = 10000; // 10 seconds
  const CHANNEL_NAME = 'exlibris-case-sync';

  // ========== PRIVATE FUNCTIONS ==========

  /**
   * Creates the warning banner element
   * @returns {HTMLElement}
   */
  function createWarningBanner() {
    const banner = document.createElement('div');
    banner.id = 'exlibris-multitab-warning';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: white;
      padding: 12px 20px;
      z-index: 999999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: slideDown 0.3s ease-out;
    `;

    const message = document.createElement('div');
    message.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    `;

    const icon = document.createElement('span');
    icon.textContent = '⚠️';
    icon.style.fontSize = '20px';

    const text = document.createElement('span');
    text.innerHTML = `
      <strong>Warning:</strong> This case is open in another tab. 
      Editing in multiple tabs may cause data loss.
    `;

    message.appendChild(icon);
    message.appendChild(text);

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 12px;
      align-items: center;
    `;

    const switchButton = document.createElement('button');
    switchButton.textContent = 'Switch to Other Tab';
    switchButton.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.2s;
    `;
    switchButton.onmouseover = () => {
      switchButton.style.background = 'rgba(255, 255, 255, 0.3)';
    };
    switchButton.onmouseout = () => {
      switchButton.style.background = 'rgba(255, 255, 255, 0.2)';
    };
    switchButton.onclick = () => {
      requestTabSwitch();
    };

    const dismissButton = document.createElement('button');
    dismissButton.textContent = '✕';
    dismissButton.title = 'Dismiss (warning will reappear if other tab is still active)';
    dismissButton.style.cssText = `
      background: transparent;
      border: none;
      color: white;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 18px;
      opacity: 0.7;
      transition: opacity 0.2s;
    `;
    dismissButton.onmouseover = () => {
      dismissButton.style.opacity = '1';
    };
    dismissButton.onmouseout = () => {
      dismissButton.style.opacity = '0.7';
    };
    dismissButton.onclick = () => {
      hideWarningBanner();
    };

    actions.appendChild(switchButton);
    actions.appendChild(dismissButton);

    banner.appendChild(message);
    banner.appendChild(actions);

    // Add animation keyframes
    if (!document.getElementById('exlibris-banner-animations')) {
      const style = document.createElement('style');
      style.id = 'exlibris-banner-animations';
      style.textContent = `
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    return banner;
  }

  /**
   * Shows the warning banner
   */
  function showWarningBanner() {
    if (warningBanner && warningBanner.parentNode) {
      return; // Already showing
    }

    warningBanner = createWarningBanner();
    document.body.insertBefore(warningBanner, document.body.firstChild);

    console.log('[MultiTabSync] Warning banner displayed');
  }

  /**
   * Hides the warning banner
   */
  function hideWarningBanner() {
    if (warningBanner && warningBanner.parentNode) {
      warningBanner.parentNode.removeChild(warningBanner);
      warningBanner = null;
      console.log('[MultiTabSync] Warning banner hidden');
    }
  }

  /**
   * Requests to switch to the other tab
   */
  function requestTabSwitch() {
    // Send message to background script to switch tabs
    chrome.runtime.sendMessage({
      action: 'switchToOtherTab',
      caseId: currentCaseId
    }, (response) => {
      if (response && response.success) {
        console.log('[MultiTabSync] Switched to other tab');
      } else {
        console.warn('[MultiTabSync] Could not switch tabs');
        alert('Unable to switch tabs. The other tab may have been closed.');
      }
    });
  }

  /**
   * Broadcasts current tab state
   */
  function broadcastHeartbeat() {
    if (!broadcastChannel || !currentCaseId) return;

    const message = {
      type: 'heartbeat',
      caseId: currentCaseId,
      tabId: generateTabId(),
      timestamp: Date.now()
    };

    try {
      broadcastChannel.postMessage(message);
    } catch (err) {
      console.error('[MultiTabSync] Error broadcasting:', err);
    }
  }

  /**
   * Handles incoming broadcast messages
   * @param {MessageEvent} event
   */
  function handleBroadcastMessage(event) {
    const message = event.data;

    if (message.type === 'heartbeat') {
      // Another tab is viewing the same case
      if (message.caseId === currentCaseId && message.tabId !== generateTabId()) {
        otherTabs.set(message.tabId, {
          caseId: message.caseId,
          timestamp: message.timestamp
        });

        // Show warning if not already showing
        if (!warningBanner) {
          showWarningBanner();
        }
      }
    } else if (message.type === 'closed') {
      // Another tab closed the case
      otherTabs.delete(message.tabId);
      
      // Hide warning if no other tabs
      if (otherTabs.size === 0) {
        hideWarningBanner();
      }
    }
  }

  /**
   * Cleans up expired tab entries
   */
  function cleanupExpiredTabs() {
    const now = Date.now();
    const expired = [];

    for (const [tabId, data] of otherTabs.entries()) {
      if (now - data.timestamp > TAB_TIMEOUT) {
        expired.push(tabId);
      }
    }

    expired.forEach(tabId => {
      otherTabs.delete(tabId);
      console.log('[MultiTabSync] Removed expired tab:', tabId);
    });

    // Hide warning if no active tabs
    if (otherTabs.size === 0) {
      hideWarningBanner();
    }
  }

  /**
   * Generates a unique tab ID
   * @returns {string}
   */
  function generateTabId() {
    if (!window.__exlibrisTabId) {
      window.__exlibrisTabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return window.__exlibrisTabId;
  }

  /**
   * Broadcasts tab closing
   */
  function broadcastClosed() {
    if (!broadcastChannel || !currentCaseId) return;

    const message = {
      type: 'closed',
      caseId: currentCaseId,
      tabId: generateTabId()
    };

    try {
      broadcastChannel.postMessage(message);
    } catch (err) {
      console.error('[MultiTabSync] Error broadcasting close:', err);
    }
  }

  // ========== PUBLIC API ==========

  return {
    /**
     * Initializes multi-tab sync for a case
     * @param {string} caseId
     */
    init(caseId) {
      if (!caseId) {
        console.warn('[MultiTabSync] No case ID provided');
        return;
      }

      console.log('[MultiTabSync] Initializing for case:', caseId);

      // Clean up previous instance
      this.cleanup();

      currentCaseId = caseId;

      // Create broadcast channel
      try {
        broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
        broadcastChannel.onmessage = handleBroadcastMessage;
        console.log('[MultiTabSync] BroadcastChannel created');
      } catch (err) {
        console.error('[MultiTabSync] BroadcastChannel not supported:', err);
        // Fallback to chrome.storage events could be implemented here
        return;
      }

      // Start heartbeat
      heartbeatInterval = setInterval(() => {
        broadcastHeartbeat();
        cleanupExpiredTabs();
      }, HEARTBEAT_INTERVAL);

      // Send initial heartbeat
      broadcastHeartbeat();

      // Listen for page unload to broadcast close
      window.addEventListener('beforeunload', broadcastClosed);

      isInitialized = true;
      console.log('[MultiTabSync] Initialized');
    },

    /**
     * Checks if case is open in other tabs
     * @returns {boolean}
     */
    hasOtherTabs() {
      return otherTabs.size > 0;
    },

    /**
     * Gets count of other tabs
     * @returns {number}
     */
    getOtherTabCount() {
      return otherTabs.size;
    },

    /**
     * Manually shows warning
     */
    showWarning() {
      showWarningBanner();
    },

    /**
     * Manually hides warning
     */
    hideWarning() {
      hideWarningBanner();
    },

    /**
     * Cleans up the module
     */
    cleanup() {
      if (!isInitialized) return;

      console.log('[MultiTabSync] Cleaning up...');

      // Broadcast close before cleanup
      broadcastClosed();

      // Clear heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      // Close broadcast channel
      if (broadcastChannel) {
        broadcastChannel.close();
        broadcastChannel = null;
      }

      // Hide warning
      hideWarningBanner();

      // Clear state
      otherTabs.clear();
      currentCaseId = null;
      isInitialized = false;
    }
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MultiTabSync;
}
