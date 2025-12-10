/**
 * Highlighter Banner Manager Module
 * Manages the highlighter banner and floating button for non-Salesforce pages
 * 
 * Features:
 * - Banner display on whitelisted/default domains with full legacy structure
 * - Floating button display when banner is dismissed
 * - Radial menu when floating button is clicked
 * - Notification when floating button is shown
 * - Animated highlight when banner is shown from radial menu
 * - Popup menu near close button explaining reactivation
 * 
 * @module HighlighterBannerManager
 */

const HighlighterBannerManager = (function() {
  'use strict';

  const BANNER_ID = 'exl-hl-banner';
  const FLOATING_BUTTON_ID = 'exl-hl-floating-btn';
  const DEFAULT_DOMAINS = [
    'support.clarivate.com',
    'developers.exlibrisgroup.com',
    'knowledge.exlibrisgroup.com',
    'wiki.clarivate.io'
  ];

  let isInitialized = false;
  let bannerElement = null;
  let floatingButton = null;
  let radialMenu = null;
  let radialOverlay = null;
  let bannerShownFromRadialMenu = false;
  let messageRotationInterval = null;

  /**
   * Initialize the banner manager
   */
  async function init() {
    if (isInitialized) return;

    console.log('[HighlighterBannerManager] Initializing...');

    // Check if banner should be shown
    const shouldShowBanner = await checkShouldShowBanner();

    if (shouldShowBanner) {
      await createAndShowBanner();
    } else {
      await createAndShowFloatingButton();
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'toggleBanner') {
        handleToggleBanner(message.show).then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
        return true; // Async response
      }
    });

    // Listen for radial menu events
    document.addEventListener('exl-hl-show-banner-from-menu', () => {
      handleShowBannerFromRadialMenu();
    });
    
    document.addEventListener('exl-hl-radial-menu-show-banner', () => {
      handleShowBannerFromRadialMenu();
    });

    isInitialized = true;
    console.log('[HighlighterBannerManager] Initialized');
  }

  /**
   * Check if banner should be shown
   */
  async function checkShouldShowBanner() {
    return new Promise((resolve) => {
      const currentUrl = window.location.href;
      const hostname = new URL(currentUrl).hostname.toLowerCase().replace(/^www\./, '');

      // Check if default domain
      const isDefaultDomain = DEFAULT_DOMAINS.some(domain => {
        const checkDomain = domain.toLowerCase().replace(/^www\./, '');
        return hostname === checkDomain || hostname.endsWith('.' + checkDomain);
      });

      // Check whitelist
      chrome.storage.local.get(['exl_hl_banner_whitelist'], (result) => {
        const whitelist = result.exl_hl_banner_whitelist || { domains: [], urls: [] };
        let isInWhitelist = false;

        try {
          const urlObj = new URL(currentUrl);
          const urlHostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
          const urlPath = urlObj.href;

          if (whitelist.urls.includes(urlPath)) {
            isInWhitelist = true;
          } else if (whitelist.domains.some(domain => {
            const checkDomain = domain.toLowerCase().replace(/^www\./, '');
            return urlHostname === checkDomain || urlHostname.endsWith('.' + checkDomain);
          })) {
            isInWhitelist = true;
          }
        } catch (e) {
          // Invalid URL
        }

        // Check dismissals
        chrome.storage.local.get(['exl_hl_banner_dismissals', 'exl_hl_banner_page_dismissals'], (result) => {
          const dismissals = result.exl_hl_banner_dismissals || {};
          const pageDismissals = result.exl_hl_banner_page_dismissals || {};
          const domain = hostname;

          const isDismissed = pageDismissals[currentUrl] || (dismissals[domain] && dismissals[domain].dismissed);

          const shouldShow = (isDefaultDomain || isInWhitelist) && !isDismissed;
          resolve(shouldShow);
        });
      });
    });
  }

  /**
   * Create and show banner with full legacy structure
   */
  async function createAndShowBanner() {
    if (bannerElement) {
      bannerElement.style.display = 'flex'; // Use flex for the banner container
      document.body.removeAttribute('data-exl-hl-banner-hidden');
      return;
    }

    bannerElement = document.createElement('div');
    bannerElement.id = BANNER_ID;
    bannerElement.className = 'exl-hl-banner';

    // Get colors from Highlighter module
    const colors = typeof Highlighter !== 'undefined' && Highlighter.getColors ? Highlighter.getColors() : [];
    
    // Get active layer from LayerManager
    const activeLayerId = typeof LayerManager !== 'undefined' && LayerManager.getActiveLayerId ? LayerManager.getActiveLayerId() : 'default';
    const activeLayerName = typeof LayerManager !== 'undefined' && LayerManager.getLayerName ? LayerManager.getLayerName(activeLayerId) : 'Layer 1';
    
    // Get current color
    const currentColor = typeof Highlighter !== 'undefined' && Highlighter.getCurrentColor ? Highlighter.getCurrentColor() : colors[2] || colors[0];
    const currentColorId = currentColor ? currentColor.id : 3;

    // Build color palette HTML
    const colorPaletteHTML = colors.map(color => {
      const isSelected = color.id === currentColorId;
      return `<div class="exl-hl-color-chip${isSelected ? ' exl-hl-selected' : ''}" data-color-id="${color.id}" title="${color.name}" style="background: ${color.rgb};"></div>`;
    }).join('');

    // Build banner HTML matching legacy structure exactly
    bannerElement.innerHTML = `
      <div class="exl-banner-container">
        <div class="exl-banner-section">
          <div class="exl-banner-label">Tool</div>
          <div class="exl-hl-banner-title">✨ Highlighter</div>
        </div>
        <div class="exl-banner-section">
          <button class="exl-hl-btn" title="Highlight selected text">🖍️ Highlight</button>
        </div>
        <div class="exl-banner-section">
          <div class="exl-banner-label">Colors</div>
          <div class="exl-hl-palette">
            ${colorPaletteHTML}
          </div>
        </div>
        <div class="exl-banner-section">
          <div class="exl-hl-layer-container">
            <button class="exl-hl-btn exl-hl-layer-btn" title="Manage layers">📚 ${activeLayerName}</button>
          </div>
        </div>
        <div class="exl-banner-section exl-banner-actions">
          <button class="exl-hl-btn" title="Create sticky note">📝 Add Note</button>
          <button class="exl-hl-btn" title="Open collections">📚 Collections</button>
          <button class="exl-hl-btn" title="Manage notes and highlights">📋 Manage</button>
          <button class="exl-hl-btn" title="Bookmark this page">🔖 Bookmark</button>
          <button class="exl-hl-btn exl-hl-screenshot-btn" id="exl-hl-screenshot-btn" title="Take screenshot (requires html2canvas and fabric.js libraries)">📷 Screenshot</button>
        </div>
        <div class="exl-banner-section exl-hl-message-section">
          <div class="exl-hl-message-text" id="exl-hl-message-text">Ready to highlight</div>
          <div class="exl-hl-message-container" style="display: none;">
            <div class="exl-hl-message-wrapper">
              <div class="exl-hl-message-description" id="exl-hl-message-description"></div>
            </div>
            <button class="exl-hl-message-nav-btn" id="exl-hl-message-prev" title="Previous" style="display: none;">‹</button>
            <button class="exl-hl-message-nav-btn" id="exl-hl-message-next" title="Next" style="display: none;">›</button>
            <span class="exl-hl-message-counter" id="exl-hl-message-counter" style="display: none;"></span>
          </div>
        </div>
        <div class="exl-banner-section" style="position: relative;">
          <button class="exl-hl-banner-close-btn" id="exl-hl-banner-close-btn" title="Close banner" style="position: relative; top: 0px;">
            <span class="exl-hl-banner-close-icon">✕</span>
            <span class="exl-hl-banner-close-tooltip" id="exl-hl-banner-close-tooltip" style="display: none;">Close banner</span>
          </button>
        </div>
      </div>
    `;

    // Wire up event handlers
    wireBannerEventHandlers();

    document.body.appendChild(bannerElement);
    document.body.removeAttribute('data-exl-hl-banner-hidden');

    // Initialize and display messages
    initializeMessages();

    console.log('[HighlighterBannerManager] Banner created and shown');
  }

  /**
   * Hide banner
   */
  function hideBanner() {
    if (bannerElement) {
      bannerElement.style.display = 'none';
      document.body.setAttribute('data-exl-hl-banner-hidden', 'true');
      console.log('[HighlighterBannerManager] Banner hidden');
    }
  }

  /**
   * Wire up banner event handlers
   */
  function wireBannerEventHandlers() {
    if (!bannerElement) return;

    // Color chip clicks
    const colorChips = bannerElement.querySelectorAll('.exl-hl-color-chip');
    colorChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const colorId = parseInt(chip.dataset.colorId);
        if (typeof Highlighter !== 'undefined' && Highlighter.setColor) {
          Highlighter.setColor(colorId);
        }
        // Update selected state
        colorChips.forEach(c => c.classList.remove('exl-hl-selected'));
        chip.classList.add('exl-hl-selected');
      });
    });

    // Highlight button
    const highlightBtn = bannerElement.querySelector('.exl-hl-btn[title="Highlight selected text"]');
    if (highlightBtn) {
      highlightBtn.addEventListener('click', () => {
        // This is handled by the highlighter module's text selection handler
        // Just focus on the page to allow text selection
        window.focus();
      });
    }

    // Layer button
    const layerBtn = bannerElement.querySelector('.exl-hl-layer-btn');
    if (layerBtn) {
      layerBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // Ensure LayerManager is initialized
        if (typeof LayerManager !== 'undefined') {
          if (LayerManager.init) {
            try {
              await LayerManager.init();
            } catch (error) {
              console.error('[HighlighterBannerManager] Error initializing LayerManager:', error);
            }
          }
          
          if (LayerManager.showLayerDropdown) {
            LayerManager.showLayerDropdown(e.target);
          } else {
            console.warn('[HighlighterBannerManager] LayerManager.showLayerDropdown not available');
          }
        } else {
          console.warn('[HighlighterBannerManager] LayerManager not available');
        }
      });
    }

    // Add Note button
    const addNoteBtn = bannerElement.querySelector('.exl-hl-btn[title="Create sticky note"]');
    if (addNoteBtn && typeof StickyNotes !== 'undefined' && StickyNotes.createNote) {
      addNoteBtn.addEventListener('click', () => {
        StickyNotes.createNote();
      });
    }

    // Collections button (Bookmarks/Collections panel)
    const collectionsBtn = bannerElement.querySelector('.exl-hl-btn[title="Open collections"]');
    if (collectionsBtn && typeof BookmarkManager !== 'undefined' && BookmarkManager.openPanel) {
      collectionsBtn.addEventListener('click', () => {
        BookmarkManager.openPanel();
      });
    }

    // Manage Notes and Highlights button
    const manageBtn = bannerElement.querySelector('.exl-hl-btn[title="Manage notes and highlights"]');
    if (manageBtn && typeof HighlightsSidepanel !== 'undefined' && HighlightsSidepanel.openPanel) {
      manageBtn.addEventListener('click', () => {
        HighlightsSidepanel.openPanel();
      });
    }

    // Bookmark button
    const bookmarkBtn = bannerElement.querySelector('.exl-hl-btn[title="Bookmark this page"]');
    if (bookmarkBtn && typeof BookmarkManager !== 'undefined' && BookmarkManager.showBookmarkDialog) {
      bookmarkBtn.addEventListener('click', () => {
        BookmarkManager.showBookmarkDialog();
      });
    }

    // Screenshot button
    const screenshotBtn = bannerElement.querySelector('#exl-hl-screenshot-btn');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => {
        if (typeof ScreenshotManager !== 'undefined' && ScreenshotManager.startCapture) {
          try {
            // Check if required libraries are available
            if (typeof html2canvas === 'undefined') {
              showSimpleToast('html2canvas library not loaded. Screenshot feature unavailable.', 'error');
              console.error('[HighlighterBannerManager] html2canvas library not available');
              return;
            }
            if (typeof fabric === 'undefined') {
              showSimpleToast('fabric.js library not loaded. Screenshot annotations unavailable.', 'warning');
              console.warn('[HighlighterBannerManager] fabric.js library not available - annotations may not work');
            }
            
            ScreenshotManager.startCapture();
            console.log('[HighlighterBannerManager] Started screenshot capture from banner button');
          } catch (error) {
            console.error('[HighlighterBannerManager] Error starting screenshot:', error);
            showSimpleToast('Failed to start screenshot capture', 'error');
          }
        } else {
          console.warn('[HighlighterBannerManager] ScreenshotManager not available');
          showSimpleToast('Screenshot feature is not available', 'warning');
        }
      });
    }

    // Close button handler with tooltip
    const closeBtn = bannerElement.querySelector('#exl-hl-banner-close-btn');
    const tooltip = bannerElement.querySelector('#exl-hl-banner-close-tooltip');
    
    if (closeBtn) {
      closeBtn.addEventListener('mouseenter', () => {
        if (tooltip) {
          tooltip.style.display = 'block';
        }
      });
      closeBtn.addEventListener('mouseleave', () => {
        if (tooltip) {
          tooltip.style.display = 'none';
        }
      });
      closeBtn.addEventListener('click', handleBannerClose);
    }
  }

  /**
   * Create and show floating button
   */
  async function createAndShowFloatingButton() {
    if (floatingButton) {
      floatingButton.style.display = 'flex';
      return;
    }

    floatingButton = document.createElement('button');
    floatingButton.id = FLOATING_BUTTON_ID;
    floatingButton.className = 'exl-hl-floating-btn';
    floatingButton.innerHTML = '✨<span class="exl-hl-floating-btn-arrow">▾</span>';
    floatingButton.title = 'Click to open highlighter tools (radial menu). Click arrow to show banner.';
    floatingButton.setAttribute('aria-label', 'Open highlighter tools');

    // Event listener for radial menu (main button click)
    floatingButton.addEventListener('click', handleFloatingButtonClick);

    // Event listener for down arrow (show banner)
    const arrowSpan = floatingButton.querySelector('.exl-hl-floating-btn-arrow');
    if (arrowSpan) {
      arrowSpan.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent main button click event
        handleShowBannerFromRadialMenu(); // Treat as if banner was requested from radial menu
      });
    }

    // Make draggable
    makeDraggable(floatingButton);

    document.body.appendChild(floatingButton);

    // Show notification about down arrow
    showFloatingButtonNotification();

    console.log('[HighlighterBannerManager] Floating button created and shown');
  }

  /**
   * Hide floating button
   */
  function hideFloatingButton() {
    if (floatingButton) {
      floatingButton.style.display = 'none';
      floatingButton.classList.remove('highlighted', 'expanded');
      console.log('[HighlighterBannerManager] Floating button hidden');
    }
  }

  /**
   * Make floating button draggable
   */
  function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    element.addEventListener('mousedown', (e) => {
      if (e.target.closest('.exl-hl-floating-btn-arrow')) return; // Don't drag when clicking arrow
      
      isDragging = true;
      element.classList.add('dragging');
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = element.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      const newX = initialX + deltaX;
      const newY = initialY + deltaY;
      
      // Keep within viewport
      const maxX = window.innerWidth - element.offsetWidth;
      const maxY = window.innerHeight - element.offsetHeight;
      
      const clampedX = Math.max(0, Math.min(newX, maxX));
      const clampedY = Math.max(0, Math.min(newY, maxY));
      
      element.style.left = clampedX + 'px';
      element.style.top = clampedY + 'px';
      element.style.right = 'auto';
      element.style.transform = 'none';
      
      // Update radial menu position if it's open
      if (radialMenu && radialMenu.parentNode) {
        const buttonRect = element.getBoundingClientRect();
        const centerX = buttonRect.left + buttonRect.width / 2;
        const centerY = buttonRect.top + buttonRect.height / 2;
        radialMenu.style.left = centerX + 'px';
        radialMenu.style.top = centerY + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.classList.remove('dragging');
      }
    });
  }

  /**
   * Show simple toast notification
   * @param {string} message - Message to display
   * @param {string} type - 'success', 'warning', or 'error'
   */
  function showSimpleToast(message, type = 'info') {
    const colors = {
      success: '#51cf66',
      warning: '#ffc107',
      error: '#ff6b6b',
      info: '#4dabf7'
    };
    
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      animation: exl-hl-toast-slide-in 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Add animation if not already added
    if (!document.getElementById('exl-hl-toast-animations')) {
      const style = document.createElement('style');
      style.id = 'exl-hl-toast-animations';
      style.textContent = `
        @keyframes exl-hl-toast-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease-out';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 3000);
  }

  /**
   * Show notification when floating button is displayed
   */
  function showFloatingButtonNotification() {
    const notification = document.createElement('div');
    notification.className = 'exl-hl-floating-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: #1a1a2e;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 999998;
      max-width: 280px;
      font-size: 13px;
      line-height: 1.4;
      animation: exl-hl-notification-slide-up 0.3s ease-out;
    `;
    notification.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 600;">💡 Tip</div>
      <div>Click the down arrow (▾) on the floating button to activate the highlighter banner.</div>
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes exl-hl-notification-slide-up {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-hide after 7 seconds
    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s ease-out';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 7000);
  }

  /**
   * Handle floating button click - show radial menu
   */
  function handleFloatingButtonClick(e) {
    // Only show radial menu if not dragging and not clicking the arrow
    if (e.target.closest('.exl-hl-floating-btn-arrow')) {
      return; // Arrow click is handled separately
    }

    // Show radial menu
    if (radialMenu && radialMenu.style.display !== 'none') {
      hideRadialMenu();
    } else {
      showRadialMenu(e);
    }
  }

  /**
   * Show radial menu
   */
  function showRadialMenu(event) {
    // Remove existing radial menu
    hideRadialMenu();

    // Create overlay
    radialOverlay = document.createElement('div');
    radialOverlay.className = 'exl-hl-radial-overlay';
    radialOverlay.addEventListener('click', hideRadialMenu);

    // Create radial menu
    radialMenu = document.createElement('div');
    radialMenu.className = 'exl-hl-radial-menu';

    // Get button position and calculate center
    const buttonRect = floatingButton.getBoundingClientRect();
    const buttonCenterX = buttonRect.left + buttonRect.width / 2;
    const buttonCenterY = buttonRect.top + buttonRect.height / 2;

    // Set radial menu position to button center
    radialMenu.style.left = buttonCenterX + 'px';
    radialMenu.style.top = buttonCenterY + 'px';

    // Get colors
    const colors = typeof Highlighter !== 'undefined' && Highlighter.getColors ? Highlighter.getColors() : [];
    const currentColor = typeof Highlighter !== 'undefined' && Highlighter.getCurrentColor ? Highlighter.getCurrentColor() : colors[2] || colors[0];
    const currentColorId = currentColor ? currentColor.id : 3;

    // Radial menu items - ALL buttons from banner
    const items = [
      { icon: '🖍️', title: 'Highlight', action: () => { 
        // Focus window to allow text selection, then highlight will be created when text is selected
        window.focus();
        hideRadialMenu();
      }},
      { icon: '📝', title: 'Add Note', action: () => { 
        if (typeof StickyNotes !== 'undefined' && StickyNotes.createNote) {
          StickyNotes.createNote();
        }
        hideRadialMenu();
      }},
      { icon: '📚', title: 'Collections', action: () => { 
        if (typeof BookmarkManager !== 'undefined' && BookmarkManager.openPanel) {
          BookmarkManager.openPanel();
        }
        hideRadialMenu();
      }},
      { icon: '📋', title: 'Manage Notes & Highlights', action: () => { 
        if (typeof HighlightsSidepanel !== 'undefined' && HighlightsSidepanel.openPanel) {
          HighlightsSidepanel.openPanel();
        }
        hideRadialMenu();
      }},
      { icon: '🔖', title: 'Bookmark', action: () => { 
        if (typeof BookmarkManager !== 'undefined' && BookmarkManager.showBookmarkDialog) {
          // Check if collections exist before showing dialog
          const collections = BookmarkManager.getCollections ? BookmarkManager.getCollections() : {};
          if (Object.keys(collections).length === 0) {
            showSimpleToast('Please create a collection first before adding bookmarks', 'warning');
            // Open panel to create collection
            if (BookmarkManager.openPanel) {
              BookmarkManager.openPanel();
            }
          } else {
          BookmarkManager.showBookmarkDialog();
          }
        }
        hideRadialMenu();
      }},
      { icon: '📷', title: 'Screenshot', action: () => { 
        if (typeof ScreenshotManager !== 'undefined' && ScreenshotManager.startCapture) {
          try {
            ScreenshotManager.startCapture();
            console.log('[HighlighterBannerManager] Started screenshot capture');
          } catch (error) {
            console.error('[HighlighterBannerManager] Error starting screenshot:', error);
            showSimpleToast('Failed to start screenshot capture', 'error');
          }
        } else {
          console.warn('[HighlighterBannerManager] ScreenshotManager not available');
          showSimpleToast('Screenshot feature is not available', 'warning');
        }
        hideRadialMenu();
      }},
      { icon: '📚', title: 'Layers', action: () => {
        // Show layer dropdown - need to find the layer button and trigger it
        const layerBtn = bannerElement ? bannerElement.querySelector('.exl-hl-layer-btn') : null;
        if (layerBtn && typeof LayerManager !== 'undefined' && LayerManager.showLayerDropdown) {
          LayerManager.showLayerDropdown(layerBtn);
        }
        hideRadialMenu();
      }},
      { icon: '⬇️', title: 'Show Banner', action: () => { 
        handleShowBannerFromRadialMenu();
      }}
    ];

    // Calculate mouse entry angle relative to button center
    
    // Get mouse position from event or use button center as fallback
    const mouseX = event ? event.clientX : buttonCenterX;
    const mouseY = event ? event.clientY : buttonCenterY;
    
    // Calculate angle from button center to mouse entry point
    const deltaX = mouseX - buttonCenterX;
    const deltaY = mouseY - buttonCenterY;
    const entryAngle = Math.atan2(deltaY, deltaX); // Angle in radians
    
    // Angle-scoped radial menu: items spread across 180 degrees (half circle)
    // Center the menu on the opposite side of where mouse entered
    const radius = 80; // Distance from center for action items
    const angleRangeDeg = 180; // Spread across 180 degrees (half circle)
    const angleRangeRad = angleRangeDeg * Math.PI / 180;
    
    // Enhanced viewport boundaries for collision detection
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const itemSize = 44; // Size of radial menu items (from CSS)
    const colorSize = 28; // Size of color chips (from CSS)
    const padding = 20; // Increased padding from viewport edge for better spacing
    
    // Calculate optimal start angle considering viewport boundaries
    // Start with opposite side of mouse entry
    let startAngleRad = entryAngle + Math.PI - (angleRangeRad / 2);
    
    // Determine which edges the button is near (using tighter thresholds)
    const edgeThreshold = 120; // Distance from edge to consider "near edge"
    const nearLeft = buttonCenterX < edgeThreshold;
    const nearRight = buttonCenterX > viewportWidth - edgeThreshold;
    const nearTop = buttonCenterY < edgeThreshold;
    const nearBottom = buttonCenterY > viewportHeight - edgeThreshold;
    
    // Calculate angle step for testing
    const angleStep = items.length > 1 ? angleRangeRad / (items.length - 1) : 0;
    
    // Test if menu would overflow viewport and find best angle
    let bestAngle = startAngleRad;
    let minOverflow = Infinity;
    let minItemsOutside = Infinity;
    const testAngles = [];
    
    // Generate candidate angles based on button position and viewport constraints
    if (nearLeft) {
      // Button near left edge - prefer angles pointing right/east
      testAngles.push(Math.PI / 2 - (angleRangeRad / 2)); // Point right (90°)
      testAngles.push(Math.PI / 4 - (angleRangeRad / 2)); // Point down-right (45°)
      testAngles.push(0 - (angleRangeRad / 2)); // Point down (0°)
    }
    if (nearRight) {
      // Button near right edge - prefer angles pointing left/west
      testAngles.push(-Math.PI / 2 - (angleRangeRad / 2)); // Point left (-90°)
      testAngles.push(-Math.PI / 4 - (angleRangeRad / 2)); // Point up-left (-45°)
      testAngles.push(Math.PI - (angleRangeRad / 2)); // Point up (180°)
    }
    if (nearTop) {
      // Button near top edge - prefer angles pointing down/south
      testAngles.push(0 - (angleRangeRad / 2)); // Point down (0°)
      testAngles.push(Math.PI / 4 - (angleRangeRad / 2)); // Point down-right (45°)
      testAngles.push(-Math.PI / 4 - (angleRangeRad / 2)); // Point down-left (-45°)
    }
    if (nearBottom) {
      // Button near bottom edge - prefer angles pointing up/north
      testAngles.push(Math.PI - (angleRangeRad / 2)); // Point up (180°)
      testAngles.push(3 * Math.PI / 4 - (angleRangeRad / 2)); // Point up-left (135°)
      testAngles.push(-3 * Math.PI / 4 - (angleRangeRad / 2)); // Point up-right (-135°)
    }
    
    // If button is in corner, add corner-specific angles
    if ((nearLeft && nearTop) || (nearRight && nearBottom)) {
      // Top-left or bottom-right corner - prefer diagonal angles
      testAngles.push(Math.PI / 4 - (angleRangeRad / 2)); // 45° or 225°
      testAngles.push(Math.PI / 2 - (angleRangeRad / 2)); // 90° or 270°
    }
    if ((nearLeft && nearBottom) || (nearRight && nearTop)) {
      // Bottom-left or top-right corner - prefer diagonal angles
      testAngles.push(-Math.PI / 4 - (angleRangeRad / 2)); // -45° or 135°
      testAngles.push(-Math.PI / 2 - (angleRangeRad / 2)); // -90° or 90°
    }
    
    // Always test the original angle (opposite of mouse entry)
    testAngles.push(startAngleRad);
    
    // Remove duplicate angles
    const uniqueAngles = [...new Set(testAngles)];
    
    // Test each candidate angle and find the one with least overflow
    for (const testAngle of uniqueAngles) {
      let overflow = 0;
      let itemsOutside = 0;
      
      // Test all items
      for (let i = 0; i < items.length; i++) {
        const angle = testAngle + (i * angleStep);
        const testX = buttonCenterX + Math.cos(angle) * radius;
        const testY = buttonCenterY + Math.sin(angle) * radius;
        
        // Calculate overflow for each edge
        const leftEdge = testX - itemSize / 2;
        const rightEdge = testX + itemSize / 2;
        const topEdge = testY - itemSize / 2;
        const bottomEdge = testY + itemSize / 2;
        
        if (leftEdge < padding) {
          overflow += (padding - leftEdge) * 2; // Penalize left overflow more
          itemsOutside++;
        }
        if (rightEdge > viewportWidth - padding) {
          overflow += (rightEdge - (viewportWidth - padding)) * 2; // Penalize right overflow more
          itemsOutside++;
        }
        if (topEdge < padding) {
          overflow += (padding - topEdge) * 2; // Penalize top overflow more
          itemsOutside++;
        }
        if (bottomEdge > viewportHeight - padding) {
          overflow += (bottomEdge - (viewportHeight - padding)) * 2; // Penalize bottom overflow more
          itemsOutside++;
        }
      }
      
      // Test color chips too
      const colorRadius = 50;
      const colorAngleStep = colors.length > 1 ? angleRangeRad / (colors.length - 1) : 0;
      for (let i = 0; i < colors.length; i++) {
        const angle = testAngle + (i * colorAngleStep);
        const testX = buttonCenterX + Math.cos(angle) * colorRadius;
        const testY = buttonCenterY + Math.sin(angle) * colorRadius;
        
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
      
      // Prefer angles with no items outside, then least overflow
      if (itemsOutside === 0 && overflow === 0) {
        bestAngle = testAngle;
        break; // Perfect fit found
      }
      if (itemsOutside < minItemsOutside || (itemsOutside === minItemsOutside && overflow < minOverflow)) {
        minItemsOutside = itemsOutside;
        minOverflow = overflow;
        bestAngle = testAngle;
      }
    }
    
    startAngleRad = bestAngle;

    items.forEach((item, index) => {
      const angle = startAngleRad + (index * angleStep);
      let x = Math.cos(angle) * radius;
      let y = Math.sin(angle) * radius;
      
      // Final boundary check and adjustment for each item
      const finalX = buttonCenterX + x;
      const finalY = buttonCenterY + y;
      
      // Clamp item position to stay within viewport with padding
      if (finalX - itemSize / 2 < padding) {
        x = padding + itemSize / 2 - buttonCenterX;
      } else if (finalX + itemSize / 2 > viewportWidth - padding) {
        x = viewportWidth - padding - itemSize / 2 - buttonCenterX;
      }
      
      if (finalY - itemSize / 2 < padding) {
        y = padding + itemSize / 2 - buttonCenterY;
      } else if (finalY + itemSize / 2 > viewportHeight - padding) {
        y = viewportHeight - padding - itemSize / 2 - buttonCenterY;
      }

      const itemEl = document.createElement('button');
      itemEl.className = 'exl-hl-radial-item';
      itemEl.innerHTML = item.icon;
      itemEl.title = item.title;
      itemEl.style.setProperty('--final-x', x + 'px');
      itemEl.style.setProperty('--final-y', y + 'px');
      itemEl.style.setProperty('--animation-delay', (index * 30) + 'ms');
      
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        hideRadialMenu();
      });

      radialMenu.appendChild(itemEl);
    });

    // Add color chips in inner circle - also angle-scoped to same range
    const colorRadius = 50;
    // colorSize already declared above (line 707)
    const colorAngleRangeRad = angleRangeRad; // Same angle range as items (180 degrees)
    const colorAngleStep = colors.length > 1 ? colorAngleRangeRad / (colors.length - 1) : 0;

    colors.forEach((color, index) => {
      const angle = startAngleRad + (index * colorAngleStep);
      let x = Math.cos(angle) * colorRadius;
      let y = Math.sin(angle) * colorRadius;
      
      // Boundary check for color chips too
      const finalX = buttonCenterX + x;
      const finalY = buttonCenterY + y;
      
      // Clamp color chip position to stay within viewport with padding
      if (finalX - colorSize / 2 < padding) {
        x = padding + colorSize / 2 - buttonCenterX;
      } else if (finalX + colorSize / 2 > viewportWidth - padding) {
        x = viewportWidth - padding - colorSize / 2 - buttonCenterX;
      }
      
      if (finalY - colorSize / 2 < padding) {
        y = padding + colorSize / 2 - buttonCenterY;
      } else if (finalY + colorSize / 2 > viewportHeight - padding) {
        y = viewportHeight - padding - colorSize / 2 - buttonCenterY;
      }

      const chip = document.createElement('div');
      chip.className = 'exl-hl-radial-color-chip';
      chip.style.backgroundColor = color.rgb;
      chip.style.setProperty('--final-x', x + 'px');
      chip.style.setProperty('--final-y', y + 'px');
      chip.style.setProperty('--animation-delay', ((items.length + index) * 30) + 'ms');
      chip.title = color.name;
      chip.dataset.colorId = color.id;
      
      if (color.id === currentColorId) {
        chip.classList.add('exl-hl-selected');
      }

      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Highlighter !== 'undefined' && Highlighter.setColor) {
          Highlighter.setColor(color.id);
        }
        hideRadialMenu();
      });

      radialMenu.appendChild(chip);
    });

    // Add to page
    document.body.appendChild(radialOverlay);
    document.body.appendChild(radialMenu);

    // Mark button as expanded
    floatingButton.classList.add('expanded');

    console.log('[HighlighterBannerManager] Radial menu shown');
  }

  /**
   * Hide radial menu
   */
  function hideRadialMenu() {
    if (radialMenu) {
      radialMenu.classList.add('collapsing');
      setTimeout(() => {
        if (radialMenu && radialMenu.parentNode) {
          radialMenu.remove();
        }
        radialMenu = null;
      }, 150);
    }
    if (radialOverlay) {
      radialOverlay.remove();
      radialOverlay = null;
    }
    if (floatingButton) {
      floatingButton.classList.remove('expanded');
    }
  }

  /**
   * Handle showing banner from radial menu
   */
  async function handleShowBannerFromRadialMenu() {
    bannerShownFromRadialMenu = true;

    // Hide radial menu
    hideRadialMenu();

    // Hide floating button
    if (floatingButton) {
      floatingButton.style.display = 'none';
    }

    // Show banner
    await createAndShowBanner();

    // Highlight floating button with animation (if still exists)
    if (floatingButton) {
      floatingButton.classList.add('highlighted');
      setTimeout(() => {
        floatingButton.classList.remove('highlighted');
      }, 2000);
    }

    // Clear dismissal to show banner
    const currentUrl = window.location.href;
    const hostname = new URL(currentUrl).hostname.toLowerCase().replace(/^www\./, '');
    
    chrome.storage.local.get(['exl_hl_banner_dismissals', 'exl_hl_banner_page_dismissals'], (result) => {
      const dismissals = result.exl_hl_banner_dismissals || {};
      const pageDismissals = result.exl_hl_banner_page_dismissals || {};
      
      delete pageDismissals[currentUrl];
      if (dismissals[hostname]) {
        dismissals[hostname].dismissed = false;
      }

      chrome.storage.local.set({
        exl_hl_banner_dismissals: dismissals,
        exl_hl_banner_page_dismissals: pageDismissals
      });
    });
  }

  /**
   * Handle banner close
   */
  function handleBannerClose() {
    if (!bannerElement) return;

    // Hide banner
    bannerElement.style.display = 'none';
    document.body.setAttribute('data-exl-hl-banner-hidden', 'true');

    // Show floating button
    createAndShowFloatingButton();

    // Store dismissal
    const currentUrl = window.location.href;
    const hostname = new URL(currentUrl).hostname.toLowerCase().replace(/^www\./, '');

    chrome.storage.local.get(['exl_hl_banner_page_dismissals'], (result) => {
      const pageDismissals = result.exl_hl_banner_page_dismissals || {};
      pageDismissals[currentUrl] = true;

      chrome.storage.local.set({ exl_hl_banner_page_dismissals: pageDismissals });
    });

    // Show popup menu explaining reactivation
    showCloseTooltip();
  }

  /**
   * Show tooltip near close button explaining reactivation
   */
  function showCloseTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'exl-hl-close-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: #1a1a2e;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 999999;
      max-width: 300px;
      font-size: 13px;
      line-height: 1.4;
      animation: exl-hl-tooltip-fade-in 0.3s ease-out;
    `;
    tooltip.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 600;">ℹ️ Banner Closed</div>
      <div style="margin-bottom: 8px;">The floating button is now available. To reactivate the banner, check the Ex Libris tab popup.</div>
      <div style="font-size: 12px; opacity: 0.8;">Or click the down arrow (▾) on the floating button.</div>
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes exl-hl-tooltip-fade-in {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    if (!document.getElementById('exl-hl-tooltip-style')) {
      style.id = 'exl-hl-tooltip-style';
      document.head.appendChild(style);
    }

    document.body.appendChild(tooltip);

    // Auto-hide after 8 seconds
    setTimeout(() => {
      tooltip.style.transition = 'opacity 0.3s ease-out';
      tooltip.style.opacity = '0';
      setTimeout(() => tooltip.remove(), 300);
    }, 8000);
  }

  /**
   * Handle toggle banner message from popup
   */
  async function handleToggleBanner(show) {
    if (show) {
      // Clear dismissals
      const currentUrl = window.location.href;
      const hostname = new URL(currentUrl).hostname.toLowerCase().replace(/^www\./, '');

      chrome.storage.local.get(['exl_hl_banner_dismissals', 'exl_hl_banner_page_dismissals'], (result) => {
        const dismissals = result.exl_hl_banner_dismissals || {};
        const pageDismissals = result.exl_hl_banner_page_dismissals || {};

        delete pageDismissals[currentUrl];
        if (dismissals[hostname]) {
          dismissals[hostname].dismissed = false;
        }

        chrome.storage.local.set({
          exl_hl_banner_dismissals: dismissals,
          exl_hl_banner_page_dismissals: pageDismissals
        });
      });

      // Hide floating button and show banner
      if (floatingButton) {
        floatingButton.style.display = 'none';
      }
      if (radialMenu) {
        hideRadialMenu();
      }
      await createAndShowBanner();
    } else {
      // Dismiss banner
      handleBannerClose();
    }
  }

  /**
   * Update layer display in banner
   * Called when layer changes to update the layer button text
   */
  function updateLayerDisplay() {
    if (!bannerElement) return;

    const layerBtn = bannerElement.querySelector('.exl-hl-layer-btn');
    if (!layerBtn) return;

    // Get active layer from LayerManager
    if (typeof LayerManager !== 'undefined' && LayerManager.getActiveLayerId && LayerManager.getLayerName) {
      const activeLayerId = LayerManager.getActiveLayerId();
      const activeLayerName = LayerManager.getLayerName(activeLayerId);
      
      if (activeLayerName) {
        // Update button text (preserve emoji)
        layerBtn.innerHTML = `📚 ${activeLayerName}`;
        layerBtn.title = `Manage layers (Current: ${activeLayerName})`;
        console.log('[HighlighterBannerManager] Updated layer display to:', activeLayerName);
      }
    }

    // Notify Highlighter module to switch layers
    if (typeof Highlighter !== 'undefined' && Highlighter.switchLayer) {
      Highlighter.switchLayer().catch(error => {
        console.error('[HighlighterBannerManager] Error switching layer in Highlighter:', error);
      });
    }
  }

  return {
    init,
    checkShouldShowBanner,
    createAndShowBanner,
    hideBanner,
    createAndShowFloatingButton,
    hideFloatingButton,
    showRadialMenu,
    hideRadialMenu,
    handleShowBannerFromRadialMenu,
    handleBannerClose,
    updateLayerDisplay
  };
})();

// Expose globally
if (typeof window !== 'undefined') {
  window.HighlighterBannerManager = HighlighterBannerManager;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HighlighterBannerManager;
}
