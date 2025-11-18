# Complete Flow Documentation

**Last Updated:** 2025-01-23  
**Purpose:** End-to-end flow documentation, observer lifecycles, event flows, and module interaction sequences

---

## Table of Contents

1. [Extension Initialization Flow](#extension-initialization-flow)
2. [Page Navigation Flow](#page-navigation-flow)
3. [Case Data Extraction Flow](#case-data-extraction-flow)
4. [Data Validation Flow](#data-validation-flow)
5. [Observer Lifecycles](#observer-lifecycles)
6. [Event Flow Diagrams](#event-flow-diagrams)
7. [Module Interaction Sequences](#module-interaction-sequences)

---

## Extension Initialization Flow

### Complete Initialization Sequence

```
1. Browser loads extension
   │
   ▼
2. manifest.json parsed
   │
   ├─► Background Service Worker (background.js)
   │   └─► Creates context menus
   │   └─► Sets up message listeners
   │
   └─► Content Scripts injected (based on URL match)
       │
       ├─► Clarivate domains → content_script.js
       │
       └─► ProQuest domain → Full module stack
           │
           ▼
       3. Modules loaded in order (manifest.json)
           │
           ├─► Core utilities (debounceUtils, logger)
           ├─► Page identification (pageIdentifier, pageContextValidator)
           ├─► Settings (settingsManager)
           ├─► Data management (customerDataManager, cacheManager)
           ├─► Data extraction (caseDataExtractor, casePageDataExtractor)
           ├─► UI utilities (fieldHighlighter, urlBuilder, textFormatter)
           ├─► Feature modules (dynamicMenu, caseCommentMemory, etc.)
           └─► Main controller (content_script_exlibris.js)
           │
           ▼
       4. ExLibrisExtension.init()
           │
           ├─► Logger.init()
           ├─► SettingsManager.init()
           │   └─► Loads settings from chrome.storage.sync
           │   └─► Merges with defaults
           │
           ├─► CustomerDataManager.init()
           │   └─► Loads customer list from chrome.storage.local
           │   └─► Falls back to default list if missing
           │
           ├─► CacheManager.init()
           │   └─► Loads cache from chrome.storage.local
           │   └─► Builds in-memory Map
           │
           ├─► NavigationObserver.start()
           │   └─► Sets up title observer
           │   └─► Intercepts history API
           │   └─► Listens for popstate/hashchange
           │   └─► Sets up DOM mutation observer
           │
           ├─► PageIdentifier.startMonitoring()
           │   └─► Calls identifyPage() immediately
           │   └─► Sets up onPageChange callback
           │
           └─► handlePageChange() called with initial page
               │
               ▼
           5. Page-specific initialization
               │
               ├─► Case Page → initializeCasePageFeatures()
               ├─► Case Comments → initializeCaseCommentsFeatures()
               └─► Cases List → initializeCaseListFeatures()
```

### Initialization Timing

- **Background script:** Loads immediately on extension install/update
- **Content scripts:** Load when matching URL is visited
- **Module initialization:** Sequential, based on manifest.json order
- **Feature initialization:** After page type is identified

---

## Page Navigation Flow

### SPA Navigation Detection

```
User clicks link or navigates
   │
   ▼
NavigationObserver detects change
   │
   ├─► Signal 1: Title change (MutationObserver)
   ├─► Signal 2: History API (pushState/replaceState)
   ├─► Signal 3: Popstate event (back/forward)
   ├─► Signal 4: Hashchange event
   └─► Signal 5: DOM mutations (fallback)
   │
   ▼
checkNavigation() called (debounced 250ms)
   │
   ├─► URL changed? → Yes
   │   │
   │   └─► updateCaseContext()
   │       │
   │       └─► Extract case ID from URL
   │       └─► Extract case number from title
   │       └─► Update currentCaseId/currentCaseNumber
   │
   └─► Title changed? → Yes
       │
       └─► updateCaseContext()
           │
           └─► Extract case number from title
           └─► Update currentCaseNumber
   │
   ▼
Navigation callbacks triggered
   │
   └─► PageIdentifier.onPageChange()
       │
       └─► identifyPage()
           │
           ├─► Check URL patterns
           ├─► Check DOM elements
           └─► Return pageInfo { type, caseId, ... }
       │
       └─► ExLibrisExtension.handlePageChange(pageInfo)
           │
           ├─► Debounce initialization (300ms)
           │
           └─► performPageInitialization(pageInfo)
               │
               ├─► Update PersistentBanner (if initialized)
               ├─► Cleanup previous page features
               ├─► Wait for DOM to settle (if URL changed)
               └─► Initialize features based on page type
```

### Navigation Debouncing

- **NavigationObserver:** 250ms debounce
- **PageIdentifier:** 300ms throttle
- **ExLibrisExtension:** 300ms debounce

This prevents multiple initializations during rapid navigation.

---

## Case Data Extraction Flow

### Complete Extraction Sequence

```
1. User navigates to case page
   │
   ▼
2. PageIdentifier detects case_page
   │
   └─► ExLibrisExtension.handlePageChange()
       │
       └─► initializeCasePageFeatures()
           │
           └─► CasePageDataExtractor.handlePageChange(pageInfo)
               │
               ├─► Check if already extracted for this case
               │   └─► Yes → Return cached data
               │
               ├─► Check if extraction in progress
               │   └─► Yes → Wait or return
               │
               └─► Start extraction
                   │
                   ▼
               3. waitForPageLoad()
                   │
                   ├─► Wait for key elements:
                   │   ├─► records-record-layout-item (fields)
                   │   ├─► flexipage-component2 (flexipage)
                   │   └─► lightning-card (cards)
                   │
                   └─► Timeout: 20 seconds
                   │
                   ▼
               4. extractAllCaseData()
                   │
                   ├─► Extract basic info:
                   │   ├─► caseId (from URL)
                   │   ├─► caseNumber (from title/DOM)
                   │   ├─► subject, description
                   │
                   ├─► Extract record layout fields:
                   │   ├─► Account Name, Contact Name
                   │   ├─► Category, Sub-Category
                   │   ├─► Status, Sub Status
                   │   ├─► Product/Service Name
                   │   └─► Ex Libris Account Number
                   │
                   ├─► Extract flexipage fields:
                   │   ├─► Asset, Affected Environment
                   │   ├─► Case Owner, Parent Case
                   │   ├─► Escalation, Dates
                   │   └─► Page Status (for banner)
                   │
                   └─► Enrich with customer data:
                       │
                       └─► CustomerDataManager.findByInstitutionCode()
                           │
                           ├─► Lookup by Ex Libris Account Number
                           └─► Add: custID, instID, server, customerName
                   │
                   ▼
               5. Validate extracted data
                   │
                   └─► PageContextValidator.validatePageContextBeforeDisplay()
                       │
                       ├─► Get current page context (URL + title)
                       ├─► Compare case ID (must match)
                       ├─► Compare case number (must match)
                       │
                       └─► If case IDs match but numbers don't:
                           │
                           └─► waitForTitleUpdate() (up to 2 seconds)
                               │
                               ├─► Poll document.title every 100ms
                               └─► Return when case number matches
                       │
                       └─► If validation fails:
                           │
                           └─► Retry after 500ms (if case IDs match)
                               │
                               └─► Re-validate (don't wait for title)
                   │
                   ▼
               6. Dispatch event (if validated)
                   │
                   └─► dispatchDataExtractedEvent(data)
                       │
                       ├─► Validate again before dispatch
                       └─► Dispatch 'casePageDataExtracted' event
                           │
                           └─► Event detail: { caseId, caseNumber, ...all data }
                   │
                   ▼
               7. Event listeners receive data
                   │
                   ├─► PersistentBanner.setupCaseDataListener()
                   │   └─► Validates data
                   │   └─► Updates banner UI
                   │
                   ├─► FlexipagePanelInjector (if panel injected)
                   │   └─► Updates panel with case data
                   │
                   └─► Other modules (if listening)
```

### Extraction Timing

- **Page load wait:** Up to 20 seconds
- **Title update wait:** Up to 2 seconds (if needed)
- **Retry delay:** 500ms
- **Total timeout:** ~22.5 seconds maximum

---

## Data Validation Flow

### Validation Before Display

```
Module wants to display case data
   │
   ▼
1. Get data (from cache, extraction, or event)
   │
   └─► Data has: { caseId, caseNumber, ... }
   │
   ▼
2. PageContextValidator.validatePageContextBeforeDisplay()
   │
   ├─► Step 1: Get current page context
   │   │
   │   └─► getCurrentCaseContext()
   │       │
   │       ├─► Extract case ID from URL
   │       ├─► Extract case number from title
   │       └─► Return { caseId, caseNumber, ... } or null
   │
   ├─► Step 2: Validate case ID
   │   │
   │   ├─► data.caseId === currentContext.caseId?
   │   │
   │   └─► No → Return { valid: false, reason: "Case ID mismatch" }
   │
   ├─► Step 3: Validate case number
   │   │
   │   ├─► data.caseNumber === currentContext.caseNumber?
   │   │
   │   ├─► No, but case IDs match:
   │   │   │
   │   │   └─► waitForTitleUpdate() (if waitForTitle = true)
   │   │       │
   │   │       ├─► Poll document.title every 100ms
   │   │       ├─► Wait up to 2000ms
   │   │       └─► Return updated context
   │   │
   │   └─► Still no match → Return { valid: false, reason: "Case number mismatch" }
   │
   └─► Step 4: Final check
       │
       ├─► document.title === 'Lightning Experience'?
       │   └─► Yes → Return { valid: false, reason: "Page still loading" }
       │
       └─► All checks passed → Return { valid: true, currentContext }
   │
   ▼
3. Handle validation result
   │
   ├─► valid === true:
   │   │
   │   └─► Display data ✓
   │
   └─► valid === false:
       │
       └─► Clear displayed data (if clearFn provided)
       └─► Log warning
```

### Periodic Validation

```
PersistentBanner displays case data
   │
   ▼
startPeriodicValidation() (every 2 seconds)
   │
   └─► PageContextValidator.validatePageContextBeforeDisplay()
       │
       ├─► Get current page context
       ├─► Compare with displayed data
       │
       └─► If case ID mismatch:
           │
           └─► clearCaseData()
               │
               └─► Remove banner data
               └─► Show loading state
```

---

## Observer Lifecycles

### NavigationObserver Lifecycle

```
start()
   │
   ├─► Initialize state
   │   ├─► currentUrl = window.location.href
   │   ├─► currentTitle = document.title
   │   └─► isRunning = true
   │
   ├─► Set up title observer
   │   └─► MutationObserver on <title> element
   │       └─► Watches: childList, subtree, characterData
   │
   ├─► Intercept history API
   │   ├─► Store original pushState/replaceState
   │   └─► Wrap with navigation check
   │
   ├─► Listen for events
   │   ├─► popstate (back/forward)
   │   └─► hashchange (hash navigation)
   │
   └─► Set up DOM mutation observer
       └─► MutationObserver on document.body
           └─► Watches: childList (direct children only)
   │
   ▼
Running (observing navigation)
   │
   ├─► checkNavigation() called (debounced 250ms)
   │   │
   │   ├─► URL changed?
   │   │   └─► Yes → updateCaseContext() → trigger callbacks
   │   │
   │   └─► Title changed?
   │       └─► Yes → updateCaseContext() → trigger callbacks
   │
   └─► Callbacks execute
       └─► PageIdentifier.onPageChange()
           └─► ExLibrisExtension.handlePageChange()
   │
   ▼
stop() (on extension unload or cleanup)
   │
   ├─► Disconnect observers
   │   ├─► titleObserver.disconnect()
   │   └─► urlObserver.disconnect()
   │
   ├─► Restore history API
   │   ├─► history.pushState = originalPushState
   │   └─► history.replaceState = originalReplaceState
   │
   ├─► Remove event listeners
   │   ├─► window.removeEventListener('popstate')
   │   └─► window.removeEventListener('hashchange')
   │
   └─► Reset state
       ├─► isRunning = false
       └─► Clear timers
```

### PageIdentifier Lifecycle

```
startMonitoring()
   │
   ├─► Identify initial page
   │   └─► identifyPage() called immediately
   │
   └─► Set up onPageChange callback
       └─► Stores callback for later use
   │
   ▼
Monitoring (via NavigationObserver)
   │
   ├─► NavigationObserver detects change
   │   │
   │   └─► Calls onPageChange callback
   │       │
   │       └─► identifyPage() called (throttled 300ms)
   │           │
   │           ├─► Check URL patterns
   │           ├─► Check DOM elements
   │           └─► Return pageInfo
   │           │
   │           └─► Call stored callback with pageInfo
   │
   └─► ExLibrisExtension.handlePageChange(pageInfo)
   │
   ▼
stopMonitoring() (on cleanup)
   │
   └─► Clear callback
       └─► onPageChange = null
```

### CasePageDataExtractor Lifecycle

```
init()
   │
   ├─► Set up event listener
   │   └─► Listen for PageIdentifier page changes
   │
   └─► isInitialized = true
   │
   ▼
Active (listening for page changes)
   │
   ├─► handlePageChange(pageInfo) called
   │   │
   │   ├─► Check if case_page
   │   │   └─► No → cleanup() → return
   │   │
   │   ├─► Check if already extracted
   │   │   └─► Yes → return
   │   │
   │   ├─► Check if extraction in progress
   │   │   └─► Yes → return
   │   │
   │   └─► Start extraction
   │       │
   │       ├─► waitForPageLoad()
   │       ├─► extractAllCaseData()
   │       ├─► Validate data
   │       └─► Dispatch event
   │
   └─► extractNow(caseId) called (manual trigger)
       │
       └─► Same extraction flow
   │
   ▼
cleanup() (on navigation away from case page)
   │
   ├─► Clear retry timeout
   ├─► Reset state
   │   ├─► currentCaseId = null
   │   ├─► lastExtractedData = null
   │   └─► isExtracting = false
   │
   └─► Clear extraction queue
```

---

## Event Flow Diagrams

### Case Data Extraction Event Flow

```
CasePageDataExtractor
   │
   ├─► Extracts data
   ├─► Validates data
   └─► Dispatches 'casePageDataExtracted' event
       │
       ├─► Event detail: { caseId, caseNumber, ...all data }
       │
       ▼
   Event Listeners:
   │
   ├─► PersistentBanner
   │   │
   │   ├─► Validates data
   │   ├─► Updates banner UI
   │   └─► Updates customer metadata
   │
   ├─► FlexipagePanelInjector (if panel injected)
   │   │
   │   └─► Updates panel with case data
   │
   └─► Other modules (if listening)
```

### Navigation Event Flow

```
User navigates
   │
   ▼
NavigationObserver detects change
   │
   └─► Calls registered callbacks
       │
       └─► PageIdentifier.onPageChange()
           │
           └─► Calls identifyPage()
               │
               └─► Returns pageInfo
                   │
                   └─► Calls stored callback
                       │
                       └─► ExLibrisExtension.handlePageChange(pageInfo)
                           │
                           ├─► Updates PersistentBanner
                           ├─► Cleans up previous features
                           └─► Initializes new features
```

---

## Module Interaction Sequences

### Case Page Load Sequence

```
1. User navigates to case page
   │
   ▼
2. NavigationObserver detects navigation
   │
   └─► Calls PageIdentifier.onPageChange()
       │
       └─► PageIdentifier.identifyPage()
           │
           └─► Returns { type: 'case_page', caseId: '...' }
               │
               └─► Calls ExLibrisExtension.handlePageChange()
                   │
                   ├─► Updates PersistentBanner.currentPage
                   ├─► Cleans up previous features
                   └─► Calls initializeCasePageFeatures()
                       │
                       ├─► CasePageDataExtractor.handlePageChange()
                       │   │
                       │   ├─► waitForPageLoad()
                       │   ├─► extractAllCaseData()
                       │   │   │
                       │   │   └─► CustomerDataManager.findByInstitutionCode()
                       │   │       └─► Enriches data with custID/instID
                       │   │
                       │   ├─► Validate data
                       │   └─► Dispatch 'casePageDataExtracted' event
                       │
                       ├─► PersistentBanner receives event
                       │   │
                       │   ├─► Validates data
                       │   └─► Updates banner UI
                       │
                       ├─► FieldHighlighter.init()
                       │   │
                       │   └─► Highlights fields
                       │
                       ├─► URLBuilder.buildAllButtons(caseData)
                       │   │
                       │   └─► Generates button groups
                       │
                       ├─► DynamicMenu.injectMenu(buttonGroups, caseData)
                       │   │
                       │   └─► Injects buttons into DOM
                       │
                       └─► Other features initialize...
```

### Data Validation Sequence

```
Module wants to display data
   │
   ▼
PageContextValidator.validatePageContextBeforeDisplay()
   │
   ├─► getCurrentCaseContext()
   │   │
   │   ├─► Extract case ID from URL
   │   └─► Extract case number from title
   │
   ├─► Compare case IDs
   │   │
   │   └─► Mismatch → Return invalid
   │
   ├─► Compare case numbers
   │   │
   │   ├─► Match → Return valid
   │   │
   │   └─► Mismatch but case IDs match:
   │       │
   │       └─► waitForTitleUpdate() (if waitForTitle = true)
   │           │
   │           ├─► Poll document.title every 100ms
   │           ├─► Wait up to 2000ms
   │           └─► Return updated context
   │
   └─► Return validation result
       │
       ├─► valid: true → Display data
       └─► valid: false → Clear data (if clearFn provided)
```

---

## Related Documentation

- **[FEATURE_SUMMARY.md](FEATURE_SUMMARY.md)** - Feature overview
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - Implementation details
- **[DEPENDENCIES.md](DEPENDENCIES.md)** - Module dependencies
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture

