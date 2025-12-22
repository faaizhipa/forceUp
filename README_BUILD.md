# Chrome Extension - Build Instructions

## Building the Extension

To create a production-ready package of the extension:

```bash
bash build.sh
```

This will create a versioned zip file in the `dist/` directory (e.g., `dist/forceUp-v7.5.8.zip`).

## What Gets Packaged

The build script packages only production files:

✅ **Included:**
- Extension core files (manifest, scripts, HTML, CSS)
- All modules and utilities
- Icons, images, and libraries
- Data files (customer lists, timezone data)

❌ **Excluded:**
- Documentation files (`*.md`)
- Backup files (`*copy.js`, `*backup.js`)
- Development artifacts (`.git`, `.vscode`, `.github`, etc.)
- Previous builds and zip files

## Output

After running the build:

- **Unpacked extension**: `dist/forceUp-v{VERSION}/`
- **Packaged extension**: `dist/forceUp-v{VERSION}.zip`

## Installing the Extension

### From Unpacked Directory

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/forceUp-v{VERSION}/` directory

### From Zip File

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Drag and drop the `dist/forceUp-v{VERSION}.zip` file onto the page

## For More Details

See [BUILD.md](BUILD.md) for comprehensive build documentation.
