# Debug Instructions

**Last Updated:** 2025-01-23  
**Purpose:** Manual testing steps, DOM inspection guidelines, console logging patterns, common issues and solutions, debugging tools and techniques, and test scenarios

---

## Table of Contents

1. [Quick Debug Checklist](#quick-debug-checklist)
2. [Console Logging Patterns](#console-logging-patterns)
3. [DOM Inspection Guidelines](#dom-inspection-guidelines)
4. [Manual Testing Steps](#manual-testing-steps)
5. [Common Issues and Solutions](#common-issues-and-solutions)
6. [Debugging Tools and Techniques](#debugging-tools-and-techniques)
7. [Test Scenarios](#test-scenarios)

---

## Quick Debug Checklist

### Before Debugging

- [ ] Extension is loaded and enabled
- [ ] Correct domain (ProQuest vs Clarivate)
- [ ] Browser console is open (F12)
- [ ] No errors in console
- [ ] Settings are configured correctly (popup)

### During Debugging

- [ ] Check console logs for module initialization
- [ ] Verify page type detection
- [ ] Check data extraction logs
- [ ] Verify event dispatching
- [ ] Check validation results
- [ ] Inspect DOM elements

### After Debugging

- [ ] Clear console logs
- [ ] Test navigation scenarios
- [ ] Verify cleanup on navigation
- [ ] Check for memory leaks (observers)

---

## Console Logging Patterns

### Module Initialization Logs

All modules log initialization:

```javascript
// Expected logs:
[ExLibris Extension] Initializing...
[Logger] Logger initialized
[ExLibris Extension] SettingsManager initialized
[ExLibris Extension] CustomerDataManager initialized
[ExLibris Extension] CacheManager initialized
[NavigationObserver] Started navigation monitoring
[PageIdentifier] Page identified: { type: 'case_page', caseId: '...' }
```

### Data Extraction Logs

```javascript
// Expected logs:
[CasePageDataExtractor] Extracting data for case: 500QO...
[CasePageDataExtractor] Waiting for page load...
[CasePageDataExtractor] Extracted case data (validated): { caseId, caseNumber, ... }
[CasePageDataExtractor] Dispatched casePageDataExtracted event (validated)
```

### Validation Logs

```javascript
// Expected logs:
[PageContextValidator] Context validated
[PageContextValidator] Case ID mismatch: data=... current=...
[PageContextValidator] Case number mismatch but case IDs match. Waiting for title update...
[PageContextValidator] Title updated after 500ms
```

### Navigation Logs

```javascript
// Expected logs:
[EXL] NavigationObserver: Navigation detected
[PageIdentifier] Page changed: { type: 'case_page', caseId: '...' }
[ExLibris Extension] Page changed: { type: 'case_page', caseId: '...' }
[ExLibris Extension] Initializing case page features...
```

### Error Logs

```javascript
// Error patterns:
[ModuleName] Error: [error message]
[ModuleName] Warning: [warning message]
[ModuleName] Failed to [action]: [reason]
```

---

## DOM Inspection Guidelines

### Key Elements to Inspect

#### Case Page Elements

```javascript
// Case ID from URL
window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})\//)

// Case number from title
document.title.match(/^(\d{6,10})/)

// Record layout fields
document.querySelectorAll('records-record-layout-item[field-label="Field Name"]')

// Flexipage components
document.querySelectorAll('flexipage-component2')

// Active tab
document.querySelector('.slds-tabs_default__item.slds-is-active')
```

#### Banner Elements

```javascript
// Persistent banner
document.querySelector('#exl-persistent-banner')

// Banner case data
document.querySelector('#exl-persistent-banner [data-case-id]')

// Banner status
document.querySelector('#exl-persistent-banner .exl-status')
```

#### Dynamic Menu Elements

```javascript
// Menu container
document.querySelector('.exlibris-custom-menu')

// Menu buttons
document.querySelectorAll('.exlibris-custom-menu button')

// Injection points
document.querySelector('lightning-card slot[name="actions"]')
document.querySelector('flexipage-component2[data-component-id*="header"]')
```

### Shadow DOM Inspection

Some elements are in Shadow DOM:

```javascript
// Access shadow root
const element = document.querySelector('lightning-card');
const shadowRoot = element.shadowRoot;

// Query within shadow root
shadowRoot.querySelector('slot[name="actions"]');
```

### Visibility Checks

```javascript
// Check if element is visible
function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0';
}

// Check if element is in viewport
function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return rect.top >= 0 && 
         rect.left >= 0 && 
         rect.bottom <= window.innerHeight && 
         rect.right <= window.innerWidth;
}
```

---

## Manual Testing Steps

### Test 1: Extension Initialization

1. **Open Salesforce page** (ProQuest domain)
2. **Open browser console** (F12)
3. **Check logs:**
   - Should see `[ExLibris Extension] Initializing...`
   - Should see module initialization logs
   - Should see `[NavigationObserver] Started navigation monitoring`
4. **Verify:**
   - No errors in console
   - All modules initialized
   - NavigationObserver is running

### Test 2: Case Page Detection

1. **Navigate to a case page**
2. **Check console logs:**
   - Should see `[PageIdentifier] Page identified: { type: 'case_page', caseId: '...' }`
   - Should see `[ExLibris Extension] Page changed: ...`
3. **Verify:**
   - Page type is `case_page`
   - Case ID is extracted correctly
   - Page change handler is called

### Test 3: Data Extraction

1. **Navigate to a case page**
2. **Check console logs:**
   - Should see `[CasePageDataExtractor] Extracting data for case: ...`
   - Should see `[CasePageDataExtractor] Extracted case data (validated): ...`
   - Should see `[CasePageDataExtractor] Dispatched casePageDataExtracted event`
3. **Verify in console:**
   ```javascript
   // Check if event was dispatched
   document.addEventListener('casePageDataExtracted', (e) => {
     console.log('Event received:', e.detail);
   });
   ```
4. **Verify data:**
   - Case ID matches URL
   - Case number matches title
   - Customer data is present (custID, instID, server)

### Test 4: Persistent Banner

1. **Navigate to a case page**
2. **Check banner:**
   - Should appear at top of page
   - Should show case number
   - Should show customer metadata
   - Should show status with gradient
3. **Check console logs:**
   - Should see `[PersistentBanner] Received case page data from CasePageDataExtractor`
   - Should see `[PersistentBanner] Updated customer metadata: ...`
4. **Test collapse:**
   - Click collapse button
   - Banner should minimize
   - Click again to expand

### Test 5: Dynamic Menu Buttons

1. **Navigate to a case page**
2. **Wait for buttons to appear** (may take a few seconds)
3. **Check DOM:**
   ```javascript
   document.querySelector('.exlibris-custom-menu')
   ```
4. **Verify buttons:**
   - Should see button groups
   - Should see environment buttons (Production, Sandbox)
   - Should see tool buttons (SQL, Analytics, Kibana)
5. **Test button click:**
   - Click a button
   - Should open URL in new tab
   - URL should contain case data (custID, instID, etc.)

### Test 6: Field Highlighting

1. **Navigate to a case page**
2. **Check fields:**
   - Empty required fields should be red
   - Filled fields should be yellow
3. **Check console logs:**
   - Should see `[FieldHighlighter] Highlighting fields...`
4. **Test with empty field:**
   - Find an empty required field
   - Should be highlighted red

### Test 7: Navigation Detection

1. **Navigate to a case page**
2. **Navigate to another case page** (click a case link)
3. **Check console logs:**
   - Should see `[EXL] NavigationObserver: Navigation detected`
   - Should see `[PageIdentifier] Page changed: ...`
   - Should see cleanup logs
   - Should see new page initialization logs
4. **Verify:**
   - Old features are cleaned up
   - New features are initialized
   - Banner updates with new case data

### Test 8: Data Validation

1. **Navigate to a case page**
2. **Manually trigger validation:**
   ```javascript
   // In console
   const context = PageContextValidator.getCurrentCaseContext();
   console.log('Current context:', context);
   
   // Validate displayed data
   const validation = PageContextValidator.validatePageContextBeforeDisplay(
     '500QO...', // case ID
     '00001026'  // case number
   );
   console.log('Validation result:', validation);
   ```
3. **Verify:**
   - Context is extracted correctly
   - Validation returns correct result

### Test 9: Cache Functionality

1. **Navigate to a case page**
2. **Check cache:**
   ```javascript
   // In console
   chrome.storage.local.get('caseDataCache', (result) => {
     console.log('Cache:', result.caseDataCache);
   });
   ```
3. **Navigate away and back:**
   - Should use cached data
   - Should see `[CasePageDataExtractor] Already have data for case: ...`
4. **Modify case:**
   - Edit a field in Salesforce
   - Navigate back
   - Should re-extract (cache invalidated)

### Test 10: Multi-Tab Sync

1. **Open case in Tab 1**
2. **Open same case in Tab 2**
3. **Check Tab 1:**
   - Should see warning banner
   - Should see "Switch to Other Tab" button
4. **Click button:**
   - Should switch to Tab 2
   - Should focus on Tab 2

---

## Common Issues and Solutions

### Issue 1: Features Not Appearing

**Symptoms:**
- Buttons don't appear
- Banner doesn't show
- Field highlighting doesn't work

**Debugging Steps:**
1. Check console for errors
2. Verify page type detection:
   ```javascript
   PageIdentifier.identifyPage()
   ```
3. Check if feature is enabled:
   ```javascript
   SettingsManager.get().exlibris.features
   ```
4. Check DOM for injection points:
   ```javascript
   document.querySelector('.exlibris-custom-menu')
   document.querySelector('#exl-persistent-banner')
   ```

**Solutions:**
- Enable feature in popup settings
- Check if correct domain (ProQuest vs Clarivate)
- Wait for page to fully load
- Check for JavaScript errors

### Issue 2: Data Not Loading

**Symptoms:**
- Banner shows "Loading..."
- Buttons don't have data
- Console shows extraction errors

**Debugging Steps:**
1. Check extraction logs:
   ```javascript
   // Look for:
   [CasePageDataExtractor] Extracting data for case: ...
   [CasePageDataExtractor] Extracted case data (validated): ...
   ```
2. Check validation:
   ```javascript
   PageContextValidator.getCurrentCaseContext()
   ```
3. Check cache:
   ```javascript
   chrome.storage.local.get('caseDataCache', console.log);
   ```

**Solutions:**
- Wait for page to fully load
- Check if case page is valid
- Clear cache and retry
- Check for selector changes (Salesforce UI update)

### Issue 3: Stale Data Displayed

**Symptoms:**
- Banner shows old case data
- Buttons have wrong case data
- Data doesn't update on navigation

**Debugging Steps:**
1. Check validation:
   ```javascript
   const validation = PageContextValidator.validatePageContextBeforeDisplay(
     displayedCaseId,
     displayedCaseNumber
   );
   console.log('Validation:', validation);
   ```
2. Check current context:
   ```javascript
   PageContextValidator.getCurrentCaseContext()
   ```
3. Check periodic validation:
   - Should run every 2 seconds
   - Check console for validation logs

**Solutions:**
- Clear displayed data manually
- Wait for periodic validation to clear
- Check navigation detection (may not be firing)

### Issue 4: Navigation Not Detected

**Symptoms:**
- Features don't update on navigation
- Old features remain active
- New features don't initialize

**Debugging Steps:**
1. Check NavigationObserver:
   ```javascript
   NavigationObserver.isRunning
   ```
2. Check navigation logs:
   ```javascript
   // Should see:
   [EXL] NavigationObserver: Navigation detected
   ```
3. Manually trigger check:
   ```javascript
   NavigationObserver.checkNavigation()
   ```

**Solutions:**
- Restart NavigationObserver
- Check for JavaScript errors
- Verify URL/title changes are detected

### Issue 5: Performance Issues

**Symptoms:**
- Slow page loads
- High CPU usage
- Browser becomes unresponsive

**Debugging Steps:**
1. Check observer count:
   ```javascript
   // Count active observers
   // (No direct API, check module state)
   ```
2. Check cache size:
   ```javascript
   chrome.storage.local.getBytesInUse('caseDataCache', console.log);
   ```
3. Check console for excessive logging

**Solutions:**
- Clear cache
- Disable unused features
- Reduce logging (set Logger.debugMode = false)
- Check for observer leaks (cleanup on navigation)

---

## Debugging Tools and Techniques

### Browser DevTools

#### Console Tab
- **Filter logs:** Use filter box to search for specific modules
- **Preserve log:** Enable to keep logs across navigation
- **Console API:** Use `console.table()`, `console.group()`, etc.

#### Elements Tab
- **Inspect element:** Right-click → Inspect
- **Search in DOM:** Ctrl+F to search for selectors
- **Break on:** Right-click element → Break on → Attribute modifications

#### Network Tab
- **Filter:** Filter by XHR/Fetch to see API calls
- **Inspect requests:** Click request to see details
- **Copy as cURL:** Right-click → Copy → Copy as cURL

#### Sources Tab
- **Set breakpoints:** Click line number
- **Step through code:** F10 (step over), F11 (step into)
- **Watch variables:** Add to Watch panel

### Extension-Specific Tools

#### Chrome Storage Inspector
```javascript
// View all storage
chrome.storage.local.get(null, console.log);
chrome.storage.sync.get(null, console.log);

// Clear storage
chrome.storage.local.clear();
chrome.storage.sync.clear();
```

#### Module State Inspector
```javascript
// Check module state
console.log('NavigationObserver:', NavigationObserver.isRunning);
console.log('PageIdentifier:', PageIdentifier._lastPageInfo);
console.log('CasePageDataExtractor:', CasePageDataExtractor.currentCaseId);
```

#### Event Listener Inspector
```javascript
// Check active event listeners
getEventListeners(document);

// Manually trigger events
document.dispatchEvent(new CustomEvent('casePageDataExtracted', {
  detail: { caseId: '...', caseNumber: '...' },
  bubbles: true,
  composed: true
}));
```

### Debugging Techniques

#### 1. Logging Levels
```javascript
// Set logging level
Logger.debugMode = true;  // Enable debug logs
Logger.debugMode = false; // Disable debug logs

// Module-specific logging
console.log('[ModuleName] Debug message');
console.warn('[ModuleName] Warning message');
console.error('[ModuleName] Error message');
```

#### 2. Breakpoints
```javascript
// Conditional breakpoint
if (caseId === '500QO...') {
  debugger; // Break here
}

// Logpoint (Chrome DevTools)
// Set breakpoint → Right-click → "Add logpoint"
// Enter: caseId, caseNumber
```

#### 3. Performance Profiling
```javascript
// Start profiling
console.profile('CasePageLoad');

// ... code to profile ...

// End profiling
console.profileEnd('CasePageLoad');

// Or use Performance tab in DevTools
```

#### 4. Memory Profiling
```javascript
// Take heap snapshot
// DevTools → Memory tab → Take snapshot

// Check for leaks
// Compare snapshots before/after navigation
```

---

## Test Scenarios

### Scenario 1: First-Time Case Page Load

**Steps:**
1. Clear cache: `chrome.storage.local.clear()`
2. Navigate to a case page
3. Observe:
   - Data extraction should occur
   - Cache should be populated
   - Features should initialize
   - Banner should show data

**Expected Results:**
- Extraction logs appear
- Cache entry created
- All features active
- Banner displays case data

### Scenario 2: Cached Case Page Load

**Steps:**
1. Load case page (cache populated)
2. Navigate away
3. Navigate back to same case
4. Observe:
   - Should use cached data
   - Should skip extraction
   - Features should initialize faster

**Expected Results:**
- Cache hit log appears
- No extraction logs
- Faster initialization
- Banner shows cached data

### Scenario 3: Case Modification

**Steps:**
1. Load case page (cache populated)
2. Edit case in Salesforce (change status)
3. Navigate back to case page
4. Observe:
   - Cache should be invalidated
   - Data should be re-extracted
   - Features should update

**Expected Results:**
- Cache invalidation log
- Re-extraction occurs
- New data displayed
- Features updated

### Scenario 4: Rapid Navigation

**Steps:**
1. Navigate to case page 1
2. Quickly navigate to case page 2
3. Quickly navigate to case page 3
4. Observe:
   - Debouncing should prevent multiple initializations
   - Only final page should initialize
   - Previous pages should cleanup

**Expected Results:**
- Debounce logs appear
- Only one initialization per navigation
- Cleanup occurs for previous pages
- Final page features active

### Scenario 5: SPA Navigation

**Steps:**
1. Load case page
2. Click tab (Details → Communication)
3. Observe:
   - Navigation should be detected
   - Features should remain active
   - Banner should persist

**Expected Results:**
- Navigation detected
- No cleanup (same case)
- Features persist
- Banner shows same case

### Scenario 6: Tab Switching

**Steps:**
1. Open case in Tab 1
2. Open same case in Tab 2
3. Observe:
   - Multi-tab warning should appear
   - BroadcastChannel should be active
4. Click "Switch to Other Tab"
5. Observe:
   - Should switch to Tab 2
   - Tab 2 should be focused

**Expected Results:**
- Warning banner appears
- Tab switching works
- Focus moves to other tab

---

## Related Documentation

- **[FEATURE_SUMMARY.md](FEATURE_SUMMARY.md)** - Feature overview
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - Implementation details
- **[COMPLETE_FLOW_DOCUMENTATION.md](COMPLETE_FLOW_DOCUMENTATION.md)** - Flow documentation
- **[BEST_PRACTICES.md](BEST_PRACTICES.md)** - Debugging best practices

