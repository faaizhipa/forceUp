# Best Practices Guide

This document outlines coding patterns, do's and don'ts, redundancies, inconsistencies, and lessons learned from the codebase.

## Do's and Don'ts

### DO's

#### Module Structure
- ✅ **DO** use IIFE pattern for module encapsulation
- ✅ **DO** separate private and public functions clearly
- ✅ **DO** implement `init()` and `cleanup()` methods
- ✅ **DO** check `isInitialized` flag to prevent double initialization
- ✅ **DO** use JSDoc comments for all public functions
- ✅ **DO** export modules using `typeof module !== 'undefined' && module.exports` pattern

#### Dependency Management
- ✅ **DO** check for optional dependencies before use: `if (typeof DependencyModule !== 'undefined')`
- ✅ **DO** provide graceful degradation when dependencies are missing
- ✅ **DO** log warnings when dependencies are unavailable
- ✅ **DO** use event-based communication for loose coupling

#### DOM Manipulation
- ✅ **DO** check element existence before querying: `if (!element) return;`
- ✅ **DO** use visibility checks before injecting: `isElementVisible(element)`
- ✅ **DO** handle Shadow DOM properly with recursive traversal
- ✅ **DO** use fallback selectors for robustness
- ✅ **DO** cache frequently used DOM elements
- ✅ **DO** use `querySelector` with specific selectors over `getElementById` when possible
- ✅ **DO** disconnect MutationObservers in cleanup methods

#### Error Handling
- ✅ **DO** wrap risky operations in try-catch blocks
- ✅ **DO** log errors with context: `console.error('[ModuleName] Error:', error)`
- ✅ **DO** return early on errors rather than throwing
- ✅ **DO** handle async errors with `.catch()` or try-catch in async functions

#### Performance
- ✅ **DO** debounce/throttle expensive operations (DOM queries, event handlers)
  - **Manifest V3 Context**: Content scripts run on main thread - blocking operations freeze the page
  - Use `DebounceUtils.debounce()` or `DebounceUtils.throttle()` for event handlers
- ✅ **DO** use `MutationObserver` with debouncing for DOM watching
  - **Manifest V3 Context**: Observers in content scripts can impact page performance
  - Always debounce observer callbacks to prevent excessive DOM queries
  - Limit observer scope to specific containers, not entire document
- ✅ **DO** cache extracted data to avoid redundant DOM parsing
  - **Manifest V3 Context**: Service workers can terminate - use `chrome.storage` for persistence
  - Cache DOM-extracted data in memory and sync to storage for persistence
- ✅ **DO** limit observer scope: `observer.observe(element, { childList: true, subtree: true })`
  - **Manifest V3 Context**: Smaller scope = better performance in content scripts
  - Use `subtree: false` when possible to reduce observation overhead
- ✅ **DO** disconnect observers when not needed
  - **Manifest V3 Context**: Prevents memory leaks and improves performance
  - Always implement cleanup methods that disconnect observers

#### Salesforce Lightning Specific

**Element Loading & Timing**
- ✅ **DO** wait for elements to load before querying (use retry loops with exponential backoff)
- ✅ **DO** use `MutationObserver` to detect when Lightning components become available
- ✅ **DO** check element visibility before interacting: `element.offsetParent !== null`
- ✅ **DO** handle multiple case pages in DOM (only operate on visible ones)
- ✅ **DO** use `requestIdleCallback` for non-critical DOM operations

**SPA Navigation Handling**
- ✅ **DO** handle SPA navigation with `NavigationObserver` (monitors title changes, history API, popstate)
- ✅ **DO** implement idempotent injection patterns (check for existing elements before injecting)
- ✅ **DO** cleanup on navigation: disconnect observers, clear timers, remove event listeners
- ✅ **DO** use debounced navigation callbacks (250ms delay recommended)
- ✅ **DO** detect navigation via multiple signals: URL change, title change, DOM mutations

**Field Identification**
- ✅ **DO** use `field-label` attributes for field identification (most stable)
- ✅ **DO** use `data-*` attributes for custom elements
- ✅ **DO** prefer attribute selectors over class names: `[field-label="Case Number"]`
- ✅ **DO** use partial matching as fallback: `[field-label*="Case Number"]`
- ✅ **DO** query both regular DOM and Shadow DOM for fields

**Shadow DOM Interaction**
- ✅ **DO** check `shadowRoot.mode === 'open'` before traversing (closed roots are inaccessible)
- ✅ **DO** recursively traverse shadow roots for nested components
- ✅ **DO** handle both native and synthetic shadow DOM modes
- ✅ **DO** use `querySelector` on `shadowRoot` to access shadow DOM elements
- ✅ **DO** respect shadow DOM boundaries - don't assume direct access
- ✅ **DO** use `composed: true` flag for events crossing shadow boundaries
- ✅ **DO** implement abort signals for long shadow DOM traversals

**Lazy Loading Strategies**
- ✅ **DO** use `MutationObserver` with `subtree: true` to detect lazy-loaded content
- ✅ **DO** debounce observer callbacks to avoid excessive processing
- ✅ **DO** use `IntersectionObserver` to detect when components become visible
- ✅ **DO** simulate user interactions (clicks) to trigger lazy loading when needed
- ✅ **DO** wait for DOM mutations to settle before querying (use `setTimeout` or `requestIdleCallback`)
- ✅ **DO** implement progressive enhancement - load critical features first

**Injection & Encapsulation**
- ✅ **DO** wrap injected elements in `<slot>` for proper encapsulation
- ✅ **DO** use `data-*` attributes to mark injected elements for cleanup
- ✅ **DO** check for existing injections before adding new ones (idempotency)
- ✅ **DO** inject into stable containers (flexipage headers, record layouts)
- ✅ **DO** use external CSS files (not inline styles) for CSP compliance

**Element Selection & Visibility**
- ✅ **DO** use `document.title` and `window.location.href` for page identification (fastest, most reliable)
- ✅ **DO** chain stable SLDS classes with visibility checks (`.active`, `[style*="display: block"]`)
- ✅ **DO** start from widest stable container, then drill down to target
- ✅ **DO** check for `.active` class on tab panels and components
- ✅ **DO** use `[style*="display: block"]` to check inline style visibility
- ✅ **DO** use ARIA attributes for state checking: `[aria-hidden="false"]`, `[aria-expanded="true"]`
- ✅ **DO** use stable SLDS classes (`.slds-page-header`, `.slds-grid`, etc.)
- ✅ **DO** verify page context before DOM queries (two-step process: identify → select)

#### Code Quality
- ✅ **DO** use consistent naming: camelCase for functions, UPPER_CASE for constants
- ✅ **DO** use descriptive variable names
- ✅ **DO** break complex functions into smaller helper functions
- ✅ **DO** use early returns to reduce nesting
- ✅ **DO** comment complex logic and non-obvious decisions

### DON'Ts

#### Module Structure
- ❌ **DON'T** create global variables outside module scope (e.g., `window.myState = {}`)
- ✅ **DO** use module-scoped variables within IIFE (e.g., `const MyModule = (function() { let state = {}; ... })()`)
- ❌ **DON'T** forget to implement cleanup methods
- ❌ **DON'T** initialize modules multiple times without checking
- ❌ **DON'T** expose private state in public API

#### Dependency Management
- ❌ **DON'T** assume dependencies are always available
- ❌ **DON'T** create circular dependencies
- ❌ **DON'T** hardcode dependency load order (rely on manifest.json)

#### DOM Manipulation
- ❌ **DON'T** use long, specific DOM paths (fragile)
- ❌ **DON'T** rely on position-based selectors
- ❌ **DON'T** query DOM without checking element existence
- ❌ **DON'T** ignore Shadow DOM
- ❌ **DON'T** use `innerHTML` with user input (security risk)
- ❌ **DON'T** forget to remove event listeners in cleanup
- ❌ **DON'T** inject into hidden elements

#### Error Handling
- ❌ **DON'T** silently fail - always log errors
- ❌ **DON'T** throw errors that break the extension
- ❌ **DON'T** ignore async errors

#### Performance
- ❌ **DON'T** query DOM in tight loops without caching
- ❌ **DON'T** create observers without cleanup
- ❌ **DON'T** use `setInterval` without clearing
- ❌ **DON'T** extract data redundantly (use cache)

#### Salesforce Lightning Specific

**Element Selection & Queries**
- ❌ **DON'T** use Salesforce internal class names (unless stable and documented)
- ❌ **DON'T** assume page structure won't change (Salesforce updates frequently)
- ❌ **DON'T** query DOM immediately on page load (elements may be lazy-loaded)
- ❌ **DON'T** use brittle selectors that depend on DOM structure depth
- ❌ **DON'T** assume all elements are in regular DOM (check Shadow DOM)

**Shadow DOM Pitfalls**
- ❌ **DON'T** try to access closed shadow roots (`mode === 'closed'`)
- ❌ **DON'T** assume all components use the same shadow mode (mixed modes exist)
- ❌ **DON'T** use `querySelector` without checking for shadow roots
- ❌ **DON'T** traverse shadow DOM without checking `shadowRoot.mode`
- ❌ **DON'T** forget to handle both native and synthetic shadow modes

**SPA Navigation Mistakes**
- ❌ **DON'T** ignore SPA navigation (use NavigationObserver)
- ❌ **DON'T** rely only on `window.onload` (doesn't fire on SPA navigation)
- ❌ **DON'T** forget to cleanup on navigation (memory leaks)
- ❌ **DON'T** inject without checking for existing elements (duplicates)
- ❌ **DON'T** assume URL changes mean page reload (SPA navigation)

**Lazy Loading Issues**
- ❌ **DON'T** query elements before they're loaded
- ❌ **DON'T** ignore lazy-loaded tabs or accordions
- ❌ **DON'T** use `setTimeout` without checking element existence
- ❌ **DON'T** process all mutations immediately (debounce observer callbacks)

**Event Handling**
- ❌ **DON'T** dispatch events without `composed: true` for shadow DOM crossing
- ❌ **DON'T** call Salesforce internal APIs directly (CSP blocked + minified)
- ❌ **DON'T** use inline event handlers (CSP compliance)
- ❌ **DON'T** assume events bubble through shadow boundaries

**Element Selection Pitfalls**
- ❌ **DON'T** use dynamic/generated classes (e.g., `lwc-3mmmrd7j9v4`, `forcegenerated-flexipage_case...`)
- ❌ **DON'T** rely on element order/position (`div:nth-child(3)`)
- ❌ **DON'T** select elements without visibility checks (hidden elements exist in DOM)
- ❌ **DON'T** query DOM before verifying page context (may be wrong page)
- ❌ **DON'T** use text content for element selection (translation issues)

#### Code Quality
- ❌ **DON'T** use magic numbers - use named constants
- ❌ **DON'T** write functions longer than 50 lines
- ❌ **DON'T** use `var` - use `const` or `let`
- ❌ **DON'T** forget to handle edge cases

## Coding Patterns

### Module Pattern (IIFE)

```javascript
/**
 * Module Name
 * Brief description
 */
const ModuleName = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  let isInitialized = false;
  let observer = null;

  // ========== PRIVATE FUNCTIONS ==========

  function privateHelper() {
    // Implementation
  }

  // ========== PUBLIC API ==========

  return {
    init() {
      if (isInitialized) return;
      // Initialization
      isInitialized = true;
    },

    cleanup() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      isInitialized = false;
    }
  };
})();
```

### Object Pattern (for simpler modules)

```javascript
/**
 * Module Name
 */
const ModuleName = {
  isInitialized: false,

  async init() {
    if (this.isInitialized) return;
    // Initialization
    this.isInitialized = true;
  },

  cleanup() {
    // Cleanup
    this.isInitialized = false;
  }
};
```

### Initialization Pattern

```javascript
async init() {
  if (this.isInitialized) {
    console.log('[ModuleName] Already initialized');
    return;
  }

  // Check feature flag
  const isEnabled = await this.isFeatureEnabled();
  if (!isEnabled) {
    console.log('[ModuleName] Feature disabled');
    return;
  }

  // Initialize
  this.setup();
  this.isInitialized = true;
  console.log('[ModuleName] Initialized');
}
```

### Cleanup Pattern

```javascript
cleanup() {
  if (!this.isInitialized) return;

  // Disconnect observers
  if (this.observer) {
    this.observer.disconnect();
    this.observer = null;
  }

  // Clear timers
  if (this.timer) {
    clearTimeout(this.timer);
    this.timer = null;
  }

  // Remove event listeners
  // Remove DOM elements
  // Clear state

  this.isInitialized = false;
  console.log('[ModuleName] Cleaned up');
}
```

### Dependency Checking Pattern

```javascript
// Optional dependency
if (typeof DependencyModule !== 'undefined') {
  DependencyModule.doSomething();
} else {
  console.warn('[ModuleName] DependencyModule not available');
  // Graceful degradation
}

// Required dependency
if (typeof RequiredModule === 'undefined') {
  console.error('[ModuleName] RequiredModule not loaded');
  return;
}
RequiredModule.doSomething();
```

### DOM Query Pattern

```javascript
// 1. Try direct query
let element = document.querySelector(selector);

// 2. Try shadow DOM
if (!element && parent.shadowRoot) {
  element = parent.shadowRoot.querySelector(selector);
}

// 3. Try deep traversal
if (!element) {
  element = queryShadowDOM(selector, parent);
}

// 4. Check existence
if (!element) {
  console.warn(`[ModuleName] Element not found: ${selector}`);
  return null;
}

// 5. Check visibility
if (!isElementVisible(element)) {
  console.warn(`[ModuleName] Element not visible: ${selector}`);
  return null;
}

return element;
```

### Visibility Check Pattern

```javascript
isElementVisible(element) {
  if (!element) return false;

  // Check display/visibility
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

### Shadow DOM Traversal Pattern

```javascript
queryShadowDOM(selector, root = document.body) {
  // Try direct query first
  let element = root.querySelector(selector);
  if (element) return element;

  // Recursively search through shadow roots
  const traverse = (node) => {
    if (node.shadowRoot) {
      const found = node.shadowRoot.querySelector(selector);
      if (found) return found;

      for (const child of node.shadowRoot.children) {
        const result = traverse(child);
        if (result) return result;
      }
    }

    for (const child of node.children) {
      const result = traverse(child);
      if (result) return result;
    }

    return null;
  };

  return traverse(root);
}
```

### Event-Based Communication Pattern

```javascript
// Module A: Dispatch event
document.dispatchEvent(new CustomEvent('dataExtracted', {
  detail: { data: extractedData },
  bubbles: true,
  composed: true
}));

// Module B: Listen for event
document.addEventListener('dataExtracted', (event) => {
  const data = event.detail.data;
  // Process data
});
```

### Retry Pattern (for late-loading elements)

```javascript
async waitForElement(selector, maxAttempts = 20, delayMs = 200) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const element = document.querySelector(selector);
    if (element && this.isElementVisible(element)) {
      return element;
    }
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return null;
}
```

### Debounced Observer Pattern

```javascript
let observerTimeout = null;
const DEBOUNCE_DELAY = 1000;

const observer = new MutationObserver(() => {
  if (observerTimeout) {
    clearTimeout(observerTimeout);
  }

  observerTimeout = setTimeout(() => {
    console.log('[ModuleName] DOM changed, re-checking...');
    this.handleDOMChange();
  }, DEBOUNCE_DELAY);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### Async Initialization Pattern

```javascript
async init() {
  // Wait for dependencies
  await this.waitForDependencies();

  // Load settings
  const settings = await this.loadSettings();

  // Initialize based on settings
  if (settings.enabled) {
    await this.initialize();
  }
}
```

## Redundancies and Inconsistencies

### Identified Redundancies

#### 1. Shadow DOM Traversal Functions
**Location**: `CasePageDataExtractor.queryShadowDOM()`, `CaseDataExtractor` (similar logic)

**Issue**: Multiple modules implement similar shadow DOM traversal logic

**Recommendation**: Extract to shared utility module `ShadowDOMUtils`

**Priority**: Medium

#### 2. Visibility Checking Functions
**Location**: `FlexipagePanelInjector.isElementVisible()`, `CaseTimezoneResolver.isElementVisible()`, `EventSimulator.isVisible()`

**Issue**: Three similar implementations of visibility checking

**Recommendation**: Extract to shared utility module `DOMUtils.isVisible()`

**Priority**: High

#### 3. Text Cleaning Functions
**Location**: `CaseDataExtractor.cleanTextContent()`, `CasePageDataExtractor.cleanTextContent()`

**Issue**: Identical implementations in two modules

**Recommendation**: Extract to shared utility module `TextUtils.cleanTextContent()`

**Priority**: Medium

#### 4. Field Extraction Logic
**Location**: `CaseDataExtractor.getFieldValue()`, `CasePageDataExtractor.getRecordLayoutField()`

**Issue**: Similar logic for extracting field values with slight variations

**Recommendation**: Create unified `FieldExtractor` utility module

**Priority**: Low (variations may be intentional)

#### 5. Case ID Extraction
**Location**: Multiple modules extract case ID from URL

**Issue**: Same regex pattern repeated: `/Case\/([a-zA-Z0-9]{15,18})/`

**Recommendation**: Extract to `URLUtils.getCaseIdFromUrl()`

**Priority**: Low

#### 6. Selector Patterns
**Location**: Similar selector patterns across modules

**Issue**: `records-record-layout-item[field-label="${label}"]` used in multiple places

**Recommendation**: Create selector constants in `SELECTORS.md` and reference them

**Priority**: Low (documentation improvement)

### Identified Inconsistencies

#### 1. Module Export Pattern
**Inconsistency**: Some modules use IIFE pattern, others use object literal

**Examples**:
- IIFE: `CustomerDataManager`, `ContextMenuHandler`, `TimezoneStorage`
- Object: `Logger`, `DebounceUtils`, `TextFormatter`, `FieldHighlighter`

**Impact**: Low - both patterns work, but inconsistent

**Recommendation**: Standardize on object pattern for simpler modules, IIFE for complex ones with private state

**Priority**: Low

#### 2. Error Handling
**Inconsistency**: Some modules log errors, others return null, others throw

**Examples**:
- `CaseDataExtractor`: Returns `null` on error
- `CasePageDataExtractor`: Logs warning and returns `null`
- Some modules: Throw errors

**Recommendation**: Standardize on: log warning + return null/empty for data extraction, throw for critical errors

**Priority**: Medium

#### 3. Logging Format
**Inconsistency**: Different logging prefixes and formats

**Examples**:
- `[EXL] ModuleName: message`
- `[ModuleName] message`
- `console.log('message')` (no prefix)

**Recommendation**: Use consistent format: `[EXL] ModuleName: message`

**Priority**: Low

#### 4. Async vs Sync Functions
**Inconsistency**: Some similar functions are async, others sync

**Examples**:
- `CaseDataExtractor.extractCaseData()` - sync
- `CasePageDataExtractor.extractAllCaseData()` - async

**Recommendation**: Make data extraction async consistently (allows for future async operations)

**Priority**: Low

#### 5. Selector Strategy
**Inconsistency**: Some modules use exact label match, others use partial match

**Examples**:
- `CaseDataExtractor`: Uses partial match `field-label*="${label}"`
- `CasePageDataExtractor`: Tries exact first, then partial

**Recommendation**: Standardize on: try exact first, fallback to partial

**Priority**: Low

#### 6. Initialization Checks
**Inconsistency**: Some modules check `isInitialized` at start, others don't

**Examples**:
- `PersistentBanner.init()`: Checks and returns early
- Some modules: No check, may initialize multiple times

**Recommendation**: Always check `isInitialized` in `init()` methods

**Priority**: Medium

#### 7. Cleanup Implementation
**Inconsistency**: Some modules have comprehensive cleanup, others minimal

**Examples**:
- `FieldHighlighter`: Comprehensive cleanup (observer, timers, highlights)
- Some modules: No cleanup method

**Recommendation**: All modules with observers/timers should implement cleanup

**Priority**: High

## Well-Implemented Functions

### Logger.perfAsync()
**Why it's good**:
- Handles both sync and async functions
- Uses `performance.now()` for accurate timing
- Returns function result unchanged
- Consistent logging format

### DebounceUtils.debounce()
**Why it's good**:
- Supports immediate execution option
- Returns cancel function for manual cancellation
- Properly handles context binding
- Clear timeout management

### TextFormatter.convertToStyle()
**Why it's good**:
- Properly handles multi-byte Unicode characters with `Array.from()`
- Supports multiple style types
- Preserves non-alphabetic characters
- Handles edge cases (empty strings, special characters)

### EventSimulator.click()
**Why it's good**:
- Checks visibility before dispatching
- Checks enabled state
- Uses `composed: true` for Shadow DOM
- Returns boolean for success/failure
- Logs warnings for debugging

### NavigationObserver.start()
**Why it's good**:
- Prevents duplicate observers
- Handles multiple navigation detection methods
- Debounces callback triggers
- Proper cleanup on stop()

### FlexipagePanelInjector.ensureInjected()
**Why it's good**:
- Idempotent (safe to call multiple times)
- Multiple fallback strategies
- Visibility checking
- Proper encapsulation with slot wrapper
- Forces UI refresh

## Lessons Learned

### From Existing Development

1. **Salesforce Lightning is Dynamic**
   - DOM structure changes frequently
   - Use multiple fallback selectors
   - Always check element visibility
   - Handle Shadow DOM properly

2. **SPA Navigation is Tricky**
   - URL changes don't always trigger page reload
   - Use `NavigationObserver` for reliable detection
   - Clean up on navigation to prevent leaks

3. **Performance Matters**
   - Debounce/throttle expensive operations
   - Cache extracted data
   - Limit observer scope
   - Disconnect observers when done

4. **Error Handling is Critical**
   - Never assume elements exist
   - Always check for null/undefined
   - Log errors with context
   - Graceful degradation is better than crashes

5. **Dependency Management**
   - Optional dependencies should be checked
   - Use events for loose coupling
   - Avoid circular dependencies

6. **Testing is Difficult**
   - Salesforce pages are complex
   - Shadow DOM makes testing harder
   - Mock dependencies for unit tests
   - Test with real Salesforce pages

### Common Pitfalls

1. **Forgetting Cleanup**
   - Observers not disconnected
   - Timers not cleared
   - Event listeners not removed
   - **Solution**: Always implement cleanup methods

2. **Assuming Elements Exist**
   - Querying DOM without checks
   - Accessing properties on null
   - **Solution**: Always check element existence

3. **Ignoring Shadow DOM**
   - Direct queries fail
   - Missing nested content
   - **Solution**: Use shadow DOM traversal

4. **Not Handling SPA Navigation**
   - Features break on navigation
   - State not reset
   - **Solution**: Use NavigationObserver

5. **Redundant DOM Queries**
   - Querying same element multiple times
   - No caching
   - **Solution**: Cache frequently used elements

## Refactoring Opportunities

### High Priority

1. **Extract Visibility Checking Utility**
   - Create `DOMUtils.isVisible()` function
   - Replace 3+ implementations
   - **Impact**: Reduces code duplication, improves consistency

2. **Extract Shadow DOM Utility**
   - Create `ShadowDOMUtils.queryShadowDOM()` function
   - Replace duplicate implementations
   - **Impact**: Reduces code duplication

3. **Standardize Cleanup Methods**
   - Add cleanup to all modules with observers/timers
   - Create cleanup checklist
   - **Impact**: Prevents memory leaks

### Medium Priority

4. **Extract Text Cleaning Utility**
   - Create `TextUtils.cleanTextContent()` function
   - Replace duplicate implementations
   - **Impact**: Reduces code duplication

5. **Standardize Error Handling**
   - Create error handling guidelines
   - Refactor modules to follow guidelines
   - **Impact**: Improves consistency, debugging

6. **Extract Field Extraction Utility**
   - Create `FieldExtractor` utility module
   - Unify field extraction logic
   - **Impact**: Reduces duplication, improves maintainability

### Low Priority

7. **Standardize Module Patterns**
   - Choose IIFE vs Object pattern guidelines
   - Refactor modules to follow guidelines
   - **Impact**: Improves consistency

8. **Extract URL Utilities**
   - Create `URLUtils` module for URL parsing
   - Extract case ID, page type detection
   - **Impact**: Reduces duplication

9. **Standardize Logging**
   - Use consistent logging format
   - Create logging utility if needed
   - **Impact**: Improves debugging

## Performance Considerations

### Best Practices

1. **Debounce Expensive Operations**
   - DOM queries in loops
   - Event handlers
   - Observer callbacks
   - **Manifest V3**: Critical for content scripts running on main thread

2. **Cache Frequently Used Data**
   - Extracted case data
   - DOM elements
   - Settings
   - **Manifest V3**: Use `chrome.storage` for persistence across service worker restarts

3. **Limit Observer Scope**
   - Observe specific containers, not entire document
   - Use `subtree: false` when possible
   - **Manifest V3**: Smaller scope reduces performance impact on page

4. **Lazy Initialization**
   - Wait for elements before initializing
   - Initialize features only when needed
   - **Manifest V3**: Reduces initial load time and memory usage

5. **Cleanup Resources**
   - Disconnect observers
   - Clear timers
   - Remove event listeners
   - **Manifest V3**: Prevents memory leaks when service worker restarts

## Manifest V3 Performance Best Practices

### Service Worker Considerations

**Event-Driven Architecture**
- Service workers are event-driven and can be terminated at any time
- Save critical state to `chrome.storage` immediately after operations
- Use `chrome.storage.onChanged` to sync state across service worker restarts
- Avoid long-running operations in event handlers

**Example:**
```javascript
// ❌ BAD: State lost when service worker terminates
let currentState = {};

// ✅ GOOD: Persist state to storage
chrome.storage.local.set({ currentState }, () => {
  console.log('State saved');
});
```

**Termination Handling**
- Service workers terminate after 30 seconds of inactivity (or sooner)
- Use `chrome.runtime.onSuspend` to save final state
- Implement state restoration on `chrome.runtime.onStartup`
- Use alarms for time-based operations instead of `setInterval`

### Content Script Performance

**Avoid Blocking Main Thread**
- Content scripts run on the main thread - blocking operations freeze the page
- Use async/await for all I/O operations
- Batch DOM queries and yield control between batches
- Use `requestIdleCallback` for non-critical operations

**Example:**
```javascript
// ❌ BAD: Blocks main thread with multiple synchronous queries
extractCaseData() {
  const field1 = document.querySelector(selector1);
  const field2 = document.querySelector(selector2);
  const field3 = document.querySelector(selector3);
  // ... 20 more queries
}

// ✅ GOOD: Yield control between batches
async extractCaseData() {
  const batch1 = await this.queryBatch([selector1, selector2, selector3]);
  await new Promise(resolve => setTimeout(resolve, 0)); // Yield
  const batch2 = await this.queryBatch([selector4, selector5, selector6]);
  return { ...batch1, ...batch2 };
}
```

**DOM Operation Batching**
- Group DOM queries together
- Use `requestIdleCallback` for non-urgent DOM reads
- Batch DOM writes to minimize reflows
- Use `DocumentFragment` for multiple DOM insertions

### Storage API Best Practices

**Use Async/Await Over Callbacks**
- Async/await provides better error handling and readability
- Avoid callback hell with nested storage operations
- Use try-catch for error handling

**Example:**
```javascript
// ❌ BAD: Callback pattern
chrome.storage.local.get(['key'], (result) => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    return;
  }
  chrome.storage.local.set({ key: result.key + 1 }, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
    }
  });
});

// ✅ GOOD: Async/await pattern
async function updateStorage() {
  try {
    const result = await chrome.storage.local.get(['key']);
    await chrome.storage.local.set({ key: result.key + 1 });
  } catch (error) {
    console.error('Storage error:', error);
  }
}
```

**Storage Helper Function**
```javascript
// Utility function for async storage operations
const storage = {
  async get(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  },
  async set(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
};
```

### Async vs Sync Analysis

**Current State**
- 23 modules already use async/await patterns
- Some sync operations that could benefit from async conversion
- Storage operations use callbacks (should migrate to async/await)
- 230+ DOM queries across 24 files (mostly synchronous)

**When Async is Beneficial**

1. **DOM Operations with Multiple Queries**
   - `CaseDataExtractor.extractCaseData()` - performs 20+ synchronous DOM queries
   - Should be converted to async with yielding points
   - Use `requestIdleCallback` or `setTimeout(0)` to yield control

2. **Storage Operations**
   - All `chrome.storage` operations should use async/await
   - Current callback pattern in: `persistentBanner.js`, `customerDataManager.js`, `cacheManager.js`
   - Better error handling and code readability

3. **Heavy Text Processing**
   - Large text extraction or formatting operations
   - Use async generators for progressive processing
   - Yield control periodically to prevent blocking

4. **Batch Operations**
   - Multiple independent operations that can run in parallel
   - Use `Promise.all()` for parallel execution
   - Use `Promise.allSettled()` when some failures are acceptable

**When Sync is Fine**

1. **Simple Single DOM Queries**
   - Single `querySelector` for immediate use
   - No performance impact for isolated queries

2. **Synchronous Calculations**
   - Mathematical operations
   - String manipulations
   - Object transformations

3. **Immediate Error Checks**
   - Validation functions
   - Type checking
   - Null/undefined checks

### Specific Recommendations

**1. Convert Storage Callbacks to Async/Await**

**Priority: High**
- Files to update: `persistentBanner.js`, `customerDataManager.js`, `cacheManager.js`
- Create storage utility module with async/await wrapper
- Improves error handling and code readability

**2. Batch DOM Queries with Yielding**

**Priority: High**
- Convert `CaseDataExtractor.extractCaseData()` to async
- Add yielding points between query batches
- Use `requestIdleCallback` for non-critical queries

**Example:**
```javascript
async extractCaseData() {
  const data = {};
  
  // Batch 1: Critical fields
  data.caseNumber = this.getFieldValue(['Case Number']);
  data.subject = this.getFieldValue(['Subject']);
  await new Promise(resolve => setTimeout(resolve, 0)); // Yield
  
  // Batch 2: Secondary fields
  data.description = this.getFieldValue(['Description']);
  data.status = this.getFieldValue(['Status']);
  await new Promise(resolve => setTimeout(resolve, 0)); // Yield
  
  // Batch 3: Optional fields
  data.priority = this.getFieldValue(['Priority']);
  return data;
}
```

**3. Use Async Generators for Large Data Processing**

**Priority: Medium**
- For processing large lists or text extraction
- Yield control periodically
- Progressive enhancement pattern

**Example:**
```javascript
async function* processLargeList(items) {
  for (let i = 0; i < items.length; i++) {
    yield processItem(items[i]);
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0)); // Yield every 10 items
    }
  }
}
```

**4. Implement Progressive Enhancement**

**Priority: Medium**
- Load critical features first
- Defer non-critical features
- Use lazy initialization patterns

**5. Add Yielding Points in Long Operations**

**Priority: Medium**
- Add `await new Promise(resolve => setTimeout(resolve, 0))` in loops
- Yield control every N iterations
- Prevents blocking the main thread

### Memory Management

**Cleanup Patterns**
- Always disconnect `MutationObserver` instances
- Clear all `setTimeout`/`setInterval` timers
- Remove event listeners in cleanup methods
- Null out large object references

**Example:**
```javascript
cleanup() {
  if (this.observer) {
    this.observer.disconnect();
    this.observer = null;
  }
  if (this.timer) {
    clearTimeout(this.timer);
    this.timer = null;
  }
  if (this.element) {
    this.element.removeEventListener('click', this.handler);
    this.element = null;
  }
}
```

### Lazy Loading Strategies

**Initialize Features Only When Needed**
- Don't initialize all features on page load
- Use feature flags to enable/disable features
- Load modules dynamically when features are accessed
- Use `import()` for dynamic module loading (if using modules)

**Example:**
```javascript
async function initializeFeature(featureName) {
  if (!isFeatureEnabled(featureName)) {
    return;
  }
  
  const module = await import(`./modules/${featureName}.js`);
  await module.init();
}
```

### Background Script Limitations

**Service Worker Constraints**
- No persistent global state
- Maximum execution time limits
- Must use `chrome.storage` for persistence
- Use `chrome.alarms` instead of `setInterval`

**Best Practices**
- Keep event handlers short and fast
- Defer heavy work with `setTimeout` or `chrome.alarms`
- Use message passing for communication
- Save state immediately after operations

## Salesforce Lightning & Manifest V3: Proven Patterns

### Shadow DOM Traversal Pattern

**Best Practice: Recursive Shadow DOM Query with Mode Check**

```javascript
/**
 * Query selector across Shadow DOM boundaries (open roots only)
 * @param {string} selector - CSS selector
 * @param {Element} root - Starting element (default: document.body)
 * @returns {Element|null}
 */
function queryShadowDOM(selector, root = document.body) {
  // Try direct query first (fastest path)
  let element = root.querySelector(selector);
  if (element) return element;

  // Recursively search through shadow roots
  const traverse = (node) => {
    // Check current node's shadowRoot (only open roots)
    if (node.shadowRoot && node.shadowRoot.mode === 'open') {
      const found = node.shadowRoot.querySelector(selector);
      if (found) return found;
      
      // Recursively search shadow root's children
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

**Key Points:**
- Always check `shadowRoot.mode === 'open'` before accessing
- Handle both native and synthetic shadow modes
- Use recursive traversal for nested shadow roots
- Start with direct query for performance

### SPA Navigation Detection Pattern

**Best Practice: Multi-Signal Navigation Observer**

```javascript
/**
 * Comprehensive SPA navigation detection for Salesforce Lightning
 * Monitors: title changes, history API, popstate, hash changes
 */
const NavigationObserver = {
  callbacks: [],
  currentUrl: null,
  currentTitle: null,
  debounceTimer: null,
  debounceDelay: 250, // Recommended: 250ms

  start() {
    this.currentUrl = window.location.href;
    this.currentTitle = document.title;
    
    // Signal 1: Title changes (Lightning updates title on navigation)
    const titleElement = document.querySelector('title');
    if (titleElement) {
      const titleObserver = new MutationObserver(() => {
        this.checkNavigation();
      });
      titleObserver.observe(titleElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    // Signal 2: History API interception
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.checkNavigation();
    };
    
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.checkNavigation();
    };

    // Signal 3: Browser back/forward
    window.addEventListener('popstate', () => this.checkNavigation());
    
    // Signal 4: Hash changes
    window.addEventListener('hashchange', () => this.checkNavigation());
  },

  checkNavigation() {
    const newUrl = window.location.href;
    const newTitle = document.title;
    
    if (newUrl !== this.currentUrl || newTitle !== this.currentTitle) {
      this.currentUrl = newUrl;
      this.currentTitle = newTitle;
      this.triggerCallbacks();
    }
  },

  triggerCallbacks() {
    // Debounce to avoid rapid-fire during complex navigations
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.callbacks.forEach(cb => {
        try {
          cb(this.currentUrl);
        } catch (err) {
          console.error('[NavigationObserver] Callback error:', err);
        }
      });
    }, this.debounceDelay);
  },

  onRouteChange(callback) {
    if (typeof callback === 'function') {
      this.callbacks.push(callback);
    }
  }
};
```

**Key Points:**
- Monitor multiple signals (title, URL, history API, popstate)
- Use debouncing (250ms recommended) to handle rapid navigation
- Always cleanup observers and restore original functions
- Handle errors in callbacks gracefully

### Lazy Loading Detection Pattern

**Best Practice: MutationObserver with Debouncing**

```javascript
/**
 * Detect lazy-loaded Lightning components
 * Uses MutationObserver with debouncing for performance
 */
function setupLazyLoadDetection(targetSelector, callback) {
  let debounceTimer = null;
  const debounceDelay = 300; // Wait for mutations to settle
  
  const observer = new MutationObserver((mutations) => {
    // Check if target element appeared
    const element = document.querySelector(targetSelector);
    if (element && element.offsetParent !== null) {
      // Debounce to avoid multiple calls
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        callback(element);
      }, debounceDelay);
    }
  });

  // Observe with subtree for nested components
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false, // Only watch for new nodes
    attributeOldValue: false
  });

  // Check immediately in case element already exists
  const existing = document.querySelector(targetSelector);
  if (existing && existing.offsetParent !== null) {
    callback(existing);
  }

  return observer; // Return for cleanup
}
```

**Key Points:**
- Use `subtree: true` to catch nested lazy-loaded components
- Debounce callbacks to avoid excessive processing
- Check visibility with `offsetParent !== null`
- Always check if element already exists before observing

### Idempotent Injection Pattern

**Best Practice: Check-Before-Inject with Cleanup**

```javascript
/**
 * Idempotent UI injection pattern for Salesforce Lightning
 * Prevents duplicate injections on SPA navigation
 */
function ensureInjected(containerSelector, injectFn, marker = 'exl-injected') {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.warn(`[Injection] Container not found: ${containerSelector}`);
    return false;
  }

  // Check if already injected using data attribute
  if (container.dataset[marker] === 'true') {
    console.log(`[Injection] Already injected, skipping`);
    return true;
  }

  // Check for existing injected elements (fallback)
  const existing = container.querySelector(`[data-${marker}]`);
  if (existing) {
    console.log(`[Injection] Found existing injection, marking container`);
    container.dataset[marker] = 'true';
    return true;
  }

  // Perform injection
  try {
    injectFn(container);
    container.dataset[marker] = 'true';
    console.log(`[Injection] Successfully injected`);
    return true;
  } catch (error) {
    console.error(`[Injection] Failed:`, error);
    return false;
  }
}

// Usage with NavigationObserver
NavigationObserver.onRouteChange((url) => {
  // Cleanup old injections
  const containers = document.querySelectorAll('[data-exl-injected="true"]');
  containers.forEach(container => {
    delete container.dataset.exlInjected;
    // Remove injected elements
    const injected = container.querySelector('[data-exl-injected]');
    if (injected) injected.remove();
  });

  // Re-inject if needed
  const pageInfo = PageIdentifier.identifyPage();
  if (pageInfo.type === 'CASE_PAGE') {
    ensureInjected('flexipage-header', injectPanel);
  }
});
```

**Key Points:**
- Use data attributes to mark injected elements
- Check both container marker and element existence
- Always cleanup on navigation
- Handle errors gracefully

### Element Waiting Pattern with Retry

**Best Practice: Exponential Backoff Retry**

```javascript
/**
 * Wait for element with exponential backoff
 * @param {string} selector - CSS selector
 * @param {Object} options - Configuration
 * @returns {Promise<Element>}
 */
function waitForElement(selector, options = {}) {
  const {
    timeout = 10000, // 10 seconds max
    interval = 100, // Start with 100ms
    maxInterval = 2000, // Max 2 seconds between retries
    root = document.body,
    checkShadow = true
  } = options;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let currentInterval = interval;

    const check = () => {
      // Try regular DOM first
      let element = root.querySelector(selector);
      
      // Try shadow DOM if enabled
      if (!element && checkShadow && typeof queryShadowDOM === 'function') {
        element = queryShadowDOM(selector, root);
      }

      if (element && element.offsetParent !== null) {
        resolve(element);
        return;
      }

      // Check timeout
      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Element not found: ${selector}`));
        return;
      }

      // Exponential backoff
      currentInterval = Math.min(currentInterval * 1.5, maxInterval);
      setTimeout(check, currentInterval);
    };

    check();
  });
}

// Usage
async function extractCaseData() {
  try {
    const caseNumberField = await waitForElement(
      'records-record-layout-item[field-label*="Case Number"]',
      { timeout: 5000, checkShadow: true }
    );
    // Process element...
  } catch (error) {
    console.error('[Extractor] Failed to find element:', error);
  }
}
```

**Key Points:**
- Use exponential backoff to reduce CPU usage
- Check both regular and shadow DOM
- Verify element visibility with `offsetParent`
- Set reasonable timeout limits

### Event Simulation for Lazy Loading

**Best Practice: User-Like Event Simulation**

```javascript
/**
 * Simulate user interaction to trigger lazy loading
 * Uses composed events for shadow DOM crossing
 */
function triggerLazyLoad(element, eventType = 'click') {
  if (!element || element.offsetParent === null) {
    console.warn('[EventSim] Element not visible');
    return false;
  }

  // Create event with composed flag for shadow DOM
  const event = new MouseEvent(eventType, {
    bubbles: true,
    cancelable: true,
    composed: true, // Critical for shadow DOM
    view: window,
    detail: 1
  });

  try {
    element.dispatchEvent(event);
    console.log(`[EventSim] Dispatched ${eventType} on element`);
    return true;
  } catch (error) {
    console.error('[EventSim] Failed to dispatch event:', error);
    return false;
  }
}

// Usage: Trigger tab click to load lazy content
const tabElement = document.querySelector('lightning-tab[data-label="Details"]');
if (tabElement) {
  triggerLazyLoad(tabElement, 'click');
  
  // Wait for content to load
  setTimeout(() => {
    const content = document.querySelector('.tab-content');
    if (content) {
      // Process loaded content
    }
  }, 500);
}
```

**Key Points:**
- Always use `composed: true` for shadow DOM events
- Check element visibility before simulating
- Wait for lazy content to load after triggering
- Never call Salesforce internal APIs directly

### Progressive Enhancement Pattern

**Best Practice: Load Critical Features First**

```javascript
/**
 * Progressive enhancement: Load features based on priority
 */
async function initializeFeatures(pageInfo) {
  // Phase 1: Critical features (immediate)
  await Promise.all([
    initializeCriticalFeature1(),
    initializeCriticalFeature2()
  ]);

  // Phase 2: Important features (after critical)
  if (pageInfo.type === 'CASE_PAGE') {
    await initializeCaseFeatures();
  }

  // Phase 3: Nice-to-have features (lazy load)
  requestIdleCallback(() => {
    initializeOptionalFeatures();
  }, { timeout: 2000 });
}
```

**Key Points:**
- Load critical features first
- Use `Promise.all()` for parallel initialization
- Defer non-critical features with `requestIdleCallback`
- Set timeout for idle callback fallback

## State Management in Manifest V3

### Critical Distinction: Service Workers vs Content Scripts

**Service Worker Context (Background Scripts):**
- Service workers are ephemeral and can terminate at any time
- Global variables in service workers are lost on termination
- **MUST use `chrome.storage` for any state that needs to persist**

**Content Script Context:**
- Content scripts run in the page context and persist for the page lifecycle
- Global variables in content scripts persist across SPA navigation (no page refresh)
- **Global variables ARE acceptable for sharing state between modules in content scripts**
- This is especially important for Single Page Applications (SPAs) like Salesforce Lightning

**The Real Problem:**
The issue is not global variables themselves, but **module loading timing**:
- Modules load asynchronously
- By the time a module loads, the page state may have changed
- Modules need immediate access to current page state without waiting for async storage operations

**Problems with Global Variables:**
```javascript
// ❌ BAD: Global variable in SERVICE WORKER
// background.js (service worker)
let currentState = {}; // Lost when service worker terminates

// ✅ ACCEPTABLE: Global variable in CONTENT SCRIPT for SPA state
// content_script.js
window.ExLibrisExtension = {
  currentPage: null,
  currentCaseId: null,
  caseData: null
}; // Persists across SPA navigation, accessible to all modules
```

### Recommended State Management Patterns

#### 1. Global State Object in Content Scripts (For SPAs)

**Best for:** Sharing current page/view state between modules in SPA environments

```javascript
// ✅ GOOD: Global state object for SPA state management
// In content_script.js (main entry point)
window.ExLibrisExtension = {
  // Current page state (updated immediately on navigation)
  currentPage: null,
  currentCaseId: null,
  currentUrl: null,
  
  // Case data (shared between modules)
  caseData: null,
  
  // Settings (loaded once, shared)
  settings: null,
  
  // Module registry (for modules to register themselves)
  modules: {},
  
  // Event bus for state changes
  events: {
    emit(event, data) {
      // Implementation
    },
    on(event, handler) {
      // Implementation
    }
  }
};

// Modules can immediately access current state
if (window.ExLibrisExtension && window.ExLibrisExtension.currentCaseId) {
  const caseId = window.ExLibrisExtension.currentCaseId;
  // Use caseId immediately, no async wait needed
}
```

**Key Points:**
- **Content scripts persist across SPA navigation** - global state remains valid
- Modules can access state immediately without async operations
- Critical for fast SPA navigation where modules load asynchronously
- State is lost on full page refresh (expected behavior)
- Use `chrome.storage` for persistence across page refreshes if needed

**Real-World Example from Your Codebase:**
```javascript
// content_script_exlibris.js
const ExLibrisExtension = {
  currentPage: null,
  currentCaseId: null,
  caseToolkit: {
    caseData: null,
    metadata: null
  }
};

// Modules access immediately:
if (window.ExLibrisExtension && window.ExLibrisExtension.caseToolkit.caseData) {
  // Use data immediately - no async wait
}
```

#### 2. Module-Scoped Variables (IIFE Pattern)

**Best for:** Module-internal state that doesn't need to be shared

```javascript
// ✅ GOOD: Module-scoped variables for internal state
const MyModule = (function() {
  'use strict';
  
  // Private module state (not global, not accessible outside)
  let isInitialized = false;
  let internalCache = null;
  
  return {
    init() {
      if (isInitialized) return;
      isInitialized = true;
      // ...
    },
    
    getData() {
      return internalCache;
    }
  };
})();
```

**Key Points:**
- Variables are scoped to the module, not global
- No pollution of global namespace
- Works well for module-internal state
- State is lost on page reload (use storage if persistence needed)

#### 2. Chrome Storage API (Persistent State)

**Best for:** State that needs to persist across sessions or be shared between contexts

```javascript
// ✅ GOOD: Persistent state with chrome.storage
const StateManager = {
  async getState() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['appState'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.appState || {});
        }
      });
    });
  },
  
  async setState(state) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ appState: state }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
};

// Usage
const state = await StateManager.getState();
state.currentCaseId = '12345';
await StateManager.setState(state);
```

**Storage Types:**
- `chrome.storage.local` - Persistent, unlimited (within quota)
- `chrome.storage.sync` - Synced across devices, limited to 100KB
- `chrome.storage.session` - In-memory, cleared on browser close (MV3+)

#### 3. Event-Based Communication

**Best for:** Sharing state changes between modules without tight coupling

```javascript
// ✅ GOOD: Event-based state synchronization
const StateEventBus = {
  listeners: new Map(),
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  },
  
  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[StateEventBus] Error in callback:`, err);
      }
    });
  },
  
  off(event, callback) {
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
};

// Module A: Emit state change
StateEventBus.emit('caseDataChanged', { caseId: '123', data: {...} });

// Module B: Listen for state change
StateEventBus.on('caseDataChanged', (data) => {
  console.log('Case data updated:', data);
});
```

#### 4. Chrome Storage Change Events (Cross-Context Sync)

**Best for:** Synchronizing state between service worker, content scripts, and popup

```javascript
// ✅ GOOD: Listen for storage changes across contexts
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.appState) {
    const newState = changes.appState.newValue;
    const oldState = changes.appState.oldValue;
    
    console.log('State changed:', { newState, oldState });
    
    // Update local state
    updateLocalState(newState);
  }
});

// In another context (service worker or content script)
async function updateState(newState) {
  await chrome.storage.local.set({ appState: newState });
  // All listeners in all contexts will be notified
}
```

#### 5. Message Passing (Cross-Context Communication)

**Best for:** Requesting state from other contexts (service worker ↔ content script)

```javascript
// ✅ GOOD: Request state via message passing
// In content script
async function getStateFromServiceWorker() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'GET_STATE' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      }
    );
  });
}

// In service worker (background.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    chrome.storage.local.get(['appState'], (result) => {
      sendResponse({ state: result.appState || {} });
    });
    return true; // Keep channel open for async response
  }
});
```

### State Management Best Practices

#### DO's

1. **Use Module-Scoped Variables for Internal State**
   ```javascript
   const MyModule = (function() {
     let internalState = {}; // ✅ OK: Module-scoped
     return { /* public API */ };
   })();
   ```

2. **Use Chrome Storage for Persistent State**
   ```javascript
   // ✅ OK: Persistent across sessions
   await chrome.storage.local.set({ myState: data });
   ```

3. **Use Events for Loose Coupling**
   ```javascript
   // ✅ OK: Modules communicate via events
   EventBus.emit('stateChanged', newState);
   ```

4. **Use Storage Change Events for Cross-Context Sync**
   ```javascript
   // ✅ OK: All contexts stay in sync
   chrome.storage.onChanged.addListener(handleStateChange);
   ```

5. **Use Message Passing for Cross-Context Requests**
   ```javascript
   // ✅ OK: Request state from other contexts
   const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
   ```

#### DON'Ts

1. **Don't Use Global Variables in Service Workers**
   ```javascript
   // ❌ BAD: Global variable in SERVICE WORKER
   // background.js (service worker)
   let sharedState = {}; // Lost when service worker terminates
   
   // ✅ GOOD: Use chrome.storage in service workers
   await chrome.storage.local.set({ sharedState: {} });
   ```

2. **Don't Rely on In-Memory State in Service Workers**
   ```javascript
   // ❌ BAD: Lost when service worker terminates
   // background.js
   let serviceWorkerState = {};
   
   // ✅ GOOD: Use chrome.storage
   await chrome.storage.local.set({ state: {} });
   ```

3. **Don't Use Global Variables for Cross-Context State (Service Worker ↔ Content Script)**
   ```javascript
   // ❌ BAD: Service worker can't access content script globals
   // content_script.js
   window.myState = {}; // Not accessible from service worker
   
   // ✅ GOOD: Use chrome.storage for cross-context state
   await chrome.storage.local.set({ myState: {} });
   ```

3. **Don't Create Circular Dependencies**
   ```javascript
   // ❌ BAD: Module A depends on Module B, Module B depends on Module A
   ```

4. **Don't Forget to Clean Up Event Listeners**
   ```javascript
   // ❌ BAD: Memory leak
   EventBus.on('event', handler); // Never removed
   
   // ✅ GOOD: Clean up
   EventBus.on('event', handler);
   // Later...
   EventBus.off('event', handler);
   ```

### State Management Pattern Examples

#### Pattern 1: Centralized State Manager

```javascript
/**
 * Centralized state manager using chrome.storage
 * Provides single source of truth for extension state
 */
const AppStateManager = {
  async getState() {
    const result = await chrome.storage.local.get(['appState']);
    return result.appState || this.getDefaultState();
  },
  
  async setState(updates) {
    const currentState = await this.getState();
    const newState = { ...currentState, ...updates };
    await chrome.storage.local.set({ appState: newState });
    
    // Notify listeners
    this.notifyListeners(newState, currentState);
  },
  
  listeners: [],
  
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) this.listeners.splice(index, 1);
    };
  },
  
  notifyListeners(newState, oldState) {
    this.listeners.forEach(cb => {
      try {
        cb(newState, oldState);
      } catch (err) {
        console.error('[AppStateManager] Listener error:', err);
      }
    });
  },
  
  getDefaultState() {
    return {
      currentCaseId: null,
      settings: {},
      cache: {}
    };
  }
};

// Listen for storage changes (cross-context sync)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.appState) {
    AppStateManager.notifyListeners(
      changes.appState.newValue,
      changes.appState.oldValue
    );
  }
});
```

#### Pattern 2: Module State with Storage Sync

```javascript
/**
 * Module with local state that syncs to storage
 */
const MyModule = (function() {
  'use strict';
  
  let localState = {}; // Module-scoped state
  let storageKey = 'myModuleState';
  
  async function loadFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get([storageKey], (result) => {
        if (result[storageKey]) {
          localState = result[storageKey];
        }
        resolve(localState);
      });
    });
  }
  
  async function saveToStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [storageKey]: localState }, () => {
        resolve();
      });
    });
  }
  
  return {
    async init() {
      await loadFromStorage();
    },
    
    getState() {
      return { ...localState }; // Return copy
    },
    
    async updateState(updates) {
      localState = { ...localState, ...updates };
      await saveToStorage();
    }
  };
})();
```

#### Pattern 3: Event-Driven State Updates

```javascript
/**
 * Event-driven state management
 * Modules emit events when state changes
 */
const StateEventSystem = {
  events: new Map(),
  
  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(handler);
  },
  
  off(event, handler) {
    const handlers = this.events.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) handlers.splice(index, 1);
  },
  
  emit(event, data) {
    const handlers = this.events.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error(`[StateEventSystem] Error in ${event} handler:`, err);
      }
    });
  }
};

// Module A: Emit state change
StateEventSystem.emit('caseDataUpdated', { caseId: '123', data: {...} });

// Module B: React to state change
StateEventSystem.on('caseDataUpdated', (data) => {
  updateUI(data);
});
```

### Summary: When to Use What

| Pattern | Context | Use Case | Persistence | Cross-Context |
|---------|---------|----------|-------------|---------------|
| **Global state object** | Content Script | SPA state sharing (current page, case data) | Until page refresh | No (content script only) |
| Module-scoped variables | Content Script | Internal module state | No | No |
| `chrome.storage.local` | Any | Persistent state | Yes | Via `onChanged` |
| `chrome.storage.sync` | Any | User preferences | Yes | Via `onChanged` |
| `chrome.storage.session` | Any | Session-only state | No | Via `onChanged` |
| Event bus | Content Script | Loose coupling in same context | No | No |
| Message passing | Any | Cross-context requests | No | Yes |
| Storage change events | Any | Cross-context sync | Yes | Yes |

### Solving the Real Problem: Module Loading Timing in SPAs

**The Actual Issue:**
Modules load asynchronously, but SPA navigation happens instantly. By the time a module loads, the page state may have changed.

**Solution 1: Immediate State Access via Global Object**
```javascript
// ✅ GOOD: Module can access state immediately
// Module loads and immediately checks current state
if (window.ExLibrisExtension && window.ExLibrisExtension.currentCaseId) {
  const caseId = window.ExLibrisExtension.currentCaseId;
  // Process immediately - no async wait
  processCase(caseId);
} else {
  // State not ready yet, wait for it
  waitForState();
}
```

**Solution 2: State Initialization Before Module Loading**
```javascript
// ✅ GOOD: Initialize state object immediately, update asynchronously
// In content_script.js (runs first)
window.ExLibrisExtension = {
  currentPage: null,
  currentCaseId: null,
  isInitialized: false
};

// Update state immediately on navigation (synchronous)
NavigationObserver.onRouteChange((url) => {
  window.ExLibrisExtension.currentUrl = url;
  window.ExLibrisExtension.currentCaseId = extractCaseId(url);
  window.ExLibrisExtension.currentPage = identifyPage(url);
  // State is now immediately available to all modules
});

// Modules can access state immediately when they load
```

**Solution 3: Hybrid Approach (Global + Storage)**
```javascript
// ✅ GOOD: Global for immediate access, storage for persistence
window.ExLibrisExtension = {
  // Immediate state (updated synchronously)
  currentCaseId: null,
  currentPage: null,
  
  // Load persisted state asynchronously
  async init() {
    const stored = await chrome.storage.local.get(['lastCaseId']);
    if (stored.lastCaseId) {
      this.lastCaseId = stored.lastCaseId;
    }
  },
  
  // Save to storage for persistence
  async saveState() {
    await chrome.storage.local.set({
      lastCaseId: this.currentCaseId
    });
  }
};
```

### Evidence from Real-World Implementations

**GitHub Examples:**
1. **Vite Vue 3 Browser Extension (MV3)**: Uses global state object in content scripts for SPA state management
2. **React Chrome Extension Boilerplate**: Uses global context for sharing state between content script modules
3. **Your Current Implementation**: Uses `window.ExLibrisExtension` for sharing case data and page state

**Official Chrome Documentation:**
- Content scripts run in page context and persist across SPA navigation
- Global variables in content scripts are valid for the page lifecycle
- The "no global variables" guidance applies specifically to **service workers**, not content scripts

## Timezone Conversion Best Practices

### DO's

1. **Use Intl.DateTimeFormat for Timezone Conversions**
   - ✅ **DO** use `Intl.DateTimeFormat` for accurate timezone conversions
   - ✅ **DO** let the browser handle DST transitions automatically
   - ✅ **DO** use `formatToParts()` when you need individual date/time components
   - Example:
     ```javascript
     const formatter = new Intl.DateTimeFormat('en-US', {
       timeZone: 'Asia/Singapore',
       year: 'numeric',
       month: '2-digit',
       day: '2-digit',
       hour: '2-digit',
       minute: '2-digit'
     });
     const formatted = formatter.format(date);
     ```

2. **Always Provide Timezone Fallbacks**
   - ✅ **DO** provide UTC as a universal fallback
   - ✅ **DO** check for timezone availability before using it
   - ✅ **DO** log warnings when falling back to UTC
   - Example:
     ```javascript
     let timezone = resolvedTimezone || 'UTC';
     if (timezone === 'UTC') {
       console.warn('[Module] Using UTC fallback');
     }
     ```

3. **Resolve Timezones with Priority Order**
   - ✅ **DO** use priority-based resolution: cached > lookup > fallback
   - ✅ **DO** cache resolved timezones to avoid repeated lookups
   - ✅ **DO** handle async timezone resolution properly
   - Example:
     ```javascript
     // Priority: TimezoneStorage > InstitutionTimezoneManager > UTC
     let timezone = await TimezoneStorage.getTimezone(identifiers);
     if (!timezone) {
       timezone = InstitutionTimezoneManager.getTimezone(identifiers);
     }
     if (!timezone) {
       timezone = 'UTC'; // Fallback
     }
     ```

4. **Parse Dates Carefully**
   - ✅ **DO** handle multiple date formats (Salesforce has various formats)
   - ✅ **DO** validate parsed dates before using them
   - ✅ **DO** use try-catch when parsing dates
   - Example:
     ```javascript
     function parseDate(dateString) {
       try {
         const date = new Date(dateString);
         if (isNaN(date.getTime())) {
           // Try alternative formats
           return parseAlternativeFormat(dateString);
         }
         return date;
       } catch (error) {
         console.warn('[Module] Date parsing failed:', error);
         return null;
       }
     }
     ```

5. **Format Timezone Names for Display**
   - ✅ **DO** provide human-readable timezone names
   - ✅ **DO** show timezone abbreviations (SGT, MYT, EST, etc.)
   - ✅ **DO** indicate auto-detection with "(auto)" label
   - Example:
     ```javascript
     const displayName = getTimezoneDisplayName(timezone);
     const abbreviation = getTimezoneAbbreviation(timezone, date);
     const label = `${displayName} (${abbreviation})${isAuto ? ' (auto)' : ''}`;
     ```

### DON'Ts

1. **Don't Manually Calculate Timezone Offsets**
   - ❌ **DON'T** manually calculate UTC offsets (DST breaks this)
   - ❌ **DON'T** assume fixed offset values
   - ❌ **DON'T** use `getTimezoneOffset()` for conversions (it's for local timezone only)
   - Bad:
     ```javascript
     // WRONG - doesn't handle DST
     const offset = 8; // hours
     const converted = new Date(date.getTime() + (offset * 60 * 60 * 1000));
     ```
   - Good:
     ```javascript
     // CORRECT - handles DST automatically
     const formatter = new Intl.DateTimeFormat('en-US', {
       timeZone: 'Asia/Singapore',
       hour: '2-digit',
       minute: '2-digit'
     });
     const converted = formatter.format(date);
     ```

2. **Don't Store Dates as Strings Without Timezone Info**
   - ❌ **DON'T** store dates as "YYYY-MM-DD HH:MM" without timezone
   - ❌ **DON'T** assume dates are in a specific timezone
   - ✅ **DO** store dates as ISO strings or Date objects
   - ✅ **DO** include timezone information when displaying

3. **Don't Ignore Timezone Resolution Failures**
   - ❌ **DON'T** silently fail when timezone resolution fails
   - ❌ **DON'T** show incorrect timezone information
   - ✅ **DO** log warnings when resolution fails
   - ✅ **DO** show UTC as fallback with clear indication

4. **Don't Block UI on Async Timezone Resolution**
   - ❌ **DON'T** block UI rendering while resolving timezones
   - ✅ **DO** show loading state or default values
   - ✅ **DO** update UI when timezone resolution completes
   - Example:
     ```javascript
     // Show default, then update
     showTimezone('UTC', 'Resolving...');
     const resolved = await resolveTimezone();
     showTimezone(resolved.timezone, resolved.displayName);
     ```

### Common Patterns

1. **Timezone Resolution Pattern**
   ```javascript
   async function resolveTimezone(identifiers) {
     // Try cached first
     const cached = await TimezoneStorage.getTimezone(identifiers);
     if (cached) return cached;
     
     // Try lookup
     const lookedUp = InstitutionTimezoneManager.getTimezone(identifiers);
     if (lookedUp) return lookedUp;
     
     // Fallback to UTC
     return { timezone: 'UTC', displayName: 'UTC', source: 'fallback' };
   }
   ```

2. **Date Conversion Pattern**
   ```javascript
   function convertToTimezone(date, timezone) {
     try {
       const formatter = new Intl.DateTimeFormat('en-US', {
         timeZone: timezone,
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
         hour: '2-digit',
         minute: '2-digit'
       });
       return formatter.format(date);
     } catch (error) {
       console.error('[Module] Conversion failed:', error);
       return date.toISOString(); // Fallback
     }
   }
   ```

3. **Multiple Timezone Display Pattern**
   ```javascript
   function displayAllTimezones(date, caseTz, userTz) {
     return {
       case: formatForTimezone(date, caseTz),
       user: formatForTimezone(date, userTz),
       utc: formatForTimezone(date, 'UTC')
     };
   }
   ```

### Edge Cases to Handle

1. **DST Transitions**
   - Browser's `Intl.DateTimeFormat` handles DST automatically
   - Don't try to manually adjust for DST
   - Test with dates during DST transitions

2. **Invalid Timezones**
   - Always validate timezone strings (IANA format)
   - Provide fallback for invalid timezones
   - Log warnings for invalid timezone usage

3. **Missing Date Data**
   - Handle cases where dates are not available
   - Show "N/A" or disable options gracefully
   - Don't break UI when dates are missing

4. **Rapid Navigation**
   - Timezone resolution may be in progress when user navigates
   - Cancel pending resolutions on navigation
   - Update UI when resolution completes (even if on different case)

**Location**: `timezoneConverter.js`, `dynamicMenu.js` (createTimezoneConverter)

## Cache Management Best Practices

### Critical Issues in SPA Environments

**The Problem:**
In Single Page Applications (SPAs) like Salesforce Lightning, cache operations can suffer from:
1. **Race Conditions**: Multiple modules extracting/saving simultaneously
2. **Stale Data Pollution**: Data from one case saved with another case's ID
3. **Timing Issues**: Cache operations happening during page navigation
4. **Signature Mismatch**: Signatures built from wrong page state
5. **Async Storage Conflicts**: Multiple saves overwriting each other

### Cache Data Integrity Principles

#### 1. Always Validate Case ID Before Caching

**Problem:**
```javascript
// ❌ BAD: No validation - data from Case A could be saved with Case B's ID
async set(caseId, data) {
  const signature = buildSignature(); // From current DOM
  memoryCache.set(caseId, { signature, data });
  await persistToStorage();
}
```

**Solution:**
```javascript
// ✅ GOOD: Validate case ID matches current page
async set(caseId, data) {
  // Validate case ID matches current page
  const currentCaseId = extractCaseIdFromUrl();
  if (caseId !== currentCaseId) {
    console.warn(`[CacheManager] Case ID mismatch: ${caseId} !== ${currentCaseId}, skipping cache`);
    return;
  }
  
  // Validate data contains matching case ID
  if (data.caseId && data.caseId !== caseId) {
    console.warn(`[CacheManager] Data case ID mismatch: ${data.caseId} !== ${caseId}`);
    return;
  }
  
  // Build signature from the data being cached, not current DOM
  const signature = buildSignatureFromData(data);
  
  memoryCache.set(caseId, { signature, data, timestamp: Date.now() });
  await persistToStorage();
}
```

#### 2. Build Signatures from Data, Not DOM

**Problem:**
```javascript
// ❌ BAD: Signature from current DOM (may be wrong case)
async get(caseId) {
  const cached = memoryCache.get(caseId);
  const currentSignature = buildSignature(); // From current DOM - wrong!
  if (cached.signature === currentSignature) {
    return cached.data;
  }
  return null;
}
```

**Solution:**
```javascript
// ✅ GOOD: Build signature from cached data, validate against current page
async get(caseId) {
  // Validate we're on the correct case page
  const currentCaseId = extractCaseIdFromUrl();
  if (caseId !== currentCaseId) {
    console.warn(`[CacheManager] Requested case ${caseId} but on case ${currentCaseId}`);
    return null;
  }
  
  const cached = memoryCache.get(caseId);
  if (!cached) return null;
  
  // Build signature from current page state
  const currentSignature = buildSignature();
  
  // Compare signatures
  if (cached.signature === currentSignature) {
    return cached.data;
  }
  
  // Signature mismatch - cache is stale
  console.log(`[CacheManager] Cache invalid: signature mismatch`);
  return null;
}

// Build signature from data object (for saving)
function buildSignatureFromData(data) {
  return [
    data.status || '',
    data.subStatus || '',
    data.category || '',
    data.subCategory || '',
    data.analysisNote || ''
  ].map(v => v.toLowerCase()).join('|');
}
```

#### 3. Implement Cache Locking to Prevent Race Conditions

**Problem:**
```javascript
// ❌ BAD: Multiple modules can extract/save simultaneously
async getCaseData(caseId) {
  const cached = await CacheManager.get(caseId);
  if (cached) return cached;
  
  // Multiple modules might extract simultaneously here
  const data = await CaseDataExtractor.getData();
  await CacheManager.set(caseId, data); // Race condition!
  return data;
}
```

**Solution:**
```javascript
// ✅ GOOD: Lock mechanism prevents concurrent operations
const CacheManager = (function() {
  const extractionLocks = new Map(); // caseId -> Promise
  
  return {
    async get(caseId) {
      // Check if extraction is in progress
      if (extractionLocks.has(caseId)) {
        console.log(`[CacheManager] Extraction in progress for ${caseId}, waiting...`);
        await extractionLocks.get(caseId);
        // Re-check cache after extraction completes
        return memoryCache.get(caseId)?.data || null;
      }
      
      // Normal cache lookup
      const cached = memoryCache.get(caseId);
      if (cached && this.isValid(cached, caseId)) {
        return cached.data;
      }
      return null;
    },
    
    async set(caseId, data) {
      // Validate case ID
      const currentCaseId = extractCaseIdFromUrl();
      if (caseId !== currentCaseId) {
        console.warn(`[CacheManager] Case ID mismatch, skipping cache`);
        return;
      }
      
      // Create lock if not exists
      if (!extractionLocks.has(caseId)) {
        extractionLocks.set(caseId, Promise.resolve());
      }
      
      const signature = buildSignatureFromData(data);
      memoryCache.set(caseId, { signature, data, timestamp: Date.now() });
      
      // Debounced save to storage
      await this.debouncedPersist();
    },
    
    async extractWithLock(caseId, extractFn) {
      // Check if already extracting
      if (extractionLocks.has(caseId)) {
        return await extractionLocks.get(caseId);
      }
      
      // Create extraction promise
      const extractionPromise = (async () => {
        try {
          const data = await extractFn();
          if (data && data.caseId === caseId) {
            await this.set(caseId, data);
          }
          return data;
        } finally {
          extractionLocks.delete(caseId);
        }
      })();
      
      extractionLocks.set(caseId, extractionPromise);
      return await extractionPromise;
    }
  };
})();
```

#### 4. Debounce Storage Persistence

**Problem:**
```javascript
// ❌ BAD: Every set() triggers immediate storage write
async set(caseId, data) {
  memoryCache.set(caseId, entry);
  await persistToStorage(); // Immediate write - can cause race conditions
}
```

**Solution:**
```javascript
// ✅ GOOD: Debounced persistence batches writes
const CacheManager = (function() {
  let persistTimer = null;
  const PERSIST_DEBOUNCE_MS = 500;
  
  return {
    async set(caseId, data) {
      // Update memory cache immediately
      memoryCache.set(caseId, entry);
      
      // Debounce storage persistence
      this.debouncedPersist();
    },
    
    debouncedPersist() {
      clearTimeout(persistTimer);
      persistTimer = setTimeout(async () => {
        await this.persistToStorage();
      }, PERSIST_DEBOUNCE_MS);
    },
    
    async persistToStorage() {
      const cacheData = {};
      memoryCache.forEach((entry, caseId) => {
        cacheData[caseId] = entry;
      });
      await saveToStorage(cacheData);
    }
  };
})();
```

#### 5. Validate Data Before Caching

**Problem:**
```javascript
// ❌ BAD: No validation - incomplete or wrong data can be cached
async set(caseId, data) {
  memoryCache.set(caseId, { data, timestamp: Date.now() });
}
```

**Solution:**
```javascript
// ✅ GOOD: Validate data integrity before caching
async set(caseId, data) {
  // Validate required fields
  if (!this.isValidData(data, caseId)) {
    console.warn(`[CacheManager] Invalid data for case ${caseId}, skipping cache`);
    return;
  }
  
  // Ensure case ID matches
  if (data.caseId && data.caseId !== caseId) {
    console.warn(`[CacheManager] Data case ID mismatch`);
    return;
  }
  
  // Normalize data
  const normalizedData = this.normalizeData(data, caseId);
  
  memoryCache.set(caseId, {
    signature: buildSignatureFromData(normalizedData),
    data: normalizedData,
    timestamp: Date.now()
  });
  
  await this.debouncedPersist();
},

isValidData(data, caseId) {
  // Check required fields
  if (!data || typeof data !== 'object') return false;
  if (!data.caseId && !caseId) return false;
  
  // Check for minimum required data
  const hasMinimumData = data.caseNumber || data.subject || data.status;
  return hasMinimumData;
},

normalizeData(data, caseId) {
  return {
    ...data,
    caseId: data.caseId || caseId, // Ensure case ID is set
    timestamp: Date.now() // Add extraction timestamp
  };
}
```

#### 6. Implement Cache Invalidation to Prevent Stale Data

**Problem:**
```javascript
// ❌ BAD: Cache never invalidates - returns stale data when case is modified
async handlePageChange(pageInfo) {
  if (this.currentCaseId === caseId && this.lastExtractedData) {
    return; // Always returns cached data, even if case was modified
  }
  // ... extraction logic
}
```

**Solution:**
```javascript
// ✅ GOOD: Multi-layered cache invalidation
const CasePageDataExtractor = {
  // Cache TTL constant
  CACHE_TTL_MS: 30000, // 30 seconds
  
  async handlePageChange(pageInfo) {
    const caseId = pageInfo.caseId;
    
    // Check if cache is valid (not just if it exists)
    const cacheValidation = this.isCacheValid(caseId);
    if (cacheValidation.valid) {
      console.log('[CasePageDataExtractor] Using cached data:', cacheValidation.reason);
      return;
    } else {
      console.log('[CasePageDataExtractor] Cache invalid, re-extracting:', cacheValidation.reason);
      this.lastExtractedData = null; // Clear stale cache
    }
    
    // Proceed with extraction...
  },
  
  isCacheValid(caseId) {
    // 1. Check if we have cached data for this case
    if (!this.lastExtractedData || this.currentCaseId !== caseId) {
      return { valid: false, reason: 'No cached data for this case' };
    }
    
    // 2. Check TTL (Time-To-Live)
    const now = Date.now();
    const extractedAt = new Date(this.lastExtractedData.extractedAt).getTime();
    if (now - extractedAt > this.CACHE_TTL_MS) {
      return { valid: false, reason: `Cache expired (TTL: ${this.CACHE_TTL_MS}ms)` };
    }
    
    // 3. Check Last Modified Date (primary validation)
    const currentLastModified = this.getLastModifiedDate();
    const cachedLastModified = this.lastExtractedData.lastModifiedDate;
    
    if (currentLastModified && cachedLastModified) {
      const normalizedCurrent = this.normalizeDate(currentLastModified);
      const normalizedCached = this.normalizeDate(cachedLastModified);
      
      if (normalizedCurrent !== normalizedCached) {
        return { valid: false, reason: 'Case was modified (Last Modified Date changed)' };
      }
    }
    
    // 4. Field-level change detection (secondary validation)
    const fieldValidation = this.validateCriticalFields();
    if (!fieldValidation.valid) {
      return { valid: false, reason: fieldValidation.reason };
    }
    
    return { valid: true, reason: 'Cache is valid' };
  },
  
  validateCriticalFields() {
    // Check critical fields that might change without Last Modified Date updating
    const criticalFields = [
      { name: 'asset', extractor: () => this.getFlexipageField('RecordAsset_Line_Item_cField', true) },
      { name: 'status', extractor: () => this.getRecordLayoutField('Status') },
      { name: 'pageStatus', extractor: () => this.getFlexipageField('RecordStatusField', false) },
      { name: 'category', extractor: () => this.getRecordLayoutField('Category') }
    ];
    
    for (const field of criticalFields) {
      const currentValue = field.extractor();
      const cachedValue = this.lastExtractedData[field.name];
      
      if (currentValue !== null && cachedValue !== null) {
        const normalizedCurrent = typeof currentValue === 'string' ? currentValue.trim() : currentValue;
        const normalizedCached = typeof cachedValue === 'string' ? cachedValue.trim() : cachedValue;
        
        if (normalizedCurrent !== normalizedCached) {
          return { 
            valid: false, 
            reason: `Critical field changed: ${field.name} (${normalizedCached} → ${normalizedCurrent})` 
          };
        }
      }
    }
    
    return { valid: true, reason: 'Critical fields unchanged' };
  },
  
  // Extract Last Modified Date for cache validation
  getLastModifiedDate() {
    const field = document.querySelector('records-record-layout-item[field-label*="Last Modified"]');
    if (field) {
      const value = field.querySelector('.test-id__field-value, lightning-formatted-text, lightning-formatted-date-time');
      return value ? value.textContent.trim() : null;
    }
    return null;
  },
  
  // Normalize date strings for comparison
  normalizeDate(dateString) {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString.trim();
      }
      return date.toISOString();
    } catch (error) {
      return dateString.trim();
    }
  },
  
  // Force re-extraction (bypass cache)
  async extractNow(force = false) {
    if (force) {
      this.lastExtractedData = null; // Clear cache
    }
    // ... extraction logic
  },
  
  // Manual cache clearing
  clearCache(caseId = null) {
    if (caseId && this.currentCaseId === caseId) {
      this.lastExtractedData = null;
    } else if (!caseId && this.currentCaseId) {
      this.lastExtractedData = null;
    }
  }
};
```

**Key Principles:**
1. **Multi-layered Validation**: Use TTL, Last Modified Date, and field-level checks
2. **Primary vs Secondary**: Last Modified Date is primary, field-level is secondary for rapid changes
3. **Graceful Degradation**: If Last Modified Date unavailable, rely on TTL and field-level checks
4. **Force Option**: Provide `extractNow(true)` to bypass cache when needed
5. **Clear Logging**: Log cache validation reasons for debugging

**Cache Invalidation Strategies:**
- **Last Modified Date** (Primary) - Most reliable indicator of case changes
- **TTL** (Secondary) - Fallback if Last Modified Date unavailable, ensures data freshness
- **Field-level Detection** (Tertiary) - Catches rapid changes that might not update Last Modified Date immediately
- **Force flag** (Manual) - For explicit re-extraction when user suspects stale data
```

#### 6. Handle Navigation During Cache Operations

**Problem:**
```javascript
// ❌ BAD: Cache operations continue during navigation
async getCaseData(caseId) {
  const cached = await CacheManager.get(caseId); // Might be from old page
  if (!cached) {
    const data = await CaseDataExtractor.getData(); // Extracting from wrong page
    await CacheManager.set(caseId, data);
  }
}
```

**Solution:**
```javascript
// ✅ GOOD: Check navigation state before cache operations
async getCaseData(caseId) {
  // Validate we're still on the correct page
  const currentCaseId = extractCaseIdFromUrl();
  if (caseId !== currentCaseId) {
    console.warn(`[CacheManager] Navigation detected: ${caseId} -> ${currentCaseId}`);
    return null;
  }
  
  const cached = await CacheManager.get(caseId);
  if (cached) return cached;
  
  // Re-validate before extraction
  const stillOnCase = extractCaseIdFromUrl();
  if (stillOnCase !== caseId) {
    console.warn(`[CacheManager] Navigated away during extraction`);
    return null;
  }
  
  const data = await CaseDataExtractor.getData();
  
  // Final validation before caching
  if (extractCaseIdFromUrl() === caseId && data.caseId === caseId) {
    await CacheManager.set(caseId, data);
  }
  
  return data;
}
```

### Complete Cache Pattern for SPAs

```javascript
/**
 * Production-ready cache manager for SPA environments
 */
const CacheManager = (function() {
  'use strict';
  
  const STORAGE_KEY = 'caseCacheData';
  const CACHE_VERSION = 2;
  const MAX_CACHE_AGE_DAYS = 30;
  const PERSIST_DEBOUNCE_MS = 500;
  
  let memoryCache = new Map();
  let extractionLocks = new Map();
  let persistTimer = null;
  let isInitialized = false;
  
  /**
   * Extract case ID from current URL
   */
  function extractCaseIdFromUrl() {
    const match = window.location.pathname.match(/Case\/([a-zA-Z0-9]{15,18})/);
    return match ? match[1] : null;
  }
  
  /**
   * Build signature from data object
   */
  function buildSignatureFromData(data) {
    return [
      data.status || '',
      data.subStatus || '',
      data.category || '',
      data.subCategory || '',
      data.analysisNote || ''
    ].map(v => (v || '').toLowerCase().trim()).join('|');
  }
  
  /**
   * Validate data integrity
   */
  function isValidData(data, caseId) {
    if (!data || typeof data !== 'object') return false;
    if (data.caseId && data.caseId !== caseId) return false;
    return !!(data.caseNumber || data.subject || data.status);
  }
  
  /**
   * Normalize data before caching
   */
  function normalizeData(data, caseId) {
    return {
      ...data,
      caseId: data.caseId || caseId,
      extractedAt: Date.now()
    };
  }
  
  return {
    /**
     * Get cached data with validation
     */
    async get(caseId) {
      if (!isInitialized) await this.init();
      if (!caseId) return null;
      
      // Validate we're on the correct case page
      const currentCaseId = extractCaseIdFromUrl();
      if (caseId !== currentCaseId) {
        console.warn(`[CacheManager] Case ID mismatch: ${caseId} !== ${currentCaseId}`);
        return null;
      }
      
      // Check if extraction is in progress
      if (extractionLocks.has(caseId)) {
        console.log(`[CacheManager] Extraction in progress, waiting...`);
        await extractionLocks.get(caseId);
        const cached = memoryCache.get(caseId);
        return cached?.data || null;
      }
      
      const cached = memoryCache.get(caseId);
      if (!cached) return null;
      
      // Validate signature against current page
      const currentSignature = buildSignatureFromData(cached.data);
      if (cached.signature === currentSignature) {
        return cached.data;
      }
      
      // Signature mismatch - invalidate
      memoryCache.delete(caseId);
      return null;
    },
    
    /**
     * Set cached data with validation
     */
    async set(caseId, data) {
      if (!isInitialized) await this.init();
      if (!caseId || !data) return;
      
      // Validate case ID matches current page
      const currentCaseId = extractCaseIdFromUrl();
      if (caseId !== currentCaseId) {
        console.warn(`[CacheManager] Case ID mismatch, skipping cache`);
        return;
      }
      
      // Validate data integrity
      if (!isValidData(data, caseId)) {
        console.warn(`[CacheManager] Invalid data, skipping cache`);
        return;
      }
      
      // Normalize and cache
      const normalizedData = normalizeData(data, caseId);
      const signature = buildSignatureFromData(normalizedData);
      
      memoryCache.set(caseId, {
        signature,
        data: normalizedData,
        timestamp: Date.now()
      });
      
      // Debounced persistence
      this.debouncedPersist();
    },
    
    /**
     * Extract with lock to prevent race conditions
     */
    async extractWithLock(caseId, extractFn) {
      // Check if already extracting
      if (extractionLocks.has(caseId)) {
        return await extractionLocks.get(caseId);
      }
      
      // Create extraction promise
      const extractionPromise = (async () => {
        try {
          // Re-validate case ID before extraction
          const currentCaseId = extractCaseIdFromUrl();
          if (currentCaseId !== caseId) {
            console.warn(`[CacheManager] Navigated away before extraction`);
            return null;
          }
          
          const data = await extractFn();
          
          // Validate after extraction
          if (data && data.caseId === caseId && extractCaseIdFromUrl() === caseId) {
            await this.set(caseId, data);
          }
          
          return data;
        } finally {
          extractionLocks.delete(caseId);
        }
      }).bind(this)();
      
      extractionLocks.set(caseId, extractionPromise);
      return await extractionPromise;
    },
    
    /**
     * Debounced persistence to storage
     */
    debouncedPersist() {
      clearTimeout(persistTimer);
      persistTimer = setTimeout(async () => {
        await this.persistToStorage();
      }, PERSIST_DEBOUNCE_MS);
    },
    
    /**
     * Persist memory cache to storage
     */
    async persistToStorage() {
      const cacheData = {};
      memoryCache.forEach((entry, caseId) => {
        cacheData[caseId] = entry;
      });
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({
          [STORAGE_KEY]: cacheData,
          cacheVersion: CACHE_VERSION
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
  };
})();
```

### Usage Pattern

```javascript
// ✅ GOOD: Use extractWithLock to prevent race conditions
async function getCaseData(caseId) {
  // Check cache first
  const cached = await CacheManager.get(caseId);
  if (cached) return cached;
  
  // Extract with lock (prevents concurrent extractions)
  const data = await CacheManager.extractWithLock(caseId, async () => {
    return await CaseDataExtractor.getData();
  });
  
  return data;
}
```

### Key Takeaways

1. **Always validate case ID** before caching operations
2. **Build signatures from data**, not current DOM
3. **Use locks** to prevent concurrent extractions
4. **Debounce storage writes** to batch operations
5. **Validate data integrity** before caching
6. **Check navigation state** during async operations
7. **Normalize data** before caching for consistency

### Cache and Global State Integration

**See [CACHE_GLOBAL_STATE_INTEGRATION_PLAN.md](CACHE_GLOBAL_STATE_INTEGRATION_PLAN.md) for comprehensive integration strategy.**

**Quick Reference:**

**When to Use Global Variables:**
- Current page state (caseId, pageType) - immediate access needed
- Temporary processing state (isExtracting flags)
- Session-only UI state

**When to Use Cache:**
- Validated, complete case data
- Data that needs persistence across sessions
- Data requiring signature validation

**Cache Acceptance Criteria:**
1. ✅ Case ID validated (format + matches current page + matches data)
2. ✅ Case number validated (format + matches current page + matches data)
3. ✅ Data integrity verified (contains required fields)
4. ✅ Identifier consensus (URL, DOM, and data all agree)
5. ✅ Page state validated (still on same case, no navigation)
6. ✅ No concurrent operations (extraction locks checked)

**Extraction Responsibility:**
- **Extraction Modules**: Extract data, include identifiers, normalize
- **Cache Manager**: Validate identifiers, verify integrity, handle storage
- **Controller**: Orchestrate extraction → validation → caching flow

## Tab Detection and Nested Case Page Detection

### Tab Detection Best Practices

**Critical for Salesforce Lightning:** Case pages have multiple tabs (Details, Communication, Related, Files, History, Reporting Fields), and detecting the active tab is essential for:
- Extracting data from the correct tab
- Injecting UI in the right location
- Avoiding operations on hidden/inactive tabs

#### Best Practice: Use Stable Attributes + Semantic Classes

**Principle:** Use `data-label` attributes (semantic contract) combined with `slds-is-active` class (state indicator).

```javascript
/**
 * ✅ BEST: Check if a specific tab is active using stable attributes
 * @param {string} tabLabel - The 'data-label' of the tab (e.g., "Details", "Communication")
 * @returns {boolean} True if the tab is found and is active
 */
function isTabActive(tabLabel) {
  // 1. Select using stable 'data-label' attribute (semantic contract)
  const tabElement = document.querySelector(`li[data-label="${tabLabel}"]`);
  
  // 2. Check state using semantic class 'slds-is-active' (single source of truth)
  if (tabElement) {
    return tabElement.classList.contains('slds-is-active');
  }
  
  return false;
}

/**
 * ✅ BEST: Get the currently active tab label
 * @returns {string|null} The label of the active tab
 */
function getActiveTabLabel() {
  // 1. Select element with active state class
  const activeTab = document.querySelector('.slds-tabs_default__item.slds-is-active');
  
  // 2. Read stable 'data-label' attribute
  if (activeTab) {
    return activeTab.dataset.label || activeTab.getAttribute('data-label');
  }
  
  return null;
}

// Usage
console.log('Is Details active?', isTabActive('Details'));
console.log('Active tab:', getActiveTabLabel());
```

**Why This Approach is Best:**
- `data-label` is a semantic contract - unlikely to change
- `slds-is-active` is the component's state indicator
- Works across Lightning updates
- No dependency on text content (translation-safe)
- No dependency on position (order-safe)

#### Alternative Approaches (When data-label Not Available)

**Fallback 1: aria-selected + title attribute**
```javascript
/**
 * ✅ GOOD: Fallback using aria-selected and title
 */
function getActiveTabLabelFallback() {
  const activeTab = document.querySelector('a[role="tab"][aria-selected="true"]');
  if (activeTab) {
    // Prefer title over textContent (more stable)
    return activeTab.title || activeTab.textContent?.trim();
  }
  return null;
}
```

**Fallback 2: Component-specific detection**
```javascript
/**
 * ✅ GOOD: Detect tab by component presence
 */
function detectTabByComponents() {
  // Details tab indicators
  if (document.querySelector('records-lwc-detail-panel') || 
      document.querySelector('force-record-layout-item')) {
    return 'details';
  }
  
  // Communication tab indicators
  if (document.querySelector('runtime_sales_activities-activity-panel') ||
      document.querySelector('[data-component-id*="Communication"]')) {
    return 'communication';
  }
  
  // Files tab indicators
  if (document.querySelector('runtime_sales_files-file-preview') ||
      document.querySelector('[data-component-id*="Files"]')) {
    return 'files';
  }
  
  return null;
}
```

#### Current Implementation Issues

**❌ FRAGILE: Current approach in PageIdentifier**
```javascript
// Current implementation (FRAGILE)
detectCasePageView() {
  const activeTab = document.querySelector('a[role="tab"][aria-selected="true"]');
  if (activeTab) {
    const tabText = activeTab.textContent?.trim().toLowerCase();
    // Text matching is fragile - breaks on translation, formatting changes
    if (tabText?.includes('detail')) return 'details';
  }
}
```

**Problems:**
- Relies on text content (breaks on translation)
- No fallback if aria-selected not available
- Text matching is case-sensitive and fragile

**✅ RECOMMENDED: Improved implementation**
```javascript
/**
 * ✅ IMPROVED: Robust tab detection with multiple strategies
 */
detectCasePageView() {
  // Strategy 1: Use data-label + slds-is-active (BEST)
  const activeTabByDataLabel = document.querySelector('.slds-tabs_default__item.slds-is-active');
  if (activeTabByDataLabel) {
    const label = activeTabByDataLabel.dataset.label;
    if (label) {
      return this.normalizeTabLabel(label);
    }
  }
  
  // Strategy 2: Use aria-selected + title (FALLBACK)
  const activeTabByAria = document.querySelector('a[role="tab"][aria-selected="true"]');
  if (activeTabByAria) {
    const title = activeTabByAria.title || activeTabByAria.textContent?.trim();
    if (title) {
      return this.normalizeTabLabel(title);
    }
  }
  
  // Strategy 3: Component-based detection (FALLBACK)
  return this.detectTabByComponents();
},

normalizeTabLabel(label) {
  const normalized = label.toLowerCase().trim();
  const mappings = {
    'details': 'details',
    'communication': 'communication',
    'communications': 'communication',
    'related': 'related',
    'files': 'files',
    'file': 'files',
    'attachments': 'files',
    'history': 'history',
    'reporting fields': 'reporting_fields',
    'reporting': 'reporting_fields'
  };
  
  return mappings[normalized] || normalized;
}
```

### Nested Case Page Detection

**The Problem:**
Salesforce Lightning can display another case page within the current case page (e.g., in Related tab, parent case links, or embedded components). This creates ambiguity:
- Which case ID should be used?
- Which case data should be extracted?
- Which case should be cached?

#### Detection Strategy: Multi-Level Case ID Detection

```javascript
/**
 * ✅ BEST: Detect all case IDs in the current page context
 * @returns {Object} { primary: string, nested: string[], all: string[] }
 */
function detectAllCaseIds() {
  const caseIds = {
    primary: null,    // Case ID from main URL
    nested: [],       // Case IDs from nested/embedded pages
    all: []           // All unique case IDs found
  };
  
  // 1. Primary case ID from URL (most reliable)
  const urlMatch = window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})/);
  if (urlMatch) {
    caseIds.primary = urlMatch[1];
    caseIds.all.push(urlMatch[1]);
  }
  
  // 2. Detect nested case IDs from DOM
  // Look for case links, case references, embedded case components
  const caseSelectors = [
    'a[href*="/Case/"]',
    'lightning-formatted-url[value*="/Case/"]',
    'force-lookup[data-field-name*="Case"]',
    '[data-case-id]',
    '[data-record-id]' // May contain case IDs
  ];
  
  const foundCaseIds = new Set();
  
  caseSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      // Extract case ID from href
      if (el.href) {
        const match = el.href.match(/\/Case\/([a-zA-Z0-9]{15,18})/);
        if (match && match[1] !== caseIds.primary) {
          foundCaseIds.add(match[1]);
        }
      }
      
      // Extract from data attributes
      const caseId = el.dataset.caseId || el.dataset.recordId;
      if (caseId && /^[a-zA-Z0-9]{15,18}$/.test(caseId) && caseId !== caseIds.primary) {
        foundCaseIds.add(caseId);
      }
      
      // Extract from value attribute
      if (el.value) {
        const match = el.value.match(/\/Case\/([a-zA-Z0-9]{15,18})/);
        if (match && match[1] !== caseIds.primary) {
          foundCaseIds.add(match[1]);
        }
      }
    });
  });
  
  caseIds.nested = Array.from(foundCaseIds);
  caseIds.all = [...new Set([caseIds.primary, ...caseIds.nested].filter(Boolean))];
  
  return caseIds;
}
```

#### Determining Which Case to Operate On

**Principle:** Always operate on the primary case (from URL), not nested cases.

```javascript
/**
 * ✅ BEST: Determine the case to operate on
 * @returns {Object} { caseId: string, isPrimary: boolean, context: string }
 */
function determineOperatingCase() {
  const allCases = detectAllCaseIds();
  
  // Always use primary case ID from URL
  if (allCases.primary) {
    return {
      caseId: allCases.primary,
      isPrimary: true,
      context: 'main_page',
      nestedCases: allCases.nested
    };
  }
  
  // Fallback: If no primary, check if we're in an iframe/embedded context
  if (window.self !== window.top) {
    // We're in an iframe - try to get case ID from parent
    try {
      const parentCaseId = window.parent.document.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})/);
      if (parentCaseId) {
        return {
          caseId: parentCaseId[1],
          isPrimary: false,
          context: 'nested_iframe',
          nestedCases: []
        };
      }
    } catch (e) {
      // Cross-origin iframe - cannot access parent
    }
  }
  
  return {
    caseId: null,
    isPrimary: false,
    context: 'unknown',
    nestedCases: []
  };
}
```

#### Validation: Ensure We're Operating on Primary Case

```javascript
/**
 * ✅ BEST: Validate that extracted data matches primary case
 * @param {string} extractedCaseId - Case ID from extracted data
 * @param {Object} data - Extracted case data
 * @returns {boolean} True if data matches primary case
 */
function validatePrimaryCaseData(extractedCaseId, data) {
  const operatingCase = determineOperatingCase();
  
  // Must match primary case ID
  if (extractedCaseId !== operatingCase.caseId) {
    console.warn(`[Validation] Extracted case ID ${extractedCaseId} does not match primary ${operatingCase.caseId}`);
    return false;
  }
  
  // Data must contain matching case ID
  if (data.caseId && data.caseId !== operatingCase.caseId) {
    console.warn(`[Validation] Data case ID ${data.caseId} does not match primary ${operatingCase.caseId}`);
    return false;
  }
  
  // Check if we're on a tab that might show nested cases
  const activeTab = getActiveTabLabel();
  if (activeTab === 'related' && operatingCase.nestedCases.length > 0) {
    console.warn(`[Validation] On Related tab with nested cases - ensure data is from primary case`);
    // Additional validation: Check if data fields match primary case context
  }
  
  return true;
}
```

### Complete Tab Detection Pattern

```javascript
/**
 * ✅ PRODUCTION-READY: Complete tab detection with all strategies
 */
const TabDetector = {
  /**
   * Get active tab using best practices
   */
  getActiveTab() {
    // Strategy 1: data-label + slds-is-active (BEST)
    const activeByDataLabel = document.querySelector('.slds-tabs_default__item.slds-is-active');
    if (activeByDataLabel?.dataset.label) {
      return this.normalizeTabLabel(activeByDataLabel.dataset.label);
    }
    
    // Strategy 2: aria-selected + title
    const activeByAria = document.querySelector('a[role="tab"][aria-selected="true"]');
    if (activeByAria) {
      const label = activeByAria.title || activeByAria.textContent?.trim();
      if (label) {
        return this.normalizeTabLabel(label);
      }
    }
    
    // Strategy 3: Component-based detection
    return this.detectByComponents();
  },
  
  /**
   * Check if specific tab is active
   */
  isTabActive(tabLabel) {
    const normalizedLabel = this.normalizeTabLabel(tabLabel);
    const activeTab = this.getActiveTab();
    return activeTab === normalizedLabel;
  },
  
  /**
   * Detect tab by component presence
   */
  detectByComponents() {
    if (document.querySelector('records-lwc-detail-panel, force-record-layout-item')) {
      return 'details';
    }
    if (document.querySelector('runtime_sales_activities-activity-panel, [data-component-id*="Communication"]')) {
      return 'communication';
    }
    if (document.querySelector('runtime_sales_files-file-preview, [data-component-id*="Files"]')) {
      return 'files';
    }
    if (document.querySelector('[data-component-id*="Related"]')) {
      return 'related';
    }
    return null;
  },
  
  /**
   * Normalize tab label to standard format
   */
  normalizeTabLabel(label) {
    const normalized = (label || '').toLowerCase().trim();
    const mappings = {
      'details': 'details',
      'communication': 'communication',
      'communications': 'communication',
      'related': 'related',
      'files': 'files',
      'file': 'files',
      'attachments': 'files',
      'history': 'history',
      'reporting fields': 'reporting_fields',
      'reporting': 'reporting_fields'
    };
    return mappings[normalized] || normalized;
  }
};
```

### Anti-Patterns to Avoid

```javascript
// ❌ BAD: Relies on auto-generated class
document.querySelector('.lwc-72usf2nsemu.slds-is-active');

// ❌ BAD: Relies on position
document.querySelector('li:nth-child(1).slds-is-active');

// ❌ BAD: Relies on text content (breaks on translation)
document.querySelector('a:contains("Details")');

// ❌ BAD: Relies on auto-generated ID
document.querySelector('#detailTab__item');

// ❌ BAD: No validation of nested cases
const caseId = extractCaseIdFromUrl(); // Might be nested case!
```

### Key Takeaways

1. **Use `data-label` + `slds-is-active`** for tab detection (most reliable)
2. **Always validate case ID** matches primary case from URL
3. **Detect nested cases** but operate only on primary case
4. **Use multiple fallback strategies** for robustness
5. **Normalize tab labels** for consistent comparison
6. **Avoid text-based matching** (translation issues)
7. **Avoid position-based selectors** (order changes)
8. **Check active tab before operations** to ensure correct context

### Selecting Visible Elements on Dynamic Lightning Pages

**Core Principle:** Salesforce Lightning pages are dynamic. Many components exist in DOM simultaneously, but only one is visible. Always use a two-step process: **Identify page context first, then select visible elements.**

#### Step 1: Identify Page Context (Title & URL)

**Best Practice:** Use `document.title` and `window.location.href` as the primary method for page identification. This is faster and more reliable than complex DOM queries.

```javascript
/**
 * ✅ BEST: Identify page context using title and URL
 * @returns {Object|null} { caseNumber: string, caseId: string } or null
 */
function getCurrentCaseContext() {
  const pageTitle = document.title;
  const currentURL = window.location.href;
  
  // Handle loading state
  if (pageTitle === 'Lightning Experience') {
    console.warn('[PageContext] Page is still loading');
    return null;
  }
  
  // Extract case ID from URL (most reliable)
  const caseIdMatch = currentURL.match(/\/Case\/([a-zA-Z0-9]{15,18})\//);
  if (!caseIdMatch) {
    return null;
  }
  
  // Extract case number from title
  const titleParts = pageTitle.split(' | ');
  if (titleParts[1] === 'Case' && caseIdMatch) {
    const caseNumber = titleParts[0];
    const caseId = caseIdMatch[1];
    
    console.log(`[PageContext] Confirmed: Case ${caseNumber} (${caseId})`);
    return { caseNumber, caseId };
  }
  
  return null;
}
```

**Why This Approach:**
- `document.title` is fast and reliable (browser API)
- `window.location.href` provides unique record ID
- Works even when DOM is still loading
- Less brittle than DOM queries
- Can detect page loading state

#### Step 2: Select Visible Elements from DOM

**Best Practice:** Chain stable SLDS classes with explicit visibility checks.

**Selector Formula:**
```
[Visible Tab] > [Visible Component Layout] > [Stable Target Class]
```

```javascript
/**
 * ✅ BEST: Select visible case title using chained stable selectors
 * @returns {string|null} Case title text or null
 */
function getCaseTitleFromDOM() {
  // Chain: Active tab > Visible layout > Stable classes > Target element
  const selector = `
    section.tabContent.active 
    .forcegenerated-record-layout2[style*="display: block"] 
    div.highlights.slds-page-header_record-home 
    .slds-page-header__title 
    lightning-formatted-text
  `.replace(/\s+/g, ' ').trim();
  
  const caseTitleElement = document.querySelector(selector);
  if (caseTitleElement) {
    return caseTitleElement.textContent?.trim() || null;
  }
  
  return null;
}
```

**Selector Breakdown:**
1. `section.tabContent.active` - Active tab panel (visibility check)
2. `.forcegenerated-record-layout2[style*="display: block"]` - Visible layout component (visibility check)
3. `div.highlights.slds-page-header_record-home` - Stable SLDS class for highlights panel
4. `.slds-page-header__title` - Stable SLDS class for title area
5. `lightning-formatted-text` - Target web component

#### Visibility Check Strategies

**Strategy 1: Active Class Check**
```javascript
// ✅ GOOD: Check for .active class
const activeTab = document.querySelector('section.tabContent.active');
```

**Strategy 2: Inline Style Check**
```javascript
// ✅ GOOD: Check for display: block in inline style
const visibleLayout = document.querySelector('.forcegenerated-record-layout2[style*="display: block"]');
```

**Strategy 3: ARIA Attributes**
```javascript
// ✅ GOOD: Check ARIA state attributes
const visiblePanel = document.querySelector('[aria-hidden="false"]');
const expandedSection = document.querySelector('[aria-expanded="true"]');
```

**Strategy 4: Combined Visibility Checks**
```javascript
// ✅ BEST: Combine multiple visibility indicators
const visibleElement = document.querySelector(`
  section.tabContent.active[style*="display: block"]
  .slds-page-header[aria-hidden="false"]
`);
```

#### Complete Pattern: Identify → Select → Validate

```javascript
/**
 * ✅ PRODUCTION-READY: Complete pattern for selecting visible elements
 */
async function getCaseDataFromVisiblePage() {
  // Step 1: Identify page context (fast, reliable)
  const context = getCurrentCaseContext();
  if (!context) {
    console.warn('[ElementSelection] Not on a valid case page');
    return null;
  }
  
  // Step 2: Wait for page to fully load (if needed)
  if (document.title === 'Lightning Experience') {
    await waitForPageLoad();
    // Re-check context after load
    const reloadedContext = getCurrentCaseContext();
    if (!reloadedContext || reloadedContext.caseId !== context.caseId) {
      console.warn('[ElementSelection] Page changed during load');
      return null;
    }
  }
  
  // Step 3: Select visible elements using chained selectors
  const caseTitle = getCaseTitleFromDOM();
  
  // Step 4: Validate extracted data matches context
  if (caseTitle && !caseTitle.includes(context.caseNumber)) {
    console.warn('[ElementSelection] Title does not match case number');
    // May be nested case - validate further
  }
  
  return {
    caseId: context.caseId,
    caseNumber: context.caseNumber,
    title: caseTitle
  };
}

function waitForPageLoad() {
  return new Promise((resolve) => {
    if (document.title !== 'Lightning Experience') {
      resolve();
      return;
    }
    
    const observer = new MutationObserver(() => {
      if (document.title !== 'Lightning Experience') {
        observer.disconnect();
        resolve();
      }
    });
    
    observer.observe(document.querySelector('title'), {
      childList: true,
      subtree: true
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 5000);
  });
}
```

#### Anti-Patterns: What NOT to Do

```javascript
// ❌ BAD: Using dynamic/generated classes
const element = document.querySelector('.lwc-3mmmrd7j9v4.slds-page-header__title');
// Will break on next page load

// ❌ BAD: Relying on position
const element = document.querySelector('div:nth-child(3) .title');
// Breaks if order changes

// ❌ BAD: No visibility check
const element = document.querySelector('.slds-page-header__title');
// May select hidden element from inactive tab

// ❌ BAD: Querying DOM before page identification
const element = document.querySelector('.case-title');
// May be on wrong page or wrong case

// ❌ BAD: Using text content for selection
const element = Array.from(document.querySelectorAll('div'))
  .find(el => el.textContent.includes('Case Number'));
// Fragile, breaks on translation
```

#### Best Practices Summary

**DO:**
1. ✅ Use `document.title` and `window.location.href` for page identification
2. ✅ Chain stable SLDS classes with visibility checks
3. ✅ Start from widest stable container, drill down to target
4. ✅ Check for `.active` class on tab panels
5. ✅ Use `[style*="display: block"]` for inline style visibility
6. ✅ Use ARIA attributes (`[aria-hidden="false"]`, `[aria-expanded="true"]`)
7. ✅ Verify page context before DOM queries
8. ✅ Handle page loading state (`document.title === 'Lightning Experience'`)

**DON'T:**
1. ❌ Use dynamic/generated classes (`lwc-*`, `forcegenerated-*`)
2. ❌ Rely on element position (`nth-child`)
3. ❌ Select without visibility checks
4. ❌ Query DOM before verifying page context
5. ❌ Use text content for element selection

### Stale Data Prevention: Validation Before Display

**Critical Issue:** Navigation observers may fail to capture all navigation changes, especially rapid navigations or edge cases. Modules must validate that the current page still matches the data they're about to display.

#### Best Practice: Always Validate Before Displaying Data

**Principle:** Before displaying any case data to the user, validate that:
1. Current page case ID matches data case ID
2. Current page case number matches data case number
3. Page context hasn't changed (not navigated away)

```javascript
/**
 * ✅ BEST: Validate page context before displaying data
 * @param {string} dataCaseId - Case ID from data to display
 * @param {string} dataCaseNumber - Case number from data to display
 * @returns {Object} { valid: boolean, reason: string, currentContext: Object }
 */
function validatePageContextBeforeDisplay(dataCaseId, dataCaseNumber) {
  // Step 1: Get current page context (fast, reliable)
  const currentContext = getCurrentCaseContext();
  
  if (!currentContext) {
    return {
      valid: false,
      reason: 'Not on a valid case page',
      currentContext: null
    };
  }
  
  // Step 2: Validate case ID matches
  if (dataCaseId && dataCaseId !== currentContext.caseId) {
    console.warn(`[Validation] Case ID mismatch: data=${dataCaseId}, current=${currentContext.caseId}`);
    return {
      valid: false,
      reason: `Case ID mismatch: ${dataCaseId} !== ${currentContext.caseId}`,
      currentContext
    };
  }
  
  // Step 3: Validate case number matches
  if (dataCaseNumber && dataCaseNumber !== currentContext.caseNumber) {
    console.warn(`[Validation] Case number mismatch: data=${dataCaseNumber}, current=${currentContext.caseNumber}`);
    return {
      valid: false,
      reason: `Case number mismatch: ${dataCaseNumber} !== ${currentContext.caseNumber}`,
      currentContext
    };
  }
  
  // Step 4: Double-check page is still loading (may have changed)
  if (document.title === 'Lightning Experience') {
    return {
      valid: false,
      reason: 'Page is still loading',
      currentContext
    };
  }
  
  // All validations passed
  return {
    valid: true,
    reason: 'Context validated',
    currentContext
  };
}

/**
 * ✅ BEST: Safe data display with validation
 * @param {Object} data - Data to display
 * @param {Function} displayFn - Function to display data
 */
function safeDisplayCaseData(data, displayFn) {
  // Validate before displaying
  const validation = validatePageContextBeforeDisplay(data.caseId, data.caseNumber);
  
  if (!validation.valid) {
    console.warn(`[SafeDisplay] Cannot display data: ${validation.reason}`);
    // Optionally show user-friendly message
    return false;
  }
  
  // Safe to display
  displayFn(data);
  return true;
}
```

#### Enhanced Page Context Detection

**Improvement:** Use both title and URL for reliable context detection.

```javascript
/**
 * ✅ IMPROVED: Enhanced page context detection with title + URL validation
 * @returns {Object|null} { caseId: string, caseNumber: string, caseTitle: string }
 */
function getCurrentCaseContext() {
  const pageTitle = document.title;
  const currentURL = window.location.href;
  
  // Handle loading state
  if (pageTitle === 'Lightning Experience') {
    return null;
  }
  
  // Extract case ID from URL (most reliable)
  const caseIdMatch = currentURL.match(/\/Case\/([a-zA-Z0-9]{15,18})\//);
  if (!caseIdMatch) {
    return null;
  }
  
  const caseId = caseIdMatch[1];
  
  // Extract case number from title
  // Format: "00001026 | Case | Salesforce" or "00001026 - Subject | Case | Salesforce"
  const titleParts = pageTitle.split(' | ');
  if (titleParts[1] !== 'Case') {
    return null;
  }
  
  // Case number is first part (may include subject)
  const firstPart = titleParts[0].trim();
  const caseNumberMatch = firstPart.match(/^(\d{6,10})/);
  const caseNumber = caseNumberMatch ? caseNumberMatch[1] : null;
  
  // Extract full title (case number + subject)
  const caseTitle = firstPart;
  
  if (caseId && caseNumber) {
    return {
      caseId,
      caseNumber,
      caseTitle,
      url: currentURL,
      title: pageTitle
    };
  }
  
  return null;
}
```

#### Module Display Pattern: Validate → Display

**Best Practice:** Every module that displays case data should validate before displaying.

```javascript
/**
 * ✅ PRODUCTION-READY: Module display pattern with stale data prevention
 */
const MyModule = {
  displayedCaseId: null,
  displayedCaseNumber: null,
  
  /**
   * Display case data with validation
   */
  async displayCaseData(data) {
    // Step 1: Validate page context
    const validation = validatePageContextBeforeDisplay(data.caseId, data.caseNumber);
    
    if (!validation.valid) {
      console.warn(`[MyModule] Cannot display: ${validation.reason}`);
      this.clearDisplay(); // Clear stale data
      return false;
    }
    
    // Step 2: Check if we're displaying the same data (avoid redundant updates)
    if (this.displayedCaseId === data.caseId && 
        this.displayedCaseNumber === data.caseNumber) {
      console.log('[MyModule] Already displaying this data');
      return true;
    }
    
    // Step 3: Update display
    this.updateUI(data);
    this.displayedCaseId = data.caseId;
    this.displayedCaseNumber = data.caseNumber;
    
    return true;
  },
  
  /**
   * Periodic validation check (safety net)
   */
  startPeriodicValidation() {
    // Check every 2 seconds if displayed data is still valid
    this.validationInterval = setInterval(() => {
      if (this.displayedCaseId || this.displayedCaseNumber) {
        const validation = validatePageContextBeforeDisplay(
          this.displayedCaseId,
          this.displayedCaseNumber
        );
        
        if (!validation.valid) {
          console.warn('[MyModule] Periodic validation failed, clearing display');
          this.clearDisplay();
        }
      }
    }, 2000);
  },
  
  clearDisplay() {
    // Clear UI
    this.updateUI(null);
    this.displayedCaseId = null;
    this.displayedCaseNumber = null;
  }
};
```

### Improved Navigation Observer for Manifest V3

**Current Issues:**
- Only monitors URL changes
- Doesn't validate case ID/case number
- May miss rapid navigations
- No title-based validation

**Improved Implementation:**

```javascript
/**
 * ✅ IMPROVED: Enhanced NavigationObserver for Manifest V3
 */
const NavigationObserver = {
  callbacks: [],
  currentUrl: null,
  currentTitle: null,
  currentCaseId: null,
  currentCaseNumber: null,
  debounceTimer: null,
  debounceDelay: 250,
  titleObserver: null,
  urlObserver: null,
  isRunning: false,
  originalPushState: null,
  originalReplaceState: null,
  
  /**
   * Start observing with enhanced detection
   */
  start() {
    if (this.isRunning) {
      console.warn('[NavigationObserver] Already running');
      return;
    }
    
    this.currentUrl = window.location.href;
    this.currentTitle = document.title;
    this.updateCaseContext();
    this.isRunning = true;
    
    // Signal 1: Title changes (Lightning updates title on navigation)
    const titleElement = document.querySelector('title');
    if (titleElement) {
      this.titleObserver = new MutationObserver(() => {
        this.checkNavigation();
      });
      
      this.titleObserver.observe(titleElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    
    // Signal 2: History API interception
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;
    
    const self = this;
    
    history.pushState = function(...args) {
      self.originalPushState.apply(history, args);
      self.checkNavigation();
    };
    
    history.replaceState = function(...args) {
      self.originalReplaceState.apply(history, args);
      self.checkNavigation();
    };
    
    // Signal 3: Browser back/forward
    window.addEventListener('popstate', () => this.checkNavigation());
    
    // Signal 4: Hash changes
    window.addEventListener('hashchange', () => this.checkNavigation());
    
    // Signal 5: DOM mutations (fallback for missed navigations)
    this.urlObserver = new MutationObserver(() => {
      // Check if URL or title changed via DOM mutation
      const newUrl = window.location.href;
      const newTitle = document.title;
      
      if (newUrl !== this.currentUrl || newTitle !== this.currentTitle) {
        this.checkNavigation();
      }
    });
    
    // Observe document for changes (lightweight, debounced)
    this.urlObserver.observe(document.body, {
      childList: true,
      subtree: false, // Only direct children to reduce overhead
      attributes: false
    });
    
    console.log('[NavigationObserver] Started with enhanced detection');
  },
  
  /**
   * Update case context from current page
   */
  updateCaseContext() {
    const context = getCurrentCaseContext();
    if (context) {
      this.currentCaseId = context.caseId;
      this.currentCaseNumber = context.caseNumber;
    } else {
      this.currentCaseId = null;
      this.currentCaseNumber = null;
    }
  },
  
  /**
   * Check if navigation occurred
   */
  checkNavigation() {
    const newUrl = window.location.href;
    const newTitle = document.title;
    const newContext = getCurrentCaseContext();
    
    // Check URL change
    const urlChanged = newUrl !== this.currentUrl;
    
    // Check title change
    const titleChanged = newTitle !== this.currentTitle;
    
    // Check case context change
    const caseIdChanged = newContext?.caseId !== this.currentCaseId;
    const caseNumberChanged = newContext?.caseNumber !== this.currentCaseNumber;
    
    // Navigation detected if any indicator changed
    if (urlChanged || titleChanged || caseIdChanged || caseNumberChanged) {
      console.log('[NavigationObserver] Navigation detected:', {
        urlChanged,
        titleChanged,
        caseIdChanged,
        caseNumberChanged,
        from: { url: this.currentUrl, caseId: this.currentCaseId },
        to: { url: newUrl, caseId: newContext?.caseId }
      });
      
      this.currentUrl = newUrl;
      this.currentTitle = newTitle;
      this.updateCaseContext();
      this.triggerCallbacks();
    }
  },
  
  /**
   * Trigger callbacks with context information
   */
  triggerCallbacks() {
    clearTimeout(this.debounceTimer);
    
    this.debounceTimer = setTimeout(() => {
      const context = {
        url: this.currentUrl,
        title: this.currentTitle,
        caseId: this.currentCaseId,
        caseNumber: this.currentCaseNumber
      };
      
      console.log(`[NavigationObserver] Triggering ${this.callbacks.length} callback(s)`);
      
      this.callbacks.forEach((cb, index) => {
        try {
          cb(this.currentUrl, context);
        } catch (err) {
          console.error(`[NavigationObserver] Callback ${index} error:`, err);
        }
      });
    }, this.debounceDelay);
  },
  
  /**
   * Register callback with context
   */
  onRouteChange(callback) {
    if (typeof callback !== 'function') {
      console.error('[NavigationObserver] Callback must be a function');
      return;
    }
    
    this.callbacks.push(callback);
    console.log(`[NavigationObserver] Registered callback (total: ${this.callbacks.length})`);
  },
  
  /**
   * Stop observing
   */
  stop() {
    if (!this.isRunning) return;
    
    if (this.titleObserver) {
      this.titleObserver.disconnect();
      this.titleObserver = null;
    }
    
    if (this.urlObserver) {
      this.urlObserver.disconnect();
      this.urlObserver = null;
    }
    
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }
    
    this.callbacks = [];
    clearTimeout(this.debounceTimer);
    this.isRunning = false;
    
    console.log('[NavigationObserver] Stopped');
  }
};
```

### Improved PageIdentifier for Manifest V3

**Current Issues:**
- Tab detection uses text content (fragile)
- No case number validation from title
- No stale data checks

**Improved Implementation:**

```javascript
/**
 * ✅ IMPROVED: Enhanced PageIdentifier with title + URL validation
 */
const PageIdentifier = {
  // ... existing pageTypes ...
  
  /**
   * Get current case context with validation
   */
  getCurrentCaseContext() {
    return getCurrentCaseContext(); // Use shared function
  },
  
  /**
   * Enhanced page identification with title validation
   */
  identifyPage() {
    const url = window.location.href;
    const title = document.title;
    
    // Get case context (validates title + URL)
    const context = getCurrentCaseContext();
    
    // Case Page
    const casePageMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/view(?:\?|$)/);
    if (casePageMatch) {
      const caseId = casePageMatch[1];
      
      // Validate case ID matches context
      if (context && context.caseId !== caseId) {
        console.warn(`[PageIdentifier] Case ID mismatch: URL=${caseId}, Context=${context.caseId}`);
      }
      
      const view = this.detectCasePageView();
      return {
        type: this.pageTypes.CASE_PAGE,
        caseId: context?.caseId || caseId,
        caseNumber: context?.caseNumber || null,
        reportId: null,
        view: view
      };
    }
    
    // ... other page types ...
  },
  
  /**
   * Improved tab detection using best practices
   */
  detectCasePageView() {
    // Strategy 1: data-label + slds-is-active (BEST)
    const activeTab = document.querySelector('.slds-tabs_default__item.slds-is-active');
    if (activeTab?.dataset.label) {
      return this.normalizeTabLabel(activeTab.dataset.label);
    }
    
    // Strategy 2: aria-selected + title
    const activeByAria = document.querySelector('a[role="tab"][aria-selected="true"]');
    if (activeByAria) {
      const label = activeByAria.title || activeByAria.textContent?.trim();
      if (label) {
        return this.normalizeTabLabel(label);
      }
    }
    
    // Strategy 3: Component-based detection
    return this.detectTabByComponents();
  },
  
  /**
   * Normalize tab label
   */
  normalizeTabLabel(label) {
    const normalized = (label || '').toLowerCase().trim();
    const mappings = {
      'details': 'details',
      'communication': 'communication',
      'communications': 'communication',
      'related': 'related',
      'files': 'files',
      'file': 'files',
      'attachments': 'files',
      'history': 'history',
      'reporting fields': 'reporting_fields',
      'reporting': 'reporting_fields'
    };
    return mappings[normalized] || normalized;
  },
  
  /**
   * Validate page context before returning page info
   */
  validatePageInfo(pageInfo) {
    if (pageInfo.type === this.pageTypes.CASE_PAGE && pageInfo.caseId) {
      const context = getCurrentCaseContext();
      
      if (context) {
        // Validate case ID matches
        if (pageInfo.caseId !== context.caseId) {
          console.warn(`[PageIdentifier] Case ID mismatch in page info`);
          return {
            ...pageInfo,
            caseId: context.caseId, // Use validated case ID
            caseNumber: context.caseNumber
          };
        }
        
        // Add case number if missing
        if (!pageInfo.caseNumber && context.caseNumber) {
          return {
            ...pageInfo,
            caseNumber: context.caseNumber
          };
        }
      }
    }
    
    return pageInfo;
  }
};
```

### Complete Stale Data Prevention Pattern

```javascript
/**
 * ✅ PRODUCTION-READY: Complete pattern for preventing stale data display
 */
const StaleDataPrevention = {
  /**
   * Validate before displaying any case data
   */
  validateBeforeDisplay(data, options = {}) {
    const { 
      requireCaseId = true,
      requireCaseNumber = false,
      allowPartialMatch = false
    } = options;
    
    // Get current context
    const currentContext = getCurrentCaseContext();
    
    if (!currentContext) {
      return {
        valid: false,
        reason: 'Not on a valid case page',
        shouldClear: true
      };
    }
    
    // Validate case ID
    if (requireCaseId && data.caseId) {
      if (data.caseId !== currentContext.caseId) {
        return {
          valid: false,
          reason: `Case ID mismatch: ${data.caseId} !== ${currentContext.caseId}`,
          shouldClear: true,
          currentContext
        };
      }
    }
    
    // Validate case number
    if (requireCaseNumber && data.caseNumber) {
      if (data.caseNumber !== currentContext.caseNumber) {
        return {
          valid: false,
          reason: `Case number mismatch: ${data.caseNumber} !== ${currentContext.caseNumber}`,
          shouldClear: true,
          currentContext
        };
      }
    }
    
    // Check if page is still loading
    if (document.title === 'Lightning Experience') {
      return {
        valid: false,
        reason: 'Page is still loading',
        shouldClear: false // Don't clear, just wait
      };
    }
    
    return {
      valid: true,
      reason: 'Context validated',
      currentContext
    };
  },
  
  /**
   * Safe display wrapper
   */
  safeDisplay(data, displayFn, options = {}) {
    const validation = this.validateBeforeDisplay(data, options);
    
    if (!validation.valid) {
      console.warn(`[StaleDataPrevention] Cannot display: ${validation.reason}`);
      
      if (validation.shouldClear) {
        // Clear any existing display
        if (typeof displayFn === 'function') {
          displayFn(null); // Pass null to clear
        }
      }
      
      return false;
    }
    
    // Safe to display
    if (typeof displayFn === 'function') {
      displayFn(data);
    }
    
    return true;
  }
};

// Usage in modules
MyModule.displayCaseData = function(data) {
  return StaleDataPrevention.safeDisplay(data, (validatedData) => {
    if (validatedData) {
      this.updateUI(validatedData);
    } else {
      this.clearUI();
    }
  }, {
    requireCaseId: true,
    requireCaseNumber: true
  });
};
```

### Key Takeaways

1. **Always validate before displaying** - Check case ID and case number match current page
2. **Use title + URL validation** - Most reliable method for page identification
3. **Implement periodic validation** - Safety net for missed navigation events
4. **Clear stale data immediately** - Don't show data from wrong case
5. **Enhanced navigation detection** - Monitor title, URL, and case context
6. **Validate in PageIdentifier** - Return validated page info with case number
7. **Use shared validation function** - Consistent validation across all modules

## Security Considerations

### Best Practices

1. **Never Use `innerHTML` with User Input**
   - Use `textContent` or `createElement`
   - Sanitize if HTML is required

2. **Validate Data from DOM**
   - Don't trust extracted data
   - Validate before using

3. **Use Content Security Policy**
   - Manifest V3 enforces CSP
   - No `eval()` or inline scripts

4. **Sanitize URLs**
   - Validate URLs before opening
   - Use `chrome.tabs.create()` for external URLs

## Testing Strategies

### Unit Testing

1. **Mock Dependencies**
   - Mock `CustomerDataManager`
   - Mock `chrome.storage`
   - Mock DOM elements

2. **Test Edge Cases**
   - Null/undefined inputs
   - Missing elements
   - Empty data

3. **Test Error Handling**
   - Dependency missing
   - DOM query fails
   - Async errors

### Integration Testing

1. **Test with Real Salesforce Pages**
   - Case detail pages
   - Case list pages
   - Different page layouts

2. **Test Navigation**
   - SPA navigation
   - Back/forward buttons
   - Direct URL navigation

3. **Test Feature Interactions**
   - Multiple features enabled
   - Feature dependencies
   - Settings changes

## Documentation Standards

### Function Documentation

```javascript
/**
 * Brief description of what the function does
 * @param {Type} paramName - Parameter description
 * @param {Type} [optionalParam] - Optional parameter description
 * @returns {Type} Return value description
 * @throws {ErrorType} When this error is thrown
 */
```

### Module Documentation

```javascript
/**
 * Module Name
 * Brief description of module purpose
 * 
 * Dependencies: List of dependencies
 * Used by: List of modules that use this
 */
```

### Selector Documentation

```javascript
/**
 * Selector: 'records-record-layout-item[field-label="Field Name"]'
 * Purpose: Extract field value from Lightning record layout
 * Stability: Stable (uses field-label attribute)
 * Fallback: 'records-record-layout-item[field-label*="Field Name"]'
 */
```

