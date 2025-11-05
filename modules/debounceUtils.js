/**
 * Debounce Utility Module
 * Provides reusable debounce and throttle functions for event handlers
 */

const DebounceUtils = {
  /**
   * Creates a debounced function that delays invoking func until after wait milliseconds
   * have elapsed since the last time the debounced function was invoked
   * @param {Function} func - The function to debounce
   * @param {number} wait - The number of milliseconds to delay
   * @param {boolean} immediate - If true, trigger the function on the leading edge instead of trailing
   * @returns {Function} Returns the new debounced function
   */
  debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
      const context = this;
      
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      
      const callNow = immediate && !timeout;
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func.apply(context, args);
      
      // Return a cancel function to allow manual cancellation
      return {
        cancel: () => {
          clearTimeout(timeout);
          timeout = null;
        }
      };
    };
  },

  /**
   * Creates a throttled function that only invokes func at most once per every wait milliseconds
   * @param {Function} func - The function to throttle
   * @param {number} wait - The number of milliseconds to throttle invocations to
   * @returns {Function} Returns the new throttled function
   */
  throttle(func, wait) {
    let inThrottle;
    let lastFunc;
    let lastRan;
    
    return function(...args) {
      const context = this;
      
      if (!inThrottle) {
        func.apply(context, args);
        lastRan = Date.now();
        inThrottle = true;
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(() => {
          if ((Date.now() - lastRan) >= wait) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        }, Math.max(wait - (Date.now() - lastRan), 0));
      }
    };
  },

  /**
   * Creates a function that will only execute once, then cache its result
   * @param {Function} func - The function to execute once
   * @returns {Function} Returns the memoized function
   */
  once(func) {
    let called = false;
    let result;
    
    return function(...args) {
      if (!called) {
        called = true;
        result = func.apply(this, args);
      }
      return result;
    };
  },

  /**
   * Delays execution of a function until a specified condition is met
   * @param {Function} condition - Function that returns true when ready to execute
   * @param {Function} callback - Function to execute when condition is met
   * @param {number} checkInterval - How often to check the condition (ms)
   * @param {number} maxWait - Maximum time to wait before giving up (ms)
   * @returns {Promise} Resolves when callback executed, rejects on timeout
   */
  waitUntil(condition, callback, checkInterval = 100, maxWait = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checker = setInterval(() => {
        if (condition()) {
          clearInterval(checker);
          const result = callback();
          resolve(result);
        } else if (Date.now() - startTime > maxWait) {
          clearInterval(checker);
          reject(new Error('waitUntil timeout exceeded'));
        }
      }, checkInterval);
    });
  },

  /**
   * Rate limiter that ensures function is called at most once per time period
   * Unlike throttle, this guarantees the spacing between calls
   * @param {Function} func - The function to rate limit
   * @param {number} delay - Minimum time between calls (ms)
   * @returns {Function} Returns the rate-limited function
   */
  rateLimit(func, delay) {
    let lastCall = 0;
    let pending = null;
    
    return function(...args) {
      const context = this;
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;
      
      // Clear any pending call
      if (pending) {
        clearTimeout(pending);
        pending = null;
      }
      
      if (timeSinceLastCall >= delay) {
        // Enough time has passed, execute immediately
        lastCall = now;
        func.apply(context, args);
      } else {
        // Schedule for later
        const remainingTime = delay - timeSinceLastCall;
        pending = setTimeout(() => {
          lastCall = Date.now();
          func.apply(context, args);
          pending = null;
        }, remainingTime);
      }
    };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.DebounceUtils = DebounceUtils;
}
