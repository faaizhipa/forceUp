# Ex Libris Salesforce Extension - Implementation Plan

**Last Updated:** October 14, 2025  
**Status:** Planning Phase  
**Target:** Complete feature parity with reference implementation + enhancements

---

## Overview

This document outlines the complete implementation plan for rebuilding the Ex Libris Salesforce extension with a clean, modular architecture. The extension enhances Salesforce Lightning with Esploro-specific features.

---

## 1. Core Logic & Page Identification ✅ (Partial)

### Current State
- ✅ `PageIdentifier` module exists
- ✅ URL pattern matching implemented
- ⚠️ Missing cache management based on "last modified date"

### Requirements
- **Platform:** Salesforce Lightning (proquestllc.lightning.force.com)
- **Page Types:**
  - Case Page: `/lightning/r/Case/{CaseID}/view`
  - Case Comments: `/lightning/r/Case/{CaseID}/related/CaseComments/view`
  - Cases List: `/lightning/o/Case/list`
  - Reports Home: `/lightning/o/Report/home`
  - Report Page: `/lightning/r/Report/{ReportID}/view`
  - Search Page: `/one/one.app#` + `forceSearch:searchPageDesktop`

### Remaining Tasks
- [ ] Implement cache invalidation based on "Last Modified Date" field
- [ ] Add cache metadata structure (lastModified, caseData, timestamp)
- [ ] Add cache cleanup for old entries (> 30 days)

---

## 2. Field Highlighting (Case Page Only) ✅ (Partial)

### Current State
- ✅ `FieldHighlighter` module exists
- ⚠️ Need to verify selectors match new requirements

### Requirements

**Target Fields:**
1. **Category** - `records-record-layout-item[field-label="Category"]`
2. **Sub-Category** - `records-record-layout-item[field-label="Sub-Category"]`
3. **Description** - `records-record-layout-item[field-label="Description"]`
4. **Status** - `records-record-layout-item[field-label="Status"]`
5. **Jira Section** - `flexipage-component2[data-component-id="flexipage_fieldSection6"]`

**Highlighting Rules:**
- **Empty (Red):**
  - Input: `rgb(191, 39, 75)` 
  - Container: `rgb(255, 220, 230)`
- **Filled (Yellow):**
  - Input: `rgb(251, 178, 22)`
  - Container: `rgb(255, 232, 184)`

### Remaining Tasks
- [ ] Update selectors in `FieldHighlighter` module
- [ ] Add Jira section targeting logic
- [ ] Implement MutationObserver for lazy-loaded fields
- [ ] Add toggle in popup settings

---

## 3. Dynamic Menu & Data Extraction ✅ (Partial)

### Current State
- ✅ `URLBuilder` module exists
- ✅ `DynamicMenu` module exists
- ✅ `CaseDataExtractor` module exists
- ⚠️ Need to verify injection points and button groups

### Requirements

**Injection Points (Configurable):**
1. Card Actions: `lightning-card slot[name="actions"]`
2. Header Details: `div.secondaryFields slot[name="secondaryFields"]`

**Data Fields to Extract:**
- Ex Libris Account Number
- Affected Environment
- Product/Service Name
- Asset (text + hyperlink)
- JIRA ID

**Derived Variables:**
- Institution Code (from Account Number)
- Server & Server Region (from Affected Environment)

**Button Groups:**
1. Live View
2. Back Office
3. Sandboxes
4. Kibana
5. Wiki
6. Customer JIRA

**Button Label Styles:**
- Formal
- Casual
- Abbreviated

**Analytics Refresh Time:**
- Display UTC time based on server region
- Display local time based on user timezone (auto-detect or manual)
- Show "(auto)" label when timezone is inferred

### Remaining Tasks
- [ ] Verify all button groups match reference implementation
- [ ] Add analytics refresh time calculation
- [ ] Implement timezone auto-detection
- [ ] Add popup settings for injection point selection
- [ ] Add popup settings for label style selection

---

## 4. Case Comment Enhancements ⚠️ (Partial)

### Current State
- ✅ `CaseCommentMemory` module exists
- ✅ `CharacterCounter` module exists
- ✅ `TextFormatter` module exists (partially)
- ❌ Context menu features NOT implemented
- ❌ Case toggling NOT implemented
- ❌ Symbol insertion NOT implemented

### Requirements

**Target Element:** `textarea[name="inputComment"]`

**Context Menu Features:**
1. **Character Replacement:**
   - Bold (Unicode bold characters)
   - Italic (Unicode italic characters)
   - Code (Unicode monospace characters)
   - etc.

2. **Case Toggling:**
   - Toggle Case
   - CAPITAL CASE
   - Sentence case
   - lower case
   - Preserve special Unicode characters

3. **Symbol Insertion Submenu:**
   - ▪ (bullet)
   - ∘ (open circle)
   - ► (arrow)
   - etc.

**Case Comment Memory:**
- ✅ Auto-save to localStorage by case ID
- ✅ History queue (last 10 versions)
- ⚠️ Restore UI needs enhancement
- ❌ Multi-tab sync warning NOT implemented

**Character Counter:**
- ✅ Live character count
- ⚠️ Verify positioning (left side of "Save" button row)

### Remaining Tasks
- [ ] Implement context menu system (chrome.contextMenus API)
- [ ] Add Unicode character replacement functions
- [ ] Add case toggling functions
- [ ] Add symbol insertion submenu
- [ ] Enhance restore UI with timestamp dropdown
- [ ] Add content preview on hover
- [ ] Implement multi-tab sync detection
- [ ] Add warning banner with hyperlink to other tab

---

## 5. Additional UI Components ❌ (Not Implemented)

### Persistent Banner
**Requirements:**
- Fixed to top of page
- Height: `2rem`
- Always visible on scroll
- Collapsible into small circular button in **upper-left** corner
- **Content:**
  - Normal Mode: Highlighted case details
  - Troubleshooting Mode: Function calls/page name

**Tasks:**
- [ ] Create `PersistentBanner` module
- [ ] Design banner UI (matching Salesforce Lightning theme)
- [ ] Implement collapse/expand animation
- [ ] Add mode toggle (Normal/Troubleshooting)
- [ ] Extract case details for display
- [ ] Add page name detection
- [ ] Add z-index management to ensure always on top

---

### Collapsible Side Panel
**Requirements:**
- Initially hidden
- Expandable from edge of page
- **Content:**
  - Case-specific notepad (with image support)
  - Tabbed code editor
  - Persistent notes tied to case ID

**Tasks:**
- [ ] Create `SidePanel` module
- [ ] Design panel UI with tabs
- [ ] Implement rich text notepad (support images)
- [ ] Add code editor with syntax highlighting
- [ ] Store notes in chrome.storage.local by case ID
- [ ] Add expand/collapse animation
- [ ] Add resize handle for panel width

---

### SQL Expression Generator
**Requirements:**
- Expandable section in main header card
- Dropdown series for entity selection:
  - Researcher
  - Asset
  - etc.
- Pre-defined SQL query generation
- Auto-fill placeholders:
  - `<CUST_ID>` from case data
  - `<INST_ID>` from case data

**Tasks:**
- [ ] Create `SQLGenerator` module
- [ ] Design expandable UI section
- [ ] Add entity dropdown options
- [ ] Create SQL query templates
- [ ] Implement placeholder replacement
- [ ] Add copy-to-clipboard button
- [ ] Add syntax highlighting for SQL

---

## 6. Data Management (Popup Menu) ⚠️ (Partial)

### Customer List Update
**Requirements:**
- Default customer list embedded in extension
- Popup feature to guide user to "Esploro Customers" Wiki page
- Auto-scrape table: `#main-content > div.table-wrap > table`
- Update internal customer data
- Toggle between default list and scraped list

**Current State:**
- ✅ Default customer list exists in reference implementation
- ❌ Popup UI NOT implemented
- ❌ Wiki scraping NOT implemented
- ❌ Toggle NOT implemented

**Tasks:**
- [ ] Extract default customer list from reference
- [ ] Add customer list to extension data
- [ ] Create popup section for customer list management
- [ ] Implement "Open Wiki Page" button
- [ ] Add content script for Wiki page detection
- [ ] Implement table scraping logic
- [ ] Store scraped data in chrome.storage.local
- [ ] Add toggle to switch between lists
- [ ] Display last update timestamp
- [ ] Add manual refresh button

---

## Module Architecture

### Existing Modules (Need Review/Enhancement)
1. ✅ `pageIdentifier.js` - Page type detection
2. ⚠️ `caseDataExtractor.js` - Extract case fields
3. ⚠️ `fieldHighlighter.js` - Highlight empty/filled fields
4. ⚠️ `urlBuilder.js` - Generate dynamic URLs
5. ⚠️ `textFormatter.js` - Format text (needs context menu)
6. ⚠️ `caseCommentMemory.js` - Auto-save comments
7. ⚠️ `dynamicMenu.js` - Inject button groups
8. ✅ `characterCounter.js` - Count characters
9. ✅ `caseCommentExtractor.js` - Extract comment history (NEWLY ADDED)

### New Modules Required
10. ❌ `persistentBanner.js` - Top banner UI
11. ❌ `sidePanel.js` - Side panel with notepad/editor
12. ❌ `sqlGenerator.js` - SQL query builder
13. ❌ `customerDataManager.js` - Customer list management
14. ❌ `contextMenuHandler.js` - Right-click menu features
15. ❌ `cacheManager.js` - Cache with last-modified tracking
16. ❌ `multiTabSync.js` - Cross-tab communication

---

## Implementation Phases

### Phase 1: Core Functionality Review (Week 1)
- [ ] Audit all existing modules
- [ ] Update selectors to match current Salesforce DOM
- [ ] Implement cache manager with last-modified tracking
- [ ] Fix any broken features

### Phase 2: Context Menu & Text Features (Week 2)
- [ ] Implement context menu system
- [ ] Add Unicode character replacement
- [ ] Add case toggling
- [ ] Add symbol insertion
- [ ] Enhance restore UI with previews
- [ ] Add multi-tab sync warnings

### Phase 3: UI Components (Week 3)
- [ ] Build persistent banner
- [ ] Build collapsible side panel
- [ ] Implement notepad with image support
- [ ] Add code editor with tabs
- [ ] Integrate SQL generator

### Phase 4: Data Management (Week 4)
- [ ] Extract and embed default customer list
- [ ] Build popup UI for settings
- [ ] Implement Wiki scraping
- [ ] Add customer list toggle
- [ ] Add timezone settings
- [ ] Add feature toggles

### Phase 5: Testing & Polish (Week 5)
- [ ] End-to-end testing on live Salesforce
- [ ] Performance optimization
- [ ] Memory leak testing
- [ ] Cross-browser compatibility
- [ ] Documentation update
- [ ] User guide creation

---

## Popup Settings Structure

```javascript
{
  // Feature Toggles
  features: {
    fieldHighlighting: true,
    dynamicMenu: true,
    caseCommentMemory: true,
    characterCounter: true,
    caseCommentExtractor: true,
    persistentBanner: true,
    sidePanel: false,
    sqlGenerator: true,
    contextMenu: true
  },
  
  // Menu Settings
  menu: {
    injectionPoints: {
      cardActions: false,
      headerDetails: true
    },
    buttonLabelStyle: 'casual', // 'formal', 'casual', 'abbreviated'
  },
  
  // Display Settings
  display: {
    timezone: null, // null = auto-detect
    bannerMode: 'normal', // 'normal', 'troubleshooting'
  },
  
  // Data Settings
  data: {
    useScrapedCustomerList: false,
    lastCustomerListUpdate: null,
    teamSelection: null // For email validation
  }
}
```

---

## Testing Checklist

### Case Page Features
- [ ] Field highlighting on empty fields (red)
- [ ] Field highlighting on filled fields (yellow)
- [ ] Dynamic menu injection at configured location
- [ ] All button groups generate correct URLs
- [ ] Analytics refresh time displays correctly
- [ ] Case comment auto-save on typing
- [ ] Restore dropdown shows last 10 versions
- [ ] Character counter updates in real-time
- [ ] Context menu appears on right-click
- [ ] Unicode character replacement works
- [ ] Case toggling preserves Unicode
- [ ] Symbol insertion works
- [ ] Multi-tab warning appears when applicable

### Navigation Features
- [ ] Features activate on case page load
- [ ] Features cleanup on page navigation
- [ ] Cache invalidates when last-modified changes
- [ ] Navigation monitoring detects case changes
- [ ] Persistent banner follows scroll
- [ ] Side panel persists between navigations

### Performance
- [ ] Extension loads in < 500ms
- [ ] MutationObserver doesn't cause lag
- [ ] No memory leaks after 100+ page navigations
- [ ] Storage usage < 5MB (chrome.storage.local)
- [ ] No conflicts with Salesforce Lightning

### Cross-Browser
- [ ] Chrome/Edge (primary)
- [ ] Firefox (if possible)

---

## Reference Files

- `./reference/extension_v3.3/content_script.js` - Reference implementation
- `./reference/extension_v3.3/background.js` - Background script reference
- Customer list data embedded in reference content_script.js

---

## Success Criteria

1. ✅ All features from requirements list implemented
2. ✅ Clean modular architecture maintained
3. ✅ Comprehensive documentation
4. ✅ < 500ms load time on case pages
5. ✅ No breaking changes to existing Salesforce UI
6. ✅ User-friendly popup settings
7. ✅ Robust error handling and logging
8. ✅ Passes all testing checklist items

---

**Next Step:** Begin Phase 1 - Core Functionality Review
