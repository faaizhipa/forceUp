/**
 * Centralized Logger for EXL Extension
 * Provides consistent namespaced logging with levels
 */

const Logger = {
    prefix: '[EXL]',
    debugMode: false,

    /**
     * Initialize logger with settings
     * @param {Object} settings - Configuration object
     */
    init(settings = {}) {
        this.debugMode = settings.debugMode || false;
    },

    /**
     * Log informational message
     * @param {string} msg - Message to log
     * @param {...any} args - Additional arguments
     */
    info(msg, ...args) {
        console.log(`${this.prefix} ℹ️`, msg, ...args);
    },

    /**
     * Log warning message
     * @param {string} msg - Message to log
     * @param {...any} args - Additional arguments
     */
    warn(msg, ...args) {
        console.warn(`${this.prefix} ⚠️`, msg, ...args);
    },

    /**
     * Log error message
     * @param {string} msg - Message to log
     * @param {...any} args - Additional arguments
     */
    error(msg, ...args) {
        console.error(`${this.prefix} ❌`, msg, ...args);
    },

    /**
     * Log debug message (only if debug mode enabled)
     * @param {string} msg - Message to log
     * @param {...any} args - Additional arguments
     */
    debug(msg, ...args) {
        if (this.debugMode) {
            console.debug(`${this.prefix} 🐛`, msg, ...args);
        }
    },

    /**
     * Measure performance of a function
     * @param {string} label - Performance label
     * @param {Function} fn - Function to measure
     * @returns {*} Function result
     */
    perf(label, fn) {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        this.info(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
        return result;
    },

    /**
     * Measure performance of an async function
     * @param {string} label - Performance label
     * @param {Function} fn - Async function to measure
     * @returns {Promise<*>} Function result
     */
    async perfAsync(label, fn) {
        const start = performance.now();
        const result = await fn();
        const duration = performance.now() - start;
        this.info(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
        return result;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}
