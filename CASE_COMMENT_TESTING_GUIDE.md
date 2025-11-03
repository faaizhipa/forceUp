# Case Comment Extractor - Testing Guide

## Quick Test URLs

### Test Case Comments Full View

Replace `[CASE_ID]` with an actual case ID (e.g., `500QO00000nJ3EAYA0`):

```
https://proquestllc.lightning.force.com/lightning/r/Case/[CASE_ID]/related/CaseComments/view
```

### Test Case Detail View (Original)

```
https://proquestllc.lightning.force.com/lightning/r/Case/[CASE_ID]/view
```

## What to Look For

### On Case Comments Full View Page

1. **Action Bar**: Look for the list view action bar near the top of the page
2. **Buttons**: Two new buttons should appear:
   - `Copy Table` (TSV format)
   - `Copy XML` (XML format)
3. **Location**: Buttons should be in the same row as "New", "Edit", "Delete" buttons

### Expected Behavior

| Action | Expected Result |
|--------|----------------|
| Click "Copy Table" | All visible comments copied as tab-separated values |
| Click "Copy XML" | All visible comments copied as XML with case metadata |
| Navigate to different case | Buttons re-inject automatically |
| Switch from detail → comments view | Buttons appear in new location |
| Switch from comments view → detail | Buttons move to detail page action bar |

## Browser Console Commands

### Check Initialization

```javascript
// Should show: "case comments full view page"
console.log(window.location.pathname.includes('/related/CaseComments/view') ? 'Comments view' : 'Case detail');
```

### Force Re-initialization

```javascript
// If buttons don't appear, try:
if (typeof CaseCommentExtractor !== 'undefined') {
    CaseCommentExtractor.cleanup();
    CaseCommentExtractor.initialize();
}
```

### Check Current State

```javascript
// Should show case ID
console.log('Case ID:', window.location.pathname.match(/\/Case\/([a-zA-Z0-9]{15,18})/)?.[1]);
```

## Common Issues & Solutions

### Issue: Buttons Don't Appear

**Check**:
1. Is there a comments table visible on the page?
2. Are you on the correct URL format?
3. Check browser console for errors

**Solution**:
```javascript
// Run in console
CaseCommentExtractor.initialize();
```

### Issue: Buttons Appear But Don't Work

**Check**:
1. Are comments visible in the table?
2. Check console for extraction errors

**Debug**:
```javascript
// Run in console - should return comments array
const data = CaseCommentExtractor.extractCaseComments();
console.log(data);
```

### Issue: Wrong Case ID Extracted

**Check**:
```javascript
// Should match the case in URL
console.log('Extracted:', CaseCommentExtractor.extractCaseMetadata().caseId);
console.log('URL:', window.location.pathname);
```

## Success Indicators

✅ Console shows: `[CaseCommentExtractor] Initializing for case [ID] on case comments full view page...`  
✅ Console shows: `[CaseCommentExtractor] Comments table found with selector (visible): ...`  
✅ Console shows: `[CaseCommentExtractor] Copy buttons added successfully.`  
✅ Two buttons visible in action bar  
✅ Clicking buttons shows success toast  
✅ Clipboard contains formatted data  

## Sample Output

### TSV Format (Copy Table)

```tsv
Case ID:	500QO00000nJ3EAYA0
Case Number:	12345678
Subject:	Test Case
Description:	Test description
Contact:	John Doe
Account:	Test Account
Status:	New

Author	Public	Date	Comment
Jane Smith	Yes	01/10/2025 14:30	First comment here
John Doe	No	02/10/2025 09:15	Internal comment
```

### XML Format (Copy XML)

```xml
<case>
  <metadata>
    <caseId>500QO00000nJ3EAYA0</caseId>
    <caseNumber>12345678</caseNumber>
    <subject>Test Case</subject>
    <description>Test description</description>
    <priority>High</priority>
    <status>New</status>
    <contactName>John Doe</contactName>
    <accountName>Test Account</accountName>
  </metadata>
  <updates>
    <comment public="true">
      <author>Jane Smith</author>
      <date>01/10/2025 14:30</date>
      <text>First comment here</text>
    </comment>
    <comment public="false">
      <author>John Doe</author>
      <date>02/10/2025 09:15</date>
      <text>Internal comment</text>
    </comment>
  </updates>
</case>
```

---

**Updated**: October 31, 2025  
**Version**: 1.1  
**Module**: Case Comment Extractor
