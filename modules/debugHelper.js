/**
 * Debug Helper Module
 * Provides debugging utilities accessible from browser console
 * Usage: window.ExLibrisDebug.inspectStorage()
 */

(function() {
  'use strict';

  const DebugHelper = {
    enabled: true, // Set to false in production builds
    
    /**
     * Log debug message
     * @param {string} module - Module name
     * @param {string} message - Message
     * @param {*} data - Optional data
     */
    log(module, message, data) {
      if (this.enabled) {
        console.log(`[${module}]`, message, data || '');
      }
    },

    /**
     * Inspect chrome.storage contents
     */
    inspectStorage() {
      console.group('[Debug] Storage Inspection');
      
      chrome.storage.sync.get(null, (sync) => {
        console.log('Sync Storage:', sync);
      });
      
      chrome.storage.local.get(null, (local) => {
        console.log('Local Storage:', local);
      });
      
      console.groupEnd();
    },

    /**
     * Test critical DOM selectors
     */
    testSelectors() {
      console.group('[Debug] Selector Tests');
      
      const selectors = {
        'Case Page URL': window.location.href.includes('/lightning/r/Case/'),
        'Case Number Field': document.querySelector('records-record-layout-item[field-label*="Case Number"]'),
        'Status Field': document.querySelector('records-record-layout-item[field-label*="Status"]'),
        'Subject Field': document.querySelector('records-record-layout-item[field-label*="Subject"]'),
        'Persistent Banner': document.getElementById('exl-persistent-banner'),
        'Global Header': document.querySelector('one-appnav'),
        'Lightning Layout': document.querySelector('lightning-layout')
      };
      
      Object.entries(selectors).forEach(([name, result]) => {
        const status = result ? '✓' : '✗';
        console.log(`${status} ${name}:`, result || 'Not found');
      });
      
      console.groupEnd();
    },

    /**
     * Inspect extension module states
     */
    inspectModules() {
      console.group('[Debug] Module States');
      
      const modules = {
        'ExLibrisExtension': typeof window.ExLibrisExtension !== 'undefined' ? window.ExLibrisExtension.isInitialized : false,
        'PersistentBanner': typeof PersistentBanner !== 'undefined' ? PersistentBanner.isInitialized : false,
        'SettingsManager': typeof SettingsManager !== 'undefined' ? SettingsManager.isInitialized : false,
        'CacheManager': typeof CacheManager !== 'undefined' ? CacheManager.isInitialized : false,
        'CaseDataExtractor': typeof CaseDataExtractor !== 'undefined' ? CaseDataExtractor.isInitialized : false,
        'FieldHighlighter': typeof FieldHighlighter !== 'undefined' ? FieldHighlighter.isInitialized : false
      };
      
      Object.entries(modules).forEach(([name, initialized]) => {
        console.log(`${name}:`, initialized ? '✓ Initialized' : '✗ Not initialized');
      });
      
      console.groupEnd();
    },

    /**
     * Get current page info
     */
    getPageInfo() {
      console.group('[Debug] Page Information');
      
      const info = {
        'URL': window.location.href,
        'Hostname': window.location.hostname,
        'Path': window.location.pathname,
        'Case ID': window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})/)?.[1] || 'Not found',
        'Extension Initialized': typeof window.ExLibrisExtension !== 'undefined' && window.ExLibrisExtension.isInitialized,
        'Current Case ID': typeof window.ExLibrisExtension !== 'undefined' ? window.ExLibrisExtension.currentCaseId : 'N/A'
      };
      
      Object.entries(info).forEach(([key, value]) => {
        console.log(`${key}:`, value);
      });
      
      console.groupEnd();
    },

    /**
     * Test cache functionality
     */
    testCache() {
      if (typeof CacheManager === 'undefined') {
        console.warn('[Debug] CacheManager not available');
        return;
      }
      
      console.group('[Debug] Cache Test');
      
      // Get current case ID
      const caseId = window.ExLibrisExtension?.currentCaseId;
      if (caseId) {
        CacheManager.get(caseId).then(cached => {
          console.log('Cached data for current case:', cached);
        });
      } else {
        console.log('No current case ID');
      }
      
      console.groupEnd();
    },

    /**
     * Measure performance of a function
     * @param {string} label - Label for the measurement
     * @param {Function} fn - Function to measure
     */
    measurePerformance(label, fn) {
      const start = performance.now();
      const result = fn();
      const end = performance.now();
      
      console.log(`[Perf] ${label} took ${(end - start).toFixed(2)}ms`);
      
      return result;
    },

    /**
     * Clear all extension storage (use with caution)
     */
    clearStorage() {
      if (confirm('Are you sure you want to clear all extension storage?')) {
        chrome.storage.sync.clear(() => {
          console.log('[Debug] Sync storage cleared');
        });
        chrome.storage.local.clear(() => {
          console.log('[Debug] Local storage cleared');
        });
      }
    },

    /**
     * Get all console logs from extension
     */
    getConsoleLogs() {
      // This would require intercepting console.log
      // For now, just show recent logs
      console.log('[Debug] Check browser console for extension logs');
      console.log('[Debug] Filter by: [ExLibris], [PersistentBanner], [CacheManager]');
    }
  };

  // Expose to window for console access
  if (typeof window !== 'undefined') {
    window.ExLibrisDebug = DebugHelper;
    console.log('[Debug Helper] Available at window.ExLibrisDebug');
    console.log('[Debug Helper] Try: ExLibrisDebug.inspectStorage()');
  }

  // Export for module use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugHelper;
  }
})();

