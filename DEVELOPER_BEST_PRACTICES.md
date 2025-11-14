# Developer Best Practices & Guidelines
**Penang CoE CForce Extension Development**

**Version:** 1.0
**Last Updated:** November 10, 2025
**Audience:** Developers and AI Agents

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [DO's and DON'Ts](#2-dos-and-donts)
3. [Module Development](#3-module-development)
4. [Memory Management](#4-memory-management)
5. [Error Handling](#5-error-handling)
6. [Security Guidelines](#6-security-guidelines)
7. [Performance Optimization](#7-performance-optimization)
8. [Salesforce Lightning Specific](#8-salesforce-lightning-specific)
9. [Testing Requirements](#9-testing-requirements)
10. [Debugging Strategies](#10-debugging-strategies)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Code Review Checklist](#12-code-review-checklist)

---

## 1. Core Principles

### 1.1 Defensive Programming

**Always assume:**
- DOM elements may not exist when your code runs
- Dependencies may not be loaded
- User may navigate away mid-operation
- Salesforce may change their DOM structure
- Network requests may fail
- Storage operations may fail

### 1.2 Graceful Degradation

**If a dependency is missing:**
```javascript
// ❌ BAD
const data = DependentModule.getData();

// ✅ GOOD
let data = null;
if (typeof DependentModule !== 'undefined') {
    data = DependentModule.getData();
} else {
    console.warn('[MyModule] DependentModule not available, using fallback');
    data = getDefaultData();
}
```

### 1.3 Fail Safely

**Never let errors break the entire extension:**
```javascript
// ❌ BAD
async function processData() {
    const data = await fetchData(); // Uncaught promise rejection
    return transform(data);
}

// ✅ GOOD
async function processData() {
    try {
        const data = await fetchData();
        return transform(data);
    } catch (error) {
        console.error('[MyModule] processData failed:', error);
        notifyUser('Unable to process data. Please try again.');
        return null; // Safe default
    }
}
```

### 1.4 Clean Up After Yourself

**All modules MUST have cleanup methods:**
```javascript
const MyModule = (function() {
    let observer = null;
    let timer = null;
    let handlers = [];

    return {
        init: function() {
            // Setup
        },

        // ⚠️ MANDATORY
        cleanup: function() {
            if (observer) {
                observer.disconnect();
                observer = null;
            }

            if (timer) {
                clearInterval(timer);
                timer = null;
            }

            handlers.forEach(({element, event, handler}) => {
                element.removeEventListener(event, handler);
            });
            handlers = [];
        }
    };
})();
```

---

## 2. DO's and DON'Ts

### 2.1 ✅ DO

1. **Always check for element existence**
   ```javascript
   const element = document.querySelector('.my-selector');
   if (!element) {
       console.warn('[MyModule] Element not found');
       return;
   }
   ```

2. **Use the Check-Then-Observe pattern**
   ```javascript
   // Try immediate query first
   let target = document.querySelector('.target');
   if (target) {
       process(target);
       return;
   }

   // If not found, set up observer
   const observer = new MutationObserver(() => {
       target = document.querySelector('.target');
       if (target) {
           observer.disconnect(); // ⚠️ CRITICAL
           process(target);
       }
   });
   observer.observe(document.body, { childList: true, subtree: true });
   ```

3. **Prefix all console logs**
   ```javascript
   console.log('[MyModule] Action completed');
   console.warn('[MyModule] Potential issue');
   console.error('[MyModule] Critical error:', error);
   ```

4. **Validate data before processing**
   ```javascript
   function processData(data) {
       if (!data || typeof data !== 'object') {
           console.error('[MyModule] Invalid data:', data);
           return null;
       }

       if (!data.requiredField) {
           console.warn('[MyModule] Missing required field');
           return null;
       }

       // Process valid data
   }
   ```

5. **Use async/await with try-catch**
   ```javascript
   async function fetchData() {
       try {
           const response = await fetch(url);
           if (!response.ok) {
               throw new Error(`HTTP ${response.status}`);
           }
           return await response.json();
       } catch (error) {
           console.error('[MyModule] Fetch failed:', error);
           throw error; // or return safe default
       }
   }
   ```

6. **Document complex logic**
   ```javascript
   /**
    * Converts Salesforce date format to ISO 8601
    * Handles both MM/DD/YYYY and DD/MM/YYYY formats
    *
    * @param {string} dateStr - Date string from Salesforce
    * @returns {string} ISO 8601 formatted date
    */
   function convertDateFormat(dateStr) {
       // Implementation with comments
   }
   ```

7. **Use data attributes for state**
   ```javascript
   // Mark initialized elements
   element.dataset.myModuleInitialized = 'true';

   // Check before re-initializing
   if (element.dataset.myModuleInitialized) {
       return; // Already initialized
   }
   ```

8. **Cache DOM queries**
   ```javascript
   // ❌ BAD
   function updateStatus() {
       document.querySelector('.status').textContent = 'Updated';
       document.querySelector('.status').classList.add('active');
   }

   // ✅ GOOD
   function updateStatus() {
       const statusElement = document.querySelector('.status');
       if (!statusElement) return;

       statusElement.textContent = 'Updated';
       statusElement.classList.add('active');
   }
   ```

9. **Disconnect observers immediately after first match**
   ```javascript
   const observer = new MutationObserver(() => {
       const target = document.querySelector('.target');
       if (target) {
           observer.disconnect(); // ⚠️ Don't continue observing
           process(target);
       }
   });
   ```

10. **Use visibility checks for Salesforce elements**
    ```javascript
    function isElementVisible(element) {
        if (!element) return false;

        // Check parent chain
        let el = element;
        while (el && el !== document.body) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            el = el.parentElement;
        }

        // Check dimensions
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    // Use when querying multiple matches
    const containers = document.querySelectorAll('.container');
    const visibleContainer = Array.from(containers).find(isElementVisible);
    ```

### 2.2 ❌ DON'T

1. **Never use eval() or Function() constructor**
   ```javascript
   // ❌ NEVER DO THIS
   eval(userInput);
   new Function(userInput)();

   // ✅ Use safe alternatives
   JSON.parse(userInput); // For JSON
   ```

2. **Never use innerHTML with unsanitized data**
   ```javascript
   // ❌ BAD
   element.innerHTML = `<div>${userData}</div>`;

   // ✅ GOOD
   element.textContent = userData;
   // OR
   const div = document.createElement('div');
   div.textContent = userData;
   element.appendChild(div);
   ```

3. **Never modify global objects**
   ```javascript
   // ❌ BAD
   Array.prototype.myMethod = function() { /*...*/ };
   window.myGlobalVar = 'value';

   // ✅ GOOD - Use module pattern
   const MyModule = (function() {
       const myPrivateVar = 'value';
       return { /* public API */ };
   })();
   ```

4. **Never create observers without disconnect logic**
   ```javascript
   // ❌ BAD
   new MutationObserver(() => {
       // ... do stuff
   }).observe(document.body, { childList: true, subtree: true });

   // ✅ GOOD
   let observer = new MutationObserver(() => {
       // ... do stuff
   });
   observer.observe(document.body, { childList: true, subtree: true });

   // Later, in cleanup:
   observer.disconnect();
   observer = null;
   ```

5. **Never assume element exists**
   ```javascript
   // ❌ BAD
   document.querySelector('.element').textContent = 'value';

   // ✅ GOOD
   const element = document.querySelector('.element');
   if (element) {
       element.textContent = 'value';
   }
   ```

6. **Never use synchronous storage in critical path**
   ```javascript
   // ❌ BAD
   const data = JSON.parse(localStorage.getItem('data'));
   processData(data); // Blocks UI

   // ✅ GOOD
   chrome.storage.local.get(['data'], (result) => {
       if (result.data) {
           processData(result.data);
       }
   });
   ```

7. **Never ignore promise rejections**
   ```javascript
   // ❌ BAD
   fetchData(); // Uncaught promise rejection

   // ✅ GOOD
   fetchData().catch(error => {
       console.error('[MyModule] Fetch failed:', error);
   });

   // ✅ BETTER
   try {
       await fetchData();
   } catch (error) {
       console.error('[MyModule] Fetch failed:', error);
   }
   ```

8. **Never pollute the global scope**
   ```javascript
   // ❌ BAD
   function helperFunction() { /*...*/ }
   var globalVar = 'value';

   // ✅ GOOD
   (function() {
       'use strict';
       function helperFunction() { /*...*/ }
       const localVar = 'value';
   })();
   ```

9. **Never use deprecated APIs**
   ```javascript
   // ❌ BAD
   document.execCommand('copy'); // Deprecated

   // ✅ GOOD
   navigator.clipboard.writeText(text).catch(error => {
       console.error('[MyModule] Copy failed:', error);
   });
   ```

10. **Never trust user input**
    ```javascript
    // ❌ BAD
    const query = `SELECT * FROM users WHERE id = ${userInput}`;

    // ✅ GOOD
    const sanitizedInput = escapeSQL(userInput);
    // Or better: use parameterized queries
    ```

---

## 3. Module Development

### 3.1 Module Template

```javascript
/**
 * ModuleName
 *
 * Purpose: [Brief description]
 *
 * Dependencies:
 * - DependencyOne (required)
 * - DependencyTwo (optional)
 *
 * Events Emitted:
 * - mymodule:ready
 * - mymodule:error
 *
 * Events Listened:
 * - somemodule:update
 */

const ModuleName = (function() {
    'use strict';

    // ========== PRIVATE STATE ==========

    let isInitialized = false;
    let settings = {};
    let observers = [];
    let timers = [];
    let eventHandlers = [];

    // ========== CONFIGURATION ==========

    const CONFIG = {
        DEFAULT_TIMEOUT: 5000,
        MAX_RETRIES: 3,
        DEBOUNCE_DELAY: 300
    };

    // ========== PRIVATE FUNCTIONS ==========

    /**
     * Internal helper function
     * @private
     */
    function privateHelper() {
        // Implementation
    }

    /**
     * Check if dependencies are available
     * @returns {boolean}
     * @private
     */
    function checkDependencies() {
        const required = ['DependencyOne'];
        const optional = ['DependencyTwo'];

        // Check required
        for (const dep of required) {
            if (typeof window[dep] === 'undefined') {
                console.error(`[ModuleName] Required dependency missing: ${dep}`);
                return false;
            }
        }

        // Warn about optional
        for (const dep of optional) {
            if (typeof window[dep] === 'undefined') {
                console.warn(`[ModuleName] Optional dependency missing: ${dep}`);
            }
        }

        return true;
    }

    /**
     * Setup event listeners
     * @private
     */
    function setupEventListeners() {
        const handler = (event) => {
            // Handle event
        };

        document.addEventListener('somemodule:update', handler);

        // Track for cleanup
        eventHandlers.push({
            element: document,
            event: 'somemodule:update',
            handler: handler
        });
    }

    /**
     * Setup observers
     * @private
     */
    function setupObservers() {
        const observer = new MutationObserver((mutations) => {
            // Handle mutations
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Track for cleanup
        observers.push(observer);
    }

    // ========== PUBLIC API ==========

    return {
        /**
         * Initialize the module
         * @param {Object} options - Configuration options
         * @returns {boolean} Success status
         */
        init: function(options = {}) {
            if (isInitialized) {
                console.warn('[ModuleName] Already initialized');
                return false;
            }

            console.log('[ModuleName] Initializing...');

            // Check dependencies
            if (!checkDependencies()) {
                console.error('[ModuleName] Failed to initialize: missing dependencies');
                return false;
            }

            // Merge settings
            settings = { ...CONFIG, ...options };

            // Setup
            try {
                setupEventListeners();
                setupObservers();

                isInitialized = true;
                console.log('[ModuleName] Initialized successfully');

                // Emit ready event
                document.dispatchEvent(new CustomEvent('mymodule:ready'));

                return true;
            } catch (error) {
                console.error('[ModuleName] Initialization failed:', error);
                this.cleanup(); // Cleanup partial initialization
                return false;
            }
        },

        /**
         * Main public function
         * @param {string} param - Parameter description
         * @returns {Object} Result object
         */
        doSomething: function(param) {
            if (!isInitialized) {
                console.warn('[ModuleName] Not initialized');
                return null;
            }

            try {
                // Implementation
                return { success: true };
            } catch (error) {
                console.error('[ModuleName] doSomething failed:', error);
                return { success: false, error: error.message };
            }
        },

        /**
         * Cleanup all resources
         */
        cleanup: function() {
            if (!isInitialized) return;

            console.log('[ModuleName] Cleaning up...');

            // Disconnect observers
            observers.forEach(observer => {
                if (observer) {
                    observer.disconnect();
                }
            });
            observers = [];

            // Clear timers
            timers.forEach(timer => {
                clearTimeout(timer);
                clearInterval(timer);
            });
            timers = [];

            // Remove event listeners
            eventHandlers.forEach(({element, event, handler}) => {
                element.removeEventListener(event, handler);
            });
            eventHandlers = [];

            // Reset state
            settings = {};
            isInitialized = false;

            console.log('[ModuleName] Cleaned up successfully');
        },

        /**
         * Check if module is initialized
         * @returns {boolean}
         */
        isInitialized: function() {
            return isInitialized;
        },

        /**
         * Get current settings
         * @returns {Object}
         */
        getSettings: function() {
            return { ...settings }; // Return copy
        },

        /**
         * Update settings
         * @param {Object} newSettings - Settings to update
         */
        updateSettings: function(newSettings) {
            if (!isInitialized) {
                console.warn('[ModuleName] Cannot update settings: not initialized');
                return;
            }

            settings = { ...settings, ...newSettings };
            console.log('[ModuleName] Settings updated');
        }
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.ModuleName = ModuleName;
}
```

### 3.2 Initialization Order

**Add new modules to manifest.json in dependency order:**

```json
{
  "content_scripts": [{
    "js": [
      // 1. Core utilities (no dependencies)
      "modules/logger.js",
      "modules/storageWrapper.js",
      "modules/debounceUtils.js",
      "modules/domUtilities.js",

      // 2. Identifiers and detectors
      "modules/caseIdentifiers.js",
      "modules/pageIdentifier.js",

      // 3. Data management
      "modules/cacheManager.js",
      "modules/customerDataManager.js",

      // 4. Extractors
      "modules/caseDataExtractor.js",

      // 5. UI components
      "modules/fieldHighlighter.js",
      "modules/dynamicMenu.js",

      // 6. NEW MODULE HERE
      "modules/myNewModule.js",

      // 7. Controller (must be last)
      "content_script_exlibris.js"
    ],
    "matches": ["https://proquestllc.lightning.force.com/*"]
  }]
}
```

### 3.3 Module Integration

**Register in content_script_exlibris.js:**

```javascript
// In init() method
if (typeof MyNewModule !== 'undefined') {
    MyNewModule.init(this.settings.myNewModuleOptions);
    console.log('[ExLibris Extension] MyNewModule initialized');
} else {
    console.warn('[ExLibris Extension] MyNewModule not loaded');
}

// In cleanup() method
if (typeof MyNewModule !== 'undefined' && MyNewModule.cleanup) {
    MyNewModule.cleanup();
}
```

---

## 4. Memory Management

### 4.1 MutationObserver Best Practices

**❌ BAD - Never disconnect:**
```javascript
const observer = new MutationObserver(() => {
    const target = document.querySelector('.target');
    if (target) {
        // Found it, but observer keeps running!
        process(target);
    }
});
observer.observe(document.body, { childList: true, subtree: true });
```

**✅ GOOD - Disconnect immediately:**
```javascript
let observer = null;

function findAndProcess() {
    // Try immediate query first
    const target = document.querySelector('.target');
    if (target) {
        process(target);
        return;
    }

    // Setup observer only if needed
    observer = new MutationObserver(() => {
        const target = document.querySelector('.target');
        if (target) {
            observer.disconnect(); // ⚠️ CRITICAL
            observer = null;
            process(target);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// In cleanup()
if (observer) {
    observer.disconnect();
    observer = null;
}
```

**✅ BETTER - Scoped observation:**
```javascript
// Don't observe entire document.body
observer.observe(document.body, { childList: true, subtree: true });

// Observe smaller subtree
const container = document.querySelector('#specific-container');
if (container) {
    observer.observe(container, { childList: true, subtree: false });
}
```

### 4.2 Event Listener Management

**Track all listeners:**
```javascript
const MyModule = (function() {
    const eventHandlers = [];

    function addListener(element, event, handler) {
        element.addEventListener(event, handler);
        eventHandlers.push({ element, event, handler });
    }

    return {
        init: function() {
            const button = document.querySelector('.my-button');
            if (button) {
                addListener(button, 'click', handleClick);
            }

            addListener(document, 'customEvent', handleCustom);
        },

        cleanup: function() {
            eventHandlers.forEach(({element, event, handler}) => {
                element.removeEventListener(event, handler);
            });
            eventHandlers.length = 0; // Clear array
        }
    };
})();
```

### 4.3 Timer Management

**Track all timers:**
```javascript
const MyModule = (function() {
    const timers = [];

    function setTimeout_tracked(fn, delay) {
        const id = setTimeout(fn, delay);
        timers.push({ type: 'timeout', id });
        return id;
    }

    function setInterval_tracked(fn, delay) {
        const id = setInterval(fn, delay);
        timers.push({ type: 'interval', id });
        return id;
    }

    return {
        init: function() {
            setTimeout_tracked(() => {
                console.log('Delayed action');
            }, 1000);

            setInterval_tracked(() => {
                console.log('Repeated action');
            }, 5000);
        },

        cleanup: function() {
            timers.forEach(({type, id}) => {
                if (type === 'timeout') {
                    clearTimeout(id);
                } else if (type === 'interval') {
                    clearInterval(id);
                }
            });
            timers.length = 0;
        }
    };
})();
```

### 4.4 Cache Management

**Implement cache limits:**
```javascript
const CacheManager = (function() {
    const cache = new Map();
    const MAX_CACHE_SIZE = 100;

    function set(key, value) {
        // Evict oldest if at limit
        if (cache.size >= MAX_CACHE_SIZE) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }

        cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    function get(key) {
        const entry = cache.get(key);
        if (!entry) return null;

        // Check expiration (1 hour)
        const AGE_LIMIT = 60 * 60 * 1000;
        if (Date.now() - entry.timestamp > AGE_LIMIT) {
            cache.delete(key);
            return null;
        }

        return entry.value;
    }

    function clear() {
        cache.clear();
    }

    return { set, get, clear };
})();
```

---

## 5. Error Handling

### 5.1 Error Hierarchy

```javascript
// Custom error types
class ModuleError extends Error {
    constructor(moduleName, message) {
        super(`[${moduleName}] ${message}`);
        this.name = 'ModuleError';
        this.moduleName = moduleName;
    }
}

class DataExtractionError extends ModuleError {
    constructor(moduleName, message, selector) {
        super(moduleName, message);
        this.name = 'DataExtractionError';
        this.selector = selector;
    }
}

// Usage
throw new DataExtractionError('CaseDataExtractor', 'Element not found', '.my-selector');
```

### 5.2 Try-Catch Patterns

**Async function:**
```javascript
async function fetchCaseData(caseId) {
    try {
        // Validate input
        if (!caseId) {
            throw new Error('Case ID is required');
        }

        // Attempt operation
        const data = await extractData(caseId);

        // Validate output
        if (!data || !data.caseNumber) {
            throw new Error('Invalid data extracted');
        }

        return { success: true, data };
    } catch (error) {
        console.error('[MyModule] fetchCaseData failed:', error);

        // Log to remote service (if available)
        if (typeof ErrorLogger !== 'undefined') {
            ErrorLogger.log(error);
        }

        // Show user-friendly message
        if (typeof PersistentBanner !== 'undefined') {
            PersistentBanner.showNotification(
                'Unable to load case data. Please refresh the page.',
                'error'
            );
        }

        return { success: false, error: error.message };
    }
}
```

**Event handler:**
```javascript
button.addEventListener('click', async (e) => {
    e.preventDefault();

    try {
        // Show loading state
        button.disabled = true;
        button.textContent = 'Processing...';

        // Perform operation
        const result = await performAction();

        // Show success
        if (result.success) {
            showSuccessMessage();
        } else {
            showErrorMessage(result.error);
        }
    } catch (error) {
        console.error('[MyModule] Button click failed:', error);
        showErrorMessage('An unexpected error occurred');
    } finally {
        // Always restore button state
        button.disabled = false;
        button.textContent = 'Submit';
    }
});
```

### 5.3 Retry Logic

```javascript
async function fetchWithRetry(url, options = {}) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`[MyModule] Fetch attempt ${attempt} failed:`, error);

            if (attempt === MAX_RETRIES) {
                // All retries exhausted
                throw new Error(`Failed after ${MAX_RETRIES} attempts: ${error.message}`);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        }
    }
}
```

---

## 6. Security Guidelines

### 6.1 Input Validation

**Always validate user input:**
```javascript
function processUserInput(input) {
    // Type check
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }

    // Length check
    if (input.length > 1000) {
        throw new Error('Input too long');
    }

    // Pattern check
    if (!/^[a-zA-Z0-9\s-]+$/.test(input)) {
        throw new Error('Input contains invalid characters');
    }

    // Sanitize
    const sanitized = input.trim();

    return sanitized;
}
```

### 6.2 XSS Prevention

**❌ NEVER use innerHTML with unsanitized data:**
```javascript
// ❌ DANGER
element.innerHTML = `<div>${userData}</div>`;

// ✅ SAFE - Use textContent
element.textContent = userData;

// ✅ SAFE - Create elements
const div = document.createElement('div');
div.textContent = userData;
element.appendChild(div);
```

**Escape XML properly:**
```javascript
function escapeXML(str) {
    if (typeof str !== 'string') return '';

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        // Escape control characters
        .replace(/[\x00-\x1F\x7F]/g, (char) => {
            return `&#${char.charCodeAt(0)};`;
        });
}
```

### 6.3 Data Storage Security

**Never store sensitive data:**
```javascript
// ❌ BAD
chrome.storage.local.set({
    password: userPassword, // NEVER store passwords
    apiKey: apiKey,         // NEVER store API keys
    token: authToken        // NEVER store tokens
});

// ✅ GOOD - Store non-sensitive data only
chrome.storage.local.set({
    userPreferences: {
        theme: 'dark',
        language: 'en'
    },
    caseCache: {
        caseNumber: '01234567',
        subject: 'Example case'
    }
});
```

### 6.4 Content Security Policy

**Adhere to CSP:**
```javascript
// ❌ FORBIDDEN - Inline event handlers
element.setAttribute('onclick', 'alert("XSS")');

// ✅ ALLOWED - Event listeners
element.addEventListener('click', () => {
    alert('Safe');
});

// ❌ FORBIDDEN - eval()
eval('maliciousCode()');

// ✅ ALLOWED - JSON.parse()
JSON.parse('{"safe": "data"}');
```

---

## 7. Performance Optimization

### 7.1 DOM Query Optimization

**Cache queries:**
```javascript
// ❌ BAD - Repeated queries
function updateUI() {
    document.querySelector('.status').textContent = 'Loading';
    document.querySelector('.status').classList.add('loading');
    document.querySelector('.status').setAttribute('aria-busy', 'true');
}

// ✅ GOOD - Single query
function updateUI() {
    const status = document.querySelector('.status');
    if (!status) return;

    status.textContent = 'Loading';
    status.classList.add('loading');
    status.setAttribute('aria-busy', 'true');
}

// ✅ BETTER - Cache at module level
const MyModule = (function() {
    let statusElement = null;

    function cacheElements() {
        statusElement = document.querySelector('.status');
    }

    function updateUI() {
        if (!statusElement) return;

        statusElement.textContent = 'Loading';
        statusElement.classList.add('loading');
    }

    return {
        init: function() {
            cacheElements();
        }
    };
})();
```

### 7.2 Debouncing and Throttling

**Use debounce for expensive operations:**
```javascript
// Import from debounceUtils.js
function handleInput(event) {
    const debouncedSave = debounce(() => {
        saveData(event.target.value);
    }, 500); // Wait 500ms after last input

    debouncedSave();
}
```

**Use throttle for frequent events:**
```javascript
function handleScroll(event) {
    const throttledUpdate = throttle(() => {
        updateScrollPosition();
    }, 100); // Max once per 100ms

    throttledUpdate();
}
```

### 7.3 Lazy Loading

**Load features only when needed:**
```javascript
const MyModule = (function() {
    let heavyFeature = null;

    function loadHeavyFeature() {
        if (heavyFeature) return heavyFeature;

        console.log('[MyModule] Loading heavy feature...');
        // Load expensive resource
        heavyFeature = initializeHeavyFeature();

        return heavyFeature;
    }

    return {
        useHeavyFeature: function() {
            const feature = loadHeavyFeature();
            feature.doSomething();
        }
    };
})();
```

### 7.4 Batch DOM Updates

**Minimize reflows:**
```javascript
// ❌ BAD - Multiple reflows
function addItems(items) {
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li); // Reflow on each append
    });
}

// ✅ GOOD - Single reflow
function addItems(items) {
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        fragment.appendChild(li);
    });

    list.appendChild(fragment); // Single reflow
}
```

---

## 8. Salesforce Lightning Specific

### 8.1 SPA Navigation Handling

**Always handle navigation cleanup:**
```javascript
const MyModule = (function() {
    let currentCaseId = null;

    function handleNavigation(url) {
        const newCaseId = extractCaseId(url);

        if (newCaseId !== currentCaseId) {
            console.log('[MyModule] Case changed, cleaning up');
            cleanup();
            currentCaseId = newCaseId;
            initialize();
        }
    }

    return {
        init: function() {
            if (typeof NavigationObserver !== 'undefined') {
                NavigationObserver.onRouteChange(handleNavigation);
            }
        }
    };
})();
```

### 8.2 Shadow DOM Handling

**Access Shadow DOM elements:**
```javascript
function extractFromShadowDOM(host) {
    if (!host || !host.shadowRoot) {
        console.warn('[MyModule] Element has no shadow root');
        return null;
    }

    const shadowElement = host.shadowRoot.querySelector('.target');
    if (!shadowElement) {
        console.warn('[MyModule] Element not found in shadow DOM');
        return null;
    }

    return shadowElement.textContent;
}

// Usage
const lightningComponent = document.querySelector('lightning-formatted-text');
const text = extractFromShadowDOM(lightningComponent);
```

### 8.3 Element Visibility Checks

**Always check visibility (Salesforce caches hidden elements):**
```javascript
function findVisibleElement(selector) {
    const elements = document.querySelectorAll(selector);

    for (const element of elements) {
        if (isElementVisible(element)) {
            return element;
        }
    }

    return null;
}

function isElementVisible(element) {
    if (!element) return false;

    // Check parent chain
    let el = element;
    while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        el = el.parentElement;
    }

    // Check dimensions
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}
```

### 8.4 Dynamic Class Names

**Never rely on generated class names:**
```javascript
// ❌ BAD - Generated class names change
document.querySelector('.lwc-2c0jakuf71q');

// ✅ GOOD - Stable attributes
document.querySelector('[data-label="Case Number"]');
document.querySelector('[title="Edit"]');
document.querySelector('[role="tab"][aria-selected="true"]');
```

---

## 9. Testing Requirements

### 9.1 Manual Testing Checklist

Before committing code:

- [ ] Load extension in chrome://extensions
- [ ] Navigate to ProQuest Salesforce
- [ ] Open DevTools Console → Check for errors
- [ ] Test happy path (feature works as expected)
- [ ] Test error path (graceful degradation)
- [ ] Navigate between multiple case pages → No memory leaks
- [ ] Reload extension → Features still work
- [ ] Check chrome.storage → Data persisted correctly

### 9.2 Performance Testing

**Check memory usage:**
```javascript
// In DevTools Console:
console.memory.usedJSHeapSize; // Before
// Navigate between 10 case pages
console.memory.usedJSHeapSize; // After
// Should increase < 10MB
```

**Check observer count:**
```javascript
// Custom debugging function
function countObservers() {
    let count = 0;
    // Check each module's observer variable
    return count;
}
```

---

## 10. Debugging Strategies

### 10.1 Logging Best Practices

**Use structured logging:**
```javascript
// Module-level logger
const Logger = (function() {
    const MODULE_NAME = 'MyModule';

    return {
        info: (message, data) => {
            console.log(`[${MODULE_NAME}] ${message}`, data || '');
        },
        warn: (message, data) => {
            console.warn(`[${MODULE_NAME}] ${message}`, data || '');
        },
        error: (message, error) => {
            console.error(`[${MODULE_NAME}] ${message}`, error);
        },
        debug: (message, data) => {
            if (DEBUG_MODE) {
                console.debug(`[${MODULE_NAME}] ${message}`, data || '');
            }
        }
    };
})();
```

### 10.2 Debugging Tools

**Add debugging methods:**
```javascript
const MyModule = (function() {
    // ... module code

    return {
        // ... public API

        // Debugging methods (remove in production)
        _debug: {
            getState: () => ({ isInitialized, settings, cache }),
            getObservers: () => observers,
            getEventHandlers: () => eventHandlers,
            forceCleanup: () => cleanup()
        }
    };
})();

// Usage in console:
MyModule._debug.getState();
```

### 10.3 Breakpoint Strategy

**Strategic breakpoints:**
1. Module initialization: `MyModule.init()`
2. Event handlers: `button.addEventListener('click', ...)`
3. Data extraction: `extractData()`
4. Error handling: `catch (error) { ... }`
5. Cleanup: `cleanup()`

---

## 11. Common Pitfalls

### 11.1 Pitfall: Assuming Element Exists

**Problem:**
```javascript
document.querySelector('.element').textContent = 'value'; // TypeError if not found
```

**Solution:**
```javascript
const element = document.querySelector('.element');
if (element) {
    element.textContent = 'value';
}
```

### 11.2 Pitfall: Forgetting to Disconnect Observers

**Problem:**
```javascript
const observer = new MutationObserver(() => { ... });
observer.observe(document.body, { ... });
// Never disconnected → Memory leak
```

**Solution:**
```javascript
let observer = new MutationObserver(() => { ... });
observer.observe(document.body, { ... });

// In cleanup:
if (observer) {
    observer.disconnect();
    observer = null;
}
```

### 11.3 Pitfall: Trusting Salesforce DOM Structure

**Problem:**
```javascript
// Specific class names break when Salesforce updates
document.querySelector('.slds-page-header__title.slds-truncate');
```

**Solution:**
```javascript
// Use multiple selectors + visibility checks
function findHeader() {
    const selectors = [
        '[data-label="header"]',
        '.slds-page-header__title',
        'h1.pageTitle'
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element)) {
            return element;
        }
    }

    return null;
}
```

### 11.4 Pitfall: Synchronous Storage Operations

**Problem:**
```javascript
const data = JSON.parse(localStorage.getItem('data')); // Blocks UI
```

**Solution:**
```javascript
chrome.storage.local.get(['data'], (result) => {
    if (result.data) {
        processData(result.data);
    }
});

// Or with promises
const data = await chrome.storage.local.get(['data']);
if (data.data) {
    processData(data.data);
}
```

### 11.5 Pitfall: Race Conditions

**Problem:**
```javascript
// Event listener fires before URL updates
document.addEventListener('casePageDataExtracted', (event) => {
    const currentCaseId = getCaseIdFromUrl(); // May be old URL
});
```

**Solution:**
```javascript
// Include case ID in event payload
document.dispatchEvent(new CustomEvent('casePageDataExtracted', {
    detail: {
        caseId: caseId,
        data: data
    }
}));

// Use event data, not URL
document.addEventListener('casePageDataExtracted', (event) => {
    const caseId = event.detail.caseId;
});
```

---

## 12. Code Review Checklist

Before approving code:

### 12.1 Functionality
- [ ] Feature works as expected in Salesforce
- [ ] Edge cases handled (empty data, missing elements, etc.)
- [ ] Error messages are user-friendly
- [ ] No console errors in DevTools

### 12.2 Memory Management
- [ ] All MutationObservers have disconnect() calls
- [ ] All event listeners have removeEventListener() calls
- [ ] All timers have clear() calls
- [ ] Module has cleanup() method
- [ ] cleanup() is called from ExLibrisExtension.cleanup()

### 12.3 Security
- [ ] No eval() or Function() constructor
- [ ] No innerHTML with unsanitized data
- [ ] Input validation for user data
- [ ] No storage of sensitive data
- [ ] XSS prevention (escapeXML, textContent)

### 12.4 Performance
- [ ] DOM queries are cached
- [ ] Debouncing/throttling for expensive operations
- [ ] MutationObserver uses specific selectors (not document.body)
- [ ] Lazy loading for heavy features
- [ ] Batch DOM updates

### 12.5 Code Quality
- [ ] Follows module template structure
- [ ] Functions have clear names
- [ ] Complex logic is commented
- [ ] Console logs have module prefix
- [ ] No global variables (except module itself)
- [ ] Dependencies checked before use

### 12.6 Salesforce Specific
- [ ] Handles SPA navigation
- [ ] Checks element visibility
- [ ] Uses stable selectors (not generated classes)
- [ ] Shadow DOM access where needed
- [ ] Multiple selector fallbacks

### 12.7 Documentation
- [ ] Module has JSDoc comments
- [ ] Public functions documented
- [ ] Dependencies listed
- [ ] Usage examples provided
- [ ] manifest.json updated with new module

---

## Appendix: Quick Reference

### Essential Checks Before Every Commit

1. **No console errors**
   ```bash
   # Open DevTools Console in ProQuest Salesforce
   # Navigate through 3-5 case pages
   # Check for red errors
   ```

2. **Memory leak check**
   ```javascript
   // Before: Note heap size
   console.memory.usedJSHeapSize;

   // Navigate between 10 case pages

   // After: Heap should increase < 10MB
   console.memory.usedJSHeapSize;
   ```

3. **Cleanup verification**
   ```javascript
   // Check cleanup() is called
   // Set breakpoint in MyModule.cleanup()
   // Navigate away from page
   // Breakpoint should hit
   ```

4. **Dependency check**
   ```javascript
   // Verify module loads
   typeof MyModule !== 'undefined'

   // Check in Console after page load
   ```

---

**End of Document**

*Keep this document updated as new patterns emerge and lessons are learned.*
