# Minimal Knowledge Base (Developers & AI)

Single-stop cheat sheet for how the extension is wired, what to respect, and how to ship changes safely. Keep this synced with `explaination.md` and log updates in `CHANGES.md`.

 
## Scope & Surfaces

- **Salesforce ProQuest/Ex Libris (Lightning SPA)**: Main target; controller `content_script_exlibris.js` orchestrates modules.
- **Clarivate Salesforce**: Legacy helpers via `content_script.js`.
- **Knowledge/Docs sites**: Highlighter/notes/bookmarks via `content_script_highlighter.js`.
- **Background**: `background.js` service worker manages menus, migrations, backups; state is ephemeral.
- **Popup/Sidepanel**: Settings and workspace export/import.


## Core Runtime Flow (ProQuest)

1) `NavigationObserver` + `PageIdentifier` detect URL/title changes.
2) `CaseContextWatcher` waits ~500 ms, resolves `{caseId, caseNumber}` from head (title + URL).
3) `CaseDataStore` holds the single active case payload (per tab). Reject mismatched case IDs; clear on navigation.
4) `CasePageDataExtractor`/`CaseDataExtractor` scrape visible Lightning fields (use check-then-observe + visibility checks).
5) Features subscribe: `PersistentBanner`, `DynamicMenu`, `FieldHighlighter`, `CaseCommentMemory`, `CharacterCounter`, `Timezone*` modules.


## State & Storage

- **In-memory (tab-scoped)**: `CaseDataStore`, observers, timers. Do not assume persistence across navigation.
- **`chrome.storage.sync`**: User prefs (timezone, menu location, label style, feature flags).
- **`chrome.storage.local`**: Workspace artifacts (highlighter/notes/bookmarks), comment history, backups; service worker backups keep latest 5 snapshots.
- **No per-case disk cache**: Use `CaseDataStore` + fresh scrape; validate with `PageContextValidator` before display.


## Critical Patterns

- **Check-then-observe** for DOM: query once, then `MutationObserver` (disconnect when found).
- **Context-first**: Always resolve case context before DOM work; validate `{caseId, caseNumber}` before display.
- **Debounce** noisy signals: navigation/title observers ~250 ms; DOM-heavy handlers ≥250 ms; autosave already debounced in feature modules.
- **Cleanup** on navigation: disconnect observers, clear timers, remove injected DOM (`data-exl-*` tags help).
- **Shadow DOM**: Use `querySelector` → `shadowRoot` → deep traversal util; respect `mode === 'open'` only.
- **Idempotent injection**: Guard with markers to avoid duplicate banners/menus.


## Module Map (fast lookup)

- **Entry**: `content_script_exlibris.js` (controller), `content_script.js` (legacy Clarivate), `content_script_highlighter.js` (docs/highlighter).
- **Infra**: `logger`, `debounceUtils`, `pageIdentifier`, `navigationObserver`, `settingsManager`, `caseDomUtils`.
- **State**: `caseContextWatcher`, `caseDataStore`, `customerDataManager`, `timezoneStorage`.
- **Extraction**: `casePageDataExtractor`, `caseDataExtractor`, `caseCommentExtractor`, `caseDetailExtractor`, `accountAddressExtractor`, `shadowTextExtractor`.
- **Business**: `urlBuilder`, `caseTimezoneResolver`, `timezoneConverter`, `customerTimezoneLookup`, `unknownCustomerManager`.
- **UI/Features**: `persistentBanner`, `dynamicMenu`, `fieldHighlighter`, `configurationWarningBanner`, `caseCommentMemory`, `characterCounter`, `flexipagePanelInjector`, `keyboardShortcuts`, `contextMenuHandler`, `multiTabSync`, `highlighter` modules.


## Do / Don’t (Developers & AI)

- Do resolve context via `CaseContextWatcher` + validate with `PageContextValidator` before showing data.
- Do debounce observers/handlers; prefer existing `DebounceUtils` instead of ad-hoc timers.
- Do prefer stable selectors (`field-label`, `data-*`, SLDS classes) with visibility checks; avoid generated classes or `nth-child`.
- Do tag injected DOM (`data-exl-*`) and clean up on navigation.
- Don’t store per-case data in `chrome.storage`—`CaseDataStore` owns the active payload.
- Don’t skip cleanup or assume background state persists (service worker is ephemeral).
- Don’t touch closed shadow roots; fall back gracefully if elements are inaccessible.
- Don’t bypass `explaination.md`/`PROJECT_RULES.md`—align with patterns before coding.


## Working Agreements

- Update `CHANGES.md` (date, category, description, files, lessons) for any doc/code change.
- Sync high-level knowledge into `explaination.md` when architecture/patterns shift; keep this cheat sheet aligned.
- Document new selectors in `SELECTORS.md`; add patterns/anti-patterns to `BEST_PRACTICES.md` when they change.
- Prefer async/await; wrap risky DOM/storage ops in try/catch with `[ModuleName]` context logs.


## Testing & Validation

- No automated tests—validate in Salesforce Lightning: case page, case list, comments, SPA navigation (back/forward, tab switches).
- Verify observers clean up (no duplicate banners/menus) and data matches active case after navigation.
- For highlighter tools, confirm backup/restore paths (DataMigration) and workspace export/import.


## Open Risks to Watch

- Salesforce DOM/selector churn; keep fallbacks handy.
- Long-lived observers leaking when navigation events are missed.
- Timezone/institution mapping drift (`instTimezones.dsv`, `customerMasterList.json`).
- Background worker termination impacting migrations/backups—persist immediately when needed.
