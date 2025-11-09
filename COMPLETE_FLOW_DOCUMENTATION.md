# COMPLETE FUNCTION FLOW DOCUMENTATION

## FIX APPLIED
Added `content_script.js` to proquestllc.lightning.force.com domain in manifest.json so legacy functions are available.

---

## INITIALIZATION SEQUENCE (Full Detail)

### 1. Extension Loads
```
Browser loads extension
↓
manifest.json parsed
↓
content_script.js loaded on proquestllc domain
↓
All modules loaded in order (pageIdentifier → settingsManager → ... → content_script_exlibris)
↓
content_script_exlibris.js IIFE executes
```

### 2. ExLibrisExtension.init()
```javascript
INPUT: None
PROCESS:
  1. SettingsManager.init()
     - chrome.storage.sync.get('settings')
     - Merge with defaults
     - Store in SettingsManager.settings
     OUTPUT: Settings object with exlibris features
  
  2. CustomerDataManager.init()
     - Parse customer-list.json (51 customers)
     - Build customerMap and productMap
     OUTPUT: Customer/product lookup tables
  
  3. CacheManager.init()
     - chrome.storage.local.get('caseCache')
     - Check version (current: 1)
     - Load cached case data
     OUTPUT: Cache with 0-N cases
  
  4. ContextMenuHandler.init()
     - IF SettingsManager.isFeatureEnabled('contextMenu')
     - Attach DOM event listeners
     OUTPUT: Right-click menu handlers ready
  
  5. KeyboardShortcuts.init(settings)
     - IF settings.exlibris.shortcuts.enabled
     - document.addEventListener('keydown', handleKeyDown)
     OUTPUT: 11 keyboard shortcuts active
  
  6. PageIdentifier.monitorPageChanges(callback)
     - Current URL analyzed
     - MutationObserver on document.body
     - window.addEventListener('popstate')
     OUTPUT: Callback fires immediately + on URL changes
```

---

## PAGE CHANGE FLOW: CASES LIST

### 3. User Navigates to Case List
```
URL: https://proquestllc.lightning.force.com/lightning/o/Case/list?filterName=00Bxxxx
```

### 4. PageIdentifier.identifyPage()
```javascript
INPUT: window.location.href
LOGIC:
  if (url.includes('/lightning/o/Case/list')) {
    return {
      type: 'cases_list',
      caseId: null,
      reportId: null
    };
  }
OUTPUT: { type: 'cases_list', caseId: null, reportId: null }
```

### 5. PageIdentifier Callback Fires
```javascript
PageIdentifier.monitorPageChanges((pageInfo) => {
  ExLibrisExtension.handlePageChange(pageInfo);  // ← Called here
});
```

### 6. ExLibrisExtension.handlePageChange(pageInfo)
```javascript
INPUT: { type: 'cases_list', caseId: null, reportId: null }
PROCESS:
  this.currentPage = pageInfo;
  this.currentCaseId = null;
  this.cleanup();  // ← Disconnect old observers
  
  if (pageInfo.type === PageIdentifier.pageTypes.CASES_LIST) {
    await this.initializeCaseListFeatures();  // ← Goes here
  }
CONSOLE LOG: "[ExLibris Extension] Page changed: Object"
```

### 7. ExLibrisExtension.cleanup()
```javascript
INPUT: None
PROCESS:
  // Disconnect case list observer
  if (this.caseListObserver) {
    this.caseListObserver.disconnect();
    this.caseListObserver = null;
  }
  
  // Disconnect communication observer
  if (this.communicationObserver) {
    this.communicationObserver.disconnect();
    this.communicationObserver = null;
  }
  
  // Remove field highlights
  FieldHighlighter.cleanup();
  
  // Remove menus
  DynamicMenu.removeAllMenus();
  
  // Cleanup other modules
  CaseDataExtractor.cleanup();
  CaseCommentMemory.cleanup();
  MultiTabSync.cleanup();
CONSOLE LOG: "[FieldHighlighter] Cleaned up"
OUTPUT: All observers disconnected, DOM modifications removed
```

### 8. ExLibrisExtension.initializeCaseListFeatures()
```javascript
INPUT: None (uses DOM)
PROCESS:
  console.log('[ExLibris Extension] Initializing case list features...');
  
  await this.waitForCaseListTable();  // ← Wait for table to load
  
  // Call legacy function 1
  if (typeof handleCases === 'function') {  // ← NOW TRUE (content_script.js loaded)
    handleCases();
    console.log('[ExLibris Extension] Case row highlighting applied');
  }
  
  // Call legacy function 2
  if (typeof handleStatus === 'function') {  // ← NOW TRUE
    handleStatus();
    console.log('[ExLibris Extension] Status badge highlighting applied');
  }
  
  this.observeCaseListChanges();  // ← Set up observer
  
CONSOLE LOGS:
  "[ExLibris Extension] Initializing case list features..."
  "[ExLibris Extension] Case row highlighting applied"
  "[ExLibris Extension] Status badge highlighting applied"
  "[ExLibris Extension] Case list observer initialized (handleCases, handleStatus)"
```

### 9. ExLibrisExtension.waitForCaseListTable()
```javascript
INPUT: None
PROCESS:
  return new Promise((resolve) => {
    const checkTable = () => {
      const table = document.querySelector('table tbody');
      if (table) {
        resolve();  // ← Table found
      } else {
        setTimeout(checkTable, 100);  // ← Check again in 100ms
      }
    };
    checkTable();
  });
OUTPUT: Promise resolves when <table><tbody> exists
MAX WAIT: Until table appears (no timeout)
```

### 10. handleCases() [from content_script.js]
```javascript
INPUT: None (scans DOM)
PROCESS:
  1. Find all tables: document.querySelectorAll('table')
  2. For each table:
     a. Get rows: table.querySelector('tbody').querySelectorAll('tr')
     b. For each row:
        - Check if status = "Open" and NOT "Re-opened"
        - Extract date from 2 cells (take earlier date)
        - Calculate minutes since date
        - Apply background color:
          * 0-30 min: GREEN (rgb(115, 240, 115))
          * 30-60 min: YELLOW (rgb(254, 254, 115))
          * 60-90 min: ORANGE (rgb(255, 178, 115))
          * >90 min: RED (rgb(240, 115, 115))

OUTPUT: Table rows styled with background colors
DOM CHANGES: 
  <tr style="background-color: rgb(115, 240, 115)">  ← Green (new case)
  <tr style="background-color: rgb(240, 115, 115)">  ← Red (old case)
```

### 11. handleStatus() [from content_script.js]
```javascript
INPUT: None (scans DOM)
PROCESS:
  1. Find all tables: document.querySelectorAll('table')
  2. For each table:
     a. Get cells: table.querySelector('tbody').querySelectorAll('tr')
     b. For each cell with <td><span><span>:
        - Read cellText
        - Apply generateStyle(color) based on status:
          
          "New Email Received", "Re-opened", "Completed by Resolver Group", "New", "Update Received"
          → RED: rgb(191, 39, 75)
          
          "Pending Action", "Initial Response Sent", "In Progress"
          → ORANGE: rgb(247, 114, 56)
          
          "Assigned to Resolver Group", "Pending Internal Response", "Pending AM Response", "Pending QA Review"
          → PURPLE: rgb(140, 77, 253)
          
          "Solution Delivered to Customer"
          → GREEN: rgb(45, 200, 64)
          
          "Closed", "Pending Customer Response"
          → GRAY: rgb(103, 103, 103)
          
          "Pending System Update - Defect/Enhancement/Other"
          → YELLOW: rgb(251, 178, 22)

OUTPUT: Status spans styled with colored badges
DOM CHANGES:
  <span style="background-color: rgb(191, 39, 75); border-radius: 6px; padding: 3px 6px; color: white; font-weight: 500;">New</span>
```

### 12. ExLibrisExtension.observeCaseListChanges()
```javascript
INPUT: None (uses DOM)
PROCESS:
  const table = document.querySelector('table');
  if (!table) return;
  
  // Disconnect existing
  if (this.caseListObserver) {
    this.caseListObserver.disconnect();
  }
  
  // Create new observer
  this.caseListObserver = new MutationObserver(() => {
    // Re-apply when table changes
    if (typeof handleCases === 'function') {
      handleCases();
    }
    if (typeof handleStatus === 'function') {
      handleStatus();
    }
  });
  
  // Start observing
  this.caseListObserver.observe(table, {
    childList: true,  // Watch for row additions/removals
    subtree: true     // Watch entire table tree
  });
  
  console.log('[ExLibris Extension] Case list observer initialized (handleCases, handleStatus)');

OUTPUT: MutationObserver watching table
TRIGGERS: User sorts, filters, changes page, new rows load
```

---

## PAGE CHANGE FLOW: CASE PAGE

### 13. User Navigates to Case Page
```
URL: https://proquestllc.lightning.force.com/lightning/r/Case/500xxx/view
```

### 14. PageIdentifier.identifyPage()
```javascript
INPUT: window.location.href
LOGIC:
  const casePageMatch = url.match(/\/lightning\/r\/Case\/([^\/]+)\/view/);
  if (casePageMatch) {
    return {
      type: 'case_page',
      caseId: casePageMatch[1],  // ← "500xxx"
      reportId: null
    };
  }
OUTPUT: { type: 'case_page', caseId: '500xxx', reportId: null }
```

### 15. ExLibrisExtension.handlePageChange(pageInfo)
```javascript
INPUT: { type: 'case_page', caseId: '500xxx', reportId: null }
PROCESS:
  this.currentPage = pageInfo;
  this.currentCaseId = '500xxx';
  this.cleanup();
  
  if (pageInfo.type === PageIdentifier.pageTypes.CASE_PAGE) {
    await this.initializeCasePageFeatures();  // ← Goes here
  }
```

### 16. ExLibrisExtension.initializeCasePageFeatures()
```javascript
INPUT: None (uses this.currentCaseId)
PROCESS:
  await this.waitForElements();  // ← Wait for case detail fields
  
  const caseData = await this.getCaseData(this.currentCaseId);
  // caseData = { caseNumber: "00001234", customer: "University of Oxford", product: "EndNote", ... }
  
  // Initialize FieldHighlighter
  if (SettingsManager.isFeatureEnabled('fieldHighlighting')) {
    FieldHighlighter.init();  // ← Highlight customer/product fields
  }
  
  // Email validation (Communication tab)
  if (typeof handleAnchors === 'function') {
    handleAnchors();
    this.observeCommunicationTab();  // ← Set up observer
  }
  
  // Initialize DynamicMenu
  if (SettingsManager.isFeatureEnabled('dynamicMenu')) {
    DynamicMenu.init(caseData);  // ← Inject Ex Libris/Esploro buttons
  }
  
  // Initialize CaseCommentMemory
  if (SettingsManager.isFeatureEnabled('caseCommentMemory')) {
    CaseCommentMemory.init(this.currentCaseId);
    CaseCommentMemory.addRestoreButton(this.currentCaseId);
  }
  
  // Initialize CharacterCounter
  if (SettingsManager.isFeatureEnabled('characterCounter')) {
    CharacterCounter.init();
  }

CONSOLE LOGS:
  "[ExLibris Extension] Initializing case page features..."
  "[FieldHighlighter] Initialized"
  "[ExLibris Extension] Email validation applied"
  "[DynamicMenu] Initialized with case: 00001234"
  "[CaseCommentMemory] Initialized for case: 500xxx"
```

### 17. ExLibrisExtension.getCaseData(caseId)
```javascript
INPUT: caseId = "500xxx"
PROCESS:
  // Check cache first
  let caseData = CacheManager.get(caseId);
  
  if (!caseData) {
    // Extract from DOM
    caseData = await CaseDataExtractor.extractCaseData();
    // caseData = { caseNumber, customer, product, description, ... }
    
    // Cache it
    CacheManager.set(caseId, caseData);
  }
  
  return caseData;

OUTPUT: 
  {
    caseNumber: "00001234",
    customer: "University of Oxford",
    product: "EndNote",
    description: "Cannot sync library",
    priority: "High",
    status: "In Progress",
    ...
  }
```

### 18. handleAnchors() [from content_script.js]
```javascript
INPUT: None (scans DOM)
PROCESS:
  1. Find email "From" dropdowns: document.getElementsByClassName("standardField uiMenu")
  2. For each dropdown:
     a. Get anchor: fromDiv.querySelector("a.select")
     b. Check email address:
        
        IF isEndNoteSupportAnchor(anchor):  // endnotesupport@clarivate.com
          → unhighlightAnchor(anchor)  // Remove background
        
        ELSE IF isClarivateEmailList(anchor):  // Any @clarivate.com
          → highlightAnchorWithSpecificContent(anchor, "orange")
        
        ELSE:  // Non-Clarivate email
          → highlightAnchorWithSpecificContent(anchor, "red")

OUTPUT: Email dropdown styled
DOM CHANGES:
  <a style="background-color: red;">wrongemail@example.com</a>
  <a style="background-color: orange;">otherdept@clarivate.com</a>
  <a style="">endnotesupport@clarivate.com</a>  ← No highlight
```

### 19. ExLibrisExtension.observeCommunicationTab()
```javascript
INPUT: None
PROCESS:
  const emailContainer = document.querySelector('.standardField.uiMenu') || document.body;
  
  if (this.communicationObserver) {
    this.communicationObserver.disconnect();
  }
  
  this.communicationObserver = new MutationObserver(() => {
    if (typeof handleAnchors === 'function') {
      handleAnchors();  // ← Re-validate email
    }
  });
  
  this.communicationObserver.observe(emailContainer, {
    childList: true,
    subtree: true
  });

OUTPUT: MutationObserver watching email area
TRIGGERS: User changes "From" email, switches tabs, email composer loads
```

---

## OBSERVER LIFECYCLE

### Case List Observer
```
Created: When user navigates to /lightning/o/Case/list
Purpose: Re-apply handleCases() + handleStatus() when table content changes
Triggers: Sorting, filtering, pagination, new rows loaded
Disconnected: When user navigates away from case list page
```

### Communication Observer
```
Created: When user navigates to /lightning/r/Case/xxx/view
Purpose: Re-validate email "From" field when Communication tab changes
Triggers: Tab switch, email composer loads, "From" field changes
Disconnected: When user navigates away from case page
```

---

## EXPECTED CONSOLE OUTPUT

### On Case List Page:
```
[ExLibris Extension] Initializing...
[SettingsManager] Initialized with settings: Object
[ExLibris Extension] SettingsManager initialized
[CustomerDataManager] Initializing...
[CustomerDataManager] Initialized with 51 customers
[ExLibris Extension] CustomerDataManager initialized
[CacheManager] Initializing...
[CacheManager] Initialized with 0 cached cases
[ExLibris Extension] CacheManager initialized
[ContextMenuHandler] Initializing...
[ContextMenuHandler] Initialized
[ExLibris Extension] ContextMenuHandler initialized
[KeyboardShortcuts] Initialized
[ExLibris Extension] KeyboardShortcuts initialized
[ExLibris Extension] Initialized
[ExLibris Extension] Page changed: Object
[FieldHighlighter] Cleaned up
[ExLibris Extension] Initializing case list features...
[ExLibris Extension] Case row highlighting applied
[ExLibris Extension] Status badge highlighting applied
[ExLibris Extension] Case list observer initialized (handleCases, handleStatus)
```

### On Case Page:
```
[ExLibris Extension] Page changed: Object
[FieldHighlighter] Cleaned up
[ExLibris Extension] Initializing case page features...
[CaseDataExtractor] Extracting case data...
[CacheManager] Cached case: 500xxx
[FieldHighlighter] Initialized
[ExLibris Extension] Email validation applied
[ExLibris Extension] Communication tab observer initialized (handleAnchors)
[DynamicMenu] Initialized with case: 00001234
[CaseCommentMemory] Initialized for case: 500xxx
[CharacterCounter] Initialized
```

---

## TESTING CHECKLIST

After reloading extension:

### Case List Page
- [ ] Navigate to `/lightning/o/Case/list`
- [ ] Console shows "Initializing case list features..."
- [ ] Console shows "Case row highlighting applied"
- [ ] Console shows "Status badge highlighting applied"
- [ ] Case rows have colored backgrounds (green/yellow/orange/red)
- [ ] Status fields have colored badges
- [ ] Sort table → colors re-apply
- [ ] Filter table → colors re-apply

### Case Page
- [ ] Navigate to `/lightning/r/Case/500xxx/view`
- [ ] Console shows "Initializing case page features..."
- [ ] Console shows "Email validation applied"
- [ ] Customer/Product fields are highlighted
- [ ] Ex Libris/Esploro buttons appear
- [ ] Email "From" field validation works (red/orange for wrong emails)
- [ ] Switch to Communication tab → email validation runs
