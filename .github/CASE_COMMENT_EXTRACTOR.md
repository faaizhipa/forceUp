# Case Comment Extractor Module - Complete Documentation

## Overview

The **Case Comment Extractor** is a Chrome Extension module designed for Salesforce Lightning that enables support agents to quickly extract case comments in structured formats (XML and TSV). This facilitates documentation, case escalation, and knowledge base creation.

## Location

**File:** `modules/caseCommentExtractor.js`  
**Type:** Singleton Module (IIFE pattern)  
**Dependencies:** None (standalone)  
**Manifest V3 Compliant:** Yes

## Architecture

### Design Pattern: Observer-Based Lazy Injection with Navigation Monitoring

```
Extension Load → Setup Navigation Monitoring → 
Page Load → URL Check → Case ID Detection →
[If new case or case changed] → Cleanup Previous → Initialize New →
Observer Setup → DOM Mutation → Button Container Detected → 
Buttons Injected → User Interaction → Extract Data → 
Format Output → Copy to Clipboard → Show Toast

[Navigation Event] → URL Change Detected → Case ID Changed → 
Cleanup → Re-initialize
```

### Key Components

1. **Navigation Monitoring System** (NEW)
   - URL change detection via MutationObserver on title
   - Case ID tracking to detect navigation between cases
   - Automatic cleanup and re-initialization
   - Popstate event listener for browser back/forward

2. **Initialization System**
   - URL pattern matching to detect case pages
   - Case ID extraction and tracking
   - MutationObserver for dynamic button injection
   - Automatic cleanup on navigation

2. **Extraction Engine**
   - Metadata extraction from case fields
   - Table parsing for comment rows
   - Multiple selector strategies for robustness

3. **Formatting System**
   - XML generator with proper escaping
   - TSV generator with tab separation
   - Date normalization (DD/MM/YYYY HH:MM)

4. **User Interface**
   - Button injection into Salesforce action bar
   - Toast notifications (native + fallback)
   - Clipboard API with execCommand fallback

## HTML Structure Reference

### Case Comments Table (Communications Tab)

```html
<article class="slds-card" title="Case Comments (4)">
  <div class="slds-card__header">
    <h2>Case Comments</h2>
  </div>
  <div class="slds-card__body">
    <table class="slds-table">
      <thead>
        <tr>
          <th data-label="Created By">Created By</th>
          <th data-label="Public">Public</th>
          <th data-label="Created Date">Created Date</th>
          <th data-label="Comment Body">Comment Body</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <!-- Comment row 1 -->
          <th data-label="Created By" scope="row">
            <a href="/lightning/r/User/...">Amir Faaiz Shamsolnizam</a>
          </th>
          <td data-label="Public">
            <img alt="True" aria-checked="true" class="checked" />
          </td>
          <td data-label="Created Date">
            <span class="uiOutputDateTime">19/08/2025 22:00</span>
          </td>
          <td data-label="Comment Body">
            <span class="forceListViewManagerGridWrapText">
              Dear Aparna,<br><br>Thank you...
            </span>
          </td>
        </tr>
        <!-- More comment rows -->
      </tbody>
    </table>
  </div>
</article>
```

### Action Bar (Button Injection Target)

```html
<div class="branding-actions slds-button-group" 
     data-aura-class="oneActionsRibbon forceActionsContainer">
  
  <!-- Salesforce default buttons -->
  <li class="slds-button slds-button_neutral">
    <a class="forceActionLink" role="button">
      <div title="New">New</div>
    </a>
  </li>
  
  <!-- Our injected buttons (marked with data-cc-extractor="true") -->
  <li class="slds-button slds-button_neutral" data-cc-extractor="true">
    <a class="forceActionLink" role="button" title="Copy comments as TSV">
      <div>Copy Table</div>
    </a>
  </li>
  
  <li class="slds-button slds-button_neutral" data-cc-extractor="true">
    <a class="forceActionLink" role="button" title="Copy comments as XML">
      <div>Copy XML</div>
    </a>
  </li>
  
</div>
```

## Public API

```javascript
// Initialize the extractor (auto-detects case pages)
CaseCommentExtractor.initialize();

// Set up automatic navigation monitoring (call once on extension load)
CaseCommentExtractor.setupNavigationMonitoring();

// Extract case comments programmatically
const data = CaseCommentExtractor.extractCaseComments();
// Returns: { caseNumber, metadata, comments: [...] }

// Generate XML format
const xmlOutput = CaseCommentExtractor.generateXML(data);

// Generate TSV table format
const tsvOutput = CaseCommentExtractor.generateTable(data);

// Cleanup (remove buttons, disconnect observers)
CaseCommentExtractor.cleanup();
```

## Data Structures

### Extracted Data Object

```javascript
{
  caseNumber: "08145640",
  metadata: {
    caseId: "500QO00000nqW1DYAU",
    caseNumber: "08145640",
    subject: "Public display of email",
    description: "Hello! I am currently updating the researcher profile...",
    priority: "",
    status: "Update Received",
    contactName: "Aparna Ghosh",
    accountName: "Eckerd College"
  },
  comments: [
    {
      author: "Amir Faaiz Shamsolnizam",
      isPublic: "Yes",  // "Yes" or "No"
      date: "19/08/2025 22:00",  // Normalized format
      commentText: "Dear Aparna,\n\nThank you so much for your patience..."
    },
    {
      author: "Aparna Ghosh",
      isPublic: "Yes",
      date: "20/08/2025 15:00",
      commentText: "Amir,\n\nThank you so much! That was super helpful..."
    }
  ]
}
```

### XML Output Format

```xml
<case>
  <metadata>
    <caseId>500QO00000nqW1DYAU</caseId>
    <caseNumber>08145640</caseNumber>
    <subject>Public display of email</subject>
    <description>Hello! I am currently updating...</description>
    <priority></priority>
    <status>Update Received</status>
    <contactName>Aparna Ghosh</contactName>
    <accountName>Eckerd College</accountName>
  </metadata>
  <updates>
    <comment public="true">
      <author>Amir Faaiz Shamsolnizam</author>
      <date>19/08/2025 22:00</date>
      <text>Dear Aparna,

Thank you so much for your patience while I investigated your request...</text>
    </comment>
    <comment public="true">
      <author>Aparna Ghosh</author>
      <date>20/08/2025 15:00</date>
      <text>Amir,

Thank you so much! That was super helpful and fixed the problem...</text>
    </comment>
  </updates>
</case>
```

### TSV Output Format

```
Case ID:	500QO00000nqW1DYAU
Case Number:	08145640
Subject:	Public display of email
Description:	Hello! I am currently updating...
Contact:	Aparna Ghosh
Account:	Eckerd College
Status:	Update Received

Author	Public	Date	Comment
Amir Faaiz Shamsolnizam	Yes	19/08/2025 22:00	Dear Aparna, Thank you so much for your patience...
Aparna Ghosh	Yes	20/08/2025 15:00	Amir, Thank you so much! That was super helpful...
```

## Navigation Monitoring

### Automatic Case Navigation Detection

The Case Comment Extractor now automatically detects when you navigate between cases and reinitializes itself to prevent state pollution from the previous case.

**How it works:**

1. **URL Monitoring:** Watches for changes to `window.location.href` using MutationObserver on the title element
2. **Case ID Tracking:** Extracts and compares case IDs from the URL pattern `/Case/{caseId}/`
3. **Automatic Cleanup:** When navigation to a new case is detected, cleans up buttons and observers from the previous case
4. **Re-initialization:** Automatically initializes for the new case after a 500ms delay

**Supported Navigation Methods:**

- ✅ Clicking case links in list views
- ✅ Using browser back/forward buttons (popstate)
- ✅ Salesforce Lightning SPA navigation
- ✅ Direct URL changes
- ✅ Opening case in new tab (each tab independent)

**Example Flow:**

```
User on Case A (500ABC...)
  ↓
Buttons injected for Case A
  ↓
User clicks link to Case B (500XYZ...)
  ↓
Navigation detected: Case ID changed
  ↓
Cleanup: Remove Case A buttons, disconnect observers
  ↓
Wait 500ms (allow page to load)
  ↓
Initialize: Inject buttons for Case B
```

### Setup

**In your main content script (e.g., `content_script_exlibris.js`):**

```javascript
// Call once when the extension loads
if (typeof CaseCommentExtractor !== 'undefined') {
  // Set up navigation monitoring
  CaseCommentExtractor.setupNavigationMonitoring();
  
  // Initial initialization
  CaseCommentExtractor.initialize();
}
```

**Benefits:**

- **No stale data:** Each case gets fresh button injection
- **No duplicate buttons:** Automatic cleanup prevents button accumulation
- **No memory leaks:** Observers are properly disconnected
- **No cross-case pollution:** Case A data never appears on Case B

### Console Logging

The navigation monitoring provides clear console logging:

```javascript
// When navigating to a new case
"Navigation detected: 500ABC... → 500XYZ..."
"Case Comment Extractor cleaned up."
"Initializing Case Comment Extractor for case 500XYZ..."

// When leaving a case page
"Navigation detected: 500ABC... → non-case page"
"Case Comment Extractor cleaned up."

// When navigating during observation
"Case changed during observation, reinitializing..."
```

## Troubleshooting Guide

### Issue 1: Buttons Not Appearing

**Symptoms:**
- No "Copy Table" or "Copy XML" buttons visible on case page
- Console shows "Not on a case page" message

**Diagnosis:**

```javascript
// 1. Check if URL matches case page pattern
const urlMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
console.log('URL match:', urlMatch);

// 2. Check if action bar exists
const actionBar = document.querySelector('.branding-actions.slds-button-group[data-aura-class="oneActionsRibbon forceActionsContainer"]');
console.log('Action bar found:', !!actionBar);

// 3. Check if buttons already exist
const existingButtons = document.querySelectorAll('[data-cc-extractor="true"]');
console.log('Existing buttons:', existingButtons.length);

// 4. Check observer status
console.log('Observer active:', extractorObserver !== null);
```

**Causes:**
1. **Not on a case detail page** - URL doesn't match `/Case/[ID]` pattern
2. **Page not fully loaded** - Action bar hasn't rendered yet (observer will retry)
3. **Buttons already injected** - Check for duplicate initialization
4. **Salesforce DOM structure changed** - Selector needs updating

**Solutions:**

```javascript
// Solution 1: Force re-initialization
CaseCommentExtractor.cleanup();
setTimeout(() => {
  CaseCommentExtractor.initialize();
}, 1000);

// Solution 2: Check for new selector
const newActionBar = document.querySelector('div.slds-button-group');
console.log('Alternative action bar:', newActionBar);

// Solution 3: Verify case ID in URL
const caseId = window.location.pathname.match(/([a-zA-Z0-9]{15,18})/)?.[1];
console.log('Case ID extracted:', caseId);
```

### Issue 2: Comments Not Extracting

**Symptoms:**
- Buttons appear but clicking shows "No comments found"
- Empty XML/TSV output
- Toast notification shows warning

**Diagnosis:**

```javascript
// 1. Test extraction manually
const data = CaseCommentExtractor.extractCaseComments();
console.log('Extracted data:', data);
console.log('Comment count:', data?.comments?.length);

// 2. Verify table exists
const table = document.querySelector('article.slds-card[title*="Case Comments"] table.slds-table');
console.log('Table element:', table);

// 3. Check table rows
const rows = table?.querySelectorAll('tbody tr');
console.log('Table rows:', rows?.length);

// 4. Inspect a single row structure
if (rows && rows.length > 0) {
  console.log('First row HTML:', rows[0].innerHTML);
  console.log('First row cells:', rows[0].cells.length);
}

// 5. Check data-label attributes
const firstCell = table?.querySelector('th[data-label="Created By"]');
console.log('Created By cell:', firstCell?.textContent);
```

**Causes:**
1. **No comments exist** - Case genuinely has zero comments
2. **Wrong tab active** - Need to navigate to Communications tab
3. **Table not loaded** - Comments section hasn't rendered yet
4. **DOM structure changed** - Cell selectors no longer match

**Solutions:**

```javascript
// Solution 1: Navigate to Communications tab
const communicationsTab = document.querySelector('a[data-label="Communications"]');
if (communicationsTab) {
  communicationsTab.click();
  setTimeout(() => {
    const data = CaseCommentExtractor.extractCaseComments();
    console.log('Retry after tab click:', data);
  }, 2000);
}

// Solution 2: Check alternative table selectors
const altTable = document.querySelector('div.forceRelatedListContainer table');
console.log('Alternative table:', altTable);

// Solution 3: Manual cell extraction test
const testRow = table?.querySelector('tbody tr');
if (testRow) {
  const author = testRow.querySelector('a, span')?.textContent;
  const date = testRow.cells[3]?.textContent;
  const comment = testRow.cells[4]?.textContent;
  console.log('Manual extract test:', { author, date, comment });
}

// Solution 4: Update selectors in code
// Modify getCellText() function with new indices:
const author = getCellText('Created By', 0); // Change index if needed
const date = getCellText('Created Date', 2);  // Adjust based on actual structure
```

### Issue 3: Date Format Problems

**Symptoms:**
- Dates showing as "N/A" in output
- Incorrect chronological order
- Comments not sorting properly

**Diagnosis:**

```javascript
// 1. Check raw date format from Salesforce
const dateCells = document.querySelectorAll('td[data-label="Created Date"]');
dateCells.forEach((cell, i) => {
  console.log(`Date ${i}:`, cell.textContent);
});

// 2. Test date parsing function
const testDates = [
  "19/08/2025 22:00",
  "20/08/2025 15:00",
  "8/19/2025 10:00 PM",
  "19/08/2025, 10:00 PM"
];

testDates.forEach(date => {
  const formatted = formatCommentDate(date);
  console.log(`"${date}" → "${formatted}"`);
});

// 3. Check for locale-specific formatting
const dateElement = document.querySelector('lightning-formatted-date-time');
console.log('Date element HTML:', dateElement?.outerHTML);
console.log('Date element text:', dateElement?.textContent);
```

**Causes:**
1. **Unexpected date format** - Salesforce using different locale
2. **Timezone conversion issues** - Time displayed in user's timezone
3. **Missing date separators** - Format doesn't match regex patterns

**Solutions:**

Update `formatCommentDate()` function to handle new patterns:

```javascript
function formatCommentDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  
  try {
    // NEW: Handle comma-separated format "DD/MM/YYYY, HH:MM AM/PM"
    dateStr = dateStr.replace(/, /g, ' ');
    
    // NEW: Handle 12-hour format "MM/DD/YYYY HH:MM AM/PM"
    const parts12hr = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
    if (parts12hr) {
      const month = parseInt(parts12hr[1], 10);
      const day = parseInt(parts12hr[2], 10);
      const year = parseInt(parts12hr[3], 10);
      let hours = parseInt(parts12hr[4], 10);
      const minutes = parseInt(parts12hr[5], 10);
      const ampm = parts12hr[6].toUpperCase();
      
      // Convert to 24-hour
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      // Return DD/MM/YYYY HH:MM format
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    
    // ... existing logic ...
  } catch (e) {
    console.error(`Error formatting date "${dateStr}":`, e);
    return dateStr;
  }
}
```

### Issue 4: Clipboard Copy Failures

**Symptoms:**
- Toast shows "Copy failed" error
- Browser console shows "DOMException: Document is not focused"
- Clipboard permissions denied

**Diagnosis:**

```javascript
// 1. Check clipboard API availability
console.log('Clipboard API available:', !!navigator.clipboard);
console.log('Secure context:', window.isSecureContext);

// 2. Test clipboard permissions
navigator.permissions.query({name: 'clipboard-write'}).then(result => {
  console.log('Clipboard permission:', result.state);
});

// 3. Test manual copy
const testText = 'Hello World';
copyToClipboard(testText).then(success => {
  console.log('Manual copy test:', success);
});

// 4. Check focus state
console.log('Document has focus:', document.hasFocus());
console.log('Active element:', document.activeElement);
```

**Causes:**
1. **Non-HTTPS page** - Clipboard API requires secure context
2. **Browser permissions** - User denied clipboard access
3. **Document not focused** - Window/tab not in foreground
4. **Extension context security** - Content script clipboard restrictions

**Solutions:**

```javascript
// Solution 1: Ensure HTTPS
if (!window.isSecureContext) {
  console.warn('Clipboard API unavailable - not in secure context');
  // Fallback to execCommand already implemented
}

// Solution 2: Request focus before copy
async function copyWithFocus(text) {
  window.focus();
  await new Promise(resolve => setTimeout(resolve, 100));
  return copyToClipboard(text);
}

// Solution 3: Enhanced fallback implementation
async function copyToClipboard(text) {
  // Try modern API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback:', err);
    }
  }
  
  // Fallback to execCommand
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  textArea.setAttribute('readonly', '');
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    document.body.removeChild(textArea);
    console.error('All copy methods failed:', err);
    return false;
  }
}

// Solution 4: Prompt user to manually grant permission
navigator.permissions.query({name: 'clipboard-write'}).then(result => {
  if (result.state === 'prompt') {
    // Trigger permission request
    navigator.clipboard.writeText('').catch(() => {});
  }
});
```

### Issue 5: Metadata Extraction Failures

**Symptoms:**
- Case metadata showing as "N/A"
- Missing subject, description, or contact name
- Partial metadata extraction

**Diagnosis:**

```javascript
// 1. Check subject field
const subjectElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Subject"] lightning-formatted-text[slot="outputField"]');
console.log('Subject element:', subjectElement);
console.log('Subject text:', subjectElement?.textContent);

// 2. Check description field
const descElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Description"] lightning-formatted-text[slot="outputField"]');
console.log('Description:', descElement?.textContent?.substring(0, 50) + '...');

// 3. Check all metadata fields
const metadataFields = ['Priority', 'Status', 'Contact Name', 'Account Name'];
metadataFields.forEach(field => {
  const item = Array.from(document.querySelectorAll('records-record-layout-item')).find(el => {
    const label = el.querySelector('.slds-form-element__label');
    return label?.textContent.trim() === field;
  });
  console.log(`${field}:`, item?.querySelector('lightning-formatted-text')?.textContent);
});

// 4. Inspect case number extraction
const caseNumElement = document.querySelector('lightning-formatted-text[data-output-element-id="output-field"]');
console.log('Case number element:', caseNumElement?.textContent);

const titleElement = document.querySelector('title');
console.log('Page title:', titleElement?.textContent);
```

**Causes:**
1. **Salesforce Lightning Components updated** - New DOM structure
2. **Field not visible** - Hidden by page layout/permissions
3. **Selector too specific** - Only works for certain views
4. **Lookup field formatting** - "Open X Preview" text not removed

**Solutions:**

Add fallback selectors for metadata extraction:

```javascript
function extractCaseMetadata() {
  const metadata = {};
  
  // Enhanced Case ID extraction
  const urlMatch = window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
  metadata.caseId = urlMatch?.[1] || 'N/A';
  
  // Enhanced Case Number extraction with multiple fallbacks
  let caseNumber = '';
  
  // Method 1: Lightning formatted text
  const caseNumElement = document.querySelector('lightning-formatted-text[data-output-element-id="output-field"][slot="output"]');
  caseNumber = caseNumElement?.textContent.trim() || '';
  
  // Method 2: Page title
  if (!caseNumber) {
    const titleElement = document.querySelector('title');
    const titleText = titleElement?.textContent.trim() || '';
    const titleMatch = titleText.match(/^(\d{8})/);
    caseNumber = titleMatch?.[1] || '';
  }
  
  // Method 3: Breadcrumb
  if (!caseNumber) {
    const breadcrumb = document.querySelector('.slds-breadcrumb__item span[title]');
    const bcMatch = breadcrumb?.getAttribute('title')?.match(/(\d{8})/);
    caseNumber = bcMatch?.[1] || '';
  }
  
  metadata.caseNumber = caseNumber || 'N/A';
  
  // Enhanced Subject extraction with fallbacks
  const subjectSelectors = [
    'div[data-target-selection-name="sfdc:RecordField.Case.Subject"] lightning-formatted-text[slot="outputField"]',
    'records-record-layout-item[field-label="Subject"] lightning-formatted-text',
    'span.test-id__field-value lightning-formatted-text'
  ];
  
  for (const selector of subjectSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      metadata.subject = element.textContent.trim();
      break;
    }
  }
  
  if (!metadata.subject) metadata.subject = 'N/A';
  
  // ... similar enhancements for other fields ...
  
  return metadata;
}
```

## Message Passing Integration

### Background Script Communication

```javascript
// Log extraction events to background script
chrome.runtime.sendMessage({
  action: 'caseCommentExtracted',
  data: {
    caseId: data.metadata.caseId,
    caseNumber: data.caseNumber,
    commentCount: data.comments.length,
    timestamp: Date.now()
  }
}, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Background message error:', chrome.runtime.lastError);
  }
});
```

### Background.js Handler

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'caseCommentExtracted') {
    console.log('Case comments extracted:', request.data);
    
    // Optional: Store extraction history
    chrome.storage.local.get('extractionHistory', (result) => {
      const history = result.extractionHistory || [];
      history.push(request.data);
      
      // Keep only last 50 extractions
      if (history.length > 50) history.shift();
      
      chrome.storage.local.set({ extractionHistory: history });
    });
    
    sendResponse({ status: 'logged' });
  }
  return true;
});
```

### Popup Integration

```javascript
// Refresh extractor from popup
document.getElementById('refreshExtractor').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'refreshCaseCommentExtractor'
    }, (response) => {
      console.log('Extractor refreshed:', response);
    });
  });
});

// In content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'refreshCaseCommentExtractor') {
    CaseCommentExtractor.cleanup();
    setTimeout(() => {
      CaseCommentExtractor.initialize();
      sendResponse({ status: 'refreshed' });
    }, 500);
    return true;
  }
});
```

## Performance Considerations

### Observer Optimization

```javascript
// Use targeted observation scope
const observeTarget = document.querySelector('.oneConsole') || 
                      document.querySelector('.forceDetailPanelDesktop') ||
                      document.body;

// Limit observation depth
extractorObserver.observe(observeTarget, {
  childList: true,
  subtree: true,  // Required but expensive
  attributes: true,
  attributeFilter: ['class', 'style'] // Limit attribute observations
});
```

### Debouncing Button Injection

```javascript
let injectionTimeout;
const tryInjectButtonsDebounced = () => {
  clearTimeout(injectionTimeout);
  injectionTimeout = setTimeout(() => {
    if (tryInjectButtons()) {
      extractorObserver?.disconnect();
      extractorObserver = null;
    }
  }, 300);
};

extractorObserver = new MutationObserver(tryInjectButtonsDebounced);
```

## Testing Strategy

### Unit Test Scenarios

```javascript
// Test 1: URL Pattern Matching
const testUrls = [
  'https://proquestllc.lightning.force.com/lightning/r/Case/500QO00000nqW1DYAU/view',
  'https://clarivate.lightning.force.com/Case/5001234567890AB',
  'https://custom.salesforce.com/lightning/r/Custom__c/123/view' // Should NOT match
];

testUrls.forEach(url => {
  const match = url.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i);
  console.log(`URL: ${url} → Match: ${!!match}`);
});

// Test 2: Date Formatting
const testDates = [
  "19/08/2025 22:00",
  "8/19/2025 10:00 PM",
  "19/08/2025, 22:00",
  "2025-08-19T22:00:00Z"
];

testDates.forEach(date => {
  const formatted = formatCommentDate(date);
  console.log(`"${date}" → "${formatted}"`);
});

// Test 3: XML Escaping
const testStrings = [
  "Text with <tags>",
  'Text with "quotes"',
  "Text with & ampersand",
  "Text with 'apostrophe'"
];

testStrings.forEach(str => {
  const escaped = escapeXML(str);
  console.log(`"${str}" → "${escaped}"`);
});

// Test 4: Comment Sorting
const testComments = [
  { date: "20/08/2025 15:00", author: "B" },
  { date: "19/08/2025 22:00", author: "A" },
  { date: "19/08/2025 16:07", author: "C" }
];

// Should sort to: C, A, B
const sorted = testComments.sort((a, b) => {
  // ... sorting logic ...
});
console.log('Sorted order:', sorted.map(c => c.author));
```

### Integration Test Checklist

- [ ] Navigate to case with 0 comments → Should show "No comments found" warning
- [ ] Navigate to case with 1 comment → Should extract successfully
- [ ] Navigate to case with 10+ comments → Should extract all and sort chronologically
- [ ] Click "Copy Table" → Should copy TSV format to clipboard
- [ ] Click "Copy XML" → Should copy valid XML to clipboard
- [ ] Switch to different tab and back → Buttons should not duplicate
- [ ] Refresh page → Buttons should re-inject automatically
- [ ] Navigate to different case → Buttons should update/re-inject
- [ ] Test on case with HTML in comments → Should escape properly
- [ ] Test on case with special characters → Should handle Unicode
- [ ] Test clipboard fallback (HTTP page) → Should use execCommand
- [ ] Test on Salesforce Classic → Should gracefully fail (not supported)

## Best Practices for Future Development

### 1. Defensive Coding

```javascript
// GOOD: Check existence before access
const table = document.querySelector('table.slds-table');
if (table) {
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    // Process row
  });
}

// BAD: Assumes element exists
const rows = document.querySelector('table.slds-table').querySelectorAll('tbody tr');
```

### 2. Selector Specificity

```javascript
// GOOD: Specific and descriptive
const actionBar = document.querySelector(
  '.branding-actions.slds-button-group[data-aura-class="oneActionsRibbon forceActionsContainer"]'
);

// BAD: Too generic (may match wrong elements)
const actionBar = document.querySelector('.slds-button-group');
```

### 3. Error Handling

```javascript
// GOOD: Try-catch with fallback
function extractMetadata() {
  try {
    const subject = document.querySelector('...').textContent.trim();
    return subject;
  } catch (e) {
    console.error('Failed to extract subject:', e);
    return 'N/A'; // Graceful fallback
  }
}

// BAD: No error handling
function extractMetadata() {
  return document.querySelector('...').textContent.trim();
}
```

### 4. User Feedback

```javascript
// GOOD: Informative toast messages
showToast('Copied 4 comments to clipboard', 'success');
showToast('No comments found for this case', 'warning');
showToast('Failed to access clipboard', 'error');

// BAD: Generic or no feedback
showToast('Done', 'success');
```

### 5. Data Validation

```javascript
// GOOD: Validate before processing
function generateXML(data) {
  if (!data || !data.comments) {
    return '<error>No data extracted</error>';
  }
  if (!Array.isArray(data.comments)) {
    return '<error>Invalid data structure</error>';
  }
  // ... proceed with generation
}

// BAD: Assume data is valid
function generateXML(data) {
  data.comments.forEach(comment => { ... });
}
```

## Manifest V3 Compliance

### Content Script Injection

```json
{
  "content_scripts": [
    {
      "matches": [
        "https://proquestllc.lightning.force.com/*",
        "https://clarivateanalytics.lightning.force.com/*"
      ],
      "js": [
        "modules/caseCommentExtractor.js",
        "content_script_exlibris.js"
      ],
      "run_at": "document_idle"
    }
  ]
}
```

### Permissions Required

```json
{
  "permissions": [
    "clipboardWrite",  // For copying to clipboard
    "activeTab"        // For querying current tab URL
  ]
}
```

## Future Enhancements

### Planned Features

1. **Comment Filtering**
   ```javascript
   // Filter by public/private
   const publicOnly = data.comments.filter(c => c.isPublic === 'Yes');
   
   // Filter by date range
   const lastWeek = data.comments.filter(c => {
     const date = new Date(c.date);
     return date > oneWeekAgo;
   });
   ```

2. **Export History**
   ```javascript
   // Store extraction history in chrome.storage.local
   chrome.storage.local.set({
     [`extraction_${caseId}_${Date.now()}`]: {
       timestamp: Date.now(),
       caseNumber: data.caseNumber,
       commentCount: data.comments.length,
       xmlData: generateXML(data)
     }
   });
   ```

3. **Customizable Templates**
   ```javascript
   // Allow users to define custom XML/TSV templates
   const template = {
     includeMetadata: ['caseId', 'subject', 'status'],
     includeComments: ['author', 'date', 'text'],
     dateFormat: 'DD/MM/YYYY HH:MM',
     sorting: 'ascending'
   };
   ```

4. **Attachment Detection**
   ```javascript
   // Detect and list case comment attachments
   function extractAttachments(row) {
     const attachmentLinks = row.querySelectorAll('a[title*="Attachment"]');
     return Array.from(attachmentLinks).map(link => ({
       name: link.textContent.trim(),
       url: link.href
     }));
   }
   ```

---

**Module:** Case Comment Extractor  
**Version:** 1.0.0  
**Last Updated:** October 14, 2025  
**Author:** Muhammad Amir Faaiz Shamsol Nizam  
**Documentation:** Claude AI Assistant
