/**
 * Modern Content Script
 * 
 * Entry point for the modular Salesforce Power-Up Extension.
 * Initializes the module system and coordinates feature activation based on page type.
 */

import { registerAllModules, getModulesForPageType, PAGE_INITIALIZERS } from './modules/moduleRegistry.js';
import { loadAndInitialize, autoLoadModules } from './modules/core/moduleLoader.js';
import { on as eventBusOn, emit as eventBusEmit } from './modules/core/eventBus.js';

/**
 * Extension state management.
 */
let extensionState = {
    initialized: false,
    currentPageType: null,
    loadedModules: new Map(),
    activeFeatures: new Set(),
    lastUrl: null
};

/**
 * Debug logging flag.
 */
const DEBUG = true;

/**
 * Log debug messages with consistent formatting.
 */
function debugLog(message, ...args) {
    if (DEBUG) {
        console.log(`[Extension] ${message}`, ...args);
    }
}

/**
 * Main initialization function.
 */
async function initializeExtension() {
    if (extensionState.initialized) {
        debugLog('Extension already initialized');
        return;
    }

    try {
        debugLog('Starting extension initialization...');
        
        // Register all modules
        registerAllModules();
        
        // Auto-load core modules
        await autoLoadModules();
        
        // Set up page change detection
        setupPageChangeDetection();
        
        // Process initial page
        await handlePageChange();
        
        extensionState.initialized = true;
        debugLog('Extension initialization complete');
        
    } catch (error) {
        console.error('[Extension] Initialization failed:', error);
    }
}

/**
 * Sets up page change detection for SPA navigation.
 */
function setupPageChangeDetection() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'pageTypeIdentified') {
            debugLog('Page type identified:', message.pageType);
            handlePageChange(message.pageType);
        }
    });
    
    // Also detect URL changes directly (for robustness)
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            debugLog('URL changed, checking page type...');
            setTimeout(handlePageChange, 1000); // Delay to allow page to settle
        }
    });
    
    urlObserver.observe(document, { subtree: true, childList: true });
}

/**
 * Handles page changes and activates appropriate features.
 */
async function handlePageChange(pageType = null) {
    try {
        // Determine page type if not provided
        if (!pageType) {
            pageType = await determinePageType();
        }
        
        // Skip if page type hasn't changed
        if (pageType === extensionState.currentPageType) {
            debugLog('Page type unchanged:', pageType);
            return;
        }
        
        debugLog('Processing page change:', extensionState.currentPageType, '→', pageType);
        
        // Clean up previous page
        await cleanupPreviousPage();
        
        // Load modules for new page type
        const modulesToLoad = getModulesForPageType(pageType);
        debugLog('Loading modules for page type:', modulesToLoad);
        
        const moduleInstances = await loadRequiredModules(modulesToLoad);
        
        // Initialize page-specific features
        if (PAGE_INITIALIZERS[pageType]) {
            debugLog('Initializing page-specific features...');
            const initResult = await PAGE_INITIALIZERS[pageType](moduleInstances);
            extensionState.activeFeatures.add(pageType);
            debugLog('Page initialization complete:', initResult);
        }
        
        // Update state
        extensionState.currentPageType = pageType;
        extensionState.lastUrl = window.location.href;
        
        // Emit page change event
        await eventBusEmit('pageChanged', {
            pageType,
            url: window.location.href,
            moduleInstances
        });
        
    } catch (error) {
        console.error('[Extension] Error handling page change:', error);
    }
}

/**
 * Determines the current page type based on URL and DOM content.
 */
async function determinePageType() {
    const url = window.location.href;
    
    // Check for wiki pages
    if (url.includes('wiki.clarivate.io')) {
        return 'Wiki_Page';
    }
    
    // Check for Salesforce case-related pages
    if (url.includes('lightning.force.com') || url.includes('salesforce.com')) {
        // Case list page detection
        if (url.includes('/list') || document.querySelector('table.slds-table')) {
            return 'Cases_List_Page';
        }
        
        // Individual case page detection
        if (url.match(/\/[a-zA-Z0-9]{15,18}\/view/) || 
            document.querySelector('records-record-layout-item')) {
            return 'Individual_Case_Page';
        }
    }
    
    return 'Unknown_Page';
}

/**
 * Loads required modules for the current page.
 */
async function loadRequiredModules(moduleNames) {
    const moduleInstances = {};
    
    for (const moduleName of moduleNames) {
        try {
            if (!extensionState.loadedModules.has(moduleName)) {
                debugLog(`Loading module: ${moduleName}`);
                const moduleInstance = await loadAndInitialize(moduleName);
                extensionState.loadedModules.set(moduleName, moduleInstance);
            }
            
            moduleInstances[moduleName] = extensionState.loadedModules.get(moduleName);
            
        } catch (error) {
            console.error(`[Extension] Failed to load module ${moduleName}:`, error);
        }
    }
    
    return moduleInstances;
}

/**
 * Cleans up resources from the previous page.
 */
async function cleanupPreviousPage() {
    // Emit cleanup event
    if (extensionState.currentPageType) {
        await eventBusEmit('pageCleanup', {
            pageType: extensionState.currentPageType
        });
    }
    
    // Clear active features
    extensionState.activeFeatures.clear();
    
    // Note: We don't unload modules as they might be reused
    debugLog('Previous page cleanup complete');
}

/**
 * Error handler for unhandled promise rejections.
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('[Extension] Unhandled promise rejection:', event.reason);
});

/**
 * Error handler for uncaught exceptions.
 */
window.addEventListener('error', (event) => {
    console.error('[Extension] Uncaught error:', event.error);
});

/**
 * Extension cleanup on page unload.
 */
window.addEventListener('beforeunload', async () => {
    debugLog('Page unloading, cleaning up...');
    await cleanupPreviousPage();
});

// Initialize the extension when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    // DOM is already ready
    initializeExtension();
}