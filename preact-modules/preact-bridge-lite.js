// Lightweight Preact bridge focused on the WorldMap only.
// Avoids external CDN dependencies that violate Salesforce CSP.
import { render, html } from './preact-setup.js';
import { WorldMap } from './WorldMap.js';

function ensureDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

const PreactBridgeLite = {
  mountWorldMap(container, config = {}) {
    if (!container) {
      console.error('[PreactBridgeLite] container is required for mountWorldMap');
      return () => {};
    }

    const { currentTime, pins = [], className = '' } = config;

    render(
      html`<${WorldMap}
        currentTime=${ensureDate(currentTime)}
        pins=${pins}
        className=${className}
      />`,
      container
    );

    return () => render(null, container);
  },

  updateWorldMap(container, config = {}) {
    if (!container) {
      console.warn('[PreactBridgeLite] updateWorldMap called without container');
      return;
    }

    const { currentTime, pins = [], className = '' } = config;

    render(
      html`<${WorldMap}
        currentTime=${ensureDate(currentTime)}
        pins=${pins}
        className=${className}
      />`,
      container
    );
  },

  unmount(container) {
    if (container) {
      render(null, container);
    }
  }
};

export default PreactBridgeLite;

if (typeof window !== 'undefined') {
  window.PreactBridge = PreactBridgeLite;
}
