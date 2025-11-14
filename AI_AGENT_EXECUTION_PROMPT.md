# AI Agent Execution Prompt
**Systematic Debugging and Enhancement Plan**

**Version:** 1.0
**Last Updated:** November 10, 2025
**Purpose:** Guide AI agents through systematic fixing of critical issues

---

## 🎯 Mission Objective

You are an expert Chrome Extension developer tasked with systematically fixing critical issues in the Penang CoE CForce Extension. Your mission is to:

1. **Fix 15+ critical bugs** (memory leaks, security vulnerabilities, performance issues)
2. **Maintain functionality** (all features must continue working)
3. **Follow best practices** (as defined in DEVELOPER_BEST_PRACTICES.md)
4. **Document all changes** (update CHANGELOG.md)
5. **Test thoroughly** (manual testing after each fix)

---

## 📋 Required Reading (Load These First)

Before starting ANY work, you MUST read and understand:

1. **[CODEBASE_EXPLANATION.md](CODEBASE_EXPLANATION.md)** - Complete technical reference
   - Section 6: Module Directory (understand each module)
   - Section 9: Critical Security & Performance Issues (all issues listed)
   - Section 10: Development Best Practices (patterns to follow)

2. **[DEVELOPER_BEST_PRACTICES.md](DEVELOPER_BEST_PRACTICES.md)** - Coding standards
   - Section 2: DO's and DON'Ts (mandatory patterns)
   - Section 3: Module Development (module template)
   - Section 4: Memory Management (cleanup patterns)
   - Section 5: Error Handling (try-catch patterns)

3. **[copilot-instructions.md](copilot-instructions.md)** - Quick reference
   - Critical Issues section (prioritized list)
   - MUST-DO Patterns section (required patterns)
   - NEVER DO section (forbidden patterns)

4. **[CHANGELOG.md](CHANGELOG.md)** - Development history
   - Review existing entries to understand context
   - You will update this after EVERY change

---

## 🔴 Phase 1: Critical Memory Leaks (Week 1 Priority)

### Context
Multiple modules create MutationObservers, event listeners, and timers but never clean them up. This causes memory accumulation over time, especially during SPA navigation between case pages.

### Your Task
Fix all 5 memory leak issues by adding proper cleanup methods.

---

### Issue 1.1: caseCommentExtractor.js - MutationObserver Leak

**File:** `modules/caseCommentExtractor.js`
**Line:** 796
**Problem:** MutationObserver `extractorObserver` created but never disconnected

**Current Code:**
```javascript
// Line 796
extractorObserver = new MutationObserver((mutations, obs) => {
    // ... observer code
});
extractorObserver.observe(document.body, { childList: true, subtree: true });
```

**Required Fix:**
1. Track the observer in module-level variable
2. Add cleanup() method to module's public API
3. Disconnect observer in cleanup()
4. Call cleanup() from ExLibrisExtension.cleanup()

**Fix Template:**
```javascript
const CaseCommentExtractor = (function() {
    'use strict';

    // Track observer
    let extractorObserver = null;

    // ... existing code ...

    return {
        // ... existing methods ...

        /**
         * Cleanup all resources
         * CRITICAL: Must be called on navigation
         */
        cleanup: function() {
            console.log('[CaseCommentExtractor] Cleaning up...');

            // Disconnect observer
            if (extractorObserver) {
                extractorObserver.disconnect();
                extractorObserver = null;
            }

            // Any other cleanup needed
        }
    };
})();
```

**Integration Required:**
In `content_script_exlibris.js`, update the `cleanup()` method:
```javascript
cleanup() {
    // ... existing cleanup ...

    // Add this:
    if (typeof CaseCommentExtractor !== 'undefined' && CaseCommentExtractor.cleanup) {
        CaseCommentExtractor.cleanup();
    }
}
```

**Testing Steps:**
1. Load extension in chrome://extensions
2. Navigate to ProQuest Salesforce case page
3. Open DevTools Console → Check for "[CaseCommentExtractor] Cleaning up..." log
4. Navigate to different case page (should see cleanup log)
5. Open DevTools Memory tab → Take heap snapshot
6. Navigate between 10 case pages
7. Take another heap snapshot → Compare (should NOT see orphaned MutationObserver)

**Update CHANGELOG.md:**
```markdown
## [2025-11-XX] - AI Agent

### Changes Made
- **File(s):** modules/caseCommentExtractor.js, content_script_exlibris.js
- **Type:** Bug Fix
- **Description:** Fixed critical memory leak - MutationObserver now properly disconnected on navigation

### Reason
MutationObserver was created but never disconnected, causing memory accumulation during SPA navigation between case pages.

### Testing
- [x] Manual testing performed
- [x] No console errors
- [x] Memory leak check passed (heap growth < 10MB after 10 navigations)
- [x] Feature works as expected (comment extraction still functional)

### Lessons Learned
Always disconnect MutationObservers when no longer needed, especially in SPA environments where navigation doesn't reload the page.

### Related Issues
Critical Issue #1 from CODEBASE_EXPLANATION.md Section 9.2
```

---

### Issue 1.2: persistentBanner.js - Event Listener Leak

**File:** `modules/persistentBanner.js`
**Line:** 118
**Problem:** Event listeners added with `document.addEventListener()` but never removed

**Current Code:**
```javascript
// Line 118
setupCaseDataListener() {
    document.addEventListener('casePageDataExtracted', (event) => {
        const data = event.detail;
        // ... handle data
    });
}
```

**Required Fix:**
1. Store reference to handler function
2. Track all event listeners
3. Remove them in cleanup()

**Fix Template:**
```javascript
const PersistentBanner = (function() {
    'use strict';

    // Track event handlers
    const eventHandlers = [];

    /**
     * Helper to add tracked event listener
     */
    function addTrackedListener(element, event, handler) {
        element.addEventListener(event, handler);
        eventHandlers.push({ element, event, handler });
    }

    /**
     * Setup case data listener
     */
    function setupCaseDataListener() {
        // Store handler reference
        const handleCaseData = (event) => {
            const data = event.detail;
            // ... handle data
        };

        // Add with tracking
        addTrackedListener(document, 'casePageDataExtracted', handleCaseData);
    }

    return {
        // ... existing methods ...

        /**
         * Cleanup all resources
         */
        cleanup: function() {
            console.log('[PersistentBanner] Cleaning up...');

            // Remove all tracked listeners
            eventHandlers.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
            eventHandlers.length = 0; // Clear array

            // Remove banner from DOM if exists
            const banner = document.getElementById('exl-persistent-banner');
            if (banner) {
                banner.remove();
            }
        }
    };
})();
```

**Testing Steps:**
1. Navigate to case page
2. Verify banner appears
3. Navigate to different case
4. Check console for cleanup log
5. Navigate between 10 pages → No duplicate banners
6. No console errors

**Update CHANGELOG.md** (same format as Issue 1.1)

---

### Issue 1.3: flexipagePanelInjector.js - Document-wide Observer

**File:** `modules/flexipagePanelInjector.js`
**Line:** 859
**Problem:** Observes entire `document.body` with `subtree: true`, massive performance overhead

**Current Code:**
```javascript
// Line 859
watchForHeader() {
    if (this.observer) {
        return;
    }
    this.observer = new MutationObserver(() => {
        const header = this.findFlexipageHeader();
        if (header) {
            this.ensureInjected();
            this.observer.disconnect();
            this.observer = null;
        }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
}
```

**Required Fix:**
1. Observe smaller subtree if possible
2. Ensure disconnect is called in all code paths
3. Add cleanup() method

**Fix Template:**
```javascript
const FlexipagePanelInjector = (function() {
    'use strict';

    let observer = null;

    function watchForHeader() {
        if (observer) {
            return;
        }

        observer = new MutationObserver(() => {
            const header = this.findFlexipageHeader();
            if (header) {
                console.log('[FlexipagePanelInjector] Header found, injecting panel');
                this.ensureInjected();

                // CRITICAL: Disconnect immediately
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
            }
        });

        // Try to observe smaller subtree
        const container = document.querySelector('.slds-page-header') ||
                         document.querySelector('article[class*="forceBaseCard"]') ||
                         document.body;

        observer.observe(container, {
            childList: true,
            subtree: container === document.body // Only use subtree for body
        });
    }

    return {
        // ... existing methods ...

        /**
         * Cleanup and teardown
         */
        teardown: function() {
            console.log('[FlexipagePanelInjector] Tearing down...');

            // Disconnect observer
            if (observer) {
                observer.disconnect();
                observer = null;
            }

            // Remove injected panel
            const panel = document.getElementById(this.panelId);
            if (panel) {
                panel.remove();
            }
        }
    };
})();
```

**Testing Steps:**
1. Navigate to case page
2. Click "Show Panel" in banner
3. Verify panel appears
4. Navigate to different case
5. Check console for teardown log
6. Click "Show Panel" again → Panel should appear (no errors)

---

### Issue 1.4: caseTimezoneResolver.js - Timer and Observer Leaks

**File:** `modules/caseTimezoneResolver.js`
**Lines:** 334 (timer), 428 (observer)
**Problem:** setInterval and MutationObserver not cleared on navigation

**Current Code:**
```javascript
// Line 334
startCountdownTimer() {
    this.countdownSeconds = 5;
    this.countdownTimer = setInterval(() => {
        this.countdownSeconds--;
        // ... countdown logic
    }, 1000);
}

// Line 428
startHoverPanelObserver() {
    this.hoverObserver = new MutationObserver((mutations) => {
        // ... observer logic
    });
    this.hoverObserver.observe(document.body, { childList: true, subtree: true });
}
```

**Required Fix:**
1. Clear interval in all code paths
2. Disconnect observer after finding hover panel
3. Add comprehensive cleanup() method

**Fix Template:**
```javascript
const CaseTimezoneResolver = (function() {
    'use strict';

    let countdownTimer = null;
    let hoverObserver = null;
    let accountNameField = null;

    function stopCountdownTimer() {
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
    }

    function stopHoverPanelObserver() {
        if (hoverObserver) {
            hoverObserver.disconnect();
            hoverObserver = null;
        }
    }

    function startCountdownTimer() {
        // Clear any existing timer first
        stopCountdownTimer();

        countdownSeconds = 5;
        countdownTimer = setInterval(() => {
            countdownSeconds--;

            if (countdownSeconds <= 0) {
                stopCountdownTimer(); // Clear when done
                handleCountdownComplete();
            } else if (countdownSeconds === 2) {
                checkForExistingHoverPanel();
            }
        }, 1000);
    }

    function startHoverPanelObserver() {
        // Clear any existing observer first
        stopHoverPanelObserver();

        hoverObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 &&
                        node.tagName === 'DIV' &&
                        node.getAttribute('name') === 'dialog') {

                        console.log('[CaseTimezoneResolver] Hover panel detected');

                        // CRITICAL: Disconnect immediately after finding panel
                        stopHoverPanelObserver();
                        stopCountdownTimer();

                        setTimeout(() => {
                            extractAddressFromPanel(node);
                        }, 500);

                        return;
                    }
                }
            }
        });

        hoverObserver.observe(document.body, { childList: true, subtree: true });
    }

    return {
        // ... existing methods ...

        /**
         * Cleanup all resources
         */
        cleanup: function() {
            console.log('[CaseTimezoneResolver] Cleaning up...');

            // Stop timers
            stopCountdownTimer();

            // Stop observers
            stopHoverPanelObserver();

            // Remove event listeners
            if (accountNameField) {
                accountNameField.removeEventListener('mouseover', onMouseOver);
                accountNameField.removeEventListener('mouseout', onMouseOut);
                accountNameField = null;
            }
        }
    };
})();
```

**Testing Steps:**
1. Navigate to case page
2. Hover over Account Name field
3. Wait for countdown (should trigger at 2 and 0 seconds)
4. Navigate to different case before countdown finishes
5. Check console → Should see cleanup log
6. No timer should continue in background
7. Navigate back → Hover again → Should work correctly

---

### Issue 1.5: pageIdentifier.js - Throttle Timer Leak

**File:** `modules/pageIdentifier.js`
**Line:** 289
**Problem:** Throttle timer not cleared on module destruction

**Current Code:**
```javascript
// Line 289
_handleNavigationChange(callback) {
    if (this._throttleTimer) {
        clearTimeout(this._throttleTimer);
        this._throttleTimer = null;
    }

    this._throttleTimer = setTimeout(() => {
        // ... handle navigation
    }, 300);
}
```

**Required Fix:**
1. Add stop() method to clear timer
2. Call from ExLibrisExtension.cleanup()

**Fix Template:**
```javascript
const PageIdentifier = (function() {
    'use strict';

    let _throttleTimer = null;
    let _urlObserver = null;
    let _callbacks = [];

    function _handleNavigationChange(callback) {
        // Clear existing timer
        if (_throttleTimer) {
            clearTimeout(_throttleTimer);
            _throttleTimer = null;
        }

        _throttleTimer = setTimeout(() => {
            const pageInfo = identifyPage();
            callback(pageInfo);
            _throttleTimer = null; // Clear reference
        }, 300);
    }

    return {
        // ... existing methods ...

        /**
         * Stop monitoring and cleanup
         */
        stop: function() {
            console.log('[PageIdentifier] Stopping...');

            // Clear throttle timer
            if (_throttleTimer) {
                clearTimeout(_throttleTimer);
                _throttleTimer = null;
            }

            // Disconnect observer if exists
            if (_urlObserver) {
                _urlObserver.disconnect();
                _urlObserver = null;
            }

            // Clear callbacks
            _callbacks = [];
        }
    };
})();
```

**Integration:**
```javascript
// In content_script_exlibris.js cleanup()
if (typeof PageIdentifier !== 'undefined' && PageIdentifier.stop) {
    PageIdentifier.stop();
}
```

---

## 🔒 Phase 2: Security Vulnerabilities (Week 1-2 Priority)

### Issue 2.1: domUtilities.js - Incomplete XML Escaping

**File:** `modules/domUtilities.js`
**Lines:** 16-24
**Problem:** Missing control character escaping, potential for invalid XML

**Current Code:**
```javascript
// Lines 16-24
function escapeXML(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
```

**Required Fix:**
```javascript
/**
 * Escape XML special characters and control characters
 * @param {string} str - String to escape
 * @returns {string} XML-safe string
 */
function escapeXML(str) {
    if (typeof str !== 'string') return '';

    return str
        // XML entities (order matters - & must be first)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        // Escape control characters (0x00-0x1F except tab, newline, carriage return)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, (char) => {
            return `&#${char.charCodeAt(0)};`;
        });
}
```

**Testing Steps:**
1. Create test case with special characters:
   ```javascript
   const testCases = [
       'Normal text',
       'Text with <tags>',
       'Text with & ampersand',
       'Text with "quotes"',
       'Text with control chars: \x00\x01\x02',
       'Text with tab\tand\nnewline'
   ];

   testCases.forEach(test => {
       const escaped = DomUtilities.escapeXML(test);
       console.log('Original:', test);
       console.log('Escaped:', escaped);
   });
   ```
2. Extract case comments with special characters
3. Verify XML output is valid (paste into XML validator)
4. Verify no XSS possible

---

### Issue 2.2: caseCommentExtractor.js - XSS Fallback Risk

**File:** `modules/caseCommentExtractor.js`
**Line:** 475
**Problem:** Falls back to no escaping if DomUtilities unavailable

**Current Code:**
```javascript
// Line 475
function generateXML(data) {
    const escape = typeof DomUtilities !== 'undefined' ?
        DomUtilities.escapeXML :
        (str) => str; // ⚠️ NO ESCAPING FALLBACK
```

**Required Fix:**
```javascript
function generateXML(data) {
    // Always provide escaping function
    const escape = typeof DomUtilities !== 'undefined' ?
        DomUtilities.escapeXML :
        escapeXMLFallback;

    // ... rest of function
}

/**
 * Fallback XML escaping if DomUtilities not available
 * @private
 */
function escapeXMLFallback(str) {
    if (typeof str !== 'string') return '';

    console.warn('[CaseCommentExtractor] Using fallback XML escaping');

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, (char) => {
            return `&#${char.charCodeAt(0)};`;
        });
}
```

**Testing:** Same as Issue 2.1

---

### Issue 2.3: persistentBanner.js - innerHTML Injection Risk

**File:** `modules/persistentBanner.js`
**Line:** 948
**Problem:** Uses innerHTML without sanitization

**Current Code:**
```javascript
// Line 948
showFormatMenu() {
    menu.innerHTML = `
        <h3>Select Export Format</h3>
        <button>XML</button>
        <button>TSV</button>
    `;
}
```

**Required Fix:**
```javascript
showFormatMenu() {
    // Clear existing content
    menu.textContent = '';

    // Create elements safely
    const h3 = document.createElement('h3');
    h3.textContent = 'Select Export Format';
    menu.appendChild(h3);

    const xmlButton = document.createElement('button');
    xmlButton.textContent = 'XML';
    xmlButton.className = 'format-button';
    xmlButton.addEventListener('click', () => this.exportAs('xml'));
    menu.appendChild(xmlButton);

    const tsvButton = document.createElement('button');
    tsvButton.textContent = 'TSV';
    tsvButton.className = 'format-button';
    tsvButton.addEventListener('click', () => this.exportAs('tsv'));
    menu.appendChild(tsvButton);

    const bothButton = document.createElement('button');
    bothButton.textContent = 'Both';
    bothButton.className = 'format-button';
    bothButton.addEventListener('click', () => this.exportAs('both'));
    menu.appendChild(bothButton);
}
```

**Testing:**
1. Navigate to case page
2. Click "Extract Comments" in banner
3. Verify format menu appears
4. Click each button → Verify works correctly
5. No console errors

---

## ⚡ Phase 3: Performance Optimizations (Week 2 Priority)

### Issue 3.1: caseCommentExtractor.js - Excessive DOM Queries

**File:** `modules/caseCommentExtractor.js`
**Lines:** 290-322
**Problem:** Loops through multiple selectors with querySelectorAll repeatedly

**Fix Strategy:**
1. Cache query results
2. Use more specific selectors
3. Break loop on first match

**Implementation:** (Your task - apply performance best practices)

---

### Issue 3.2: navigationObserver.js - History API Pollution

**File:** `modules/navigationObserver.js`
**Lines:** 49-57
**Problem:** Modifies global history object, potential conflicts

**Fix Strategy:**
1. Remove history API interception
2. Use alternative: popstate event + title MutationObserver
3. Test SPA navigation still works

---

## 🧪 Testing Protocol (After Each Fix)

### Manual Testing Checklist
```
[ ] Load extension in chrome://extensions
[ ] Navigate to https://proquestllc.lightning.force.com/
[ ] Open DevTools Console
[ ] Navigate to case page
[ ] Verify feature works (specific to fix)
[ ] Navigate to different case page
[ ] Check console for cleanup logs
[ ] Navigate between 5 case pages
[ ] Check for console errors
[ ] Verify no duplicate UI elements
```

### Memory Leak Testing
```javascript
// In DevTools Console:

// 1. Take baseline
console.memory.usedJSHeapSize; // Note this value

// 2. Navigate between 10 case pages
// (Use navigation history or manually navigate)

// 3. Force garbage collection
// DevTools → Performance → Collect Garbage icon

// 4. Check heap size again
console.memory.usedJSHeapSize; // Should increase < 10MB

// 5. Take heap snapshots (optional)
// DevTools → Memory → Take snapshot (before)
// Navigate 10 times
// DevTools → Memory → Take snapshot (after)
// Compare → Look for detached DOM nodes
```

---

## 📝 Documentation Requirements

### For EVERY Fix:

1. **Update CHANGELOG.md** (use template from Issue 1.1)
2. **Add inline comments** to complex logic
3. **Update module JSDoc** if adding new methods
4. **Test and document** all edge cases

### CHANGELOG.md Entry Template:
```markdown
## [YYYY-MM-DD] - AI Agent

### Changes Made
- **File(s):** [list all files modified]
- **Type:** [Bug Fix | Feature | Refactor]
- **Description:** [1-2 sentences]

### Reason
[Why this change was necessary]

### Testing
- [ ] Manual testing performed
- [ ] No console errors
- [ ] Memory leak check passed
- [ ] Feature works as expected

### Lessons Learned
[What you discovered]

### Related Issues
[Reference to CODEBASE_EXPLANATION.md section]
```

---

## 🎯 Success Criteria

### Phase 1 Complete When:
- [ ] All 5 memory leaks fixed
- [ ] cleanup() methods added to all affected modules
- [ ] ExLibrisExtension.cleanup() calls all module cleanups
- [ ] Memory leak testing shows < 10MB growth after 10 navigations
- [ ] No console errors during navigation
- [ ] All features still functional
- [ ] CHANGELOG.md updated with all 5 fixes

### Phase 2 Complete When:
- [ ] All 3 security vulnerabilities fixed
- [ ] XML escaping handles all edge cases
- [ ] No innerHTML with unsanitized data
- [ ] XSS testing passed (try malicious inputs)
- [ ] All features still functional
- [ ] CHANGELOG.md updated

### Phase 3 Complete When:
- [ ] Performance issues addressed
- [ ] DOM queries optimized
- [ ] History API pollution removed
- [ ] Navigation still works correctly
- [ ] CHANGELOG.md updated

---

## 🚨 Critical Rules

### MUST DO:
1. ✅ Read all required documentation before starting
2. ✅ Fix ONE issue at a time (don't batch)
3. ✅ Test after EACH fix
4. ✅ Update CHANGELOG.md after EACH fix
5. ✅ Follow module template patterns
6. ✅ Add cleanup() to ALL modules with observers/timers/listeners
7. ✅ Use try-catch for all async operations
8. ✅ Check dependencies before using (`typeof Module !== 'undefined'`)

### NEVER DO:
1. ❌ Modify multiple files without testing
2. ❌ Skip CHANGELOG.md updates
3. ❌ Create observers without cleanup
4. ❌ Use innerHTML with unsanitized data
5. ❌ Assume elements exist
6. ❌ Ignore promise rejections
7. ❌ Rely on Salesforce-generated class names
8. ❌ Pollute global scope

---

## 💬 Communication Protocol

### After Each Fix:
```
✅ Fixed: [Issue Name]
📄 Files Modified: [list]
🧪 Testing: [Passed/Failed]
📝 CHANGELOG.md: [Updated]
🔍 Observations: [Any findings]
➡️ Next: [Next issue to tackle]
```

### If You Get Stuck:
```
🚧 Blocked on: [Issue Name]
❓ Problem: [Describe what's wrong]
🔍 Attempted: [What you tried]
📊 Evidence: [Console errors, behavior observed]
💡 Need: [What would help]
```

---

## 🎬 Getting Started

### Step 1: Environment Setup
```bash
# 1. Ensure you have the repository
cd "c:\Users\U6071248\Tools\00_Extension Revamp\6.0 - Claude\3.0"

# 2. Open in VS Code
code .

# 3. Read required documentation (30-45 minutes)
# - CODEBASE_EXPLANATION.md
# - DEVELOPER_BEST_PRACTICES.md
# - copilot-instructions.md
```

### Step 2: Test Current State
```
1. Load extension in chrome://extensions
2. Navigate to https://proquestllc.lightning.force.com/
3. Open DevTools Console
4. Navigate to case page
5. Verify all features work
6. Document current state (any errors?)
```

### Step 3: Start with Phase 1, Issue 1.1
```
1. Open modules/caseCommentExtractor.js
2. Locate line 796
3. Implement fix following template
4. Update content_script_exlibris.js
5. Test thoroughly
6. Update CHANGELOG.md
7. Report completion
```

### Step 4: Continue Sequentially
```
Follow Phase 1 issues in order:
1.1 → 1.2 → 1.3 → 1.4 → 1.5

Then Phase 2:
2.1 → 2.2 → 2.3

Then Phase 3:
3.1 → 3.2
```

---

## 📊 Progress Tracking Template

```markdown
# Execution Progress

## Phase 1: Memory Leaks
- [ ] Issue 1.1: caseCommentExtractor.js (Line 796)
- [ ] Issue 1.2: persistentBanner.js (Line 118)
- [ ] Issue 1.3: flexipagePanelInjector.js (Line 859)
- [ ] Issue 1.4: caseTimezoneResolver.js (Lines 334, 428)
- [ ] Issue 1.5: pageIdentifier.js (Line 289)

## Phase 2: Security
- [ ] Issue 2.1: domUtilities.js (Lines 16-24)
- [ ] Issue 2.2: caseCommentExtractor.js (Line 475)
- [ ] Issue 2.3: persistentBanner.js (Line 948)

## Phase 3: Performance
- [ ] Issue 3.1: caseCommentExtractor.js (Lines 290-322)
- [ ] Issue 3.2: navigationObserver.js (Lines 49-57)

## Testing Status
- [ ] Memory leak testing passed (< 10MB growth)
- [ ] No console errors
- [ ] All features functional
- [ ] CHANGELOG.md up to date
```

---

**You are now ready to begin. Start with Phase 1, Issue 1.1. Good luck! 🚀**
