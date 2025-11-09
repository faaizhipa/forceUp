/**
 * Module Registry
 * 
 * Central registry for all extension modules and their configurations.
 * This file defines the module dependency graph and initialization order.
 */

import { registerModule } from './core/moduleLoader.js';

/**
 * Module configurations with dependencies and initialization order.
 */
export const MODULE_CONFIGS = {
    // Core infrastructure modules (no dependencies)
    'eventBus': {
        path: 'core/eventBus.js',
        dependencies: [],
        autoLoad: true,
        priority: 1
    },
    
    'storageManager': {
        path: 'core/storageManager.js',
        dependencies: [],
        autoLoad: true,
        priority: 1
    },

    // Utility modules (depend on core)
    'domUtils': {
        path: 'utils/domUtils.js',
        dependencies: [],
        autoLoad: true,
        priority: 2
    },
    
    'dateUtils': {
        path: 'utils/dateUtils.js',
        dependencies: [],
        autoLoad: true,
        priority: 2
    },

    // UI modules (depend on utilities)
    'styleUtils': {
        path: 'ui/styleUtils.js',
        dependencies: [],
        autoLoad: true,
        priority: 3
    },
    
    'buttonFactory': {
        path: 'ui/buttonFactory.js',
        dependencies: ['storageManager'],
        autoLoad: false,
        priority: 3
    },

    // Feature modules (depend on utilities and UI)
    'fieldHighlighter': {
        path: 'features/fieldHighlighter.js',
        dependencies: [],
        autoLoad: false,
        priority: 4
    },
    
    'caseListProcessor': {
        path: 'features/caseListProcessor.js',
        dependencies: ['domUtils', 'dateUtils', 'styleUtils'],
        autoLoad: false,
        priority: 4
    },
    
    'wikiScraper': {
        path: 'features/wikiScraper.js',
        dependencies: ['storageManager'],
        autoLoad: false,
        priority: 4
    },

    'commentEnhancements': {
        path: 'features/commentEnhancements.js',
        dependencies: ['storageManager', 'eventBus'],
        autoLoad: false,
        priority: 4
    },

    'sqlGenerator': {
        path: 'features/sqlGenerator.js',
        dependencies: ['eventBus'],
        autoLoad: false,
        priority: 4
    },

    // Data modules
    'customerData': {
        path: 'data/customerData.js',
        dependencies: [],
        autoLoad: false,
        priority: 2
    }
};

/**
 * Registers all modules with the module loader.
 */
export function registerAllModules() {
    console.log('[Module Registry] Registering all modules...');
    
    // Sort modules by priority for proper initialization order
    const sortedModules = Object.entries(MODULE_CONFIGS)
        .sort(([, a], [, b]) => a.priority - b.priority);
    
    for (const [name, config] of sortedModules) {
        registerModule(name, config);
    }
    
    console.log(`[Module Registry] Registered ${Object.keys(MODULE_CONFIGS).length} modules`);
}

/**
 * Gets modules that should be loaded for a specific page type.
 * @param {string} pageType Page type (e.g., 'Cases_List_Page', 'Individual_Case_Page').
 * @returns {Array<string>} Array of module names to load.
 */
export function getModulesForPageType(pageType) {
    const pageModuleMap = {
        'Cases_List_Page': [
            'eventBus',
            'storageManager', 
            'domUtils',
            'styleUtils',
            'caseListProcessor'
        ],
        
        'Individual_Case_Page': [
            'eventBus',
            'storageManager',
            'domUtils', 
            'customerData',
            'buttonFactory',
            'fieldHighlighter',
            'commentEnhancements',
            'sqlGenerator'
        ],
        
        'Wiki_Page': [
            'eventBus',
            'storageManager',
            'wikiScraper'
        ],
        
        'Unknown_Page': [
            'eventBus',
            'storageManager'
        ]
    };
    
    return pageModuleMap[pageType] || pageModuleMap['Unknown_Page'];
}

/**
 * Module initialization functions for different page types.
 */
export const PAGE_INITIALIZERS = {
    'Cases_List_Page': async (moduleInstances) => {
        const { caseListProcessor, domUtils, eventBus } = moduleInstances;
        
        // Set up case list processing
        const table = await caseListProcessor.findCaseListTable();
        if (table) {
            await caseListProcessor.processCaseListTable(table);
            eventBus.emit('caseListProcessed', { table });
        }
        
        // Set up observers for dynamic content
        const observer = new MutationObserver(() => {
            const newTable = caseListProcessor.findCaseListTable();
            if (newTable && !newTable.dataset.caseListEnhanced) {
                caseListProcessor.processCaseListTable(newTable);
                eventBus.emit('caseListProcessed', { table: newTable });
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        return { observer };
    },
    
    'Individual_Case_Page': async (moduleInstances) => {
        const { fieldHighlighter, buttonFactory, storageManager, eventBus, commentEnhancements, sqlGenerator } = moduleInstances;
        
        // Extract case data
        const caseData = await extractCaseData();
        
        // Apply field highlighting
        if (caseData && fieldHighlighter) {
            fieldHighlighter.highlightFields();
            eventBus.emit('fieldsHighlighted', { caseData });
        }
        
        // Inject dynamic menu
        if (caseData && buttonFactory) {
            await injectDynamicMenu(caseData, buttonFactory, storageManager);
            eventBus.emit('menuInjected', { caseData });
        }

        // Initialize comment enhancements
        if (commentEnhancements) {
            await commentEnhancements.initialize(storageManager, eventBus);
            eventBus.emit('commentEnhancementsReady');
        }

        // Initialize SQL generator
        if (sqlGenerator) {
            await sqlGenerator.initialize(eventBus, caseData);
            eventBus.emit('sqlGeneratorReady');
        }
        
        return { caseData };
    },
    
    'Wiki_Page': async (moduleInstances) => {
        const { wikiScraper, eventBus } = moduleInstances;
        
        // Wiki scraping is typically user-initiated, just set up the capability
        eventBus.emit('wikiScraperReady');
        
        return {};
    }
};

/**
 * Helper function to extract case data (placeholder - would use domUtils).
 */
async function extractCaseData() {
    // This would be implemented using domUtils
    // For now, return a placeholder
    return {
        caseId: 'placeholder',
        server: 'placeholder',
        institutionCode: 'placeholder'
    };
}

/**
 * Helper function to inject dynamic menu (placeholder).
 */
async function injectDynamicMenu(caseData, buttonFactory, storageManager) {
    // This would be implemented using the button factory
    // For now, just log the action
    console.log('[Module Registry] Would inject dynamic menu for case:', caseData.caseId);
}