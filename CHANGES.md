# Change Tracking

This document tracks all changes to the codebase, organized by category with lessons learned.

## Format

Each entry follows this structure:

```markdown
### [Date] - [Category] - [Brief Description]

**Description**: Detailed description of the change

**Files Changed**:

- `path/to/file1.js`
- `path/to/file2.js`

**Lessons Learned**:

- Key insight 1
- Key insight 2

**Related Issues/PRs**: #issue-number
```

## Categories

- **Bug Fixes**: Fixes to existing functionality
- **Features**: New functionality added
- **Refactoring**: Code improvements without changing functionality
- **Documentation**: Documentation updates
- **Performance**: Performance improvements
- **Security**: Security fixes

## Change History

### [2025-12-12] - Documentation - Condensed guide refresh and Copilot pre-reads

**Description**: Expanded the condensed developer guide with architecture snapshots, guardrails, and AI guidance to serve as the minimal single reference, and updated Copilot instructions to require it as part of the mandatory pre-read set.

**Files Changed**:

- `docs/condensed-dev-guide.md`
- `.github/copilot-instructions.md`
- `CHANGES.md`

**Lessons Learned**:

- Keeping a single, explicitly referenced quick guide reduces drift between human and AI contributors and speeds onboarding.
- Copilot instructions should point to the same minimal doc set the team uses; pre-read lists must stay current when documentation consolidates.

**Related Issues/PRs**: n/a

### [2025-12-11] - Documentation - Condensed dev guide and Copilot refresh

**Description**: Added a single condensed developer guide capturing surfaces, flows, storage boundaries, and safety checklists, and refreshed Copilot instructions with CaseDataStore ownership, cleanup/idempotency expectations, timezone pipeline usage, and documentation/testing reminders.

**Files Changed**:

- `docs/condensed-dev-guide.md`
- `.github/copilot-instructions.md`
- `CHANGES.md`

**Lessons Learned**:

- Keeping a concise reference aligned with the detailed knowledge base reduces drift and onboarding time for both humans and AI.
- Copilot guidance must enforce CaseContextWatcher/PageContextValidator gates and CaseDataStore single-source-of-truth rules to avoid stale UI or storage misuse.

**Related Issues/PRs**: n/a

### [2025-12-10] - Features - Floating comment formatter toolbar

**Description**: Added a floating formatter that appears when text is selected in the case comment textarea, providing bold/italic/mono/plain swaps plus bullet/indent/outdent helpers with style swapping that normalizes styled characters before reapplying formatting.

**Files Changed**:

- `modules/caseCommentMemory.js`

**Lessons Learned**:

- Normalize unicode-styled text before applying a new style so switching between bold/italic/mono stays reversible.
- Keep formatter listeners cleaned up with module teardown to avoid duplicate toolbars across SPA navigations.

**Related Issues/PRs**: n/a

### [2025-12-10] - UX - Persistent banner height lock and scroll

**Description**: Locked the persistent banner to 48px height, kept sections on a single row, and enabled horizontal scrolling so sections no longer overlap or exceed the 48px vertical space.

**Files Changed**:

- `modules/styles/persistent-banner.css`

**Lessons Learned**:

- For fixed-height toolbars, avoid wrapping and let horizontal scrolling handle overflow to prevent overlap.
- Using `width: max-content` on the inner container preserves natural section sizing while allowing overflow-x scrolling.

**Related Issues/PRs**: n/a

### [2025-12-10] - Documentation - Minimal knowledge base & copilot refresh

**Description**: Added a concise `docs/minimal-knowledge-base.md` cheat sheet for developers/AI and updated `.github/copilot-instructions.md` to reflect the CaseContextWatcher/CaseDataStore flow, storage boundaries, and new doc syncing expectations.

**Files Changed**:

- `docs/minimal-knowledge-base.md`
- `.github/copilot-instructions.md`
- `CHANGES.md`

**Lessons Learned**:

- Keep a single lightweight cheat sheet in sync with the fuller knowledge base to reduce drift and onboarding time.
- Copilot guidance must mirror current data-flow ownership (CaseContextWatcher + CaseDataStore) and storage rules to prevent stale instructions.

**Related Issues/PRs**: n/a

### [2025-12-09] - Features - Capture panel cleanup & recording quota toggle

**Description**: Removed the legacy capture/record tabs from the sidepanel now that CapturePanel owns the UX, and added a popup toggle to allow operators to opt out of the 150MB recording cap (default stays enforced). RecordingManager now honors that preference while keeping quota checks as the safe default.

**Files Changed**:

- `sidepanel.html`
- `sidepanel.js`
- `popup.html`
- `popup.js`
- `modules/settingsManager.js`
- `modules/recordingManager.js`
- `CHANGES.md`

**Lessons Learned**:

- When migrating UI to a new surface, strip obsolete tabs to reduce confusion and guard legacy events so they fail gracefully.
- User-facing toggles for storage caps need a safe default and explicit messaging; keep the enforcement path opt-out instead of opt-in.
- Keep popup defaults and SettingsManager defaults in lockstep to avoid config drift.

**Related Issues/PRs**: n/a

### [2025-12-09] - Features - Radial quick menu and banner mode migration

**Description**: Ported the radial quick-access menu into the main highlighter, rewired the floating button to open it (with drag + persisted position), coerced legacy floating banner mode back to sticky with a one-time log, and added a cloud-sync stub alert. Also hardened teardown by cleaning radial overlays/styles during controller cleanup.

**Files Changed**:

- `content_script_highlighter.js`
- `CHANGES.md`

**Lessons Learned**:

- When introducing injected UI (radial overlay/menu), ensure cleanup runs during controller teardown to avoid orphaned overlays.
- Gate style injection with an id and remove the tag on cleanup to prevent duplicates across SPA navigations.
- Migration logs help surface silent setting coercions (floating → sticky) without surprising users.

**Related Issues/PRs**: n/a

### [2025-12-06] - Documentation - Knowledge base snapshot refresh

**Description**: Added a concise snapshot section to `explaination.md` capturing purpose, surfaces, critical modules, data flow, dependencies, and doc hygiene expectations so new contributors and AI agents can orient quickly.

**Files Changed**:

- `explaination.md`
- `CHANGES.md`

**Lessons Learned**:

- Front-loading a snapshot reduces context-switching and duplication across docs; keep it updated whenever architecture or practices change.
- Documentation changes still need traceability—log them with dates and file lists to avoid silent drift.

**Related Issues/PRs**: n/a

### [2025-12-06] - Bug Fixes - Restore utility scripts for background/side panel

**Description**: Added the missing `utils` scripts (Storage, Google Drive, AI helpers, export/import) alongside the packaged extension so the background service worker and side panel can load their dependencies without `importScripts` failures.

**Files Changed**:

- `utils/storage.js`
- `utils/google-drive.js`
- `utils/ai.js`
- `utils/export-import.js`

**Lessons Learned**:

- Service worker import paths must point to shipped files; keep source and packaged directories in sync.
- Shared utility scripts used by multiple extension surfaces (background, side panel) need to live in the distributed root, not only in `/src`.

**Related Issues/PRs**: n/a

### [2025-12-05] - Documentation - Condensed Knowledge Base & Copilot Guidance Refresh

**Description**: Created `explaination.md` as the single-stop knowledge base that maps structure, data flow, dependencies, best practices, and open questions for the extension. Updated `.github/copilot-instructions.md` to reference the new document, require ongoing synchronization, and corrected the broken link to `BEST_PRACTICES.md`.

**Files Changed**:

- `explaination.md`
- `.github/copilot-instructions.md`
- `CHANGES.md`

**Lessons Learned**:

- Centralizing architecture, practices, and do/don't guidance in one document reduces onboarding time and keeps AI agents aligned.
- Instruction files must explicitly call out where canonical knowledge lives so future edits stay consistent.
- Broken relative links slip in easily—add link checks when touching documentation.

**Related Issues/PRs**: Knowledge base consolidation initiative

### [2025-11-24] - Features - Customer Timezone Lookup Pipeline

**Description**: Replaced the legacy timezone modules (`timezoneDetector`, `timezoneStorage`, `institutionTimezoneManager`, `timezoneUtils`, `timezoneConverter`) with a single `CustomerTimezoneLookup` helper that parses `instTimezones.dsv`, builds indexed lookups, and exposes a consistent API for overrides/export. Customer records and case data now receive enriched timezone metadata, DynamicMenu renders conversions without depending on the removed module, and the Flexipage workspace surfaces the same data.

**Files Changed**:

- `manifest.json` – removed old timezone scripts, added `modules/customerTimezoneLookup.js`, exposed `instTimezones.dsv`
- `modules/customerTimezoneLookup.js` – new helper that loads/parses DSV data, manages overrides/unknown customers, and resolves timezones
- `content_script_exlibris.js` – initializes the new helper instead of the retired modules
- `modules/customerDataManager.js` – annotates customer records with timezone info and exposes `getCustomerTimezone`
- `modules/caseDataExtractor.js` – attaches `customerTimezone`, `customerOrgCode`, etc. to processed case data
- `modules/persistentBanner.js` & `modules/flexipagePanelInjector.js` – consume the enriched case/customer timezone data
- `modules/dynamicMenu.js` – switches timezone converter UI to local helper logic (no external module)
- `modules/caseTimezoneResolver.js`, `modules/unknownCustomerManager.js` – re-point caching logic to `CustomerTimezoneLookup`
- Deleted `modules/timezoneDetector.js`, `modules/timezoneStorage.js`, `modules/timezoneUtils.js`, `modules/timezoneConverter.js`, `modules/institutionTimezoneManager.js`

**Lessons Learned**:

- Centralizing lookup/parsing logic avoids keeping multiple in-memory copies of the same dataset
- Keeping an override API in the new helper eases migration because downstream modules can keep their write semantics
- Case data hydration is the best hand-off point for derived customer metadata (banner, menus, exports all reuse it)

**Related Issues/PRs**: Timezone persistence/pipeline refactor

### [2024-12-XX] - Features - Timezone Converter Feature

**Description**: Replaced the "Next Analytics Refresh" section in DynamicMenu with a comprehensive timezone converter feature. The converter displays time conversions between case timezone, user timezone, and UTC in an expandable/collapsible UI. Users can select from multiple dates (Analytics Refresh, Case Created, Case Closed, Last Modified) via dropdown.

**Files Changed**:

- `modules/timezoneConverter.js` - New module with timezone conversion logic, formatting functions, date parsing, and timezone resolution
- `modules/dynamicMenu.js` - Replaced `createRefreshInfo()` with `createTimezoneConverter()`, made menu injection methods async
- `manifest.json` - Added `timezoneConverter.js` to content scripts (before `dynamicMenu.js`)
- `content_script_exlibris.js` - Updated `DynamicMenu.refresh()` call to await async method

**Key Features**:

- Expandable/collapsible UI (default collapsed, shows summary)
- Date selection dropdown with dynamic options
- Three timezone displays: Case, User, UTC
- Automatic timezone resolution with fallbacks
- Real-time conversion updates on date selection
- Handles missing timezones gracefully (UTC fallback)
- Supports DST transitions and timezone abbreviations

**Implementation Details**:

- Case timezone resolution: TimezoneStorage > InstitutionTimezoneManager > UTC
- User timezone resolution: UserPreferences > browser auto-detect
- Date parsing: Handles multiple Salesforce date formats
- Time conversion: Uses Intl.DateTimeFormat for accurate conversions
- UI: Matches existing DynamicMenu styling, accessible (ARIA labels, keyboard navigation)

**Breaking Changes**:

- `DynamicMenu.createRefreshInfo()` removed (replaced by `createTimezoneConverter()`)
- `DynamicMenu.injectMenu()`, `injectIntoCardActions()`, `injectIntoHeaderDetails()`, `populateMenu()`, and `refresh()` are now async

**Lessons Learned**:

- Use Intl.DateTimeFormat for accurate timezone conversions (handles DST automatically)
- Always provide fallbacks for timezone resolution (UTC is universal)
- Parse Salesforce dates carefully (multiple formats possible)
- Make UI expandable for better space utilization
- Async timezone resolution requires async UI creation
- Update all call sites when making methods async

**Related Issues/PRs**: Timezone converter feature implementation

### [2024-12-XX] - Bug Fix - CaseDetailExtractor Stale Data Prevention

**Description**: Fixed `CaseDetailExtractor` to prevent extraction of stale data from cached `window.ExLibrisExtension.caseToolkit.caseData`. The module now validates that cached data matches the current case ID from the URL before using it, preventing mixed data scenarios where Case B ID would be combined with Case A details.

**Files Changed**:

- `modules/caseDetailExtractor.js` - Added cache validation using PageContextValidator, case ID validation, and re-validation after async operations

**Key Changes**:

- Extract case ID from URL **first** before checking cache
- Validate cached data using `PageContextValidator.validatePageContextBeforeDisplay()` if available
- Fallback to simple case ID validation (`cachedData.caseId === currentCaseId && window.ExLibrisExtension.currentCaseId === currentCaseId`)
- Re-validate after `prepareTools` completes (case might have changed during async operation)
- Extract fresh data if validation fails
- Enhanced logging for validation results

**Problem Solved**:

- **Before**: CaseDetailExtractor could use cached data from Case A when viewing Case B, resulting in mixed data (Case B ID with Case A details)
- **After**: CaseDetailExtractor validates cache matches current case before use, ensuring data integrity

**Lessons Learned**:

- Always validate cached data matches current context before use
- Extract identifiers (case ID) from URL first, then validate cache against them
- Re-validate after async operations that might update cache
- Use PageContextValidator for robust validation when available
- Consistent validation pattern across modules prevents similar issues

**Related Issues/PRs**: Stale data extraction in CaseDetailExtractor

### [2024-12-XX] - Features - Cache Invalidation for Case Data Extractors

**Description**: Implemented multi-layered cache invalidation system to prevent stale data from being returned when case data changes in Salesforce. The system uses Last Modified Date validation (primary), TTL expiration (secondary), and field-level change detection (tertiary) to ensure data freshness.

**Files Changed**:

- `modules/casePageDataExtractor.js` - Added cache invalidation logic, Last Modified Date extraction, field-level validation, force re-extraction option, and cache clearing methods

**Key Features**:

- **Last Modified Date Validation**: Primary validation method that compares current case Last Modified Date with cached value
- **TTL (Time-To-Live)**: 30-second cache expiration to ensure data freshness
- **Field-level Change Detection**: Validates critical fields (asset, status, category) haven't changed
- **Force Re-extraction**: `extractNow(true)` parameter to bypass cache when needed
- **Manual Cache Clearing**: `clearCache(caseId)` method for explicit cache invalidation
- **Date Normalization**: Handles various Salesforce date formats for consistent comparison

**Lessons Learned**:

- Multi-layered validation provides robust cache invalidation with graceful degradation
- Last Modified Date is most reliable but may lag behind rapid changes, hence field-level checks
- TTL provides fallback when Last Modified Date is unavailable
- Clear logging of cache validation reasons aids debugging
- Date normalization is critical for consistent comparison across different formats

**Related Issues/PRs**: Cache invalidation implementation to prevent stale data issue

### [2024-01-XX] - Documentation - Comprehensive Codebase Documentation

**Description**: Created comprehensive documentation system with multiple focused documents:

- `FUNCTIONS.md` - Complete function catalog with summary table and detailed sections
- `SELECTORS.md` - Centralized DOM selector registry with stability ratings
- `DEPENDENCIES.md` - Module dependency graph and data flow documentation
- `BEST_PRACTICES.md` - Do's/don'ts, patterns, redundancies, and inconsistencies
- `CHANGES.md` - Structured change tracking document
- Updated `explanation.md` - Enhanced overview with navigation links
- Updated `.github/copilot-instructions.md` - Added best practices section

**Files Changed**:

- `FUNCTIONS.md` (new)
- `SELECTORS.md` (new)
- `DEPENDENCIES.md` (new)
- `BEST_PRACTICES.md` (new)
- `CHANGES.md` (new)
- `explanation.md` (updated)
- `.github/copilot-instructions.md` (updated)

**Lessons Learned**:

- Comprehensive documentation helps onboard new developers quickly
- Focused documents are easier to maintain than monolithic docs
- Centralized selector registry prevents selector duplication
- Dependency graph helps identify refactoring opportunities
- Best practices guide prevents common mistakes

**Related Issues/PRs**: N/A

---

## Template for Future Entries

Copy this template when adding new entries:

```markdown
### [YYYY-MM-DD] - [Category] - [Brief Description]

**Description**: 

**Files Changed**:

- `path/to/file.js`

**Lessons Learned**:

- 

**Related Issues/PRs**: #issue-number
```

---

## Change Statistics

- **Total Changes**: 1
- **Bug Fixes**: 0
- **Features**: 0
- **Refactoring**: 0
- **Documentation**: 1
- **Performance**: 0
- **Security**: 0

---

## Recent Changes Summary

### Documentation (1)

- Comprehensive codebase documentation system created

---

## Notes

- This document should be updated with every significant change
- Include lessons learned to help future development
- Link to related issues/PRs for context
- Group related changes together

