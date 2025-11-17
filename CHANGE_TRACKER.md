# Change Tracker

Purpose: maintain a concise audit trail of codebase and documentation updates performed by developers or AI agents. Add a new dated section for every meaningful change and keep entries chronological (most recent first).

## Log Format

- Use ISO date `YYYY-MM-DD`.
- Reference touched files with paths in backticks.
- Summarize rationale and outcomes in under three bullet points.
- Link to related documents, tickets, or lessons when applicable.

## Entries

### 2025-11-07

- Fixed critical bug in `3.0/modules/persistentBanner.js`: added missing `SELECTORS` object definition to prevent `Cannot read properties of undefined` error during initialization.
- Defined `RECORD_LAYOUT_BROKER` and `CONTEXT_BAR_TABS` selectors for case navigation listener setup.
- Fixed stale case data bug in `3.0/modules/persistentBanner.js` where banner displayed correct case number but wrong subject/status from a previously extracted case.
- Added DOM validation in `setupCaseDataListener` to reject extracted data when it doesn't match the currently visible case number, preventing stale cache pollution.
- Enhanced post-render validation to schedule revalidation after UI updates, ensuring banner content stays synchronized with visible page state.
- **Fixed nested case view bug**: Implemented proximity-based validation in `getVisibleCaseNumberFromDom()` to handle Salesforce's case-within-case page scenarios.
- Banner now uses viewport distance to select the closest `RecordCaseNumberField` when multiple exist, preventing display of parent case data when viewing nested case details.
- Applied same proximity logic to standard page selectors for consistent behavior across nested page structures.
- Added `getActiveLightningConsoleTabCaseNumber()` method to detect active Salesforce Lightning console tab and extract case number from tab label as validation source.
- Updated `getVisibleCaseNumberFromDom()` to prioritize `RecordCaseNumberField` (most reliable) → console tab → page header selectors → document title.
- Implemented hierarchical validation strategy: checks visible `lightning-formatted-text[data-field-id="RecordCaseNumberField"]` first for highest accuracy.
- Updated `3.0/modules/persistentBanner.js` to track active cases by visible case number and validate DOM state before/after banner refreshes.
- Introduced shared visibility helpers plus timed revalidation to keep banner content synchronized with the rendered page.
- Extended cleanup routines to clear validation timers and reset stored case references when navigating away.

### 2025-11-06

- Added `explaination.md` as the condensed architecture and operations guide for the extension.
- Created this tracker to log future updates; align usage guidelines across human and AI contributors.
- Reviewed and scheduled updates for `.github/copilot-instructions.md` and `LESSONS.md` to reflect current best practices.
