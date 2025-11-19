/**
 * Bookmark Manager Module
 * Handles bookmark collections and bookmark management (global across all three sites)
 * @module bookmarkManager
 */

const BookmarkManager = (function() {
  'use strict';

  const STORAGE_VERSION = 1;
  const STORAGE_KEY_COLLECTIONS = 'exl_bookmark_collections';
  const STORAGE_KEY_BOOKMARKS = 'exl_bookmarks';
  const VERSION_KEY = 'exl_bookmark_storage_version';
  
  let collections = {};
  let bookmarks = {};
  let isInitialized = false;
  let isPanelOpen = false;

  /**
   * Initialize bookmark manager
   */
  async function init() {
    if (isInitialized) return;
    
    console.log('[BookmarkManager] Initializing...');
    
    await loadData();
    
    isInitialized = true;
    console.log('[BookmarkManager] Initialized with', Object.keys(collections).length, 'collections and', Object.keys(bookmarks).length, 'bookmarks');
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
   * Get storage keys with version
   */
  function getStorageKeys() {
    return {
      collections: `${STORAGE_KEY_COLLECTIONS}_v${STORAGE_VERSION}`,
      bookmarks: `${STORAGE_KEY_BOOKMARKS}_v${STORAGE_VERSION}`
    };
  }

  /**
   * Load collections and bookmarks from storage (with backward compatibility)
   */
  async function loadData() {
    return new Promise((resolve) => {
      const keys = getStorageKeys();
      const oldCollectionKey = STORAGE_KEY_COLLECTIONS;
      const oldBookmarkKey = STORAGE_KEY_BOOKMARKS;
      
      // Try new format first, then fall back to old format
      chrome.storage.local.get([
        keys.collections, keys.bookmarks,
        oldCollectionKey, oldBookmarkKey
      ], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[BookmarkManager] Error loading data:', chrome.runtime.lastError);
          collections = {};
          bookmarks = {};
          resolve();
          return;
        }
        
        // Prefer new format, fall back to old format
        collections = result[keys.collections] || result[oldCollectionKey] || {};
        bookmarks = result[keys.bookmarks] || result[oldBookmarkKey] || {};
        
        if ((result[oldCollectionKey] || result[oldBookmarkKey]) && 
            (!result[keys.collections] && !result[keys.bookmarks])) {
          console.log('[BookmarkManager] Loaded data from old format, migration will handle upgrade');
        }
        
        resolve();
      });
    });
  }

  /**
   * Save collections to storage
   */
  async function saveCollections() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY_COLLECTIONS]: collections }, () => {
        if (chrome.runtime.lastError) {
          console.error('[BookmarkManager] Error saving collections:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  /**
   * Save bookmarks to storage
   */
  async function saveBookmarks() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY_BOOKMARKS]: bookmarks }, () => {
        if (chrome.runtime.lastError) {
          console.error('[BookmarkManager] Error saving bookmarks:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  /**
   * Create a new collection
   */
  async function createCollection(name) {
    if (!name || !name.trim()) {
      showToast('Collection name cannot be empty');
      return null;
    }

    const collectionId = 'col_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    collections[collectionId] = {
      id: collectionId,
      name: name.trim(),
      created: Date.now(),
      bookmarkIds: []
    };

    await saveCollections();
    
    // Refresh panel if it's open
    refreshPanel();
    
    console.log('[BookmarkManager] Created collection:', collectionId);
    return collectionId;
  }

  /**
   * Rename a collection
   */
  async function renameCollection(collectionId, newName) {
    if (collections[collectionId]) {
      collections[collectionId].name = newName.trim();
      await saveCollections();
      
      // Refresh panel if it's open
      refreshPanel();
      
      console.log('[BookmarkManager] Renamed collection:', collectionId);
    }
  }

  /**
   * Delete a collection
   */
  async function deleteCollection(collectionId) {
    if (collections[collectionId]) {
      // Delete all bookmarks in collection
      const bookmarkIds = collections[collectionId].bookmarkIds;
      bookmarkIds.forEach(id => {
        delete bookmarks[id];
      });
      
      delete collections[collectionId];
      await saveCollections();
      await saveBookmarks();
      
      // Refresh panel if it's open
      refreshPanel();
      
      console.log('[BookmarkManager] Deleted collection:', collectionId);
    }
  }

  /**
   * Create a new bookmark
   */
  async function createBookmark(collectionId, title, url, description = '') {
    if (!collections[collectionId]) {
      showToast('Collection not found');
      return null;
    }

    const bookmarkId = 'bm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    bookmarks[bookmarkId] = {
      id: bookmarkId,
      title: title.trim().substring(0, 100),
      url: url.trim(),
      description: description.trim().substring(0, 200),
      collectionId,
      created: Date.now()
    };

    collections[collectionId].bookmarkIds.push(bookmarkId);

    await saveBookmarks();
    await saveCollections();
    
    // Refresh panel if it's open
    refreshPanel();
    
    console.log('[BookmarkManager] Created bookmark:', bookmarkId);
    return bookmarkId;
  }

  /**
   * Delete a bookmark
   */
  async function deleteBookmark(bookmarkId) {
    if (bookmarks[bookmarkId]) {
      const collectionId = bookmarks[bookmarkId].collectionId;
      
      // Remove from collection
      if (collections[collectionId]) {
        collections[collectionId].bookmarkIds = collections[collectionId].bookmarkIds.filter(id => id !== bookmarkId);
      }
      
      delete bookmarks[bookmarkId];
      await saveBookmarks();
      await saveCollections();
      
      // Refresh panel if it's open
      refreshPanel();
      
      console.log('[BookmarkManager] Deleted bookmark:', bookmarkId);
    }
  }

  /**
   * Get all collections
   */
  function getCollections() {
    return Object.values(collections);
  }

  /**
   * Get bookmarks for a collection
   */
  function getBookmarksByCollection(collectionId) {
    if (!collections[collectionId]) return [];
    
    return collections[collectionId].bookmarkIds
      .map(id => bookmarks[id])
      .filter(bm => bm); // Filter out undefined
  }

  /**
   * Open collections panel
   */
  function openPanel() {
    if (isPanelOpen) return;
    
    const panel = renderPanel();
    document.body.appendChild(panel);
    
    // Trigger animation
    setTimeout(() => {
      panel.classList.add('exl-hl-open');
    }, 10);
    
    isPanelOpen = true;
  }

  /**
   * Close collections panel
   */
  function closePanel() {
    const panel = document.querySelector('.exl-hl-collections-panel');
    if (panel) {
      panel.classList.remove('exl-hl-open');
      setTimeout(() => {
        panel.remove();
      }, 250);
    }
    isPanelOpen = false;
  }

  /**
   * Refresh collections panel by closing and reopening with animation
   */
  function refreshPanel() {
    if (!isPanelOpen) return;
    
    // Close the panel with animation
    closePanel();
    
    // Reopen after close animation completes
    setTimeout(() => {
      openPanel();
    }, 300); // Slightly longer than close animation (250ms) to ensure clean transition
  }

  /**
   * Render collections panel
   */
  function renderPanel() {
    const panel = document.createElement('div');
    panel.className = 'exl-hl-collections-panel';

    const header = document.createElement('div');
    header.className = 'exl-hl-panel-header';

    const title = document.createElement('h2');
    title.className = 'exl-hl-panel-title';
    title.textContent = '📚 Collections';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'exl-hl-panel-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', closePanel);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.className = 'exl-hl-panel-content';

    // New collection button
    const newCollBtn = document.createElement('button');
    newCollBtn.className = 'exl-hl-btn';
    newCollBtn.textContent = '+ New Collection';
    newCollBtn.style.marginBottom = '1rem';
    newCollBtn.addEventListener('click', showNewCollectionDialog);
    content.appendChild(newCollBtn);

    // Render collections
    Object.values(collections).forEach(collection => {
      const collEl = renderCollection(collection);
      content.appendChild(collEl);
    });

    panel.appendChild(header);
    panel.appendChild(content);

    return panel;
  }

  /**
   * Render a collection
   */
  function renderCollection(collection) {
    const collEl = document.createElement('div');
    collEl.className = 'exl-hl-collection';
    collEl.dataset.collectionId = collection.id;

    const header = document.createElement('div');
    header.className = 'exl-hl-collection-header';
    header.addEventListener('click', () => {
      collEl.classList.toggle('exl-hl-expanded');
    });

    const name = document.createElement('div');
    name.className = 'exl-hl-collection-name';
    name.textContent = collection.name;

    const count = document.createElement('span');
    count.className = 'exl-hl-collection-count';
    count.textContent = collection.bookmarkIds.length;

    header.appendChild(name);
    header.appendChild(count);

    const bookmarkList = document.createElement('div');
    bookmarkList.className = 'exl-hl-bookmark-list';

    collection.bookmarkIds.forEach(bookmarkId => {
      const bookmark = bookmarks[bookmarkId];
      if (bookmark) {
        const bookmarkEl = renderBookmark(bookmark);
        bookmarkList.appendChild(bookmarkEl);
      }
    });

    collEl.appendChild(header);
    collEl.appendChild(bookmarkList);

    // Context menu
    header.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showCollectionContextMenu(e.pageX, e.pageY, collection.id);
    });

    return collEl;
  }

  /**
   * Render a bookmark
   */
  function renderBookmark(bookmark) {
    const bookmarkEl = document.createElement('div');
    bookmarkEl.className = 'exl-hl-bookmark';
    bookmarkEl.dataset.bookmarkId = bookmark.id;

    bookmarkEl.addEventListener('click', () => {
      window.open(bookmark.url, '_blank');
    });

    const title = document.createElement('div');
    title.className = 'exl-hl-bookmark-title';
    title.textContent = bookmark.title;

    const desc = document.createElement('div');
    desc.className = 'exl-hl-bookmark-desc';
    desc.textContent = bookmark.description || 'No description';

    const url = document.createElement('div');
    url.className = 'exl-hl-bookmark-url';
    url.textContent = bookmark.url;

    bookmarkEl.appendChild(title);
    if (bookmark.description) {
      bookmarkEl.appendChild(desc);
    }
    bookmarkEl.appendChild(url);

    // Context menu
    bookmarkEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showBookmarkContextMenu(e.pageX, e.pageY, bookmark.id);
    });

    return bookmarkEl;
  }

  /**
   * Show new collection dialog
   */
  function showNewCollectionDialog() {
    const name = prompt('Enter collection name:');
    if (name) {
      createCollection(name).then(() => {
        closePanel();
        setTimeout(() => {
          openPanel();
        }, 100);
      });
    }
  }

  /**
   * Show collection context menu
   */
  function showCollectionContextMenu(x, y, collectionId) {
    const menu = createContextMenu(x, y, [
      {
        label: '✏️ Rename',
        action: () => {
          const newName = prompt('Enter new name:', collections[collectionId].name);
          if (newName) {
            renameCollection(collectionId, newName).then(() => {
              closePanel();
              setTimeout(() => openPanel(), 100);
            });
          }
        }
      },
      {
        label: '🗑️ Delete',
        action: () => {
          const count = collections[collectionId].bookmarkIds.length;
          const msg = count > 0 
            ? `Delete collection "${collections[collectionId].name}" and its ${count} bookmark(s)?`
            : `Delete collection "${collections[collectionId].name}"?`;
          
          if (confirm(msg)) {
            deleteCollection(collectionId).then(() => {
              closePanel();
              setTimeout(() => openPanel(), 100);
            });
          }
        }
      }
    ]);
  }

  /**
   * Show bookmark context menu
   */
  function showBookmarkContextMenu(x, y, bookmarkId) {
    const bookmark = bookmarks[bookmarkId];
    const menu = createContextMenu(x, y, [
      {
        label: '🔗 Copy URL',
        action: () => {
          navigator.clipboard.writeText(bookmark.url);
          showToast('URL copied to clipboard');
        }
      },
      {
        label: '🗑️ Delete',
        action: () => {
          if (confirm(`Delete bookmark "${bookmark.title}"?`)) {
            deleteBookmark(bookmarkId).then(() => {
              closePanel();
              setTimeout(() => openPanel(), 100);
            });
          }
        }
      }
    ]);
  }

  /**
   * Create generic context menu
   */
  function createContextMenu(x, y, items) {
    // Remove existing menu
    document.querySelectorAll('.exl-hl-context-menu').forEach(m => m.remove());

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
      z-index: 1000001;
      font-family: Inter, sans-serif;
      font-size: 14px;
      min-width: 150px;
    `;

    items.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.textContent = item.label;
      menuItem.style.cssText = `
        padding: 0.5rem 1rem;
        cursor: pointer;
        white-space: nowrap;
      `;
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.background = '#f5f5f5';
      });
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.background = 'transparent';
      });
      menuItem.addEventListener('click', () => {
        item.action();
        menu.remove();
      });
      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    // Close on click outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 100);

    return menu;
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
   * Get all data (for export)
   */
  function getAllData() {
    const keys = getStorageKeys();
    return {
      [keys.collections]: collections,
      [keys.bookmarks]: bookmarks
    };
  }

  /**
   * Import data
   */
  async function importData(data) {
    const keys = getStorageKeys();
    if (data[keys.collections] || data[STORAGE_KEY_COLLECTIONS]) {
      collections = data[keys.collections] || data[STORAGE_KEY_COLLECTIONS];
      await saveCollections();
    }
    if (data[keys.bookmarks] || data[STORAGE_KEY_BOOKMARKS]) {
      bookmarks = data[keys.bookmarks] || data[STORAGE_KEY_BOOKMARKS];
      await saveBookmarks();
    }
    console.log('[BookmarkManager] Imported data');
  }

  /**
   * Cleanup
   */
  function cleanup() {
    closePanel();
    document.querySelectorAll('.exl-hl-context-menu').forEach(m => m.remove());
    isInitialized = false;
    console.log('[BookmarkManager] Cleaned up');
  }

  return {
    init,
    createCollection,
    createBookmark,
    getCollections,
    getBookmarksByCollection,
    openPanel,
    closePanel,
    getAllData,
    importData,
    cleanup
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookmarkManager;
}
