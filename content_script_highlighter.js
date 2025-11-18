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
  
  try {
    // Method 1: Apply inline style if body exists
    if (document.body) {
      document.body.style.marginTop = `${BANNER_HEIGHT_PX}px`;
      window[STATE_FLAG] = true;
      console.log('[HighlighterController] Early layout adjustment applied (inline)');
      return;
    }
    
    // Method 2: Inject style tag into head (CSP compliant, preferred)
    // This works even if body doesn't exist yet
    const style = document.createElement('style');
    style.id = EARLY_STYLE_ID;
    style.textContent = `body { margin-top: ${BANNER_HEIGHT_PX}px !important; }`;
    
    // Try to inject into head
    if (document.head) {
      document.head.appendChild(style);
      window[STATE_FLAG] = true;
      console.log('[HighlighterController] Early layout adjustment applied (style tag)');
      return;
    }
    
    // Method 3: Fallback to documentElement if head doesn't exist
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

        // Initialize modules (sequential - best practice for dependencies)
        // LayerManager must be initialized first as other modules depend on it
        if (typeof LayerManager !== 'undefined') {
          await LayerManager.init();
        }
        await Highlighter.init();
        await StickyNotes.init();
        await BookmarkManager.init();

        // Create UI
        this.createBanner();
        this.setupListeners();

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
     * Create sticky banner UI
     */
    createBanner() {
      if (this.bannerElement) return;

      const banner = document.createElement('div');
      banner.className = 'exl-hl-banner';

      // Left side
      const leftSide = document.createElement('div');
      leftSide.className = 'exl-hl-banner-left';

      const title = document.createElement('h1');
      title.className = 'exl-hl-banner-title';
      title.textContent = '✨ Highlighter';

      const highlightBtn = document.createElement('button');
      highlightBtn.className = 'exl-hl-btn';
      highlightBtn.innerHTML = '🖍️ Highlight';
      highlightBtn.title = 'Highlight selected text';
      highlightBtn.addEventListener('click', () => {
        Highlighter.createHighlight();
      });

      leftSide.appendChild(title);
      leftSide.appendChild(highlightBtn);

      // Right side (color palette + action buttons)
      const rightSide = document.createElement('div');
      rightSide.className = 'exl-hl-banner-right';

      // Color palette
      const palette = this.createColorPalette();
      rightSide.appendChild(palette);

      // Layer dropdown button
      const layerBtn = this.createLayerDropdown();
      rightSide.appendChild(layerBtn);

      // Add Note button
      const noteBtn = document.createElement('button');
      noteBtn.className = 'exl-hl-btn';
      noteBtn.innerHTML = '📝 Add Note';
      noteBtn.title = 'Create sticky note';
      noteBtn.addEventListener('click', () => {
        StickyNotes.createNote();
      });

      // Collections button
      const collectionsBtn = document.createElement('button');
      collectionsBtn.className = 'exl-hl-btn';
      collectionsBtn.innerHTML = '📚 Collections';
      collectionsBtn.title = 'Open collections';
      collectionsBtn.addEventListener('click', () => {
        BookmarkManager.openPanel();
      });

      // Bookmark button
      const bookmarkBtn = document.createElement('button');
      bookmarkBtn.className = 'exl-hl-btn';
      bookmarkBtn.innerHTML = '🔖 Bookmark';
      bookmarkBtn.title = 'Bookmark this page';
      bookmarkBtn.addEventListener('click', () => {
        this.showBookmarkDialog();
      });

      rightSide.appendChild(noteBtn);
      rightSide.appendChild(collectionsBtn);
      rightSide.appendChild(bookmarkBtn);

      banner.appendChild(leftSide);
      banner.appendChild(rightSide);

      document.body.appendChild(banner);
      this.bannerElement = banner;

      // Adjust page content to avoid banner overlap
      this.adjustPageLayout(true);
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
     * Adjust page layout to avoid banner overlap
     * Note: Early layout adjustment may already be applied
     * Follows best practices: constants, element checks, error handling
     */
    adjustPageLayout(apply) {
      const BANNER_HEIGHT_PX = 48; // 3rem = 48px (constant, not magic number)
      const STATE_FLAG = '__exlHlEarlyLayoutApplied';
      
      try {
        if (apply) {
          // Apply or maintain layout adjustment
          if (document.body) {
            // Check element existence (best practice)
            document.body.style.marginTop = `${BANNER_HEIGHT_PX}px`;
          }
          window[STATE_FLAG] = true;
        } else {
          // Remove layout adjustment
          if (document.body) {
            // Check element existence (best practice)
            document.body.style.marginTop = '';
          }
          
          // Also remove early style tag if present
          const earlyStyle = document.getElementById('exl-hl-early-layout');
          if (earlyStyle) {
            // Check element existence before removal (best practice)
            earlyStyle.remove();
          }
          
          window[STATE_FLAG] = false;
        }
      } catch (error) {
        // Error handling (best practice: log with context)
        console.error('[HighlighterController] Error adjusting page layout:', error);
      }
    },

    /**
     * Remove early layout adjustment if feature is disabled
     * Follows best practices: checks element existence, error handling
     */
    removeEarlyLayoutAdjustment() {
      const EARLY_STYLE_ID = 'exl-hl-early-layout';
      const STATE_FLAG = '__exlHlEarlyLayoutApplied';
      
      try {
        // Remove inline style from body if present
        if (document.body && document.body.style.marginTop) {
          document.body.style.marginTop = '';
        }
        
        // Remove early style tag if present (check existence first - best practice)
        const earlyStyle = document.getElementById(EARLY_STYLE_ID);
        if (earlyStyle) {
          earlyStyle.remove();
        }
        
        // Clear flag
        window[STATE_FLAG] = false;
        
        console.log('[HighlighterController] Removed early layout adjustment');
        
      } catch (error) {
        // Error handling (best practice: log with context)
        console.error('[HighlighterController] Error removing early layout adjustment:', error);
      }
    },

    /**
     * Setup settings listener
     * Follows best practices: dependency checks, error handling
     */
    setupListeners() {
      try {
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
      } catch (error) {
        // Error handling (best practice: log with context)
        console.error('[HighlighterController] Error setting up listeners:', error);
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
        // Remove banner from DOM (check existence first - best practice)
        if (this.bannerElement) {
          this.bannerElement.remove();
          this.bannerElement = null;
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
