# Salesforce Chrome Extension - Copilot Instructions

**IMPORTANT:** Before making any changes, review **[PROJECT_RULES.md](../PROJECT_RULES.md)**, the condensed knowledge base in **[explaination.md](../explaination.md)**, the short **[minimal-knowledge-base.md](../docs/minimal-knowledge-base.md)**, _and_ the single-stop **[condensed-dev-guide.md](../docs/condensed-dev-guide.md)** so new work aligns with current architecture and lessons learned.

## Project Overview
This is a **Manifest V3 Chrome Extension** for Salesforce (Lightning/Console/Visualforce), specifically targeting ProQuest/Ex Libris case management workflows. The extension provides dynamic menus, field highlighting, URL generation, comment memory, text formatting, and workspace tooling (highlighter/notes/bookmarks).

## Core Architecture

### Component Roles
- **`background.js`**: Service worker that routes page type identification requests
- **`content_script.js`**: Legacy helpers for Clarivate/other Salesforce domains
- **`content_script_exlibris.js`**: Controller orchestrating ProQuest modules; wires observers → context → data store → features
- **`popup.js` + `popup.html`**: Settings configurator (timezone, button styles, menu location)
- **`modules/`**: 40+ isolated feature modules (pageIdentifier, navigationObserver, CaseContextWatcher, CaseDataStore, CasePageDataExtractor, dynamicMenu, persistentBanner, highlighter tooling, etc.)

### Storage Strategy
- **In-memory (per tab)**: `CaseDataStore` holds the single active case payload; clear on navigation/context mismatch.
- **`chrome.storage.sync`**: User settings (timezone, label style, menu location, feature flags).
- **`chrome.storage.local`**: Workspace artifacts (highlighter/notes/bookmarks + backups), comment history, migrations. Do **not** persist per-case payloads here.

### Critical Pattern: "Check-Then-Observe"
**ALWAYS** use this pattern when searching for Salesforce DOM elements that may load asynchronously:

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
        observer.disconnect(); // ⚠️ CRITICAL: Always disconnect when done
        processElement(element);
    }
});

observer.observe(document.body, { childList: true, subtree: true });
```

**Why critical**: Salesforce Lightning is an SPA with dynamic content. Elements may not exist on initial script execution but appear after API responses or user interactions.

## Page Type Routing

### Entry Point: `handlePageChanges(pageType)`
All feature initialization flows through this function in `content_script_exlibris.js`:

```javascript
async function handlePageChanges(pageType) {
    switch(pageType.type) {
        case 'case_page':
            await initCasePage(pageType.caseId);
            break;
        case 'case_list':
            await highlightCaseList();
            break;
        // ... other page types
    }
}
```

**Triggering**: 
- `background.js` identifies page type using `getPageType(url)` 
- Sends `{type: "pageTypeIdentified", pageType}` message to content script
- Content script calls `handlePageChanges(pageType)`

## Key Selectors (Salesforce Lightning)

```javascript
// Case page fields (Lightning Record Page)
'lightning-record-edit-form records-record-layout-item[field-label="Case Number"]'
'records-record-layout-item[field-label="Subject"] input'
'records-record-layout-item[field-label="Case Owner"] slot lightning-formatted-text'

// Case list table
'table[aria-label*="Cases"] tbody tr'
'td[data-label="Case Number"] a'

// Menu injection points (configurable by user)
'.highlights .slds-page-header__detail-row' // Top location
'.forcePageBlockSectionRow' // Bottom location
```

**Shadow DOM**: Some Salesforce components use Shadow DOM. Use `.shadowRoot` to traverse:
```javascript
const inputField = element.shadowRoot?.querySelector('input');
```

## Case State & Validation

- **Primary flow**: NavigationObserver/PageIdentifier → CaseContextWatcher (title + URL) → CaseDataStore → subscribers (banner/menu/highlighter/etc.).
- **Validation**: Always call `PageContextValidator.validatePageContextBeforeDisplay()` with `{caseId, caseNumber}` before showing data to avoid stale renders.
- **Extraction**: Use `CasePageDataExtractor`/`CaseDataExtractor` with check-then-observe + visibility checks; avoid writing per-case data to storage.
- **Cleanup**: Disconnect observers, clear timers, and remove injected DOM on navigation; tag injected nodes with `data-exl-*` for idempotency.

## Dynamic Menu Generation

### Data-Driven UI
`DynamicMenu.getButtonData(caseData, buttonStyle)` returns an array of button definitions:

```javascript
{
    label: "Button Text",
    url: "https://...",
    id: "unique-button-id",
    style: { backgroundColor: "#0070d2", color: "#fff" }
}
```

**Rendering**: Dynamically creates buttons/links and injects into configured location.

## SPA Navigation Handling

### URL Monitoring
```javascript
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        const pageType = getPageType(lastUrl);
        handlePageChanges(pageType);
    }
}).observe(document.body, { childList: true, subtree: true });
```

**Why needed**: Salesforce Lightning uses client-side routing. Page changes don't trigger full reloads, so monitor URL changes manually.

## Development Guidelines

### When Modifying Features
1. **Read AGENTS.md first** for architecture overview and selector reference
2. **Check `content_script_exlibris.js`** for module initialization order
3. **Resolve context via `CaseContextWatcher`** before DOM work; validate with `PageContextValidator` prior to display.
4. **Use Check-Then-Observe pattern** for any new DOM queries; debounce noisy observers (~250 ms) and clean up listeners/observers on navigation.
5. **Test in ProQuest Salesforce** (`proquestllc.lightning.force.com`) across SPA navigation (back/forward, tab switches).
6. **Refresh the snapshot in `explaination.md` and `docs/minimal-knowledge-base.md`** when architecture, data flow, or best practices change, and log the update in `CHANGES.md` (Date, Category, Description, Files, Lessons Learned, Related Issues).
7. **Keep `CaseDataStore` the single source of truth for active case data**; never write case payloads to `chrome.storage` and clear UI immediately on context mismatch.
8. **Make injections idempotent and self-cleaning**: tag injected DOM with `data-exl-*`, use `DebounceUtils` for noisy observers, and disconnect observers/timers on navigation.
9. **Align with current timezone pipeline**: prefer `CustomerTimezoneLookup` + `CustomerDataManager` for timezones; avoid legacy timezone modules.
10. **Document and test**: update `CHANGES.md` for any doc/code change, sync condensed guides, and re-run SPA navigation checks (case page/list/comments) to verify teardown and re-init.

### When Adding New Modules
1. Create in `modules/` directory with single responsibility
2. Export functions (no global pollution)
3. Register in `manifest.json` content_scripts array (ProQuest match pattern)
4. Initialize in `content_script_exlibris.js` (order matters for dependencies)

### When Debugging
- **Check console**: `[ExLibris]` prefix logs from controller
- **Inspect storage**: DevTools → Application → Storage → chrome.storage.local
- **Verify selectors**: Salesforce UI changes frequently; validate selectors still work
- **Test SPA navigation**: Navigate between pages without refresh to ensure observers work

## Best Practices

### Module Development

1. **Always Check Dependencies**
   ```javascript
   if (typeof DependencyModule !== 'undefined') {
     DependencyModule.doSomething();
   } else {
     console.warn('[ModuleName] DependencyModule not available');
   }
   ```

2. **Implement Cleanup Methods**
   ```javascript
   cleanup() {
     if (this.observer) {
       this.observer.disconnect();
       this.observer = null;
     }
     // Clear timers, remove listeners, etc.
   }
   ```

3. **Check Element Visibility Before Injecting**
   ```javascript
   if (!this.isElementVisible(element)) {
     console.warn('[ModuleName] Element not visible');
     return;
   }
   ```

4. **Handle Shadow DOM Properly**
   ```javascript
   // Try direct query first
   let element = document.querySelector(selector);
   
   // Try shadow root
   if (!element && parent.shadowRoot) {
     element = parent.shadowRoot.querySelector(selector);
   }
   
   // Try deep traversal if needed
   if (!element) {
     element = queryShadowDOM(selector, parent);
   }
   ```

5. **Use Debouncing for Expensive Operations**
   ```javascript
   const debouncedHandler = DebounceUtils.debounce(() => {
     this.handleExpensiveOperation();
   }, 1000);
   ```
   Use ~250 ms for navigation/title observers; use higher values (≥250 ms) for heavy DOM work.

### Selector Best Practices

1. **Use Stable Selectors**
   - ✅ `records-record-layout-item[field-label="Field Name"]` (stable)
   - ✅ `data-*` attributes (stable)
   - ❌ Long DOM paths (fragile)
   - ❌ Position-based selectors (fragile)

2. **Always Have Fallbacks**
   ```javascript
   // Primary selector
   let element = document.querySelector(primarySelector);
   
   // Fallback selectors
   if (!element) {
     element = document.querySelector(fallbackSelector1);
   }
   if (!element) {
     element = document.querySelector(fallbackSelector2);
   }
   ```

3. **Check Element Existence**
   ```javascript
   const element = document.querySelector(selector);
   if (!element) {
     console.warn(`[ModuleName] Element not found: ${selector}`);
     return;
   }
   ```

### Documentation Standards

1. **Function Documentation**
   ```javascript
   /**
    * Brief description
    * @param {Type} paramName - Description
    * @returns {Type} Description
    */
   ```

2. **Selector Documentation**
   - Document in `SELECTORS.md`
   - Include stability rating
   - Include fallback selectors
   - Include usage context

3. **Change Tracking**
   - Update `CHANGES.md` for significant changes
   - Include lessons learned
   - Link to related issues/PRs

4. **Knowledge Base Sync**
  - Update `../explaination.md` and `../docs/minimal-knowledge-base.md` whenever you learn something new about architecture, data flow, or best practices
  - Mirror any high-level discoveries back into this instruction file if they affect agent guidance

### Common Patterns

See **[BEST_PRACTICES.md](../BEST_PRACTICES.md)** for:
- Complete do's/don'ts list
- Coding patterns (IIFE, Object, Initialization, Cleanup)
- Redundancies and inconsistencies
- Well-implemented functions
- Refactoring opportunities

## Critical Files Reference
- **Architecture**: `ARCHITECTURE.md` (diagrams), `AGENTS.md` (patterns)
- **Entry points**: `content_script_exlibris.js` (controller), `background.js` (router)
- **Core modules**: `pageIdentifier.js`, `navigationObserver.js`, `caseContextWatcher.js`, `caseDataStore.js`, `casePageDataExtractor.js`, `dynamicMenu.js`, `persistentBanner.js`
- **Comprehensive Docs**: 
  - `explaination.md` (condensed knowledge base + do/don't list)
  - `docs/minimal-knowledge-base.md` (short cheat sheet for devs/AI)
  - `explanation.md` (legacy overview with navigation links)
  - `FUNCTIONS.md` (complete function catalog)
  - `SELECTORS.md` (DOM selector registry)
  - `DEPENDENCIES.md` (dependency graph)
  - `BEST_PRACTICES.md` (patterns and guidelines)
  - `CHANGES.md` (change tracking)
