/**
 * Configuration Warning Banner
 * 
 * Displays a warning banner when the extension is using default values for
 * shift timing, team settings, or IRT expectations on first run.
 * 
 * @module configurationWarningBanner
 * @version 1.0.0
 */
/**
 * Sets configuration warning banner height and updates layout for 48px height.
 */
const CONFIG_BANNER_HEIGHT = 48;

const BANNER_ID = 'cforce-config-warning-banner';
const BANNER_STYLES = `
  #${BANNER_ID} {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 999999;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    color: white;
    height: ${CONFIG_BANNER_HEIGHT}px;
    min-height: ${CONFIG_BANNER_HEIGHT}px;
    max-height: ${CONFIG_BANNER_HEIGHT}px;
    padding: 0 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    display: flex;
    align-items: center;
    gap: 12px;
    animation: slideDown 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    box-sizing: border-box;
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

  #${BANNER_ID}-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    font-size: 18px;
    margin-right: 12px;
  }

  #${BANNER_ID}-content {
    flex: 1;
    min-width: 0;
    font-size: 16px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    height: 100%;
  }

  #${BANNER_ID}-close {
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    margin-left: 4px;
    border: none;
    background: transparent;
    color: white;
    font-size: 21px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    border-radius: 50%;
    transition: background 0.15s;
  }
  #${BANNER_ID}-close:hover, #${BANNER_ID}-close:focus {
    background: rgba(255,255,255,0.25);
  }
`;

const ConfigurationWarningBanner = (function() {
  'use strict';

  const BANNER_ID = 'cforce-config-warning-banner';
  const BANNER_STYLES = `
    #${BANNER_ID} {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999999;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: white;
      padding: 16px 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      display: flex;
      align-items: center;
      gap: 16px;
      animation: slideDown 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
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

    #${BANNER_ID}-icon {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      font-size: 20px;
    }

    #${BANNER_ID}-content {
      flex: 1;
      min-width: 0;
    }

    #${BANNER_ID}-title {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 4px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #${BANNER_ID}-message {
      font-size: 13px;
      line-height: 1.5;
      margin: 0;
      opacity: 0.95;
    }

    #${BANNER_ID}-defaults {
      font-size: 12px;
      margin: 8px 0 0 0;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.15);
      border-radius: 6px;
      border-left: 3px solid rgba(255, 255, 255, 0.5);
    }

    #${BANNER_ID}-defaults-title {
      font-weight: 600;
      margin-bottom: 4px;
    }

    #${BANNER_ID}-defaults-list {
      list-style: none;
      padding: 0;
      margin: 4px 0 0 0;
    }

    #${BANNER_ID}-defaults-list li {
      padding: 2px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    #${BANNER_ID}-defaults-list li::before {
      content: "•";
      font-size: 16px;
      opacity: 0.7;
    }

    #${BANNER_ID}-actions {
      flex-shrink: 0;
      display: flex;
      gap: 12px;
      align-items: center;
    }

    #${BANNER_ID}-btn-configure,
    #${BANNER_ID}-btn-dismiss {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    #${BANNER_ID}-btn-configure {
      background: white;
      color: #ee5a6f;
    }

    #${BANNER_ID}-btn-configure:hover {
      background: #f8f8f8;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    #${BANNER_ID}-btn-dismiss {
      background: rgba(255, 255, 255, 0.15);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    #${BANNER_ID}-btn-dismiss:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    #${BANNER_ID}-btn-configure:active,
    #${BANNER_ID}-btn-dismiss:active {
      transform: translateY(0);
    }

    @media (max-width: 768px) {
      #${BANNER_ID} {
        flex-direction: column;
        text-align: center;
      }

      #${BANNER_ID}-actions {
        width: 100%;
        flex-direction: column;
      }

      #${BANNER_ID}-btn-configure,
      #${BANNER_ID}-btn-dismiss {
        width: 100%;
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
        <div id="${BANNER_ID}-icon">⚠️</div>
        <div id="${BANNER_ID}-content">
          <div id="${BANNER_ID}-title">
            Configuration Required
          </div>
          <div id="${BANNER_ID}-message">
            The extension is using default values for shift timing, team settings, and IRT expectations. 
            Please configure your preferences to ensure accurate case highlighting and timezone handling.
          </div>
          ${defaultsList}
        </div>
        <div id="${BANNER_ID}-actions">
          <button id="${BANNER_ID}-btn-configure">Configure Now</button>
          <button id="${BANNER_ID}-btn-dismiss">Use Defaults</button>
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
