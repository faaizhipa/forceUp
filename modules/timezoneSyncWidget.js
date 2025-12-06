/**
 * Timezone Sync Widget Wrapper
 * Provides a lightweight overlay around GlobalSyncWidget for use inside the
 * Salesforce content scripts and PersistentBanner actions.
 */
const TimezoneSyncWidget = (() => {
  'use strict';

  const OVERLAY_ID = 'exl-timezone-sync-overlay';
  const CONTAINER_ID = 'exl-timezone-sync-container';
  const STYLE_ID = 'exl-timezone-sync-styles';

  let overlayEl = null;
  let containerEl = null;
  let escHandler = null;
  let isVisible = false;

  function ensureDependencies() {
    if (typeof GlobalSyncWidget === 'undefined') {
      console.error('[TimezoneSyncWidget] GlobalSyncWidget is required but not loaded');
      return false;
    }
    if (typeof TimezoneUtils === 'undefined') {
      console.error('[TimezoneSyncWidget] TimezoneUtils is required but not loaded');
      return false;
    }
    return true;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      #${OVERLAY_ID}.visible {
        display: flex;
      }
      #${OVERLAY_ID} .exl-timezone-shell {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 12px;
        min-width: 360px;
        max-width: 720px;
        box-shadow: 0 10px 35px rgba(0, 0, 0, 0.45);
      }
      #${OVERLAY_ID} .exl-timezone-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
        color: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #${OVERLAY_ID} .exl-timezone-close {
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.08);
        color: #e2e8f0;
        border-radius: 8px;
        padding: 6px 10px;
        cursor: pointer;
      }
      #${OVERLAY_ID} .exl-timezone-close:hover {
        background: rgba(255, 255, 255, 0.16);
      }
    `;

    document.head.appendChild(style);
  }

  function buildOverlay() {
    if (overlayEl) return;

    injectStyles();

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.setAttribute('data-exl-injected', 'true');

    const shell = document.createElement('div');
    shell.className = 'exl-timezone-shell';

    const header = document.createElement('div');
    header.className = 'exl-timezone-header';

    const title = document.createElement('div');
    title.textContent = 'Timezone Inspector';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'exl-timezone-close';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', hide);

    header.appendChild(title);
    header.appendChild(closeBtn);

    containerEl = document.createElement('div');
    containerEl.id = CONTAINER_ID;

    shell.appendChild(header);
    shell.appendChild(containerEl);
    overlayEl.appendChild(shell);
    document.body.appendChild(overlayEl);

    overlayEl.addEventListener('click', (event) => {
      if (event.target === overlayEl) {
        hide();
      }
    });
  }

  async function getUserTimezone(preferred) {
    if (preferred) return preferred;

    try {
      if (typeof UserPreferences !== 'undefined') {
        const prefs = await UserPreferences.load();
        const effective = UserPreferences.getEffectiveUserTimezone(prefs);
        if (effective) return effective;
        if (prefs?.userTimezone?.manual) return prefs.userTimezone.manual;
        if (prefs?.userTimezone?.detected) return prefs.userTimezone.detected;
      }
    } catch (error) {
      console.warn('[TimezoneSyncWidget] Failed to read user preferences:', error);
    }

    return TimezoneUtils.getBrowserTimezone();
  }

  async function getFavoriteTimezones(favorites) {
    if (favorites && Array.isArray(favorites)) {
      return favorites.filter(Boolean);
    }

    try {
      if (typeof UserPreferences !== 'undefined') {
        const prefs = await UserPreferences.load();
        return (prefs?.favoriteTimezones || []).filter(Boolean);
      }
    } catch (error) {
      console.warn('[TimezoneSyncWidget] Failed to read favorite timezones:', error);
    }

    return [];
  }

  async function buildConfig(options = {}) {
    const localTimezone = await getUserTimezone(options.localTimezone);
    const customerTimezone = options.customerTimezone || options.targetTimezone || null;
    const favoriteTimezones = await getFavoriteTimezones(options.favoriteTimezones);

    return { localTimezone, customerTimezone, favoriteTimezones };
  }

  async function show(options = {}) {
    if (!ensureDependencies()) return false;

    const config = await buildConfig(options);
    if (!config.customerTimezone) {
      console.warn('[TimezoneSyncWidget] Missing customer timezone');
      return false;
    }

    buildOverlay();

    overlayEl.classList.add('visible');
    overlayEl.setAttribute('aria-hidden', 'false');

    if (typeof GlobalSyncWidget.destroy === 'function' && containerEl) {
      GlobalSyncWidget.destroy();
      containerEl.innerHTML = '';
    }

    const initResult = GlobalSyncWidget.init(containerEl, config);
    if (!initResult) {
      hide();
      return false;
    }

    if (!escHandler) {
      escHandler = (event) => {
        if (event.key === 'Escape') {
          hide();
        }
      };
      document.addEventListener('keydown', escHandler, true);
    }

    isVisible = true;
    return true;
  }

  function hide() {
    if (typeof GlobalSyncWidget !== 'undefined' && typeof GlobalSyncWidget.destroy === 'function') {
      GlobalSyncWidget.destroy();
    }

    if (overlayEl) {
      overlayEl.classList.remove('visible');
      overlayEl.setAttribute('aria-hidden', 'true');
    }

    if (escHandler) {
      document.removeEventListener('keydown', escHandler, true);
      escHandler = null;
    }

    isVisible = false;
  }

  return {
    show,
    hide,
    isVisible: () => isVisible
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezoneSyncWidget;
}
