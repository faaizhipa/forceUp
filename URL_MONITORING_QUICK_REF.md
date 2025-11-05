# URL Change Monitoring - Quick Reference

## What It Does
Tracks URL, page type, and case ID changes to intelligently re-initialize modules.

## Key Components

### UrlChangeMonitor Module
**Location:** `modules/urlChangeMonitor.js`

**State Tracked:**
- `lastUrl` - Last visited URL
- `lastPageType` - Last page type (case_page, report_page, etc.)
- `lastCaseId` - Last case ID viewed
- `lastReportId` - Last report ID viewed

**Main Methods:**
```javascript
// Initialize with current page
UrlChangeMonitor.init(pageInfo);

// Check for changes
const changes = UrlChangeMonitor.checkForChanges(pageInfo);

// Register change callback
UrlChangeMonitor.onChanged((data) => {
  console.log('Changes:', data.changes);
  console.log('New page:', data.pageInfo);
});

// Get current state
const state = UrlChangeMonitor.getState();

// Check if on case page
if (UrlChangeMonitor.isOnCasePage()) { }
```

### PageIdentifier Integration
**Location:** `modules/pageIdentifier.js`

**Updated Method:** `monitorPageChanges(callback)`

**Features:**
- Automatically uses UrlChangeMonitor if available
- Falls back to old behavior if not
- Selective module cleanup based on change type
- Detailed logging with change summaries

## Change Types

| Change | Description | Triggers Cleanup |
|--------|-------------|------------------|
| `urlChanged` | Full URL changed | No (unless type/ID changed) |
| `pageTypeChanged` | Page type changed (e.g., case → report) | Yes |
| `caseIdChanged` | Different case ID | Yes |
| `reportIdChanged` | Different report ID | Yes |

## Usage Examples

### Example 1: Conditional Re-initialization
```javascript
const changes = UrlChangeMonitor.checkForChanges(pageInfo);

if (changes.caseIdChanged) {
  // Different case - full re-init
  await CasePageDataExtractor.extractNow();
  PersistentBanner.reset();
}

if (changes.pageTypeChanged) {
  // Different page type - cleanup
  this.cleanup();
}

if (changes.urlChanged && !changes.caseIdChanged) {
  // Same case, different tab - no action
  console.log('Tab change only');
}
```

### Example 2: Debug Logging
```javascript
UrlChangeMonitor.onChanged((data) => {
  const summary = UrlChangeMonitor.getChangeSummary(data.changes);
  console.log(`Navigation: ${summary}`);
  console.log('From:', data.previous.caseId);
  console.log('To:', data.pageInfo.caseId);
});
```

### Example 3: State Checking
```javascript
// Check current state
const state = UrlChangeMonitor.getState();
console.log('Current case:', state.lastCaseId);
console.log('Current page type:', state.lastPageType);

// Quick checks
if (UrlChangeMonitor.isOnCasePage()) {
  console.log('On a case page');
}
```

## Console Output

### Initial Load
```
[UrlChangeMonitor] Initialized with state: {
  url: ".../Case/500QO.../view",
  pageType: "case_page",
  caseId: "500QO00000y1xd3YAA"
}
PageIdentifier: UrlChangeMonitor initialized
```

### Case Change
```
[UrlChangeMonitor] Changes detected: {
  urlChanged: true, caseIdChanged: true
}
PageIdentifier: Page changed (URL, CaseID). Triggering callback.
```

### Tab Change
```
[UrlChangeMonitor] Changes detected: {
  urlChanged: true, pageTypeChanged: true
}
PageIdentifier: Page changed (URL, PageType). Triggering callback.
```

## Testing

### Quick Test Commands
```javascript
// Check current state
UrlChangeMonitor.getState();

// Manually trigger change check
const pageInfo = PageIdentifier.identifyPage();
const changes = UrlChangeMonitor.checkForChanges(pageInfo);
console.log('Changes:', changes);

// Reset monitor
UrlChangeMonitor.reset();
```

### Test Scenarios
1. ✅ Navigate between different cases
2. ✅ Switch tabs on same case (Details ↔ Communication)
3. ✅ Use browser back/forward buttons
4. ✅ Navigate from case page to report page
5. ✅ URL hash change only

## Files Modified

- ✅ `modules/urlChangeMonitor.js` - NEW module
- ✅ `modules/pageIdentifier.js` - Updated to use monitor
- ✅ `manifest.json` - Added urlChangeMonitor.js

## Load Order (manifest.json)
```
1. debounceUtils.js
2. logger.js
3. urlChangeMonitor.js  ← NEW
4. pageIdentifier.js    ← Uses urlChangeMonitor
5. ... other modules
```

## Benefits

✅ Centralized state management  
✅ Detailed change detection  
✅ Selective module cleanup  
✅ Better debugging  
✅ Graceful degradation  
✅ Callback notification system  

## Troubleshooting

**Modules not re-initializing?**
```javascript
// Check if loaded
console.log(typeof UrlChangeMonitor); // 'object'

// Check state
console.log(UrlChangeMonitor.getState());

// Check callbacks
console.log(UrlChangeMonitor.callbacks.length); // > 0
```

**Too many re-initializations?**
- Check console for duplicate "Page changed" messages
- Verify debounce timing (300ms in PageIdentifier)

**State not updating?**
```javascript
// Force manual check
const pageInfo = PageIdentifier.identifyPage();
UrlChangeMonitor.checkForChanges(pageInfo);
```
