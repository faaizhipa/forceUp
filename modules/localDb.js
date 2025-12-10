/**
 * LocalDb
 * IndexedDB-based persistence for shareable entities (highlights, notes, bookmarks, collections, settings).
 * Provides CRUD helpers plus import/export for interoperability.
 */

const LocalDb = (function() {
  'use strict';

  const DB_NAME = 'ExLibrisLocalDB';
  const DB_VERSION = 1;

  /**
   * Object store definitions. Each store uses a simple primary key plus useful indexes.
   * Keys are string-serialised to make export/import straightforward.
   */
  const STORES = {
    highlights: {
      keyPath: 'id',
      indexes: [
        { name: 'by_url', keyPath: 'pageUrl', options: { unique: false } },
        { name: 'by_layer', keyPath: 'layerId', options: { unique: false } },
        { name: 'by_updated', keyPath: 'updatedAt', options: { unique: false } }
      ]
    },
    notes: {
      keyPath: 'id',
      indexes: [
        { name: 'by_url', keyPath: 'pageUrl', options: { unique: false } },
        { name: 'by_updated', keyPath: 'updatedAt', options: { unique: false } }
      ]
    },
    bookmarks: {
      keyPath: 'id',
      indexes: [
        { name: 'by_url', keyPath: 'url', options: { unique: false } },
        { name: 'by_tag', keyPath: 'tags', options: { unique: false, multiEntry: true } },
        { name: 'by_updated', keyPath: 'updatedAt', options: { unique: false } }
      ]
    },
    collections: {
      keyPath: 'id',
      indexes: [
        { name: 'by_name', keyPath: 'name', options: { unique: false } },
        { name: 'by_updated', keyPath: 'updatedAt', options: { unique: false } }
      ]
    },
    settings: {
      keyPath: 'key',
      indexes: [
        { name: 'by_updated', keyPath: 'updatedAt', options: { unique: false } }
      ]
    }
  };

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        Object.entries(STORES).forEach(([storeName, def]) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: def.keyPath });
            def.indexes.forEach((idx) => {
              store.createIndex(idx.name, idx.keyPath, idx.options);
            });
          }
        });
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });

    return dbPromise;
  }

  function tx(storeName, mode = 'readonly') {
    return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function toPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function normalizeEntity(entity, defaults = {}) {
    const now = Date.now();
    return {
      ...defaults,
      ...entity,
      updatedAt: entity?.updatedAt || now
    };
  }

  async function put(storeName, entity) {
    const store = await tx(storeName, 'readwrite');
    const normalized = normalizeEntity(entity);
    return toPromise(store.put(normalized));
  }

  async function bulkPut(storeName, entities = []) {
    const store = await tx(storeName, 'readwrite');
    await Promise.all(entities.map((item) => toPromise(store.put(normalizeEntity(item)))));
  }

  async function get(storeName, id) {
    const store = await tx(storeName, 'readonly');
    return toPromise(store.get(id));
  }

  async function getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return toPromise(store.getAll());
  }

  async function deleteById(storeName, id) {
    const store = await tx(storeName, 'readwrite');
    return toPromise(store.delete(id));
  }

  async function clearStore(storeName) {
    const store = await tx(storeName, 'readwrite');
    return toPromise(store.clear());
  }

  async function exportEntities(storeNames = Object.keys(STORES)) {
    const payload = {};
    for (const name of storeNames) {
      // eslint-disable-next-line no-await-in-loop
      payload[name] = await getAll(name);
    }
    return {
      version: DB_VERSION,
      exportedAt: Date.now(),
      stores: payload
    };
  }

  async function importEntities(json, { merge = true } = {}) {
    if (!json || typeof json !== 'object' || !json.stores) return false;
    const storeNames = Object.keys(STORES).filter((name) => json.stores[name]);

    for (const name of storeNames) {
      const records = Array.isArray(json.stores[name]) ? json.stores[name] : [];
      if (!merge) {
        // eslint-disable-next-line no-await-in-loop
        await clearStore(name);
      }
      // eslint-disable-next-line no-await-in-loop
      await bulkPut(name, records);
    }

    return true;
  }

  return {
    openDb,
    putHighlight: (entity) => put('highlights', entity),
    getHighlight: (id) => get('highlights', id),
    getAllHighlights: () => getAll('highlights'),
    deleteHighlight: (id) => deleteById('highlights', id),

    putNote: (entity) => put('notes', entity),
    getNote: (id) => get('notes', id),
    getAllNotes: () => getAll('notes'),
    deleteNote: (id) => deleteById('notes', id),

    putBookmark: (entity) => put('bookmarks', entity),
    getBookmark: (id) => get('bookmarks', id),
    getAllBookmarks: () => getAll('bookmarks'),
    deleteBookmark: (id) => deleteById('bookmarks', id),

    putCollection: (entity) => put('collections', entity),
    getCollection: (id) => get('collections', id),
    getAllCollections: () => getAll('collections'),
    deleteCollection: (id) => deleteById('collections', id),

    putSetting: (entity) => put('settings', entity),
    getSetting: (key) => get('settings', key),
    getAllSettings: () => getAll('settings'),
    deleteSetting: (key) => deleteById('settings', key),

    clearStore,
    exportEntities,
    importEntities
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalDb;
}
