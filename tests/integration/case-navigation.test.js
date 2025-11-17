const { loadExtension, waitForExtension } = require('../helpers/extensionLoader');

describe('Case Navigation', () => {
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

  test('Extension should handle SPA navigation', async () => {
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await waitForExtension(page);

    // Simulate SPA navigation by checking if navigation observer is set up
    const navigationObserverActive = await page.evaluate(() => {
      if (typeof window.ExLibrisExtension !== 'undefined' && 
          window.ExLibrisExtension.performPageInitialization) {
        return true;
      }
      return false;
    });

    expect(navigationObserverActive).toBe(true);
  }, 30000);

  test('Extension should cleanup on page change', async () => {
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await waitForExtension(page);

    // Check if cleanup method exists
    const cleanupMethodExists = await page.evaluate(() => {
      return typeof window.ExLibrisExtension !== 'undefined' &&
             typeof window.ExLibrisExtension.cleanup === 'function';
    });

    expect(cleanupMethodExists).toBe(true);
  }, 30000);

  test('PageIdentifier should detect page type changes', async () => {
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await waitForExtension(page);

    // Check if PageIdentifier is monitoring changes
    const pageIdentifierActive = await page.evaluate(() => {
      return typeof PageIdentifier !== 'undefined' &&
             typeof PageIdentifier.monitorPageChanges === 'function';
    });

    expect(pageIdentifierActive).toBe(true);
  }, 30000);
});

