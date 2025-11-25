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
  
  // Check if current site is a default banner domain
  // Only apply early layout adjustment if it's a default domain (optimistic)
  // Will be removed later if banner shouldn't show
  function isDefaultBannerDomain() {
    const DEFAULT_BANNER_DOMAINS = [
      'support.clarivate.com',
      'developers.exlibrisgroup.com',
      'knowledge.exlibrisgroup.com',
      'wiki.clarivate.io'
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
    undoNotificationTimer: null,
    closeButtonElement: null,

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

        // Check if banner should be shown using new decision logic BEFORE creating UI
        const bannerResult = await this.shouldShowBannerForSite();
        
        if (bannerResult.show) {
          // Banner should show - create it
          this.createBanner();
          this.setupListeners();
          
          // Setup MutationObserver to watch for dynamically added fixed elements
          this.setupFixedElementObserver();
          
          // Hide floating button
          this.hideFloatingButton();
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
          }, 100);
          
          // Show floating button (for non-default/non-whitelisted sites or dismissed sites)
          await this.checkAndShowFloatingButton();
          
          // Ensure floating button is shown even if check failed
          if (!this.floatingButtonElement || this.floatingButtonElement.style.display === 'none') {
            this.showFloatingButton();
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
        chrome.storage.sync.get(['exlibris'], (result) => {
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
        chrome.storage.local.get(['exl_hl_banner_whitelist'], (result) => {
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
        chrome.storage.local.get(['exl_hl_banner_dismissals'], (result) => {
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
        chrome.storage.local.get(['exl_hl_banner_page_dismissals'], (result) => {
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
        chrome.storage.local.get(['exl_hl_banner_dismissals'], (result) => {
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
          
          chrome.storage.local.set({ exl_hl_banner_dismissals: dismissals }, () => {
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
        chrome.storage.local.get(['exl_hl_banner_page_dismissals'], (result) => {
          const pageDismissals = result.exl_hl_banner_page_dismissals || {};
          pageDismissals[url] = true;
          chrome.storage.local.set({ exl_hl_banner_page_dismissals: pageDismissals }, () => {
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
        chrome.storage.local.get(['exl_hl_banner_dismissals'], (result) => {
          const dismissals = result.exl_hl_banner_dismissals || {};
          
          if (!dismissals[domain]) {
            dismissals[domain] = {};
          }
          
          dismissals[domain].dismissed = true;
          dismissals[domain].count = 0; // Reset count
          
          chrome.storage.local.set({ exl_hl_banner_dismissals: dismissals }, () => {
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
        chrome.storage.local.get(['exl_hl_banner_dismissals'], (result) => {
          const dismissals = result.exl_hl_banner_dismissals || {};
          
          if (!dismissals[domain]) {
            dismissals[domain] = {};
          }
          
          dismissals[domain].modalShown = true;
          dismissals[domain].count = 0; // Reset count
          
          chrome.storage.local.set({ exl_hl_banner_dismissals: dismissals }, () => {
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
        chrome.storage.local.get(['exl_hl_banner_whitelist'], (result) => {
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
            
            chrome.storage.local.set({ exl_hl_banner_whitelist: whitelist }, () => {
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
        chrome.storage.local.get(['exl_hl_banner_whitelist'], (result) => {
          const whitelist = result.exl_hl_banner_whitelist || { domains: [], urls: [] };
          
          try {
            if (type === 'domain') {
              const domain = value.toLowerCase().replace(/^www\./, '').replace(/^https?:\/\//, '').split('/')[0];
              whitelist.domains = whitelist.domains.filter(d => d !== domain);
            } else if (type === 'url') {
              whitelist.urls = whitelist.urls.filter(u => u !== value);
            }
            
            chrome.storage.local.set({ exl_hl_banner_whitelist: whitelist }, () => {
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
    async shouldShowFloatingButton() {
      try {
        // Exclude Salesforce domains
        const hostname = window.location.hostname.toLowerCase();
        const isSalesforce = /\.force\.com$|\.salesforce\.com$|\.lightning\.force\.com$/i.test(hostname);
        if (isSalesforce) {
          return false;
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
        StickyNotes.createNote();
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
      
      actionsSection.appendChild(noteBtn);
      actionsSection.appendChild(collectionsBtn);
      actionsSection.appendChild(bookmarkBtn);
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

    /**
     * Check and show floating button if conditions are met
     * Shows if: banner should not be shown (not default/whitelisted or dismissed)
     */
    async checkAndShowFloatingButton() {
      const shouldShow = await this.shouldShowFloatingButton();
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
        return;
      }
      
      const floatingBtn = document.createElement('button');
      floatingBtn.className = 'exl-hl-floating-btn';
      floatingBtn.innerHTML = '✨';
      floatingBtn.title = 'Show Highlighter Banner';
      floatingBtn.setAttribute('aria-label', 'Show Highlighter Banner');
      
      floatingBtn.addEventListener('click', async () => {
        await this.reactivateBannerForCurrentUrl();
      });
      
      document.body.appendChild(floatingBtn);
      this.floatingButtonElement = floatingBtn;
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
        chrome.storage.local.get(['exl_hl_banner_page_dismissals', 'exl_hl_banner_dismissals'], (result) => {
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
          
          chrome.storage.local.set({
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
        dropdown.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
          renderLayerList();
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });

      container.appendChild(button);
      container.appendChild(dropdown);

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

    /**
     * Find and adjust fixed-positioned elements that might overlap banner
     * This handles elements with position: fixed and top: 0 (or close to 0)
     */
    adjustFixedElements() {
      const BANNER_HEIGHT_PX = 48;
      const ADJUSTMENT_ATTR = 'data-exl-hl-adjusted';
      
      try {
        // Find all elements that might be fixed headers
        const allElements = document.querySelectorAll('*');
        const fixedElements = [];
        
        allElements.forEach(el => {
          // Skip if already adjusted or if it's our banner
          if (el.hasAttribute(ADJUSTMENT_ATTR) || 
              el.id === 'exl-hl-banner' || 
              el.classList.contains('exl-hl-banner')) {
            return;
          }
          
          const style = window.getComputedStyle(el);
          const position = style.position;
          const top = parseInt(style.top, 10);
          
          // Check if element is fixed/sticky and at top of page
          if ((position === 'fixed' || position === 'sticky') && 
              (isNaN(top) || top <= 10)) {
            fixedElements.push(el);
          }
        });
        
        // Adjust fixed elements
        fixedElements.forEach(el => {
          const currentTop = parseInt(window.getComputedStyle(el).top, 10);
          const newTop = isNaN(currentTop) || currentTop < BANNER_HEIGHT_PX 
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
          }
          
          // Strategy 2: Apply inline styles as backup (padding only, no margin)
          if (document.body) {
            // Check element existence (best practice)
            const currentPadding = parseInt(window.getComputedStyle(document.body).paddingTop, 10);
            if (isNaN(currentPadding) || currentPadding < BANNER_HEIGHT_PX) {
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

        // Remove floating button if present
        if (this.floatingButtonElement) {
          this.floatingButtonElement.remove();
          this.floatingButtonElement = null;
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
