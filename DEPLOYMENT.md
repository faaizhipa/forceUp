# Deployment Guide

This guide covers packaging, deployment, and troubleshooting for the Penang CoE Salesforce Extension.

## Quick Start

```bash
# Install dependencies (one-time)
npm install

# Build the extension
npm run build

# Create release package
npm run package
```

## Prerequisites

- **Node.js**: v18.0.0 or later
- **npm**: v9.0.0 or later
- **Chrome/Edge**: Latest version for testing

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Default build to `dist/` |
| `npm run build:dev` | Development build (keeps console.log) |
| `npm run build:prod` | Production build (strips debug code) |
| `npm run build:data` | Regenerate customerMasterList.json |
| `npm run package` | Create ZIP package in `releases/` |
| `npm run validate` | Validate extension integrity |
| `npm run clean` | Remove build artifacts |

## Version Management

```bash
# Bump patch version (7.2.0 → 7.2.1)
npm run version:bump

# Bump minor version (7.2.0 → 7.3.0)
npm run version:bump:minor

# Bump major version (7.2.0 → 8.0.0)
npm run version:bump:major
```

---

## Deployment Methods

### Method 1: Developer Mode (Testing)

1. Build the extension:
   ```bash
   npm run build
   ```

2. Open Chrome → `chrome://extensions/`

3. Enable **Developer mode** (top right toggle)

4. Click **Load unpacked**

5. Select the `dist/` folder

6. The extension loads immediately

**Tip**: Click the refresh icon on the extension card after code changes.

### Method 2: ZIP Package (Distribution)

1. Build and package:
   ```bash
   npm run build:prod
   npm run package
   ```

2. Find the ZIP in `releases/`:
   ```
   releases/
   ├── penang-coe-extension-v7.2-20251128.zip
   ├── penang-coe-extension-v7.2-20251128-notes.md
   └── latest.json
   ```

3. Distribute ZIP to users

4. Users install via:
   - Drag ZIP to `chrome://extensions/`
   - Or extract and load unpacked

### Method 3: Chrome Web Store (Enterprise)

1. Build production package:
   ```bash
   npm run build:prod
   npm run package:zip
   ```

2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)

3. Upload the ZIP from `releases/`

4. Fill in store listing details

5. Submit for review

**Note**: The manifest includes `"key"` for consistent extension ID across installs.

---

## Troubleshooting

### Quick Diagnostics

Open browser console on any Salesforce page and run:

```javascript
// Check extension status
ExLibrisExtension?.getStatus?.()

// Check CustomerMasterManager
CustomerMasterManager?.getStats?.()

// Check current case data
CaseDataStore?.getCurrentData?.()

// Get module initialization status
window.ExLibrisExtension
```

### Common Issues

#### Extension Not Loading

1. Check `chrome://extensions/` for errors
2. Verify manifest.json is valid:
   ```bash
   npm run validate --manifest
   ```
3. Check console for load errors

#### Customer Timezone Not Resolving

1. Verify data file exists:
   ```bash
   npm run validate --deps
   ```
2. Check console for CustomerMasterManager errors:
   ```javascript
   await CustomerMasterManager.getStats()
   ```
3. Rebuild data if needed:
   ```bash
   npm run build:data
   ```

#### Stale Data Display

1. Clear extension storage:
   ```javascript
   chrome.storage.local.clear()
   ```
2. Reload extension
3. Navigate to a case page

#### Module Not Found Errors

1. Check manifest.json content_scripts order
2. Verify all files exist:
   ```bash
   npm run validate --modules
   ```
3. Check for circular dependencies

### Debug Mode

Enable verbose logging in console:

```javascript
// Enable debug mode
localStorage.setItem('exlibris_debug', 'true');

// Disable debug mode  
localStorage.removeItem('exlibris_debug');

// Check Logger output
Logger.setDebugMode(true);
```

### Console Log Prefixes

| Prefix | Module |
|--------|--------|
| `[ExLibris Extension]` | Main content script |
| `[CustomerMasterManager]` | Customer/timezone data |
| `[CaseDataStore]` | Case data cache |
| `[CasePageDataExtractor]` | DOM extraction |
| `[PersistentBanner]` | Banner UI |
| `[CaseContextWatcher]` | Navigation detection |

### Storage Inspection

```javascript
// View all extension storage
chrome.storage.local.get(null, console.log);

// View sync storage
chrome.storage.sync.get(null, console.log);

// Clear all storage
chrome.storage.local.clear();
chrome.storage.sync.clear();
```

---

## Build Artifacts

### dist/ Structure

```
dist/
├── manifest.json
├── background.js
├── content_script.js
├── content_script_exlibris.js
├── content_script_highlighter.js
├── popup.html
├── popup.js
├── customerMasterList.json
├── build-info.json
├── modules/
│   ├── *.js (all module files)
│   └── styles/
│       ├── highlighter.css
│       ├── injected-panel.css
│       └── persistent-banner.css
├── lib/
│   ├── DOMPurify.min.js
│   ├── fabric.min.js
│   └── html2canvas.min.js
├── icons/
│   └── ExtLogoV3.png
└── img/
    └── *.png
```

### releases/ Structure

```
releases/
├── penang-coe-extension-v7.2-20251128.zip
├── penang-coe-extension-v7.2-20251128-notes.md
└── latest.json
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Extension

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - run: npm ci
      - run: npm run validate
      - run: npm run build:prod
      - run: npm run package
      
      - uses: actions/upload-artifact@v4
        with:
          name: extension-package
          path: releases/*.zip
```

### Pre-commit Validation

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/sh
npm run validate || exit 1
```

---

## Rollback Procedure

1. Keep previous versions in `releases/`

2. To rollback:
   ```bash
   # Users can install previous ZIP
   releases/penang-coe-extension-v7.1-20251120.zip
   ```

3. For Chrome Web Store:
   - Upload previous version ZIP
   - Submit for expedited review

---

## Security Checklist

Before release:

- [ ] Remove `console.log` statements (use `--prod` build)
- [ ] Remove `debugger` statements
- [ ] Verify permissions are minimal
- [ ] Check for exposed API keys/secrets
- [ ] Validate Content Security Policy compliance
- [ ] Test on sandbox environment first

---

## Support

- **Documentation**: `docs/` folder
- **Debug Guide**: `DEBUG_INSTRUCTIONS.md`
- **Change History**: `CHANGES.md`
- **Known Issues**: `docs/06-bugs-and-gaps.md`

