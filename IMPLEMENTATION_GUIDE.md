# Ex Libris/Esploro Features - Implementation Guide

## Overview

This document provides a comprehensive guide to implementing the new Ex Libris/Esploro features for the Salesforce Chrome Extension. The features are designed specifically for the ProQuest Salesforce instance (`proquestllc.lightning.force.com`).

## Project Status

### Completed ✅

1. **Core Module Architecture**
   - `modules/pageIdentifier.js` - Page type detection and URL monitoring
   - `modules/caseDataExtractor.js` - Extracts case data from Salesforce DOM
   - `modules/fieldHighlighter.js` - Highlights empty/filled fields
   - `modules/urlBuilder.js` - Generates dynamic URLs based on case data
   - `modules/textFormatter.js` - Unicode text formatting for comments
   - `modules/caseCommentMemory.js` - Auto-saves case comments with history
   - `modules/dynamicMenu.js` - Injects custom button menus
   - `modules/characterCounter.js` - Character count for textarea

2. **Integration Script**
   - `content_script_exlibris.js` - Main controller integrating all modules

3. **Manifest Configuration**
   - Updated to load Ex Libris modules only on ProQuest SFDC
   - Maintains backward compatibility with existing features

### In Progress 🚧

The following features have been architected but require additional implementation:

1. **Context Menu for Text Formatting**
   - Right-click menu on textarea
   - Style selection (Bold, Italic, Code, etc.)
   - Case toggle options
   - Symbol insertion

2. **Caching System Enhancement**
   - localStorage-based caching
   - Last modified date tracking
   - Automatic cache invalidation

3. **Customer Data Sync from Wiki**
   - Table extraction from Confluence Wiki
   - Automatic customer list updates
   - Toggle between pre-defined and extracted data

4. **SQL Query Builder**
   - Dropdown interface for query selection
   - Dynamic placeholder replacement
   - Copy-to-clipboard functionality

5. **Collapsible Sidepanel**
   - Notepad section (rich text with images)
   - Code editor (syntax highlighting)
   - Per-case data persistence

6. **Enhanced Popup UI**
   - Settings for all new features
   - Timezone selector
   - Button label style selector
   - Menu injection location toggles

7. **Multi-tab Warning Banner**
   - Detects simultaneous case editing
   - Provides navigation link to active tab

---

## Architecture Overview

### Module System

The extension uses a modular architecture where each feature is isolated in its own file. This provides:

- **Maintainability**: Easy to update individual features
- **Testability**: Each module can be tested independently
- **Performance**: Only necessary modules are loaded
- **Scalability**: New features can be added without modifying existing code

### Data Flow

```
Page Load
    ↓
PageIdentifier detects page type
    ↓
ExLibrisExtension.handlePageChange()
    ↓
CaseDataExtractor gets case data
    ↓
Modules initialize based on page type:
    - FieldHighlighter
    - DynamicMenu
    - CaseCommentMemory
    - CharacterCounter
```

### Storage Strategy

- **chrome.storage.sync**: User settings (timezone, button labels, menu locations)
- **chrome.storage.local**: Case comment history, cached case data
- **In-memory Map**: Active entries, temporary state

---

## Feature Details

### 1. Page Identification

**File**: `modules/pageIdentifier.js`

**Status**: ✅ Complete

**Functionality**:
- Detects 6 page types via URL patterns
- Monitors URL changes using MutationObserver and popstate events
- Provides callbacks for page transitions

**Usage**:
```javascript
PageIdentifier.monitorPageChanges((pageInfo) => {
  console.log(pageInfo.type);    // 'case_page', 'cases_list', etc.
  console.log(pageInfo.caseId);  // Case ID if on case page
});
```

### 2. Field Highlighting

**File**: `modules/fieldHighlighter.js`

**Status**: ✅ Complete

**Functionality**:
- Highlights empty fields in red (`rgb(191, 39, 75)`)
- Highlights filled fields in yellow (`rgb(251, 178, 22)`)
- Uses lighter shades for containers
- Targets: Category, Sub-Category, Description, Status, Jira fields

**CSS Selectors**:
- `records-record-layout-item[field-label="Category"]`
- `records-record-layout-item[field-label="Sub-Category"]`
- `records-record-layout-item[field-label="Description"]`
- `records-record-layout-item[field-label="Status"]`
- `div[data-target-selection-name$="Problem_Root_Cause__c"]`

**Customization**:
```javascript
// Modify colors in fieldHighlighter.js
FieldHighlighter.colors.emptyInput = 'rgb(191, 39, 75)';
FieldHighlighter.colors.filledInput = 'rgb(251, 178, 22)';
```

### 3. Dynamic Menu Injection

**Files**: `modules/urlBuilder.js`, `modules/dynamicMenu.js`

**Status**: ✅ Core complete, needs UI integration

**Functionality**:
- Injects button groups into Salesforce UI
- Two injection points (configurable):
  - Card actions slot (within lightning-card)
  - Header details section (secondaryFields)
- Button groups:
  - **Production**: Live View, Back Office
  - **Sandboxes**: PSB/SB/SQA variants based on product type
  - **Tools**: Kibana (DC-aware), Wiki, System Status
  - **SQL**: SQL Wiki, Alma KB, Esploro KB
  - **Misc**: Customer JIRA
- Analytics refresh time display (UTC + local timezone)

**URL Templates**:
```javascript
Live View: https://{server}.alma.exlibrisgroup.com/esploro/?institution={institutionCode}
Back Office: https://{server}.alma.exlibrisgroup.com/mng/login?institute={institutionCode}&productCode=esploro&debug=true
Kibana: Dynamic based on DC mapping (NA04→dc01, EU00→dc03, etc.)
```

**Button Label Styles**:
- **Formal**: Portal, Researchers Profile, Repository
- **Casual**: Live View, Profiles, Back Office
- **Abbreviated**: LV, ERP, BO

### 4. Case Comment Memory

**File**: `modules/caseCommentMemory.js`

**Status**: ✅ Complete

**Functionality**:
- Auto-saves textarea content every 500ms (throttled)
- Maintains history of last 10 entries per case
- Inactivity timeout: 5 minutes
- Closes entry on:
  - Save button click
  - Field cleared manually
  - Page refresh
  - Inactivity timeout
- Restores previous entries via dropdown menu

**Storage Structure**:
```javascript
{
  "caseCommentMemory": {
    "[caseId]": [
      {
        "text": "Comment text...",
        "timestamp": 1735000000000,
        "closed": true
      },
      // ... up to 10 entries
    ]
  }
}
```

**UI Elements**:
- "Restore ▼" button next to Save
- Dropdown with timestamps
- Hover tooltip shows full text preview

### 5. Character Counter

**File**: `modules/characterCounter.js`

**Status**: ✅ Complete

**Functionality**:
- Displays `current / 4000` character count
- Color-coded based on usage:
  - Gray (< 75%)
  - Yellow (75-90%)
  - Orange (90-100%)
  - Red (> 100%)
- Positioned on left side of button row

### 6. Text Formatter

**File**: `modules/textFormatter.js`

**Status**: ✅ Complete (UI integration needed)

**Functionality**:
- Converts text to Unicode styled characters:
  - **Bold**: 𝗮𝗯𝗰 (Sans-serif bold)
  - **Bold Italic**: 𝙖𝙗𝙘
  - **Italic**: 𝘢𝘣𝘤
  - **Bold Serif**: 𝐚𝐛𝐜
  - **Code**: 𝚊𝚋𝚌 (Monospace)
- Case transformations (preserves formatting):
  - Toggle Case
  - Capital Case
  - Sentence Case
  - Lower Case
- Symbol insertion: ▪ ∘ ▫ ► ▻ ▸ ▹ ▿ ▾ ⋯ ⋮

**API**:
```javascript
TextFormatter.convertToStyle("Hello World", "bold");
// Returns: "𝗛𝗲𝗹𝗹𝗼 𝗪𝗼𝗿𝗹𝗱"

TextFormatter.toCapitalCase("hello world");
// Returns: "Hello World"
```

---

## Remaining Implementation Tasks

### Priority 1: Context Menu for Text Formatting

**What's Needed**:
1. Create context menu UI that appears on right-click in textarea
2. Menu structure:
   ```
   Format
     ├─ Bold
     ├─ Italic
     ├─ Bold Italic
     ├─ Bold Serif
     ├─ Code
     └─ Normal
   Case
     ├─ Toggle Case
     ├─ Capital Case
     ├─ Sentence Case
     └─ Lower Case
   Symbols
     ├─ ▪
     ├─ ∘
     └─ ...
   ```

**Implementation**:
```javascript
// Create modules/contextMenu.js
const ContextMenu = {
  create(x, y, selection) {
    // Create menu div at mouse position
    // Apply TextFormatter methods on click
    // Update textarea with formatted text
  },

  show(textarea) {
    textarea.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const selection = window.getSelection().toString();
      if (selection) {
        this.create(e.clientX, e.clientY, selection);
      }
    });
  }
};
```

### Priority 2: Customer Data Sync from Wiki

**What's Needed**:
1. Guide user to Wiki page for authentication
2. Extract table when page loads: `#main-content > div.table-wrap > table`
3. Convert to JSON using provided script
4. Store in `chrome.storage.local`
5. Add toggle in popup: "Use Extracted Data" vs "Use Default Data"

**Implementation**:
```javascript
// Create modules/customerDataSync.js
const CustomerDataSync = {
  wikiUrl: 'https://wiki.clarivate.io/spaces/EXLPS/pages/506201574/Esploro+Customers',

  async extractFromWiki() {
    // Inject table conversion script
    // Extract data
    // Save to storage
  },

  async getCustomerData(useExtracted = false) {
    if (useExtracted) {
      // Return from storage
    } else {
      // Return default hardcoded data
    }
  },

  matchCustomer(accountNumber, server) {
    // Find matching customer from list
  }
};
```

**Default Customer Data Structure**:
```javascript
const DEFAULT_CUSTOMERS = [
  {
    institutionCode: "TR_INTEGRATION_INST",
    server: "na05",
    custid: "550",
    instid: "561",
    esploroEdition: "Advanced",
    // ...
  }
];
```

### Priority 3: SQL Query Builder

**What's Needed**:
1. Expandable section below header details
2. Dropdown menus:
   - Entity type (Researcher, User, Organization, etc.)
   - Additional options based on entity type
3. Display SQL query with replaced placeholders
4. Copy button

**UI Mockup**:
```
┌─ SQL Query Builder ─────────────────────────┐
│ Entity: [Researcher ▼]                      │
│ Result: SELECT * FROM HFRUSER h             │
│         JOIN RESEARCH_PERSON rp             │
│           ON h.ID = rp.USER_ID              │
│         WHERE h.CUSTOMERID = 550            │
│           AND h.INSTITUTIONID = 561;        │
│         [Copy to Clipboard]                 │
└─────────────────────────────────────────────┘
```

**Implementation**:
```javascript
// Create modules/sqlQueryBuilder.js
const SQLQueryBuilder = {
  queries: {
    researcher: "SELECT h.USER_NAME, h.FIRST_NAME, h.LAST_NAME...",
    user: "SELECT ID, USER_NAME, FIRST_NAME...",
    // etc.
  },

  build(entityType, customerId, institutionId) {
    let query = this.queries[entityType];
    query = query.replace('<CUST_ID>', customerId);
    query = query.replace('<INST_ID>', institutionId);
    return query;
  },

  createUI(caseData) {
    // Create dropdown and result display
    // Use URLBuilder to lookup customer data
  }
};
```

### Priority 4: Collapsible Sidepanel

**What's Needed**:
1. Circular button in upper-left corner
2. Slides out sidepanel on click
3. Two sections:
   - **Notepad**: Rich text editor with image support
   - **Code Viewer**: Simple syntax-highlighted editor
4. Tab switcher between sections
5. Per-case persistence

**Implementation**:
```javascript
// Create modules/sidepanel.js
const Sidepanel = {
  storageKey: 'caseSidepanelData',

  create() {
    // Create panel HTML
    // Position: fixed, left: 0, top: 50px
    // Width: 300px (collapsed) / 500px (expanded)
  },

  async load(caseId) {
    // Load notepad and code data for this case
  },

  async save(caseId, data) {
    // Save to storage
  },

  initializeNotepad() {
    // Use contenteditable div
    // Support image paste
  },

  initializeCodeEditor() {
    // Simple textarea with basic syntax highlighting
  }
};
```

**Storage Structure**:
```javascript
{
  "caseSidepanelData": {
    "[caseId]": {
      "notepad": "<div>Rich HTML content...</div>",
      "code": "// Code content\nSELECT * FROM..."
    }
  }
}
```

### Priority 5: Enhanced Popup UI

**What's Needed**:
1. New tab or section for Ex Libris settings
2. Settings to add:
   - Timezone selector (dropdown with common zones + auto-detect)
   - Button label style (Formal / Casual / Abbreviated)
   - Menu injection locations (checkboxes for Card Actions / Header Details)
   - Field highlighting toggle
   - Link to Wiki sync page
   - Data source toggle (Default / Extracted)

**Implementation**:
Update `popup.html` to add new section:

```html
<h2 class="descriptionTitle">⚙️ Ex Libris/Esploro Settings</h2>

<label>Timezone</label>
<select id="timezoneSelect">
  <option value="auto">Auto-detect</option>
  <option value="America/New_York">Eastern Time</option>
  <option value="America/Chicago">Central Time</option>
  <option value="America/Los_Angeles">Pacific Time</option>
  <option value="Europe/London">London</option>
  <option value="Asia/Singapore">Singapore</option>
</select>

<label>Button Label Style</label>
<select id="labelStyleSelect">
  <option value="casual">Casual (Live View, Back Office)</option>
  <option value="formal">Formal (Portal, Repository)</option>
  <option value="abbreviated">Abbreviated (LV, BO)</option>
</select>

<label>Menu Locations</label>
<label><input type="checkbox" id="menuCardActions"> Card Actions</label>
<label><input type="checkbox" id="menuHeaderDetails" checked> Header Details</label>

<label><input type="checkbox" id="fieldHighlighting" checked> Enable Field Highlighting</label>

<h3>Customer Data</h3>
<button id="syncCustomerData">Sync from Wiki</button>
<label><input type="radio" name="dataSource" value="default" checked> Use Default Data</label>
<label><input type="radio" name="dataSource" value="extracted"> Use Extracted Data</label>
```

Update `popup.js` to save these settings to `chrome.storage.sync`.

### Priority 6: Multi-Tab Warning Banner

**What's Needed**:
1. Detect when same case is open in multiple tabs
2. Show banner at top of page
3. Provide link to navigate to active editing tab

**Implementation**:
```javascript
// Add to modules/caseCommentMemory.js or create modules/multiTabDetector.js
const MultiTabDetector = {
  async checkForActiveTabs(caseId) {
    // Query all tabs with same case URL
    const tabs = await chrome.tabs.query({
      url: `*://proquestllc.lightning.force.com/*/Case/${caseId}/*`
    });

    if (tabs.length > 1) {
      // Check if any tab has active entry
      const activeEntry = CaseCommentMemory.activeEntries.get(caseId);
      if (activeEntry && activeEntry.isActive) {
        this.showBanner(tabs[0].id); // Link to first tab
      }
    }
  },

  showBanner(tabId) {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgb(251, 178, 22);
      color: white;
      padding: 12px;
      text-align: center;
      z-index: 10000;
    `;
    banner.innerHTML = `
      ⚠️ This case is being edited in another tab.
      <a href="#" style="color: white; text-decoration: underline;">Click here to switch.</a>
    `;

    banner.querySelector('a').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.update(tabId, { active: true });
    });

    document.body.insertBefore(banner, document.body.firstChild);
  }
};
```

---

## Testing Checklist

### Module Testing

- [ ] **PageIdentifier**: Test on all 6 page types
- [ ] **CaseDataExtractor**: Verify all fields extracted correctly
- [ ] **FieldHighlighter**: Test empty vs filled fields, all field types
- [ ] **URLBuilder**: Test all button URLs with sample case data
- [ ] **TextFormatter**: Test all styles and case transformations
- [ ] **CaseCommentMemory**: Test save, restore, timeout, multi-tab
- [ ] **DynamicMenu**: Test both injection locations
- [ ] **CharacterCounter**: Test color changes at thresholds

### Integration Testing

- [ ] Navigate between different page types
- [ ] Refresh case page and verify cache usage
- [ ] Test with different timezone settings
- [ ] Test with different button label styles
- [ ] Test menu toggle settings

### Edge Cases

- [ ] Case with missing Ex Libris Account Number
- [ ] Case with non-standard Affected Environment format
- [ ] Textarea cleared while comment is being auto-saved
- [ ] Page navigated away during auto-save
- [ ] Multiple tabs editing same case simultaneously

---

## Performance Considerations

### Current Performance Optimizations

1. **Throttled Auto-Save**: 500ms delay prevents excessive storage writes
2. **Caching**: Case data cached to avoid re-extraction on every DOM change
3. **Conditional Loading**: Modules only loaded on ProQuest SFDC
4. **MutationObserver Scoping**: Field highlighter targets specific elements

### Recommended Optimizations

1. **Debounce MutationObserver**: Add 100-200ms debounce to field highlighter
2. **Lazy Loading**: Load sidepanel code only when button is clicked
3. **IndexedDB**: Consider using IndexedDB for large history/cache data
4. **Web Workers**: Move customer data lookups to background thread

---

## Deployment Instructions

### Development Testing

1. **Load Extension Unpacked**:
   ```
   1. Open chrome://extensions/
   2. Enable "Developer mode"
   3. Click "Load unpacked"
   4. Select the "3.0" directory
   ```

2. **Navigate to ProQuest Salesforce**:
   ```
   https://proquestllc.lightning.force.com/
   ```

3. **Open a Case**:
   - Check browser console for initialization messages
   - Verify modules loaded: `[ExLibris Extension] Initializing...`

4. **Test Features**:
   - Field highlighting should appear automatically
   - Buttons should appear in header
   - Character counter should appear when focusing textarea

### Production Deployment

1. **Update Version**: Increment version in `manifest.json`

2. **Test All Features**: Complete testing checklist above

3. **Create CRX Package**:
   ```bash
   # Using Chrome
   chrome --pack-extension=./3.0 --pack-extension-key=private-key.pem
   ```

4. **Deploy**: Upload to Chrome Web Store or distribute internally

---

## Troubleshooting

### Common Issues

**Issue**: Modules not loading
- **Check**: Browser console for errors
- **Solution**: Verify all module files exist in `/modules/` directory

**Issue**: Buttons not appearing
- **Check**: PageIdentifier correctly detecting page type
- **Solution**: Add console.log in `handlePageChange()` to debug

**Issue**: Field highlighting not working
- **Check**: CSS selectors match current Salesforce DOM structure
- **Solution**: Inspect element and update selectors in `fieldHighlighter.js`

**Issue**: Character counter misaligned
- **Check**: Button row element structure
- **Solution**: Update `findButtonRow()` logic in `characterCounter.js`

**Issue**: Case comment not saving
- **Check**: chrome.storage.local permissions
- **Solution**: Verify "storage" permission in manifest.json

**Issue**: URLs incorrect
- **Check**: Case data extraction
- **Solution**: Use `ExLibrisExtension.getCaseData()` in console to debug

### Debug Commands

Open browser console on Salesforce page:

```javascript
// Check current page info
PageIdentifier.identifyPage()

// Get case data
ExLibrisExtension.getCaseData(ExLibrisExtension.currentCaseId)

// Test text formatter
TextFormatter.convertToStyle("Hello", "bold")

// Check active comment entry
CaseCommentMemory.activeEntries

// Manually refresh all features
ExLibrisExtension.refresh()
```

---

## Future Enhancements

### Phase 2 Features (Not Yet Planned)

1. **Bulk Case Operations**: Process multiple cases at once
2. **Report Builder**: Generate analytics reports from case data
3. **Integration with External Tools**: Direct links to Jira, Confluence
4. **AI-Powered Suggestions**: Suggest case resolutions based on history
5. **Email Template Generator**: Create customer emails from templates
6. **Case Timeline Visualization**: Visual timeline of case events

---

## Support & Maintenance

### Code Ownership

- **Original Extension**: Muhammad Amir Faaiz Shamsol Nizam
- **Ex Libris Features**: To be assigned

### Documentation

- **Codebase Analysis**: `explanation.md`
- **Implementation Guide**: This file
- **Module Documentation**: Inline JSDoc comments in each module

### Contribution Guidelines

1. Follow existing code style
2. Add JSDoc comments for all public functions
3. Test across all supported Salesforce instances
4. Update this guide when adding new features
5. Use meaningful commit messages

---

## Appendix

### A. Complete List of Modules

| Module | File | Lines | Status | Priority |
|--------|------|-------|--------|----------|
| Page Identifier | pageIdentifier.js | ~150 | ✅ Complete | P0 |
| Case Data Extractor | caseDataExtractor.js | ~200 | ✅ Complete | P0 |
| Field Highlighter | fieldHighlighter.js | ~180 | ✅ Complete | P1 |
| URL Builder | urlBuilder.js | ~300 | ✅ Complete | P0 |
| Text Formatter | textFormatter.js | ~250 | ✅ Complete | P1 |
| Case Comment Memory | caseCommentMemory.js | ~400 | ✅ Complete | P0 |
| Dynamic Menu | dynamicMenu.js | ~250 | ✅ Complete | P0 |
| Character Counter | characterCounter.js | ~100 | ✅ Complete | P1 |
| Context Menu | contextMenu.js | 0 | 🚧 Pending | P1 |
| Customer Data Sync | customerDataSync.js | 0 | 🚧 Pending | P2 |
| SQL Query Builder | sqlQueryBuilder.js | 0 | 🚧 Pending | P2 |
| Sidepanel | sidepanel.js | 0 | 🚧 Pending | P2 |
| Multi-Tab Detector | multiTabDetector.js | 0 | 🚧 Pending | P3 |

**Total Implemented**: ~1,830 lines of code across 8 modules

### B. Storage Schema

```javascript
// chrome.storage.sync (user settings)
{
  "exlibrisSettings": {
    "menuLocations": {
      "cardActions": false,
      "headerDetails": true
    },
    "buttonLabelStyle": "casual",
    "timezone": null,
    "highlightingEnabled": true,
    "customerDataSource": "default"
  },
  "savedSelection": "EndNote" // Existing setting
}

// chrome.storage.local (case data)
{
  "caseCommentMemory": {
    "[caseId]": [
      { "text": "...", "timestamp": 123, "closed": true }
    ]
  },
  "caseSidepanelData": {
    "[caseId]": {
      "notepad": "<html>",
      "code": "SELECT ..."
    }
  },
  "extractedCustomerData": [
    { "institutionCode": "...", "server": "..." }
  ],
  "caseDataCache": {
    "[caseId]": {
      "exLibrisAccountNumber": "...",
      "lastModifiedDate": "...",
      // ...
    }
  }
}
```

### C. URL Reference

**Salesforce Instances**:
- Production: `https://proquestllc.lightning.force.com/`
- Sandbox: `https://clarivateanalytics--preprod.sandbox.lightning.force.com/`

**Ex Libris Environments**:
- Production: `https://{server}.alma.exlibrisgroup.com/`
- Premium Sandbox: `https://psb-{server}.alma.exlibrisgroup.com/`
- Standard Sandbox: `https://sb-{server}.alma.exlibrisgroup.com/`
- SQA: `https://sqa-{server}.alma.exlibrisgroup.com/`

**Kibana**: 8 DCs mapped in `urlBuilder.js`

**Wiki**: `https://wiki.clarivate.io/`

**Jira**: `https://jira.clarivate.io/`

---

**Last Updated**: 2025-10-14
**Version**: 1.0
**Author**: Implementation Guide by Claude Code
