/**
 * Helper functions for testing Salesforce pages
 */

/**
 * Mock Salesforce Lightning page structure
 * @param {Page} page - Puppeteer page
 */
async function mockSalesforcePage(page) {
  await page.evaluate(() => {
    // Create basic Salesforce Lightning structure
    const body = document.body;
    
    // Create global header
    if (!document.querySelector('one-appnav')) {
      const nav = document.createElement('one-appnav');
      nav.id = 'oneAppNav';
      body.appendChild(nav);
    }
    
    // Create main content area
    if (!document.querySelector('lightning-layout')) {
      const layout = document.createElement('lightning-layout');
      layout.id = 'main-content';
      body.appendChild(layout);
    }
  });
}

/**
 * Navigate to a mock case page
 * @param {Page} page - Puppeteer page
 * @param {string} caseId - Case ID (optional)
 */
async function navigateToCasePage(page, caseId = '500QO000001XXXXX') {
  // For real testing, you would navigate to actual Salesforce
  // This is a helper for setting up test scenarios
  const url = `https://proquestllc.lightning.force.com/lightning/r/Case/${caseId}/view`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
}

/**
 * Wait for Salesforce page to load
 * @param {Page} page - Puppeteer page
 */
async function waitForSalesforcePage(page) {
  // Wait for Salesforce Lightning to load
  await page.waitForSelector('one-appnav, lightning-layout, records-record-layout-item', {
    timeout: 15000
  });
}

/**
 * Check if page is a Salesforce Lightning page
 * @param {Page} page - Puppeteer page
 * @returns {Promise<boolean>}
 */
async function isSalesforcePage(page) {
  return await page.evaluate(() => {
    return window.location.hostname.includes('salesforce.com') ||
           window.location.hostname.includes('lightning.force.com') ||
           document.querySelector('one-appnav') !== null;
  });
}

module.exports = {
  mockSalesforcePage,
  navigateToCasePage,
  waitForSalesforcePage,
  isSalesforcePage
};

