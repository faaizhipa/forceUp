# Build and Package Guide

This document describes how to build and package the Chrome Extension for distribution.

## Quick Start

To create a production build:

```bash
bash build.sh
```

This will create a versioned zip file in the `dist/` directory ready for distribution.

## Build Process

The build script (`build.sh`) performs the following steps:

1. **Version Detection**: Reads the version from `manifest.json`
2. **Clean Build**: Removes any previous builds from the `dist/` directory
3. **Copy Production Files**: Copies only the necessary files for the extension to work:
   - Core extension files (manifest, background, content scripts, popup, sidepanel)
   - HTML and CSS files
   - Data files (customer lists, timezone data)
   - Production directories (icons, img, lib, modules, preact-modules, utils)
4. **Cleanup**: Removes backup files and development artifacts
5. **Package**: Creates a versioned zip file

## What Gets Included

The following files and directories are included in the production build:

### Core Files
- `manifest.json` - Extension manifest
- `background.js` - Service worker
- `content_script.js` - Main content script
- `content_script_exlibris.js` - ExLibris-specific content script
- `content_script_highlighter.js` - Highlighter content script
- `popup.html`, `popup.js` - Extension popup
- `sidepanel.html`, `sidepanel.js` - Side panel
- `updated.html`, `updated.js` - Update notification page
- `privacy-policy.html` - Privacy policy
- `styles.css` - Main stylesheet

### Data Files
- `customerMasterList.json` - Customer master data
- `timezones_index.json` - Timezone index
- `timezones_index.js` - Timezone utilities
- `timezones_final.csv` - Timezone data
- `instTimezones.dsv` - Institution timezone data

### Directories
- `icons/` - Extension icons
- `img/` - Images and screenshots
- `lib/` - Third-party libraries (DOMPurify, html2canvas, fabric)
- `modules/` - Feature modules
- `preact-modules/` - Preact components and utilities
- `utils/` - Utility functions

## What Gets Excluded

The build process automatically excludes:

- Documentation files (`*.md`, except data-related MD files)
- Backup files (`*copy.js`, `*backup.js`)
- Development artifacts (`.github/`, `.vscode/`, `.cursor/`, `.genkit/`, `.reference/`)
- Git repository (`.git/`)
- IDE configuration files
- Previous builds and zip files

## Output

The build creates:

1. **Build Directory**: `dist/forceUp-v{VERSION}/` - An unpacked extension ready for testing
2. **Zip File**: `dist/forceUp-v{VERSION}.zip` - A packaged extension ready for distribution

## Installation

### Testing the Build

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/forceUp-v{VERSION}/` directory

### Distributing the Extension

The `dist/forceUp-v{VERSION}.zip` file can be:
- Uploaded to the Chrome Web Store
- Distributed directly to users
- Shared for manual installation

## Git Configuration

The `.gitignore` file is configured to exclude:
- `dist/` directory (build output)
- `*.zip` files (packaged extensions)
- Development files and IDE configurations
- Temporary and log files

This ensures that only source files are tracked in version control, keeping the repository clean.

## Version Management

The extension version is managed in `manifest.json`:

```json
{
  "version": "X.Y.Z",
  ...
}
```

When you update the version in `manifest.json`, the build script will automatically use the new version for the output files.

## Build Verification

After running the build, verify:

✓ The zip file is created in `dist/`
✓ The file size is reasonable (typically 5-6 MB)
✓ No documentation files are included (except data-related ones)
✓ No backup files are included
✓ The manifest.json version matches the build name

## Troubleshooting

### Permission Denied Error

If you get a "Permission denied" error:

```bash
bash build.sh
```

Instead of:

```bash
./build.sh
```

### Missing Files

If the build completes but is missing files:
1. Check that all source files exist in the repository
2. Review the `build.sh` script for the copy commands
3. Ensure no files are being filtered by `.gitignore`

### Large File Size

If the build is unexpectedly large:
1. Check for accidentally included development files
2. Review the cleanup section of `build.sh`
3. Consider excluding additional files if needed

## Maintenance

When adding new production files to the extension:

1. Add them to the appropriate copy section in `build.sh`
2. Test the build to ensure they're included
3. Update this documentation if needed

## Related Files

- `build.sh` - Build script
- `.gitignore` - Git exclusion rules
- `manifest.json` - Extension manifest with version
