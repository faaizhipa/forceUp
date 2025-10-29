# Lessons Learned - ExLibris Extension Development

## Date: October 28-29, 2025

---

## 1. Customer Data Fallback Strategy

### Problem
Extension wasn't utilizing the known customer list data when case fields were missing or incomplete.

### Solution
Implemented comprehensive fallback logic in both `caseDataExtractor.js` and `caseDetailExtractor.js`:
- First tries to use cached/processed case data
- If customer identified by institution code or account name, immediately populate missing fields
- Customer list provides: `server`, `custID`, `instID`, `institutionCode`, `portalCustomDomain`, `esploroEdition`
- URLBuilder can immediately generate all environment URLs once customer is identified

### Key Takeaway
**Always leverage existing data sources as fallbacks.** If you have a known dataset (like customer list), use it to fill gaps in dynamically extracted data. This makes the system more robust and less dependent on DOM structure.

---

## 2. SPA Navigation & DOM Timing

### Problem
Functions detecting page changes were firing twice, and the second time couldn't identify the page type correctly.

### Solution
Implemented debouncing in `pageIdentifier.js`:
- Added 300ms debounce timer on MutationObserver
- Only check URL after DOM has stabilized
- Clear and reset timer on subsequent mutations
- Prevents hundreds of unnecessary checks during page load

### Key Takeaway
**Single Page Applications require timing strategies.** Salesforce Lightning (and similar SPAs) dynamically build pages through many DOM mutations. Use debouncing to wait for DOM stability before making decisions based on page state.

### Related Timing Strategies Used
- 800ms delay in `content_script_exlibris.js` after URL change detection
- 500ms delay for Communication tab activation
- Multiple retry mechanisms with timeouts when elements aren't immediately available

---

## 3. Tab-Aware UI Component Injection

### Problem
Case Comment Memory buttons weren't appearing in the Communication tab and weren't persisting across tab switches.

### Solution
Created multi-layered tab detection system in `caseCommentMemory.js`:
1. **Tab State Detection**: Check for `li.slds-tabs_default__item.slds-is-active[data-label="Communication"]`
2. **Tab Change Monitoring**: 
   - MutationObserver watching for `class="slds-is-active"` changes on tab elements
   - Click event listeners on Communication tab link
3. **Dynamic Content Monitoring**: Watch for textarea appearance after tab activation
4. **Duplicate Prevention**: Use `dataset` attributes to mark initialized elements

### Key Takeaway
**Salesforce Lightning uses lazy loading for tab content.** Don't assume all page elements are available on initial load. Monitor for tab activation, then watch for content appearance, and always prevent duplicate initialization.

---

## 4. Button Click-Triggered Observers

### Problem
Running observers continuously wastes resources and can trigger prematurely.

### Solution
Modified `monitorTextareaAppearance()` to only start MutationObserver after specific buttons are clicked:
- Attach click listeners to `button[title="Create new..."]` and `button[title="Ad"]`
- Only create observer when user action indicates they want to add a comment
- Disconnect observer after textarea is found and initialized

### Key Takeaway
**Lazy initialization saves resources and improves accuracy.** Wait for user intent (button clicks) before starting expensive operations like DOM monitoring. This reduces false positives and CPU usage.

---

## 5. Salesforce Lightning DOM Structure

### Lessons Learned About Lightning Components

#### Multi-Tier Selector Strategy
When finding elements in Salesforce Lightning, always use multiple fallback selectors:
```javascript
// Primary selector
document.querySelector('forceListViewManager')
// Fallback selector
|| document.querySelector('test-listViewManager')
// Text content matching as last resort
|| Array.from(tables).find(t => headers.includes('Comment'))
```

#### Shadow DOM Awareness
- Lightning components often use Web Components with shadow roots
- Standard `querySelector` may not find elements inside shadow DOM
- Sometimes need to query inside specific Lightning component boundaries

---

## 6. Element Visibility in Multi-Tab Navigation

### Problem
When navigating between case tabs in Salesforce Lightning, the extension was injecting buttons into non-visible flexipage elements and extracting data from hidden previous case tables instead of the currently visible case.

### Root Cause
Salesforce Lightning's single-page application architecture keeps previous case page DOM elements in memory but hidden when users navigate to new cases. This creates multiple matching elements in the DOM:
- Multiple action bar containers (one visible, others hidden from previous cases)
- Multiple Case Comments tables (one visible, others cached from previous cases)
- Multiple metadata field containers (one visible, others from previous cases)

Using `querySelector()` or `querySelectorAll()` without visibility checks always returns the first match in DOM order, which is often the hidden element from a previous case.

### Solution
Implemented comprehensive visibility filtering across all DOM query operations:

#### Created Helper Function
```javascript
function isElementVisible(element) {
  if (!element) return false;
  
  // Check element and all parents for display:none or visibility:hidden
  let el = element;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    el = el.parentElement;
  }
  
  // Check element has dimensions
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
```

#### Applied to All DOM Queries
1. **Button Injection** (`tryInjectButtons`):
   - Changed from `querySelector()` to `querySelectorAll()`
   - Iterate through all matches and check `isElementVisible()`
   - Only inject into first visible action bar container
   
2. **Table Finding** (`findCommentsTable`):
   - Applied visibility checks to all 5 search code paths:
     - Container selector queries
     - Fallback table header matching
     - Table-within-container searches
   - Return only visible Case Comments table
   
3. **Metadata Extraction** (`extractCaseMetadata`):
   - Added visibility check in field element loop
   - Skip non-visible `record-layout-item` elements
   - Only extract from currently visible case fields

### Key Takeaway
**In navigation-heavy SPAs, always validate element visibility before interaction or extraction.** Using `querySelector()` or `querySelectorAll()` alone is insufficient when the DOM contains multiple matching elements from navigation history. Implement visibility checks that:
- Traverse parent chain for CSS `display:none` or `visibility:hidden`
- Validate element has actual dimensions via `getBoundingClientRect()`
- Filter `querySelectorAll()` results to use only visible matches

This ensures UI components (buttons, panels) inject into the correct location and data extraction operations target the currently active page content, not cached/hidden elements from previous navigation states.

### Related Implementation
- `modules/caseCommentExtractor.js` lines 707-745: `isElementVisible()` helper
- `modules/caseCommentExtractor.js` lines 747-784: Button injection with visibility filtering
- `modules/caseCommentExtractor.js` lines 294-387: Table finding with visibility filtering
- `modules/caseCommentExtractor.js` lines 252-285: Metadata extraction with visibility filtering

#### Dynamic Class Names
- Salesforce generates unique class identifiers (e.g., `lwc-2c0jakuf71q`)
- Don't rely on these for selectors
- Use stable attributes like `data-label`, `title`, `role`, `slot`, `part`

#### Container Targeting for Injection
When injecting buttons/UI elements:
1. Find the correct container (e.g., `.slds-float_right`)
2. Insert relative to existing elements (`insertBefore`)
3. Use data attributes to mark injected elements
4. Provides alternative injection methods if primary fails

---

## 6. CSS Positioning in Salesforce

### Problem
Extension banner needed to stay fixed at top without being overridden by Salesforce styles.

### Solution
Applied specific CSS with proper selectors and `!important` flags:
```css
/* Push Salesforce elements down */
#oneHeader > div.slds-global-header.slds-grid.slds-grid_align-spread {
    margin-top: 45px;
}

/* Fixed positioning for banner */
#exl-persistent-banner {
    position: fixed !important;
    top: 0 !important;
    width: 100%;
    z-index: 9999;
}
```

### Key Takeaway
**Salesforce has complex layout with multiple fixed/sticky elements.** To inject persistent UI:
- Use very specific selectors (full class chains)
- Apply early in page load to prevent layout shifts
- Use `!important` judiciously to override framework styles
- Coordinate z-index values carefully
- Push native Salesforce elements down to make space

---

## 7. Form Submission Prevention

### Problem
Custom buttons in Lightning forms were triggering form submission.

### Solution
Added `type="button"` to custom buttons:
```javascript
const button = document.createElement('button');
button.type = 'button';  // Prevents form submission
button.dataset.caseCommentRestoreButton = 'true';
```

### Key Takeaway
**Default button type in forms is `submit`.** Always explicitly set `type="button"` for custom buttons that shouldn't submit forms. This is especially critical in Salesforce where forms have auto-submit behavior.

---

## 8. Data Attributes for State Management

### Usage Patterns Discovered

1. **Initialization Flags**
   ```javascript
   textarea.dataset.caseCommentMemoryInitialized = 'true';
   ```
   Prevents duplicate event listener attachment

2. **Component Marking**
   ```javascript
   button.dataset.caseCommentListenerAttached = 'true';
   ```
   Identifies elements created by the extension

3. **State Tracking**
   ```javascript
   button.dataset.caseCommentRestoreButton = 'true';
   ```
   Enables existence checks and cleanup

### Key Takeaway
**Data attributes are perfect for DOM-based state management.** They persist with the element, are queryable, don't pollute the global scope, and are cleared automatically when elements are removed.

---

## 9. Async/Await Patterns in Content Scripts

### Discovered Patterns

1. **Sequential Initialization**
   ```javascript
   async init(caseId) {
     await this.loadHistory(caseId);
     await this.setupMonitoring(caseId);
   }
   ```

2. **Retry with Delay**
   ```javascript
   if (!button) {
     setTimeout(() => attachButtonListeners(), 500);
   }
   ```

3. **Wait for Elements**
   ```javascript
   await new Promise(resolve => setTimeout(resolve, 800));
   ```

### Key Takeaway
**Content scripts need robust async handling.** DOM may not be ready, APIs may be initializing, and SPA navigation introduces timing complexity. Always use async/await for initialization sequences and provide retry mechanisms.

---

## 10. Module Communication & Global State

### Architecture Used

```javascript
window.ExLibrisExtension = {
  caseToolkit: {
    caseData: null,      // Shared across modules
    lastUrl: null        // SPA navigation tracking
  }
};
```

### Key Takeaway
**Global state object provides module coordination.** In content scripts where modules can't import each other via ES6 modules, a well-structured global object enables:
- Data sharing between modules
- State persistence across async operations
- Prevention of redundant API calls
- Centralized configuration

---

## 11. Error Handling & Logging Strategies

### Patterns Implemented

1. **Contextual Logging**
   ```javascript
   console.log('[ModuleName] Action description', data);
   ```
   Makes debugging easier by identifying source

2. **Fallback Chains**
   ```javascript
   const value = primarySource || fallbackSource || defaultValue;
   ```
   Prevents null reference errors

3. **Try-Catch with Warnings**
   ```javascript
   try {
     // risky operation
   } catch (error) {
     console.warn('[Module] Operation failed:', error);
     // continue with degraded functionality
   }
   ```

### Key Takeaway
**Defensive programming is essential for browser extensions.** The DOM structure can change, user actions are unpredictable, and third-party scripts can interfere. Always log with context, provide fallbacks, and fail gracefully.

---

## 12. Performance Optimization Techniques

### Implemented Optimizations

1. **Observer Cleanup**
   - Disconnect MutationObservers after finding target elements
   - Prevents continuous monitoring when no longer needed

2. **Debouncing**
   - 300ms debounce on page change detection
   - Reduces unnecessary function calls from hundreds to one

3. **Lazy Loading**
   - Only initialize features when user navigates to relevant page
   - Button click triggers for expensive operations

4. **Dataset Flags**
   - Prevent duplicate initialization with quick existence checks
   - `if (element.dataset.initialized) return;`

### Key Takeaway
**Browser extensions must be lightweight.** They run in every tab and compete for resources with the main application. Optimize aggressively: debounce frequent events, disconnect observers when done, lazy-load features, and prevent duplicate work.

---

## 13. Chrome Extension MV3 Considerations

### Constraints & Solutions

1. **No Inline Scripts**
   - All event handlers must be in separate JS files
   - Use `addEventListener` instead of `onclick` attributes

2. **CSP Compliance**
   - No `eval()` or inline styles in injected HTML
   - All CSS must be in external files or via `style` property

3. **Content Script Isolation**
   - Can't directly access page's JavaScript context
   - Need to inject scripts or use postMessage for deep integration

### Key Takeaway
**MV3 requires cleaner architecture.** The restrictions actually improve code quality by enforcing separation of concerns and preventing common security issues.

---

## 14. Testing in Production Environment

### Debugging Techniques Used

1. **Console Log Analysis**
   - Chronological review of logs to understand execution flow
   - Identifying duplicate events and timing issues

2. **DOM Inspection**
   - Chrome DevTools to verify element existence
   - Checking computed styles and layout

3. **Network Tab**
   - Monitoring XHR requests to understand data flow
   - Identifying when Salesforce APIs complete

### Key Takeaway
**Real-world testing reveals timing issues.** Local testing with static HTML doesn't reveal SPA navigation issues, timing races, or Lightning-specific DOM structures. Always test in actual Salesforce environment with realistic user workflows.

---

## Summary of Best Practices

1. ✅ **Always provide fallback data sources** - Don't rely solely on DOM extraction
2. ✅ **Debounce DOM observers** - Wait for page stability before acting
3. ✅ **Detect tab state** - Lazy-loaded content requires tab-aware logic
4. ✅ **Use data attributes** - Perfect for DOM-based state management
5. ✅ **Set button types** - Prevent accidental form submission
6. ✅ **Implement retry logic** - Elements may not exist immediately
7. ✅ **Clean up observers** - Disconnect when no longer needed
8. ✅ **Log with context** - Include module name in all console messages
9. ✅ **Multiple selector strategies** - Primary, fallback, and text-matching
10. ✅ **Lazy initialization** - Wait for user intent before starting expensive operations

---

## Future Improvements to Consider

1. **Cache Invalidation Strategy**: More sophisticated cache expiration based on data freshness
2. **Error Recovery**: Automatic retry with exponential backoff for failed operations
3. **Performance Monitoring**: Track timing metrics to identify bottlenecks
4. **Unit Tests**: Test individual modules with mocked DOM structures
5. **Configuration UI**: Allow users to adjust timing delays and feature toggles

---

*Document created: October 29, 2025*
*Last updated: October 29, 2025*
