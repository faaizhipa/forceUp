/**
 * PreactBridge Loader - Non-ES-Module Wrapper for Content Scripts
 * 
 * This script loads the PreactBridge ES module into the page context
 * and provides a DOM-based API for content scripts to use it.
 * 
 * CRITICAL: Content scripts and page scripts have ISOLATED window objects!
 * - Content script's window.PreactBridge is NOT the same as page's window.PreactBridge
 * - We use CustomEvents with DOM elements to communicate between contexts
 * 
 * How it works:
 * 1. This script runs in content script context
 * 2. It injects a <script type="module"> that loads PreactBridge in page context
 * 3. Commands are sent via CustomEvents on a shared DOM element
 * 4. Page context executes commands and sends results back via DOM
 */
(function() {
  'use strict';

  const LOG_PREFIX = '[PreactBridgeLoader]';
  const CONFIG_ELEMENT_ID = '__preact_bridge_config__';
  const COMMAND_ELEMENT_ID = '__preact_bridge_commands__';

  // Prevent double-loading
  if (window.__preactBridgeLoaderInitialized) {
    console.log(LOG_PREFIX, 'Already initialized, skipping');
    return;
  }
  window.__preactBridgeLoaderInitialized = true;

  /**
   * Get the extension's resource URL
   */
  function getExtensionUrl(path) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(path);
    }
    console.error(LOG_PREFIX, 'chrome.runtime.getURL not available');
    return null;
  }

  /**
   * Create config element with all pre-resolved URLs
   */
  function setupConfigElement() {
    let configElement = document.getElementById(CONFIG_ELEMENT_ID);
    if (!configElement) {
      configElement = document.createElement('div');
      configElement.id = CONFIG_ELEMENT_ID;
      configElement.style.display = 'none';
      document.documentElement.appendChild(configElement);
    }

    // Pre-resolve all known extension resource URLs
    const resources = {
      // Use the lightweight bridge to avoid CSP issues from external deps
      'bridge': 'preact-modules/preact-bridge-lite.js',
      'topology': 'preact-modules/lib/countries-110m.json'
    };
    
    Object.entries(resources).forEach(([key, path]) => {
      const url = getExtensionUrl(path);
      if (url) {
        configElement.setAttribute(`data-${key}-url`, url);
      }
    });
    
    console.log(LOG_PREFIX, 'Config element created with URLs');
    return configElement;
  }

  /**
   * Create command element for DOM-based communication
   */
  function setupCommandElement() {
    let cmdElement = document.getElementById(COMMAND_ELEMENT_ID);
    if (!cmdElement) {
      cmdElement = document.createElement('div');
      cmdElement.id = COMMAND_ELEMENT_ID;
      cmdElement.style.display = 'none';
      document.documentElement.appendChild(cmdElement);
    }
    return cmdElement;
  }

  /**
   * Inject the module loader script into page context
   */
  function injectModuleScript() {
    const configElement = setupConfigElement();
    setupCommandElement();
    
    const bridgeUrl = configElement.getAttribute('data-bridge-url');
    if (!bridgeUrl) {
      console.error(LOG_PREFIX, 'Cannot get bridge URL');
      return false;
    }

    // Check if already injected
    if (document.querySelector(`script[data-preact-bridge-loader="true"]`)) {
      console.log(LOG_PREFIX, 'Script already injected, skipping');
      return true;
    }

    // Create the page-side handler code
    // This runs in page context and handles commands from content script
    const pageHandlerCode = `
      (async function() {
        const CONFIG_ID = '${CONFIG_ELEMENT_ID}';
        const CMD_ID = '${COMMAND_ELEMENT_ID}';
        
        try {
          const config = document.getElementById(CONFIG_ID);
          const bridgeUrl = config?.getAttribute('data-bridge-url');
          
          if (!bridgeUrl) {
            throw new Error('No bridge URL in config');
          }
          
          // Store topology URL globally for WorldMap to use
          window.__extensionUrls = {
            topology: config?.getAttribute('data-topology-url')
          };
          window.getExtensionResourceUrl = function(path) {
            if (path.includes('countries-110m.json')) {
              return window.__extensionUrls.topology;
            }
            return null;
          };
          
          console.log('[PreactBridge] Loading from:', bridgeUrl);
          const bridgeModule = await import(bridgeUrl);
          
          window.PreactBridge = bridgeModule.default || bridgeModule.PreactBridge;
          
          if (!window.PreactBridge) {
            throw new Error('No PreactBridge export found');
          }
          
          console.log('[PreactBridge] Loaded successfully in page context');
          
          // Mark as ready
          config.setAttribute('data-ready', 'true');
          
          // Set up command handler
          const cmdElement = document.getElementById(CMD_ID);
          if (cmdElement) {
            cmdElement.addEventListener('preact-command', function(e) {
              const { id, action, containerId, props } = e.detail || {};
              
              try {
                const container = document.getElementById(containerId);
                if (!container && action !== 'ping') {
                  throw new Error('Container not found: ' + containerId);
                }
                
                let result = null;
                
                switch (action) {
                  case 'ping':
                    result = { ready: !!window.PreactBridge };
                    break;
                  case 'mountWorldMap':
                    window.PreactBridge.mountWorldMap(container, props);
                    result = { mounted: true };
                    break;
                  case 'updateWorldMap':
                    window.PreactBridge.updateWorldMap(container, props);
                    result = { updated: true };
                    break;
                  case 'unmount':
                    window.PreactBridge.unmount(container);
                    result = { unmounted: true };
                    break;
                  default:
                    throw new Error('Unknown action: ' + action);
                }
                
                cmdElement.setAttribute('data-result-' + id, JSON.stringify({ success: true, result }));
              } catch (error) {
                console.error('[PreactBridge] Command error:', error);
                cmdElement.setAttribute('data-result-' + id, JSON.stringify({ success: false, error: error.message }));
              }
            });
          }
          
        } catch (error) {
          console.error('[PreactBridge] Load error:', error);
          const config = document.getElementById(CONFIG_ID);
          if (config) {
            config.setAttribute('data-error', error.message);
          }
        }
      })();
    `;

    // Create blob URL to avoid CSP inline script issues
    const blob = new Blob([pageHandlerCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    const script = document.createElement('script');
    script.type = 'module';
    script.src = blobUrl;
    script.setAttribute('data-preact-bridge-loader', 'true');
    
    script.onload = () => {
      URL.revokeObjectURL(blobUrl);
      console.log(LOG_PREFIX, 'Page handler script loaded');
    };
    script.onerror = (err) => {
      URL.revokeObjectURL(blobUrl);
      console.error(LOG_PREFIX, 'Page handler script failed:', err);
    };

    (document.head || document.documentElement).appendChild(script);
    console.log(LOG_PREFIX, 'Injected page handler script');
    return true;
  }

  /**
   * Send a command to the page context PreactBridge
   * @param {string} action - Action to perform
   * @param {string} containerId - Target container element ID
   * @param {Object} props - Props to pass
   * @returns {Promise<Object>} Result
   */
  window.sendPreactCommand = function(action, containerId, props) {
    return new Promise((resolve, reject) => {
      const cmdElement = document.getElementById(COMMAND_ELEMENT_ID);
      if (!cmdElement) {
        reject(new Error('Command element not found'));
        return;
      }

      const id = 'cmd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // Send command via custom event
      const event = new CustomEvent('preact-command', {
        detail: { id, action, containerId, props },
        bubbles: false
      });
      cmdElement.dispatchEvent(event);
      
      // Poll for result
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkResult = () => {
        const resultAttr = cmdElement.getAttribute('data-result-' + id);
        if (resultAttr) {
          cmdElement.removeAttribute('data-result-' + id);
          try {
            const result = JSON.parse(resultAttr);
            if (result.success) {
              resolve(result.result);
            } else {
              reject(new Error(result.error));
            }
          } catch (e) {
            reject(new Error('Invalid result format'));
          }
          return;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error('Command timeout'));
          return;
        }
        
        setTimeout(checkResult, 100);
      };
      
      checkResult();
    });
  };

  /**
   * Wait for the bridge to be ready
   */
  window.waitForPreactBridge = function(timeout = 10000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const check = () => {
        const config = document.getElementById(CONFIG_ELEMENT_ID);
        
        if (config?.getAttribute('data-ready') === 'true') {
          console.log(LOG_PREFIX, 'Bridge is ready');
          resolve(true);
          return;
        }
        
        if (config?.getAttribute('data-error')) {
          console.error(LOG_PREFIX, 'Bridge error:', config.getAttribute('data-error'));
          resolve(false);
          return;
        }
        
        if (Date.now() - startTime >= timeout) {
          console.warn(LOG_PREFIX, 'Timeout waiting for bridge');
          resolve(false);
          return;
        }
        
        setTimeout(check, 100);
      };
      
      check();
    });
  };

  // Auto-inject when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectModuleScript();
    });
  } else {
    injectModuleScript();
  }

  console.log(LOG_PREFIX, 'Loader initialized');
})();
