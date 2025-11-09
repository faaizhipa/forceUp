# URL Change Monitoring System

## Overview
Implemented a centralized URL change monitoring system to improve navigation detection and module re-initialization across case pages.

**Date:** November 4, 2025
**Modules Modified:** `pageIdentifier.js`
**Modules Created:** `urlChangeMonitor.js`
**Files Updated:** `manifest.json`

---

## Problem Statement

The extension needed better detection of:
1. **URL changes** - When the browser navigates to a new page
2. **Page type changes** - When the page type changes (e.g., case page → report page)
3. **Case ID changes** - When navigating between different cases

Previously, PageIdentifier had embedded logic for tracking these changes, making it difficult to:
- Extend change detection logic
- Share state across modules
- Debug navigation issues
- Coordinate module re-initialization

---

## Solution: UrlChangeMonitor Module

Created a dedicated `urlChangeMonitor.js` module that provides centralized state tracking for:

### State Tracked
```javascript
{
  lastUrl: string | null,          // Last visited URL
  lastPageType: string | null,     // Last page type (case_page, report_page, etc.)
  lastCaseId: string | null,       // Last case ID
  lastReportId: string | null,     // Last report ID
  initialized: boolean             // Initialization status
}
```

### Change Detection
The monitor checks for changes in:
- **URL** - Full URL string comparison
- **Page Type** - Salesforce page type (case_page, cases_list, report_page, etc.)
- **Case ID** - Specific case being viewed
- **Report ID** - Specific report being viewed

### Key Methods

#### `init(pageInfo)`
Initializes the monitor with the current page state.

```javascript
UrlChangeMonitor.init({
  type: 'case_page',
  caseId: '500QO00000y1xd3YAA',
  reportId: null
});
```

#### `checkForChanges(currentPageInfo)`
Compares current page info against stored state and returns detailed change information.

```javascript
const changes = UrlChangeMonitor.checkForChanges(pageInfo);
// Returns:
// {
//   urlChanged: true,
//   pageTypeChanged: false,
//   caseIdChanged: true,
//   reportIdChanged: false,
//   anyChange: true,
//   timestamp: 1699123456789
// }
```

#### `onChanged(callback)`
Registers callbacks to be notified when changes occur.

```javascript
UrlChangeMonitor.onChanged((data) => {
  console.log('Changes:', data.changes);
  console.log('New page:', data.pageInfo);
  console.log('Previous state:', data.previous);
});
```

#### `getState()`
Returns current tracked state.

```javascript
const state = UrlChangeMonitor.getState();
console.log('Current URL:', state.currentUrl);
console.log('Last case ID:', state.lastCaseId);
```

#### `isOnCasePage()`
Quick check if currently on a case page.

```javascript
if (UrlChangeMonitor.isOnCasePage()) {
  // Initialize case-specific features
}
```

#### `getChangeSummary(changes)`
Returns human-readable summary of what changed.

```javascript
const summary = UrlChangeMonitor.getChangeSummary(changes);
// Returns: "URL, CaseID" or "PageType" or "None"
```

---

## Integration with PageIdentifier

Updated `pageIdentifier.js` to use UrlChangeMonitor:

### Before
```javascript
monitorPageChanges(callback) {
  let lastUrl = window.location.href;
  let lastPageInfo = this.identifyPage();
  
  const checkUrlChange = () => {
    if (currentUrl !== lastUrl) {
      // Manual state tracking
      lastUrl = currentUrl;
      const newPageInfo = this.identifyPage();
      
      if (newPageInfo.type !== lastPageInfo.type ||
          newPageInfo.caseId !== lastPageInfo.caseId) {
        lastPageInfo = newPageInfo;
        callback(newPageInfo);
      }
    }
  };
}
```

### After
```javascript
monitorPageChanges(callback) {
  const initialPageInfo = this.identifyPage();
  
  // Initialize UrlChangeMonitor
  if (typeof UrlChangeMonitor !== 'undefined') {
    UrlChangeMonitor.init(initialPageInfo);
  }
  
  const checkUrlChange = () => {
    const newPageInfo = this.identifyPage();
    
    // Use UrlChangeMonitor for change detection
    const changes = UrlChangeMonitor.checkForChanges(newPageInfo);
    
    if (changes.anyChange) {
      const summary = UrlChangeMonitor.getChangeSummary(changes);
      console.log(`Page changed (${summary})`);
      
      // Cleanup modules on significant changes
      if (changes.pageTypeChanged || changes.caseIdChanged) {
        // Trigger module cleanup
      }
      
      callback(newPageInfo);
    }
  };
}
```

### Benefits of Integration

1. **Graceful Degradation** - If UrlChangeMonitor isn't loaded, PageIdentifier falls back to old behavior
2. **Detailed Logging** - Change summaries show exactly what changed
3. **Selective Cleanup** - Only cleanup modules when page type or case ID changes (not just URL)
4. **Centralized State** - All modules can access the same state via UrlChangeMonitor

---

## Usage in Content Scripts

### Example: Module Re-initialization

```javascript
// In content_script_exlibris.js
async handlePageChange(pageInfo) {
  // Check what actually changed
  const changes = UrlChangeMonitor.checkForChanges(pageInfo);
  
  if (changes.caseIdChanged) {
    console.log('Navigated to different case, re-initializing...');
    await CasePageDataExtractor.extractNow();
  }
  
  if (changes.pageTypeChanged) {
    console.log('Page type changed, cleaning up...');
    this.cleanup();
  }
  
  if (changes.urlChanged && !changes.pageTypeChanged && !changes.caseIdChanged) {
    console.log('URL changed but same page/case - no action needed');
  }
}
```

### Example: Conditional Feature Activation

```javascript
// Only activate case features if on a case page
if (UrlChangeMonitor.isOnCasePage()) {
  CasePageDataExtractor.init();
  PersistentBanner.show();
  DynamicMenu.inject();
}
```

### Example: Debug Navigation Issues

```javascript
// Register debug logger
UrlChangeMonitor.onChanged((data) => {
  console.group('Navigation Event');
  console.log('Changed:', UrlChangeMonitor.getChangeSummary(data.changes));
  console.log('From:', data.previous);
  console.log('To:', data.pageInfo);
  console.groupEnd();
});
```

---

## Change Flow

### Initial Page Load
```
1. PageIdentifier.monitorPageChanges(callback) called
2. PageIdentifier.identifyPage() → { type: 'case_page', caseId: '500...' }
3. UrlChangeMonitor.init(pageInfo) → State initialized
4. callback(pageInfo) → Content script handles initial page
5. MutationObserver starts monitoring DOM changes
```

### URL Change (Same Case, Different Tab)
```
URL: /Case/500.../view → /Case/500.../related/CaseComments/view

1. MutationObserver detects DOM change
2. Debounced checkUrlChange() fires (300ms delay)
3. PageIdentifier.identifyPage() → { type: 'case_comments', caseId: '500...' }
4. UrlChangeMonitor.checkForChanges()
   → { urlChanged: true, pageTypeChanged: true, caseIdChanged: false }
5. Console: "Page changed (URL, PageType)"
6. callback(newPageInfo) → Content script handles page change
```

### Navigation to Different Case
```
URL: /Case/500QO.../view → /Case/500QP.../view

1. MutationObserver detects DOM change
2. Debounced checkUrlChange() fires (300ms delay)
3. PageIdentifier.identifyPage() → { type: 'case_page', caseId: '500QP...' }
4. UrlChangeMonitor.checkForChanges()
   → { urlChanged: true, pageTypeChanged: false, caseIdChanged: true }
5. Console: "Page changed (URL, CaseID)"
6. CaseTimezoneResolver.cleanup() called
7. callback(newPageInfo) → Content script re-initializes modules
```

### Popstate Event (Back/Forward Button)
```
User clicks browser back button

1. window.popstate event fires
2. PageIdentifier.identifyPage() → New page info
3. UrlChangeMonitor.checkForChanges()
4. If changes detected:
   - Cleanup modules
   - callback(newPageInfo)
```

---

## Files Modified

### `modules/urlChangeMonitor.js` ⭐ NEW
- Created centralized URL/page state tracker
- 240 lines, fully documented
- Handles state comparison and change notification
- Provides callback registration system

### `modules/pageIdentifier.js`
- **Line 153-250**: Updated `monitorPageChanges()` method
  - Added UrlChangeMonitor integration
  - Graceful fallback if monitor not available
  - Detailed change logging with summaries
  - Selective module cleanup based on change type

### `manifest.json`
- **Line 30**: Added `modules/urlChangeMonitor.js` to content_scripts array
- Loaded before pageIdentifier.js to ensure availability

---

## Benefits

### 1. **Centralized State Management**
- Single source of truth for page state
- No duplicate state tracking across modules
- Easy to query current state from anywhere

### 2. **Better Debugging**
- Detailed logs showing exactly what changed
- Change summaries for quick diagnosis
- Callback notification system for tracking

### 3. **Selective Module Cleanup**
- Only cleanup when page type or case ID changes
- Avoid unnecessary re-initialization
- Better performance on URL-only changes

### 4. **Extensibility**
- Easy to add new state tracking (e.g., account ID)
- Callback system allows any module to listen
- Independent module can be tested/modified

### 5. **Graceful Degradation**
- PageIdentifier works with or without UrlChangeMonitor
- No breaking changes to existing code
- Progressive enhancement pattern

---

## Testing Scenarios

### ✅ Scenario 1: Navigate Between Cases
**Action:** Click different case from list
**Expected:**
- `urlChanged: true`
- `caseIdChanged: true`
- Modules cleanup and re-initialize
- Console shows "Page changed (URL, CaseID)"

### ✅ Scenario 2: Switch Tabs on Same Case
**Action:** Click "Details" → "Communication" on same case
**Expected:**
- `urlChanged: true`
- `pageTypeChanged: true` (case_page → case_comments)
- `caseIdChanged: false`
- Console shows "Page changed (URL, PageType)"

### ✅ Scenario 3: Browser Back Button
**Action:** Press browser back button
**Expected:**
- Popstate event triggers
- Changes detected via UrlChangeMonitor
- Modules cleanup if case changed
- Console shows previous/new page info

### ✅ Scenario 4: Case Page → Report Page
**Action:** Navigate from case to report
**Expected:**
- `urlChanged: true`
- `pageTypeChanged: true`
- `caseIdChanged: true` (from case ID to null)
- Full cleanup and re-initialization

### ✅ Scenario 5: URL Hash Change Only
**Action:** URL hash parameter changes
**Expected:**
- `urlChanged: true`
- `pageTypeChanged: false`
- `caseIdChanged: false`
- Console shows "URL changed but page info unchanged"
- No cleanup or re-initialization

---

## Future Enhancements

### 1. Account ID Tracking
Add `lastAccountId` to state:
```javascript
state: {
  lastAccountId: null,
  // ... existing state
}
```

### 2. Navigation History
Track history of page changes:
```javascript
history: [],
maxHistory: 10,

recordChange(changes, pageInfo) {
  this.history.push({
    timestamp: Date.now(),
    changes,
    pageInfo
  });
  
  if (this.history.length > this.maxHistory) {
    this.history.shift();
  }
}
```

### 3. Performance Metrics
Track navigation performance:
```javascript
metrics: {
  totalNavigations: 0,
  avgInitTime: 0,
  slowNavigations: []
}
```

### 4. Navigation Predictions
Predict next likely navigation:
```javascript
predictNext() {
  // Analyze history to predict next page
  // Pre-load data for likely next case
}
```

---

## Console Output Examples

### Initial Load
```
[UrlChangeMonitor] Initialized with state: {
  url: "https://proquestllc.lightning.force.com/lightning/r/Case/500QO00000y1xd3YAA/view",
  pageType: "case_page",
  caseId: "500QO00000y1xd3YAA",
  reportId: null
}
PageIdentifier: UrlChangeMonitor initialized
PageIdentifier: Starting page monitoring. Initial page: { type: 'case_page', caseId: '500QO00000y1xd3YAA' }
```

### Case Change
```
[UrlChangeMonitor] Changes detected: {
  urlChanged: true,
  pageTypeChanged: false,
  caseIdChanged: true,
  reportIdChanged: false,
  from: {
    url: ".../Case/500QO00000y1xd3YAA/view",
    caseId: "500QO00000y1xd3YAA"
  },
  to: {
    url: ".../Case/500QP00000y1xd4YAA/view",
    caseId: "500QP00000y1xd4YAA"
  }
}
[UrlChangeMonitor] Notifying 2 callbacks
PageIdentifier: Page changed (URL, CaseID). Triggering callback.
PageIdentifier: CaseTimezoneResolver cleaned up
```

### Tab Change
```
[UrlChangeMonitor] Changes detected: {
  urlChanged: true,
  pageTypeChanged: true,
  caseIdChanged: false,
  from: { pageType: "case_page" },
  to: { pageType: "case_comments" }
}
PageIdentifier: Page changed (URL, PageType). Triggering callback.
```

---

## Troubleshooting

### Issue: Modules Not Re-initializing
**Symptom:** Navigate to new case but banner shows old data
**Debug:**
```javascript
// Check if UrlChangeMonitor is loaded
console.log(typeof UrlChangeMonitor); // Should be 'object'

// Check current state
console.log(UrlChangeMonitor.getState());

// Check if callbacks registered
console.log(UrlChangeMonitor.callbacks.length); // Should be > 0
```

### Issue: Too Many Re-initializations
**Symptom:** Console shows multiple "Page changed" messages
**Debug:**
```javascript
// Check debounce timing
// PageIdentifier uses 300ms debounce

// Verify changes are actually different
UrlChangeMonitor.onChanged((data) => {
  console.log('Change count:', data.changes);
});
```

### Issue: State Not Updating
**Symptom:** State shows old values after navigation
**Debug:**
```javascript
// Manually check for changes
const currentPageInfo = PageIdentifier.identifyPage();
const changes = UrlChangeMonitor.checkForChanges(currentPageInfo);
console.log('Manual check:', changes);
```

---

## Summary

The URL Change Monitoring System provides:
- ✅ Centralized page state tracking
- ✅ Detailed change detection (URL, page type, case ID, report ID)
- ✅ Callback notification system
- ✅ Integration with PageIdentifier
- ✅ Selective module cleanup
- ✅ Better debugging and logging
- ✅ Graceful degradation
- ✅ Extensible architecture

This improves navigation reliability, reduces unnecessary re-initializations, and provides better visibility into page changes across the extension.
