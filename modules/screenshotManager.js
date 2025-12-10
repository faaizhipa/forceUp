/**
 * Screenshot Manager Module
 * Handles screenshot capture on non-Salesforce domains only
 * Uses html2canvas for capture and fabric.js for annotations
 * 
 * CRITICAL: Screenshots are NOT active on Salesforce pages
 * Domain restriction: *.force.com, *.salesforce.com, *.lightning.force.com
 */

const ScreenshotManager = (function() {
  'use strict';

  // State
  let isCapturing = false;
  let selectionOverlay = null;
  let startPoint = null;
  let selectionBox = null;
  let annotationModal = null;
  let fabricCanvas = null;
  let capturedImage = null;

  // Constants
  const RESTRICTED_DOMAINS = ['force.com', 'salesforce.com', 'lightning.force'];
  const JPEG_QUALITY = 0.8;
  const MAX_IMAGE_WIDTH = 800;
  const ANNOTATION_TOOLS = ['arrow', 'rectangle', 'text', 'blur', 'pixelate', 'freehand', 'circle'];

  /**
   * Check if current domain is restricted (Salesforce)
   * @returns {boolean} True if domain is restricted
   */
  function isRestrictedDomain() {
    const hostname = window.location.hostname.toLowerCase();
    return RESTRICTED_DOMAINS.some(domain => hostname.includes(domain));
  }

  /**
   * Initialize screenshot manager
   */
  function init() {
    if (isRestrictedDomain()) {
      if (typeof Logger !== 'undefined') {
        Logger.info('[ScreenshotManager] Not initializing - restricted Salesforce domain');
      }
      return false;
    }

    if (typeof Logger !== 'undefined') {
      Logger.info('[ScreenshotManager] Initializing on non-Salesforce domain');
    }

    // Register keyboard shortcut will be handled by KeyboardShortcuts module
    return true;
  }

  /**
   * Start screenshot capture process
   */
  function startCapture() {
    if (isRestrictedDomain()) {
      if (typeof Logger !== 'undefined') {
        Logger.warn('[ScreenshotManager] Screenshot not allowed on Salesforce domains');
      }
      showWarningToast('Screenshots are not available on Salesforce pages');
      return;
    }

    if (isCapturing) {
      if (typeof Logger !== 'undefined') {
        Logger.warn('[ScreenshotManager] Capture already in progress');
      }
      return;
    }

    isCapturing = true;
    createSelectionOverlay();
  }

  /**
   * Create full-screen selection overlay
   */
  function createSelectionOverlay() {
    // Create overlay container
    selectionOverlay = document.createElement('div');
    selectionOverlay.id = 'exl-screenshot-overlay';
    selectionOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      cursor: crosshair;
      z-index: 2147483647;
      user-select: none;
    `;

    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
      position: absolute;
      border: 2px dashed #0070d2;
      background: rgba(0, 112, 210, 0.1);
      display: none;
      pointer-events: none;
    `;
    selectionOverlay.appendChild(selectionBox);

    // Create instruction text
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #333;
      z-index: 2147483648;
    `;
    instructions.textContent = 'Drag to select area • ESC to cancel';
    selectionOverlay.appendChild(instructions);

    // Event listeners
    selectionOverlay.addEventListener('mousedown', handleMouseDown);
    selectionOverlay.addEventListener('mousemove', handleMouseMove);
    selectionOverlay.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleEscape);

    document.body.appendChild(selectionOverlay);
  }

  /**
   * Handle mouse down event
   */
  function handleMouseDown(e) {
    startPoint = { x: e.clientX, y: e.clientY };
    selectionBox.style.display = 'block';
    selectionBox.style.left = startPoint.x + 'px';
    selectionBox.style.top = startPoint.y + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
  }

  /**
   * Handle mouse move event
   */
  function handleMouseMove(e) {
    if (!startPoint) return;

    const currentX = e.clientX;
    const currentY = e.clientY;
    const width = Math.abs(currentX - startPoint.x);
    const height = Math.abs(currentY - startPoint.y);
    const left = Math.min(currentX, startPoint.x);
    const top = Math.min(currentY, startPoint.y);

    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
  }

  /**
   * Handle mouse up event
   */
  async function handleMouseUp(e) {
    if (!startPoint) return;

    const endPoint = { x: e.clientX, y: e.clientY };
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    // Minimum selection size
    if (width < 10 || height < 10) {
      cancelCapture();
      return;
    }

    const bounds = {
      left: Math.min(endPoint.x, startPoint.x),
      top: Math.min(endPoint.y, startPoint.y),
      width: width,
      height: height
    };

    await captureScreenshot(bounds);
  }

  /**
   * Handle ESC key to cancel
   */
  function handleEscape(e) {
    if (e.key === 'Escape' && isCapturing) {
      cancelCapture();
    }
  }

  /**
   * Cancel capture and cleanup
   */
  function cancelCapture() {
    if (selectionOverlay && selectionOverlay.parentNode) {
      selectionOverlay.parentNode.removeChild(selectionOverlay);
    }
    document.removeEventListener('keydown', handleEscape);
    selectionOverlay = null;
    selectionBox = null;
    startPoint = null;
    isCapturing = false;
  }

  /**
   * Capture screenshot using html2canvas
   * @param {Object} bounds - Selection bounds {left, top, width, height}
   */
  async function captureScreenshot(bounds) {
    try {
      // Remove overlay temporarily
      if (selectionOverlay) {
        selectionOverlay.style.display = 'none';
      }

      // Wait a brief moment for overlay to hide
      await new Promise(resolve => setTimeout(resolve, 120));

      // Capture via Chrome API with scroll-and-stitch
      const initialScroll = { x: window.scrollX, y: window.scrollY };
      const fullCanvas = await captureFullPageWithChromeAPI(initialScroll);
      const croppedCanvas = cropCanvas(fullCanvas, bounds, initialScroll);

      // Cleanup overlay
      cancelCapture();

      // Process and compress image
      const processedCanvas = processImage(croppedCanvas);
      const dataUrl = processedCanvas.toDataURL('image/jpeg', JPEG_QUALITY);

      capturedImage = {
        dataUrl: dataUrl,
        bounds: bounds,
        timestamp: Date.now(),
        url: window.location.href
      };

      // Open annotation UI
      openAnnotationUI();

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[ScreenshotManager] Capture failed:', error);
      }

      // Check for cross-origin issues
      if (error.message && error.message.includes('taint')) {
        showWarningToast('Unable to capture: Page contains cross-origin content');
      } else {
        showWarningToast('Screenshot capture failed');
      }

      cancelCapture();
    }
  }

  /**
   * Capture full page by scrolling and stitching viewport captures
   * Uses chrome.tabs.captureVisibleTab via background messaging
   * @param {Object} initialScroll - {x, y} scroll position before capture
   * @returns {Promise<HTMLCanvasElement>} Stitched canvas of full page
   */
  async function captureFullPageWithChromeAPI(initialScroll) {
    const totalHeight = document.documentElement.scrollHeight;
    const totalWidth = document.documentElement.scrollWidth;
    const viewportHeight = window.innerHeight;

    const stitchedCanvas = document.createElement('canvas');
    stitchedCanvas.width = totalWidth;
    stitchedCanvas.height = totalHeight;
    const ctx = stitchedCanvas.getContext('2d');

    for (let y = 0; y < totalHeight; y += viewportHeight) {
      window.scrollTo(0, y);
      await waitForFrame();
      const capture = await captureVisibleTab();
      const img = await dataUrlToImage(capture);
      const drawHeight = Math.min(img.height, totalHeight - y);
      ctx.drawImage(img, 0, 0, img.width, drawHeight, 0, y, img.width, drawHeight);
    }

    // Restore original scroll
    window.scrollTo(initialScroll.x, initialScroll.y);
    await waitForFrame();
    return stitchedCanvas;
  }

  /**
   * Crop stitched canvas to user selection bounds
   * @param {HTMLCanvasElement} fullCanvas - Stitched full page canvas
   * @param {Object} bounds - Selection bounds relative to viewport
   * @param {Object} initialScroll - Scroll position when selection occurred
   * @returns {HTMLCanvasElement} Cropped canvas
   */
  function cropCanvas(fullCanvas, bounds, initialScroll) {
    const crop = document.createElement('canvas');
    crop.width = bounds.width;
    crop.height = bounds.height;
    const ctx = crop.getContext('2d');
    ctx.drawImage(
      fullCanvas,
      bounds.left + initialScroll.x,
      bounds.top + initialScroll.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );
    return crop;
  }

  /**
   * Request a visible tab capture from background (PNG data URL)
   * @returns {Promise<string>} data URL
   */
  function captureVisibleTab() {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (response) => {
          if (!response || !response.success || !response.dataUrl) {
            reject(response?.error || 'Capture failed');
            return;
          }
          resolve(response.dataUrl);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function dataUrlToImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function waitForFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));
  }

  /**
   * Process and resize image if needed
   * @param {HTMLCanvasElement} canvas - Original canvas
   * @returns {HTMLCanvasElement} Processed canvas
   */
  function processImage(canvas) {
    const width = canvas.width;
    const height = canvas.height;

    // Resize if too large
    if (width > MAX_IMAGE_WIDTH) {
      const ratio = MAX_IMAGE_WIDTH / width;
      const newWidth = MAX_IMAGE_WIDTH;
      const newHeight = height * ratio;

      const resizedCanvas = document.createElement('canvas');
      resizedCanvas.width = newWidth;
      resizedCanvas.height = newHeight;

      const ctx = resizedCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, 0, newWidth, newHeight);

      return resizedCanvas;
    }

    return canvas;
  }

  /**
   * Open annotation UI modal
   */
  function openAnnotationUI() {
    if (!capturedImage) return;

    // Create modal
    annotationModal = document.createElement('div');
    annotationModal.id = 'exl-annotation-modal';
    annotationModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;

    // Create toolbar
    const toolbar = createAnnotationToolbar();
    annotationModal.appendChild(toolbar);

    // Create canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
      background: white;
      padding: 10px;
      border-radius: 4px;
      max-width: 90%;
      max-height: 80%;
      overflow: auto;
      margin-top: 10px;
    `;

    // Create fabric canvas
    const canvasEl = document.createElement('canvas');
    canvasEl.id = 'exl-annotation-canvas';
    canvasContainer.appendChild(canvasEl);
    annotationModal.appendChild(canvasContainer);

    document.body.appendChild(annotationModal);

    // Initialize fabric.js canvas
    initFabricCanvas(canvasEl);
  }

  /**
   * Create annotation toolbar
   * @returns {HTMLElement} Toolbar element
   */
  function createAnnotationToolbar() {
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      background: white;
      padding: 10px;
      border-radius: 4px;
      display: flex;
      gap: 10px;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;

    // Tool buttons
    const tools = [
      { id: 'arrow', label: '→ Arrow', icon: '→' },
      { id: 'rectangle', label: '□ Rectangle', icon: '□' },
      { id: 'circle', label: '○ Circle', icon: '○' },
      { id: 'text', label: 'T Text', icon: 'T' },
      { id: 'freehand', label: '✎ Draw', icon: '✎' },
      { id: 'blur', label: '⊗ Blur', icon: '⊗' },
      { id: 'pixelate', label: '▦ Pixelate', icon: '▦' }
    ];

    tools.forEach(tool => {
      const btn = document.createElement('button');
      btn.textContent = tool.icon + ' ' + tool.label.split(' ')[1];
      btn.style.cssText = `
        padding: 8px 12px;
        border: 1px solid #ccc;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;
      btn.addEventListener('click', () => setAnnotationTool(tool.id));
      toolbar.appendChild(btn);
    });

    // Separator
    const separator = document.createElement('div');
    separator.style.cssText = 'width: 1px; height: 30px; background: #ccc;';
    toolbar.appendChild(separator);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 Save';
    saveBtn.style.cssText = `
      padding: 8px 16px;
      border: none;
      background: #0070d2;
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    saveBtn.addEventListener('click', saveAnnotatedScreenshot);
    toolbar.appendChild(saveBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '✕ Cancel';
    cancelBtn.style.cssText = `
      padding: 8px 16px;
      border: 1px solid #ccc;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    cancelBtn.addEventListener('click', closeAnnotationUI);
    toolbar.appendChild(cancelBtn);

    // Send to panel (keeps annotation open)
    const panelBtn = document.createElement('button');
    panelBtn.textContent = '↗ Panel';
    panelBtn.style.cssText = `
      padding: 8px 12px;
      border: 1px solid #ccc;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    panelBtn.addEventListener('click', () => {
      if (typeof CapturePanel !== 'undefined' && typeof CapturePanel.open === 'function') {
        CapturePanel.open({ tab: 'screenshots' });
        return;
      }
      try {
        chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL', tab: 'captured' });
      } catch (err) {
        if (typeof Logger !== 'undefined') {
          Logger.warn('[ScreenshotManager] Failed to open side panel', err);
        }
      }
    });
    toolbar.appendChild(panelBtn);

    return toolbar;
  }

  /**
   * Initialize fabric.js canvas
   * @param {HTMLCanvasElement} canvasEl - Canvas element
   */
  function initFabricCanvas(canvasEl) {
    if (typeof fabric === 'undefined') {
      if (typeof Logger !== 'undefined') {
        Logger.error('[ScreenshotManager] fabric.js not loaded');
      }
      showWarningToast('Annotation library not available');
      closeAnnotationUI();
      return;
    }

    // Load captured image
    const img = new Image();
    img.onload = function() {
      fabricCanvas = new fabric.Canvas(canvasEl, {
        width: img.width,
        height: img.height
      });

      // Set background image
      fabricCanvas.setBackgroundImage(capturedImage.dataUrl, fabricCanvas.renderAll.bind(fabricCanvas));

      // Enable drawing mode by default
      fabricCanvas.isDrawingMode = false;
    };
    img.src = capturedImage.dataUrl;
  }

  /**
   * Set annotation tool
   * @param {string} toolId - Tool identifier
   */
  function setAnnotationTool(toolId) {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = false;

    switch (toolId) {
      case 'freehand':
        fabricCanvas.isDrawingMode = true;
        fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
        fabricCanvas.freeDrawingBrush.color = '#ff0000';
        fabricCanvas.freeDrawingBrush.width = 3;
        break;

      case 'arrow':
      case 'rectangle':
      case 'circle':
      case 'text':
        // These will be added on click
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.off('mouse:down');
        fabricCanvas.on('mouse:down', (e) => addShape(toolId, e));
        break;

      case 'blur':
      case 'pixelate':
        // Apply filter on selection
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.off('mouse:down');
        fabricCanvas.on('mouse:down', (e) => applyEffect(toolId, e));
        break;
    }
  }

  /**
   * Add shape to canvas
   * @param {string} shapeType - Shape type
   * @param {Object} event - Mouse event
   */
  function addShape(shapeType, event) {
    if (!fabricCanvas) return;

    const pointer = fabricCanvas.getPointer(event.e);

    switch (shapeType) {
      case 'rectangle':
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 100,
          height: 60,
          fill: 'transparent',
          stroke: '#ff0000',
          strokeWidth: 3
        });
        fabricCanvas.add(rect);
        break;

      case 'circle':
        const circle = new fabric.Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 50,
          fill: 'transparent',
          stroke: '#ff0000',
          strokeWidth: 3
        });
        fabricCanvas.add(circle);
        break;

      case 'arrow':
        const arrow = new fabric.Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
          stroke: '#ff0000',
          strokeWidth: 3
        });
        fabricCanvas.add(arrow);
        break;

      case 'text':
        const text = new fabric.IText('Text', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 20,
          fill: '#ff0000',
          fontFamily: 'Arial'
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing();
        break;
    }

    fabricCanvas.renderAll();
  }

  /**
   * Apply visual effect (blur, pixelate)
   * @param {string} effectType - Effect type
   * @param {Object} event - Mouse event
   */
  function applyEffect(effectType, event) {
    // Simplified implementation - would need more complex logic for region-based effects
    if (typeof Logger !== 'undefined') {
      Logger.info('[ScreenshotManager] Effect application not yet implemented:', effectType);
    }
  }

  /**
   * Save annotated screenshot
   */
  async function saveAnnotatedScreenshot() {
    if (!fabricCanvas || !capturedImage) return;

    try {
      // Merge annotations with background
      const finalDataUrl = fabricCanvas.toDataURL({
        format: 'jpeg',
        quality: JPEG_QUALITY
      });

      // Create thumbnail (10% size)
      const thumbnailCanvas = document.createElement('canvas');
      const img = new Image();
      img.onload = async function() {
        thumbnailCanvas.width = img.width * 0.1;
        thumbnailCanvas.height = img.height * 0.1;
        const ctx = thumbnailCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
        const thumbnailDataUrl = thumbnailCanvas.toDataURL('image/jpeg', 0.5);

        // Get current layer ID
        const layerId = typeof LayerManager !== 'undefined' ? LayerManager.getCurrentLayerId() : 'default';

        // Prepare screenshot data
        const screenshotData = {
          id: `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          dataUrl: finalDataUrl,
          thumbnail: thumbnailDataUrl,
          annotations: fabricCanvas.toJSON(),
          timestamp: Date.now(),
          url: capturedImage.url,
          bounds: capturedImage.bounds,
          layerId: layerId
        };

        // Save to storage
        await saveToStorage(screenshotData);

        // Copy to clipboard
        await copyToClipboard(finalDataUrl);

        // Open capture panel for immediate feedback; fallback to sidepanel message
        if (typeof CapturePanel !== 'undefined' && typeof CapturePanel.open === 'function') {
          CapturePanel.open({ tab: 'screenshots', justSavedId: screenshotData.id, url: screenshotData.url });
        } else {
          try {
            chrome.runtime.sendMessage({
              type: 'OPEN_SIDEPANEL',
              tab: 'captured',
              payload: { justSavedId: screenshotData.id, url: screenshotData.url }
            });
          } catch (err) {
            if (typeof Logger !== 'undefined') {
              Logger.warn('[ScreenshotManager] Failed to open side panel after save', err);
            }
          }
        }

        // Show success message
        showSuccessToast('Screenshot saved and copied to clipboard');

        // Close UI
        closeAnnotationUI();
      };
      img.src = finalDataUrl;

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[ScreenshotManager] Save failed:', error);
      }
      showWarningToast('Failed to save screenshot');
    }
  }

  /**
   * Save screenshot to chrome.storage
   * @param {Object} screenshotData - Screenshot data
   */
  async function saveToStorage(screenshotData) {
    try {
      // Check storage quota first
      if (typeof StorageQuotaManager !== 'undefined') {
        const canStore = await StorageQuotaManager.canStoreScreenshot(screenshotData.dataUrl.length);
        if (!canStore) {
          throw new Error('Storage quota exceeded');
        }
      }

      // Generate storage key
      const urlHash = screenshotData.url.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
      const storageKey = `exl_screenshots_v1_${screenshotData.layerId}_${urlHash}_${screenshotData.id}`;

      // Save to chrome.storage.local
      await chrome.storage.local.set({ [storageKey]: screenshotData });

      if (typeof Logger !== 'undefined') {
        Logger.info('[ScreenshotManager] Screenshot saved:', storageKey);
      }

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.error('[ScreenshotManager] Storage save failed:', error);
      }
      throw error;
    }
  }

  /**
   * Copy image to clipboard
   * @param {string} dataUrl - Image data URL
   */
  async function copyToClipboard(dataUrl) {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);

      if (typeof Logger !== 'undefined') {
        Logger.info('[ScreenshotManager] Image copied to clipboard');
      }

    } catch (error) {
      if (typeof Logger !== 'undefined') {
        Logger.warn('[ScreenshotManager] Clipboard copy failed:', error);
      }
      // Non-critical error, continue
    }
  }

  /**
   * Close annotation UI
   */
  function closeAnnotationUI() {
    if (annotationModal && annotationModal.parentNode) {
      annotationModal.parentNode.removeChild(annotationModal);
    }
    annotationModal = null;
    fabricCanvas = null;
    capturedImage = null;
    isCapturing = false;
  }

  /**
   * Show warning toast
   * @param {string} message - Warning message
   */
  function showWarningToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Show success toast
   * @param {string} message - Success message
   */
  function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #51cf66;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Cleanup function
   */
  function cleanup() {
    cancelCapture();
    closeAnnotationUI();
  }

  // Public API
  return {
    init,
    startCapture,
    cleanup,
    isRestrictedDomain
  };
})();

// Auto-initialize if not in Salesforce domain
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ScreenshotManager.init());
} else {
  ScreenshotManager.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScreenshotManager;
}
