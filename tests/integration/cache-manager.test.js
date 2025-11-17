const { loadExtension, waitForExtension } = require('../helpers/extensionLoader');

describe('Cache Manager', () => {
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

  test('CacheManager should initialize', async () => {
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await waitForExtension(page);

    const cacheManagerAvailable = await page.evaluate(() => {
      return typeof CacheManager !== 'undefined' &&
             typeof CacheManager.init === 'function';
    });

    expect(cacheManagerAvailable).toBe(true);
  }, 30000);

  test('CacheManager should have get and set methods', async () => {
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await waitForExtension(page);

    const methodsAvailable = await page.evaluate(() => {
      return typeof CacheManager !== 'undefined' &&
             typeof CacheManager.get === 'function' &&
             typeof CacheManager.set === 'function';
    });

    expect(methodsAvailable).toBe(true);
  }, 30000);

  test('CacheManager should handle cache operations', async () => {
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await waitForExtension(page);

    // Test cache set and get
    const cacheWorks = await page.evaluate(async () => {
      if (typeof CacheManager === 'undefined') {
        return false;
      }

      try {
        // Initialize cache manager
        await CacheManager.init();

        // Test data
        const testCaseId = 'TEST_CASE_123';
        const testData = {
          caseNumber: '00001234',
          subject: 'Test Case',
          status: 'New'
        };

        // Set cache
        await CacheManager.set(testCaseId, testData);

        // Get cache
        const cached = await CacheManager.get(testCaseId);

        return cached !== null && cached.caseNumber === testData.caseNumber;
      } catch (error) {
        console.error('Cache test error:', error);
        return false;
      }
    });

    expect(cacheWorks).toBe(true);
  }, 30000);
});

