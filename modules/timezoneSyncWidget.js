/**
 * Timezone Sync Widget Wrapper
 * Provides a lightweight overlay around GlobalSyncWidget for use inside the
 * Salesforce content scripts and PersistentBanner actions.
 * 
 * Includes a Mercator world map with real-time day/night terminator.
 */
const TimezoneSyncWidget = (() => {
  'use strict';

  const OVERLAY_ID = 'exl-timezone-sync-overlay';
  const CONTAINER_ID = 'exl-timezone-sync-container';
  const MAP_CONTAINER_ID = 'exl-timezone-map-container';
  const STYLE_ID = 'exl-timezone-sync-styles';
  const MAP_UPDATE_INTERVAL_MS = 60000;

  let overlayEl = null;
  let shellEl = null;
  let containerEl = null;
  let mapContainerEl = null;
  let legendEl = null;
  let escHandler = null;
  let isVisible = false;
  let mapUpdateInterval = null;
  let currentConfig = null;
  let originalCustomerTimezone = null;
  let customerTzInput = null;
  let allTimezones = null;
  let PreactBridge = null;

  // ============================================================================
  // Preact Bridge Loading (Command-based API)
  // ============================================================================

  // Flag to track if bridge is ready (not the object itself, since it's in page context)
  let bridgeReady = false;

  /**
   * Load PreactBridge using the loader injected by preact-bridge-loader.js
   * 
   * The loader uses a command-based API because content scripts and page scripts
   * have isolated window objects. We communicate via DOM elements.
   * 
   * @returns {Promise<boolean>} True if bridge loaded successfully
   */
  async function loadBridge() {
    if (bridgeReady) {
      return true;
    }
    
    // Use the loader's wait helper
    if (typeof window.waitForPreactBridge === 'function') {
      console.log('[TimezoneSyncWidget] Waiting for PreactBridge via loader...');
      const loaded = await window.waitForPreactBridge(10000);
      if (loaded) {
        bridgeReady = true;
        console.log('[TimezoneSyncWidget] PreactBridge is ready');
        return true;
      }
    } else {
      console.error('[TimezoneSyncWidget] waitForPreactBridge not available - loader not injected?');
    }
    
    console.error('[TimezoneSyncWidget] Failed to load PreactBridge - timeout');
    return false;
  }

  /**
   * Send a command to PreactBridge in page context
   */
  async function sendCommand(action, containerId, props) {
    if (typeof window.sendPreactCommand === 'function') {
      return await window.sendPreactCommand(action, containerId, props);
    }
    throw new Error('sendPreactCommand not available');
  }

  // ============================================================================
  // Map Rendering (Command-based API to PreactBridge in page context)
  // ============================================================================

  function renderMap(date) {
    if (!mapContainerEl) {
      console.warn('[TimezoneSyncWidget] mapContainerEl not found');
      return;
    }

    if (!bridgeReady) {
      console.warn('[TimezoneSyncWidget] PreactBridge not ready, cannot render map');
      return;
    }

    // Ensure container has an ID for command API
    if (!mapContainerEl.id) {
      mapContainerEl.id = 'tsw-map-' + Date.now();
    }

    const pins = [];

    if (currentConfig?.localTimezone) {
      pins.push({ timezone: currentConfig.localTimezone, label: 'You', lat: 0, lng: 0 });
    }
    if (currentConfig?.customerTimezone) {
      pins.push({ timezone: currentConfig.customerTimezone, label: 'Customer', lat: 0, lng: 0 });
    }
    if (currentConfig?.favoriteTimezones && Array.isArray(currentConfig.favoriteTimezones)) {
      currentConfig.favoriteTimezones.forEach(tz => {
        if (tz && tz !== currentConfig.localTimezone && tz !== currentConfig.customerTimezone) {
          pins.push({ timezone: tz, label: 'Fav', lat: 0, lng: 0 });
        }
      });
    }

    const props = {
      currentTime: date.toISOString(),
      pins: pins
    };

    // Send command to page context
    if (!mapContainerEl.hasAttribute('data-preact-mounted')) {
      sendCommand('mountWorldMap', mapContainerEl.id, props)
        .then(() => {
          mapContainerEl.setAttribute('data-preact-mounted', 'true');
          console.log('[TimezoneSyncWidget] WorldMap mounted');
        })
        .catch(err => {
          console.error('[TimezoneSyncWidget] Failed to mount WorldMap:', err);
        });
    } else {
      sendCommand('updateWorldMap', mapContainerEl.id, props)
        .catch(err => {
          console.error('[TimezoneSyncWidget] Failed to update WorldMap:', err);
        });
    }
  }

  function startMapUpdates() {
    stopMapUpdates();
    renderMap(new Date());
    mapUpdateInterval = setInterval(() => renderMap(new Date()), MAP_UPDATE_INTERVAL_MS);
  }

  function stopMapUpdates() {
    if (mapUpdateInterval) {
      clearInterval(mapUpdateInterval);
      mapUpdateInterval = null;
    }
    if (mapContainerEl && PreactBridge) {
        // Optional: PreactBridge.unmount(mapContainerEl); 
        // We might want to keep it mounted if we just hide/show, but unmounting is safer for cleanup
        // But for hide(), we might just hide the overlay. destroyerOverlay calls this?
        // Let's stick to clearing interval here. Unmount happens in destroyOverlay.
    }
  }

  // ============================================================================
  // Widget Core Functions
  // ============================================================================

  function ensureDependencies() {
    if (typeof GlobalSyncWidget === 'undefined') {
      console.error('[TimezoneSyncWidget] GlobalSyncWidget is required but not loaded');
      return false;
    }
    // TimezoneUtils is still needed for dropdown
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
        backdrop-filter: blur(4px);
      }
      #${OVERLAY_ID}.visible {
        display: flex;
        animation: exl-fade-in 0.2s ease-out;
      }
      @keyframes exl-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      #${OVERLAY_ID} .exl-timezone-shell {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 0; 
        min-width: 360px;
        width: min(800px, 90vw);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      #${OVERLAY_ID} .exl-timezone-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        color: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        width: 100%;
        font-weight: 600;
      }
      #${OVERLAY_ID} .exl-timezone-close {
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 12px;
        line-height: 1;
      }
      #${OVERLAY_ID} .exl-timezone-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #f8fafc;
        border-color: rgba(255, 255, 255, 0.2);
      }
      #${MAP_CONTAINER_ID} {
        background: #020617;
        position: relative;
        width: 800px;
        max-width: 100%;
        height: 250px;
        min-height: 250px;
        aspect-ratio: 32 / 10;
      }

      /* Ensure map children respect the container box */
      #${MAP_CONTAINER_ID} > * {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
      }

      #${MAP_CONTAINER_ID} svg {
        width: 100%;
        height: 100%;
      }
      
      /* New Legend Style (matches WorldMap) */
      .exl-map-legend {
        display: none; /* WorldMap has its own legend or visual cues */
      }
      
      /* Customer Timezone Selector */
      .exl-tz-selector {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        margin: 0 16px;
        max-width: 400px;
      }
      .exl-tz-selector label {
        font-size: 13px;
        color: #94a3b8;
        white-space: nowrap;
      }
      .exl-tz-selector input {
        flex: 1;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 6px 10px;
        color: #e2e8f0;
        font-size: 13px;
        font-family: inherit;
        outline: none;
        transition: all 0.15s ease;
      }
      .exl-tz-selector input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        background: rgba(0, 0, 0, 0.3);
      }
      .exl-tz-selector input.exl-tz-input-error {
        border-color: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
      }
      .exl-tz-selector input::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }
      .exl-tz-error-msg {
        font-size: 11px;
        color: #ef4444;
        display: none;
        margin-left: 4px;
        animation: slide-down 0.2s ease-out;
      }
      .exl-tz-selector.has-error .exl-tz-error-msg {
        display: inline;
      }

      /* Container for GlobalSyncWidget */
      #${CONTAINER_ID} {
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        background: #0f172a;
        width: 100%;
      }
    `;
    document.head.appendChild(style);
  }

  function destroyOverlay() {
    if (mapContainerEl && PreactBridge) {
        PreactBridge.unmount(mapContainerEl);
    }
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
      shellEl = null;
      mapContainerEl = null;
      legendEl = null;
      containerEl = null;
      customerTzInput = null;
    }
  }

  function handleCustomerTimezoneChange(event) {
    const newValue = event.target.value.trim();
    const selectorWrapper = event.target.closest('.exl-tz-selector');
    
    // Validate against known timezones
    if (!allTimezones) {
      allTimezones = TimezoneUtils.getAllTimezones();
    }
    
    const isValid = allTimezones.includes(newValue);
    
    if (isValid) {
      // Clear error state
      event.target.classList.remove('exl-tz-input-error');
      selectorWrapper.classList.remove('has-error');
      
      // Update config
      currentConfig.customerTimezone = newValue;
      
      // Update GlobalSyncWidget
      if (typeof GlobalSyncWidget !== 'undefined' && typeof GlobalSyncWidget.updateConfig === 'function') {
        GlobalSyncWidget.updateConfig({ customerTimezone: newValue });
      }
      
      // Re-render map with new marker position
      renderMap(new Date());
      
      console.log('[TimezoneSyncWidget] Customer timezone changed to:', newValue);
    } else {
      // Show error state
      event.target.classList.add('exl-tz-input-error');
      selectorWrapper.classList.add('has-error');
      console.warn('[TimezoneSyncWidget] Invalid timezone:', newValue);
    }
  }

  function buildOverlay() {
    // Always destroy and rebuild to ensure fresh DOM
    destroyOverlay();

    injectStyles();

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.setAttribute('data-exl-injected', 'true');

    shellEl = document.createElement('div');
    shellEl.className = 'exl-timezone-shell';

    // Header
    const header = document.createElement('div');
    header.className = 'exl-timezone-header';
    const title = document.createElement('div');
    title.textContent = 'Timezone Inspector';
    
    // Customer Timezone Selector
    const selectorWrapper = document.createElement('div');
    selectorWrapper.className = 'exl-tz-selector';
    
    const selectorLabel = document.createElement('label');
    selectorLabel.textContent = 'Customer:';
    
    customerTzInput = document.createElement('input');
    customerTzInput.type = 'text';
    customerTzInput.id = 'exl-tz-input';
    customerTzInput.setAttribute('list', 'exl-tz-list');
    customerTzInput.placeholder = 'Search timezone...';
    customerTzInput.value = currentConfig?.customerTimezone || '';
    customerTzInput.autocomplete = 'off';
    
    const datalist = document.createElement('datalist');
    datalist.id = 'exl-tz-list';
    
    // Populate datalist with all IANA timezones (cached)
    if (!allTimezones) {
      allTimezones = TimezoneUtils.getAllTimezones();
    }
    allTimezones.forEach(tz => {
      const option = document.createElement('option');
      option.value = tz;
      datalist.appendChild(option);
    });
    
    const errorMsg = document.createElement('span');
    errorMsg.className = 'exl-tz-error-msg';
    errorMsg.textContent = 'Invalid timezone';
    
    // Handle timezone change
    customerTzInput.addEventListener('change', handleCustomerTimezoneChange);
    
    selectorWrapper.appendChild(selectorLabel);
    selectorWrapper.appendChild(customerTzInput);
    selectorWrapper.appendChild(datalist);
    selectorWrapper.appendChild(errorMsg);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'exl-timezone-close';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', hide);
    
    header.appendChild(title);
    header.appendChild(selectorWrapper);
    header.appendChild(closeBtn);
    shellEl.appendChild(header);

    // Map container (ABOVE the GlobalSyncWidget)
    mapContainerEl = document.createElement('div');
    mapContainerEl.id = MAP_CONTAINER_ID;
    shellEl.appendChild(mapContainerEl);

    // Widget container (for GlobalSyncWidget - this gets replaced by GSW)
    containerEl = document.createElement('div');
    containerEl.id = CONTAINER_ID;
    shellEl.appendChild(containerEl);

    overlayEl.appendChild(shellEl);
    document.body.appendChild(overlayEl);

    overlayEl.addEventListener('click', (event) => {
      if (event.target === overlayEl) hide();
    });

    console.log('[TimezoneSyncWidget] Overlay built with map container');
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
    if (favorites && Array.isArray(favorites)) return favorites.filter(Boolean);
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

  function hide() {
    if (overlayEl) {
      overlayEl.classList.remove('visible');
      stopMapUpdates();
      
      // Delay removal to allow fade out
      setTimeout(() => {
        if (overlayEl) {
          overlayEl.style.display = 'none';
          destroyOverlay(); // Cleanup DOM and Preact
        }
      }, 200);
    }
    isVisible = false;
  }

  async function show(options = {}) {
    if (!ensureDependencies()) return false;

    // Load PreactBridge before proceeding
    const bridgeLoaded = await loadBridge();
    if (!bridgeLoaded) {
        console.error('[TimezoneSyncWidget] Cannot show widget: Bridge failed to load');
        return false;
    }

    const config = await buildConfig(options);
    if (!config.customerTimezone) {
      console.warn('[TimezoneSyncWidget] Missing customer timezone');
      return false;
    }

    currentConfig = config;
    
    // Store original customer timezone for reset on close
    originalCustomerTimezone = config.customerTimezone;

    // Build fresh overlay
    buildOverlay();

    // Show overlay
    overlayEl.style.display = 'flex';
    // Small delay to trigger transition
    requestAnimationFrame(() => {
        if (overlayEl) overlayEl.classList.add('visible');
    });
    overlayEl.setAttribute('aria-hidden', 'false');

    // Render map FIRST
    startMapUpdates();

    // Initialize GlobalSyncWidget inside containerEl
    if (typeof GlobalSyncWidget.destroy === 'function') {
      GlobalSyncWidget.destroy();
    }

    const initResult = GlobalSyncWidget.init(containerEl, config);
    if (!initResult) {
      hide();
      return false;
    }

    isVisible = true;
    return true;
  }

  return {
    show,
    hide,
    isVisible: () => isVisible
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezoneSyncWidget;
} else {
  window.TimezoneSyncWidget = TimezoneSyncWidget;
}
