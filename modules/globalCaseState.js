/**
 * Global Case State Manager
 * Single source of truth for current case information across all modules
 *
 * OWNERSHIP RULES:
 * - PageIdentifier: WRITES to currentCaseNumber, currentCaseId, lastUpdated
 * - All other modules: READ ONLY from global state
 * - All modules: Can write to their own consumption flags
 */

const GlobalCaseState = (function() {
  'use strict';

  // ========== PRIVATE STATE (DO NOT ACCESS DIRECTLY) ==========

  const state = {
    // Current case information (ONLY PageIdentifier can write)
    currentCaseNumber: null,
    currentCaseId: null,
    currentUrl: null,
    lastUpdated: null,
    lastUpdatedBy: null,

    // Consumption flags (each module sets its own flag)
    consumptionFlags: {
      cacheManagerUsed: false,
      caseDataExtractorUsed: false,
      persistentBannerUsed: false,
      fieldHighlighterUsed: false
    }
  };

  // Event listeners for state changes
  const stateChangeListeners = [];

  // ========== PUBLIC API ==========

  return {
    /**
     * Gets current case number (READ ONLY for all modules)
     * @returns {string|null}
     */
    getCaseNumber() {
      return state.currentCaseNumber;
    },

    /**
     * Gets current case ID (READ ONLY for all modules)
     * @returns {string|null}
     */
    getCaseId() {
      return state.currentCaseId;
    },

    /**
     * Gets current URL (READ ONLY for all modules)
     * @returns {string|null}
     */
    getUrl() {
      return state.currentUrl;
    },

    /**
     * Gets last updated timestamp (READ ONLY for all modules)
     * @returns {number|null}
     */
    getLastUpdated() {
      return state.lastUpdated;
    },

    /**
     * Gets last updated by module name (READ ONLY for all modules)
     * @returns {string|null}
     */
    getLastUpdatedBy() {
      return state.lastUpdatedBy;
    },

    /**
     * Gets full state snapshot (READ ONLY)
     * @returns {Object}
     */
    getState() {
      return {
        currentCaseNumber: state.currentCaseNumber,
        currentCaseId: state.currentCaseId,
        currentUrl: state.currentUrl,
        lastUpdated: state.lastUpdated,
        lastUpdatedBy: state.lastUpdatedBy,
        consumptionFlags: { ...state.consumptionFlags }
      };
    },

    /**
     * Updates case information (ONLY PageIdentifier should call this)
     * Notifies all registered listeners when state changes
     * @param {Object} newState - { caseNumber, caseId, url }
     * @param {string} updatedBy - Module name that updated the state
     */
    updateCaseInfo(newState, updatedBy = 'Unknown') {
      // Validate caller (security check)
      const stack = new Error().stack;
      const isFromPageIdentifier = stack && stack.includes('pageIdentifier.js');

      if (!isFromPageIdentifier && updatedBy !== 'PageIdentifier') {
        console.error('[GlobalCaseState] VIOLATION: Only PageIdentifier can update case info. Called by:', updatedBy);
        console.error('[GlobalCaseState] Stack trace:', stack);
        return false;
      }

      const hasChanged =
        state.currentCaseNumber !== newState.caseNumber ||
        state.currentCaseId !== newState.caseId ||
        state.currentUrl !== newState.url;

      if (hasChanged) {
        const previousState = {
          caseNumber: state.currentCaseNumber,
          caseId: state.currentCaseId,
          url: state.currentUrl
        };

        console.log('[GlobalCaseState] State updated by', updatedBy);
        console.log('[GlobalCaseState] Previous:', previousState);
        console.log('[GlobalCaseState] New:', newState);

        state.currentCaseNumber = newState.caseNumber || null;
        state.currentCaseId = newState.caseId || null;
        state.currentUrl = newState.url || null;
        state.lastUpdated = Date.now();
        state.lastUpdatedBy = updatedBy;

        // Reset all consumption flags when state changes
        state.consumptionFlags.cacheManagerUsed = false;
        state.consumptionFlags.caseDataExtractorUsed = false;
        state.consumptionFlags.persistentBannerUsed = false;
        state.consumptionFlags.fieldHighlighterUsed = false;

        console.log('[GlobalCaseState] Consumption flags reset to false');

        // Notify all registered listeners
        this._notifyListeners(previousState, {
          caseNumber: state.currentCaseNumber,
          caseId: state.currentCaseId,
          url: state.currentUrl
        });
      }

      return true;
    },

    /**
     * Notify all registered listeners of state change
     * @param {Object} previousState - Previous state before change
     * @param {Object} newState - New state after change
     * @private
     */
    _notifyListeners(previousState, newState) {
      console.log(`[GlobalCaseState] Notifying ${stateChangeListeners.length} listeners of state change`);

      stateChangeListeners.forEach((listener, index) => {
        try {
          console.log(`[GlobalCaseState] Notifying listener ${index + 1}: ${listener.moduleName}`);
          listener.callback(previousState, newState);
        } catch (error) {
          console.error(`[GlobalCaseState] Error in listener ${listener.moduleName}:`, error);
        }
      });
    },

    /**
     * Register a listener for state changes
     * @param {string} moduleName - Name of the module registering the listener
     * @param {Function} callback - Callback function (previousState, newState) => void
     * @returns {Function} Unregister function
     */
    onStateChange(moduleName, callback) {
      if (typeof callback !== 'function') {
        console.error('[GlobalCaseState] Callback must be a function');
        return () => {};
      }

      const listener = { moduleName, callback };
      stateChangeListeners.push(listener);

      console.log(`[GlobalCaseState] Registered listener for ${moduleName} (total: ${stateChangeListeners.length})`);

      // Return unregister function
      return () => {
        const index = stateChangeListeners.indexOf(listener);
        if (index > -1) {
          stateChangeListeners.splice(index, 1);
          console.log(`[GlobalCaseState] Unregistered listener for ${moduleName} (remaining: ${stateChangeListeners.length})`);
        }
      };
    },

    /**
     * Marks that CacheManager has consumed the current state
     * @param {string} caseNumber - Case number being consumed (for validation)
     */
    markCacheManagerUsed(caseNumber) {
      if (caseNumber === state.currentCaseNumber) {
        state.consumptionFlags.cacheManagerUsed = true;
        console.log('[GlobalCaseState] CacheManager marked as used for case:', caseNumber);
      } else {
        console.warn('[GlobalCaseState] CacheManager tried to mark used for wrong case:', caseNumber, 'Expected:', state.currentCaseNumber);
      }
    },

    /**
     * Marks that CaseDataExtractor has consumed the current state
     * @param {string} caseNumber - Case number being consumed (for validation)
     */
    markCaseDataExtractorUsed(caseNumber) {
      if (caseNumber === state.currentCaseNumber) {
        state.consumptionFlags.caseDataExtractorUsed = true;
        console.log('[GlobalCaseState] CaseDataExtractor marked as used for case:', caseNumber);
      } else {
        console.warn('[GlobalCaseState] CaseDataExtractor tried to mark used for wrong case:', caseNumber, 'Expected:', state.currentCaseNumber);
      }
    },

    /**
     * Marks that PersistentBanner has consumed the current state
     * @param {string} caseNumber - Case number being consumed (for validation)
     */
    markPersistentBannerUsed(caseNumber) {
      if (caseNumber === state.currentCaseNumber) {
        state.consumptionFlags.persistentBannerUsed = true;
        console.log('[GlobalCaseState] PersistentBanner marked as used for case:', caseNumber);
      } else {
        console.warn('[GlobalCaseState] PersistentBanner tried to mark used for wrong case:', caseNumber, 'Expected:', state.currentCaseNumber);
      }
    },

    /**
     * Marks that FieldHighlighter has consumed the current state
     * @param {string} caseNumber - Case number being consumed (for validation)
     */
    markFieldHighlighterUsed(caseNumber) {
      if (caseNumber === state.currentCaseNumber) {
        state.consumptionFlags.fieldHighlighterUsed = true;
        console.log('[GlobalCaseState] FieldHighlighter marked as used for case:', caseNumber);
      } else {
        console.warn('[GlobalCaseState] FieldHighlighter tried to mark used for wrong case:', caseNumber, 'Expected:', state.currentCaseNumber);
      }
    },

    /**
     * Gets consumption flag for a specific module
     * @param {string} moduleName - 'cacheManager', 'caseDataExtractor', 'persistentBanner', 'fieldHighlighter'
     * @returns {boolean}
     */
    getConsumptionFlag(moduleName) {
      const flagKey = `${moduleName}Used`;
      return state.consumptionFlags[flagKey] || false;
    },

    /**
     * Gets all consumption flags
     * @returns {Object}
     */
    getAllConsumptionFlags() {
      return { ...state.consumptionFlags };
    },

    /**
     * Clears all state (for cleanup/reset)
     */
    clear() {
      console.log('[GlobalCaseState] Clearing all state');
      state.currentCaseNumber = null;
      state.currentCaseId = null;
      state.currentUrl = null;
      state.lastUpdated = null;
      state.lastUpdatedBy = null;
      state.consumptionFlags.cacheManagerUsed = false;
      state.consumptionFlags.caseDataExtractorUsed = false;
      state.consumptionFlags.persistentBannerUsed = false;
      state.consumptionFlags.fieldHighlighterUsed = false;
    }
  };
})();

// Export to global scope
if (typeof window !== 'undefined') {
  window.GlobalCaseState = GlobalCaseState;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlobalCaseState;
}
