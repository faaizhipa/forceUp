# DEBUG INSTRUCTIONS

## To test case list highlighting, you MUST navigate to the case list view.

### Current Status from Console:
```
Page detected: {type: 'case_page', caseId: '500QO00000KzJK3YAN', reportId: null}
```

**This is a CASE DETAIL PAGE, not a case list!**

---

## TESTING STEPS:

### 1. Navigate to Case List View
Go to: `https://proquestllc.lightning.force.com/lightning/o/Case/list?filterName=<your-filter>`

Or click on "Cases" tab in Salesforce navigation.

### 2. Open Browser Console
Press F12 → Console tab

### 3. Check if Functions Exist
Paste this in console:
```javascript
console.log('handleCases exists:', typeof handleCases === 'function');
console.log('handleStatus exists:', typeof handleStatus === 'function');
console.log('handleAnchors exists:', typeof handleAnchors === 'function');
console.log('PageIdentifier page type:', PageIdentifier.identifyPage());
```

Expected output:
```
handleCases exists: true
handleStatus exists: true
handleAnchors exists: true
PageIdentifier page type: {type: 'cases_list', caseId: null, reportId: null}
```

### 4. Check Extension Logs
Look for these in console:
```
[ExLibris Extension] Page changed: {type: 'cases_list', ...}
[ExLibris Extension] Initializing case list features...
[ExLibris Extension] Case row highlighting applied
[ExLibris Extension] Status badge highlighting applied
[ExLibris Extension] Case list observer initialized (handleCases, handleStatus)
```

### 5. Manually Trigger Functions (if needed)
If automatic triggering fails, run manually:
```javascript
handleCases();
handleStatus();
```

### 6. Verify DOM Changes
Check if table rows have background colors:
```javascript
// Check for colored rows
const rows = document.querySelectorAll('table tbody tr[style*="background-color"]');
console.log('Colored rows:', rows.length);

// Check for status badges
const badges = document.querySelectorAll('td span span[style*="background-color"]');
console.log('Status badges:', badges.length);
```

---

## CURRENT ISSUE: Wrong Page Type

You're on a **case detail page** (`/lightning/r/Case/500xxx/view`), but case list features only work on **case list pages** (`/lightning/o/Case/list`).

**Navigate to the case list view NOW to test.**

---

## If Functions Don't Exist:

### Check if content_script.js Loaded
```javascript
console.log('Scripts loaded:', performance.getEntriesByType('resource')
  .filter(r => r.name.includes('.js'))
  .map(r => r.name.split('/').pop()));
```

Should include: `content_script.js`

### Check Manifest Matches
Open `chrome://extensions` → Find extension → Details → Check "Site access"

Should show: `On specific sites: proquestllc.lightning.force.com`

### Reload Extension
1. Go to `chrome://extensions`
2. Find "Penang CoE CForce Extension"
3. Click reload button (circular arrow)
4. Refresh Salesforce page
5. Navigate to `/lightning/o/Case/list`

---

## Expected Visual Results on Case List:

### Row Colors (handleCases):
- Green rows: Cases opened 0-30 minutes ago
- Yellow rows: Cases opened 30-60 minutes ago
- Orange rows: Cases opened 60-90 minutes ago
- Red rows: Cases opened >90 minutes ago

### Status Badges (handleStatus):
- Red badges: "New Email Received", "Re-opened", "New"
- Orange badges: "In Progress", "Pending Action"
- Purple badges: "Assigned to Resolver Group"
- Green badges: "Solution Delivered to Customer"
- Gray badges: "Closed", "Pending Customer Response"

---

## If Still Not Working:

1. Open console
2. Type: `ExLibrisExtension.initializeCaseListFeatures()`
3. Check console logs
4. Report exact error messages
