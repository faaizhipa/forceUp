# Salesforce Chrome Extension - Complete Knowledge Base

**Version:** 1.0  
**Last Updated:** December 1, 2025  
**Purpose:** Single comprehensive document containing all essential knowledge about this codebase for developers and AI agents

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Architecture](#project-architecture)
3. [Directory Structure](#directory-structure)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [State Management](#state-management)
7. [Critical Patterns & Rules](#critical-patterns--rules)
8. [Module Reference](#module-reference)
9. [Dependencies](#dependencies)
10. [Do's and Don'ts](#dos-and-donts)
11. [Known Issues](#known-issues)
12. [Debugging Guide](#debugging-guide)
13. [Visual Diagrams](#visual-diagrams)
14. [Lessons Learned](#lessons-learned)
15. [Documentation Gaps](#documentation-gaps)
16. [Change Log](#change-log)

---

## Executive Summary

### What This Extension Does

The **Penang CoE Salesforce and Docs Extension** is a Chrome Manifest V3 extension that enhances Salesforce Lightning Experience for support teams at Clarivate and Ex Libris/ProQuest. It provides:

- **Case data extraction and display** via persistent banner
- **Dynamic URL menu generation** for quick access to customer environments
- **Field highlighting** for empty/filled required fields  
- **Timezone conversion** between customer, user, and UTC
- **Case comment memory** with auto-save and restore
- **Knowledge base annotation tools** (highlighting, sticky notes, bookmarks)
- **Multi-tab synchronization** for case data

### Target Domains

| Domain | Primary Features |
|--------|------------------|
| `proquestllc.lightning.force.com` | Full feature set (banner, menu, highlighting, timezone) |
| `clarivateanalytics.lightning.force.com` | Case list highlighting, email validation |
| `support.clarivate.com`, `knowledge.exlibrisgroup.com` | Knowledge base tools (highlighting, notes, bookmarks) |

### Technology Stack

- **Manifest V3** Chrome Extension API
- **Vanilla JavaScript** (no frameworks)
- **Salesforce Lightning** SPA (target platform)
- **Chrome Storage API** for persistence
- **MutationObserver API** for DOM change detection

---

## Project Architecture

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TIER 1: EXTENSION CORE                                      │
│ ┌──────────────────┐  ┌───────────────┐                    │
│ │  popup.html/js   │  │ background.js │                    │
│ │  (Settings UI)   │  │(Service Worker│                    │
│ └──────────────────┘  └───────────────┘                    │
│                                                             │
│ TIER 2: CONTENT SCRIPTS                                     │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ MAIN WORLD              │ ISOLATED WORLD                ││
│ │ interceptor.js          │ content_script_exlibris.js    ││
│ │ (XHR interception)      │ (All modules, chrome.* APIs)  ││
│ │        │                │         ▲                     ││
│ │        └─ CustomEvent ──┘         │                     ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ TIER 3: HOST PAGE (Salesforce Lightning)                    │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Shadow DOM Components │ Dynamic Content │ SPA Routing   ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Cross-World Communication (CRITICAL)

**The extension uses TWO JavaScript execution contexts:**

```
┌────────────────────────────────────────────────────────────┐
│                    WEB PAGE                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ MAIN WORLD (interceptor.js)                         │  │
│  │ • window.exLibrisFetchedCaseData (global)           │  │
│  │ • Can intercept XHR/fetch requests                  │  │
│  │ • ⚠️ NO chrome.* APIs                              │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │ CustomEvent (ONLY bridge!)      │
│                         │ 'EXLIBRIS_DATA_UPDATED'         │
│                         ▼                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ISOLATED WORLD (content scripts)                    │  │
│  │ • window.ExLibrisExtension (DIFFERENT window!)      │  │
│  │ • All modules/ run here                             │  │
│  │ • ✅ Full chrome.* API access                      │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**⚠️ RULE: Variables are NOT shared between worlds. CustomEvents are the ONLY bridge.**

---

## Directory Structure

```
3.0/
├── manifest.json              # Extension configuration (CRITICAL)
├── background.js              # Service worker (ephemeral, MV3)
├── interceptor.js             # MAIN world XHR interceptor
├── content_script.js          # Entry point (all domains)
├── content_script_exlibris.js # Main controller (ProQuest)
├── content_script_highlighter.js # KB sites controller
├── popup.html/js              # Settings UI
├── customerMasterList.json    # Customer database (7,212 records)
│
├── modules/                   # 50+ feature modules
│   ├── [Infrastructure Layer]
│   │   ├── logger.js          # Centralized logging
│   │   ├── debounceUtils.js   # Throttle/debounce utilities
│   │   ├── settingsManager.js # Chrome storage settings
│   │   ├── pageIdentifier.js  # Page type detection
│   │   ├── caseDomUtils.js    # DOM utilities
│   │   └── pageContextValidator.js # Validation utilities
│   │
│   ├── [Data Management Layer]
│   │   ├── caseDataStore.js   # Single source of truth (pub/sub)
│   │   ├── caseContextWatcher.js # Page context monitoring
│   │   ├── customerMasterManager.js # Customer DB + timezone
│   │   └── interceptorCacheManager.js # API data cache
│   │
│   ├── [Data Extraction Layer]
│   │   ├── casePageDataExtractor.js # Main extractor
│   │   ├── caseDataExtractor.js # Field extraction
│   │   ├── shadowTextExtractor.js # Shadow DOM traversal
│   │   └── accountAddressExtractor.js # Address extraction
│   │
│   ├── [Business Logic Layer]
│   │   ├── urlBuilder.js      # Environment URL generation
│   │   ├── timezoneNormalizer.js # IANA timezone normalization
│   │   ├── caseCommentMemory.js # Comment auto-save
│   │   └── unknownCustomerManager.js # Unknown customer handling
│   │
│   ├── [Presentation Layer]
│   │   ├── persistentBanner.js # Case info banner (9000+ lines)
│   │   ├── dynamicMenu.js     # URL button menu
│   │   ├── fieldHighlighter.js # Field status highlighting
│   │   ├── characterCounter.js # Comment character count
│   │   └── highlighter.js     # KB highlighting tools
│   │
│   └── styles/                # CSS files
│
├── docs/                      # Documentation (7 files)
├── archive/                   # Historical docs
├── icons/                     # Extension icons
├── lib/                       # Third-party libraries
└── *.md                       # Root-level reference docs
```

---

## Core Components

### Entry Points (Load Order)

```javascript
// manifest.json content_scripts order:

// 1. MAIN WORLD (document_start) - First to load
"interceptor.js"  // Intercepts XHR before DOM ready

// 2. ISOLATED WORLD (document_start) - Page identification
"pageIdentifier.js", "pageInfoInitializer.js", "pageContextValidator.js"

// 3. ISOLATED WORLD (document_idle) - Main modules
// Infrastructure → Data Management → Extraction → Business → UI
// ... 40+ modules in dependency order ...
"content_script_exlibris.js"  // Main controller (LAST)
```

### Key Module Relationships

```
                    ┌──────────────────────┐
                    │  NavigationObserver  │
                    │  (SPA nav detection) │
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
┌────────────────────┐ ┌──────────────┐ ┌────────────────┐
│ CaseContextWatcher │ │ PageIdentifier│ │ CaseDataStore  │
│ (page monitoring)  │ │ (page type)   │ │ (state + pub/sub)│
└────────┬───────────┘ └──────────────┘ └────────┬───────┘
         │                                        │
         ▼                                        │
┌────────────────────────┐                       │
│ CasePageDataExtractor  │◄──────────────────────┘
│ (extracts case data)   │
└────────┬───────────────┘
         │ emits: casePageDataExtracted
         ▼
┌────────────────────────────────────────────────┐
│            UI SUBSCRIBERS                       │
│  PersistentBanner │ DynamicMenu │ FieldHighlighter │
└────────────────────────────────────────────────┘
```

---

## Data Flow

### Primary Data Flow (Interceptor → UI)

```
User navigates to case page
        │
        ▼
┌───────────────────────────────────────────────────┐
│ 1. INTERCEPTION (MAIN WORLD - interceptor.js)    │
│    Browser sends XHR to Salesforce Aura API      │
│    interceptor.js captures response              │
│    Dispatches: CustomEvent('EXLIBRIS_DATA_UPDATED')│
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│ 2. CACHING (ISOLATED WORLD)                       │
│    content_script_exlibris.js receives event     │
│    InterceptorCacheManager.store() caches data   │
│    CustomerMasterManager enriches data           │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│ 3. VALIDATION                                     │
│    PageContextValidator validates:               │
│    - Case ID from URL                            │
│    - Case Number from document.title             │
│    - Both must match before display              │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│ 4. DISTRIBUTION                                   │
│    CaseDataStore.setCurrentData() → notifies all │
│    Event: 'casePageDataExtracted' dispatched     │
│    Subscribers update UI                         │
└───────────────────────────────────────────────────┘
```

### Data Source Priority

| Priority | Source | Speed | Completeness |
|----------|--------|-------|--------------|
| 1 | Interceptor (API response) | Fastest | Complete (50+ fields) |
| 2 | DOM Extraction (fallback) | Slower | Partial (visible fields) |
| 3 | CustomerMasterManager | On-demand | Enrichment only |

---

## State Management

### State Layers

| Layer | Location | Persistence | Use Case |
|-------|----------|-------------|----------|
| **Ephemeral** | Service Worker (`background.js`) | ~30s idle | Context menus, messaging |
| **In-Memory** | `window.ExLibrisExtension` | Tab lifetime | Current page state |
| **Managed** | `CaseDataStore` (pub/sub) | Tab lifetime | Single source of truth |
| **Persistent** | `chrome.storage.local` (10MB) | Permanent | Customer DB, cache |
| **Synced** | `chrome.storage.sync` (5KB) | Across devices | User preferences |

### Global State Object

```javascript
window.ExLibrisExtension = {
  currentPage: null,          // { type: 'case_page', caseId: '...' }
  currentCaseId: null,        // '5008c00000XYZ'
  currentCaseNumber: null,    // '12345678'
  lastUrl: null,              // Last known URL
  isInitialized: false,       // Extension ready flag
  isNavigating: false,        // Navigation in progress
  settings: {
    timezone: 'Asia/Kuala_Lumpur',
    buttonLabelStyle: 'casual',
    highlightingEnabled: true
  }
};
```

---

## Critical Patterns & Rules

### ⚠️ RULE 1: Always Validate Before Display (HIGHEST PRIORITY)

```javascript
// ✅ REQUIRED PATTERN
async displayCaseData(data) {
  // 1. Validate page context
  const validation = PageContextValidator.validatePageContextBeforeDisplay(
    data.caseId,
    data.caseNumber
  );
  
  if (!validation.valid) {
    Logger.warn('[ModuleName] Validation failed:', validation.reason);
    this.clearDisplay();
    return false;
  }
  
  // 2. Check if already displaying this case
  if (this.displayedCaseId === data.caseId) {
    return true;
  }
  
  // 3. Update UI
  this.updateUI(data);
  this.displayedCaseId = data.caseId;
  return true;
}
```

**Why:** Modules may receive events for Case A after user navigated to Case B.

### ⚠️ RULE 2: Page Context First (Two-Step Process)

```javascript
// ✅ CORRECT: Context first, then DOM query
const context = PageIdentifier.getCurrentCaseContext();
if (!context) return; // Not on valid case page

// Now safe to query DOM
const element = document.querySelector(selector);
```

```javascript
// ❌ WRONG: DOM query before context check
const element = document.querySelector(selector);
const context = getCurrentCaseContext(); // Too late!
```

### ⚠️ RULE 3: Check-Then-Observe Pattern (DOM Queries)

```javascript
// 1. Try immediate query
let element = document.querySelector(selector);
if (element && element.offsetParent !== null) {
  processElement(element);
  return;
}

// 2. Set up MutationObserver
const observer = new MutationObserver((mutations) => {
  element = document.querySelector(selector);
  if (element && element.offsetParent !== null) {
    observer.disconnect(); // ⚠️ CRITICAL: Always disconnect
    processElement(element);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// ⚠️ CRITICAL: Set timeout to prevent infinite observation
setTimeout(() => {
  if (observer) {
    observer.disconnect();
    Logger.warn('[ModuleName] Element not found after timeout');
  }
}, 20000);
```

### ⚠️ RULE 4: Shadow DOM Traversal

```javascript
function queryShadowDOM(selector, root = document.body) {
  // 1. Try direct query
  let element = root.querySelector(selector);
  if (element) return element;

  // 2. Recursively search shadow roots
  const traverse = (node) => {
    // Check for OPEN shadow root only
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

### ⚠️ RULE 5: Module Cleanup (MANDATORY)

```javascript
const MyModule = {
  _observer: null,
  _timer: null,
  _listeners: [],
  
  init() {
    // Setup...
  },
  
  cleanup() {
    // ⚠️ CRITICAL: Always cleanup
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    
    this._listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this._listeners = [];
  }
};
```

### ⚠️ RULE 6: Service Worker State (Manifest V3)

```javascript
// ❌ WRONG: Global state (lost after ~30s idle)
let currentState = {};

// ✅ CORRECT: Persist to storage
await chrome.storage.local.set({ currentState });
const result = await chrome.storage.local.get(['currentState']);
```

---

## Module Reference

### Infrastructure Layer (6 modules)

| Module | File | Purpose |
|--------|------|---------|
| **Logger** | `logger.js` | Centralized logging with debug mode |
| **DebounceUtils** | `debounceUtils.js` | Function throttling/debouncing |
| **SettingsManager** | `settingsManager.js` | chrome.storage.sync settings |
| **PageIdentifier** | `pageIdentifier.js` | Page type detection |
| **CaseDomUtils** | `caseDomUtils.js` | DOM utilities for Lightning |
| **PageContextValidator** | `pageContextValidator.js` | Stale data prevention |

### Data Management Layer (4 modules)

| Module | File | Purpose |
|--------|------|---------|
| **CaseDataStore** | `caseDataStore.js` | Single source of truth, pub/sub |
| **CaseContextWatcher** | `caseContextWatcher.js` | Page context monitoring |
| **CustomerMasterManager** | `customerMasterManager.js` | Customer DB + timezone |
| **InterceptorCacheManager** | `interceptorCacheManager.js` | API response cache |

### Data Extraction Layer (9 modules)

| Module | File | Purpose |
|--------|------|---------|
| **CasePageDataExtractor** | `casePageDataExtractor.js` | Main case extraction |
| **CaseDataExtractor** | `caseDataExtractor.js` | Field-level extraction |
| **CaseCommentExtractor** | `caseCommentExtractor.js` | Comment extraction |
| **ShadowTextExtractor** | `shadowTextExtractor.js` | Shadow DOM text |
| **AccountAddressExtractor** | `accountAddressExtractor.js` | Address extraction |
| **CaseDetailExtractor** | `caseDetailExtractor.js` | Detail field extraction |

### Presentation Layer (13 modules)

| Module | File | Purpose |
|--------|------|---------|
| **PersistentBanner** | `persistentBanner.js` | Case info banner (9000+ lines) |
| **DynamicMenu** | `dynamicMenu.js` | URL button menu |
| **FieldHighlighter** | `fieldHighlighter.js` | Required field highlighting |
| **CharacterCounter** | `characterCounter.js` | Comment character count |
| **Highlighter** | `highlighter.js` | KB highlighting tools |
| **FlexipagePanelInjector** | `flexipagePanelInjector.js` | Panel injection |

---

## Dependencies

### External Libraries (in `/lib/`)

| Library | Purpose | Version |
|---------|---------|---------|
| **DOMPurify** | XSS sanitization | Min |
| **html2canvas** | Screenshot capture | Min |
| **fabric.min.js** | Canvas manipulation | Min |

### Chrome APIs Used

```javascript
chrome.storage.sync       // Settings (synced, 5KB limit)
chrome.storage.local      // Cache, workspace (local, 10MB limit)
chrome.runtime            // Background messaging
chrome.tabs               // Multi-tab sync
chrome.contextMenus       // Right-click menus
```

### Browser APIs

```javascript
MutationObserver          // DOM change detection
IntersectionObserver      // Visibility detection
BroadcastChannel          // Cross-tab communication
performance.now()         // Performance measurement
Intl.DateTimeFormat       // Timezone handling
sessionStorage            // Session-scoped cache
```

---

## Do's and Don'ts

### ✅ DO's

**Module Development:**
- Use IIFE pattern for encapsulation
- Implement `init()` and `cleanup()` methods
- Check `isInitialized` to prevent double init
- Check dependencies with `typeof X !== 'undefined'`
- Use JSDoc for all public functions

**DOM Operations:**
- Always identify page context first (title + URL)
- Use stable SLDS classes (`.slds-page-header`, `.slds-grid`)
- Check visibility before interacting
- Debounce observer callbacks (250ms)
- Disconnect observers in cleanup

**State Management:**
- Use `CaseDataStore.subscribe()` for case data
- Use `chrome.storage` for persistent data
- Clear state on navigation away
- Validate data before display

**Error Handling:**
- Wrap risky operations in try-catch
- Log errors with context: `Logger.error('[Module]', error)`
- Return early on errors

### ❌ DON'Ts

**Never Do:**
- Use dynamic classes (`lwc-*`, `forcegenerated-*`)
- Use position selectors (`nth-child`)
- Use global state in service worker
- Query DOM before page context check
- Skip validation before display
- Forget to disconnect observers
- Use `var` (use `const` or `let`)
- Create circular dependencies

**Salesforce-Specific:**
- Don't assume DOM structure won't change
- Don't query immediately on page load
- Don't ignore Shadow DOM
- Don't rely only on `window.onload` for SPA
- Don't use text content for element selection

---

## Known Issues

### 1. Stale Data Display (Partially Resolved)

**Status:** 🟡 Partially Fixed  
**Severity:** HIGH

**Problem:** UI may show Case A data on Case B page during rapid navigation.

**Mitigation:**
- ✅ `PageContextValidator` validates before display
- ✅ `PersistentBanner` has periodic validation (2s interval)
- ❌ `DynamicMenu` doesn't re-validate
- ❌ No global stale UI clearing mechanism

### 2. Title Update Race Condition

**Status:** 🔴 Active  
**Severity:** MEDIUM

**Problem:** Salesforce updates `document.title` asynchronously (~200-500ms after URL change). Validation may fail during this window.

**Mitigation:** `waitForTitleUpdate()` polls for up to 2 seconds.

### 3. Shadow DOM Performance

**Status:** 🟡 Active  
**Severity:** LOW

**Problem:** Recursive shadow DOM traversal can take 50ms-2000ms on complex pages.

**Mitigation:** Use breadth-first search with depth limits.

---

## Debugging Guide

### Expected Console Log Sequence

```
[ExLibris Extension] Initializing...
[Logger] Logger initialized
[ExLibris Extension] SettingsManager initialized
[ExLibris Extension] CustomerMasterManager initialized
[CaseContextWatcher] Initialized
[CaseDataStore] Initialized
[NavigationObserver] Started navigation monitoring
[PageIdentifier] Page identified: { type: 'case_page', caseId: '...' }
[CasePageDataExtractor] Extracting data for case: 500QO...
[CasePageDataExtractor] Extracted case data (validated)
[CasePageDataExtractor] Dispatched casePageDataExtracted event
```

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Module not initializing | Not in manifest.json | Add to content_scripts array |
| Stale data displayed | Missing validation | Add PageContextValidator check |
| Elements not found | Wrong timing | Use Check-Then-Observe pattern |
| Memory leaks | Missing cleanup | Implement cleanup() method |
| Cross-world access fails | Wrong pattern | Use CustomEvent bridge |

### Debug Mode

```javascript
// Enable debug logging
Logger.init({ debugMode: true });

// Check module state
console.log(window.ExLibrisExtension);

// Check CaseDataStore
console.log(CaseDataStore.getCurrentData());
```

---

## Visual Diagrams

### Module Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                      │
│  persistentBanner │ dynamicMenu │ fieldHighlighter      │
│  characterCounter │ highlighter │ flexipagePanelInjector│
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                  BUSINESS LOGIC LAYER                    │
│  urlBuilder │ timezoneNormalizer │ caseCommentMemory    │
│  addressTimezoneResolver │ unknownCustomerManager       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                  DATA EXTRACTION LAYER                   │
│  casePageDataExtractor │ caseDataExtractor              │
│  shadowTextExtractor │ accountAddressExtractor          │
│  caseCommentExtractor │ caseDetailExtractor             │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                  DATA MANAGEMENT LAYER                   │
│  caseDataStore │ caseContextWatcher                     │
│  customerMasterManager │ interceptorCacheManager        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                  INFRASTRUCTURE LAYER                    │
│  logger │ debounceUtils │ settingsManager               │
│  pageIdentifier │ caseDomUtils │ pageContextValidator   │
└─────────────────────────────────────────────────────────┘
```

### Navigation Detection Flow

```
User Navigation
      │
      ├─► Title MutationObserver ──┐
      ├─► history.pushState ───────┼─► NavigationObserver
      ├─► popstate event ──────────┤   (debounced 250ms)
      └─► hashchange event ────────┘
                                   │
                                   ▼
                          PageIdentifier
                          (page type detection)
                                   │
                                   ▼
                       CaseContextWatcher
                       (case ID + number validation)
                                   │
                                   ▼
                        CasePageDataExtractor
                        (data extraction)
                                   │
                                   ▼
                        UI Subscribers Update
```

---

## Lessons Learned

### Code Quality

1. **Validation is Critical**: Always validate before displaying data to prevent stale data bugs
2. **Context First**: Always identify page context before querying DOM
3. **Cleanup is Mandatory**: Always implement cleanup to prevent memory leaks
4. **Shadow DOM is Complex**: Check shadow root mode and traverse properly
5. **SPA Navigation is Tricky**: Use NavigationObserver, don't rely on single signals
6. **Service Workers are Ephemeral**: Never use global state, persist to storage
7. **Salesforce Changes Frequently**: Use stable selectors, have fallbacks
8. **Cross-World is NOT Shared**: CustomEvents are the ONLY bridge between worlds

### Architecture

9. **Interceptor is Primary**: API interception is faster and more complete than DOM scraping
10. **Pub/Sub Decouples**: CaseDataStore allows loose coupling between extractor and UI
11. **Early Page Identification**: pageInfoInitializer at document_start enables early detection
12. **Module Load Order Matters**: Dependencies must load before dependents

### Documentation

13. **Single Source of Truth**: Keep `docs/` folder authoritative
14. **Update As You Go**: Document changes immediately
15. **Track Lessons**: Every bug fix should add to lessons learned

---

## Documentation Gaps

### Areas Needing More Documentation

| Area | Gap | Priority |
|------|-----|----------|
| `persistentBanner.js` | 9000+ lines, needs function catalog | HIGH |
| Error Recovery | No retry mechanism documented | MEDIUM |
| Performance Metrics | No benchmarks documented | LOW |
| Test Scenarios | Manual test checklist incomplete | MEDIUM |

### Questions to Clarify

1. What is the expected behavior when CustomerMasterManager has no match?
2. What's the maximum acceptable extraction time?
3. Should stale data be silently cleared or show an error?
4. What happens when sessionStorage exceeds quota?

---

## Change Log

### December 1, 2025 - Documentation Consolidation

**Description**: Created comprehensive CODEBASE_KNOWLEDGE.md consolidating all documentation.

**Changes:**
- Created single-file knowledge base
- Documented all critical patterns
- Added visual diagrams
- Consolidated lessons learned

**Files:** `CODEBASE_KNOWLEDGE.md`

---

*This document is the single source of truth for codebase knowledge. Update it with every significant change.*

