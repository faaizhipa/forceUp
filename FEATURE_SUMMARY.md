# Ex Libris/Esploro Features - Quick Reference

## What's Been Built

### ✅ Fully Implemented (Ready to Test)

| Feature | Description | File |
|---------|-------------|------|
| **Page Detection** | Automatically identifies which Salesforce page you're on | `modules/pageIdentifier.js` |
| **Field Highlighting** | Empty fields = red, filled fields = yellow | `modules/fieldHighlighter.js` |
| **Dynamic Buttons** | Generates links to Live View, Back Office, Sandboxes, Kibana, etc. | `modules/urlBuilder.js` + `modules/dynamicMenu.js` |
| **Comment Auto-Save** | Automatically saves case comments every 500ms | `modules/caseCommentMemory.js` |
| **Comment History** | Restore previous versions (last 10) via dropdown | `modules/caseCommentMemory.js` |
| **Character Counter** | Shows character count with color-coded warnings | `modules/characterCounter.js` |
| **Text Formatter** | Convert text to 𝗯𝗼𝗹𝗱, 𝘪𝘵𝘢𝘭𝘪𝘤, 𝚌𝚘𝚍𝚎, etc. | `modules/textFormatter.js` |
| **Data Extractor** | Pulls case data (account #, server, product, etc.) | `modules/caseDataExtractor.js` |

### 🚧 Partially Implemented (Needs UI)

| Feature | What's Done | What's Needed |
|---------|-------------|---------------|
| **Context Menu** | Text formatting logic complete | Right-click menu UI |
| **Customer Data Sync** | Architecture designed | Wiki extraction + toggle |
| **SQL Query Builder** | Queries defined | Dropdown UI + copy button |
| **Sidepanel** | Storage schema defined | Notepad + code editor UI |
| **Multi-Tab Warning** | Detection logic sketched | Banner UI implementation |

---

## How to Test

### 1. Load the Extension

```bash
1. Open Chrome
2. Go to chrome://extensions/
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the "3.0" folder
```

### 2. Navigate to ProQuest Salesforce

URL: `https://proquestllc.lightning.force.com/`

### 3. Open a Case

The following should happen automatically:

✅ **Field Highlighting**: Category, Sub-Category, Description, Status, Jira fields highlighted in red (empty) or yellow (filled)

✅ **Dynamic Buttons**: Section appears in header with buttons:
   - Production (LV, BO)
   - Sandboxes (PSB/SB/SQA variants)
   - Tools (Kibana, Wiki, System Status)
   - SQL (3 wiki links)
   - Customer JIRA

✅ **Analytics Refresh Time**: Displays next refresh in UTC and local time

### 4. Try Case Comments

1. Scroll to case comment section
2. Click in the textarea

✅ **Character Counter**: Appears on left side showing `0 / 4000`

✅ **Auto-Save**: Type something, switch tabs, come back - text should still be there

✅ **Restore Button**: Click "Restore ▼" to see previous versions (after saving at least once)

### 5. Check Browser Console

You should see:
```
[ExLibris Extension] Initializing...
[ExLibris Extension] Page changed: {type: "case_page", caseId: "..."}
[ExLibris Extension] Extracting case data...
[ExLibris Extension] Case page features initialized
```

---

## Configuration Options

Currently, most features use default settings. To customize:

### Settings Object (in code)

Located in `content_script_exlibris.js`:

```javascript
settings: {
  menuLocations: {
    cardActions: false,      // Show buttons in card actions
    headerDetails: true      // Show buttons in header
  },
  buttonLabelStyle: 'casual',  // 'formal', 'casual', 'abbreviated'
  timezone: null,              // null = auto-detect
  highlightingEnabled: true    // Enable field highlighting
}
```

### To Change Settings (Temporary):

Open browser console on Salesforce page:

```javascript
// Change button labels to abbreviated
ExLibrisExtension.settings.buttonLabelStyle = 'abbreviated';
ExLibrisExtension.refresh();

// Disable field highlighting
ExLibrisExtension.settings.highlightingEnabled = false;
ExLibrisExtension.refresh();

// Change timezone
ExLibrisExtension.settings.timezone = 'America/New_York';
ExLibrisExtension.refresh();
```

---

## Button URLs Reference

All buttons are dynamically generated based on case data. Here are the templates:

### Production
- **Live View**: `https://{server}.alma.exlibrisgroup.com/esploro/?institution={institutionCode}`
- **Back Office**: `https://{server}.alma.exlibrisgroup.com/mng/login?institute={institutionCode}&productCode=esploro&debug=true`

### Sandboxes (Varies by Product)

**If Product = "Esploro Advanced"**:
- PSB LV, PSB BO (Premium Sandbox)

**If Product = "Esploro Standard"**:
- SB LV, SB BO (Standard Sandbox)

**Always Available**:
- SQA LV, SQA BO

### Kibana (DC-Aware)

Automatically selects correct Kibana based on affected environment:

| Environment | Kibana DC |
|-------------|-----------|
| NA04-08 | dc01 |
| EU00-02 | dc03 |
| NA01-03, NA91 | dc04 |
| AP01 | dc05 |
| EU03-06 | dc06 |
| AP02 | dc07 |
| CA01 | dc82 |
| CN01 | dc81 |

### Customer JIRA

Searches for customer code in URM project with Esploro filter.

---

## Data Extraction Logic

The extension looks for these fields in the Salesforce case:

| Field | CSS Selector | Derived Values |
|-------|--------------|----------------|
| Ex Libris Account # | `records-record-layout-item[field-label*="Ex Libris Account"]` | → Institution Code (adds `_INST` if no underscore) |
| Affected Environment | `records-record-layout-item[field-label*="Affected Environment"]` | → Server (e.g., `na05`) <br> → Server Region (e.g., `NA`) |
| Product/Service Name | `records-record-layout-item[field-label*="Product"]` | → Determines sandbox type |
| Asset | `records-record-layout-item[field-label*="Asset"]` | → Text + Href |
| JIRA ID | `flexipage-component2[data-component-id="flexipage_fieldSection6"]` | → Primary JIRA field |

### Example Data Flow

**Case Page Shows**:
- Ex Libris Account Number: `61SCU`
- Affected Environment: `AP02`
- Product: `Esploro Advanced`

**Extension Extracts**:
```javascript
{
  exLibrisAccountNumber: "61SCU",
  institutionCode: "61SCU_INST",  // Derived
  server: "ap02",                  // Derived
  serverRegion: "AP",              // Derived
  productServiceName: "esploro advanced"
}
```

**Buttons Generated**:
- Live View → `https://ap02.alma.exlibrisgroup.com/esploro/?institution=61SCU_INST`
- PSB LV → `https://psb-ap02.alma.exlibrisgroup.com/esploro/?institution=61SCU_INST`
- Kibana → `http://lm-oss-kib.dc07.hosted.exlibrisgroup.com:5601/` (AP02 = dc07)

---

## Troubleshooting Quick Fixes

### Buttons Not Appearing

**Check 1**: Is page detected correctly?
```javascript
PageIdentifier.identifyPage()
// Should return: {type: "case_page", caseId: "..."}
```

**Check 2**: Is case data extracted?
```javascript
ExLibrisExtension.getCaseData(ExLibrisExtension.currentCaseId)
// Should return object with exLibrisAccountNumber, server, etc.
```

**Fix**: If data extraction fails, check if field labels match. Update selectors in `modules/caseDataExtractor.js`.

### Field Highlighting Not Working

**Check**: Inspect a field element and compare class names with selectors in `modules/fieldHighlighter.js`.

**Common Issue**: Salesforce changed DOM structure.

**Fix**: Update selectors:
```javascript
// In fieldHighlighter.js
fieldSelectors: {
  category: {
    container: 'NEW_SELECTOR_HERE',
    input: 'NEW_INPUT_SELECTOR_HERE'
  }
}
```

### Character Counter Misplaced

**Check**: Is button row detected?
```javascript
CharacterCounter.findButtonRow()
```

**Fix**: Update `findButtonRow()` logic in `characterCounter.js` to match current DOM structure.

### Auto-Save Not Working

**Check**: Browser console for errors related to `chrome.storage`

**Fix**: Verify "storage" permission in `manifest.json` (should already be there).

### URLs Are Wrong

**Most Common**: Case data extraction failed or incomplete.

**Check**:
```javascript
const data = await ExLibrisExtension.getCaseData(ExLibrisExtension.currentCaseId);
console.log(data);
```

**Fix**: Ensure Ex Libris Account Number and Affected Environment fields are populated in the case.

---

## Next Steps for Full Implementation

### Priority 1 Tasks

1. **Context Menu UI** (2-3 hours)
   - Create right-click menu for textarea
   - Wire up to TextFormatter methods
   - Test all formatting options

2. **Enhanced Popup** (2-3 hours)
   - Add Ex Libris settings section
   - Timezone dropdown
   - Button label style selector
   - Menu location toggles

### Priority 2 Tasks

3. **Customer Data Sync** (3-4 hours)
   - Guide user to Wiki page
   - Extract table on load
   - Store and use for lookups

4. **SQL Query Builder** (2-3 hours)
   - Create expandable UI section
   - Add entity dropdowns
   - Display formatted query
   - Copy to clipboard button

### Priority 3 Tasks

5. **Sidepanel** (4-5 hours)
   - Circular trigger button
   - Sliding panel animation
   - Rich text notepad
   - Simple code editor
   - Per-case persistence

6. **Multi-Tab Warning** (1-2 hours)
   - Detect simultaneous editing
   - Show warning banner
   - Link to active tab

**Estimated Total**: 14-22 hours to complete all remaining features

---

## File Structure Reference

```
3.0/
├── modules/
│   ├── pageIdentifier.js           (✅ Complete)
│   ├── caseDataExtractor.js        (✅ Complete)
│   ├── fieldHighlighter.js         (✅ Complete)
│   ├── urlBuilder.js               (✅ Complete)
│   ├── textFormatter.js            (✅ Complete)
│   ├── caseCommentMemory.js        (✅ Complete)
│   ├── dynamicMenu.js              (✅ Complete)
│   ├── characterCounter.js         (✅ Complete)
│   ├── contextMenu.js              (🚧 To create)
│   ├── customerDataSync.js         (🚧 To create)
│   ├── sqlQueryBuilder.js          (🚧 To create)
│   ├── sidepanel.js                (🚧 To create)
│   └── multiTabDetector.js         (🚧 To create)
├── content_script.js               (Existing - Clarivate features)
├── content_script_exlibris.js      (✅ New - Ex Libris integration)
├── background.js                   (Existing)
├── popup.html                      (Existing - needs update)
├── popup.js                        (Existing - needs update)
├── manifest.json                   (✅ Updated)
├── explanation.md                  (✅ Codebase analysis)
├── IMPLEMENTATION_GUIDE.md         (✅ Detailed guide)
└── FEATURE_SUMMARY.md              (This file)
```

---

## Contact & Support

**Original Extension**: Muhammad Amir Faaiz Shamsol Nizam

**New Features**: Implementation by Claude Code

**Questions**: Refer to `IMPLEMENTATION_GUIDE.md` for detailed documentation

---

**Version**: 1.0
**Last Updated**: 2025-10-14
**Status**: Core features complete, UI enhancements pending
