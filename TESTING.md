# Testing and Debugging Guide

This document provides instructions for testing and debugging the Chrome Extension.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Debugging](#debugging)
- [MCP Integration](#mcp-integration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Install Dependencies

```bash
npm install
```

This installs:
- **Jest** - Test framework
- **Puppeteer** - Browser automation
- **jest-puppeteer** - Jest preset for Puppeteer

### Chrome Installation

Ensure Google Chrome is installed. Puppeteer will download Chromium automatically, but for extension testing, we use your system Chrome.

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Specific Test Suite

```bash
npm run test:integration
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Debug Tests

```bash
npm run test:debug
```

Then open Chrome DevTools at `chrome://inspect` and click "inspect" on the Node.js process.

## Writing Tests

### Test Structure

Tests are located in `tests/integration/` directory. Each test file follows this pattern:

```javascript
const { loadExtension, waitForExtension } = require('../helpers/extensionLoader');

describe('Feature Name', () => {
  let browser;
  let page;
  let extensionId;

  beforeAll(async () => {
    const result = await loadExtension();
    browser = result.browser;
    page = result.page;
    extensionId = result.extensionId;
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should do something', async () => {
    // Test implementation
  });
});
```

### Available Test Helpers

#### Extension Loading

```javascript
const { loadExtension, waitForExtension, getExtensionPopup } = require('../helpers/extensionLoader');

// Load extension in browser
const { browser, page, extensionId } = await loadExtension();

// Wait for extension to initialize
await waitForExtension(page);

// Get extension popup page
const popupPage = await getExtensionPopup(browser, extensionId);
```

#### Waiting for Elements

```javascript
const { waitForElement, waitForElementVisible, waitForPersistentBanner } = require('../helpers/waitForExtension');

// Wait for element to appear
await waitForElement(page, '#my-element');

// Wait for element to be visible
await waitForElementVisible(page, '#my-element');

// Wait for PersistentBanner
await waitForPersistentBanner(page);
```

#### Salesforce Helpers

```javascript
const { waitForSalesforcePage, isSalesforcePage } = require('../helpers/salesforceMock');

// Check if page is Salesforce
const isSalesforce = await isSalesforcePage(page);

// Wait for Salesforce to load
await waitForSalesforcePage(page);
```

### Example Test

```javascript
test('PersistentBanner should display on case page', async () => {
  await page.goto('https://proquestllc.lightning.force.com', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await waitForExtension(page);

  const bannerExists = await page.evaluate(() => {
    return document.getElementById('exl-persistent-banner') !== null;
  });

  expect(bannerExists).toBe(true);
});
```

## Debugging

### Using Debug Helper Module

The extension includes a debug helper module accessible from the browser console.

#### Access Debug Helper

Open browser console on a Salesforce page and use:

```javascript
// Inspect storage
ExLibrisDebug.inspectStorage();

// Test DOM selectors
ExLibrisDebug.testSelectors();

// Inspect module states
ExLibrisDebug.inspectModules();

// Get page information
ExLibrisDebug.getPageInfo();

// Test cache
ExLibrisDebug.testCache();

// Measure performance
ExLibrisDebug.measurePerformance('My Operation', () => {
  // Your code here
});

// Clear storage (use with caution)
ExLibrisDebug.clearStorage();
```

### Console Logging

The extension uses consistent logging prefixes:

- `[ExLibris Extension]` - Main controller
- `[PersistentBanner]` - Banner module
- `[CacheManager]` - Cache operations
- `[SettingsManager]` - Settings operations
- `[CaseDataExtractor]` - Data extraction

Filter console logs by these prefixes for easier debugging.

### Service Worker Debugging

1. Go to `chrome://extensions`
2. Find your extension
3. Click "Service worker: Inspect"
4. Console shows logs from `background.js`

### Content Script Debugging

1. Right-click on the page
2. Select "Inspect"
3. Go to Console tab
4. Filter by extension log prefixes

## MCP Integration

MCP (Model Context Protocol) allows AI agents to interact with Chrome DevTools for automated debugging.

### Setup

1. **Install Chrome DevTools MCP** (if using MCP client):

   ```bash
   npm install -g chrome-devtools-mcp
   ```

2. **Launch Chrome with Remote Debugging**:

   **Windows:**
   ```bash
   scripts\launch-chrome-debug.bat
   ```

   **macOS/Linux:**
   ```bash
   chmod +x scripts/launch-chrome-debug.sh
   ./scripts/launch-chrome-debug.sh
   ```

   Or manually:
   ```bash
   # Windows
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="chrome-debug-profile"

   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="chrome-debug-profile"

   # Linux
   google-chrome --remote-debugging-port=9222 --user-data-dir="chrome-debug-profile"
   ```

3. **Configure MCP Client** (e.g., Cursor):

   Add to your MCP client configuration:

   ```json
   {
     "mcpServers": {
       "chrome-devtools": {
         "command": "npx",
         "args": ["chrome-devtools-mcp@latest"],
         "env": {
           "CHROME_DEBUG_PORT": "9222"
         }
       }
     }
   }
   ```

### Using MCP

Once configured, AI agents can:
- Inspect DOM elements
- Execute JavaScript
- Monitor network requests
- View console logs
- Set breakpoints
- Capture screenshots
- Simulate user interactions

## Troubleshooting

### Tests Fail to Load Extension

**Problem:** Extension doesn't load in Puppeteer browser.

**Solutions:**
- Ensure Chrome is installed (not just Chromium)
- Check that `manifest.json` is valid
- Verify extension path in test setup
- Check browser console for errors

### Extension Not Initializing

**Problem:** `ExLibrisExtension.isInitialized` is false.

**Solutions:**
- Increase timeout in `waitForExtension()`
- Check if Salesforce page loaded correctly
- Verify content scripts are injected
- Check console for initialization errors

### MCP Connection Fails

**Problem:** MCP can't connect to Chrome.

**Solutions:**
- Verify Chrome is running with `--remote-debugging-port=9222`
- Check if port 9222 is available: `netstat -an | findstr 9222` (Windows) or `lsof -i :9222` (macOS/Linux)
- Ensure firewall allows connections on port 9222
- Try a different port if 9222 is in use

### Tests Timeout

**Problem:** Tests timeout before completing.

**Solutions:**
- Increase timeout in test: `test('name', async () => {...}, 60000)`
- Check network connectivity to Salesforce
- Verify Salesforce URLs are accessible
- Add more wait conditions for async operations

### Debug Helper Not Available

**Problem:** `ExLibrisDebug` is undefined in console.

**Solutions:**
- Ensure `modules/debugHelper.js` is loaded
- Check if module is included in content scripts
- Reload extension and page
- Check console for module loading errors

## Best Practices

1. **Isolation**: Each test should be independent and not rely on previous test state
2. **Timeouts**: Use appropriate timeouts for async operations (30s for page loads, 10s for element waits)
3. **Cleanup**: Always close browser and pages in `afterAll`
4. **Error Handling**: Use try-catch for operations that might fail
5. **Logging**: Use descriptive console logs for debugging
6. **Selectors**: Prefer stable selectors (data attributes, IDs) over CSS classes

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Puppeteer Documentation](https://pptr.dev/)
- [Chrome Extension Testing Guide](https://developer.chrome.com/docs/extensions/mv3/testing/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)

## Support

For issues or questions:
1. Check console logs for errors
2. Review test output for failures
3. Use debug helper module for inspection
4. Check extension service worker logs

