/**
 * Event Bus
 * 
 * Provides a centralized event system for inter-module communication.
 * Allows modules to communicate without direct dependencies.
 */

/**
 * Event listeners registry.
 */
const eventListeners = new Map();

/**
 * Event history for debugging (limited to last 100 events).
 */
const eventHistory = [];
const MAX_HISTORY_SIZE = 100;

/**
 * Event bus configuration.
 */
const busConfig = {
    enableHistory: true,
    enableDebugging: false,
    maxListeners: 50
};

/**
 * Event listener wrapper for tracking and cleanup.
 */
class EventListener {
    constructor(event, callback, options = {}) {
        this.event = event;
        this.callback = callback;
        this.once = options.once || false;
        this.priority = options.priority || 0;
        this.namespace = options.namespace || 'default';
        this.id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.created = Date.now();
    }
}

/**
 * Subscribes to an event.
 * @param {string} event Event name to listen for.
 * @param {Function} callback Function to call when event is emitted.
 * @param {object} [options] Listener options.
 * @param {boolean} [options.once] Whether to remove listener after first execution.
 * @param {number} [options.priority] Priority for execution order (higher = earlier).
 * @param {string} [options.namespace] Namespace for grouping listeners.
 * @returns {string} Listener ID for later removal.
 */
export function on(event, callback, options = {}) {
    if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
    }

    const listeners = eventListeners.get(event);
    
    if (listeners.length >= busConfig.maxListeners) {
        console.warn(`[Event Bus] Maximum listeners (${busConfig.maxListeners}) reached for event: ${event}`);
    }

    const listener = new EventListener(event, callback, options);
    listeners.push(listener);
    
    // Sort by priority (higher priority first)
    listeners.sort((a, b) => b.priority - a.priority);
    
    if (busConfig.enableDebugging) {
        console.log(`[Event Bus] Registered listener for '${event}' (ID: ${listener.id})`);
    }

    return listener.id;
}

/**
 * Subscribes to an event for one-time execution.
 * @param {string} event Event name to listen for.
 * @param {Function} callback Function to call when event is emitted.
 * @param {object} [options] Listener options.
 * @returns {string} Listener ID.
 */
export function once(event, callback, options = {}) {
    return on(event, callback, { ...options, once: true });
}

/**
 * Removes an event listener.
 * @param {string} listenerId Listener ID returned from on() or once().
 * @returns {boolean} True if listener was found and removed.
 */
export function off(listenerId) {
    for (const [event, listeners] of eventListeners.entries()) {
        const index = listeners.findIndex(listener => listener.id === listenerId);
        if (index !== -1) {
            listeners.splice(index, 1);
            
            if (busConfig.enableDebugging) {
                console.log(`[Event Bus] Removed listener ${listenerId} from '${event}'`);
            }
            
            return true;
        }
    }
    return false;
}

/**
 * Removes all listeners for an event or namespace.
 * @param {string} eventOrNamespace Event name or namespace to clear.
 * @param {boolean} [isNamespace=false] Whether the parameter is a namespace.
 */
export function removeAllListeners(eventOrNamespace, isNamespace = false) {
    if (isNamespace) {
        // Remove all listeners in the namespace
        for (const [event, listeners] of eventListeners.entries()) {
            const filtered = listeners.filter(listener => listener.namespace !== eventOrNamespace);
            eventListeners.set(event, filtered);
        }
        
        if (busConfig.enableDebugging) {
            console.log(`[Event Bus] Removed all listeners from namespace: ${eventOrNamespace}`);
        }
    } else {
        // Remove all listeners for the event
        eventListeners.delete(eventOrNamespace);
        
        if (busConfig.enableDebugging) {
            console.log(`[Event Bus] Removed all listeners for event: ${eventOrNamespace}`);
        }
    }
}

/**
 * Emits an event to all registered listeners.
 * @param {string} event Event name to emit.
 * @param {*} [data] Data to pass to listeners.
 * @param {object} [options] Emission options.
 * @param {boolean} [options.async=true] Whether to call listeners asynchronously.
 * @returns {Promise<Array>} Promise resolving to array of listener results.
 */
export async function emit(event, data = null, options = {}) {
    const { async = true } = options;
    const listeners = eventListeners.get(event) || [];
    
    // Record event in history
    if (busConfig.enableHistory) {
        const historyEntry = {
            event,
            data: JSON.parse(JSON.stringify(data)), // Deep clone for history
            timestamp: Date.now(),
            listenerCount: listeners.length
        };
        
        eventHistory.push(historyEntry);
        
        // Trim history if it gets too large
        if (eventHistory.length > MAX_HISTORY_SIZE) {
            eventHistory.shift();
        }
    }

    if (busConfig.enableDebugging) {
        console.log(`[Event Bus] Emitting '${event}' to ${listeners.length} listeners`, data);
    }

    const results = [];
    const listenersToRemove = [];

    for (const listener of listeners) {
        try {
            let result;
            
            if (async) {
                result = await Promise.resolve(listener.callback(data, event));
            } else {
                result = listener.callback(data, event);
            }
            
            results.push(result);
            
            // Mark for removal if it's a once listener
            if (listener.once) {
                listenersToRemove.push(listener.id);
            }
            
        } catch (error) {
            console.error(`[Event Bus] Error in listener for '${event}':`, error);
            results.push(error);
        }
    }

    // Remove once listeners
    listenersToRemove.forEach(id => off(id));

    return results;
}

/**
 * Waits for an event to be emitted.
 * @param {string} event Event name to wait for.
 * @param {number} [timeout=30000] Timeout in milliseconds.
 * @returns {Promise} Promise resolving with event data or rejecting on timeout.
 */
export function waitFor(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            off(listenerId);
            reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeout);

        const listenerId = once(event, (data) => {
            clearTimeout(timeoutId);
            resolve(data);
        });
    });
}

/**
 * Gets the current event listeners for debugging.
 * @param {string} [event] Specific event to get listeners for.
 * @returns {object} Listeners information.
 */
export function getListeners(event = null) {
    if (event) {
        const listeners = eventListeners.get(event) || [];
        return {
            event,
            count: listeners.length,
            listeners: listeners.map(l => ({
                id: l.id,
                namespace: l.namespace,
                priority: l.priority,
                once: l.once,
                created: l.created
            }))
        };
    }

    const summary = {};
    for (const [eventName, listeners] of eventListeners.entries()) {
        summary[eventName] = {
            count: listeners.length,
            listeners: listeners.map(l => ({
                id: l.id,
                namespace: l.namespace,
                priority: l.priority,
                once: l.once,
                created: l.created
            }))
        };
    }
    
    return summary;
}

/**
 * Gets the event history for debugging.
 * @param {number} [limit=10] Number of recent events to return.
 * @returns {Array} Array of recent events.
 */
export function getEventHistory(limit = 10) {
    return eventHistory.slice(-limit);
}

/**
 * Configures the event bus.
 * @param {object} config Configuration options.
 * @param {boolean} [config.enableHistory] Whether to track event history.
 * @param {boolean} [config.enableDebugging] Whether to enable debug logging.
 * @param {number} [config.maxListeners] Maximum listeners per event.
 */
export function configure(config) {
    Object.assign(busConfig, config);
    
    if (busConfig.enableDebugging) {
        console.log('[Event Bus] Configuration updated:', busConfig);
    }
}

/**
 * Clears all listeners and history.
 */
export function reset() {
    eventListeners.clear();
    eventHistory.length = 0;
    
    if (busConfig.enableDebugging) {
        console.log('[Event Bus] Reset complete');
    }
}