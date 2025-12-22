/**
 * Preact Bridge - Connect Preact Components with Vanilla JS
 * 
 * This bridge allows vanilla JS modules (like globalSyncWidget.js) to use
 * Preact components (like WorldMap) without requiring vanilla modules to
 * understand Preact.
 * 
 * Usage in vanilla JS:
 * ```js
 * const container = document.getElementById('map-container')
 * PreactBridge.mountWorldMap(container, {
 *   currentTime: new Date(),
 *   pins: [{ timezone: 'America/New_York', label: 'NYC' }]
 * })
 * ```
 */

import { render, html } from './preact-setup.js'
import { WorldMap } from './WorldMap.js'
import { GlobalSyncModal } from './components/GlobalSyncModal.js'
import { TimeConverter } from './components/TimeConverter.js'
import { CopyActions } from './components/CopyActions.js'

/**
 * Helper to ensure currentTime is a Date object
 * Handles ISO strings passed through DOM-based command API
 */
function ensureDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'number') return new Date(value);
  return new Date();
}

const PreactBridge = {
  /**
   * Mount WorldMap component into a DOM container
   * @param {HTMLElement} container - DOM element to render into
   * @param {Object} config - WorldMap configuration
   * @param {Date|string} config.currentTime - Current time to display (Date or ISO string)
   * @param {Array} config.pins - Array of timezone pins
   * @param {string} config.className - Optional additional classes
   * @returns {Function} Cleanup function to unmount
   */
  mountWorldMap(container, config) {
    if (!container) {
      console.error('PreactBridge.mountWorldMap: container is required')
      return () => {}
    }

    const { currentTime, pins = [], className = '' } = config

    render(
      html`<${WorldMap}
        currentTime=${ensureDate(currentTime)}
        pins=${pins}
        className=${className}
      />`,
      container
    )

    // Return cleanup function
    return () => {
      render(null, container)
    }
  },

  /**
   * Update WorldMap with new data (maintains component instance)
   * @param {HTMLElement} container - Container with mounted WorldMap
   * @param {Object} config - Updated configuration
   */
  updateWorldMap(container, config) {
    if (!container) return
    
    const { currentTime, pins = [], className = '' } = config

    render(
      html`<${WorldMap}
        currentTime=${ensureDate(currentTime)}
        pins=${pins}
        className=${className}
      />`,
      container
    )
  },

  /**
   * Mount GlobalSyncModal component
   * @param {HTMLElement} container - DOM element to render into
   * @param {Object} config - Modal configuration
   * @returns {Function} Cleanup function
   */
  mountGlobalSyncModal(container, config) {
    if (!container) {
      console.error('PreactBridge.mountGlobalSyncModal: container is required')
      return () => {}
    }

    render(
      html`<${GlobalSyncModal} ...${config} />`,
      container
    )

    return () => {
      render(null, container)
    }
  },

  /**
   * Mount TimeConverter component
   * @param {HTMLElement} container - DOM element to render into
   * @param {Object} config - TimeConverter configuration
   * @returns {Function} Cleanup function
   */
  mountTimeConverter(container, config) {
    if (!container) {
      console.error('PreactBridge.mountTimeConverter: container is required')
      return () => {}
    }

    render(
      html`<${TimeConverter} ...${config} />`,
      container
    )

    return () => {
      render(null, container)
    }
  },

  /**
   * Mount CopyActions component
   * @param {HTMLElement} container - DOM element to render into
   * @param {Object} config - CopyActions configuration
   * @returns {Function} Cleanup function
   */
  mountCopyActions(container, config) {
    if (!container) {
      console.error('PreactBridge.mountCopyActions: container is required')
      return () => {}
    }

    render(
      html`<${CopyActions} ...${config} />`,
      container
    )

    return () => {
      render(null, container)
    }
  },

  /**
   * Unmount any Preact component from a container
   * @param {HTMLElement} container - Container to unmount from
   */
  unmount(container) {
    if (container) {
      render(null, container)
    }
  }
}

// Export for ES modules
export default PreactBridge

// Also expose globally for vanilla JS scripts
if (typeof window !== 'undefined') {
  window.PreactBridge = PreactBridge
}
