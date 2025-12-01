# Bugs, Flaws & Gaps Analysis

**Document Version:** 1.0  
**Last Updated:** January 23, 2025  
**Reference:** See also [BEST_PRACTICES.md](../BEST_PRACTICES.md) for anti-patterns

---

## Table of Contents

- [Known Issues](#known-issues)
- [Architectural Gaps](#architectural-gaps)
- [Code Redundancies](#code-redundancies)
- [Inconsistencies](#inconsistencies)
- [Performance Bottlenecks](#performance-bottlenecks)
- [Security Considerations](#security-considerations)
- [Technical Debt](#technical-debt)
- [Recommended Improvements](#recommended-improvements)

---

## Known Issues

### 1. Stale Data Display (PARTIALLY RESOLVED)

**Status**: 🟡 Partially Fixed  
**Severity**: HIGH  
**Affected Modules**: PersistentBanner, DynamicMenu, FlexipagePanelInjector

**Problem**:
Modules may display data from Case A when user has navigated to Case B, resulting in mixed/incorrect information being shown.

**Root Cause**:
- Event listeners receive `casePageDataExtracted` event without re-validating page context
- Async operations complete after navigation has occurred
- No periodic validation of displayed data

**Current Mitigations**:
- ✅ PageContextValidator validates before display
- ✅ PersistentBanner implements periodic validation (every 2s)
- ✅ CaseDetailExtractor validates cached data before use

**Remaining Gaps**:
- ❌ DynamicMenu doesn't re-validate on display
- ❌ FlexipagePanelInjector doesn't validate data before injection
- ❌ No global mechanism to clear stale UI on navigation

**Reproduction Steps**:
1. Navigate to Case A (12345678)
2. Wait for data extraction to complete
3. Quickly navigate to Case B (87654321)
4. If Case B title hasn't updated yet, validation may fail
5. Modules may briefly show Case A data on Case B page

**Workaround**:
User can refresh the page to clear stale data.

**Recommended Fix**:
```javascript
// 1. All modules should validate before display
async displayCaseData(data) {
  const validation = PageContextValidator.validatePageContextBeforeDisplay(
    data.caseId,
    data.caseNumber
  );
  
  if (!validation.valid) {
    this.clearDisplay();
    return false;
  }
  
  this.updateUI(data);
  return true;
}

// 2. Implement periodic validation (every 2 seconds)
startPeriodicValidation() {
  this.validationInterval = setInterval(() => {
    if (!this.displayedCaseId) return;
    
    const validation = PageContextValidator.validatePageContextBeforeDisplay(
      this.displayedCaseId,
      this.displayedCaseNumber
    );
    
    if (!validation.valid) {
      this.clearDisplay();
    }
  }, 2000);
}

// 3. Clear display on navigation away
NavigationObserver.onRouteChange(() => {
  if (!PageIdentifier.isCasePage()) {
    this.clearDisplay();
  }
});
```

---

### 2. Title Update Race Condition

**Status**: 🔴 Active Issue  
**Severity**: MEDIUM  
**Affected Modules**: PageContextValidator, CasePageDataExtractor

**Problem**:
Salesforce Lightning updates `document.title` asynchronously after URL changes. During this window (~200-500ms), validation may fail because:
- URL shows Case B ID
- Title still shows Case A number

**Root Cause**:
Lightning is a SPA framework that updates the DOM (including title) after route changes, not atomically.

**Current Mitigation**:
✅ `waitForTitleUpdate()` polls `document.title` for up to 2 seconds

**Remaining Gap**:
- Polling is inefficient
- 2-second timeout may be too short/long depending on network
- No way to detect when title update is "complete"

**Recommended Fix**:
```javascript
// Use MutationObserver on <title> element
function observeTitleUpdate(expectedCaseNumber, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const titleElement = document.querySelector('title');
    
    const observer = new MutationObserver(() => {
      const title = document.title;
      if (title.includes(expectedCaseNumber)) {
        observer.disconnect();
        resolve(title);
      }
    });
    
    observer.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
    
    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      reject(new Error('Title update timeout'));
    }, timeout);
  });
}
```

---

### 3. Cache Invalidation Gaps (PARTIALLY RESOLVED)

**Status**: 🟡 Partially Fixed  
**Severity**: MEDIUM  
**Affected Modules**: CasePageDataExtractor, CustomerMasterManager

**Problem**:
Legacy cache layer has been removed, but there's no persistence mechanism. All data is re-extracted on every navigation.

**Current State**:
- ✅ No stale cache issues (cache removed)
- ❌ Redundant extraction on every navigation
- ❌ No TTL or signature-based validation
- ⏳ CaseDataStore will handle this in future

**Future Fix**:
CaseDataStore will implement:
- Signature-based validation (case ID + case number + last modified)
- TTL (5-minute cache lifetime)
- Field-level change detection
- Lock-based updates (prevent race conditions)

---

### 4. Shadow DOM Traversal Performance

**Status**: 🟡 Active Issue  
**Severity**: LOW  
**Affected Modules**: ShadowTextExtractor, CaseDomUtils

**Problem**:
Recursive shadow DOM traversal can be slow on complex Lightning pages with deeply nested shadow roots.

**Metrics**:
- Simple page: ~50ms
- Complex page: ~500ms
- Very complex page: ~2000ms (2 seconds!)

**Root Cause**:
- No caching of traversed shadow roots
- Traverses entire DOM tree every time
- No early termination when target found deep in tree

**Recommended Fix**:
```javascript
// 1. Cache shadow roots
const shadowRootCache = new WeakMap();

function getCachedShadowRoot(element) {
  if (shadowRootCache.has(element)) {
    return shadowRootCache.get(element);
  }
  
  const shadowRoot = element.shadowRoot;
  if (shadowRoot && shadowRoot.mode === 'open') {
    shadowRootCache.set(element, shadowRoot);
  }
  
  return shadowRoot;
}

// 2. Implement early termination
function queryShadowDOM(selector, root = document.body, maxDepth = 10) {
  if (maxDepth === 0) return null;
  
  // Try direct query first
  let element = root.querySelector(selector);
  if (element) return element;
  
  // Traverse shadow roots (breadth-first, not depth-first)
  const queue = [{ node: root, depth: 0 }];
  
  while (queue.length > 0) {
    const { node, depth } = queue.shift();
    
    if (depth >= maxDepth) continue;
    
    const shadowRoot = getCachedShadowRoot(node);
    if (shadowRoot) {
      const found = shadowRoot.querySelector(selector);
      if (found) return found;
      
      // Add shadow children to queue
      for (const child of shadowRoot.children) {
        queue.push({ node: child, depth: depth + 1 });
      }
    }
    
    // Add regular children to queue
    for (const child of node.children) {
      queue.push({ node: child, depth: depth + 1 });
    }
  }
  
  return null;
}
```

---

### 5. No Error Recovery for Failed Extractions

**Status**: 🔴 Active Issue  
**Severity**: MEDIUM  
**Affected Modules**: CasePageDataExtractor

**Problem**:
If extraction fails (e.g., DOM structure changed), there's no retry mechanism or partial data fallback.

**Current Behavior**:
- Extraction fails → No data emitted
- User sees loading state indefinitely
- No way to manually retry

**Recommended Fix**:
```javascript
async extractWithRetry(maxRetries = 3, backoffMs = 1000) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await this.extractAllCaseData();
      
      // Validate extracted data
      if (this.isValidData(data)) {
        return data;
      }
      
      console.warn(`[Attempt ${attempt}] Invalid data extracted`);
      
    } catch (error) {
      lastError = error;
      console.error(`[Attempt ${attempt}] Extraction failed:`, error);
    }
    
    // Exponential backoff
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, backoffMs * attempt));
    }
  }
  
  // All retries failed - return partial data
  console.error('Extraction failed after retries, returning partial data');
  return this.extractPartialData();
}

extractPartialData() {
  // At minimum, extract case ID and case number
  return {
    caseId: this.extractCaseId(),
    caseNumber: this.extractCaseNumber(),
    partial: true,
    error: 'Full extraction failed'
  };
}
```

---

## Architectural Gaps

### 1. No Centralized State Management

**Issue**: State is scattered across multiple locations:
- `window.ExLibrisExtension` (global object)
- `CaseDataStore` (pub/sub)
- Module-scoped variables
- `chrome.storage` (persistent)

**Problems**:
- Difficult to track state changes
- No single source of truth
- Inconsistent state access patterns
- Hard to debug state-related issues

**Recommended Solution**:
Implement a centralized state manager with:
- Single store for all application state
- Immutable state updates
- Middleware for logging/debugging
- DevTools integration

```javascript
const StateManager = {
  state: {
    navigation: { currentCaseId: null, currentCaseNumber: null },
    caseData: { current: null, cache: {} },
    ui: { bannerVisible: false, menuInjected: false },
    settings: { timezone: 'UTC', labelStyle: 'bold' }
  },
  
  subscribers: new Map(),
  
  // Get state slice
  getState(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  },
  
  // Update state slice
  setState(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const parent = keys.reduce((obj, key) => obj[key], this.state);
    
    const oldValue = parent[lastKey];
    parent[lastKey] = value;
    
    // Notify subscribers
    this.notify(path, value, oldValue);
  },
  
  // Subscribe to state changes
  subscribe(path, callback) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    this.subscribers.get(path).add(callback);
    
    // Return unsubscribe
    return () => this.subscribers.get(path).delete(callback);
  }
};
```

---

### 2. No Unified Logging System

**Issue**: Logging is inconsistent:
- Some modules use `console.log`
- Some use `Logger.info()`
- No structured logging
- No log levels filtering
- No log persistence

**Problems**:
- Hard to debug in production
- Can't enable/disable debug logs easily
- No way to export logs for support

**Recommended Solution**:
```javascript
const Logger = {
  level: 'INFO',  // DEBUG, INFO, WARN, ERROR
  levels: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
  buffer: [],  // Last 1000 logs
  
  log(level, module, message, ...args) {
    if (this.levels[level] < this.levels[this.level]) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      module,
      message,
      args,
      url: window.location.href,
      caseId: window.ExLibrisExtension?.currentCaseId
    };
    
    // Add to buffer
    this.buffer.push(logEntry);
    if (this.buffer.length > 1000) {
      this.buffer.shift();
    }
    
    // Console output
    const prefix = `[${timestamp}] [${level}] [${module}]`;
    console[level.toLowerCase()](prefix, message, ...args);
    
    // Persist to storage (batched)
    this.persistLogs();
  },
  
  // Export logs for debugging
  exportLogs() {
    return JSON.stringify(this.buffer, null, 2);
  },
  
  // Clear logs
  clearLogs() {
    this.buffer = [];
  }
};
```

---

### 3. No Module Dependency Management

**Issue**: Module load order is defined in `manifest.json`, but:
- No explicit dependency declarations
- No runtime dependency checking
- No lazy loading of optional modules
- All modules load even if not needed

**Problems**:
- Fragile load order (easy to break)
- Unused modules consume resources
- Hard to understand dependencies

**Recommended Solution**:
```javascript
// Each module declares its dependencies
const MyModule = {
  dependencies: ['Logger', 'SettingsManager', 'CaseDomUtils'],
  
  async init() {
    // Check dependencies
    const missing = this.dependencies.filter(dep => 
      typeof window[dep] === 'undefined'
    );
    
    if (missing.length > 0) {
      console.error(`[MyModule] Missing dependencies:`, missing);
      return false;
    }
    
    // Initialize
    return true;
  }
};

// Dependency loader
const DependencyManager = {
  async loadModule(moduleName) {
    const module = window[moduleName];
    
    if (!module) {
      throw new Error(`Module not found: ${moduleName}`);
    }
    
    // Load dependencies first
    if (module.dependencies) {
      for (const dep of module.dependencies) {
        await this.loadModule(dep);
      }
    }
    
    // Initialize module
    if (module.init) {
      await module.init();
    }
  }
};
```

---

### 4. No Testing Infrastructure

**Issue**: No automated tests exist:
- No unit tests
- No integration tests
- No E2E tests
- Manual testing only

**Problems**:
- Easy to introduce regressions
- Hard to refactor with confidence
- Long manual testing cycles

**Recommended Solution**:
```javascript
// Example: Jest unit tests
describe('PageContextValidator', () => {
  test('validates matching case ID and number', () => {
    const result = PageContextValidator.validatePageContextBeforeDisplay(
      '5008c00000XYZ',
      '12345678'
    );
    
    expect(result.valid).toBe(true);
  });
  
  test('rejects mismatched case ID', () => {
    const result = PageContextValidator.validatePageContextBeforeDisplay(
      '5008c00000ABC',  // Different ID
      '12345678'
    );
    
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Case ID mismatch');
  });
});

// Example: Playwright E2E tests
test('extracts case data on navigation', async ({ page }) => {
  await page.goto('https://proquestllc.lightning.force.com/lightning/r/Case/5008c00000XYZ/view');
  
  // Wait for extraction
  await page.waitForEvent('casePageDataExtracted');
  
  // Verify banner updated
  const banner = await page.locator('.exl-persistent-banner');
  await expect(banner).toContainText('Case 12345678');
});
```

---

## Code Redundancies

### 1. Duplicate Shadow DOM Traversal

**Location**: 
- `ShadowTextExtractor.extractAllText()`
- `CaseDomUtils.queryShadowDOM()`
- `CasePageDataExtractor.queryShadowDOM()`

**Issue**: Similar shadow DOM traversal logic implemented 3 times

**Recommended Fix**: Consolidate into `CaseDomUtils.queryShadowDOM()` and use everywhere

---

### 2. Duplicate Visibility Checks

**Location**:
- `FlexipagePanelInjector.isElementVisible()`
- `FieldHighlighter.isElementVisible()`
- `EventSimulator.isVisible()`

**Issue**: Same visibility check logic in 3 modules

**Recommended Fix**: Move to `CaseDomUtils.isVisible()` and use everywhere

---

### 3. Duplicate Field Extraction Logic

**Location**:
- `CasePageDataExtractor.extractFieldValue()`
- `CaseDataExtractor.extractFieldValue()` (legacy)
- `CaseDetailExtractor` (custom extraction)

**Issue**: Similar field extraction patterns

**Recommended Fix**: Standardize on `CasePageDataExtractor` and deprecate others

---

### 4. Duplicate Timezone Resolution

**Location**:
- `TimezoneConverter.resolveCaseTimezone()`
- `CaseTimezoneResolver.init()` (similar logic)
- `AddressTimezoneResolver.resolveTimezone()`

**Issue**: Timezone resolution logic duplicated

**Recommended Fix**: Single timezone resolution service:
```javascript
const TimezoneResolution = {
  async resolveForCase(caseData) {
    // 1. Try TimezoneStorage cache
    const cached = await TimezoneStorage.getTimezone({
      accountName: caseData.accountName
    });
    if (cached) return cached.timezone;
    
    // 2. Try InstitutionTimezoneManager
    const institution = InstitutionTimezoneManager.getTimezoneByInstitution(
      caseData.accountName
    );
    if (institution) return institution;
    
    // 3. Try AddressTimezoneResolver
    if (caseData.address) {
      const address = await AddressTimezoneResolver.resolveTimezone(caseData.address);
      if (address) return address;
    }
    
    // 4. Fallback to UTC
    return 'UTC';
  }
};
```

---

## Inconsistencies

### 1. Inconsistent Initialization Patterns

**Issue**: Modules use different initialization patterns:

```javascript
// Pattern 1: Sync init
init() {
  if (this.isInitialized) return;
  // ...
}

// Pattern 2: Async init
async init() {
  if (this.isInitialized) return;
  // ...
}

// Pattern 3: Init with parameters
init(settings) {
  // ...
}

// Pattern 4: No init (auto-initialize on import)
```

**Recommended Standard**:
```javascript
/**
 * Standard initialization pattern
 * - Always async (even if no async operations)
 * - Always check isInitialized
 * - Always return boolean (success/failure)
 * - Always accept optional settings
 */
async init(settings = {}) {
  if (this.isInitialized) {
    console.log('[ModuleName] Already initialized');
    return true;
  }
  
  try {
    // Check feature flag
    const isEnabled = await this.isFeatureEnabled();
    if (!isEnabled) {
      console.log('[ModuleName] Feature disabled');
      return false;
    }
    
    // Apply settings
    this.config = { ...this.config, ...settings };
    
    // Initialize
    await this.setup();
    
    this.isInitialized = true;
    console.log('[ModuleName] Initialized');
    return true;
    
  } catch (error) {
    console.error('[ModuleName] Initialization failed:', error);
    return false;
  }
}
```

---

### 2. Inconsistent Error Handling

**Issue**: Error handling varies by module:

```javascript
// Pattern 1: Try-catch with log
try {
  // ...
} catch (error) {
  console.error('[Module] Error:', error);
}

// Pattern 2: Try-catch with return
try {
  // ...
} catch (error) {
  return null;
}

// Pattern 3: No error handling (throws)
const result = riskyOperation();

// Pattern 4: Promise rejection
return promise.catch(error => {
  console.error(error);
});
```

**Recommended Standard**:
```javascript
/**
 * Standard error handling pattern
 * - Always wrap risky operations
 * - Always log with context
 * - Return error object or null
 * - Don't throw errors (breaks extension)
 */
async performOperation() {
  try {
    const result = await riskyOperation();
    return { success: true, data: result };
    
  } catch (error) {
    console.error('[ModuleName] Operation failed:', error);
    return { success: false, error: error.message };
  }
}
```

---

### 3. Inconsistent Naming Conventions

**Issue**: Naming varies across codebase:

```javascript
// Case ID variations
caseId, case_id, CaseId, caseid

// Function naming
getCaseData(), extractCaseData(), fetchCaseData()

// Boolean flags
isInitialized, initialized, hasInitialized
```

**Recommended Standards**:
- Variables: `camelCase`
- Functions: `camelCase` with verb prefix (get, set, extract, fetch, etc.)
- Constants: `UPPER_SNAKE_CASE`
- Classes/Modules: `PascalCase`
- Boolean flags: `isX`, `hasX`, `canX`
- Private members: `_privateVariable` (underscore prefix)

---

## Performance Bottlenecks

### 1. Excessive DOM Queries

**Issue**: Modules repeatedly query the same DOM elements

**Metrics**:
- `CasePageDataExtractor` queries ~40 fields (40 queries)
- `FieldHighlighter` re-queries fields on every highlight (5-10 queries)
- No caching of query results

**Recommended Fix**:
```javascript
// Cache DOM elements
const DOMCache = new WeakMap();

function queryCached(selector, options = {}) {
  const { ttl = 5000, forceRefresh = false } = options;
  
  // Check cache
  const cached = DOMCache.get(selector);
  if (cached && !forceRefresh) {
    const age = Date.now() - cached.timestamp;
    if (age < ttl) {
      return cached.element;
    }
  }
  
  // Query and cache
  const element = document.querySelector(selector);
  if (element) {
    DOMCache.set(selector, {
      element,
      timestamp: Date.now()
    });
  }
  
  return element;
}
```

---

### 2. Synchronous Storage Operations

**Issue**: Some modules use synchronous-style storage access

**Problem**: Blocks execution while waiting for storage

**Recommended Fix**: Always use async/await for storage:
```javascript
// ❌ BAD: Blocking
chrome.storage.local.get(['key'], (result) => {
  processData(result.key);
});

// ✅ GOOD: Non-blocking
const result = await chrome.storage.local.get(['key']);
processData(result.key);
```

---

### 3. Unthrottled Event Handlers

**Issue**: Some event handlers fire on every mutation/scroll without throttling

**Affected**: 
- MutationObserver callbacks in several modules
- Scroll event listeners

**Recommended Fix**:
```javascript
// Use DebounceUtils everywhere
const observer = new MutationObserver(
  DebounceUtils.debounce(() => {
    this.handleDOMChange();
  }, 250)
);
```

---

## Security Considerations

### 1. No Input Sanitization

**Issue**: Text content from Salesforce DOM is displayed without sanitization

**Risk**: Medium (Salesforce sanitizes on server, but defense in depth)

**Recommended Fix**:
```javascript
function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = text;  // Use textContent, not innerHTML
  return div.textContent;
}

// Or use DOMPurify library
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(dirtyText);
```

---

### 2. No CSP Compliance Verification

**Issue**: No automated checks for CSP compliance

**Risk**: Low (manual review catches issues, but error-prone)

**Recommended Fix**: Add CSP linting to build process

---

## Technical Debt

### Priority Matrix

| Issue | Severity | Impact | Effort | Priority |
|-------|----------|--------|--------|----------|
| Stale data display | HIGH | HIGH | MEDIUM | 🔴 CRITICAL |
| No centralized state | MEDIUM | HIGH | HIGH | 🟡 HIGH |
| Shadow DOM performance | LOW | MEDIUM | MEDIUM | 🟢 MEDIUM |
| Code redundancies | LOW | LOW | LOW | 🟢 LOW |
| No testing infrastructure | MEDIUM | HIGH | HIGH | 🟡 HIGH |

---

## Recommended Improvements

### Short-term (1-2 sprints)

1. **Fix stale data display** (CRITICAL)
   - Add validation to all display modules
   - Implement periodic validation
   - Add navigation cleanup

2. **Consolidate redundant code** (MEDIUM)
   - Merge shadow DOM traversal into CaseDomUtils
   - Standardize visibility checks
   - Unify timezone resolution

3. **Improve error handling** (MEDIUM)
   - Implement retry logic in extractors
   - Add partial data fallbacks
   - Better error logging

### Mid-term (3-6 sprints)

1. **Implement centralized state management** (HIGH)
   - Single state store
   - Immutable updates
   - DevTools integration

2. **Add testing infrastructure** (HIGH)
   - Unit tests (Jest)
   - Integration tests
   - E2E tests (Playwright)

3. **Optimize performance** (MEDIUM)
   - DOM query caching
   - Shadow DOM traversal optimization
   - Lazy module loading

### Long-term (6+ sprints)

1. **Rewrite in TypeScript** (HIGH)
   - Type safety
   - Better IDE support
   - Catch errors at compile time

2. **Implement build system** (MEDIUM)
   - Module bundling
   - Tree shaking
   - Code splitting

3. **Add monitoring/telemetry** (MEDIUM)
   - Error tracking
   - Performance monitoring
   - Usage analytics

---

## Next Steps

- **For development history**: See [07-development-log.md](./07-development-log.md)
- **For architecture**: See [02-architecture-and-design.md](./02-architecture-and-design.md)
- **For best practices**: See [BEST_PRACTICES.md](../BEST_PRACTICES.md)

---

**[← Back: State Management](./05-state-management.md)** | **[↑ Main Documentation](./explanation.md)** | **[Next: Development Log →](./07-development-log.md)**
