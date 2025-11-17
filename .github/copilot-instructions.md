# Salesforce Chrome Extension - Copilot Instructions

## Project Overview
This is a **Manifest V3 Chrome Extension** for Salesforce (Lightning/Console/Visualforce), specifically targeting ProQuest/Ex Libris case management workflows. The extension provides dynamic menus, field highlighting, URL generation, comment memory, and text formatting capabilities.

**Start here:** review `explaination.md` (condensed architecture guide), then skim `CHANGE_TRACKER.md` and the latest section in `LESSONS.md` before modifying code.

## Core Architecture

### Component Roles
- **`background.js`**: Service worker that owns context menu creation, saved team selection, and tab handoff utilities.
- **`content_script.js`**: Legacy helper script (status colors, anchor tweaks, comment helpers) loaded on every Salesforce host; reused by the ProQuest stack.
- **`content_script_exlibris.js`**: Primary orchestrator for ProQuest pages; coordinates module init/cleanup per page type.
- **`popup.js` + `popup.html`**: Settings configurator (timezone, button styles, menu location, shift data) and storage usage display.
- **`modules/`**: Feature singletons (pageIdentifier, cacheManager, dynamicMenu, timezone stack, comment memory, etc.). Check availability with `typeof Module !== 'undefined'` before use.

### Storage Strategy
- **`chrome.storage.sync`**: User settings (timezone, menu locations, feature toggles) via `SettingsManager`.
- **`chrome.storage.local`**: Case data cache, comment history, and user preferences via `CacheManager`, `CaseCommentMemory`, and `UserPreferences`.
- **Cache validation**: `CacheManager` no longer keys by timestamp. It builds a signature from status/sub-status/category/analysis-note fields and invalidates when those change.

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

## Data Caching Strategy

1. **Lookup**: Call `CacheManager.get(caseId)`; it initializes on demand and reads from memory mirror + `chrome.storage.local`.
2. **Signature check**: Manager hashes the visible status/sub-status/category/sub-category/analysis note combination. If signature differs, cache is considered stale.
3. **Refresh**: On miss, run `CaseDataExtractor.extractCaseData()` followed by `processData()` to enrich from customer datasets.
4. **Persist**: Use `CacheManager.set(caseId, payload)`; the manager throttles writes and trims old entries to stay below the 8MB quota buffer.

**Benefit**: Avoids redundant DOM scraping while ensuring UI reacts when key status fields change.

## Visibility & Idempotence

- Always combine Check-Then-Observe with **visibility filtering**. Only act on elements that pass `getBoundingClientRect()` and computed-style checks; Salesforce keeps hidden copies from prior navigations.
- Mark injected nodes or initialized inputs with `dataset` flags (for example `element.dataset.exlibrisInjected = 'true'`) to prevent duplicate listeners and simplify cleanup.
- Disconnect observers once the target appears; reconnect only when Salesforce re-renders the region (see `DynamicMenu.observeHeaderSection`).

## Dynamic Menu Generation

### Data-Driven UI
`DynamicMenu.getButtonData(caseData, buttonStyle)` returns an array of button definitions:

```javascript
{
    label: "Button Text",
    url: "https://...",
    id: "unique-button-id"
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
1. Read `explaination.md` and the latest `LESSONS.md` entry, then inspect `content_script_exlibris.js` to understand init order.
2. Guard all DOM work with Check-Then-Observe **and** visibility checks; disconnect observers promptly.
3. Update `CHANGE_TRACKER.md` with a brief log after committing docs or code changes.
4. Exercise features on `proquestllc.lightning.force.com`: case page, comments "View All", and list view at minimum.
5. Review cache signature implications before adding/removing fields from `CaseDataExtractor` outputs.

### When Adding New Modules
1. Place new single-responsibility scripts in `modules/` and expose a global singleton.
2. Register in `manifest.json` under the ProQuest content_scripts block if needed.
3. Initialize within `content_script_exlibris.js` in the correct phase (settings, case page, comments, list) and ensure cleanup hooks exist.
4. Add toggles to `SettingsManager`/popup when introducing configurable behavior.

### When Debugging
- **Console**: `[ExLibris Extension]` and `[EXL]` prefixed logs surface controller actions; enable `Logger` debug when deeper tracing is needed.
- **Storage**: DevTools → Application → Storage → `chrome.storage.local`/`sync` for cache and preferences.
- **Selectors**: Validate Lightning DOM changes; prefer data attributes over dynamic class names.
- **SPA navigation**: Navigate without hard refresh to confirm observers, cache cleanup, and banner/menu re-injection behave.

## Critical Files Reference
- **Condensed knowledge**: `explaination.md` (primary reference), `CHANGE_TRACKER.md` (recent updates), `LESSONS.md` (historical insights).
- **Architecture**: `ARCHITECTURE.md` (diagrams), `AGENTS.md` (patterns), `COMPLETE_FLOW_DOCUMENTATION.md` (legacy deep dive).
- **Entry points**: `content_script_exlibris.js` (controller), `content_script.js` (legacy helpers), `background.js` (service worker).
- **Core modules**: `pageIdentifier.js`, `cacheManager.js`, `caseDataExtractor.js`, `dynamicMenu.js`, `persistentBanner.js`.
- **Process docs**: `.github/DEVELOPER_GUIDE.md`, `.github/IMPLEMENTATION_PLAN.md`, `.github/FEATURE_REQUIREMENTS.md` for previous project phases.
