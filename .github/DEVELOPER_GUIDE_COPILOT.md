# Ex Libris Salesforce Extension - Development Guidelines

## Project Overview

This is a **Chrome Extension (Manifest V3)** that enhances Salesforce Lightning with Esploro-specific features. The extension runs on `proquestllc.lightning.force.com` and provides field highlighting, dynamic menus, case comment tools, and data extraction capabilities.

---

## Architecture Principles

### 1. Modular Design
- **One module = One responsibility**
- Each module is a self-contained IIFE that exposes a public API
- Modules are loaded in sequence via `manifest.json`
- No inter-module dependencies (use message passing instead)

### 2. Manifest V3 Compliance
- **Service Worker background script** (not persistent)
- No `eval()` or inline scripts
- Message passing via `chrome.runtime.sendMessage()`
- Storage via `chrome.storage.sync` (settings) and `chrome.storage.local` (data)

### 3. Performance First
- Use `MutationObserver` with debouncing (1000ms delay)
- Disconnect observers when features cleanup
- Cache extracted data with last-modified validation
- Lazy initialization (wait for DOM elements before injecting)

---

## Module Pattern (IIFE Template)

```javascript
/**
 * Module Name
 * Brief description of what this module does
 */

const ModuleName = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  let isInitialized = false;
  let observer = null;

  // ========== PRIVATE FUNCTIONS ==========

  /**
   * Private helper function
   */
  function privateFunction() {
    // Implementation
  }

  // ========== PUBLIC API ==========

  return {
    /**
     * Initializes the module
     */
    init() {
      if (isInitialized) return;
      
      console.log('[ModuleName] Initializing...');
      // Initialization logic
      
      isInitialized = true;
    },

    /**
     * Cleans up the module
     */
    cleanup() {
      if (!isInitialized) return;
      
      console.log('[ModuleName] Cleaning up...');
      
      // Disconnect observers
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      
      // Remove injected UI elements
      // Clear state
      
      isInitialized = false;
    }
  };
})();
```

---

## Database (Chrome Storage) Best Practices

### Storage Types

**chrome.storage.sync** (100KB limit, 5KB per item)
- User settings
- Feature toggles
- Button label preferences
- Timezone settings

**chrome.storage.local** (10MB limit)
- Case data cache
- Case comment history
- Customer list data
- Notepad content

### Troubleshooting Storage Issues

**Problem:** Data not persisting
```javascript
// ❌ BAD: Async race condition
chrome.storage.sync.set({ key: value });
chrome.storage.sync.get('key', (result) => {
  console.log(result.key); // May be undefined!
});

// ✅ GOOD: Wait for set to complete
chrome.storage.sync.set({ key: value }, () => {
  chrome.storage.sync.get('key', (result) => {
    console.log(result.key); // Correct value
  });
});
```

**Problem:** Storage quota exceeded
```javascript
// ✅ Check storage usage before saving
chrome.storage.local.getBytesInUse(null, (bytes) => {
  if (bytes > 9 * 1024 * 1024) { // 9MB threshold
    console.warn('Storage almost full, cleaning up old entries...');
    cleanupOldCacheEntries();
  }
});
```

**Problem:** Data structure changed between versions
```javascript
// ✅ Use version migration
chrome.storage.local.get(['version', 'caseCache'], (result) => {
  const currentVersion = 3;
  const storedVersion = result.version || 1;
  
  if (storedVersion < currentVersion) {
    console.log('Migrating data from v' + storedVersion + ' to v' + currentVersion);
    migrateData(result.caseCache, storedVersion, currentVersion);
  }
});
```

---

## Message Passing Patterns

### Popup → Content Script

**Popup (popup.js):**
```javascript
// Get active tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  // Send message to content script
  chrome.tabs.sendMessage(tabs[0].id, {
    type: 'UPDATE_SETTINGS',
    payload: { highlightingEnabled: true }
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Content script not ready:', chrome.runtime.lastError);
      return;
    }
    console.log('Response:', response);
  });
});
```

**Content Script (content_script_exlibris.js):**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'UPDATE_SETTINGS') {
    console.log('Settings updated:', request.payload);
    
    // Apply new settings
    ExLibrisExtension.settings = { ...ExLibrisExtension.settings, ...request.payload };
    
    // Reinitialize features
    ExLibrisExtension.handlePageChange(ExLibrisExtension.currentPage);
    
    sendResponse({ success: true });
  }
  
  return true; // Keep channel open for async response
});
```

### Content Script → Background

**Content Script:**
```javascript
chrome.runtime.sendMessage({
  type: 'SCRAPE_WIKI_TABLE',
  url: 'https://example.com/wiki/customers'
}, (response) => {
  console.log('Scraped data:', response.data);
});
```

**Background (background.js):**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SCRAPE_WIKI_TABLE') {
    // Open tab, scrape, close tab
    chrome.tabs.create({ url: request.url, active: false }, (tab) => {
      // Inject scraping script
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const table = document.querySelector('#main-content table');
          // Extract data
          return Array.from(table.rows).map(row => /* ... */);
        }
      }, (results) => {
        sendResponse({ success: true, data: results[0].result });
        chrome.tabs.remove(tab.id);
      });
    });
    
    return true; // Keep channel open
  }
});
```

---

## Page Identification & Caching

### Identifying Pages

Always use `PageIdentifier.identifyPage()` to determine current page:

```javascript
const pageInfo = PageIdentifier.identifyPage();

if (pageInfo.type === PageIdentifier.pageTypes.CASE_PAGE) {
  // Initialize case page features
  initializeCasePageFeatures(pageInfo.caseId);
}
```

### Cache with Last Modified Validation

```javascript
/**
 * Gets case data from cache or extracts from DOM
 */
async function getCaseData(caseId) {
  // Check cache
  const cached = caseDataCache.get(caseId);
  
  // Get current last modified date from DOM
  const lastModified = extractLastModifiedDate();
  
  // Return cached if still valid
  if (cached && cached.lastModified === lastModified) {
    console.log('[Cache] Using cached data for case', caseId);
    return cached.data;
  }
  
  // Extract fresh data
  console.log('[Cache] Extracting fresh data for case', caseId);
  const freshData = await CaseDataExtractor.extractAll();
  
  // Update cache
  caseDataCache.set(caseId, {
    lastModified: lastModified,
    data: freshData,
    timestamp: Date.now()
  });
  
  return freshData;
}

/**
 * Extracts "Last Modified" date from Salesforce field
 */
function extractLastModifiedDate() {
  const field = document.querySelector('records-record-layout-item[field-label="Last Modified Date"] .test-id__field-value');
  return field ? field.textContent.trim() : null;
}
```

---

## DOM Manipulation Best Practices

### Wait for Elements Before Injection

```javascript
/**
 * Waits for elements to appear in DOM
 */
async function waitForElements(selectors, timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const allFound = selectors.every(selector => document.querySelector(selector));
    
    if (allFound) {
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.warn('[Wait] Timeout waiting for elements:', selectors);
  return false;
}

// Usage
async function injectButtons() {
  const found = await waitForElements([
    'lightning-card slot[name="actions"]',
    'div.secondaryFields'
  ]);
  
  if (!found) return;
  
  // Proceed with injection
}
```

### Prevent Duplicate Injection

```javascript
function injectButton() {
  // Check if already injected
  if (document.querySelector('[data-exlibris-injected="true"]')) {
    console.log('[Inject] Button already exists, skipping');
    return;
  }
  
  const button = document.createElement('button');
  button.setAttribute('data-exlibris-injected', 'true');
  // ... configure button
  
  targetContainer.appendChild(button);
}
```

### Use MutationObserver with Debouncing

```javascript
let observerTimeout = null;
const DEBOUNCE_DELAY = 1000; // ms

const observer = new MutationObserver(() => {
  // Clear existing timeout
  if (observerTimeout) {
    clearTimeout(observerTimeout);
  }
  
  // Set new timeout
  observerTimeout = setTimeout(() => {
    console.log('[Observer] DOM changed, re-checking...');
    tryInjectButtons();
  }, DEBOUNCE_DELAY);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Don't forget to disconnect!
function cleanup() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  if (observerTimeout) {
    clearTimeout(observerTimeout);
    observerTimeout = null;
  }
}
```

---

## Salesforce Lightning Selectors

### Common Selectors

**Case Fields:**
```javascript
// Generic field by label
records-record-layout-item[field-label="Field Name"] .test-id__field-value

// Specific examples
records-record-layout-item[field-label="Category"] .test-id__field-value
records-record-layout-item[field-label="Sub-Category"] .test-id__field-value
records-record-layout-item[field-label="Description"] .test-id__field-value
records-record-layout-item[field-label="Status"] .test-id__field-value
records-record-layout-item[field-label="Ex Libris Account Number"] .test-id__field-value
records-record-layout-item[field-label="Affected Environment"] .test-id__field-value
```

**Sections:**
```javascript
// Jira section
flexipage-component2[data-component-id="flexipage_fieldSection6"]

// Fields within section
div[data-target-selection-name$="Primary_Jira__c"]
```

**Case Comments:**
```javascript
// Comment textarea
textarea[name="inputComment"]

// Save button (for positioning character counter)
button[name="SaveEdit"]
```

**Injection Points:**
```javascript
// Card actions slot
lightning-card slot[name="actions"]

// Header secondary fields
div.secondaryFields slot[name="secondaryFields"]
```

---

## Navigation Monitoring

### Detecting Page Changes in Salesforce Lightning SPA

Salesforce Lightning is a Single Page Application, so standard `window.onload` won't detect navigation. Use this pattern:

```javascript
/**
 * Sets up navigation monitoring for Salesforce Lightning SPA
 */
function setupNavigationMonitoring() {
  let currentUrl = window.location.href;
  let currentCaseId = getCurrentCaseId();
  
  // Monitor title changes (reliable SPA navigation indicator)
  const observer = new MutationObserver(() => {
    const newUrl = window.location.href;
    const newCaseId = getCurrentCaseId();
    
    if (newUrl !== currentUrl || newCaseId !== currentCaseId) {
      console.log('[Navigation] Detected:', currentUrl, '→', newUrl);
      
      // Cleanup old page
      cleanup();
      
      // Wait for new page to load
      setTimeout(() => {
        const pageInfo = PageIdentifier.identifyPage();
        handlePageChange(pageInfo);
      }, 500);
      
      currentUrl = newUrl;
      currentCaseId = newCaseId;
    }
  });
  
  observer.observe(document.querySelector('title'), {
    childList: true,
    subtree: true
  });
  
  // Also listen for browser back/forward
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      const pageInfo = PageIdentifier.identifyPage();
      handlePageChange(pageInfo);
    }, 500);
  });
}

function getCurrentCaseId() {
  const match = window.location.href.match(/\/Case\/([^\/]+)\//);
  return match ? match[1] : null;
}
```

---

## Error Handling & Logging

### Consistent Logging Format

```javascript
// [Module] Action - Details
console.log('[FieldHighlighter] Initializing...');
console.log('[FieldHighlighter] Highlighted 5 fields');
console.warn('[FieldHighlighter] Field not found:', fieldName);
console.error('[FieldHighlighter] Failed to highlight:', error);
```

### Graceful Degradation

```javascript
function highlightFields() {
  try {
    const fields = document.querySelectorAll('records-record-layout-item');
    
    if (!fields || fields.length === 0) {
      console.warn('[FieldHighlighter] No fields found, page may still be loading');
      return;
    }
    
    fields.forEach(field => {
      try {
        // Highlight individual field
        highlightField(field);
      } catch (err) {
        // Don't let one field error break all fields
        console.error('[FieldHighlighter] Error highlighting field:', err);
      }
    });
    
  } catch (err) {
    console.error('[FieldHighlighter] Fatal error:', err);
    // Extension continues working, just this feature disabled
  }
}
```

---

## Context Menu (Chrome API)

### Creating Context Menus

**Background Script (background.js):**
```javascript
// Create context menu on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'exlibris-parent',
    title: 'Ex Libris Tools',
    contexts: ['editable']
  });
  
  // Character replacement submenu
  chrome.contextMenus.create({
    id: 'bold-text',
    parentId: 'exlibris-parent',
    title: '𝗕𝗼𝗹𝗱 𝗧𝗲𝘅𝘁',
    contexts: ['editable']
  });
  
  // Case toggling submenu
  chrome.contextMenus.create({
    id: 'toggle-case',
    parentId: 'exlibris-parent',
    title: 'Toggle Case',
    contexts: ['editable']
  });
  
  // Symbol insertion submenu
  chrome.contextMenus.create({
    id: 'insert-symbol',
    parentId: 'exlibris-parent',
    title: 'Insert Symbol ▸',
    contexts: ['editable']
  });
});

// Handle menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Send message to content script with selected text
  chrome.tabs.sendMessage(tab.id, {
    type: 'CONTEXT_MENU_ACTION',
    action: info.menuItemId,
    selectionText: info.selectionText
  });
});
```

**Content Script:**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CONTEXT_MENU_ACTION') {
    const textarea = document.activeElement;
    
    if (textarea.tagName === 'TEXTAREA') {
      const transformedText = TextFormatter.transform(
        request.selectionText,
        request.action
      );
      
      // Replace selection in textarea
      replaceSelection(textarea, transformedText);
    }
  }
});
```

---

## Testing Strategies

### Manual Testing Checklist

Before committing changes:

1. ✅ Load extension in Chrome (chrome://extensions)
2. ✅ Navigate to Salesforce case page
3. ✅ Open DevTools Console (check for errors)
4. ✅ Verify feature activates within 2 seconds
5. ✅ Navigate to different case (verify cleanup)
6. ✅ Open popup (verify settings persist)
7. ✅ Reload extension (verify no errors)

### Console Debugging

```javascript
// Add debug flag to modules
const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

// Usage
debugLog('Current case ID:', caseId);
debugLog('Extracted data:', caseData);
```

### Performance Monitoring

```javascript
function measurePerformance(label, fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  console.log(`[Perf] ${label} took ${(end - start).toFixed(2)}ms`);
  
  return result;
}

// Usage
measurePerformance('Field Highlighting', () => {
  FieldHighlighter.init();
});
```

---

## Common Issues & Solutions

### Issue: "Extension context invalidated"

**Cause:** Extension reloaded while content script still running  
**Solution:** Graceful error handling

```javascript
try {
  chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('Extension context lost, please refresh page');
      return;
    }
    // Continue normal operation
  });
} catch (err) {
  console.error('Extension unavailable:', err);
}
```

### Issue: Buttons injected multiple times

**Cause:** MutationObserver fires repeatedly  
**Solution:** Add injection guard

```javascript
function injectButton() {
  if (document.querySelector('[data-exlibris-button="true"]')) {
    return; // Already injected
  }
  
  const button = createElement('button');
  button.setAttribute('data-exlibris-button', 'true');
  // ...
}
```

### Issue: Features activate on wrong page

**Cause:** URL not checked before initialization  
**Solution:** Always check page type

```javascript
function init() {
  const pageInfo = PageIdentifier.identifyPage();
  
  if (pageInfo.type !== PageIdentifier.pageTypes.CASE_PAGE) {
    console.log('[Module] Not a case page, skipping initialization');
    return;
  }
  
  // Proceed with initialization
}
```

---

## Next Steps

See `.github/IMPLEMENTATION_PLAN.md` for detailed feature roadmap and implementation phases.
