# Idle Helper Implementation

## Overview
The Idle Helper is a feature added to `urlChangeMonitor.js` that detects when the page has been stable (no significant changes) for a specified period and triggers a callback to ensure PageIdentifier proceeds with initialization.

## Problem Solved
When a page loads, `urlChangeMonitor` was correctly detecting "No significant changes detected" because the page was stable. However, this prevented PageIdentifier from proceeding with its callback, causing modules like `casePageDataExtractor` to remain idle and not extract data.

## Solution
Added an idle detection mechanism that:
1. Monitors for periods of inactivity (no URL, pageType, or caseId changes)
2. After 2 seconds of stability, triggers a one-time callback
3. Automatically disables after triggering to prevent repeated calls
4. Resets when significant changes occur

## Implementation Details

### New State Properties
```javascript
state: {
  // ... existing properties
  lastActivityTimestamp: null,     // Tracks last activity
  idleHelperEnabled: false          // Whether idle helper is active
}

idleHelper: {
  timer: null,          // setTimeout reference
  triggered: false,     // Prevents duplicate triggers
  delay: 2000,         // Default 2 seconds
  callback: null       // Function to call when idle
}
```

### New Methods

#### `enableIdleHelper(callback, delay = 2000)`
Enables the idle helper with a callback function.
- **callback**: Function to call when page is idle
- **delay**: Milliseconds of inactivity before triggering (default: 2000ms)

```javascript
UrlChangeMonitor.enableIdleHelper((pageInfo) => {
  console.log('Page has been idle for 2 seconds');
  // Proceed with initialization
}, 2000);
```

#### `disableIdleHelper()`
Disables the idle helper and clears any pending timers.

#### `startIdleHelper(pageInfo)`
Starts the idle timer when no changes are detected. Called internally by `checkForChanges()`.

#### `resetIdleHelper()`
Resets the timer and triggered state. Called when significant changes occur.

#### `getTimeSinceLastActivity()`
Returns milliseconds since last activity (useful for debugging).

### Modified Methods

#### `init(pageInfo)`
Now sets `lastActivityTimestamp` on initialization.

#### `checkForChanges(currentPageInfo)`
- Updates `lastActivityTimestamp` on every check
- Starts idle helper when no changes detected and helper is enabled
- Resets idle helper when significant changes occur

#### `reset()`
Now also resets idle helper state.

## Integration with PageIdentifier

### Before
```javascript
monitorPageChanges(callback) {
  if (hasUrlMonitor) {
    UrlChangeMonitor.init(initialPageInfo);
  }
  callback(initialPageInfo); // Called once on init
  
  // Further callbacks only on changes
}
```

### After
```javascript
monitorPageChanges(callback) {
  if (hasUrlMonitor) {
    UrlChangeMonitor.init(initialPageInfo);
    
    // Enable idle helper for stable page detection
    UrlChangeMonitor.enableIdleHelper((pageInfo) => {
      console.log('Idle period detected, triggering callback');
      callback(pageInfo);
    }, 2000);
  }
  callback(initialPageInfo); // Called immediately
  
  // Callback also triggered after 2 seconds if no changes
}
```

## Behavior Flow

### On Page Load (Stable Page)
1. **T+0ms**: PageIdentifier initializes UrlChangeMonitor
2. **T+0ms**: Idle helper enabled with 2-second delay
3. **T+0ms**: Initial callback triggered immediately
4. **T+300ms**: First MutationObserver check - no changes
5. **T+600ms**: Second MutationObserver check - no changes, idle timer starts
6. **T+2600ms**: Idle timer fires, callback triggered again
7. **T+2600ms**: Idle helper automatically disables (one-time trigger)

### On Page Navigation (URL/CaseID Change)
1. **T+0ms**: User navigates to different case
2. **T+300ms**: MutationObserver detects DOM changes
3. **T+300ms**: `checkForChanges()` detects caseId change
4. **T+300ms**: Callback triggered immediately
5. **T+300ms**: Idle helper reset (timer cleared, triggered = false)
6. **T+300ms**: Idle helper re-enabled for new page
7. **T+2300ms**: If stable, idle callback triggers again

### On Repeated Checks (No Changes)
1. **T+0ms**: `checkForChanges()` finds no changes
2. **T+0ms**: Logs "No significant changes detected"
3. **T+0ms**: Starts idle timer if not already running
4. **T+300ms**: Another `checkForChanges()` - still no changes
5. **T+300ms**: Idle timer already running, skips creating new timer
6. **T+2000ms**: Original timer fires, callback triggered
7. **T+2000ms**: Idle helper disables automatically

## Console Output

### Before Fix
```
[UrlChangeMonitor] Initialized with state: {...}
PageIdentifier: Starting page monitoring. Initial page: {...}
[UrlChangeMonitor] No significant changes detected
[UrlChangeMonitor] No significant changes detected
[UrlChangeMonitor] No significant changes detected
// PageIdentifier callback never fires again
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
```

## Configuration

### Default Settings
- **Delay**: 2000ms (2 seconds)
- **One-time trigger**: Yes (auto-disables after first trigger)
- **Reset on changes**: Yes (resets when URL/pageType/caseId changes)

### Customization
You can change the delay when enabling:
```javascript
UrlChangeMonitor.enableIdleHelper(callback, 3000); // 3 seconds
```

## Edge Cases Handled

### 1. Multiple Rapid Checks
If `checkForChanges()` is called multiple times quickly with no changes:
- Only one timer is created (checked via `this.idleHelper.timer`)
- Timer is not reset/restarted on subsequent checks
- Prevents timer stacking

### 2. Change During Idle Period
If a change occurs while idle timer is running:
- `resetIdleHelper()` clears the pending timer
- Callback fires immediately for the change
- New idle timer can start for the new state

### 3. Manual Disable
If `disableIdleHelper()` is called before timer fires:
- Pending timer is cleared
- Callback will not fire
- Can be re-enabled later

### 4. Callback Errors
If the idle helper callback throws an error:
- Error is caught and logged
- Idle helper still disables
- Does not break the monitoring system

## Testing Checklist

- [ ] Initial page load triggers callback twice (immediate + after 2s)
- [ ] Console shows "Idle helper enabled" on initialization
- [ ] Console shows "Starting idle helper timer" when no changes detected
- [ ] Console shows "Idle period detected" after 2 seconds
- [ ] Idle helper disables after triggering once
- [ ] Navigation to different case resets and re-enables idle helper
- [ ] Rapid DOM changes don't create multiple timers
- [ ] `getTimeSinceLastActivity()` returns expected values
- [ ] PageIdentifier callback receives correct pageInfo

## Benefits

1. **Ensures initialization**: Modules always proceed even on stable pages
2. **Prevents stalling**: No more waiting indefinitely for changes
3. **Graceful degradation**: Works alongside existing change detection
4. **One-time trigger**: Doesn't spam callbacks on stable pages
5. **Smart reset**: Re-enables on navigation for consistent behavior
6. **Configurable**: Delay can be adjusted based on needs
7. **Non-breaking**: Maintains all existing functionality

## Future Enhancements

1. **Adaptive delay**: Adjust delay based on page load performance
2. **Multiple callbacks**: Support array of idle callbacks
3. **Idle state API**: Expose `isIdle()` method for external checks
4. **Metrics**: Track idle periods for performance monitoring
5. **Conditional enablement**: Enable only for specific page types
