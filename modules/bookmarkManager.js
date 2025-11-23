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
   * Validate URL format
   * Accepts any valid URL (http, https, file, ftp, etc.)
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid URL
   */
  function isValidUrl(url) {
    if (!url || !url.trim()) return false;
    
    try {
      new URL(url.trim());
      return true;
    } catch (error) {
      return false;
    }
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
   * Update a bookmark
   * @param {string} bookmarkId - Bookmark ID
   * @param {Object} updates - Object with title, url, description fields
   */
  async function updateBookmark(bookmarkId, updates) {
    if (!bookmarks[bookmarkId]) {
      showToast('Bookmark not found');
      return false;
    }

    if (updates.title !== undefined) {
      bookmarks[bookmarkId].title = updates.title.trim().substring(0, 100);
    }
    if (updates.url !== undefined) {
      if (!isValidUrl(updates.url)) {
        showToast('Invalid URL format');
        return false;
      }
      bookmarks[bookmarkId].url = updates.url.trim();
    }
    if (updates.description !== undefined) {
      bookmarks[bookmarkId].description = updates.description.trim().substring(0, 200);
    }

    await saveBookmarks();
    
    // Refresh panel if it's open
    refreshPanel();
    
    console.log('[BookmarkManager] Updated bookmark:', bookmarkId);
    return true;
  }

  /**
   * Duplicate a bookmark
   * @param {string} bookmarkId - Bookmark ID to duplicate
   */
  async function duplicateBookmark(bookmarkId) {
    const bookmark = bookmarks[bookmarkId];
    if (!bookmark) {
      showToast('Bookmark not found');
      return null;
    }

    const newBookmarkId = 'bm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    bookmarks[newBookmarkId] = {
      id: newBookmarkId,
      title: bookmark.title + ' (Copy)',
      url: bookmark.url,
      description: bookmark.description,
      collectionId: bookmark.collectionId,
      created: Date.now()
    };

    collections[bookmark.collectionId].bookmarkIds.push(newBookmarkId);

    await saveBookmarks();
    await saveCollections();
    
    // Refresh panel if it's open
    refreshPanel();
    
    console.log('[BookmarkManager] Duplicated bookmark:', newBookmarkId);
    return newBookmarkId;
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
   * Render a collection with drag-and-drop support
   */
  function renderCollection(collection) {
    const collEl = document.createElement('div');
    collEl.className = 'exl-hl-collection';
    collEl.dataset.collectionId = collection.id;

    // Drag-and-drop handlers for collection (drop target)
    collEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      collEl.classList.add('exl-drop-active');
    });

    collEl.addEventListener('dragleave', (e) => {
      // Only remove if leaving the collection element itself
      if (e.target === collEl) {
        collEl.classList.remove('exl-drop-active');
      }
    });

    collEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      collEl.classList.remove('exl-drop-active');
      
      const bookmarkId = e.dataTransfer.getData('text/plain');
      if (!bookmarkId || !bookmarks[bookmarkId]) return;
      
      const bookmark = bookmarks[bookmarkId];
      const oldCollectionId = bookmark.collectionId;
      const newCollectionId = collection.id;
      
      if (oldCollectionId === newCollectionId) {
        console.log('[BookmarkManager] Bookmark already in this collection');
        return;
      }
      
      // Move bookmark to new collection
      console.log('[BookmarkManager] Moving bookmark', bookmarkId, 'from', oldCollectionId, 'to', newCollectionId);
      
      // Remove from old collection
      if (collections[oldCollectionId]) {
        collections[oldCollectionId].bookmarkIds = collections[oldCollectionId].bookmarkIds.filter(id => id !== bookmarkId);
      }
      
      // Add to new collection
      bookmark.collectionId = newCollectionId;
      collections[newCollectionId].bookmarkIds.push(bookmarkId);
      
      await saveBookmarks();
      await saveCollections();
      
      refreshPanel();
      showToast('Bookmark moved');
    });

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
   * Render a bookmark with drag-drop and action buttons
   */
  function renderBookmark(bookmark) {
    const bookmarkEl = document.createElement('div');
    bookmarkEl.className = 'exl-hl-bookmark';
    bookmarkEl.dataset.bookmarkId = bookmark.id;
    bookmarkEl.draggable = true;

    // Drag-and-drop handlers
    bookmarkEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', bookmark.id);
      bookmarkEl.classList.add('exl-dragging');
      console.log('[BookmarkManager] Drag started:', bookmark.id);
    });

    bookmarkEl.addEventListener('dragend', (e) => {
      bookmarkEl.classList.remove('exl-dragging');
      // Remove drop-active class from all collections
      document.querySelectorAll('.exl-hl-collection').forEach(col => {
        col.classList.remove('exl-drop-active');
      });
    });

    const content = document.createElement('div');
    content.className = 'exl-hl-bookmark-content';
    content.addEventListener('click', () => {
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

    content.appendChild(title);
    if (bookmark.description) {
      content.appendChild(desc);
    }
    content.appendChild(url);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'exl-hl-bookmark-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'exl-hl-bookmark-action-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit bookmark';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEditBookmarkDialog(bookmark.id);
    });

    const duplicateBtn = document.createElement('button');
    duplicateBtn.className = 'exl-hl-bookmark-action-btn';
    duplicateBtn.innerHTML = '📋';
    duplicateBtn.title = 'Duplicate bookmark';
    duplicateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateBookmark(bookmark.id).then(() => {
        showToast('Bookmark duplicated');
      });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'exl-hl-bookmark-action-btn exl-hl-bookmark-delete-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete bookmark';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete bookmark "${bookmark.title}"?`)) {
        deleteBookmark(bookmark.id).then(() => {
          showToast('Bookmark deleted');
        });
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(duplicateBtn);
    actions.appendChild(deleteBtn);

    bookmarkEl.appendChild(content);
    bookmarkEl.appendChild(actions);

    // Context menu (legacy support)
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
        label: '➕ Add Bookmark',
        action: () => {
          showAddBookmarkDialog(collectionId);
        }
      },
      {
        label: '✏️ Rename',
        action: () => {
          const newName = prompt('Enter new name:', collections[collectionId].name);
          if (newName) {
            renameCollection(collectionId, newName).then(() => {
              refreshPanel();
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
              showToast('Collection deleted');
            });
          }
        }
      }
    ]);
  }

  /**
   * Show edit bookmark dialog
   * @param {string} bookmarkId - Bookmark ID to edit
   */
  function showEditBookmarkDialog(bookmarkId) {
    const bookmark = bookmarks[bookmarkId];
    if (!bookmark) {
      showToast('Bookmark not found');
      return;
    }

    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'exl-bookmark-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000002;
    `;

    const content = document.createElement('div');
    content.className = 'exl-bookmark-modal-content';
    content.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 500px;
      width: 90%;
    `;

    content.innerHTML = `
      <h3 style="margin: 0 0 1rem 0;">Edit Bookmark</h3>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Title:</label>
        <input type="text" id="edit-bookmark-title" value="${bookmark.title}" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;" maxlength="100">
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">URL:</label>
        <input type="url" id="edit-bookmark-url" value="${bookmark.url}" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Description:</label>
        <textarea id="edit-bookmark-desc" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 80px;" maxlength="200">${bookmark.description || ''}</textarea>
      </div>
      <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
        <button id="edit-bookmark-cancel" style="padding: 0.5rem 1rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
        <button id="edit-bookmark-save" style="padding: 0.5rem 1rem; border: none; background: #0070d2; color: white; border-radius: 4px; cursor: pointer; font-weight: 600;">Save</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Event handlers
    const titleInput = content.querySelector('#edit-bookmark-title');
    const urlInput = content.querySelector('#edit-bookmark-url');
    const descInput = content.querySelector('#edit-bookmark-desc');
    const cancelBtn = content.querySelector('#edit-bookmark-cancel');
    const saveBtn = content.querySelector('#edit-bookmark-save');

    const closeModal = () => {
      modal.remove();
    };

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    saveBtn.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      const description = descInput.value.trim();

      if (!title) {
        showToast('Title cannot be empty');
        return;
      }

      if (!url || !isValidUrl(url)) {
        showToast('Please enter a valid URL');
        return;
      }

      const success = await updateBookmark(bookmarkId, { title, url, description });
      if (success) {
        showToast('Bookmark updated');
        closeModal();
      }
    });
  }

  /**
   * Show add bookmark dialog for a collection
   * @param {string} collectionId - Collection ID
   */
  function showAddBookmarkDialog(collectionId) {
    if (!collections[collectionId]) {
      showToast('Collection not found');
      return;
    }

    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'exl-bookmark-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000002;
    `;

    const content = document.createElement('div');
    content.className = 'exl-bookmark-modal-content';
    content.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 500px;
      width: 90%;
    `;

    content.innerHTML = `
      <h3 style="margin: 0 0 1rem 0;">Add Bookmark to "${collections[collectionId].name}"</h3>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Title:</label>
        <input type="text" id="add-bookmark-title" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;" maxlength="100">
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">URL:</label>
        <input type="url" id="add-bookmark-url" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;" placeholder="https://example.com">
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Description (optional):</label>
        <textarea id="add-bookmark-desc" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 80px;" maxlength="200"></textarea>
      </div>
      <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
        <button id="add-bookmark-cancel" style="padding: 0.5rem 1rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
        <button id="add-bookmark-save" style="padding: 0.5rem 1rem; border: none; background: #0070d2; color: white; border-radius: 4px; cursor: pointer; font-weight: 600;">Add</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Event handlers
    const titleInput = content.querySelector('#add-bookmark-title');
    const urlInput = content.querySelector('#add-bookmark-url');
    const descInput = content.querySelector('#add-bookmark-desc');
    const cancelBtn = content.querySelector('#add-bookmark-cancel');
    const saveBtn = content.querySelector('#add-bookmark-save');

    const closeModal = () => {
      modal.remove();
    };

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    saveBtn.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      const description = descInput.value.trim();

      if (!title) {
        showToast('Title cannot be empty');
        return;
      }

      if (!url || !isValidUrl(url)) {
        showToast('Please enter a valid URL');
        return;
      }

      await createBookmark(collectionId, title, url, description);
      showToast('Bookmark added');
      closeModal();
    });
  }

  /**
   * Show bookmark context menu
   */
  function showBookmarkContextMenu(x, y, bookmarkId) {
    const bookmark = bookmarks[bookmarkId];
    const menu = createContextMenu(x, y, [
      {
        label: '✏️ Edit',
        action: () => {
          showEditBookmarkDialog(bookmarkId);
        }
      },
      {
        label: '📋 Duplicate',
        action: () => {
          duplicateBookmark(bookmarkId).then(() => {
            showToast('Bookmark duplicated');
          });
        }
      },
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
              showToast('Bookmark deleted');
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
    updateBookmark,
    duplicateBookmark,
    deleteBookmark,
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
