# Idle Helper Feature Summary

## Problem
Based on console logs, the extension was stopping at `urlChangeMonitor` with repeated "No significant changes detected" messages. PageIdentifier wasn't proceeding with callbacks, preventing modules like `casePageDataExtractor` from initializing.

## Root Cause
When a page loaded and became stable:
1. UrlChangeMonitor correctly detected no URL/pageType/caseId changes
2. Logged "No significant changes detected" 
3. Did NOT trigger PageIdentifier callback
4. Modules waiting for that callback remained idle

## Solution Implemented
Added an **Idle Helper** to `urlChangeMonitor.js` that:
1. Detects when page has been stable for 2 seconds
2. Triggers a one-time callback to PageIdentifier
3. Ensures modules proceed even when page is stable
4. Automatically disables after triggering to prevent spam
5. Re-enables on navigation for consistent behavior

## Files Modified

### `modules/urlChangeMonitor.js`
**New State Properties:**
- `state.lastActivityTimestamp` - Tracks last activity time
- `state.idleHelperEnabled` - Whether idle helper is active
- `idleHelper` object with timer, triggered flag, delay, and callback

**New Methods:**
- `enableIdleHelper(callback, delay)` - Enable with callback and optional delay
- `disableIdleHelper()` - Disable and clear timers
- `startIdleHelper(pageInfo)` - Start idle timer (internal)
- `resetIdleHelper()` - Reset timer and triggered state
- `getTimeSinceLastActivity()` - Get milliseconds since last activity

**Modified Methods:**
- `init()` - Now sets `lastActivityTimestamp`
- `checkForChanges()` - Updates timestamp, starts/resets idle helper
- `reset()` - Also resets idle helper

### `modules/pageIdentifier.js`
**Modified Method:**
- `monitorPageChanges()` - Now enables idle helper with 2-second delay

## Expected Console Output

### Before Fix
```
[UrlChangeMonitor] Initialized with state: {...}
[UrlChangeMonitor] No significant changes detected
[UrlChangeMonitor] No significant changes detected
[UrlChangeMonitor] No significant changes detected
// Nothing happens - modules stuck
```

### After Fix
```
[UrlChangeMonitor] Initialized with state: {...}
[UrlChangeMonitor] Idle helper enabled (2000ms delay)
PageIdentifier: Starting page monitoring. Initial page: {...}
[UrlChangeMonitor] No significant changes detected
[UrlChangeMonitor] Starting idle helper timer (2000ms)
[UrlChangeMonitor] No significant changes detected
// ... 2 seconds pass ...
[UrlChangeMonitor] Idle period detected - triggering idle helper callback
PageIdentifier: Idle period detected, triggering callback for stable page
[UrlChangeMonitor] Idle helper disabled
[CasePageDataExtractor] Extracting data for case: 500QO00000y1xd3YAA
// Modules proceed normally
```

## Behavior Details

### On Stable Page (No Changes)
1. PageIdentifier calls callback immediately on init
2. Idle helper enabled with 2-second delay
3. MutationObserver triggers checks every ~300ms
4. Each check logs "No significant changes detected"
5. First check with no changes starts idle timer
6. After 2 seconds, idle callback fires
7. PageIdentifier callback triggered again with pageInfo
8. Idle helper automatically disables
9. Modules receive callback and proceed with initialization

### On Page Navigation (Changes Detected)
1. User navigates to different case
2. `checkForChanges()` detects caseId change
3. Callback fires immediately
4. Idle helper resets (timer cleared, triggered = false)
5. Idle helper re-enabled for new page
6. Process repeats for new page

### Edge Case: Rapid Checks with No Changes
1. Multiple `checkForChanges()` calls in quick succession
2. Only first call starts idle timer
3. Subsequent calls see timer already running, skip timer creation
4. Original timer completes after 2 seconds
5. Callback fires once, idle helper disables

## Configuration

**Default Delay:** 2000ms (2 seconds)

**Custom Delay:**
```javascript
UrlChangeMonitor.enableIdleHelper(callback, 3000); // 3 seconds
```

**One-time Trigger:** Yes - automatically disables after firing

**Reset on Changes:** Yes - clears and restarts on URL/pageType/caseId changes

## Testing Steps

1. Reload extension
2. Navigate to case page
3. Watch console for these messages in order:
   - "Idle helper enabled (2000ms delay)"
   - "Starting idle helper timer (2000ms)"
   - "Idle period detected - triggering idle helper callback"
   - "PageIdentifier: Idle period detected, triggering callback"
   - "Idle helper disabled"
   - "CasePageDataExtractor: Extracting data for case..."

4. Navigate to different case
5. Verify idle helper resets and re-enables
6. Verify callback fires again after 2 seconds

## Benefits

✅ **Ensures Initialization** - Modules always proceed even on stable pages
✅ **Prevents Stalling** - No more indefinite waiting for changes
✅ **One-time Trigger** - Doesn't spam callbacks on stable pages
✅ **Smart Reset** - Re-enables on navigation for consistent behavior
✅ **Non-breaking** - Maintains all existing functionality
✅ **Configurable** - Delay can be adjusted if needed
✅ **Graceful** - Works alongside existing change detection

## Potential Issues & Solutions

### Issue: Callback firing twice too quickly
**Cause:** Initial callback + idle callback both firing
**Solution:** This is expected and ensures modules initialize. First ensures immediate response, second ensures stability.

### Issue: Idle helper not disabling
**Cause:** Error in callback preventing completion
**Solution:** Callback errors are caught and logged, idle helper still disables

### Issue: Timer not starting
**Cause:** Changes still being detected
**Solution:** Verify page is actually stable, check for background requests

## Documentation Created

1. **IDLE_HELPER_IMPLEMENTATION.md** - Detailed technical documentation
2. **IDLE_HELPER_QUICK_REF.md** - Quick reference for developers
3. **IDLE_HELPER_SUMMARY.md** - This summary document

## Next Steps

1. Test extension with new idle helper
2. Monitor console for expected messages
3. Verify case data extraction proceeds
4. Check timing is appropriate (2 seconds feels right)
5. Adjust delay if needed based on testing

## Rollback Plan

If issues occur:
1. Revert changes to `urlChangeMonitor.js` (remove idle helper code)
2. Revert changes to `pageIdentifier.js` (remove enableIdleHelper call)
3. Extension will work as before (may have original stalling issue)
