# Codebase Understanding - Module Initialization & Data Flow

**Last Updated:** 2025-01-23  
**Purpose:** Comprehensive guide to understanding how modules are initiated and how data flows through the extension

---

## Table of Contents

1. [Extension Architecture Overview](#extension-architecture-overview)
2. [Module Initialization Flow](#module-initialization-flow)
3. [Data Flow Patterns](#data-flow-patterns)
4. [Module Communication](#module-communication)
5. [Storage Architecture](#storage-architecture)
6. [Observer Patterns](#observer-patterns)
7. [Event-Driven Architecture](#event-driven-architecture)

---

## Extension Architecture Overview

### High-Level Structure

```
Chrome Extension (Manifest V3)
│
├── Background Service Worker (background.js)
│   ├── Context menu creation
│   ├── Message routing
│   └── Extension lifecycle management
│
├── Content Scripts (URL-based injection)
│   │
│   ├── Clarivate Domains
│   │   └── content_script.js (legacy features)
│   │
│   └── ProQuest Domain (proquestllc.lightning.force.com)
│       └── Full Module Stack
│           ├── Core Utilities
│           ├── Page Detection
│           ├── Settings Management
│           ├── Data Management
│           ├── Feature Modules
│           └── Main Controller
│
└── Popup UI (popup.html/popup.js)
    └── Settings interface
```

### Module Categories

1. **Core Infrastructure**
   - `logger.js` - Centralized logging
   - `debounceUtils.js` - Utility functions
   - `settingsManager.js` - Settings management
   - `navigationObserver.js` - SPA navigation detection
   - `pageIdentifier.js` - Page type detection
   - `pageContextValidator.js` - Data validation

2. **Data Management**
   - `cacheManager.js` - Case data caching
   - `customerDataManager.js` - Customer data lookup
   - `timezoneStorage.js` - Timezone persistence
   - `userPreferences.js` - User preferences

3. **Data Extraction**
   - `caseDataExtractor.js` - Case field extraction
   - `casePageDataExtractor.js` - Automatic case data extraction
   - `caseDetailExtractor.js` - Detailed case extraction
   - `caseCommentExtractor.js` - Comment extraction
   - `accountAddressExtractor.js` - Address parsing

4. **Feature Modules**
   - `fieldHighlighter.js` - Field highlighting
   - `dynamicMenu.js` - Button injection
   - `urlBuilder.js` - URL generation
   - `caseCommentMemory.js` - Comment auto-save
   - `characterCounter.js` - Character counting
   - `textFormatter.js` - Text formatting
   - `contextMenuHandler.js` - Context menu handling
   - `keyboardShortcuts.js` - Keyboard shortcuts
   - `multiTabSync.js` - Multi-tab synchronization
   - `persistentBanner.js` - Persistent banner UI
   - `flexipagePanelInjector.js` - Panel injection

5. **Timezone Modules**
   - `timezoneDetector.js` - Browser timezone detection
   - `timezoneConverter.js` - Timezone conversion
   - `timezoneUtils.js` - Timezone utilities
   - `institutionTimezoneManager.js` - Institution timezone lookup
   - `caseTimezoneResolver.js` - Case timezone resolution
   - `addressTimezoneResolver.js` - Address-based resolution

6. **Support Site Features**
   - `highlighter.js` - Text highlighting
   - `stickyNotes.js` - Sticky notes
   - `bookmarkManager.js` - Bookmarks
   - `layerManager.js` - Layer management

---

## Module Initialization Flow

### 1. Extension Load Sequence

```
1. Browser loads extension
   │
   ▼
2. manifest.json parsed
   │
   ├─► Background Service Worker starts
   │   └─► background.js executed
   │       ├─► createContextMenus()
   │       └─► Message listeners setup
   │
   └─► Content Scripts injected (when URL matches)
       │
       └─► ProQuest domain detected
           │
           ▼
       3. Modules loaded in order (manifest.json)
           │
           Order:
           1. fetchDataCache.js (document_start)
           2. fetchInterceptor.js (document_start)
           3. content_script.js (document_idle)
           4. debounceUtils.js
           5. logger.js
           6. pageContextValidator.js
           7. pageIdentifier.js
           8. settingsManager.js
           9. customerDataManager.js
           10. cacheManager.js
           11. caseDataExtractor.js
           12. caseCommentExtractor.js
           13. casePageDataExtractor.js
           14. fieldHighlighter.js
           15. urlBuilder.js
           16. textFormatter.js
           17. keyboardShortcuts.js
           18. contextMenuHandler.js
           19. multiTabSync.js
           20. caseCommentMemory.js
           21. characterCounter.js
           22. shadowTextExtractor.js
           23. eventSimulator.js
           24. scrollController.js
           25. navigationObserver.js
           26. timezoneDetector.js
           27. addressTimezoneResolver.js
           28. accountAddressExtractor.js
           29. timezoneStorage.js
           30. institutionTimezoneManager.js
           31. caseTimezoneResolver.js
           32. unknownCustomerManager.js
           33. caseDetailExtractor.js
           34. userPreferences.js
           35. timezoneUtils.js
           36. timezoneConverter.js
           37. dynamicMenu.js
           38. configurationWarningBanner.js
           39. implementationStatus.js
           40. flexipagePanelInjector.js
           41. content_script_exlibris.js (MAIN CONTROLLER)
```

### 2. Main Controller Initialization

**File:** `content_script_exlibris.js`

```javascript
ExLibrisExtension.init()
│
├─► Logger.init() [First - for logging]
│   └─► Sets debug mode
│
├─► SettingsManager.init() [Critical - settings needed by all]
│   ├─► Loads from chrome.storage.sync
│   ├─► Merges with defaults
│   └─► Returns settings object
│
├─► CustomerDataManager.init()
│   ├─► Loads customer list from chrome.storage.local
│   └─► Falls back to default list
│
├─► CacheManager.init()
│   ├─► Loads cache from chrome.storage.local
│   └─► Builds in-memory Map
│
├─► InstitutionTimezoneManager.init()
│   └─► Loads timezone data
│
├─► NavigationObserver.start()
│   ├─► Sets up title observer
│   ├─► Intercepts history API
│   ├─► Listens for popstate/hashchange
│   └─► Sets up DOM mutation observer
│
├─► ContextMenuHandler.init() [If enabled]
│   └─► Sets up context menu listeners
│
├─► KeyboardShortcuts.init()
│   └─► Registers keyboard event listeners
│
├─► PersistentBanner.init()
│   └─► Creates banner UI
│
├─► CasePageDataExtractor.init()
│   └─► Sets up page change listener
│
├─► UserPreferences.load()
│   ├─► Loads user preferences
│   ├─► Initializes TimezoneUtils
│   └─► Checks configuration warnings
│
└─► startPageMonitoring()
    └─► PageIdentifier.monitorPageChanges()
        └─► Calls handlePageChange() on page change
```

### 3. Page-Specific Initialization

When a page is detected, `handlePageChange()` is called:

```javascript
handlePageChange(pageInfo)
│
├─► Debounce check (prevents duplicate init)
│
├─► Update PersistentBanner (if initialized)
│
├─► Cleanup previous page features
│   ├─► FieldHighlighter.cleanup()
│   ├─► DynamicMenu.removeAllMenus()
│   ├─► CharacterCounter.remove()
│   └─► Other module cleanups
│
├─► Wait for DOM to settle (if URL changed)
│
└─► Initialize features based on page type
    │
    ├─► CASE_PAGE → initializeCasePageFeatures()
    │   ├─► waitForElements()
    │   ├─► FieldHighlighter.init()
    │   ├─► getCaseData() [with caching]
    │   │   ├─► Check CacheManager
    │   │   ├─► Extract if cache miss
    │   │   └─► Cache result
    │   ├─► Update PersistentBanner with case data
    │   ├─► CaseCommentMemory.init()
    │   ├─► CharacterCounter.init()
    │   └─► MultiTabSync.init()
    │
    ├─► CASE_COMMENTS → initializeCaseCommentsFeatures()
    │   ├─► CaseCommentMemory.init()
    │   └─► CharacterCounter.init()
    │
    └─► CASES_LIST → initializeCaseListFeatures()
        ├─► waitForCaseListTable()
        ├─► handleCases() [legacy function]
        ├─► handleStatus() [legacy function]
        └─► observeCaseListChanges()
```

---

## Data Flow Patterns

### Pattern 1: Case Data Extraction Flow

```
User navigates to case page
│
▼
PageIdentifier detects case_page
│
└─► ExLibrisExtension.handlePageChange()
    │
    └─► initializeCasePageFeatures()
        │
        └─► getCaseData(caseId)
            │
            ├─► Check CacheManager.get(caseId)
            │   │
            │   ├─► Cache HIT?
            │   │   ├─► Yes → Validate lastModified
            │   │   │   ├─► Match → Return cached data ✓
            │   │   │   └─► No match → Continue to extraction
            │   │   │
            │   └─► Cache MISS → Continue to extraction
            │
            └─► CaseDataExtractor.getData()
                │
                ├─► Extract from DOM:
                │   ├─► Case ID (from URL)
                │   ├─► Case Number (from title/DOM)
                │   ├─► Subject, Description
                │   ├─► Account, Contact
                │   ├─► Category, Sub-Category
                │   ├─► Status, Sub-Status
                │   ├─► Product/Service
                │   ├─► Ex Libris Account Number
                │   └─► Dates (Created, Modified, Closed)
                │
                ├─► Derive computed values:
                │   ├─► Institution Code (add _INST if needed)
                │   ├─► Server (lowercase)
                │   └─► Server Region (uppercase)
                │
                └─► Enrich with customer data:
                    │
                    └─► CustomerDataManager.findByInstitutionCode()
                        │
                        ├─► Lookup by Ex Libris Account Number
                        └─► Add: custID, instID, server, customerName
                │
                ▼
            CacheManager.set(caseId, caseData)
                │
                ├─► Store in memory cache (Map)
                └─► Persist to chrome.storage.local
                │
                ▼
            Return caseData
                │
                └─► Used by:
                    ├─► DynamicMenu (for button generation)
                    ├─► PersistentBanner (for display)
                    ├─► FlexipagePanelInjector (for panel)
                    └─► Other features
```

### Pattern 2: Automatic Case Data Extraction (Event-Based)

```
User navigates to case page
│
▼
CasePageDataExtractor.handlePageChange(pageInfo)
│
├─► Check if case_page
│   └─► No → cleanup() → return
│
├─► Check if already extracted
│   └─► Yes → return
│
└─► Start extraction
    │
    ├─► waitForPageLoad()
    │   └─► Wait for key DOM elements
    │
    ├─► extractAllCaseData()
    │   ├─► Extract basic info
    │   ├─► Extract record layout fields
    │   ├─► Extract flexipage fields
    │   └─► Enrich with customer data
    │
    ├─► Validate data
    │   └─► PageContextValidator.validatePageContextBeforeDisplay()
    │       ├─► Get current page context
    │       ├─► Compare case ID
    │       ├─► Compare case number
    │       └─► Wait for title update if needed
    │
    └─► Dispatch event (if validated)
        │
        └─► dispatchEvent('casePageDataExtracted', { data })
            │
            ▼
        Event Listeners:
        │
        ├─► PersistentBanner.setupCaseDataListener()
        │   ├─► Validates data
        │   └─► Updates banner UI
        │
        └─► FlexipagePanelInjector (if panel injected)
            └─► Updates panel with case data
```

### Pattern 3: Settings Flow

```
SettingsManager.init()
│
├─► Load from chrome.storage.sync
│   └─► Key: 'exlibrisSettings'
│
├─► Merge with DEFAULT_SETTINGS
│   └─► Deep merge (preserves nested objects)
│
└─► Return settings object
    │
    ▼
Settings used by:
│
├─► ExLibrisExtension.settings
│   └─► Used throughout extension
│
├─► Feature modules check:
│   ├─► SettingsManager.isFeatureEnabled('featureName')
│   └─► SettingsManager.get().exlibris.features.featureName
│
└─► UI modules use:
    ├─► SettingsManager.get().exlibris.ui.buttonLabelStyle
    ├─► SettingsManager.get().exlibris.ui.timezone
    └─► SettingsManager.get().exlibris.ui.menuLocations
```

### Pattern 4: URL Builder Flow

```
DynamicMenu needs buttons
│
▼
URLBuilder.buildAllButtons(caseData, buttonStyle, timezone)
│
├─► Generate Production URLs
│   ├─► Live View URL
│   └─► Back Office URL
│
├─► Generate Sandbox URLs
│   ├─► Based on product type
│   └─► PSB, SQA variants
│
├─► Generate Tool URLs
│   ├─► Kibana (DC lookup)
│   ├─► Wiki
│   ├─► SQL
│   └─► JIRA
│
├─► Generate Analytics Refresh Time
│   └─► Based on server region
│
└─► Return button groups
    │
    ▼
DynamicMenu.injectMenu(buttonGroups, caseData)
│
├─► Find injection points (based on menuLocations)
│
├─► Create button elements
│
└─► Inject into DOM
```

---

## Module Communication

### 1. Direct Module Access

Modules are loaded in global scope and accessed directly:

```javascript
// Module defined as:
const ModuleName = {
  init() { ... },
  method() { ... }
};

// Accessed as:
if (typeof ModuleName !== 'undefined') {
  ModuleName.init();
}
```

### 2. Message Passing (Content ↔ Background)

```javascript
// Content Script → Background
chrome.runtime.sendMessage({
  action: 'getSavedSelection'
}, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Error:', chrome.runtime.lastError);
    return;
  }
  // Use response
});

// Background → Content Script
chrome.tabs.sendMessage(tabId, {
  action: 'refreshFeature'
}, (response) => {
  // Handle response
});

// Content Script Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'refreshFeature') {
    // Handle request
    sendResponse({ success: true });
  }
  return true; // Keep channel open for async
});
```

### 3. Event-Based Communication

```javascript
// Dispatch event
const event = new CustomEvent('casePageDataExtracted', {
  detail: { caseId, caseNumber, ...data }
});
document.dispatchEvent(event);

// Listen for event
document.addEventListener('casePageDataExtracted', (event) => {
  const data = event.detail;
  // Process data
});
```

### 4. Storage-Based Communication

```javascript
// Write to storage
chrome.storage.local.set({
  key: value
}, () => {
  // Callback
});

// Read from storage
chrome.storage.local.get(['key'], (result) => {
  const value = result.key;
  // Use value
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.key) {
    // Handle change
  }
});
```

### 5. BroadcastChannel (Multi-Tab Sync)

```javascript
// Create channel
const channel = new BroadcastChannel('exlibris-sync');

// Send message
channel.postMessage({
  type: 'heartbeat',
  caseId: '500...',
  timestamp: Date.now()
});

// Listen for messages
channel.addEventListener('message', (event) => {
  const { type, data } = event.data;
  // Handle message
});
```

---

## Storage Architecture

### Storage Types

1. **chrome.storage.sync** (5KB limit)
   - User preferences
   - Settings
   - Small configuration data
   - Synced across devices

2. **chrome.storage.local** (10MB limit)
   - Case data cache
   - Comment history
   - Customer data
   - Timezone storage
   - Large datasets

### Storage Keys

```javascript
// Sync Storage
'exlibrisSettings' - Main settings object
'savedSelection' - Team selection (legacy)

// Local Storage
'caseCacheData' - Case data cache
'cacheVersion' - Cache version number
'customerData' - Customer list
'timezoneStorage' - Timezone mappings
'caseCommentMemory_{caseId}' - Comment history per case
```

### Cache Structure

```javascript
// In-Memory Cache (Map)
memoryCache = Map<caseId, {
  data: { ...caseData },
  lastModified: '2025-01-23 10:30 AM',
  timestamp: 1234567890
}>

// Persistent Cache (chrome.storage.local)
{
  caseCacheData: {
    '500QO000001': {
      data: { ...caseData },
      lastModified: '2025-01-23 10:30 AM',
      timestamp: 1234567890,
      signature: 'abc123...'
    },
    ...
  },
  cacheVersion: 2
}
```

---

## Observer Patterns

### 1. NavigationObserver

```javascript
NavigationObserver.start()
│
├─► Title Observer (MutationObserver)
│   └─► Watches <title> element
│
├─► History API Interception
│   ├─► Wraps history.pushState
│   └─► Wraps history.replaceState
│
├─► Event Listeners
│   ├─► popstate (back/forward)
│   └─► hashchange
│
└─► DOM Mutation Observer
    └─► Watches document.body (childList only)
    │
    ▼
checkNavigation() [debounced 250ms]
│
├─► URL changed?
│   └─► Yes → updateCaseContext() → trigger callbacks
│
└─► Title changed?
    └─► Yes → updateCaseContext() → trigger callbacks
```

### 2. PageIdentifier Monitoring

```javascript
PageIdentifier.monitorPageChanges(callback)
│
├─► Identify initial page
│   └─► identifyPage() called immediately
│
└─► Set up callback
    │
    ▼
NavigationObserver calls callback on navigation
│
└─► identifyPage() called (throttled 300ms)
    │
    ├─► Check URL patterns
    ├─► Check DOM elements
    └─► Return pageInfo
        │
        └─► Call callback with pageInfo
            │
            └─► ExLibrisExtension.handlePageChange(pageInfo)
```

### 3. Case List Observer

```javascript
observeCaseListChanges()
│
└─► MutationObserver on table
    │
    └─► Watches: childList, subtree
        │
        ▼
    On mutation:
    │
    ├─► handleCases() [re-apply row highlighting]
    └─► handleStatus() [re-apply status badges]
```

### 4. Communication Tab Observer

```javascript
observeCommunicationTab()
│
└─► MutationObserver on email container
    │
    └─► Watches: childList, subtree
        │
        ▼
    On mutation:
    │
    └─► handleAnchors() [re-validate email "From" field]
```

---

## Event-Driven Architecture

### Event Flow

```
1. Event Source
   │
   ├─► CasePageDataExtractor
   │   └─► Dispatches: 'casePageDataExtracted'
   │
   ├─► NavigationObserver
   │   └─► Triggers: PageIdentifier callbacks
   │
   └─► User Actions
       └─► Trigger: Module methods
   │
   ▼
2. Event Listeners
   │
   ├─► PersistentBanner
   │   └─► Listens: 'casePageDataExtracted'
   │
   ├─► FlexipagePanelInjector
   │   └─► Listens: 'casePageDataExtracted'
   │
   └─► Other modules
       └─► Listen: Various events
```

### Key Events

1. **casePageDataExtracted**
   - Source: `CasePageDataExtractor`
   - Payload: `{ caseId, caseNumber, ...allCaseData }`
   - Listeners: `PersistentBanner`, `FlexipagePanelInjector`

2. **Navigation Events**
   - Source: `NavigationObserver`
   - Triggers: `PageIdentifier` callbacks
   - Result: `ExLibrisExtension.handlePageChange()`

3. **Storage Change Events**
   - Source: `chrome.storage.onChanged`
   - Used by: Settings-dependent modules

---

## Key Design Patterns

### 1. Singleton Pattern

Most modules use singleton pattern:

```javascript
const ModuleName = {
  // Private state
  _state: null,
  
  // Public API
  init() { ... },
  method() { ... }
};
```

### 2. IIFE Pattern

Some modules use IIFE for encapsulation:

```javascript
const ModuleName = (function() {
  'use strict';
  
  // Private variables
  let privateVar = null;
  
  // Private functions
  function privateFunction() { ... }
  
  // Public API
  return {
    init() { ... },
    method() { ... }
  };
})();
```

### 3. Observer Pattern

Used extensively for:
- Navigation detection
- DOM mutation watching
- Event dispatching/listening

### 4. Cache-Aside Pattern

```javascript
// Check cache first
const cached = await CacheManager.get(caseId);
if (cached) {
  return cached;
}

// Cache miss - fetch data
const data = await extractData();

// Store in cache
await CacheManager.set(caseId, data);

return data;
```

### 5. Debounce/Throttle Pattern

Used to prevent excessive function calls:
- Navigation detection: 250ms debounce
- Page identification: 300ms throttle
- Initialization: 100ms debounce

---

## Module Dependencies

### Dependency Graph

```
content_script_exlibris.js (Main Controller)
│
├─► Logger (no dependencies)
├─► SettingsManager (no dependencies)
├─► CustomerDataManager (no dependencies)
├─► CacheManager (no dependencies)
├─► NavigationObserver (no dependencies)
│
├─► PageIdentifier
│   └─► PageContextValidator
│
├─► FieldHighlighter
│   ├─► PageIdentifier
│   └─► CaseDataExtractor
│
├─► DynamicMenu
│   ├─► URLBuilder
│   │   ├─► CaseDataExtractor
│   │   ├─► CustomerDataManager
│   │   └─► TimezoneConverter
│   └─► SettingsManager
│
├─► CasePageDataExtractor
│   ├─► PageIdentifier
│   ├─► PageContextValidator
│   └─► CustomerDataManager
│
├─► PersistentBanner
│   ├─► CasePageDataExtractor (via events)
│   ├─► PageContextValidator
│   └─► NavigationObserver
│
└─► Other feature modules...
```

---

## Best Practices

### 1. Module Initialization

- Always check if module is loaded: `typeof ModuleName !== 'undefined'`
- Initialize in correct order (dependencies first)
- Handle initialization failures gracefully

### 2. Data Validation

- Always validate data before use
- Use `PageContextValidator` for case data
- Check cache validity before using cached data

### 3. Error Handling

- Wrap operations in try-catch
- Log errors with Logger
- Provide fallback behavior
- Don't break extension on single module failure

### 4. Performance

- Use caching to avoid redundant operations
- Debounce/throttle expensive operations
- Disconnect observers when not needed
- Clean up resources on navigation

### 5. Storage

- Use `chrome.storage.sync` for small, synced data
- Use `chrome.storage.local` for large, local data
- Check storage limits
- Clean up old data periodically

---

## Related Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture overview
- **[COMPLETE_FLOW_DOCUMENTATION.md](COMPLETE_FLOW_DOCUMENTATION.md)** - Detailed flow documentation
- **[FEATURE_SUMMARY.md](FEATURE_SUMMARY.md)** - Feature overview
- **[.github/DEVELOPER_GUIDE.md](.github/DEVELOPER_GUIDE.md)** - Developer quick reference

