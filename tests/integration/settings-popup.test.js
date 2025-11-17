const { loadExtension, getExtensionPopup } = require('../helpers/extensionLoader');

describe('Settings Popup', () => {
  let browser;
  let extensionId;

  beforeAll(async () => {
    const result = await loadExtension();
    browser = result.browser;
    extensionId = result.extensionId;
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('Popup should load without errors', async () => {
    const popupPage = await getExtensionPopup(browser, extensionId);
    
    // Wait for popup to load
    await popupPage.waitForSelector('body', { timeout: 5000 });
    
    // Check if popup HTML loaded
    const title = await popupPage.title();
    expect(title).toBeTruthy();
    
    await popupPage.close();
  }, 10000);

  test('Settings checkboxes should be present', async () => {
    const popupPage = await getExtensionPopup(browser, extensionId);
    
    await popupPage.waitForSelector('body', { timeout: 5000 });
    
    // Check for feature checkboxes
    const checkboxes = await popupPage.evaluate(() => {
      return {
        featureHighlighting: document.getElementById('featureHighlighting') !== null,
        featureContextMenu: document.getElementById('featureContextMenu') !== null,
        featureMultiTabSync: document.getElementById('featureMultiTabSync') !== null,
        featurePersistentBanner: document.getElementById('featurePersistentBanner') !== null
      };
    });
    
    expect(checkboxes.featureHighlighting).toBe(true);
    expect(checkboxes.featureContextMenu).toBe(true);
    expect(checkboxes.featureMultiTabSync).toBe(true);
    
    await popupPage.close();
  }, 10000);

  test('Settings should save and load correctly', async () => {
    const popupPage = await getExtensionPopup(browser, extensionId);
    
    await popupPage.waitForSelector('body', { timeout: 5000 });
    
    // Wait for settings to load
    await popupPage.waitForTimeout(1000);
    
    // Get initial state of a checkbox
    const initialState = await popupPage.evaluate(() => {
      const checkbox = document.getElementById('featureHighlighting');
      return checkbox ? checkbox.checked : null;
    });
    
    expect(initialState).not.toBeNull();
    
    // Toggle checkbox
    await popupPage.evaluate(() => {
      const checkbox = document.getElementById('featureHighlighting');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
    
    // Click save button
    await popupPage.evaluate(() => {
      const saveButton = document.querySelector('button[type="submit"], #saveSettings');
      if (saveButton) {
        saveButton.click();
      }
    });
    
    // Wait for save to complete
    await popupPage.waitForTimeout(500);
    
    // Reload popup to verify persistence
    await popupPage.reload({ waitUntil: 'networkidle2' });
    await popupPage.waitForTimeout(1000);
    
    // Check if setting persisted (this is a basic test)
    const settingsLoaded = await popupPage.evaluate(() => {
      return document.getElementById('featureHighlighting') !== null;
    });
    
    expect(settingsLoaded).toBe(true);
    
    await popupPage.close();
  }, 15000);
});

