# Ex Libris Extension - Feature Requirements Summary

**Date:** October 14, 2025  
**Purpose:** Complete requirements specification for Ex Libris Salesforce Extension rebuild

---

## Executive Summary

This document consolidates all feature requirements for the Ex Libris Salesforce extension. The extension enhances Salesforce Lightning with Esploro-specific features including field highlighting, dynamic menus, case comment tools, UI components, and data management.

**Key Statistics:**
- **9 Core Modules** (existing, need enhancement)
- **6 New Modules** required
- **6 Major Feature Categories**
- **Target Platform:** Salesforce Lightning (proquestllc.lightning.force.com)
- **Technology:** Chrome Extension (Manifest V3)

---

## Feature Categories

### 1. Core Logic & Page Identification ✅

**Status:** Partially implemented  
**Module:** `pageIdentifier.js`

**Requirements:**
- ✅ URL pattern matching for 6 page types
- ❌ Cache invalidation based on "Last Modified Date"
- ❌ Cache cleanup for old entries

**Page Types to Detect:**
1. Case Page: `/lightning/r/Case/{CaseID}/view`
2. Case Comments: `/lightning/r/Case/{CaseID}/related/CaseComments/view`
3. Cases List: `/lightning/o/Case/list`
4. Reports Home: `/lightning/o/Report/home`
5. Report Page: `/lightning/r/Report/{ReportID}/view`
6. Search Page: `/one/one.app#` + `forceSearch:searchPageDesktop`

**Cache Strategy:**
```javascript
{
  caseId: {
    lastModified: "10/14/2025 10:30 AM",
    data: { /* extracted case data */ },
    timestamp: 1697284200000
  }
}
```

---

### 2. Field Highlighting (Case Page Only) ⚠️

**Status:** Module exists, needs selector verification  
**Module:** `fieldHighlighter.js`

**Target Fields:**
| Field | Selector |
|-------|----------|
| Category | `records-record-layout-item[field-label="Category"]` |
| Sub-Category | `records-record-layout-item[field-label="Sub-Category"]` |
| Description | `records-record-layout-item[field-label="Description"]` |
| Status | `records-record-layout-item[field-label="Status"]` |
| Jira Section | `flexipage-component2[data-component-id="flexipage_fieldSection6"]` |

**Highlight Colors:**

**Empty (Red):**
- Input: `rgb(191, 39, 75)` = #BF274B
- Container: `rgb(255, 220, 230)` = #FFDCE6

**Filled (Yellow):**
- Input: `rgb(251, 178, 22)` = #FBB216
- Container: `rgb(255, 232, 184)` = #FFE8B8

**Logic:**
1. Wait for page load
2. Query all target fields
3. Check if value is empty/null
4. Apply red or yellow highlight
5. Use MutationObserver for lazy-loaded fields

---

### 3. Dynamic Menu & Data Extraction ⚠️

**Status:** Modules exist, need verification  
**Modules:** `urlBuilder.js`, `dynamicMenu.js`, `caseDataExtractor.js`

**Injection Points (User Configurable):**
1. **Card Actions:** `lightning-card slot[name="actions"]`
2. **Header Details:** `div.secondaryFields slot[name="secondaryFields"]`

**Data Fields to Extract:**
| Field | Salesforce Field Label |
|-------|------------------------|
| Ex Libris Account Number | "Ex Libris Account Number" |
| Affected Environment | "Affected Environment" |
| Product/Service Name | "Product/Service Name" |
| Asset | "Asset" (text + hyperlink) |
| JIRA ID | "Primary Jira" or similar |

**Derived Variables:**
```javascript
// From "Ex Libris Account Number": e.g., "61USC_INST"
institutionCode = "61USC_INST"

// From "Affected Environment": e.g., "ap02-prod-esploro"
server = "ap02"
serverRegion = "ap" // for UTC offset calculation

// Auto-filled in SQL queries
custID = "2620" // from customer list
instID = "2621" // from customer list
```

**Button Groups (6 total):**

1. **Live View**
   - Portal
   - Back Office

2. **Back Office Sections**
   - Configuration
   - Repositories
   - Asset Management
   - etc.

3. **Sandboxes**
   - SB1, SB2, SB3, PSB

4. **Kibana**
   - Link to Kibana logs

5. **Wiki**
   - Customer-specific wiki page

6. **Customer JIRA**
   - Link to customer's JIRA instance

**Button Label Styles (Configurable):**
- **Formal:** "Production Portal"
- **Casual:** "Portal"
- **Abbreviated:** "Prod"

**Analytics Refresh Time:**
```
UTC: 02:00 (AP region)
Local: 10:00 AM AWST (auto)
```
- Calculate UTC from server region
- Calculate local from user timezone (auto-detect or manual setting)

---

### 4. Case Comment Enhancements ⚠️

**Status:** Partially implemented  
**Modules:** `caseCommentMemory.js`, `characterCounter.js`, `textFormatter.js`

**Target Element:** `textarea[name="inputComment"]`

#### 4.1 Context Menu Features ❌ NOT IMPLEMENTED

**Character Replacement (Unicode):**
- Bold: "Hello" → "𝗛𝗲𝗹𝗹𝗼"
- Italic: "Hello" → "𝘏𝘦𝘭𝘭𝘰"
- Code: "Hello" → "𝙷𝚎𝚕𝚕𝚘"
- etc.

**Case Toggling:**
- Toggle Case: "Hello World" → "hELLO wORLD"
- CAPITAL CASE: "Hello World" → "HELLO WORLD"
- Sentence case: "hello world" → "Hello world"
- lower case: "Hello World" → "hello world"

**Symbol Insertion:**
- ▪ Bullet
- ∘ Open circle
- ► Arrow
- • Dot
- ✓ Check
- ✗ X
- etc.

#### 4.2 Case Comment Memory ✅ PARTIAL

**Current Implementation:**
- ✅ Auto-save to localStorage by case ID
- ✅ History queue (last 10 versions)

**Missing Features:**
- ❌ Enhanced restore UI with dropdown
- ❌ Content preview on hover
- ❌ Multi-tab sync detection & warning

**Required UI:**
```
[Restore ▼] button
  └─ Dropdown showing:
     10/14/2025 10:30 AM
     10/14/2025 10:15 AM (hover shows preview)
     10/14/2025 10:00 AM
     ...
```

**Multi-Tab Warning:**
```
⚠️ This case is being edited in another tab. Click here to switch.
```

#### 4.3 Character Counter ✅ IMPLEMENTED

**Position:** Left side of same row as "Save" button  
**Format:** "Characters: 245"

---

### 5. Additional UI Components ❌ NOT IMPLEMENTED

#### 5.1 Persistent Banner

**Requirements:**
- Fixed to top of page
- Height: `2rem`
- Always visible on scroll
- Z-index above Salesforce UI
- Collapsible to small circular button in **upper-left** corner

**Content - Normal Mode:**
```
Case #00123456 | Status: Open | Category: Technical | Sub: Configuration
```

**Content - Troubleshooting Mode:**
```
Page: Case Details | Function: FieldHighlighter.init() | Data Extracted: Yes
```

**Toggle:** Click button to switch between modes

#### 5.2 Collapsible Side Panel

**Requirements:**
- Initially hidden
- Slide in from right edge
- Resizable width
- Persists between page navigations
- Z-index below banner but above Salesforce content

**Content - Tab 1: Notepad**
- Rich text editor
- Image paste support
- Auto-save to chrome.storage.local by case ID
- Toolbar: Bold, Italic, Lists, Image

**Content - Tab 2: Code Editor**
- Syntax highlighting (detect language)
- Auto-save to chrome.storage.local by case ID
- Multiple code snippets per case
- Copy button

**Storage Structure:**
```javascript
{
  caseId: {
    notepad: {
      content: "<p>My notes...</p>",
      images: ["data:image/png;base64,..."]
    },
    codeSnippets: [
      { language: "sql", code: "SELECT * FROM...", label: "Query 1" },
      { language: "javascript", code: "function...", label: "Script 1" }
    ]
  }
}
```

#### 5.3 SQL Expression Generator

**Requirements:**
- Expandable section in main header card
- Click to expand/collapse
- Dropdown to select entity type

**Entity Types:**
- Researcher
- Asset
- Repository Item
- Institution
- Department
- etc.

**SQL Templates:**
```sql
-- Researcher Query
SELECT * FROM researcher 
WHERE cust_id = <CUST_ID> 
  AND inst_id = <INST_ID>
  AND researcher_id = '{researcher_id}';

-- Asset Query
SELECT * FROM asset 
WHERE cust_id = <CUST_ID> 
  AND inst_id = <INST_ID>
  AND asset_id = '{asset_id}';
```

**Auto-Fill:**
- `<CUST_ID>` → extracted from case data
- `<INST_ID>` → extracted from case data
- Highlight placeholders that still need manual input

**UI:**
```
[SQL Generator ▼]
  Entity: [Dropdown: Researcher]
  [Copy SQL] button
  
  Generated SQL:
  ┌─────────────────────────────────────┐
  │ SELECT * FROM researcher            │
  │ WHERE cust_id = 2620                │
  │   AND inst_id = 2621                │
  │   AND researcher_id = '{researcher_id}'; │
  └─────────────────────────────────────┘
```

---

### 6. Data Management (Popup Menu) ⚠️

**Status:** Not implemented  
**Required Module:** `customerDataManager.js`

#### 6.1 Customer List Management

**Default Customer List:**
- Embedded in extension (~100 Esploro customers)
- Data from reference implementation
- Fields: institutionCode, server, custID, instID, name, etc.

**Scraping Workflow:**
1. User clicks "Update Customer List" in popup
2. Extension opens "Esploro Customers" Wiki page in background tab
3. Content script scrapes table: `#main-content > div.table-wrap > table`
4. Parse rows and extract columns
5. Store in chrome.storage.local
6. Close background tab
7. Show success notification with timestamp

**Popup UI:**
```
┌─ Customer Data ────────────────────┐
│                                    │
│ ○ Use default list (embedded)     │
│ ● Use scraped list                 │
│   Last updated: 10/14/2025 10:30   │
│                                    │
│ [Update from Wiki]                 │
│ [Reset to Default]                 │
│                                    │
└────────────────────────────────────┘
```

**Storage:**
```javascript
{
  customerList: {
    source: "scraped", // or "default"
    lastUpdate: 1697284200000,
    data: [
      {
        institutionCode: "61USC_INST",
        server: "ap02",
        custID: "2620",
        instID: "2621",
        name: "University of the Sunshine Coast",
        // ... more fields
      },
      // ... more customers
    ]
  }
}
```

---

## Module Dependencies

### Load Order (manifest.json)
```javascript
"content_scripts": [{
  "matches": ["https://proquestllc.lightning.force.com/*"],
  "js": [
    // 1. Core modules (no dependencies)
    "modules/pageIdentifier.js",
    "modules/caseDataExtractor.js",
    
    // 2. Feature modules (depend on core)
    "modules/fieldHighlighter.js",
    "modules/urlBuilder.js",
    "modules/textFormatter.js",
    "modules/caseCommentMemory.js",
    "modules/characterCounter.js",
    "modules/dynamicMenu.js",
    "modules/caseCommentExtractor.js",
    
    // 3. NEW: UI component modules
    "modules/persistentBanner.js",
    "modules/sidePanel.js",
    "modules/sqlGenerator.js",
    
    // 4. NEW: Management modules
    "modules/cacheManager.js",
    "modules/customerDataManager.js",
    "modules/contextMenuHandler.js",
    "modules/multiTabSync.js",
    
    // 5. Main controller (last)
    "content_script_exlibris.js"
  ],
  "run_at": "document_idle"
}]
```

---

## Popup Settings UI Structure

### Tab 1: Features
```
┌─ Enable/Disable Features ─────────┐
│                                    │
│ ☑ Field Highlighting              │
│ ☑ Dynamic Menu                     │
│ ☑ Case Comment Memory              │
│ ☑ Character Counter                │
│ ☑ Case Comment Extractor           │
│ ☑ Context Menu (Right-click)       │
│ ☐ Persistent Banner                │
│ ☐ Side Panel                       │
│ ☑ SQL Generator                    │
│                                    │
└────────────────────────────────────┘
```

### Tab 2: Menu Settings
```
┌─ Dynamic Menu Configuration ──────┐
│                                    │
│ Injection Point:                   │
│ ○ Card Actions                     │
│ ● Header Details                   │
│                                    │
│ Button Label Style:                │
│ ○ Formal                           │
│ ● Casual                           │
│ ○ Abbreviated                      │
│                                    │
└────────────────────────────────────┘
```

### Tab 3: Display Settings
```
┌─ Display Preferences ─────────────┐
│                                    │
│ Timezone:                          │
│ ● Auto-detect (AWST)               │
│ ○ Manual: [Dropdown]               │
│                                    │
│ Banner Mode:                       │
│ ● Normal (Case Details)            │
│ ○ Troubleshooting (Debug Info)     │
│                                    │
└────────────────────────────────────┘
```

### Tab 4: Data Management
```
┌─ Customer Data ────────────────────┐
│                                    │
│ ○ Use default list (embedded)     │
│ ● Use scraped list                 │
│   Last updated: 10/14/2025 10:30   │
│                                    │
│ [Update from Wiki]                 │
│ [Reset to Default]                 │
│                                    │
│ Team Selection (Email Validation): │
│ [Dropdown: Penang CoE]             │
│                                    │
└────────────────────────────────────┘
```

---

## Implementation Priority

### High Priority (Core Features)
1. ✅ Page identification (existing, verify)
2. ✅ Cache management with last-modified
3. ✅ Field highlighting (verify selectors)
4. ✅ Dynamic menu (verify button groups)
5. ✅ Case data extraction (verify fields)

### Medium Priority (Enhancements)
6. ⚠️ Context menu (Unicode, case toggle, symbols)
7. ⚠️ Enhanced restore UI for comments
8. ⚠️ Multi-tab sync detection
9. ⚠️ Customer list scraping
10. ⚠️ Popup settings UI

### Low Priority (Nice to Have)
11. ❌ Persistent banner
12. ❌ Collapsible side panel
13. ❌ SQL expression generator

---

## Testing Scenarios

### Scenario 1: Case Page Load
1. Navigate to case page
2. Verify field highlighting appears within 2 seconds
3. Verify dynamic menu injected at configured location
4. Verify all button URLs are correct
5. Check console for errors

### Scenario 2: Case Navigation
1. Open case A
2. Features activate
3. Navigate to case B
4. Verify cleanup of case A features
5. Verify re-initialization for case B
6. Verify cache invalidation if last-modified changed

### Scenario 3: Context Menu
1. Open case comment textarea
2. Type and select text
3. Right-click → Ex Libris Tools → Bold
4. Verify text replaced with Unicode bold characters
5. Test case toggling
6. Test symbol insertion

### Scenario 4: Multi-Tab Editing
1. Open case in Tab A
2. Start typing comment
3. Open same case in Tab B
4. Verify warning banner appears in both tabs
5. Click hyperlink to switch tabs

### Scenario 5: Customer List Update
1. Open popup
2. Click "Update from Wiki"
3. Verify background tab opens Wiki page
4. Verify table scraped
5. Verify success notification
6. Verify timestamp updated
7. Verify toggle switches to "scraped"

---

## Success Metrics

1. **Performance:** Extension loads in < 500ms on case pages
2. **Memory:** No memory leaks after 100+ page navigations
3. **Storage:** Usage stays under 5MB (chrome.storage.local)
4. **Reliability:** All features work 99% of the time
5. **User Experience:** No breaking changes to Salesforce UI
6. **Maintainability:** All modules follow IIFE pattern with cleanup

---

## Next Actions

1. ✅ Review existing modules (verify selectors, logic)
2. ✅ Implement cache manager with last-modified tracking
3. ⚠️ Build context menu system (background + content script)
4. ⚠️ Enhance case comment restore UI
5. ⚠️ Add multi-tab sync detection
6. ⚠️ Build popup settings UI
7. ⚠️ Implement customer list scraping
8. ❌ Build persistent banner
9. ❌ Build side panel
10. ❌ Build SQL generator

---

**Document Version:** 1.0  
**Last Updated:** October 14, 2025  
**Status:** Ready for implementation
