/**
 * Site Activation Manager Module
 * Manages per-domain banner activation state for multi-site support
 * Enables users to activate/deactivate persistent banner on specific domains
 */

const SiteActivationManager = (function() {
  'use strict';

  return {
    /**
     * Get current domain from window.location
     * @returns {string} Current domain (e.g., "example.com")
     */
    getCurrentDomain() {
      try {
        const hostname = window.location.hostname;
        // Remove www. prefix if present for consistency
        return hostname.replace(/^www\./, '');
      } catch (error) {
        console.error('[SiteActivationManager] Error getting current domain:', error);
        return null;
      }
    },

    /**
     * Check if banner is enabled for a specific domain
     * @param {string} domain - Domain to check (optional, defaults to current domain)
     * @returns {Promise<boolean>} True if banner is enabled for this domain
     */
    async isBannerEnabled(domain = null) {
      const targetDomain = domain || this.getCurrentDomain();
      
      if (!targetDomain) {
        console.warn('[SiteActivationManager] Cannot check banner status - invalid domain');
        return false;
      }

      try {
        // Get settings using SettingsManager if available
        if (typeof SettingsManager !== 'undefined' && typeof SettingsManager.getValue === 'function') {
          const activeSites = SettingsManager.getValue('highlighterNotes.activeSites') || {};
          // Undefined means not explicitly set - default to true (enabled)
          return activeSites[targetDomain] !== false;
        }

        // Fallback: Direct storage access
        return new Promise((resolve) => {
          chrome.storage.sync.get(['highlighterNotes'], (result) => {
            const activeSites = result.highlighterNotes?.activeSites || {};
            // Undefined means not explicitly set - default to true (enabled)
            resolve(activeSites[targetDomain] !== false);
          });
        });
      } catch (error) {
        console.error('[SiteActivationManager] Error checking banner status:', error);
        // Default to enabled on error
        return true;
      }
    },

    /**
     * Enable banner for a specific domain
     * @param {string} domain - Domain to enable (optional, defaults to current domain)
     * @returns {Promise<boolean>} True if successful
     */
    async enableBanner(domain = null) {
      const targetDomain = domain || this.getCurrentDomain();
      
      if (!targetDomain) {
        console.warn('[SiteActivationManager] Cannot enable banner - invalid domain');
        return false;
      }

      try {
        // Get current settings
        if (typeof SettingsManager !== 'undefined' && typeof SettingsManager.getValue === 'function') {
          const activeSites = SettingsManager.getValue('highlighterNotes.activeSites') || {};
          activeSites[targetDomain] = true;
          
          await SettingsManager.setValue('highlighterNotes.activeSites', activeSites);
          console.log(`[SiteActivationManager] Banner enabled for domain: ${targetDomain}`);
          
          // Broadcast change event
          this.broadcastActivationChange(targetDomain, true);
          return true;
        }

        // Fallback: Direct storage access
        return new Promise((resolve) => {
          chrome.storage.sync.get(['highlighterNotes'], (result) => {
            const settings = result.highlighterNotes || {};
            const activeSites = settings.activeSites || {};
            activeSites[targetDomain] = true;
            settings.activeSites = activeSites;

            chrome.storage.sync.set({ highlighterNotes: settings }, () => {
              if (chrome.runtime.lastError) {
                console.error('[SiteActivationManager] Error enabling banner:', chrome.runtime.lastError);
                resolve(false);
                return;
              }
              console.log(`[SiteActivationManager] Banner enabled for domain: ${targetDomain}`);
              this.broadcastActivationChange(targetDomain, true);
              resolve(true);
            });
          });
        });
      } catch (error) {
        console.error('[SiteActivationManager] Error enabling banner:', error);
        return false;
      }
    },

    /**
     * Disable banner for a specific domain
     * @param {string} domain - Domain to disable (optional, defaults to current domain)
     * @returns {Promise<boolean>} True if successful
     */
    async disableBanner(domain = null) {
      const targetDomain = domain || this.getCurrentDomain();
      
      if (!targetDomain) {
        console.warn('[SiteActivationManager] Cannot disable banner - invalid domain');
        return false;
      }

      try {
        // Get current settings
        if (typeof SettingsManager !== 'undefined' && typeof SettingsManager.getValue === 'function') {
          const activeSites = SettingsManager.getValue('highlighterNotes.activeSites') || {};
          activeSites[targetDomain] = false;
          
          await SettingsManager.setValue('highlighterNotes.activeSites', activeSites);
          console.log(`[SiteActivationManager] Banner disabled for domain: ${targetDomain}`);
          
          // Broadcast change event
          this.broadcastActivationChange(targetDomain, false);
          return true;
        }

        // Fallback: Direct storage access
        return new Promise((resolve) => {
          chrome.storage.sync.get(['highlighterNotes'], (result) => {
            const settings = result.highlighterNotes || {};
            const activeSites = settings.activeSites || {};
            activeSites[targetDomain] = false;
            settings.activeSites = activeSites;

            chrome.storage.sync.set({ highlighterNotes: settings }, () => {
              if (chrome.runtime.lastError) {
                console.error('[SiteActivationManager] Error disabling banner:', chrome.runtime.lastError);
                resolve(false);
                return;
              }
              console.log(`[SiteActivationManager] Banner disabled for domain: ${targetDomain}`);
              this.broadcastActivationChange(targetDomain, false);
              resolve(true);
            });
          });
        });
      } catch (error) {
        console.error('[SiteActivationManager] Error disabling banner:', error);
        return false;
      }
    },

    /**
     * Get all activated sites
     * @returns {Promise<Object>} Object with domain keys and boolean values
     */
    async getActiveSites() {
      try {
        // Get settings using SettingsManager if available
        if (typeof SettingsManager !== 'undefined' && typeof SettingsManager.getValue === 'function') {
          return SettingsManager.getValue('highlighterNotes.activeSites') || {};
        }

        // Fallback: Direct storage access
        return new Promise((resolve) => {
          chrome.storage.sync.get(['highlighterNotes'], (result) => {
            const activeSites = result.highlighterNotes?.activeSites || {};
            resolve(activeSites);
          });
        });
      } catch (error) {
        console.error('[SiteActivationManager] Error getting active sites:', error);
        return {};
      }
    },

    /**
     * Broadcast activation change event using window.postMessage
     * @param {string} domain - Domain that changed
     * @param {boolean} enabled - New enabled state
     */
    broadcastActivationChange(domain, enabled) {
      try {
        window.postMessage({
          type: 'exl-banner-activation-changed',
          domain: domain,
          enabled: enabled,
          timestamp: Date.now()
        }, '*');
        
        console.log(`[SiteActivationManager] Broadcast activation change: ${domain} = ${enabled}`);
      } catch (error) {
        console.warn('[SiteActivationManager] Error broadcasting activation change:', error);
      }
    }
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.SiteActivationManager = SiteActivationManager;
}

// Make available for module exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SiteActivationManager;
}
