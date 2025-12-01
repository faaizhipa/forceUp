# State Management

**Document Version:** 1.0  
**Last Updated:** January 23, 2025  
**Reference:** See also [BEST_PRACTICES.md](../BEST_PRACTICES.md) for state management patterns

---

## Table of Contents

- [State Management Overview](#state-management-overview)
- [Global State Patterns](#global-state-patterns)
- [Chrome Storage Patterns](#chrome-storage-patterns)
- [Event-Based Communication](#event-based-communication)
- [Observer Pattern (Pub/Sub)](#observer-pattern-pubsub)
- [Cross-Context Synchronization](#cross-context-synchronization)
- [State Persistence Strategy](#state-persistence-strategy)
- [State Validation & Integrity](#state-validation--integrity)

---

## State Management Overview

### State Layers in the Extension

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: EPHEMERAL STATE                                │
│ Service Worker (background.js)                          │
│ - Context menus                                         │
│ - Message handlers                                      │
│ ⚠️ CRITICAL: Lost on worker termination (~30s idle)    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 2: IN-MEMORY STATE (Content Scripts)             │
│ window.ExLibrisExtension (global object)               │
│ - currentPage: PageInfo                                │
│ - currentCaseId: string                                │
│ - currentCaseNumber: string                            │
│ - lastUrl: string                                      │
│ ✅ Persists across SPA navigation                      │
│ ⚠️ Lost on page refresh                                │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 3: MANAGED STATE                                 │
│ CaseDataStore (pub/sub pattern)                        │
│ - currentData: CaseData                                │
│ - subscribers: Set<Function>                           │
│ ✅ Single source of truth                              │
│ ✅ Automatic subscriber notification                   │
│ ⚠️ Lost on page refresh                                │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 4: PERSISTENT STATE                              │
│ chrome.storage.local (~10MB limit)                     │
│ - customerDatabase: Array<Customer>                    │
│ - timezoneCache: Map<string, Timezone>                 │
│ - commentHistory: Array<Comment>                       │
│ ✅ Survives extension restart                          │
│ ✅ Accessible from all contexts                        │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 5: SYNCED STATE                                  │
│ chrome.storage.sync (~5KB limit, synced across devices)│
│ - userPreferences: Preferences                         │
│ - featureFlags: Object                                 │
│ ✅ Survives extension restart                          │
│ ✅ Syncs across user's devices                         │
└─────────────────────────────────────────────────────────┘
```

### State Flow by Use Case

**Case Navigation Flow**
```
User navigates to case page
   │
   ▼
NavigationObserver detects change
   │
   ▼
window.ExLibrisExtension.currentCaseId = newCaseId (L2: In-Memory)
   │
   ▼
CaseContextWatcher emits context change
   │
   ▼
CasePageDataExtractor extracts data
   │
   ▼
CaseDataStore.setCurrentData(data) (L3: Managed State)
   │
   └─► Notifies all subscribers immediately
```

**User Preference Update Flow**
```
User changes timezone setting in popup
   │
   ▼
SettingsManager.set('timezone', 'Asia/Kuala_Lumpur')
   │
   ▼
chrome.storage.sync.set({ timezone: 'Asia/Kuala_Lumpur' }) (L5: Synced)
   │
   ▼
chrome.storage.onChanged event fired
   │
   ├─► Content scripts receive update
   ├─► Popup receives update
   └─► Background script receives update
   │
   ▼
All contexts update their local state
```

---

## Global State Patterns

### Content Script Global State

```javascript
/**
 * Global state object for SPA state sharing
 * Lives at window.ExLibrisExtension
 * 
 * ✅ GOOD FOR:
 * - Current page context (URL, case ID, case number)
 * - Immediate access across modules (no async)
 * - State that persists across SPA navigation
 * 
 * ❌ NOT FOR:
 * - Persistent data (use chrome.storage)
 * - Data that needs to survive refresh
 * - Large datasets (memory constraints)
 */
window.ExLibrisExtension = {
  // Page context
  currentPage: null,          // { type: 'case_page', caseId: '...' }
  currentCaseId: null,        // '5008c00000XYZ'
  currentCaseNumber: null,    // '12345678'
  lastUrl: null,              // Last known URL
  
  // Navigation state
  isNavigating: false,        // True during navigation
  navigationTimer: null,      // Debounce timer
  
  // Initialization flags
  isInitialized: false,       // Extension initialized
  featuresInitialized: {},    // { featureName: true/false }
  
  // Observers
  observers: {
    navigation: null,
    title: null,
    dom: null
  }
};
```

### Access Patterns

**Reading State**
```javascript
// ✅ GOOD: Check existence first
if (window.ExLibrisExtension?.currentCaseId) {
  const caseId = window.ExLibrisExtension.currentCaseId;
  processCase(caseId);
}

// ❌ BAD: Assume existence
const caseId = window.ExLibrisExtension.currentCaseId;  // May throw
```

**Writing State**
```javascript
// ✅ GOOD: Update atomically
window.ExLibrisExtension.currentCaseId = newCaseId;
window.ExLibrisExtension.currentCaseNumber = newCaseNumber;
window.ExLibrisExtension.lastUrl = newUrl;

// ❌ BAD: Partial updates (race conditions)
window.ExLibrisExtension.currentCaseId = newCaseId;
// ... async operation ...
window.ExLibrisExtension.currentCaseNumber = newCaseNumber;  // May be stale
```

**Clearing State**
```javascript
// ✅ GOOD: Clear on navigation away
function handleNavigationAway() {
  window.ExLibrisExtension.currentCaseId = null;
  window.ExLibrisExtension.currentCaseNumber = null;
  window.ExLibrisExtension.currentPage = null;
}
```

### Module-Scoped State

```javascript
/**
 * Module Pattern with Private State
 * 
 * ✅ GOOD FOR:
 * - Internal module state
 * - Temporary processing state
 * - Module-specific configuration
 * 
 * ❌ NOT FOR:
 * - Shared state across modules (use global or pub/sub)
 * - Persistent state (use chrome.storage)
 */
const MyModule = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  let isInitialized = false;           // Initialization flag
  let observer = null;                 // MutationObserver instance
  let currentData = null;              // Current working data
  let processingQueue = [];            // Task queue
  let config = {                       // Module configuration
    debounceDelay: 250,
    maxRetries: 3
  };

  // ========== PRIVATE FUNCTIONS ==========

  function updateState(newData) {
    currentData = newData;
    // Process...
  }

  // ========== PUBLIC API ==========

  return {
    init() {
      if (isInitialized) return;
      // Initialize
      isInitialized = true;
    },
    
    // Don't expose private state directly
    getCurrentData() {
      return currentData ? { ...currentData } : null;  // Return copy
    }
  };
})();
```

---

## Chrome Storage Patterns

### chrome.storage.local (Persistent, Large Data)

**Capacity**: ~10MB  
**Scope**: Per-extension, local to device  
**Performance**: ~20ms read/write

**Use Cases**:
- Customer database (~1000 customers)
- Timezone cache
- Comment history
- Large datasets

#### Storage Operations

```javascript
// ========== WRITE OPERATIONS ==========

// Single key-value
await chrome.storage.local.set({ 
  key: value 
});

// Multiple key-values (atomic)
await chrome.storage.local.set({
  customerDatabase: customers,
  timezoneCache: timezones,
  lastSync: Date.now()
});

// ========== READ OPERATIONS ==========

// Single key
const result = await chrome.storage.local.get(['customerDatabase']);
const customers = result.customerDatabase;

// Multiple keys
const result = await chrome.storage.local.get([
  'customerDatabase',
  'timezoneCache'
]);
const { customerDatabase, timezoneCache } = result;

// All keys
const allData = await chrome.storage.local.get(null);

// With defaults
const result = await chrome.storage.local.get({
  customerDatabase: [],
  timezoneCache: {}
});

// ========== DELETE OPERATIONS ==========

// Single key
await chrome.storage.local.remove('customerDatabase');

// Multiple keys
await chrome.storage.local.remove([
  'customerDatabase',
  'timezoneCache'
]);

// Clear all
await chrome.storage.local.clear();
```

#### Change Listener

```javascript
/**
 * Listen for storage changes
 * Fires in all extension contexts (background, content, popup)
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  
  // Check specific key
  if (changes.customerDatabase) {
    const { oldValue, newValue } = changes.customerDatabase;
    console.log('Customer database updated:', oldValue, '=>', newValue);
    
    // Update local cache
    this.refreshCustomerCache(newValue);
  }
  
  // Handle multiple changes
  Object.keys(changes).forEach(key => {
    const { oldValue, newValue } = changes[key];
    this.handleStorageChange(key, oldValue, newValue);
  });
});
```

#### Best Practices

```javascript
// ✅ GOOD: Batch writes
await chrome.storage.local.set({
  key1: value1,
  key2: value2,
  key3: value3
});

// ❌ BAD: Multiple separate writes
await chrome.storage.local.set({ key1: value1 });
await chrome.storage.local.set({ key2: value2 });
await chrome.storage.local.set({ key3: value3 });

// ✅ GOOD: Read only what you need
const result = await chrome.storage.local.get(['customerDatabase']);

// ❌ BAD: Read everything
const allData = await chrome.storage.local.get(null);  // Slow!

// ✅ GOOD: Handle errors
try {
  await chrome.storage.local.set({ key: value });
} catch (error) {
  console.error('Storage write failed:', error);
  // Retry or fallback
}

// ✅ GOOD: Check quota
const bytesInUse = await chrome.storage.local.getBytesInUse();
const quota = chrome.storage.local.QUOTA_BYTES;  // 10485760 (10MB)
if (bytesInUse / quota > 0.9) {
  console.warn('Storage almost full:', bytesInUse, '/', quota);
}
```

### chrome.storage.sync (Synced Settings)

**Capacity**: ~100KB total, ~8KB per item  
**Scope**: Per-user, synced across devices  
**Performance**: ~20ms read/write, sync delay varies

**Use Cases**:
- User preferences (timezone, theme)
- Feature flags
- UI settings
- Small configuration data

#### Storage Operations

```javascript
// ========== WRITE OPERATIONS ==========

// User preferences
await chrome.storage.sync.set({
  timezone: 'Asia/Kuala_Lumpur',
  labelStyle: 'bold',
  menuLocation: 'top',
  featureFlags: {
    persistentBanner: true,
    timezoneConverter: true,
    fieldHighlighting: true
  }
});

// ========== READ OPERATIONS ==========

// With defaults
const result = await chrome.storage.sync.get({
  timezone: 'UTC',
  labelStyle: 'pill',
  menuLocation: 'top',
  featureFlags: {}
});

const { timezone, labelStyle, menuLocation, featureFlags } = result;
```

#### Change Listener

```javascript
/**
 * Listen for synced settings changes
 * Fires when settings change on ANY device
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  
  if (changes.timezone) {
    const newTimezone = changes.timezone.newValue;
    console.log('User changed timezone:', newTimezone);
    
    // Update UI
    this.updateTimezoneDisplay(newTimezone);
    
    // Refresh data with new timezone
    this.refreshDataWithTimezone(newTimezone);
  }
  
  if (changes.featureFlags) {
    const newFlags = changes.featureFlags.newValue;
    console.log('Feature flags updated:', newFlags);
    
    // Enable/disable features
    this.applyFeatureFlags(newFlags);
  }
});
```

#### Best Practices

```javascript
// ✅ GOOD: Small data only
await chrome.storage.sync.set({
  theme: 'dark',
  fontSize: 14
});

// ❌ BAD: Large data (use local instead)
await chrome.storage.sync.set({
  customerDatabase: hugeArray  // Will fail!
});

// ✅ GOOD: Check item size
const itemSize = JSON.stringify(value).length;
const maxItemSize = chrome.storage.sync.QUOTA_BYTES_PER_ITEM;  // 8192
if (itemSize > maxItemSize) {
  console.error('Item too large for sync storage');
  // Use local storage instead
}

// ✅ GOOD: Handle sync errors
try {
  await chrome.storage.sync.set({ key: value });
} catch (error) {
  if (error.message.includes('QUOTA_BYTES')) {
    console.error('Sync storage quota exceeded');
    // Fallback to local
    await chrome.storage.local.set({ key: value });
  }
}
```

---

## Event-Based Communication

### Custom Events (Within Context)

```javascript
/**
 * Dispatch custom events for loose coupling
 * 
 * ✅ GOOD FOR:
 * - Module-to-module communication
 * - Broadcasting state changes
 * - Crossing shadow DOM boundaries
 * 
 * ❌ NOT FOR:
 * - Cross-context communication (use chrome.runtime.sendMessage)
 * - Guaranteed delivery (listeners may not be registered)
 */

// ========== DISPATCHING EVENTS ==========

// Module A: Emit event
document.dispatchEvent(new CustomEvent('casePageDataExtracted', {
  detail: {
    caseId: '5008c00000XYZ',
    caseNumber: '12345678',
    subject: 'Case Subject',
    // ... all extracted data
  },
  bubbles: true,      // Bubble up DOM tree
  composed: true      // Cross shadow DOM boundaries
}));

// ========== LISTENING FOR EVENTS ==========

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
  } else {
    console.warn('Stale data:', validation.reason);
  }
});

// ========== CLEANUP ==========

// Remove listener on cleanup
const handler = (event) => { /* ... */ };
document.addEventListener('casePageDataExtracted', handler);

// Later...
document.removeEventListener('casePageDataExtracted', handler);
```

### Event Catalog

| Event Name | Emitter | Payload | Subscribers |
|------------|---------|---------|-------------|
| `casePageDataExtracted` | CasePageDataExtractor | `{ caseId, caseNumber, ...data }` | PersistentBanner, DynamicMenu, FlexipagePanelInjector |
| `navigationChange` | NavigationObserver | `{ url, title }` | PageIdentifier, ExLibrisExtension |
| `contextChange` | CaseContextWatcher | `{ caseId, caseNumber, isValid }` | CasePageDataExtractor, PersistentBanner |
| `accountAddressExtracted` | AccountAddressExtractor | `{ accountName, address }` | CaseTimezoneResolver |
| `unknownCustomerDetected` | TimezoneStorage | `{ accountName, caseId }` | UnknownCustomerManager |

---

## Observer Pattern (Pub/Sub)

### CaseDataStore Implementation

```javascript
/**
 * CaseDataStore: Single source of truth with pub/sub
 * 
 * ✅ BENEFITS:
 * - Single source of truth for case data
 * - Automatic notification of all subscribers
 * - New subscribers receive current state immediately
 * - Type-safe unsubscribe
 * 
 * ❌ LIMITATIONS:
 * - Lost on page refresh (in-memory only)
 * - No persistence (use chrome.storage for that)
 */
const CaseDataStore = {
  // ========== STATE ==========
  currentData: null,
  subscribers: new Set(),
  
  // ========== SUBSCRIBE ==========
  subscribe(callback) {
    // Add subscriber
    this.subscribers.add(callback);
    
    // Emit current state immediately (important!)
    if (this.currentData) {
      callback({ data: this.currentData });
    }
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  },
  
  // ========== PUBLISH ==========
  setCurrentData(data) {
    // Validate data before storing
    if (!data || !data.caseId) {
      console.error('[CaseDataStore] Invalid data');
      return;
    }
    
    // Update state
    this.currentData = data;
    
    // Notify all subscribers
    this.notify();
  },
  
  notify() {
    this.subscribers.forEach(callback => {
      try {
        callback({ data: this.currentData });
      } catch (error) {
        console.error('[CaseDataStore] Subscriber error:', error);
      }
    });
  },
  
  // ========== CLEAR ==========
  clearCurrentData() {
    this.currentData = null;
    this.notify();  // Notify subscribers of clear
  },
  
  // ========== QUERY ==========
  getCurrentData() {
    return this.currentData ? { ...this.currentData } : null;  // Return copy
  }
};
```

### Usage Pattern

```javascript
/**
 * Module subscribing to CaseDataStore
 */
const MyModule = {
  unsubscribe: null,
  
  init() {
    // Subscribe to data updates
    this.unsubscribe = CaseDataStore.subscribe(({ data }) => {
      if (data) {
        // New data available
        console.log('[MyModule] Data updated:', data.caseId);
        this.updateUI(data);
      } else {
        // Data cleared (navigated away)
        console.log('[MyModule] Data cleared');
        this.clearUI();
      }
    });
  },
  
  cleanup() {
    // Unsubscribe
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  },
  
  updateUI(data) {
    // Update UI with new data
  },
  
  clearUI() {
    // Clear UI
  }
};
```

### Benefits Over Events

| Feature | Custom Events | Observer Pattern |
|---------|---------------|------------------|
| **Immediate state** | ❌ No | ✅ Yes (on subscribe) |
| **Guaranteed delivery** | ❌ No (if listener added late) | ✅ Yes |
| **Unsubscribe** | Manual cleanup | ✅ Function returned |
| **Type safety** | ❌ No | ✅ Better |
| **Error handling** | Listener's problem | ✅ Store handles |

---

## Cross-Context Synchronization

### Service Worker ↔ Content Script

```javascript
// ========== CONTENT SCRIPT → SERVICE WORKER ==========

// Send message from content script
chrome.runtime.sendMessage({
  action: 'getData',
  caseId: '5008c00000XYZ'
}, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Message failed:', chrome.runtime.lastError);
    return;
  }
  
  console.log('Response:', response);
});

// ========== SERVICE WORKER → CONTENT SCRIPT ==========

// Send message to specific tab
chrome.tabs.sendMessage(tabId, {
  action: 'updateData',
  data: { ... }
}, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Message failed:', chrome.runtime.lastError);
    return;
  }
});

// Send message to all tabs
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, {
      action: 'updateData',
      data: { ... }
    });
  });
});

// ========== LISTENERS (BOTH CONTEXTS) ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  
  // Handle different actions
  switch (message.action) {
    case 'getData':
      const data = this.getData(message.caseId);
      sendResponse({ data });
      return true;  // Keep channel open for async response
      
    case 'updateData':
      this.updateData(message.data);
      sendResponse({ success: true });
      break;
      
    default:
      console.warn('Unknown action:', message.action);
      sendResponse({ error: 'Unknown action' });
  }
  
  return true;  // Keep channel open
});
```

### Cross-Tab Communication (BroadcastChannel)

```javascript
/**
 * BroadcastChannel: Communication between tabs
 * 
 * ✅ GOOD FOR:
 * - Syncing state across tabs
 * - Notifying other tabs of changes
 * - Real-time updates
 * 
 * ❌ NOT FOR:
 * - Communication with service worker (use chrome.runtime)
 * - Persistent data (use chrome.storage)
 */

// ========== SETUP ==========

// Create channel (same name in all tabs)
const channel = new BroadcastChannel('case-sync');

// ========== SEND MESSAGE ==========

// Tab A: Broadcast message
channel.postMessage({
  type: 'caseSwitch',
  caseId: '5008c00000XYZ',
  caseNumber: '12345678',
  timestamp: Date.now()
});

// ========== RECEIVE MESSAGE ==========

// Tab B: Listen for messages
channel.addEventListener('message', (event) => {
  const { type, caseId, caseNumber, timestamp } = event.data;
  
  console.log('Message from other tab:', type, caseId);
  
  // Handle message
  if (type === 'caseSwitch') {
    // Check if this tab should react
    if (window.ExLibrisExtension.currentCaseId !== caseId) {
      console.log('Other tab switched to case:', caseId);
      // Optionally sync state
    }
  }
});

// ========== CLEANUP ==========

// Close channel when done
channel.close();
```

### Storage-Based Sync

```javascript
/**
 * Alternative: Use chrome.storage for cross-context sync
 * 
 * ✅ GOOD FOR:
 * - Simple key-value sync
 * - Persistence + sync
 * - Guaranteed delivery
 * 
 * ❌ NOT FOR:
 * - High-frequency updates (slow)
 * - Large data (10MB limit)
 */

// ========== TAB A: UPDATE STORAGE ==========

await chrome.storage.local.set({
  currentCase: {
    caseId: '5008c00000XYZ',
    caseNumber: '12345678',
    timestamp: Date.now()
  }
});

// ========== TAB B: LISTEN FOR CHANGES ==========

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.currentCase) {
    const newData = changes.currentCase.newValue;
    const oldData = changes.currentCase.oldValue;
    
    console.log('Case changed in other tab:', oldData?.caseId, '=>', newData?.caseId);
    
    // Sync local state
    if (newData) {
      this.handleCaseSwitch(newData);
    }
  }
});
```

---

## State Persistence Strategy

### What to Store Where

```
┌──────────────────────────────────────────────────────┐
│ chrome.storage.sync (~5KB)                           │
│ ✅ User Preferences                                  │
│   - timezone, labelStyle, menuLocation              │
│   - featureFlags                                    │
│ ✅ UI Settings                                       │
│   - theme, fontSize                                 │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ chrome.storage.local (~10MB)                         │
│ ✅ Customer Database                                 │
│   - ~1000 customers with timezones                  │
│ ✅ Timezone Cache                                    │
│   - Institution → timezone mappings                 │
│ ✅ Comment History                                   │
│   - Last 100 comments per case                      │
│ ✅ Bookmarks                                         │
│   - Favorite cases                                  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ window.ExLibrisExtension (in-memory)                │
│ ✅ Navigation State                                  │
│   - currentCaseId, currentCaseNumber               │
│   - lastUrl, isNavigating                          │
│ ✅ Temporary State                                   │
│   - Observers, timers                              │
│ ❌ DON'T store persistent data here                 │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ CaseDataStore (in-memory, pub/sub)                  │
│ ✅ Current Case Data                                 │
│   - All extracted fields                           │
│   - Enriched with customer data                    │
│ ✅ Single source of truth                            │
│ ❌ DON'T store persistent data here                 │
└──────────────────────────────────────────────────────┘
```

### Persistence Checklist

**Before storing data, ask:**

1. **Does it need to survive page refresh?**
   - Yes → chrome.storage
   - No → In-memory (window or module state)

2. **Does it need to sync across devices?**
   - Yes → chrome.storage.sync
   - No → chrome.storage.local or in-memory

3. **How large is the data?**
   - <5KB → chrome.storage.sync (if needs sync)
   - <10MB → chrome.storage.local
   - Larger → Consider external storage or compression

4. **How frequently does it change?**
   - High frequency → In-memory cache + periodic sync
   - Low frequency → Direct chrome.storage writes

5. **Do other contexts need access?**
   - Yes → chrome.storage or message passing
   - No → Module-scoped state

---

## State Validation & Integrity

### Validation Before Use

```javascript
/**
 * ALWAYS validate state before using it
 * 
 * Why: State may be stale due to:
 * - SPA navigation
 * - Tab switches
 * - Data updates
 * - Extension updates
 */

// ========== VALIDATE PAGE CONTEXT ==========

function validateCaseData(data) {
  // 1. Check required fields
  if (!data || !data.caseId || !data.caseNumber) {
    return { valid: false, reason: 'Missing required fields' };
  }
  
  // 2. Validate against current page
  const validation = PageContextValidator.validatePageContextBeforeDisplay(
    data.caseId,
    data.caseNumber
  );
  
  if (!validation.valid) {
    return validation;
  }
  
  // 3. Check data freshness (optional)
  const age = Date.now() - (data.extractedAt || 0);
  const maxAge = 5 * 60 * 1000;  // 5 minutes
  if (age > maxAge) {
    return { valid: false, reason: 'Data too old' };
  }
  
  return { valid: true };
}

// ========== USE VALIDATED DATA ==========

async displayCaseData(data) {
  const validation = validateCaseData(data);
  
  if (!validation.valid) {
    console.warn('Invalid data:', validation.reason);
    this.clearDisplay();
    return false;
  }
  
  // Safe to display
  this.updateUI(data);
  return true;
}
```

### State Synchronization

```javascript
/**
 * Keep state synchronized across contexts
 */

// ========== PATTERN 1: Storage Sync ==========

// Context A: Update state
await chrome.storage.local.set({ currentCase: caseData });

// Context B: Listen for changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.currentCase) {
    const newData = changes.currentCase.newValue;
    this.syncLocalState(newData);
  }
});

// ========== PATTERN 2: Message Passing ==========

// Context A: Broadcast update
chrome.runtime.sendMessage({
  type: 'stateUpdate',
  state: { currentCaseId: '5008c...' }
});

// Context B: Receive update
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'stateUpdate') {
    this.syncLocalState(message.state);
  }
});

// ========== PATTERN 3: Periodic Validation ==========

// Validate state every 2 seconds
setInterval(() => {
  const validation = this.validateCurrentState();
  if (!validation.valid) {
    console.warn('State became invalid:', validation.reason);
    this.clearState();
  }
}, 2000);
```

---

## Next Steps

- **For architecture**: See [02-architecture-and-design.md](./02-architecture-and-design.md)
- **For data flow**: See [04-data-flow.md](./04-data-flow.md)
- **For known issues**: See [06-bugs-and-gaps.md](./06-bugs-and-gaps.md)

---

**[← Back: Data Flow](./04-data-flow.md)** | **[↑ Main Documentation](./explanation.md)** | **[Next: Bugs & Gaps →](./06-bugs-and-gaps.md)**
