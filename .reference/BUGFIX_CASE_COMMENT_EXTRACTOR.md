# Case Comment Extractor Button Injection Fix

**Date:** October 29, 2025  
**Issue:** Extract Comments button in banner recognizes comments but doesn't inject copy buttons

---

## Problem Description

When clicking "Extract Comments" button in the persistent banner:
- Banner correctly detects that case comments exist
- Shows success message with comment count
- **BUG:** No "Copy Table" or "Copy XML" buttons appear in the action bar
- User cannot actually copy the comments

### Root Cause

Two issues were identified:

1. **Action Bar Selector Too Specific**
   - `tryInjectButtons()` only looked for one very specific selector
   - Selector: `.branding-actions.slds-button-group[data-aura-class="oneActionsRibbon forceActionsContainer"]`
   - This selector doesn't exist in all case page views (especially Communication tab)

2. **Wrong Execution Order in Banner**
   - Banner called `initialize()` first (which tries to inject buttons)
   - Then called `extractCaseComments()` to check if comments exist
   - But `initialize()` is async and uses observers, so buttons weren't injected yet when success message shown

---

## Solution Implemented

### 1. Enhanced Action Bar Detection (caseCommentExtractor.js)

**Added multiple fallback selectors:**

```javascript
function tryInjectButtons() {
    // Try multiple selectors for the action bar container
    const actionBarSelectors = [
        // Primary: Standard action bar (next to "New" button)
        '.branding-actions.slds-button-group[data-aura-class="oneActionsRibbon forceActionsContainer"]',
        // Fallback 1: Alternative action container
        '.branding-actions.slds-button-group',
        // Fallback 2: Any button group in the header area
        '.slds-page-header__detail-row .slds-button-group',
        // Fallback 3: Related list action bar
        'div[class*="forceRelatedListViewManager"] .slds-button-group',
        // Fallback 4: Case Comments related list action bar
        'article[aria-label*="Case Comments"] .slds-button-group'
    ];

    for (const selector of actionBarSelectors) {
        const actionContainer = document.querySelector(selector);
        
        if (actionContainer) {
            // Check if buttons already exist
            if (actionContainer.querySelector('[data-cc-extractor="true"]')) {
                console.log('[CaseCommentExtractor] Buttons already injected');
                buttonsInjected = true;
                return true;
            }
            
            console.log('[CaseCommentExtractor] Found action container with selector:', selector);
            addCopyButtons(actionContainer);
            buttonsInjected = true;
            return true;
        }
    }
    
    console.log('[CaseCommentExtractor] No suitable action container found');
    return false;
}
```

**Benefits:**
- Tries 5 different selectors in priority order
- Logs which selector succeeded
- Gracefully handles missing action bars

### 2. Improved Banner Logic (persistentBanner.js)

**Changed execution order and added validation:**

```javascript
async handleCaseCommentExtractor() {
    // ... validation code

    try {
        // First, check if comments table exists
        const data = CaseCommentExtractor.extractCaseComments();
        
        if (!data || !data.comments || data.comments.length === 0) {
            this.showNotification(
                'No comments found. Make sure you are on the Communications tab and Case Comments section is loaded.',
                'warning'
            );
            return;
        }

        console.log(`[PersistentBanner] Found ${data.comments.length} comment(s), attempting to inject buttons...`);

        // Initialize the extractor (this will inject buttons and set up observers)
        CaseCommentExtractor.initialize();
        
        // Wait longer for the buttons to be injected
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if buttons were actually injected
        const injectedButtons = document.querySelectorAll('[data-cc-extractor="true"]');
        
        if (injectedButtons.length > 0) {
            this.showNotification(
                `Found ${data.comments.length} comment(s). Copy buttons injected successfully.`,
                'success'
            );
        } else {
            // Buttons not injected, but we have data - offer alternative
            console.warn('[PersistentBanner] Buttons not injected, action bar not found');
            this.showNotification(
                `Found ${data.comments.length} comment(s), but could not inject buttons. The action bar may not be visible on this view.`,
                'warning'
            );
        }
    } catch (error) {
        console.error('[PersistentBanner] Error extracting comments:', error);
        this.showNotification('Error extracting comments: ' + error.message, 'error');
    }
}
```

**Key Changes:**
1. **Extract first, inject second** - Validates comments exist before attempting injection
2. **Longer wait time** - 1000ms instead of 500ms for DOM to settle
3. **Verify injection** - Checks if buttons actually appeared using `[data-cc-extractor="true"]`
4. **Better feedback** - Different messages for success vs action bar not found

---

## How It Works Now

### Before Fix

```
User clicks "Extract Comments"
  ↓
Banner calls initialize()
  ↓
initialize() looks for action bar with specific selector
  ↓
❌ Action bar not found (wrong view/tab)
  ↓
Banner calls extractCaseComments() after 500ms
  ↓
Comments found! Show success message
  ↓
❌ But no buttons were injected
```

### After Fix

```
User clicks "Extract Comments"
  ↓
Banner calls extractCaseComments() FIRST
  ↓
Comments found? Yes (5 comments)
  ↓
Banner calls initialize()
  ↓
initialize() tries 5 different action bar selectors
  ↓
✅ Selector #3 finds action bar
  ↓
Buttons injected successfully
  ↓
Wait 1000ms for DOM to settle
  ↓
Banner verifies buttons exist
  ↓
✅ Show success: "Found 5 comment(s). Copy buttons injected successfully."
```

---

## Testing Instructions

### Test Case 1: Standard Case View

1. Navigate to a case with comments
2. Click Communication tab
3. Ensure Case Comments section is visible
4. Click banner's "Extract Comments" button
5. **Expected:** Success message + Copy Table/Copy XML buttons appear

### Test Case 2: Case Comments Full View

1. Navigate to a case
2. Click "View All" on Case Comments related list
3. Click banner's "Extract Comments" button
4. **Expected:** Success message + buttons appear

### Test Case 3: No Comments

1. Navigate to a case with NO comments
2. Click banner's "Extract Comments" button
3. **Expected:** Warning message "No comments found..."

### Test Case 4: No Action Bar Visible

1. Navigate to a case page where action bar is hidden
2. Click banner's "Extract Comments" button
3. **Expected:** Warning message "...could not inject buttons. The action bar may not be visible on this view."

---

## Console Logs

When working correctly, you'll see:

```
[PersistentBanner] Action triggered: action1
[PersistentBanner] Found 5 comment(s), attempting to inject buttons...
[CaseCommentExtractor] Initializing Case Comment Extractor for case 5003X00001AbCdE...
[CaseCommentExtractor] Found action container with selector: .slds-page-header__detail-row .slds-button-group
[CaseCommentExtractor] Adding copy buttons to: <div class="slds-button-group">
[CaseCommentExtractor] Copy buttons added successfully.
[CaseCommentExtractor] Buttons injected successfully on first attempt.
[PersistentBanner] Found 5 comment(s). Copy buttons injected successfully.
```

If action bar not found:

```
[PersistentBanner] Action triggered: action1
[PersistentBanner] Found 5 comment(s), attempting to inject buttons...
[CaseCommentExtractor] Initializing Case Comment Extractor for case 5003X00001AbCdE...
[CaseCommentExtractor] No suitable action container found
[CaseCommentExtractor] Observer set up to watch for action bar.
[PersistentBanner] Buttons not injected, action bar not found
[PersistentBanner] Found 5 comment(s), but could not inject buttons. The action bar may not be visible on this view.
```

---

## Files Modified

1. **modules/caseCommentExtractor.js**
   - `tryInjectButtons()` - Added 5 fallback selectors for action bar

2. **modules/persistentBanner.js**
   - `handleCaseCommentExtractor()` - Reversed execution order, added verification

---

## Summary

The fix ensures that:
1. ✅ Comments are validated before attempting button injection
2. ✅ Multiple action bar locations are tried (not just one specific selector)
3. ✅ Button injection is verified before showing success message
4. ✅ User gets accurate feedback about what happened
5. ✅ Works in different case page views (standard, communication tab, full view)
