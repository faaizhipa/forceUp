# Condensed Dev Guide

Single, minimal reference for developers and AI agents working on the Ex Libris/ProQuest Salesforce Chrome extension. Keep this file in sync with `explaination.md`, `docs/minimal-knowledge-base.md`, and log updates in `CHANGES.md`.

## Scope & Surfaces

- ProQuest/Ex Libris Salesforce Lightning (SPA) via `content_script_exlibris.js` orchestrating modules.
- Clarivate Salesforce legacy helpers via `content_script.js`.
- Knowledge/Docs tooling (highlighter/notes/bookmarks) via `content_script_highlighter.js`.
- Background service worker `background.js` (context menus, backups, migrations) is ephemeral; popup/sidepanel manage settings and workspace export/import.

## Entry Points & Order (ProQuest)

- Manifest loads infrastructure first (`debounceUtils`, `logger`, `pageIdentifier`, `settingsManager`), then state (`caseContextWatcher`, `caseDataStore`, `customerDataManager`), extraction (`caseDataExtractor`, `casePageDataExtractor`), utilities (`caseDomUtils`, `urlBuilder`, `customerTimezoneLookup`), UI modules, and finally `content_script_exlibris.js` controller.
- All feature init flows through `handlePageChanges(pageType)`; page type comes from `PageIdentifier`/`NavigationObserver` signals.

## Core Runtime Flow

1) Navigation detected (title + URL + history interception) → `CaseContextWatcher` waits ~500 ms for head to settle.
2) `CaseDataStore` holds the single active `{caseId, caseNumber, ...}` payload; clear on mismatch/navigation.
3) `CasePageDataExtractor`/`CaseDataExtractor` scrape visible Lightning fields using check-then-observe + visibility checks; enrich with `CustomerDataManager` + `CustomerTimezoneLookup`.
4) `PageContextValidator.validatePageContextBeforeDisplay()` gates all display; if context fails, clear UI and retry only when context matches.
5) Subscribers (`PersistentBanner`, `DynamicMenu`, `FieldHighlighter`, `CaseCommentMemory`, `CharacterCounter`, timezone widgets) render idempotently and clean up on navigation.

## State & Storage Boundaries

- In-memory (tab): CaseDataStore, observers, timers. Treat as single-case, cleared on navigation.
- `chrome.storage.sync`: user prefs (timezone, menu placement, label style, feature flags).
- `chrome.storage.local`: workspace artifacts (highlighter/notes/bookmarks + backups), comment history; keep backups capped (latest 5) via DataMigration.
- Never persist per-case payloads to storage; do not rely on service worker globals (ephemeral).

## Safety Patterns

- Check-then-observe for DOM (disconnect observers promptly).
- Context-first: resolve `{caseId, caseNumber}` before DOM work; validate again before display.
- Idempotent injection: tag injected nodes `data-exl-*`; remove on cleanup.
- Visibility: operate only on active tab/panel; avoid generated classes or positional selectors.
- Debounce noisy observers/handlers (~250 ms navigation/title; higher for heavy DOM work). Use `DebounceUtils` instead of ad-hoc timers.
- Shadow DOM: query, then traverse open `shadowRoot`; bail on closed roots.
- Error handling: wrap risky DOM/storage in try/catch with `[ModuleName]` prefix; fail gracefully.

## Do / Do Not (Developers & AI)

- Do use CaseContextWatcher + CaseDataStore as the single source of truth; reject mismatched IDs.
- Do validate with PageContextValidator before showing cached/extracted data; clear stale UI immediately.
- Do batch DOM reads/writes and yield if heavy; prefer `requestIdleCallback` for non-critical work.
- Do clean up observers, timers, listeners, injected DOM on every navigation.
- Do update `SELECTORS.md` when adding selectors and prefer `field-label`/`data-*` with visibility checks.
- Do keep timezone lookups through `CustomerTimezoneLookup`; avoid legacy timezone modules.
- Do log doc/code changes in `CHANGES.md` and sync `explaination.md` + `docs/minimal-knowledge-base.md`.
- Do not store per-case data in `chrome.storage`; keep it in memory only.
- Do not rely on text content or positional selectors (`nth-child`); avoid dynamic `lwc-*`/`forcegenerated-*` classes.
- Do not leave observers running across SPA navigation; avoid global state in the service worker.

## Quick Checklists

- Before DOM work: ensure page type + context resolved; confirm active tab/panel; plan primary + fallback selectors.
- Before injecting UI: check for existing `data-exl-*` markers; ensure container is visible; add cleanup hooks.
- Before shipping: run through case page, case list, comments SPA navigation (back/forward); verify banner/menu/highlighter teardown and re-init; confirm timezone and URL buttons render correctly.
- Documentation hygiene: append `CHANGES.md` (Date, Category, Description, Files, Lessons Learned, Related Issues); refresh snapshots in `explaination.md` and `docs/minimal-knowledge-base.md` when patterns shift; align `.github/copilot-instructions.md` with current practices.

## Open Risks to Monitor

- Salesforce DOM churn (selectors may break); keep fallbacks ready and validate in prod org.
- Long-lived observers or missing cleanup leading to duplicate UI or memory leaks.
- Timezone/institution mapping drift (`instTimezones.dsv`, `customerMasterList.json`).
- Background worker termination impacting workspace backups; persist immediately after migrations/exports.
