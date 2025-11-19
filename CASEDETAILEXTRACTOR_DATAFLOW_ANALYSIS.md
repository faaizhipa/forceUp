# CaseDetailExtractor Data Flow Analysis

## Problem Statement

Determine if `CaseDetailExtractor` will extract data from the current case being viewed or from a stale case.

## Current Data Flow

### CaseDetailExtractor.extractCaseDetails()

**Location**: `modules/caseDetailExtractor.js` (lines 32-304)

**Flow**:
1. **Line 37-39**: Checks for cached data in `window.ExLibrisExtension.caseToolkit.caseData`
   ```javascript
   if (typeof window.ExLibrisExtension !== 'undefined' && 
       window.ExLibrisExtension.caseToolkit?.caseData) {
       caseData = window.ExLibrisExtension.caseToolkit.caseData;
   ```
   ⚠️ **NO VALIDATION** that cached data matches current case

2. **Line 72-73**: Extracts case ID from URL
   ```javascript
   const urlMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
   details.caseId = urlMatch?.[1] || caseData?.caseId || null;
   ```
   ⚠️ Uses cached `caseData.caseId` as fallback, but doesn't validate if it matches URL

3. **Line 76-82**: Uses cached case data fields
   ```javascript
   details.caseNumber = caseData?.caseNumber || null;
   details.subject = caseData?.subject || null;
   // ... etc
   ```
   ⚠️ Uses cached data without checking if it matches current case

## The Problem: Stale Data Risk

### Scenario 1: Navigation Between Cases
1. User views **Case A** (ID: `5001a000001ABC`)
   - `window.ExLibrisExtension.caseToolkit.caseData` is populated with Case A data
   - `window.ExLibrisExtension.currentCaseId = '5001a000001ABC'`

2. User navigates to **Case B** (ID: `5001a000001XYZ`)
   - URL changes to Case B
   - `window.ExLibrisExtension.currentCaseId` may or may not be updated (depends on which module updates it)
   - `window.ExLibrisExtension.caseToolkit.caseData` **may still contain Case A data** if:
     - No extraction has occurred yet for Case B
     - Extraction failed for Case B
     - Navigation was too fast

3. User triggers `CaseDetailExtractor.extractCaseDetails()`
   - **Line 37-39**: Finds cached data (Case A)
   - **Line 72**: Extracts Case B ID from URL
   - **Line 73**: Sets `details.caseId = '5001a000001XYZ'` (from URL)
   - **Line 76-82**: Uses **Case A data** (caseNumber, subject, etc.) but with **Case B ID**
   - **Result**: Mixed data - Case B ID with Case A details ❌

### Scenario 2: Stale Data After Case Modification
1. User views Case A
   - Data extracted and cached
   - Case A modified in Salesforce (status changed, asset updated, etc.)

2. User triggers `CaseDetailExtractor.extractCaseDetails()`
   - Uses cached data (old Case A data)
   - **No validation** that data is still current
   - **Result**: Stale data returned ❌

## Comparison with Other Modules

### PersistentBanner (CORRECT Implementation)
**Location**: `modules/persistentBanner.js` (lines 1419-1426)

```javascript
// Try to get from cached toolkit first
if (window.ExLibrisExtension && 
    window.ExLibrisExtension.caseToolkit && 
    window.ExLibrisExtension.caseToolkit.caseData &&
    window.ExLibrisExtension.currentCaseId === caseId) {  // ✅ VALIDATES
    caseData = window.ExLibrisExtension.caseToolkit.caseData;
}
```

✅ **Validates** that `currentCaseId` matches the case ID from URL before using cached data.

### CasePageDataExtractor (CORRECT Implementation)
**Location**: `modules/casePageDataExtractor.js` (lines 66-74)

```javascript
// Check if cache is valid for this case
const cacheValidation = this.isCacheValid(caseId);  // ✅ VALIDATES
if (cacheValidation.valid) {
    console.log('[CasePageDataExtractor] Using cached data:', cacheValidation.reason);
    return;
} else {
    console.log('[CasePageDataExtractor] Cache invalid, re-extracting:', cacheValidation.reason);
    this.lastExtractedData = null; // Clear stale cache
}
```

✅ **Validates** cache using multi-layered validation (TTL, Last Modified Date, field-level checks).

## Root Cause

**CaseDetailExtractor** does NOT validate:
1. ❌ Whether cached `caseData.caseId` matches the current URL case ID
2. ❌ Whether cached data is stale (no TTL or Last Modified Date check)
3. ❌ Whether `window.ExLibrisExtension.currentCaseId` matches the URL case ID

## Impact

- **High Risk**: Mixed data (Case B ID with Case A details)
- **Data Integrity**: Exported XML/TSV may contain incorrect case information
- **User Confusion**: Wrong case details in exported data
- **Downstream Issues**: Any module consuming this data will receive incorrect information

## Recommended Fix

### Option 1: Add Case ID Validation (Quick Fix)

```javascript
async function extractCaseDetails() {
    const details = {};
    
    // Extract Case ID from URL FIRST
    const urlMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
    const currentCaseId = urlMatch?.[1] || null;
    details.caseId = currentCaseId;
    
    // Try to get cached data, but VALIDATE it matches current case
    let caseData = null;
    if (typeof window.ExLibrisExtension !== 'undefined' && 
        window.ExLibrisExtension.caseToolkit?.caseData) {
        
        const cachedData = window.ExLibrisExtension.caseToolkit.caseData;
        
        // ✅ VALIDATE: Check if cached data matches current case
        if (currentCaseId && 
            cachedData.caseId === currentCaseId &&
            window.ExLibrisExtension.currentCaseId === currentCaseId) {
            caseData = cachedData;
            console.log('[CaseDetailExtractor] Using validated cached case data');
        } else {
            console.warn('[CaseDetailExtractor] Cached data mismatch, ignoring cache:', {
                cachedCaseId: cachedData.caseId,
                currentCaseId: currentCaseId,
                globalCaseId: window.ExLibrisExtension.currentCaseId
            });
        }
    }
    
    // ... rest of extraction logic
}
```

### Option 2: Use PageContextValidator (Recommended)

```javascript
async function extractCaseDetails() {
    const details = {};
    
    // Extract Case ID from URL
    const urlMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
    const currentCaseId = urlMatch?.[1] || null;
    details.caseId = currentCaseId;
    
    // Try to get cached data, but VALIDATE using PageContextValidator
    let caseData = null;
    if (typeof window.ExLibrisExtension !== 'undefined' && 
        window.ExLibrisExtension.caseToolkit?.caseData) {
        
        const cachedData = window.ExLibrisExtension.caseToolkit.caseData;
        
        // ✅ VALIDATE using PageContextValidator
        if (typeof PageContextValidator !== 'undefined' && 
            typeof PageContextValidator.validatePageContextBeforeDisplay === 'function') {
            
            let validation = PageContextValidator.validatePageContextBeforeDisplay(
                cachedData.caseId, 
                cachedData.caseNumber
            );
            
            // Handle async validation
            if (validation instanceof Promise) {
                validation = await validation;
            }
            
            if (validation.valid) {
                caseData = cachedData;
                console.log('[CaseDetailExtractor] Using validated cached case data');
            } else {
                console.warn('[CaseDetailExtractor] Cached data validation failed:', validation.reason);
            }
        } else {
            // Fallback: Simple case ID check
            if (currentCaseId && cachedData.caseId === currentCaseId) {
                caseData = cachedData;
            }
        }
    }
    
    // ... rest of extraction logic
}
```

### Option 3: Always Extract Fresh (Safest, but slower)

```javascript
async function extractCaseDetails() {
    const details = {};
    
    // Extract Case ID from URL
    const urlMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
    details.caseId = urlMatch?.[1] || null;
    
    // Always extract fresh data (no cache)
    let caseData = null;
    if (typeof CaseDataExtractor !== 'undefined') {
        try {
            console.log('[CaseDetailExtractor] Extracting fresh case data...');
            caseData = await CaseDataExtractor.getData();
        } catch (error) {
            console.warn('[CaseDetailExtractor] Could not extract case data:', error);
        }
    }
    
    // ... rest of extraction logic
}
```

## Conclusion

**YES, CaseDetailExtractor CAN extract stale data** because:

1. ❌ It doesn't validate that cached `caseData.caseId` matches the current URL case ID
2. ❌ It doesn't check `window.ExLibrisExtension.currentCaseId` before using cached data
3. ❌ It doesn't validate data freshness (no TTL or Last Modified Date check)
4. ❌ It uses cached data fields (caseNumber, subject, etc.) without ensuring they match the current case

**Recommended Action**: Implement Option 2 (PageContextValidator) for consistency with other modules and robust validation.

---

## ✅ FIX IMPLEMENTED

**Status**: Fixed on [Date]

**Implementation**: Option 2 (PageContextValidator) has been implemented in `modules/caseDetailExtractor.js`

**Changes Made**:
1. Extract case ID from URL **FIRST** before checking cache
2. Validate cached data using `PageContextValidator.validatePageContextBeforeDisplay()` if available
3. Fallback to simple case ID validation if PageContextValidator unavailable
4. Re-validate after `prepareTools` completes (case might have changed during async operation)
5. Extract fresh data if validation fails
6. Log validation results for debugging

**Key Improvements**:
- ✅ Prevents stale data from being used
- ✅ Validates cache matches current case before use
- ✅ Consistent with other modules (PersistentBanner, CasePageDataExtractor)
- ✅ Graceful fallback if PageContextValidator unavailable
- ✅ Re-validates after async operations (prepareTools)
- ✅ Clear logging for debugging

**Testing Recommendations**:
1. Navigate from Case A to Case B, then trigger extraction → Should extract Case B data
2. Modify case in Salesforce, then trigger extraction → Should extract fresh data
3. Rapid navigation between cases → Should always extract current case data

