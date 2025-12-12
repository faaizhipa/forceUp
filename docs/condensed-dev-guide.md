# Condensed Dev Guide

Single, minimal reference for developers and AI agents working on the Ex Libris/ProQuest Salesforce Chrome extension. Keep this file in sync with `explaination.md`, `docs/minimal-knowledge-base.md`, and log updates in `CHANGES.md`.

## Architecture Snapshot

- Surfaces: ProQuest/Ex Libris Lightning SPA (`content_script_exlibris.js` controller), Clarivate legacy helpers (`content_script.js`), knowledge-site highlighter/notes/bookmarks (`content_script_highlighter.js`), popup/sidepanel for settings/export, and an ephemeral `background.js` service worker for menus/backups.
- Controller flow: Navigation signals (`NavigationObserver` + `PageIdentifier`) → `CaseContextWatcher` resolves `{caseId, caseNumber}` → `CaseDataStore` owns the single active payload → extractors (`CasePageDataExtractor`/`CaseDataExtractor`) scrape visible fields → UI modules (banner/menu/highlighter/comment memory/counters/timezone) subscribe.
- Initialization order (ProQuest): manifest loads infra (`debounceUtils`, `logger`, `pageIdentifier`, `settingsManager`), then state (`caseContextWatcher`, `caseDataStore`, `customerDataManager`), extraction (`caseDataExtractor`, `casePageDataExtractor`), utilities (`caseDomUtils`, `urlBuilder`, `customerTimezoneLookup`), UI modules, and finally `content_script_exlibris.js`.

## Runtime Flow (Case Page)

1) Navigation detected (title + URL + history interception); `CaseContextWatcher` waits ~500 ms for head to settle.
2) `CaseDataStore` holds the single `{caseId, caseNumber, ...}` payload; clear on mismatch/navigation.
3) Extractors scrape visible Lightning fields with check-then-observe + visibility checks; enrich with `CustomerDataManager` + `CustomerTimezoneLookup`.
4) `PageContextValidator.validatePageContextBeforeDisplay()` gates rendering; if validation fails, clear UI and wait for a matching context.
5) Subscribers (`PersistentBanner`, `DynamicMenu`, `FieldHighlighter`, `CaseCommentMemory`, `CharacterCounter`, timezone widgets) render idempotently and clean up on navigation.

## State & Storage Boundaries

- In-memory (tab): CaseDataStore, observers, timers. Single-case only; clear on navigation.
- `chrome.storage.sync`: user prefs (timezone, menu placement, label style, feature flags).
- `chrome.storage.local`: workspace artifacts (highlighter/notes/bookmarks + backups), comment history; cap backups to latest 5 via DataMigration.
- Never persist per-case payloads to storage; service worker globals are ephemeral.

## Safety Patterns

- Check-then-observe for DOM and disconnect once found; debounce noisy callbacks (~250 ms for navigation/title, higher for heavy DOM work).
- Context-first: resolve `{caseId, caseNumber}` before DOM work; re-validate before display with `PageContextValidator`.
- Idempotent injection: tag injected nodes `data-exl-*`; remove on cleanup; operate only on visible tabs/panels.
- Selectors: prefer `field-label`/`data-*` and stable SLDS classes; avoid text-based, positional, or generated `lwc-*`/`forcegenerated-*` classes.
- Shadow DOM: query first, then traverse open `shadowRoot`; bail on closed roots; use composed events when needed.
- Error handling: wrap risky DOM/storage ops in try/catch with `[ModuleName]` prefix; fail gracefully.

## Do / Do Not (Developers & AI)

- Do use CaseContextWatcher + CaseDataStore as the single source of truth; reject mismatched IDs and clear UI immediately on mismatch.
- Do batch DOM reads/writes and yield if heavy; prefer `requestIdleCallback` for non-critical work.
- Do clean up observers, timers, listeners, and injected DOM on every navigation; ensure modules expose `cleanup()`.
- Do update `SELECTORS.md` when adding selectors; document stability and fallbacks.
- Do keep timezone lookups through `CustomerTimezoneLookup`; avoid legacy timezone modules.
- Do log doc/code changes in `CHANGES.md` and sync `explaination.md` + `docs/minimal-knowledge-base.md` + this guide.
- Do not store per-case data in `chrome.storage`; keep it in memory only.
- Do not rely on text content, positional selectors (`nth-child`), or generated classes; avoid global state in the service worker.

## Quick Checklists

- Before DOM work: ensure page type + context resolved; confirm active tab/panel; prepare primary + fallback selectors.
- Before injecting UI: check for existing `data-exl-*` markers; ensure container is visible; add cleanup hooks.
- Before shipping: test case page, case list, and comments through SPA navigation (back/forward); verify banner/menu/highlighter teardown and re-init; confirm timezone and URL buttons render correctly.
- Documentation hygiene: append `CHANGES.md` (Date, Category, Description, Files, Lessons Learned, Related Issues); refresh snapshots (`explaination.md`, `docs/minimal-knowledge-base.md`, this file) and keep `.github/copilot-instructions.md` aligned.

## AI/Agent Guardrails

- Always read `PROJECT_RULES.md`, `explaination.md`, `docs/minimal-knowledge-base.md`, and this guide before edits; follow check-then-observe + validation patterns.
- Prefer existing utilities (`DebounceUtils`, `CaseContextWatcher`, `PageContextValidator`, `CaseDataStore`) over new ad-hoc helpers.
- When touching DOM: validate context, use stable selectors with visibility checks, and disconnect observers; tag injections for cleanup.
- When updating docs: keep guidance consistent across this file, `copilot-instructions.md`, and the knowledge bases; log the change.

## Open Risks to Monitor

- Salesforce DOM churn (selectors may break); keep fallbacks ready and validate in prod org.
- Long-lived observers or missing cleanup leading to duplicate UI or memory leaks.
- Timezone/institution mapping drift (`instTimezones.dsv`, `customerMasterList.json`).
- Background worker termination impacting workspace backups; persist immediately after migrations/exports.
