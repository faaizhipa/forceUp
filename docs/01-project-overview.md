# Project Overview

**Document Version:** 1.0  
**Last Updated:** January 23, 2025  
**Maintained By:** Development Team

---

## Table of Contents

- [What is This Extension?](#what-is-this-extension)
- [Key Features](#key-features)
- [Target Users](#target-users)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Browser Compatibility](#browser-compatibility)
- [Version History](#version-history)

---

## What is This Extension?

The **Penang CoE Salesforce and Docs Extension** is a Chrome browser extension (Manifest V3) designed to enhance productivity for support teams working in Salesforce environments. It specifically targets:

- **Clarivate Salesforce instances** (EndNote, WebOfScience, ScholarOne, etc.)
- **Ex Libris/ProQuest Salesforce** (Alma, Esploro, Pivot-RP, RefWorks)
- **Knowledge base sites** (Clarivate Support, Ex Libris Knowledge)

The extension provides intelligent automation, data extraction, field highlighting, dynamic menus, and productivity tools tailored for case management workflows.

---

## Key Features

### 1. **Salesforce Case Management** (Primary Focus)

#### For ProQuest/Ex Libris (proquestllc.lightning.force.com)

**🎯 Case Page Enhancements:**
- **Field Highlighting**: Automatically highlights empty required fields in red, filled fields in green
- **Dynamic URL Menus**: Auto-generates buttons for:
  - Production environments (Live View, Back Office)
  - Sandbox environments (PSB, SB, SQA)
  - Kibana logs (data center auto-detection)
  - Customer JIRA queries
  - SQL wikis and system status pages
- **Timezone Converter**: Expandable widget showing time conversions between case timezone, user timezone, and UTC
- **Case Comment Memory**: Auto-saves case comments every 500ms with restore capability
- **Character Counter**: Real-time character count for comment fields with color-coded warnings
- **Persistent Banner**: Always-visible case info banner showing case number, subject, status, and quick actions

**📊 Case List Enhancements:**
- **Age-Based Highlighting**: Colors case rows based on elapsed working time (green → yellow → orange → red)
- **Status Badge Coloring**: Visual indicators for case status (New, In Progress, Closed, etc.)
- **Multi-Team Support**: Calculates working hours based on team configuration (14 different teams)

**🔍 Case Comments Page:**
- Auto-save and restore functionality
- Character counting
- Text formatting shortcuts

#### For Clarivate Salesforce (all instances)

**📧 Email Validation:**
- Highlights "From" email field based on team assignment
- Color-codes incorrect email addresses (red for wrong team, orange for other teams)

**📋 Case List Features:**
- Age-based row highlighting
- Status badge coloring
- Response time tracking

### 2. **Knowledge Base Tools** (Support Sites)

#### For support.clarivate.com, knowledge.exlibrisgroup.com, developers.exlibrisgroup.com

**✍️ Highlighting & Annotation:**
- **Layer-based highlighting**: Create multiple highlight layers per page
- **Color-coded highlights**: 5 colors with tooltips and notes
- **Sticky notes**: Add floating notes to any page
- **Bookmarks**: Organize pages into collections with tags

**💾 Workspace Management:**
- **Automatic backups**: Creates backups on every migration
- **Export/import**: Transfer workspace between browsers
- **Auto-restore**: Restores workspace if Chrome clears storage
- **Version migration**: Handles data format upgrades

### 3. **Text Formatting Tools** (All Sites)

**🎨 Unicode Text Styles:**
- Bold: 𝗕𝗼𝗹𝗱
- Italic: 𝘐𝘵𝘢𝘭𝘪𝘤
- Bold Italic: 𝙄𝙩𝙖𝙡𝙞𝘤
- Bold Serif: 𝐒𝐞𝐫𝐢𝐟
- Code: 𝙲𝚘𝚍𝚎

**🔤 Case Transformations:**
- Toggle Case
- UPPERCASE
- lowercase
- Capital Case
- Sentence case

**➕ Special Symbols:**
- Quick insert via context menu
- 11 common symbols (▪, ∘, ▫, ►, etc.)

**⌨️ Keyboard Shortcuts:**
- Ctrl+Shift+B: Bold
- Ctrl+Shift+I: Italic
- Ctrl+Shift+U: Toggle case
- And more...

### 4. **Data Extraction & Caching**

**📦 Smart Data Extraction:**
- Extracts 30+ fields from Salesforce case pages
- Handles Shadow DOM traversal
- Supports lazy-loaded Lightning components
- Derives computed values (server region, institution codes)

**💾 Multi-Layer Caching:**
- **In-memory cache**: Fast access for current session
- **CaseDataStore**: Single source of truth for current case
- **CaseContextWatcher**: Monitors page context changes
- **Validation layer**: Prevents stale data display

### 5. **Timezone Resolution**

**🌍 Automatic Timezone Detection:**
- Extracts customer timezone from account data
- Falls back to address-based resolution
- Caches timezone data for performance
- Displays timezone in case banner and converter

**🕐 Timezone Converter:**
- Converts times between Case/User/UTC
- Supports multiple date selection (Analytics Refresh, Case Created, etc.)
- Handles DST transitions automatically
- Shows timezone abbreviations (SGT, MYT, EST, etc.)

---

## Target Users

### Primary Users
- **Technical Support Engineers** at Clarivate and Ex Libris
- **Case Management Teams** handling Alma, Esploro, EndNote, RefWorks, WebOfScience, ScholarOne support
- **QA Teams** validating case workflows
- **Team Leads** monitoring case age and response times

### User Personas

**1. Support Engineer (Sarah)**
- Opens 20-30 cases per day
- Needs quick access to customer environments
- Wants automatic timezone conversion
- Requires fast case data extraction

**2. Senior Engineer (Tom)**
- Reviews complex escalations
- Needs detailed case history
- Uses SQL queries frequently
- Requires knowledge base annotations

**3. Team Lead (Maria)**
- Monitors case age and response times
- Tracks team performance
- Needs quick case overview
- Uses age-based highlighting for prioritization

---

## Technology Stack

### Core Technologies
- **Manifest V3**: Latest Chrome Extension API
- **Vanilla JavaScript**: No external dependencies
- **Salesforce Lightning**: Target platform (SPA framework)
- **Chrome Storage API**: Data persistence
- **MutationObserver API**: DOM change detection
- **Shadow DOM**: Lightning component traversal

### Key APIs Used
```javascript
// Chrome Extension APIs
chrome.storage.sync       // Settings (synced across devices)
chrome.storage.local      // Cache, workspace data
chrome.runtime            // Background messaging
chrome.tabs               // Multi-tab synchronization
chrome.contextMenus       // Right-click menus

// Browser APIs
MutationObserver          // DOM change detection
IntersectionObserver      // Lazy loading detection
BroadcastChannel          // Cross-tab communication
performance.now()         // Performance measurement
Intl.DateTimeFormat       // Timezone handling
```

### Architecture Patterns
- **IIFE Module Pattern**: Encapsulation without build tools
- **Event-Driven Architecture**: Loose coupling via custom events
- **Observer Pattern**: DOM monitoring and state changes
- **Pub/Sub Pattern**: Cross-module communication
- **Singleton Pattern**: Shared state managers

---

## Project Structure

```
/
├── manifest.json                 # Extension configuration
├── background.js                 # Service worker (Manifest V3)
├── popup.html/js                 # Settings UI
├── content_script.js             # Entry point for Clarivate SFDC
├── content_script_exlibris.js    # Controller for ProQuest SFDC
├── content_script_highlighter.js # Entry point for knowledge bases
│
├── modules/                      # 40+ feature modules
│   ├── Core Infrastructure
│   │   ├── logger.js             # Logging utility
│   │   ├── debounceUtils.js      # Timing utilities
│   │   ├── settingsManager.js    # Settings management
│   │   └── pageIdentifier.js     # Page type detection
│   │
│   ├── Data Management
│   │   ├── caseContextWatcher.js  # Page context monitoring
│   │   ├── caseDataStore.js       # Single source of truth
│   │   ├── caseDataExtractor.js   # Legacy extractor
│   │   ├── casePageDataExtractor.js # Current extractor
│   │   └── customerDataManager.js  # Customer database
│   │
│   ├── UI Components
│   │   ├── fieldHighlighter.js    # Field highlighting
│   │   ├── dynamicMenu.js         # URL button injection
│   │   ├── persistentBanner.js    # Always-visible banner
│   │   └── flexipagePanelInjector.js # Panel injection
│   │
│   ├── Features
│   │   ├── caseCommentMemory.js   # Auto-save comments
│   │   ├── characterCounter.js    # Comment length counter
│   │   ├── timezoneConverter.js   # Timezone widget
│   │   └── caseTimezoneResolver.js # Timezone detection
│   │
│   └── Utilities
│       ├── navigationObserver.js  # SPA navigation detection
│       ├── textFormatter.js       # Unicode formatting
│       ├── urlBuilder.js          # Dynamic URL generation
│       └── shadowTextExtractor.js # Shadow DOM traversal
│
├── docs/                         # Documentation (this folder)
│   ├── explanation.md            # Main navigation
│   ├── 01-project-overview.md    # This file
│   ├── 02-architecture-and-design.md
│   ├── 03-core-modules.md
│   ├── 04-data-flow.md
│   ├── 05-state-management.md
│   ├── 06-bugs-and-gaps.md
│   └── 07-development-log.md
│
└── .github/
    └── copilot-instructions.md   # AI assistant guidelines
```

---

## Browser Compatibility

### Supported Browsers
- ✅ **Google Chrome**: v88+ (Manifest V3 support)
- ✅ **Microsoft Edge**: v88+ (Chromium-based)
- ❌ **Firefox**: Not compatible (uses different extension API)
- ❌ **Safari**: Not compatible (uses different extension API)

### Required Permissions
```json
{
  "permissions": [
    "storage",      // For settings and cache
    "tabs",         // For multi-tab sync
    "activeTab",    // For content script injection
    "contextMenus"  // For right-click formatting
  ]
}
```

### Salesforce Compatibility
- **Lightning Experience**: ✅ Fully supported
- **Classic Experience**: ⚠️ Limited support (ScholarOne only)
- **Salesforce Mobile**: ❌ Not supported

---

## Version History

### v7.2 (Current - January 2025)
- Added persistent banner with case info
- Improved timezone converter with expandable UI
- Enhanced cache validation and stale data prevention
- Added CaseContextWatcher for reliable page detection
- Implemented CaseDataStore as single source of truth
- Fixed SPA navigation issues
- Added workspace backup and restore

### v7.1 (December 2024)
- Added timezone converter feature
- Improved field highlighting performance
- Enhanced shadow DOM traversal
- Fixed multi-tab sync issues

### v7.0 (November 2024)
- Migrated to Manifest V3
- Refactored background script to service worker
- Updated storage API usage
- Improved performance and reliability

### v6.x (2023-2024)
- Initial Ex Libris/ProQuest support
- Dynamic menu injection
- Case comment memory
- Field highlighting
- Knowledge base tools

### v5.x and earlier (2022-2023)
- Clarivate Salesforce support
- Email validation
- Case age highlighting
- Basic productivity tools

---

## Performance Metrics

### Typical Performance
- **Page Load Impact**: <100ms additional load time
- **Case Data Extraction**: 200-500ms (including DOM queries)
- **Field Highlighting**: 50-100ms
- **Dynamic Menu Injection**: 100-200ms
- **Memory Footprint**: ~10-15MB per tab

### Optimization Techniques
- Debounced DOM observers (250ms delay)
- Cached DOM queries
- Lazy loading of non-critical features
- Progressive enhancement (load critical features first)
- Efficient Shadow DOM traversal

---

## Known Limitations

### Technical Limitations
1. **Salesforce Updates**: Salesforce frequently changes DOM structure, requiring selector updates
2. **Shadow DOM Access**: Closed shadow roots are inaccessible
3. **Service Worker Ephemeral**: Background state lost when service worker terminates
4. **Storage Quota**: chrome.storage.local limited to ~10MB
5. **Lazy Loading**: Some Lightning components load on-demand, requiring retry logic

### Feature Limitations
1. **Offline Mode**: Requires active Salesforce session
2. **Mobile**: Not optimized for mobile browsers
3. **Cross-Browser**: Chrome/Edge only
4. **Language**: English UI only
5. **Timezone Detection**: Requires customer data or address

---

## Security & Privacy

### Data Handling
- ✅ **No external API calls**: All processing is client-side
- ✅ **No user tracking**: No analytics or telemetry
- ✅ **No data transmission**: Data never leaves the browser
- ✅ **Local storage only**: Uses chrome.storage APIs
- ✅ **Content scripts only**: No web page code injection

### Sensitive Data
The extension handles:
- Case numbers and subjects (Salesforce data)
- Customer account numbers
- Institution codes
- Email addresses (for validation only)

**Storage**: All data stored locally in browser using Chrome Storage API. Data is not synced to cloud or shared with any external service.

### Permissions Justification
- **storage**: Required for settings and cache
- **tabs**: Required for multi-tab case synchronization
- **activeTab**: Required for content script injection
- **contextMenus**: Required for text formatting menus

---

## Support & Maintenance

### Development Team
- **Maintained By**: Penang CoE Team
- **Primary Codebase**: Internal repository
- **Issue Tracking**: Internal issue tracker
- **Documentation**: This folder (docs/)

### Getting Help
1. Check [06-bugs-and-gaps.md](./06-bugs-and-gaps.md) for known issues
2. Review [07-development-log.md](./07-development-log.md) for similar problems
3. Consult team knowledge base
4. Contact senior developers

### Contributing
1. Follow [PROJECT_RULES.md](../PROJECT_RULES.md)
2. Reference [BEST_PRACTICES.md](../BEST_PRACTICES.md)
3. Update documentation with changes
4. Add lessons learned to development log

---

## Next Steps

- **For architecture details**: See [02-architecture-and-design.md](./02-architecture-and-design.md)
- **For module details**: See [03-core-modules.md](./03-core-modules.md)
- **For data flow**: See [04-data-flow.md](./04-data-flow.md)
- **For state management**: See [05-state-management.md](./05-state-management.md)

---

**[← Back to Main Documentation](./explanation.md)** | **[Next: Architecture & Design →](./02-architecture-and-design.md)**
