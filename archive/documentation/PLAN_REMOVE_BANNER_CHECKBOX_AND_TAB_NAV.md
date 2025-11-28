# Plan: Remove Persistent Banner Activation Section and Enable Tab Navigation

## Objectives

1. Remove the `#global-controls` banner activation section from popup menu (always enabled)
2. Remove all related implementation code for banner activation toggle
3. Ensure tab navigation works correctly through the page when the banner is present
4. Make banner buttons accessible via keyboard navigation

---

## Task 1: Remove Banner Activation Section from Popup HTML

### Files to Modify
- `popup.html`

### Implementation
- Remove the entire `#global-controls` div section (lines 425-438):
  ```html
  <div id="global-controls">
    <div id="banner-activation-section">
      <div class="activation-info">
        <span class="domain-label">Current Site:</span>
        <span id="current-site-domain" class="domain-value">Loading...</span>
      </div>
      <div class="activation-status-row">
        <span id="activation-status" class="status-badge status-inactive">●Inactive</span>
        <button id="toggle-banner-btn" class="toggle-btn" data-enabled="false">
          Activate Banner
        </button>
      </div>
    </div>
  </div>
  ```

- Remove related CSS styles (lines 42-138):
  - `#global-controls`
  - `#banner-activation-section`
  - `.activation-info`
  - `.domain-label`
  - `.domain-value`
  - `.activation-status-row`
  - `.status-badge` and variants
  - `.toggle-btn` and variants

---

## Task 2: Remove Banner Activation Functions from Popup JS

### Files to Modify
- `popup.js`

### Implementation
- Remove `loadBannerActivationUI()` function (lines 960-1045)
- Remove `updateBannerActivationUI()` function (lines 1051-1068)
- Remove the call to `loadBannerActivationUI()` in DOMContentLoaded event listener (line 1561)

---

## Task 3: Remove Related Storage/Domain Logic (if applicable)

### Files to Modify
- `popup.js`
- Potentially `modules/siteActivationManager.js` (if used for persistent banner)

### Implementation
- Check if `highlighterNotes.activeSites` is used for persistent banner activation
- If yes, remove or ignore this check in persistent banner initialization
- Ensure persistent banner always initializes regardless of `activeSites` settings
- Note: `SiteActivationManager` might be used for highlighter banner (different feature), so only remove persistent banner-specific logic

---

## Task 4: Ensure Persistent Banner Always Enabled

### Files to Modify
- `modules/persistentBanner.js`

### Implementation
- Update `isFeatureEnabled()` method to always return `true` (remove dependency on settings toggle)
- Update `shouldShowBanner()` to check only dismissal status, not feature toggle or domain activation
- Remove any checks for `highlighterNotes.activeSites` or domain-based activation
- Ensure banner initializes on all Salesforce domains regardless of activation settings

---

## Task 5: Remove Content Script Message Handler (if exists)

### Files to Modify
- `content_script_exlibris.js` or relevant content script

### Implementation
- Search for message handler with `action: 'toggleBanner'` that might disable persistent banner
- Remove or update handler to ignore persistent banner toggle messages
- Ensure banner cannot be toggled off via messages

---

## Task 6: Fix Tab Navigation - Banner Container

### Files to Modify
- `modules/persistentBanner.js` (createBanner method)
- `modules/styles/persistent-banner.css`

### Implementation
- Add `tabindex="-1"` to main banner container to exclude non-interactive wrapper from tab order
- Ensure banner container doesn't block tab navigation to page elements below
- Add CSS: `pointer-events: none` to banner container, but `pointer-events: auto` to interactive elements

### CSS Changes
```css
#exl-persistent-banner {
    /* ... existing styles ... */
    pointer-events: none; /* Allow clicks through to page */
}

#exl-persistent-banner * {
    pointer-events: auto; /* But allow interactions with banner elements */
}

/* Or more specifically */
#exl-persistent-banner .exl-banner-btn,
#exl-persistent-banner button,
#exl-persistent-banner a {
    pointer-events: auto;
    tabindex: 0; /* Make buttons keyboard accessible */
}
```

---

## Task 7: Make Banner Buttons Keyboard Accessible

### Files to Modify
- `modules/persistentBanner.js` (createBanner method)

### Implementation
- Ensure all interactive elements (buttons, links) have proper `tabindex="0"`
- Add keyboard event handlers for Enter/Space on buttons
- Ensure popup menus can be navigated with keyboard

### Button Attributes
- All `.exl-banner-btn` buttons should have `tabindex="0"`
- All `.exl-popup-menu-item` should have `tabindex="0"`
- Popup menus should be focusable when opened

---

## Task 8: Clean Up Unused Code

### Files to Review
- `popup.html`
- `popup.js`
- `modules/persistentBanner.js`
- `modules/siteActivationManager.js`

### Implementation
- Remove any unused CSS classes/styles related to banner activation
- Remove any comments referencing banner activation toggle
- Ensure no broken references remain

---

## Technical Implementation Details

### Tab Navigation Strategy
1. **Banner Container**: `tabindex="-1"` (excluded from tab order)
2. **Non-interactive elements** (labels, text): No tabindex needed
3. **Interactive elements** (buttons, links): `tabindex="0"` (in natural tab order)
4. **Popup menus when open**: Should be focusable and trap focus within
5. **Modals when open**: Should trap focus and restore on close

### Pointer Events Strategy
- Container uses `pointer-events: none` to allow clicks through to page
- Interactive elements use `pointer-events: auto` to receive clicks
- This allows banner to overlay page without blocking interactions

### Banner Always Enabled Strategy
- Remove all feature toggle checks
- Remove domain activation checks
- Keep dismissal logic (user can still dismiss banner per-session)
- Banner always initializes if not dismissed

---

## File Changes Summary

### Files to Modify

1. **popup.html**
   - Remove `#global-controls` HTML section (lines 425-438)
   - Remove related CSS styles (lines 42-138)

2. **popup.js**
   - Remove `loadBannerActivationUI()` function
   - Remove `updateBannerActivationUI()` function
   - Remove call to `loadBannerActivationUI()` in DOMContentLoaded

3. **modules/persistentBanner.js**
   - Update `isFeatureEnabled()` to always return `true`
   - Update `shouldShowBanner()` to check only dismissal
   - Remove domain activation checks
   - Add proper `tabindex` attributes to interactive elements

4. **modules/styles/persistent-banner.css**
   - Add `pointer-events` handling
   - Ensure tab navigation styling is correct

5. **content_script_exlibris.js** (if applicable)
   - Remove or update `toggleBanner` message handler for persistent banner

### Files to Review (No Changes Expected)

- `modules/siteActivationManager.js` - Only affects highlighter banner, not persistent banner

---

## Testing Checklist

- [ ] `#global-controls` section removed from popup
- [ ] Banner activation CSS styles removed
- [ ] `loadBannerActivationUI()` function removed
- [ ] No errors in popup console
- [ ] Persistent banner always appears (cannot be disabled)
- [ ] Tab navigation works through page when banner is present
- [ ] Banner buttons are accessible via Tab key
- [ ] Banner buttons can be activated with Enter/Space
- [ ] Focus doesn't get trapped in banner
- [ ] Clicking on banner non-interactive areas allows clicks through to page
- [ ] Banner interactive elements receive clicks correctly
- [ ] Popup menus are keyboard navigable
- [ ] Action-focused mode tool views are keyboard navigable
- [ ] Banner initializes on all Salesforce domains
- [ ] No broken references to removed functions

---

## Rollback Plan

If issues arise:
1. Restore `#global-controls` HTML in `popup.html`
2. Restore CSS styles in `popup.html`
3. Restore `loadBannerActivationUI()` and `updateBannerActivationUI()` in `popup.js`
4. Restore call to `loadBannerActivationUI()` in DOMContentLoaded
5. Revert `isFeatureEnabled()` changes in `persistentBanner.js`
6. Remove `pointer-events` CSS changes
