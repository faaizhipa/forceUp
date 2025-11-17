const { loadExtension, waitForExtension } = require('../helpers/extensionLoader');
const { waitForSalesforcePage, isSalesforcePage } = require('../helpers/salesforceMock');
const { waitForElement } = require('../helpers/waitForExtension');

describe('Extension Loading', () => {
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

  test('Extension should load in browser', () => {
    expect(extensionId).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });

  test('Extension should initialize on ProQuest Salesforce page', async () => {
    // Navigate to ProQuest Salesforce
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for Salesforce page to load
    const isSalesforce = await isSalesforcePage(page);
    expect(isSalesforce).toBe(true);

    // Wait for extension to initialize
    const initialized = await waitForExtension(page, 15000);
    expect(initialized).toBe(true);

    // Verify ExLibrisExtension is available
    const extensionAvailable = await page.evaluate(() => {
      return typeof window.ExLibrisExtension !== 'undefined' &&
             window.ExLibrisExtension.isInitialized === true;
    });

    expect(extensionAvailable).toBe(true);
  }, 30000);

  test('Extension modules should be loaded', async () => {
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await waitForExtension(page);

    const modulesLoaded = await page.evaluate(() => {
      return {
        SettingsManager: typeof SettingsManager !== 'undefined',
        PageIdentifier: typeof PageIdentifier !== 'undefined',
        CacheManager: typeof CacheManager !== 'undefined',
        CaseDataExtractor: typeof CaseDataExtractor !== 'undefined'
      };
    });

    expect(modulesLoaded.SettingsManager).toBe(true);
    expect(modulesLoaded.PageIdentifier).toBe(true);
    expect(modulesLoaded.CacheManager).toBe(true);
    expect(modulesLoaded.CaseDataExtractor).toBe(true);
  }, 30000);
});

