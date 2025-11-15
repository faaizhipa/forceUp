/**
 * Layer Manager Module
 * Handles layer creation, switching, renaming, deletion, and persistence
 * @module layerManager
 */

const LayerManager = (function() {
  'use strict';

  const STORAGE_KEY_PREFIX = 'exl_layers_';
  const ACTIVE_LAYER_KEY = 'exl_active_layer';
  
  let layers = {};
  let activeLayerId = null;
  let isInitialized = false;

  /**
   * Initialize layer manager
   */
  async function init() {
    if (isInitialized) return;
    
    console.log('[LayerManager] Initializing...');
    
    await loadLayers();
    await loadActiveLayer();
    
    // Ensure at least one layer exists
    if (Object.keys(layers).length === 0) {
      await createLayer('Layer 1');
    }
    
    // Ensure we have an active layer
    if (!activeLayerId || !layers[activeLayerId]) {
      const firstLayerId = Object.keys(layers)[0];
      await setActiveLayer(firstLayerId);
    }
    
    isInitialized = true;
    console.log('[LayerManager] Initialized with', Object.keys(layers).length, 'layers');
    console.log('[LayerManager] Active layer:', activeLayerId);
  }

  /**
   * Get storage key for layers (per URL)
   */
  function getStorageKey() {
    return STORAGE_KEY_PREFIX + window.location.href;
  }

  /**
   * Load layers from storage
   */
  async function loadLayers() {
    return new Promise((resolve) => {
      const key = getStorageKey();
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[LayerManager] Error loading layers:', chrome.runtime.lastError);
          layers = {};
          resolve();
          return;
        }
        
        layers = result[key] || {};
        console.log('[LayerManager] Loaded', Object.keys(layers).length, 'layers');
        resolve();
      });
    });
  }

  /**
   * Save layers to storage
   */
  async function saveLayers() {
    return new Promise((resolve) => {
      const key = getStorageKey();
      chrome.storage.local.set({ [key]: layers }, () => {
        if (chrome.runtime.lastError) {
          console.error('[LayerManager] Error saving layers:', chrome.runtime.lastError);
        } else {
          console.log('[LayerManager] Saved', Object.keys(layers).length, 'layers');
        }
        resolve();
      });
    });
  }

  /**
   * Load active layer ID from storage
   */
  async function loadActiveLayer() {
    return new Promise((resolve) => {
      const key = ACTIVE_LAYER_KEY + '_' + window.location.href;
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[LayerManager] Error loading active layer:', chrome.runtime.lastError);
          activeLayerId = null;
          resolve();
          return;
        }
        
        activeLayerId = result[key] || null;
        console.log('[LayerManager] Loaded active layer:', activeLayerId);
        resolve();
      });
    });
  }

  /**
   * Save active layer ID to storage
   */
  async function saveActiveLayer() {
    return new Promise((resolve) => {
      const key = ACTIVE_LAYER_KEY + '_' + window.location.href;
      chrome.storage.local.set({ [key]: activeLayerId }, () => {
        if (chrome.runtime.lastError) {
          console.error('[LayerManager] Error saving active layer:', chrome.runtime.lastError);
        } else {
          console.log('[LayerManager] Saved active layer:', activeLayerId);
        }
        resolve();
      });
    });
  }

  /**
   * Create a new layer
   */
  async function createLayer(name = null) {
    const layerId = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Auto-generate name if not provided
    if (!name) {
      const layerCount = Object.keys(layers).length + 1;
      name = `Layer ${layerCount}`;
    }
    
    layers[layerId] = {
      id: layerId,
      name: name.trim(),
      created: Date.now(),
      modified: Date.now()
    };

    await saveLayers();
    console.log('[LayerManager] Created layer:', layerId, name);
    
    return layerId;
  }

  /**
   * Rename a layer
   */
  async function renameLayer(layerId, newName) {
    if (!layers[layerId]) {
      console.warn('[LayerManager] Layer not found for rename:', layerId);
      return false;
    }

    if (!newName || newName.trim() === '') {
      console.warn('[LayerManager] Invalid layer name');
      return false;
    }

    layers[layerId].name = newName.trim();
    layers[layerId].modified = Date.now();
    
    await saveLayers();
    console.log('[LayerManager] Renamed layer:', layerId, 'to', newName);
    
    return true;
  }

  /**
   * Delete a layer
   */
  async function deleteLayer(layerId) {
    // Prevent deletion of last layer
    if (Object.keys(layers).length === 1) {
      console.warn('[LayerManager] Cannot delete last layer');
      return false;
    }

    if (!layers[layerId]) {
      console.warn('[LayerManager] Layer not found for deletion:', layerId);
      return false;
    }

    delete layers[layerId];
    
    // If deleted layer was active, switch to another layer
    if (activeLayerId === layerId) {
      const remainingLayerIds = Object.keys(layers);
      await setActiveLayer(remainingLayerIds[0]);
    }
    
    await saveLayers();
    console.log('[LayerManager] Deleted layer:', layerId);
    
    return true;
  }

  /**
   * Set active layer
   */
  async function setActiveLayer(layerId) {
    if (!layers[layerId]) {
      console.warn('[LayerManager] Cannot set active layer - layer not found:', layerId);
      return false;
    }

    activeLayerId = layerId;
    await saveActiveLayer();
    
    console.log('[LayerManager] Active layer set to:', layerId);
    return true;
  }

  /**
   * Get active layer ID
   */
  function getActiveLayerId() {
    return activeLayerId;
  }

  /**
   * Get active layer object
   */
  function getActiveLayer() {
    return layers[activeLayerId] || null;
  }

  /**
   * Get all layers
   */
  function getAllLayers() {
    return Object.values(layers).sort((a, b) => a.created - b.created);
  }

  /**
   * Get layer by ID
   */
  function getLayer(layerId) {
    return layers[layerId] || null;
  }

  /**
   * Get layer count
   */
  function getLayerCount() {
    return Object.keys(layers).length;
  }

  /**
   * Export layers data
   */
  function exportLayers() {
    return {
      layers: layers,
      activeLayerId: activeLayerId
    };
  }

  /**
   * Import layers data
   */
  async function importLayers(data) {
    if (data.layers) {
      layers = data.layers;
      await saveLayers();
    }
    
    if (data.activeLayerId && layers[data.activeLayerId]) {
      await setActiveLayer(data.activeLayerId);
    }
    
    console.log('[LayerManager] Imported', Object.keys(layers).length, 'layers');
  }

  /**
   * Cleanup
   */
  function cleanup() {
    layers = {};
    activeLayerId = null;
    isInitialized = false;
    console.log('[LayerManager] Cleaned up');
  }

  return {
    init,
    createLayer,
    renameLayer,
    deleteLayer,
    setActiveLayer,
    getActiveLayerId,
    getActiveLayer,
    getAllLayers,
    getLayer,
    getLayerCount,
    exportLayers,
    importLayers,
    cleanup
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LayerManager;
}
