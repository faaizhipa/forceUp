# Case Page View Tracking Implementation

## Overview
Added view/tab tracking to `urlChangeMonitor` and `pageIdentifier` to detect when users navigate between different tabs on a case page (Details, Communication, Files, etc.) even when the URL remains the same.

## Problem Solved
Previously, when navigating from Case Details to Communication tab (or vice versa), the URL stayed the same:
- URL: `https://proquestllc.lightning.force.com/lightning/r/Case/500QO.../view`
- UrlChangeMonitor logged: "No significant changes detected"
- Modules didn't reinitialize or respond to the tab change

## Solution Implemented
Added a `view` property to track which tab/view is active on case pages:
- Detects active tab by checking `aria-selected="true"` on tab elements
- Tracks view changes independently of URL changes
- Triggers callbacks when view changes, even if URL stays the same

## Files Modified

### `modules/pageIdentifier.js`

**New Method: `detectCasePageView()`**
```javascript
detectCasePageView() {
  // Checks for active tab with aria-selected="true"
  // Returns: 'details', 'communication', 'files', 'related', or null
}
```

**Updated Method: `identifyPage()`**
- Now returns object with `view` property
- Calls `detectCasePageView()` for case pages
- Returns: `{ type, caseId, reportId, view }`

**Detection Logic:**
1. Find element: `a[role="tab"][aria-selected="true"]`
2. Check tab text content (case-insensitive):
   - Contains "detail" → returns `'details'`
   - Contains "communication" → returns `'communication'`
   - Contains "file" or "attachment" → returns `'files'`
   - Contains "related" → returns `'related'`
3. Fallback: Check for specific DOM components
   - `records-lwc-detail-panel` → `'details'`
   - `runtime_sales_activities-activity-panel` → `'communication'`

### `modules/urlChangeMonitor.js`

**New State Property:**
```javascript
state: {
  // ... existing properties
  lastView: null  // NEW: Tracks last detected view
}
```

**Updated Methods:**

**`init(pageInfo)`**
- Now stores `pageInfo.view` in `state.lastView`
- Logs view in initialization output

**`checkForChanges(currentPageInfo)`**
- Added `viewChanged` check:
  ```javascript
  viewChanged: this.state.lastView !== currentView
  ```
- Includes `viewChanged` in `anyChange` determination
- Updates `state.lastView` when changes detected
- Logs view changes in detailed output

**`notifyCallbacks(changes, pageInfo)`**
- Includes `view` in `previous` state object

**`reset()`**
- Resets `lastView` to `null`

**`getChangeSummary(changes)`**
- Adds `'View'` to summary when `viewChanged` is true

## Expected Console Output

### Before Fix (View Change Ignored)
```
PageIdentifier: Identifying page for URL: .../Case/500QO.../view
PageIdentifier: Detected CASE_PAGE: {type: 'case_page', caseId: '500QO...', reportId: null}
[UrlChangeMonitor] No significant changes detected
[UrlChangeMonitor] No significant changes detected
// User clicks Communication tab - nothing happens
```

### After Fix (View Change Detected)
```
PageIdentifier: Identifying page for URL: .../Case/500QO.../view
PageIdentifier: Detected CASE_PAGE: {type: 'case_page', caseId: '500QO...', reportId: null, view: 'details'}
[UrlChangeMonitor] Initialized with state: {url: '...', pageType: 'case_page', caseId: '500QO...', reportId: null, view: 'details'}

// User clicks Communication tab
PageIdentifier: Identifying page for URL: .../Case/500QO.../view
PageIdentifier: Detected CASE_PAGE: {type: 'case_page', caseId: '500QO...', reportId: null, view: 'communication'}
[UrlChangeMonitor] Changes detected: {viewChanged: true, from: {view: 'details'}, to: {view: 'communication'}}
PageIdentifier: Page changed (View). Triggering callback.
```

## Behavior Details

### View Detection on Different Tabs

| Tab Clicked | URL | Detected View | Change Logged |
|-------------|-----|---------------|---------------|
| Details | .../view | `'details'` | viewChanged: true |
| Communication | .../view | `'communication'` | viewChanged: true |
| Files | .../view | `'files'` | viewChanged: true |
| Related | .../view | `'related'` | viewChanged: true |

### Change Detection Logic

**Significant Changes** (triggers callback):
- URL changed
- Page type changed
- Case ID changed
- Report ID changed
- **View changed** ← NEW

**View-Only Changes**:
- Does NOT cleanup `CaseTimezoneResolver`
- Does NOT cleanup other major modules
- DOES trigger callback for modules that need to respond to view changes

### Module Cleanup Strategy

**Full Cleanup Triggered By:**
- `pageTypeChanged` (e.g., case page → report page)
- `caseIdChanged` (e.g., case 123 → case 456)

**No Cleanup (View-Only Change):**
- `viewChanged` only (e.g., Details tab → Communication tab on same case)
- Allows modules to respond without full re-initialization

## Integration Example

### Listening for View Changes
```javascript
PageIdentifier.monitorPageChanges((pageInfo) => {
  console.log('Page info:', pageInfo);
  // pageInfo = { type, caseId, reportId, view }
  
  if (pageInfo.view === 'communication') {
    // User is on Communication tab
    initializeCommunicationFeatures();
  } else if (pageInfo.view === 'details') {
    // User is on Details tab
    initializeDetailsFeatures();
  }
});
```

### Checking Current View
```javascript
const currentPage = PageIdentifier.identifyPage();
if (currentPage.view === 'communication') {
  // Show communication-specific UI
}
```

## Edge Cases Handled

### 1. Tab Not Yet Rendered
- `detectCasePageView()` returns `null`
- View tracked as `null`, changes still detected when tab loads
- Fallback checks for specific DOM components

### 2. Custom Tabs
- Unknown tab text captured as-is
- Returns actual tab text (lowercased)
- Enables tracking even for custom tabs

### 3. Rapid Tab Switching
- Each tab switch triggers view change detection
- MutationObserver debouncing (300ms) prevents spam
- Only final stable view triggers callback

### 4. View Detection Errors
- Wrapped in try-catch
- Errors logged to console
- Returns `null` on error (graceful degradation)

### 5. Initial Page Load
- View detected immediately on first `identifyPage()` call
- Stored in initial state
- Subsequent changes properly detected

## Testing Checklist

- [ ] Load case page - verify view detected (e.g., 'details')
- [ ] Click Communication tab - verify "View changed" logged
- [ ] Click Details tab - verify "View changed" logged
- [ ] Click Files tab - verify "View changed" logged
- [ ] Navigate to different case - verify view resets
- [ ] Check console shows view in state logs
- [ ] Verify callback triggered on view change
- [ ] Verify CaseTimezoneResolver NOT cleaned up on view-only change
- [ ] Verify full cleanup still happens on case ID change

## Benefits

✅ **Detects Tab Navigation** - Responds to user switching between tabs
✅ **No URL Required** - Works even when URL doesn't change
✅ **Smart Cleanup** - Avoids unnecessary module cleanup on view changes
✅ **Extensible** - Supports custom tabs automatically
✅ **Backward Compatible** - Existing code continues to work
✅ **Graceful Degradation** - Returns null if view can't be detected

## Known Limitations

1. **Tab Must Be Active**: Can only detect active tab (aria-selected="true")
2. **Lightning Only**: Relies on Lightning component structure
3. **Text Matching**: Tab detection based on text content (may need adjustment for other languages)
4. **DOM Dependency**: Requires tab elements to be rendered
5. **No URL Fragment**: View not encoded in URL, only in DOM state

## Future Enhancements

1. **View History**: Track view navigation history
2. **View Timing**: Measure time spent on each view
3. **View Preferences**: Remember last used view per case
4. **Deep Linking**: Add URL hash for view state (e.g., `#view=communication`)
5. **View Events**: Emit custom events for view changes
6. **Analytics**: Track which views users spend most time on
