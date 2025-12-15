/**
 * Highlights Sidepanel Module
 * Manages all highlights and notes with CRUD operations
 * Features: Scope filtering, search, bulk operations, real-time updates
 * @module highlightsSidepanel
 */

const HighlightsSidepanel = (function() {
  'use strict';

  // ========== CONSTANTS ==========
  const PANEL_ID = 'exl-hl-sidepanel';
  const SCOPE_OPTIONS = {
    CURRENT_URL: 'current_url',
    CURRENT_DOMAIN: 'current_domain',
    ALL_DATA: 'all'
  };

  // ========== STATE ==========
  let isInitialized = false;
  let isPanelOpen = false;
  let panelElement = null;
  let currentScope = SCOPE_OPTIONS.CURRENT_URL;
  let searchQuery = '';
  let selectedItems = new Set();
  let highlightsData = [];
  let notesData = [];
  let storageListener = null;

  // ========== INITIALIZATION ==========

  /**
   * Ensure sidepanel styles are injected
   */
  function ensureStyles() {
    const STYLE_ID = 'exl-hl-sidepanel-styles';
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ========== SIDEPANEL CONTAINER ========== */
      .exl-hl-sidepanel {
        position: fixed;
        top: 0;
        right: -420px;
        width: 400px;
        height: 100vh;
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        border-left: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #e0e0e0;
        transition: right 0.3s ease;
      }
      .exl-hl-sidepanel.open {
        right: 0;
      }

      /* ========== HEADER ========== */
      .exl-hl-sidepanel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: rgba(255, 255, 255, 0.05);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .exl-hl-sidepanel-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .exl-hl-sidepanel-icon {
        font-size: 20px;
      }
      .exl-hl-sidepanel-close {
        background: transparent;
        border: none;
        color: #888;
        font-size: 20px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }
      .exl-hl-sidepanel-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      /* ========== CONTROLS ========== */
      .exl-hl-sidepanel-controls {
        padding: 12px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .exl-hl-sidepanel-scope {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .exl-hl-sidepanel-scope label {
        color: #888;
        font-size: 13px;
      }
      .exl-hl-scope-select {
        flex: 1;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        cursor: pointer;
      }
      .exl-hl-scope-select:focus {
        outline: none;
        border-color: #4a9eff;
      }
      .exl-hl-sidepanel-search {
        position: relative;
      }
      .exl-hl-search-input {
        width: 100%;
        padding: 10px 12px 10px 36px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        box-sizing: border-box;
      }
      .exl-hl-search-input::placeholder {
        color: #666;
      }
      .exl-hl-search-input:focus {
        outline: none;
        border-color: #4a9eff;
      }
      .exl-hl-search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 14px;
        pointer-events: none;
      }

      /* ========== TOOLBAR ========== */
      .exl-hl-sidepanel-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 20px;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .exl-hl-select-all {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 13px;
        color: #888;
      }
      .exl-hl-select-all:hover {
        color: #fff;
      }
      .exl-hl-toolbar-actions {
        display: flex;
        gap: 8px;
      }
      .exl-hl-toolbar-btn {
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        color: #888;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .exl-hl-toolbar-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
      }
      .exl-hl-toolbar-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .exl-hl-btn-delete:hover:not(:disabled) {
        background: rgba(255, 80, 80, 0.2);
        border-color: rgba(255, 80, 80, 0.3);
        color: #ff6b6b;
      }

      /* ========== CONTENT ========== */
      .exl-hl-sidepanel-content {
        flex: 1;
        overflow-y: auto;
        padding: 12px 0;
      }
      .exl-hl-section {
        margin-bottom: 8px;
      }
      .exl-hl-section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        cursor: pointer;
        user-select: none;
        transition: background 0.2s ease;
      }
      .exl-hl-section-header:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .exl-hl-section-toggle {
        font-size: 12px;
        color: #888;
        width: 16px;
      }
      .exl-hl-section-title {
        font-weight: 600;
        color: #fff;
      }
      .exl-hl-section-count {
        color: #666;
        font-size: 13px;
      }
      .exl-hl-section-content {
        max-height: 1000px;
        overflow: hidden;
        transition: max-height 0.3s ease;
      }
      .exl-hl-section.collapsed .exl-hl-section-content {
        max-height: 0;
      }

      /* ========== ITEMS ========== */
      .exl-hl-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        transition: background 0.2s ease;
      }
      .exl-hl-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .exl-hl-item.selected {
        background: rgba(74, 158, 255, 0.1);
      }
      .exl-hl-item-checkbox {
        margin-top: 4px;
        cursor: pointer;
      }
      .exl-hl-item-color {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        flex-shrink: 0;
        margin-top: 2px;
      }
      .exl-hl-item-icon {
        font-size: 16px;
        flex-shrink: 0;
      }
      .exl-hl-item-content {
        flex: 1;
        min-width: 0;
      }
      .exl-hl-item-text {
        color: #e0e0e0;
        font-size: 13px;
        line-height: 1.5;
        word-wrap: break-word;
        margin-bottom: 6px;
      }
      .exl-hl-item-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 11px;
        color: #666;
      }
      .exl-hl-item-url {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      }
      .exl-hl-item-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .exl-hl-item:hover .exl-hl-item-actions {
        opacity: 1;
      }
      .exl-hl-item-btn {
        background: transparent;
        border: none;
        padding: 4px 6px;
        font-size: 14px;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.2s ease;
      }
      .exl-hl-item-btn:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      .exl-hl-btn-delete-item:hover {
        background: rgba(255, 80, 80, 0.2);
      }

      /* ========== STATES ========== */
      .exl-hl-empty-state {
        text-align: center;
        padding: 24px 20px;
        color: #666;
        font-size: 13px;
      }
      .exl-hl-loading {
        text-align: center;
        padding: 24px 20px;
        color: #888;
        font-size: 13px;
      }

      /* ========== FOOTER ========== */
      .exl-hl-sidepanel-footer {
        padding: 12px 20px;
        background: rgba(255, 255, 255, 0.03);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        text-align: center;
        font-size: 12px;
        color: #666;
      }

      /* ========== TOAST ========== */
      .exl-hl-sidepanel-toast {
        position: fixed;
        bottom: 80px;
        right: 20px;
        padding: 12px 20px;
        background: #333;
        color: #fff;
        border-radius: 6px;
        font-size: 13px;
        z-index: 1000000;
        animation: exl-hl-toast-in 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
      .exl-hl-sidepanel-toast.error {
        background: #a33;
      }
      @keyframes exl-hl-toast-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
    console.log('[HighlightsSidepanel] Styles injected');
  }

  /**
   * Initialize the sidepanel module
   */
  async function init() {
    if (isInitialized) return;

    console.log('[HighlightsSidepanel] Initializing...');

    // Load last used scope from storage
    await loadScopePreference();

    // Setup storage change listener for real-time updates
    setupStorageListener();

    isInitialized = true;
    console.log('[HighlightsSidepanel] Initialized');
  }

  /**
   * Load scope preference from storage
   */
  async function loadScopePreference() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['exl_hl_sidepanel_scope'], (result) => {
        if (result.exl_hl_sidepanel_scope) {
          currentScope = result.exl_hl_sidepanel_scope;
        }
        resolve();
      });
    });
  }

  /**
   * Save scope preference to storage
   */
  function saveScopePreference(scope) {
    chrome.storage.local.set({ exl_hl_sidepanel_scope: scope });
  }

  /**
   * Setup storage change listener for real-time updates
   */
  function setupStorageListener() {
    if (storageListener) return;

    storageListener = (changes, areaName) => {
      if (areaName !== 'local') return;

      // Check if highlights or notes changed
      const highlightsChanged = Object.keys(changes).some(key => 
        key.startsWith('exl_highlights_')
      );
      const notesChanged = Object.keys(changes).some(key => 
        key.startsWith('exl_notes_')
      );

      if ((highlightsChanged || notesChanged) && isPanelOpen) {
        refreshPanelData();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);
  }

  // ========== PANEL UI ==========

  /**
   * Open the sidepanel
   */
  async function openPanel() {
    if (isPanelOpen && panelElement) {
      panelElement.focus();
      return;
    }

    // Ensure styles are injected
    ensureStyles();

    // Create panel
    panelElement = createPanelElement();
    document.body.appendChild(panelElement);

    // Load data
    await refreshPanelData();

    // Animate in
    requestAnimationFrame(() => {
      panelElement.classList.add('open');
    });

    isPanelOpen = true;
    console.log('[HighlightsSidepanel] Panel opened');
  }

  /**
   * Close the sidepanel
   */
  function closePanel() {
    if (!isPanelOpen || !panelElement) return;

    panelElement.classList.remove('open');
    
    // Remove after animation
    setTimeout(() => {
      if (panelElement) {
        panelElement.remove();
        panelElement = null;
      }
    }, 300);

    isPanelOpen = false;
    selectedItems.clear();
    console.log('[HighlightsSidepanel] Panel closed');
  }

  /**
   * Toggle panel visibility
   */
  function togglePanel() {
    if (isPanelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  /**
   * Create the panel DOM element
   */
  function createPanelElement() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'exl-hl-sidepanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Highlights and Notes Manager');
    panel.setAttribute('tabindex', '-1');

    panel.innerHTML = `
      <div class="exl-hl-sidepanel-header">
        <h2 class="exl-hl-sidepanel-title">
          <span class="exl-hl-sidepanel-icon">📝</span>
          Highlights & Notes
        </h2>
        <button class="exl-hl-sidepanel-close" aria-label="Close panel" title="Close">
          ✕
        </button>
      </div>

      <div class="exl-hl-sidepanel-controls">
        <div class="exl-hl-sidepanel-scope">
          <label for="exl-hl-scope-select">Scope:</label>
          <select id="exl-hl-scope-select" class="exl-hl-scope-select">
            <option value="${SCOPE_OPTIONS.CURRENT_URL}">Current URL</option>
            <option value="${SCOPE_OPTIONS.CURRENT_DOMAIN}">Current Domain</option>
            <option value="${SCOPE_OPTIONS.ALL_DATA}">All Data</option>
          </select>
        </div>

        <div class="exl-hl-sidepanel-search">
          <input 
            type="text" 
            id="exl-hl-search-input"
            class="exl-hl-search-input" 
            placeholder="Search highlights and notes..."
            aria-label="Search"
          />
          <span class="exl-hl-search-icon">🔍</span>
        </div>
      </div>

      <div class="exl-hl-sidepanel-toolbar">
        <label class="exl-hl-select-all">
          <input type="checkbox" id="exl-hl-select-all-checkbox" />
          <span>Select All</span>
        </label>
        <div class="exl-hl-toolbar-actions">
          <button class="exl-hl-toolbar-btn exl-hl-btn-export" title="Export selected" disabled>
            📤 Export
          </button>
          <button class="exl-hl-toolbar-btn exl-hl-btn-delete" title="Delete selected" disabled>
            🗑️ Delete
          </button>
        </div>
      </div>

      <div class="exl-hl-sidepanel-content">
        <div class="exl-hl-section exl-hl-highlights-section">
          <div class="exl-hl-section-header" data-section="highlights">
            <span class="exl-hl-section-toggle">▾</span>
            <span class="exl-hl-section-title">Highlights</span>
            <span class="exl-hl-section-count">(0)</span>
          </div>
          <div class="exl-hl-section-content" id="exl-hl-highlights-list">
            <div class="exl-hl-empty-state">No highlights found</div>
          </div>
        </div>

        <div class="exl-hl-section exl-hl-notes-section">
          <div class="exl-hl-section-header" data-section="notes">
            <span class="exl-hl-section-toggle">▾</span>
            <span class="exl-hl-section-title">Notes</span>
            <span class="exl-hl-section-count">(0)</span>
          </div>
          <div class="exl-hl-section-content" id="exl-hl-notes-list">
            <div class="exl-hl-empty-state">No notes found</div>
          </div>
        </div>
      </div>

      <div class="exl-hl-sidepanel-footer">
        <span class="exl-hl-footer-stats">
          <span id="exl-hl-total-highlights">0</span> highlights, 
          <span id="exl-hl-total-notes">0</span> notes
        </span>
      </div>
    `;

    // Attach event listeners
    attachPanelEventListeners(panel);

    return panel;
  }

  /**
   * Attach event listeners to panel elements
   */
  function attachPanelEventListeners(panel) {
    // Close button
    panel.querySelector('.exl-hl-sidepanel-close').addEventListener('click', closePanel);

    // Scope select
    const scopeSelect = panel.querySelector('#exl-hl-scope-select');
    scopeSelect.value = currentScope;
    scopeSelect.addEventListener('change', (e) => {
      currentScope = e.target.value;
      saveScopePreference(currentScope);
      refreshPanelData();
    });

    // Search input
    const searchInput = panel.querySelector('#exl-hl-search-input');
    searchInput.addEventListener('input', debounce((e) => {
      searchQuery = e.target.value.toLowerCase();
      renderItems();
    }, 200));

    // Select all checkbox
    const selectAllCheckbox = panel.querySelector('#exl-hl-select-all-checkbox');
    selectAllCheckbox.addEventListener('change', (e) => {
      toggleSelectAll(e.target.checked);
    });

    // Export button
    panel.querySelector('.exl-hl-btn-export').addEventListener('click', exportSelected);

    // Delete button
    panel.querySelector('.exl-hl-btn-delete').addEventListener('click', deleteSelected);

    // Section toggles
    panel.querySelectorAll('.exl-hl-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.exl-hl-section');
        section.classList.toggle('collapsed');
        const toggle = header.querySelector('.exl-hl-section-toggle');
        toggle.textContent = section.classList.contains('collapsed') ? '▸' : '▾';
      });
    });

    // Keyboard handling
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePanel();
      }
    });

    // Click outside to close (optional)
    document.addEventListener('click', handleOutsideClick);
  }

  /**
   * Handle clicks outside the panel
   */
  function handleOutsideClick(e) {
    if (!isPanelOpen || !panelElement) return;
    
    // Don't close if clicking inside the panel or on the radial menu
    if (panelElement.contains(e.target) || 
        e.target.closest('.exl-hl-radial-menu') ||
        e.target.closest('.exl-hl-floating-btn')) {
      return;
    }
    
    // Don't close on first click (the one that opened it)
    // Use a flag or delay
  }

  // ========== DATA LOADING ==========

  /**
   * Refresh panel data based on current scope
   */
  async function refreshPanelData() {
    if (!isPanelOpen) return;

    // Show loading state
    const highlightsList = panelElement.querySelector('#exl-hl-highlights-list');
    const notesList = panelElement.querySelector('#exl-hl-notes-list');
    
    highlightsList.innerHTML = '<div class="exl-hl-loading">Loading...</div>';
    notesList.innerHTML = '<div class="exl-hl-loading">Loading...</div>';

    // Load highlights
    highlightsData = await loadHighlights();
    
    // Load notes
    notesData = await loadNotes();

    // Render items
    renderItems();

    // Update stats
    updateStats();
  }

  /**
   * Load highlights based on current scope
   */
  async function loadHighlights() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const highlights = [];
        const currentUrl = window.location.href;
        const currentDomain = window.location.hostname;

        Object.keys(items).forEach(key => {
          if (key.startsWith('exl_highlights_')) {
            const urlHighlights = items[key];
            const url = key.replace('exl_highlights_', '');

            if (Array.isArray(urlHighlights)) {
              urlHighlights.forEach(hl => {
                const highlight = {
                  id: hl.id || `hl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  type: 'highlight',
                  text: hl.text || '',
                  color: hl.color || { id: 1, name: 'Default', rgb: '#ffff00' },
                  url: url,
                  domain: getDomainFromUrl(url),
                  createdAt: hl.createdAt || Date.now(),
                  xpath: hl.xpath || '',
                  storageKey: key
                };

                // Apply scope filter
                if (shouldIncludeItem(highlight, currentUrl, currentDomain)) {
                  highlights.push(highlight);
                }
              });
            }
          }
        });

        // Sort by creation date (newest first)
        highlights.sort((a, b) => b.createdAt - a.createdAt);
        resolve(highlights);
      });
    });
  }

  /**
   * Load notes based on current scope
   */
  async function loadNotes() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const notes = [];
        const currentUrl = window.location.href;
        const currentDomain = window.location.hostname;

        Object.keys(items).forEach(key => {
          if (key.startsWith('exl_notes_')) {
            const noteData = items[key];
            const url = key.replace('exl_notes_', '');

            // Handle both array and object formats
            const noteArray = Array.isArray(noteData) ? noteData : 
                             (noteData && typeof noteData === 'object' ? [noteData] : []);

            noteArray.forEach(n => {
              if (!n || typeof n !== 'object') return;

              const note = {
                id: n.id || `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'note',
                content: n.content || n.text || '',
                color: n.color || 'yellow',
                url: n.url || url,
                domain: getDomainFromUrl(n.url || url),
                position: n.position || { x: 0, y: 0 },
                size: n.size || { width: 200, height: 150 },
                createdAt: n.createdAt || n.timestamp || Date.now(),
                storageKey: key
              };

              // Apply scope filter
              if (shouldIncludeItem(note, currentUrl, currentDomain)) {
                notes.push(note);
              }
            });
          }
        });

        // Sort by creation date (newest first)
        notes.sort((a, b) => b.createdAt - a.createdAt);
        resolve(notes);
      });
    });
  }

  /**
   * Check if item should be included based on current scope
   */
  function shouldIncludeItem(item, currentUrl, currentDomain) {
    switch (currentScope) {
      case SCOPE_OPTIONS.CURRENT_URL:
        return item.url === currentUrl;
      case SCOPE_OPTIONS.CURRENT_DOMAIN:
        return item.domain === currentDomain;
      case SCOPE_OPTIONS.ALL_DATA:
        return true;
      default:
        return true;
    }
  }

  /**
   * Extract domain from URL
   */
  function getDomainFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  // ========== RENDERING ==========

  /**
   * Render items based on current data and search query
   */
  function renderItems() {
    renderHighlights();
    renderNotes();
    updateToolbarState();
  }

  /**
   * Render highlights list
   */
  function renderHighlights() {
    const container = panelElement.querySelector('#exl-hl-highlights-list');
    const countEl = panelElement.querySelector('.exl-hl-highlights-section .exl-hl-section-count');

    // Filter by search query
    const filtered = highlightsData.filter(hl => {
      if (!searchQuery) return true;
      return hl.text.toLowerCase().includes(searchQuery) ||
             hl.url.toLowerCase().includes(searchQuery);
    });

    countEl.textContent = `(${filtered.length})`;

    if (filtered.length === 0) {
      container.innerHTML = '<div class="exl-hl-empty-state">No highlights found</div>';
      return;
    }

    container.innerHTML = filtered.map(hl => createHighlightItem(hl)).join('');

    // Attach item event listeners
    container.querySelectorAll('.exl-hl-item').forEach(item => {
      attachItemEventListeners(item);
    });
  }

  /**
   * Render notes list
   */
  function renderNotes() {
    const container = panelElement.querySelector('#exl-hl-notes-list');
    const countEl = panelElement.querySelector('.exl-hl-notes-section .exl-hl-section-count');

    // Filter by search query
    const filtered = notesData.filter(note => {
      if (!searchQuery) return true;
      return note.content.toLowerCase().includes(searchQuery) ||
             note.url.toLowerCase().includes(searchQuery);
    });

    countEl.textContent = `(${filtered.length})`;

    if (filtered.length === 0) {
      container.innerHTML = '<div class="exl-hl-empty-state">No notes found</div>';
      return;
    }

    container.innerHTML = filtered.map(note => createNoteItem(note)).join('');

    // Attach item event listeners
    container.querySelectorAll('.exl-hl-item').forEach(item => {
      attachItemEventListeners(item);
    });
  }

  /**
   * Create HTML for a highlight item
   */
  function createHighlightItem(hl) {
    const isSelected = selectedItems.has(hl.id);
    const truncatedText = truncateText(hl.text, 100);
    const formattedDate = formatDate(hl.createdAt);
    const colorRgb = typeof hl.color === 'object' ? hl.color.rgb : '#ffff00';

    return `
      <div class="exl-hl-item exl-hl-highlight-item ${isSelected ? 'selected' : ''}" 
           data-id="${hl.id}" 
           data-type="highlight"
           data-storage-key="${hl.storageKey}">
        <input type="checkbox" class="exl-hl-item-checkbox" ${isSelected ? 'checked' : ''} />
        <div class="exl-hl-item-color" style="background-color: ${colorRgb}"></div>
        <div class="exl-hl-item-content">
          <div class="exl-hl-item-text">"${escapeHtml(truncatedText)}"</div>
          <div class="exl-hl-item-meta">
            <span class="exl-hl-item-date">${formattedDate}</span>
            <span class="exl-hl-item-url" title="${escapeHtml(hl.url)}">${truncateText(hl.url, 40)}</span>
          </div>
        </div>
        <div class="exl-hl-item-actions">
          <button class="exl-hl-item-btn exl-hl-btn-copy" title="Copy text">📋</button>
          <button class="exl-hl-item-btn exl-hl-btn-goto" title="Go to highlight">🔗</button>
          <button class="exl-hl-item-btn exl-hl-btn-delete-item" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }

  /**
   * Create HTML for a note item
   */
  function createNoteItem(note) {
    const isSelected = selectedItems.has(note.id);
    const truncatedContent = truncateText(stripHtml(note.content), 100);
    const formattedDate = formatDate(note.createdAt);

    return `
      <div class="exl-hl-item exl-hl-note-item ${isSelected ? 'selected' : ''}" 
           data-id="${note.id}" 
           data-type="note"
           data-storage-key="${note.storageKey}">
        <input type="checkbox" class="exl-hl-item-checkbox" ${isSelected ? 'checked' : ''} />
        <div class="exl-hl-item-icon">📝</div>
        <div class="exl-hl-item-content">
          <div class="exl-hl-item-text">${escapeHtml(truncatedContent)}</div>
          <div class="exl-hl-item-meta">
            <span class="exl-hl-item-date">${formattedDate}</span>
            <span class="exl-hl-item-url" title="${escapeHtml(note.url)}">${truncateText(note.url, 40)}</span>
          </div>
        </div>
        <div class="exl-hl-item-actions">
          <button class="exl-hl-item-btn exl-hl-btn-copy" title="Copy content">📋</button>
          <button class="exl-hl-item-btn exl-hl-btn-edit" title="Edit note">✏️</button>
          <button class="exl-hl-item-btn exl-hl-btn-goto" title="Go to note">🔗</button>
          <button class="exl-hl-item-btn exl-hl-btn-delete-item" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to an item
   */
  function attachItemEventListeners(itemEl) {
    const id = itemEl.dataset.id;
    const type = itemEl.dataset.type;

    // Checkbox
    const checkbox = itemEl.querySelector('.exl-hl-item-checkbox');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      if (e.target.checked) {
        selectedItems.add(id);
        itemEl.classList.add('selected');
      } else {
        selectedItems.delete(id);
        itemEl.classList.remove('selected');
      }
      updateToolbarState();
    });

    // Copy button
    itemEl.querySelector('.exl-hl-btn-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      copyItemContent(id, type);
    });

    // Go to button
    itemEl.querySelector('.exl-hl-btn-goto').addEventListener('click', (e) => {
      e.stopPropagation();
      goToItem(id, type);
    });

    // Delete button
    itemEl.querySelector('.exl-hl-btn-delete-item').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(id, type, itemEl.dataset.storageKey);
    });

    // Edit button (notes only)
    const editBtn = itemEl.querySelector('.exl-hl-btn-edit');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editNote(id);
      });
    }
  }

  // ========== ACTIONS ==========

  /**
   * Copy item content to clipboard
   */
  async function copyItemContent(id, type) {
    let content = '';

    if (type === 'highlight') {
      const hl = highlightsData.find(h => h.id === id);
      if (hl) {
        content = `"${hl.text}"\n\nSource: ${hl.url}\nHighlighted on: ${formatDate(hl.createdAt)}`;
      }
    } else {
      const note = notesData.find(n => n.id === id);
      if (note) {
        content = `${stripHtml(note.content)}\n\nPage: ${note.url}\nCreated on: ${formatDate(note.createdAt)}`;
      }
    }

    try {
      await navigator.clipboard.writeText(content);
      showToast('Copied to clipboard');
    } catch (err) {
      console.error('[HighlightsSidepanel] Copy failed:', err);
      showToast('Failed to copy', 'error');
    }
  }

  /**
   * Navigate to item's source
   */
  function goToItem(id, type) {
    let url = '';

    if (type === 'highlight') {
      const hl = highlightsData.find(h => h.id === id);
      if (hl) url = hl.url;
    } else {
      const note = notesData.find(n => n.id === id);
      if (note) url = note.url;
    }

    if (url && url !== window.location.href) {
      window.open(url, '_blank');
    } else {
      // Already on the page, try to scroll to the highlight/note
      closePanel();
      // TODO: Implement scroll-to-highlight functionality
    }
  }

  /**
   * Delete a single item
   */
  async function deleteItem(id, type, storageKey) {
    if (!confirm('Delete this item?')) return;

    try {
      const result = await chrome.storage.local.get([storageKey]);
      let data = result[storageKey];

      if (Array.isArray(data)) {
        data = data.filter(item => item.id !== id);
        
        if (data.length === 0) {
          await chrome.storage.local.remove([storageKey]);
        } else {
          await chrome.storage.local.set({ [storageKey]: data });
        }
      }

      // Remove from local data
      if (type === 'highlight') {
        highlightsData = highlightsData.filter(h => h.id !== id);
      } else {
        notesData = notesData.filter(n => n.id !== id);
      }

      // Re-render
      renderItems();
      updateStats();
      showToast('Item deleted');

    } catch (err) {
      console.error('[HighlightsSidepanel] Delete failed:', err);
      showToast('Failed to delete', 'error');
    }
  }

  /**
   * Edit a note (opens it for editing)
   */
  function editNote(id) {
    const note = notesData.find(n => n.id === id);
    if (!note) return;

    // Navigate to the note's page if not there
    if (note.url !== window.location.href) {
      window.location.href = note.url;
      return;
    }

    // Close panel and focus the note
    closePanel();
    
    // Try to focus the note using StickyNotes API
    if (typeof StickyNotes !== 'undefined' && StickyNotes.focusNote) {
      StickyNotes.focusNote(id);
    }
  }

  /**
   * Toggle select all
   */
  function toggleSelectAll(checked) {
    selectedItems.clear();

    if (checked) {
      highlightsData.forEach(hl => selectedItems.add(hl.id));
      notesData.forEach(note => selectedItems.add(note.id));
    }

    // Update checkboxes
    panelElement.querySelectorAll('.exl-hl-item-checkbox').forEach(cb => {
      cb.checked = checked;
      cb.closest('.exl-hl-item').classList.toggle('selected', checked);
    });

    updateToolbarState();
  }

  /**
   * Export selected items
   */
  async function exportSelected() {
    if (selectedItems.size === 0) return;

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      highlights: highlightsData.filter(hl => selectedItems.has(hl.id)),
      notes: notesData.filter(note => selectedItems.has(note.id))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `highlights-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast(`Exported ${selectedItems.size} items`);
  }

  /**
   * Delete selected items
   */
  async function deleteSelected() {
    if (selectedItems.size === 0) return;

    const count = selectedItems.size;
    if (!confirm(`Delete ${count} selected item(s)?`)) return;

    try {
      // Group items by storage key for efficient deletion
      const itemsByKey = new Map();

      [...selectedItems].forEach(id => {
        const hl = highlightsData.find(h => h.id === id);
        const note = notesData.find(n => n.id === id);
        const item = hl || note;

        if (item) {
          if (!itemsByKey.has(item.storageKey)) {
            itemsByKey.set(item.storageKey, []);
          }
          itemsByKey.get(item.storageKey).push(id);
        }
      });

      // Delete items from storage
      for (const [storageKey, ids] of itemsByKey) {
        const result = await chrome.storage.local.get([storageKey]);
        let data = result[storageKey];

        if (Array.isArray(data)) {
          data = data.filter(item => !ids.includes(item.id));
          
          if (data.length === 0) {
            await chrome.storage.local.remove([storageKey]);
          } else {
            await chrome.storage.local.set({ [storageKey]: data });
          }
        }
      }

      // Update local data
      highlightsData = highlightsData.filter(h => !selectedItems.has(h.id));
      notesData = notesData.filter(n => !selectedItems.has(n.id));
      selectedItems.clear();

      // Re-render
      renderItems();
      updateStats();
      
      // Uncheck select all
      panelElement.querySelector('#exl-hl-select-all-checkbox').checked = false;

      showToast(`Deleted ${count} items`);

    } catch (err) {
      console.error('[HighlightsSidepanel] Bulk delete failed:', err);
      showToast('Failed to delete items', 'error');
    }
  }

  // ========== UI HELPERS ==========

  /**
   * Update toolbar button states
   */
  function updateToolbarState() {
    const exportBtn = panelElement.querySelector('.exl-hl-btn-export');
    const deleteBtn = panelElement.querySelector('.exl-hl-btn-delete');
    const hasSelection = selectedItems.size > 0;

    exportBtn.disabled = !hasSelection;
    deleteBtn.disabled = !hasSelection;

    // Update select all checkbox state
    const totalItems = highlightsData.length + notesData.length;
    const selectAllCheckbox = panelElement.querySelector('#exl-hl-select-all-checkbox');
    selectAllCheckbox.indeterminate = selectedItems.size > 0 && selectedItems.size < totalItems;
    selectAllCheckbox.checked = selectedItems.size === totalItems && totalItems > 0;
  }

  /**
   * Update footer stats
   */
  function updateStats() {
    if (!panelElement) return;
    
    panelElement.querySelector('#exl-hl-total-highlights').textContent = highlightsData.length;
    panelElement.querySelector('#exl-hl-total-notes').textContent = notesData.length;
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'success') {
    const existing = document.querySelector('.exl-hl-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `exl-hl-toast exl-hl-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ========== UTILITY FUNCTIONS ==========

  /**
   * Truncate text with ellipsis
   */
  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Strip HTML tags from string
   */
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format date for display
   */
  function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Debounce function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ========== PUBLIC API ==========

  return {
    init,
    openPanel,
    closePanel,
    togglePanel,
    isOpen: () => isPanelOpen,
    refreshData: refreshPanelData
  };

})();

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HighlightsSidepanel;
}

