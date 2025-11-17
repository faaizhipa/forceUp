# Idle Helper Flow Diagram

## Timeline View - Stable Page Load

```
T+0ms      │ Extension Loads
           │
           ├─► content_script_exlibris.js initializes
           │
           ├─► PageIdentifier.identifyPage()
           │   Returns: {type: 'case_page', caseId: '500QO...'}
           │
           ├─► UrlChangeMonitor.init(pageInfo)
           │   State: {lastUrl, lastPageType, lastCaseId, initialized: true}
           │   lastActivityTimestamp = now
           │
           ├─► UrlChangeMonitor.enableIdleHelper(callback, 2000)
           │   idleHelperEnabled = true
           │   Console: "Idle helper enabled (2000ms delay)"
           │
           ├─► callback(pageInfo) - FIRST CALL
           │   Console: "Starting page monitoring. Initial page: {...}"
           │
           │
T+300ms    │ MutationObserver triggers checkUrlChange()
           │
           ├─► PageIdentifier.identifyPage()
           │   Returns: {type: 'case_page', caseId: '500QO...'}
           │
           ├─► UrlChangeMonitor.checkForChanges(pageInfo)
           │   urlChanged = false
           │   pageTypeChanged = false
           │   caseIdChanged = false
           │   anyChange = false
           │   Console: "No significant changes detected"
           │
           ├─► startIdleHelper(pageInfo)
           │   timer = null? YES, start new timer
           │   triggered = false? YES, proceed
           │   Console: "Starting idle helper timer (2000ms)"
           │   setTimeout(() => { trigger callback }, 2000)
           │
           │
T+600ms    │ MutationObserver triggers checkUrlChange()
           │
           ├─► UrlChangeMonitor.checkForChanges(pageInfo)
           │   Console: "No significant changes detected"
           │
           ├─► startIdleHelper(pageInfo)
           │   timer = null? NO, timer already running
           │   Skip creating new timer
           │
           │
T+900ms    │ MutationObserver triggers checkUrlChange()
           │
           ├─► Same as T+600ms - timer keeps running
           │
           │
T+2300ms   │ 🎯 IDLE TIMER FIRES
           │
           ├─► Idle helper callback executes
           │   triggered = true
           │   Console: "Idle period detected - triggering idle helper callback"
           │
           ├─► PageIdentifier callback(pageInfo) - SECOND CALL
           │   Console: "Idle period detected, triggering callback for stable page"
           │
           ├─► disableIdleHelper()
           │   idleHelperEnabled = false
           │   timer = null
           │   Console: "Idle helper disabled"
           │
           ├─► CasePageDataExtractor receives callback
           │   Begins extracting data
           │   Console: "Extracting data for case: 500QO..."
           │
           │
T+2600ms   │ MutationObserver triggers checkUrlChange()
           │
           ├─► UrlChangeMonitor.checkForChanges(pageInfo)
           │   Console: "No significant changes detected"
           │
           ├─► startIdleHelper(pageInfo)
           │   idleHelperEnabled = false - SKIP
           │   No more idle helper calls
           │
           │
T+3000ms   │ Page fully loaded, modules working
           └─► Extension ready
```

## Timeline View - Page Navigation

```
T+0ms      │ User navigates to different case
           │
           │
T+300ms    │ MutationObserver detects DOM changes
           │
           ├─► PageIdentifier.identifyPage()
           │   Returns: {type: 'case_page', caseId: '500QO000DIFFERENT'}
           │
           ├─► UrlChangeMonitor.checkForChanges(pageInfo)
           │   urlChanged = true (different case ID in URL)
           │   caseIdChanged = true
           │   anyChange = TRUE
           │
           ├─► Console: "Changes detected: {caseIdChanged: true}"
           │
           ├─► State updated to new values
           │   lastCaseId = '500QO000DIFFERENT'
           │   lastActivityTimestamp = now
           │
           ├─► notifyCallbacks(changes, pageInfo)
           │   All registered callbacks receive notification
           │
           ├─► resetIdleHelper()
           │   Clear any pending timer
           │   triggered = false
           │   Console: "Idle helper reset"
           │
           ├─► callback(pageInfo) - IMMEDIATE CALL
           │   CaseTimezoneResolver.cleanup()
           │   Console: "Page changed (CaseID). Triggering callback."
           │
           ├─► UrlChangeMonitor.enableIdleHelper() called again
           │   (PageIdentifier calls this on every monitorPageChanges)
           │   idleHelperEnabled = true
           │
           │
T+600ms    │ MutationObserver triggers (page settling)
           │
           ├─► checkForChanges() - no more changes
           │   Console: "No significant changes detected"
           │
           ├─► startIdleHelper(pageInfo) - timer starts again
           │   setTimeout(() => { trigger callback }, 2000)
           │
           │
T+2600ms   │ 🎯 IDLE TIMER FIRES for new page
           │
           ├─► Callback fires for stable new page
           │   Console: "Idle period detected"
           │
           ├─► Modules reinitialize for new case
           │
           └─► Idle helper disables again
```

## State Diagram

```
┌─────────────────┐
│  UNINITIALIZED  │
└────────┬────────┘
         │
         │ init(pageInfo)
         ▼
┌─────────────────┐      enableIdleHelper(callback)
│   INITIALIZED   ├──────────────────────────────────────┐
│ (monitoring)    │                                      │
└────────┬────────┘                                      │
         │                                               │
         │ checkForChanges()                             ▼
         ▼                                    ┌──────────────────┐
┌─────────────────┐                          │  IDLE HELPER     │
│  CHANGES        │                          │    ENABLED       │
│  DETECTED       │                          └────────┬─────────┘
└────────┬────────┘                                   │
         │                                            │
         │ resetIdleHelper()                          │ No changes detected
         │ Re-enable idle helper                      │ for 2 seconds
         │                                            ▼
         │                                 ┌──────────────────┐
         └─────────────────────────────────┤  IDLE TIMER      │
                                          │    RUNNING       │
                                          └────────┬─────────┘
                                                   │
                                                   │ Timer expires
                                                   ▼
                                          ┌──────────────────┐
                                          │  CALLBACK        │
                                          │   TRIGGERED      │
                                          └────────┬─────────┘
                                                   │
                                                   │ disableIdleHelper()
                                                   ▼
                                          ┌──────────────────┐
                                          │  IDLE HELPER     │
                                          │   DISABLED       │
                                          └──────────────────┘
                                                   │
                                                   │ Changes detected?
                                                   ▼
                                          Back to CHANGES DETECTED
```

## Decision Flow

```
checkForChanges(pageInfo) called
         │
         ▼
    ┌────────┐
    │Compare │
    │current │
    │  with  │
    │  last  │
    └───┬────┘
        │
        ├───► anyChange = true?
        │     │
        │     ├─YES──► Update state
        │     │        Notify callbacks
        │     │        resetIdleHelper()
        │     │        DONE
        │     │
        │     └─NO───► idleHelperEnabled?
        │              │
        │              ├─YES──► timer running?
        │              │        │
        │              │        ├─YES──► SKIP (don't create duplicate)
        │              │        │
        │              │        └─NO───► startIdleHelper()
        │              │                 setTimeout(2000ms)
        │              │
        │              └─NO───► SKIP (helper disabled)
        │
        └───► Log activity
              Update timestamp
              DONE
```

## Integration Points

```
┌─────────────────────────────────────────────┐
│         content_script_exlibris.js          │
│                                             │
│  Initializes all modules                    │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│            PageIdentifier.js                │
│                                             │
│  ┌─────────────────────────────────┐        │
│  │  monitorPageChanges(callback)   │        │
│  │                                 │        │
│  │  1. identifyPage()              │        │
│  │  2. UrlChangeMonitor.init()     │        │
│  │  3. enableIdleHelper()          │◄───────┼─── NEW
│  │  4. callback(pageInfo)          │        │
│  │  5. Set up MutationObserver     │        │
│  └─────────────────────────────────┘        │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│          UrlChangeMonitor.js                │
│                                             │
│  ┌──────────────────────────────┐           │
│  │  Idle Helper System          │           │
│  │  ├─ state.idleHelperEnabled  │           │
│  │  ├─ idleHelper.timer          │           │
│  │  ├─ idleHelper.triggered      │           │
│  │  ├─ idleHelper.callback       │           │
│  │  └─ idleHelper.delay          │           │
│  └──────────────────────────────┘           │
│                                             │
│  enableIdleHelper(callback, delay)          │◄─── NEW
│  startIdleHelper(pageInfo)                  │◄─── NEW
│  resetIdleHelper()                          │◄─── NEW
│  disableIdleHelper()                        │◄─── NEW
│  getTimeSinceLastActivity()                 │◄─── NEW
└────────────────┬────────────────────────────┘
                 │
                 │ Triggers callback after idle period
                 │
                 ▼
┌─────────────────────────────────────────────┐
│       CasePageDataExtractor.js              │
│       CaseCommentMemory.js                  │
│       Other Modules                         │
│                                             │
│  Receive callback and initialize            │
└─────────────────────────────────────────────┘
```

## Key Benefits Visualized

```
WITHOUT Idle Helper:
─────────────────────
Extension Load
    │
    ├─► UrlChangeMonitor: "No changes detected"
    ├─► UrlChangeMonitor: "No changes detected"
    ├─► UrlChangeMonitor: "No changes detected"
    └─► ❌ STUCK - Modules never initialize


WITH Idle Helper:
─────────────────
Extension Load
    │
    ├─► UrlChangeMonitor: "No changes detected"
    ├─► UrlChangeMonitor: "No changes detected"
    │   (2 seconds pass)
    ├─► ✅ Idle callback fires
    └─► ✅ Modules initialize successfully
```
