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
    // Add styles if not already added
    if (!document.getElementById('exlibris-multitab-banner-styles')) {
      const style = document.createElement('style');
      style.id = 'exlibris-multitab-banner-styles';
      style.textContent = `
        #exlibris-multitab-warning {
          position: fixed !important;
          top: 0 !important;
          left: 0;
          right: 0;
          width: 100%;
          z-index: 9998;
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
          color: #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          font-family: 'Salesforce Sans', Arial, sans-serif;
          font-size: 11px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          height: 3rem;
          overflow: hidden;
          display: flex;
          align-items: center;
          animation: slideDown 0.3s ease-out;
        }

        #exlibris-multitab-warning-container {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px;
          max-width: 100%;
          height: 100%;
          flex-wrap: nowrap;
          overflow-x: auto;
          overflow-y: hidden;
        }

        #exlibris-multitab-warning-icon {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          font-size: 14px;
        }

        #exlibris-multitab-warning-message {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          padding: 0 8px;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }

        #exlibris-multitab-warning-text {
          font-size: 11px;
          line-height: 1.2;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        #exlibris-multitab-warning-text strong {
          font-weight: 600;
          margin-right: 4px;
        }

        #exlibris-multitab-warning-actions {
          flex-shrink: 0;
          display: flex;
          gap: 6px;
          align-items: center;
          padding: 0 8px;
        }

        #exlibris-multitab-warning-switch,
        #exlibris-multitab-warning-dismiss {
          background-color: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 3px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          height: 26px;
          line-height: 1;
        }

        #exlibris-multitab-warning-switch:hover {
          background-color: rgba(255, 255, 255, 0.3);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        #exlibris-multitab-warning-dismiss {
          background-color: transparent;
          border: none;
          padding: 4px 8px;
          font-size: 16px;
          opacity: 0.7;
          width: 26px;
        }

        #exlibris-multitab-warning-dismiss:hover {
          opacity: 1;
          background-color: rgba(255, 255, 255, 0.1);
        }

        #exlibris-multitab-warning-switch:active,
        #exlibris-multitab-warning-dismiss:active {
          transform: translateY(0);
        }

        #exlibris-multitab-warning-container::-webkit-scrollbar {
          height: 4px;
        }

        #exlibris-multitab-warning-container::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }

        #exlibris-multitab-warning-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
        }

        #exlibris-multitab-warning-container::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }

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

    const banner = document.createElement('div');
    banner.id = 'exlibris-multitab-warning';

    const container = document.createElement('div');
    container.id = 'exlibris-multitab-warning-container';

    const icon = document.createElement('div');
    icon.id = 'exlibris-multitab-warning-icon';
    icon.textContent = '⚠️';

    const message = document.createElement('div');
    message.id = 'exlibris-multitab-warning-message';

    const text = document.createElement('span');
    text.id = 'exlibris-multitab-warning-text';
    text.innerHTML = '<strong>Warning:</strong> This case is open in another tab. Editing in multiple tabs may cause data loss.';

    message.appendChild(text);

    const actions = document.createElement('div');
    actions.id = 'exlibris-multitab-warning-actions';

    const switchButton = document.createElement('button');
    switchButton.id = 'exlibris-multitab-warning-switch';
    switchButton.textContent = 'Switch Tab';
    switchButton.onclick = () => {
      requestTabSwitch();
    };

    const dismissButton = document.createElement('button');
    dismissButton.id = 'exlibris-multitab-warning-dismiss';
    dismissButton.textContent = '✕';
    dismissButton.title = 'Dismiss (warning will reappear if other tab is still active)';
    dismissButton.onclick = () => {
      hideWarningBanner();
    };

    actions.appendChild(switchButton);
    actions.appendChild(dismissButton);

    container.appendChild(icon);
    container.appendChild(message);
    container.appendChild(actions);
    banner.appendChild(container);

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
