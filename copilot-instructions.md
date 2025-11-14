# Copilot Instructions - Penang CoE CForce Extension
**Chrome Manifest V3 Extension for Salesforce Lightning**

**Last Updated:** November 10, 2025
**Version:** 2.0 (Enhanced with critical findings)

---

## 📋 Quick Reference

**Before ANY code changes, review:**
1. [CODEBASE_EXPLANATION.md](CODEBASE_EXPLANATION.md) - Complete technical reference
2. [DEVELOPER_BEST_PRACTICES.md](DEVELOPER_BEST_PRACTICES.md) - DO's and DON'Ts
3. [CHANGELOG.md](CHANGELOG.md) - Development history and lessons learned

**Always update CHANGELOG.md when making changes!**

---

## 🎯 Project Overview

### Core Purpose
Chrome extension enhancing Salesforce Lightning UI for technical support teams managing Alma/Esploro/EndNote/WoS/ScholarOne cases.

### Architecture
- **Manifest V3** (service worker, no remote code)
- **Vanilla JavaScript** (ES6+, no build step)
- **Modular Design** (30+ independent modules)
- **Target Platform:** Salesforce Lightning (SPA)

### Key Domains
| Domain | Products | Content Script |
|--------|----------|---------------|
| proquestllc.lightning.force.com | Alma, Esploro | content_script_exlibris.js + 30+ modules |
| clarivateanalytics.lightning.force.com | EndNote, WoS | content_script.js |
| scholarone.my.salesforce.com | ScholarOne | content_script.js |

---

## 🚨 CRITICAL ISSUES - Fix These First

### 🔴 Memory Leaks (HIGH PRIORITY)
**NEVER create observers without cleanup!**

#### Issue #1: caseCommentExtractor.js:796
```javascript
// ❌ CURRENT - Memory leak
extractorObserver = new MutationObserver(/*...*/);

// ✅ FIX NEEDED - Add cleanup
cleanup() {
    if (extractorObserver) {
        extractorObserver.disconnect();
        extractorObserver = null;
    }
}
```

#### Issue #2: persistentBanner.js:118
```javascript
// ❌ CURRENT - Event listeners not removed
document.addEventListener('casePageDataExtracted', (event) => {/*...*/});

// ✅ FIX NEEDED - Track and remove listeners
this.handleCaseData = (event) => {/*...*/};
document.addEventListener('casePageDataExtracted', this.handleCaseData);

// In cleanup()
document.removeEventListener('casePageDataExtracted', this.handleCaseData);
```

#### Issue #3: flexipagePanelInjector.js:859
```javascript
// ❌ CURRENT - Observes entire document.body
this.observer.observe(document.body, { childList: true, subtree: true });

// ✅ FIX NEEDED - Observe smaller subtree or disconnect after match
const container = document.querySelector('.specific-container');
if (container) {
    this.observer.observe(container, { childList: true, subtree: false });
}
```

#### Issue #4: caseTimezoneResolver.js:334,428
```javascript
// ❌ CURRENT - Timer and observer not cleared
this.countdownTimer = setInterval(/*...*/);
this.hoverObserver = new MutationObserver(/*...*/);

// ✅ FIX NEEDED - Add cleanup
cleanup() {
    if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
    }
    if (this.hoverObserver) {
        this.hoverObserver.disconnect();
        this.hoverObserver = null;
    }
}
```

### 🔴 Security Vulnerabilities (HIGH PRIORITY)

#### Issue #1: caseCommentExtractor.js:475 & domUtilities.js:16-24
```javascript
// ❌ CURRENT - Incomplete XML escaping
function escapeXML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ✅ FIX NEEDED - Escape control characters
function escapeXML(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        // Add control character escaping
        .replace(/[\x00-\x1F\x7F]/g, (char) => `&#${char.charCodeAt(0)};`);
}
```

#### Issue #2: persistentBanner.js:948
```javascript
// ❌ CURRENT - innerHTML injection risk
menu.innerHTML = `<h3>Select Export Format</h3>...`;

// ✅ FIX NEEDED - Use createElement and textContent
const h3 = document.createElement('h3');
h3.textContent = 'Select Export Format';
menu.appendChild(h3);
```

#### Issue #3: navigationObserver.js:49-57
```javascript
// ❌ CURRENT - Pollutes global history object
history.pushState = function(...args) {
    self.originalPushState.apply(history, args);
    self.checkUrlChange();
};

// ✅ FIX NEEDED - Remove or namespace properly
// Consider using popstate event or MutationObserver on title instead
```

---

## ✅ MUST-DO Patterns

### 1. Check-Then-Observe Pattern
**ALWAYS use this when searching for elements:**

```javascript
// 1. Try immediate query first
let element = document.querySelector('.target');
if (element) {
    processElement(element);
    return;
}

// 2. If not found, set up MutationObserver
const observer = new MutationObserver(() => {
    element = document.querySelector('.target');
    if (element) {
        observer.disconnect(); // ⚠️ CRITICAL: Always disconnect
        processElement(element);
    }
});

observer.observe(document.body, { childList: true, subtree: true });
```

### 2. Mandatory Cleanup Method
**Every module MUST have cleanup():**

```javascript
const MyModule = (function() {
    let observer = null;
    let timer = null;
    const eventHandlers = [];

    return {
        init: function() {
            // Setup observers, timers, listeners
        },

        // ⚠️ MANDATORY
        cleanup: function() {
            // Disconnect observers
            if (observer) {
                observer.disconnect();
                observer = null;
            }

            // Clear timers
            if (timer) {
                clearInterval(timer);
                timer = null;
            }

            // Remove event listeners
            eventHandlers.forEach(({element, event, handler}) => {
                element.removeEventListener(event, handler);
            });
            eventHandlers.length = 0;
        }
    };
})();
```

### 3. Visibility Checks for Salesforce Elements
**Salesforce caches hidden DOM elements - always check visibility:**

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

// Usage
const containers = document.querySelectorAll('.container');
const visibleContainer = Array.from(containers).find(isElementVisible);
```

### 4. Dependency Checking
**Always check if dependencies are loaded:**

```javascript
if (typeof DependentModule !== 'undefined') {
    DependentModule.doSomething();
} else {
    console.warn('[MyModule] DependentModule not available, using fallback');
    // Graceful degradation
}
```

### 5. Try-Catch for Async Operations
**Never let promise rejections go uncaught:**

```javascript
async function riskyOperation() {
    try {
        const result = await fetchData();
        if (!result) {
            throw new Error('No result returned');
        }
        return result;
    } catch (error) {
        console.error('[MyModule] riskyOperation failed:', error);

        // Show user-friendly message
        if (typeof PersistentBanner !== 'undefined') {
            PersistentBanner.showNotification(
                'Operation failed. Please try again.',
                'error'
            );
        }

        return null; // Safe default
    }
}
```

---

## ❌ NEVER DO These Things

### 1. Never Create Observers Without Cleanup
```javascript
// ❌ BAD - Memory leak
new MutationObserver(() => {/*...*/}).observe(document.body, {/*...*/});

// ✅ GOOD - Tracked and cleaned up
let observer = new MutationObserver(() => {/*...*/});
observer.observe(document.body, {/*...*/});
// Later: observer.disconnect(); observer = null;
```

### 2. Never Use innerHTML with Unsanitized Data
```javascript
// ❌ BAD - XSS risk
element.innerHTML = `<div>${userData}</div>`;

// ✅ GOOD - Safe
element.textContent = userData;
// OR
const div = document.createElement('div');
div.textContent = userData;
element.appendChild(div);
```

### 3. Never Assume Elements Exist
```javascript
// ❌ BAD - TypeError if not found
document.querySelector('.element').textContent = 'value';

// ✅ GOOD - Defensive
const element = document.querySelector('.element');
if (element) {
    element.textContent = 'value';
}
```

### 4. Never Ignore Promise Rejections
```javascript
// ❌ BAD - Uncaught promise rejection
fetchData();

// ✅ GOOD - Caught and handled
fetchData().catch(error => {
    console.error('[MyModule] Fetch failed:', error);
});

// ✅ BETTER - Async/await with try-catch
try {
    await fetchData();
} catch (error) {
    console.error('[MyModule] Fetch failed:', error);
}
```

### 5. Never Trust Salesforce DOM Structure
```javascript
// ❌ BAD - Generated class names change
document.querySelector('.lwc-2c0jakuf71q');

// ✅ GOOD - Stable attributes
document.querySelector('[data-label="Case Number"]');
document.querySelector('[title="Edit"]');
document.querySelector('[role="tab"][aria-selected="true"]');
```

---

## 🏗️ Module Development

### Module Template
```javascript
/**
 * ModuleName
 *
 * Purpose: [Brief description]
 * Dependencies: [List required modules]
 * Chrome Manifest V3 Compliant: Yes/No
 */

const ModuleName = (function() {
    'use strict';

    // ========== PRIVATE STATE ==========
    let isInitialized = false;
    let observers = [];
    let timers = [];
    let eventHandlers = [];

    // ========== PRIVATE FUNCTIONS ==========
    function privateHelper() {
        // Implementation
    }

    // ========== PUBLIC API ==========
    return {
        init: function() {
            if (isInitialized) {
                console.warn('[ModuleName] Already initialized');
                return;
            }

            console.log('[ModuleName] Initializing...');

            // Check dependencies
            if (typeof DependentModule === 'undefined') {
                console.error('[ModuleName] DependentModule not loaded');
                return;
            }

            // Setup
            isInitialized = true;
        },

        // ⚠️ MANDATORY
        cleanup: function() {
            if (!isInitialized) return;

            console.log('[ModuleName] Cleaning up...');

            // Disconnect observers
            observers.forEach(obs => obs.disconnect());
            observers = [];

            // Clear timers
            timers.forEach(timer => clearInterval(timer));
            timers = [];

            // Remove listeners
            eventHandlers.forEach(({element, event, handler}) => {
                element.removeEventListener(event, handler);
            });
            eventHandlers = [];

            isInitialized = false;
        }
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.ModuleName = ModuleName;
}
```

### Adding New Modules

**1. Create module file:**
- Location: `modules/myNewModule.js`
- Follow template above
- Include JSDoc comments

**2. Update manifest.json:**
```json
{
  "content_scripts": [{
    "js": [
      "modules/logger.js",
      "modules/storageWrapper.js",
      // ... existing modules

      "modules/myNewModule.js", // Add here

      "content_script_exlibris.js" // Controller must be last
    ],
    "matches": ["https://proquestllc.lightning.force.com/*"]
  }]
}
```

**3. Register in content_script_exlibris.js:**
```javascript
// In init() method
if (typeof MyNewModule !== 'undefined') {
    MyNewModule.init();
    console.log('[ExLibris Extension] MyNewModule initialized');
} else {
    console.warn('[ExLibris Extension] MyNewModule not loaded');
}

// In cleanup() method
if (typeof MyNewModule !== 'undefined' && MyNewModule.cleanup) {
    MyNewModule.cleanup();
}
```

**4. Update CHANGELOG.md:**
```markdown
## [Date] - [Your Name]

### Changes Made
- **File(s):** modules/myNewModule.js, manifest.json, content_script_exlibris.js
- **Type:** Feature
- **Description:** Added MyNewModule to handle [purpose]

### Testing
- [x] Manual testing performed
- [x] No console errors
- [x] Memory leak check passed
```

---

## 🎨 Salesforce Lightning Specifics

### SPA Navigation Handling
```javascript
// Always handle navigation cleanup
function handleNavigation(url) {
    const newCaseId = extractCaseId(url);

    if (newCaseId !== currentCaseId) {
        console.log('[MyModule] Case changed, cleaning up');
        cleanup();
        currentCaseId = newCaseId;
        initialize();
    }
}
```

### Shadow DOM Access
```javascript
function extractFromShadowDOM(host) {
    if (!host || !host.shadowRoot) {
        console.warn('[MyModule] Element has no shadow root');
        return null;
    }

    const shadowElement = host.shadowRoot.querySelector('.target');
    return shadowElement ? shadowElement.textContent : null;
}
```

### Dynamic Class Names
```javascript
// ❌ NEVER rely on generated class names
'.lwc-2c0jakuf71q'

// ✅ USE stable attributes
'[data-label="Field Name"]'
'[title="Button Title"]'
'[role="tab"][aria-selected="true"]'
```

---

## 🔍 Debugging

### Logging Standards
```javascript
// Always prefix with module name
console.log('[ModuleName] Action completed');
console.warn('[ModuleName] Potential issue detected');
console.error('[ModuleName] Critical failure:', error);
```

### Memory Leak Detection
```javascript
// In DevTools Console:

// 1. Take heap snapshot
// 2. Navigate between 10 case pages
// 3. Force garbage collection (DevTools → Performance → Collect Garbage)
// 4. Take another heap snapshot
// 5. Compare → Look for detached DOM nodes, listeners

// Expected: Heap growth < 10MB
console.memory.usedJSHeapSize; // Before
// ... navigation ...
console.memory.usedJSHeapSize; // After
```

### Debugging Tools
```javascript
// Add debug methods to modules
const MyModule = (function() {
    // ... module code

    return {
        // ... public API

        _debug: {
            getState: () => ({ isInitialized, settings }),
            getObservers: () => observers,
            forceCleanup: () => cleanup()
        }
    };
})();

// Usage in Console:
MyModule._debug.getState();
```

---

## 📊 Performance Guidelines

### DOM Query Optimization
```javascript
// ❌ BAD - Repeated queries
function updateUI() {
    document.querySelector('.status').textContent = 'Loading';
    document.querySelector('.status').classList.add('loading');
}

// ✅ GOOD - Single query, cached
function updateUI() {
    const status = document.querySelector('.status');
    if (!status) return;

    status.textContent = 'Loading';
    status.classList.add('loading');
}
```

### Debouncing
```javascript
// Use for expensive operations triggered by frequent events
const debouncedSave = debounce(() => {
    saveData(textarea.value);
}, 500); // Wait 500ms after last input

textarea.addEventListener('input', debouncedSave);
```

### Batch DOM Updates
```javascript
// ❌ BAD - Multiple reflows
items.forEach(item => {
    list.appendChild(createListItem(item)); // Reflow each time
});

// ✅ GOOD - Single reflow
const fragment = document.createDocumentFragment();
items.forEach(item => {
    fragment.appendChild(createListItem(item));
});
list.appendChild(fragment); // One reflow
```

---

## 🧪 Testing Checklist

Before committing code:

- [ ] Load extension in chrome://extensions
- [ ] Navigate to ProQuest Salesforce
- [ ] Open DevTools Console → Check for errors
- [ ] Test happy path (feature works)
- [ ] Test error path (graceful degradation)
- [ ] Navigate between 5 case pages → No memory leaks
- [ ] Reload extension → Features still work
- [ ] Check chrome.storage → Data persisted
- [ ] Update CHANGELOG.md with changes

---

## 📚 Key Files Reference

### Entry Points
- [content_script_exlibris.js](content_script_exlibris.js) - Main controller for ProQuest org
- [content_script.js](content_script.js) - Legacy features for Clarivate/ScholarOne
- [background.js](background.js) - Service worker (context menus)

### Configuration
- [manifest.json](manifest.json) - Extension manifest (MV3)
- [popup.html](popup.html) / [popup.js](popup.js) - Settings UI

### Critical Modules (Fix Memory Leaks First!)
- [modules/caseCommentExtractor.js](modules/caseCommentExtractor.js) - 🔴 Line 796
- [modules/persistentBanner.js](modules/persistentBanner.js) - 🔴 Line 118
- [modules/flexipagePanelInjector.js](modules/flexipagePanelInjector.js) - 🔴 Line 859
- [modules/caseTimezoneResolver.js](modules/caseTimezoneResolver.js) - 🔴 Lines 334, 428

### Utility Modules
- [modules/logger.js](modules/logger.js) - Centralized logging
- [modules/storageWrapper.js](modules/storageWrapper.js) - Chrome Storage API wrapper
- [modules/domUtilities.js](modules/domUtilities.js) - 🔴 Fix escapeXML at line 16

### Documentation
- [CODEBASE_EXPLANATION.md](CODEBASE_EXPLANATION.md) - **START HERE** - Complete reference
- [DEVELOPER_BEST_PRACTICES.md](DEVELOPER_BEST_PRACTICES.md) - DO's and DON'Ts
- [CHANGELOG.md](CHANGELOG.md) - **UPDATE THIS** - Development history
- [ARCHITECTURE.md](ARCHITECTURE.md) - Architecture diagrams
- [LESSONS.md](LESSONS.md) - Historical lessons learned

---

## 🚀 Quick Start for New Developers

1. **Read documentation:**
   - [CODEBASE_EXPLANATION.md](CODEBASE_EXPLANATION.md) - Complete overview
   - [DEVELOPER_BEST_PRACTICES.md](DEVELOPER_BEST_PRACTICES.md) - Coding standards

2. **Setup environment:**
   ```bash
   # 1. Clone repository
   git clone <repo-url>

   # 2. Open Chrome → chrome://extensions
   # 3. Enable "Developer mode"
   # 4. Click "Load unpacked"
   # 5. Select project directory
   ```

3. **Test manually:**
   - Navigate to https://proquestllc.lightning.force.com/
   - Open DevTools Console
   - Navigate to a case page
   - Verify features work (banner, panel, highlighting)

4. **Before making changes:**
   - Review critical issues section above
   - Check CHANGELOG.md for recent changes
   - Understand module you're modifying

5. **After making changes:**
   - Test in Salesforce (all features)
   - Check for console errors
   - Check memory leaks (heap size before/after)
   - Update CHANGELOG.md
   - Commit with descriptive message

---

## 🔗 External Resources

### Chrome Extension Development
- [Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

### Salesforce Lightning
- [Lightning Web Components](https://developer.salesforce.com/docs/component-library/overview/components)
- [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM)
- [Salesforce Lightning Design System](https://www.lightningdesignsystem.com/)

### JavaScript Best Practices
- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [JavaScript Design Patterns](https://www.patterns.dev/posts/classic-design-patterns/)
- [Mutation Observer](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)

---

## 📝 Commit Message Format

```
[Type] Brief description (50 chars max)

- More detailed explanation if needed
- List changes made
- Reference issues: Fixes #123

Updated CHANGELOG.md: [Date] entry
```

**Types:** `[Fix]`, `[Feature]`, `[Refactor]`, `[Docs]`, `[Security]`, `[Perf]`

**Example:**
```
[Fix] Disconnect MutationObserver in caseCommentExtractor

- Added cleanup() method to caseCommentExtractor module
- Properly disconnect observer when no longer needed
- Prevents memory leak during navigation

Fixes critical issue identified in CODEBASE_EXPLANATION.md
Updated CHANGELOG.md: 2025-11-10 entry
```

---

**End of Copilot Instructions**

*This document is your guide. Follow it closely. Update CHANGELOG.md with every change.*
