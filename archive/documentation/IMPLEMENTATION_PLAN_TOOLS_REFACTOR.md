# Implementation Plan: Tools Refactor & Panel Removal

## Overview
This plan outlines the refactoring of the Persistent Banner to:
1. Remove FlexipagePanelInjector and DynamicMenu modules
2. Replace "Show Panel" with "Tools" button group
3. Add "Wiki Shortcuts" section
4. Implement action-focused mode for tools
5. Add case navigation detection with warnings

---

## Phase 1: Removal of Deprecated Modules

### 1.1 Remove FlexipagePanelInjector References

**Files to modify:**
- `modules/persistentBanner.js`
- `content_script_exlibris.js`
- `manifest.json`

**Changes:**
1. Remove `handleFlexipagePanel()` method from `persistentBanner.js`
2. Change "Show Panel" button (action2) to "Tools" button
3. Remove all `FlexipagePanelInjector.*` calls from `content_script_exlibris.js`:
   - `FlexipagePanelInjector.setPreparationState()`
   - `FlexipagePanelInjector.updateContext()`
   - `FlexipagePanelInjector.setCaseSummary()`
   - `FlexipagePanelInjector.setSlot2Message()`
   - `FlexipagePanelInjector.setInitialMetadata()`
   - `FlexipagePanelInjector.setStatusMessage()`
   - `FlexipagePanelInjector.teardown()`
   - `FlexipagePanelInjector.registerActionHandler()`
   - `FlexipagePanelInjector.ensureInjected()`
4. Remove `flexipagePanelInjector.js` from `manifest.json` line 68

### 1.2 Remove DynamicMenu References

**Files to modify:**
- `content_script_exlibris.js`
- `manifest.json`

**Changes:**
1. Remove all `DynamicMenu.*` calls from `content_script_exlibris.js`:
   - `DynamicMenu.setSettings()`
   - `DynamicMenu.refresh()`
   - `DynamicMenu.removeAllMenus()`
2. Remove `dynamicMenu.js` from `manifest.json` line 48
3. Remove `buttonGroups` building logic that was only used for DynamicMenu

### 1.3 Extract Wiki Links

**Files to modify:**
- `modules/urlBuilder.js`

**Changes:**
1. Extract wiki links from `buildAllButtons()` method:
   - From `tools` group: Wiki link (Kibana wiki)
   - From `sql` group: SQL Wiki, SQL Alma, SQL Esploro
2. Create new method `getWikiLinks()` that returns array of wiki link objects:
   ```javascript
   [
     { label: 'Wiki', url: '...', icon: '...' },
     { label: 'SQL Wiki', url: '...', icon: '...' },
     { label: 'SQL Alma', url: '...', icon: '...' },
     { label: 'SQL Esploro', url: '...', icon: '...' }
   ]
   ```

---

## Phase 2: Banner UI Updates

### 2.1 Rename "Show Panel" to "Tools" and Move Existing Actions

**File:** `modules/persistentBanner.js`

**Changes:**
1. Update button HTML (line ~3200):
   ```html
   <button class="exl-banner-btn" data-action="tools" title="Open Tools menu">Tools</button>
   ```
2. Remove "Extract Comments" button (action1) from main action buttons
3. Remove "Copy Details" button (action3) from main action buttons
4. Rename actions:
   - "Extract Comments" → "Extract Case Comments"
   - "Copy Details" → "Copy Case Details"
5. Update action handler to open Tools collapsible section instead of calling `handleFlexipagePanel()`

### 2.2 Create "Tools" Collapsible Section

**File:** `modules/persistentBanner.js`

**Structure:**
```html
<div class="exl-banner-section exl-banner-tools" id="exl-banner-tools-section" style="display: none;">
  <div class="exl-banner-label exl-collapsible-header" data-toggle="tools">
    <span>Tools</span>
    <span class="exl-toggle-icon">▼</span>
  </div>
  <div class="exl-tools-container" id="exl-tools-container">
    <button class="exl-tool-btn" data-tool="timezone-inspector">Timezone Inspector</button>
    <button class="exl-tool-btn" data-tool="sql-wizard">SQL Wizard</button>
    <button class="exl-tool-btn" data-tool="customer-data">Add/Modify Customer Data</button>
    <button class="exl-tool-btn" data-action="action1" title="Extract and enable copy buttons for case comments">Extract Case Comments</button>
    <button class="exl-tool-btn" data-action="action3" title="Copy case details as XML or TSV">Copy Case Details</button>
  </div>
</div>
```

**Implementation:**
1. Add state variable: `toolsSectionVisible: false`
2. Add toggle handler for Tools section
3. Add click handlers for each tool button:
   - Timezone Inspector, SQL Wizard, Customer Data → trigger action-focused mode
   - Extract Case Comments (action1) → calls existing `handleCaseCommentExtractor()` method
   - Copy Case Details (action3) → calls existing `handleCopyDetails()` method
4. Update existing action handlers to use new button names in notifications/logs

### 2.3 Create "Wiki Shortcuts" Collapsible Section

**File:** `modules/persistentBanner.js`

**Structure:**
```html
<div class="exl-banner-section exl-banner-wiki" id="exl-banner-wiki-section" style="display: none;">
  <div class="exl-banner-label exl-collapsible-header" data-toggle="wiki">
    <span>Wiki Shortcuts</span>
    <span class="exl-toggle-icon">▼</span>
  </div>
  <div class="exl-wiki-container" id="exl-wiki-container">
    <!-- Populated dynamically from URLBuilder.getWikiLinks() -->
  </div>
</div>
```

**Implementation:**
1. Add state variable: `wikiSectionVisible: false`
2. Add method `populateWikiShortcuts()` that:
   - Calls `URLBuilder.getWikiLinks()` (if available)
   - Creates button elements for each wiki link
   - Appends to `#exl-wiki-container`
3. Add toggle handler for Wiki section

---

## Phase 3: Action-Focused Mode System

### 3.1 State Management

**File:** `modules/persistentBanner.js`

**New state variables:**
```javascript
// Action-focused mode state
actionFocusedMode: {
  active: false,
  currentTool: null, // 'timezone-inspector' | 'sql-wizard' | 'customer-data'
  originalCaseId: null,
  originalCaseNumber: null,
  originalCaseData: null
}
```

### 3.2 View Switching

**File:** `modules/persistentBanner.js`

**Methods to implement:**
1. `enterActionFocusedMode(toolName, caseData)`
   - Sets `actionFocusedMode.active = true`
   - Stores original case data
   - Hides normal banner sections
   - Shows tool-specific UI
   - Adds "Back" button

2. `exitActionFocusedMode()`
   - Sets `actionFocusedMode.active = false`
   - Restores normal banner view
   - Clears tool-specific UI

3. `renderActionFocusedView(toolName)`
   - Renders tool-specific UI based on `toolName`
   - Includes back button
   - Includes tool inputs/outputs area

### 3.3 Case Navigation Detection

**File:** `modules/persistentBanner.js`

**Implementation:**
1. In `handleContextUpdate()` or `handleStoreDataUpdate()`:
   - Check if `actionFocusedMode.active === true`
   - Compare current case ID with `actionFocusedMode.originalCaseId`
   - If different:
     - Add CSS class `exl-banner-stale-warning` to banner
     - Show warning message: `"{tool} is using data from case #{originalCaseNumber}. Please return to banner homepage to use data from currently viewed case #{currentCaseNumber}."`
     - Set banner background to red (`background-color: #ffebee` or similar)

2. When user clicks "Back" button:
   - Clear warning state
   - Exit action-focused mode
   - Banner returns to normal view with current case data

---

## Phase 4: Collapse Hierarchy Logic

### 4.1 Space Management

**File:** `modules/persistentBanner.js`

**Implementation:**
1. Add method `checkAndCollapseSections(expandingSection)`:
   - Check if banner height exceeds viewport or threshold
   - If space needed, collapse in order:
     1. Navigation History section
     2. Messages section
   - Only collapse if they are currently expanded

2. Call `checkAndCollapseSections()` when:
   - Tools section expands
   - Customer Env section expands
   - Wiki Shortcuts section expands

3. Add method `restoreCollapsedSections()`:
   - Restore previously collapsed sections when space becomes available
   - Called when a section collapses

---

## Phase 5: Tool Placeholder UIs

### 5.1 Timezone Inspector

**File:** `modules/persistentBanner.js`

**Placeholder UI:**
```html
<div class="exl-tool-view" data-tool="timezone-inspector">
  <div class="exl-tool-header">
    <h3>Timezone Inspector</h3>
    <button class="exl-back-btn" data-action="exit-tool">← Back</button>
  </div>
  <div class="exl-tool-content">
    <p>Timezone Inspector tool - specifications to be provided</p>
    <!-- Placeholder for future implementation -->
  </div>
</div>
```

**Note:** This tool uses action-focused mode.

### 5.2 SQL Wizard

**File:** `modules/persistentBanner.js`

**Placeholder UI:**
```html
<div class="exl-tool-view" data-tool="sql-wizard">
  <div class="exl-tool-header">
    <h3>SQL Wizard</h3>
    <button class="exl-back-btn" data-action="exit-tool">← Back</button>
  </div>
  <div class="exl-tool-content">
    <p>SQL Wizard tool - specifications to be provided</p>
    <!-- Placeholder for future implementation -->
  </div>
</div>
```

### 5.3 Add/Modify Customer Data

**File:** `modules/persistentBanner.js`

**Placeholder UI:**
```html
<div class="exl-tool-view" data-tool="customer-data">
  <div class="exl-tool-header">
    <h3>Add/Modify Customer Data</h3>
    <button class="exl-back-btn" data-action="exit-tool">← Back</button>
  </div>
  <div class="exl-tool-content">
    <p>Customer Data tool - specifications to be provided</p>
    <!-- Placeholder for future implementation -->
  </div>
</div>
```

**Note:** This tool uses action-focused mode.

### 5.4 Extract Case Comments

**File:** `modules/persistentBanner.js`

**Implementation:**
- This tool does NOT use action-focused mode
- Calls existing `handleCaseCommentExtractor()` method
- Button label: "Extract Case Comments"
- Moved from main action buttons (action1) to Tools section

### 5.5 Copy Case Details

**File:** `modules/persistentBanner.js`

**Implementation:**
- This tool does NOT use action-focused mode
- Calls existing `handleCopyDetails()` method (action3 handler)
- Button label: "Copy Case Details"
- Moved from main action buttons (action3) to Tools section

---

## Phase 6: CSS Updates

### 6.1 Action-Focused Mode Styles

**File:** `modules/styles/persistent-banner.css`

**New styles:**
```css
/* Action-focused mode */
.exl-banner.action-focused {
  /* Styles for focused mode */
}

.exl-banner-stale-warning {
  background-color: #ffebee !important;
  border-left: 4px solid #f44336;
}

.exl-tool-view {
  display: none;
  padding: 16px;
}

.exl-banner.action-focused .exl-tool-view[data-tool="active"] {
  display: block;
}

.exl-back-btn {
  /* Back button styles */
}

/* Collapsible sections */
.exl-collapsible-header {
  cursor: pointer;
  user-select: none;
}

.exl-collapsible-header .exl-toggle-icon {
  transition: transform 0.3s;
}

.exl-collapsible-header[aria-expanded="true"] .exl-toggle-icon {
  transform: rotate(180deg);
}
```

---

## Phase 7: Testing & Validation

### 7.1 Removal Validation
- [ ] Verify no console errors when FlexipagePanelInjector is undefined
- [ ] Verify no console errors when DynamicMenu is undefined
- [ ] Verify banner still renders correctly
- [ ] Verify other banner features still work

### 7.2 New Features Validation
- [ ] Tools section toggles correctly
- [ ] Wiki Shortcuts section toggles correctly
- [ ] Each tool enters action-focused mode
- [ ] Back button exits action-focused mode
- [ ] Case navigation warning appears correctly
- [ ] Collapse hierarchy works when space is needed

---

## Implementation Order

1. **Phase 1**: Remove deprecated modules (safest, least breaking)
2. **Phase 2**: Add new UI sections (Tools, Wiki Shortcuts)
3. **Phase 3**: Implement action-focused mode system
4. **Phase 4**: Add collapse hierarchy logic
5. **Phase 5**: Add tool placeholder UIs
6. **Phase 6**: Add CSS styling
7. **Phase 7**: Testing

---

## Notes

- Keep `flexipagePanelInjector.js` and `dynamicMenu.js` files in codebase initially (commented out or deprecated) for reference
- Can delete them after successful testing
- Wiki links are static URLs, no case data needed
- Action-focused mode preserves original case data even when navigating
- Collapse logic only triggers when space is actually needed (viewport check)

