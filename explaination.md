# Ex Libris Extension — Condensed Knowledge Base

**Last updated:** 2025-12-05

This single reference captures how the Manifest V3 Chrome extension for Clarivate / Ex Libris works, which files matter, and how data, modules, and developers should interact. Treat it as the minimal onboarding packet for both humans and AI agents.

---

## 1. Project Purpose & Usage

- **Target environment**: Salesforce Lightning (Clarivate & ProQuest tenants) plus knowledge/support sites for the workspace highlighter.
- **Audience**: Support engineers handling Penang CoE case workflows.
- **Value proposition**: Faster triage via dynamic menus, consistent formatting, automatic comment memory, and workspace tools (highlighter, notes, bookmarks, screenshots).
- **Modes**: Content scripts for Salesforce, popup/side panel for settings, background worker for context menus and storage resilience.

## 2. Directory & Entry Points

| Path | Role | Notes |
| --- | --- | --- |
| `manifest.json` | MV3 manifest | Declares service worker, popup, side panel, permissions, and domain-scoped content scripts. |
| `background.js` | Service worker | Builds context menus, handles menu clicks, orchestrates tab switching, and triggers data-migration backups on update. |
| `popup.html / popup.js / styles.css` | Settings UI | Lets users pick menu placement, label styles, timezone prefs, shortcut configs, and exports workspace data. |
| `content_script.js` | Legacy helpers | Runs on both Clarivate & ProQuest to color status badges, validate email fields, highlight aging rows, etc. |
| `content_script_exlibris.js` | Main controller | SPA-aware orchestrator for ProQuest-specific modules (case detection, extraction, UI features, cleanup). |
| `modules/` | Feature modules | 40+ vanilla JS modules following IIFE/object patterns. Grouped by data, UI, utilities, workspace. |
| `content_script_highlighter.js` + `modules/highlighter/*` | Workspace tools | Inject global highlighter, sticky notes, bookmarks outside Salesforce (knowledge bases, docs). |
| `docs/` & `*.md` | Documentation | Detailed architecture, flows, selectors, dependencies, best practices, change logs. |
| `icons/`, `img/`, `lib/` | Assets | Logos, screenshots, and third-party libs (`DOMPurify`, `html2canvas`, `fabric`). |

**Languages:** Vanilla JavaScript, HTML, CSS, JSON manifest; no bundler or npm toolchain.

## 3. Core Components & Relationships

### Controllers & Observers

- `content_script_exlibris.js`: Initializes Logger → SettingsManager → data helpers → NavigationObserver → CaseContextWatcher → feature modules. Handles page type routing via `PageIdentifier` and ensures cleanup between SPA navigations.
- `PageIdentifier`: Monitors URL/title/mutations to classify CASE_PAGE, CASE_COMMENTS, CASES_LIST.
- `CaseContextWatcher`: Waits ~500 ms post-navigation, re-reads `document.title` + `location.href`, produces stable `{caseId, caseNumber}`. Feeds CaseDataStore + extractors.
- `CaseDataStore`: In-memory per-tab cache plus event bus for case payload updates.

### Data & Extraction

- `CaseDataExtractor`, `CasePageDataExtractor`: Read visible Lightning record fields, handle shadow DOM traversal, derive computed values (institution codes, server region) and broadcast `casePageDataExtracted`.
- `CustomerDataManager`, `CustomerTimezoneLookup`: Provide account metadata, timezone mappings parsed from `instTimezones.dsv`.
- `CaseDetailExtractor`, `CaseCommentExtractor`: Build export payloads (XML/TSV) on demand with context validation to prevent stale reads.

### UI Enhancements

- `PersistentBanner`, `FlexipagePanelInjector`: Surface live case metadata, warn when another tab holds the case, and host tooling panels.
- `DynamicMenu` + `URLBuilder`: Generate grouped buttons (production, sandbox, Kibana, SQL, JIRA) with timezone aware refresh cards.
- `FieldHighlighter`, `ConfigurationWarningBanner`, `CharacterCounter`, `CaseCommentMemory`, `KeyboardShortcuts`, `ContextMenuHandler`, `MultiTabSync`: Improve case editing ergonomics.

### Workspace Tools (non-SF pages)

- `highlighter`, `stickyNotes`, `bookmarkManager`, `screenshotManager`, `dataMigration`: Provide markup and persistence for arbitrary documentation sites, with automatic backups/restores via background worker.

### Utility & Safety Net Modules

- `NavigationObserver`, `DebounceUtils`, `EventSimulator`, `ScrollController`, `ShadowTextExtractor`, `PageContextValidator`, `SettingsManager`, `SiteActivationManager` (feature gating) keep operations reliable.

## 4. Data Flow & Lifecycles

### High-Level Flow (ProQuest Case Page)

```mermaid
sequenceDiagram
    participant PI as PageIdentifier
    participant CW as CaseContextWatcher
    participant CS as content_script_exlibris
    participant DE as CaseDataExtractor
    participant DS as CaseDataStore
    participant UI as Feature Modules

    PI->>CS: Page change (CASE_PAGE)
    CS->>CW: Request stable context
### Lifecycle Notes

1. **Navigation detection** relies on dual signals (history interception + title observer) to avoid missing Lightning SPA transitions.
2. **Context validation** precedes any DOM query. Modules must validate case ID & number against `CaseContextWatcher` + `PageContextValidator`.
3. **Extraction** happens only after the highlights section is visible; modules use "check-then-observe" to find elements.
4. **Feature injection** (menus, banners, counters) must be idempotent and clean up observers/listeners in `cleanup()` before the next navigation.
5. **Storage**: user settings in `chrome.storage.sync`; per-case artifacts (comments, workspace backups) in `chrome.storage.local`; runtime caches in memory.
6. **Workspace backups** run on background update/install events to guard against Chrome data loss.
    ### Lifecycle Notes


- **Chrome APIs**: `contextMenus`, `runtime`, `tabs`, `storage`, `sidePanel`, `alarms`, `identity`.
- **Web APIs**: `MutationObserver`, `IntersectionObserver`, `BroadcastChannel`, `CustomEvent`, `Intl.DateTimeFormat`, History API overrides.
- **Third-party libs**: `DOMPurify` (HTML sanitization), `html2canvas` + `fabric` (screenshots/annotation). Loaded only for workspace tooling, not Salesforce DOM.
- **Salesforce DOM**: Operates solely via DOM scraping; no Salesforce REST/SOAP. SPA + Shadow DOM quirks dictate strict selector discipline.
    6. **Workspace backups** run on background update/install events to guard against Chrome data loss.


- **Module pattern**: Self-contained IIFE/object with `init()` + `cleanup()` and an `isInitialized` guard.
- **Check-Then-Observe**: Query synchronously → if missing, register a scoped `MutationObserver` that disconnects once the element appears.
- **Context-first**: Always resolve `{caseId, caseNumber}` and validate via `PageContextValidator` before showing cached data.
- **Defensive selectors**: Use `records-record-layout-item[field-label="..."]`, `data-label`, or SLDS classes; never rely on autogenerated `lwc-*` classes or positional selectors.
- **Async discipline**: Prefer `async/await`, wrap risky DOM ops/storage calls in try/catch, log with `[ModuleName]` prefix.
- **Cleanup hygiene**: Observers, timers, event listeners, injected DOM nodes must be cleaned up on navigation; background tasks should exit early if page no longer active.
- **Storage strategy**: `chrome.storage.sync` for preferences (≤5 KB), `chrome.storage.local` for cached artifacts (≤10 MB), in-memory for per-tab runtime data. Backups limited to latest 5 snapshots.
- **Check-Then-Observe**: Query synchronously → if missing, register a scoped `MutationObserver` that disconnects once the element appears.
- **Context-first**: Always resolve `{caseId, caseNumber}` and validate via `PageContextValidator` before showing cached data.

- **CaseContextWatcher + CaseDataStore**: Single source of truth for navigation-aware case identity. Bugs here ripple everywhere.
- **CasePageDataExtractor**: Heavy DOM traversal; ensure it runs only when required, respects TTLs, and handles shadow DOM gracefully.
- **DynamicMenu & URLBuilder**: High-impact UI; incorrect mappings can send engineers to wrong environments. Keep DC mapping + institution suffix logic current.
- **Workspace DataMigration**: Failure results in lost highlights/notes; monitor backup logs and storage quotas.
- **ContextMenuHandler + TextFormatter**: Must sanitize inputs to avoid injecting exotic Unicode that Salesforce rejects.
- **MultiTabSync**: Prevents conflicting edits; ensure BroadcastChannel listeners clean up or they can leak memory in long-lived tabs.
- **CasePageDataExtractor**: Heavy DOM traversal; ensure it runs only when required, respects TTLs, and handles shadow DOM gracefully.
- **DynamicMenu & URLBuilder**: High-impact UI; incorrect mappings can send engineers to wrong environments. Keep DC mapping + institution suffix logic current.

- **Canonical docs**: `PROJECT_RULES.md`, `BEST_PRACTICES.md`, `FUNCTIONS.md`, `SELECTORS.md`, `DEPENDENCIES.md`, `CHANGES.md`, and this file. Each new feature should link back here.
- **Gaps**:
  - No automated tests or selector monitors; regressions rely on manual Salesforce checks.
  - `caseCommentExtractor.js` is bundled but unused on ProQuest—confirm requirements.
  - No linting/build tooling; consistent style relies on discipline.
  - Lacks UX specs/screenshots for newer banner/menu layouts—capture before Salesforce UI shifts.
  - No automated tests or selector monitors; regressions rely on manual Salesforce checks.
  - `caseCommentExtractor.js` is bundled but unused on ProQuest—confirm requirements.

### Do

1. Start with `PROJECT_RULES.md` + this file before coding.
2. Use `CaseContextWatcher` outputs instead of re-parsing URLs.
3. Follow check-then-observe when touching Salesforce DOM; always disconnect observers.
4. Validate cached data with `PageContextValidator.validatePageContextBeforeDisplay()`.
5. Keep injections idempotent; tag DOM you add via `data-exl-*` attributes for cleanup.
6. Log with context (`[Module] operation detail`) and guard optional dependencies.
7. Update `CHANGES.md` (Lessons Learned) and this document when knowledge changes.

### Don’t

1. Don’t introduce new global variables; keep module scope enclosed.
2. Don’t rely on Lightning’s autogenerated class names or element order.
3. Don’t use blocking loops or repeated DOM scans; debounce or batch operations.
4. Don’t store sensitive data or huge payloads in `chrome.storage.sync`.
5. Don’t skip cleanup on navigation—it leads to duplicate UI and memory leaks.
6. Don’t edit service worker globals assuming persistence; fetch fresh state when events fire.
4. Don’t store sensitive data or huge payloads in `chrome.storage.sync`.
5. Don’t skip cleanup on navigation—it leads to duplicate UI and memory leaks.

- Should `caseCommentExtractor` run on ProQuest? If yes, define injection points, cleanup contract, and needed selectors.
- Are additional Salesforce orgs (sandbox/specific business units) planned? Manifest match patterns and feature flags may need expansion.
- Do we need automated selector monitoring or integration tests to catch Lightning UI shifts proactively?
- What is the roadmap for `CaseDataStore` persistence (beyond in-memory) and how will conflicts across tabs be resolved?
- Do we need automated selector monitoring or integration tests to catch Lightning UI shifts proactively?
- What is the roadmap for `CaseDataStore` persistence (beyond in-memory) and how will conflicts across tabs be resolved?

- Every change must append `CHANGES.md` with **Date, Category, Description, Files, Lessons Learned, Related Issues**.
- Note debugging insights or Salesforce selector shifts even if no code changes occurred.
- Keep this condensed knowledge base aligned with reality (update section numbers/dates accordingly).
- Keep this condensed knowledge base aligned with reality (update section numbers/dates accordingly).

---

_Questions or updates? Add them here, link to supporting docs, and notify maintainers so this single source of truth stays accurate._
