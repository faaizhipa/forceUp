/**
 * Configuration Warning Banner
 * 
 * Displays a warning banner when the extension is using default values for
 * shift timing, team settings, or IRT expectations on first run.
 * 
 * @module configurationWarningBanner
 * @version 1.0.0
 */

const ConfigurationWarningBanner = (function() {
  'use strict';

  const BANNER_ID = 'cforce-config-warning-banner';
  const BANNER_STYLES = `
    #${BANNER_ID} {
      position: fixed !important;
      top: 0 !important;
      left: 0;
      right: 0;
      width: 100%;
      z-index: 9998;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: #ffffff;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      font-family: 'Salesforce Sans', Arial, sans-serif;
      font-size: 11px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      height: 3rem;
      overflow: hidden;
      display: flex;
      align-items: center;
      animation: slideDown 0.3s ease-out;
    }

    @keyframes slideDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    #${BANNER_ID}-container {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 12px;
      max-width: 100%;
      height: 100%;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;
    }

    #${BANNER_ID}-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      font-size: 14px;
    }

    #${BANNER_ID}-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      padding: 0 8px;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
    }

    #${BANNER_ID}-title {
      font-size: 11px;
      font-weight: 600;
      margin: 0;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: rgba(255, 255, 255, 0.9);
    }

    #${BANNER_ID}-message {
      font-size: 11px;
      line-height: 1.2;
      margin: 0;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${BANNER_ID}-defaults {
      display: none;
    }

    #${BANNER_ID}-actions {
      flex-shrink: 0;
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 0 8px;
    }

    #${BANNER_ID}-btn-configure,
    #${BANNER_ID}-btn-dismiss {
      background-color: rgba(255, 255, 255, 0.2);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 3px;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      height: 26px;
      line-height: 1;
    }

    #${BANNER_ID}-btn-configure {
      background-color: #ffffff;
      color: #ee5a6f;
      border: none;
    }

    #${BANNER_ID}-btn-configure:hover {
      background-color: #f8f8f8;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    #${BANNER_ID}-btn-dismiss:hover {
      background-color: rgba(255, 255, 255, 0.3);
    }

    #${BANNER_ID}-btn-configure:active,
    #${BANNER_ID}-btn-dismiss:active {
      transform: translateY(0);
    }

    /* Scrollbar styling */
    #${BANNER_ID}-container::-webkit-scrollbar {
      height: 4px;
    }

    #${BANNER_ID}-container::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
    }

    #${BANNER_ID}-container::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
    }

    #${BANNER_ID}-container::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    @media (max-width: 768px) {
      #${BANNER_ID}-content {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }

      #${BANNER_ID}-message {
        font-size: 10px;
      }
    }
  `;

  let bannerElement = null;
  let isVisible = false;

  /**
   * Creates the banner HTML structure
   * @param {Object} preferences - Current user preferences
   * @returns {string} HTML string
   */
  function createBannerHTML(preferences) {
    const defaults = [];
    
    // Check what defaults are being used
    if (preferences.meta.isFirstRun) {
      defaults.push(`Shift timing: <strong>9 PM - 6 AM MYT</strong>`);
      defaults.push(`Team: <strong>${preferences.irt.team}</strong>`);
      defaults.push(`IRT expectations: <strong>Team defaults</strong>`);
      
      if (preferences.userTimezone.auto) {
        defaults.push(`User timezone: <strong>Auto-detected (${preferences.userTimezone.detected})</strong>`);
      }
    }

    const defaultsList = defaults.length > 0 
      ? `
        <div id="${BANNER_ID}-defaults">
          <div id="${BANNER_ID}-defaults-title">Currently using defaults:</div>
          <ul id="${BANNER_ID}-defaults-list">
            ${defaults.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `
      : '';

    return `
      <div id="${BANNER_ID}">
        <div id="${BANNER_ID}-container">
          <div id="${BANNER_ID}-icon">⚠️</div>
          <div id="${BANNER_ID}-content">
            <span id="${BANNER_ID}-title">Configuration Required</span>
            <span id="${BANNER_ID}-message">Using default values for shift timing, team settings, and IRT expectations. Configure preferences for accurate case highlighting.</span>
          </div>
          <div id="${BANNER_ID}-actions">
            <button id="${BANNER_ID}-btn-configure">Configure</button>
            <button id="${BANNER_ID}-btn-dismiss">Dismiss</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Injects CSS styles into the page
   */
  function injectStyles() {
    // Check if styles already injected
    if (document.getElementById(`${BANNER_ID}-styles`)) {
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = `${BANNER_ID}-styles`;
    styleElement.textContent = BANNER_STYLES;
    document.head.appendChild(styleElement);
  }

  /**
   * Shows the warning banner
   * @param {Object} preferences - Current user preferences
   * @returns {Promise<void>}
   */
  async function show(preferences) {
    if (isVisible) {
      console.log('[ConfigWarningBanner] Banner already visible');
      return;
    }

    // Inject styles
    injectStyles();

    // Create banner element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = createBannerHTML(preferences);
    bannerElement = tempDiv.firstElementChild;

    // Attach event listeners
    const configureBtn = bannerElement.querySelector(`#${BANNER_ID}-btn-configure`);
    const dismissBtn = bannerElement.querySelector(`#${BANNER_ID}-btn-dismiss`);

    configureBtn.addEventListener('click', handleConfigure);
    dismissBtn.addEventListener('click', handleDismiss);

    // Add to page
    document.body.appendChild(bannerElement);
    isVisible = true;

    console.log('[ConfigWarningBanner] Banner shown');
  }

  /**
   * Hides and removes the warning banner
   * @param {boolean} animate - Whether to animate the removal
   */
  function hide(animate = true) {
    if (!bannerElement || !isVisible) {
      return;
    }

    if (animate) {
      // Animate out
      bannerElement.style.animation = 'slideDown 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) reverse';
      
      setTimeout(() => {
        if (bannerElement && bannerElement.parentNode) {
          bannerElement.remove();
          bannerElement = null;
          isVisible = false;
        }
      }, 300);
    } else {
      // Remove immediately
      bannerElement.remove();
      bannerElement = null;
      isVisible = false;
    }

    console.log('[ConfigWarningBanner] Banner hidden');
  }

  /**
   * Handles configure button click
   * Opens the extension popup for configuration
   */
  function handleConfigure() {
    console.log('[ConfigWarningBanner] Configure clicked - opening popup');
    
    // Send message to background script to open popup
    chrome.runtime.sendMessage({
      action: 'openPopup',
      tab: 'preferences'  // Direct to preferences tab
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[ConfigWarningBanner] Error opening popup:', 
          chrome.runtime.lastError?.message || JSON.stringify(chrome.runtime.lastError));
        // Fallback: show alert
        alert('Please click the extension icon in your browser toolbar to configure preferences.');
      }
    });

    hide();
  }

  /**
   * Handles dismiss button click
   * Marks setup as completed and hides banner
   */
  async function handleDismiss() {
    console.log('[ConfigWarningBanner] Dismiss clicked - using defaults');

    try {
      // Mark setup as completed (but user chose defaults)
      if (typeof UserPreferences !== 'undefined') {
        await UserPreferences.completeSetup();
      }

      hide();
    } catch (error) {
      console.error('[ConfigWarningBanner] Error dismissing banner:', error);
      hide();
    }
  }

  /**
   * Checks if banner should be shown and displays it if needed
   * @returns {Promise<boolean>} True if banner was shown
   */
  async function checkAndShow() {
    try {
      if (typeof UserPreferences === 'undefined') {
        console.warn('[ConfigWarningBanner] UserPreferences module not available');
        return false;
      }

      const shouldShow = await UserPreferences.shouldShowWarning();
      
      if (shouldShow) {
        const preferences = await UserPreferences.get();
        await show(preferences);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[ConfigWarningBanner] Error checking if banner should show:', error);
      return false;
    }
  }

  /**
   * Force shows the banner for testing/debugging
   * @returns {Promise<void>}
   */
  async function forceShow() {
    if (typeof UserPreferences === 'undefined') {
      console.warn('[ConfigWarningBanner] UserPreferences module not available');
      return;
    }

    const preferences = await UserPreferences.get();
    await show(preferences);
  }

  /**
   * Updates banner content if visible
   * @param {Object} preferences - Updated preferences
   */
  function update(preferences) {
    if (!isVisible || !bannerElement) {
      return;
    }

    // Hide current banner
    hide(false);
    
    // Show updated banner
    show(preferences);
  }

  // Public API
  return {
    show,
    hide,
    checkAndShow,
    forceShow,
    update,
    isVisible: () => isVisible
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigurationWarningBanner;
}
