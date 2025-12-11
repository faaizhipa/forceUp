/**
 * Highlighter Module
 * Handles text selection, highlight rendering, and highlight persistence
 * @module highlighter
 */

const Highlighter = (function() {
  'use strict';

  const STORAGE_PREFIX = 'exl_highlights_';
  const HIGHLIGHT_CLASS_PREFIX = 'exl-hl-highlight';
  const STORAGE_VERSION = 1;
  const VERSION_KEY = 'exl_highlighter_storage_version';
  const SELECTION_PREF_KEY = 'exl_selection_toolbar_pref';
  const SelectionPalettePreference = {
    PALETTE: 'palette',
    DISABLED: 'disabled',
    FLOATING: 'floating'
  };
  
  // 11 custom highlight colors
  const COLORS = [
    { id: 1, name: 'Sky Blue', rgb: 'rgb(191, 229, 255)', hex: '#BFE5FF' },
    { id: 2, name: 'Light Blue', rgb: 'rgb(166, 217, 255)', hex: '#A6D9FF' },
    { id: 3, name: 'Mint Green', rgb: 'rgb(168, 224, 165)', hex: '#A8E0A5' },
    { id: 4, name: 'Light Yellow', rgb: 'rgb(255, 238, 163)', hex: '#FFEEA3' },
    { id: 5, name: 'Soft Yellow', rgb: 'rgb(255, 228, 168)', hex: '#FFE4A8' },
    { id: 6, name: 'Peach', rgb: 'rgb(255, 212, 168)', hex: '#FFD4A8' },
    { id: 7, name: 'Coral', rgb: 'rgb(255, 199, 194)', hex: '#FFC7C2' },
    { id: 8, name: 'Pink', rgb: 'rgb(255, 199, 216)', hex: '#FFC7D8' },
    { id: 9, name: 'Lavender', rgb: 'rgb(238, 199, 255)', hex: '#EEC7FF' },
    { id: 10, name: 'Periwinkle', rgb: 'rgb(212, 207, 255)', hex: '#D4CFFF' },
    { id: 11, name: 'Light Gray', rgb: 'rgb(204, 207, 216)', hex: '#CCCFD8' }
  ];

  let currentColor = COLORS[2]; // Default: Light Yellow
  let highlights = {};
  let isInitialized = false;
  let selectionToolbar = null;
  let selectionToolbarPref = SelectionPalettePreference.PALETTE;
  let selectionDecisionPending = false;
  let selectionDecisionChoice = null;
  let selectionPaletteLocked = false;
  let savedRange = null; // Store the selected range for toolbar highlighting
  let contentObserver = null; // Watch for dynamic content loading
  let pendingHighlights = new Set(); // Track highlights that failed to render
  let floatingButtonElement = null;
  let floatingButtonPosition = { x: null, y: null };
  let radialMenuState = {
    isExpanded: false,
    menuElement: null,
    items: [],
    radius: 70,
    innerRadius: 30,
    animationDelay: 20,
    keyboardHandler: null
  };
  let resizeHandler = null;
  let proximityHandler = null;

  function isLocalDbAvailable() {
    return typeof LocalDb !== 'undefined' && typeof LocalDb.getAllHighlights === 'function';
  }

  function getPersistenceContext() {
    const layerId = typeof LayerManager !== 'undefined' ? LayerManager.getActiveLayerId() : 'default';
    return {
      layerId,
      pageUrl: window.location.href
    };
  }

  /**
   * Initialize highlighter
   */
  async function init() {
    if (isInitialized) return;
    
    console.log('[Highlighter] Initializing...');
    
    // Wait for DOM to be ready before loading and rendering
    const domReady = await waitForDOMReady();
    if (!domReady) {
      console.warn('[Highlighter] DOM not ready after timeout, proceeding anyway');
    }
    
    await loadHighlights();
    await renderHighlights(); // Wait for initial render
    setupContextMenu();
    await loadSelectionToolbarPreference();
    setupSelectionToolbar();
    handleSelectionPreferenceChange(selectionToolbarPref);
    setupContentObserver(); // Watch for dynamic content
    
    isInitialized = true;
    console.log('[Highlighter] Initialized with', Object.keys(highlights).length, 'highlights');
  }

  async function loadSelectionToolbarPreference() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get([SELECTION_PREF_KEY], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('[Highlighter] Failed to load selection toolbar preference:', chrome.runtime.lastError);
            selectionToolbarPref = SelectionPalettePreference.PALETTE;
            resolve(selectionToolbarPref);
            return;
          }
          const stored = result[SELECTION_PREF_KEY];
          if (stored && Object.values(SelectionPalettePreference).includes(stored)) {
            selectionToolbarPref = stored;
          } else {
            selectionToolbarPref = SelectionPalettePreference.PALETTE;
          }
          resolve(selectionToolbarPref);
        });
      } catch (error) {
        console.warn('[Highlighter] Error loading selection toolbar preference:', error);
        selectionToolbarPref = SelectionPalettePreference.PALETTE;
        resolve(selectionToolbarPref);
      }
    });
  }

  async function saveSelectionToolbarPreference(pref) {
    selectionToolbarPref = pref;
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.set({ [SELECTION_PREF_KEY]: pref }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Highlighter] Failed to save selection toolbar preference:', chrome.runtime.lastError);
          }
          resolve();
        });
      } catch (error) {
        console.warn('[Highlighter] Error saving selection toolbar preference:', error);
        resolve();
      }
    });
  }

  async function setSelectionToolbarPreference(pref) {
    return saveSelectionToolbarPreference(pref);
  }

  function getSelectionToolbarPreference() {
    return selectionToolbarPref;
  }

  function handleSelectionPreferenceChange(pref) {
    if (pref === SelectionPalettePreference.FLOATING) {
      hideSelectionToolbar();
      showFloatingButton();
      return;
    }
    hideSelectionToolbar();
    hideRadialMenu();
    removeFloatingButton();
  }

  function ensureRadialStyles() {
    const STYLE_ID = 'exl-hl-radial-styles';
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
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

      .exl-hl-radial-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999996;
        background: transparent;
      }

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
        font-family: Arial, sans-serif;
        white-space: nowrap;
        border-radius: 4px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }

      .exl-hl-radial-item:hover::before {
        opacity: 1;
      }

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
  }

  async function loadFloatingButtonPosition() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['exl_hl_floating_btn_pos'], (result) => {
          const pos = result.exl_hl_floating_btn_pos;
          if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
            floatingButtonPosition = { x: pos.x, y: pos.y };
          }
          resolve();
        });
      } catch (error) {
        console.warn('[Highlighter] Failed to load floating position:', error);
        resolve();
      }
    });
  }

  function saveFloatingButtonPosition(x, y) {
    floatingButtonPosition = { x, y };
    try {
      chrome.storage.local.set({ exl_hl_floating_btn_pos: { x, y } });
    } catch (error) {
      console.warn('[Highlighter] Failed to save floating position:', error);
    }
  }

  function applyFloatingButtonPosition() {
    if (!floatingButtonElement) return;
    const { x, y } = floatingButtonPosition;
    if (x === null || y === null) return;
    floatingButtonElement.style.left = `${x}px`;
    floatingButtonElement.style.top = `${y}px`;
    floatingButtonElement.style.right = 'auto';
    floatingButtonElement.style.bottom = 'auto';
    floatingButtonElement.style.transform = 'none';
  }

  function clampFloatingButtonToViewport() {
    if (!floatingButtonElement) return;
    const rect = floatingButtonElement.getBoundingClientRect();
    const padding = 8;
    const width = rect.width || 48;
    const height = rect.height || 48;
    const clampedX = Math.min(Math.max(rect.left, padding), Math.max(padding, window.innerWidth - width - padding));
    const clampedY = Math.min(Math.max(rect.top, padding), Math.max(padding, window.innerHeight - height - padding));
    floatingButtonElement.style.left = `${clampedX}px`;
    floatingButtonElement.style.top = `${clampedY}px`;
    floatingButtonElement.style.right = 'auto';
    floatingButtonElement.style.bottom = 'auto';
    saveFloatingButtonPosition(clampedX, clampedY);

    if (radialMenuState.isExpanded && radialMenuState.menuElement) {
      const centerX = clampedX + (width / 2);
      const centerY = clampedY + (height / 2);
      radialMenuState.menuElement.style.left = `${centerX}px`;
      radialMenuState.menuElement.style.top = `${centerY}px`;
    }
  }

  function setupResizeHandler() {
    if (resizeHandler) return;
    const debounced = (() => {
      let timer = null;
      return () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          clampFloatingButtonToViewport();
          if (radialMenuState.isExpanded) {
            hideRadialMenu();
            showRadialMenu();
          }
        }, 120);
      };
    })();

    resizeHandler = debounced;
    window.addEventListener('resize', resizeHandler);
  }

  function setupFloatingButtonProximity() {
    if (!floatingButtonElement) return;
    if (proximityHandler) return;

    const button = floatingButtonElement;
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

    proximityHandler = handler;
    window.addEventListener('mousemove', handler);
  }

  function makeFloatingButtonDraggable(button) {
    if (!button) return;

    loadFloatingButtonPosition().then(() => applyFloatingButtonPosition());

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    const DRAG_THRESHOLD = 5;

    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const newX = clamp(originX + deltaX, 8, window.innerWidth - 56);
      const newY = clamp(originY + deltaY, 8, window.innerHeight - 56);
      button.style.left = `${newX}px`;
      button.style.top = `${newY}px`;
      button.style.right = 'auto';
      button.style.bottom = 'auto';

      if (radialMenuState.isExpanded && radialMenuState.menuElement) {
        const centerX = newX + button.offsetWidth / 2;
        const centerY = newY + button.offsetHeight / 2;
        radialMenuState.menuElement.style.left = `${centerX}px`;
        radialMenuState.menuElement.style.top = `${centerY}px`;
      }
    };

    const onMouseUp = (e) => {
      if (isDragging) {
        const moved = Math.abs(e.clientX - startX) > DRAG_THRESHOLD || Math.abs(e.clientY - startY) > DRAG_THRESHOLD;
        const rect = button.getBoundingClientRect();
        saveFloatingButtonPosition(rect.left, rect.top);
        button.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        isDragging = false;
        if (!moved) {
          toggleRadialMenu(e);
        }
      }
    };

    button.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      const rect = button.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      isDragging = true;
      button.classList.add('dragging');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    button.addEventListener('contextmenu', (e) => {
      if (isDragging) {
        e.preventDefault();
      }
    });
  }

  function showFloatingButton() {
    if (selectionToolbarPref !== SelectionPalettePreference.FLOATING) return;

    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => showFloatingButton());
      } else {
        setTimeout(() => showFloatingButton(), 100);
      }
      return;
    }

    if (floatingButtonElement) {
      floatingButtonElement.style.display = 'block';
      applyFloatingButtonPosition();
      setupFloatingButtonProximity();
      return;
    }

    ensureRadialStyles();

    const floatingBtn = document.createElement('button');
    floatingBtn.className = 'exl-hl-floating-btn';
    floatingBtn.innerHTML = '✨';
    floatingBtn.title = 'Highlighter quick actions';
    floatingBtn.setAttribute('aria-label', 'Highlighter quick actions');

    makeFloatingButtonDraggable(floatingBtn);

    document.body.appendChild(floatingBtn);
    floatingButtonElement = floatingBtn;
    setupResizeHandler();
    setupFloatingButtonProximity();
  }

  function hideFloatingButton() {
    if (floatingButtonElement) {
      floatingButtonElement.style.display = 'none';
    }
  }

  function removeFloatingButton() {
    hideRadialMenu();
    if (floatingButtonElement) {
      floatingButtonElement.remove();
      floatingButtonElement = null;
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    if (proximityHandler) {
      window.removeEventListener('mousemove', proximityHandler);
      proximityHandler = null;
    }
  }

  function toggleRadialMenu(event) {
    if (radialMenuState.isExpanded) {
      hideRadialMenu();
    } else {
      showRadialMenu(event);
    }
  }

  function showRadialMenu(event) {
    if (radialMenuState.isExpanded || !floatingButtonElement) return;

    ensureRadialStyles();
    hideRadialMenu();

    const buttonRect = floatingButtonElement.getBoundingClientRect();
    const centerX = buttonRect.left + buttonRect.width / 2;
    const centerY = buttonRect.top + buttonRect.height / 2;

    const menu = document.createElement('div');
    menu.className = 'exl-hl-radial-menu';
    menu.id = 'exl-hl-radial-menu';
    menu.style.left = `${centerX}px`;
    menu.style.top = `${centerY}px`;

    const overlay = document.createElement('div');
    overlay.className = 'exl-hl-radial-overlay';
    overlay.addEventListener('click', () => hideRadialMenu());
    document.body.appendChild(overlay);

    const items = getRadialMenuItems();
    const colors = getColors();
    const currentColor = getCurrentColor();

    const mouseX = event ? event.clientX : centerX;
    const mouseY = event ? event.clientY : centerY;
    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;
    const entryAngle = Math.atan2(deltaY, deltaX);

    const radius = radialMenuState.radius;
    const colorRadius = Math.max(40, Math.min(radialMenuState.innerRadius || 55, radius - 20));
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
      itemEl.style.setProperty('--animation-delay', `${index * radialMenuState.animationDelay}ms`);

      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.action) {
          item.action();
        }
        if (item.closeOnAction !== false) {
          hideRadialMenu();
        }
      });

      menu.appendChild(itemEl);
      radialMenuState.items.push(itemEl);
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
      chip.style.setProperty('--animation-delay', `${(items.length + index) * radialMenuState.animationDelay}ms`);

      if (currentColor && currentColor.id === color.id) {
        chip.classList.add('selected');
      }

      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        selectRadialColor(color.id, chip);
      });

      menu.appendChild(chip);
      radialMenuState.items.push(chip);
    });

    document.body.appendChild(menu);
    radialMenuState.menuElement = menu;
    radialMenuState.isExpanded = true;

    floatingButtonElement.classList.add('expanded');
    floatingButtonElement.setAttribute('aria-expanded', 'true');

    setupRadialMenuKeyboard(menu);
  }

  function getRadialMenuItems() {
    const items = [
      {
        icon: '🖍️',
        label: 'Highlight selection',
        closeOnAction: false,
        action: () => createHighlight()
      }
    ];

    if (selectionToolbarPref !== SelectionPalettePreference.PALETTE) {
      items.push({
        icon: '🚦',
        label: 'Restore selection palette',
        action: async () => {
          await setSelectionToolbarPreference(SelectionPalettePreference.PALETTE);
          handleSelectionPreferenceChange(SelectionPalettePreference.PALETTE);
        }
      });
    }

    return items;
  }

  function selectRadialColor(colorId, element) {
    setColor(colorId);
    const allColorChips = document.querySelectorAll('.exl-hl-radial-color-chip');
    allColorChips.forEach(chip => chip.classList.remove('selected'));
    if (element) {
      element.classList.add('selected');
    }
  }

  function setupRadialMenuKeyboard(menu) {
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        hideRadialMenu();
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
    radialMenuState.keyboardHandler = handleKeydown;

    const firstItem = menu.querySelector('button');
    if (firstItem) {
      setTimeout(() => firstItem.focus(), 100);
    }
  }

  function hideRadialMenu() {
    if (!radialMenuState.isExpanded) return;

    const menu = radialMenuState.menuElement;
    const overlay = document.querySelector('.exl-hl-radial-overlay');

    if (menu) {
      menu.classList.add('collapsing');
      setTimeout(() => menu.remove(), 200);
    }
    if (overlay) overlay.remove();

    if (radialMenuState.keyboardHandler) {
      document.removeEventListener('keydown', radialMenuState.keyboardHandler);
      radialMenuState.keyboardHandler = null;
    }

    if (floatingButtonElement) {
      floatingButtonElement.classList.remove('expanded');
      floatingButtonElement.setAttribute('aria-expanded', 'false');
      floatingButtonElement.focus();
    }

    radialMenuState.menuElement = null;
    radialMenuState.items = [];
    radialMenuState.isExpanded = false;
  }

  /**
   * Wait for DOM to be ready before rendering highlights
   * Checks for key content elements and waits up to maxWait milliseconds
   * @param {number} maxWait - Maximum time to wait in milliseconds (default: 5000)
   * @returns {Promise<boolean>} - True if DOM is ready, false if timeout
   */
  async function waitForDOMReady(maxWait = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      // Check for key content elements that indicate page is ready
      const hasContent = document.querySelector('article, main, [role="main"], .content, .slds-rich-text-editor__output, .uiOutputRichText, .forceOutputRichText');
      if (hasContent && document.body) {
        // Additional check: ensure body has some content
        if (document.body.children.length > 0) {
          console.log('[Highlighter] DOM is ready');
          return true;
        }
      }
      // Wait 200ms before next check
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.warn('[Highlighter] DOM readiness timeout after', maxWait, 'ms');
    return false; // Timeout
  }

  /**
   * Setup MutationObserver to watch for dynamic content loading
   * (Critical for Aura/Lightning components that load asynchronously)
   */
  function setupContentObserver() {
    contentObserver = new MutationObserver((mutations) => {
      // Only retry if we have pending highlights
      if (pendingHighlights.size === 0) return;

      // Debounce: wait for content to settle
      clearTimeout(contentObserver.timer);
      contentObserver.timer = setTimeout(() => {
        console.log('[Highlighter] Content changed, retrying', pendingHighlights.size, 'pending highlights');
        retryPendingHighlights();
      }, 500);
    });

    // Observe content areas for changes
    contentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('[Highlighter] Content observer active');
  }

  /**
   * Get current storage version from storage
   * @returns {Promise<number>} Current storage version
   */
  async function getCurrentStorageVersion() {
    return new Promise((resolve) => {
      chrome.storage.local.get([VERSION_KEY], (result) => {
        resolve(result[VERSION_KEY] || STORAGE_VERSION);
      });
    });
  }

  /**
   * Set storage version in storage
   * @param {number} version - Version to set
   * @returns {Promise<void>}
   */
  async function setStorageVersion(version) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [VERSION_KEY]: version }, () => {
        resolve();
      });
    });
  }

  /**
   * Get storage key for current URL and active layer
   */
  function getStorageKey() {
    const layerId = typeof LayerManager !== 'undefined' ? LayerManager.getActiveLayerId() : 'default';
    return `${STORAGE_PREFIX}v${STORAGE_VERSION}_${layerId}_${window.location.href}`;
  }

  /**
   * Get old-format storage key (for backward compatibility)
   */
  function getOldStorageKey() {
    const layerId = typeof LayerManager !== 'undefined' ? LayerManager.getActiveLayerId() : 'default';
    return STORAGE_PREFIX + layerId + '_' + window.location.href;
  }

  /**
   * Load highlights from storage (with backward compatibility for old format)
   */
  async function loadHighlights() {
    const { layerId, pageUrl } = getPersistenceContext();

    if (isLocalDbAvailable()) {
      try {
        const all = await LocalDb.getAllHighlights();
        const scoped = all.filter((item) => item.pageUrl === pageUrl && item.layerId === layerId);
        if (scoped.length > 0) {
          highlights = scoped.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {});
          console.log('[Highlighter] Loaded', scoped.length, 'highlights from LocalDb');
          return;
        }
      } catch (error) {
        console.warn('[Highlighter] LocalDb load failed, falling back to chrome.storage:', error);
      }
    }

    return new Promise((resolve) => {
      const key = getStorageKey();
      const oldKey = getOldStorageKey();
      
      // Try new format first, then fall back to old format
      chrome.storage.local.get([key, oldKey], async (result) => {
        if (chrome.runtime.lastError) {
          console.error('[Highlighter] Error loading highlights:', chrome.runtime.lastError);
          highlights = {};
          resolve();
          return;
        }
        
        // Prefer new format, fall back to old format
        highlights = result[key] || result[oldKey] || {};
        
        if (result[oldKey] && !result[key]) {
          console.log('[Highlighter] Loaded highlights from old format, migration will handle upgrade');
        }

        if (isLocalDbAvailable() && Object.keys(highlights).length > 0) {
          try {
            await persistHighlightsToLocalDb();
            console.log('[Highlighter] Migrated highlights to LocalDb');
          } catch (error) {
            console.warn('[Highlighter] Failed to migrate highlights to LocalDb:', error);
          }
        }
        
        console.log('[Highlighter] Loaded', Object.keys(highlights).length, 'highlights');
        resolve();
      });
    });
  }

  /**
   * Save highlights to storage
   */
  async function saveHighlights() {
    if (isLocalDbAvailable()) {
      try {
        await persistHighlightsToLocalDb();
        console.log('[Highlighter] Saved', Object.keys(highlights).length, 'highlights to LocalDb');
        return;
      } catch (error) {
        console.warn('[Highlighter] LocalDb save failed, falling back to chrome.storage:', error);
      }
    }

    return new Promise((resolve) => {
      const key = getStorageKey();
      chrome.storage.local.set({ [key]: highlights }, () => {
        if (chrome.runtime.lastError) {
          console.error('[Highlighter] Error saving highlights:', chrome.runtime.lastError);
        } else {
          console.log('[Highlighter] Saved', Object.keys(highlights).length, 'highlights');
        }
        resolve();
      });
    });
  }

  async function persistHighlightsToLocalDb() {
    const { layerId, pageUrl } = getPersistenceContext();
    const incomingIds = Object.keys(highlights);
    const existing = await LocalDb.getAllHighlights();
    const scopedExisting = existing.filter((item) => item.pageUrl === pageUrl && item.layerId === layerId);
    const staleIds = scopedExisting.map((item) => item.id).filter((id) => !incomingIds.includes(id));

    // Remove stale records for this page/layer
    await Promise.all(staleIds.map((id) => LocalDb.deleteHighlight(id)));

    // Upsert current highlights
    await Promise.all(incomingIds.map((id) => {
      const record = highlights[id] || {};
      return LocalDb.putHighlight({
        ...record,
        id,
        pageUrl,
        layerId,
        updatedAt: record.timestamp || record.updatedAt || Date.now()
      });
    }));
  }

  /**
   * Create a new highlight from current selection or saved range
   */
  async function createHighlight(useRange = null) {
    let range;
    let selectedText;

    if (useRange) {
      // Use provided range (from toolbar)
      range = useRange;
      selectedText = range.toString().trim();
    } else {
      // Use current selection
      const selection = window.getSelection();
      
      if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
        showToast('Please select some text to highlight');
        return null;
      }

      range = selection.getRangeAt(0);
      selectedText = selection.toString();
    }

    if (!selectedText || selectedText.trim() === '') {
      showToast('Please select some text to highlight');
      return null;
    }

    const highlightId = 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const { layerId, pageUrl } = getPersistenceContext();
    
    // Get XPath BEFORE wrapping (of the container element)
    const containerElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
      ? range.commonAncestorContainer.parentElement 
      : range.commonAncestorContainer;
    const xpath = getXPath(containerElement);
    
    // Wrap selection in span
    const span = document.createElement('span');
    span.className = `${HIGHLIGHT_CLASS_PREFIX} exl-hl-color-${currentColor.id}`;
    span.dataset.highlightId = highlightId;
    span.dataset.colorId = currentColor.id;
    
    try {
      range.surroundContents(span);
    } catch (e) {
      console.error('[Highlighter] Error wrapping selection:', e);
      showToast('Cannot highlight this selection');
      return null;
    }

    // Store highlight data with container XPath and offset info
    highlights[highlightId] = {
      id: highlightId,
      text: selectedText,
      colorId: currentColor.id,
      timestamp: Date.now(),
      layerId,
      pageUrl,
      xpath: xpath,
      containerTag: containerElement.tagName.toLowerCase(),
      startOffset: range.startOffset,
      endOffset: range.endOffset
    };

    await saveHighlights();
    
    // Clear selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    
    console.log('[Highlighter] Created highlight:', highlightId);
    return highlightId;
  }

  /**
   * Remove a highlight by ID
   */
  async function removeHighlight(highlightId) {
    const span = document.querySelector(`[data-highlight-id="${highlightId}"]`);
    if (span) {
      // Replace span with its text content
      const parent = span.parentNode;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
      parent.normalize(); // Merge adjacent text nodes
    }

    delete highlights[highlightId];
    await saveHighlights();
    
    console.log('[Highlighter] Removed highlight:', highlightId);
  }

  /**
   * Render all highlights on page (async to allow for batch processing)
   */
  async function renderHighlights() {
    const highlightList = Object.values(highlights);
    
    for (const highlight of highlightList) {
      const success = await renderSingleHighlight(highlight);
      if (!success) {
        pendingHighlights.add(highlight.id);
      } else {
        pendingHighlights.delete(highlight.id);
      }
      
      // Yield to browser every 10 highlights to avoid blocking
      if (highlightList.indexOf(highlight) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (pendingHighlights.size > 0) {
      console.log('[Highlighter] Waiting for content to load for', pendingHighlights.size, 'highlights');
    } else {
      console.log('[Highlighter] All highlights rendered successfully');
    }
  }

  /**
   * Retry rendering highlights that failed initially
   */
  async function retryPendingHighlights() {
    const toRetry = Array.from(pendingHighlights);
    
    for (const highlightId of toRetry) {
      const highlight = highlights[highlightId];
      if (highlight) {
        const success = await renderSingleHighlight(highlight);
        if (success) {
          pendingHighlights.delete(highlightId);
          console.log('[Highlighter] Successfully rendered pending highlight:', highlightId);
        }
      } else {
        // Highlight was deleted, remove from pending
        pendingHighlights.delete(highlightId);
      }
      
      // Yield to browser between retries
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (pendingHighlights.size === 0) {
      console.log('[Highlighter] All highlights rendered successfully');
    }
  }

  /**
   * Render a single highlight (async for better performance)
   * Returns true if successful, false if content not yet available
   */
  async function renderSingleHighlight(highlight) {
    try {
      // Check if already rendered
      if (document.querySelector(`[data-highlight-id="${highlight.id}"]`)) {
        return true;
      }

      let containerElement = getElementByXPath(highlight.xpath);
      
      // Fallback: If XPath fails (dynamic content), search for text in common containers
      if (!containerElement) {
        containerElement = findContainerByText(highlight.text, highlight.containerTag);
      }
      
      if (!containerElement) {
        return false; // Content not loaded yet
      }

      // Find the text node containing our highlighted text
      const textNodes = getTextNodesIn(containerElement);
      let textFound = false;

      for (const textNode of textNodes) {
        const text = textNode.textContent;
        const index = text.indexOf(highlight.text);
        
        if (index !== -1) {
          // Create range for the found text
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, index + highlight.text.length);

          // Create and insert highlight span
          const span = document.createElement('span');
          span.className = `${HIGHLIGHT_CLASS_PREFIX} exl-hl-color-${highlight.colorId}`;
          span.dataset.highlightId = highlight.id;
          span.dataset.colorId = highlight.colorId;

          try {
            range.surroundContents(span);
            textFound = true;
            break;
          } catch (e) {
            console.warn('[Highlighter] Could not wrap text for highlight:', highlight.id, e);
            return false;
          }
        }
      }

      if (!textFound) {
        return false; // Text not found yet
      }

      return true; // Successfully rendered
    } catch (e) {
      console.warn('[Highlighter] Error rendering highlight:', highlight.id, e);
      return false;
    }
  }

  /**
   * Find container element by searching for text content (fallback strategy)
   */
  function findContainerByText(text, tagName = null) {
    // Search in article/main content areas first
    const contentAreas = [
      'article',
      '.article-column',
      '.content',
      'main',
      '[role="main"]',
      '.slds-rich-text-editor__output',
      '.uiOutputRichText',
      '.forceOutputRichText'
    ];

    for (const selector of contentAreas) {
      const containers = document.querySelectorAll(selector);
      for (const container of containers) {
        if (container.textContent.includes(text)) {
          // If we have a tag name preference, try to find it within this container
          if (tagName) {
            const specificElement = Array.from(container.querySelectorAll(tagName))
              .find(el => el.textContent.includes(text));
            if (specificElement) return specificElement;
          }
          return container;
        }
      }
    }

    // Last resort: search entire body
    return document.body;
  }

  /**
   * Get all text nodes within an element
   */
  function getTextNodesIn(element) {
    const textNodes = [];
    const walk = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walk.nextNode()) {
      // Skip empty text nodes
      if (node.textContent.trim().length > 0) {
        textNodes.push(node);
      }
    }

    return textNodes;
  }

  /**
   * Setup context menu for removing highlights
   */
  function setupContextMenu() {
    document.addEventListener('contextmenu', (e) => {
      const target = e.target.closest(`.${HIGHLIGHT_CLASS_PREFIX}`);
      if (target && target.dataset.highlightId) {
        e.preventDefault();
        showRemoveContextMenu(e.pageX, e.pageY, target.dataset.highlightId);
      }
    });
  }

  /**
   * Show context menu for removing highlight
   */
  function showRemoveContextMenu(x, y, highlightId) {
    // Remove existing menu
    const existingMenu = document.querySelector('.exl-hl-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'exl-hl-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      padding: 0.5rem 0;
      z-index: 1000000;
      font-family: Inter, sans-serif;
      font-size: 14px;
    `;

    const removeBtn = document.createElement('div');
    removeBtn.textContent = '🗑️ Remove Highlight';
    removeBtn.style.cssText = `
      padding: 0.5rem 1rem;
      cursor: pointer;
      white-space: nowrap;
    `;
    removeBtn.addEventListener('mouseenter', () => {
      removeBtn.style.background = '#f5f5f5';
    });
    removeBtn.addEventListener('mouseleave', () => {
      removeBtn.style.background = 'transparent';
    });
    removeBtn.addEventListener('click', () => {
      removeHighlight(highlightId);
      menu.remove();
    });

    menu.appendChild(removeBtn);
    document.body.appendChild(menu);

    // Close menu on click outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 100);
  }

  /**
   * Setup selection toolbar that appears when text is selected
   */
  function setupSelectionToolbar() {
    // Listen for text selection
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', handleTextSelection);
    
    // Hide toolbar when clicking outside (but not on banner color palette)
    document.addEventListener('mousedown', (e) => {
      if (selectionToolbar && !selectionToolbar.contains(e.target)) {
        if (selectionDecisionPending) {
          return;
        }
        // Don't hide if clicking on banner color palette
        const clickedElement = e.target;
        if (clickedElement.closest('.exl-hl-color-chip') || clickedElement.closest('.exl-hl-palette')) {
          return; // Let the banner color click handler work
        }

        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
          hideSelectionToolbar();
        }
      }
    });
  }

  /**
   * Handle text selection event
   */
  function handleTextSelection(e) {
    // Small delay to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      if (selectedText && selection.rangeCount > 0) {
        // Don't show toolbar if selecting within the banner or existing highlight
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const parentElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        
        if (parentElement.closest('.exl-hl-banner') || parentElement.closest('.exl-hl-selection-toolbar')) {
          return;
        }

        showSelectionToolbar(range);
      } else {
        if (!selectionDecisionPending) {
          hideSelectionToolbar();
        }
      }
    }, 10);
  }

  /**
   * Show selection toolbar near the selected text
   */
  function showSelectionToolbar(range) {
    if (selectionToolbarPref !== SelectionPalettePreference.PALETTE) {
      return;
    }
    // Remove existing toolbar
    hideSelectionToolbar();

    // Save the range for later use when color is clicked
    savedRange = range.cloneRange();

    // Get selection position
    const rect = range.getBoundingClientRect();
    selectionDecisionPending = false;
    selectionDecisionChoice = null;
    selectionPaletteLocked = false;
    
    // Create toolbar
    selectionToolbar = document.createElement('div');
    selectionToolbar.className = 'exl-hl-selection-toolbar';
    
    // Create color palette
    const palette = document.createElement('div');
    palette.className = 'exl-hl-selection-palette';
    
    COLORS.forEach(color => {
      const chip = document.createElement('div');
      chip.className = 'exl-hl-selection-color-chip';
      chip.style.backgroundColor = color.rgb;
      chip.title = color.name;
      chip.dataset.colorId = color.id;
      
      chip.addEventListener('click', async () => {
        if (selectionPaletteLocked) {
          return;
        }
        setColor(color.id);
        await createHighlight(savedRange);
        if (selectionDecisionPending) {
          selectionPaletteLocked = true;
          palette.style.pointerEvents = 'none';
          palette.style.opacity = '0.6';
          return;
        }
        hideSelectionToolbar();
      });
      
      palette.appendChild(chip);
    });

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'exl-hl-selection-options';

    const radioName = `exl-hl-selection-pref-${Date.now()}`;
    let confirmBtn;
    let cancelBtn;

    const createOption = (labelText, value) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'exl-hl-selection-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = radioName;
      input.value = value;

      const text = document.createElement('span');
      text.textContent = labelText;

      input.addEventListener('change', () => {
        selectionDecisionPending = true;
        selectionDecisionChoice = value;
        if (confirmBtn) confirmBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        if (selectionToolbar) {
          selectionToolbar.classList.add('exl-hl-selection-toolbar--pending');
        }
      });

      wrapper.appendChild(input);
      wrapper.appendChild(text);
      return wrapper;
    };

    optionsContainer.appendChild(
      createOption("Don't show colour bar again", SelectionPalettePreference.DISABLED)
    );
    optionsContainer.appendChild(
      createOption('Show colours via the floating ✨ button', SelectionPalettePreference.FLOATING)
    );

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'exl-hl-selection-actions';

    confirmBtn = document.createElement('button');
    confirmBtn.className = 'exl-hl-selection-confirm';
    confirmBtn.innerHTML = '✔';
    confirmBtn.title = 'Confirm option';
    confirmBtn.disabled = true;
    confirmBtn.addEventListener('click', async () => {
      if (!selectionDecisionChoice) return;
      if (selectionDecisionChoice === SelectionPalettePreference.DISABLED || selectionDecisionChoice === SelectionPalettePreference.FLOATING) {
        await saveSelectionToolbarPreference(selectionDecisionChoice);
        handleSelectionPreferenceChange(selectionDecisionChoice);
      }
      hideSelectionToolbar();
    });

    cancelBtn = document.createElement('button');
    cancelBtn.className = 'exl-hl-selection-cancel';
    cancelBtn.innerHTML = '✕';
    cancelBtn.title = 'Cancel';
    cancelBtn.disabled = true;
    cancelBtn.addEventListener('click', () => {
      selectionDecisionPending = false;
      selectionDecisionChoice = null;
      selectionPaletteLocked = false;
      hideSelectionToolbar();
    });

    actionsContainer.appendChild(confirmBtn);
    actionsContainer.appendChild(cancelBtn);

    const topRow = document.createElement('div');
    topRow.className = 'exl-hl-selection-top';
    topRow.appendChild(optionsContainer);
    topRow.appendChild(actionsContainer);

    selectionToolbar.appendChild(topRow);
    selectionToolbar.appendChild(palette);
    document.body.appendChild(selectionToolbar);

    // Auto-fade the mini options panel after 5 seconds of inactivity
    let fadeTimer = null;
    let topRowInteracted = false; // Once hovered/focused, keep visible

    const startFadeTimer = () => {
      if (topRowInteracted) return;
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => {
        if (!topRowInteracted) {
          topRow.classList.add('exl-hl-selection-top--hidden');
        }
      }, 5000);
    };

    const cancelFade = () => {
      topRowInteracted = true;
      clearTimeout(fadeTimer);
      topRow.classList.remove('exl-hl-selection-top--hidden');
    };

    startFadeTimer();
    topRow.addEventListener('mouseenter', cancelFade);
    topRow.addEventListener('focusin', cancelFade);
    
    // Position toolbar above selection
    const toolbarRect = selectionToolbar.getBoundingClientRect();
    let top = rect.top + window.scrollY - toolbarRect.height - 8;
    let left = rect.left + window.scrollX + (rect.width / 2) - (toolbarRect.width / 2);
    
    // Ensure toolbar stays within viewport
    if (left < 10) left = 10;
    if (left + toolbarRect.width > window.innerWidth - 10) {
      left = window.innerWidth - toolbarRect.width - 10;
    }
    if (top < 60) { // Account for banner height
      top = rect.bottom + window.scrollY + 8; // Show below selection
    }
    
    selectionToolbar.style.top = top + 'px';
    selectionToolbar.style.left = left + 'px';
    selectionToolbar.style.opacity = '1';
    selectionToolbar.style.transform = 'translateY(0)';
  }

  /**
   * Hide selection toolbar
   */
  function hideSelectionToolbar() {
    selectionDecisionPending = false;
    selectionDecisionChoice = null;
    selectionPaletteLocked = false;
    if (selectionToolbar) {
      selectionToolbar.remove();
      selectionToolbar = null;
    }
    savedRange = null; // Clear saved range
  }

  /**
   * Set current highlight color
   */
  function setColor(colorId) {
    const color = COLORS.find(c => c.id === colorId);
    if (color) {
      currentColor = color;
      console.log('[Highlighter] Color set to:', color.name);
    }
  }

  /**
   * Get current highlight color
   */
  function getCurrentColor() {
    return currentColor;
  }

  /**
   * Get all available colors
   */
  function getColors() {
    return COLORS;
  }

  /**
   * Get XPath for an element (ignoring dynamic Aura attributes)
   */
  function getXPath(element) {
    if (element.id && !element.id.includes(':') && !element.id.match(/^\d/)) {
      // Use ID if it's stable (not Aura-generated IDs with colons or starting with numbers)
      return `//*[@id="${element.id}"]`;
    }
    
    if (element === document.body) {
      return '/html/body';
    }

    // Build path using stable attributes (classes, not data-aura-* attributes)
    let index = 0;
    const siblings = element.parentNode.childNodes;
    
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === element) {
        // Try to use stable class names if available
        const stableClasses = getStableClasses(element);
        if (stableClasses.length > 0) {
          const classSelector = stableClasses.map(c => `contains(@class, "${c}")`).join(' and ');
          return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + 
                 '[' + classSelector + '][' + (index + 1) + ']';
        }
        return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (index + 1) + ']';
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        // Only count siblings with matching stable classes
        const siblingClasses = getStableClasses(sibling);
        const elementClasses = getStableClasses(element);
        if (siblingClasses.length === 0 || elementClasses.length === 0 || 
            arraysOverlap(siblingClasses, elementClasses)) {
          index++;
        }
      }
    }
  }

  /**
   * Get stable class names (exclude Aura/LWC dynamic classes)
   */
  function getStableClasses(element) {
    if (!element.className || typeof element.className !== 'string') return [];
    
    const classes = element.className.split(/\s+/).filter(c => {
      // Exclude dynamic/generated classes
      return c && 
             !c.startsWith('lwc-') && 
             !c.match(/^data-/) &&
             !c.match(/^\d/) &&
             !c.includes(':');
    });
    
    return classes.slice(0, 2); // Use first 2 stable classes for specificity
  }

  /**
   * Check if two arrays have any common elements
   */
  function arraysOverlap(arr1, arr2) {
    return arr1.some(item => arr2.includes(item));
  }

  /**
   * Get element by XPath
   */
  function getElementByXPath(xpath) {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  }

  /**
   * Show toast notification
   */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'exl-hl-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Get all highlights data (for export)
   */
  function getAllHighlights() {
    return { [getStorageKey()]: highlights };
  }

  /**
   * Import highlights data
   */
  async function importHighlights(data) {
    const key = getStorageKey();
    if (data[key]) {
      highlights = data[key];
      await saveHighlights();
      await renderHighlights();
      console.log('[Highlighter] Imported', Object.keys(highlights).length, 'highlights');
    }
  }

  /**
   * Switch to a different layer (clear current highlights and load new layer)
   */
  async function switchLayer() {
    console.log('[Highlighter] Switching layer...');
    
    // Clear all current highlight spans from DOM
    document.querySelectorAll(`.${HIGHLIGHT_CLASS_PREFIX}`).forEach(span => {
      const parent = span.parentNode;
      if (parent) {
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
        parent.normalize();
      }
    });
    
    // Clear pending highlights for previous layer
    pendingHighlights.clear();
    
    // Load highlights for new active layer
    await loadHighlights();
    await renderHighlights();
    
    console.log('[Highlighter] Switched layer, loaded', Object.keys(highlights).length, 'highlights');
  }

  /**
   * Reload highlights for new URL (called when URL changes in SPA)
   * Clears existing highlights from DOM and loads highlights for new URL
   */
  async function reloadForNewUrl() {
    console.log('[Highlighter] Reloading highlights for new URL:', window.location.href);
    
    // Clear all current highlight spans from DOM
    document.querySelectorAll(`.${HIGHLIGHT_CLASS_PREFIX}`).forEach(span => {
      const parent = span.parentNode;
      if (parent) {
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
        parent.normalize();
      }
    });
    
    // Clear pending highlights
    pendingHighlights.clear();
    
    // Clear current highlights object
    highlights = {};
    
    // Wait for DOM to be ready before loading and rendering
    const domReady = await waitForDOMReady();
    if (!domReady) {
      console.warn('[Highlighter] DOM not ready after timeout, proceeding anyway');
    }
    
    // Load highlights for new URL
    await loadHighlights();
    
    // Render highlights
    await renderHighlights();
    
    console.log('[Highlighter] Reloaded', Object.keys(highlights).length, 'highlights for new URL');
  }

  /**
   * Cleanup
   */
  function cleanup() {
    // Disconnect content observer
    if (contentObserver) {
      contentObserver.disconnect();
      contentObserver = null;
      console.log('[Highlighter] Content observer disconnected');
    }

    // Remove all highlight spans
    document.querySelectorAll(`.${HIGHLIGHT_CLASS_PREFIX}`).forEach(span => {
      const parent = span.parentNode;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    });

    // Remove context menus and toolbars
    document.querySelectorAll('.exl-hl-context-menu').forEach(menu => menu.remove());
    hideSelectionToolbar();
    
    // Remove event listeners
    document.removeEventListener('mouseup', handleTextSelection);
    document.removeEventListener('keyup', handleTextSelection);

    highlights = {};
    pendingHighlights.clear();
    isInitialized = false;
    console.log('[Highlighter] Cleaned up');
  }

  return {
    init,
    createHighlight,
    removeHighlight,
    setColor,
    getCurrentColor,
    getColors,
    getSelectionToolbarPreference,
    setSelectionToolbarPreference,
    getAllHighlights,
    importHighlights,
    switchLayer,
    reloadForNewUrl,
    cleanup
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Highlighter;
}
