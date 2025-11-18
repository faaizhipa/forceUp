# Module Dependencies

This document maps all module dependencies, data flow, and external API usage in the codebase.

## Module Dependency Graph

### Core Infrastructure (No Dependencies)

```
Logger
├── No dependencies
└── Used by: All modules

DebounceUtils
├── No dependencies
└── Used by: ContextMenuHandler, CharacterCounter, FieldHighlighter, NavigationObserver

SettingsManager
├── No dependencies
└── Used by: content_script_exlibris.js, PersistentBanner, ConfigurationWarningBanner

PageIdentifier
├── No dependencies
└── Used by: content_script_exlibris.js, CasePageDataExtractor, CaseCommentMemory
```

### Data Management Layer

```
CustomerDataManager
├── No dependencies
└── Used by: CaseDataExtractor, CasePageDataExtractor, CaseDetailExtractor, TimezoneStorage, UnknownCustomerManager

CacheManager
├── No dependencies
└── Used by: content_script_exlibris.js, CaseDataExtractor

TimezoneStorage
├── Depends on: CustomerDataManager
└── Used by: CaseTimezoneResolver, UnknownCustomerManager, TimezoneDetector

UserPreferences
├── No dependencies
└── Used by: TimezoneUtils, ConfigurationWarningBanner, content_script_exlibris.js
```

### Data Extraction Layer

```
CaseDataExtractor
├── Depends on: CustomerDataManager (optional)
└── Used by: CasePageDataExtractor, PersistentBanner, FlexipagePanelInjector, CaseDetailExtractor

CasePageDataExtractor
├── Depends on: PageIdentifier, CustomerDataManager (optional)
└── Used by: PersistentBanner, FlexipagePanelInjector

CaseCommentExtractor
├── No dependencies
└── Used by: PersistentBanner, CaseCommentMemory

CaseDetailExtractor
├── Depends on: CaseDataExtractor, CustomerDataManager, URLBuilder (optional)
└── Used by: FlexipagePanelInjector, UnknownCustomerManager

AccountAddressExtractor
├── No dependencies
└── Used by: CaseTimezoneResolver

ShadowTextExtractor
├── No dependencies
└── Used by: CaseDataExtractor, CasePageDataExtractor
```

### UI Components Layer

```
FlexipagePanelInjector
├── Depends on: ScrollController, CaseDataExtractor, ImplementationStatus, TimezoneDetector (all optional)
└── Used by: CaseTimezoneResolver, UnknownCustomerManager, PersistentBanner

PersistentBanner
├── Depends on: NavigationObserver, CasePageDataExtractor, CaseCommentExtractor, CaseDataExtractor, FlexipagePanelInjector, CaseTimezoneResolver, CaseDetailExtractor (all optional)
└── Used by: content_script_exlibris.js

DynamicMenu
├── Depends on: URLBuilder, CaseDataExtractor
└── Used by: content_script_exlibris.js

FieldHighlighter
├── Depends on: DebounceUtils (optional)
└── Used by: content_script_exlibris.js

CharacterCounter
├── Depends on: DebounceUtils
└── Used by: content_script_exlibris.js

ConfigurationWarningBanner
├── Depends on: UserPreferences
└── Used by: content_script_exlibris.js
```

### Utility Layer

```
NavigationObserver
├── No dependencies
└── Used by: PersistentBanner, PageIdentifier, content_script_exlibris.js

TextFormatter
├── No dependencies
└── Used by: ContextMenuHandler, KeyboardShortcuts

URLBuilder
├── No dependencies
└── Used by: DynamicMenu, CaseDetailExtractor

ScrollController
├── No dependencies
└── Used by: FlexipagePanelInjector, UnknownCustomerManager

EventSimulator
├── No dependencies
└── Used by: FlexipagePanelInjector, CaseTimezoneResolver

TimezoneDetector
├── No dependencies
└── Used by: FlexipagePanelInjector, TimezoneUtils

AddressTimezoneResolver
├── No dependencies
└── Used by: CaseTimezoneResolver, AccountAddressExtractor

TimezoneUtils
├── Depends on: UserPreferences
└── Used by: content_script_exlibris.js
```

### Feature Modules

```
ContextMenuHandler
├── Depends on: DebounceUtils, TextFormatter
└── Used by: content_script_exlibris.js, background.js

KeyboardShortcuts
├── Depends on: TextFormatter
└── Used by: content_script_exlibris.js

CaseCommentMemory
├── Depends on: PageIdentifier
└── Used by: content_script_exlibris.js

CaseTimezoneResolver
├── Depends on: FlexipagePanelInjector, TimezoneStorage, AccountAddressExtractor, AddressTimezoneResolver (all optional)
└── Used by: PersistentBanner, FlexipagePanelInjector

UnknownCustomerManager
├── Depends on: TimezoneStorage, FlexipagePanelInjector, ScrollController, CaseDetailExtractor, CaseDataExtractor (all optional)
└── Used by: FlexipagePanelInjector

ImplementationStatus
├── No dependencies
└── Used by: FlexipagePanelInjector

MultiTabSync
├── No dependencies
└── Used by: content_script_exlibris.js
```

## Load Order (manifest.json)

The modules are loaded in this order for the Ex Libris content script:

1. **Core Utilities** (no dependencies):
   - `debounceUtils.js`
   - `logger.js`
   - `pageIdentifier.js`
   - `settingsManager.js`

2. **Data Management**:
   - `customerDataManager.js`
   - `cacheManager.js`

3. **Data Extraction**:
   - `caseDataExtractor.js`
   - `caseCommentExtractor.js`
   - `casePageDataExtractor.js`

4. **UI Utilities**:
   - `fieldHighlighter.js`
   - `urlBuilder.js`
   - `textFormatter.js`
   - `keyboardShortcuts.js`
   - `contextMenuHandler.js`
   - `multiTabSync.js`
   - `caseCommentMemory.js`
   - `dynamicMenu.js`
   - `characterCounter.js`
   - `shadowTextExtractor.js`
   - `eventSimulator.js`
   - `scrollController.js`
   - `navigationObserver.js`

5. **Timezone Modules**:
   - `timezoneDetector.js`
   - `addressTimezoneResolver.js`
   - `accountAddressExtractor.js`
   - `timezoneStorage.js`
   - `caseTimezoneResolver.js`
   - `timezoneUtils.js`

6. **UI Components**:
   - `unknownCustomerManager.js`
   - `caseDetailExtractor.js`
   - `userPreferences.js`
   - `configurationWarningBanner.js`
   - `persistentBanner.js`
   - `implementationStatus.js`
   - `flexipagePanelInjector.js`

7. **Main Controller** (last):
   - `content_script_exlibris.js`

## Runtime Dependencies

### Dependency Checking Pattern

Most modules use optional dependency checking:

```javascript
if (typeof DependencyModule !== 'undefined') {
  // Use dependency
  DependencyModule.someFunction();
} else {
  console.warn('Dependency not available');
  // Graceful degradation
}
```

### Common Dependency Patterns

#### 1. Optional Dependencies
Modules check for dependencies before use:
- `CaseDataExtractor` → `CustomerDataManager` (optional)
- `FlexipagePanelInjector` → `ScrollController`, `CaseDataExtractor` (optional)
- `PersistentBanner` → Multiple optional dependencies

#### 2. Required Dependencies
Some modules require dependencies:
- `CasePageDataExtractor` → `PageIdentifier` (required)
- `ContextMenuHandler` → `TextFormatter` (required)
- `TimezoneStorage` → `CustomerDataManager` (required)

#### 3. Circular Dependencies
**None identified** - The codebase avoids circular dependencies through:
- Optional dependency checking
- Event-based communication
- Dependency injection patterns

## Data Flow Dependencies

### Storage Dependencies

```
chrome.storage.sync
├── SettingsManager
├── UserPreferences
└── PersistentBanner (feature flags)

chrome.storage.local
├── CacheManager (case data cache)
├── CustomerDataManager (customer list)
├── TimezoneStorage (timezone data)
├── CaseCommentMemory (comment history)
└── UserPreferences (user settings)
```

### Message Passing Dependencies

```
background.js
├── Sends: contextMenuClick messages
└── Receives: switchToOtherTab requests

content_script_exlibris.js
├── Sends: Various action messages
└── Receives: pageTypeIdentified, contextMenuClick

ContextMenuHandler
├── Receives: contextMenuClick from background.js
└── Uses: TextFormatter for formatting

MultiTabSync
├── Uses: BroadcastChannel API
└── Sends: switchToOtherTab to background.js
```

### Event Dependencies

```
Custom Events:
├── 'casePageDataExtracted' (CasePageDataExtractor → PersistentBanner)
├── 'exlibris:unknownCustomerDetected' (→ UnknownCustomerManager)
└── Navigation events (NavigationObserver → All modules)
```

## External API Dependencies

### Chrome Extension APIs

```javascript
// Storage API
chrome.storage.sync    // Settings, feature flags
chrome.storage.local   // Cache, customer data, timezone data

// Tabs API
chrome.tabs.query      // MultiTabSync, background.js
chrome.tabs.update     // MultiTabSync, background.js
chrome.tabs.sendMessage // background.js → content scripts

// Context Menus API
chrome.contextMenus.create    // background.js
chrome.contextMenus.onClicked  // background.js

// Runtime API
chrome.runtime.onMessage      // All modules
chrome.runtime.sendMessage    // All modules
chrome.runtime.onInstalled    // background.js
```

### Browser APIs

```javascript
// DOM APIs
document.querySelector/querySelectorAll
document.getElementById
window.getComputedStyle
element.shadowRoot
MutationObserver
IntersectionObserver

// Storage APIs
sessionStorage  // PersistentBanner (navigation history)
localStorage    // Not used (uses chrome.storage instead)

// Communication APIs
BroadcastChannel  // MultiTabSync
MessageChannel    // Not used

// Performance APIs
performance.now()  // Logger.perfAsync
```

### No External Libraries

The codebase uses **vanilla JavaScript only** - no NPM dependencies, no external frameworks.

## Dependency Injection Patterns

### Pattern 1: Global Object Check
```javascript
if (typeof DependencyModule !== 'undefined') {
  DependencyModule.init();
}
```

### Pattern 2: Event-Based Communication
```javascript
// Module A dispatches event
document.dispatchEvent(new CustomEvent('dataExtracted', { detail: data }));

// Module B listens
document.addEventListener('dataExtracted', (event) => {
  const data = event.detail;
  // Process data
});
```

### Pattern 3: Function Parameters
```javascript
// Module A calls Module B with data
function processData(data) {
  if (typeof ModuleB !== 'undefined') {
    ModuleB.process(data);
  }
}
```

## Circular Dependency Prevention

The codebase prevents circular dependencies through:

1. **Optional Dependencies**: Most dependencies are optional and checked at runtime
2. **Event-Driven Architecture**: Modules communicate via events rather than direct calls
3. **Dependency Injection**: Dependencies passed as parameters rather than imported
4. **Load Order**: manifest.json ensures dependencies load before dependents

## Module Initialization Order

### Initialization Flow

```
1. Core modules initialize (Logger, DebounceUtils, SettingsManager)
2. Data managers initialize (CustomerDataManager, CacheManager)
3. NavigationObserver starts
4. PageIdentifier starts monitoring
5. Feature modules initialize based on page type
6. UI components initialize
7. Event listeners attached
```

### Example: Case Page Initialization

```
PageIdentifier detects case page
  ↓
CasePageDataExtractor.init()
  ↓
CasePageDataExtractor extracts data
  ↓
Dispatches 'casePageDataExtracted' event
  ↓
PersistentBanner receives event
  ↓
FlexipagePanelInjector.ensureInjected()
  ↓
CaseTimezoneResolver.init() (if panel injected)
  ↓
FieldHighlighter.init()
  ↓
DynamicMenu.injectMenu()
```

## Dependency Issues and Recommendations

### Current Issues

1. **Optional Dependency Checking**: Many modules use `typeof` checks, which is verbose but safe
   - **Recommendation**: Consider a dependency injection system for cleaner code

2. **Event Coupling**: Some modules are tightly coupled via events
   - **Recommendation**: Document event contracts clearly

3. **Load Order Dependency**: Modules depend on load order in manifest.json
   - **Recommendation**: Add explicit dependency declarations

### Best Practices

1. ✅ **Optional Dependencies**: Always check for optional dependencies
2. ✅ **Graceful Degradation**: Modules work even if dependencies missing
3. ✅ **Event-Based Communication**: Use events for loose coupling
4. ✅ **No Circular Dependencies**: Architecture prevents cycles
5. ✅ **Clear Module Boundaries**: Each module has single responsibility

## Module Communication Patterns

### Direct Function Calls
```javascript
// When dependency is guaranteed
CustomerDataManager.findByInstitutionCode(code);
```

### Optional Function Calls
```javascript
// When dependency is optional
if (typeof ScrollController !== 'undefined') {
  await ScrollController.toBottom();
}
```

### Event-Based Communication
```javascript
// Loose coupling via events
document.addEventListener('casePageDataExtracted', handler);
```

### Message Passing
```javascript
// Cross-context communication
chrome.runtime.sendMessage({ action: 'doSomething' });
```

## Data Flow Diagrams

### Case Data Extraction Flow

```
PageIdentifier
  ↓ (detects case page)
CasePageDataExtractor
  ↓ (extracts data)
CustomerDataManager (enriches with customer data)
  ↓
Dispatches 'casePageDataExtracted' event
  ↓
PersistentBanner (receives event, updates UI)
FlexipagePanelInjector (receives event, updates panel)
DynamicMenu (receives event, updates buttons)
```

### Timezone Resolution Flow

```
CaseTimezoneResolver.init()
  ↓
FlexipagePanelInjector.ensureInjected()
  ↓
Extracts account name
  ↓
TimezoneStorage.getTimezone() (checks cache)
  ↓
If cache miss:
  AccountAddressExtractor (extracts address)
    ↓
  AddressTimezoneResolver.resolveTimezone()
    ↓
  TimezoneStorage.storeTimezone()
```

### Settings Flow

```
User changes settings in popup
  ↓
chrome.storage.sync.set()
  ↓
chrome.storage.onChanged event
  ↓
SettingsManager (updates internal state)
  ↓
Modules listening to settings (update behavior)
```

## External Service Dependencies

### None

The extension does not make HTTP requests or depend on external services. All data is:
- Extracted from Salesforce pages
- Stored locally in chrome.storage
- Processed client-side

## Testing Dependencies

### Module Isolation

Each module can be tested independently because:
- Dependencies are optional
- Modules use dependency injection
- No global state (except chrome.storage)

### Mock Dependencies

For testing, dependencies can be mocked:
```javascript
// Mock CustomerDataManager
window.CustomerDataManager = {
  findByInstitutionCode: jest.fn()
};
```

