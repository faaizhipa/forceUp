'use strict';

const GlobalSyncThemeController = (() => {
  'use strict';

  const THEME_ATTR = 'data-theme';
  let mediaQuery = null;
  let currentPreference = 'auto';
  let rootTarget = null;

  function _resolveTheme(preference) {
    if (preference === 'light' || preference === 'dark') {
      return preference;
    }
    if (mediaQuery && typeof mediaQuery.matches === 'boolean') {
      return mediaQuery.matches ? 'dark' : 'light';
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'dark';
  }

  function _apply(theme) {
    if (!rootTarget) {
      return;
    }
    rootTarget.setAttribute(THEME_ATTR, theme);
  }

  function _handleMediaChange(event) {
    if (currentPreference !== 'auto') {
      return;
    }
    _apply(event.matches ? 'dark' : 'light');
  }

  function init(options = {}) {
    rootTarget = options.root || document.documentElement;
    currentPreference = options.preference || 'auto';

    if (typeof window !== 'undefined' && window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', _handleMediaChange);
    }

    _apply(_resolveTheme(currentPreference));
  }

  function setPreference(preference) {
    currentPreference = preference;
    _apply(_resolveTheme(preference));
  }

  function teardown() {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', _handleMediaChange);
      mediaQuery = null;
    }
    rootTarget = null;
  }

  return {
    init,
    setPreference,
    teardown
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlobalSyncThemeController;
}
