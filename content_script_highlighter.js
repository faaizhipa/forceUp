/**
 * Highlighter Content Script Controller
 * Orchestrates highlighter, sticky notes, and bookmark manager
 * Only active on support sites when feature is enabled
 */

(function() {
  'use strict';

  const HighlighterController = {
    isInitialized: false,
    currentColor: null,
    bannerElement: null,

    /**
     * Initialize controller
     */
    async init() {
      if (this.isInitialized) return;

      console.log('[HighlighterController] Initializing...');

      // Check if feature is enabled
      const enabled = await this.isFeatureEnabled();
      if (!enabled) {
        console.log('[HighlighterController] Feature disabled in settings');
        return;
      }

      // Initialize modules
      await Highlighter.init();
      await StickyNotes.init();
      await BookmarkManager.init();

      // Create UI
      this.createBanner();
      this.setupListeners();

      this.isInitialized = true;
      console.log('[HighlighterController] Initialized successfully');
    },

    /**
     * Check if feature is enabled in settings
     */
    async isFeatureEnabled() {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['exlibris'], (result) => {
          const enabled = result.exlibris?.features?.highlighterEnabled === true;
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
     */
    createLayerDropdown() {
      const container = document.createElement('div');
      container.className = 'exl-hl-layer-container';

      const button = document.createElement('button');
      button.className = 'exl-hl-btn exl-hl-layer-btn';
      button.title = 'Manage layers';
      
      // Update button text with active layer name
      const updateButtonText = () => {
        const activeLayer = LayerManager.getActiveLayer();
        button.innerHTML = `📚 ${activeLayer ? activeLayer.name : 'Layers'}`;
      };
      updateButtonText();

      // Create dropdown menu
      const dropdown = document.createElement('div');
      dropdown.className = 'exl-hl-layer-dropdown';
      dropdown.style.display = 'none';

      // Function to render layer list
      const renderLayerList = () => {
        dropdown.innerHTML = '';
        
        const layers = LayerManager.getAllLayers();
        const activeLayerId = LayerManager.getActiveLayerId();

        // New Layer button
        const newLayerBtn = document.createElement('div');
        newLayerBtn.className = 'exl-hl-layer-item exl-hl-new-layer';
        newLayerBtn.innerHTML = '<span class="exl-hl-layer-icon">➕</span> New Layer';
        newLayerBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const layerName = prompt('Enter layer name:');
          if (layerName && layerName.trim()) {
            await LayerManager.createLayer(layerName.trim());
            renderLayerList();
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
            if (layer.id !== activeLayerId) {
              await LayerManager.setActiveLayer(layer.id);
              
              // Switch both highlighter and sticky notes
              await Promise.all([
                Highlighter.switchLayer(),
                StickyNotes.switchLayer()
              ]);
              
              updateButtonText();
              renderLayerList();
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
              const newName = prompt('Enter new name:', layer.name);
              if (newName && newName.trim() && newName.trim() !== layer.name) {
                await LayerManager.renameLayer(layer.id, newName.trim());
                updateButtonText();
                renderLayerList();
              }
              document.body.removeChild(contextMenu);
            });
            contextMenu.appendChild(renameOption);

            // Delete option (if not last layer)
            if (LayerManager.getLayerCount() > 1) {
              const deleteOption = document.createElement('div');
              deleteOption.className = 'exl-hl-layer-context-item exl-hl-layer-delete';
              deleteOption.textContent = '🗑️ Delete';
              deleteOption.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Delete layer "${layer.name}"? This will remove all highlights and notes in this layer.`)) {
                  const wasActive = layer.id === activeLayerId;
                  await LayerManager.deleteLayer(layer.id);
                  
                  if (wasActive) {
                    // Refresh both highlighter and notes
                    await Promise.all([
                      Highlighter.switchLayer(),
                      StickyNotes.switchLayer()
                    ]);
                    updateButtonText();
                  }
                  renderLayerList();
                }
                document.body.removeChild(contextMenu);
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
     */
    adjustPageLayout(apply) {
      if (apply) {
        document.body.style.marginTop = '48px';
      } else {
        document.body.style.marginTop = '';
      }
    },

    /**
     * Setup settings listener
     */
    setupListeners() {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && changes.exlibris) {
          const newValue = changes.exlibris.newValue?.features?.highlighterEnabled;
          const oldValue = changes.exlibris.oldValue?.features?.highlighterEnabled;
          
          if (newValue !== oldValue) {
            if (newValue === false) {
              this.cleanup();
            } else if (!this.isInitialized) {
              this.init();
            }
          }
        }
      });
    },

    /**
     * Cleanup
     */
    cleanup() {
      if (this.bannerElement) {
        this.bannerElement.remove();
        this.bannerElement = null;
      }

      this.adjustPageLayout(false);

      Highlighter.cleanup();
      StickyNotes.cleanup();
      BookmarkManager.cleanup();

      this.isInitialized = false;
      console.log('[HighlighterController] Cleaned up');
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
