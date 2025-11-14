# Quick Start Fix Prompt for AI Agents
**Immediate Action - Critical Bug Fixes**

**Use this prompt to start fixing bugs RIGHT NOW.**

---

## 🚀 Quick Start Command

Copy and paste this entire prompt to your AI agent:

```
You are an expert Chrome Extension developer. Your task is to systematically fix critical bugs in the Penang CoE CForce Extension.

STEP 1: LOAD CONTEXT (5 minutes)
Read these files in this order:
1. copilot-instructions.md (Critical Issues section)
2. CODEBASE_EXPLANATION.md (Section 9: Critical Issues)
3. DEVELOPER_BEST_PRACTICES.md (Section 4: Memory Management)

STEP 2: VERIFY ENVIRONMENT (2 minutes)
1. Confirm you can see these files:
   - modules/caseCommentExtractor.js
   - modules/persistentBanner.js
   - modules/flexipagePanelInjector.js
   - content_script_exlibris.js
2. Check manifest.json exists
3. Confirm you can edit files

STEP 3: FIX FIRST BUG (15 minutes)
Fix the most critical memory leak:

FILE: modules/caseCommentExtractor.js
LINE: 796
ISSUE: MutationObserver not disconnected

CURRENT CODE:
```javascript
extractorObserver = new MutationObserver((mutations, obs) => {
    // ... observer code
});
```

REQUIRED FIX:
Add this to the module's public API (before the final return statement):

```javascript
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
}
```

Then in content_script_exlibris.js, find the cleanup() method and add:

```javascript
// Cleanup CaseCommentExtractor
if (typeof CaseCommentExtractor !== 'undefined' && CaseCommentExtractor.cleanup) {
    CaseCommentExtractor.cleanup();
}
```

STEP 4: TEST THE FIX (5 minutes)
1. Save both files
2. Document what you changed
3. Report completion

STEP 5: UPDATE CHANGELOG (5 minutes)
Add this to CHANGELOG.md at the top of the "Future Changes Go Below This Line" section:

```markdown
## [2025-11-XX] - AI Agent (Replace XX with today's date)

### Changes Made
- **File(s):** modules/caseCommentExtractor.js, content_script_exlibris.js
- **Type:** Bug Fix
- **Description:** Fixed critical memory leak - MutationObserver now properly disconnected on navigation

### Reason
MutationObserver was created but never disconnected, causing memory accumulation during SPA navigation between case pages. This is Issue #1 from CODEBASE_EXPLANATION.md Section 9.2.

### Testing
- [ ] Manual testing performed (pending user verification)
- [ ] No syntax errors (verified)
- [ ] Memory leak check (pending user verification)
- [ ] Feature works as expected (pending user verification)

### Lessons Learned
Always disconnect MutationObservers when no longer needed, especially in SPA environments where navigation doesn't reload the page. This pattern must be applied to ALL modules that create observers.

### Related Issues
Critical Issue #1 - Memory Leak in caseCommentExtractor.js:796
Reference: CODEBASE_EXPLANATION.md Section 9.2
```

STEP 6: REPORT COMPLETION
Output:
```
✅ COMPLETED: Memory leak fix #1
📄 FILES MODIFIED:
   - modules/caseCommentExtractor.js (added cleanup() method)
   - content_script_exlibris.js (integrated cleanup call)
   - CHANGELOG.md (documented changes)

🔍 CHANGES SUMMARY:
   - Added cleanup() method to CaseCommentExtractor module
   - Method disconnects MutationObserver when called
   - Integrated cleanup() into ExLibrisExtension.cleanup()
   - Documented changes in CHANGELOG.md

🧪 TESTING REQUIRED BY USER:
   1. Load extension in chrome://extensions
   2. Navigate to ProQuest Salesforce case page
   3. Open DevTools Console
   4. Navigate between 5 different case pages
   5. Check console for "[CaseCommentExtractor] Cleaning up..." logs
   6. Verify no console errors
   7. Verify comment extraction still works

➡️ NEXT STEPS:
   Ready to fix Issue #2: persistentBanner.js memory leak
   Proceed? (Yes/No)
```

Now begin with STEP 1.
```

---

## 📋 All 15 Issues in Priority Order

### 🔴 PHASE 1: Memory Leaks (Fix First - Week 1)

1. **caseCommentExtractor.js:796** - MutationObserver leak
2. **persistentBanner.js:118** - Event listener leak
3. **flexipagePanelInjector.js:859** - Document-wide observer
4. **caseTimezoneResolver.js:334,428** - Timer and observer leaks
5. **pageIdentifier.js:289** - Throttle timer leak

### 🔒 PHASE 2: Security (Fix Second - Week 1-2)

6. **domUtilities.js:16-24** - Incomplete XML escaping
7. **caseCommentExtractor.js:475** - XSS fallback risk
8. **persistentBanner.js:948** - innerHTML injection

### ⚡ PHASE 3: Performance (Fix Third - Week 2)

9. **caseCommentExtractor.js:290-322** - Excessive DOM queries
10. **navigationObserver.js:49-57** - History API pollution
11. **persistentBanner.js:332-342** - Synchronous storage
12. **flexipagePanelInjector.js:859-862** - Performance overhead

### 🟡 PHASE 4: Error Handling (Fix Fourth - Week 2-3)

13. **Multiple modules** - Missing try-catch blocks
14. **Multiple modules** - Silent storage failures
15. **Multiple modules** - Generic error messages

---

## 🎯 One-Issue-at-a-Time Approach

**For each issue:**

1. **Read** the specific section in AI_AGENT_EXECUTION_PROMPT.md
2. **Understand** the current code and problem
3. **Implement** the fix using provided template
4. **Test** by saving and checking syntax
5. **Document** in CHANGELOG.md
6. **Report** completion
7. **Move** to next issue

**Estimated time per issue:** 15-30 minutes
**Total estimated time:** 6-12 hours

---

## 🆘 If You Get Stuck

### Common Issues:

**"I can't find the file"**
- Check file path: `modules/[filename].js`
- Use file search in your editor
- Verify you're in the correct directory

**"The code looks different"**
- Line numbers may vary slightly
- Search for the pattern/function name instead
- Check nearby lines (±10 lines)

**"I don't understand the fix"**
- Re-read DEVELOPER_BEST_PRACTICES.md Section 4
- Look at the template provided
- Ask for clarification on specific parts

**"Tests are failing"**
- Check console for syntax errors
- Verify file saved correctly
- Compare your code to template
- Ensure you didn't modify unrelated code

---

## ✅ Quick Verification Checklist

After each fix, verify:

```
[ ] File modified and saved
[ ] No syntax errors (check editor)
[ ] cleanup() method added to module
[ ] cleanup() called from ExLibrisExtension.cleanup()
[ ] CHANGELOG.md updated with fix details
[ ] Code follows template pattern
[ ] Console.log statements added for debugging
[ ] Comments explain why, not just what
```

---

## 📞 Communication Template

**After completing each issue:**

```
✅ Issue X.Y Complete

Files: [list]
Changes: [summary]
Testing: [what user needs to verify]
Next: [next issue number]
Questions: [any blockers or questions]
```

---

## 🏁 Starting Now

**To begin immediately, run:**

```
Fix Issue #1: modules/caseCommentExtractor.js:796 memory leak
Refer to AI_AGENT_EXECUTION_PROMPT.md Section "Issue 1.1" for detailed instructions
Expected completion: 15-20 minutes
```

**Good luck! Start with Issue 1.1 now. 🚀**
