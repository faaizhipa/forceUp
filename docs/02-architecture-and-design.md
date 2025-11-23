# Architecture & Design

**Document Version:** 1.0  
**Last Updated:** January 23, 2025  
**Reference:** See also [ARCHITECTURE.md](../ARCHITECTURE.md) for visual diagrams

---

## Table of Contents

- [System Architecture Overview](#system-architecture-overview)
- [Chrome Extension Structure](#chrome-extension-structure)
- [Module Organization](#module-organization)
- [Entry Points and Load Order](#entry-points-and-load-order)
- [Manifest V3 Considerations](#manifest-v3-considerations)
- [Design Patterns](#design-patterns)
- [Communication Patterns](#communication-patterns)
- [Performance Architecture](#performance-architecture)

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                              │
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │   Popup UI   │◄───────►│  Background  │                      │
│  │ (Settings)   │         │Service Worker│                      │
│  └──────┬───────┘         └──────┬───────┘                      │
│         │                         │                              │
│         │    chrome.storage.sync  │                              │
│         └────────────┬────────────┘                              │
│                      │                                            │
│              ┌───────▼────────┐                                  │
│              │ User Settings  │                                  │
│              │  - Timezone    │                                  │
│              │  - Label Style │                                  │
│              │  - Menu Loc    │                                  │
│              └───────┬────────┘                                  │
│                      │                                            │
│         ┌────────────▼────────────┐                              │
│         │   Content Scripts       │                              │
│         │  (ProQuest SFDC Only)   │                              │
│         └────────────┬────────────┘                              │
│                      │                                            │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │    Salesforce DOM            │
        │  (proquestllc.lightning...)  │
        └──────────────────────────────┘
```

### Three-Tier Architecture

**1. Extension Core (Background)**
- Service worker for background tasks
- Context menu management
- Cross-tab coordination
- Extension lifecycle management

**2. Content Scripts (Injected)**
- DOM manipulation and extraction
- Feature modules (40+ modules)
- Event handling
- State management

**3. Host Page (Salesforce)**
- Lightning SPA framework
- Shadow DOM components
- Dynamic content loading
- Navigation routing

---

## Chrome Extension Structure

### Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Penang CoE Salesforce and Docs Extension",
  "version": "7.2",
  
  "background": {
    "service_worker": "background.js"  // Ephemeral worker
  },
  
  "action": {
    "default_popup": "popup.html"  // Settings UI
  },
  
  "content_scripts": [
    {
      "matches": ["https://proquestllc.lightning.force.com/*"],
      "js": ["content_script.js", "modules/*.js", "content_script_exlibris.js"],
      "run_at": "document_idle",  // After DOM ready
      "css": ["modules/styles/*.css"]
    }
  ],
  
  "permissions": [
    "storage",      // Settings and cache
    "tabs",         // Multi-tab sync
    "activeTab",    // Content injection
    "contextMenus"  // Right-click menus
  ]
}
```

### Key Differences from Manifest V2

| Aspect | V2 (Old) | V3 (Current) |
|--------|----------|--------------|
| Background | Persistent page | Ephemeral service worker |
| Global State | Survives restarts | Lost on termination |
| Storage | Same | Use chrome.storage for persistence |
| Content Security | Relaxed | Stricter (no inline scripts) |
| Alarms | setTimeout in background | chrome.alarms API |

---

## Module Organization

### Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│  persistentBanner, dynamicMenu, fieldHighlighter       │
│  characterCounter, flexipagePanelInjector              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                  │
│  caseTimezoneResolver, urlBuilder, timezoneConverter   │
│  caseCommentMemory, unknownCustomerManager             │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA ACCESS LAYER                     │
│  caseDataExtractor, casePageDataExtractor              │
│  caseCommentExtractor, caseDetailExtractor             │
│  accountAddressExtractor, shadowTextExtractor          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA MANAGEMENT LAYER                 │
│  caseDataStore, caseContextWatcher                      │
│  customerDataManager, timezoneStorage                   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                  │
│  logger, debounceUtils, navigationObserver              │
│  settingsManager, pageIdentifier, caseDomUtils          │
└─────────────────────────────────────────────────────────┘
```

### Module Categories

**Infrastructure (6 modules)**
- Foundation utilities used by all other modules
- No dependencies on other modules
- Examples: Logger, DebounceUtils, SettingsManager

**Data Management (4 modules)**
- Single source of truth for application state
- Coordinates data flow
- Examples: CaseDataStore, CaseContextWatcher

**Data Extraction (9 modules)**
- Reads data from Salesforce DOM
- Handles Shadow DOM traversal
- Examples: CaseDataExtractor, CasePageDataExtractor

**Business Logic (8 modules)**
- Implements feature logic
- Transforms and enriches data
- Examples: TimezoneResolver, URLBuilder

**Presentation (13 modules)**
- UI components and injection
- User interaction handling
- Examples: PersistentBanner, DynamicMenu, FieldHighlighter

---

## Entry Points and Load Order

### 1. Background Script (Service Worker)

```javascript
// background.js - Runs in extension context
// Lifecycle: Ephemeral, terminates after 30s of inactivity

chrome.runtime.onInstalled.addListener((details) => {
  // Extension install/update
  createContextMenus();
  if (details.reason === 'update') {
    DataMigration.createBackup();
    chrome.tabs.create({ url: 'updated.html' });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Forward to content script
  chrome.tabs.sendMessage(tab.id, { action: 'contextMenuClick', info });
});
```

### 2. Content Scripts (Injected into Salesforce)

#### Load Order (manifest.json)

```javascript
// 1. CORE INFRASTRUCTURE (No dependencies)
"modules/debounceUtils.js"
"modules/logger.js"
"modules/pageIdentifier.js"
"modules/settingsManager.js"

// 2. DATA MANAGEMENT
"modules/pageContextValidator.js"
"modules/caseDomUtils.js"
"modules/caseContextWatcher.js"  // Depends on NavigationObserver
"modules/caseDataStore.js"       // Depends on CaseContextWatcher
"modules/customerDataManager.js"

// 3. DATA EXTRACTION
"modules/caseDataExtractor.js"
"modules/caseCommentExtractor.js"
"modules/casePageDataExtractor.js"
"modules/shadowTextExtractor.js"
"modules/accountAddressExtractor.js"
"modules/caseDetailExtractor.js"

// 4. UTILITIES
"modules/fieldHighlighter.js"
"modules/urlBuilder.js"
"modules/textFormatter.js"
"modules/navigationObserver.js"
"modules/scrollController.js"
"modules/eventSimulator.js"

// 5. FEATURES
"modules/caseCommentMemory.js"
"modules/characterCounter.js"
"modules/keyboardShortcuts.js"
"modules/contextMenuHandler.js"
"modules/multiTabSync.js"
"modules/timezoneDetector.js"
"modules/timezoneConverter.js"
"modules/caseTimezoneResolver.js"

// 6. UI COMPONENTS
"modules/dynamicMenu.js"
"modules/persistentBanner.js"
"modules/configurationWarningBanner.js"
"modules/flexipagePanelInjector.js"
"modules/unknownCustomerManager.js"

// 7. MAIN CONTROLLER (Last)
"content_script_exlibris.js"
```

#### Why This Order Matters

1. **Infrastructure First**: Core utilities must load before modules that use them
2. **Data Management Early**: State managers needed by extractors
3. **Extractors Before Features**: Features consume extracted data
4. **UI Components Late**: Need data and business logic modules ready
5. **Controller Last**: Orchestrates all modules, must load after everything

### 3. Initialization Flow

```javascript
// content_script_exlibris.js
(function() {
  'use strict';

  const ExLibrisExtension = {
    async init() {
      // 1. Initialize core modules
      Logger.init({ debugMode: false });
      await SettingsManager.init();
      await CustomerDataManager.init();
      
      // 2. Initialize watchers
      CaseContextWatcher.init();
      CaseDataStore.init();
      NavigationObserver.start();
      
      // 3. Start page monitoring
      PageIdentifier.monitorPageChanges((pageInfo) => {
        this.handlePageChange(pageInfo);
      });
      
      // 4. Listen for messages
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true;
      });
    },
    
    async handlePageChange(pageInfo) {
      // Initialize features based on page type
      if (pageInfo.type === 'CASE_PAGE') {
        await this.initializeCasePageFeatures();
      } else if (pageInfo.type === 'CASES_LIST') {
        await this.initializeCaseListFeatures();
      }
    }
  };

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ExLibrisExtension.init());
  } else {
    ExLibrisExtension.init();
  }
  
  window.ExLibrisExtension = ExLibrisExtension;
})();
```

---

## Manifest V3 Considerations

### Service Worker Constraints

**Problem**: Service workers are ephemeral and terminate after 30 seconds of inactivity.

**Solution**:
```javascript
// ❌ BAD: Global state in service worker (lost on termination)
let currentState = {};

// ✅ GOOD: Persist to storage
chrome.storage.local.set({ currentState });
```

### Content Script State Management

**Problem**: Content scripts persist across SPA navigation but may load asynchronously.

**Solution**:
```javascript
// ✅ GOOD: Global state object for SPA state
window.ExLibrisExtension = {
  currentPage: null,
  currentCaseId: null,
  caseData: null
};

// Modules access immediately (no async wait)
if (window.ExLibrisExtension?.currentCaseId) {
  const caseId = window.ExLibrisExtension.currentCaseId;
}
```

### Storage Strategy

**chrome.storage.sync** (5KB limit, synced across devices)
- User preferences
- Feature flags
- UI settings

**chrome.storage.local** (10MB limit, local only)
- Cache data
- Customer database
- Timezone mappings
- Comment history

**In-Memory (Tab-scoped)**
- Current page state
- Current case data
- Active observers

---

## Design Patterns

### 1. Module Pattern (IIFE)

```javascript
const ModuleName = (function() {
  'use strict';

  // Private state
  let isInitialized = false;
  let observer = null;

  // Private functions
  function privateHelper() {
    // ...
  }

  // Public API
  return {
    init() {
      if (isInitialized) return;
      // Initialize
      isInitialized = true;
    },
    
    cleanup() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      isInitialized = false;
    }
  };
})();
```

**Benefits:**
- Encapsulation without build tools
- Private state via closures
- Single global per module
- Clear public API

### 2. Observer Pattern

```javascript
const CaseDataStore = {
  subscribers: new Set(),
  
  subscribe(callback) {
    this.subscribers.add(callback);
    
    // Emit current state immediately
    callback({ data: this.currentData });
    
    // Return unsubscribe function
    return () => this.subscribers.delete(callback);
  },
  
  notify(data) {
    this.subscribers.forEach(cb => cb({ data }));
  }
};
```

**Usage:**
```javascript
// Module A: Subscribe to updates
const unsubscribe = CaseDataStore.subscribe(({ data }) => {
  console.log('Data updated:', data);
});

// Module B: Publish update
CaseDataStore.setCurrentData(newData);  // Notifies all subscribers
```

### 3. Event-Driven Architecture

```javascript
// Module A: Emit event
document.dispatchEvent(new CustomEvent('casePageDataExtracted', {
  detail: { caseData },
  bubbles: true,
  composed: true  // Crosses shadow DOM boundaries
}));

// Module B: Listen for event
document.addEventListener('casePageDataExtracted', (event) => {
  const { caseData } = event.detail;
  this.handleCaseData(caseData);
});
```

### 4. Check-Then-Observe Pattern (Salesforce Lightning)

```javascript
// 1. Try immediate query
let element = document.querySelector(selector);
if (element) {
  processElement(element);
  return;
}

// 2. If not found, set up MutationObserver
const observer = new MutationObserver((mutations) => {
  element = document.querySelector(selector);
  if (element) {
    observer.disconnect();  // CRITICAL: Always disconnect
    processElement(element);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
```

**Why Critical:** Salesforce Lightning loads components asynchronously. Elements may not exist on initial script execution.

### 5. Idempotent Injection Pattern

```javascript
function ensureInjected(selector, createFn, marker = 'exl-injected') {
  const container = document.querySelector(selector);
  if (!container) return false;

  // Check if already injected
  if (container.dataset[marker] === 'true') {
    return true;
  }

  // Inject
  const element = createFn();
  container.appendChild(element);
  container.dataset[marker] = 'true';
  
  return true;
}
```

**Benefits:**
- Safe to call multiple times
- Prevents duplicate injections
- Works across SPA navigation

---

## Communication Patterns

### 1. Cross-Context Messaging (Service Worker ↔ Content Script)

```javascript
// Content Script → Service Worker
chrome.runtime.sendMessage({ action: 'getData' }, (response) => {
  console.log('Response:', response);
});

// Service Worker → Content Script
chrome.tabs.sendMessage(tabId, { action: 'update', data });

// Listener (in either context)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getData') {
    sendResponse({ data: result });
    return true;  // Keep channel open for async response
  }
});
```

### 2. Cross-Tab Communication (BroadcastChannel)

```javascript
// Tab A: Broadcast message
const channel = new BroadcastChannel('case-sync');
channel.postMessage({ caseId: '12345', action: 'switch' });

// Tab B: Receive message
channel.addEventListener('message', (event) => {
  console.log('Received:', event.data);
});
```

### 3. Storage-Based Sync

```javascript
// Tab A: Update storage
await chrome.storage.local.set({ currentCase: caseData });

// Tab B: Listen for changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.currentCase) {
    const newData = changes.currentCase.newValue;
    this.handleCaseDataUpdate(newData);
  }
});
```

### 4. Event-Based (Within Same Context)

```javascript
// Module A: Dispatch custom event
document.dispatchEvent(new CustomEvent('dataReady', { 
  detail: { data } 
}));

// Module B: Listen
document.addEventListener('dataReady', (event) => {
  this.process(event.detail.data);
});
```

---

## Performance Architecture

### Lazy Loading Strategy

```javascript
// Critical path: Load immediately
async initializeCasePageFeatures() {
  // Phase 1: Critical features (blocking)
  await Promise.all([
    FieldHighlighter.init(),
    PersistentBanner.init()
  ]);

  // Phase 2: Important features (non-blocking)
  CaseCommentMemory.init();
  CharacterCounter.init();

  // Phase 3: Nice-to-have features (idle callback)
  requestIdleCallback(() => {
    UnknownCustomerManager.init();
  }, { timeout: 2000 });
}
```

### Debouncing Strategy

```javascript
// Navigation observer with debouncing
const observer = new MutationObserver(
  DebounceUtils.debounce(() => {
    this.handleDOMChange();
  }, 250)  // Wait 250ms for changes to settle
);
```

### Caching Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    Cache Layers                          │
├─────────────────────────────────────────────────────────┤
│  L1: In-Memory (Fastest, ~1ms access)                   │
│      - window.ExLibrisExtension.caseData                │
│      - Module-scoped caches                             │
├─────────────────────────────────────────────────────────┤
│  L2: CaseDataStore (Fast, ~5ms access)                  │
│      - Single source of truth                           │
│      - Validated against CaseContextWatcher             │
├─────────────────────────────────────────────────────────┤
│  L3: chrome.storage.local (Medium, ~20ms access)        │
│      - Customer database                                │
│      - Timezone mappings                                │
│      - Comment history                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Salesforce Lightning Specifics

### SPA Navigation Detection

```javascript
// Multi-signal navigation detection
NavigationObserver.start()  // Monitors:
  - document.title changes (MutationObserver)
  - history.pushState/replaceState (intercept)
  - popstate event (browser back/forward)
  - hashchange event (URL hash changes)
```

### Shadow DOM Traversal

```javascript
function queryShadowDOM(selector, root = document.body) {
  // 1. Try direct query
  let element = root.querySelector(selector);
  if (element) return element;

  // 2. Recursively search shadow roots
  const traverse = (node) => {
    if (node.shadowRoot && node.shadowRoot.mode === 'open') {
      const found = node.shadowRoot.querySelector(selector);
      if (found) return found;
      
      for (const child of node.shadowRoot.children) {
        const result = traverse(child);
        if (result) return result;
      }
    }

    for (const child of node.children) {
      const result = traverse(child);
      if (result) return result;
    }

    return null;
  };

  return traverse(root);
}
```

### Lazy Loading Detection

```javascript
function setupLazyLoadDetection(selector, callback) {
  let debounceTimer = null;

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        callback(element);
      }
    }, 300);  // Wait for mutations to settle
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Check immediately in case already loaded
  const existing = document.querySelector(selector);
  if (existing && existing.offsetParent !== null) {
    callback(existing);
  }

  return observer;
}
```

---

## Security Architecture

### Content Security Policy (CSP)

**Restrictions:**
- ❌ No `eval()`
- ❌ No `innerHTML` with user input
- ❌ No inline `<script>` tags
- ❌ No inline event handlers (`onclick=""`)

**Solutions:**
```javascript
// ✅ Use createElement and textContent
const div = document.createElement('div');
div.textContent = userInput;  // Safe

// ✅ Use addEventListener
element.addEventListener('click', handler);

// ✅ Use external CSS files
// manifest.json: "css": ["styles/injected-panel.css"]
```

### Data Isolation

```javascript
// Content scripts run in isolated world
// Cannot access:
// - Page JavaScript variables
// - Page JavaScript functions
// - Salesforce internal APIs

// Can access:
// - DOM (read/write)
// - Chrome Extension APIs
// - Own variables and functions
```

---

## Next Steps

- **For module details**: See [03-core-modules.md](./03-core-modules.md)
- **For data flow**: See [04-data-flow.md](./04-data-flow.md)
- **For state management**: See [05-state-management.md](./05-state-management.md)

---

**[← Back: Project Overview](./01-project-overview.md)** | **[↑ Main Documentation](./explanation.md)** | **[Next: Core Modules →](./03-core-modules.md)**
