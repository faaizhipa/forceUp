# Reactive Lifecycle Pattern

## Overview

The **Reactive Lifecycle Pattern** is an event-driven architecture where modules automatically respond to GlobalCaseState changes by executing a standardized lifecycle sequence. When PageIdentifier detects a new case, all consumer modules automatically reset, refresh, and re-initialize without manual coordination.

## Problem Statement

**Before Reactive Lifecycle:**
- Modules were called manually in sequence after case detection
- No automatic cleanup when switching cases
- Stale observers and intervals could continue running
- Race conditions between manual cleanup and new data requests
- Hard to track which modules had updated for new case

**Example of the problem:**
```
User navigates from Case A to Case B
1. PageIdentifier detects Case B
2. Manually call CacheManager.get() - might still have Case A data
3. Manually call PersistentBanner.updateCurrentPage() - might show Case A
4. Old URL monitoring still running for Case A
5. Result: Mixed state between Case A and Case B
```

## Solution: Event-Driven Reactive Lifecycle

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GlobalCaseState                              │
│                   (Event Emitter + State Store)                      │
│                                                                       │
│  updateCaseInfo(newState) {                                          │
│    // Detect change                                                  │
│    if (hasChanged) {                                                 │
│      // Update internal state                                        │
│      state.currentCaseNumber = newState.caseNumber                   │
│      state.currentCaseId = newState.caseId                           │
│      // Reset consumption flags                                      │
│      state.consumptionFlags = { all: false }                         │
│      // NOTIFY ALL LISTENERS                                         │
│      this._notifyListeners(previousState, newState)                 │
│    }                                                                  │
│  }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Event: onStateChange(previousState, newState)
                              ▼
      ┌───────────────────────┴───────────────────────┐
      │                                                 │
┌─────▼─────────┐                            ┌────────▼────────┐
│ CacheManager  │                            │ PersistentBanner│
│               │                            │                 │
│ Lifecycle:    │                            │ Lifecycle:      │
│ 1. RESETTING  │                            │ 1. RESETTING    │
│    - Abort    │                            │    - Stop URL   │
│      ongoing  │                            │      monitoring │
│      requests │                            │    - Clear page │
│               │                            │      data       │
│ 2. REFRESHING │                            │                 │
│    - Update   │                            │ 2. REFRESHING   │
│      tracked  │                            │    - Update     │
│      case     │                            │      tracked    │
│      number   │                            │      case       │
│               │                            │                 │
│ 3. INITIATING │                            │ 3. INITIATING   │
│    - Ready    │                            │    - Restart    │
│      for new  │                            │      URL watch  │
│      requests │                            │    - Update UI  │
│               │                            │                 │
│ 4. INITIALIZED│                            │ 4. INITIALIZED  │
└───────────────┘                            └─────────────────┘
```

## Lifecycle Phases

### Phase 1: RESETTING
**Purpose:** Abort all ongoing operations related to the previous case

**CacheManager:**
```javascript
lifecycleState = 'resetting';
ongoingValidations.clear();  // Abort background validations
```

**PersistentBanner:**
```javascript
lifecycleState = 'resetting';
clearInterval(urlMonitorInterval);  // Stop URL monitoring
this.currentPage = { ...empty };   // Clear page data
```

### Phase 2: REFRESHING
**Purpose:** Update internal tracking variables to new case

**CacheManager:**
```javascript
lifecycleState = 'refreshing';
trackedCaseNumber = newState.caseNumber;
```

**PersistentBanner:**
```javascript
lifecycleState = 'refreshing';
trackedCaseNumber = newState.caseNumber;
currentCaseId = newState.caseId;
```

### Phase 3: INITIATING
**Purpose:** Restart services and prepare for new case operations

**CacheManager:**
```javascript
lifecycleState = 'initiating';
// Ready to accept new cache requests
// (Passive - waits for get() calls)
```

**PersistentBanner:**
```javascript
lifecycleState = 'initiating';
startUrlMonitoring();    // Restart monitoring
updateBannerUI();        // Update display with new case
```

### Phase 4: INITIALIZED
**Purpose:** Signal that module is ready for normal operations

**Both Modules:**
```javascript
lifecycleState = 'initialized';
console.log('[Module] Lifecycle: INITIALIZED (ready)');
```

## Implementation

### 1. GlobalCaseState Event System

**File:** `modules/globalCaseState.js`

```javascript
// Event listeners storage
const stateChangeListeners = [];

// Register a listener
onStateChange(moduleName, callback) {
  const listener = { moduleName, callback };
  stateChangeListeners.push(listener);

  // Return unsubscribe function
  return () => {
    const index = stateChangeListeners.indexOf(listener);
    if (index > -1) {
      stateChangeListeners.splice(index, 1);
    }
  };
}

// Notify all listeners when state changes
_notifyListeners(previousState, newState) {
  console.log(`[GlobalCaseState] Notifying ${stateChangeListeners.length} listeners`);

  stateChangeListeners.forEach((listener) => {
    try {
      listener.callback(previousState, newState);
    } catch (error) {
      console.error(`[GlobalCaseState] Error in listener ${listener.moduleName}:`, error);
    }
  });
}

// Update case info - triggers notifications
updateCaseInfo(newState, updatedBy) {
  // ... security check ...

  const hasChanged =
    state.currentCaseNumber !== newState.caseNumber ||
    state.currentCaseId !== newState.caseId;

  if (hasChanged) {
    const previousState = { ...state };

    // Update state
    state.currentCaseNumber = newState.caseNumber;
    state.currentCaseId = newState.caseId;

    // Reset flags
    state.consumptionFlags = { all: false };

    // NOTIFY ALL LISTENERS
    this._notifyListeners(previousState, newState);
  }
}
```

### 2. CacheManager Reactive Lifecycle

**File:** `modules/cacheManager.js`

```javascript
// Lifecycle state tracking
let lifecycleState = 'uninitialized';
let trackedCaseNumber = null;
let stateChangeUnsubscribe = null;

// Register listener during init
async init() {
  // ... existing init logic ...

  isInitialized = true;
  lifecycleState = 'initialized';

  // Register listener for GlobalCaseState changes
  if (typeof GlobalCaseState !== 'undefined') {
    stateChangeUnsubscribe = GlobalCaseState.onStateChange('CacheManager',
      (previousState, newState) => {
        this._handleStateChange(previousState, newState);
      }
    );
  }
}

// Handle state changes
async _handleStateChange(previousState, newState) {
  // Ignore if case number unchanged
  if (previousState.caseNumber === newState.caseNumber) {
    return;
  }

  console.log(`[CacheManager] Case changed: ${previousState.caseNumber} -> ${newState.caseNumber}`);

  try {
    // PHASE 1: RESETTING
    lifecycleState = 'resetting';
    console.log('[CacheManager] Lifecycle: RESETTING');

    // Abort all ongoing validations
    ongoingValidations.clear();

    // PHASE 2: REFRESHING
    lifecycleState = 'refreshing';
    console.log('[CacheManager] Lifecycle: REFRESHING');

    // Update tracked case number
    trackedCaseNumber = newState.caseNumber;

    // PHASE 3: INITIATING
    lifecycleState = 'initiating';
    console.log('[CacheManager] Lifecycle: INITIATING');

    // Ready for new cache requests
    // (Passive - waits for get() calls from other modules)

    // PHASE 4: INITIALIZED
    lifecycleState = 'initialized';
    console.log('[CacheManager] Lifecycle: INITIALIZED (ready)');

  } catch (error) {
    console.error('[CacheManager] Error in lifecycle:', error);
    lifecycleState = 'initialized'; // Reset on error
  }
}

// Public API to check lifecycle state
getLifecycleState() {
  return lifecycleState;
}
```

### 3. PersistentBanner Reactive Lifecycle

**File:** `modules/persistentBanner.js`

```javascript
// Lifecycle state tracking
lifecycleState: 'uninitialized',
trackedCaseNumber: null,
stateChangeUnsubscribe: null,
urlMonitorInterval: null,

// Register listener during init
init() {
  // ... existing init logic ...

  // Register listener for GlobalCaseState changes
  if (typeof GlobalCaseState !== 'undefined') {
    this.stateChangeUnsubscribe = GlobalCaseState.onStateChange('PersistentBanner',
      (previousState, newState) => {
        this._handleStateChange(previousState, newState);
      }
    );
  }

  this.isInitialized = true;
  this.lifecycleState = 'initialized';
}

// Handle state changes
_handleStateChange(previousState, newState) {
  // Ignore if case number unchanged
  if (previousState.caseNumber === newState.caseNumber) {
    return;
  }

  console.log(`[PersistentBanner] Case changed: ${previousState.caseNumber} -> ${newState.caseNumber}`);

  try {
    // PHASE 1: RESETTING
    this.lifecycleState = 'resetting';
    console.log('[PersistentBanner] Lifecycle: RESETTING');

    // Abort URL monitoring
    if (this.urlMonitorInterval) {
      clearInterval(this.urlMonitorInterval);
      this.urlMonitorInterval = null;
    }

    // Clear current page data
    this.currentPage = {
      type: 'Unknown',
      caseNumber: null,
      subject: null,
      status: null,
      subStatus: null
    };

    // PHASE 2: REFRESHING
    this.lifecycleState = 'refreshing';
    console.log('[PersistentBanner] Lifecycle: REFRESHING');

    // Update tracked case
    this.trackedCaseNumber = newState.caseNumber;
    this.currentCaseId = newState.caseId;

    // PHASE 3: INITIATING
    this.lifecycleState = 'initiating';
    console.log('[PersistentBanner] Lifecycle: INITIATING');

    // Restart URL monitoring
    this.startUrlMonitoring();

    // Update banner UI (reads from GlobalCaseState)
    this.updateBannerUI();

    // PHASE 4: INITIALIZED
    this.lifecycleState = 'initialized';
    console.log('[PersistentBanner] Lifecycle: INITIALIZED (ready)');

  } catch (error) {
    console.error('[PersistentBanner] Error in lifecycle:', error);
    this.lifecycleState = 'initialized'; // Reset on error
  }
}

// Public API to check lifecycle state
getLifecycleState() {
  return this.lifecycleState;
}
```

## Complete Flow Diagram

```
User navigates from Case A (08241255) to Case B (08211928)
│
▼
PageIdentifier.getCaseNumberFromPage()
│ - Uses offsetParent to detect visible case number
│ - Finds: "08211928"
│ - Calls _updateCaseNumberState("08211928")
▼
PageIdentifier._updateCaseNumberState("08211928")
│ - Compares with _lastDetectedCaseNumber ("08241255")
│ - Different! Update needed
▼
GlobalCaseState.updateCaseInfo({
  caseNumber: "08211928",
  caseId: "500QO00000thOllYAE",
  url: "https://..."
}, "PageIdentifier")
│ - Validates caller is PageIdentifier ✓
│ - Detects change: "08241255" -> "08211928"
│ - Updates internal state
│ - Resets all consumption flags
│ - NOTIFIES ALL LISTENERS
▼
┌───────────────────────────────────────────────────────────┐
│          GlobalCaseState._notifyListeners()                │
│  Calls all registered listener callbacks in parallel:     │
└───────────────────────────────────────────────────────────┘
         │                                    │
         ├────> CacheManager                 └────> PersistentBanner
         │      _handleStateChange()                _handleStateChange()
         │
         ▼                                           ▼
┌────────────────────────┐              ┌─────────────────────────────┐
│ CacheManager Lifecycle │              │ PersistentBanner Lifecycle  │
│                        │              │                             │
│ [RESETTING]            │              │ [RESETTING]                 │
│ - Clear validations    │              │ - Stop URL monitoring       │
│                        │              │ - Clear page data           │
│ [REFRESHING]           │              │                             │
│ - Update tracked case  │              │ [REFRESHING]                │
│                        │              │ - Update tracked case       │
│ [INITIATING]           │              │                             │
│ - Ready for requests   │              │ [INITIATING]                │
│                        │              │ - Restart URL monitoring    │
│ [INITIALIZED] ✓        │              │ - Update banner UI          │
│                        │              │                             │
│                        │              │ [INITIALIZED] ✓             │
└────────────────────────┘              └─────────────────────────────┘
         │                                           │
         │                                           │
         │  (Other modules call CacheManager.get()) │
         └───────────────────┬───────────────────────┘
                             │
                             ▼
                All modules synchronized with Case B ✓
                Banner shows: "08211928 | Case - Subject"
                Cache lookup uses: "500QO00000thOllYAE"
                No stale data from Case A
```

## Benefits

### ✅ Automatic Cleanup
Modules automatically abort stale operations when case changes. No manual cleanup needed.

### ✅ Guaranteed Synchronization
All modules receive state change notification simultaneously. No race conditions.

### ✅ Decoupled Architecture
PageIdentifier doesn't need to know which modules exist. Just updates GlobalCaseState.

### ✅ Trackable Lifecycle
Each module exposes `getLifecycleState()` for debugging current phase.

### ✅ Error Isolation
If one module's lifecycle fails, others continue. Error doesn't propagate.

### ✅ Extensible
New modules just register a listener. No changes to existing code.

## Console Log Patterns

### Successful Lifecycle

```
[PageIdentifier] Found visible case number: 08211928
[PageIdentifier] Case number changed: 08241255 -> 08211928
[PageIdentifier] Updated GlobalCaseState: { caseNumber: "08211928", ... }

[GlobalCaseState] State updated by PageIdentifier
[GlobalCaseState] Previous: { caseNumber: "08241255", ... }
[GlobalCaseState] New: { caseNumber: "08211928", ... }
[GlobalCaseState] Consumption flags reset to false
[GlobalCaseState] Notifying 2 listeners of state change

[GlobalCaseState] Notifying listener 1: CacheManager
[CacheManager] GlobalCaseState changed: { previousState: {...}, newState: {...} }
[CacheManager] Case changed from 08241255 to 08211928, starting lifecycle
[CacheManager] Lifecycle: RESETTING
[CacheManager] Aborted all ongoing validations
[CacheManager] Lifecycle: REFRESHING
[CacheManager] Updated tracked case number: 08211928
[CacheManager] Lifecycle: INITIATING
[CacheManager] Ready for new case data requests
[CacheManager] Lifecycle: INITIALIZED (ready)

[GlobalCaseState] Notifying listener 2: PersistentBanner
[PersistentBanner] GlobalCaseState changed: { previousState: {...}, newState: {...} }
[PersistentBanner] Case changed from 08241255 to 08211928, starting lifecycle
[PersistentBanner] Lifecycle: RESETTING
[PersistentBanner] Stopped URL monitoring
[PersistentBanner] Cleared current page data
[PersistentBanner] Lifecycle: REFRESHING
[PersistentBanner] Updated tracked case: { caseNumber: "08211928", caseId: "500QO..." }
[PersistentBanner] Lifecycle: INITIATING
[PersistentBanner] Restarted URL monitoring
[PersistentBanner] Updated banner UI
[PersistentBanner] Lifecycle: INITIALIZED (ready)
```

### Error Handling

```
[GlobalCaseState] Notifying listener 1: CacheManager
[CacheManager] Error in lifecycle: TypeError: Cannot read property 'clear' of undefined
[CacheManager] Lifecycle reset to 'initialized' after error

[GlobalCaseState] Error in listener CacheManager: TypeError: ...
[GlobalCaseState] Notifying listener 2: PersistentBanner
[PersistentBanner] Lifecycle: RESETTING
...
[PersistentBanner] Lifecycle: INITIALIZED (ready)
```

**Note:** One module's error doesn't prevent other modules from completing their lifecycle.

## Debugging

### Check Lifecycle State

```javascript
// In browser console:

// Check CacheManager state
CacheManager.getLifecycleState()
// Returns: "initialized" | "resetting" | "refreshing" | "initiating"

// Check PersistentBanner state
PersistentBanner.getLifecycleState()
// Returns: "initialized" | "resetting" | "refreshing" | "initiating"

// Check GlobalCaseState
GlobalCaseState.getState()
// Returns: { currentCaseNumber, currentCaseId, ... }
```

### Verify Listeners Registered

```javascript
// After page load, check listener count
// (Not exposed publicly, but visible in logs)

// Look for these logs:
"[GlobalCaseState] Registered listener for CacheManager (total: 1)"
"[GlobalCaseState] Registered listener for PersistentBanner (total: 2)"
```

### Monitor State Changes

```javascript
// Register a debug listener
GlobalCaseState.onStateChange('DebugMonitor', (prev, next) => {
  console.log('DEBUG: State changed', { prev, next });
});
```

## Best Practices

### For Module Developers

1. **Always register listener in init()**
   ```javascript
   async init() {
     // ... existing init ...

     if (typeof GlobalCaseState !== 'undefined') {
       this.stateChangeUnsubscribe = GlobalCaseState.onStateChange(
         'MyModule',
         (prev, next) => this._handleStateChange(prev, next)
       );
     }
   }
   ```

2. **Implement all 4 lifecycle phases**
   ```javascript
   _handleStateChange(prev, next) {
     // Check if changed
     if (prev.caseNumber === next.caseNumber) return;

     // PHASE 1: RESETTING - abort operations
     // PHASE 2: REFRESHING - update tracking
     // PHASE 3: INITIATING - restart services
     // PHASE 4: INITIALIZED - signal ready
   }
   ```

3. **Expose lifecycle state for debugging**
   ```javascript
   getLifecycleState() {
     return this.lifecycleState;
   }
   ```

4. **Handle errors gracefully**
   ```javascript
   try {
     // Lifecycle phases
   } catch (error) {
     console.error('[MyModule] Lifecycle error:', error);
     this.lifecycleState = 'initialized'; // Reset
   }
   ```

5. **Unsubscribe on cleanup**
   ```javascript
   cleanup() {
     if (this.stateChangeUnsubscribe) {
       this.stateChangeUnsubscribe();
       this.stateChangeUnsubscribe = null;
     }
   }
   ```

## Comparison with Previous Pattern

### Before (Manual Coordination)

```javascript
// PageIdentifier manually calls each module
_updateCaseNumberState(caseNumber) {
  this._lastDetectedCaseNumber = caseNumber;

  // Manually call CacheManager
  if (typeof CacheManager !== 'undefined') {
    CacheManager.getCaseData(caseId, caseNumber)
      .then(data => {
        // Manually call PersistentBanner
        if (typeof PersistentBanner !== 'undefined') {
          PersistentBanner.updateCurrentPage(data);
        }
      });
  }
}

// Problems:
// ❌ PageIdentifier knows about all modules
// ❌ Sequential calls (slow)
// ❌ No automatic cleanup
// ❌ Hard to add new modules
```

### After (Event-Driven Reactive)

```javascript
// PageIdentifier just updates GlobalCaseState
_updateCaseNumberState(caseNumber) {
  this._lastDetectedCaseNumber = caseNumber;

  GlobalCaseState.updateCaseInfo({
    caseNumber,
    caseId: currentPageInfo.caseId,
    url: window.location.href
  }, 'PageIdentifier');

  // Done! All modules automatically notified
}

// Benefits:
// ✅ PageIdentifier decoupled from modules
// ✅ Parallel notifications (fast)
// ✅ Automatic cleanup in each module
// ✅ Easy to add new modules
```

## Adding New Modules

### Step 1: Add Lifecycle State

```javascript
const MyNewModule = {
  // Add lifecycle tracking
  lifecycleState: 'uninitialized',
  trackedCaseNumber: null,
  stateChangeUnsubscribe: null,

  // ... existing properties ...
};
```

### Step 2: Register Listener in init()

```javascript
init() {
  // ... existing init logic ...

  // Register listener
  if (typeof GlobalCaseState !== 'undefined') {
    this.stateChangeUnsubscribe = GlobalCaseState.onStateChange(
      'MyNewModule',
      (prev, next) => this._handleStateChange(prev, next)
    );
  }

  this.lifecycleState = 'initialized';
}
```

### Step 3: Implement Lifecycle Handler

```javascript
_handleStateChange(previousState, newState) {
  // Ignore if unchanged
  if (previousState.caseNumber === newState.caseNumber) {
    return;
  }

  console.log(`[MyNewModule] Case changed: ${previousState.caseNumber} -> ${newState.caseNumber}`);

  try {
    // PHASE 1: RESETTING
    this.lifecycleState = 'resetting';
    // Abort ongoing operations specific to your module

    // PHASE 2: REFRESHING
    this.lifecycleState = 'refreshing';
    this.trackedCaseNumber = newState.caseNumber;

    // PHASE 3: INITIATING
    this.lifecycleState = 'initiating';
    // Restart services specific to your module

    // PHASE 4: INITIALIZED
    this.lifecycleState = 'initialized';

  } catch (error) {
    console.error('[MyNewModule] Lifecycle error:', error);
    this.lifecycleState = 'initialized';
  }
}
```

### Step 4: Expose State

```javascript
getLifecycleState() {
  return this.lifecycleState;
}
```

### Step 5: Register Consumption Flag (Optional)

If your module reads from GlobalCaseState:

```javascript
// In GlobalCaseState.js - add flag
consumptionFlags: {
  cacheManagerUsed: false,
  caseDataExtractorUsed: false,
  persistentBannerUsed: false,
  myNewModuleUsed: false  // Add this
}

// Add marker method
markMyNewModuleUsed(caseNumber) {
  if (caseNumber === state.currentCaseNumber) {
    state.consumptionFlags.myNewModuleUsed = true;
  }
}
```

## Conclusion

The Reactive Lifecycle Pattern provides automatic, event-driven synchronization when case changes occur. By implementing standardized lifecycle phases (RESETTING → REFRESHING → INITIATING → INITIALIZED), modules ensure clean state transitions without manual coordination.

**Key Takeaways:**
- ✅ Event-driven architecture via GlobalCaseState
- ✅ Automatic cleanup when case changes
- ✅ Standardized 4-phase lifecycle
- ✅ Parallel notification to all modules
- ✅ Error isolation between modules
- ✅ Easy to extend with new modules
- ✅ Debuggable via lifecycle state inspection
