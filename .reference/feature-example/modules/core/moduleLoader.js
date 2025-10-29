/**
 * Module Loader
 * 
 * Provides dynamic module loading and management system for the extension.
 * Handles module registration, initialization, and lifecycle management.
 */

/**
 * Registry of loaded modules and their metadata.
 */
const moduleRegistry = new Map();

/**
 * Module loader configuration.
 */
const loaderConfig = {
    baseUrl: chrome.runtime.getURL('modules/'),
    retryAttempts: 3,
    retryDelay: 1000
};

/**
 * Module states for lifecycle management.
 */
export const MODULE_STATES = {
    UNLOADED: 'unloaded',
    LOADING: 'loading',
    LOADED: 'loaded',
    INITIALIZING: 'initializing',
    INITIALIZED: 'initialized',
    ERROR: 'error'
};

/**
 * Registers a module for loading.
 * @param {string} name Module name/identifier.
 * @param {object} config Module configuration.
 * @param {string} config.path Module file path relative to modules directory.
 * @param {Array<string>} [config.dependencies] Array of module names this module depends on.
 * @param {boolean} [config.autoLoad] Whether to auto-load this module.
 * @param {Function} [config.initFunction] Custom initialization function.
 */
export function registerModule(name, config) {
    if (moduleRegistry.has(name)) {
        console.warn(`[Module Loader] Module ${name} is already registered`);
        return;
    }

    const moduleInfo = {
        name,
        path: config.path,
        dependencies: config.dependencies || [],
        autoLoad: config.autoLoad || false,
        initFunction: config.initFunction || null,
        state: MODULE_STATES.UNLOADED,
        instance: null,
        error: null,
        loadTime: null
    };

    moduleRegistry.set(name, moduleInfo);
    console.log(`[Module Loader] Registered module: ${name}`);
}

/**
 * Loads a module dynamically.
 * @param {string} name Module name to load.
 * @returns {Promise<object>} Promise resolving to the loaded module.
 */
export async function loadModule(name) {
    const moduleInfo = moduleRegistry.get(name);
    
    if (!moduleInfo) {
        throw new Error(`Module ${name} is not registered`);
    }

    if (moduleInfo.state === MODULE_STATES.LOADED || moduleInfo.state === MODULE_STATES.INITIALIZED) {
        return moduleInfo.instance;
    }

    if (moduleInfo.state === MODULE_STATES.LOADING) {
        // Wait for ongoing load
        return new Promise((resolve, reject) => {
            const checkLoad = () => {
                if (moduleInfo.state === MODULE_STATES.LOADED || moduleInfo.state === MODULE_STATES.INITIALIZED) {
                    resolve(moduleInfo.instance);
                } else if (moduleInfo.state === MODULE_STATES.ERROR) {
                    reject(moduleInfo.error);
                } else {
                    setTimeout(checkLoad, 100);
                }
            };
            checkLoad();
        });
    }

    moduleInfo.state = MODULE_STATES.LOADING;

    try {
        // Load dependencies first
        if (moduleInfo.dependencies.length > 0) {
            console.log(`[Module Loader] Loading dependencies for ${name}: ${moduleInfo.dependencies.join(', ')}`);
            await Promise.all(moduleInfo.dependencies.map(dep => loadModule(dep)));
        }

        // Load the module
        const modulePath = `${loaderConfig.baseUrl}${moduleInfo.path}`;
        console.log(`[Module Loader] Loading module ${name} from ${modulePath}`);
        
        const moduleInstance = await import(modulePath);
        
        moduleInfo.instance = moduleInstance;
        moduleInfo.state = MODULE_STATES.LOADED;
        moduleInfo.loadTime = Date.now();
        
        console.log(`[Module Loader] Successfully loaded module: ${name}`);
        return moduleInstance;
        
    } catch (error) {
        moduleInfo.state = MODULE_STATES.ERROR;
        moduleInfo.error = error;
        console.error(`[Module Loader] Failed to load module ${name}:`, error);
        throw error;
    }
}

/**
 * Initializes a loaded module.
 * @param {string} name Module name to initialize.
 * @param {object} [context] Context object to pass to initialization.
 * @returns {Promise<void>} Promise resolving when initialization is complete.
 */
export async function initializeModule(name, context = {}) {
    const moduleInfo = moduleRegistry.get(name);
    
    if (!moduleInfo) {
        throw new Error(`Module ${name} is not registered`);
    }

    if (moduleInfo.state === MODULE_STATES.INITIALIZED) {
        console.log(`[Module Loader] Module ${name} is already initialized`);
        return;
    }

    if (moduleInfo.state !== MODULE_STATES.LOADED) {
        await loadModule(name);
    }

    moduleInfo.state = MODULE_STATES.INITIALIZING;

    try {
        if (moduleInfo.initFunction) {
            await moduleInfo.initFunction(moduleInfo.instance, context);
        } else if (moduleInfo.instance.init) {
            await moduleInfo.instance.init(context);
        }

        moduleInfo.state = MODULE_STATES.INITIALIZED;
        console.log(`[Module Loader] Successfully initialized module: ${name}`);
        
    } catch (error) {
        moduleInfo.state = MODULE_STATES.ERROR;
        moduleInfo.error = error;
        console.error(`[Module Loader] Failed to initialize module ${name}:`, error);
        throw error;
    }
}

/**
 * Loads and initializes a module in one call.
 * @param {string} name Module name.
 * @param {object} [context] Context object for initialization.
 * @returns {Promise<object>} Promise resolving to the initialized module.
 */
export async function loadAndInitialize(name, context = {}) {
    const moduleInstance = await loadModule(name);
    await initializeModule(name, context);
    return moduleInstance;
}

/**
 * Gets information about a registered module.
 * @param {string} name Module name.
 * @returns {object|null} Module information or null if not found.
 */
export function getModuleInfo(name) {
    const moduleInfo = moduleRegistry.get(name);
    return moduleInfo ? { ...moduleInfo } : null;
}

/**
 * Gets all registered modules.
 * @returns {Array<object>} Array of module information objects.
 */
export function getAllModules() {
    return Array.from(moduleRegistry.values()).map(info => ({ ...info }));
}

/**
 * Unloads a module and cleans up its resources.
 * @param {string} name Module name to unload.
 * @returns {Promise<void>} Promise resolving when unload is complete.
 */
export async function unloadModule(name) {
    const moduleInfo = moduleRegistry.get(name);
    
    if (!moduleInfo) {
        return;
    }

    try {
        if (moduleInfo.instance && moduleInfo.instance.cleanup) {
            await moduleInfo.instance.cleanup();
        }

        moduleInfo.state = MODULE_STATES.UNLOADED;
        moduleInfo.instance = null;
        moduleInfo.error = null;
        
        console.log(`[Module Loader] Unloaded module: ${name}`);
        
    } catch (error) {
        console.error(`[Module Loader] Error unloading module ${name}:`, error);
    }
}

/**
 * Auto-loads all modules marked for auto-loading.
 * @returns {Promise<void>} Promise resolving when all auto-load modules are loaded.
 */
export async function autoLoadModules() {
    const autoLoadModules = Array.from(moduleRegistry.values())
        .filter(module => module.autoLoad)
        .map(module => module.name);
    
    if (autoLoadModules.length > 0) {
        console.log(`[Module Loader] Auto-loading modules: ${autoLoadModules.join(', ')}`);
        await Promise.all(autoLoadModules.map(name => loadAndInitialize(name)));
    }
}