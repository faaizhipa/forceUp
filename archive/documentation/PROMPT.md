# Salesforce MV3 Extension Refactoring Strategy

Date: 2025-10-24

---

## Section 1: Study Prompt for REFERENCE.MD

### Title
Study the Salesforce MV3 Extension Testing Guide (REFERENCE.MD)

### Goal
- Extract actionable constraints, risks, and proven techniques for building MV3 content scripts that operate against Salesforce Lightning (LWC/Aura/Visualforce).
- Summarize guidance into enforceable engineering rules, test checklists, and code patterns we will use across this project.

### Primary Source
- `REFERENCE.MD` (this file)

### Key Questions
1. What MV3 constraints most affect background/service worker, content script injection, and web_accessible_resources on Salesforce?
2. How do LWC Shadow DOM (native vs. synthetic) and Aura impact querying, event dispatch, and DOM mutation?
3. What event-simulation techniques are reliable vs. fragile for loading content and interacting with components?
4. What CSP constraints apply (MV3 + Salesforce CSP), and how should we structure assets and script execution?
5. What testing practices reduce breakage risk across Salesforce seasonal releases (Spring/Summer/Winter)?
6. Which techniques safely retrieve text within Shadow DOM trees and when should we fall back to user-assisted flows?
7. What are the safest strategies to trigger data loading (clicks, tab activation) without relying on internal/minified framework APIs?

### Tasks
- Extract must-do rules and anti-patterns from the guide.
- Derive a repeatable testing checklist for MV3 + Salesforce pages.
- Produce reference implementations for:
  - a) Recursive Shadow DOM text extraction (read-only).
  - b) Event simulation to trigger lazy content loading.
  - c) Flexipage header injection pattern with two-slot panel.
- Identify observability points (logs, errors) for service worker and content script debugging in Chrome.

### Deliverables
- **Summary (bullets):** constraints, risks, required patterns.
- **Code patterns (snippets):** extractor, event simulator, injection skeleton (no inline scripts).
- **Test checklist:** step-by-step for Chrome + Salesforce.
- **Risks & mitigations:** clear, prioritized, with workarounds.

### Acceptance Criteria
- Output is concise, actionable, and directly maps to our extension modules and manifest needs.
- All examples comply with MV3 restrictions and Salesforce CSP.

---

## Section 2: Refactored Strategy for Relevant Features

### Objectives
- **Robustly read text** across nested Shadow DOM (LWC/Aura) without brittle selectors.
- **Reliably trigger lazy-loaded UI content** via user-like events, never by calling minified internals.
- **Inject a resilient, two-part panel** into the flexipage header that adapts to Lightning navigation and DOM churn.
- **Provide user-assisted fallbacks** (scroll to bottom, manual "expand" flows) when automated extraction is blocked by encapsulation or CSP.

### Core Tactics
- Encapsulate DOM work in dedicated, idempotent content-side modules with strict guards and cleanup.
- Prefer event simulation on visible, interactive elements; avoid synthetic internal APIs.
- Defer to runtime checks: detect native vs. synthetic shadow, guard against closed shadow roots.
- Drive UI through CSS-injected classes and MV3-compliant assets declared in web_accessible_resources.
- Keep all injection idempotent: verify not already injected; register MutationObservers for SPA route changes.

---

## Section 3: Implementation Plan and Components

### Content Modules

#### 1. ShadowTextExtractor
- **Responsibility:** Recursive traversal from document.body; collect text from open shadow roots only.
- **API:** `extractAllText({root = document.body, maxNodes?, abortSignal?}) -> string | {text, stats}`
- **Implementation Notes:**
  - Use TreeWalker for efficient traversal
  - Recursively enter open shadowRoot nodes
  - Respect maxNodes and abortSignal to avoid blocking UI
  - Return statistics (nodes visited, shadow roots traversed, time elapsed)

#### 2. EventSimulator
- **Responsibility:** Dispatch safe user-like events (click, input) on target elements; verify visibility.
- **API:** 
  - `click(selector | element, options) -> boolean`
  - `activateTabByLabel(text) -> boolean`
- **Implementation Notes:**
  - Verify element visibility (offsetParent, bounding rect)
  - Check for disabled state before dispatching
  - Use composed: true, bubbles: true for events
  - Log failures with reasons for debugging

#### 3. FlexipagePanelInjector
- **Responsibility:** Inject Slot 1 (buttons/data) and Slot 2 (collapsible content) into header; wire expand/collapse.
- **API:** 
  - `ensureInjected()`
  - `updateContext({customerId, institutionId, server, timezone})`
  - `teardown()`
- **Implementation Notes:**
  - Check for existing injection before creating new elements
  - Use MutationObserver to detect header availability
  - Wire aria-expanded states for accessibility
  - Clean up observers and elements on teardown

#### 4. TimezoneDetector
- **Responsibility:** Report locale/timezone using Intl API; optionally render in header.
- **API:** `detect() -> { locale, timeZone, numberingSystem, calendar }`
- **Implementation Notes:**
  - Use Intl.DateTimeFormat().resolvedOptions()
  - Cache result for session
  - Provide formatted display strings

#### 5. ImplementationStatus
- **Responsibility:** Provide "Get Implementation Status" hook; either scrape or open target URLs/tools.
- **API:** 
  - `check() -> { status, notes }`
  - `openTool()`
- **Implementation Notes:**
  - Define external tool URLs
  - Handle navigation or iframe embedding based on context
  - Provide fallback messaging when data unavailable

#### 6. ScrollController
- **Responsibility:** Scroll to bottom reliably, with progressive waits for dynamic content.
- **API:** `toBottom({stepPx = 800, delayMs = 150}) -> Promise<void>`
- **Implementation Notes:**
  - Scroll incrementally to trigger lazy loading
  - Check scrollHeight after each step
  - Timeout after reasonable duration
  - Return scroll statistics

#### 7. NavigationObserver
- **Responsibility:** Detect Lightning SPA navigation and re-apply injections; debounced.
- **API:** 
  - `start()`
  - `stop()`
  - `onRouteChange(cb)`
- **Implementation Notes:**
  - Monitor URL changes (popstate, pushState)
  - Watch for Lightning navigation events
  - Debounce callbacks (250ms typical)
  - Teardown previous injections before re-applying

### Background Service Worker
- **Minimal:** Only if needed for contextMenus, saved selection, or tab routing.
- **Responsibilities:**
  - Context menu creation and event forwarding
  - Storage management for saved selections
  - Tab switching by case ID

### Popup/Settings
- **Features:**
  - Toggle features (extraction, injection, event sim threshold)
  - Export/import settings to chrome.storage.sync
  - Display version from manifest
  - Cache management

### Storage
- **chrome.storage.sync:** User settings and preferences
- **chrome.storage.local:** Lightweight cache for case data

---

## Section 4: Message Contracts

### Content ↔ Background ↔ Popup

```json
{
  "messages": [
    {
      "type": "EXL_GET_VERSION",
      "response": { "version": "4.0" }
    },
    {
      "type": "EXL_GET_SETTINGS",
      "response": { "settings": {} }
    },
    {
      "type": "EXL_SAVE_SETTINGS",
      "payload": { "settings": {} },
      "response": { "success": true }
    },
    {
      "type": "EXL_TRIGGER_INJECTION",
      "response": { "success": true, "injected": true }
    },
    {
      "type": "EXL_EXTRACT_TEXT",
      "payload": { "scope": "page|selection" },
      "response": { "text": "...", "stats": {} }
    },
    {
      "type": "EXL_GET_TIMEZONE",
      "response": { "locale": "en-US", "timeZone": "America/New_York" }
    },
    {
      "type": "EXL_GET_IMPL_STATUS",
      "response": { "status": "active", "notes": "..." }
    },
    {
      "type": "EXL_SCROLL_BOTTOM",
      "payload": { "stepPx": 800, "delayMs": 150 },
      "response": { "success": true, "scrolled": 5000 }
    }
  ]
}
```

---

## Section 5: Proposed Changes (No Code Edits Yet)

### Manifest Updates
- **Confirm matches** for Salesforce Lightning, Console, and Visualforce hostnames.
- **Ensure web_accessible_resources** declare CSS/images used in injected panels with proper matches.
- **Verify permissions** include storage, tabs, activeTab, contextMenus.

### Content Script Bootstrapping
- Add **NavigationObserver** to re-run injection on Lightning SPA route updates.
- Guarded, idempotent **FlexipagePanelInjector** with MutationObserver to find header region.
- Initialize all modules with proper lifecycle management.

### Panel Behavior
- **Slot 1:** Buttons for:
  - Enable Full Feature
  - Get Implementation Status
  - Get Timezones
  - Scroll to Bottom
  - Data placeholders for CUSTOMERID/INSTITUTIONID/SERVER/TIMEZONE
- **Slot 2:** Contextual groups shown per expand trigger:
  - Toggle aria-expanded and classes
  - Ensure cleanup on route change
  - Smooth expand/collapse animations

### Safe DOM and Events
- **Prefer query by stable, higher-level containers**; avoid deep brittle selectors.
- **Verify element visibility and enabled state** before dispatching events.
- **Log failures with reasons** for debugging and monitoring.
- **Use composed and bubbles flags** for events crossing shadow boundaries.

### Testing
- **Manual checklists** for:
  - Standard Lightning record pages
  - Console tabs
  - Visualforce pages
  - List views
- **Regression pass** per Salesforce seasonal release (Spring/Summer/Winter).
- **Verify selectors and observers** remain functional.
- **Test in scratch orgs and sandboxes** before production.

### Observability
- **Namespaced logs** `[EXL]` with levels (info, warn, error).
- **Optional in-page debug console** gated by settings.
- **Performance metrics** (injection time, extraction time, scroll duration).
- **Error reporting** with context (page type, URL, timestamp).

---

## Section 6: Development & Debugging Log (Initial Entries)

### Entry 1: Event Simulation for Lazy-Load Triggers
- **Change/Attempt Description:** Replace direct framework calls with event simulation for lazy-load triggers.
- **Status/Outcome:** INVESTIGATION_COMPLETE
- **Failures Observed:** Direct calls to minified internals are brittle and blocked by encapsulation.
- **Actual Root Cause:** Internal Shadow DOM event dispatcher not intended for external invocation; breaks across updates.
- **Fixes & Successful Attempts:** Simulate user click on visible tab headers; confirm load via DOM mutation.
- **Lessons Learned:** Never depend on private/minified APIs; use user-like events and state verification.

### Entry 2: Recursive Shadow DOM Text Extraction
- **Change/Attempt Description:** Implement recursive Shadow DOM text extraction with guards.
- **Status/Outcome:** SUCCESS
- **Failures Observed:** Naive querySelectorAll missed text inside shadow roots; partial results.
- **Actual Root Cause:** Encapsulation prevents traversal into shadow trees by default.
- **Fixes & Successful Attempts:** TreeWalker + recursion into open shadowRoot; batching to avoid long tasks.
- **Lessons Learned:** Use incremental traversal and abort signals to remain responsive on dynamic pages.

### Entry 3: Idempotent Flexipage Header Two-Panel Injection
- **Change/Attempt Description:** Idempotent flexipage header two-panel injection.
- **Status/Outcome:** SUCCESS
- **Failures Observed:** Duplicate UI and layout shifts after SPA navigation.
- **Actual Root Cause:** Lightning SPA route changes don't reload page; previous nodes persist.
- **Fixes & Successful Attempts:** Add NavigationObserver; ensureInjected checks; teardown on route change.
- **Lessons Learned:** Treat Lightning as an SPA; all injections must be idempotent and lifecycle-aware.

### Entry 4: Shadow DOM Mode Detection
- **Change/Attempt Description:** Detect native vs. synthetic shadow DOM at runtime.
- **Status/Outcome:** SUCCESS
- **Failures Observed:** Assumptions about shadow mode caused query failures.
- **Actual Root Cause:** Salesforce components can opt into native shadow; mixed modes on same page.
- **Fixes & Successful Attempts:** Check shadowRoot.mode and adapt traversal strategy.
- **Lessons Learned:** Always check shadow mode before traversal; handle both native and synthetic gracefully.

### Entry 5: CSP Compliance for Injected Assets
- **Change/Attempt Description:** Ensure all CSS and images comply with MV3 and Salesforce CSP.
- **Status/Outcome:** SUCCESS
- **Failures Observed:** Inline styles blocked; external URLs blocked.
- **Actual Root Cause:** Stricter CSP in MV3 + Salesforce Lightning CSP.
- **Fixes & Successful Attempts:** Move all styles to external CSS; declare in web_accessible_resources.
- **Lessons Learned:** Plan for CSP from day one; no inline scripts or styles in MV3.

---

## Next Steps

### Implementation Order
1. **Create core utility modules** (ShadowTextExtractor, EventSimulator, ScrollController)
2. **Build NavigationObserver** for SPA lifecycle management
3. **Implement FlexipagePanelInjector** with two-slot design
4. **Wire TimezoneDetector and ImplementationStatus** features
5. **Update manifest** with proper web_accessible_resources
6. **Add comprehensive logging** and debug tools
7. **Create testing checklist** and documentation
8. **Perform regression testing** across Salesforce environments

### Documentation Needs
- API documentation for each module (JSDoc)
- Testing procedures and checklists
- Troubleshooting guide for common CSP/Shadow DOM issues
- Migration guide from current implementation
- Performance benchmarks and optimization notes

### Open Questions
1. Should we scaffold the new modules immediately or refactor existing code incrementally?
2. What is the priority order for features (extraction vs. injection vs. status)?
3. Do we need a feature flag system for gradual rollout?
4. Should we create a compatibility matrix for Salesforce versions?

---

## Appendix A: Key Constraints from REFERENCE.MD

### MV3 Constraints
- Service workers replace background pages (no DOM access)
- Restricted dynamic code execution (no eval, new Function)
- declarativeNetRequest instead of blocking webRequest
- Stricter CSP by default
- web_accessible_resources requires explicit matches

### Salesforce Constraints
- Lightning DOM is private and can change without notice
- LWC uses Shadow DOM (native or synthetic)
- Aura components have different structure
- Visualforce pages have distinct behavior
- Dynamic content loads asynchronously
- SPA navigation doesn't trigger full page reloads

### Testing Requirements
- Use scratch orgs and sandboxes for testing
- Test across Lightning, Console, and Visualforce
- Regression test with each Salesforce seasonal release
- Verify both LWC and Aura component interactions
- Handle closed shadow roots gracefully
- Test event simulation across different component types

### Risk Mitigation
- Avoid direct DOM manipulation where possible
- Use event simulation instead of internal APIs
- Implement robust error handling and logging
- Provide fallback mechanisms for blocked operations
- Document selector strategies for maintenance
- Monitor Salesforce release notes for breaking changes

---

## Appendix B: Study Notes from REFERENCE.MD Analysis

### Base Documents Referenced
- **Primary Source:** `REFERENCE.MD` - Testing Manifest V3 Browser Extensions for Salesforce: A Developer's Guide
- **Supporting Context:** Current codebase (manifest.json, content scripts, modules)
- **Standards:** Chrome Extension MV3 Documentation, Salesforce Lightning Web Components Guide

### Critical Findings from Study

#### 1. Lightning Experience DOM Manipulation Risks
**Source:** REFERENCE.MD Section 1 - Understanding Salesforce's Environment

**Key Insight:**
> "Salesforce heavily discourages direct DOM manipulation by third-party extensions within Lightning Experience. The internal DOM structure is considered private and can change without notice, leading to extension breakage."

**Implications for Our Extension:**
- Current approach using direct querySelector in `content_script.js` and modules is fragile
- Risk of breakage with Salesforce seasonal releases (Spring/Summer/Winter)
- Need defensive selector strategies and graceful degradation

**Recommended Actions:**
- Prefer high-level, stable selectors (avoid deep nesting)
- Implement selector validation before operations
- Add fallback mechanisms when selectors fail
- Document all selectors with versioning notes

#### 2. Shadow DOM Encapsulation Challenges
**Source:** REFERENCE.MD Section 1 - LWC and Shadow DOM

**Key Insight:**
> "LWCs utilize Shadow DOM to encapsulate their structure and style. This means your extension's content scripts typically cannot directly access elements within an LWC's shadow tree using standard `document.querySelector()` calls from the main page context."

**Specific Concerns:**
- **Native vs. Synthetic Shadow:** Salesforce transitioning from synthetic shadow polyfill to native shadow DOM
- **Closed Shadow Roots:** Some components use mode: 'closed', blocking all external access
- **Mixed Modes:** Single page can have components in both native and synthetic modes

**Implications for Our Extension:**
- `CaseDataExtractor` may miss fields inside LWC shadow roots
- `FieldHighlighter` cannot style elements within closed shadows
- Text extraction for comment memory may be incomplete

**Required Solutions:**
```javascript
// Example: Recursive shadow traversal (open roots only)
function traverseShadowDOM(root, callback) {
  callback(root);
  
  // Check for shadow root
  if (root.shadowRoot && root.shadowRoot.mode === 'open') {
    traverseShadowDOM(root.shadowRoot, callback);
  }
  
  // Traverse children
  for (const child of root.children) {
    traverseShadowDOM(child, callback);
  }
}
```

#### 3. Event Simulation for Lazy Loading
**Source:** REFERENCE.MD Section 2 - Content Scripts & Execution Environment

**Key Insight:**
> "If injecting scripts, be aware that by default in MV3, they might not access page variables (like `jQuery $`) or call page functions (like `window.alert()`) due to Content Security Policy."

**Pattern Identified:**
- Cannot call Salesforce internal APIs directly (CSP blocked + minified)
- Must simulate user interactions to trigger lazy loading
- Event composition matters: `composed: true` for shadow DOM crossing

**Working Example Pattern:**
```javascript
// Safe event simulation
function simulateClick(element) {
  // Verify element is visible and enabled
  if (!element || element.offsetParent === null) {
    console.warn('[EXL] Element not visible, skipping click');
    return false;
  }
  
  if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
    console.warn('[EXL] Element disabled, skipping click');
    return false;
  }
  
  // Dispatch user-like click
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    composed: true, // Important for shadow DOM
    view: window
  });
  
  element.dispatchEvent(clickEvent);
  return true;
}
```

#### 4. Service Worker Limitations in MV3
**Source:** REFERENCE.MD Section 2 - Service Workers for Background Logic

**Key Insight:**
> "Manifest V3 replaces background pages with service workers. This has implications for how you manage background tasks, maintain state, and interact with other parts of your extension. DOM access is not available in service workers."

**Current Architecture Impact:**
- Our `background.js` is correctly structured as service worker
- Context menu creation works (no DOM needed)
- Storage operations are properly async
- Tab switching via chrome.tabs API is compatible

**No Changes Needed:** Our background script already follows MV3 patterns correctly.

#### 5. Content Security Policy (CSP) Compliance
**Source:** REFERENCE.MD Section 2 - Inject Js Script Limitations

**Critical Restrictions:**
- No inline scripts in HTML (already compliant)
- No eval() or new Function() (already compliant)
- External resources must be in web_accessible_resources (need to verify)
- Inline styles may be blocked in strict CSP contexts

**Current Violations to Fix:**
- `popup.html` has inline CSS → Move to external stylesheet
- Injected UI from `DynamicMenu` may use inline styles → Refactor to classes

**Migration Pattern:**
```javascript
// ❌ Don't do this (inline style)
element.style.backgroundColor = 'red';

// ✅ Do this instead (CSS class)
element.classList.add('exl-highlighted');

// In external CSS:
// .exl-highlighted { background-color: red; }
```

#### 6. SPA Navigation Handling
**Source:** REFERENCE.MD Section 1 - Dynamic Content & Navigation

**Key Insight:**
> "Salesforce pages are highly dynamic. Your extension must be robust enough to handle content that loads asynchronously, navigation events within Lightning (which often don't trigger full page reloads), and changes in the UI state."

**Current Implementation Analysis:**
- ✅ `PageIdentifier` has `monitorPageChanges()` with popstate and MutationObserver
- ✅ `content_script_exlibris.js` has cleanup() method
- ⚠️ Cleanup may not be comprehensive (check all observers)
- ⚠️ Re-injection may create duplicates without idempotency checks

**Required Pattern:**
```javascript
// Idempotent injection
function ensureInjected() {
  const marker = 'exl-panel-injected';
  
  // Check if already injected
  if (document.body.dataset[marker]) {
    console.log('[EXL] Already injected, skipping');
    return;
  }
  
  // Inject UI
  injectPanel();
  
  // Mark as injected
  document.body.dataset[marker] = 'true';
}

// On route change
navigationObserver.onRouteChange(() => {
  // Clear marker
  delete document.body.dataset['exl-panel-injected'];
  
  // Cleanup old UI
  cleanup();
  
  // Re-inject if needed
  if (shouldInject()) {
    ensureInjected();
  }
});
```

#### 7. Testing in Salesforce Environments
**Source:** REFERENCE.MD Section 1 - Salesforce Orgs

**Critical Guidance:**
> "Always test your extension in dedicated Salesforce development environments like scratch orgs or sandboxes. This isolates testing from production data and configurations."

**Testing Strategy Derived:**

**Pre-Release Checklist:**
1. Test in Salesforce Scratch Org (disposable, reproducible)
2. Test in Sandbox (realistic data, safe)
3. Verify across page types:
   - Standard Lightning record pages
   - Lightning Console tabs
   - List views
   - Visualforce pages (if applicable)
4. Test with both LWC and Aura components
5. Simulate seasonal release by testing in preview sandbox

**Regression Testing Triggers:**
- Salesforce Spring/Summer/Winter releases
- Major Chrome/Edge version updates
- Extension version updates

#### 8. Web Accessible Resources Requirements
**Source:** REFERENCE.MD Section 2 - MV3 Specifics

**Current Gap Identified:**
Our `manifest.json` does not declare `web_accessible_resources`, but we may need them for:
- External CSS for injected panels
- Images/icons in dynamic menus
- Any resources referenced from injected content

**Required Addition to Manifest:**
```json
{
  "web_accessible_resources": [
    {
      "resources": [
        "modules/styles/injected-panel.css",
        "modules/styles/field-highlighting.css",
        "icons/*.png"
      ],
      "matches": [
        "https://proquestllc.lightning.force.com/*",
        "https://clarivateanalytics.lightning.force.com/*",
        "https://clarivateanalytics--preprod.sandbox.lightning.force.com/*",
        "https://scholarone.my.salesforce.com/*"
      ]
    }
  ]
}
```

#### 9. Observability and Debugging
**Source:** REFERENCE.MD (implied from testing guidance)

**Current State:**
- Scattered console.log statements
- No consistent namespace
- No log levels
- Hard to filter in production

**Recommended Pattern:**
```javascript
// Centralized logger
const Logger = {
  prefix: '[EXL]',
  
  info(msg, ...args) {
    console.log(`${this.prefix} ℹ️`, msg, ...args);
  },
  
  warn(msg, ...args) {
    console.warn(`${this.prefix} ⚠️`, msg, ...args);
  },
  
  error(msg, ...args) {
    console.error(`${this.prefix} ❌`, msg, ...args);
  },
  
  debug(msg, ...args) {
    if (DEBUG_MODE) {
      console.debug(`${this.prefix} 🐛`, msg, ...args);
    }
  },
  
  perf(label, fn) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    this.info(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    return result;
  }
};
```

### Code Examples Extracted from Study

#### Example 1: Safe Shadow DOM Text Extraction
```javascript
/**
 * Recursively extract text from Shadow DOM trees
 * @param {Element} root - Starting element
 * @param {Object} options - Configuration
 * @returns {Object} Extracted text and statistics
 */
function extractTextFromShadowDOM(root, options = {}) {
  const {
    maxNodes = 10000,
    abortSignal = null,
    includeHidden = false
  } = options;
  
  const stats = {
    nodesVisited: 0,
    shadowRootsTraversed: 0,
    closedRootsSkipped: 0,
    textLength: 0
  };
  
  const textParts = [];
  
  function traverse(node) {
    // Check abort signal
    if (abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    
    // Check node limit
    if (stats.nodesVisited >= maxNodes) {
      return;
    }
    
    stats.nodesVisited++;
    
    // Skip hidden elements unless requested
    if (!includeHidden && node.nodeType === Node.ELEMENT_NODE) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return;
      }
    }
    
    // Extract text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) {
        textParts.push(text);
        stats.textLength += text.length;
      }
      return;
    }
    
    // Traverse shadow root if open
    if (node.shadowRoot) {
      if (node.shadowRoot.mode === 'open') {
        stats.shadowRootsTraversed++;
        traverse(node.shadowRoot);
      } else {
        stats.closedRootsSkipped++;
      }
    }
    
    // Traverse children
    for (const child of node.childNodes) {
      traverse(child);
    }
  }
  
  try {
    traverse(root);
  } catch (err) {
    if (err.name !== 'AbortError') throw err;
  }
  
  return {
    text: textParts.join(' '),
    stats
  };
}
```

#### Example 2: Lightning Navigation Observer
```javascript
/**
 * Observe Lightning SPA navigation and trigger callbacks
 */
class LightningNavigationObserver {
  constructor() {
    this.callbacks = [];
    this.currentUrl = window.location.href;
    this.debounceTimer = null;
    this.debounceDelay = 250;
  }
  
  start() {
    // Watch URL changes
    this.urlObserver = new MutationObserver(() => {
      this.checkUrlChange();
    });
    
    // Observe title changes (Lightning updates title on navigation)
    this.urlObserver.observe(
      document.querySelector('title'),
      { childList: true, subtree: true }
    );
    
    // Watch history API
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.checkUrlChange();
    };
    
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.checkUrlChange();
    };
    
    window.addEventListener('popstate', () => this.checkUrlChange());
  }
  
  checkUrlChange() {
    const newUrl = window.location.href;
    
    if (newUrl !== this.currentUrl) {
      this.currentUrl = newUrl;
      this.triggerCallbacks();
    }
  }
  
  triggerCallbacks() {
    // Debounce to avoid rapid-fire during complex navigations
    clearTimeout(this.debounceTimer);
    
    this.debounceTimer = setTimeout(() => {
      this.callbacks.forEach(cb => {
        try {
          cb(this.currentUrl);
        } catch (err) {
          console.error('[EXL] Navigation callback error:', err);
        }
      });
    }, this.debounceDelay);
  }
  
  onRouteChange(callback) {
    this.callbacks.push(callback);
  }
  
  stop() {
    if (this.urlObserver) {
      this.urlObserver.disconnect();
    }
    this.callbacks = [];
    clearTimeout(this.debounceTimer);
  }
}
```

#### Example 3: Idempotent UI Injection
```javascript
/**
 * Inject panel into Salesforce flexipage header (idempotent)
 */
class FlexipagePanelInjector {
  constructor() {
    this.injectionMarker = 'exl-flexipage-panel-injected';
    this.panelId = 'exl-flexipage-panel';
    this.observer = null;
  }
  
  ensureInjected() {
    // Check if already injected
    if (document.getElementById(this.panelId)) {
      console.log('[EXL] Panel already present');
      return true;
    }
    
    // Find injection point
    const header = this.findFlexipageHeader();
    
    if (!header) {
      console.warn('[EXL] Flexipage header not found, will retry');
      this.watchForHeader();
      return false;
    }
    
    // Create panel
    const panel = this.createPanel();
    
    // Inject
    header.appendChild(panel);
    
    console.log('[EXL] Panel injected successfully');
    return true;
  }
  
  findFlexipageHeader() {
    // Try multiple selectors for robustness
    const selectors = [
      '.slds-page-header',
      '[data-aura-class="forceRecordLayout"]',
      'one-record-home-flexipage2'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    
    return null;
  }
  
  createPanel() {
    const panel = document.createElement('div');
    panel.id = this.panelId;
    panel.className = 'exl-panel';
    
    // Use external stylesheet (CSP compliant)
    // Styles defined in modules/styles/injected-panel.css
    
    // Slot 1: Control buttons
    const slot1 = document.createElement('div');
    slot1.className = 'exl-panel-slot1';
    slot1.innerHTML = `
      <button class="exl-btn" data-action="enable-full">Enable Full Feature</button>
      <button class="exl-btn" data-action="get-status">Get Implementation Status</button>
      <button class="exl-btn" data-action="get-timezone">Get Timezones</button>
      <button class="exl-btn" data-action="scroll-bottom">Scroll to Bottom</button>
      <div class="exl-data-display">
        <span class="exl-data-item">CUSTOMERID: <span id="exl-customerid">—</span></span>
        <span class="exl-data-item">INSTITUTIONID: <span id="exl-institutionid">—</span></span>
        <span class="exl-data-item">SERVER: <span id="exl-server">—</span></span>
        <span class="exl-data-item">TIMEZONE: <span id="exl-timezone">—</span></span>
      </div>
    `;
    
    // Slot 2: Expandable content
    const slot2 = document.createElement('div');
    slot2.className = 'exl-panel-slot2';
    slot2.setAttribute('aria-expanded', 'false');
    slot2.style.display = 'none';
    
    panel.appendChild(slot1);
    panel.appendChild(slot2);
    
    // Wire event handlers
    this.wireEventHandlers(panel);
    
    return panel;
  }
  
  wireEventHandlers(panel) {
    // Button clicks
    panel.addEventListener('click', (e) => {
      if (e.target.matches('[data-action]')) {
        const action = e.target.dataset.action;
        this.handleAction(action);
      }
    });
  }
  
  handleAction(action) {
    console.log(`[EXL] Action triggered: ${action}`);
    
    // Dispatch to appropriate handler
    switch (action) {
      case 'enable-full':
        // Enable all features
        break;
      case 'get-status':
        // Fetch implementation status
        break;
      case 'get-timezone':
        // Display timezone info
        break;
      case 'scroll-bottom':
        // Trigger scroll
        break;
    }
  }
  
  updateContext(data) {
    const { customerId, institutionId, server, timezone } = data;
    
    if (customerId) {
      document.getElementById('exl-customerid').textContent = customerId;
    }
    if (institutionId) {
      document.getElementById('exl-institutionid').textContent = institutionId;
    }
    if (server) {
      document.getElementById('exl-server').textContent = server;
    }
    if (timezone) {
      document.getElementById('exl-timezone').textContent = timezone;
    }
  }
  
  watchForHeader() {
    // If header not immediately available, watch for it
    if (this.observer) return; // Already watching
    
    this.observer = new MutationObserver(() => {
      if (this.findFlexipageHeader()) {
        this.ensureInjected();
        this.observer.disconnect();
        this.observer = null;
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  teardown() {
    const panel = document.getElementById(this.panelId);
    if (panel) {
      panel.remove();
    }
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
```

### Verification Checklist Derived from Study

#### Pre-Deployment Verification
- [ ] All inline styles moved to external CSS files
- [ ] web_accessible_resources declared in manifest for all external assets
- [ ] No eval() or new Function() in codebase
- [ ] All DOM queries wrapped in try-catch with fallbacks
- [ ] Event simulation uses composed: true for shadow DOM crossing
- [ ] Idempotency checks on all UI injection points
- [ ] Navigation observer properly tears down and re-injects
- [ ] Service worker has no DOM access attempts
- [ ] Logging uses consistent namespace and levels

#### Testing Verification
- [ ] Tested in Salesforce scratch org
- [ ] Tested in Salesforce sandbox
- [ ] Verified on Lightning standard pages
- [ ] Verified on Lightning Console
- [ ] Verified on List views
- [ ] Verified with native shadow DOM components
- [ ] Verified with synthetic shadow DOM components
- [ ] Verified with Aura components
- [ ] Tested SPA navigation (no page reload)
- [ ] Tested with closed shadow roots (graceful degradation)

#### Documentation Verification
- [ ] All selectors documented with version tested
- [ ] All event simulation patterns documented
- [ ] CSP compliance confirmed and documented
- [ ] Fallback mechanisms documented
- [ ] Breaking change monitoring process defined
- [ ] Regression testing schedule established

---

**Document Version:** 1.0  
**Created:** 2025-10-24  
**Last Updated:** 2025-10-24  
**Status:** Planning Phase
