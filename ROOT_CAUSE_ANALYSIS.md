# CRITICAL BUG ANALYSIS: Legacy Functions Not Available

## ROOT CAUSE
**`content_script.js` is NOT loaded on `proquestllc.lightning.force.com`**

### Manifest Configuration Shows Separation:
```json
// OLD DOMAINS - Loads content_script.js
"content_scripts": [
  {
    "js": [ "content_script.js" ],  // ← Has handleCases, handleStatus, handleAnchors
    "matches": [
      "https://clarivateanalytics.lightning.force.com/*",
      "https://scholarone.my.salesforce.com/*"
    ]
  },
  
  // NEW DOMAIN - Does NOT load content_script.js  
  {
    "js": [ ...modules..., "content_script_exlibris.js" ],  // ← No legacy file
    "matches": [ "https://proquestllc.lightning.force.com/*" ]
  }
]
```

### Result:
- `handleCases()` - **UNDEFINED**
- `handleStatus()` - **UNDEFINED**
- `handleAnchors()` - **UNDEFINED**

## IMMEDIATE FIX
Add `content_script.js` to proquestllc domain in manifest.json
