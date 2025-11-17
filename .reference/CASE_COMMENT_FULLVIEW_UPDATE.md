# Case Comment Extractor - Comments Full View Support

## Summary

Updated `modules/caseCommentExtractor.js` to support the **Case Comments Full View page** in addition to the existing Case Detail page support.

## Changes Made

### 1. Enhanced URL Detection

**Function**: `getCurrentCaseId()`

**Before**: Only matched case detail page URLs
```javascript
/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i
```

**After**: Supports both page types
- Case Detail: `/lightning/r/Case/[ID]` 
- Comments View: `/lightning/r/Case/[ID]/related/CaseComments/view`

```javascript
// Match case detail page
const caseDetailMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);

// Match case comments full view page
const caseCommentsMatch = window.location.pathname.match(/\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})\/related\/CaseComments\/view/i);
```

### 2. Improved Case Metadata Extraction

**Function**: `extractCaseMetadata()`

Added additional fallbacks for extracting case number from breadcrumbs when not on case detail page:

```javascript
// Additional fallback: Try to extract from breadcrumb or header on comments page
if (!caseNumber) {
    const breadcrumbLinks = document.querySelectorAll('nav[role="navigation"] a, .breadcrumb a');
    for (const link of breadcrumbLinks) {
        const linkText = link.textContent.trim();
        if (/^\d{8}$/.test(linkText)) {
            caseNumber = linkText;
            break;
        }
    }
}
```

### 3. Enhanced Action Bar Detection

**Function**: `tryInjectButtons()`

Added selectors specific to the comments full view page layout:

```javascript
const actionBarSelectors = [
    // Primary: Standard action bar (next to "New" button)
    '.branding-actions.slds-button-group[data-aura-class="oneActionsRibbon forceActionsContainer"]',
    
    // ✨ NEW: Case Comments full view page - List view action bar
    'lst-list-view-manager-header .slds-button-group',
    
    // ✨ NEW: Case Comments full view page - Alternative list view header
    'div.forceListViewManagerHeader .slds-button-group',
    
    // ✨ NEW: List view manager button groups
    'div.forceListViewManager .slds-button-group',
    
    // ✨ NEW: Any action buttons container in list view
    'lst-list-view-manager .actionsContainer .slds-button-group',
    
    // ... existing fallbacks
];
```

### 4. Enhanced Comments Container Detection

**Function**: `findCommentsTable()`

Reordered selectors to prioritize list view manager containers:

```javascript
const containerSelectors = [
    // ✨ PRIORITY: Case Comments full view page - list view manager
    'div.forceListViewManager',
    'div.test-listViewManager',
    'lst-list-view-manager',
    
    // Standard related list containers (case detail page)
    'article.slds-card[title*="Case Comments"]',
    // ... rest of selectors
];
```

### 5. Better Logging

**Function**: `initialize()`

Added page type detection in logs:

```javascript
// Determine page type for logging
const isCommentsPage = window.location.pathname.includes('/related/CaseComments/view');
const pageType = isCommentsPage ? 'case comments full view' : 'case detail';

console.log(`[CaseCommentExtractor] Initializing for case ${caseId} on ${pageType} page...`);
```

## URL Examples Supported

### Case Detail Page
```
https://proquestllc.lightning.force.com/lightning/r/Case/500QO00000nJ3EAYA0/view
```

### Case Comments Full View Page ✨ NEW
```
https://proquestllc.lightning.force.com/lightning/r/Case/500QO00000nJ3EAYA0/related/CaseComments/view
https://proquestllc.lightning.force.com/lightning/r/Case/500QO00000nJ3EAYA0/related/CaseComments/view?ws=%2Flightning%2Fr%2FReport%2F00OQO000006MKZJ2A4%2Fview%3FqueryScope%3DuserFolders
```

## Functionality

The module will now:

1. ✅ Detect when on a case comments full view page
2. ✅ Extract case ID from the URL pattern
3. ✅ Find the comments table in the list view manager
4. ✅ Inject "Copy Table" and "Copy XML" buttons into the list view action bar
5. ✅ Extract all visible comments from the table
6. ✅ Copy comments in TSV or XML format to clipboard

## Testing Checklist

- [ ] Navigate to case detail page → Verify buttons appear
- [ ] Click "View All" on Case Comments related list → Verify buttons appear on full view
- [ ] On comments full view page, click "Copy Table" → Verify TSV copied
- [ ] On comments full view page, click "Copy XML" → Verify XML copied
- [ ] Navigate between different cases → Verify buttons re-inject correctly
- [ ] Navigate from case detail to comments view → Verify buttons re-inject
- [ ] Navigate from comments view back to case detail → Verify buttons re-inject

## Browser Console Verification

Look for these log messages:

```
[CaseCommentExtractor] Initializing for case 500QO00000nJ3EAYA0 on case comments full view page...
[CaseCommentExtractor] Comments container found with selector (visible): div.forceListViewManager
[CaseCommentExtractor] Comments table found with selector (visible): table.slds-table
[CaseCommentExtractor] Found visible action container with selector: lst-list-view-manager-header .slds-button-group
[CaseCommentExtractor] Copy buttons added successfully.
```

## Technical Notes

- All existing functionality on case detail page remains unchanged
- The module already had visibility checks, so it only operates on visible elements
- The observer pattern ensures buttons are injected even if the page loads dynamically
- Case navigation detection works across both page types

## Backward Compatibility

✅ **100% backward compatible** - All existing functionality for case detail pages is preserved.

---

**Updated**: October 31, 2025  
**Module**: `modules/caseCommentExtractor.js`  
**Lines Changed**: ~50 lines across 5 functions
