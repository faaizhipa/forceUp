/**
 * Example: Integrating WorldMap with Vanilla JS Widgets
 * 
 * This demonstrates how to use the Preact WorldMap component
 * within your existing vanilla JS globalSyncWidget
 */

// ============================================================================
// Method 1: Direct Integration (Recommended)
// ============================================================================

/**
 * Enhanced globalSyncWidget with WorldMap
 * Adds WorldMap to your existing widget
 */
const EnhancedGlobalSyncWidget = (() => {
  'use strict';

  // Import the bridge (make sure this is loaded first)
  // <script type="module" src="preact-modules/preact-bridge.js"></script>

  function createWidget(config) {
    const { 
      localTimezone, 
      customerTimezone, 
      favoriteTimezones = []
    } = config;

    // Create container
    const container = document.createElement('div');
    container.className = 'gsw-container';

    // Create header
    const header = document.createElement('div');
    header.className = 'gsw-header';
    header.innerHTML = `
      <h2 class="gsw-title">Global Sync Utility</h2>
    `;
    container.appendChild(header);

    // Create WorldMap container
    const mapContainer = document.createElement('div');
    mapContainer.id = 'worldmap-container';
    mapContainer.style.marginBottom = '16px';
    container.appendChild(mapContainer);

    // Mount WorldMap using PreactBridge
    const currentTime = new Date();
    const pins = [
      { 
        timezone: localTimezone, 
        label: 'Local',
        lat: 0, // Will be auto-filled from TIMEZONE_COORDS
        lng: 0
      },
      { 
        timezone: customerTimezone, 
        label: 'Target',
        lat: 0,
        lng: 0
      },
      ...favoriteTimezones.map(tz => ({
        timezone: tz,
        label: tz.split('/').pop() || tz,
        lat: 0,
        lng: 0
      }))
    ];

    // Wait for PreactBridge to be available
    if (window.PreactBridge) {
      window.PreactBridge.mountWorldMap(mapContainer, {
        currentTime,
        pins
      });
    } else {
      console.warn('PreactBridge not loaded. WorldMap will not be displayed.');
    }

    // Your existing widget content continues here...
    const content = document.createElement('div');
    content.className = 'gsw-content';
    content.innerHTML = `
      <p>Your existing widget content...</p>
    `;
    container.appendChild(content);

    // Update WorldMap periodically
    const updateInterval = setInterval(() => {
      if (window.PreactBridge && mapContainer.isConnected) {
        window.PreactBridge.updateWorldMap(mapContainer, {
          currentTime: new Date(),
          pins
        });
      }
    }, 60000); // Update every minute

    // Cleanup on removal
    const originalRemove = container.remove.bind(container);
    container.remove = function() {
      clearInterval(updateInterval);
      if (window.PreactBridge) {
        window.PreactBridge.unmount(mapContainer);
      }
      originalRemove();
    };

    return container;
  }

  return { createWidget };
})();

// ============================================================================
// Method 2: Optional WorldMap (Graceful Degradation)
// ============================================================================

/**
 * Add WorldMap to existing widget as an optional enhancement
 */
function addWorldMapToWidget(widgetElement, config) {
  // Find or create map container
  let mapContainer = widgetElement.querySelector('#worldmap-container');
  
  if (!mapContainer) {
    mapContainer = document.createElement('div');
    mapContainer.id = 'worldmap-container';
    mapContainer.style.marginBottom = '16px';
    
    // Insert at the beginning of widget
    widgetElement.insertBefore(mapContainer, widgetElement.firstChild);
  }

  // Mount WorldMap if available
  if (window.PreactBridge) {
    const { localTimezone, customerTimezone, favoriteTimezones = [] } = config;
    
    const pins = [
      { timezone: localTimezone, label: 'Local', lat: 0, lng: 0 },
      { timezone: customerTimezone, label: 'Target', lat: 0, lng: 0 },
      ...favoriteTimezones.map(tz => ({
        timezone: tz,
        label: tz.split('/').pop() || tz,
        lat: 0,
        lng: 0
      }))
    ];

    window.PreactBridge.mountWorldMap(mapContainer, {
      currentTime: new Date(),
      pins
    });

    return mapContainer;
  }

  return null;
}

// ============================================================================
// Method 3: Standalone WorldMap Widget
// ============================================================================

/**
 * Create standalone WorldMap widget
 */
function createWorldMapWidget(timezones = []) {
  const container = document.createElement('div');
  container.className = 'worldmap-widget';
  container.style.cssText = `
    background: var(--gsw-card);
    border-radius: var(--gsw-radius-lg);
    padding: 16px;
    box-shadow: var(--gsw-shadow);
    border: 1px solid var(--gsw-border);
  `;

  const title = document.createElement('h3');
  title.textContent = 'World View';
  title.style.cssText = `
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 12px 0;
    color: var(--gsw-foreground);
  `;
  container.appendChild(title);

  const mapContainer = document.createElement('div');
  mapContainer.id = 'standalone-worldmap';
  container.appendChild(mapContainer);

  if (window.PreactBridge) {
    const pins = timezones.map(tz => ({
      timezone: tz,
      label: tz.split('/').pop() || tz,
      lat: 0,
      lng: 0
    }));

    window.PreactBridge.mountWorldMap(mapContainer, {
      currentTime: new Date(),
      pins
    });

    // Auto-update
    const interval = setInterval(() => {
      if (mapContainer.isConnected) {
        window.PreactBridge.updateWorldMap(mapContainer, {
          currentTime: new Date(),
          pins
        });
      }
    }, 60000);

    // Cleanup
    const originalRemove = container.remove.bind(container);
    container.remove = function() {
      clearInterval(interval);
      if (window.PreactBridge) {
        window.PreactBridge.unmount(mapContainer);
      }
      originalRemove();
    };
  }

  return container;
}

// ============================================================================
// Usage Examples
// ============================================================================

// Example 1: Enhanced widget
/*
const widget = EnhancedGlobalSyncWidget.createWidget({
  localTimezone: 'America/New_York',
  customerTimezone: 'Asia/Singapore',
  favoriteTimezones: ['Europe/London', 'Asia/Tokyo']
});
document.body.appendChild(widget);
*/

// Example 2: Add to existing widget
/*
const existingWidget = GlobalSyncWidget.createWidget(config);
document.body.appendChild(existingWidget);

// Add WorldMap after creation
addWorldMapToWidget(existingWidget, config);
*/

// Example 3: Standalone WorldMap
/*
const mapWidget = createWorldMapWidget([
  'America/New_York',
  'Europe/London',
  'Asia/Singapore',
  'Asia/Tokyo'
]);
document.getElementById('map-section').appendChild(mapWidget);
*/

// ============================================================================
// HTML Setup Required
// ============================================================================

/*
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Timezone Widget</title>
  <!-- Your existing styles -->
  <link rel="stylesheet" href="styles/widget.css">
</head>
<body>
  <div id="widget-container"></div>

  <!-- Load Preact modules FIRST -->
  <script type="module" src="preact-modules/preact-bridge.js"></script>
  
  <!-- Then load your vanilla JS modules -->
  <script src="modules/timezoneUtils.js"></script>
  <script src="modules/globalSyncWidget.js"></script>
  
  <!-- Finally initialize -->
  <script type="module">
    // Wait for PreactBridge to load
    window.addEventListener('DOMContentLoaded', () => {
      const widget = EnhancedGlobalSyncWidget.createWidget({
        localTimezone: 'America/New_York',
        customerTimezone: 'Asia/Singapore',
        favoriteTimezones: []
      });
      
      document.getElementById('widget-container').appendChild(widget);
    });
  </script>
</body>
</html>
*/

// Export for ES modules
export { 
  EnhancedGlobalSyncWidget,
  addWorldMapToWidget,
  createWorldMapWidget
};
