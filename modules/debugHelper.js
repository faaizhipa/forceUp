/**
 * Debug Helper Module
 * 
 * Runtime diagnostics and troubleshooting utilities.
 * Accessible from browser console for debugging deployed extensions.
 * 
 * Usage (in console):
 *   DebugHelper.status()          - Full status report
 *   DebugHelper.modules()         - List loaded modules
 *   DebugHelper.caseData()        - Current case data
 *   DebugHelper.storage()         - View storage contents
 *   DebugHelper.clearCache()      - Clear all caches
 *   DebugHelper.export()          - Export debug info
 */

const DebugHelper = (function() {
  'use strict';

  const VERSION = '1.0.0';

  /**
   * Get list of loaded modules
   */
  function getLoadedModules() {
    const modules = [];
    const moduleNames = [
      'Logger', 'DebounceUtils', 'PageIdentifier', 'PageContextValidator',
      'CaseDomUtils', 'CaseContextWatcher', 'CaseDataStore', 'SettingsManager',
      'CustomerMasterManager', 'UserCustomerDataManager', 'CaseDataExtractor',
      'CasePageDataExtractor', 'CaseCommentExtractor', 'CaseDetailExtractor',
      'PersistentBanner', 'DynamicMenu', 'FlexipagePanelInjector',
      'FieldHighlighter', 'URLBuilder', 'TextFormatter', 'KeyboardShortcuts',
      'ContextMenuHandler', 'MultiTabSync', 'NavigationObserver',
      'ScrollController', 'EventSimulator', 'CharacterCounter',
      'ShadowTextExtractor', 'AccountAddressExtractor', 'AddressTimezoneResolver',
      'UnknownCustomerManager', 'ConfigurationWarningBanner', 'ImplementationStatus'
    ];

    for (const name of moduleNames) {
      if (typeof window[name] !== 'undefined') {
        modules.push({
          name,
          loaded: true,
          hasInit: typeof window[name].init === 'function',
          hasCleanup: typeof window[name].cleanup === 'function'
        });
      }
    }

    return modules;
  }

  /**
   * Get extension status
   */
  async function getStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      version: null,
      url: window.location.href,
      pageType: null,
      modules: {
        total: 0,
        loaded: 0,
        list: []
      },
      data: {
        caseData: null,
        customerStats: null,
        storage: {}
      },
      errors: []
    };

    // Get version from manifest
    try {
      const manifest = chrome.runtime.getManifest();
      status.version = manifest.version;
    } catch (e) {
      status.errors.push(`Manifest error: ${e.message}`);
    }

    // Get page type
    try {
      if (typeof PageIdentifier !== 'undefined') {
        status.pageType = PageIdentifier.getCurrentPageType?.() || 'unknown';
      }
    } catch (e) {
      status.errors.push(`PageIdentifier error: ${e.message}`);
    }

    // Get loaded modules
    const modules = getLoadedModules();
    status.modules.list = modules;
    status.modules.loaded = modules.length;
    status.modules.total = 35; // Approximate total

    // Get case data
    try {
      if (typeof CaseDataStore !== 'undefined') {
        status.data.caseData = CaseDataStore.getCurrentData?.() || null;
      }
    } catch (e) {
      status.errors.push(`CaseDataStore error: ${e.message}`);
    }

    // Get customer stats
    try {
      if (typeof CustomerMasterManager !== 'undefined') {
        status.data.customerStats = await CustomerMasterManager.getStats?.();
      }
    } catch (e) {
      status.errors.push(`CustomerMasterManager error: ${e.message}`);
    }

    // Get storage usage
    try {
      const usage = await new Promise((resolve) => {
        chrome.storage.local.getBytesInUse(null, resolve);
      });
      status.data.storage.localBytes = usage;
      status.data.storage.localMB = (usage / (1024 * 1024)).toFixed(2);
    } catch (e) {
      status.errors.push(`Storage error: ${e.message}`);
    }

    return status;
  }

  /**
   * Print formatted status report
   */
  async function printStatus() {
    const status = await getStatus();

    console.group('%c📊 Extension Status Report', 'font-size: 14px; font-weight: bold; color: #2196F3');
    
    console.log('%cVersion:', 'font-weight: bold', status.version);
    console.log('%cPage Type:', 'font-weight: bold', status.pageType);
    console.log('%cURL:', 'font-weight: bold', status.url);
    
    console.group('%cModules', 'font-weight: bold');
    console.log(`Loaded: ${status.modules.loaded}/${status.modules.total}`);
    console.table(status.modules.list);
    console.groupEnd();

    if (status.data.caseData) {
      console.group('%cCase Data', 'font-weight: bold');
      console.log('Case Number:', status.data.caseData.caseNumber);
      console.log('Account:', status.data.caseData.accountName);
      console.log('Timezone:', status.data.caseData.customerTimezone || status.data.caseData.timezone);
      console.log('Full Data:', status.data.caseData);
      console.groupEnd();
    }

    if (status.data.customerStats) {
      console.group('%cCustomer Data Stats', 'font-weight: bold');
      console.log('Records:', status.data.customerStats.recordCount);
      console.log('Overrides:', status.data.customerStats.overrides);
      console.log('Unknown:', status.data.customerStats.unknownCustomers);
      console.groupEnd();
    }

    console.group('%cStorage', 'font-weight: bold');
    console.log(`Local: ${status.data.storage.localMB} MB`);
    console.groupEnd();

    if (status.errors.length > 0) {
      console.group('%c⚠️ Errors', 'font-weight: bold; color: red');
      status.errors.forEach(err => console.error(err));
      console.groupEnd();
    }

    console.groupEnd();

    return status;
  }

  /**
   * Get current case data with validation
   */
  function getCaseData() {
    if (typeof CaseDataStore === 'undefined') {
      console.warn('CaseDataStore not loaded');
      return null;
    }

    const data = CaseDataStore.getCurrentData?.();
    
    if (!data) {
      console.warn('No case data available');
      return null;
    }

    // Validate data freshness
    const extractedAt = data.extractedAt ? new Date(data.extractedAt) : null;
    const age = extractedAt ? Date.now() - extractedAt.getTime() : null;
    const isStale = age && age > 30000; // 30 seconds

    console.group('%c📋 Case Data', 'font-size: 12px; font-weight: bold');
    console.log('Case Number:', data.caseNumber);
    console.log('Subject:', data.subject);
    console.log('Account:', data.accountName);
    console.log('Institution Code:', data.exLibrisAccountNumber || data.institutionCode);
    console.log('Timezone:', data.customerTimezone || data.timezone || 'Not resolved');
    console.log('Server:', data.server);
    console.log('Status:', data.status || data.pageStatus);
    
    if (extractedAt) {
      console.log('Extracted:', extractedAt.toLocaleTimeString());
      console.log('Age:', `${Math.round(age / 1000)}s`, isStale ? '⚠️ STALE' : '✓');
    }
    
    console.log('\nFull Data:', data);
    console.groupEnd();

    return data;
  }

  /**
   * View storage contents
   */
  async function viewStorage(type = 'local') {
    return new Promise((resolve) => {
      const storage = type === 'sync' ? chrome.storage.sync : chrome.storage.local;
      
      storage.get(null, (items) => {
        console.group(`%c💾 Chrome Storage (${type})`, 'font-size: 12px; font-weight: bold');
        
        const keys = Object.keys(items);
        console.log(`Keys: ${keys.length}`);
        
        for (const key of keys) {
          const value = items[key];
          const size = JSON.stringify(value).length;
          const sizeKB = (size / 1024).toFixed(2);
          console.log(`${key} (${sizeKB} KB):`, value);
        }
        
        console.groupEnd();
        resolve(items);
      });
    });
  }

  /**
   * Clear all caches
   */
  async function clearCache() {
    console.log('Clearing caches...');

    // Clear CaseDataStore
    if (typeof CaseDataStore !== 'undefined') {
      CaseDataStore.clear?.();
      console.log('✓ CaseDataStore cleared');
    }

    // Clear local storage caches
    const keysToRemove = [];
    await new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        for (const key of Object.keys(items)) {
          if (key.includes('cache') || key.includes('Cache')) {
            keysToRemove.push(key);
          }
        }
        resolve();
      });
    });

    if (keysToRemove.length > 0) {
      await new Promise((resolve) => {
        chrome.storage.local.remove(keysToRemove, resolve);
      });
      console.log(`✓ Removed ${keysToRemove.length} cache keys`);
    }

    console.log('Cache cleared. Reload page to refresh data.');
  }

  /**
   * Export debug info as JSON
   */
  async function exportDebugInfo() {
    const status = await getStatus();
    
    // Add more context
    const debugInfo = {
      ...status,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenSize: `${screen.width}x${screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      localStorage: {},
      sessionStorage: {}
    };

    // Include relevant localStorage
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('exlibris') || key.startsWith('EXL')) {
        debugInfo.localStorage[key] = localStorage.getItem(key);
      }
    }

    // Create downloadable file
    const blob = new Blob([JSON.stringify(debugInfo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exlibris-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('Debug info exported to file');
    return debugInfo;
  }

  /**
   * Test timezone resolution
   */
  async function testTimezone(accountName, institutionCode = null) {
    if (typeof CustomerMasterManager === 'undefined') {
      console.error('CustomerMasterManager not loaded');
      return null;
    }

    console.group('%c🌍 Timezone Resolution Test', 'font-weight: bold');
    console.log('Input:', { accountName, institutionCode });

    const result = await CustomerMasterManager.resolveTimezone({
      accountName,
      institutionCode
    });

    if (result) {
      console.log('✓ Resolved:', result.timezone);
      console.log('Source:', result.source);
      console.log('Match Type:', result.matchType);
      console.log('Full Result:', result);
    } else {
      console.warn('✗ No timezone found');
    }

    console.groupEnd();
    return result;
  }

  /**
   * Force re-extraction of case data
   */
  async function forceExtract() {
    console.log('Forcing case data extraction...');

    if (typeof CasePageDataExtractor !== 'undefined') {
      const data = await CasePageDataExtractor.extractAllCaseData?.();
      console.log('Extracted data:', data);
      return data;
    }

    if (typeof CaseDataExtractor !== 'undefined') {
      const data = await CaseDataExtractor.getData?.({ force: true });
      console.log('Extracted data:', data);
      return data;
    }

    console.warn('No extractor available');
    return null;
  }

  // Public API
  return {
    version: VERSION,

    // Status and diagnostics
    status: printStatus,
    getStatus,
    modules: () => {
      const modules = getLoadedModules();
      console.table(modules);
      return modules;
    },

    // Data inspection
    caseData: getCaseData,
    storage: viewStorage,
    
    // Actions
    clearCache,
    export: exportDebugInfo,
    forceExtract,
    testTimezone,

    // Quick shortcuts
    help: () => {
      console.log(`
%c🔧 DebugHelper Commands

%cStatus & Info:%c
  DebugHelper.status()         - Full status report
  DebugHelper.modules()        - List loaded modules
  DebugHelper.caseData()       - Current case data

%cStorage:%c
  DebugHelper.storage()        - View local storage
  DebugHelper.storage('sync')  - View sync storage
  DebugHelper.clearCache()     - Clear all caches

%cTesting:%c
  DebugHelper.testTimezone('University Name')
  DebugHelper.forceExtract()   - Re-extract case data

%cExport:%c
  DebugHelper.export()         - Download debug info
`,
        'font-size: 14px; font-weight: bold',
        'color: #4CAF50; font-weight: bold', '',
        'color: #2196F3; font-weight: bold', '',
        'color: #FF9800; font-weight: bold', '',
        'color: #9C27B0; font-weight: bold', ''
      );
    }
  };
})();

// Auto-print help hint on load
if (typeof console !== 'undefined') {
  console.log('%c🔧 DebugHelper loaded - Type DebugHelper.help() for commands', 
    'color: #888; font-style: italic');
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DebugHelper;
}

