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

### [2025-11-29] - Features - Timezone Normalization Module

**Description**: Created a new TimezoneNormalizer module to convert non-standard timezone values in customerMasterList.json to valid IANA timezone identifiers. The module integrates with CustomerMasterManager to ensure all consuming modules receive normalized timezone data automatically.

**Problem Solved**:
The `customerMasterList.json` contained non-IANA timezone values like "US", "UK" instead of proper identifiers like "America/New_York", "Europe/London". This caused issues with:
- JavaScript's `Intl.DateTimeFormat` API
- Timezone offset calculations
- Customer time display

**Files Created**:
- `modules/timezoneNormalizer.js` - Comprehensive timezone normalization module

**Files Modified**:
- `modules/customerMasterManager.js` - Added `normalizeTimezone()` integration
- `modules/casePageDataExtractor.js` - Added enhanced timezone display fields
- `modules/caseDataExtractor.js` - Added enhanced timezone display fields
- `manifest.json` - Added timezoneNormalizer.js to content scripts

**Key Features**:

*TimezoneNormalizer Module:*
- 60+ country code to IANA mappings (US → America/New_York, UK → Europe/London, etc.)
- 30+ country name mappings
- US state-specific timezone resolution
- Common abbreviation support (EST, PST, GMT, etc.)
- Geographic context-based inference (uses country/state/city for resolution)
- Caching for performance

*New Data Fields (added to extractors):*
- `timezoneRaw` - Original value from JSON for debugging
- `timezoneDisplayName` - Human-readable name via `getDisplayName()`
- `timezoneOffset` - Formatted offset (e.g., "+05:30", "-08:00")
- `timezoneOffsetMinutes` - Numeric offset in minutes
- `customerCurrentTime` - Current time in customer's timezone

*API Methods:*
- `normalize(timezone, context)` - Normalize to IANA
- `getOffset(timezone, date)` - Get UTC offset
- `getDisplayName(timezone, style)` - Get readable name
- `convert(dateTime, fromTz, toTz)` - Convert between timezones
- `isValidIANA(timezone)` - Validation check
- `getCurrentTime(timezone)` - Current time info

**Lessons Learned**:
- Non-IANA timezone values are common in legacy data - always normalize at the source
- Geographic context (country, state) enables accurate resolution when timezone is ambiguous
- US states have complex timezone boundaries - state-level mapping improves accuracy
- Caching normalized results improves performance for repeated lookups
- Providing both raw and normalized values aids debugging

**Related Issues/PRs**: Timezone normalization for customerMasterList.json

---

### [2025-11-29] - Features - Highlighter Panel Enhancement

**Description**: Comprehensive enhancement to the highlighter system with four major features:
1. **Radial Menu** - Replaced the floating banner with a radial fan-out menu that expands from the floating button
2. **Highlights/Notes Sidepanel** - New management panel for viewing, editing, and organizing highlights and notes across URLs/domains
3. **Bookmark Export/Import** - Added export/import functionality to BookmarkManager with scope selection and conflict resolution
4. **Cloud Storage (OneDrive)** - Added OneDrive integration for cross-device sync with OAuth 2.0 + PKCE authentication

**Files Created**:
- `modules/highlightsSidepanel.js` - Highlights/notes management panel with CRUD operations
- `modules/styles/highlights-sidepanel.css` - Sidepanel styling
- `modules/oneDriveAuth.js` - OAuth 2.0 + PKCE authentication for OneDrive
- `modules/hybridStorageManager.js` - Unified storage API with local/cloud sync

**Files Modified**:
- `content_script_highlighter.js` - Added radial menu, cloud sync dialog, initialization for new modules
- `modules/styles/highlighter.css` - Added radial menu CSS, dialog styles, cloud sync UI styles
- `modules/bookmarkManager.js` - Added export/import functionality with HTML and JSON formats
- `manifest.json` - Added new module registrations and CSS files

**Key Features**:

*Radial Menu:*
- 7 action items (Highlight, Note, Manage, Collections, Bookmark, Pin, Clear, Cloud)
- 11 color chips in inner arc
- Staggered fan-out animation
- Keyboard accessible (Escape to close)
- Position-aware direction (adjusts based on button location)

*Highlights Sidepanel:*
- Scope filtering: Current URL, Current Domain, All Data
- Search functionality
- Bulk selection and operations
- Copy metadata to clipboard
- Real-time updates via storage listener

*Bookmark Export/Import:*
- Export scope: All, Specific Collection
- Export formats: JSON (full data) and HTML (browser compatible)
- Import with conflict resolution: Skip, Replace, Rename duplicates
- Preview before import

*Cloud Storage:*
- OneDrive OAuth 2.0 with PKCE (no client secret needed)
- Token encryption at rest
- Automatic token refresh
- Sync modes: Local, Hybrid, Cloud Primary
- Offline queue for pending sync operations
- Migration UI with progress indicator

**Lessons Learned**:
- Radial menus require position-aware angle calculations to avoid going off-screen
- PKCE flow is essential for Chrome extensions (no secure client secret storage)
- Hybrid storage approach allows graceful degradation when offline
- Staggered animations (30ms delay) create a polished fan-out effect
- Always provide scope options for data operations (URL, domain, all)

**Security Considerations**:
- Refresh tokens encrypted using Web Crypto API before storage
- HTTPS only for all OAuth and API calls
- App-specific OneDrive folder (Files.ReadWrite.AppFolder scope)
- User data stays in their OneDrive, not shared

**Related Issues/PRs**: Highlighter panel enhancement plan

---

### [2025-11-28] - Bug Fix - FetchInterceptor Data Recovery and TTL

**Description**: Fixed multiple issues preventing FetchInterceptor from being effectively used as the primary case data source. The FetchInterceptor intercepts Salesforce API calls to extract case data before DOM parsing, providing faster and more reliable data.

**Problems Fixed**:
1. **Pending data never consumed** - `window._pendingApiCaseData` was set by FetchInterceptor but never read
2. **Event never listened to** - `caseDataFromApi` event was dispatched but no subscribers existed
3. **TTL too short** - 5-second freshness window often expired before extraction ran
4. **Stale data on navigation** - Old API data persisted when navigating to new cases

**Changes Made**:
- Added pending API data recovery in `init()` to retrieve data captured before ExLibrisExtension existed
- Added `caseDataFromApi` event listener for real-time API data updates
- Increased API data TTL from 5 seconds to 30 seconds
- Clear API data on navigation to prevent stale data from previous cases

**Files Changed**:
- `content_script_exlibris.js` - Added pending data recovery, event listener, navigation clearing
- `modules/casePageDataExtractor.js` - Increased TTL from 5000ms to 30000ms

**Console Log Flow (Success)**:
```
[FetchInterceptor] Case data captured from API: { caseNumber: "00001234", fieldCount: 45 }
[ExLibris Extension] Received API case data via event
[CasePageDataExtractor] Using fresh API data (age: 150ms)
```

**Lessons Learned**:
- Modules loaded at `document_start` may capture data before main objects exist - always check for pending data
- Event listeners should be registered early to catch events from fast-loading modules
- 5-second TTL is too aggressive for SPA navigation - 30 seconds provides buffer while still ensuring freshness
- Always clear cached data on navigation in SPAs to prevent cross-case data contamination

**Related Issues/PRs**: FetchInterceptor effectiveness fix

---

### [2025-11-28] - Documentation - Initialization and Module Reference Updates

**Description**: Updated documentation to reflect the new initialization architecture and CustomerMasterManager module, including the new `safeInit` pattern with error boundaries and timeout handling.

**Key Changes**:
- Updated references from `CustomerDataManager` + `CustomerTimezoneLookup` → `CustomerMasterManager`
- Updated initialization sequence in documentation to reflect new state machine pattern
- Added `UserCustomerDataManager` as the override layer for user-added entries
- Archived 9 obsolete implementation notes from `.github/` folder

**Files Updated**:
- `.github/copilot-instructions.md` - Updated module references and data management layer
- `.github/DEVELOPER_GUIDE.md` - Fixed outdated architecture references
- `DEPENDENCIES.md` - Updated all module dependency references
- `BEST_PRACTICES.md` - Updated module examples
- `DEBUG_INSTRUCTIONS.md` - Updated expected initialization log sequence

**New Initialization Features Documented**:
- `initState` state machine ('idle' | 'initializing' | 'ready' | 'error')
- `safeInit()` helper for error-bounded module initialization
- 30-second timeout wrapper for initialization
- Improved logging with initialization duration

**Related Issues/PRs**: Module consolidation and initialization refactor

---

### [2025-11-28] - Features - Build and Packaging Infrastructure

**Description**: Added comprehensive build tooling, packaging scripts, and debugging utilities to make the extension easier to deploy and troubleshoot in production.

**Files Created**:
- `package.json` - npm package configuration with build scripts
- `scripts/build.js` - Build script for creating production-ready dist/
- `scripts/package.js` - Package script for creating ZIP releases
- `scripts/validate.js` - Validation script for checking extension integrity
- `scripts/version.js` - Version management script
- `scripts/clean.js` - Clean script for removing build artifacts
- `modules/debugHelper.js` - Runtime debug utilities (console diagnostics)
- `DEPLOYMENT.md` - Comprehensive deployment and troubleshooting guide
- `.gitignore` - Git ignore rules for build artifacts

**New npm Commands**:
- `npm run build` / `npm run build:prod` - Create production build
- `npm run package` - Create ZIP package in releases/
- `npm run validate` - Validate extension integrity
- `npm run version:bump` - Bump version numbers
- `npm run clean` - Remove build artifacts

**DebugHelper Console Commands**:
- `DebugHelper.status()` - Full status report
- `DebugHelper.modules()` - List loaded modules
- `DebugHelper.caseData()` - Current case data
- `DebugHelper.storage()` - View storage contents
- `DebugHelper.testTimezone('name')` - Test timezone resolution
- `DebugHelper.export()` - Export debug info to JSON

**Lessons Learned**:
- Proper build tooling reduces manual deployment errors
- Debug utilities in production help with remote troubleshooting
- Version management scripts ensure consistency across manifest and package.json
- Validation before packaging catches missing files early

**Related Issues/PRs**: Deployment infrastructure improvement

---

### [2025-11-27] - Features - CustomerMasterManager Replacement

**Description**: Replaced the dual-layer customer/timezone system (`CustomerDataManager` + `CustomerTimezoneLookup`) with a unified `CustomerMasterManager` module. The new system uses `customerMasterList.json` (7,212 institution records with pre-resolved timezones) as the single source of truth, providing faster lookups via multiple indexed keys and cleaner code architecture.

**Key Changes**:
- Created `scripts/buildCustomerMasterJSON.js` to convert the master list JS file to indexed JSON
- Created `modules/customerMasterManager.js` with unified API for customer lookup and timezone resolution
- Updated `manifest.json` to use new module and expose `customerMasterList.json`
- Updated all consuming modules to use `CustomerMasterManager`:
  - `caseDataExtractor.js` - Uses `CustomerMasterManager.resolveTimezone()` and `findByInstitutionCode()`
  - `casePageDataExtractor.js` - Uses `CustomerMasterManager.resolveTimezone()` and `findByInstitutionCode()`
  - `persistentBanner.js` - Uses `CustomerMasterManager` for timezone resolution and customer lookup
  - `dynamicMenu.js` - Uses `CustomerMasterManager.resolveTimezone()` for timezone display
  - `flexipagePanelInjector.js` - Uses `CustomerMasterManager.resolveTimezone()` for timezone lookup
  - `content_script_exlibris.js` - Initializes `CustomerMasterManager` instead of the two old modules

**Removed Files**:
- `modules/customerDataManager.js` (replaced by CustomerMasterManager)
- `modules/customerTimezoneLookup.js` (replaced by CustomerMasterManager)
- `timezones_index.json` (replaced by customerMasterList.json)
- `timezones_index.js` (replaced by customerMasterList.json)

**New Data Features**:
- 7,212 institution records with pre-resolved timezones
- Multiple lookup indexes: byAccountName, byInstitutionCode, byAccountCode, byServerIds
- Server and region data included for better URL generation
- User overrides preserved via chrome.storage.local

**Lessons Learned**:
- Unifying customer data and timezone lookup eliminates redundant code paths and data duplication
- Pre-building indexes in the JSON file speeds up runtime lookups significantly
- Using consistent field names (customerId vs custID) requires backwards-compatible aliases in the new API
- UserCustomerDataManager remains separate for user-added custom entries (priority over master list)

**Related Issues/PRs**: Customer timezone pipeline refactor

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

### [2025-11-28] - Documentation - Documentation Structure Cleanup

**Description**: Major documentation cleanup and reorganization to establish `docs/` folder as single source of truth and reduce redundancy.

**Changes Made**:
- Created `archive/` folder for obsolete documentation
- Archived 18 obsolete implementation notes and planning documents
- Updated cross-references in active documentation
- Created `archive/README.md` with archive index

**Files Archived**: 
- `ARCHITECTURE.md`, `BANNER_DESIGN_ANALYSIS.md`, `CACHE_GLOBAL_STATE_INTEGRATION_PLAN.md`
- `CASEDETAILEXTRACTOR_DATAFLOW_ANALYSIS.md`, `CLEANUP_SUMMARY.md`, `CODEBASE_ANALYSIS.md`
- `COMPLETE_FLOW_DOCUMENTATION.md`, `comprehensive-codebase-documentation.plan.md`
- `CROSS_TAB_SYNC_IMPLEMENTATION.md`, `explanation.md` (root), `FEATURE_IMPLEMENTATION_PLAN.md`
- `FETCH_INTERCEPTION_ANALYSIS.md`, `HIGHLIGHTER_BANNER_REDESIGN.md`, `IMPLEMENTATION_GUIDE.md`
- `IMPLEMENTATION_PLAN_TOOLS_REFACTOR.md`, `IMPLEMENTATION_PROGRESS.md`
- `PLAN_REMOVE_BANNER_CHECKBOX_AND_TAB_NAV.md`, `PROMPT.md`

**Files Updated**:
- `docs/explanation.md` - Updated documentation structure references
- `docs/02-architecture-and-design.md` - Removed archived file references
- `docs/04-data-flow.md` - Removed archived file references

**New Structure**:
- Root level: Essential reference docs (8 files)
- `docs/`: Comprehensive documentation (7 files + explanation.md)
- `.github/`: AI/developer guidelines (2 files)
- `archive/`: Historical documentation (18 files)

**Lessons Learned**:
- Single source of truth prevents confusion from duplicate/outdated docs
- Implementation notes should be archived after implementation is complete
- Clear archive structure with README helps future reference if needed
- Focused documentation is easier to maintain than scattered files

**Related Issues/PRs**: Documentation cleanup initiative

---

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

- **Total Changes**: 6
- **Bug Fixes**: 2
- **Features**: 2
- **Refactoring**: 0
- **Documentation**: 2
- **Performance**: 0
- **Security**: 0

---

## Recent Changes Summary

### Documentation (2)
- [2025-11-28] Documentation structure cleanup and archive creation
- [2024-01-XX] Comprehensive codebase documentation system created

### Features (2)
- [2025-11-24] Customer Timezone Lookup Pipeline
- [2024-12-XX] Timezone Converter Feature

### Bug Fixes (2)
- [2024-12-XX] CaseDetailExtractor Stale Data Prevention
- [2024-12-XX] Cache Invalidation for Case Data Extractors

---

## Notes

- This document should be updated with every significant change
- Include lessons learned to help future development
- Link to related issues/PRs for context
- Group related changes together

