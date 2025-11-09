# Ex Libris Extension - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                              │
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │   Popup UI   │◄───────►│  Background  │                      │
│  │ (Settings)   │         │Service Worker│                      │
│  └──────┬───────┘         └──────┬───────┘                      │
│         │                         │                              │
│         │    chrome.storage.sync  │                              │
│         └────────────┬────────────┘                              │
│                      │                                            │
│              ┌───────▼────────┐                                  │
│              │ User Settings  │                                  │
│              │  - Timezone    │                                  │
│              │  - Label Style │                                  │
│              │  - Menu Loc    │                                  │
│              └───────┬────────┘                                  │
│                      │                                            │
│         ┌────────────▼────────────┐                              │
│         │   Content Scripts       │                              │
│         │  (ProQuest SFDC Only)   │                              │
│         └────────────┬────────────┘                              │
│                      │                                            │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │    Salesforce DOM            │
        │  (proquestllc.lightning...)  │
        └──────────────────────────────┘
```

---

## Module Architecture

```
content_script_exlibris.js (Main Controller)
            │
            ├─► PageIdentifier
            │   └─► Monitors URL changes
            │   └─► Detects page type
            │
            ├─► CaseDataExtractor
            │   └─► Reads Salesforce fields
            │   └─► Derives computed values
            │
            ├─► FieldHighlighter
            │   └─► Highlights empty/filled fields
            │   └─► Color-codes by status
            │
            ├─► URLBuilder
            │   └─► Generates dynamic URLs
            │   └─► Lookups Kibana DC
            │   └─► Calculates refresh times
            │
            ├─► DynamicMenu
            │   └─► Injects button groups
            │   └─► Configurable locations
            │
            ├─► CaseCommentMemory
            │   └─► Auto-saves comments
            │   └─► Maintains history
            │   └─► Provides restore UI
            │
            ├─► CharacterCounter
            │   └─► Displays count
            │   └─► Color-codes warnings
            │
            └─► TextFormatter
                └─► Unicode conversions
                └─► Case transformations
```

---

## Data Flow - Case Page Load

```
1. USER NAVIGATES TO CASE PAGE
   │
   ▼
2. PageIdentifier detects URL change
   │
   ├─► Returns: {type: "case_page", caseId: "500QO..."}
   │
   ▼
3. ExLibrisExtension.handlePageChange()
   │
   ├─► Checks cache for case data
   │   │
   │   ├─ Cache HIT: Check if last_modified matches
   │   │   │
   │   │   ├─ MATCH: Use cached data ✓
   │   │   └─ NO MATCH: Extract fresh data
   │   │
   │   └─ Cache MISS: Extract fresh data
   │
   ▼
4. CaseDataExtractor.getData()
   │
   ├─► Query DOM for fields:
   │   ├─ Ex Libris Account #
   │   ├─ Affected Environment
   │   ├─ Product/Service Name
   │   ├─ Asset (text + href)
   │   ├─ JIRA ID
   │   └─ Last Modified Date
   │
   ├─► Derive computed values:
   │   ├─ Institution Code (add _INST if needed)
   │   ├─ Server (lowercase, e.g., "ap02")
   │   └─ Server Region (uppercase, e.g., "AP")
   │
   ▼
5. Cache case data (with last_modified as key)
   │
   ▼
6. Initialize Features in Parallel
   │
   ├─► FieldHighlighter.init()
   │   └─► Highlights Category, Sub-Category, Description, etc.
   │
   ├─► URLBuilder.buildAllButtons()
   │   ├─► Production URLs (LV, BO)
   │   ├─► Sandbox URLs (based on product type)
   │   ├─► Kibana URL (DC lookup)
   │   ├─► SQL/Wiki URLs (static)
   │   ├─► Customer JIRA URL (with account #)
   │   └─► Next Analytics Refresh (based on server region)
   │
   ├─► DynamicMenu.injectMenu()
   │   └─► Injects buttons into header
   │
   ├─► CaseCommentMemory.init()
   │   ├─► Loads history for case
   │   ├─► Monitors textarea
   │   └─► Adds "Restore" button
   │
   └─► CharacterCounter.init()
       └─► Adds counter to button row
   │
   ▼
7. FEATURES ACTIVE
   │
   └─► MutationObserver continues to monitor for DOM changes
```

---

## Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   chrome.storage.sync (5KB limit)            │
│                                                               │
│  User Preferences (Synced across devices)                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ exlibrisSettings:                                    │    │
│  │   menuLocations:                                     │    │
│  │     cardActions: false                               │    │
│  │     headerDetails: true                              │    │
│  │   buttonLabelStyle: "casual"                         │    │
│  │   timezone: null                                     │    │
│  │   highlightingEnabled: true                          │    │
│  │   customerDataSource: "default"                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ savedSelection: "EndNote"  (Existing feature)        │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│                chrome.storage.local (10MB limit)             │
│                                                               │
│  Per-Case Data (Not synced)                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ caseCommentMemory:                                   │    │
│  │   "500QO000001":                                     │    │
│  │     - { text: "...", timestamp: 123, closed: true }  │    │
│  │     - { text: "...", timestamp: 124, closed: true }  │    │
│  │     ... (up to 10 entries)                           │    │
│  │   "500QO000002":                                     │    │
│  │     - ...                                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ caseDataCache:                                       │    │
│  │   "500QO000001":                                     │    │
│  │     exLibrisAccountNumber: "61SCU"                   │    │
│  │     institutionCode: "61SCU_INST"                    │    │
│  │     server: "ap02"                                   │    │
│  │     serverRegion: "AP"                               │    │
│  │     lastModifiedDate: "2025-10-14 10:30 AM"          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ extractedCustomerData: (Future)                      │    │
│  │   [                                                  │    │
│  │     {institutionCode: "...", server: "...", ...},    │    │
│  │     ...                                              │    │
│  │   ]                                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ caseSidepanelData: (Future)                          │    │
│  │   "500QO000001":                                     │    │
│  │     notepad: "<div>...</div>"                        │    │
│  │     code: "SELECT * FROM..."                         │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│                    In-Memory State                            │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ExLibrisExtension.caseDataCache (Map)                │    │
│  │   caseId → case data object                          │    │
│  │   (Cleared on extension reload)                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ CaseCommentMemory.activeEntries (Map)                │    │
│  │   caseId → { text, timestamp, timerId, isActive }    │    │
│  │   (Cleared on extension reload)                      │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

---

## Feature Interaction Map

```
┌────────────────────────────────────────────────────────────────┐
│                        CASE PAGE                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  Header Section                          │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │  Case Number  |  Priority  |  Status  | Contact   │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │ 🔘 DynamicMenu Injection Point                     │  │  │
│  │  │                                                     │  │  │
│  │  │  Next Analytics Refresh: 12:00 UTC | 08:00 ET     │  │  │
│  │  │                                                     │  │  │
│  │  │  Production:  [LV] [BO]                            │  │  │
│  │  │  Sandboxes:   [PSB LV] [PSB BO] [SQA LV] [SQA BO] │  │  │
│  │  │  Tools:       [Kibana] [Wiki] [System Status]     │  │  │
│  │  │  SQL:         [SQL Wiki] [Alma] [Esploro]         │  │  │
│  │  │  Other:       [Customer JIRA]                      │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  Details Section                         │  │
│  │                                                           │  │
│  │  Category:       [Value...]         🔴 FieldHighlighter  │  │
│  │  Sub-Category:   [Value...]         🟡 FieldHighlighter  │  │
│  │  Description:    [Value...]         🟡 FieldHighlighter  │  │
│  │  Status:         [Value...]         🟡 FieldHighlighter  │  │
│  │                                                           │  │
│  │  ┌─── ExLibris JIRA Section ─────────────────────────┐  │  │
│  │  │  Primary JIRA:     [Value...]  🟡 FieldHighlighter │  │  │
│  │  │  Root Cause:       [Empty...]  🔴 FieldHighlighter │  │  │
│  │  │  JIRA Status:      [Value...]  🟡 FieldHighlighter │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Case Comments Section                       │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │ [Textarea]                                       │    │  │
│  │  │ 🎯 CaseCommentMemory monitors                    │    │  │
│  │  │ 🎨 TextFormatter (via context menu - future)     │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                           │  │
│  │  [0 / 4000] 📊 CharacterCounter  [Restore ▼] [Save]     │  │
│  │                                   🔁 CaseCommentMemory   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 🎛️ SQL Query Builder (Future)                           │  │
│  │                                                           │  │
│  │  Entity: [Researcher ▼]                                  │  │
│  │  Query: SELECT * FROM HFRUSER...                         │  │
│  │         [Copy]                                           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘

┌─────────────┐
│ 📝 Sidepanel│ (Future - Slides from left)
│             │
│ [Notepad]   │
│ [Code]      │
│             │
└─────────────┘
```

---

## URL Generation Flow

```
Case Data:
  exLibrisAccountNumber: "61SCU"
  server: "ap02"
  serverRegion: "AP"
  productServiceName: "esploro advanced"
  affectedEnvironment: "AP02"

        │
        ▼

URLBuilder.buildAllButtons()

        │
        ├──► Production URLs
        │    │
        │    ├─► Live View
        │    │   Template: https://{server}.alma.exlibrisgroup.com/esploro/?institution={institutionCode}
        │    │   Result:   https://ap02.alma.exlibrisgroup.com/esploro/?institution=61SCU_INST
        │    │
        │    └─► Back Office
        │        Template: https://{server}.alma.exlibrisgroup.com/mng/login?institute={institutionCode}&productCode=esploro&debug=true
        │        Result:   https://ap02.alma.exlibrisgroup.com/mng/login?institute=61SCU_INST&productCode=esploro&debug=true
        │
        ├──► Sandbox URLs (Product-Dependent)
        │    │
        │    ├─► IF Product = "Esploro Advanced"
        │    │   ├─► PSB LV: https://psb-ap02.alma.exlibrisgroup.com/esploro/?institution=61SCU_INST
        │    │   └─► PSB BO: https://psb-ap02.alma.exlibrisgroup.com/mng/login?institute=61SCU_INST&productCode=esploro&debug=true
        │    │
        │    ├─► IF Product = "Esploro Standard"
        │    │   ├─► SB LV: https://sb-ap02.alma.exlibrisgroup.com/esploro/?institution=61SCU_INST
        │    │   └─► SB BO: https://sb-ap02.alma.exlibrisgroup.com/mng/login?institute=61SCU_INST&productCode=esploro&debug=true
        │    │
        │    └─► Always Available
        │        ├─► SQA LV: https://sqa-ap02.alma.exlibrisgroup.com/esploro/?institution=61SCU_INST
        │        └─► SQA BO: https://sqa-ap02.alma.exlibrisgroup.com/mng/login?institute=61SCU_INST&productCode=esploro&debug=true
        │
        ├──► Kibana URL (DC Mapping)
        │    │
        │    Affected Environment: "AP02"
        │    Extract first 4 chars: "AP02"
        │    Lookup in kibanaMapping: AP02 → dc07
        │    Result: http://lm-oss-kib.dc07.hosted.exlibrisgroup.com:5601/
        │
        ├──► Customer JIRA
        │    │
        │    Template: https://jira.clarivate.io/issues/?jql=project=URM AND "Customer Code"~{accountNumber} AND "Platform Product"=Esploro
        │    Result:   https://jira.clarivate.io/issues/?jql=project%20%3D%20URM%20AND%20%22Customer%20Code%22%20~%2061SCU...
        │
        └──► Analytics Refresh Time
             │
             Server Region: "AP"
             Lookup: AP → 12:00 UTC
             Local Time: Convert to user's timezone
             Result: { utc: "12:00 UTC", local: "08:00 (America)", isAuto: true }
```

---

## Caching Strategy

```
Case Page Load:
    │
    ▼
Get Last Modified Date from DOM
    │
    ├─► Check In-Memory Cache
    │   │
    │   ├─ Has caseId?
    │   │   │
    │   │   ├─ YES: Compare lastModifiedDate
    │   │   │   │
    │   │   │   ├─ MATCH: Return cached data ✓ (Fast path)
    │   │   │   └─ NO MATCH: Re-extract data
    │   │   │
    │   │   └─ NO: Extract data
    │   │
    │   └─► Cache New Data
    │       │
    │       └─► Store in Map: caseId → {data, lastModifiedDate}
    │
    └─► Optional: Persist to chrome.storage.local
        │
        └─► For offline access or extension reload recovery
```

**Cache Invalidation**:
- When `lastModifiedDate` changes (case updated)
- When user manually clicks "Refresh" in popup
- On extension reload (in-memory cache cleared)

**Benefits**:
- Reduces DOM queries (expensive)
- Faster page transitions within same case
- Prevents re-calculation of derived values

---

## Performance Considerations

### Current Optimizations

1. **Throttled Auto-Save**: 500ms delay
   ```
   User types → Wait 500ms → Save to storage
   If user types again within 500ms → Reset timer
   ```

2. **Caching**: In-memory Map for case data

3. **Conditional Loading**: Modules only on ProQuest SFDC

4. **MutationObserver Scoping**: Targets specific elements

### Recommended Enhancements

1. **Debounce Field Highlighter**:
   ```
   DOM Change → Wait 100ms → Re-highlight
   ```

2. **Lazy Load Sidepanel**: Only load code when opened

3. **IndexedDB for Large Data**: Customer list, long history

4. **Web Workers**: Background customer lookups

---

## Security & Privacy

### Data Handling

| Data Type | Storage | Sync | Sensitive? |
|-----------|---------|------|------------|
| User Settings | chrome.storage.sync | Yes | No |
| Case Comments | chrome.storage.local | No | Potentially |
| Case Data Cache | In-memory | No | Yes |
| Customer List | chrome.storage.local | No | No |

### Best Practices

✅ **DO**:
- Minimize stored data
- Clear cache periodically
- Use content scripts (not web pages)
- Validate extracted data

❌ **DON'T**:
- Store passwords or tokens
- Send data to external servers
- Execute code from remote sources
- Access unrelated Salesforce data

### Permissions

- `storage`: For settings and cache
- `tabs`: For querying current tab
- `activeTab`: For injecting into active tab

**No Network Permissions**: Extension doesn't make external API calls

---

## Extension Lifecycle

```
Install/Update
    │
    ▼
Background Service Worker Starts
    │
    └─► Listens for messages from content scripts
    │
    └─► Manages chrome.storage
    │
User Opens Salesforce Tab
    │
    ▼
Content Scripts Injected (based on URL match)
    │
    ├─► Clarivate SFDC → content_script.js (existing features)
    │
    └─► ProQuest SFDC → All modules + content_script_exlibris.js
            │
            ▼
        ExLibrisExtension.init()
            │
            ├─► Load settings from storage
            ├─► Start PageIdentifier monitoring
            └─► Wait for page changes
                │
                ▼
            Page Detected → Initialize Features
                │
                └─► Features run until tab closed or navigated away
```

---

## Module Dependencies

```
content_script_exlibris.js
    │
    ├── Requires: PageIdentifier
    ├── Requires: CaseDataExtractor
    ├── Requires: FieldHighlighter
    ├── Requires: URLBuilder
    ├── Requires: DynamicMenu
    ├── Requires: CaseCommentMemory
    ├── Requires: CharacterCounter
    └── Optional: TextFormatter (for future context menu)

No External Dependencies: All vanilla JavaScript
```

**Load Order** (defined in manifest.json):
1. pageIdentifier.js
2. caseDataExtractor.js
3. fieldHighlighter.js
4. urlBuilder.js
5. textFormatter.js
6. caseCommentMemory.js
7. dynamicMenu.js
8. characterCounter.js
9. content_script_exlibris.js (last - controller)

---

## Error Handling Strategy

### Module-Level

Each module should be defensive:

```javascript
// Example from FieldHighlighter
highlightField(fieldSelector) {
  const container = document.querySelector(fieldSelector.container);
  if (!container) return; // Graceful failure

  const input = document.querySelector(fieldSelector.input);
  const isEmpty = this.isEmpty(input); // Handles null

  // Apply styles...
}
```

### Controller-Level

```javascript
// In content_script_exlibris.js
async initializeCasePageFeatures() {
  try {
    await this.waitForElements();

    // Each feature wrapped in try-catch
    if (typeof FieldHighlighter !== 'undefined') {
      try {
        FieldHighlighter.init();
      } catch (e) {
        console.error('[ExLibris] Field highlighting failed:', e);
      }
    }

    // Continue with other features...
  } catch (e) {
    console.error('[ExLibris] Failed to initialize:', e);
  }
}
```

### User-Facing Errors

- Log to console for debugging
- Don't show alert() dialogs (annoying)
- Gracefully degrade (partial features ok)

---

**Version**: 1.0
**Last Updated**: 2025-10-14
**Document Type**: Architecture Reference
