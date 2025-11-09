# Extension Not Loading? Chrome Manifest Cache Issue

## Problem
The manifest.json changes are correct, but Chrome's extension cache isn't picking them up.

## Solution (Choose ONE method)

### Method 1: Complete Chrome Reset
1. Close ALL Chrome windows
2. Reopen Chrome
3. Go to chrome://extensions
4. Remove extension (trash icon)
5. **Close Chrome completely again**
6. Reopen Chrome
7. Click "Load unpacked"
8. Select folder: `c:\Users\faaiz\Repository\3.0`
9. Go to Salesforce and press Ctrl+Shift+R (hard refresh)

### Method 2: Clear Extension Storage (Nuclear Option)
1. Close all Chrome windows
2. Navigate to: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions`
3. Delete the folder for this extension
4. Reopen Chrome
5. Load unpacked from `c:\Users\faaiz\Repository\3.0`

### Method 3: New Chrome Profile (If above fails)
1. chrome://settings/people
2. "Add person" → Create new profile
3. In NEW profile: chrome://extensions
4. Enable Developer mode
5. Load unpacked from `c:\Users\faaiz\Repository\3.0`

## Verify It Worked

Open browser console on Salesforce case list page and run:
```javascript
typeof handleCases
```

Should return: `"function"` (not `"undefined"`)

## Current Manifest Status
✅ content_script.js DOES include proquestllc domain (line 21)
✅ All code is correct
❌ Chrome manifest cache is stale

The issue is 100% Chrome's caching, not the code.
