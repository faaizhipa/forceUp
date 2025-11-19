# Functions Documentation

This document provides a comprehensive catalog of all functions across all modules in the codebase.

## Summary Table

| Module | Function | Purpose | Parameters | Returns | Complexity |
|--------|----------|---------|------------|---------|------------|
| Logger | `init` | Initialize logger with settings | `settings: Object` | `void` | Low |
| Logger | `info` | Log informational message | `msg: string, ...args: any` | `void` | Low |
| Logger | `warn` | Log warning message | `msg: string, ...args: any` | `void` | Low |
| Logger | `error` | Log error message | `msg: string, ...args: any` | `void` | Low |
| Logger | `debug` | Log debug message (if enabled) | `msg: string, ...args: any` | `void` | Low |
| Logger | `perf` | Measure performance of function | `label: string, fn: Function` | `*` | Medium |
| Logger | `perfAsync` | Measure performance of async function | `label: string, fn: Function` | `Promise<*>` | Medium |
| DebounceUtils | `debounce` | Create debounced function | `func: Function, wait: number, immediate: boolean` | `Function` | Medium |
| DebounceUtils | `throttle` | Create throttled function | `func: Function, wait: number` | `Function` | Medium |
| DebounceUtils | `once` | Create function that executes once | `func: Function` | `Function` | Low |
| DebounceUtils | `waitUntil` | Wait until condition is met | `condition: Function, callback: Function, checkInterval: number, maxWait: number` | `Promise` | Medium |
| DebounceUtils | `rateLimit` | Rate limit function calls | `func: Function, delay: number` | `Function` | Medium |
| NavigationObserver | `start` | Start observing navigation changes | `void` | `void` | High |
| NavigationObserver | `checkUrlChange` | Check if URL has changed | `void` | `void` | Medium |
| NavigationObserver | `triggerCallbacks` | Trigger all registered callbacks | `void` | `void` | Low |
| NavigationObserver | `onRouteChange` | Register callback for route changes | `callback: Function` | `void` | Low |
| NavigationObserver | `offRouteChange` | Remove callback | `callback: Function` | `void` | Low |
| NavigationObserver | `stop` | Stop observing navigation | `void` | `void` | Medium |
| TextFormatter | `convertToStyle` | Convert text to specified style | `text: string, style: string` | `string` | Medium |
| TextFormatter | `convertToNormal` | Convert formatted text back to normal | `text: string` | `string` | Medium |
| TextFormatter | `detectStyle` | Detect current style of text | `text: string` | `string` | Medium |
| TextFormatter | `toggleCase` | Toggle case while preserving formatting | `text: string` | `string` | Medium |
| TextFormatter | `toCapitalCase` | Convert to Capital Case | `text: string` | `string` | Low |
| TextFormatter | `toSentenceCase` | Convert to Sentence case | `text: string` | `string` | Low |
| TextFormatter | `toLowerCase` | Convert to lowercase | `text: string` | `string` | Low |
| TextFormatter | `getAvailableStyles` | Get all available styles | `void` | `Array<string>` | Low |
| TextFormatter | `getAvailableSymbols` | Get all available symbols | `void` | `Array<string>` | Low |
| ContextMenuHandler | `init` | Initialize context menu handler | `void` | `void` | High |
| ContextMenuHandler | `getMenuIds` | Get menu IDs for background script | `void` | `Object` | Low |
| ContextMenuHandler | `applyFormatting` | Manually apply formatting to selection | `formatType: string` | `void` | Medium |
| ContextMenuHandler | `insertSymbol` | Insert symbol at cursor | `symbol: string` | `void` | Medium |
| ContextMenuHandler | `isAvailable` | Check if context menu is available | `void` | `boolean` | Low |
| ContextMenuHandler | `cleanup` | Clean up the module | `void` | `void` | Low |
| CharacterCounter | `init` | Initialize character counter | `void` | `void` | Medium |
| CharacterCounter | `getTextarea` | Get the textarea element | `void` | `HTMLTextAreaElement\|null` | Low |
| CharacterCounter | `findButtonRow` | Find button row where counter should be placed | `void` | `HTMLElement\|null` | Medium |
| CharacterCounter | `createCounter` | Create counter element | `void` | `HTMLElement` | Low |
| CharacterCounter | `updateCounter` | Update counter display | `counter: HTMLElement, length: number` | `void` | Low |
| CharacterCounter | `addCounter` | Add counter to UI | `void` | `void` | Medium |
| CharacterCounter | `remove` | Remove counter | `void` | `void` | Low |
| MultiTabSync | `init` | Initialize multi-tab sync | `void` | `void` | High |
| MultiTabSync | `cleanup` | Clean up multi-tab sync | `void` | `void` | Medium |
| KeyboardShortcuts | `init` | Initialize keyboard shortcuts | `settings: Object` | `void` | Medium |
| KeyboardShortcuts | `attachListeners` | Attach keyboard event listeners | `void` | `void` | Medium |
| KeyboardShortcuts | `handleKeyDown` | Handle keyboard events | `event: KeyboardEvent` | `void` | Medium |
| KeyboardShortcuts | `getKeyString` | Get key string from event | `event: KeyboardEvent` | `string` | Low |
| KeyboardShortcuts | `shouldHandleShortcut` | Check if shortcut should be handled | `event: KeyboardEvent, shortcut: Object` | `boolean` | Medium |
| KeyboardShortcuts | `executeAction` | Execute shortcut action | `action: string, event: KeyboardEvent` | `void` | Medium |
| ScrollController | `toBottom` | Scroll to bottom incrementally | `options: Object` | `Promise<Object>` | High |
| ScrollController | `toTop` | Scroll to top of page | `smooth: boolean` | `void` | Low |
| ScrollController | `scrollIntoView` | Scroll element into view | `target: string\|Element, options: Object` | `boolean` | Low |
| ScrollController | `ensureFullPageLoad` | Ensure full page is loaded by scrolling | `void` | `Promise<Object>` | High |
| EventSimulator | `isVisible` | Check if element is visible | `element: Element` | `boolean` | Medium |
| EventSimulator | `isEnabled` | Check if element is enabled | `element: Element` | `boolean` | Low |
| EventSimulator | `click` | Simulate click on element | `target: string\|Element, options: Object` | `boolean` | Medium |
| EventSimulator | `activateTabByLabel` | Activate tab by label text | `labelText: string` | `boolean` | Medium |
| EventSimulator | `input` | Dispatch input event | `target: string\|Element, value: string` | `boolean` | Medium |
| EventSimulator | `focus` | Focus element | `target: string\|Element` | `boolean` | Low |
| ShadowTextExtractor | `extractAllText` | Extract all text from Shadow DOM trees | `options: Object` | `Object` | High |
| ShadowTextExtractor | `extractFromSelector` | Extract text from specific selector | `selector: string, options: Object` | `Object` | Medium |
| TimezoneDetector | `detect` | Detect current locale and timezone | `void` | `Object` | Low |
| TimezoneDetector | `getFormattedTimezone` | Get formatted timezone string | `void` | `string` | Medium |
| TimezoneDetector | `getCurrentTime` | Get current time in detected timezone | `void` | `string` | Medium |
| TimezoneDetector | `clearCache` | Clear cache | `void` | `void` | Low |
| ImplementationStatus | `check` | Check implementation status | `void` | `Promise<Object>` | Low |
| ImplementationStatus | `openTool` | Open implementation status tool | `void` | `void` | Low |
| ImplementationStatus | `updateConfig` | Update configuration | `newConfig: Object` | `void` | Low |
| FlexipagePanelInjector | `ensureInjected` | Ensure panel is injected | `void` | `boolean` | High |
| FlexipagePanelInjector | `isElementVisible` | Check if element is visible | `element: Element` | `boolean` | Medium |
| FlexipagePanelInjector | `findFlexipageHeader` | Find flexipage header element | `void` | `Element\|null` | High |
| FlexipagePanelInjector | `createPanel` | Create panel element | `void` | `Element` | High |
| FlexipagePanelInjector | `createSlot1` | Create Slot 1 | `void` | `Element` | Medium |
| FlexipagePanelInjector | `createSlot2` | Create Slot 2 | `void` | `Element` | Low |
| FlexipagePanelInjector | `cacheElements` | Cache frequently used elements | `panel: Element` | `void` | Low |
| FlexipagePanelInjector | `forceUIRefresh` | Force UI refresh | `panel: Element` | `void` | Medium |
| FlexipagePanelInjector | `wireEventHandlers` | Wire event handlers for panel | `panel: Element` | `void` | High |
| PersistentBanner | `init` | Initialize persistent banner | `void` | `Promise<void>` | High |
| PersistentBanner | `isFeatureEnabled` | Check if feature is enabled | `void` | `Promise<boolean>` | Low |
| PersistentBanner | `setupSettingsListener` | Setup listener for settings changes | `void` | `void` | Low |
| PersistentBanner | `show` | Show the banner | `void` | `void` | Low |
| PersistentBanner | `hide` | Hide the banner | `void` | `void` | Low |
| PersistentBanner | `applySalesforceLayoutAdjustments` | Apply/remove layout adjustments | `apply: boolean` | `void` | Medium |
| PersistentBanner | `setupCaseDataListener` | Setup listener for case data events | `void` | `void` | Medium |
| PersistentBanner | `extractServerFromAffectedEnvironment` | Extract server code | `affectedEnvironment: string` | `string\|null` | Low |
| PersistentBanner | `startUrlMonitoring` | Start monitoring URL changes | `void` | `void` | Medium |
| PersistentBanner | `handleUrlChange` | Handle URL change | `newUrl: string` | `void` | High |
| CaseTimezoneResolver | `init` | Initialize timezone resolver | `void` | `Promise<void>` | High |
| CaseTimezoneResolver | `waitForPanel` | Wait for panel to be injected | `maxAttempts: number, delayMs: number` | `Promise<boolean>` | Medium |
| CaseTimezoneResolver | `findTargetElements` | Find target elements | `void` | `boolean` | High |
| CaseTimezoneResolver | `isElementVisible` | Check if element is visible | `element: Element` | `boolean` | Medium |
| CaseTimezoneResolver | `extractAccountName` | Extract account name | `void` | `string\|null` | Medium |
| CaseTimezoneResolver | `checkCachedTimezone` | Check cached timezone | `accountName: string, targetDiv: Element` | `Promise<void>` | Medium |
| CaseTimezoneResolver | `applyCacheMissState` | Apply cache miss state | `void` | `void` | Low |
| CaseTimezoneResolver | `onMouseOver` | Handle mouseover event | `event: Event` | `void` | High |
| CaseTimezoneResolver | `onMouseOut` | Handle mouseout event | `event: Event` | `void` | Medium |
| CaseTimezoneResolver | `cleanup` | Clean up resolver | `void` | `void` | Medium |
| URLBuilder | `buildLiveViewURL` | Build production Live View URL | `caseData: Object` | `string` | Low |
| URLBuilder | `buildBackOfficeURL` | Build production Back Office URL | `caseData: Object` | `string` | Low |
| URLBuilder | `buildSandboxURLs` | Build sandbox URLs | `caseData: Object` | `Array<Object>` | Medium |
| URLBuilder | `getKibanaURL` | Get Kibana URL | `caseData: Object` | `string\|null` | Medium |
| URLBuilder | `buildCustomerJiraURL` | Build customer JIRA URL | `caseData: Object` | `string` | Low |
| URLBuilder | `getNextAnalyticsRefresh` | Get next analytics refresh time | `serverRegion: string, userTimezone: string` | `Object\|null` | High |
| DynamicMenu | `setSettings` | Set injection settings | `settings: Object` | `void` | Low |
| DynamicMenu | `injectMenu` | Inject menu into configured locations | `buttonGroups: Object, caseData: Object` | `Promise<void>` | High |
| DynamicMenu | `injectIntoCardActions` | Inject into card actions | `buttonGroups: Object, caseData: Object` | `Promise<void>` | Medium |
| DynamicMenu | `injectIntoHeaderDetails` | Inject into header details | `buttonGroups: Object, caseData: Object` | `Promise<void>` | High |
| DynamicMenu | `observeHeaderSection` | Observe header section | `headerSlot: Element` | `void` | Medium |
| DynamicMenu | `createMenuContainer` | Create menu container | `location: string` | `HTMLElement` | Low |
| DynamicMenu | `populateMenu` | Populate menu with buttons | `container: HTMLElement, buttonGroups: Object, caseData: Object` | `Promise<void>` | High |
| DynamicMenu | `createTimezoneConverter` | Create timezone converter UI (expandable) | `refreshInfo: Object, caseData: Object` | `Promise<HTMLElement>` | High |
| TimezoneConverter | `convertTime` | Convert date between timezones | `date: Date\|string, fromTimezone: string, toTimezone: string` | `Date\|null` | Medium |
| TimezoneConverter | `formatTimeForTimezone` | Format time for display in timezone | `date: Date, timezone: string, options: Object` | `string` | Medium |
| TimezoneConverter | `formatDateForTimezone` | Format date for timezone | `date: Date, timezone: string` | `string` | Low |
| TimezoneConverter | `getTimezoneAbbreviation` | Get timezone abbreviation (SGT, MYT, etc.) | `timezone: string, date: Date` | `string` | Low |
| TimezoneConverter | `getTimezoneDisplayName` | Get human-readable timezone name | `timezone: string` | `string` | Low |
| TimezoneConverter | `getTimezoneOffset` | Get UTC offset for timezone | `timezone: string, date: Date` | `string` | Medium |
| TimezoneConverter | `getAvailableDates` | Get available dates from case data | `caseData: Object, refreshInfo: Object` | `Array<Object>` | Medium |
| TimezoneConverter | `parseSalesforceDate` | Parse Salesforce date format | `dateString: string` | `Date\|null` | Medium |
| TimezoneConverter | `resolveCaseTimezone` | Resolve case timezone from case data | `caseData: Object` | `Promise<Object>` | High |
| TimezoneConverter | `resolveUserTimezone` | Resolve user timezone from preferences | `void` | `Promise<Object>` | Medium |
| TimezoneConverter | `convertToAllTimezones` | Convert date to Case, User, UTC | `date: Date, caseTimezone: string, userTimezone: string` | `Object` | High |
| FieldHighlighter | `isEmpty` | Check if field value is empty | `element: HTMLElement` | `boolean` | Low |
| FieldHighlighter | `styleLabelElement` | Apply label styling | `label: HTMLElement, backgroundColor: string` | `void` | Low |
| FieldHighlighter | `highlightField` | Apply highlight to field | `fieldSelector: Object` | `void` | Medium |
| FieldHighlighter | `removeHighlight` | Remove highlight from field | `fieldSelector: Object` | `void` | Low |
| FieldHighlighter | `highlightAllFields` | Highlight all configured fields | `void` | `void` | Medium |
| FieldHighlighter | `removeAllHighlights` | Remove all highlights | `void` | `void` | Low |
| FieldHighlighter | `init` | Initialize field highlighting | `void` | `void` | Medium |
| FieldHighlighter | `cleanup` | Clean up the module | `void` | `void` | Low |
| TimezoneUtils | `init` | Initialize timezone utilities | `preferences: Object` | `Promise<void>` | Medium |
| TimezoneUtils | `convertToShiftTimezone` | Convert date to shift timezone | `date: Date, timezone: string` | `Date` | High |
| TimezoneUtils | `createShiftTimezoneDate` | Create date in shift timezone | `year: number, month: number, day: number, hours: number, minutes: number, seconds: number` | `Date` | Medium |
| TimezoneUtils | `calculateWorkingMinutes` | Calculate working minutes | `startDate: Date\|string, endDate: Date\|string, customWorkingHours: Object` | `number` | High |
| TimezoneStorage | `getTimezone` | Get timezone for customer | `identifiers: Object` | `Promise<Object\|null>` | High |
| TimezoneStorage | `storeTimezone` | Store timezone for customer | `params: Object` | `Promise<Object>` | High |
| TimezoneStorage | `checkUnknownCustomers` | Check for unknown customers | `void` | `Promise<Object>` | Medium |
| UserPreferences | `get` | Get user preferences | `void` | `Promise<Object>` | Medium |
| UserPreferences | `save` | Save user preferences | `preferences: Object` | `Promise<void>` | Medium |
| UserPreferences | `getDefaults` | Get default preferences | `void` | `Object` | Low |
| AccountAddressExtractor | `init` | Initialize address extractor | `void` | `void` | Medium |
| AccountAddressExtractor | `observeHoverPanels` | Watch for hover panels | `void` | `void` | Medium |
| AccountAddressExtractor | `handleHoverPanelAppeared` | Handle hover panel appearance | `panel: Element` | `void` | Medium |
| AccountAddressExtractor | `extractAccountNameFromPanel` | Extract account name | `panel: Element` | `string\|null` | Medium |
| AccountAddressExtractor | `extractAddressFromPanel` | Extract address | `panel: Element` | `Object\|null` | High |
| AddressTimezoneResolver | `resolveTimezone` | Resolve timezone from address | `address: Object` | `Promise<string\|null>` | Medium |
| AddressTimezoneResolver | `normalizeStateCode` | Normalize state code | `state: string` | `string` | Medium |
| AddressTimezoneResolver | `getTimezoneByState` | Get timezone by state code | `stateCode: string` | `string\|null` | Low |
| AddressTimezoneResolver | `getTimezoneByCountry` | Get timezone by country | `country: string` | `string\|null` | Low |
| AddressTimezoneResolver | `isValidTimezone` | Check if timezone is valid | `timezone: string` | `boolean` | Low |
| UnknownCustomerManager | `init` | Initialize unknown customer manager | `void` | `void` | Medium |
| UnknownCustomerManager | `checkPendingReviews` | Check for pending reviews | `void` | `Promise<void>` | Medium |
| UnknownCustomerManager | `handleUnknownCustomerDetected` | Handle unknown customer detection | `detail: Object` | `Promise<void>` | Medium |
| UnknownCustomerManager | `promptUserToAddCustomer` | Prompt user to add customer | `customerData: Object` | `void` | Low |
| UnknownCustomerManager | `startCustomerDataCollection` | Start data collection | `customerData: Object` | `Promise<void>` | High |
| CaseDetailExtractor | `extractCaseDetails` | Extract case details | `void` | `Promise<Object>` | High |
| CaseDetailExtractor | `formatAsXML` | Format as XML | `details: Object` | `string` | Medium |
| CaseDetailExtractor | `formatAsTSV` | Format as TSV | `details: Object` | `string` | Medium |
| ConfigurationWarningBanner | `init` | Initialize warning banner | `void` | `Promise<void>` | Medium |
| ConfigurationWarningBanner | `show` | Show banner | `void` | `void` | Low |
| ConfigurationWarningBanner | `hide` | Hide banner | `void` | `void` | Low |
| ConfigurationWarningBanner | `dismiss` | Dismiss banner | `void` | `Promise<void>` | Low |
| CasePageDataExtractor | `init` | Initialize data extractor | `void` | `void` | Medium |
| CasePageDataExtractor | `handlePageChange` | Handle page change events | `pageInfo: Object` | `Promise<void>` | High |
| CasePageDataExtractor | `extractAllCaseData` | Extract all case data fields | `void` | `Promise<Object>` | High |
| CasePageDataExtractor | `getLastModifiedDate` | Get last modified date of case | `void` | `string\|null` | Medium |
| CasePageDataExtractor | `normalizeDate` | Normalize date string for comparison | `dateString: string` | `string\|null` | Low |
| CasePageDataExtractor | `isCacheValid` | Check if cached data is valid | `caseId: string` | `{valid: boolean, reason: string}` | Medium |
| CasePageDataExtractor | `validateCriticalFields` | Validate critical fields haven't changed | `void` | `{valid: boolean, reason: string}` | Medium |
| CasePageDataExtractor | `extractNow` | Manually trigger data extraction | `force: boolean` | `Promise<Object\|null>` | Medium |
| CasePageDataExtractor | `clearCache` | Clear cached data for case | `caseId: string\|null` | `void` | Low |
| CasePageDataExtractor | `getLastExtractedData` | Get last extracted data | `void` | `Object\|null` | Low |

## Detailed Function Documentation

### High Complexity Functions

#### NavigationObserver.start()
**Purpose**: Start observing navigation changes in Salesforce Lightning SPA

**Parameters**: None

**Returns**: `void`

**Details**:
- Intercepts `history.pushState` and `history.replaceState`
- Observes title element changes (Lightning updates title on navigation)
- Listens to `popstate` and `hashchange` events
- Debounces callback triggers to avoid rapid-fire during complex navigations

**Dependencies**: None

**Edge Cases**:
- Handles multiple rapid navigations
- Prevents duplicate observers
- Cleans up on stop()

#### FlexipagePanelInjector.ensureInjected()
**Purpose**: Ensure panel is injected into Salesforce flexipage header (idempotent)

**Parameters**: None

**Returns**: `boolean` - True if injection successful or already present

**Details**:
- Checks if panel already exists before injecting
- Finds flexipage header using multiple fallback strategies
- Handles Shadow DOM and visibility checks
- Wraps panel in slot element for proper encapsulation
- Forces UI refresh to prevent panel from hiding

**Dependencies**: 
- `findFlexipageHeader()`
- `createPanel()`
- `forceUIRefresh()`

**Edge Cases**:
- Header not found (retries with observer)
- Multiple case pages in DOM (only injects into visible one)
- Panel already exists (returns true)

#### CaseTimezoneResolver.init()
**Purpose**: Initialize timezone resolver with account name extraction and caching

**Parameters**: None

**Returns**: `Promise<void>`

**Details**:
- Waits for panel to be injected
- Extracts account name from DOM
- Checks cache for existing timezone
- Sets up hover detection if cache miss

**Dependencies**:
- `FlexipagePanelInjector.ensureInjected()`
- `TimezoneStorage.getTimezone()`

**Edge Cases**:
- Panel not yet injected (waits with retries)
- Account name not found
- Cache hit (skips hover detection)
- Cache miss (sets up hover listeners)

#### ScrollController.toBottom()
**Purpose**: Progressively scroll to bottom with delays to trigger lazy loading

**Parameters**:
- `options.stepPx` (default: 800) - Pixels to scroll per step
- `options.delayMs` (default: 150) - Delay between steps
- `options.maxScrolls` (default: 50) - Maximum iterations

**Returns**: `Promise<Object>` - Stats about scroll operation

**Details**:
- Scrolls incrementally to trigger lazy-loaded content
- Monitors scroll height changes
- Stops when bottom reached or no new content after 3 attempts
- Returns statistics about scroll operation

**Dependencies**: None

**Edge Cases**:
- Content still loading (continues scrolling)
- No new content (stops after 3 attempts)
- Already at bottom (returns immediately)

#### ShadowTextExtractor.extractAllText()
**Purpose**: Recursively extract text from Shadow DOM trees (open roots only)

**Parameters**:
- `options.root` (default: document.body) - Starting element
- `options.maxNodes` (default: 10000) - Maximum nodes to visit
- `options.abortSignal` - Signal to abort operation
- `options.includeHidden` (default: false) - Include hidden elements

**Returns**: `Object` - `{ text: string, stats: Object }`

**Details**:
- Traverses DOM and Shadow DOM recursively
- Skips closed shadow roots
- Handles multi-byte Unicode characters properly
- Tracks statistics about traversal

**Dependencies**: None

**Edge Cases**:
- Closed shadow roots (skipped)
- Max nodes reached (stops with warning)
- Abort signal (throws DOMException)
- Hidden elements (skipped unless includeHidden=true)

### Well-Implemented Functions

#### Logger.perfAsync()
**Example of good async performance measurement**:
- Uses `performance.now()` for accurate timing
- Handles both sync and async functions
- Returns function result unchanged
- Logs with consistent format

#### DebounceUtils.debounce()
**Example of robust utility function**:
- Supports immediate execution option
- Returns cancel function for manual cancellation
- Properly handles context binding
- Clear timeout management

#### TextFormatter.convertToStyle()
**Example of Unicode handling**:
- Properly handles multi-byte characters with `Array.from()`
- Supports multiple style types
- Preserves non-alphabetic characters
- Handles edge cases (empty strings, special characters)

#### EventSimulator.click()
**Example of safe event simulation**:
- Checks visibility before dispatching
- Checks enabled state
- Uses `composed: true` for Shadow DOM
- Returns boolean for success/failure
- Logs warnings for debugging

## Function Patterns

### Initialization Pattern
Most modules follow this pattern:
```javascript
init() {
  if (this.isInitialized) return;
  // Setup code
  this.isInitialized = true;
}
```

### Cleanup Pattern
Modules with observers/timers implement cleanup:
```javascript
cleanup() {
  if (this.observer) {
    this.observer.disconnect();
    this.observer = null;
  }
  // Clear other resources
}
```

### Async Initialization Pattern
Many modules use async initialization:
```javascript
async init() {
  const isEnabled = await this.isFeatureEnabled();
  if (!isEnabled) return;
  // Continue initialization
}
```

### Dependency Checking Pattern
Modules check for dependencies before use:
```javascript
if (typeof DependencyModule !== 'undefined') {
  // Use dependency
} else {
  console.warn('Dependency not available');
}
```

