/**
 * Wait for extension initialization utilities
 */

/**
 * Wait for extension to be fully initialized
 * @param {Page} page - Puppeteer page
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForExtensionInit(page, timeout = 15000) {
  try {
    await page.waitForFunction(
      () => {
        return typeof window.ExLibrisExtension !== 'undefined' &&
               window.ExLibrisExtension.isInitialized === true;
      },
      { timeout }
    );
    return true;
  } catch (error) {
    console.warn('[Test] Extension initialization timeout');
    return false;
  }
}

/**
 * Wait for PersistentBanner to be initialized
 * @param {Page} page - Puppeteer page
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForPersistentBanner(page, timeout = 10000) {
  try {
    await page.waitForFunction(
      () => {
        return typeof PersistentBanner !== 'undefined' &&
               PersistentBanner.isInitialized === true &&
               PersistentBanner.isInjected() === true;
      },
      { timeout }
    );
    return true;
  } catch (error) {
    console.warn('[Test] PersistentBanner initialization timeout');
    return false;
  }
}

/**
 * Wait for element to appear in DOM
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForElement(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for element to be visible
 * @param {Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForElementVisible(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { 
      timeout,
      visible: true 
    });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  waitForExtensionInit,
  waitForPersistentBanner,
  waitForElement,
  waitForElementVisible
};

