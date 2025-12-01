# Core Modules Reference

**Document Version:** 1.0  
**Last Updated:** January 23, 2025  
**Reference:** See also [FUNCTIONS.md](../FUNCTIONS.md) for complete function catalog

---

## Table of Contents

- [Module Catalog](#module-catalog)
- [Infrastructure Layer](#infrastructure-layer)
- [Data Management Layer](#data-management-layer)
- [Data Extraction Layer](#data-extraction-layer)
- [Business Logic Layer](#business-logic-layer)
- [Presentation Layer](#presentation-layer)
- [Module Initialization Guide](#module-initialization-guide)
- [Cross-Module Communication](#cross-module-communication)

---

## Module Catalog

**Total Modules**: 40+  
**Entry Point**: `content_script_exlibris.js`  
**Background Service Worker**: `background.js`

### By Layer

| Layer | Module Count | Purpose |
|-------|--------------|---------|
| Infrastructure | 6 | Foundation utilities |
| Data Management | 4 | State and storage |
| Data Extraction | 9 | DOM data reading |
| Business Logic | 8 | Feature logic |
| Presentation | 13 | UI components |

### By Complexity

| Complexity | Count | Examples |
|------------|-------|----------|
| Low | 15 | Logger, TextFormatter, URLBuilder |
| Medium | 18 | CharacterCounter, FieldHighlighter, TimezoneConverter |
| High | 7 | CaseDataStore, NavigationObserver, CasePageDataExtractor |

---

## Infrastructure Layer

### 1. Logger

**File**: `modules/logger.js`  
**Dependencies**: None  
**Purpose**: Centralized logging with debug mode support

#### Public API

```javascript
Logger.init(settings)
Logger.info(msg, ...args)
Logger.warn(msg, ...args)
Logger.error(msg, ...args)
Logger.debug(msg, ...args)
Logger.perf(label, fn)
Logger.perfAsync(label, asyncFn)
```

#### Configuration

```javascript
Logger.init({
  debugMode: false,
  prefix: '[ExLibris]',
  logToConsole: true
});
```

#### Performance Measurement

```javascript
// Sync function
const result = Logger.perf('Data Extraction', () => {
  return extractData();
});

// Async function
const result = await Logger.perfAsync('API Call', async () => {
  return await fetchData();
});
```

**Features**:
- Timestamps on all logs
- Conditional debug logging
- Performance measurement with `performance.now()`
- Prefix support for module identification

---

### 2. DebounceUtils

**File**: `modules/debounceUtils.js`  
**Dependencies**: None  
**Purpose**: Function throttling and debouncing utilities

#### Public API

```javascript
DebounceUtils.debounce(func, wait, immediate)
DebounceUtils.throttle(func, wait)
DebounceUtils.once(func)
DebounceUtils.waitUntil(condition, callback, checkInterval, maxWait)
DebounceUtils.rateLimit(func, delay)
```

#### Usage Examples

```javascript
// Debounce navigation callback
const debouncedHandler = DebounceUtils.debounce(() => {
  handleNavigation();
}, 250);

// Throttle scroll events
const throttledScroll = DebounceUtils.throttle(() => {
  handleScroll();
}, 100);

// Execute function only once
const initOnce = DebounceUtils.once(() => {
  initializeModule();
});

// Wait until condition met
DebounceUtils.waitUntil(
  () => document.querySelector('.target'),
  (element) => processElement(element),
  100,  // Check every 100ms
  5000  // Max wait 5s
);
```

**Best Practices**:
- Use 250ms debounce for navigation callbacks
- Use 100-150ms throttle for scroll handlers
- Always store debounced/throttled functions to prevent recreation

---

### 3. PageIdentifier

**File**: `modules/pageIdentifier.js`  
**Dependencies**: None  
**Purpose**: Identify Salesforce page type and context

#### Public API

```javascript
PageIdentifier.getPageType(url)
PageIdentifier.getCurrentCaseContext()
PageIdentifier.monitorPageChanges(callback)
```

#### Page Types

```javascript
{
  type: 'CASE_PAGE',
  caseId: '5008c00000XYZ',
  caseNumber: '12345678'
}

{
  type: 'CASES_LIST'
}

{
  type: 'HOME'
}

{
  type: 'UNKNOWN'
}
```

#### Context Extraction

```javascript
// ALWAYS use title + URL together
const context = PageIdentifier.getCurrentCaseContext();
// Returns:
{
  caseId: '5008c00000XYZ',
  caseNumber: '12345678',
  title: 'Case 12345678: Some Subject'
}
```

**Critical Rule**: Never extract case info without using `getCurrentCaseContext()`. This ensures both case ID and case number are validated.

---

### 4. SettingsManager

**File**: `modules/settingsManager.js`  
**Dependencies**: None  
**Purpose**: Manage extension settings (chrome.storage.sync)

#### Public API

```javascript
SettingsManager.init()
SettingsManager.get(key)
SettingsManager.set(key, value)
SettingsManager.getAll()
SettingsManager.onChanged(callback)
```

#### Settings Schema

```javascript
{
  timezone: 'Asia/Kuala_Lumpur',  // User timezone
  labelStyle: 'bold',             // Button style (bold/pill)
  menuLocation: 'top',            // Menu location (top/bottom)
  debugMode: false,               // Debug logging
  featureFlags: {
    persistentBanner: true,
    timezoneConverter: true,
    fieldHighlighting: true
  }
}
```

#### Listen for Changes

```javascript
SettingsManager.onChanged((changes) => {
  if (changes.timezone) {
    console.log('Timezone changed:', changes.timezone.newValue);
  }
});
```

---

### 5. CaseDomUtils

**File**: `modules/caseDomUtils.js`  
**Dependencies**: None  
**Purpose**: DOM utility functions for Salesforce Lightning

#### Public API

```javascript
CaseDomUtils.querySelector(selector, fallbackSelectors)
CaseDomUtils.queryShadowDOM(selector, root)
CaseDomUtils.isVisible(element)
CaseDomUtils.waitForElement(selector, timeout)
CaseDomUtils.extractFieldValue(fieldLabel)
```

#### Shadow DOM Traversal

```javascript
// Recursively search Shadow DOM
const element = CaseDomUtils.queryShadowDOM(
  'lightning-input',
  document.body
);
```

#### Visibility Checks

```javascript
// Check if element is actually visible
if (CaseDomUtils.isVisible(element)) {
  // Element is displayed
}
```

**Implementation**:
```javascript
isVisible(element) {
  return element && 
         element.offsetParent !== null &&
         getComputedStyle(element).display !== 'none' &&
         getComputedStyle(element).visibility !== 'hidden';
}
```

---

### 6. PageContextValidator

**File**: `modules/pageContextValidator.js`  
**Dependencies**: `PageIdentifier`  
**Purpose**: Validate page context before displaying data

#### Public API

```javascript
PageContextValidator.validatePageContextBeforeDisplay(caseId, caseNumber)
```

#### Validation Result

```javascript
{
  valid: true/false,
  reason: 'Description of why invalid',
  context: {
    currentCaseId: '5008c...',
    currentCaseNumber: '12345678',
    pageLoading: false
  }
}
```

#### Usage Pattern

```javascript
async displayCaseData(data) {
  // ALWAYS validate before display
  const validation = PageContextValidator.validatePageContextBeforeDisplay(
    data.caseId,
    data.caseNumber
  );
  
  if (!validation.valid) {
    Logger.warn('Validation failed:', validation.reason);
    this.clearDisplay();
    return false;
  }
  
  // Safe to display
  this.updateUI(data);
  return true;
}
```

**Critical Rule**: ALWAYS validate before displaying any case data to prevent stale data issues.

---

## Data Management Layer

### 1. CaseContextWatcher

**File**: `modules/caseContextWatcher.js`  
**Dependencies**: `PageIdentifier`, `NavigationObserver`, `DebounceUtils`  
**Purpose**: Track current case context across SPA navigation

#### Public API

```javascript
CaseContextWatcher.init()
CaseContextWatcher.getCurrentContext()
CaseContextWatcher.onContextChange(callback)
CaseContextWatcher.isOnCasePage()
```

#### Context Object

```javascript
{
  caseId: '5008c00000XYZ',
  caseNumber: '12345678',
  timestamp: 1674567890123,
  isValid: true
}
```

#### Usage

```javascript
// Listen for context changes
CaseContextWatcher.onContextChange((context) => {
  if (context.isValid) {
    Logger.info('Case changed:', context.caseNumber);
    // Trigger data extraction
  } else {
    // Navigated away from case page
    this.cleanup();
  }
});

// Get current context
const context = CaseContextWatcher.getCurrentContext();
if (context && context.isValid) {
  // On valid case page
}
```

**Features**:
- Tracks case ID and case number
- Detects navigation via multiple signals
- Debounced context updates (250ms)
- Validates context on every check

---

### 2. CaseDataStore

**File**: `modules/caseDataStore.js`  
**Dependencies**: `CaseContextWatcher`, `PageContextValidator`  
**Purpose**: Single source of truth for case data

#### Public API

```javascript
CaseDataStore.init()
CaseDataStore.setCurrentData(data)
CaseDataStore.getCurrentData()
CaseDataStore.subscribe(callback)
CaseDataStore.clearCurrentData()
```

#### Data Structure

```javascript
{
  // Core fields
  caseId: '5008c00000XYZ',
  caseNumber: '12345678',
  subject: 'Case Subject',
  status: 'New',
  priority: 'High',
  
  // Metadata
  lastModified: '2025-01-20T10:30:00Z',
  extractedAt: 1674567890123,
  
  // Customer data
  accountName: 'Customer Name',
  contactEmail: 'email@example.com',
  
  // Server data
  affectedEnvironment: 'PROD-01234',
  serverRegion: 'US-East'
}
```

#### Subscription Pattern

```javascript
// Subscribe to data updates
const unsubscribe = CaseDataStore.subscribe(({ data }) => {
  if (data) {
    // New data available
    this.updateUI(data);
  } else {
    // Data cleared (navigated away)
    this.clearUI();
  }
});

// Unsubscribe when done
unsubscribe();
```

#### Update Pattern

```javascript
// Publish new data
CaseDataStore.setCurrentData(newData);  // Notifies all subscribers
```

**Features**:
- Observer pattern (pub/sub)
- Automatic validation on set
- Immediate notification to new subscribers
- Clear on navigation

---

### 3. CustomerMasterManager

**File**: `modules/customerMasterManager.js`  
**Dependencies**: `customerMasterList.json` (7,212 institution records)  
**Purpose**: Unified customer data and timezone resolution. Single source of truth for customer lookups.

#### Public API

```javascript
// Initialization
CustomerMasterManager.init()

// Customer Lookup
CustomerMasterManager.findByAccountName(accountName)
CustomerMasterManager.findByInstitutionCode(institutionCode, accountName)
CustomerMasterManager.findByServerIds(server, customerId, institutionId)
CustomerMasterManager.findByServer(server)
CustomerMasterManager.getAllCustomers()

// Timezone Resolution
CustomerMasterManager.resolveTimezone(identifiers)
CustomerMasterManager.getCustomerTimezone(identifiers)  // Alias for backwards compatibility

// User Overrides
CustomerMasterManager.storeTimezone(params)
CustomerMasterManager.updateTimezone(params)
CustomerMasterManager.checkUnknownCustomers()
CustomerMasterManager.addUnknownCustomer(customerData)
CustomerMasterManager.promoteUnknownCustomer(customerData)

// Utilities
CustomerMasterManager.getStats()
CustomerMasterManager.getIndexes()
CustomerMasterManager.clearAllUserData()
CustomerMasterManager.cleanup()
```

#### Customer Record

```javascript
{
  sqlName: "University Name (SQL)",
  sfName: "University Name (Salesforce)",
  accountName: "University Name",  // Derived: sfName || sqlName
  customerId: "1234",
  institutionId: "5678",
  server: "ap02",
  region: "ap",
  institutionCode: "61USC",
  accountCode: "61USC_INST",
  city: "Sydney",
  state: "NSW",
  country: "Australia",
  timezone: "Australia/Sydney",
  source: "customerMasterList",  // or "override"
  matchType: "accountName",  // How the record was matched
  matchValue: "UNIVERSITY NAME"  // Key used for matching
}
```

#### Usage

```javascript
// Resolve timezone for a customer
const timezoneInfo = await CustomerMasterManager.resolveTimezone({
  accountName: 'University of Sydney',
  institutionCode: '61UNSW_INST'
});

if (timezoneInfo && timezoneInfo.timezone) {
  console.log('Timezone:', timezoneInfo.timezone);
  console.log('Source:', timezoneInfo.source);
}

// Find customer by institution code
const customer = CustomerMasterManager.findByInstitutionCode('61USC');
if (customer) {
  console.log('Server:', customer.server);
  console.log('Region:', customer.region);
}

// Store user override
await CustomerMasterManager.storeTimezone({
  accountName: 'Custom Customer',
  timezone: 'America/New_York',
  source: 'manual'
});
```

**Features**:
- 7,212 institution records with pre-resolved timezones
- Multiple lookup indexes: byAccountName, byInstitutionCode, byAccountCode, byServerIds
- User overrides stored in chrome.storage.local
- Server and region data for URL generation
- Unknown customer tracking for review

---

### 4. TimezoneStorage

**File**: `modules/timezoneStorage.js`  
**Dependencies**: `CustomerMasterManager`  
**Purpose**: Simplified timezone storage and retrieval

#### Public API

```javascript
TimezoneStorage.getTimezone(identifiers)
TimezoneStorage.storeTimezone(params)
TimezoneStorage.checkUnknownCustomers()
```

#### Usage

```javascript
// Get timezone
const result = await TimezoneStorage.getTimezone({
  accountName: 'Customer Name'
});

if (result) {
  console.log('Timezone:', result.timezone);
  console.log('Source:', result.source); // 'cached' or 'detected'
}

// Store timezone
await TimezoneStorage.storeTimezone({
  accountName: 'Customer Name',
  timezone: 'America/New_York',
  address: { city: 'NYC', state: 'NY', country: 'USA' },
  source: 'manual'
});

// Check for unknown customers
const unknowns = await TimezoneStorage.checkUnknownCustomers();
if (unknowns.count > 0) {
  // Prompt user to add timezones
}
```

---

## Data Extraction Layer

### 1. CasePageDataExtractor

**File**: `modules/casePageDataExtractor.js`  
**Dependencies**: `CaseContextWatcher`, `PageContextValidator`, `CaseDomUtils`  
**Purpose**: Extract case data from Salesforce DOM

#### Public API

```javascript
CasePageDataExtractor.init()
CasePageDataExtractor.extractAllCaseData()
CasePageDataExtractor.extractNow(force)
CasePageDataExtractor.getLastExtractedData()
```

#### Extraction Flow

```
1. Validate page context (case ID + case number)
2. Check if already extracted (avoid duplicates)
3. Extract all fields from DOM
4. Validate critical fields
5. Emit event: 'casePageDataExtracted'
6. Store in CaseDataStore
```

#### Field Extraction

```javascript
// Extract specific field
const caseNumber = CaseDomUtils.extractFieldValue('Case Number');

// Extract all fields
const data = await CasePageDataExtractor.extractAllCaseData();
// Returns:
{
  caseId: '5008c...',
  caseNumber: '12345678',
  subject: '...',
  status: '...',
  priority: '...',
  // ... 30+ fields
}
```

#### Manual Extraction

```javascript
// Force re-extraction
const data = await CasePageDataExtractor.extractNow(true);
```

**Features**:
- Validates context before extraction
- Prevents duplicate extractions
- Emits custom event on completion
- Updates CaseDataStore automatically

---

### 2. CaseDataExtractor (Legacy)

**File**: `modules/caseDataExtractor.js`  
**Dependencies**: `CaseDomUtils`  
**Purpose**: Legacy extractor (being replaced by CasePageDataExtractor)

**Status**: DEPRECATED - Use `CasePageDataExtractor` instead

---

### 3. CaseCommentExtractor

**File**: `modules/caseCommentExtractor.js`  
**Dependencies**: `CaseDomUtils`, `ShadowTextExtractor`  
**Purpose**: Extract comments from case feed

#### Public API

```javascript
CaseCommentExtractor.extractComments()
CaseCommentExtractor.extractLatestComment()
CaseCommentExtractor.getCommentCount()
```

#### Comment Object

```javascript
{
  id: 'comment-id',
  author: 'John Doe',
  body: 'Comment text',
  timestamp: '2025-01-20T10:30:00Z',
  isInternal: false,
  attachments: []
}
```

#### Usage

```javascript
// Extract all comments
const comments = await CaseCommentExtractor.extractComments();

// Get latest comment only
const latest = await CaseCommentExtractor.extractLatestComment();
```

---

### 4. CaseDetailExtractor

**File**: `modules/caseDetailExtractor.js`  
**Dependencies**: `CasePageDataExtractor`  
**Purpose**: Extract and format complete case details

#### Public API

```javascript
CaseDetailExtractor.extractCaseDetails()
CaseDetailExtractor.formatAsXML(details)
CaseDetailExtractor.formatAsTSV(details)
```

#### Usage

```javascript
// Extract details
const details = await CaseDetailExtractor.extractCaseDetails();

// Export as XML
const xml = CaseDetailExtractor.formatAsXML(details);
console.log(xml);

// Export as TSV (tab-separated values)
const tsv = CaseDetailExtractor.formatAsTSV(details);
```

**Features**:
- Comprehensive field extraction
- Multiple export formats
- Metadata inclusion
- Error handling

---

### 5. AccountAddressExtractor

**File**: `modules/accountAddressExtractor.js`  
**Dependencies**: `CaseDomUtils`, `MutationObserver`  
**Purpose**: Extract address from account hover panels

#### Public API

```javascript
AccountAddressExtractor.init()
AccountAddressExtractor.observeHoverPanels()
```

#### Address Object

```javascript
{
  street: '123 Main St',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'USA'
}
```

#### How It Works

1. Observes DOM for hover panels
2. Detects account name hover
3. Extracts address from panel
4. Emits event: `accountAddressExtracted`
5. Resolves timezone via `AddressTimezoneResolver`

**Features**:
- Automatic hover detection
- Shadow DOM support
- Address parsing and normalization
- Timezone resolution integration

---

### 6. ShadowTextExtractor

**File**: `modules/shadowTextExtractor.js`  
**Dependencies**: None  
**Purpose**: Extract text from Shadow DOM trees

#### Public API

```javascript
ShadowTextExtractor.extractAllText(options)
ShadowTextExtractor.extractFromSelector(selector, options)
```

#### Options

```javascript
{
  root: document.body,
  maxNodes: 10000,
  includeHidden: false,
  abortSignal: signal  // AbortController signal
}
```

#### Usage

```javascript
// Extract all text from page
const result = ShadowTextExtractor.extractAllText();
console.log('Text:', result.text);
console.log('Stats:', result.stats);

// Extract from specific element
const result = ShadowTextExtractor.extractFromSelector(
  'records-record-layout-item[field-label="Subject"]'
);
```

**Features**:
- Recursive shadow root traversal
- Open shadow roots only
- Unicode support
- Performance monitoring
- Abort support

---

### 7. Highlighter (Legacy)

**File**: `modules/highlighter.js`  
**Purpose**: Legacy highlighting module for Clarivate domain

**Status**: Still in use for Clarivate SFDC only

---

### 8. CaseCommentMemory

**File**: `modules/caseCommentMemory.js`  
**Dependencies**: `CaseContextWatcher`, `chrome.storage.local`  
**Purpose**: Remember last comment position

#### Public API

```javascript
CaseCommentMemory.init()
CaseCommentMemory.savePosition(caseId, position)
CaseCommentMemory.getPosition(caseId)
CaseCommentMemory.clearPosition(caseId)
```

---

### 9. BookmarkManager

**File**: `modules/bookmarkManager.js`  
**Dependencies**: None  
**Purpose**: Manage case bookmarks

#### Public API

```javascript
BookmarkManager.addBookmark(caseId, caseNumber)
BookmarkManager.removeBookmark(caseId)
BookmarkManager.getAllBookmarks()
BookmarkManager.isBookmarked(caseId)
```

---

## Business Logic Layer

### 1. TimezoneConverter

**File**: `modules/timezoneConverter.js`  
**Dependencies**: `Intl.DateTimeFormat`  
**Purpose**: Convert dates between timezones with formatting

#### Public API

```javascript
TimezoneConverter.convertTime(date, fromTz, toTz)
TimezoneConverter.formatTimeForTimezone(date, timezone, options)
TimezoneConverter.formatDateForTimezone(date, timezone)
TimezoneConverter.getTimezoneAbbreviation(timezone, date)
TimezoneConverter.getTimezoneDisplayName(timezone)
TimezoneConverter.getTimezoneOffset(timezone, date)
TimezoneConverter.parseSalesforceDate(dateString)
TimezoneConverter.resolveCaseTimezone(caseData)
TimezoneConverter.resolveUserTimezone()
TimezoneConverter.convertToAllTimezones(date, caseTz, userTz)
```

#### Usage Examples

```javascript
// Convert time between timezones
const nyTime = TimezoneConverter.convertTime(
  new Date(),
  'America/Los_Angeles',
  'America/New_York'
);

// Format for display
const formatted = TimezoneConverter.formatTimeForTimezone(
  new Date(),
  'Asia/Kuala_Lumpur',
  { timeStyle: 'short' }
);

// Get timezone abbreviation
const abbr = TimezoneConverter.getTimezoneAbbreviation(
  'Asia/Kuala_Lumpur',
  new Date()
);  // Returns "MYT" or "GMT+8"

// Parse Salesforce date
const date = TimezoneConverter.parseSalesforceDate('1/20/2025, 10:30 AM');

// Resolve case timezone
const result = await TimezoneConverter.resolveCaseTimezone(caseData);
// Returns: { timezone: 'America/New_York', source: 'cached', confidence: 'high' }

// Convert to all relevant timezones
const allTimes = TimezoneConverter.convertToAllTimezones(
  new Date(),
  'America/New_York',  // Case timezone
  'Asia/Kuala_Lumpur'  // User timezone
);
// Returns: { case: Date, user: Date, utc: Date }
```

**Features**:
- Uses native `Intl.DateTimeFormat` (no libraries)
- Automatic DST handling
- Timezone abbreviation support
- Multiple format options
- Salesforce date parsing

---

### 2. CaseTimezoneResolver

**File**: `modules/caseTimezoneResolver.js`  
**Dependencies**: `FlexipagePanelInjector`, `TimezoneStorage`, `AccountAddressExtractor`  
**Purpose**: Resolve and display case timezone

#### Public API

```javascript
CaseTimezoneResolver.init()
CaseTimezoneResolver.cleanup()
```

#### Workflow

```
1. Wait for panel injection
2. Extract account name
3. Check timezone cache
   ├─ Cache Hit: Display timezone
   └─ Cache Miss: Setup hover detection
4. On hover: Extract address → Resolve timezone
5. Prompt user to save timezone
```

#### UI Elements

```
┌──────────────────────────────────────┐
│ [🌍 ?] Hover over account name       │  Cache miss
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ [🌍 America/New_York] Customer TZ    │  Cache hit
└──────────────────────────────────────┘
```

**Features**:
- Automatic timezone detection
- Hover-triggered resolution
- Cache integration
- User prompts for unknown customers

---

### 3. AddressTimezoneResolver

**File**: `modules/addressTimezoneResolver.js`  
**Dependencies**: `instTimezones.dsv` (data file)  
**Purpose**: Resolve timezone from address

#### Public API

```javascript
AddressTimezoneResolver.resolveTimezone(address)
AddressTimezoneResolver.getTimezoneByState(stateCode)
AddressTimezoneResolver.getTimezoneByCountry(country)
AddressTimezoneResolver.isValidTimezone(timezone)
```

#### Resolution Strategy

1. **State/Province** (most accurate)
   - US states → timezone
   - Canadian provinces → timezone
   
2. **Country** (fallback)
   - Country code → default timezone
   
3. **Multiple Timezones**
   - Returns most populous timezone for country

#### Usage

```javascript
const address = {
  city: 'New York',
  state: 'NY',
  country: 'USA'
};

const timezone = await AddressTimezoneResolver.resolveTimezone(address);
// Returns: 'America/New_York'
```

**Data Source**: `instTimezones.dsv` - Institution timezone mappings

---

### 4. URLBuilder

**File**: `modules/urlBuilder.js`  
**Dependencies**: None  
**Purpose**: Build external URLs from case data

#### Public API

```javascript
URLBuilder.buildLiveViewURL(caseData)
URLBuilder.buildBackOfficeURL(caseData)
URLBuilder.buildSandboxURLs(caseData)
URLBuilder.getKibanaURL(caseData)
URLBuilder.buildCustomerJiraURL(caseData)
URLBuilder.getNextAnalyticsRefresh(serverRegion, userTimezone)
```

#### Usage

```javascript
const liveViewURL = URLBuilder.buildLiveViewURL({
  affectedEnvironment: 'PROD-01234'
});
// Returns: 'https://liveview.example.com/server/PROD-01234'

const sandboxURLs = URLBuilder.buildSandboxURLs(caseData);
// Returns: [
//   { label: 'Sandbox 1', url: '...' },
//   { label: 'Sandbox 2', url: '...' }
// ]

const refreshInfo = URLBuilder.getNextAnalyticsRefresh('US-East', 'Asia/Kuala_Lumpur');
// Returns: {
//   nextRefresh: Date,
//   timeUntil: '2h 30m',
//   userTime: '10:30 AM MYT',
//   serverTime: '9:30 PM EST'
// }
```

---

### 5. TextFormatter

**File**: `modules/textFormatter.js`  
**Dependencies**: None  
**Purpose**: Text formatting (Unicode styles, symbols)

#### Public API

```javascript
TextFormatter.convertToStyle(text, style)
TextFormatter.convertToNormal(text)
TextFormatter.detectStyle(text)
TextFormatter.toggleCase(text)
TextFormatter.toCapitalCase(text)
TextFormatter.toSentenceCase(text)
TextFormatter.toLowerCase(text)
TextFormatter.getAvailableStyles()
TextFormatter.getAvailableSymbols()
```

#### Styles

- `bold` → 𝗕𝗼𝗹𝗱
- `italic` → 𝘐𝘵𝘢𝘭𝘪𝘤
- `monospace` → 𝙼𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎
- `fraktur` → 𝔉𝔯𝔞𝔨𝔱𝔲𝔯
- `script` → 𝒮𝒸𝓇𝒾𝓅𝓉

#### Usage

```javascript
const bold = TextFormatter.convertToStyle('Hello', 'bold');
// Returns: '𝗛𝗲𝗹𝗹𝗼'

const normal = TextFormatter.convertToNormal('𝗛𝗲𝗹𝗹𝗼');
// Returns: 'Hello'

const style = TextFormatter.detectStyle('𝗛𝗲𝗹𝗹𝗼');
// Returns: 'bold'
```

**Features**:
- Unicode character transformation
- Proper multi-byte handling with `Array.from()`
- Preserves non-alphabetic characters
- Supports multiple styles

---

### 6. TimezoneDetector

**File**: `modules/timezoneDetector.js`  
**Dependencies**: `Intl`  
**Purpose**: Detect user's browser timezone

#### Public API

```javascript
TimezoneDetector.detect()
TimezoneDetector.getFormattedTimezone()
TimezoneDetector.getCurrentTime()
TimezoneDetector.clearCache()
```

#### Usage

```javascript
const detected = TimezoneDetector.detect();
// Returns: {
//   timezone: 'Asia/Kuala_Lumpur',
//   locale: 'en-US',
//   offset: '+08:00'
// }

const formatted = TimezoneDetector.getFormattedTimezone();
// Returns: 'Asia/Kuala_Lumpur (GMT+8)'

const time = TimezoneDetector.getCurrentTime();
// Returns: '10:30 AM MYT'
```

---

### 7. TimezoneUtils

**File**: `modules/timezoneUtils.js`  
**Dependencies**: `UserPreferences`  
**Purpose**: Timezone calculation utilities

#### Public API

```javascript
TimezoneUtils.init(preferences)
TimezoneUtils.convertToShiftTimezone(date, timezone)
TimezoneUtils.createShiftTimezoneDate(year, month, day, hours, minutes, seconds)
TimezoneUtils.calculateWorkingMinutes(startDate, endDate, customWorkingHours)
```

#### Working Hours Calculation

```javascript
const minutes = TimezoneUtils.calculateWorkingMinutes(
  '2025-01-20 09:00',
  '2025-01-22 17:00',
  {
    startHour: 9,
    endHour: 17,
    workingDays: [1, 2, 3, 4, 5]  // Mon-Fri
  }
);
// Returns: Number of working minutes between dates
```

---

### 8. InstitutionTimezoneManager

**File**: `modules/institutionTimezoneManager.js`  
**Dependencies**: `instTimezones.dsv`  
**Purpose**: Manage institution timezone mappings

#### Public API

```javascript
InstitutionTimezoneManager.init()
InstitutionTimezoneManager.getTimezoneByInstitution(name)
InstitutionTimezoneManager.searchInstitutions(query)
```

---

## Presentation Layer

### 1. PersistentBanner

**File**: `modules/persistentBanner.js`  
**Dependencies**: `CaseDataStore`, `URLBuilder`, `TimezoneConverter`  
**Purpose**: Top banner with case info and quick links

#### Public API

```javascript
PersistentBanner.init()
PersistentBanner.show()
PersistentBanner.hide()
```

#### Banner Content

```
┌─────────────────────────────────────────────────────────────┐
│ Case 12345678 | PROD-01234 | Customer: Example Corp        │
│ [Live View] [Back Office] [Kibana] [Customer JIRA]          │
│ Next Refresh: 2h 30m (10:30 AM MYT)                         │
└─────────────────────────────────────────────────────────────┘
```

#### Features

- Auto-hides on non-case pages
- Responsive to case data changes
- Salesforce layout adjustments
- Sticky positioning
- Settings toggle

---

### 2. DynamicMenu

**File**: `modules/dynamicMenu.js`  
**Dependencies**: `CaseDataStore`, `URLBuilder`, `TimezoneConverter`, `SettingsManager`  
**Purpose**: Inject menu buttons into case page

#### Public API

```javascript
DynamicMenu.setSettings(settings)
DynamicMenu.injectMenu(buttonGroups, caseData)
DynamicMenu.injectIntoCardActions(buttonGroups, caseData)
DynamicMenu.injectIntoHeaderDetails(buttonGroups, caseData)
```

#### Button Groups

```javascript
const buttonGroups = {
  production: [
    { label: 'Live View', url: '...', style: 'primary' },
    { label: 'Back Office', url: '...', style: 'secondary' }
  ],
  sandbox: [
    { label: 'Sandbox 1', url: '...' },
    { label: 'Sandbox 2', url: '...' }
  ]
};
```

#### Injection Locations

1. **Top** (Header Details Row)
   - Above case fields
   - High visibility

2. **Bottom** (Card Actions)
   - Below case fields
   - Standard Salesforce location

**Settings**:
- `menuLocation`: 'top' | 'bottom' | 'both'
- `labelStyle`: 'bold' | 'pill'

---

### 3. FlexipagePanelInjector

**File**: `modules/flexipagePanelInjector.js`  
**Dependencies**: `CaseDomUtils`  
**Purpose**: Inject custom panel into case header

#### Public API

```javascript
FlexipagePanelInjector.ensureInjected()
FlexipagePanelInjector.findFlexipageHeader()
FlexipagePanelInjector.createPanel()
```

#### Panel Structure

```
┌─────────────────────────────────────┐
│ [Slot 1: Timezone Info]             │
│ [Slot 2: Analytics Refresh]         │
└─────────────────────────────────────┘
```

#### Slot API

```javascript
// Get slot element
const slot1 = document.getElementById('exl-injected-panel-slot1');
const slot2 = document.getElementById('exl-injected-panel-slot2');

// Inject content into slot
slot1.appendChild(myElement);
```

**Features**:
- Idempotent injection
- Shadow DOM compatible
- Visibility checks
- Forced UI refresh

---

### 4. FieldHighlighter

**File**: `modules/fieldHighlighter.js`  
**Dependencies**: `CaseDomUtils`  
**Purpose**: Highlight empty or important fields

#### Public API

```javascript
FieldHighlighter.init()
FieldHighlighter.highlightField(fieldSelector)
FieldHighlighter.removeHighlight(fieldSelector)
FieldHighlighter.highlightAllFields()
FieldHighlighter.removeAllHighlights()
FieldHighlighter.cleanup()
```

#### Field Configuration

```javascript
const fields = [
  {
    label: 'Subject',
    color: '#ffeb3b',  // Yellow
    condition: 'empty'
  },
  {
    label: 'Priority',
    color: '#f44336',  // Red
    condition: 'value',
    value: 'High'
  }
];
```

#### Usage

```javascript
// Highlight specific field
FieldHighlighter.highlightField({
  label: 'Subject',
  color: '#ffeb3b'
});

// Highlight all configured fields
FieldHighlighter.highlightAllFields();

// Remove all highlights
FieldHighlighter.removeAllHighlights();
```

**Features**:
- Conditional highlighting
- Custom colors
- Label styling
- Auto-cleanup on navigation

---

### 5. CharacterCounter

**File**: `modules/characterCounter.js`  
**Dependencies**: `CaseDomUtils`  
**Purpose**: Show character count in comment textarea

#### Public API

```javascript
CharacterCounter.init()
CharacterCounter.addCounter()
CharacterCounter.remove()
```

#### Display

```
┌────────────────────────────────────┐
│ Comment textarea                   │
│                                    │
└────────────────────────────────────┘
Characters: 150
```

**Features**:
- Real-time character count
- Updates on input
- Auto-removal on navigation

---

### 6. ConfigurationWarningBanner

**File**: `modules/configurationWarningBanner.js`  
**Dependencies**: `SettingsManager`  
**Purpose**: Warn user about missing configuration

#### Public API

```javascript
ConfigurationWarningBanner.init()
ConfigurationWarningBanner.show()
ConfigurationWarningBanner.hide()
ConfigurationWarningBanner.dismiss()
```

#### Display

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Extension not configured                     │
│ Please set your timezone in extension settings  │
│ [Dismiss] [Open Settings]                       │
└─────────────────────────────────────────────────┘
```

---

### 7. UnknownCustomerManager

**File**: `modules/unknownCustomerManager.js`  
**Dependencies**: `TimezoneStorage`, `CustomerMasterManager`, `AccountAddressExtractor`  
**Purpose**: Manage unknown customer timezone prompts

#### Public API

```javascript
UnknownCustomerManager.init()
UnknownCustomerManager.checkPendingReviews()
UnknownCustomerManager.promptUserToAddCustomer(customerData)
```

#### Workflow

```
1. Detect unknown customer (no timezone in cache)
2. Extract address via hover
3. Attempt auto-resolution
4. Prompt user to confirm/edit
5. Save to customer database
```

---

### 8. KeyboardShortcuts

**File**: `modules/keyboardShortcuts.js`  
**Dependencies**: `SettingsManager`  
**Purpose**: Handle keyboard shortcuts

#### Public API

```javascript
KeyboardShortcuts.init(settings)
KeyboardShortcuts.attachListeners()
KeyboardShortcuts.cleanup()
```

#### Default Shortcuts

- `Ctrl+Shift+C` - Copy case number
- `Ctrl+Shift+D` - Copy case details
- `Ctrl+Shift+L` - Open Live View
- `Ctrl+Shift+B` - Open Back Office

---

### 9. ContextMenuHandler

**File**: `modules/contextMenuHandler.js`  
**Dependencies**: `TextFormatter`, `chrome.runtime`  
**Purpose**: Handle right-click context menu

#### Public API

```javascript
ContextMenuHandler.init()
ContextMenuHandler.applyFormatting(formatType)
ContextMenuHandler.insertSymbol(symbol)
ContextMenuHandler.cleanup()
```

---

### 10. MultiTabSync

**File**: `modules/multiTabSync.js`  
**Dependencies**: `BroadcastChannel`, `chrome.storage`  
**Purpose**: Synchronize state across tabs

#### Public API

```javascript
MultiTabSync.init()
MultiTabSync.cleanup()
```

---

### 11. ScrollController

**File**: `modules/scrollController.js`  
**Dependencies**: None  
**Purpose**: Advanced scrolling utilities

#### Public API

```javascript
ScrollController.toBottom(options)
ScrollController.toTop(smooth)
ScrollController.scrollIntoView(target, options)
ScrollController.ensureFullPageLoad()
```

---

### 12. EventSimulator

**File**: `modules/eventSimulator.js`  
**Dependencies**: None  
**Purpose**: Simulate user interactions

#### Public API

```javascript
EventSimulator.click(target, options)
EventSimulator.activateTabByLabel(labelText)
EventSimulator.input(target, value)
EventSimulator.focus(target)
```

---

### 13. StickyNotes

**File**: `modules/stickyNotes.js`  
**Dependencies**: `chrome.storage.local`  
**Purpose**: Case-specific sticky notes

#### Public API

```javascript
StickyNotes.init()
StickyNotes.addNote(caseId, note)
StickyNotes.getNotes(caseId)
StickyNotes.deleteNote(caseId, noteId)
```

---

## Module Initialization Guide

### Standard Initialization Flow

```javascript
// content_script_exlibris.js
(async function() {
  'use strict';

  // 1. Infrastructure
  Logger.init({ debugMode: false });
  await SettingsManager.init();
  await CustomerMasterManager.init();

  // 2. Watchers
  CaseContextWatcher.init();
  CaseDataStore.init();
  NavigationObserver.start();

  // 3. Data extraction
  CasePageDataExtractor.init();

  // 4. Features (on case page)
  await initializeCasePageFeatures();

  // 5. UI Components
  PersistentBanner.init();
  DynamicMenu.setSettings(await SettingsManager.getAll());

  // 6. Page monitoring
  PageIdentifier.monitorPageChanges(handlePageChange);
})();
```

### Feature Initialization (Case Page Only)

```javascript
async function initializeCasePageFeatures() {
  // Wait for panel injection
  await FlexipagePanelInjector.ensureInjected();

  // Initialize timezone features
  await CaseTimezoneResolver.init();
  await UnknownCustomerManager.init();

  // Initialize UI features
  FieldHighlighter.init();
  CharacterCounter.init();
  KeyboardShortcuts.init(await SettingsManager.getAll());

  // Initialize extraction features
  AccountAddressExtractor.init();
  CaseCommentMemory.init();
}
```

---

## Cross-Module Communication

### Event-Based Communication

```javascript
// Module A: Emit event
document.dispatchEvent(new CustomEvent('casePageDataExtracted', {
  detail: { caseData },
  bubbles: true,
  composed: true
}));

// Module B: Listen for event
document.addEventListener('casePageDataExtracted', (event) => {
  const { caseData } = event.detail;
  this.handleCaseData(caseData);
});
```

### Storage-Based Communication

```javascript
// Module A: Update storage
await chrome.storage.local.set({ currentCase: caseData });

// Module B: Listen for changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.currentCase) {
    const newData = changes.currentCase.newValue;
    this.handleCaseDataUpdate(newData);
  }
});
```

### Observer Pattern (Preferred)

```javascript
// Module A: Subscribe to CaseDataStore
const unsubscribe = CaseDataStore.subscribe(({ data }) => {
  if (data) {
    this.updateUI(data);
  }
});

// Module B: Publish update
CaseDataStore.setCurrentData(newData);  // Notifies all subscribers
```

---

## Next Steps

- **For data flow details**: See [04-data-flow.md](./04-data-flow.md)
- **For state management**: See [05-state-management.md](./05-state-management.md)
- **For architecture**: See [02-architecture-and-design.md](./02-architecture-and-design.md)

---

**[← Back: Architecture](./02-architecture-and-design.md)** | **[↑ Main Documentation](./explanation.md)** | **[Next: Data Flow →](./04-data-flow.md)**
