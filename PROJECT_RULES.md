# Project Rules & Agent Guidelines

**Last Updated:** 2025-01-23  
**Purpose:** Comprehensive rules and guidelines for maintaining and developing this Chrome Extension codebase

---

## Table of Contents

1. [Project Architecture Rules](#project-architecture-rules)
2. [Code Quality Rules](#code-quality-rules)
3. [Chrome Extension Manifest V3 Rules](#chrome-extension-manifest-v3-rules)
4. [Salesforce Lightning Rules](#salesforce-lightning-rules)
5. [State Management Rules](#state-management-rules)
6. [Cache Management Rules](#cache-management-rules)
7. [Navigation & Page Detection Rules](#navigation--page-detection-rules)
8. [Element Selection Rules](#element-selection-rules)
9. [Stale Data Prevention Rules](#stale-data-prevention-rules)
10. [Error Handling Rules](#error-handling-rules)
11. [Performance Rules](#performance-rules)
12. [Security Rules](#security-rules)
13. [Documentation Rules](#documentation-rules)
14. [Agent Development Rules](#agent-development-rules)

---

## Project Architecture Rules

### Module Structure

1. **All modules must be self-contained**
   - Each module should be in its own file: `modules/moduleName.js`
   - Modules should not have circular dependencies
   - Use IIFE pattern for encapsulation when needed

2. **Module exports**
   ```javascript
   // ✅ CORRECT: Export pattern
   const MyModule = {
     // module code
   };
   
   if (typeof module !== 'undefined' && module.exports) {
     module.exports = MyModule;
   }
   ```

3. **Module dependencies**
   - Always check if dependencies exist before using them
   - Use defensive checks: `if (typeof DependencyModule !== 'undefined')`
   - Log warnings when dependencies are missing

4. **Entry points**
   - `content_script.js` - Main content script entry point
   - `content_script_exlibris.js` - Extension controller with global state
   - `background.js` - Service worker (Manifest V3)

### File Organization

1. **Directory structure**
   ```
   /
   ├── modules/          # All feature modules
   ├── .github/         # GitHub configuration
   ├── content_script.js
   ├── content_script_exlibris.js
   ├── background.js
   ├── manifest.json
   └── *.md             # Documentation files
   ```

2. **Naming conventions**
   - Files: `camelCase.js` (e.g., `caseDataExtractor.js`)
   - Modules: `PascalCase` (e.g., `CaseDataExtractor`)
   - Functions: `camelCase` (e.g., `extractCaseData`)
   - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)

---

## Code Quality Rules

### General Rules

1. **No magic numbers**
   - Use named constants for all numeric values
   - Example: `const DEBOUNCE_DELAY = 250;`

2. **Function length**
   - Functions should not exceed 50 lines
   - Break complex functions into smaller helper functions

3. **Variable declarations**
   - Always use `const` or `let`
   - Never use `var`
   - Use `const` by default, `let` only when reassignment is needed

4. **Comments**
   - Use JSDoc for all public functions
   - Explain "why" not "what" in comments
   - Document complex logic and edge cases

5. **Error handling**
   - Always wrap risky operations in try-catch
   - Log errors with context: `console.error('[ModuleName] Error:', error)`
   - Never silently swallow errors

### Code Patterns

1. **Async/await over promises**
   ```javascript
   // ✅ PREFERRED
   async function fetchData() {
     const result = await someAsyncOperation();
     return result;
   }
   
   // ❌ AVOID
   function fetchData() {
     return someAsyncOperation().then(result => result);
   }
   ```

2. **Early returns**
   ```javascript
   // ✅ PREFERRED
   function processData(data) {
     if (!data) return null;
     if (!data.isValid) return null;
     // Process valid data
   }
   ```

3. **Null checks**
   ```javascript
   // ✅ PREFERRED
   if (element && element.offsetParent !== null) {
     // Element exists and is visible
   }
   ```

---

## Chrome Extension Manifest V3 Rules

### Service Worker (background.js)

1. **No persistent global state**
   - Service workers are ephemeral
   - Use `chrome.storage.local` for persistent data
   - Always fetch latest state from storage

2. **Message passing**
   - Use `chrome.runtime.sendMessage` for communication
   - Handle async responses with `return true`
   - Always validate message sources

3. **Event listeners**
   - Register all listeners immediately
   - Don't rely on global variables between events
   - Clean up listeners when appropriate

### Content Scripts

1. **Global state is acceptable**
   - Content scripts persist across SPA navigation
   - Global state object (`window.ExLibrisExtension`) is acceptable
   - Use for immediate state access across modules

2. **Module loading timing**
   - Modules load asynchronously
   - Always check if state exists before using
   - Implement fallback for missing state

3. **Storage API usage**
   - Use `chrome.storage.local` for persistent data
   - Use `chrome.storage.onChanged` for cross-tab sync
   - Always handle storage errors

### Performance

1. **Async operations**
   - Prefer async/await for all I/O operations
   - Use `requestIdleCallback` for non-critical DOM operations
   - Batch DOM queries when possible

2. **Observer cleanup**
   - Always disconnect observers in cleanup methods
   - Clear timers and intervals
   - Remove event listeners

3. **Debouncing and throttling**
   - Debounce navigation callbacks (250ms recommended)
   - Throttle expensive operations
   - Use appropriate delays for each use case

---

## Salesforce Lightning Rules

### Page Detection

1. **Two-step process**
   - Step 1: Identify page context (title + URL)
   - Step 2: Select visible elements from DOM
   - Never skip step 1

2. **Page identification**
   ```javascript
   // ✅ REQUIRED: Always use title + URL
   const context = getCurrentCaseContext(); // Uses title + URL
   if (!context) return; // Not on valid case page
   ```

3. **Tab detection**
   - Use `data-label` + `slds-is-active` (most reliable)
   - Fallback to `aria-selected="true"`
   - Never use text content for tab detection

### Element Selection

1. **Selector stability**
   - ✅ Use stable SLDS classes (`.slds-page-header`, `.slds-grid`)
   - ✅ Chain selectors with visibility checks
   - ❌ Never use dynamic classes (`lwc-*`, `forcegenerated-*`)
   - ❌ Never use position selectors (`nth-child`)

2. **Visibility checks**
   - Always check for `.active` class on tab panels
   - Use `[style*="display: block"]` for inline style visibility
   - Check ARIA attributes: `[aria-hidden="false"]`

3. **Selector formula**
   ```
   [Visible Tab] > [Visible Component Layout] > [Stable Target Class]
   ```

### Shadow DOM

1. **Traversal rules**
   - Check `shadowRoot.mode === 'open'` before accessing
   - Recursively traverse nested shadow roots
   - Handle both native and synthetic shadow DOM

2. **Event handling**
   - Use `composed: true` for events crossing shadow boundaries
   - Don't assume events bubble through shadow boundaries

### Lazy Loading

1. **Detection**
   - Use `MutationObserver` with `subtree: true`
   - Debounce observer callbacks
   - Use `IntersectionObserver` for visibility detection

2. **Triggering**
   - Simulate user interactions to trigger lazy loading
   - Wait for DOM mutations to settle before querying
   - Use `requestIdleCallback` for non-critical operations

---

## State Management Rules

### Global State (Content Scripts)

1. **When to use**
   - ✅ For SPA state sharing (current page, case data)
   - ✅ For immediate access across modules
   - ✅ For state that persists across SPA navigation

2. **Structure**
   ```javascript
   window.ExLibrisExtension = {
     currentPage: null,
     currentCaseId: null,
     lastUrl: null,
     isInitialized: false,
     // ... other state
   };
   ```

3. **Updates**
   - Update immediately on navigation (synchronous)
   - Validate state before using
   - Clear state on navigation away

### Module-Scoped State

1. **When to use**
   - Internal module state
   - Temporary processing state
   - Module-specific configuration

2. **Pattern**
   ```javascript
   const MyModule = {
     _internalState: null, // Private state
     _isProcessing: false,
     // Public methods
   };
   ```

### Chrome Storage

1. **When to use**
   - Persistent data across sessions
   - User preferences
   - Cache data (with validation)

2. **Patterns**
   ```javascript
   // Store
   await chrome.storage.local.set({ key: value });
   
   // Retrieve
   const result = await chrome.storage.local.get(['key']);
   
   // Listen for changes
   chrome.storage.onChanged.addListener((changes, areaName) => {
     // Handle changes
   });
   ```

### Message Passing

1. **When to use**
   - Cross-context communication (content ↔ background)
   - Request-response patterns
   - Cross-tab communication

2. **Pattern**
   ```javascript
   // Send message
   chrome.runtime.sendMessage({ action: 'getData' }, (response) => {
     // Handle response
   });
   
   // Receive message
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     if (message.action === 'getData') {
       sendResponse({ data: result });
       return true; // Async response
     }
   });
   ```

---

## Cache Management Rules

### Cache Validation

1. **Dual identifier validation**
   - Always validate both `caseId` AND `caseNumber`
   - Reject cache if either doesn't match
   - Build signatures from data, not DOM

2. **Cache acceptance checklist**
   - ✅ Case ID matches current page
   - ✅ Case number matches current page
   - ✅ Signature matches current data
   - ✅ Data is not stale (within TTL)
   - ✅ No navigation in progress
   - ✅ Data structure is valid

3. **Signature building**
   ```javascript
   // ✅ CORRECT: Build signature from data
   const signature = buildSignatureFromData(data);
   
   // ❌ WRONG: Build signature from DOM
   const signature = buildSignatureFromDOM();
   ```

### Cache Locking

1. **Prevent race conditions**
   - Use lock mechanism during cache updates
   - Queue concurrent requests
   - Debounce persistence operations

2. **Pattern**
   ```javascript
   const CacheManager = {
     _lock: false,
     _queue: [],
     
     async get(caseId) {
       if (this._lock) {
         // Wait for lock
         return this._waitForLock(caseId);
       }
       // Proceed with cache read
     }
   };
   ```

### Cache Invalidation

1. **When to invalidate**
   - Navigation to different case
   - Case ID mismatch detected
   - Case number mismatch detected
   - Signature mismatch detected
   - TTL expired

2. **Clear immediately**
   - Don't keep stale cache entries
   - Clear on navigation
   - Clear on validation failure

---

## Navigation & Page Detection Rules

### Navigation Detection

1. **Multiple signals required**
   - Monitor title changes (MutationObserver)
   - Intercept History API (pushState/replaceState)
   - Listen to popstate events
   - Listen to hashchange events
   - Monitor DOM mutations (fallback)

2. **Case context tracking**
   - Track both case ID and case number
   - Update context on navigation
   - Validate context before use

3. **Debouncing**
   - Debounce navigation callbacks (250ms)
   - Prevent rapid-fire during complex navigations
   - Clear timers on cleanup

### Page Identification

1. **Always use title + URL**
   ```javascript
   // ✅ REQUIRED
   function getCurrentCaseContext() {
     const pageTitle = document.title;
     const currentURL = window.location.href;
     // Extract and validate both
   }
   ```

2. **Handle loading state**
   ```javascript
   if (pageTitle === 'Lightning Experience') {
     // Page is still loading
     return null;
   }
   ```

3. **Validate page info**
   - Always validate returned page info
   - Check case ID matches context
   - Check case number matches context

### Tab Detection

1. **Best practice selector**
   ```javascript
   // ✅ BEST: data-label + slds-is-active
   const activeTab = document.querySelector(
     'li[data-label="Details"].slds-is-active'
   );
   ```

2. **Fallback strategies**
   - Strategy 1: `data-label` + `slds-is-active` (BEST)
   - Strategy 2: `aria-selected="true"` + title
   - Strategy 3: Component-based detection

3. **Never use**
   - ❌ Text content matching
   - ❌ Position-based selectors
   - ❌ Auto-generated classes

---

## Element Selection Rules

### Selector Rules

1. **Stable classes only**
   - ✅ SLDS classes (`.slds-page-header`, `.slds-grid`)
   - ✅ Structural classes (`section.tabContent`)
   - ❌ Dynamic classes (`lwc-*`, `forcegenerated-*`)
   - ❌ Position selectors (`nth-child`)

2. **Visibility checks required**
   - Always check for `.active` class
   - Check `[style*="display: block"]`
   - Check ARIA attributes
   - Verify element is visible: `element.offsetParent !== null`

3. **Selector chaining**
   ```
   [Visible Tab] > [Visible Layout] > [Stable Class] > [Target]
   ```

### Page Context First

1. **Two-step process**
   - Step 1: Identify page context (title + URL)
   - Step 2: Select elements from DOM
   - Never skip step 1

2. **Validation before query**
   ```javascript
   // ✅ CORRECT
   const context = getCurrentCaseContext();
   if (!context) return; // Not on valid page
   const element = document.querySelector(selector);
   ```

### Shadow DOM Rules

1. **Traversal**
   - Check `shadowRoot.mode === 'open'`
   - Recursively traverse nested roots
   - Handle both native and synthetic

2. **Events**
   - Use `composed: true` for cross-boundary events
   - Don't assume event bubbling

---

## Stale Data Prevention Rules

### Validation Before Display

1. **Always validate**
   - Validate case ID matches current page
   - Validate case number matches current page
   - Check page context hasn't changed
   - Verify page is not still loading

2. **Validation function**
   ```javascript
   // ✅ REQUIRED: Always use before display
   const validation = validatePageContextBeforeDisplay(
     data.caseId,
     data.caseNumber
   );
   
   if (!validation.valid) {
     // Don't display, clear stale data
     return false;
   }
   ```

3. **Clear stale data**
   - Clear immediately when validation fails
   - Don't show data from wrong case
   - Log warnings for debugging

### Periodic Validation

1. **Safety net**
   - Implement periodic validation (every 2 seconds)
   - Check if displayed data is still valid
   - Clear if validation fails

2. **Pattern**
   ```javascript
   setInterval(() => {
     const validation = validatePageContextBeforeDisplay(
       this.displayedCaseId,
       this.displayedCaseNumber
     );
     if (!validation.valid) {
       this.clearDisplay();
     }
   }, 2000);
   ```

### Module Display Pattern

1. **Required pattern**
   ```javascript
   async displayCaseData(data) {
     // 1. Validate
     const validation = validatePageContextBeforeDisplay(
       data.caseId,
       data.caseNumber
     );
     
     if (!validation.valid) {
       this.clearDisplay();
       return false;
     }
     
     // 2. Check if already displaying
     if (this.isDisplaying(data.caseId)) {
       return true;
     }
     
     // 3. Display
     this.updateUI(data);
     return true;
   }
   ```

---

## Error Handling Rules

### Try-Catch Blocks

1. **Always wrap risky operations**
   - DOM queries
   - Async operations
   - External API calls
   - Storage operations

2. **Error logging**
   ```javascript
   try {
     // Risky operation
   } catch (error) {
     console.error('[ModuleName] Operation failed:', error);
     // Handle gracefully
   }
   ```

### Error Context

1. **Always include context**
   - Module name in log
   - Operation being performed
   - Relevant data/parameters

2. **User-friendly messages**
   - Don't expose technical errors to users
   - Provide actionable error messages
   - Log technical details to console

### Graceful Degradation

1. **Fail gracefully**
   - Don't break entire extension on single failure
   - Provide fallback behavior
   - Continue with reduced functionality

---

## Performance Rules

### DOM Operations

1. **Batch queries**
   - Group DOM queries together
   - Cache query results
   - Minimize reflows/repaints

2. **Lazy operations**
   - Use `requestIdleCallback` for non-critical
   - Defer expensive operations
   - Load data on demand

### Observers

1. **Scope appropriately**
   - Use `subtree: false` when possible
   - Limit observer scope
   - Disconnect when done

2. **Debounce callbacks**
   - Debounce MutationObserver callbacks
   - Debounce navigation callbacks
   - Use appropriate delays

### Async Operations

1. **Prefer async/await**
   - Use async/await over promises
   - Handle errors properly
   - Don't block main thread

2. **Parallel operations**
   - Use `Promise.all()` for parallel operations
   - Don't await unnecessarily
   - Optimize critical path

---

## Security Rules

### Content Security Policy (CSP)

1. **Never use `innerHTML`**
   - Use `textContent` or `createElement`
   - Sanitize user input
   - Avoid inline scripts

2. **External resources**
   - Use external CSS files
   - No inline styles (when possible)
   - Validate external content

### Data Validation

1. **Always validate**
   - Validate user input
   - Validate data from storage
   - Validate data from DOM
   - Validate case IDs and numbers

2. **Sanitization**
   - Sanitize before display
   - Escape special characters
   - Validate data types

### Permissions

1. **Minimal permissions**
   - Request only what's needed
   - Use `activeTab` when possible
   - Document why permissions are needed

---

## Documentation Rules

### Code Documentation

1. **JSDoc for all public functions**
   ```javascript
   /**
    * Extracts case data from the current page
    * @param {string} caseId - The case ID to extract data for
    * @returns {Promise<Object>} Extracted case data
    */
   async function extractCaseData(caseId) {
     // ...
   }
   ```

2. **Inline comments**
   - Explain "why" not "what"
   - Document complex logic
   - Note edge cases

### Change Documentation

1. **Update CHANGES.md**
   - Document all significant changes
   - Include lessons learned
   - Note related issues/PRs

2. **Update BEST_PRACTICES.md**
   - Add new patterns discovered
   - Update anti-patterns
   - Document solutions to problems

---

## Agent Development Rules

### Before Making Changes

1. **Read existing code**
   - Understand the module structure
   - Check for existing patterns
   - Review related modules

2. **Check dependencies**
   - Verify all dependencies exist
   - Check module loading order
   - Review integration points

3. **Review best practices**
   - Check BEST_PRACTICES.md
   - Review PROJECT_RULES.md
   - Follow established patterns

### During Development

1. **Follow patterns**
   - Use established patterns
   - Don't reinvent the wheel
   - Maintain consistency

2. **Validate as you go**
   - Test navigation scenarios
   - Test stale data prevention
   - Test error cases

3. **Document decisions**
   - Comment complex logic
   - Document why, not what
   - Note trade-offs

### After Making Changes

1. **Update documentation**
   - Update CHANGES.md
   - Update BEST_PRACTICES.md if new pattern
   - Update function documentation

2. **Test thoroughly**
   - Test happy path
   - Test error cases
   - Test edge cases
   - Test navigation scenarios

3. **Review for compliance**
   - Check against PROJECT_RULES.md
   - Verify best practices followed
   - Ensure no anti-patterns introduced

### Common Pitfalls to Avoid

1. **Don't use dynamic classes**
   - No `lwc-*` classes
   - No `forcegenerated-*` classes
   - Use stable SLDS classes

2. **Don't skip validation**
   - Always validate before display
   - Always validate page context
   - Always validate case ID/number

3. **Don't ignore navigation**
   - Always handle navigation events
   - Always clear stale data
   - Always validate on display

4. **Don't use global state in service worker**
   - Use chrome.storage instead
   - Fetch state when needed
   - Don't assume persistence

5. **Don't query DOM before context**
   - Always identify page first
   - Always validate context
   - Always check visibility

---

## Quick Reference Checklist

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

---

## Enforcement

These rules should be:
1. **Reviewed before any major changes**
2. **Referenced during code reviews**
3. **Updated when new patterns emerge**
4. **Followed consistently across all modules**

**Remember:** These rules exist to prevent bugs, improve maintainability, and ensure consistency. When in doubt, follow the rule. If a rule needs to be broken, document why and update the rules.

---

**Related Documents:**
- [BEST_PRACTICES.md](BEST_PRACTICES.md) - Detailed best practices and patterns
- [CHANGES.md](CHANGES.md) - Change log and lessons learned
- [FUNCTIONS.md](FUNCTIONS.md) - Function catalog
- [SELECTORS.md](SELECTORS.md) - Selector registry
- [DEPENDENCIES.md](DEPENDENCIES.md) - Module dependencies

