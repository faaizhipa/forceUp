# Chrome Extension Developer Guide - Quick Reference

## Project: Penang CoE CForce Extension

**Type:** Chrome Extension (Manifest V3)  
**Primary Use:** Salesforce Lightning Enhancement Tools  
**Target Users:** Support Teams (Clarivate & Ex Libris/Esploro)

---

## Important Documentation

- **Complete Architecture:** See `ARCHITECTURE.md`
- **Case Comment Extractor Module:** See `.github/CASE_COMMENT_EXTRACTOR.md` (comprehensive guide)
- **Feature Updates:** See `FEATURE_SUMMARY.md`
- **Bug Fixes:** See `BUGFIX_CASE_LIST_ONLY.md`

---

## Quick Module Reference

### Core Modules (Ex Libris Features)

| Module | Purpose | Key Methods |
|--------|---------|-------------|
| [`pageIdentifier.js`](modules/pageIdentifier.js) | Detects Salesforce page types | `identifyPage()` |
| [`caseDataExtractor.js`](modules/caseDataExtractor.js) | Extracts case data from DOM | `getData()`, `getExLibrisAccountNumber()` |
| [`fieldHighlighter.js`](modules/fieldHighlighter.js) | Highlights empty/filled fields | `highlightFields()` |
| [`urlBuilder.js`](modules/urlBuilder.js) | Generates dynamic URLs | `buildAllButtons()` |
| [`dynamicMenu.js`](modules/dynamicMenu.js) | Injects button groups | `createButtonGroup()` |
| [`caseCommentMemory.js`](modules/caseCommentMemory.js) | Auto-saves comments with history | `startAutoSave()`, `restoreComment()` |
| [`characterCounter.js`](modules/characterCounter.js) | Shows character count | `attachCounter()` |
| [`textFormatter.js`](modules/textFormatter.js) | Unicode text styling | `applyFormatting()` |
| **[`caseCommentExtractor.js`](modules/caseCommentExtractor.js)** | **Extracts case comments (XML/TSV)** | **`initialize()`, `extractCaseComments()`** |

---

## Message Passing (Manifest V3 Pattern)

### Background Script (`background.js`)

**Role:** Central message router and storage handler (no DOM access)

**Common Patterns:**

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Always return true for async responses
  if (request.message === 'saveData') {
    chrome.storage.sync.set({ key: request.data }, () => {
      sendResponse({ status: true });
    });
    return true; // CRITICAL: Keep channel open
  }
});
```

### Content Scripts → Background

```javascript
chrome.runtime.sendMessage(
  { message: 'getSavedSelection' },
  (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error:', chrome.runtime.lastError);
      return;
    }
    console.log('Data:', response.data);
  }
);
```

### Popup → Content Script (via Background)

```javascript
// popup.js
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    action: 'refreshFeature'
  }, (response) => {
    console.log('Feature refreshed:', response);
  });
});

// content_script_exlibris.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'refreshFeature') {
    // Refresh logic
    sendResponse({ status: 'refreshed' });
  }
  return true;
});
```

---

## Storage Strategy

### chrome.storage.sync (5KB limit)

**Use for:** User preferences, settings, small config

```javascript
// Save team selection
chrome.storage.sync.set({ 'savedSelection': 'EndNote' });

// Retrieve
chrome.storage.sync.get('savedSelection', (result) => {
  const team = result.savedSelection;
});
```

### chrome.storage.local (10MB limit)

**Use for:** Case data, comment history, large datasets

```javascript
// Save case comment history
chrome.storage.local.set({
  [`caseCommentMemory_${caseId}`]: {
    comments: [...],
    lastModified: Date.now()
  }
});

// Retrieve
chrome.storage.local.get(`caseCommentMemory_${caseId}`, (result) => {
  const history = result[`caseCommentMemory_${caseId}`];
});
```

---

## Troubleshooting Decision Tree

```
Problem?
├─ Buttons not appearing
│  ├─ Check URL pattern match
│  ├─ Check if page loaded (use observer)
│  ├─ Check for duplicate injection
│  └─ Update DOM selectors
│
├─ Data extraction fails
│  ├─ Verify table/element exists
│  ├─ Check selector specificity
│  ├─ Test manual extraction
│  └─ Update cell indices
│
├─ Message passing fails
│  ├─ Check chrome.runtime.lastError
│  ├─ Verify return true in listener
│  ├─ Check service worker status
│  └─ Add error handling
│
├─ Storage issues
│  ├─ Check quota (sync: 5KB, local: 10MB)
│  ├─ Verify permissions in manifest
│  └─ Test in incognito mode
│
└─ MutationObserver performance
   ├─ Add page detection scoping
   ├─ Debounce callbacks
   ├─ Disconnect when not needed
   └─ Use attributeFilter
```

---

## Best Practices Checklist

### When Adding New Features

- [ ] Check element existence before manipulation
- [ ] Add page detection to scope expensive operations
- [ ] Use MutationObserver for dynamic content
- [ ] Mark injected elements with data attributes
- [ ] Always return `true` in async message listeners
- [ ] Add chrome.runtime.lastError handling
- [ ] Use specific CSS selectors (prefer data- attributes)
- [ ] Log extensively for debugging
- [ ] Add toast notifications for user feedback
- [ ] Disconnect observers when done

### When Debugging

- [ ] Check browser console for errors
- [ ] Verify URL matches expected pattern
- [ ] Inspect DOM structure manually
- [ ] Test selectors in DevTools console
- [ ] Check chrome://extensions → service worker
- [ ] Review storage usage
- [ ] Test in incognito mode
- [ ] Clear storage and retry
- [ ] Check for conflicting extensions
- [ ] Test after extension reload

---

## Case Comment Extractor - Quick Start

**See `.github/CASE_COMMENT_EXTRACTOR.md` for complete documentation**

### Basic Usage

```javascript
// Initialize on case pages
CaseCommentExtractor.initialize();

// Extract comments programmatically
const data = CaseCommentExtractor.extractCaseComments();
// { caseNumber, metadata, comments: [...] }

// Generate formats
const xml = CaseCommentExtractor.generateXML(data);
const tsv = CaseCommentExtractor.generateTable(data);

// Cleanup
CaseCommentExtractor.cleanup();
```

### Troubleshooting

**Buttons not showing?**
```javascript
// Check URL
console.log(window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})/i));

// Force re-init
CaseCommentExtractor.cleanup();
CaseCommentExtractor.initialize();
```

**No comments extracted?**
```javascript
// Test manually
const data = CaseCommentExtractor.extractCaseComments();
console.log('Comments:', data?.comments?.length);

// Check table
const table = document.querySelector('article[title*="Case Comments"] table');
console.log('Table exists:', !!table);
```

**Copy fails?**
```javascript
// Test clipboard
navigator.clipboard.writeText('test').then(() => {
  console.log('Clipboard OK');
}).catch(err => {
  console.log('Clipboard error:', err);
});
```

---

## Common DOM Selectors

### Salesforce Lightning

```javascript
// Case ID (from URL)
window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})/i)

// Case Number
document.querySelector('lightning-formatted-text[data-output-element-id="output-field"]')

// Field by label
document.querySelector('records-record-layout-item[field-label="Account Name"]')

// Action bar (for button injection)
document.querySelector('.branding-actions.slds-button-group')

// Case Comments table
document.querySelector('article.slds-card[title*="Case Comments"] table.slds-table')

// Table rows
table.querySelectorAll('tbody tr')

// Cell by data-label
row.querySelector('td[data-label="Created Date"]')
```

---

## Manifest V3 Key Points

✅ **Use service worker** (not background page)  
✅ **Message passing** for background ↔ content  
✅ **chrome.storage API** (not localStorage)  
✅ **Return true** for async listeners  
✅ **Check chrome.runtime.lastError**  
✅ **Inject content scripts** via manifest  
✅ **Use activeTab permission**  

❌ **No persistent background**  
❌ **No DOM access from background**  
❌ **No blocking listeners**  
❌ **No inline scripts**  

---

## Testing Commands

```javascript
// Check if module loaded
console.log(typeof CaseCommentExtractor !== 'undefined');

// Test extraction
CaseCommentExtractor.extractCaseComments();

// Check storage
chrome.storage.sync.get(null, (items) => console.log('Sync:', items));
chrome.storage.local.get(null, (items) => console.log('Local:', items));

// Test message passing
chrome.runtime.sendMessage({ message: 'test' }, console.log);

// Check service worker
// Navigate to chrome://extensions → Extension → Service worker: "Inspect"
```

---

## Resources

- **Manifest V3 Migration Guide:** https://developer.chrome.com/docs/extensions/mv3/
- **Chrome Extension APIs:** https://developer.chrome.com/docs/extensions/reference/
- **Salesforce Lightning Design System:** https://www.lightningdesignsystem.com/

---

**Last Updated:** October 14, 2025  
**Version:** 3.0  
**Maintainer:** Muhammad Amir Faaiz Shamsol Nizam
