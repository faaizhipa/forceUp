const path = require('path');
const puppeteer = require('puppeteer');

/**
 * Load extension in Puppeteer browser instance
 * @param {Object} options - Browser launch options
 * @returns {Promise<{browser: Browser, page: Page, extensionId: string}>}
 */
async function loadExtension(options = {}) {
  const extensionPath = process.env.EXTENSION_PATH || path.resolve(__dirname, '../../');
  
  const browser = await puppeteer.launch({
    headless: false, // Extensions require non-headless mode
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    ...options
  });

  // Get extension ID
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    target => target.type() === 'service_worker'
  );
  
  let extensionId = null;
  if (extensionTarget) {
    const url = extensionTarget.url();
    const match = url.match(/chrome-extension:\/\/([a-z]{32})/);
    extensionId = match ? match[1] : null;
  }

  const page = await browser.newPage();

  return { browser, page, extensionId };
}

/**
 * Wait for extension to initialize on a page
 * @param {Page} page - Puppeteer page
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForExtension(page, timeout = 10000) {
  await page.waitForFunction(
    () => {
      return typeof window.ExLibrisExtension !== 'undefined' &&
             window.ExLibrisExtension.isInitialized === true;
    },
    { timeout }
  );
}

/**
 * Wait for a specific module to be available
 * @param {Page} page - Puppeteer page
 * @param {string} moduleName - Module name (e.g., 'PersistentBanner')
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForModule(page, moduleName, timeout = 10000) {
  await page.waitForFunction(
    (name) => {
      return typeof window[name] !== 'undefined' &&
             window[name].isInitialized === true;
    },
    { timeout },
    moduleName
  );
}

/**
 * Get extension popup page
 * @param {Browser} browser - Puppeteer browser
 * @param {string} extensionId - Extension ID
 * @returns {Promise<Page>}
 */
async function getExtensionPopup(browser, extensionId) {
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const page = await browser.newPage();
  await page.goto(popupUrl, { waitUntil: 'networkidle2' });
  return page;
}

module.exports = {
  loadExtension,
  waitForExtension,
  waitForModule,
  getExtensionPopup
};

