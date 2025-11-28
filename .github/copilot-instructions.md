# Salesforce Chrome Extension - Copilot Instructions

**Last Updated:** 2025-11-28  
**Purpose:** Comprehensive guidelines for AI agents and developers working on this Chrome Extension codebase

---

## ⚠️ CRITICAL: Read These First

Before making ANY changes:
1. **Read [PROJECT_RULES.md](../PROJECT_RULES.md)** - Complete project rules and agent guidelines
2. **Read [BEST_PRACTICES.md](../BEST_PRACTICES.md)** - Detailed patterns and anti-patterns
3. **Review [CHANGES.md](../CHANGES.md)** - Recent changes and lessons learned
4. **Check [docs/06-bugs-and-gaps.md](../docs/06-bugs-and-gaps.md)** - Known issues to avoid

---

## Project Overview

This is a **Manifest V3 Chrome Extension** for Salesforce Lightning Experience, specifically targeting:
- **ProQuest/Ex Libris Salesforce** (`proquestllc.lightning.force.com`) - Primary focus
- **Clarivate Salesforce** (multiple instances) - Secondary support
- **Knowledge Base Sites** (support.clarivate.com, knowledge.exlibrisgroup.com)

The extension provides:
- Case data extraction and caching
- Field highlighting and validation
- Dynamic URL menu generation
- Timezone conversion and resolution
- Case comment memory and formatting
- Persistent banner with case info
- Multi-tab synchronization

---

## Core Architecture

### Component Roles

- **`background.js`**: Service worker (ephemeral, Manifest V3)
  - Context menu management
  - Cross-tab coordination
  - Extension lifecycle (install/update)
  - ⚠️ **NO persistent global state** - use `chrome.storage` instead

- **`content_script_exlibris.js`**: Main controller for ProQuest domain
  - Orchestrates all modules
  - Manages global state (`window.ExLibrisExtension`)
  - Handles SPA navigation
  - Initializes features based on page type

- **`content_script.js`**: Entry point for Clarivate domains
- **`content_script_highlighter.js`**: Entry point for knowledge base sites
- **`popup.js` + `popup.html`**: Settings UI (timezone, button styles, menu location)
- **`modules/`**: 40+ feature modules organized by layer

### Module Organization (5 Layers)

```
PRESENTATION LAYER (13 modules)
  ├─ persistentBanner.js, dynamicMenu.js, fieldHighlighter.js
  └─ characterCounter.js, flexipagePanelInjector.js

BUSINESS LOGIC LAYER (8 modules)
  ├─ urlBuilder.js, timezoneConverter.js
  └─ caseCommentMemory.js, unknownCustomerManager.js

DATA EXTRACTION LAYER (9 modules)
  ├─ casePageDataExtractor.js, caseDataExtractor.js
  ├─ caseCommentExtractor.js, caseDetailExtractor.js
  └─ accountAddressExtractor.js, shadowTextExtractor.js

DATA MANAGEMENT LAYER (4 modules)
  ├─ caseDataStore.js, caseContextWatcher.js
  └─ customerDataManager.js, customerTimezoneLookup.js

INFRASTRUCTURE LAYER (6 modules)
  ├─ logger.js, debounceUtils.js, settingsManager.js
  └─ pageIdentifier.js, caseDomUtils.js, pageContextValidator.js
```

### Storage Strategy

**chrome.storage.sync** (5KB limit, synced across devices)
- User preferences (timezone, label style, menu location)
- Feature flags
- UI settings

**chrome.storage.local** (10MB limit, local only)
- Customer database
- Timezone mappings
- Comment history
- Case data cache (interim - being migrated to CaseDataStore)

**In-Memory (Tab-scoped)**
- `window.ExLibrisExtension` - Current page state, case data
- `CaseDataStore` - Single source of truth for current case
- Module-scoped state

---

## 🚨 CRITICAL RULES - Never Violate These

### 1. Stale Data Prevention (HIGHEST PRIORITY)

**ALWAYS validate before displaying any case data:**

```javascript
// ✅ REQUIRED PATTERN: Validate before display
async displayCaseData(data) {
  // 1. Validate page context
  const validation = PageContextValidator.validatePageContextBeforeDisplay(
    data.caseId,
    data.caseNumber
  );
  
  if (!validation.valid) {
    Logger.warn('[ModuleName] Validation failed:', validation.reason);
    this.clearDisplay();
    return false;
  }
  
  // 2. Check if already displaying this case
  if (this.isDisplaying(data.caseId)) {
    return true;
  }
  
  // 3. Display
  this.updateUI(data);
  return true;
}
```

**Why Critical**: Modules may receive `casePageDataExtracted` events for Case A after user navigated to Case B, causing mixed/incorrect data display.

**Required for**: PersistentBanner, DynamicMenu, FlexipagePanelInjector, and ALL modules that display case data.

### 2. Page Context Identification (TWO-STEP PROCESS)

**NEVER skip step 1:**

```javascript
// ✅ REQUIRED: Always use title + URL together
const context = PageIdentifier.getCurrentCaseContext();
if (!context) return; // Not on valid case page

// Step 2: Now safe to query DOM
const element = document.querySelector(selector);
```

**Why Critical**: Salesforce Lightning is an SPA. URL may change before title updates, or vice versa. Both must match.

### 3. Element Selection Rules

**ALWAYS follow this order:**

1. ✅ Identify page context first (title + URL)
2. ✅ Use stable SLDS classes (`.slds-page-header`, `.slds-grid`)
3. ✅ Check visibility (`.active`, `[style*="display: block"]`, `offsetParent !== null`)
4. ✅ Chain selectors: `[Visible Tab] > [Visible Layout] > [Stable Class] > [Target]`

**NEVER use:**
- ❌ Dynamic classes (`lwc-*`, `forcegenerated-*`)
- ❌ Position selectors (`nth-child`)
- ❌ Text content matching
- ❌ Auto-generated classes

### 4. Check-Then-Observe Pattern (MANDATORY)

**ALWAYS use this pattern for Salesforce DOM queries:**

```javascript
// 1. Try immediate query
let element = document.querySelector(selector);
if (element && element.offsetParent !== null) {
  processElement(element);
  return;
}

// 2. If not found, set up MutationObserver
const observer = new MutationObserver((mutations) => {
  element = document.querySelector(selector);
  if (element && element.offsetParent !== null) {
    observer.disconnect(); // ⚠️ CRITICAL: Always disconnect
    processElement(element);
  }
});

observer.observe(document.body, { 
  childList: true, 
  subtree: true 
});

// ⚠️ CRITICAL: Set timeout to prevent infinite observation
setTimeout(() => {
  if (observer) {
    observer.disconnect();
    Logger.warn('[ModuleName] Element not found after timeout:', selector);
  }
}, 20000); // 20 second max wait
```

**Why Critical**: Salesforce Lightning loads components asynchronously. Elements may not exist on initial script execution.

### 5. Shadow DOM Traversal

**ALWAYS check shadow root mode:**

```javascript
function queryShadowDOM(selector, root = document.body) {
  // 1. Try direct query
  let element = root.querySelector(selector);
  if (element) return element;

  // 2. Recursively search shadow roots
  const traverse = (node) => {
    // Check for open shadow root
    if (node.shadowRoot && node.shadowRoot.mode === 'open') {
      const found = node.shadowRoot.querySelector(selector);
      if (found) return found;
      
      // Recursively search children
      for (const child of node.shadowRoot.children) {
        const result = traverse(child);
        if (result) return result;
      }
    }

    // Search regular children
    for (const child of node.children) {
      const result = traverse(child);
      if (result) return result;
    }

    return null;
  };

  return traverse(root);
}
```

**Why Critical**: Lightning components use Shadow DOM. Closed shadow roots are inaccessible, but open ones must be traversed.

### 6. SPA Navigation Handling

**ALWAYS use NavigationObserver:**

```javascript
// ✅ CORRECT: Use NavigationObserver
NavigationObserver.start();
NavigationObserver.onRouteChange((url) => {
  // Handle navigation
  this.handleNavigationChange(url);
});

// ❌ WRONG: Only listening to URL changes
window.addEventListener('popstate', handler); // Misses pushState/replaceState
```

**Why Critical**: Salesforce Lightning uses client-side routing. Page changes don't trigger full reloads. Must monitor:
- Title changes (MutationObserver)
- History API (pushState/replaceState intercept)
- Popstate events (browser back/forward)
- Hashchange events

### 7. Service Worker State (Manifest V3)

**NEVER use global state in service worker:**

```javascript
// ❌ WRONG: Global state (lost on termination)
let currentState = {};

// ✅ CORRECT: Persist to storage
await chrome.storage.local.set({ currentState });
const result = await chrome.storage.local.get(['currentState']);
```

**Why Critical**: Service workers are ephemeral and terminate after ~30 seconds of inactivity. All state is lost.

### 8. Module Cleanup (MANDATORY)

**ALWAYS implement cleanup:**

```javascript
const MyModule = {
  _observer: null,
  _timer: null,
  _listeners: [],
  
  init() {
    // Setup observers, timers, listeners
  },
  
  cleanup() {
    // ⚠️ CRITICAL: Always cleanup
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    
    // Remove event listeners
    this._listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this._listeners = [];
  }
};
```

**Why Critical**: Memory leaks occur when observers, timers, and listeners aren't cleaned up on navigation.

---

## State Management Patterns

### Global State (Content Scripts)

**Use `window.ExLibrisExtension` for SPA state:**

```javascript
// ✅ GOOD: Global state for SPA state sharing
window.ExLibrisExtension = {
  currentPage: null,
  currentCaseId: null,
  currentCaseNumber: null,
  lastUrl: null,
  isInitialized: false
};

// Access with defensive check
if (window.ExLibrisExtension?.currentCaseId) {
  const caseId = window.ExLibrisExtension.currentCaseId;
}
```

**When to use:**
- ✅ Current page context (URL, case ID, case number)
- ✅ Immediate access across modules (no async)
- ✅ State that persists across SPA navigation

**When NOT to use:**
- ❌ Persistent data (use chrome.storage)
- ❌ Data that needs to survive refresh
- ❌ Large datasets

### CaseDataStore (Pub/Sub Pattern)

**Use for single source of truth:**

```javascript
// Subscribe to data updates
const unsubscribe = CaseDataStore.subscribe(({ data }) => {
  if (data) {
    this.updateUI(data);
  } else {
    this.clearUI(); // Data cleared (navigated away)
  }
});

// Publish update
CaseDataStore.setCurrentData(newData); // Notifies all subscribers

// Cleanup
unsubscribe();
```

**Benefits:**
- Single source of truth
- Automatic subscriber notification
- Immediate notification to new subscribers
- Clear on navigation

### Chrome Storage Patterns

**For persistent data:**

```javascript
// Store
await chrome.storage.local.set({ key: value });

// Retrieve
const result = await chrome.storage.local.get(['key']);

// Listen for changes (cross-tab sync)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.key) {
    const newValue = changes.key.newValue;
    this.handleUpdate(newValue);
  }
});
```

---

## Module Development Workflow

### Before Starting

1. **Read existing code**
   - Understand module structure
   - Check for existing patterns
   - Review related modules

2. **Check dependencies**
   - Verify all dependencies exist
   - Check module loading order in `manifest.json`
   - Review integration points

3. **Review documentation**
   - Check `PROJECT_RULES.md`
   - Review `BEST_PRACTICES.md`
   - Check `CHANGES.md` for similar work

### Module Structure (IIFE Pattern)

```javascript
/**
 * Module Name
 * Brief description of purpose
 */
const ModuleName = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  let isInitialized = false;
  let observer = null;
  let timer = null;
  let displayedCaseId = null;

  // ========== PRIVATE FUNCTIONS ==========

  function privateHelper() {
    // Implementation
  }

  // ========== PUBLIC API ==========

  return {
    /**
     * Initialize the module
     * @returns {Promise<void>}
     */
    async init() {
      if (isInitialized) {
        Logger.warn('[ModuleName] Already initialized');
        return;
      }

      try {
        // Check dependencies
        if (typeof DependencyModule === 'undefined') {
          Logger.warn('[ModuleName] DependencyModule not available');
          return;
        }

        // Initialize
        await DependencyModule.init();
        
        // Setup observers, listeners, etc.
        this.setupObservers();
        
        isInitialized = true;
        Logger.info('[ModuleName] Initialized');
      } catch (error) {
        Logger.error('[ModuleName] Initialization failed:', error);
      }
    },

    /**
     * Display case data (with validation)
     * @param {Object} data - Case data
     * @returns {Promise<boolean>} Success status
     */
    async displayCaseData(data) {
      // ALWAYS validate before display
      const validation = PageContextValidator.validatePageContextBeforeDisplay(
        data.caseId,
        data.caseNumber
      );
      
      if (!validation.valid) {
        Logger.warn('[ModuleName] Validation failed:', validation.reason);
        this.clearDisplay();
        return false;
      }
      
      // Check if already displaying
      if (displayedCaseId === data.caseId) {
        return true;
      }
      
      // Display
      this.updateUI(data);
      displayedCaseId = data.caseId;
      return true;
    },

    /**
     * Cleanup resources
     */
    cleanup() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      
      this.clearDisplay();
      isInitialized = false;
      displayedCaseId = null;
      Logger.info('[ModuleName] Cleaned up');
    },

    /**
     * Clear display
     */
    clearDisplay() {
      // Remove UI elements
      displayedCaseId = null;
    }
  };
})();

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModuleName;
}
```

### Module Registration

1. **Add to `manifest.json`** (in correct load order):
```json
{
  "content_scripts": [{
    "js": [
      "modules/dependencyModule.js",
      "modules/newModule.js",  // Add here
      "content_script_exlibris.js"
    ]
  }]
}
```

2. **Initialize in `content_script_exlibris.js`**:
```javascript
// In init() method
if (typeof NewModule !== 'undefined') {
  await NewModule.init();
  Logger.info('[ExLibris Extension] NewModule initialized');
} else {
  Logger.warn('[ExLibris Extension] NewModule not loaded');
}
```

### Module Checklist

- [ ] Uses IIFE pattern for encapsulation
- [ ] Checks dependencies before use
- [ ] Implements cleanup() method
- [ ] Validates before displaying data
- [ ] Uses Check-Then-Observe pattern for DOM queries
- [ ] Handles Shadow DOM properly
- [ ] Debounces expensive operations
- [ ] Logs errors with context
- [ ] JSDoc comments on public methods
- [ ] Registered in manifest.json
- [ ] Initialized in content_script_exlibris.js

---

## Common Pitfalls & Anti-Patterns

### ❌ DON'T: Skip Validation

```javascript
// ❌ WRONG: No validation
async displayCaseData(data) {
  this.updateUI(data); // May show stale data!
}

// ✅ CORRECT: Always validate
async displayCaseData(data) {
  const validation = PageContextValidator.validatePageContextBeforeDisplay(
    data.caseId,
    data.caseNumber
  );
  if (!validation.valid) {
    this.clearDisplay();
    return false;
  }
  this.updateUI(data);
}
```

### ❌ DON'T: Query DOM Before Context

```javascript
// ❌ WRONG: Query before context check
const element = document.querySelector(selector);
const context = getCurrentCaseContext(); // Too late!

// ✅ CORRECT: Context first
const context = getCurrentCaseContext();
if (!context) return;
const element = document.querySelector(selector);
```

### ❌ DON'T: Use Dynamic Classes

```javascript
// ❌ WRONG: Dynamic class (breaks on Salesforce updates)
const element = document.querySelector('.lwc-3mmmrd7j9v4');

// ✅ CORRECT: Stable selector
const element = document.querySelector(
  'records-record-layout-item[field-label="Case Number"]'
);
```

### ❌ DON'T: Forget Cleanup

```javascript
// ❌ WRONG: Observer never disconnected
const observer = new MutationObserver(() => {});
observer.observe(document.body, { subtree: true });
// Memory leak!

// ✅ CORRECT: Always cleanup
const observer = new MutationObserver(() => {});
observer.observe(document.body, { subtree: true });

// Later, in cleanup():
observer.disconnect();
```

### ❌ DON'T: Use Global State in Service Worker

```javascript
// ❌ WRONG: Global state (lost on termination)
let currentState = {};

// ✅ CORRECT: Persist to storage
await chrome.storage.local.set({ currentState });
```

### ❌ DON'T: Assume Elements Exist

```javascript
// ❌ WRONG: May throw error
const value = element.textContent;

// ✅ CORRECT: Check first
if (element && element.textContent) {
  const value = element.textContent;
}
```

### ❌ DON'T: Ignore Shadow DOM

```javascript
// ❌ WRONG: May miss elements in shadow DOM
const input = document.querySelector('lightning-input input');

// ✅ CORRECT: Traverse shadow DOM
const input = CaseDomUtils.queryShadowDOM('lightning-input input');
```

---

## Debugging Guidelines

### Console Logging Patterns

**Use Logger module:**

```javascript
Logger.init({ debugMode: false }); // Set to true for debugging

Logger.info('[ModuleName] Message', data);
Logger.warn('[ModuleName] Warning', issue);
Logger.error('[ModuleName] Error', error);
Logger.debug('[ModuleName] Debug info', data); // Only if debugMode: true
```

### Expected Log Sequence

```
[ExLibris Extension] Initializing...
[Logger] Logger initialized
[ExLibris Extension] SettingsManager initialized
[ExLibris Extension] CustomerMasterManager initialized
[CaseContextWatcher] Initialized
[CaseDataStore] Initialized
[NavigationObserver] Started navigation monitoring
[PageIdentifier] Page identified: { type: 'case_page', caseId: '...' }
[CasePageDataExtractor] Extracting data for case: 500QO...
[CasePageDataExtractor] Extracted case data (validated)
[CasePageDataExtractor] Dispatched casePageDataExtracted event
```

### Debugging Checklist

- [ ] Extension loaded and enabled
- [ ] Correct domain (ProQuest vs Clarivate)
- [ ] Browser console open (F12)
- [ ] No errors in console
- [ ] Settings configured (popup)
- [ ] Check module initialization logs
- [ ] Verify page type detection
- [ ] Check data extraction logs
- [ ] Verify event dispatching
- [ ] Check validation results
- [ ] Inspect DOM elements
- [ ] Test SPA navigation
- [ ] Verify cleanup on navigation

### Common Issues & Solutions

**Issue: Module not initializing**
- Check if module is in `manifest.json`
- Check if module is initialized in `content_script_exlibris.js`
- Check console for dependency errors

**Issue: Stale data displayed**
- Verify validation before display
- Check if periodic validation is running
- Verify cleanup on navigation

**Issue: Elements not found**
- Check if using Check-Then-Observe pattern
- Verify selector stability
- Check Shadow DOM traversal
- Verify page context identification

**Issue: Memory leaks**
- Check if observers are disconnected
- Verify timers are cleared
- Check if event listeners are removed

---

## Testing Guidelines

### Manual Testing Checklist

**Navigation Scenarios:**
- [ ] Navigate to case page
- [ ] Navigate between cases (SPA)
- [ ] Navigate away from case page
- [ ] Browser back/forward buttons
- [ ] Refresh page

**Data Display:**
- [ ] Data appears after extraction
- [ ] Data updates on case change
- [ ] Data clears on navigation away
- [ ] No stale data from previous case

**Error Handling:**
- [ ] Graceful degradation on errors
- [ ] Errors logged with context
- [ ] Extension continues working after error

### Test Scenarios

1. **Rapid Navigation Test**
   - Navigate to Case A
   - Wait for data extraction
   - Quickly navigate to Case B
   - Verify Case B data (not Case A)

2. **Shadow DOM Test**
   - Navigate to case with complex components
   - Verify all fields extracted
   - Check console for errors

3. **Cleanup Test**
   - Navigate to case page
   - Navigate away
   - Check DevTools → Performance → Memory
   - Verify no memory leaks

---

## Documentation Requirements

### Code Documentation

**JSDoc for all public functions:**

```javascript
/**
 * Extracts case data from the current page
 * @param {string} caseId - The case ID to extract data for
 * @param {boolean} force - Force re-extraction even if cached
 * @returns {Promise<Object>} Extracted case data
 * @throws {Error} If extraction fails
 */
async function extractCaseData(caseId, force = false) {
  // Implementation
}
```

### Change Documentation

**Update CHANGES.md for significant changes:**

```markdown
### [Date] - [Category] - [Brief Description]

**Description**: Detailed description of the change

**Files Changed**: 
- `path/to/file1.js`
- `path/to/file2.js`

**Lessons Learned**: 
- Key insight 1
- Key insight 2

**Related Issues/PRs**: #issue-number
```

### Selector Documentation

**Document in SELECTORS.md:**
- Selector string
- Stability rating (High/Medium/Low)
- Fallback selectors
- Usage context
- Last verified date

---

## Quick Reference Checklists

### Before Displaying Data
- [ ] Validate page context (case ID + case number)
- [ ] Check page is not loading
- [ ] Verify data matches current page
- [ ] Clear stale data if validation fails

### Before Selecting Elements
- [ ] Identify page context (title + URL)
- [ ] Use stable SLDS classes
- [ ] Check visibility (`.active`, `[style*="display: block"]`)
- [ ] Chain selectors properly
- [ ] Handle Shadow DOM

### Before Caching Data
- [ ] Validate case ID and case number
- [ ] Build signature from data (not DOM)
- [ ] Check for navigation in progress
- [ ] Use cache locking for updates

### Before Navigation Handling
- [ ] Monitor multiple signals (title, URL, context)
- [ ] Debounce callbacks (250ms)
- [ ] Track case context (ID + number)
- [ ] Validate on every callback

### Before Module Development
- [ ] Check dependencies exist
- [ ] Review existing patterns
- [ ] Plan state management
- [ ] Plan error handling
- [ ] Plan cleanup strategy

---

## Critical Files Reference

### Documentation (Single Source of Truth: `docs/` folder)

**Essential Reference (Root Level):**
- **`PROJECT_RULES.md`** - Complete project rules and guidelines
- **`BEST_PRACTICES.md`** - Detailed patterns and anti-patterns
- **`CHANGES.md`** - Change history and lessons learned
- **`DEBUG_INSTRUCTIONS.md`** - Debugging guide and test scenarios
- **`FEATURE_SUMMARY.md`** - Quick feature reference guide
- **`FUNCTIONS.md`** - Complete function catalog
- **`SELECTORS.md`** - DOM selector registry
- **`DEPENDENCIES.md`** - Dependency graph

**Comprehensive Documentation (`docs/` folder):**
- **`docs/explanation.md`** - Documentation hub and navigation
- **`docs/01-project-overview.md`** - Project overview
- **`docs/02-architecture-and-design.md`** - Architecture details
- **`docs/03-core-modules.md`** - Module reference
- **`docs/04-data-flow.md`** - Data flow documentation
- **`docs/05-state-management.md`** - State management patterns
- **`docs/06-bugs-and-gaps.md`** - Known issues
- **`docs/07-development-log.md`** - Development history

**Archived Documentation:**
- **`archive/`** - Historical implementation notes (see `archive/README.md`)

### Code Files
- **`manifest.json`** - Extension configuration and module load order
- **`content_script_exlibris.js`** - Main controller
- **`background.js`** - Service worker
- **`modules/caseDataStore.js`** - Single source of truth
- **`modules/caseContextWatcher.js`** - Page context monitoring
- **`modules/casePageDataExtractor.js`** - Data extraction
- **`modules/pageContextValidator.js`** - Validation utility
- **`modules/customerTimezoneLookup.js`** - Timezone resolution (replaces legacy modules)
- **`modules/fetchInterceptor.js`** - API response interception for case data

---

## Lessons Learned (Key Takeaways)

### Code Quality
1. **Validation is Critical**: Always validate before displaying data to prevent stale data bugs
2. **Context First**: Always identify page context before querying DOM
3. **Cleanup is Mandatory**: Always implement cleanup to prevent memory leaks
4. **Shadow DOM is Complex**: Always check shadow root mode and traverse properly
5. **SPA Navigation is Tricky**: Use NavigationObserver, don't rely on single signals
6. **Service Workers are Ephemeral**: Never use global state, always persist to storage
7. **Salesforce Changes Frequently**: Use stable selectors, have fallbacks
8. **Async Timing Matters**: Module loading is async, use proper initialization patterns
9. **Error Handling is Essential**: Never silently fail, always log with context
10. **Testing is Difficult**: Test with real Salesforce pages, not just mocks

### Documentation
11. **Single Source of Truth**: Keep `docs/` folder as the authoritative documentation location
12. **Archive, Don't Delete**: Move obsolete docs to `archive/` for historical reference
13. **Update CHANGES.md**: Document all significant changes with lessons learned
14. **Keep Docs Current**: Update documentation as part of every feature/bug fix
15. **Cross-Reference Properly**: Link between related documents for easy navigation

---

## Enforcement

These guidelines should be:
1. **Reviewed before any major changes**
2. **Referenced during code reviews**
3. **Updated when new patterns emerge**
4. **Followed consistently across all modules**

**Remember:** These guidelines exist to prevent bugs, improve maintainability, and ensure consistency. When in doubt, follow the guideline. If a guideline needs to be broken, document why and update the guidelines.

---

## Documentation Maintenance

### When to Update Documentation

| Trigger | Action |
|---------|--------|
| New feature added | Update `docs/03-core-modules.md`, add to `CHANGES.md` |
| Bug fixed | Add lessons to `docs/07-development-log.md`, update `CHANGES.md` |
| Pattern discovered | Update `BEST_PRACTICES.md`, add to lessons learned |
| Module deprecated | Update this file, archive old docs |
| Selector changed | Update `SELECTORS.md` |

### Documentation Review Checklist
- [ ] Is the change documented in `CHANGES.md`?
- [ ] Are affected docs in `docs/` folder updated?
- [ ] Do cross-references still work?
- [ ] Is this file (`copilot-instructions.md`) still accurate?

---

**Last Updated:** 2025-11-28  
**Maintained By:** Development Team  
**Version:** 2.1
