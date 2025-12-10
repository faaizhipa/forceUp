'use strict';

const GlobalSyncApp = (() => {
  'use strict';

  const STYLE_ID = 'gsw-shared-theme';
  const POPUP_LAYER_CLASS = 'gsw-popup-layer';
  let rootElement = null;
  let unsubscribe = null;
  let isMounted = false;
  let popupContainer = null;

  function _resolveAssetPath(relativePath) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(relativePath);
    }
    return relativePath;
  }

  function _ensureStylesheet() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = _resolveAssetPath('modules/globalSyncTheme.css');
    document.head.appendChild(link);
  }

  function _ensurePopupLayer() {
    if (!rootElement) {
      return null;
    }
    if (popupContainer && popupContainer.isConnected) {
      return popupContainer;
    }
    popupContainer = document.createElement('div');
    popupContainer.className = POPUP_LAYER_CLASS;
    rootElement.appendChild(popupContainer);
    return popupContainer;
  }

  function _renderPlaceholder(text) {
    if (!rootElement) {
      return;
    }
    rootElement.innerHTML = `
      <div class="gsw-card-section">
        <p class="gsw-date-display">${text}</p>
      </div>
    `;
    _ensurePopupLayer();
  }

  function _render(state) {
    if (!rootElement) {
      return;
    }
    // Placeholder UI for preview; replace with composed UI when available
    rootElement.innerHTML = `
      <div class="gsw-card-section">
        <div class="gsw-chip" style="justify-content: space-between; width: 100%;">
          <span>Global Sync Widget (Preview)</span>
          <span>${state.localTimezone} → ${state.customerTimezone}</span>
        </div>
        <p class="gsw-date-display" style="margin-top: 12px;">
          Favorites: ${state.favoriteTimezones.length} • Theme: ${state.themePreference}
        </p>
      </div>
    `;
    _ensurePopupLayer();
  }

  async function init(targetEl, options = {}) {
    if (!targetEl) {
      throw new Error('[GlobalSyncApp] target element is required');
    }

    rootElement = targetEl;
    rootElement.classList.add('gsw-theme-root', 'gsw-surface');

    _ensureStylesheet();
    _renderPlaceholder('Loading timezones...');

    const state = await GlobalSyncStateStore.initialize();
    GlobalSyncThemeController.init({
      root: rootElement,
      preference: state.themePreference
    });

    unsubscribe = GlobalSyncStateStore.subscribe((event) => {
      if (event === 'updated') {
        _render(GlobalSyncStateStore.getSnapshot());
      }
    });

    _render(state);
    isMounted = true;

    if (options.onReady) {
      options.onReady(state);
    }

    return state;
  }

  function updateTheme(preference) {
    GlobalSyncStateStore.setTheme(preference);
    GlobalSyncThemeController.setPreference(preference);
  }

  function destroy() {
    if (!isMounted) {
      return;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    GlobalSyncThemeController.teardown();
    if (rootElement) {
      rootElement.innerHTML = '';
      rootElement.classList.remove('gsw-theme-root', 'gsw-surface');
      rootElement.removeAttribute('data-theme');
    }
    popupContainer = null;
    rootElement = null;
    isMounted = false;
  }

  return {
    init,
    destroy,
    updateTheme,
    getPopupContainer: () => _ensurePopupLayer()
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlobalSyncApp;
}
