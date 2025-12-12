/**
 * Highlighter Content Script Controller
 * Orchestrates highlighter, sticky notes, and bookmark manager
 * Only active on support sites when feature is enabled
 */

/**
 * Early page layout adjustment
 * Runs immediately when script loads to prevent layout shift
 * Applied optimistically, removed if feature is disabled
 * 
 * Best Practices:
 * - Uses CSS injection via style tag (CSP compliant)
 * - Module-scoped state tracking (no global pollution)
 * - Idempotent (checks before applying)
 * - Error handling with try-catch
 */
(function earlyLayoutAdjustment() {
  'use strict';
  
  // Constants (following best practices: no magic numbers)
  const BANNER_HEIGHT_PX = 48; // 3rem = 48px
  const EARLY_STYLE_ID = 'exl-hl-early-layout';
  const STATE_FLAG = '__exlHlEarlyLayoutApplied';
  
  // Check if already applied (idempotency)
  if (window[STATE_FLAG]) {
    return;
  }

  // Determine session type using Navigation Timing API

    const navEntry = performance.getEntriesByType("navigation")[0];
    const isNewSession = !sessionStorage.getItem('session_active');

    if (isNewSession) {
        console.log("This is a completely new tab/window session.");
        sessionStorage.setItem('session_active', 'true');
    } else if (navEntry.type === 'reload') {
        console.log("This is a refresh within an existing tab session.");
    } else if (navEntry.type === 'navigate' || navEntry.type === 'back_forward') {
        console.log("This is navigation within the same tab, but not a simple refresh.");
    };
  
  // Check if current site is a default banner domain
  // Only apply early layout adjustment if it's a default domain (optimistic)
  // Will be removed later if banner shouldn't show
  function isDefaultBannerDomain() {
    const DEFAULT_BANNER_DOMAINS = [
      'support.clarivate.com',
      'wiki.clarivate.io',
      'jira.clarivate.io',
      'exlibrisgroup.com',

    ];
    
    try {
      const hostname = window.location.hostname.toLowerCase();
      return DEFAULT_BANNER_DOMAINS.some(domain => {
        return hostname === domain || hostname.endsWith('.' + domain);
      });
    } catch (error) {
      return false;
    }
  }
  
  // Only apply early if default domain (optimistic approach)
  // For other sites, wait for banner decision
  const isDefault = isDefaultBannerDomain();
  
  if (!isDefault) {
    // Not a default domain - don't apply early adjustment
    // Will be applied later if banner is shown
    return;
  }
  
  try {
    // Enhanced CSS injection - use padding only to avoid double spacing
    const style = document.createElement('style');
    style.id = EARLY_STYLE_ID;
    style.textContent = `
      /* Primary strategy: Add padding to body only (not margin) */
      body {
        padding-top: ${BANNER_HEIGHT_PX}px !important;
        margin-top: 0 !important;
      }
      
      /* Ensure html element doesn't conflict */
      html {
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      
      /* Prevent white gaps - ensure body background extends */
      body {
        background-attachment: fixed !important;
      }
    `;
    
    // Try to inject into head (preferred)
    if (document.head) {
      document.head.appendChild(style);
      window[STATE_FLAG] = true;
      console.log('[HighlighterController] Early layout adjustment applied (style tag)');
      return;
    }
    
    // Fallback: Apply inline style if body exists
    if (document.body) {
      document.body.style.paddingTop = `${BANNER_HEIGHT_PX}px`;
      document.body.style.marginTop = '0px';
      window[STATE_FLAG] = true;
      console.log('[HighlighterController] Early layout adjustment applied (inline)');
      return;
    }
    
    // Fallback to documentElement if head doesn't exist
    if (document.documentElement) {
      document.documentElement.appendChild(style);
      window[STATE_FLAG] = true;
      console.log('[HighlighterController] Early layout adjustment applied (documentElement)');
      return;
    }
    
    // If we reach here, DOM is not ready at all - will retry in init()
    console.warn('[HighlighterController] Could not apply early layout adjustment - DOM not ready');
    
  } catch (error) {
    // Error handling (best practice: log with context)
    console.error('[HighlighterController] Error applying early layout adjustment:', error);
    // Don't set flag on error - allow retry in init()
  }
})();

(function() {
  'use strict';

  const HighlighterController = {
    isInitialized: false,
    currentColor: null,
    bannerElement: null,
    currentUrl: null,
    urlCheckInterval: null,
    floatingButtonElement: null,
    floatingBannerElement: null,
    undoNotificationTimer: null,
    closeButtonElement: null,
    bannerMode: 'hidden', // 'hidden' | 'floating' | 'sticky'
    isDragging: false,
    dragStartPos: { x: 0, y: 0 },

    // Radial menu + floating button state
    radialMenuState: {
      isExpanded: false,
      menuElement: null,
      items: [],
      radius:70,
      innerRadius:30,
      animationDelay: 20,
      keyboardHandler: null
    },
    floatingButtonPosition: { x: null, y: null },
    recordingStatusHandler: null,

    /**
     * Safe storage helpers to tolerate invalidated contexts
     */
    safeLocalGet(keys, cb) {
      try {
        chrome.storage.local.get(keys, (result) => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.warn('[HighlighterController] storage.local.get failed:', err);
            cb({});
            return;
          }
          cb(result || {});
        });
      } catch (error) {
        console.warn('[HighlighterController] storage.local.get threw:', error);
        cb({});
      }
    },

    safeLocalSet(items, cb = () => {}) {
      try {
        chrome.storage.local.set(items, () => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.warn('[HighlighterController] storage.local.set failed:', err);
          }
          cb();
        });
      } catch (error) {
        console.warn('[HighlighterController] storage.local.set threw:', error);
        cb();
      }
    },

    getActiveNoteColorId() {
      if (typeof Highlighter === 'undefined' || typeof Highlighter.getCurrentColor !== 'function') {
        return null;
      }

      const current = Highlighter.getCurrentColor();
      if (!current || current.id === undefined || current.id === null) {
        return null;
      }

      const rawId = current.id;
      if (typeof rawId === 'string') {
        return rawId.startsWith('hl-') ? rawId : `hl-${rawId}`;
      }

      return `hl-${rawId}`;
    },

    safeSyncGet(keys, cb) {
      try {
        chrome.storage.sync.get(keys, (result) => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.warn('[HighlighterController] storage.sync.get failed:', err);
            cb({});
            return;
          }
          cb(result || {});
        });
      } catch (error) {
        console.warn('[HighlighterController] storage.sync.get threw:', error);
        cb({});
      }
    },

    ensureRadialStyles() {
      const STYLE_ID = 'exl-hl-radial-styles';
      if (document.getElementById(STYLE_ID)) return;

      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        /* Floating button */
        .exl-hl-floating-btn {
          position: fixed;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 48px;
          background: linear-gradient(160deg, rgba(70, 52, 150, 0.82) 0%, rgba(48, 122, 255, 0.88) 80%),
            linear-gradient(var(--exl-glow-angle, 135deg), rgba(152, 121, 255, 0.45), rgba(82, 188, 255, 0.12));
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.45);
          border-radius: 50%;
          cursor: grab;
          font-size: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999997;
          box-shadow: 0 6px 18px rgba(38, 58, 136, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.12);
          transition: opacity 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease;
          opacity: 0.82;
          padding: 0;
          line-height: 1;
          -webkit-user-select: none;
          user-select: none;
          touch-action: none;
          position: relative;
          overflow: visible;
          backdrop-filter: blur(12px);
          --exl-glow-angle: 135deg;
        }

        .exl-hl-floating-btn::before {
          content: '';
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          background: linear-gradient(var(--exl-glow-angle, 135deg), rgba(120, 167, 255, 0.32), rgba(132, 104, 255, 0.12));
          filter: blur(10px);
          opacity: 0;
          transition: opacity 150ms ease, transform 150ms ease;
          pointer-events: none;
        }

        .exl-hl-floating-btn::after {
          content: '';
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0));
          opacity: 0.9;
          pointer-events: none;
          mix-blend-mode: screen;
        }

        .exl-hl-floating-btn:hover {
          opacity: 1;
          box-shadow: 0 10px 26px rgba(47, 86, 180, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.22);
          border-color: rgba(255, 255, 255, 0.6);
        }

        .exl-hl-floating-btn:active:not(.dragging) {
          transform: translateY(-50%) scale(0.95);
        }

        .exl-hl-floating-btn.dragging {
          cursor: grabbing;
          opacity: 0.8;
          transition: none;
        }

        .exl-hl-floating-btn.expanded {
          opacity: 1;
          border-color: rgba(255, 255, 255, 0.65);
          background: linear-gradient(170deg, #0d1026 0%, #111734 65%, #162043 100%);
          box-shadow: 0 14px 32px rgba(9, 12, 32, 0.65), inset 0 0 0 1px rgba(255, 255, 255, 0.25);
          animation: exl-hl-button-pulse 1.5s ease-in-out infinite;
        }

        .exl-hl-floating-btn.proximity {
          box-shadow: 0 12px 30px rgba(76, 119, 255, 0.55), 0 0 0 10px rgba(126, 110, 255, 0.18);
        }

        .exl-hl-floating-btn.proximity::before {
          opacity: 1;
          transform: scale(1.05);
        }

        @keyframes exl-hl-button-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,112,210,0.4); }
          50% { box-shadow: 0 0 28px rgba(0,112,210,0.6); }
        }

        /* Radial overlay */
        .exl-hl-radial-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 999996;
          background: transparent;
        }

        /* Radial menu container */
        .exl-hl-radial-menu {
          position: fixed;
          z-index: 999998;
          pointer-events: none;
          transform: translate(-50%, -50%);
          width: 1px;
          height: 1px;
        }

        .exl-hl-radial-menu.collapsing .exl-hl-radial-item,
        .exl-hl-radial-menu.collapsing .exl-hl-radial-color-chip {
          animation: exl-hl-radial-collapse 150ms ease-in forwards;
        }

        /* Radial action items */
        .exl-hl-radial-item {
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: #ffffff;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) scale(0);
          animation: exl-hl-radial-expand 200ms ease-out forwards;
          animation-delay: var(--animation-delay, 0ms);
        }

        .exl-hl-radial-item:hover {
          transform: translate(calc(-50% + var(--final-x)), calc(-50% + var(--final-y))) scale(1.15);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
          border-color: #0070d2;
          z-index: 10;
        }

        .exl-hl-radial-item:focus {
          outline: none;
          border-color: #0070d2;
          box-shadow: 0 0 0 3px rgba(0, 112, 210, 0.4);
        }

        .exl-hl-radial-item:active {
          transform: translate(calc(-50% + var(--final-x)), calc(-50% + var(--final-y))) scale(0.95);
        }

        /* Radial color chips */
        .exl-hl-radial-color-chip {
          position: absolute;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.5);
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) scale(0);
          animation: exl-hl-radial-expand 200ms ease-out forwards;
          animation-delay: var(--animation-delay, 0ms);
        }

        .exl-hl-radial-color-chip:hover {
          transform: translate(calc(-50% + var(--final-x)), calc(-50% + var(--final-y))) scale(1.3);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          z-index: 10;
        }

        .exl-hl-radial-color-chip:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.6);
        }

        .exl-hl-radial-color-chip.selected {
          border-color: #ffffff;
          box-shadow: 0 0 0 3px rgba(0, 112, 210, 0.8), 0 4px 12px rgba(0, 0, 0, 0.4);
          transform: translate(calc(-50% + var(--final-x)), calc(-50% + var(--final-y))) scale(1.1);
        }

        .exl-hl-radial-color-chip.selected::after {
          content: '✓';
          position: absolute;
          font-size: 14px;
          color: #1a1a2e;
          font-weight: bold;
          text-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
        }

        /* Tooltip on radial items */
        .exl-hl-radial-item::before {
          content: attr(title);
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.9);
          color: #ffffff;
          font-size: 11px;
          font-family: 'Salesforce Sans', Arial, sans-serif;
          white-space: nowrap;
          border-radius: 4px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }

        .exl-hl-radial-item:hover::before {
          opacity: 1;
        }

        /* Animations */
        @keyframes exl-hl-radial-expand {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--final-x)), calc(-50% + var(--final-y))) scale(1); opacity: 1; }
        }

        @keyframes exl-hl-radial-collapse {
          0% { transform: translate(calc(-50% + var(--final-x)), calc(-50% + var(--final-y))) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        }
      `;

      (document.head || document.documentElement || document.body)?.appendChild(style);
    },

    /**
     * Initialize controller
     * Follows best practices: feature flag check, early returns, error handling
     */
    async init() {
      // Idempotency check (best practice)
      if (this.isInitialized) return;

      console.log('[HighlighterController] Initializing...');

      try {
        // Check if feature is enabled (async - best practice)
        const enabled = await this.isFeatureEnabled();
        if (!enabled) {
          console.log('[HighlighterController] Feature disabled in settings');
          
          // Remove early layout adjustment if it was applied
          this.removeEarlyLayoutAdjustment();
          return; // Early return (best practice)
        }

        // Feature is enabled - ensure early layout adjustment is still applied
        // (it should already be, but ensure it's there as fallback)
        const STATE_FLAG = '__exlHlEarlyLayoutApplied';
        if (!window[STATE_FLAG]) {
          // Early adjustment wasn't applied - apply it now
          this.adjustPageLayout(true);
        }

        // Run data migration before initializing modules (best practice: migrate before use)
        if (typeof DataMigration !== 'undefined') {
          try {
            await DataMigration.migrateAll();
          } catch (error) {
            // Log error but don't block initialization (best practice: graceful degradation)
            console.error('[HighlighterController] Migration error (non-fatal):', error);
          }
        }

        // Initialize modules (sequential - best practice for dependencies)
        // LayerManager must be initialized first as other modules depend on it
        if (typeof LayerManager !== 'undefined') {
          await LayerManager.init();
        }
        await Highlighter.init();
        await StickyNotes.init();
        await BookmarkManager.init();

        // Load banner mode preference before deciding what to render
        await this.loadBannerMode();

        // Check if banner should be shown using new decision logic BEFORE creating UI
        const bannerResult = await this.shouldShowBannerForSite();
        
        if (bannerResult.show && this.bannerMode !== 'floating') {
          // Banner should show as sticky (default) unless explicitly set to floating
          this.createBanner();
          this.setupListeners();
          
          // Setup MutationObserver to watch for dynamically added fixed elements (only relevant for sticky)
          if (this.bannerMode === 'sticky') {
            this.setupFixedElementObserver();
          }
          
          // Hide floating affordances when sticky is active
          this.hideFloatingButton();
          this.hideFloatingBanner();
        } else {
          console.log('[HighlighterController] Banner should not show:', bannerResult.reason);
          // Banner should not show - create it but keep it hidden, show floating button instead
          this.createBanner();
          this.setupListeners();
          
          // Hide banner but keep it in DOM (for potential reactivation)
          if (this.bannerElement) {
            this.bannerElement.style.display = 'none';
          }
          // Mark body as having hidden banner
          if (document.body) {
            document.body.setAttribute('data-exl-hl-banner-hidden', 'true');
          }
          this.adjustPageLayout(false);
          this.removeEarlyLayoutAdjustment();
          this.removeFixedElementAdjustments();
          
          // Ensure gaps are removed - force cleanup after a short delay
          setTimeout(() => {
            this.removeEarlyLayoutAdjustment();
            // Also ensure body doesn't have any top spacing
            if (document.body) {
              const computedPadding = parseInt(window.getComputedStyle(document.body).paddingTop, 10);
              const computedMargin = parseInt(window.getComputedStyle(document.body).marginTop, 10);
              if ((!isNaN(computedPadding) && computedPadding > 0) || (!isNaN(computedMargin) && computedMargin > 0)) {
                document.body.style.setProperty('padding-top', '0', 'important');
                document.body.style.setProperty('margin-top', '0', 'important');
              }
            }
            this.removeFixedElementAdjustments();
          }, 100);
          
          // Show floating button (for non-default/non-whitelisted sites or dismissed sites)
          if (this.bannerMode !== 'sticky') {
            await this.checkAndShowFloatingButton();
            
            // Ensure floating button is shown even if check failed
            if (!this.floatingButtonElement || this.floatingButtonElement.style.display === 'none') {
              await this.showFloatingButton();
            }
          }
        }

        // Track current URL for SPA navigation detection
        this.currentUrl = window.location.href;

        this.isInitialized = true;
        console.log('[HighlighterController] Initialized successfully');
        
      } catch (error) {
        // Error handling (best practice: log with context, don't break extension)
        console.error('[HighlighterController] Error during initialization:', error);
        // Don't set isInitialized on error - allows retry
      }
    },

    /**
     * Check if feature is enabled in settings
     * Uses SettingsManager if available, otherwise checks storage directly with consistent logic
     */
    async isFeatureEnabled() {
      // Try SettingsManager first (preferred method)
      if (typeof SettingsManager !== 'undefined') {
        return SettingsManager.isFeatureEnabled('highlighterEnabled');
      }
      
      // Fallback to direct storage check with consistent logic
      return new Promise((resolve) => {
        this.safeSyncGet(['exlibris'], (result) => {
          // Consistent check: !== false (undefined/true = enabled, false = disabled)
          const enabled = result.exlibris?.features?.highlighterEnabled !== false;
          resolve(enabled);
        });
      });
    },

    /**
     * Check if hostname is a default banner domain
     * Default banner domains show banner by default
     * @param {string} hostname - Hostname to check (optional, defaults to current)
     * @returns {boolean} True if domain is in default list
     */
    isDefaultBannerDomain(hostname = null) {
      const DEFAULT_BANNER_DOMAINS = [
        'support.clarivate.com',
        'developers.exlibrisgroup.com',
        'knowledge.exlibrisgroup.com',
        'wiki.clarivate.io'
      ];

      const checkHostname = (hostname || window.location.hostname).toLowerCase();
      return DEFAULT_BANNER_DOMAINS.some(domain => {
        // Exact match
        if (checkHostname === domain) return true;
        // Subdomain match (e.g., support.clarivate.com matches www.support.clarivate.com)
        return checkHostname.endsWith('.' + domain);
      });
    },

    /**
     * Check if URL or domain is in banner whitelist
     * @param {string} url - URL to check
     * @returns {Promise<boolean>} True if URL/domain is whitelisted
     */
    async isInBannerWhitelist(url) {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_whitelist'], (result) => {
          const whitelist = result.exl_hl_banner_whitelist || { domains: [], urls: [] };
          
          try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
            const urlPath = urlObj.href;
            
            // Check exact URL match
            if (whitelist.urls.includes(urlPath)) {
              resolve(true);
              return;
            }
            
            // Check domain match
            if (whitelist.domains.some(domain => {
              const checkDomain = domain.toLowerCase().replace(/^www\./, '');
              return hostname === checkDomain || hostname.endsWith('.' + checkDomain);
            })) {
              resolve(true);
              return;
            }
            
            resolve(false);
          } catch (error) {
            console.error('[HighlighterController] Error checking whitelist:', error);
            resolve(false);
          }
        });
      });
    },

    /**
     * Get domain from URL
     * @param {string} url - URL to extract domain from
     * @returns {string} Domain (hostname without www)
     */
    getDomainFromUrl(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname.toLowerCase().replace(/^www\./, '');
      } catch (error) {
        console.error('[HighlighterController] Error extracting domain:', error);
        return '';
      }
    },

    /**
     * Check if domain is permanently dismissed
     * @param {string} domain - Domain to check
     * @returns {Promise<boolean>} True if permanently dismissed
     */
    async isDomainPermanentlyDismissed(domain) {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_dismissals'], (result) => {
          const dismissals = result.exl_hl_banner_dismissals || {};
          const domainData = dismissals[domain] || {};
          resolve(domainData.dismissed === true);
        });
      });
    },

    /**
     * Check if URL is permanently dismissed
     * @param {string} url - URL to check
     * @returns {Promise<boolean>} True if permanently dismissed
     */
    async isUrlPermanentlyDismissed(url) {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_page_dismissals'], (result) => {
          const pageDismissals = result.exl_hl_banner_page_dismissals || {};
          resolve(pageDismissals[url] === true);
        });
      });
    },

    /**
     * Check if domain is dismissed in current session
     * @param {string} domain - Domain to check
     * @returns {boolean} True if dismissed in session
     */
    isDomainSessionDismissed(domain) {
      try {
        const sessionDismissals = JSON.parse(
          sessionStorage.getItem('exl_hl_banner_session_dismissals') || '{}'
        );
        return sessionDismissals[domain] === true;
      } catch (error) {
        return false;
      }
    },

    /**
     * Main function to determine if banner should show for a site
     * Checks: default domains, whitelist, permanent dismissals, session dismissals
     * @param {string} url - URL to check (optional, defaults to current)
     * @returns {Promise<{show: boolean, reason: string}>} Show status and reason
     */
    async shouldShowBannerForSite(url = null) {
      const currentUrl = url || window.location.href;
      const domain = this.getDomainFromUrl(currentUrl);

      // 1. Check if domain is in default banner domains
      if (this.isDefaultBannerDomain(domain)) {
        // Check dismissals for default domains
        const urlDismissed = await this.isUrlPermanentlyDismissed(currentUrl);
        const domainDismissed = await this.isDomainPermanentlyDismissed(domain);
        const sessionDismissed = this.isDomainSessionDismissed(domain);

        if (urlDismissed) {
          return { show: false, reason: 'url_permanently_dismissed' };
        }
        if (domainDismissed) {
          return { show: false, reason: 'domain_permanently_dismissed' };
        }
        if (sessionDismissed) {
          return { show: false, reason: 'session_dismissed' };
        }
        return { show: true, reason: 'default_domain' };
      }

      // 2. Check if site/URL is in whitelist
      const inWhitelist = await this.isInBannerWhitelist(currentUrl);
      if (inWhitelist) {
        // Check dismissals for whitelisted sites
        const urlDismissed = await this.isUrlPermanentlyDismissed(currentUrl);
        const domainDismissed = await this.isDomainPermanentlyDismissed(domain);
        const sessionDismissed = this.isDomainSessionDismissed(domain);

        if (urlDismissed) {
          return { show: false, reason: 'url_permanently_dismissed' };
        }
        if (domainDismissed) {
          return { show: false, reason: 'domain_permanently_dismissed' };
        }
        if (sessionDismissed) {
          return { show: false, reason: 'session_dismissed' };
        }
        return { show: true, reason: 'whitelisted' };
      }

      // 3. For non-default, non-whitelisted sites, don't show banner by default
      // Show floating button instead
      return { show: false, reason: 'not_default_or_whitelisted' };
    },

    /**
     * Check if banner should be shown for current URL
     * Legacy method - now uses shouldShowBannerForSite()
     * @returns {Promise<boolean>} True if banner should be shown
     */
    async shouldShowBanner() {
      const result = await this.shouldShowBannerForSite();
      return result.show;
    },

    /**
     * Check if banner is dismissed for a specific URL
     * @param {string} url - URL to check
     * @returns {Promise<boolean>} True if dismissed
     */
    async isBannerDismissed(url) {
      const result = await this.shouldShowBannerForSite(url);
      return !result.show;
    },

    /**
     * Track banner dismissal and increment count
     * @param {string} domain - Domain of the dismissal
     * @param {string} url - Full URL
     * @returns {Promise<{count: number, shouldShowModal: boolean}>} Dismissal info
     */
    async trackBannerDismissal(domain, url) {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_dismissals'], (result) => {
          const dismissals = result.exl_hl_banner_dismissals || {};
          
          if (!dismissals[domain]) {
            dismissals[domain] = {
              count: 0,
              dismissed: false,
              lastDismissed: null,
              modalShown: false
            };
          }
          
          // Increment count
          dismissals[domain].count = (dismissals[domain].count || 0) + 1;
          dismissals[domain].lastDismissed = Date.now();
          
          // Check if we should show modal (3rd attempt and modal not shown yet)
          const shouldShowModal = dismissals[domain].count === 3 && !dismissals[domain].modalShown;
          
          this.safeLocalSet({ exl_hl_banner_dismissals: dismissals }, () => {
            console.log(`[HighlighterController] Tracked dismissal for ${domain}, count: ${dismissals[domain].count}`);
            resolve({
              count: dismissals[domain].count,
              shouldShowModal: shouldShowModal
            });
          });
        });
      });
    },

    /**
     * Dismiss banner for session (temporary, resets on browser restart)
     * @param {string} domain - Domain to dismiss
     * @returns {void}
     */
    dismissBannerForSession(domain) {
      try {
        const sessionDismissals = JSON.parse(
          sessionStorage.getItem('exl_hl_banner_session_dismissals') || '{}'
        );
        sessionDismissals[domain] = true;
        sessionStorage.setItem('exl_hl_banner_session_dismissals', JSON.stringify(sessionDismissals));
        console.log('[HighlighterController] Banner dismissed for session:', domain);
      } catch (error) {
        console.error('[HighlighterController] Error setting session dismissal:', error);
      }
    },

    /**
     * Dismiss banner permanently for a specific URL
     * @param {string} url - URL to dismiss
     * @returns {Promise<void>}
     */
    async dismissBannerPermanentlyForUrl(url) {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_page_dismissals'], (result) => {
          const pageDismissals = result.exl_hl_banner_page_dismissals || {};
          pageDismissals[url] = true;
          this.safeLocalSet({ exl_hl_banner_page_dismissals: pageDismissals }, () => {
            console.log('[HighlighterController] Banner permanently dismissed for URL:', url);
            resolve();
          });
        });
      });
    },

    /**
     * Dismiss banner permanently for a domain
     * @param {string} domain - Domain to dismiss
     * @returns {Promise<void>}
     */
    async dismissBannerPermanentlyForDomain(domain) {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_dismissals'], (result) => {
          const dismissals = result.exl_hl_banner_dismissals || {};
          
          if (!dismissals[domain]) {
            dismissals[domain] = {};
          }
          
          dismissals[domain].dismissed = true;
          dismissals[domain].count = 0; // Reset count
          
          this.safeLocalSet({ exl_hl_banner_dismissals: dismissals }, () => {
            console.log('[HighlighterController] Banner permanently dismissed for domain:', domain);
            resolve();
          });
        });
      });
    },

    /**
     * Mark modal as shown for a domain (don't ask again)
     * @param {string} domain - Domain
     * @returns {Promise<void>}
     */
    async markModalShownForDomain(domain) {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_dismissals'], (result) => {
          const dismissals = result.exl_hl_banner_dismissals || {};
          
          if (!dismissals[domain]) {
            dismissals[domain] = {};
          }
          
          dismissals[domain].modalShown = true;
          dismissals[domain].count = 0; // Reset count
          
          this.safeLocalSet({ exl_hl_banner_dismissals: dismissals }, () => {
            resolve();
          });
        });
      });
    },

    /**
     * Add site to banner whitelist
     * @param {string} type - 'domain' or 'url'
     * @param {string} value - Domain or URL to add
     * @returns {Promise<boolean>} True if successful
     */
    async addToBannerWhitelist(type, value) {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_whitelist'], (result) => {
          const whitelist = result.exl_hl_banner_whitelist || { domains: [], urls: [] };
          
          try {
            if (type === 'domain') {
              const domain = value.toLowerCase().replace(/^www\./, '').replace(/^https?:\/\//, '').split('/')[0];
              if (!whitelist.domains.includes(domain)) {
                whitelist.domains.push(domain);
              }
            } else if (type === 'url') {
              const url = value.trim();
              if (!whitelist.urls.includes(url)) {
                whitelist.urls.push(url);
              }
            }
            
            this.safeLocalSet({ exl_hl_banner_whitelist: whitelist }, () => {
              console.log('[HighlighterController] Added to whitelist:', type, value);
              resolve(true);
            });
          } catch (error) {
            console.error('[HighlighterController] Error adding to whitelist:', error);
            resolve(false);
          }
        });
      });
    },

    /**
     * Remove site from banner whitelist
     * @param {string} type - 'domain' or 'url'
     * @param {string} value - Domain or URL to remove
     * @returns {Promise<boolean>} True if successful
     */
    async removeFromBannerWhitelist(type, value) {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_whitelist'], (result) => {
          const whitelist = result.exl_hl_banner_whitelist || { domains: [], urls: [] };
          
          try {
            if (type === 'domain') {
              const domain = value.toLowerCase().replace(/^www\./, '').replace(/^https?:\/\//, '').split('/')[0];
              whitelist.domains = whitelist.domains.filter(d => d !== domain);
            } else if (type === 'url') {
              whitelist.urls = whitelist.urls.filter(u => u !== value);
            }
            
            this.safeLocalSet({ exl_hl_banner_whitelist: whitelist }, () => {
              console.log('[HighlighterController] Removed from whitelist:', type, value);
              resolve(true);
            });
          } catch (error) {
            console.error('[HighlighterController] Error removing from whitelist:', error);
            resolve(false);
          }
        });
      });
    },

    /**
     * Check if floating button should be shown for current domain
     * Shows on non-default, non-whitelisted sites (or when banner is dismissed)
     * @returns {Promise<boolean>} True if floating button should show
     */
    async shouldShowFloatingButton(force = false) {
      try {
        // Exclude Salesforce domains
        const hostname = window.location.hostname.toLowerCase();
        const isSalesforce = /\.force\.com$|\.salesforce\.com$|\.lightning\.force\.com$/i.test(hostname);
        if (isSalesforce) {
          return false;
        }

        if (force) {
          return true;
        }

        // Show floating button if banner shouldn't be shown
        const bannerResult = await this.shouldShowBannerForSite();
        const shouldShow = !bannerResult.show;
        
        // Also check if banner element exists but is hidden
        if (this.bannerElement && this.bannerElement.style.display === 'none') {
          return true;
        }
        
        return shouldShow;
      } catch (error) {
        console.error('[HighlighterController] Error checking floating button eligibility:', error);
        // Default to showing on error (better UX - user can always dismiss)
        return true;
      }
    },

    /**
     * Create sticky banner UI
     * Uses section-based structure matching persistentBanner design pattern
     */
    createBanner() {
      if (this.bannerElement) return;

      const banner = document.createElement('div');
      banner.className = 'exl-hl-banner';
      banner.id = 'exl-hl-banner';

      // Create container matching persistentBanner structure
      const container = document.createElement('div');
      container.className = 'exl-banner-container';

      // Section 1: Title and Highlight Action
      const titleSection = document.createElement('div');
      titleSection.className = 'exl-banner-section';
      
      const titleLabel = document.createElement('div');
      titleLabel.className = 'exl-banner-label';
      titleLabel.textContent = 'Tool';
      
      const title = document.createElement('div');
      title.className = 'exl-hl-banner-title';
      title.textContent = '✨StartNote';

      // Run typewriter animation once per domain per browser session
      try {
        const sessionKey = `exl-hl-typewriter-${window.location.hostname}`;
        const shouldAnimate = sessionStorage.getItem(sessionKey) !== '1';
        if (shouldAnimate) {
          title.classList.add('exl-hl-typewriter');
          sessionStorage.setItem(sessionKey, '1');
          const handleAnimationEnd = (event) => {
            if (event?.animationName === 'exl-hl-typing') {
              title.classList.add('exl-hl-typewriter-done');
              title.removeEventListener('animationend', handleAnimationEnd);
            }
          };
          title.addEventListener('animationend', handleAnimationEnd);
        }
      } catch (error) {
        console.warn('[HighlighterController] Typewriter animation skipped:', error);
      }
      
      titleSection.appendChild(titleLabel);
      titleSection.appendChild(title);
      container.appendChild(titleSection);

      // Section 2: Highlight Action
      const highlightSection = document.createElement('div');
      highlightSection.className = 'exl-banner-section';
      
      const highlightBtn = document.createElement('button');
      highlightBtn.className = 'exl-hl-btn';
      highlightBtn.innerHTML = '🖍️ Highlight';
      highlightBtn.title = 'Highlight selected text';
      highlightBtn.addEventListener('click', () => {
        Highlighter.createHighlight();
      });
      
      highlightSection.appendChild(highlightBtn);
      container.appendChild(highlightSection);

      // Section 3: Color Palette
      const paletteSection = document.createElement('div');
      paletteSection.className = 'exl-banner-section';
      
      const paletteLabel = document.createElement('div');
      paletteLabel.className = 'exl-banner-label';
      paletteLabel.textContent = 'Colors';
      
      const palette = this.createColorPalette();
      paletteSection.appendChild(paletteLabel);
      paletteSection.appendChild(palette);
      container.appendChild(paletteSection);

      // Section 4: Layers
      const layerSection = document.createElement('div');
      layerSection.className = 'exl-banner-section';
      
      const layerBtn = this.createLayerDropdown();
      layerSection.appendChild(layerBtn);
      container.appendChild(layerSection);

      // Section 5: Actions (Notes, Collections, Bookmark)
      const actionsSection = document.createElement('div');
      actionsSection.className = 'exl-banner-section exl-banner-actions';
      
      const noteBtn = document.createElement('button');
      noteBtn.className = 'exl-hl-btn';
      noteBtn.innerHTML = '📝 Add Note';
      noteBtn.title = 'Create sticky note';
      noteBtn.addEventListener('click', () => {
        const colorId = this.getActiveNoteColorId();
        StickyNotes.createNote(colorId ? { colorId } : {});
      });

      const collectionsBtn = document.createElement('button');
      collectionsBtn.className = 'exl-hl-btn';
      collectionsBtn.innerHTML = '📚 Collections';
      collectionsBtn.title = 'Open collections';
      collectionsBtn.addEventListener('click', () => {
        BookmarkManager.openPanel();
      });

      const bookmarkBtn = document.createElement('button');
      bookmarkBtn.className = 'exl-hl-btn';
      bookmarkBtn.innerHTML = '🔖 Bookmark';
      bookmarkBtn.title = 'Bookmark this page';
      bookmarkBtn.addEventListener('click', () => {
        this.showBookmarkDialog();
      });

      function showActionToast(text) {
        try {
          const toast = document.createElement('div');
          toast.className = 'exl-hl-toast';
          toast.textContent = text;
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 3500);
        } catch (err) {
          console.warn('[HighlighterController] Toast failed', err);
        }
      }

      const captureBtn = document.createElement('button');
      captureBtn.className = 'exl-hl-btn';
      captureBtn.innerHTML = '📸 Capture';
      captureBtn.title = 'Capture a screenshot of this page';
      captureBtn.disabled = true;
      captureBtn.addEventListener('click', () => {
        if (typeof ScreenshotManager !== 'undefined' && typeof ScreenshotManager.startCapture === 'function') {
          ScreenshotManager.startCapture();
          showActionToast('Drag to capture a region.');
          return;
        }
        showActionToast('Screenshots are unavailable on this page.');
        console.warn('[HighlighterController] ScreenshotManager not available (likely restricted domain).');
      });

      const recordBtn = document.createElement('button');
      recordBtn.className = 'exl-hl-btn';
      recordBtn.disabled = true;
      const setRecordLabel = (isRecording) => {
        recordBtn.innerHTML = isRecording ? '⏹ Stop Rec' : '🎥 Record';
        recordBtn.title = isRecording ? 'Stop recording and save' : 'Start tab recording (150MB cap)';
      };

      const handleRecordingStatus = (payload) => {
        const status = payload?.status;
        if (!status) return;

        if (status === 'recording') {
          setRecordLabel(true);
          showRecordToast('Recording... click ⏹ to stop.');
        } else if (status === 'stopping') {
          setRecordLabel(true);
          showRecordToast('Stopping recording...');
        } else if (status === 'saved') {
          setRecordLabel(false);
          showRecordToast('Recording saved. Opening capture panel...');
        } else if (status === 'discarded') {
          setRecordLabel(false);
          showRecordToast('Recording discarded (limit hit).');
        } else if (status === 'error') {
          setRecordLabel(false);
          showRecordToast('Recording failed. See console for details.');
        }
      };

      // Listen for global recording status events (from RecordingManager)
      try {
        if (this.recordingStatusHandler) {
          document.removeEventListener('exlRecordingStatus', this.recordingStatusHandler);
        }
        this.recordingStatusHandler = (evt) => handleRecordingStatus(evt?.detail);
        document.addEventListener('exlRecordingStatus', this.recordingStatusHandler);
      } catch (err) {
        console.warn('[HighlighterController] Failed to register recording status listener', err);
      }

      setRecordLabel(typeof RecordingManager !== 'undefined' && typeof RecordingManager.getStatus === 'function' && RecordingManager.getStatus().isRecording);

      const showRecordToast = (text) => showActionToast(text);

      recordBtn.addEventListener('click', async () => {
        if (typeof RecordingManager === 'undefined' || typeof RecordingManager.toggleRecording !== 'function') {
          showRecordToast('Recording unavailable on this page.');
          console.warn('[HighlighterController] RecordingManager not available (recording is disabled on Salesforce pages).');
          return;
        }

        const current = typeof RecordingManager.getStatus === 'function' && RecordingManager.getStatus().isRecording;
        setRecordLabel(!current);
        const result = await RecordingManager.toggleRecording();
        if (result === 'starting') {
          showRecordToast('Starting recording...');
        } else if (result === 'stopping') {
          showRecordToast('Stopping recording...');
        } else if (result === 'blocked') {
          setRecordLabel(false);
          showRecordToast('Recording is blocked on this page. Try a non-Salesforce tab.');
        }
      });
      
      actionsSection.appendChild(noteBtn);
      actionsSection.appendChild(collectionsBtn);
      actionsSection.appendChild(bookmarkBtn);
      actionsSection.appendChild(recordBtn);
      actionsSection.appendChild(captureBtn);
      const recordingsPanelBtn = document.createElement('button');
      recordingsPanelBtn.className = 'exl-hl-btn';
      recordingsPanelBtn.innerHTML = '🖼️ Gallery';
      recordingsPanelBtn.disabled = true;
      recordingsPanelBtn.title = 'Open captures (shots + recordings)';
      recordingsPanelBtn.addEventListener('click', () => {
        if (typeof CapturePanel !== 'undefined' && typeof CapturePanel.open === 'function') {
          CapturePanel.open({ tab: 'screenshots' });
          return;
        }
        try {
          chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL', tab: 'captured' });
        } catch (err) {
          console.warn('[HighlighterController] Failed to open gallery panel', err);
        }
      });
      actionsSection.appendChild(recordingsPanelBtn);
      container.appendChild(actionsSection);

      // Add close button (top-right corner)
      const closeBtn = this.createCloseButton();
      banner.appendChild(closeBtn);
      this.closeButtonElement = closeBtn;

      banner.appendChild(container);
      document.body.appendChild(banner);
      this.bannerElement = banner;

      // Ensure banner height is at least 48px
      this.ensureBannerHeight();

      // Adjust page content to avoid banner overlap
      this.adjustPageLayout(true);
      
      // Handle "skip to main content" links that might overlap
      this.handleSkipToContentLinks();
      
      // Also adjust fixed elements after banner is inserted (in case DOM changed)
      setTimeout(() => {
        this.adjustFixedElements();
      }, 200);
    },

    /**
     * Ensure banner height is at least 48px
     * Checks actual rendered height and enforces minimum
     */
    ensureBannerHeight() {
      if (!this.bannerElement) return;
      
      const BANNER_HEIGHT_PX = 48;
      
      try {
        // Use ResizeObserver or check after a short delay to ensure layout is complete
        setTimeout(() => {
          if (!this.bannerElement) return;
          
          const computedHeight = this.bannerElement.offsetHeight || 
                                parseInt(window.getComputedStyle(this.bannerElement).height, 10);
          
          if (isNaN(computedHeight) || computedHeight < BANNER_HEIGHT_PX) {
            this.bannerElement.style.minHeight = `${BANNER_HEIGHT_PX}px`;
            this.bannerElement.style.height = `${BANNER_HEIGHT_PX}px`;
            console.log(`[HighlighterController] Banner height enforced to ${BANNER_HEIGHT_PX}px (was ${computedHeight}px)`);
          }
        }, 100);
      } catch (error) {
        console.error('[HighlighterController] Error ensuring banner height:', error);
      }
    },

    /**
     * Handle "skip to main content" accessibility links
     * These links can overlap headers when they become visible
     * We hide them or adjust their position to prevent overlap
     */
    handleSkipToContentLinks() {
      try {
        // Common patterns for skip links
        const skipLinkSelectors = [
          'a[href*="#main"]',
          'a[href*="#content"]',
          'a.skip',
          'a.skip-link',
          'a.skip-to-main',
          'a.skip-to-content',
          'a[class*="skip"]',
          'a[id*="skip"]',
          'a[aria-label*="skip" i]',
          'a[aria-label*="main content" i]',
          'a[title*="skip" i]',
          'a[title*="main content" i]'
        ];
        
        // Also check by text content
        const allLinks = document.querySelectorAll('a');
        const skipLinks = [];
        
        // Find links by selector
        skipLinkSelectors.forEach(selector => {
          try {
            const links = document.querySelectorAll(selector);
            links.forEach(link => {
              if (!skipLinks.includes(link)) {
                skipLinks.push(link);
              }
            });
          } catch (e) {
            // Invalid selector, skip
          }
        });
        
        // Find links by text content (case-insensitive)
        allLinks.forEach(link => {
          const text = (link.textContent || '').toLowerCase().trim();
          if ((text.includes('skip') && (text.includes('main') || text.includes('content'))) ||
              text === 'skip to main content' ||
              text === 'skip to content') {
            if (!skipLinks.includes(link)) {
              skipLinks.push(link);
            }
          }
        });
        
        // Handle each skip link
        skipLinks.forEach(link => {
          try {
            const style = window.getComputedStyle(link);
            const position = style.position;
            const top = parseInt(style.top, 10);
            const zIndex = parseInt(style.zIndex, 10);
            
            // Check if link is visible and might overlap
            if (style.display !== 'none' && 
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                (position === 'fixed' || position === 'absolute') &&
                (isNaN(top) || top < 50)) {
              
              // Hide the link to prevent overlap
              // We use display: none but preserve it in DOM for accessibility
              link.style.setProperty('display', 'none', 'important');
              link.setAttribute('data-exl-hl-skip-link-hidden', 'true');
              
              console.log('[HighlighterController] Hidden skip link to prevent header overlap:', link);
            } else if (position === 'fixed' && !isNaN(top) && top < 50) {
              // If it's fixed but not overlapping yet, move it down
              link.style.setProperty('top', '48px', 'important');
              link.setAttribute('data-exl-hl-skip-link-adjusted', 'true');
              
              console.log('[HighlighterController] Adjusted skip link position:', link);
            }
          } catch (error) {
            console.error('[HighlighterController] Error handling skip link:', error);
          }
        });
        
        if (skipLinks.length > 0) {
          console.log(`[HighlighterController] Processed ${skipLinks.length} skip link(s)`);
        }
      } catch (error) {
        console.error('[HighlighterController] Error handling skip to content links:', error);
      }
    },

    /**
     * Restore skip to content links when banner is hidden
     */
    restoreSkipToContentLinks() {
      try {
        // Restore hidden skip links
        const hiddenLinks = document.querySelectorAll('[data-exl-hl-skip-link-hidden]');
        hiddenLinks.forEach(link => {
          link.style.removeProperty('display');
          link.removeAttribute('data-exl-hl-skip-link-hidden');
        });
        
        // Restore adjusted skip links
        const adjustedLinks = document.querySelectorAll('[data-exl-hl-skip-link-adjusted]');
        adjustedLinks.forEach(link => {
          link.style.removeProperty('top');
          link.removeAttribute('data-exl-hl-skip-link-adjusted');
        });
        
        if (hiddenLinks.length > 0 || adjustedLinks.length > 0) {
          console.log(`[HighlighterController] Restored ${hiddenLinks.length + adjustedLinks.length} skip link(s)`);
        }
      } catch (error) {
        console.error('[HighlighterController] Error restoring skip links:', error);
      }
    },

    /**
     * Create close button for banner
     * @returns {HTMLElement} Close button element
     */
    createCloseButton() {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'exl-hl-banner-close-btn';
      closeBtn.innerHTML = '×';
      closeBtn.title = 'Hide banner for this page';
      closeBtn.setAttribute('aria-label', 'Close banner');
      
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleBannerClose();
      });
      
      return closeBtn;
    },

    /**
     * Handle banner close button click
     * Dismisses banner and tracks dismissal count
     * Shows modal on 3rd dismissal attempt
     */
    async handleBannerClose() {
      console.log('[HighlighterController] Close button clicked');
      
      const currentUrl = window.location.href;
      const domain = this.getDomainFromUrl(currentUrl);
      
      // Track dismissal and check if we should show modal
      const dismissalInfo = await this.trackBannerDismissal(domain, currentUrl);
      
      // If this is the 3rd dismissal, show modal instead of just hiding
      if (dismissalInfo.shouldShowModal) {
        this.showDismissalModal(domain, currentUrl);
        return; // Modal will handle the dismissal
      }
      
      // Regular dismissal (1st or 2nd time) - session-based
      this.dismissBannerForSession(domain);
      
      // Hide banner with slide-up animation
      if (this.bannerElement) {
        this.bannerElement.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        this.bannerElement.style.transform = 'translateY(-100%)';
        this.bannerElement.style.opacity = '0';
        
        // Mark body as having hidden banner
        if (document.body) {
          document.body.setAttribute('data-exl-hl-banner-hidden', 'true');
        }
        
        setTimeout(() => {
          if (this.bannerElement) {
            this.bannerElement.style.display = 'none';
          }
        }, 300);
      }
      
      // Remove layout adjustment
      this.adjustPageLayout(false);
      this.removeEarlyLayoutAdjustment();
      
      // Force cleanup of any remaining margin-top on body
      // Use setTimeout to ensure this happens after other cleanup
      setTimeout(() => {
        if (document.body) {
          const computedMargin = parseInt(window.getComputedStyle(document.body).marginTop, 10);
          if (!isNaN(computedMargin) && computedMargin >= 48) {
            document.body.style.setProperty('margin-top', '0', 'important');
            document.body.style.marginTop = '';
            console.log('[HighlighterController] Force-removed remaining body margin-top');
          }
        }
      }, 100);
      
      // Show floating button if appropriate for this domain
      this.checkAndShowFloatingButton();
      
      // Show undo notification
      this.showUndoNotification();
    },

    /**
     * Show 3rd dismissal attempt modal
     * @param {string} domain - Domain
     * @param {string} url - Full URL
     */
    showDismissalModal(domain, url) {
      // Remove any existing modal
      const existing = document.querySelector('.exl-hl-dismissal-modal-overlay');
      if (existing) {
        existing.remove();
      }
      
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.className = 'exl-hl-dismissal-modal-overlay';
      
      const modal = document.createElement('div');
      modal.className = 'exl-hl-dismissal-modal';
      
      // Header
      const header = document.createElement('div');
      header.className = 'exl-hl-dismissal-modal-header';
      header.textContent = 'Hide Banner?';
      modal.appendChild(header);
      
      // Body
      const body = document.createElement('div');
      body.className = 'exl-hl-dismissal-modal-body';
      body.innerHTML = `
        <p>You've closed the banner multiple times. Would you like to:</p>
        <div class="exl-hl-dismissal-options">
          <button class="exl-hl-dismissal-option" data-choice="url">
            <strong>Don't show for this page</strong>
            <span>Hide banner permanently on this specific page</span>
          </button>
          <button class="exl-hl-dismissal-option" data-choice="domain">
            <strong>Don't show for this domain</strong>
            <span>Hide banner permanently on all pages of ${domain}</span>
          </button>
          <button class="exl-hl-dismissal-option" data-choice="session">
            <strong>Just this time</strong>
            <span>Hide for this session only (don't ask again)</span>
          </button>
        </div>
        <p class="exl-hl-dismissal-footer">You can change these settings anytime in the extension popup menu.</p>
      `;
      modal.appendChild(body);
      
      // Handle option clicks
      const options = body.querySelectorAll('.exl-hl-dismissal-option');
      options.forEach(option => {
        option.addEventListener('click', async () => {
          const choice = option.dataset.choice;
          await this.handleDismissalChoice(choice, domain, url);
          overlay.remove();
        });
      });
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          // Default to session dismissal if user clicks outside
          this.handleDismissalChoice('session', domain, url);
          overlay.remove();
        }
      });
    },

    /**
     * Handle dismissal choice from modal
     * @param {string} choice - 'url', 'domain', or 'session'
     * @param {string} domain - Domain
     * @param {string} url - Full URL
     */
    async handleDismissalChoice(choice, domain, url) {
      console.log('[HighlighterController] Handling dismissal choice:', choice, domain, url);
      
      // Hide banner
      if (this.bannerElement) {
        this.bannerElement.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        this.bannerElement.style.transform = 'translateY(-100%)';
        this.bannerElement.style.opacity = '0';
        
        if (document.body) {
          document.body.setAttribute('data-exl-hl-banner-hidden', 'true');
        }
        
        setTimeout(() => {
          if (this.bannerElement) {
            this.bannerElement.style.display = 'none';
          }
        }, 300);
      }
      
      // Handle based on choice
      switch (choice) {
        case 'url':
          // Permanently dismiss for this URL
          await this.dismissBannerPermanentlyForUrl(url);
          await this.markModalShownForDomain(domain);
          break;
          
        case 'domain':
          // Permanently dismiss for entire domain
          await this.dismissBannerPermanentlyForDomain(domain);
          break;
          
        case 'session':
        default:
          // Session dismissal, don't ask again
          this.dismissBannerForSession(domain);
          await this.markModalShownForDomain(domain);
          break;
      }
      
      // Remove layout adjustment
      this.adjustPageLayout(false);
      this.removeEarlyLayoutAdjustment();
      
      // Cleanup margin
      setTimeout(() => {
        if (document.body) {
          const computedMargin = parseInt(window.getComputedStyle(document.body).marginTop, 10);
          if (!isNaN(computedMargin) && computedMargin >= 48) {
            document.body.style.setProperty('margin-top', '0', 'important');
            document.body.style.marginTop = '';
          }
        }
      }, 100);
      
      // Show floating button
      this.checkAndShowFloatingButton();
      
      // Show success notification
      const toast = document.createElement('div');
      toast.className = 'exl-hl-toast';
      toast.textContent = '✅ Banner hidden. You can change this in the extension popup.';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    },

    /**
     * Show undo notification
     * Similar to PersistentBanner pattern
     */
    showUndoNotification() {
      // Clear any existing notification
      const existing = document.querySelector('.exl-hl-undo-notification');
      if (existing) {
        existing.remove();
      }
      
      // Clear any existing timer
      if (this.undoNotificationTimer) {
        clearTimeout(this.undoNotificationTimer);
      }
      
      const notification = document.createElement('div');
      notification.className = 'exl-hl-undo-notification';
      notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">Banner Hidden</div>
        <div style="font-size: 11px; opacity: 0.9;">You can reactivate it via the extension popup or the floating button.</div>
      `;
      
      document.body.appendChild(notification);
      
      // Auto-remove after 7 seconds
      this.undoNotificationTimer = setTimeout(() => {
        if (notification.parentNode) {
          notification.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
          notification.style.opacity = '0';
          notification.style.transform = 'translateY(10px)';
          setTimeout(() => {
            if (notification.parentNode) {
              notification.remove();
            }
          }, 300);
        }
      }, 7000);
    },

    async loadBannerMode() {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_mode'], (result) => {
          const mode = result.exl_hl_banner_mode;
          if (mode === 'sticky' || mode === 'floating') {
            this.bannerMode = mode;
          } else {
            this.bannerMode = 'hidden';
          }
          resolve(this.bannerMode);
        });
      });
    },

    async saveBannerMode(mode) {
      const normalized = mode === 'floating' ? 'floating' : mode === 'sticky' ? 'sticky' : 'hidden';
      this.bannerMode = normalized;
      return new Promise((resolve) => {
        this.safeLocalSet({ exl_hl_banner_mode: normalized }, resolve);
      });
    },

    /**
     * Check and show floating button if conditions are met
     * Shows if: banner should not be shown (not default/whitelisted or dismissed)
     */
    async checkAndShowFloatingButton(options = {}) {
      const shouldShow = await this.shouldShowFloatingButton(options.force === true);
      if (shouldShow) {
        this.showFloatingButton();
      } else {
        this.hideFloatingButton();
      }
    },

    /**
     * Create and show floating button
     */
    showFloatingButton() {
      // Ensure body exists before appending
      if (!document.body) {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this.showFloatingButton());
          return;
        }
        // If still no body, try again after a short delay
        setTimeout(() => this.showFloatingButton(), 100);
        return;
      }
      
      // Don't create if already exists
      if (this.floatingButtonElement) {
        this.floatingButtonElement.style.display = 'block';
        // Restore saved position if available
        this.applyFloatingButtonPosition();
        this.clampFloatingButtonToViewport();
        this.setupFloatingButtonProximity();
        return;
      }
      
      this.ensureRadialStyles();

      const floatingBtn = document.createElement('button');
      floatingBtn.className = 'exl-hl-floating-btn';
      floatingBtn.innerHTML = '✨';
      floatingBtn.title = 'Highlighter quick actions';
      floatingBtn.setAttribute('aria-label', 'Highlighter quick actions');

      // Drag vs click detection is inside makeFloatingButtonDraggable
      this.makeFloatingButtonDraggable(floatingBtn);
      
      document.body.appendChild(floatingBtn);
      this.floatingButtonElement = floatingBtn;
      this.clampFloatingButtonToViewport();
      this.setupResizeHandler();
      this.setupFloatingButtonProximity();
      console.log('[HighlighterController] Floating button shown');
    },

    /**
     * Hide floating button
     */
    hideFloatingButton() {
      if (this.floatingButtonElement) {
        this.floatingButtonElement.style.display = 'none';
      }
    },

    async loadFloatingButtonPosition() {
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_floating_btn_pos'], (result) => {
          const pos = result.exl_hl_floating_btn_pos;
          if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
            this.floatingButtonPosition = { x: pos.x, y: pos.y };
          }
          resolve();
        });
      });
    },

    applyFloatingButtonPosition() {
      if (!this.floatingButtonElement) return;
      const { x, y } = this.floatingButtonPosition;
      if (x === null || y === null) return;
      this.floatingButtonElement.style.left = `${x}px`;
      this.floatingButtonElement.style.top = `${y}px`;
      this.floatingButtonElement.style.right = 'auto';
      this.floatingButtonElement.style.bottom = 'auto';
      this.floatingButtonElement.style.transform = 'none';
    },

    saveFloatingButtonPosition(x, y) {
      this.floatingButtonPosition = { x, y };
      this.safeLocalSet({ exl_hl_floating_btn_pos: { x, y } });
    },

    clampFloatingButtonToViewport() {
      if (!this.floatingButtonElement) return;
      const rect = this.floatingButtonElement.getBoundingClientRect();
      const padding = 8;
      const width = rect.width || 48;
      const height = rect.height || 48;
      const clampedX = Math.min(Math.max(rect.left, padding), Math.max(padding, window.innerWidth - width - padding));
      const clampedY = Math.min(Math.max(rect.top, padding), Math.max(padding, window.innerHeight - height - padding));
      this.floatingButtonElement.style.left = `${clampedX}px`;
      this.floatingButtonElement.style.top = `${clampedY}px`;
      this.floatingButtonElement.style.right = 'auto';
      this.floatingButtonElement.style.bottom = 'auto';
      this.saveFloatingButtonPosition(clampedX, clampedY);

      // If radial menu is open, reposition it to stay centered on the button
      if (this.radialMenuState.isExpanded) {
        const centerX = clampedX + (width / 2);
        const centerY = clampedY + (height / 2);
        if (this.radialMenuState.menuElement) {
          this.radialMenuState.menuElement.style.left = `${centerX}px`;
          this.radialMenuState.menuElement.style.top = `${centerY}px`;
        }
      }
    },

    setupResizeHandler() {
      if (this._resizeHandler) return;
      const debounced = (() => {
        let timer = null;
        return () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            this.clampFloatingButtonToViewport();
            if (this.radialMenuState.isExpanded) {
              // Re-render radial menu to recalc positions with current viewport
              this.hideRadialMenu();
              this.showRadialMenu();
            }
          }, 120);
        };
      })();

      this._resizeHandler = debounced;
      window.addEventListener('resize', this._resizeHandler);
    },

    makeFloatingButtonDraggable(button) {
      if (!button) return;

      // Load saved position then apply and clamp to viewport
      this.loadFloatingButtonPosition().then(() => {
        this.applyFloatingButtonPosition();
        this.clampFloatingButtonToViewport();
      });

      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialLeft = 0;
      let initialTop = 0;
      const CLICK_THRESHOLD = 5;

      const onMouseMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        // Constrain to viewport with padding
        const padding = 8;
        const maxX = Math.max(padding, window.innerWidth - (button.offsetWidth || 48) - padding);
        const maxY = Math.max(padding, window.innerHeight - (button.offsetHeight || 48) - padding);
        newLeft = Math.min(Math.max(newLeft, padding), maxX);
        newTop = Math.min(Math.max(newTop, padding), maxY);

        button.style.left = `${newLeft}px`;
        button.style.top = `${newTop}px`;
        button.style.right = 'auto';
        button.style.bottom = 'auto';

        // Keep radial menu centered on the moving button
        if (this.radialMenuState.isExpanded && this.radialMenuState.menuElement) {
          const centerX = newLeft + button.offsetWidth / 2;
          const centerY = newTop + button.offsetHeight / 2;
          this.radialMenuState.menuElement.style.left = `${centerX}px`;
          this.radialMenuState.menuElement.style.top = `${centerY}px`;
        }
      };

      const onMouseUp = (e) => {
        if (!isDragging) return;

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Restore cursor and selection
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        const moved = Math.abs(e.clientX - startX) > CLICK_THRESHOLD || Math.abs(e.clientY - startY) > CLICK_THRESHOLD;
        const rect = button.getBoundingClientRect();

        // Only persist/adjust position when the user actually dragged; avoid micro-jumps on click
        if (moved) {
          this.saveFloatingButtonPosition(rect.left, rect.top);
          this.clampFloatingButtonToViewport();
        }

        button.classList.remove('dragging');
        isDragging = false;

        if (!moved) {
          // Treat as click
          if (this.bannerMode === 'floating') {
            this.toggleFloatingBanner();
          } else {
            this.toggleRadialMenu(e);
          }
        }
      };

      const onMouseDown = (e) => {
        // Only start drag on direct interaction with the button
        if (e.target !== button && !button.contains(e.target)) return;

        startX = e.clientX;
        startY = e.clientY;
        const rect = button.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        isDragging = true;
        button.classList.add('dragging');

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      button.addEventListener('mousedown', onMouseDown);

      // Prevent context menu during drag
      button.addEventListener('contextmenu', (e) => {
        if (isDragging) {
          e.preventDefault();
        }
      });
    },

    setupFloatingButtonProximity() {
      if (!this.floatingButtonElement) return;
      if (this._proximityHandler) return;

      const button = this.floatingButtonElement;
      const handler = (evt) => {
        if (!button || button.style.display === 'none') return;
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = evt.clientX - centerX;
        const dy = evt.clientY - centerY;
        const distance = Math.hypot(dx, dy);
        const radius = rect.width / 2;
        const proximityThreshold = radius + 30;

        if (distance <= proximityThreshold) {
          const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
          button.style.setProperty('--exl-glow-angle', `${angleDeg}deg`);
          button.classList.add('proximity');
        } else {
          button.classList.remove('proximity');
        }
      };

      this._proximityHandler = handler;
      window.addEventListener('mousemove', handler);
    },

    // ========== RADIAL MENU ========== 

    toggleRadialMenu(event) {
      if (this.radialMenuState.isExpanded) {
        this.hideRadialMenu();
      } else {
        this.showRadialMenu(event);
      }
    },

    showRadialMenu(event) {
      if (this.radialMenuState.isExpanded || !this.floatingButtonElement) return;

      this.ensureRadialStyles();
      this.hideRadialMenu();

      const buttonRect = this.floatingButtonElement.getBoundingClientRect();
      const centerX = buttonRect.left + buttonRect.width / 2;
      const centerY = buttonRect.top + buttonRect.height / 2;

      const menu = document.createElement('div');
      menu.className = 'exl-hl-radial-menu';
      menu.id = 'exl-hl-radial-menu';
      menu.style.left = `${centerX}px`;
      menu.style.top = `${centerY}px`;

      const overlay = document.createElement('div');
      overlay.className = 'exl-hl-radial-overlay';
      overlay.addEventListener('click', () => this.hideRadialMenu());
      document.body.appendChild(overlay);

      const items = this.getRadialMenuItems();
      const colors = (typeof Highlighter !== 'undefined' && Highlighter.getColors) ? Highlighter.getColors() : [];
      const currentColor = (typeof Highlighter !== 'undefined' && Highlighter.getCurrentColor) ? Highlighter.getCurrentColor() : null;

      const mouseX = event ? event.clientX : centerX;
      const mouseY = event ? event.clientY : centerY;
      const deltaX = mouseX - centerX;
      const deltaY = mouseY - centerY;
      const entryAngle = Math.atan2(deltaY, deltaX);

      const radius = this.radialMenuState.radius;
      const colorRadius = Math.max(40, Math.min(this.radialMenuState.innerRadius || 55, radius - 20));
      const angleRangeDeg = 180;
      const angleRangeRad = angleRangeDeg * Math.PI / 180;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const itemSize = 44;
      const colorSize = 28;
      const padding = 20;

      const baseStartAngle = entryAngle - (angleRangeRad / 2);
      let startAngleRad = baseStartAngle;

      const edgeThreshold = 120;
      const nearLeft = centerX < edgeThreshold;
      const nearRight = centerX > viewportWidth - edgeThreshold;
      const nearTop = centerY < edgeThreshold;
      const nearBottom = centerY > viewportHeight - edgeThreshold;

      const angleStep = items.length > 1 ? angleRangeRad / (items.length - 1) : 0;

      let bestAngle = startAngleRad;
      let minOverflow = Infinity;
      let minItemsOutside = Infinity;
      const testAngles = [];

      if (nearLeft) {
        testAngles.push(Math.PI / 2 - (angleRangeRad / 2));
        testAngles.push(Math.PI / 4 - (angleRangeRad / 2));
        testAngles.push(0 - (angleRangeRad / 2));
      }
      if (nearRight) {
        testAngles.push(-Math.PI / 2 - (angleRangeRad / 2));
        testAngles.push(-Math.PI / 4 - (angleRangeRad / 2));
        testAngles.push(Math.PI - (angleRangeRad / 2));
      }
      if (nearTop) {
        testAngles.push(0 - (angleRangeRad / 2));
        testAngles.push(Math.PI / 4 - (angleRangeRad / 2));
        testAngles.push(-Math.PI / 4 - (angleRangeRad / 2));
      }
      if (nearBottom) {
        testAngles.push(Math.PI - (angleRangeRad / 2));
        testAngles.push(3 * Math.PI / 4 - (angleRangeRad / 2));
        testAngles.push(-3 * Math.PI / 4 - (angleRangeRad / 2));
      }

      if ((nearLeft && nearTop) || (nearRight && nearBottom)) {
        testAngles.push(Math.PI / 4 - (angleRangeRad / 2));
        testAngles.push(Math.PI / 2 - (angleRangeRad / 2));
      }
      if ((nearLeft && nearBottom) || (nearRight && nearTop)) {
        testAngles.push(-Math.PI / 4 - (angleRangeRad / 2));
        testAngles.push(-Math.PI / 2 - (angleRangeRad / 2));
      }

      testAngles.push(startAngleRad);

      const normalizeAngle = (angle) => {
        const twoPi = Math.PI * 2;
        let a = angle % twoPi;
        if (a > Math.PI) a -= twoPi;
        if (a < -Math.PI) a += twoPi;
        return a;
      };

      const uniqueAngles = [...new Set([baseStartAngle, ...testAngles])];

      for (const testAngle of uniqueAngles) {
        let overflow = 0;
        let itemsOutside = 0;

        for (let i = 0; i < items.length; i++) {
          const angle = testAngle + (i * angleStep);
          const testX = centerX + Math.cos(angle) * radius;
          const testY = centerY + Math.sin(angle) * radius;

          const leftEdge = testX - itemSize / 2;
          const rightEdge = testX + itemSize / 2;
          const topEdge = testY - itemSize / 2;
          const bottomEdge = testY + itemSize / 2;

          if (leftEdge < padding) {
            overflow += (padding - leftEdge) * 2;
            itemsOutside++;
          }
          if (rightEdge > viewportWidth - padding) {
            overflow += (rightEdge - (viewportWidth - padding)) * 2;
            itemsOutside++;
          }
          if (topEdge < padding) {
            overflow += (padding - topEdge) * 2;
            itemsOutside++;
          }
          if (bottomEdge > viewportHeight - padding) {
            overflow += (bottomEdge - (viewportHeight - padding)) * 2;
            itemsOutside++;
          }
        }

        const colorAngleStep = colors.length > 1 ? angleRangeRad / (colors.length - 1) : 0;
        for (let i = 0; i < colors.length; i++) {
          const angle = testAngle + (i * colorAngleStep);
          const testX = centerX + Math.cos(angle) * colorRadius;
          const testY = centerY + Math.sin(angle) * colorRadius;

          const leftEdge = testX - colorSize / 2;
          const rightEdge = testX + colorSize / 2;
          const topEdge = testY - colorSize / 2;
          const bottomEdge = testY + colorSize / 2;

          if (leftEdge < padding) {
            overflow += (padding - leftEdge);
            itemsOutside++;
          }
          if (rightEdge > viewportWidth - padding) {
            overflow += (rightEdge - (viewportWidth - padding));
            itemsOutside++;
          }
          if (topEdge < padding) {
            overflow += (padding - topEdge);
            itemsOutside++;
          }
          if (bottomEdge > viewportHeight - padding) {
            overflow += (bottomEdge - (viewportHeight - padding));
            itemsOutside++;
          }
        }

        const deviationPenalty = Math.abs(normalizeAngle(testAngle - baseStartAngle)) * 50;
        const score = (itemsOutside * 200) + overflow + deviationPenalty;

        if (itemsOutside === 0 && overflow === 0 && deviationPenalty === 0) {
          bestAngle = testAngle;
          break;
        }

        if (itemsOutside < minItemsOutside || (itemsOutside === minItemsOutside && score < minOverflow)) {
          minItemsOutside = itemsOutside;
          minOverflow = score;
          bestAngle = testAngle;
        }
      }

      startAngleRad = bestAngle;
      const angleStepDeg = items.length > 1 ? angleRangeRad / (items.length - 1) : 0;

      items.forEach((item, index) => {
        const angle = startAngleRad + (index * angleStepDeg);
        let x = Math.cos(angle) * radius;
        let y = Math.sin(angle) * radius;

        const finalX = centerX + x;
        const finalY = centerY + y;

        if (finalX - itemSize / 2 < padding) {
          x = padding + itemSize / 2 - centerX;
        } else if (finalX + itemSize / 2 > viewportWidth - padding) {
          x = viewportWidth - padding - itemSize / 2 - centerX;
        }

        if (finalY - itemSize / 2 < padding) {
          y = padding + itemSize / 2 - centerY;
        } else if (finalY + itemSize / 2 > viewportHeight - padding) {
          y = viewportHeight - padding - itemSize / 2 - centerY;
        }

        const itemEl = document.createElement('button');
        itemEl.className = 'exl-hl-radial-item';
        itemEl.innerHTML = item.icon;
        itemEl.title = item.label;
        itemEl.setAttribute('aria-label', item.label);
        itemEl.setAttribute('tabindex', '0');
        itemEl.style.setProperty('--final-x', `${x}px`);
        itemEl.style.setProperty('--final-y', `${y}px`);
        itemEl.style.setProperty('--animation-delay', `${index * this.radialMenuState.animationDelay}ms`);

        itemEl.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.action) {
            item.action();
          }
          if (item.closeOnAction !== false) {
            this.hideRadialMenu();
          }
        });

        menu.appendChild(itemEl);
        this.radialMenuState.items.push(itemEl);
      });

      const colorAngleStep = colors.length > 1 ? angleRangeRad / (colors.length - 1) : 0;

      colors.forEach((color, index) => {
        const angle = startAngleRad + (index * colorAngleStep);
        let x = Math.cos(angle) * colorRadius;
        let y = Math.sin(angle) * colorRadius;

        const finalX = centerX + x;
        const finalY = centerY + y;

        if (finalX - colorSize / 2 < padding) {
          x = padding + colorSize / 2 - centerX;
        } else if (finalX + colorSize / 2 > viewportWidth - padding) {
          x = viewportWidth - padding - colorSize / 2 - centerX;
        }

        if (finalY - colorSize / 2 < padding) {
          y = padding + colorSize / 2 - centerY;
        } else if (finalY + colorSize / 2 > viewportHeight - padding) {
          y = viewportHeight - padding - colorSize / 2 - centerY;
        }

        const chip = document.createElement('button');
        chip.className = 'exl-hl-radial-color-chip';
        chip.style.backgroundColor = color.rgb;
        chip.title = color.name;
        chip.setAttribute('aria-label', `Color: ${color.name}`);
        chip.dataset.colorId = color.id;
        chip.style.setProperty('--final-x', `${x}px`);
        chip.style.setProperty('--final-y', `${y}px`);
        chip.style.setProperty('--animation-delay', `${(items.length + index) * this.radialMenuState.animationDelay}ms`);

        if (currentColor && currentColor.id === color.id) {
          chip.classList.add('selected');
        }

        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectRadialColor(color.id, chip);
        });

        menu.appendChild(chip);
        this.radialMenuState.items.push(chip);
      });

      document.body.appendChild(menu);
      this.radialMenuState.menuElement = menu;
      this.radialMenuState.isExpanded = true;

      this.floatingButtonElement.classList.add('expanded');
      this.floatingButtonElement.setAttribute('aria-expanded', 'true');

      this.setupRadialMenuKeyboard(menu);
    },

    getRadialMenuItems() {
      const items = [
        {
          icon: '🖍️',
          label: 'Highlight Selection',
          closeOnAction: false,
          action: () => {
            if (typeof Highlighter !== 'undefined' && Highlighter.createHighlight) {
              Highlighter.createHighlight();
            }
          }
        },
        {
          icon: '📝',
          label: 'Add Note',
          action: () => {
            if (typeof StickyNotes !== 'undefined' && StickyNotes.createNote) {
              const colorId = this.getActiveNoteColorId();
              StickyNotes.createNote(colorId ? { colorId } : {});
            }
          }
        },
        {
          icon: '📋',
          label: 'Manage Highlights & Notes',
          action: () => {
            if (typeof HighlightsSidepanel !== 'undefined' && HighlightsSidepanel.openPanel) {
              HighlightsSidepanel.openPanel();
            }
          }
        },
        {
          icon: '📚',
          label: 'Collections',
          action: () => {
            if (typeof BookmarkManager !== 'undefined' && BookmarkManager.openPanel) {
              BookmarkManager.openPanel();
            }
          }
        },
        {
          icon: '🔖',
          label: 'Bookmark Page',
          action: () => {
            this.showBookmarkDialog();
          }
        },
        {
          icon: '📌',
          label: 'Pin Banner',
          action: () => {
            this.reactivateBannerForCurrentUrl();
          }
        },
        {
          icon: '🗑️',
          label: 'Clear Page Highlights',
          action: () => {
            if (typeof Highlighter !== 'undefined' && Highlighter.clearCurrentPageHighlights) {
              if (confirm('Clear all highlights on this page?')) {
                Highlighter.clearCurrentPageHighlights();
              }
            }
          }
        },
        {
          icon: '☁️',
          label: 'Cloud Sync Settings',
          action: () => {
            if (typeof HybridStorageManager !== 'undefined' && HybridStorageManager.getSyncStatus) {
              this.showCloudSyncDialog();
            } else {
              this.showCloudSyncDialog();
            }
          }
        }
      ];

      try {
        const pref = (typeof Highlighter !== 'undefined' && Highlighter.getSelectionToolbarPreference)
          ? Highlighter.getSelectionToolbarPreference()
          : 'palette';
        if (pref !== 'palette') {
          items.push({
            icon: '🚦',
            label: 'Restore Selection Palette',
            action: async () => {
              if (typeof Highlighter !== 'undefined' && Highlighter.setSelectionToolbarPreference) {
                await Highlighter.setSelectionToolbarPreference('palette');
              }
            }
          });
        }
      } catch (error) {
        console.warn('[HighlighterController] Unable to read selection palette preference:', error);
      }

      return items;
    },

    selectRadialColor(colorId, element) {
      if (typeof Highlighter !== 'undefined' && Highlighter.setColor) {
        Highlighter.setColor(colorId);
      }
      if (typeof StickyNotes !== 'undefined' && StickyNotes.setDefaultColor) {
        StickyNotes.setDefaultColor(colorId);
      }
      this.safeLocalSet({ exl_hl_current_banner_color: colorId });

      const allColorChips = document.querySelectorAll('.exl-hl-radial-color-chip');
      allColorChips.forEach(chip => chip.classList.remove('selected'));
      if (element) {
        element.classList.add('selected');
      }
    },

    setupRadialMenuKeyboard(menu) {
      const handleKeydown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.hideRadialMenu();
        } else if (e.key === 'Tab') {
          const focusable = menu.querySelectorAll('button');
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeydown);
      this.radialMenuState.keyboardHandler = handleKeydown;

      const firstItem = menu.querySelector('button');
      if (firstItem) {
        setTimeout(() => firstItem.focus(), 100);
      }
    },

    hideRadialMenu() {
      if (!this.radialMenuState.isExpanded) return;

      const menu = this.radialMenuState.menuElement;
      const overlay = document.querySelector('.exl-hl-radial-overlay');

      if (menu) {
        menu.classList.add('collapsing');
        setTimeout(() => menu.remove(), 200);
      }
      if (overlay) overlay.remove();

      if (this.radialMenuState.keyboardHandler) {
        document.removeEventListener('keydown', this.radialMenuState.keyboardHandler);
        this.radialMenuState.keyboardHandler = null;
      }

      if (this.floatingButtonElement) {
        this.floatingButtonElement.classList.remove('expanded');
        this.floatingButtonElement.setAttribute('aria-expanded', 'false');
        this.floatingButtonElement.focus();
      }

      this.radialMenuState.menuElement = null;
      this.radialMenuState.items = [];
      this.radialMenuState.isExpanded = false;
    },

    /**
     * Create floating sidebar banner that expands from button
     * @deprecated Use radial menu instead. Kept for sticky/floating mode transition.
     */
    showFloatingBanner() {
      // Don't create if already exists
      if (this.floatingBannerElement) {
        this.floatingBannerElement.style.display = 'flex';
        return;
      }

      if (!this.floatingButtonElement) {
        console.warn('[HighlighterController] Cannot show floating banner: button not found');
        return;
      }

      // Get button position
      const buttonRect = this.floatingButtonElement.getBoundingClientRect();
      const buttonY = buttonRect.top;

      // Create floating banner container
      const floatingBanner = document.createElement('div');
      floatingBanner.className = 'exl-hl-floating-banner';
      floatingBanner.id = 'exl-hl-floating-banner';

      // Create container with all banner sections
      const container = document.createElement('div');
      container.className = 'exl-banner-container';

      // Section 1: Title
      const titleSection = document.createElement('div');
      titleSection.className = 'exl-banner-section';
      
      const titleLabel = document.createElement('div');
      titleLabel.className = 'exl-banner-label';
      titleLabel.textContent = 'Tool';
      
      const title = document.createElement('div');
      title.className = 'exl-hl-banner-title';
      title.textContent = '✨ Highlighter';
      
      titleSection.appendChild(titleLabel);
      titleSection.appendChild(title);
      container.appendChild(titleSection);

      // Section 2: Highlight Action
      const highlightSection = document.createElement('div');
      highlightSection.className = 'exl-banner-section';
      
      const highlightBtn = document.createElement('button');
      highlightBtn.className = 'exl-hl-btn';
      highlightBtn.innerHTML = '🖍️ Highlight';
      highlightBtn.title = 'Highlight selected text';
      highlightBtn.addEventListener('click', () => {
        if (typeof Highlighter !== 'undefined' && Highlighter.createHighlight) {
          Highlighter.createHighlight();
        }
      });
      
      highlightSection.appendChild(highlightBtn);
      container.appendChild(highlightSection);

      // Section 3: Color Palette
      const paletteSection = document.createElement('div');
      paletteSection.className = 'exl-banner-section';
      
      const paletteLabel = document.createElement('div');
      paletteLabel.className = 'exl-banner-label';
      paletteLabel.textContent = 'Colors';
      
      const palette = this.createColorPalette();
      paletteSection.appendChild(paletteLabel);
      paletteSection.appendChild(palette);
      container.appendChild(paletteSection);

      // Section 4: Layers
      const layerSection = document.createElement('div');
      layerSection.className = 'exl-banner-section';
      
      const layerBtn = this.createLayerDropdown();
      layerSection.appendChild(layerBtn);
      container.appendChild(layerSection);

      // Section 5: Actions (Notes, Collections, Bookmark)
      const actionsSection = document.createElement('div');
      actionsSection.className = 'exl-banner-section exl-banner-actions';
      
      const noteBtn = document.createElement('button');
      noteBtn.className = 'exl-hl-btn';
      noteBtn.innerHTML = '📝 Add Note';
      noteBtn.title = 'Create sticky note';
      noteBtn.addEventListener('click', () => {
        if (typeof StickyNotes !== 'undefined' && StickyNotes.createNote) {
          StickyNotes.createNote();
        }
      });

      const collectionsBtn = document.createElement('button');
      collectionsBtn.className = 'exl-hl-btn';
      collectionsBtn.innerHTML = '📚 Collections';
      collectionsBtn.title = 'Open collections';
      collectionsBtn.addEventListener('click', () => {
        if (typeof BookmarkManager !== 'undefined' && BookmarkManager.openPanel) {
          BookmarkManager.openPanel();
        }
      });

      const bookmarkBtn = document.createElement('button');
      bookmarkBtn.className = 'exl-hl-btn';
      bookmarkBtn.innerHTML = '🔖 Bookmark';
      bookmarkBtn.title = 'Bookmark this page';
      bookmarkBtn.addEventListener('click', () => {
        this.showBookmarkDialog();
      });
      
      actionsSection.appendChild(noteBtn);
      actionsSection.appendChild(collectionsBtn);
      actionsSection.appendChild(bookmarkBtn);
      container.appendChild(actionsSection);

      floatingBanner.appendChild(container);

      // Add collapse button (chevron pointing toward button)
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'exl-hl-floating-collapse-btn';
      collapseBtn.innerHTML = '◀';
      collapseBtn.title = 'Collapse to button';
      collapseBtn.setAttribute('aria-label', 'Collapse banner');
      collapseBtn.setAttribute('tabindex', '0');
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideFloatingBanner();
      });
      floatingBanner.appendChild(collapseBtn);

      // Add pin button (pin inside window)
      const pinBtn = document.createElement('button');
      pinBtn.className = 'exl-hl-floating-pin-btn';
      pinBtn.innerHTML = '📌';
      pinBtn.title = 'Pin to top';
      pinBtn.setAttribute('aria-label', 'Pin banner to top');
      pinBtn.setAttribute('tabindex', '0');
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchToStickyMode();
      });
      floatingBanner.appendChild(pinBtn);

      // Position floating banner on left side, anchored to button Y position
      floatingBanner.style.top = `${buttonY}px`;
      floatingBanner.style.left = '0px';
      floatingBanner.style.height = '48px';

      document.body.appendChild(floatingBanner);
      this.floatingBannerElement = floatingBanner;

      // Hide floating button when banner is shown
      if (this.floatingButtonElement) {
        this.floatingButtonElement.style.display = 'none';
      }

      console.log('[HighlighterController] Floating banner shown');
    },

    /**
     * Hide floating banner and show button
     */
    hideFloatingBanner() {
      if (this.floatingBannerElement) {
        this.floatingBannerElement.style.display = 'none';
      }
      
      // Show floating button
      if (this.floatingButtonElement) {
        this.floatingButtonElement.style.display = 'block';
      }
      
      console.log('[HighlighterController] Floating banner hidden');
    },

    /**
     * Toggle between floating button and floating banner
     */
    toggleFloatingBanner() {
      if (this.floatingBannerElement && this.floatingBannerElement.style.display !== 'none') {
        this.hideFloatingBanner();
      } else {
        this.showFloatingBanner();
      }
    },

    /**
     * Switch from floating to sticky mode
     */
    async switchToStickyMode() {
      // Hide floating banner and button
      this.hideFloatingBanner();
      if (this.floatingButtonElement) {
        this.floatingButtonElement.style.display = 'none';
      }

      // Show sticky banner
      if (!this.bannerElement) {
        this.createBanner();
        this.setupListeners();
      }
      
      if (this.bannerElement) {
        this.bannerElement.style.display = 'block';
        this.bannerElement.classList.add('sticky-mode');
        
        // Mark body
        if (document.body) {
          document.body.removeAttribute('data-exl-hl-banner-hidden');
        }

        // Ensure no layout adjustments are applied (sticky mode overlays content)
        this.adjustPageLayout(false);
        this.removeFixedElementAdjustments();
      }

      // Save mode
      await this.saveBannerMode('sticky');
      
      console.log('[HighlighterController] Switched to sticky mode');
    },

    /**
     * Switch from sticky to floating mode
     */
    async switchToFloatingMode() {
      // Hide sticky banner
      if (this.bannerElement) {
        this.bannerElement.style.display = 'none';
        this.bannerElement.classList.remove('sticky-mode');
        
        // Mark body
        if (document.body) {
          document.body.setAttribute('data-exl-hl-banner-hidden', 'true');
        }
        
        // Remove all layout adjustments
        this.adjustPageLayout(false);
        this.removeFixedElementAdjustments();
      }

      // Show floating button
      await this.showFloatingButton();

      // Save mode
      await this.saveBannerMode('floating');
      
      console.log('[HighlighterController] Switched to floating mode');
    },

    /**
     * Clear all dismissals for current URL/domain (reactivate banner)
     * @param {string} url - URL (optional, defaults to current)
     * @param {string} domain - Domain (optional, defaults to current)
     * @returns {Promise<void>}
     */
    async clearDismissals(url = null, domain = null) {
      const currentUrl = url || window.location.href;
      const currentDomain = domain || this.getDomainFromUrl(currentUrl);
      
      // Clear permanent URL dismissal
      return new Promise((resolve) => {
        this.safeLocalGet(['exl_hl_banner_page_dismissals', 'exl_hl_banner_dismissals'], (result) => {
          const pageDismissals = result.exl_hl_banner_page_dismissals || {};
          const dismissals = result.exl_hl_banner_dismissals || {};
          
          // Remove URL dismissal
          delete pageDismissals[currentUrl];
          
          // Remove domain permanent dismissal
          if (dismissals[currentDomain]) {
            dismissals[currentDomain].dismissed = false;
            dismissals[currentDomain].count = 0;
            dismissals[currentDomain].modalShown = false;
          }
          
          this.safeLocalSet({
            exl_hl_banner_page_dismissals: pageDismissals,
            exl_hl_banner_dismissals: dismissals
          }, () => {
            // Clear session dismissal
            try {
              const sessionDismissals = JSON.parse(
                sessionStorage.getItem('exl_hl_banner_session_dismissals') || '{}'
              );
              delete sessionDismissals[currentDomain];
              sessionStorage.setItem('exl_hl_banner_session_dismissals', JSON.stringify(sessionDismissals));
            } catch (error) {
              console.error('[HighlighterController] Error clearing session dismissal:', error);
            }
            
            resolve();
          });
        });
      });
    },

    /**
     * Reactivate banner for current URL
     */
    async reactivateBannerForCurrentUrl() {
      const currentUrl = window.location.href;
      const domain = this.getDomainFromUrl(currentUrl);
      
      // Clear all dismissals
      await this.clearDismissals(currentUrl, domain);
      
      // Hide floating button
      this.hideFloatingButton();
      
      // Show banner
      if (this.bannerElement) {
        this.bannerElement.style.display = 'block';
        this.bannerElement.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        this.bannerElement.style.transform = 'translateY(0)';
        this.bannerElement.style.opacity = '1';
        // Ensure height is maintained
        this.ensureBannerHeight();
      } else {
        // Recreate banner if it doesn't exist
        this.createBanner();
      }
      
      // Remove hidden marker from body
      if (document.body) {
        document.body.removeAttribute('data-exl-hl-banner-hidden');
      }
      
      // Apply layout adjustment
      this.adjustPageLayout(true);
      
      // Handle skip links
      this.handleSkipToContentLinks();
      
      // Show success message
      const toast = document.createElement('div');
      toast.className = 'exl-hl-toast';
      toast.textContent = '✅ Banner restored!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    },

    /**
     * Create color palette
     */
    createColorPalette() {
      const palette = document.createElement('div');
      palette.className = 'exl-hl-palette';

      const colors = Highlighter.getColors();
      colors.forEach(color => {
        const chip = document.createElement('div');
        chip.className = 'exl-hl-color-chip';
        chip.dataset.colorId = color.id;
        chip.style.background = color.rgb;
        chip.title = color.name;

        // Mark current color as selected
        const currentColor = Highlighter.getCurrentColor();
        if (color.id === currentColor.id) {
          chip.classList.add('exl-hl-selected');
        }

        chip.addEventListener('click', () => {
          // Remove selection from all chips
          palette.querySelectorAll('.exl-hl-color-chip').forEach(c => {
            c.classList.remove('exl-hl-selected');
          });
          
          // Select this chip
          chip.classList.add('exl-hl-selected');
          
          // Set color in highlighter
          Highlighter.setColor(color.id);
          
          // If there's a text selection, highlight it with this color
          let selectionNow = window.getSelection();
          let selectedTextNow = selectionNow.toString().trim();
          if (selectionNow && selectedTextNow.length > 0) {
            Highlighter.setColor(color.id);
            Highlighter.createHighlight(selectedTextNow);
            selectionNow = null;
          } else {
            Highlighter.setColor(color.id);
          }
        });

        palette.appendChild(chip);
      });

      return palette;
    },

    /**
     * Create layer dropdown
     * Follows best practices: dependency checks, error handling
     */
    createLayerDropdown() {
      // Check if LayerManager is available (dependency check - best practice)
      if (typeof LayerManager === 'undefined') {
        console.warn('[HighlighterController] LayerManager not available, skipping layer dropdown');
        return document.createElement('div'); // Return empty div as fallback
      }

      const container = document.createElement('div');
      container.className = 'exl-hl-layer-container';

      const button = document.createElement('button');
      button.className = 'exl-hl-btn exl-hl-layer-btn';
      button.title = 'Manage layers';
      
      // Update button text with active layer name
      const updateButtonText = () => {
        if (typeof LayerManager !== 'undefined' && LayerManager.getActiveLayer) {
          try {
            const activeLayer = LayerManager.getActiveLayer();
            button.innerHTML = `📚 ${activeLayer ? activeLayer.name : 'Layers'}`;
          } catch (error) {
            console.error('[HighlighterController] Error updating layer button text:', error);
            button.innerHTML = '📚 Layers';
          }
        } else {
          button.innerHTML = '📚 Layers';
        }
      };
      updateButtonText();

      // Create dropdown menu
      const dropdown = document.createElement('div');
      dropdown.className = 'exl-hl-layer-dropdown';
      dropdown.style.display = 'none';

      // Function to render layer list
      const renderLayerList = () => {
        if (typeof LayerManager === 'undefined') {
          console.warn('[HighlighterController] LayerManager not available, cannot render layer list');
          return;
        }

        dropdown.innerHTML = '';
        
        try {
          const layers = LayerManager.getAllLayers();
          const activeLayerId = LayerManager.getActiveLayerId();

          // New Layer button
          const newLayerBtn = document.createElement('div');
          newLayerBtn.className = 'exl-hl-layer-item exl-hl-new-layer';
          newLayerBtn.innerHTML = '<span class="exl-hl-layer-icon">➕</span> New Layer';
          newLayerBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (typeof LayerManager === 'undefined' || !LayerManager.createLayer) {
              console.error('[HighlighterController] LayerManager.createLayer not available');
              return;
            }
            const layerName = prompt('Enter layer name:');
            if (layerName && layerName.trim()) {
              try {
                await LayerManager.createLayer(layerName.trim());
                renderLayerList();
              } catch (error) {
                console.error('[HighlighterController] Error creating layer:', error);
              }
            }
          });
          dropdown.appendChild(newLayerBtn);

          // Separator
          const separator = document.createElement('div');
          separator.className = 'exl-hl-layer-separator';
          dropdown.appendChild(separator);

          // Layer list
          layers.forEach(layer => {
            const item = document.createElement('div');
            item.className = 'exl-hl-layer-item';
            if (layer.id === activeLayerId) {
              item.classList.add('exl-hl-active-layer');
            }

            const nameSpan = document.createElement('span');
            nameSpan.className = 'exl-hl-layer-name';
            nameSpan.textContent = layer.name;
            
            // Active checkmark
            if (layer.id === activeLayerId) {
              const checkmark = document.createElement('span');
              checkmark.className = 'exl-hl-layer-checkmark';
              checkmark.textContent = '✓';
              item.appendChild(checkmark);
            }
            
            item.appendChild(nameSpan);

            // Click to switch layer
            item.addEventListener('click', async (e) => {
              e.stopPropagation();
              if (typeof LayerManager === 'undefined' || !LayerManager.setActiveLayer) {
                console.error('[HighlighterController] LayerManager.setActiveLayer not available');
                return;
              }
              if (layer.id !== activeLayerId) {
                try {
                  await LayerManager.setActiveLayer(layer.id);
                  
                  // Switch both highlighter and sticky notes
                  if (typeof Highlighter !== 'undefined' && Highlighter.switchLayer &&
                      typeof StickyNotes !== 'undefined' && StickyNotes.switchLayer) {
                    await Promise.all([
                      Highlighter.switchLayer(),
                      StickyNotes.switchLayer()
                    ]);
                  }
                  
                  updateButtonText();
                  renderLayerList();
                } catch (error) {
                  console.error('[HighlighterController] Error switching layer:', error);
                }
              }
              dropdown.style.display = 'none';
            });

            // Right-click context menu for rename/delete
            item.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              const contextMenu = document.createElement('div');
              contextMenu.className = 'exl-hl-layer-context';
              contextMenu.style.position = 'fixed';
              contextMenu.style.left = e.clientX + 'px';
              contextMenu.style.top = e.clientY + 'px';

              // Rename option
              const renameOption = document.createElement('div');
              renameOption.className = 'exl-hl-layer-context-item';
              renameOption.textContent = '✏️ Rename';
              renameOption.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (typeof LayerManager === 'undefined' || !LayerManager.renameLayer) {
                  console.error('[HighlighterController] LayerManager.renameLayer not available');
                  return;
                }
                const newName = prompt('Enter new name:', layer.name);
                if (newName && newName.trim() && newName.trim() !== layer.name) {
                  try {
                    await LayerManager.renameLayer(layer.id, newName.trim());
                    updateButtonText();
                    renderLayerList();
                  } catch (error) {
                    console.error('[HighlighterController] Error renaming layer:', error);
                  }
                }
                if (document.body.contains(contextMenu)) {
                  document.body.removeChild(contextMenu);
                }
              });
              contextMenu.appendChild(renameOption);

              // Delete option (if not last layer)
              if (typeof LayerManager !== 'undefined' && LayerManager.getLayerCount && 
                  typeof LayerManager.getLayerCount === 'function' && LayerManager.getLayerCount() > 1) {
                const deleteOption = document.createElement('div');
                deleteOption.className = 'exl-hl-layer-context-item exl-hl-layer-delete';
                deleteOption.textContent = '🗑️ Delete';
                deleteOption.addEventListener('click', async (e) => {
                  e.stopPropagation();
                  if (typeof LayerManager === 'undefined' || !LayerManager.deleteLayer) {
                    console.error('[HighlighterController] LayerManager.deleteLayer not available');
                    return;
                  }
                  if (confirm(`Delete layer "${layer.name}"? This will remove all highlights and notes in this layer.`)) {
                    const wasActive = layer.id === activeLayerId;
                    try {
                      await LayerManager.deleteLayer(layer.id);
                      
                      if (wasActive) {
                        // Refresh both highlighter and notes
                        if (typeof Highlighter !== 'undefined' && Highlighter.switchLayer &&
                            typeof StickyNotes !== 'undefined' && StickyNotes.switchLayer) {
                          await Promise.all([
                            Highlighter.switchLayer(),
                            StickyNotes.switchLayer()
                          ]);
                        }
                        updateButtonText();
                      }
                      renderLayerList();
                    } catch (error) {
                      console.error('[HighlighterController] Error deleting layer:', error);
                    }
                  }
                  if (document.body.contains(contextMenu)) {
                    document.body.removeChild(contextMenu);
                  }
                });
                contextMenu.appendChild(deleteOption);
              }

              document.body.appendChild(contextMenu);

              // Close context menu on click outside
              const closeContextMenu = (e) => {
                if (!contextMenu.contains(e.target)) {
                  if (document.body.contains(contextMenu)) {
                    document.body.removeChild(contextMenu);
                  }
                  document.removeEventListener('click', closeContextMenu);
                }
              };
              setTimeout(() => document.addEventListener('click', closeContextMenu), 0);
            });

            dropdown.appendChild(item);
          });
        } catch (error) {
          console.error('[HighlighterController] Error rendering layer list:', error);
        }
      };

      // Toggle dropdown
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdown.style.display !== 'none';
        if (isVisible) {
          dropdown.style.display = 'none';
        } else {
          // Calculate position for fixed dropdown
          const buttonRect = button.getBoundingClientRect();
          dropdown.style.display = 'block';
          dropdown.style.top = (buttonRect.bottom + 8) + 'px';
          // Position dropdown aligned to the right edge of the button
          dropdown.style.right = (window.innerWidth - buttonRect.right) + 'px';
          dropdown.style.left = 'auto';
          renderLayerList();
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!container.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });

      // Append dropdown to body for proper stacking context
      document.body.appendChild(dropdown);

      container.appendChild(button);

      return container;
    },

    /**
     * Show bookmark dialog
     */
    showBookmarkDialog() {
      const collections = BookmarkManager.getCollections();
      
      if (collections.length === 0) {
        alert('Please create a collection first!\n\nClick "Collections" button to create one.');
        BookmarkManager.openPanel();
        return;
      }

      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.className = 'exl-hl-modal-overlay';

      const modal = document.createElement('div');
      modal.className = 'exl-hl-modal';

      // Header
      const header = document.createElement('div');
      header.className = 'exl-hl-modal-header';
      const title = document.createElement('h2');
      title.className = 'exl-hl-modal-title';
      title.textContent = '🔖 Bookmark This Page';
      header.appendChild(title);

      // Body
      const body = document.createElement('div');
      body.className = 'exl-hl-modal-body';

      // Collection select
      const collGroup = document.createElement('div');
      collGroup.className = 'exl-hl-form-group';
      const collLabel = document.createElement('label');
      collLabel.className = 'exl-hl-label';
      collLabel.textContent = 'Collection';
      const collSelect = document.createElement('select');
      collSelect.className = 'exl-hl-select';
      collections.forEach(coll => {
        const option = document.createElement('option');
        option.value = coll.id;
        option.textContent = coll.name;
        collSelect.appendChild(option);
      });
      collGroup.appendChild(collLabel);
      collGroup.appendChild(collSelect);

      // Title input
      const titleGroup = document.createElement('div');
      titleGroup.className = 'exl-hl-form-group';
      const titleLabel = document.createElement('label');
      titleLabel.className = 'exl-hl-label';
      titleLabel.textContent = 'Title (max 100 characters)';
      const titleInput = document.createElement('input');
      titleInput.className = 'exl-hl-input';
      titleInput.type = 'text';
      titleInput.maxLength = 100;
      titleInput.value = document.title;
      titleGroup.appendChild(titleLabel);
      titleGroup.appendChild(titleInput);

      // URL input (read-only)
      const urlGroup = document.createElement('div');
      urlGroup.className = 'exl-hl-form-group';
      const urlLabel = document.createElement('label');
      urlLabel.className = 'exl-hl-label';
      urlLabel.textContent = 'URL';
      const urlInput = document.createElement('input');
      urlInput.className = 'exl-hl-input';
      urlInput.type = 'text';
      urlInput.value = window.location.href;
      urlInput.readOnly = true;
      urlGroup.appendChild(urlLabel);
      urlGroup.appendChild(urlInput);

      // Description textarea
      const descGroup = document.createElement('div');
      descGroup.className = 'exl-hl-form-group';
      const descLabel = document.createElement('label');
      descLabel.className = 'exl-hl-label';
      descLabel.textContent = 'Description (max 200 characters)';
      const descTextarea = document.createElement('textarea');
      descTextarea.className = 'exl-hl-textarea-input';
      descTextarea.maxLength = 200;
      descTextarea.rows = 3;
      const charCounter = document.createElement('div');
      charCounter.className = 'exl-hl-char-counter';
      charCounter.textContent = '0 / 200';
      descTextarea.addEventListener('input', () => {
        charCounter.textContent = `${descTextarea.value.length} / 200`;
      });
      descGroup.appendChild(descLabel);
      descGroup.appendChild(descTextarea);
      descGroup.appendChild(charCounter);

      body.appendChild(collGroup);
      body.appendChild(titleGroup);
      body.appendChild(urlGroup);
      body.appendChild(descGroup);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'exl-hl-modal-footer';
      
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'exl-hl-btn exl-hl-btn-secondary';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        overlay.remove();
      });

      const saveBtn = document.createElement('button');
      saveBtn.className = 'exl-hl-btn';
      saveBtn.textContent = 'Save Bookmark';
      saveBtn.addEventListener('click', async () => {
        const collectionId = collSelect.value;
        const title = titleInput.value.trim();
        const url = urlInput.value.trim();
        const description = descTextarea.value.trim();

        if (!title) {
          alert('Please enter a title');
          return;
        }

        await BookmarkManager.createBookmark(collectionId, title, url, description);
        overlay.remove();
        
        // Show toast
        const toast = document.createElement('div');
        toast.className = 'exl-hl-toast';
        toast.textContent = '✅ Page bookmarked!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      });

      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);

      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
        }
      });

      document.body.appendChild(overlay);
    },

    showCloudSyncDialog() {
      console.log('[HighlighterController] Cloud sync dialog not available in this build');
      alert('Cloud sync settings are not available in this build.');
    },

    /**
     * Find and adjust fixed-positioned elements that might overlap banner
     * This handles elements with position: fixed and top: 0 (or close to 0)
     */
    adjustFixedElements() {
      const BANNER_HEIGHT_PX = 48;
      const ADJUSTMENT_ATTR = 'data-exl-hl-adjusted';
      
      try {
        // Only adjust when banner (or early padding) is actually in play
        const bannerActive = !!(this.bannerElement && this.bannerElement.isConnected && this.bannerElement.offsetParent !== null);
        const earlyApplied = !!window.__exlHlEarlyLayoutApplied;
        if (!bannerActive && !earlyApplied) {
          return;
        }

        // Find all elements that might be fixed headers
        const allElements = document.querySelectorAll('*');
        const fixedElements = [];
        
        allElements.forEach(el => {
          // Skip if already adjusted or if it's our banner
          if (el.hasAttribute(ADJUSTMENT_ATTR) || 
              el.id === 'exl-hl-banner' || 
              el.classList.contains('exl-hl-banner') ||
              el.closest(`[${ADJUSTMENT_ATTR}]`)) {
            return;
          }
          
          const style = window.getComputedStyle(el);
          const position = style.position;
          const top = parseInt(style.top, 10);
          
          // Check if element is fixed/sticky and at top of page
          if ((position === 'fixed' || position === 'sticky') && 
              (isNaN(top) || top <= 2)) {
            fixedElements.push(el);
          }
        });
        
        // Adjust fixed elements
        fixedElements.forEach(el => {
          const currentTop = parseInt(window.getComputedStyle(el).top, 10);
          const newTop = isNaN(currentTop) || currentTop >= BANNER_HEIGHT_PX 
            ? BANNER_HEIGHT_PX 
            : currentTop + BANNER_HEIGHT_PX;
          
          el.style.setProperty('top', `${newTop}px`, 'important');
          el.setAttribute(ADJUSTMENT_ATTR, 'true');
        });
        
        if (fixedElements.length > 0) {
          console.log(`[HighlighterController] Adjusted ${fixedElements.length} fixed elements`);
        }
      } catch (error) {
        console.error('[HighlighterController] Error adjusting fixed elements:', error);
      }
    },

    /**
     * Remove adjustments from fixed elements
     */
    removeFixedElementAdjustments() {
      const ADJUSTMENT_ATTR = 'data-exl-hl-adjusted';
      
      try {
        const adjustedElements = document.querySelectorAll(`[${ADJUSTMENT_ATTR}]`);
        adjustedElements.forEach(el => {
          el.style.removeProperty('top');
          el.removeAttribute(ADJUSTMENT_ATTR);
        });
        
        if (adjustedElements.length > 0) {
          console.log(`[HighlighterController] Removed adjustments from ${adjustedElements.length} elements`);
        }
      } catch (error) {
        console.error('[HighlighterController] Error removing fixed element adjustments:', error);
      }
    },

    /**
     * Adjust page layout to avoid banner overlap
     * Enhanced to handle various page structures more robustly
     * Uses padding only (not margin) to avoid double spacing
     * Note: Early layout adjustment may already be applied
     * Follows best practices: constants, element checks, error handling
     */
    adjustPageLayout(apply) {
      const BANNER_HEIGHT_PX = 48; // 3rem = 48px (constant, not magic number)
      const EARLY_STYLE_ID = 'exl-hl-early-layout';
      const STATE_FLAG = '__exlHlEarlyLayoutApplied';
      
      try {
        if (apply) {
          // Apply layout adjustment using padding only (to avoid double spacing)
          // Strategy 1: Ensure early style tag exists
          let earlyStyle = document.getElementById(EARLY_STYLE_ID);
          if (!earlyStyle && document.head) {
            earlyStyle = document.createElement('style');
            earlyStyle.id = EARLY_STYLE_ID;
            earlyStyle.textContent = `
              body {
                padding-top: ${BANNER_HEIGHT_PX}px !important;
                margin-top: 0 !important;
              }
              html {
                margin-top: 0 !important;
                padding-top: 0 !important;
              }
            `;
            document.head.appendChild(earlyStyle);
            return;
          }
          
          // Strategy 2: Apply inline styles as backup (padding only, no margin)
          if (document.body) {
            // Check element existence (best practice)
            const currentPadding = parseInt(window.getComputedStyle(document.body).paddingTop, 10);
            if (isNaN(currentPadding) || currentPadding < 2 || currentPadding < BANNER_HEIGHT_PX) {
              document.body.style.paddingTop = `${BANNER_HEIGHT_PX}px`;
            }
            // Remove margin to prevent double spacing
            document.body.style.marginTop = '0px';
          }
          
          // Strategy 3: Adjust fixed-positioned elements
          // Use setTimeout to ensure DOM is fully loaded
          setTimeout(() => {
            this.adjustFixedElements();
          }, 100);
          
          // Also adjust fixed elements after a delay for dynamic content
          setTimeout(() => {
            this.adjustFixedElements();
            // Re-check skip links for dynamically added ones
            this.handleSkipToContentLinks();
          }, 500);
          
          window[STATE_FLAG] = true;
        } else {
          // Remove layout adjustment completely
          // Remove inline styles from body (ensure both padding and margin are cleared)
          if (document.body) {
            // Check element existence (best practice)
            document.body.style.paddingTop = '';
            document.body.style.marginTop = '';
            
            // Also check computed style and force removal if it's still 48px
            const computedPadding = parseInt(window.getComputedStyle(document.body).paddingTop, 10);
            const computedMargin = parseInt(window.getComputedStyle(document.body).marginTop, 10);
            
            if (!isNaN(computedPadding) && computedPadding >= BANNER_HEIGHT_PX) {
              document.body.style.setProperty('padding-top', '0', 'important');
            }
            if (!isNaN(computedMargin) && computedMargin >= BANNER_HEIGHT_PX) {
              document.body.style.setProperty('margin-top', '0', 'important');
            }
          }
          
          // Remove early style tag if present
          const earlyStyle = document.getElementById(EARLY_STYLE_ID);
          if (earlyStyle) {
            // Check element existence before removal (best practice)
            earlyStyle.remove();
          }
          
          // Also remove any inline margin-top that might have been added elsewhere
          if (document.body && document.body.style.marginTop) {
            const marginTopValue = document.body.style.marginTop;
            if (marginTopValue.includes('48') || marginTopValue === '48px') {
              document.body.style.removeProperty('margin-top');
            }
          }
          
          // Remove fixed element adjustments
          this.removeFixedElementAdjustments();
          
          // Restore skip to content links
          this.restoreSkipToContentLinks();
          
          window[STATE_FLAG] = false;
        }
      } catch (error) {
        // Error handling (best practice: log with context)
        console.error('[HighlighterController] Error adjusting page layout:', error);
      }
    },

    /**
     * Remove early layout adjustment if feature is disabled
     * Enhanced to remove all layout adjustments completely
     * Follows best practices: checks element existence, error handling
     */
    removeEarlyLayoutAdjustment() {
      const EARLY_STYLE_ID = 'exl-hl-early-layout';
      const STATE_FLAG = '__exlHlEarlyLayoutApplied';
      
      try {
        // Remove inline styles from body (ensure both padding and margin are cleared)
        if (document.body) {
          // Remove padding
          if (document.body.style.paddingTop) {
            document.body.style.paddingTop = '';
          }
          // Force remove padding if it's still 48px via computed style
          const computedPadding = parseInt(window.getComputedStyle(document.body).paddingTop, 10);
          if (!isNaN(computedPadding) && computedPadding >= 48) {
            document.body.style.setProperty('padding-top', '0', 'important');
          }
          
          // Remove margin
          if (document.body.style.marginTop) {
            document.body.style.marginTop = '';
          }
          // Force remove margin if it's still 48px via computed style
          const computedMargin = parseInt(window.getComputedStyle(document.body).marginTop, 10);
          if (!isNaN(computedMargin) && computedMargin >= 48) {
            document.body.style.setProperty('margin-top', '0', 'important');
          }
          
          // Also check and remove any padding-top from html element
          if (document.documentElement) {
            const htmlPadding = parseInt(window.getComputedStyle(document.documentElement).paddingTop, 10);
            if (!isNaN(htmlPadding) && htmlPadding >= 48) {
              document.documentElement.style.setProperty('padding-top', '0', 'important');
            }
            const htmlMargin = parseInt(window.getComputedStyle(document.documentElement).marginTop, 10);
            if (!isNaN(htmlMargin) && htmlMargin >= 48) {
              document.documentElement.style.setProperty('margin-top', '0', 'important');
            }
          }
        }
        
        // Remove early style tag if present (check existence first - best practice)
        const earlyStyle = document.getElementById(EARLY_STYLE_ID);
        if (earlyStyle) {
          earlyStyle.remove();
        }
        
        // Remove fixed element adjustments
        this.removeFixedElementAdjustments();
        
        // Restore skip to content links
        this.restoreSkipToContentLinks();
        
        // Clear flag
        window[STATE_FLAG] = false;
        
        // Force a reflow to ensure styles are applied
        if (document.body) {
          document.body.offsetHeight; // Trigger reflow
        }
        
        console.log('[HighlighterController] Removed early layout adjustment');
        
      } catch (error) {
        // Error handling (best practice: log with context)
        console.error('[HighlighterController] Error removing early layout adjustment:', error);
      }
    },

    /**
     * Setup MutationObserver to watch for dynamically added fixed elements
     * This ensures fixed headers added after page load are also adjusted
     */
    setupFixedElementObserver() {
      try {
        // Only observe if banner is visible
        if (!this.bannerElement || this.bannerElement.style.display === 'none') {
          return;
        }

        // Create observer to watch for new elements
        const observer = new MutationObserver((mutations) => {
          let shouldAdjust = false;
          
          mutations.forEach((mutation) => {
            // Check if any added nodes are fixed-positioned elements
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) { // Element node
                const style = window.getComputedStyle(node);
                if ((style.position === 'fixed' || style.position === 'sticky') && 
                    (parseInt(style.top, 10) <= 10 || isNaN(parseInt(style.top, 10)))) {
                  shouldAdjust = true;
                }
                
                // Also check children
                const fixedChildren = node.querySelectorAll('*');
                fixedChildren.forEach(child => {
                  const childStyle = window.getComputedStyle(child);
                  if ((childStyle.position === 'fixed' || childStyle.position === 'sticky') && 
                      (parseInt(childStyle.top, 10) <= 10 || isNaN(parseInt(childStyle.top, 10)))) {
                    shouldAdjust = true;
                  }
                });
              }
            });
          });
          
          if (shouldAdjust) {
            // Debounce adjustments to avoid excessive calls
            clearTimeout(this._fixedElementAdjustTimeout);
            this._fixedElementAdjustTimeout = setTimeout(() => {
              this.adjustFixedElements();
              // Also check for new skip links
              this.handleSkipToContentLinks();
            }, 200);
          }
        });
        
        // Start observing
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: false
        });
        
        // Store observer for cleanup
        this._fixedElementObserver = observer;
        
        console.log('[HighlighterController] Fixed element observer set up');
      } catch (error) {
        console.error('[HighlighterController] Error setting up fixed element observer:', error);
      }
    },

    /**
     * Setup settings listener and URL change detection
     * Follows best practices: dependency checks, error handling
     */
    setupListeners() {
      try {
        // Storage change listener for feature toggle
        chrome.storage.onChanged.addListener((changes, areaName) => {
          try {
            if (areaName === 'sync' && changes.exlibris) {
              const newValue = changes.exlibris.newValue?.features?.highlighterEnabled;
              const oldValue = changes.exlibris.oldValue?.features?.highlighterEnabled;
              
              if (newValue !== oldValue) {
                if (newValue === false) {
                  // Feature disabled - remove early adjustment and cleanup
                  this.removeEarlyLayoutAdjustment();
                  this.cleanup();
                } else if (!this.isInitialized) {
                  // Feature enabled - apply early adjustment and init
                  // Early adjustment should already be applied, but ensure it
                  const STATE_FLAG = '__exlHlEarlyLayoutApplied';
                  if (!window[STATE_FLAG]) {
                    this.adjustPageLayout(true);
                  }
                  this.init();
                }
              }
            }
          } catch (error) {
            // Error handling (best practice: log with context)
            console.error('[HighlighterController] Error in storage change listener:', error);
          }
        });

        // URL change detection for SPA navigation
        this.setupUrlChangeDetection();

        // Listen for messages from popup/background for banner reactivation
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          try {
            if (request.action === 'toggleBanner') {
              const url = request.url || window.location.href;
              const show = request.show !== false; // Default to true
              
              if (show) {
                this.reactivateBannerForCurrentUrl().then(() => {
                  sendResponse({ success: true });
                });
              } else {
                this.handleBannerClose().then(() => {
                  sendResponse({ success: true });
                });
              }
              
              return true; // Keep channel open for async response
            }
          } catch (error) {
            console.error('[HighlighterController] Error handling message:', error);
            sendResponse({ success: false, error: error.message });
            return false;
          }
        });
      } catch (error) {
        // Error handling (best practice: log with context)
        console.error('[HighlighterController] Error setting up listeners:', error);
      }
    },

    /**
     * Setup URL change detection for SPA navigation
     * Uses NavigationObserver if available, otherwise falls back to polling
     */
    setupUrlChangeDetection() {
      // Try to use NavigationObserver if available
      if (typeof NavigationObserver !== 'undefined' && NavigationObserver.registerCallback) {
        NavigationObserver.registerCallback((context) => {
          this.handleUrlChange(window.location.href);
        });
        console.log('[HighlighterController] Using NavigationObserver for URL change detection');
        return;
      }

      // Fallback: Poll for URL changes (for SPAs that don't trigger NavigationObserver)
      // Check every 500ms for URL changes
      this.urlCheckInterval = setInterval(() => {
        const newUrl = window.location.href;
        if (newUrl !== this.currentUrl) {
          this.handleUrlChange(newUrl);
        }
      }, 500);

      // Also listen to popstate for back/forward navigation
      window.addEventListener('popstate', () => {
        setTimeout(() => {
          const newUrl = window.location.href;
          if (newUrl !== this.currentUrl) {
            this.handleUrlChange(newUrl);
          }
        }, 100);
      });

      console.log('[HighlighterController] Using polling for URL change detection');
    },

    /**
     * Handle URL change - reload highlights and notes for new URL
     * Also checks if banner should be shown/hidden based on dismissal status
     * @param {string} newUrl - The new URL
     */
    async handleUrlChange(newUrl) {
      if (!this.isInitialized) {
        return;
      }

      console.log('[HighlighterController] URL changed from', this.currentUrl, 'to', newUrl);
      this.currentUrl = newUrl;

      try {
        // Check if banner should be shown for new URL using new decision logic
        const bannerResult = await this.shouldShowBannerForSite(newUrl);
        
        if (bannerResult.show) {
          // Show banner if it should be shown
          if (this.bannerElement) {
            this.bannerElement.style.display = 'block';
            this.bannerElement.style.transform = 'translateY(0)';
            this.bannerElement.style.opacity = '1';
            // Remove hidden marker from body
            if (document.body) {
              document.body.removeAttribute('data-exl-hl-banner-hidden');
            }
            this.adjustPageLayout(true);
            // Hide floating button when banner is shown
            this.hideFloatingButton();
            // Re-adjust fixed elements after a delay for new page content
            setTimeout(() => {
              this.adjustFixedElements();
              // Re-check skip links for new page
              this.handleSkipToContentLinks();
            }, 300);
          } else {
            // Create banner if it doesn't exist
            this.createBanner();
          }
          this.hideFloatingButton();
        } else {
          // Hide banner if it shouldn't be shown
          if (this.bannerElement) {
            this.bannerElement.style.display = 'none';
            // Mark body as having hidden banner
            if (document.body) {
              document.body.setAttribute('data-exl-hl-banner-hidden', 'true');
            }
            this.adjustPageLayout(false);
            this.removeEarlyLayoutAdjustment();
          }
          
          // Force cleanup of gaps after a delay to ensure styles are applied
          setTimeout(() => {
            this.removeEarlyLayoutAdjustment();
            // Also ensure body doesn't have any top spacing
            if (document.body) {
              const computedPadding = parseInt(window.getComputedStyle(document.body).paddingTop, 10);
              const computedMargin = parseInt(window.getComputedStyle(document.body).marginTop, 10);
              if ((!isNaN(computedPadding) && computedPadding > 0) || (!isNaN(computedMargin) && computedMargin > 0)) {
                document.body.style.setProperty('padding-top', '0', 'important');
                document.body.style.setProperty('margin-top', '0', 'important');
              }
            }
            // Check html element too
            if (document.documentElement) {
              const htmlPadding = parseInt(window.getComputedStyle(document.documentElement).paddingTop, 10);
              const htmlMargin = parseInt(window.getComputedStyle(document.documentElement).marginTop, 10);
              if ((!isNaN(htmlPadding) && htmlPadding > 0) || (!isNaN(htmlMargin) && htmlMargin > 0)) {
                document.documentElement.style.setProperty('padding-top', '0', 'important');
                document.documentElement.style.setProperty('margin-top', '0', 'important');
              }
            }
          }, 100);
          
          // Show floating button - ensure it appears
          await this.checkAndShowFloatingButton();
          
          // Double-check floating button is shown (fallback)
          if (!this.floatingButtonElement || this.floatingButtonElement.style.display === 'none') {
            this.showFloatingButton();
          }
        }

        // Reload highlights for new URL
        if (typeof Highlighter !== 'undefined' && Highlighter.reloadForNewUrl) {
          await Highlighter.reloadForNewUrl();
        }

        // Reload notes for new URL
        if (typeof StickyNotes !== 'undefined' && StickyNotes.reloadForNewUrl) {
          await StickyNotes.reloadForNewUrl();
        }
      } catch (error) {
        console.error('[HighlighterController] Error reloading data for new URL:', error);
      }
    },

    /**
     * Cleanup
     * Follows best practices: idempotency check, proper cleanup order
     */
    cleanup() {
      // Idempotency check (best practice)
      if (!this.isInitialized) return;

      try {
        // Ensure radial UI is fully removed
        this.hideRadialMenu();
        const strayRadialOverlay = document.querySelector('.exl-hl-radial-overlay');
        if (strayRadialOverlay) {
          strayRadialOverlay.remove();
        }

        // Clear URL check interval if it exists
        if (this.urlCheckInterval) {
          clearInterval(this.urlCheckInterval);
          this.urlCheckInterval = null;
        }

        // Clear undo notification timer
        if (this.undoNotificationTimer) {
          clearTimeout(this.undoNotificationTimer);
          this.undoNotificationTimer = null;
        }

        // Clear fixed element adjustment timeout
        if (this._fixedElementAdjustTimeout) {
          clearTimeout(this._fixedElementAdjustTimeout);
          this._fixedElementAdjustTimeout = null;
        }

        // Disconnect MutationObserver if present
        if (this._fixedElementObserver) {
          this._fixedElementObserver.disconnect();
          this._fixedElementObserver = null;
        }

        // Remove undo notification if present
        const undoNotification = document.querySelector('.exl-hl-undo-notification');
        if (undoNotification) {
          undoNotification.remove();
        }

        // Remove banner from DOM (check existence first - best practice)
        if (this.bannerElement) {
          this.bannerElement.remove();
          this.bannerElement = null;
        }

        // Remove radial style tag if injected
        const radialStyle = document.getElementById('exl-hl-radial-styles');
        if (radialStyle) {
          radialStyle.remove();
        }

        if (this.recordingStatusHandler) {
          document.removeEventListener('exlRecordingStatus', this.recordingStatusHandler);
          this.recordingStatusHandler = null;
        }

        if (this._proximityHandler) {
          window.removeEventListener('mousemove', this._proximityHandler);
          this._proximityHandler = null;
        }

        // Remove floating button if present
        if (this.floatingButtonElement) {
          this.floatingButtonElement.remove();
          this.floatingButtonElement = null;
        }

        if (this._resizeHandler) {
          window.removeEventListener('resize', this._resizeHandler);
          this._resizeHandler = null;
        }

        // Remove layout adjustment
        this.adjustPageLayout(false);
        this.removeEarlyLayoutAdjustment();

        // Cleanup modules (best practice: cleanup in reverse order of init)
        if (typeof Highlighter !== 'undefined') {
          Highlighter.cleanup();
        }
        if (typeof StickyNotes !== 'undefined') {
          StickyNotes.cleanup();
        }
        if (typeof BookmarkManager !== 'undefined') {
          BookmarkManager.cleanup();
        }

        this.currentUrl = null;
        this.closeButtonElement = null;
        this.isInitialized = false;
        console.log('[HighlighterController] Cleaned up');
        
      } catch (error) {
        // Error handling (best practice: log with context)
        console.error('[HighlighterController] Error during cleanup:', error);
        // Still mark as not initialized to allow retry
        this.isInitialized = false;
      }
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      HighlighterController.init();
    });
  } else {
    HighlighterController.init();
  }

  // Make available globally for debugging
  window.HighlighterController = HighlighterController;

})();
