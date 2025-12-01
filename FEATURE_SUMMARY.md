# Feature Summary

**Last Updated:** 2025-01-23  
**Purpose:** Quick reference guide for all extension features with brief descriptions and quick start steps

---

## Overview

This Chrome Extension (Manifest V3) enhances Salesforce Lightning with productivity tools for Clarivate and Ex Libris support teams. Features are organized by domain and page type.

---

## Feature Availability by Domain

### ProQuest/Ex Libris Domain (`proquestllc.lightning.force.com`)
**Full feature set available:**
- Field Highlighting
- Dynamic Menu Buttons
- Case Comment Memory
- Character Counter
- Context Menu Formatting
- Keyboard Shortcuts
- Multi-Tab Sync
- Persistent Banner
- Case Data Extraction & Caching
- Timezone Resolution
- Case Page Data Extractor

### Clarivate Domains
**Legacy features:**
- Email From validation
- Case list row aging colors
- Status badge colorization

### Support Sites (`support.clarivate.com`, `knowledge.exlibrisgroup.com`, `developers.exlibrisgroup.com`)
**Text highlighting features:**
- Text Highlighter
- Sticky Notes
- Bookmarks

---

## Core Features

### 1. Field Highlighting
**Module:** `fieldHighlighter.js`  
**Page Type:** Case Page only  
**Status:** ✅ Active

**Description:**  
Highlights key case fields with color coding:
- **Red:** Empty required fields
- **Yellow:** Filled fields
- **Green:** Optional fields (if configured)

**Target Fields:**
- Category
- Sub-Category
- Description
- Status
- Problem Root Cause
- Primary Jira
- Jira Status

**Quick Start:**
1. Navigate to a case page
2. Fields are automatically highlighted
3. Configure in popup settings (General tab)

**Configuration:**
- Enable/disable in popup: `Features > Field Highlighting`
- Colors are defined in `fieldHighlighter.js`

**Dependencies:**
- `pageIdentifier.js` (page detection)
- `caseDataExtractor.js` (field data)

---

### 2. Dynamic Menu Buttons
**Module:** `dynamicMenu.js`  
**Page Type:** Case Page  
**Status:** ✅ Active

**Description:**  
Injects action buttons that generate dynamic URLs for:
- Live View (Esploro/Alma portals)
- Back Office
- Sandbox environments
- SQL Query Builder
- JIRA links
- Analytics tools
- Kibana dashboards

**Quick Start:**
1. Navigate to a case page
2. Buttons appear in header details area (default)
3. Click any button to open the generated URL

**Button Groups:**
- **Environment Buttons:** Production, Sandbox, PSB
- **Tool Buttons:** SQL, Analytics, Kibana
- **External Links:** JIRA, Documentation

**Configuration:**
- Button placement: `Popup > Ex Libris > Menu Locations`
- Button label style: `Popup > Ex Libris > Button Label Style`
  - Options: Formal, Casual, Abbreviated

**Dependencies:**
- `urlBuilder.js` (URL generation)
- `caseDataExtractor.js` (case data)
- `customerDataManager.js` (customer info)

---

### 3. Timezone Converter
**Module:** `timezoneConverter.js`, `dynamicMenu.js`  
**Page Type:** Case Page  
**Status:** ✅ Active

**Description:**  
Expandable timezone converter that displays time conversions between case timezone, user timezone, and UTC. Replaces the previous "Next Analytics Refresh" section with a comprehensive converter.

**Features:**
- Expandable/collapsible UI (default collapsed)
- Date selection dropdown:
  - Next Analytics Refresh (default)
  - Case Created Date
  - Case Closed Date
  - Case Last Modified Date
- Three timezone displays:
  - Case Timezone (resolved from case data)
  - Your Timezone (from user preferences)
  - UTC
- Automatic timezone resolution
- Real-time conversion updates

**Quick Start:**
1. Navigate to a case page
2. Timezone converter appears in Dynamic Menu
3. Click header to expand/collapse
4. Select different dates from dropdown
5. View conversions in all three timezones

**Timezone Resolution:**
- **Case Timezone:** 
  - Priority: TimezoneStorage (cached) > InstitutionTimezoneManager > UTC fallback
  - Uses case account name, institution code, customer ID, institution ID
- **User Timezone:**
  - From UserPreferences (auto-detect or manual)
  - Falls back to browser detection
- **UTC:** Always available

**Configuration:**
- User timezone: `Popup > Timezone Settings > Your Local Timezone`
- Auto-detect or manual override available
- Case timezone resolved automatically from case data

**Dependencies:**
- `timezoneConverter.js` (conversion logic)
- `timezoneStorage.js` (case timezone cache)
- `institutionTimezoneManager.js` (institution timezone lookup)
- `userPreferences.js` (user timezone settings)
- `urlBuilder.js` (analytics refresh time)
- `casePageDataExtractor.js` (case dates)

---

### 4. Case Comment Memory
**Module:** `caseCommentMemory.js`  
**Page Type:** Case Comments page  
**Status:** ✅ Active

**Description:**  
Auto-saves comment text as you type with history tracking. Restore previous versions or continue where you left off.

**Features:**
- Auto-save every 2 seconds (throttled)
- History queue (last 10 versions)
- Restore UI with timestamp dropdown
- Per-case storage (localStorage)
- Multi-tab sync detection

**Quick Start:**
1. Navigate to Case Comments page
2. Start typing in comment textarea
3. Text is auto-saved automatically
4. Use restore button to access history

**Configuration:**
- Enable/disable: `Popup > Features > Auto-Save Comments`
- Storage: `chrome.storage.local` by case ID

**Dependencies:**
- `pageIdentifier.js` (page detection)
- `multiTabSync.js` (tab sync warnings)

---

### 4. Character Counter
**Module:** `characterCounter.js`  
**Page Type:** Case Comments page  
**Status:** ✅ Active

**Description:**  
Displays live character count (0/4000) near the Save button with color thresholds.

**Color Coding:**
- **Green:** 0-3500 characters
- **Yellow:** 3500-3900 characters
- **Red:** 3900-4000+ characters

**Quick Start:**
1. Navigate to Case Comments page
2. Counter appears automatically near Save button
3. Updates in real-time as you type

**Configuration:**
- Enable/disable: `Popup > Features > Character Counter`
- Thresholds are configurable in module

---

### 5. Context Menu Formatting
**Module:** `contextMenuHandler.js`  
**Page Type:** Any (textareas/inputs)  
**Status:** ✅ Active

**Description:**  
Right-click context menu for text formatting:
- Unicode character replacement (bold, italic, code)
- Case toggling (UPPER, lower, Sentence, Title)
- Symbol insertion (bullets, arrows, etc.)

**Quick Start:**
1. Select text in any textarea
2. Right-click to open context menu
3. Choose formatting option

**Menu Options:**
- **Format:** Bold, Italic, Code, Strikethrough
- **Case:** Toggle, UPPER, lower, Sentence, Title
- **Symbols:** Bullets, arrows, special characters

**Configuration:**
- Enable/disable: `Popup > Features > Context Menu Formatting`
- Menu items defined in `background.js`

**Dependencies:**
- `textFormatter.js` (formatting functions)
- `background.js` (menu creation)

---

### 6. Keyboard Shortcuts
**Module:** `keyboardShortcuts.js`  
**Page Type:** Case Comments page  
**Status:** ✅ Active

**Description:**  
Hotkeys for quick text formatting and UI actions.

**Available Shortcuts:**
- `Ctrl+B` / `Cmd+B`: Bold
- `Ctrl+I` / `Cmd+I`: Italic
- `Ctrl+U` / `Cmd+U`: Underline
- `Ctrl+Shift+X`: Toggle case
- `Ctrl+K`: Insert symbol

**Quick Start:**
1. Focus on a textarea
2. Use keyboard shortcuts
3. Formatting is applied to selection

**Configuration:**
- Enable/disable: `Popup > Shortcuts > Enable Keyboard Shortcuts`
- Shortcuts defined in `keyboardShortcuts.js`

**Dependencies:**
- `textFormatter.js` (formatting functions)

---

### 7. Multi-Tab Sync
**Module:** `multiTabSync.js`  
**Page Type:** Case Page, Case Comments  
**Status:** ✅ Active

**Description:**  
Detects when the same case is open in multiple tabs and warns users to prevent conflicts.

**Features:**
- BroadcastChannel-based detection
- Heartbeat mechanism (every 2 seconds)
- Warning banner with "Switch to Other Tab" button
- Automatic tab switching via background script

**Quick Start:**
1. Open a case in one tab
2. Open the same case in another tab
3. Warning banner appears
4. Click button to switch to other tab

**Configuration:**
- Enable/disable: `Popup > Features > Multi-Tab Warning`
- Heartbeat interval: 2000ms (configurable)

---

### 8. Persistent Banner
**Module:** `persistentBanner.js`  
**Page Type:** All pages (ProQuest domain)  
**Status:** ✅ Active

**Description:**  
Fixed banner at top of page showing:
- Current case information
- Customer metadata (custID, instID, server)
- Page status with gradient coloring
- Navigation history
- Environment buttons (Production, Sandbox)
- Quick actions (Refresh, Show Panel)

**Features:**
- Always visible (fixed position)
- Collapsible to small button
- Status-based gradient colors
- Case data validation
- Periodic validation (every 2 seconds)

**Quick Start:**
1. Navigate to any ProQuest Salesforce page
2. Banner appears automatically at top
3. Click collapse button to minimize
4. Use action buttons for quick access

**Status Colors:**
- **Blue gradient:** Closed cases
- **Green gradient:** New cases
- **Yellow gradient:** In Progress
- **Red gradient:** Escalated
- **Gray gradient:** Default/Unknown

**Configuration:**
- Enable/disable: `Popup > Features > Persistent Banner`
- Banner messages: Rotating informational messages

**Dependencies:**
- `casePageDataExtractor.js` (case data)
- `pageContextValidator.js` (validation)
- `navigationObserver.js` (navigation detection)

---

### 9. Case Data Extraction & Caching
**Module:** `caseDataExtractor.js`, `casePageDataExtractor.js`, `cacheManager.js`  
**Page Type:** Case Page  
**Status:** ✅ Active

**Description:**  
Extracts case data from DOM and caches it for performance. Validates data integrity and prevents stale data display.

**Extracted Data:**
- Case ID and Case Number
- Subject and Description
- Account and Contact names
- Product/Service information
- Category and Sub-Category
- Status and Sub-Status
- Customer metadata (custID, instID, server)
- Ex Libris Account Number
- Dates (Created, Closed, Last Modified)

**Caching Strategy:**
- In-memory cache (fast access)
- `chrome.storage.local` (persistence)
- Signature-based validation
- Case ID and Case Number validation
- Cache locking for concurrency

**Quick Start:**
1. Navigate to a case page
2. Data is extracted automatically
3. Cached for subsequent visits
4. Cache invalidates on case modification

**Configuration:**
- Cache TTL: 30 days (configurable)
- Cache size limit: ~8MB (chrome.storage limit)

**Dependencies:**
- `customerDataManager.js` (customer lookup)
- `pageContextValidator.js` (validation)
- `pageIdentifier.js` (page detection)

---

### 10. Timezone Resolution
**Module:** `caseTimezoneResolver.js`, `timezoneUtils.js`, `institutionTimezoneManager.js`  
**Page Type:** Case Page (via Panel)  
**Status:** ✅ Active

**Description:**  
Resolves timezone for cases based on:
- Institution code lookup
- Customer ID lookup
- Account address analysis
- Default timezone fallback

**Features:**
- Automatic timezone detection
- Manual timezone override
- Timezone storage per institution
- Integration with case data

**Quick Start:**
1. Open case page
2. Click "Show Panel" in banner
3. Timezone is resolved automatically
4. View timezone info in panel

**Configuration:**
- Auto-detect: Enabled by default
- Manual override: Available in panel
- Storage: `chrome.storage.local`

**Dependencies:**
- `institutionTimezoneManager.js` (timezone data)
- `accountAddressExtractor.js` (address parsing)
- `timezoneStorage.js` (persistence)

---

### 11. Case Page Data Extractor
**Module:** `casePageDataExtractor.js`  
**Page Type:** Case Page  
**Status:** ✅ Active

**Description:**  
Automatically extracts comprehensive case data when navigating to case pages. Handles SPA navigation and validates data before dispatch.

**Features:**
- Automatic extraction on page load
- Manual extraction trigger (via banner)
- Data validation (case ID/number matching)
- Title update waiting (handles SPA timing)
- Retry mechanism for failed validations
- Event-based data dispatch

**Quick Start:**
1. Navigate to a case page
2. Data extraction happens automatically
3. Data is dispatched via `casePageDataExtracted` event
4. Other modules consume the event

**Configuration:**
- Extraction timeout: 20 seconds
- Retry delay: 500ms
- Title update wait: 2 seconds max

**Dependencies:**
- `pageIdentifier.js` (page detection)
- `pageContextValidator.js` (validation)
- `customerDataManager.js` (customer data)

---

## Legacy Features (Clarivate Domains)

### Email From Validation
**Module:** `content_script.js`  
**Domain:** Clarivate domains  
**Status:** ✅ Active

**Description:**  
Highlights email "From" addresses in case emails based on team configuration.

**Quick Start:**
1. View case emails
2. Team emails are automatically highlighted
3. Configure team in popup settings

---

### Case List Row Aging
**Module:** `content_script.js`  
**Domain:** Clarivate domains  
**Status:** ✅ Active

**Description:**  
Color-codes case list rows based on age and response time targets.

**Color Logic:**
- Based on team working hours
- Response time targets
- Elapsed time calculation

---

## Support Site Features

### Text Highlighter
**Module:** `highlighter.js`  
**Domain:** Support sites  
**Status:** ✅ Active

**Description:**  
Highlight text on support documentation sites with persistent storage.

**Quick Start:**
1. Navigate to support site
2. Select text and highlight
3. Highlights persist across sessions

---

### Sticky Notes
**Module:** `stickyNotes.js`  
**Domain:** Support sites  
**Status:** ✅ Active

**Description:**  
Add sticky notes to support pages with positioning and persistence.

---

### Bookmarks
**Module:** `bookmarkManager.js`  
**Domain:** Support sites  
**Status:** ✅ Active

**Description:**  
Bookmark important pages and sections.

---

## Feature Dependencies

### Core Dependencies
All features depend on:
- `pageIdentifier.js` - Page type detection
- `settingsManager.js` - Settings management
- `navigationObserver.js` - SPA navigation detection

### Data Dependencies
Features that need case data:
- Dynamic Menu Buttons → `caseDataExtractor.js`, `customerDataManager.js`
- Persistent Banner → `casePageDataExtractor.js`
- Timezone Resolution → `caseTimezoneResolver.js`

### UI Dependencies
Features that inject UI:
- Dynamic Menu → `dynamicMenu.js`
- Persistent Banner → `persistentBanner.js`
- Field Highlighting → `fieldHighlighter.js`

---

## Configuration Quick Reference

### Popup Settings Location
1. Click extension icon
2. Navigate to appropriate tab:
   - **General:** Team selection
   - **Ex Libris:** Feature toggles, UI preferences
   - **Shortcuts:** Keyboard shortcuts
   - **About:** Version info, storage usage

### Feature Toggles
All features can be enabled/disabled individually in:
`Popup > Ex Libris > Features`

### Team Configuration
Select your team in:
`Popup > General > Team Setting`

Available teams:
- EndNote
- Web of Science
- ScholarOne
- Life Science (various)
- Account Support
- Esploro
- Alma
- Pivot-RP
- RefWorks
- InCites

---

## Troubleshooting

### Features Not Appearing
1. Check popup settings (feature enabled?)
2. Verify correct domain (ProQuest vs Clarivate)
3. Check browser console for errors
4. Verify page type (some features are page-specific)

### Data Not Loading
1. Check `casePageDataExtractor.js` logs in console
2. Verify page context validation
3. Check cache status in console
4. Try manual refresh via banner button

### Performance Issues
1. Check cache size in popup (About tab)
2. Clear cache if needed
3. Disable unused features
4. Check console for excessive logging

---

## Related Documentation

- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - Detailed implementation information
- **[FUNCTIONS.md](FUNCTIONS.md)** - Function reference for each module
- **[SELECTORS.md](SELECTORS.md)** - DOM selector reference
- **[BEST_PRACTICES.md](BEST_PRACTICES.md)** - Development best practices
- **[PROJECT_RULES.md](PROJECT_RULES.md)** - Project rules and guidelines

