# Global Case State Synchronization Pattern

## Overview

The **GlobalCaseState** module provides a centralized, single source of truth for the current case information across all extension modules. This prevents race conditions, stale data, and ensures all modules work with the same case information.

## Problem Statement

**Before GlobalCaseState:**
- Multiple modules were independently extracting case numbers from DOM/URL
- Race conditions occurred when navigating between cases
- Stale data from previous cases would persist in some modules
- PersistentBanner would show data from the previous case
- Cache lookups would use wrong case IDs
- No way to track which modules had consumed current state

**Example of the problem:**
```
User navigates from Case A (08241255) to Case B (08211928)
- PageIdentifier detects Case B immediately
- PersistentBanner still shows Case A data
- CacheManager looks up cache for Case A
- Result: Banner shows wrong case number
```

## Solution: GlobalCaseState Module

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GlobalCaseState                          │
│  (Single Source of Truth - Loaded first in manifest.json)   │
│                                                              │
│  State:                                                      │
│    - currentCaseNumber: "08211928"                          │
│    - currentCaseId: "500QO00000thOllYAE"                    │
│    - currentUrl: "https://..."                              │
│    - lastUpdated: timestamp                                 │
│    - consumptionFlags: {                                    │
│        cacheManagerUsed: false                              │
│        caseDataExtractorUsed: false                         │
│        persistentBannerUsed: false                          │
│      }                                                       │
└─────────────────────────────────────────────────────────────┘
        ▲                                    │
        │ WRITE ONLY                         │ READ ONLY
        │ (updateCaseInfo)                   │ (getCaseNumber, getCaseId)
        │                                    ▼
┌───────────────────┐           ┌────────────────────────────┐
│  PageIdentifier   │           │  All Other Modules:        │
│                   │           │  - CacheManager            │
│  - Detects case   │           │  - CaseDataExtractor       │
│    number via DOM │           │  - PersistentBanner        │
│  - Updates        │           │  - FieldHighlighter        │
│    GlobalCaseState│           │                            │
│  - Resets flags   │           │  Each marks consumption:   │
│                   │           │  GlobalCaseState.mark      │
│                   │           │    CacheManagerUsed()      │
└───────────────────┘           └────────────────────────────┘
```

## Ownership Rules

### PageIdentifier (WRITE)
- **ONLY** module that can update `GlobalCaseState`
- Calls `GlobalCaseState.updateCaseInfo()` when case number detected
- Updates happen in `_updateCaseNumberState()` method
- Automatically resets all consumption flags when updating

### All Other Modules (READ)
- **READ ONLY** access to global state
- Call `GlobalCaseState.getCaseNumber()` and `GlobalCaseState.getCaseId()`
- Mark consumption with `GlobalCaseState.mark[ModuleName]Used(caseNumber)`
- Must validate case number matches before marking consumed

## Implementation Details

### 1. Loading Order (manifest.json)

```json
{
  "js": [
    "modules/globalCaseState.js",  ← LOADED FIRST
    "modules/pageIdentifier.js",    ← Writer
    "modules/cacheManager.js",      ← Reader
    "modules/caseDataExtractor.js", ← Reader
    "modules/persistentBanner.js"   ← Reader
  ]
}
```

### 2. PageIdentifier Updates Global State

**File:** `modules/pageIdentifier.js`

```javascript
_updateCaseNumberState(caseNumber) {
  // Skip if case number hasn't changed
  if (this._lastDetectedCaseNumber === caseNumber) {
    return;
  }

  console.log('[PageIdentifier] Case number changed:',
    this._lastDetectedCaseNumber, '->', caseNumber);
  this._lastDetectedCaseNumber = caseNumber;

  // Get current page info to extract case ID
  const currentPageInfo = this.identifyPage();

  // Update GlobalCaseState (ONLY PageIdentifier can do this)
  if (typeof GlobalCaseState !== 'undefined') {
    GlobalCaseState.updateCaseInfo(
      {
        caseNumber: caseNumber,
        caseId: currentPageInfo.caseId,
        url: window.location.href
      },
      'PageIdentifier'  // Module name for tracking
    );
  }
}
```

**When does this trigger?**
- When `getCaseNumberFromPage()` finds a visible case number via `offsetParent` check
- Logs: `[PageIdentifier] Found visible case number: 08211928`

### 3. CacheManager Reads Global State

**File:** `modules/cacheManager.js`

```javascript
async get(caseId) {
  // ALWAYS read from GlobalCaseState as source of truth
  let targetCaseId = caseId;
  let targetCaseNumber = null;

  if (typeof GlobalCaseState !== 'undefined') {
    const globalCaseId = GlobalCaseState.getCaseId();
    const globalCaseNumber = GlobalCaseState.getCaseNumber();

    if (globalCaseId) {
      // If provided caseId differs from global, warn and use global
      if (caseId && caseId !== globalCaseId) {
        console.warn(`[CacheManager] Provided case ID differs from GlobalCaseState, using GlobalCaseState`);
      }
      targetCaseId = globalCaseId;
      targetCaseNumber = globalCaseNumber;
    }
  }

  // ... cache lookup logic ...

  // Mark consumption
  if (typeof GlobalCaseState !== 'undefined' && targetCaseNumber) {
    GlobalCaseState.markCacheManagerUsed(targetCaseNumber);
  }
}
```

### 4. CaseDataExtractor Reads Global State

**File:** `modules/caseDataExtractor.js`

```javascript
extractCaseData() {
  // Read from GlobalCaseState as source of truth
  let caseId = null;
  let caseNumber = null;

  if (typeof GlobalCaseState !== 'undefined') {
    caseId = GlobalCaseState.getCaseId();
    caseNumber = GlobalCaseState.getCaseNumber();
    console.log('[CaseDataExtractor] Using GlobalCaseState');
  } else {
    // Fallback to extraction
    caseId = this.getCaseIdFromUrl();
    caseNumber = this.getCaseNumber();
  }

  const extractedData = {
    caseId: caseId,
    caseNumber: caseNumber,
    // ... other fields ...
  };

  // Mark consumption
  if (typeof GlobalCaseState !== 'undefined' && caseNumber) {
    GlobalCaseState.markCaseDataExtractorUsed(caseNumber);
  }

  return extractedData;
}
```

### 5. PersistentBanner Reads Global State

**File:** `modules/persistentBanner.js`

```javascript
updateCurrentPage(pageData = {}) {
  // ALWAYS read from GlobalCaseState as source of truth
  let caseNumber = null;
  let caseId = null;

  if (typeof GlobalCaseState !== 'undefined') {
    caseNumber = GlobalCaseState.getCaseNumber();
    caseId = GlobalCaseState.getCaseId();

    // If pageData has case info that differs, warn and use GlobalCaseState
    if (pageData.caseNumber && pageData.caseNumber !== caseNumber) {
      console.warn(`[PersistentBanner] pageData differs from GlobalCaseState, using GlobalCaseState`);
    }
  }

  this.currentPage = {
    type: pageData.type || 'Unknown',
    caseNumber: caseNumber,  // From GlobalCaseState
    caseId: caseId,          // From GlobalCaseState
    subject: pageData.subject || null,
    status: pageData.status || null,
    // ...
  };

  // Mark consumption
  if (typeof GlobalCaseState !== 'undefined' && caseNumber) {
    GlobalCaseState.markPersistentBannerUsed(caseNumber);
  }

  this.updateBannerUI();
}
```

## Consumption Flags

### Purpose
Consumption flags allow PageIdentifier and other modules to track which modules have successfully consumed the current state.

### Lifecycle

```
1. PageIdentifier detects new case number "08211928"
   └─> Calls GlobalCaseState.updateCaseInfo()
       └─> All flags reset to false:
           - cacheManagerUsed: false
           - caseDataExtractorUsed: false
           - persistentBannerUsed: false

2. CacheManager reads global state
   └─> Calls GlobalCaseState.markCacheManagerUsed("08211928")
       └─> cacheManagerUsed: true

3. CaseDataExtractor reads global state
   └─> Calls GlobalCaseState.markCaseDataExtractorUsed("08211928")
       └─> caseDataExtractorUsed: true

4. PersistentBanner reads global state
   └─> Calls GlobalCaseState.markPersistentBannerUsed("08211928")
       └─> persistentBannerUsed: true

5. All modules now in sync ✓
```

### Validation
When marking consumption, the case number is validated:

```javascript
markCacheManagerUsed(caseNumber) {
  if (caseNumber === state.currentCaseNumber) {
    state.consumptionFlags.cacheManagerUsed = true;
    console.log('[GlobalCaseState] CacheManager marked as used for case:', caseNumber);
  } else {
    console.warn('[GlobalCaseState] CacheManager tried to mark used for wrong case:',
      caseNumber, 'Expected:', state.currentCaseNumber);
  }
}
```

This prevents modules from marking consumption for stale case numbers.

## Security

### Write Protection
The `updateCaseInfo()` method includes stack trace validation:

```javascript
updateCaseInfo(newState, updatedBy = 'Unknown') {
  // Validate caller (security check)
  const stack = new Error().stack;
  const isFromPageIdentifier = stack && stack.includes('pageIdentifier.js');

  if (!isFromPageIdentifier && updatedBy !== 'PageIdentifier') {
    console.error('[GlobalCaseState] VIOLATION: Only PageIdentifier can update case info');
    console.error('[GlobalCaseState] Called by:', updatedBy);
    console.error('[GlobalCaseState] Stack trace:', stack);
    return false;
  }

  // Proceed with update...
}
```

If any other module tries to call `updateCaseInfo()`, it will:
1. Log an error with violation details
2. Return `false` without updating
3. Show stack trace for debugging

## Flow Diagram

```
User navigates to Case 500QO00000thOllYAE (Case Number: 08211928)
│
▼
PageIdentifier.getCaseNumberFromPage()
│ - Uses querySelectorAll + offsetParent visibility check
│ - Finds: <lightning-formatted-text>08211928 - Case Subject</lightning-formatted-text>
│ - Extracts case number: "08211928"
▼
PageIdentifier._updateCaseNumberState("08211928")
│ - Compares with _lastDetectedCaseNumber
│ - Different! (was "08241255")
│ - Calls identifyPage() to get case ID
▼
GlobalCaseState.updateCaseInfo({
  caseNumber: "08211928",
  caseId: "500QO00000thOllYAE",
  url: "https://proquestllc.lightning.force.com/..."
}, "PageIdentifier")
│ - Validates caller is PageIdentifier ✓
│ - Updates state
│ - Resets all consumption flags to false
│ - Logs state change
▼
[State is now authoritative source of truth]
│
├─> CacheManager.get()
│   │ - Reads GlobalCaseState.getCaseId() → "500QO00000thOllYAE"
│   │ - Reads GlobalCaseState.getCaseNumber() → "08211928"
│   │ - Looks up cache with correct case ID
│   │ - Marks: GlobalCaseState.markCacheManagerUsed("08211928")
│   └─> Returns cached data or extracts fresh
│
├─> CaseDataExtractor.extractCaseData()
│   │ - Reads GlobalCaseState.getCaseId() → "500QO00000thOllYAE"
│   │ - Reads GlobalCaseState.getCaseNumber() → "08211928"
│   │ - Extracts case data using correct case number
│   │ - Marks: GlobalCaseState.markCaseDataExtractorUsed("08211928")
│   └─> Returns extracted data
│
└─> PersistentBanner.updateCurrentPage(pageData)
    │ - Reads GlobalCaseState.getCaseNumber() → "08211928"
    │ - Reads GlobalCaseState.getCaseId() → "500QO00000thOllYAE"
    │ - If pageData differs, logs warning and uses GlobalCaseState
    │ - Updates banner UI with correct case number
    │ - Marks: GlobalCaseState.markPersistentBannerUsed("08211928")
    └─> Banner displays: "08211928 | Case - Subject"
```

## Debugging

### Console Log Patterns

**Successful Flow:**
```
[PageIdentifier] Found visible case number: 08211928 from element: <lightning-formatted-text>
[PageIdentifier] Case number changed: 08241255 -> 08211928
[GlobalCaseState] State updated by PageIdentifier
[GlobalCaseState] Previous: { caseNumber: "08241255", caseId: "500QO00000yTqC4YAK", ... }
[GlobalCaseState] New: { caseNumber: "08211928", caseId: "500QO00000thOllYAE", ... }
[GlobalCaseState] Consumption flags reset to false
[CacheManager] Using GlobalCaseState - Case ID: 500QO00000thOllYAE, Case Number: 08211928
[GlobalCaseState] CacheManager marked as used for case: 08211928
[CaseDataExtractor] Using GlobalCaseState - Case ID: 500QO00000thOllYAE, Case Number: 08211928
[GlobalCaseState] CaseDataExtractor marked as used for case: 08211928
[PersistentBanner] Using GlobalCaseState - Case ID: 500QO00000thOllYAE, Case Number: 08211928
[GlobalCaseState] PersistentBanner marked as used for case: 08211928
```

**Problem Indicators:**
```
❌ [GlobalCaseState] VIOLATION: Only PageIdentifier can update case info
   → Some module tried to write to GlobalCaseState

❌ [CacheManager] Provided case ID differs from GlobalCaseState, using GlobalCaseState
   → Module passed stale case ID, but was corrected

❌ [PersistentBanner] pageData differs from GlobalCaseState, using GlobalCaseState
   → Banner received stale pageData, but was corrected

❌ [GlobalCaseState] CacheManager tried to mark used for wrong case: 08241255 Expected: 08211928
   → Module tried to mark consumption for stale case
```

### Inspection APIs

```javascript
// In browser console:

// Get current state
GlobalCaseState.getState()
// Returns: {
//   currentCaseNumber: "08211928",
//   currentCaseId: "500QO00000thOllYAE",
//   currentUrl: "https://...",
//   lastUpdated: 1699824000000,
//   lastUpdatedBy: "PageIdentifier",
//   consumptionFlags: {
//     cacheManagerUsed: true,
//     caseDataExtractorUsed: true,
//     persistentBannerUsed: true,
//     fieldHighlighterUsed: false
//   }
// }

// Get specific values
GlobalCaseState.getCaseNumber()  // "08211928"
GlobalCaseState.getCaseId()      // "500QO00000thOllYAE"

// Check consumption
GlobalCaseState.getAllConsumptionFlags()
// Returns: { cacheManagerUsed: true, ... }

// Clear state (for testing)
GlobalCaseState.clear()
```

## Benefits

### ✅ Single Source of Truth
- All modules read from one authoritative source
- No conflicting case information
- No race conditions

### ✅ Prevents Stale Data
- When case changes, all flags reset
- Modules forced to re-consume new state
- Old data cannot persist

### ✅ Clear Ownership
- Only PageIdentifier can write
- All other modules read-only
- Violations are logged and blocked

### ✅ Trackable Consumption
- Know which modules have consumed current state
- Debug when modules use wrong data
- Validate synchronization

### ✅ Centralized Debugging
- Single module to inspect
- Clear log patterns
- Easy to trace data flow

## Best Practices

### For Module Developers

1. **Always read from GlobalCaseState**
   ```javascript
   // ❌ BAD
   const caseNumber = this.getCaseNumberFromDOM();

   // ✅ GOOD
   const caseNumber = GlobalCaseState.getCaseNumber();
   ```

2. **Never write to GlobalCaseState (except PageIdentifier)**
   ```javascript
   // ❌ BAD
   GlobalCaseState.updateCaseInfo({ ... }, 'MyModule');

   // ✅ GOOD
   // Let PageIdentifier handle updates
   ```

3. **Always mark consumption**
   ```javascript
   const caseNumber = GlobalCaseState.getCaseNumber();
   // ... use caseNumber ...
   GlobalCaseState.markMyModuleUsed(caseNumber);
   ```

4. **Handle undefined GlobalCaseState gracefully**
   ```javascript
   if (typeof GlobalCaseState !== 'undefined') {
     caseNumber = GlobalCaseState.getCaseNumber();
   } else {
     // Fallback logic
     caseNumber = this.extractFromDOM();
   }
   ```

### For Testing

1. **Check state before test**
   ```javascript
   const stateBefore = GlobalCaseState.getState();
   console.log('State before navigation:', stateBefore);
   ```

2. **Navigate to case**
   ```javascript
   // Navigate to case page...
   ```

3. **Wait for PageIdentifier update**
   ```javascript
   await new Promise(resolve => setTimeout(resolve, 1000));
   ```

4. **Check state after**
   ```javascript
   const stateAfter = GlobalCaseState.getState();
   console.log('State after navigation:', stateAfter);
   console.log('All modules consumed?',
     Object.values(stateAfter.consumptionFlags).every(flag => flag));
   ```

## Migration Guide

### Before (Old Pattern)
```javascript
// CacheManager - Old
async get(caseId) {
  const urlCaseId = getCaseIdFromUrl();  // Extract from URL
  const targetCaseId = urlCaseId || caseId;
  // ... lookup cache ...
}

// PersistentBanner - Old
updateCurrentPage(pageData) {
  this.currentPage = {
    caseNumber: pageData.caseNumber,  // Use passed data
    // ...
  };
}
```

### After (GlobalCaseState Pattern)
```javascript
// CacheManager - New
async get(caseId) {
  let targetCaseId = caseId;
  let targetCaseNumber = null;

  if (typeof GlobalCaseState !== 'undefined') {
    targetCaseId = GlobalCaseState.getCaseId();      // From global state
    targetCaseNumber = GlobalCaseState.getCaseNumber();
  }

  // ... lookup cache ...

  // Mark consumption
  if (typeof GlobalCaseState !== 'undefined' && targetCaseNumber) {
    GlobalCaseState.markCacheManagerUsed(targetCaseNumber);
  }
}

// PersistentBanner - New
updateCurrentPage(pageData) {
  let caseNumber = null;

  if (typeof GlobalCaseState !== 'undefined') {
    caseNumber = GlobalCaseState.getCaseNumber();  // From global state

    // Warn if passed data differs
    if (pageData.caseNumber && pageData.caseNumber !== caseNumber) {
      console.warn('[PersistentBanner] Using GlobalCaseState, not pageData');
    }
  }

  this.currentPage = {
    caseNumber: caseNumber,  // From global state
    // ...
  };

  // Mark consumption
  if (typeof GlobalCaseState !== 'undefined' && caseNumber) {
    GlobalCaseState.markPersistentBannerUsed(caseNumber);
  }
}
```

## Future Enhancements

### Potential Additions

1. **Event System**
   ```javascript
   GlobalCaseState.onUpdate((newState) => {
     console.log('State changed:', newState);
   });
   ```

2. **State History**
   ```javascript
   GlobalCaseState.getHistory()  // Last 10 state changes
   ```

3. **Performance Metrics**
   ```javascript
   GlobalCaseState.getMetrics()
   // { avgUpdateTime: 50ms, totalUpdates: 42, ... }
   ```

4. **Automatic Consumption Tracking**
   ```javascript
   // Auto-mark consumption when reading
   GlobalCaseState.getCaseNumber({ autoMark: 'CacheManager' })
   ```

## Conclusion

The GlobalCaseState pattern solves synchronization issues by providing a single, authoritative source of truth for case information. With clear ownership rules (PageIdentifier writes, others read) and consumption tracking, we ensure all modules work with consistent, up-to-date case data.

**Key Takeaways:**
- ✅ Single source of truth prevents race conditions
- ✅ Clear ownership prevents conflicting updates
- ✅ Consumption flags enable tracking and debugging
- ✅ Stack trace validation enforces security
- ✅ Fallback logic ensures resilience
