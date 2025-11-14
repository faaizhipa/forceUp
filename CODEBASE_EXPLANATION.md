# Comprehensive Codebase Explanation
**Penang CoE CForce Extension - Chrome Manifest V3**

**Version:** 4.0
**Last Updated:** November 10, 2025
**Document Purpose:** Complete technical reference for developers and AI agents

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Directory Structure](#directory-structure)
4. [Architecture Patterns](#architecture-patterns)
5. [Core Components](#core-components)
6. [Module Directory](#module-directory)
7. [Data Flow](#data-flow)
8. [Manifest V3 Compliance](#manifest-v3-compliance)
9. [Critical Security & Performance Issues](#critical-security--performance-issues)
10. [Development Best Practices](#development-best-practices)
11. [Testing Guidelines](#testing-guidelines)
12. [Deployment & Distribution](#deployment--distribution)

---

## 1. Executive Summary

**Purpose:** Chrome browser extension enhancing Salesforce Lightning UI for support case management teams at Clarivate/ProQuest/Ex Libris.

**Primary Features:**
- Intelligent case comment extraction (XML/TSV export)
- Automated field highlighting for data completeness
- Dynamic URL generation for production/sandbox environments
- Persistent banner with navigation history
- Timezone auto-detection for international customers
- Case comment memory (auto-save drafts)
- Multi-tab synchronization

**Technology Stack:**
- Vanilla JavaScript (ES6+)
- Chrome Extension Manifest V3
- Salesforce Lightning Web Components DOM APIs
- Chrome Storage API (sync + local)

**Code Quality:** Generally good separation of concerns, but **critical memory leaks** and **security vulnerabilities** identified (see section 9).

---

## 2. Project Overview

### 2.1 Business Context

This extension supports three Salesforce orgs serving different product lines:

| Org | Domain | Products | Content Script |
|-----|--------|----------|---------------|
| Clarivate Analytics | clarivateanalytics.lightning.force.com | EndNote, WoS | content_script.js |
| Clarivate Preprod | clarivateanalytics--preprod.sandbox.lightning.force.com | EndNote, WoS | content_script.js |
| ScholarOne | scholarone.my.salesforce.com | ScholarOne | content_script.js |
| **ProQuest/Ex Libris** | proquestllc.lightning.force.com | Alma, Esploro | content_script_exlibris.js + 30+ modules |

### 2.2 User Personas

**Primary Users:** Technical Support Engineers (Penang CoE team)

**Workflows:**
1. **Case Triage:** Quickly identify case age, status, priority via visual highlighting
2. **Email Validation:** Ensure correct "From" address before sending emails
3. **Environment Access:** One-click navigation to customer production/sandbox environments
4. **Comment Extraction:** Export case history for analysis or handoffs
5. **Timezone Coordination:** Auto-detect customer timezone for SLA tracking

---

## 3. Directory Structure

```
c:\Users\U6071248\Tools\00_Extension Revamp\6.0 - Claude\3.0\
│
├── manifest.json                      # Extension configuration (MV3)
├── background.js                      # Service worker (context menus)
├── popup.html                         # Settings UI
├── popup.js                           # Settings controller
├── content_script.js                  # Injected into Clarivate/ScholarOne orgs
├── content_script_exlibris.js         # Main controller for ProQuest org
├── saveSelection.js                   # Legacy feature (product selection)
│
├── modules/                           # 30+ feature modules
│   ├── Core Utilities/
│   │   ├── logger.js                  # Centralized logging
│   │   ├── storageWrapper.js          # Chrome Storage API wrapper
│   │   ├── debounceUtils.js           # Debounce/throttle functions
│   │   ├── domUtilities.js            # DOM helpers (escapeXML, clipboard)
│   │   └── caseIdentifiers.js         # Case ID/number extraction
│   │
│   ├── Page Detection/
│   │   ├── pageIdentifier.js          # Page type identification
│   │   ├── navigationObserver.js      # SPA navigation detection
│   │   └── urlChangeMonitor.js        # URL change monitoring (legacy)
│   │
│   ├── Data Management/
│   │   ├── cacheManager.js            # Case data caching
│   │   ├── customerDataManager.js     # Customer list management
│   │   ├── caseDataExtractor.js       # Case metadata extraction
│   │   ├── caseDetailExtractor.js     # Detailed case data extraction
│   │   ├── casePageDataExtractor.js   # Page-level data extraction
│   │   ├── caseCommentExtractor.js    # Comment extraction (XML/TSV)
│   │   ├── caseCommentMemory.js       # Comment draft auto-save
│   │   └── accountAddressExtractor.js # Address extraction from hover panels
│   │
│   ├── UI Enhancements/
│   │   ├── persistentBanner.js        # Top banner with case info
│   │   ├── configurationWarningBanner.js # First-time setup prompt
│   │   ├── flexipagePanelInjector.js  # Case page workspace panel
│   │   ├── dynamicMenu.js             # URL button injection
│   │   ├── fieldHighlighter.js        # Empty field highlighting
│   │   ├── characterCounter.js        # Comment character counter
│   │   └── shadowTextExtractor.js     # Extract text from Shadow DOM
│   │
│   ├── Timezone Features/
│   │   ├── timezoneUtils.js           # Timezone conversion utilities
│   │   ├── timezoneDetector.js        # Browser timezone detection
│   │   ├── timezoneStorage.js         # Timezone cache management
│   │   ├── caseTimezoneResolver.js    # Auto-detect customer timezone
│   │   ├── addressTimezoneResolver.js # Address-to-timezone mapping
│   │   ├── institutionTimezoneManager.js # Institution timezone overrides
│   │   └── unknownCustomerManager.js  # Handle unmapped customers
│   │
│   ├── User Interaction/
│   │   ├── contextMenuHandler.js      # Right-click menu handler
│   │   ├── keyboardShortcuts.js       # Keyboard shortcuts
│   │   ├── textFormatter.js           # Unicode text formatting
│   │   ├── eventSimulator.js          # Simulate Salesforce events
│   │   └── scrollController.js        # Page scrolling automation
│   │
│   ├── Configuration/
│   │   ├── settingsManager.js         # Settings persistence
│   │   ├── userPreferences.js         # User-specific preferences
│   │   └── implementationStatus.js    # Feature flags
│   │
│   ├── Cross-Tab Communication/
│   │   └── multiTabSync.js            # Sync data between tabs
│   │
│   ├── URL Generation/
│   │   └── urlBuilder.js              # Generate environment URLs
│   │
│   └── styles/
│       ├── injected-panel.css         # Flexipage panel styles
│       └── persistent-banner.css      # Banner styles
│
├── icons/                             # Extension icons
│   └── ExtLogoV3.png
│
├── img/                               # Documentation images
│
├── .github/                           # GitHub-specific docs
│   ├── copilot-instructions.md        # GitHub Copilot instructions
│   ├── DEVELOPER_GUIDE.md
│   ├── DEVELOPER_GUIDE_COPILOT.md
│   ├── FEATURE_REQUIREMENTS.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── PHASE*_*.md                    # Implementation phase documentation
│
├── .reference/                        # Reference implementations
│   ├── default-customer-list.js       # Default customer data
│   ├── extension_v3.3/                # Previous version
│   └── feature-example/               # Example module architecture
│
└── *.md                               # 40+ documentation files
    ├── ARCHITECTURE.md                # Architecture diagrams
    ├── LESSONS.md                     # Lessons learned
    ├── README.md                      # Project readme
    ├── REFERENCE.MD                   # Quick reference
    ├── PROMPT.md                      # AI prompt context
    └── [FEATURE]_*.md                 # Feature-specific docs
```

### 3.1 Documentation Structure

**40+ markdown files** documenting features, implementations, and debugging:

- **Architecture:** ARCHITECTURE.md, explanation.md, AGENTS.md
- **Implementation Phases:** PHASE1-4_COMPLETE.md, ALL_PHASES_COMPLETE.md
- **Features:** TIMEZONE_*, BANNER_*, CASE_*, IDLE_HELPER_*
- **Debugging:** DEBUG_INSTRUCTIONS.md, ROOT_CAUSE_ANALYSIS.md, BUGFIX_*
- **Reference:** FEATURE_SUMMARY.md, URL_MONITORING_QUICK_REF.md

---

## 4. Architecture Patterns

### 4.1 Design Patterns

**1. Module Pattern**
```javascript
// Example: caseDataExtractor.js
const CaseDataExtractor = (function() {
    // Private state
    let cache = {};

    // Private functions
    function extractField(selector) { /*...*/ }

    // Public API
    return {
        getData: async function() { /*...*/ },
        getLastModifiedDate: function() { /*...*/ }
    };
})();
```

**2. Observer Pattern**
- MutationObserver for DOM changes
- Event dispatching for cross-module communication
- NavigationObserver for SPA routing

**3. Singleton Pattern**
- All modules are singletons
- Settings managers ensure single instance

**4. Factory Pattern**
- DynamicMenu creates button elements
- URLBuilder generates environment URLs

### 4.2 Architectural Principles

**Separation of Concerns:**
- **Data Extraction:** caseDataExtractor, caseCommentExtractor
- **UI Manipulation:** persistentBanner, flexipagePanelInjector
- **Business Logic:** customerDataManager, timezoneResolver
- **Infrastructure:** logger, storageWrapper, cacheManager

**Dependency Injection:**
```javascript
// Modules check for dependency availability
if (typeof CacheManager !== 'undefined') {
    CacheManager.set(caseId, data);
}
```

**Event-Driven Communication:**
```javascript
// Dispatch custom event
document.dispatchEvent(new CustomEvent('casePageDataExtracted', {
    detail: caseData
}));

// Listen for event
document.addEventListener('casePageDataExtracted', (event) => {
    handleCaseData(event.detail);
});
```

### 4.3 Loading Strategy

**manifest.json defines load order:**

1. **First Batch (All Orgs):**
   ```json
   {
     "js": ["content_script.js"],
     "matches": ["https://clarivateanalytics.lightning.force.com/*"]
   }
   ```

2. **Second Batch (ProQuest Only):**
   ```json
   {
     "js": [
       "content_script.js",
       "modules/debounceUtils.js",
       "modules/logger.js",
       "modules/domUtilities.js",
       // ... 30+ modules
       "content_script_exlibris.js"  // Controller must load LAST
     ],
     "matches": ["https://proquestllc.lightning.force.com/*"],
     "css": ["modules/styles/injected-panel.css", "modules/styles/persistent-banner.css"]
   }
   ```

**Why load order matters:**
- Utility modules (logger, storageWrapper) must load before feature modules
- Feature modules must load before controller (content_script_exlibris.js)
- Controller checks for module availability: `if (typeof ModuleName !== 'undefined')`

---

## 5. Core Components

### 5.1 background.js (Service Worker)

**Role:** Lightweight service worker handling context menus only.

**Key Functions:**
```javascript
function createContextMenus() {
    // Creates "Ex Libris Format" context menu
    // Submenus: Style (Bold, Italic, Code), Case (Upper/Lower), Symbols
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    // Forwards to content script
    chrome.tabs.sendMessage(tab.id, {
        action: 'contextMenuClick',
        info: info
    });
});
```

**Messages Handled:**
- `saveSelection`: Save product selection to storage
- `getSavedSelection`: Retrieve saved product
- `createContextMenus`: Recreate context menus
- `switchToOtherTab`: Switch to another tab with same case

**MV3 Compliance:** ✅
- Uses service worker (not persistent background page)
- No remote code execution
- Minimal permissions (storage, tabs, activeTab, contextMenus)

### 5.2 content_script.js (Legacy Features)

**Role:** Provides features for Clarivate/ScholarOne orgs.

**Features:**
1. **Email "From" Validation:**
   - Highlights email dropdown if wrong address selected
   - Colors: Red (empty), Orange (other Clarivate), Green (correct)
   - Team-specific emails configured (EndNote, WoS, ScholarOne, etc.)

2. **Case Age Highlighting:**
   - Calculates working hours (2PM-11PM MYT timezone)
   - Colors based on response target: Blue (<50%), Green (50-75%), Yellow (75-100%), Orange (100-150%), Red (>150%)
   - Team-specific SLA targets

3. **Status Badge Highlighting:**
   - "New" = Red
   - "In Progress" = Orange
   - "Pending Internal Response" = Purple
   - "Solution Delivered" = Green
   - "Closed" = Gray

**Key Functions:**
```javascript
handleAnchors()    // Email validation
handleCases()      // Case age highlighting
handleStatus()     // Status badge styling
```

**Issues Identified:**
- ⚠️ No cleanup on navigation
- ⚠️ MutationObserver runs continuously
- ⚠️ Hard-coded timezone assumptions (MYT only)

### 5.3 content_script_exlibris.js (Main Controller)

**Role:** Orchestrates all ProQuest-specific features.

**Lifecycle:**

```
1. DOM Ready
   ↓
2. ExLibrisExtension.init()
   ↓
3. Load Modules (SettingsManager, CustomerDataManager, CacheManager, etc.)
   ↓
4. Start PageIdentifier Monitoring
   ↓
5. Detect Page Type (case_page, case_list, case_comments)
   ↓
6. Initialize Features
   - Case Page: FieldHighlighter, FlexipagePanelInjector, CaseCommentMemory
   - Case List: handleCases(), handleStatus()
   - Case Comments: CaseCommentMemory, CharacterCounter
```

**Key Methods:**
```javascript
ExLibrisExtension.init()                    // Initialize all modules
ExLibrisExtension.handlePageChange(pageInfo) // Route to feature initializers
ExLibrisExtension.initializeCasePageFeatures() // Setup case page features
ExLibrisExtension.getCaseData(caseId)       // Get/extract case data
ExLibrisExtension.cleanup()                 // Teardown on navigation
```

**State Management:**
```javascript
ExLibrisExtension.caseToolkit = {
    metadata: null,       // Initial case metadata
    caseData: null,       // Full extracted case data
    menuConfig: {},       // Button style, timezone settings
    buttonGroups: null,   // Generated URL buttons
    prepared: false,      // Toolkit preparation status
    preparedAt: null,     // Last preparation timestamp
    scrollStats: null     // Scroll operation results
};
```

**Issues Identified:**
- ⚠️ Multiple initialization attempts not fully prevented
- ⚠️ Cleanup may not disconnect all observers
- ✅ Debouncing prevents duplicate initializations

---

## 6. Module Directory

### 6.1 Critical Modules

#### **caseCommentExtractor.js**
- **Purpose:** Extract case comments, format as XML/TSV, inject copy buttons
- **Entry Point:** `CaseCommentExtractor.initialize()`
- **Functions:**
  - `extractCaseComments()`: Main extraction logic
  - `generateXML(data)`: Convert to XML format
  - `generateTable(data)`: Convert to TSV format
  - `addCopyButtons(container)`: Inject UI buttons
  - `findCommentsTable()`: Locate comments table (visibility-aware)
- **Dependencies:** DomUtilities, CaseIdentifiers
- **Critical Issues:**
  - 🔴 **Memory Leak (Line 796):** MutationObserver not disconnected on navigation
  - 🔴 **XSS Risk (Line 475):** Falls back to no escaping if DomUtilities unavailable
  - 🟡 **Performance (Lines 290-322):** Excessive DOM queries in loops

#### **persistentBanner.js**
- **Purpose:** Display persistent top banner with case info, navigation history, action buttons
- **Entry Point:** `PersistentBanner.init()`
- **Functions:**
  - `createBanner()`: Create banner DOM structure
  - `updateBannerUI()`: Update displayed information
  - `handleCaseCommentExtractor()`: Trigger comment extraction
  - `handleFlexipagePanel()`: Inject workspace panel
  - `updateBannerBackground()`: Update gradient based on status
- **Dependencies:** NavigationObserver, CasePageDataExtractor, CaseCommentExtractor
- **Critical Issues:**
  - 🔴 **Memory Leak (Line 118):** Event listeners not removed in cleanup
  - 🔴 **Race Condition (Lines 123-129):** Case data may arrive before URL updates
  - 🟡 **Performance (Lines 332-342):** Synchronous sessionStorage operations

#### **flexipagePanelInjector.js**
- **Purpose:** Inject two-stage workspace panel into case pages
- **Entry Point:** `FlexipagePanelInjector.ensureInjected()`
- **Functions:**
  - `createPanelHTML()`: Generate panel HTML
  - `findFlexipageHeader()`: Locate injection point (visibility-aware)
  - `handlePrepareTools()`: Scroll page, extract data, populate panel
  - `setPreparationState(state)`: Control workflow state machine
  - `updateContext(data)`: Update displayed metadata
- **Dependencies:** ScrollController, CaseDataExtractor, CaseTimezoneResolver
- **Critical Issues:**
  - 🔴 **Multiple Injection (Lines 28-31):** May inject multiple panels on rapid navigation
  - 🔴 **Memory Leak (Lines 859-862):** Observes entire document.body with subtree:true
  - 🟡 **Partial Error Handling (Line 432):** Catches at end, not around individual operations

#### **caseTimezoneResolver.js**
- **Purpose:** Auto-detect customer timezone by observing Account Name hover panel
- **Entry Point:** `CaseTimezoneResolver.init()`
- **Workflow:**
  1. User hovers over Account Name field
  2. 5-second countdown starts
  3. At 2 seconds, checks for existing hover panel
  4. At 0 seconds, triggers artificial click to open panel
  5. MutationObserver detects panel appearance
  6. Extracts address from panel
  7. Resolves timezone via Google Maps API (or cache)
  8. Stores in TimezoneStorage
- **Dependencies:** TimezoneStorage, AccountAddressExtractor, AddressTimezoneResolver
- **Critical Issues:**
  - 🔴 **Timer Leak (Lines 334-352):** setInterval not cleared on exceptions
  - 🔴 **Observer Leak (Lines 428-443):** MutationObserver not disconnected after match
  - 🟡 **Hard-coded Timing (Line 343):** 2-second check may be insufficient for slow networks

#### **customerDataManager.js**
- **Purpose:** Manage Esploro customer list, provide customer lookups
- **Entry Point:** `CustomerDataManager.init()`
- **Functions:**
  - `findByInstitutionCode(code, name)`: Flexible customer matching (3 strategies)
  - `getAllCustomers()`: Return active customer list
  - `saveScrapedData(data)`: Store scraped customer list
  - `setSource(source)`: Switch between default/scraped lists
- **Data Structure:**
  ```javascript
  {
      institutionCode: "61SCU_INST",
      name: "University of Southern California",
      custID: "61SCU",
      instID: "61SCU_INST",
      server: "na05",
      portalCustomDomain: "usc.edu",
      esploroEdition: "Advanced"
  }
  ```
- **Critical Issues:**
  - 🟡 **Silent Failures (Lines 714-716):** Storage errors logged but swallowed
  - 🟡 **False Positives (Lines 834-841):** Substring matching can match wrong customers
  - 🟡 **No Validation (Lines 921-925):** Scraped data not validated before storage

### 6.2 Utility Modules

#### **storageWrapper.js**
- **Purpose:** Promise-based Chrome Storage API wrapper
- **Functions:**
  - `getLocal(keys)`: Get from chrome.storage.local
  - `setLocal(items)`: Set in chrome.storage.local
  - `getSync(keys)`: Get from chrome.storage.sync
  - `setSync(items)`: Set in chrome.storage.sync
  - `removeLocal(keys)`: Remove from local storage
  - `removeSync(keys)`: Remove from sync storage
- **Issues:** 🟡 No quota management or QUOTA_EXCEEDED handling

#### **logger.js**
- **Purpose:** Centralized logging with debug mode
- **Functions:**
  - `Logger.init(options)`: Configure logging
  - `Logger.info(message, ...args)`: Info logging
  - `Logger.warn(message, ...args)`: Warning logging
  - `Logger.error(message, ...args)`: Error logging
  - `Logger.debug(message, ...args)`: Debug logging (only if enabled)

#### **domUtilities.js**
- **Purpose:** Common DOM utilities
- **Functions:**
  - `escapeXML(str)`: Escape XML special characters
  - `copyToClipboard(text)`: Copy to clipboard with fallback
  - `isElementVisible(element)`: Check visibility
- **Issues:**
  - 🔴 **Incomplete Escaping (Lines 16-24):** Doesn't escape control characters
  - 🟡 **Deprecated API (Lines 39-46):** document.execCommand is deprecated

#### **caseIdentifiers.js**
- **Purpose:** Extract case IDs and numbers from URLs/DOM
- **Functions:**
  - `getCaseIdFromUrl()`: Extract case ID from URL
  - `getCaseNumberFromHeader()`: Extract case number from header
  - `isCasePage()`: Check if current page is case page
- **Issues:** 🟡 **Multiple Breadcrumbs (Lines 69-74):** Returns first numeric breadcrumb

### 6.3 Navigation & Detection Modules

#### **pageIdentifier.js**
- **Purpose:** Identify Salesforce page type from URL
- **Page Types:**
  ```javascript
  pageTypes: {
      CASE_PAGE: 'case_page',
      CASE_COMMENTS: 'case_comments',
      CASES_LIST: 'cases_list',
      REPORT: 'report',
      SEARCH: 'search',
      UNKNOWN: 'unknown'
  }
  ```
- **Functions:**
  - `identifyPage()`: Identify current page
  - `detectCasePageView()`: Detect active tab (Details, Communication, etc.)
  - `monitorPageChanges(callback)`: Monitor navigation
- **Issues:**
  - 🟡 **Tab Detection (Lines 32-48):** Relies on English text content
  - 🟡 **No Stop Method:** Cannot properly unload module

#### **navigationObserver.js**
- **Purpose:** Detect SPA navigation without full page reloads
- **Functions:**
  - `start()`: Begin observing navigation
  - `stop()`: Stop observing and cleanup
  - `onRouteChange(callback)`: Register callback
  - `checkUrlChange()`: Check if URL changed
- **Mechanism:**
  - Intercepts `history.pushState` and `history.replaceState`
  - Observes `<title>` changes
  - Triggers callbacks on URL changes
- **Issues:**
  - 🔴 **History API Pollution (Lines 49-57):** Modifies global history object
  - 🟡 **Double Initialization (Lines 21-24):** Multiple start() calls not handled properly
  - 🟡 **Debounce (Lines 86-98):** May skip rapid navigation changes

---

## 7. Data Flow

### 7.1 Case Page Load Flow

```
1. User Navigates to Case Page
   ↓
2. NavigationObserver Detects URL Change
   ↓
3. PageIdentifier.identifyPage() → Returns { type: 'case_page', caseId: '500...' }
   ↓
4. ExLibrisExtension.handlePageChange(pageInfo)
   ↓
5. ExLibrisExtension.initializeCasePageFeatures()
   ↓
6. Parallel Initialization:
   │
   ├─→ PersistentBanner.init()
   │   └─→ Creates banner, listens for case data
   │
   ├─→ FieldHighlighter.init()
   │   └─→ Highlights empty fields (Category, Description, etc.)
   │
   ├─→ CaseDataExtractor.getData()
   │   ├─→ Check CacheManager
   │   ├─→ Extract from DOM if not cached
   │   ├─→ Enrich with CustomerDataManager
   │   └─→ Store in CacheManager
   │
   ├─→ CaseCommentMemory.init()
   │   └─→ Monitor textarea, auto-save drafts
   │
   └─→ CharacterCounter.init()
       └─→ Add character counter to comment box
```

### 7.2 Prepare Tools Workflow

```
User Clicks "Prepare Tools" in FlexipagePanelInjector
   ↓
1. ScrollController.ensureFullPageLoad()
   - Scroll to bottom incrementally (800px steps, 150ms delay)
   - Triggers lazy-loaded content
   - Return scroll statistics
   ↓
2. CaseDataExtractor.getData({ forceRefresh: true })
   - Extract fresh case data (bypasses cache)
   - CustomerDataManager enrichment
   ↓
3. URLBuilder.buildAllButtons(caseData, buttonStyle, timezone)
   - Generate production URLs (LV, BO)
   - Generate sandbox URLs (PSB, SB, SQA)
   - Generate Kibana URL (DC mapping)
   - Generate Customer JIRA URL
   - Calculate analytics refresh time
   ↓
4. DynamicMenu.refresh(buttonGroups, caseData)
   - Inject buttons into configured locations
   ↓
5. FlexipagePanelInjector.setPreparationState('ready')
   - Update UI to show "Toolkit Ready"
   - Enable "Enable Full Feature" button
   ↓
6. ScrollController.toTop()
   - Restore original scroll position
```

### 7.3 Comment Extraction Flow

```
User Clicks "Extract Comments" in PersistentBanner
   ↓
1. CaseCommentExtractor.extractCaseComments()
   ↓
2. findCommentsTable()
   - Try 5 different selector strategies
   - Filter by visibility (isElementVisible)
   - Return first visible Case Comments table
   ↓
3. Extract Metadata (from hidden fields)
   - Case Number
   - Case Status
   - Subject
   - Status Reason
   ↓
4. Extract Comments (from table rows)
   - For each <tr>:
     - Extract created date
     - Extract created by
     - Extract comment body (from Shadow DOM)
     - Format date
   ↓
5. PersistentBanner.showFormatMenu()
   - User selects: XML, TSV, or Both
   ↓
6. Generate Formats
   - generateXML(data) → XML string
   - generateTable(data) → TSV string
   ↓
7. Copy to Clipboard
   - DomUtilities.copyToClipboard(output)
   - Show success notification
```

### 7.4 Timezone Detection Flow

```
User Hovers Over Account Name Field
   ↓
1. CaseTimezoneResolver.onMouseOver()
   - Check if timezone already cached
   - If cached → Display immediately
   - If not → Start countdown
   ↓
2. startCountdownTimer()
   - 5-second countdown
   - At 2 seconds → checkForExistingHoverPanel()
   - At 0 seconds → triggerAccountClick()
   ↓
3. startHoverPanelObserver()
   - MutationObserver watches for div[name="dialog"]
   - Detects hover panel appearance
   ↓
4. extractAddressFromPanel(panel)
   - AccountAddressExtractor.extractFromHoverPanel()
   - Parses address fields (street, city, state, postal, country)
   ↓
5. resolveTimezoneFromAddress(address, accountName)
   - AddressTimezoneResolver.resolve(address)
   - Calls Google Maps Geocoding API (or uses cache)
   - Returns timezone ID (e.g., "America/Los_Angeles")
   ↓
6. TimezoneStorage.set(accountName, timezone, address)
   - Store in chrome.storage.local
   - Display timezone in FlexipagePanelInjector
```

---

## 8. Manifest V3 Compliance

### 8.1 MV3 Requirements Checklist

| Requirement | Status | Implementation |
|------------|--------|----------------|
| Service Worker (not background page) | ✅ | `"service_worker": "background.js"` |
| No remote code execution | ✅ | All JS bundled in extension |
| No eval() or inline scripts | ✅ | All event listeners use addEventListener |
| Declarative context menus | ✅ | Created in background.js via chrome.contextMenus API |
| Host permissions in manifest | ✅ | Explicit `matches` for each Salesforce domain |
| Content Security Policy compliant | ✅ | No inline styles in HTML, external CSS only |
| Storage API (not cookies) | ✅ | Uses chrome.storage.sync and chrome.storage.local |
| Permissions justified | ✅ | storage, tabs, activeTab, contextMenus |

### 8.2 MV2 → MV3 Migration

**Changes Made:**
1. **Background Script → Service Worker:**
   ```diff
   - "background": { "page": "background.html", "persistent": false }
   + "background": { "service_worker": "background.js" }
   ```

2. **Web Accessible Resources:**
   ```diff
   - "web_accessible_resources": ["icons/*.png"]
   + "web_accessible_resources": [{
   +     "resources": ["modules/styles/injected-panel.css", "icons/*.png"],
   +     "matches": ["https://proquestllc.lightning.force.com/*", ...]
   + }]
   ```

3. **Permissions (No Changes Needed):**
   - Already using minimal permissions
   - No webRequest blocking

### 8.3 Compliance Verification

**Run Chrome Extension Manifest Checker:**
```bash
# No CLI tool, verify manually in chrome://extensions
# 1. Load unpacked extension
# 2. Check for warnings/errors
# 3. Verify all features work
```

**Verified on Chrome Version:** 120+ (Manifest V3 required since January 2024)

---

## 9. Critical Security & Performance Issues

### 9.1 Security Vulnerabilities

#### 🔴 **HIGH: XSS via Incomplete XML Escaping**
- **Location:** [caseCommentExtractor.js:475](modules/caseCommentExtractor.js#L475), [domUtilities.js:16-24](modules/domUtilities.js#L16-L24)
- **Issue:** Falls back to no escaping if DomUtilities unavailable; doesn't escape control characters
- **Impact:** User-controlled case comments could inject malicious XML
- **Fix:**
  ```javascript
  function escapeXML(str) {
      if (typeof str !== 'string') return '';
      return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;')
          // Add control character escaping
          .replace(/[\x00-\x1F\x7F]/g, (char) => `&#${char.charCodeAt(0)};`);
  }
  ```

#### 🔴 **HIGH: innerHTML Injection Risk**
- **Location:** [persistentBanner.js:948-993](modules/persistentBanner.js#L948-L993)
- **Issue:** Uses innerHTML without sanitization
- **Impact:** XSS if dynamic content is later injected
- **Fix:** Use `createElement()` and `textContent` instead of `innerHTML`

#### 🟡 **MEDIUM: Generic querySelector Injection**
- **Location:** [caseTimezoneResolver.js:379](modules/caseTimezoneResolver.js#L379)
- **Issue:** `document.querySelector('div[name="dialog"]')` could match unintended elements
- **Impact:** Wrong data extraction from unrelated dialogs
- **Fix:** Use more specific selector or check parent structure

### 9.2 Memory Leaks

#### 🔴 **HIGH: MutationObserver Not Disconnected**
- **Locations:**
  - [caseCommentExtractor.js:796](modules/caseCommentExtractor.js#L796)
  - [flexipagePanelInjector.js:859](modules/flexipagePanelInjector.js#L859)
  - [caseTimezoneResolver.js:428](modules/caseTimezoneResolver.js#L428)
- **Issue:** Observers created but not disconnected on navigation
- **Impact:** Memory accumulation, performance degradation over time
- **Fix:**
  ```javascript
  // Add cleanup method to each module
  cleanup() {
      if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
      }
  }

  // Call from ExLibrisExtension.cleanup()
  if (typeof ModuleName !== 'undefined' && ModuleName.cleanup) {
      ModuleName.cleanup();
  }
  ```

#### 🔴 **HIGH: Event Listeners Not Removed**
- **Location:** [persistentBanner.js:118](modules/persistentBanner.js#L118)
- **Issue:** `document.addEventListener()` not paired with `removeEventListener()`
- **Impact:** Duplicate handlers, memory leaks
- **Fix:**
  ```javascript
  // Store reference to handler
  this.handleCaseData = (event) => { /* ... */ };
  document.addEventListener('casePageDataExtracted', this.handleCaseData);

  // In cleanup()
  document.removeEventListener('casePageDataExtracted', this.handleCaseData);
  ```

#### 🔴 **HIGH: Timer Not Cleared**
- **Location:** [caseTimezoneResolver.js:334-352](modules/caseTimezoneResolver.js#L334-L352)
- **Issue:** setInterval not cleared if exception occurs
- **Impact:** Timer continues indefinitely
- **Fix:**
  ```javascript
  cleanup() {
      if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
      }
  }
  ```

### 9.3 Performance Issues

#### 🟡 **MEDIUM: Excessive DOM Queries**
- **Location:** [caseCommentExtractor.js:290-322](modules/caseCommentExtractor.js#L290-L322)
- **Issue:** Loops through multiple selectors with `querySelectorAll()`
- **Impact:** Performance degradation on large pages
- **Fix:** Cache DOM queries, use more specific selectors

#### 🟡 **MEDIUM: Document-wide MutationObserver**
- **Location:** [flexipagePanelInjector.js:859-862](modules/flexipagePanelInjector.js#L859-L862)
- **Issue:** Observes entire `document.body` with `subtree: true`
- **Impact:** Massive overhead on large DOM mutations
- **Fix:** Observe smaller subtree or use more specific selector

#### 🟡 **MEDIUM: Synchronous sessionStorage**
- **Location:** [persistentBanner.js:332-342](modules/persistentBanner.js#L332-L342)
- **Issue:** Synchronous `sessionStorage` operations can block UI
- **Impact:** UI lag on parse errors or large data
- **Fix:** Use asynchronous storage (chrome.storage.local) instead

#### 🟡 **MEDIUM: History API Pollution**
- **Location:** [navigationObserver.js:49-57](modules/navigationObserver.js#L49-L57)
- **Issue:** Modifies global `history.pushState` and `history.replaceState`
- **Impact:** Conflicts with other extensions or Salesforce code
- **Fix:** Use MutationObserver on URL bar or `popstate` event instead

### 9.4 Error Handling Issues

#### 🟡 **MEDIUM: Missing Try-Catch Blocks**
- **Locations:**
  - [caseCommentExtractor.js:650-668](modules/caseCommentExtractor.js#L650-L668)
  - [persistentBanner.js:597-672](modules/persistentBanner.js#L597-L672)
  - [caseTimezoneResolver.js:468-495](modules/caseTimezoneResolver.js#L468-L495)
- **Issue:** Async event handlers lack try-catch wrappers
- **Impact:** Uncaught exceptions break functionality
- **Fix:**
  ```javascript
  button.addEventListener('click', async (e) => {
      try {
          // ... async operations
      } catch (error) {
          console.error('[Module] Operation failed:', error);
          // Show user-friendly error
      }
  });
  ```

#### 🟡 **MEDIUM: Silent Failures**
- **Locations:**
  - [caseDataExtractor.js:371-383](modules/caseDataExtractor.js#L371-L383)
  - [customerDataManager.js:714-716](modules/customerDataManager.js#L714-L716)
- **Issue:** Errors logged but swallowed, no user notification
- **Impact:** Missing data may go unnoticed
- **Fix:** Add user-facing error notifications (banner, toast, etc.)

### 9.5 Edge Cases

#### 🟡 **MEDIUM: Date Parsing Failures**
- **Location:** [caseCommentExtractor.js:42-68](modules/caseCommentExtractor.js#L42-L68)
- **Issue:** Complex date parsing may fail for unexpected formats
- **Impact:** Dates display as "N/A" or incorrect format
- **Fix:** Add more format patterns, use library like date-fns

#### 🟡 **MEDIUM: Partial Name Matching**
- **Location:** [customerDataManager.js:834-841](modules/customerDataManager.js#L834-L841)
- **Issue:** Substring matching can produce false positives
- **Impact:** Wrong customer data selected
- **Fix:** Use fuzzy matching library or require exact match + manual override

#### 🟡 **MEDIUM: Tab Detection Language Dependency**
- **Location:** [pageIdentifier.js:32-48](modules/pageIdentifier.js#L32-L48)
- **Issue:** Relies on English text content ("Detail", "Communication")
- **Impact:** Fails for non-English Salesforce instances
- **Fix:** Use `data-label` attributes or `aria-label` instead

---

## 10. Development Best Practices

### 10.1 Code Style

**Naming Conventions:**
```javascript
// Modules: PascalCase
const CaseDataExtractor = { /*...*/ };

// Functions: camelCase
function extractCaseComments() { /*...*/ }

// Constants: UPPER_SNAKE_CASE
const STORAGE_KEY = 'exlibrisSettings';

// Private variables: _leadingUnderscore (convention only)
let _cache = {};
```

**Module Template:**
```javascript
/**
 * ModuleName
 *
 * Purpose: Brief description
 *
 * Dependencies:
 * - OtherModule1
 * - OtherModule2
 */

const ModuleName = (function() {
    'use strict';

    // ========== PRIVATE STATE ==========
    let isInitialized = false;

    // ========== PRIVATE FUNCTIONS ==========
    function privateHelper() {
        // Implementation
    }

    // ========== PUBLIC API ==========
    return {
        /**
         * Initialize the module
         */
        init: function() {
            if (isInitialized) {
                console.warn('[ModuleName] Already initialized');
                return;
            }

            console.log('[ModuleName] Initializing...');
            // Initialization logic
            isInitialized = true;
        },

        /**
         * Cleanup resources
         */
        cleanup: function() {
            if (!isInitialized) return;

            console.log('[ModuleName] Cleaning up...');
            // Cleanup logic
            isInitialized = false;
        }
    };
})();
```

### 10.2 Error Handling

**Pattern:**
```javascript
async function riskyOperation() {
    try {
        const result = await someAsyncCall();
        if (!result) {
            throw new Error('No result returned');
        }
        return result;
    } catch (error) {
        console.error('[ModuleName] riskyOperation failed:', error);

        // Show user-friendly message
        if (typeof PersistentBanner !== 'undefined') {
            PersistentBanner.showNotification(
                'Operation failed. Please try again.',
                'error'
            );
        }

        // Return safe default or rethrow
        return null;
    }
}
```

**Async Event Handlers:**
```javascript
button.addEventListener('click', async (e) => {
    e.preventDefault();

    try {
        await handleButtonClick();
    } catch (error) {
        console.error('[ModuleName] Button click failed:', error);
        // Handle error
    }
});
```

### 10.3 Cleanup Pattern

**Required for all modules:**
```javascript
const ModuleName = (function() {
    let observer = null;
    let timer = null;
    let eventHandler = null;

    return {
        init: function() {
            // Setup
            observer = new MutationObserver(/*...*/);
            observer.observe(document.body, {/*...*/});

            timer = setInterval(/*...*/, 1000);

            eventHandler = (e) => { /*...*/ };
            document.addEventListener('customEvent', eventHandler);
        },

        cleanup: function() {
            // Teardown
            if (observer) {
                observer.disconnect();
                observer = null;
            }

            if (timer) {
                clearInterval(timer);
                timer = null;
            }

            if (eventHandler) {
                document.removeEventListener('customEvent', eventHandler);
                eventHandler = null;
            }
        }
    };
})();
```

### 10.4 Dependency Checking

**Always check before using:**
```javascript
if (typeof DependentModule !== 'undefined') {
    DependentModule.doSomething();
} else {
    console.warn('[ModuleName] DependentModule not available');
    // Graceful degradation
}
```

### 10.5 Logging Standards

**Prefix all logs:**
```javascript
console.log('[ModuleName] Action completed');
console.warn('[ModuleName] Potential issue detected');
console.error('[ModuleName] Critical failure:', error);
```

**Use Logger module:**
```javascript
if (typeof Logger !== 'undefined') {
    Logger.info('ModuleName', 'Action completed');
    Logger.debug('ModuleName', 'Debug details', data);
}
```

---

## 11. Testing Guidelines

### 11.1 Manual Testing Checklist

**Environment Setup:**
1. Load unpacked extension in chrome://extensions
2. Navigate to https://proquestllc.lightning.force.com/
3. Open DevTools Console (check for errors)
4. Open DevTools Application tab (inspect storage)

**Feature Tests:**

**1. Case Page Features:**
- [ ] Navigate to any case page
- [ ] Verify persistent banner appears
- [ ] Verify banner shows correct case number and status
- [ ] Click "Show Panel" → Panel injected
- [ ] Click "Prepare Tools" → Scroll animation, toolkit ready
- [ ] Verify empty fields highlighted (red = empty, yellow = filled)
- [ ] Verify URL buttons injected (Production, Sandboxes, Kibana)
- [ ] Click URL buttons → Opens in new tab

**2. Comment Extraction:**
- [ ] Click "Extract Comments" in banner
- [ ] Select format (XML, TSV, Both)
- [ ] Verify clipboard contains correct data
- [ ] Check XML is valid (paste into XML validator)
- [ ] Check TSV is correctly formatted (tab-separated)

**3. Comment Memory:**
- [ ] Type text in comment box
- [ ] Wait 500ms (auto-save)
- [ ] Reload page
- [ ] Click "Restore" → Text restored

**4. Timezone Detection:**
- [ ] Hover over Account Name field
- [ ] Wait 5 seconds (countdown)
- [ ] Verify hover panel opens
- [ ] Verify timezone detected and displayed in panel
- [ ] Check chrome.storage.local → timezoneCache → Entry created

**5. Case List Features:**
- [ ] Navigate to Cases list view
- [ ] Verify case rows highlighted by age (blue → green → yellow → orange → red)
- [ ] Verify status badges styled (New = red, In Progress = orange, etc.)
- [ ] Sort/filter list → Verify highlighting persists

**6. Email Validation:**
- [ ] Navigate to case page
- [ ] Click Communication tab → Compose email
- [ ] Check "From" dropdown
- [ ] Verify highlight: Red (empty), Orange (wrong), Green (correct)

**7. Navigation:**
- [ ] Navigate between multiple case pages
- [ ] Verify banner updates with correct case info
- [ ] Verify navigation history dropdown shows recent cases
- [ ] Verify no duplicate panels injected

### 11.2 Performance Testing

**Memory Leak Detection:**
```javascript
// In DevTools Console:
// 1. Take heap snapshot (before)
// 2. Navigate between 10 different case pages
// 3. Force garbage collection (DevTools → Performance → Collect Garbage)
// 4. Take heap snapshot (after)
// 5. Compare snapshots → Look for detached DOM nodes, listeners
```

**Expected Results:**
- Heap growth < 10MB after 10 navigations
- No detached MutationObserver instances
- No orphaned event listeners

### 11.3 Browser Compatibility

**Tested Browsers:**
- Chrome 120+ (Primary target)
- Edge 120+ (Chromium-based, should work)

**Not Supported:**
- Firefox (requires different manifest format)
- Safari (requires different extension API)

---

## 12. Deployment & Distribution

### 12.1 Build Process

**No build step required** (vanilla JavaScript, no transpilation).

**Pre-deployment checklist:**
1. Update `manifest.json` version number
2. Test all features manually (see section 11.1)
3. Check DevTools Console for errors
4. Verify no MV3 warnings in chrome://extensions
5. Create ZIP file (exclude .git, .vscode, .reference, node_modules)

### 12.2 Chrome Web Store Submission

**Not currently published** (internal use only).

**If publishing in future:**
1. Create developer account ($5 one-time fee)
2. Prepare assets:
   - Icon: 128x128px (already: icons/ExtLogoV3.png)
   - Screenshots: 1280x800px or 640x400px
   - Promotional images: 440x280px (optional)
3. Fill in store listing:
   - Name: "Penang CoE CForce Extension"
   - Description: (see README.md)
   - Category: Productivity
   - Privacy policy: (required if collecting user data)
4. Upload ZIP file
5. Submit for review (1-3 days)

### 12.3 Internal Distribution

**Current method:** Manual installation via chrome://extensions

**Alternative: Enterprise distribution:**
1. Host CRX file on internal server
2. Configure Chrome policy: `ExtensionInstallForcelist`
3. Auto-install for all managed devices

**Update process:**
1. Increment version in manifest.json
2. Reload extension in chrome://extensions
3. Test thoroughly
4. Distribute new ZIP to users
5. Users replace old extension folder with new

---

## Appendix A: Glossary

- **MV3:** Manifest Version 3 (Chrome Extension API)
- **SPA:** Single Page Application (Salesforce Lightning)
- **Salesforce Lightning:** Modern Salesforce UI framework
- **Web Component:** Reusable UI component with Shadow DOM
- **Shadow DOM:** Encapsulated DOM tree (inaccessible via normal querySelector)
- **Service Worker:** Background script that runs only when needed (MV3 requirement)
- **Content Script:** JavaScript injected into web pages
- **Flexipage:** Salesforce Lightning page layout system
- **Lightning Web Component (LWC):** Salesforce's component framework
- **Case:** Salesforce object representing support ticket
- **SLA:** Service Level Agreement (response time target)
- **MYT:** Malaysia Time (UTC+8)
- **TSV:** Tab-Separated Values (spreadsheet format)
- **XML:** Extensible Markup Language
- **XSS:** Cross-Site Scripting (security vulnerability)

---

## Appendix B: Quick Reference

**Key Files:**
- Entry point: [content_script_exlibris.js](content_script_exlibris.js)
- Configuration: [manifest.json](manifest.json)
- Settings UI: [popup.html](popup.html), [popup.js](popup.js)
- Main controller: [ExLibrisExtension object](content_script_exlibris.js#L16-L960)

**Key Data Structures:**
```javascript
// Case Data
{
    caseNumber: "01234567",
    subject: "...",
    status: "In Progress",
    subStatus: "Pending Customer Response",
    category: "Technical",
    custID: "61SCU",
    instID: "61SCU_INST",
    server: "na05",
    // ... 20+ more fields
}

// Customer Data
{
    institutionCode: "61SCU_INST",
    name: "University of Southern California",
    custID: "61SCU",
    server: "na05",
    esploroEdition: "Advanced"
}

// Page Info
{
    type: "case_page",  // or "cases_list", "case_comments"
    caseId: "500QO000001ABC",
    activeView: "details"  // or "communication", "related"
}
```

**Key Selectors:**
```javascript
// Case page field
'records-record-layout-item[field-label="Case Number"] .test-id__field-value'

// Case list table
'table[aria-label*="Cases"] tbody tr'

// Comments table
'table[data-label="Case Comments"]'

// Flexipage header (panel injection point)
'div.slds-page-header__title.slds-truncate'
```

**Storage Keys:**
```javascript
// chrome.storage.sync
'exlibrisSettings'      // User settings
'savedSelection'        // Product selection (EndNote, Esploro, etc.)

// chrome.storage.local
'caseDataCache'         // Case data cache
'caseCommentMemory'     // Comment drafts
'timezoneCache'         // Timezone mappings
'customerData'          // Customer list
'navigationHistory'     // Recent case navigation
```

---

**End of Document**

*For questions or issues, contact the Penang CoE development team or file an issue in the repository.*
