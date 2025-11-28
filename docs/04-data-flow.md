# Data Flow & Extraction

**Document Version:** 1.1  
**Last Updated:** November 28, 2025  
**Note:** This is the authoritative data flow documentation for the extension.

---

## Table of Contents

- [Data Flow Overview](#data-flow-overview)
- [Case Data Extraction Process](#case-data-extraction-process)
- [Data Validation Flow](#data-validation-flow)
- [DOM Query Patterns](#dom-query-patterns)
- [Shadow DOM Traversal](#shadow-dom-traversal)
- [Cache Management Strategy](#cache-management-strategy)
- [Event-Driven Data Flow](#event-driven-data-flow)
- [Error Handling & Recovery](#error-handling--recovery)

---

## Data Flow Overview

### High-Level Data Flow

```
User Action (Navigation/Interaction)
   │
   ▼
Navigation Detection
   ├─► NavigationObserver (multiple signals)
   └─► PageIdentifier (page type detection)
   │
   ▼
Page Context Identification
   ├─► Extract case ID from URL
   └─► Extract case number from title
   │
   ▼
Data Extraction
   ├─► CasePageDataExtractor (main orchestrator)
   │   ├─► Wait for DOM elements
   │   ├─► Extract fields from Lightning components
   │   ├─► Traverse Shadow DOM
   │   └─► Enrich with customer database
   │
   └─► Validation
       ├─► PageContextValidator
       └─► Compare extracted data with current page
   │
   ▼
Data Storage
   ├─► CaseDataStore (in-memory, pub/sub)
   └─► chrome.storage.local (persistent cache)
   │
   ▼
Data Distribution
   ├─► Event: 'casePageDataExtracted'
   │   ├─► PersistentBanner
   │   ├─► DynamicMenu
   │   ├─► FlexipagePanelInjector
   │   └─► Other subscribers
   │
   └─► CaseDataStore.subscribe()
       └─► Immediate notification to subscribers
```

### Data Flow Layers

```
┌─────────────────────────────────────────────────────┐
│                 PRESENTATION LAYER                   │
│  PersistentBanner, DynamicMenu, FieldHighlighter    │
└────────────────────┬────────────────────────────────┘
                     │ (subscribes to)
                     ▼
┌─────────────────────────────────────────────────────┐
│                 STATE LAYER                          │
│  CaseDataStore (pub/sub)                            │
│  window.ExLibrisExtension (global state)            │
└────────────────────┬────────────────────────────────┘
                     │ (emits events)
                     ▼
┌─────────────────────────────────────────────────────┐
│                 EXTRACTION LAYER                     │
│  CasePageDataExtractor → CaseDomUtils               │
│  CaseCommentExtractor → ShadowTextExtractor         │
└────────────────────┬────────────────────────────────┘
                     │ (queries)
                     ▼
┌─────────────────────────────────────────────────────┐
│                 DOM LAYER                            │
│  Salesforce Lightning DOM                           │
│  Shadow DOM components                              │
└─────────────────────────────────────────────────────┘
```

---

## Case Data Extraction Process

### Complete Extraction Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. NAVIGATION DETECTION                                  │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
              User navigates to case page
                         │
                         ▼
          NavigationObserver detects change
                         │
                         ├─► Title change (MutationObserver)
                         ├─► URL change (History API intercept)
                         ├─► Popstate event (back/forward)
                         └─► Hashchange event
                         │
                         ▼
              PageIdentifier.identifyPage()
                         │
                         └─► Returns: { type: 'case_page', caseId: '5008c...' }
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ 2. INITIALIZATION TRIGGER                                │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
      ExLibrisExtension.handlePageChange(pageInfo)
                         │
                         └─► Debounced 300ms
                         │
                         ▼
            initializeCasePageFeatures()
                         │
                         └─► CasePageDataExtractor.handlePageChange(pageInfo)
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ 3. PRE-EXTRACTION CHECKS                                 │
└──────────────────────────────────────────────────────────┘
                         │
                         ├─► Check if already extracted for this caseId
                         │   └─► Yes → Return cached data, exit
                         │
                         ├─► Check if extraction in progress
                         │   └─► Yes → Wait or return
                         │
                         └─► Set extractionInProgress = true
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ 4. DOM READINESS WAIT                                    │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
              waitForPageLoad() - Up to 20 seconds
                         │
                         ├─► Wait for: records-record-layout-item
                         ├─► Wait for: flexipage-component2
                         ├─► Wait for: lightning-card
                         │
                         └─► Check every 100ms
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ 5. FIELD EXTRACTION                                      │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
              extractAllCaseData()
                         │
                         ├─► Extract Basic Info
                         │   ├─► caseId (from URL)
                         │   ├─► caseNumber (from title/DOM)
                         │   ├─► subject
                         │   └─► description
                         │
                         ├─► Extract Record Layout Fields
                         │   ├─► Account Name
                         │   ├─► Contact Name
                         │   ├─► Category, Sub-Category
                         │   ├─► Status, Sub Status
                         │   ├─► Product/Service Name
                         │   ├─► Ex Libris Account Number
                         │   └─► Priority, Severity
                         │
                         ├─► Extract Flexipage Fields
                         │   ├─► Asset
                         │   ├─► Affected Environment
                         │   ├─► Case Owner
                         │   ├─► Parent Case
                         │   ├─► Escalation
                         │   ├─► Created Date, Last Modified Date
                         │   └─► Page Status (for banner)
                         │
                         └─► Extract Shadow DOM Fields
                             └─► ShadowTextExtractor for complex components
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ 6. DATA ENRICHMENT                                       │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
      CustomerMasterManager.findByInstitutionCode()
                         │
                         ├─► Lookup by Ex Libris Account Number
                         │
                         └─► Add enrichment:
                             ├─► custID
                             ├─► instID
                             ├─► server
                             ├─► customerName
                             └─► timezone (if cached)
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ 7. DATA VALIDATION                                       │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
  PageContextValidator.validatePageContextBeforeDisplay()
                         │
                         ├─► Get current page context
                         │   ├─► Extract case ID from URL
                         │   └─► Extract case number from title
                         │
                         ├─► Compare case IDs
                         │   └─► Mismatch → INVALID, exit
                         │
                         ├─► Compare case numbers
                         │   ├─► Match → VALID
                         │   └─► Mismatch (but IDs match):
                         │       └─► waitForTitleUpdate() (up to 2s)
                         │
                         └─► Return validation result
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ 8. EVENT EMISSION                                        │
└──────────────────────────────────────────────────────────┘
                         │
                         ├─► If validation passed:
                         │   │
                         │   └─► dispatchDataExtractedEvent(data)
                         │       │
                         │       └─► Event: 'casePageDataExtracted'
                         │           └─► detail: { caseId, caseNumber, ...all data }
                         │
                         └─► If validation failed:
                             └─► Log warning, retry after 500ms (if case IDs match)
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ 9. DATA STORAGE                                          │
└──────────────────────────────────────────────────────────┘
                         │
                         ├─► CaseDataStore.setCurrentData(data)
                         │   └─► Notifies all subscribers immediately
                         │
                         └─► (Legacy: chrome.storage.local cache - deprecated)
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ 10. UI UPDATES                                           │
└──────────────────────────────────────────────────────────┘
                         │
                         ├─► PersistentBanner
                         │   ├─► Validates data
                         │   ├─► Updates banner UI
                         │   └─► Shows case info and links
                         │
                         ├─► DynamicMenu
                         │   ├─► Builds button groups
                         │   └─► Injects buttons into DOM
                         │
                         └─► FlexipagePanelInjector (if panel injected)
                             └─► Updates panel slots
```

### Extraction Timing

| Phase | Duration | Notes |
|-------|----------|-------|
| Navigation detection | ~250ms | Debounced |
| Page type identification | ~300ms | Throttled |
| DOM readiness wait | 0-20s | Until key elements appear |
| Field extraction | 100-500ms | Depends on DOM size |
| Data enrichment | 5-20ms | chrome.storage.local lookup |
| Validation | 0-2s | May wait for title update |
| Event emission | <1ms | Synchronous |
| UI updates | 50-200ms | DOM manipulation |
| **Total** | **0.5-23s** | Typical: 1-3s |

---

## Data Validation Flow

### Two-Phase Validation

```
┌───────────────────────────────────────────────────┐
│ PHASE 1: Pre-Display Validation                  │
│ (Before showing data to user)                     │
└───────────────────────────────────────────────────┘
                    │
                    ▼
    validatePageContextBeforeDisplay(caseId, caseNumber)
                    │
                    ├─► Step 1: Get current page context
                    │   │
                    │   └─► getCurrentCaseContext()
                    │       │
                    │       ├─► Extract case ID from URL
                    │       │   └─► Regex: /\/Case\/([a-zA-Z0-9]{15,18})/
                    │       │
                    │       ├─► Extract case number from title
                    │       │   └─► Regex: /Case\s+(\d{8})/
                    │       │
                    │       └─► Return { caseId, caseNumber, ... } or null
                    │
                    ├─► Step 2: Validate case ID
                    │   │
                    │   ├─► data.caseId === context.caseId?
                    │   │   └─► No → INVALID ("Case ID mismatch")
                    │   │
                    │   └─► Yes → Continue
                    │
                    ├─► Step 3: Validate case number
                    │   │
                    │   ├─► data.caseNumber === context.caseNumber?
                    │   │   └─► Yes → VALID
                    │   │
                    │   ├─► No, but case IDs match:
                    │   │   │
                    │   │   └─► waitForTitleUpdate() (if waitForTitle = true)
                    │   │       │
                    │   │       ├─► Poll document.title every 100ms
                    │   │       ├─► Wait up to 2000ms
                    │   │       ├─► Extract case number on each poll
                    │   │       │
                    │   │       ├─► Match found → VALID
                    │   │       └─► Timeout → INVALID ("Case number mismatch")
                    │   │
                    │   └─► No, case IDs don't match:
                    │       └─► INVALID ("Different case")
                    │
                    └─► Step 4: Final check
                        │
                        ├─► document.title === 'Lightning Experience'?
                        │   └─► Yes → INVALID ("Page still loading")
                        │
                        └─► All checks passed → VALID
                    │
                    ▼
        Return { valid: true/false, reason: string }

┌───────────────────────────────────────────────────┐
│ PHASE 2: Periodic Validation                     │
│ (While data is displayed)                         │
└───────────────────────────────────────────────────┘
                    │
                    ▼
        PersistentBanner.startPeriodicValidation()
                    │
                    └─► Every 2 seconds:
                        │
                        └─► validatePageContextBeforeDisplay()
                            │
                            ├─► VALID → Continue displaying
                            │
                            └─► INVALID → Clear display
                                │
                                └─► clearCaseData()
                                    ├─► Remove banner data
                                    ├─► Show loading state
                                    └─► Wait for new extraction
```

### Validation Edge Cases

**Case 1: Navigation Between Cases**
```
User on Case A → Clicks link to Case B
   │
   ├─► URL changes immediately (Case B ID)
   ├─► Title changes after ~500ms (Case B number)
   │
   └─► Extraction starts with Case B ID
       │
       └─► If title still shows Case A number:
           └─► waitForTitleUpdate() waits for Case B number
```

**Case 2: Back Button Navigation**
```
User on Case B → Clicks back button → Case A
   │
   ├─► URL changes via popstate (Case A ID)
   ├─► Title may be stale (still Case B number)
   │
   └─► Validation detects mismatch
       │
       └─► waitForTitleUpdate() waits for Case A number
```

**Case 3: Lightning Experience Loading**
```
User navigates to case
   │
   ├─► URL shows case ID
   ├─► Title shows "Lightning Experience" (loading)
   │
   └─► Extraction starts
       │
       └─► Validation detects "Lightning Experience"
           └─► INVALID ("Page still loading")
               └─► Retry after 500ms
```

---

## DOM Query Patterns

### Salesforce Lightning Selectors

#### Record Layout Fields (Most Stable)

```javascript
// Field by label (BEST - most stable)
const selector = 'records-record-layout-item[field-label="Case Number"]';

// With nested input
const input = element.querySelector('lightning-input input');
const text = element.querySelector('lightning-formatted-text');
```

**Stability**: ✅ High - SLDS classes are stable across Salesforce versions

#### Flexipage Fields (Medium Stability)

```javascript
// Flexipage component
const flexipage = document.querySelector('flexipage-component2');

// Field within flexipage
const field = flexipage.querySelector('lightning-output-field[data-field-id="AssetId"]');
```

**Stability**: ⚠️ Medium - Component structure may change

#### Shadow DOM Fields (Variable)

```javascript
// Must traverse shadow roots
const component = document.querySelector('lightning-record-edit-form');
const shadowRoot = component.shadowRoot;
const field = shadowRoot.querySelector('lightning-input-field');
```

**Stability**: ⚠️ Variable - Shadow DOM structure can change

### Check-Then-Observe Pattern

```javascript
/**
 * CRITICAL PATTERN: Always use check-then-observe for Salesforce Lightning
 * 
 * Why: Elements may load asynchronously. Immediate query might fail
 *      even though element will appear soon.
 */

function findElementSafely(selector, timeout = 10000) {
  // 1. Try immediate query
  let element = document.querySelector(selector);
  if (element) {
    return Promise.resolve(element);
  }

  // 2. Set up observer if not found
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      element = document.querySelector(selector);
      if (element) {
        observer.disconnect();  // CRITICAL: Always disconnect
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 3. Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found: ${selector}`));
    }, timeout);
  });
}
```

### Selector Strategies by Field Type

**1. Text Fields**
```javascript
// Strategy: field-label + nested input
const field = document.querySelector('records-record-layout-item[field-label="Subject"]');
const input = field.querySelector('lightning-input input');
const value = input.value;
```

**2. Lookup Fields**
```javascript
// Strategy: field-label + formatted-text
const field = document.querySelector('records-record-layout-item[field-label="Account Name"]');
const text = field.querySelector('lightning-formatted-text');
const value = text.textContent.trim();
```

**3. Picklist Fields**
```javascript
// Strategy: field-label + combobox + selected option
const field = document.querySelector('records-record-layout-item[field-label="Status"]');
const combobox = field.querySelector('lightning-combobox');
const value = combobox.value;
```

**4. Date Fields**
```javascript
// Strategy: field-label + formatted-date-time
const field = document.querySelector('records-record-layout-item[field-label="Created Date"]');
const date = field.querySelector('lightning-formatted-date-time');
const value = date.getAttribute('value');  // ISO format
```

**5. Rich Text Fields**
```javascript
// Strategy: field-label + formatted-rich-text + textContent
const field = document.querySelector('records-record-layout-item[field-label="Description"]');
const richText = field.querySelector('lightning-formatted-rich-text');
const value = richText.textContent.trim();
```

### Visibility Checks

```javascript
/**
 * Check if element is truly visible (not just in DOM)
 */
function isVisible(element) {
  if (!element) return false;
  
  // Check 1: offsetParent (null if hidden)
  if (element.offsetParent === null) return false;
  
  // Check 2: Computed style
  const style = getComputedStyle(element);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  
  // Check 3: Dimensions
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  
  return true;
}
```

---

## Shadow DOM Traversal

### Shadow DOM Concepts

**Open Shadow Roots**
- Accessible via `element.shadowRoot`
- Extension can traverse and read content
- Most Salesforce Lightning components use open shadows

**Closed Shadow Roots**
- Not accessible via `shadowRoot` property
- Extension cannot read content
- Rare in Salesforce Lightning

### Recursive Traversal

```javascript
/**
 * Recursively search for element in Shadow DOM
 * 
 * @param {string} selector - CSS selector
 * @param {Element} root - Starting element (default: document.body)
 * @returns {Element|null}
 */
function queryShadowDOM(selector, root = document.body) {
  // 1. Try direct query
  let element = root.querySelector(selector);
  if (element) return element;

  // 2. Recursively search shadow roots
  function traverse(node) {
    // Check if node has shadow root
    if (node.shadowRoot && node.shadowRoot.mode === 'open') {
      // Query within shadow root
      const found = node.shadowRoot.querySelector(selector);
      if (found) return found;
      
      // Recursively search children
      for (const child of node.shadowRoot.children) {
        const result = traverse(child);
        if (result) return result;
      }
    }

    // Search regular children
    for (const child of node.children) {
      const result = traverse(child);
      if (result) return result;
    }

    return null;
  }

  return traverse(root);
}
```

### Text Extraction from Shadow DOM

```javascript
/**
 * Extract all text from Shadow DOM trees
 * Used by ShadowTextExtractor module
 */
function extractShadowText(root = document.body, options = {}) {
  const { maxNodes = 10000, includeHidden = false } = options;
  let nodeCount = 0;
  let text = '';

  function traverse(node) {
    if (nodeCount >= maxNodes) return;
    nodeCount++;

    // Check visibility
    if (!includeHidden && !isVisible(node)) return;

    // Extract text from text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      const trimmed = node.textContent.trim();
      if (trimmed) {
        text += trimmed + ' ';
      }
      return;
    }

    // Traverse shadow root
    if (node.shadowRoot && node.shadowRoot.mode === 'open') {
      for (const child of node.shadowRoot.childNodes) {
        traverse(child);
      }
    }

    // Traverse regular children
    for (const child of node.childNodes) {
      traverse(child);
    }
  }

  traverse(root);
  
  return {
    text: text.trim(),
    stats: {
      nodesVisited: nodeCount,
      shadowRootsFound: 0  // TODO: Track shadow roots
    }
  };
}
```

### Shadow DOM Best Practices

1. **Always check for open shadow roots**
   ```javascript
   if (element.shadowRoot && element.shadowRoot.mode === 'open') {
     // Safe to access
   }
   ```

2. **Use Check-Then-Observe for shadow content**
   ```javascript
   // Shadow content may load after shadow root is attached
   const shadowRoot = element.shadowRoot;
   const observer = new MutationObserver(() => {
     const field = shadowRoot.querySelector('input');
     if (field) {
       observer.disconnect();
       processField(field);
     }
   });
   observer.observe(shadowRoot, { childList: true, subtree: true });
   ```

3. **Handle missing shadow roots gracefully**
   ```javascript
   const input = element.shadowRoot?.querySelector('input') ?? element.querySelector('input');
   ```

---

## Cache Management Strategy

### Cache Architecture (Interim - No Persistence)

**Current State (No Cache Layer)**
```
Case Navigation
   │
   ▼
CaseContextWatcher confirms case
   │
   ▼
Extract fresh data (no cache check)
   │
   ▼
Broadcast via 'casePageDataExtracted'
   │
   └─► All modules receive fresh data
```

**Future State (With CaseDataStore)**
```
Case Navigation
   │
   ▼
CaseContextWatcher confirms case
   │
   ▼
CaseDataStore checks signature
   │
   ├─► Valid → Return cached data
   └─► Invalid → Trigger extraction
       │
       └─► Store with new signature
```

### Cache Invalidation Triggers (Future)

1. **Navigation** - Always extract fresh data
2. **Field Update** - Detect via MutationObserver
3. **Time-based** - TTL (e.g., 5 minutes)
4. **Manual** - User refresh action

### Data Signatures (Future Pattern)

```javascript
/**
 * Build signature from extracted data (not DOM)
 * 
 * Signature includes:
 * - Case ID + Case Number (identity)
 * - Last Modified Date (staleness check)
 * - Critical field hashes (change detection)
 */
function buildSignature(data) {
  const critical = {
    caseId: data.caseId,
    caseNumber: data.caseNumber,
    lastModified: data.lastModified,
    status: data.status,
    priority: data.priority
  };
  
  return JSON.stringify(critical);
}

/**
 * Compare signatures
 */
function isSignatureValid(storedSignature, currentData) {
  const currentSignature = buildSignature(currentData);
  return storedSignature === currentSignature;
}
```

---

## Event-Driven Data Flow

### Custom Event Pattern

```javascript
// Module A: Emit event
document.dispatchEvent(new CustomEvent('casePageDataExtracted', {
  detail: {
    caseId: '5008c00000XYZ',
    caseNumber: '12345678',
    // ... all extracted data
  },
  bubbles: true,      // Bubble up DOM tree
  composed: true      // Cross shadow DOM boundaries
}));

// Module B: Listen for event
document.addEventListener('casePageDataExtracted', (event) => {
  const { detail: caseData } = event;
  
  // Validate before using
  const validation = PageContextValidator.validatePageContextBeforeDisplay(
    caseData.caseId,
    caseData.caseNumber
  );
  
  if (validation.valid) {
    this.updateUI(caseData);
  }
});
```

### Observer Pattern (CaseDataStore)

```javascript
// CaseDataStore implementation
const CaseDataStore = {
  currentData: null,
  subscribers: new Set(),
  
  subscribe(callback) {
    this.subscribers.add(callback);
    
    // Emit current state immediately
    if (this.currentData) {
      callback({ data: this.currentData });
    }
    
    // Return unsubscribe function
    return () => this.subscribers.delete(callback);
  },
  
  setCurrentData(data) {
    this.currentData = data;
    this.notify();
  },
  
  notify() {
    this.subscribers.forEach(callback => {
      callback({ data: this.currentData });
    });
  }
};

// Module usage
const unsubscribe = CaseDataStore.subscribe(({ data }) => {
  if (data) {
    this.updateUI(data);
  } else {
    this.clearUI();
  }
});
```

### Event Ordering

```
1. Navigation Event
   └─► NavigationObserver.checkNavigation()

2. Page Type Identified
   └─► PageIdentifier emits page change

3. Extraction Started
   └─► CasePageDataExtractor.handlePageChange()

4. Data Extracted
   └─► CasePageDataExtractor emits 'casePageDataExtracted'

5. Data Stored
   └─► CaseDataStore.setCurrentData()
   └─► Notifies subscribers

6. UI Updates
   ├─► PersistentBanner updates
   ├─► DynamicMenu injects buttons
   └─► FieldHighlighter highlights fields
```

---

## Error Handling & Recovery

### Extraction Errors

```javascript
async function extractAllCaseData() {
  try {
    // Wait for page load
    await this.waitForPageLoad();
  } catch (error) {
    Logger.error('Page load timeout:', error);
    // Attempt extraction anyway with partial data
  }

  try {
    // Extract fields
    const data = {
      caseId: this.extractCaseId(),
      caseNumber: this.extractCaseNumber(),
      // ... other fields
    };
    
    return data;
  } catch (error) {
    Logger.error('Extraction failed:', error);
    
    // Return partial data
    return {
      caseId: this.extractCaseId(),
      caseNumber: this.extractCaseNumber(),
      error: error.message
    };
  }
}
```

### Validation Errors

```javascript
// Retry with backoff
async function extractWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const data = await this.extractAllCaseData();
    
    const validation = PageContextValidator.validatePageContextBeforeDisplay(
      data.caseId,
      data.caseNumber
    );
    
    if (validation.valid) {
      return data;  // Success
    }
    
    Logger.warn(`Validation failed (attempt ${i+1}/${maxRetries}):`, validation.reason);
    
    // Wait before retry (exponential backoff)
    await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
  }
  
  throw new Error('Extraction failed after retries');
}
```

### Graceful Degradation

```javascript
// PersistentBanner: Handle missing data gracefully
setupCaseDataListener() {
  document.addEventListener('casePageDataExtracted', (event) => {
    const { detail: caseData } = event;
    
    try {
      // Validate
      const validation = PageContextValidator.validatePageContextBeforeDisplay(
        caseData.caseId,
        caseData.caseNumber
      );
      
      if (!validation.valid) {
        this.showLoadingState();
        return;
      }
      
      // Update UI with all available data
      this.updateBanner(caseData);
      
    } catch (error) {
      Logger.error('Banner update failed:', error);
      
      // Show minimal info
      this.updateBanner({
        caseId: caseData.caseId,
        caseNumber: caseData.caseNumber,
        subject: 'Error loading case data'
      });
    }
  });
}
```

---

## Next Steps

- **For state management**: See [05-state-management.md](./05-state-management.md)
- **For architecture**: See [02-architecture-and-design.md](./02-architecture-and-design.md)
- **For modules**: See [03-core-modules.md](./03-core-modules.md)

---

**[← Back: Core Modules](./03-core-modules.md)** | **[↑ Main Documentation](./explanation.md)** | **[Next: State Management →](./05-state-management.md)**
