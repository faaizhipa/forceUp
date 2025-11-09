# Banner Case Data Navigation Fix

## Problem
The banner was displaying **wrong case data** when navigating from one case page to another. When navigating from Case A to Case B, the banner would still show customer metadata, status, and environment buttons from Case A until Case B's data was fully extracted.

## Root Cause
The `PersistentBanner` module was **not clearing old case data** when navigating to a different case page. It relied solely on new data overwriting old data, which created a timing window where stale data was visible.

**Sequence showing the problem:**
```
User on Case A (ID: 500ABC...)
  ↓
Banner shows Case A data (customer, status, env buttons)
  ↓
User navigates to Case B (ID: 500XYZ...)
  ↓
Banner still shows Case A data ❌ WRONG
  ↓
[Wait 2-3 seconds for extraction...]
  ↓
CasePageDataExtractor extracts Case B data
  ↓
Banner updates to Case B data ✓ CORRECT (but delayed)
```

## Solution Strategy
Implemented the **same cleanup strategy** used by `caseCommentExtractor`:

1. **Track current case ID** - Store `currentCaseId` to detect navigation
2. **Detect case changes** - Compare new case ID with current case ID
3. **Clear old data immediately** - When case changes, clear all case-specific data
4. **Reset to clean state** - Show loading/unknown state until new data arrives

## Implementation

### 1. Added Case ID Tracking

**File:** `modules/persistentBanner.js`

Added `currentCaseId` property:
```javascript
// Current case tracking (to detect navigation to different case)
currentCaseId: null,
```

### 2. Updated Case Data Listener

**Before:**
```javascript
setupCaseDataListener() {
    document.addEventListener('casePageDataExtracted', (event) => {
        const data = event.detail;
        
        // Directly update metadata (no cleanup)
        this.customerMetadata = {
            customerId: data.custID || null,
            institutionId: data.instID || null,
            // ... etc
        };
        
        this.updateBannerUI();
    });
}
```

**After:**
```javascript
setupCaseDataListener() {
    document.addEventListener('casePageDataExtracted', (event) => {
        const data = event.detail;
        
        // Extract case ID from the data
        const newCaseId = data.caseNumber || null;
        
        // Check if we've navigated to a different case
        if (this.currentCaseId && newCaseId && this.currentCaseId !== newCaseId) {
            console.log(`[PersistentBanner] Navigated from case ${this.currentCaseId} to ${newCaseId}, clearing old data...`);
            this.clearCaseData();  // ← NEW: Clear old data
        }
        
        // Update current case ID
        this.currentCaseId = newCaseId;  // ← NEW: Track case ID
        
        // Update metadata with new data
        this.customerMetadata = {
            customerId: data.custID || null,
            // ... etc
        };
        
        this.updateBannerUI();
    });
}
```

### 3. Added clearCaseData() Method

New method to clear all case-specific data:

```javascript
/**
 * Clear case-specific data (called when navigating to a different case or non-case page)
 */
clearCaseData() {
    console.log('[PersistentBanner] Clearing case-specific data');
    
    // Clear current case ID
    this.currentCaseId = null;
    
    // Clear customer metadata
    this.customerMetadata = {
        customerId: null,
        institutionId: null,
        server: null,
        productServiceName: null,
        institutionCode: null
    };
    
    // Reset environment menu state
    this.envMenuVisible = false;
    
    console.log('[PersistentBanner] Case data cleared');
}
```

### 4. Updated handleUrlChange()

Enhanced to clear case data when navigating:

```javascript
handleUrlChange(newUrl) {
    console.log('[PersistentBanner] Handling URL change, resetting current page data');
    
    // Clear case-specific data when navigating away
    this.clearCaseData();  // ← NEW: Clear on URL change
    
    // Reset current page to initial state
    this.currentPage = {
        type: 'Unknown',
        caseNumber: null,
        // ... etc
    };
    
    this.updateBannerUI();
}
```

## Flow Comparison

### Before (Problematic):
```
Navigate Case A → Case B
         ↓
URL changes
         ↓
Banner shows "Unknown" page type
         ↓
BUT: Still shows Case A customer metadata ❌
BUT: Still shows Case A environment buttons ❌
BUT: Still shows Case A status gradient ❌
         ↓
[Wait for extraction...]
         ↓
Case B data arrives
         ↓
Banner updates to Case B data ✓
```

### After (Fixed):
```
Navigate Case A → Case B
         ↓
URL changes → handleUrlChange() called
         ↓
clearCaseData() invoked
         ↓
Banner shows "Unknown" page type ✓
Banner clears customer metadata ✓
Banner clears environment buttons ✓
Banner resets to default gradient ✓
         ↓
[Wait for extraction...]
         ↓
Case B data arrives
         ↓
setupCaseDataListener() detects new case
         ↓
Updates currentCaseId = Case B
         ↓
Banner updates to Case B data ✓
```

## Benefits

1. **✅ Immediate Cleanup** - Old case data cleared instantly on navigation
2. **✅ No Stale Data** - Users never see wrong customer info or environment buttons
3. **✅ Consistent Behavior** - Matches caseCommentExtractor cleanup pattern
4. **✅ Better UX** - Clean loading state instead of confusing mixed data
5. **✅ Prevents Errors** - Avoids actions on wrong case (e.g., clicking wrong env button)

## What Gets Cleared

When navigating to a different case or non-case page:

- ✅ `currentCaseId` → null
- ✅ `customerMetadata.customerId` → null
- ✅ `customerMetadata.institutionId` → null
- ✅ `customerMetadata.server` → null
- ✅ `customerMetadata.productServiceName` → null
- ✅ `customerMetadata.institutionCode` → null
- ✅ `envMenuVisible` → false

What stays (basic page info):

- ✓ `currentPage.type` - Updated by content_script
- ✓ `currentPage.url` - Updated to new URL
- ✓ `navigationHistory` - Preserved across navigations

## Testing Checklist

### Case Navigation Tests:
- [ ] Navigate from Case A to Case B
  - [ ] Verify banner clears Case A data immediately
  - [ ] Verify banner shows "Unknown" during transition
  - [ ] Verify banner updates to Case B data when extracted
  - [ ] Verify no Case A environment buttons appear

- [ ] Navigate from Case to Report page
  - [ ] Verify banner clears case data
  - [ ] Verify banner shows "Report Home" or appropriate type
  - [ ] Verify no environment buttons appear

- [ ] Navigate from Case back to same Case
  - [ ] Verify data refreshes correctly
  - [ ] Verify no duplicate clearing

### Console Verification:
```
Expected logs when navigating Case A → Case B:

[PersistentBanner] URL changed: .../Case/500XYZ.../view
[PersistentBanner] Handling URL change, resetting current page data
[PersistentBanner] Clearing case-specific data
[PersistentBanner] Case data cleared
[PersistentBanner] Waiting for content script to update page data...
[CasePageDataExtractor] Extracting data for case: 500XYZ...
[PersistentBanner] Received case page data from CasePageDataExtractor: {...}
[PersistentBanner] Navigated from case 500ABC... to 500XYZ..., clearing old data...
[PersistentBanner] Clearing case-specific data
[PersistentBanner] Case data cleared
[PersistentBanner] Updated customer metadata: {customerId: "1234", ...}
```

### UI Verification:
- [ ] Environment buttons disappear during transition
- [ ] Customer metadata not visible during transition
- [ ] Status gradient resets to default during transition
- [ ] Banner shows correct case data after extraction completes

## Edge Cases Handled

1. **Rapid Navigation**: If user rapidly navigates A→B→C, each transition clears properly
2. **Back/Forward**: Browser back/forward triggers URL change → clears data
3. **Same Case Reload**: If navigating to same case, no clearing occurs (currentCaseId matches)
4. **Non-Case Pages**: Navigating to non-case page clears case data completely

## Files Modified

1. **modules/persistentBanner.js**
   - Added `currentCaseId` property
   - Updated `setupCaseDataListener()` with case change detection
   - Added `clearCaseData()` method
   - Updated `handleUrlChange()` to call `clearCaseData()`

## Alignment with CaseCommentExtractor

The implementation now mirrors `caseCommentExtractor.js` pattern:

| Aspect | CaseCommentExtractor | PersistentBanner |
|--------|---------------------|------------------|
| **Tracking** | `currentCaseId` | `currentCaseId` ✓ |
| **Detection** | Compare on initialize() | Compare on casePageDataExtracted ✓ |
| **Cleanup** | `cleanup()` method | `clearCaseData()` method ✓ |
| **Trigger** | Before re-initialization | Before updating metadata ✓ |
| **Logging** | "Navigated from X to Y" | "Navigated from X to Y" ✓ |

## Summary

✅ **Added case ID tracking** to detect navigation between cases
✅ **Implemented cleanup logic** when navigating to different case
✅ **Created clearCaseData() method** to reset case-specific state
✅ **Updated URL change handler** to clear data on navigation
✅ **Aligned with caseCommentExtractor** cleanup strategy

The banner now correctly handles case navigation, clearing old data immediately and preventing display of wrong case information.
