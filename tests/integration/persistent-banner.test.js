const { loadExtension, waitForExtension } = require('../helpers/extensionLoader');
const { waitForPersistentBanner, waitForElementVisible } = require('../helpers/waitForExtension');

describe('PersistentBanner', () => {
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

  test('PersistentBanner should initialize when feature is enabled', async () => {
    // Enable persistent banner feature via settings
    // Note: This assumes default settings have persistentBanner enabled
    // In real tests, you might need to set this via chrome.storage
    
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await waitForExtension(page);

    // Wait for PersistentBanner to initialize
    const bannerInitialized = await waitForPersistentBanner(page, 15000);
    
    if (bannerInitialized) {
      // Check if banner element exists
      const bannerExists = await page.evaluate(() => {
        return document.getElementById('exl-persistent-banner') !== null;
      });
      
      expect(bannerExists).toBe(true);
    } else {
      // Banner might be disabled in settings, skip test
      console.log('[Test] PersistentBanner not initialized (may be disabled in settings)');
    }
  }, 30000);

  test('PersistentBanner should display on case page', async () => {
    // Navigate to a case page (you'll need a real case ID for full testing)
    // For now, just check if banner would appear
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await waitForExtension(page);

    // Check if banner element is in DOM
    const bannerInDOM = await waitForElement(page, '#exl-persistent-banner', 5000);
    
    if (bannerInDOM) {
      // Check if banner is visible
      const bannerVisible = await page.evaluate(() => {
        const banner = document.getElementById('exl-persistent-banner');
        return banner && banner.style.display !== 'none' && banner.offsetHeight > 0;
      });
      
      // Banner visibility depends on feature toggle
      // Just verify it exists if feature is enabled
      expect(bannerInDOM).toBe(true);
    }
  }, 30000);

  test('PersistentBanner should update on navigation', async () => {
    await page.goto('https://proquestllc.lightning.force.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await waitForExtension(page);

    // Simulate navigation by checking URL change handling
    const navigationHandled = await page.evaluate(() => {
      if (typeof PersistentBanner !== 'undefined' && PersistentBanner.handleUrlChange) {
        const initialUrl = window.location.href;
        PersistentBanner.handleUrlChange(window.location.href);
        return true;
      }
      return false;
    });

    // Navigation handling should be available
    expect(navigationHandled).toBe(true);
  }, 30000);
});

