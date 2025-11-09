# Persistent Banner URL Synchronization Fix

**Date:** October 29, 2025  
**Issue:** Banner actions (Copy Details) use cached case data from previously viewed case instead of current case

---

## Problem Description

When navigating from one case to another using Salesforce's standard navigation:
1. User views **Case A** (e.g., 12345678)
2. Banner stores Case A's details in memory
3. User navigates to **Case B** (e.g., 87654321)
4. User clicks "Copy Details" button in banner
5. **BUG:** Clipboard contains details from Case A instead of Case B

### Root Cause

The `PersistentBanner` module was not monitoring URL changes, so:
- `currentPage` data became stale after navigation
- `CaseDetailExtractor` used cached data from `window.ExLibrisExtension.caseToolkit.caseData`
- Cached data was never refreshed when URL changed
- Actions triggered from banner used old case data

---

## Solution Implemented

### 1. Added URL Monitoring to Banner

**File:** `modules/persistentBanner.js`

Added automatic URL monitoring that:
- Checks URL every 500ms
- Detects navigation changes
- Resets `currentPage` data when URL changes
- Waits for content script to populate fresh data

**New Properties:**
```javascript
const PersistentBanner = {
    // ... existing properties
    
    // URL monitoring
    lastKnownUrl: null,
    urlMonitorInterval: null,
```

**New Methods:**

#### `startUrlMonitoring()`
```javascript
startUrlMonitoring() {
    this.lastKnownUrl = window.location.href;
    
    // Check URL every 500ms
    this.urlMonitorInterval = setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== this.lastKnownUrl) {
            console.log('[PersistentBanner] URL changed:', currentUrl);
            this.lastKnownUrl = currentUrl;
            this.handleUrlChange(currentUrl);
        }
    }, 500);
    
    console.log('[PersistentBanner] URL monitoring started');
}
```

#### `stopUrlMonitoring()`
```javascript
stopUrlMonitoring() {
    if (this.urlMonitorInterval) {
        clearInterval(this.urlMonitorInterval);
        this.urlMonitorInterval = null;
        console.log('[PersistentBanner] URL monitoring stopped');
    }
}
```

#### `handleUrlChange(newUrl)`
```javascript
handleUrlChange(newUrl) {
    console.log('[PersistentBanner] Handling URL change, resetting current page data');
    
    // Reset current page to initial state
    this.currentPage = {
        type: 'Unknown',
        caseNumber: null,
        subject: null,
        status: null,
        subStatus: null,
        url: newUrl,
        timestamp: new Date().toISOString()
    };
    
    // Update UI to show loading/unknown state
    this.updateBannerUI();
    
    // The content script will call updateCurrentPage with proper data after page analysis
    console.log('[PersistentBanner] Waiting for content script to update page data...');
}
```

### 2. Initialize URL Monitoring in `init()`

**Modified:** `init()` method

```javascript
init() {
    if (this.isInitialized) {
        console.log('[PersistentBanner] Already initialized');
        return;
    }

    console.log('[PersistentBanner] Initializing...');
    
    // Load navigation history from sessionStorage
    this.loadNavigationHistory();
    
    // Create and inject banner
    this.createBanner();
    
    // Observe DOM for the right injection point
    this.observeForInjection();
    
    // Start URL monitoring to detect navigation changes ← NEW
    this.startUrlMonitoring();
    
    this.isInitialized = true;
    console.log('[PersistentBanner] Initialized');
}
```

### 3. Force Fresh Data Extraction Before Copy

**Modified:** `handleCaseDetailExtractor()` method

Added logic to force refresh of cached case data before extraction:

```javascript
async handleCaseDetailExtractor() {
    // ... existing validation code

    // Force refresh of cached case data to ensure we're using current page data
    console.log('[PersistentBanner] Forcing refresh of case data before extraction');
    if (typeof window.ExLibrisExtension !== 'undefined' && 
        typeof CaseDataExtractor !== 'undefined') {
        try {
            // Clear cached data
            if (window.ExLibrisExtension.caseToolkit) {
                window.ExLibrisExtension.caseToolkit.caseData = null;
            }
            
            // Extract fresh data from current page
            const freshCaseData = await CaseDataExtractor.getData();
            
            // Update toolkit cache
            if (window.ExLibrisExtension.caseToolkit && freshCaseData) {
                window.ExLibrisExtension.caseToolkit.caseData = freshCaseData;
                console.log('[PersistentBanner] Refreshed case data:', freshCaseData.caseNumber);
            }
        } catch (error) {
            console.warn('[PersistentBanner] Error refreshing case data:', error);
        }
    }

    // ... rest of extraction logic
}
```

### 4. Clean Up URL Monitoring on Destroy

**Modified:** `cleanup()` method

```javascript
cleanup() {
    this.stopUrlMonitoring(); // ← NEW
    this.remove();
    this.isInitialized = false;
    console.log('[PersistentBanner] Cleaned up');
}
```

---

## How It Works

### Before Fix

```
User on Case A (12345678)
  ↓
ExLibrisExtension.caseToolkit.caseData = { caseNumber: "12345678", ... }
  ↓
User navigates to Case B (87654321)
  ↓
Banner.currentPage updates eventually
  ↓
ExLibrisExtension.caseToolkit.caseData = STILL { caseNumber: "12345678", ... }
  ↓
User clicks "Copy Details"
  ↓
CaseDetailExtractor uses cached data
  ↓
❌ Clipboard has Case A details instead of Case B
```

### After Fix

```
User on Case A (12345678)
  ↓
ExLibrisExtension.caseToolkit.caseData = { caseNumber: "12345678", ... }
  ↓
User navigates to Case B (87654321)
  ↓
Banner detects URL change (500ms polling)
  ↓
Banner.currentPage resets to Unknown
  ↓
Banner.updateBannerUI() shows loading state
  ↓
Content script analyzes new page
  ↓
Banner.updateCurrentPage({ caseNumber: "87654321", ... })
  ↓
User clicks "Copy Details"
  ↓
Banner.handleCaseDetailExtractor() clears cache
  ↓
CaseDataExtractor.getData() extracts fresh data
  ↓
ExLibrisExtension.caseToolkit.caseData = { caseNumber: "87654321", ... }
  ↓
CaseDetailExtractor uses fresh data
  ↓
✅ Clipboard has correct Case B details
```

---

## Testing Instructions

### Test Case 1: Basic Navigation

1. Navigate to **Case 12345678**
2. Wait for banner to show case details
3. Click "Copy Details" → Select TSV
4. Verify clipboard contains **12345678**
5. Navigate to **Case 87654321**
6. Wait for banner to update (should show "87654321")
7. Click "Copy Details" → Select TSV
8. Verify clipboard contains **87654321** ✅

### Test Case 2: Rapid Navigation

1. Navigate to **Case A**
2. Immediately navigate to **Case B** (don't wait for banner update)
3. Wait 2 seconds for page to settle
4. Click "Copy Details" → Select XML
5. Verify clipboard contains **Case B** details ✅

### Test Case 3: Browser Back/Forward

1. Navigate to **Case A**
2. Navigate to **Case B**
3. Click browser **Back** button
4. Wait for banner to update to **Case A**
5. Click "Copy Details" → Select TSV
6. Verify clipboard contains **Case A** details ✅
7. Click browser **Forward** button
8. Wait for banner to update to **Case B**
9. Click "Copy Details" → Select TSV
10. Verify clipboard contains **Case B** details ✅

### Test Case 4: Multiple Tabs

1. Open **Case A** in Tab 1
2. Copy details → verify Case A ✅
3. Open **Case B** in Tab 2
4. Copy details → verify Case B ✅
5. Switch back to Tab 1
6. Copy details → verify Case A ✅

---

## Edge Cases Handled

### 1. URL Changes Before Content Script Updates

**Scenario:** User navigates very quickly between cases

**Handling:**
- Banner immediately resets `currentPage` to Unknown
- UI shows loading state
- Action buttons check `currentPage.caseNumber` before executing
- Warning shown if user tries to act before page is ready

### 2. Content Script Slow to Update

**Scenario:** Page loads slowly, content script takes time to analyze

**Handling:**
- URL monitoring is independent of content script
- Banner waits for `updateCurrentPage()` call
- Fresh data extraction happens on demand in actions
- User sees accurate state in banner UI

### 3. Cache Corruption

**Scenario:** Cached data becomes inconsistent

**Handling:**
- `handleCaseDetailExtractor()` clears cache before extraction
- Fresh data always extracted from current DOM
- Cache refreshed with correct data after extraction

### 4. Non-Case Pages

**Scenario:** User navigates to non-case page (dashboard, reports, etc.)

**Handling:**
- URL monitoring continues running
- `currentPage.type` set to appropriate value by content script
- Action buttons validate page type before executing
- Warning shown if user tries case actions on non-case pages

---

## Performance Impact

**Negligible overhead:**
- URL check every 500ms (same as `CaseCommentMemory`)
- Simple string comparison: `currentUrl !== lastKnownUrl`
- No DOM queries in monitoring loop
- Cleanup properly stops interval on destroy

**Memory usage:**
- +2 properties: `lastKnownUrl` (string), `urlMonitorInterval` (number)
- Interval timer: ~100 bytes
- Total impact: < 1 KB

---

## Related Modules

### Affected by This Fix

1. **CaseDetailExtractor** - Now gets fresh data on demand
2. **FlexipagePanelInjector** - Banner refreshes force panel to update
3. **CaseCommentExtractor** - Benefits from accurate case detection

### Uses Same Pattern

1. **CaseCommentMemory** - Also uses URL monitoring (500ms interval)
2. **PageIdentifier** - Monitors page changes via MutationObserver

---

## Console Log Output

When working correctly, you'll see:

```
[PersistentBanner] Initializing...
[PersistentBanner] URL monitoring started
[PersistentBanner] Initialized

// User navigates to new case
[PersistentBanner] URL changed: https://example.lightning.force.com/lightning/r/Case/5003X00001AbCdE/view
[PersistentBanner] Handling URL change, resetting current page data
[PersistentBanner] Waiting for content script to update page data...
[ExLibris Extension] Page changed: {type: "Case", caseId: "5003X00001AbCdE"}
[PersistentBanner] Updated current page: {type: "Case", caseNumber: "12345678", ...}

// User clicks Copy Details
[PersistentBanner] Action triggered: action3
[PersistentBanner] Forcing refresh of case data before extraction
[CaseDetailExtractor] Using cached case data from ExLibrisExtension
[PersistentBanner] Refreshed case data: 12345678
```

---

## Rollback Instructions

If this fix causes issues:

```bash
cd "c:\Users\U6071248\Tools\00_Extension Revamp\4.0 - Dev01\3.0"

# Revert persistentBanner.js
git checkout HEAD~1 modules/persistentBanner.js

# Reload extension in Chrome
```

---

## Future Enhancements

### Potential Improvements

1. **Debounce URL Changes** - Prevent excessive resets during rapid navigation
2. **Visual Loading Indicator** - Show spinner in banner during data refresh
3. **Cache Validation** - Compare cached case ID with URL case ID
4. **Manual Refresh Button** - Allow users to force refresh banner data
5. **URL History** - Track URL changes for debugging

### Known Limitations

1. **500ms Delay** - Small window where URL changed but banner not updated yet
2. **No Pushstate Detection** - Relies on polling, not `popstate` event
3. **Multiple Instances** - If multiple banners exist, they monitor independently

---

## Changelog

### Version 4.0.1 - October 29, 2025

**Fixed:**
- ✅ Banner now refreshes when URL changes
- ✅ Copy Details action uses current page data, not cached data
- ✅ URL monitoring runs continuously at 500ms interval
- ✅ Cached case data cleared and refreshed before extraction

**Added:**
- ➕ `startUrlMonitoring()` method
- ➕ `stopUrlMonitoring()` method
- ➕ `handleUrlChange()` method
- ➕ `lastKnownUrl` property
- ➕ `urlMonitorInterval` property

**Changed:**
- 🔧 `init()` - Now starts URL monitoring
- 🔧 `cleanup()` - Now stops URL monitoring
- 🔧 `handleCaseDetailExtractor()` - Forces fresh data extraction

---

## Summary

This fix ensures the persistent banner always operates on **current page data** by:

1. **Monitoring URL changes** continuously (500ms polling)
2. **Resetting cached data** when navigation detected
3. **Forcing fresh extraction** before critical actions
4. **Proper cleanup** when banner is destroyed

Users will now always copy the **correct case details** regardless of navigation history or cached state.
