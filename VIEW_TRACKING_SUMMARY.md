# View Tracking Feature - Summary

## What Was Added
View/tab tracking to detect when users navigate between tabs on case pages (Details, Communication, Files, etc.) even when the URL doesn't change.

## The Problem
```
User on Details tab → Clicks Communication tab
URL: .../Case/500QO.../view (stays the same)
UrlChangeMonitor: "No significant changes detected"
Result: ❌ No callback, modules don't respond
```

## The Solution
```
User on Details tab → Clicks Communication tab
URL: .../Case/500QO.../view (stays the same)
View: 'details' → 'communication' (CHANGED)
UrlChangeMonitor: "Changes detected: viewChanged: true"
Result: ✅ Callback fired, modules can respond
```

## Changes Made

### pageIdentifier.js
1. **New method**: `detectCasePageView()`
   - Finds active tab: `a[role="tab"][aria-selected="true"]`
   - Returns: `'details'`, `'communication'`, `'files'`, `'related'`, or `null`

2. **Updated**: `identifyPage()`
   - Now returns: `{ type, caseId, reportId, view }`
   - Calls `detectCasePageView()` for case pages

### urlChangeMonitor.js
1. **New state**: `lastView` property
2. **Updated**: `init()`, `checkForChanges()`, `notifyCallbacks()`, `reset()`, `getChangeSummary()`
3. **New detection**: `viewChanged` check triggers callbacks

## Expected Console Output

### On Page Load
```
PageIdentifier: Detected CASE_PAGE: {type: 'case_page', caseId: '500QO...', view: 'details'}
[UrlChangeMonitor] Initialized with state: {..., view: 'details'}
```

### On Tab Change (Details → Communication)
```
PageIdentifier: Detected CASE_PAGE: {type: 'case_page', caseId: '500QO...', view: 'communication'}
[UrlChangeMonitor] Changes detected: {viewChanged: true, from: {view: 'details'}, to: {view: 'communication'}}
PageIdentifier: Page changed (View). Triggering callback.
```

### On Tab Change (Communication → Details)
```
PageIdentifier: Detected CASE_PAGE: {type: 'case_page', caseId: '500QO...', view: 'details'}
[UrlChangeMonitor] Changes detected: {viewChanged: true, from: {view: 'communication'}, to: {view: 'details'}}
PageIdentifier: Page changed (View). Triggering callback.
```

## Smart Cleanup Logic

**View-only changes** (Details ↔ Communication):
- ✅ Callback triggered
- ❌ CaseTimezoneResolver NOT cleaned up
- ❌ Major modules NOT reinitialized

**Case/Page type changes** (Case A → Case B):
- ✅ Callback triggered
- ✅ CaseTimezoneResolver cleaned up
- ✅ Major modules reinitialized

## Testing Steps

1. **Load case page**
   - Check console for: `view: 'details'` (or other tab)

2. **Click Communication tab**
   - Wait 300ms (debounce)
   - Check console for: `viewChanged: true`
   - Check console for: `from: {view: 'details'}, to: {view: 'communication'}`

3. **Click Details tab**
   - Check console for: `viewChanged: true`
   - Check console for: `from: {view: 'communication'}, to: {view: 'details'}`

4. **Navigate to different case**
   - Verify view resets for new case
   - Verify full cleanup happens (CaseTimezoneResolver cleaned up)

## Benefits

✅ **Tab navigation detected** - No more "No significant changes"
✅ **URL-independent** - Works even when URL is identical
✅ **Smart cleanup** - Avoids unnecessary reinitializations
✅ **Extensible** - Works with custom tabs
✅ **Backward compatible** - Existing code unaffected

## View Detection Method

1. **Primary**: Check `aria-selected="true"` tab element
2. **Fallback**: Check for specific DOM components
3. **Error handling**: Returns `null` if detection fails

## What Modules Can Do

```javascript
PageIdentifier.monitorPageChanges((pageInfo) => {
  if (pageInfo.view === 'communication') {
    // Initialize communication-specific features
    initCommunicationPanel();
  } else if (pageInfo.view === 'details') {
    // Initialize details-specific features
    initDetailsView();
  }
});
```

## Documentation Created

- **CASE_VIEW_TRACKING.md** - Full technical documentation (250+ lines)
- **VIEW_TRACKING_SUMMARY.md** - This summary

## Next Steps

1. Reload extension
2. Navigate to case page
3. Switch between tabs
4. Verify console shows view changes
5. Verify callbacks trigger appropriately
