/**
 * Sticky Notes Module (Enhanced with Rich Text Editor)
 * Handles note creation, dragging, editing, and persistence
 * Features: ContentEditable, formatting toolbar, image paste, lazy-loading, BroadcastChannel sync
 * @module stickyNotes
 */

const StickyNotes = (function() {
  'use strict';

  const STORAGE_PREFIX = 'exl_notes_';
  const STORAGE_VERSION = 2; // Incremented for rich text support
  const VERSION_KEY = 'exl_notes_storage_version';
  const NOTE_COLORS = [
    { id: 'yellow', name: 'Light Yellow', rgb: 'rgb(254, 252, 232)' },
    { id: 'blue', name: 'Light Blue', rgb: 'rgb(239, 246, 255)' },
    { id: 'pink', name: 'Soft Pink', rgb: 'rgb(253, 242, 248)' },
    { id: 'green', name: 'Mint Green', rgb: 'rgb(240, 253, 244)' },
    { id: 'purple', name: 'Lavender', rgb: 'rgb(245, 243, 255)' },
    { id: 'peach', name: 'Soft Peach', rgb: 'rgb(254, 240, 236)' }
  ];

  // Virtual scrolling constants
  const VIRTUAL_SCROLL_THRESHOLD = 50;
  const VISIBLE_NOTE_BUFFER = 10; // Render 10 above and 10 below viewport

  let notes = {};
  let isInitialized = false;
  let draggedNote = null;
  let resizingNote = null;
  let dragOffset = { x: 0, y: 0 };
  let resizeStart = { width: 0, height: 0, x: 0, y: 0 };
  let highestZIndex = 999998;
  let broadcastChannel = null;
  let tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  let lazyLoadObserver = null;
  let virtualScrollEnabled = false;
  let visibleNoteIds = new Set();
  let defaultNoteColor = 'yellow'; // Default color for new notes

  /**
   * Map highlighter color ID to sticky note color ID
   * Highlighter colors (1-11) → Sticky note colors
   */
  function mapHighlighterColorToNoteColor(highlighterColorId) {
    // Color mapping based on visual similarity
    const colorMap = {
      1: 'blue',   // Sky Blue → Light Blue
      2: 'blue',   // Light Blue → Light Blue
      3: 'green',  // Mint Green → Mint Green
      4: 'yellow', // Light Yellow → Light Yellow
      5: 'yellow', // Soft Yellow → Light Yellow
      6: 'peach',  // Peach → Soft Peach
      7: 'peach',  // Coral → Soft Peach
      8: 'pink',   // Pink → Soft Pink
      9: 'purple', // Lavender → Lavender
      10: 'purple', // Periwinkle → Lavender
      11: 'yellow'  // Light Gray → Light Yellow (fallback)
    };
    
    return colorMap[highlighterColorId] || 'yellow';
  }

  /**
   * Set default color for new sticky notes
   * Maps highlighter color ID to sticky note color ID
   * @param {number} highlighterColorId - Highlighter color ID (1-11)
   */
  function setDefaultColor(highlighterColorId) {
    if (typeof highlighterColorId === 'number' && highlighterColorId >= 1 && highlighterColorId <= 11) {
      defaultNoteColor = mapHighlighterColorToNoteColor(highlighterColorId);
      console.log('[StickyNotes] Default color set to:', defaultNoteColor, '(from highlighter color', highlighterColorId + ')');
    } else {
      console.warn('[StickyNotes] Invalid highlighter color ID:', highlighterColorId);
    }
  }

  /**
   * Load default color from storage
   */
  async function loadDefaultColor() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['exl_hl_current_banner_color'], (result) => {
        const colorId = result.exl_hl_current_banner_color;
        if (typeof colorId === 'number' && colorId >= 1 && colorId <= 11) {
          defaultNoteColor = mapHighlighterColorToNoteColor(colorId);
          console.log('[StickyNotes] Loaded default color from storage:', defaultNoteColor);
        }
        resolve(defaultNoteColor);
      });
    });
  }

  /**
   * Initialize sticky notes
   */
  async function init() {
    if (isInitialized) return;
    
    console.log('[StickyNotes] Initializing enhanced version...');
    
    // Wait for DOM to be ready before loading and rendering
    const domReady = await waitForDOMReady();
    if (!domReady) {
      console.warn('[StickyNotes] DOM not ready after timeout, proceeding anyway');
    }

    // Initialize keyboard blocker
    if (typeof NoteKeyboardBlocker !== 'undefined') {
      NoteKeyboardBlocker.init();
    }

    // Initialize BroadcastChannel for cross-tab sync
    initBroadcastChannel();

    // Initialize lazy-load observer
    initLazyLoadObserver();
    
    // Load default color from storage
    await loadDefaultColor();
    
    await loadNotes();
    
    // Check if virtual scrolling should be enabled
    const noteCount = Object.keys(notes).length;
    virtualScrollEnabled = noteCount > VIRTUAL_SCROLL_THRESHOLD;
    
    if (virtualScrollEnabled) {
      console.log('[StickyNotes] Virtual scrolling enabled for', noteCount, 'notes');
      setupVirtualScrolling();
    } else {
      renderNotes();
    }
    
    isInitialized = true;
    console.log('[StickyNotes] Initialized with', noteCount, 'notes');
  }

  /**
   * Wait for DOM to be ready before rendering notes
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
          console.log('[StickyNotes] DOM is ready');
          return true;
        }
      }
      // Wait 200ms before next check
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.warn('[StickyNotes] DOM readiness timeout after', maxWait, 'ms');
    return false; // Timeout
  }

  /**
   * Initialize BroadcastChannel for cross-tab synchronization
   */
  function initBroadcastChannel() {
    try {
      broadcastChannel = new BroadcastChannel('exl-notes-sync');
      
      broadcastChannel.onmessage = (event) => {
        const { type, noteId, updates, timestamp, senderId } = event.data;
        
        // Ignore messages from this tab
        if (senderId === tabId) return;
        
        console.log('[StickyNotes] Received broadcast:', type, noteId);
        
        switch (type) {
          case 'noteCreated':
            handleRemoteNoteCreated(noteId, updates);
            break;
          case 'noteUpdated':
            handleRemoteNoteUpdated(noteId, updates, timestamp);
            break;
          case 'noteDeleted':
            handleRemoteNoteDeleted(noteId);
            break;
        }
      };
      
      console.log('[StickyNotes] BroadcastChannel initialized');
    } catch (error) {
      console.warn('[StickyNotes] BroadcastChannel not supported:', error);
    }
  }

  /**
   * Broadcast note change to other tabs
   * @param {string} type - Event type (noteCreated, noteUpdated, noteDeleted)
   * @param {string} noteId - Note ID
   * @param {Object} updates - Updated note data
   */
  function broadcastChange(type, noteId, updates = null) {
    if (!broadcastChannel) return;
    
    try {
      broadcastChannel.postMessage({
        type,
        noteId,
        updates,
        timestamp: Date.now(),
        senderId: tabId
      });
    } catch (error) {
      console.warn('[StickyNotes] Broadcast failed:', error);
    }
  }

  /**
   * Handle remote note creation
   * @param {string} noteId - Note ID
   * @param {Object} noteData - Note data
   */
  function handleRemoteNoteCreated(noteId, noteData) {
    if (!notes[noteId]) {
      notes[noteId] = noteData;
      renderNote(noteData);
    }
  }

  /**
   * Handle remote note update
   * @param {string} noteId - Note ID
   * @param {Object} updates - Updated fields
   * @param {number} remoteTimestamp - Remote update timestamp
   */
  function handleRemoteNoteUpdated(noteId, updates, remoteTimestamp) {
    if (!notes[noteId]) return;
    
    const localNote = notes[noteId];
    const localEditAge = Date.now() - (localNote.lastLocalEdit || 0);
    
    // Check for conflict (local edit within last 5 seconds)
    if (localEditAge < 5000) {
      showConflictToast(noteId, localNote, updates);
      return;
    }
    
    // No conflict, apply remote changes
    Object.assign(localNote, updates);
    updateNoteDOM(noteId);
  }

  /**
   * Handle remote note deletion
   * @param {string} noteId - Note ID
   */
  function handleRemoteNoteDeleted(noteId) {
    if (notes[noteId]) {
      const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
      if (noteEl) {
        noteEl.remove();
      }
      delete notes[noteId];
    }
  }

  /**
   * Show conflict resolution toast
   * @param {string} noteId - Note ID
   * @param {Object} localNote - Local note data
   * @param {Object} remoteUpdates - Remote updates
   */
  function showConflictToast(noteId, localNote, remoteUpdates) {
    const toast = document.createElement('div');
    toast.className = 'exl-conflict-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ffc107;
      color: #000;
      padding: 16px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      max-width: 400px;
    `;

    const title = document.createElement('div');
    title.textContent = `Conflict: Note "${localNote.title || 'Untitled'}" was edited in another tab`;
    title.style.fontWeight = '500';
    title.style.marginBottom = '12px';
    toast.appendChild(title);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';

    const buttons = [
      { label: 'Keep Local', action: () => keepLocal(noteId, toast) },
      { label: 'Use Remote', action: () => useRemote(noteId, remoteUpdates, toast) },
      { label: 'Copy to Clipboard', action: () => copyAndUseRemote(noteId, localNote, remoteUpdates, toast) }
    ];

    buttons.forEach(({ label, action }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        padding: 6px 12px;
        border: none;
        background: #000;
        color: #ffc107;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        flex: 1;
      `;
      btn.addEventListener('click', action);
      buttonContainer.appendChild(btn);
    });

    toast.appendChild(buttonContainer);
    document.body.appendChild(toast);

    // Auto-resolve to "Use Remote" after 10 seconds
    const autoResolveTimeout = setTimeout(() => {
      if (toast.parentNode) {
        useRemote(noteId, remoteUpdates, toast);
      }
    }, 10000);

    toast.dataset.autoResolveTimeout = autoResolveTimeout;
  }

  /**
   * Keep local version (broadcast local changes)
   * @param {string} noteId - Note ID
   * @param {HTMLElement} toast - Toast element
   */
  function keepLocal(noteId, toast) {
    broadcastChange('noteUpdated', noteId, notes[noteId]);
    toast.remove();
    showSuccessToast('Kept local version');
  }

  /**
   * Use remote version (apply remote changes)
   * @param {string} noteId - Note ID
   * @param {Object} remoteUpdates - Remote updates
   * @param {HTMLElement} toast - Toast element
   */
  function useRemote(noteId, remoteUpdates, toast) {
    Object.assign(notes[noteId], remoteUpdates);
    updateNoteDOM(noteId);
    saveNotes();
    toast.remove();
    showSuccessToast('Applied remote version');
  }

  /**
   * Copy local content to clipboard and use remote version
   * @param {string} noteId - Note ID
   * @param {Object} localNote - Local note data
   * @param {Object} remoteUpdates - Remote updates
   * @param {HTMLElement} toast - Toast element
   */
  async function copyAndUseRemote(noteId, localNote, remoteUpdates, toast) {
    try {
      const textContent = localNote.html || localNote.content || '';
      await navigator.clipboard.writeText(textContent);
      
      Object.assign(notes[noteId], remoteUpdates);
      updateNoteDOM(noteId);
      saveNotes();
      toast.remove();
      showSuccessToast('Local content copied to clipboard, applied remote version');
    } catch (error) {
      console.error('[StickyNotes] Clipboard copy failed:', error);
      showWarningToast('Failed to copy to clipboard');
    }
  }

  /**
   * Update note DOM without full re-render
   * @param {string} noteId - Note ID
   */
  function updateNoteDOM(noteId) {
    const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
    if (!noteEl) return;

    const note = notes[noteId];
    const editor = noteEl.querySelector('.exl-hl-note-editor');
    const titleInput = noteEl.querySelector('.exl-hl-note-title-input');

    if (editor && note.html) {
      editor.innerHTML = sanitizeHTML(note.html);
    }
    if (titleInput && note.title) {
      titleInput.value = note.title;
    }
  }

  /**
   * Initialize IntersectionObserver for lazy-loading images
   */
  function initLazyLoadObserver() {
    if ('IntersectionObserver' in window) {
      lazyLoadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              img.classList.remove('exl-lazy-img');
              lazyLoadObserver.unobserve(img);
            }
          }
        });
      }, {
        rootMargin: '200px' // Load images 200px before they enter viewport
      });
      
      console.log('[StickyNotes] Lazy-load observer initialized');
    }
  }

  /**
   * Setup virtual scrolling for large number of notes
   */
  function setupVirtualScrolling() {
    // Calculate visible range based on viewport
    updateVisibleNotes();

    // Throttled scroll handler
    const scrollHandler = throttle(() => {
      updateVisibleNotes();
    }, 100);

    window.addEventListener('scroll', scrollHandler);
  }

  /**
   * Update which notes are visible and should be rendered
   */
  function updateVisibleNotes() {
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;
    const newVisibleIds = new Set();

    Object.values(notes).forEach(note => {
      const noteTop = note.position.y;
      const noteBottom = noteTop + (note.size?.height || 200);

      // Check if note is in viewport with buffer
      if (noteBottom >= viewportTop - 500 && noteTop <= viewportBottom + 500) {
        newVisibleIds.add(note.id);
      }
    });

    // Render newly visible notes
    newVisibleIds.forEach(noteId => {
      if (!visibleNoteIds.has(noteId)) {
        renderNote(notes[noteId]);
      }
    });

    // Remove notes that are no longer visible
    visibleNoteIds.forEach(noteId => {
      if (!newVisibleIds.has(noteId)) {
        const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
        if (noteEl) {
          noteEl.style.display = 'none'; // Hide instead of removing for performance
        }
      }
    });

    visibleNoteIds = newVisibleIds;
  }

  /**
   * Throttle function
   * @param {Function} func - Function to throttle
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Throttled function
   */
  function throttle(func, wait) {
    let timeout = null;
    let lastRan = 0;

    return function(...args) {
      const now = Date.now();
      
      if (!lastRan || now - lastRan >= wait) {
        func.apply(this, args);
        lastRan = now;
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          func.apply(this, args);
          lastRan = Date.now();
        }, wait - (now - lastRan));
      }
    };
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
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
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
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
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
    const layerId = typeof LayerManager !== 'undefined' 
      ? LayerManager.getActiveLayerId() 
      : 'default';
    return `${STORAGE_PREFIX}v${STORAGE_VERSION}_${layerId}_${window.location.href}`;
  }

  /**
   * Get old-format storage key (for backward compatibility)
   */
  function getOldStorageKey() {
    const layerId = typeof LayerManager !== 'undefined' 
      ? LayerManager.getActiveLayerId() 
      : 'default';
    return STORAGE_PREFIX + layerId + '_' + window.location.href;
  }

  /**
   * Load notes from storage (with backward compatibility for old format)
   */
  async function loadNotes() {
    return new Promise((resolve) => {
      const key = getStorageKey();
      const oldKey = getOldStorageKey();
      
      // Try new format first, then fall back to old format
      chrome.storage.local.get([key, oldKey], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[StickyNotes] Error loading notes:', chrome.runtime.lastError);
          notes = {};
          resolve();
          return;
        }
        
        // Prefer new format, fall back to old format
        notes = result[key] || result[oldKey] || {};
        
        if (result[oldKey] && !result[key]) {
          console.log('[StickyNotes] Loaded notes from old format, migration will handle upgrade');
        }
        
        console.log('[StickyNotes] Loaded', Object.keys(notes).length, 'notes');
        resolve();
      });
    });
  }

  /**
   * Save notes to storage
   */
  async function saveNotes() {
    return new Promise((resolve) => {
      const key = getStorageKey();
      chrome.storage.local.set({ [key]: notes }, () => {
        if (chrome.runtime.lastError) {
          console.error('[StickyNotes] Error saving notes:', chrome.runtime.lastError);
        } else {
          console.log('[StickyNotes] Saved', Object.keys(notes).length, 'notes');
        }
        resolve();
      });
    });
  }

  /**
   * Create a new sticky note (Enhanced with rich text support)
   */
  async function createNote() {
    const noteId = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Position in center of viewport
    const x = window.innerWidth / 2 - 150; // 150 = half of default note width (300px)
    const y = window.innerHeight / 2 - 100; // 100 = half of default note height (200px)

    const note = {
      id: noteId,
      title: '',
      content: '', // Backward compatibility with plain text
      html: '', // New rich text content
      color: defaultNoteColor || 'yellow',
      position: { x, y },
      size: { width: 300, height: 200 }, // Default size
      isCollapsed: false,
      isHidden: false,
      timestamp: Date.now(),
      lastModified: Date.now(),
      lastLocalEdit: Date.now(),
      zIndex: ++highestZIndex
    };

    notes[noteId] = note;
    
    // Check storage quota before saving
    if (typeof StorageQuotaManager !== 'undefined') {
      const noteSize = StorageQuotaManager.estimateSize(note);
      const canStore = await StorageQuotaManager.canStoreNote(noteSize);
      if (!canStore) {
        delete notes[noteId];
        showWarningToast('Storage limit reached. Cannot create new note.');
        return null;
      }
    }
    
    await saveNotes();
    renderNote(note);
    
    // Dispatch custom event for immediate local updates
    window.dispatchEvent(new CustomEvent('exl-note-created', { 
      detail: { noteId, url: window.location.href } 
    }));
    
    // Broadcast creation to other tabs
    broadcastChange('noteCreated', noteId, note);
    
    // Focus editor
    setTimeout(() => {
      const editor = document.querySelector(`[data-note-id="${noteId}"] .exl-hl-note-editor`);
      if (editor) {
        editor.focus();
      }
    }, 100);

    console.log('[StickyNotes] Created note:', noteId);
    return noteId;
  }

  /**
   * Update note content (Enhanced with HTML support)
   */
  async function updateNote(noteId, html, plainText = '') {
    if (notes[noteId]) {
      notes[noteId].html = sanitizeHTML(html);
      notes[noteId].content = plainText; // Backward compatibility
      notes[noteId].timestamp = Date.now();
      notes[noteId].lastModified = Date.now();
      notes[noteId].lastLocalEdit = Date.now();
      
      await saveNotes();
      
      // Dispatch custom event for immediate local updates
      window.dispatchEvent(new CustomEvent('exl-note-updated', { 
        detail: { noteId, url: window.location.href } 
      }));
      
      // Broadcast update to other tabs
      broadcastChange('noteUpdated', noteId, {
        html: notes[noteId].html,
        content: notes[noteId].content,
        lastModified: notes[noteId].lastModified
      });
    }
  }

  /**
   * Update note title
   * @param {string} noteId - Note ID
   * @param {string} title - New title
   */
  async function updateNoteTitle(noteId, title) {
    if (notes[noteId]) {
      notes[noteId].title = title;
      notes[noteId].lastModified = Date.now();
      notes[noteId].lastLocalEdit = Date.now();
      
      await saveNotes();
      
      // Dispatch custom event for immediate local updates
      window.dispatchEvent(new CustomEvent('exl-note-updated', { 
        detail: { noteId, url: window.location.href } 
      }));
      
      broadcastChange('noteUpdated', noteId, { title, lastModified: notes[noteId].lastModified });
    }
  }

  /**
   * Toggle note collapsed state
   * @param {string} noteId - Note ID
   */
  async function toggleNoteCollapse(noteId) {
    if (notes[noteId]) {
      notes[noteId].isCollapsed = !notes[noteId].isCollapsed;
      notes[noteId].lastModified = Date.now();
      
      const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
      if (noteEl) {
        const body = noteEl.querySelector('.exl-hl-note-body');
        if (body) {
          body.style.display = notes[noteId].isCollapsed ? 'none' : 'block';
        }
        
        // Remove editing class when collapsed
        if (notes[noteId].isCollapsed) {
          noteEl.classList.remove('editing');
        }
      }
      
      await saveNotes();
      
      // Dispatch custom event for immediate local updates
      window.dispatchEvent(new CustomEvent('exl-note-updated', { 
        detail: { noteId, url: window.location.href } 
      }));
      
      broadcastChange('noteUpdated', noteId, { isCollapsed: notes[noteId].isCollapsed });
    }
  }

  /**
   * Toggle note hidden state
   * @param {string} noteId - Note ID
   */
  async function toggleNoteHidden(noteId) {
    if (notes[noteId]) {
      notes[noteId].isHidden = !notes[noteId].isHidden;
      notes[noteId].lastModified = Date.now();
      
      const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
      if (noteEl) {
        noteEl.style.display = notes[noteId].isHidden ? 'none' : 'block';
      }
      
      await saveNotes();
      
      // Dispatch custom event for immediate local updates
      window.dispatchEvent(new CustomEvent('exl-note-updated', { 
        detail: { noteId, url: window.location.href } 
      }));
      
      broadcastChange('noteUpdated', noteId, { isHidden: notes[noteId].isHidden });
    }
  }

  /**
   * Sanitize HTML to prevent XSS attacks
   * @param {string} html - HTML string to sanitize
   * @returns {string} Sanitized HTML
   */
  function sanitizeHTML(html) {
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'br', 'p', 'img', 'strong', 'em'],
        ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'data-src', 'class'],
        ALLOWED_CLASSES: {
          img: ['exl-lazy-img']
        }
      });
    }
    
    // Fallback: basic sanitization
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
  }

  /**
   * Update note color
   */
  async function updateNoteColor(noteId, colorId) {
    if (notes[noteId]) {
      notes[noteId].color = colorId;
      notes[noteId].timestamp = Date.now();
      notes[noteId].lastModified = Date.now();
      await saveNotes();
      
      // Update DOM
      const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
      if (noteEl) {
        NOTE_COLORS.forEach(c => {
          noteEl.classList.remove(`exl-hl-note-${c.id}`);
        });
        noteEl.classList.add(`exl-hl-note-${colorId}`);
        
        // Update selected state
        noteEl.querySelectorAll('.exl-hl-note-color-chip').forEach(chip => {
          if (chip.dataset.colorId === colorId) {
            chip.classList.add('exl-hl-selected');
          } else {
            chip.classList.remove('exl-hl-selected');
          }
        });
      }
      
      // Dispatch custom event for immediate local updates
      window.dispatchEvent(new CustomEvent('exl-note-updated', { 
        detail: { noteId, url: window.location.href } 
      }));
      
      // Broadcast update
      broadcastChange('noteUpdated', noteId, { color: colorId, lastModified: notes[noteId].lastModified });
    }
  }

  /**
   * Update note position
   */
  async function updateNotePosition(noteId, x, y) {
    if (notes[noteId]) {
      notes[noteId].position = { x, y };
      notes[noteId].timestamp = Date.now();
      notes[noteId].lastModified = Date.now();
      await saveNotes();
      
      // Dispatch custom event for immediate local updates (position updates are frequent, so debounce is handled by storage listener)
      window.dispatchEvent(new CustomEvent('exl-note-updated', { 
        detail: { noteId, url: window.location.href } 
      }));
      
      // Broadcast update (debounced to avoid too many messages during drag)
      broadcastChange('noteUpdated', noteId, { position: { x, y } });
    }
  }

  /**
   * Update note size
   * @param {string} noteId - Note ID
   * @param {number} width - New width
   * @param {number} height - New height
   */
  async function updateNoteSize(noteId, width, height) {
    if (notes[noteId]) {
      notes[noteId].size = { width, height };
      notes[noteId].lastModified = Date.now();
      await saveNotes();
      
      // Dispatch custom event for immediate local updates
      window.dispatchEvent(new CustomEvent('exl-note-updated', { 
        detail: { noteId, url: window.location.href } 
      }));
      
      broadcastChange('noteUpdated', noteId, { size: { width, height } });
    }
  }

  /**
   * Delete note
   */
  async function deleteNote(noteId) {
    const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
    if (noteEl) {
      noteEl.remove();
    }

    delete notes[noteId];
    await saveNotes();
    
    // Dispatch custom event for immediate local updates
    window.dispatchEvent(new CustomEvent('exl-note-deleted', { 
      detail: { noteId, url: window.location.href } 
    }));
    
    // Broadcast deletion
    broadcastChange('noteDeleted', noteId);
    
    console.log('[StickyNotes] Deleted note:', noteId);
  }

  /**
   * Render all notes
   */
  function renderNotes() {
    Object.values(notes).forEach(note => {
      renderNote(note);
    });
  }

  /**
   * Render a single note (Enhanced with rich text editor)
   */
  function renderNote(note) {
    // Check if already rendered
    if (document.querySelector(`[data-note-id="${note.id}"]`)) {
      return;
    }

    // Check if note should be hidden
    if (note.isHidden) {
      return;
    }

    const noteEl = document.createElement('div');
    noteEl.className = `exl-hl-note exl-hl-note-${note.color}`;
    noteEl.dataset.noteId = note.id;
    noteEl.style.left = note.position.x + 'px';
    noteEl.style.top = note.position.y + 'px';
    noteEl.style.zIndex = note.zIndex || highestZIndex;
    
    // Set size if defined
    if (note.size) {
      noteEl.style.width = note.size.width + 'px';
      noteEl.style.height = note.size.height + 'px';
    }

    // Update highest z-index
    if (note.zIndex > highestZIndex) {
      highestZIndex = note.zIndex;
    }

    // Header with controls
    const header = document.createElement('div');
    header.className = 'exl-hl-note-header-enhanced';

    // Title input (editable)
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'exl-hl-note-title-input';
    titleInput.placeholder = 'Untitled';
    titleInput.value = note.title || '';
    titleInput.addEventListener('input', (e) => {
      updateNoteTitle(note.id, e.target.value);
    });
    titleInput.addEventListener('mousedown', (e) => e.stopPropagation());

    // Header controls container
    const controls = document.createElement('div');
    controls.className = 'exl-hl-note-controls';

    // Color picker dropdown
    const colorBtn = document.createElement('button');
    colorBtn.className = 'exl-hl-note-control-btn';
    colorBtn.innerHTML = '🎨';
    colorBtn.title = 'Change color';
    colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleColorPicker(note.id);
    });

    // Collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'exl-hl-note-control-btn';
    collapseBtn.innerHTML = note.isCollapsed ? '▼' : '▲';
    collapseBtn.title = note.isCollapsed ? 'Expand' : 'Collapse';
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNoteCollapse(note.id);
      collapseBtn.innerHTML = !note.isCollapsed ? '▼' : '▲';
      collapseBtn.title = !note.isCollapsed ? 'Expand' : 'Collapse';
    });

    // Hide button
    const hideBtn = document.createElement('button');
    hideBtn.className = 'exl-hl-note-control-btn';
    hideBtn.innerHTML = '👁';
    hideBtn.title = 'Hide note';
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNoteHidden(note.id);
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'exl-hl-note-control-btn exl-hl-note-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete note';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this note?')) {
        deleteNote(note.id);
      }
    });

    controls.appendChild(colorBtn);
    controls.appendChild(collapseBtn);
    controls.appendChild(hideBtn);
    controls.appendChild(deleteBtn);

    header.appendChild(titleInput);
    header.appendChild(controls);

    // Color picker (hidden by default)
    const colorPicker = document.createElement('div');
    colorPicker.className = 'exl-hl-note-colors';
    colorPicker.style.display = 'none';
    
    NOTE_COLORS.forEach(color => {
      const chip = document.createElement('div');
      chip.className = 'exl-hl-note-color-chip';
      chip.dataset.colorId = color.id;
      chip.style.background = color.rgb;
      if (color.id === note.color) {
        chip.classList.add('exl-hl-selected');
      }
      chip.addEventListener('click', () => {
        updateNoteColor(note.id, color.id);
        colorPicker.style.display = 'none';
      });
      colorPicker.appendChild(chip);
    });

    // Note body
    const body = document.createElement('div');
    body.className = 'exl-hl-note-body';
    body.style.display = note.isCollapsed ? 'none' : 'block';

    // Formatting toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'exl-hl-note-toolbar';

    const toolbarButtons = [
      { command: 'bold', icon: 'B', title: 'Bold' },
      { command: 'italic', icon: 'I', title: 'Italic' },
      { command: 'underline', icon: 'U', title: 'Underline' },
      { command: 'insertUnorderedList', icon: '•', title: 'Bullet List' },
      { command: 'createLink', icon: '🔗', title: 'Insert Link' },
      { command: 'removeFormat', icon: '🚫', title: 'Remove Format' }
    ];

    toolbarButtons.forEach(({ command, icon, title }) => {
      const btn = document.createElement('button');
      btn.className = 'exl-hl-note-toolbar-btn';
      btn.innerHTML = icon;
      btn.title = title;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (command === 'createLink') {
          const url = prompt('Enter URL:');
          if (url) {
            document.execCommand(command, false, url);
          }
        } else {
          document.execCommand(command, false, null);
        }
        
        // Update note content
        const editor = noteEl.querySelector('.exl-hl-note-editor');
        if (editor) {
          updateNote(note.id, editor.innerHTML, editor.textContent);
        }
      });
      toolbar.appendChild(btn);
    });

    // ContentEditable editor
    const editor = document.createElement('div');
    editor.className = 'exl-hl-note-editor';
    editor.contentEditable = 'true';
    editor.setAttribute('data-placeholder', 'Type your note here...');
    
    // Set content (prefer HTML, fallback to plain text)
    if (note.html) {
      editor.innerHTML = sanitizeHTML(note.html);
    } else if (note.content) {
      editor.textContent = note.content;
    }

        // Handle content changes
        editor.addEventListener('input', () => {
          updateNote(note.id, editor.innerHTML, editor.textContent);
        });

        // Handle image paste
        editor.addEventListener('paste', (e) => {
          handlePaste(e, note.id, editor);
        });

        // Handle focus/blur for editing state and keyboard shortcut blocking
        editor.addEventListener('focus', () => {
          // Add editing class to show controls and toolbar
          noteEl.classList.add('editing');
          
          if (typeof NoteKeyboardBlocker !== 'undefined') {
            NoteKeyboardBlocker.blockShortcutsForElement(editor);
          }
        });
        
        editor.addEventListener('blur', () => {
          // Remove editing class after a short delay to allow toolbar button clicks
          setTimeout(() => {
            // Check if editor is still not focused (user clicked outside)
            if (document.activeElement !== editor && !noteEl.contains(document.activeElement)) {
              noteEl.classList.remove('editing');
            }
          }, 200);
          
          if (typeof NoteKeyboardBlocker !== 'undefined') {
            NoteKeyboardBlocker.unblockShortcutsForElement(editor);
          }
        });

        // Handle title input focus/blur for editing state and keyboard shortcut blocking
        titleInput.addEventListener('focus', () => {
          // Add editing class when title is focused
          noteEl.classList.add('editing');
          
          if (typeof NoteKeyboardBlocker !== 'undefined') {
            NoteKeyboardBlocker.blockShortcutsForElement(titleInput);
          }
        });
        
        titleInput.addEventListener('blur', () => {
          // Remove editing class after a short delay
          setTimeout(() => {
            // Check if editor or title is still not focused
            if (document.activeElement !== editor && document.activeElement !== titleInput && !noteEl.contains(document.activeElement)) {
              noteEl.classList.remove('editing');
            }
          }, 200);
          
          if (typeof NoteKeyboardBlocker !== 'undefined') {
            NoteKeyboardBlocker.unblockShortcutsForElement(titleInput);
          }
        });

    body.appendChild(toolbar);
    body.appendChild(editor);

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'exl-hl-note-resize-handle';
    resizeHandle.addEventListener('mousedown', (e) => startResize(e, note.id));

    noteEl.appendChild(header);
    noteEl.appendChild(colorPicker);
    noteEl.appendChild(body);
    noteEl.appendChild(resizeHandle);

    // Setup dragging (on header only)
    header.addEventListener('mousedown', startDrag);

    document.body.appendChild(noteEl);

    // Setup lazy loading for images
    if (lazyLoadObserver) {
      const images = editor.querySelectorAll('img[data-src]');
      images.forEach(img => {
        img.classList.add('exl-lazy-img');
        lazyLoadObserver.observe(img);
      });
    }
  }

  /**
   * Toggle color picker visibility
   * @param {string} noteId - Note ID
   */
  function toggleColorPicker(noteId) {
    const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
    if (!noteEl) return;

    const colorPicker = noteEl.querySelector('.exl-hl-note-colors');
    if (colorPicker) {
      colorPicker.style.display = colorPicker.style.display === 'none' ? 'flex' : 'none';
    }
  }

  /**
   * Handle paste event (support image paste)
   * @param {ClipboardEvent} e - Paste event
   * @param {string} noteId - Note ID
   * @param {HTMLElement} editor - Editor element
   */
  async function handlePaste(e, noteId, editor) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        
        const blob = item.getAsFile();
        if (!blob) continue;

        try {
          // Convert to base64
          const reader = new FileReader();
          reader.onload = function(event) {
            const base64 = event.target.result;
            
            // Create image element with lazy loading
            const img = document.createElement('img');
            img.dataset.src = base64;
            img.alt = 'Pasted image';
            img.classList.add('exl-lazy-img');
            img.style.maxWidth = '100%';
            
            // Insert into editor
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();
              range.insertNode(img);
              
              // Move cursor after image
              range.setStartAfter(img);
              range.setEndAfter(img);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              editor.appendChild(img);
            }

            // Setup lazy loading
            if (lazyLoadObserver) {
              lazyLoadObserver.observe(img);
            }

            // Update note content
            updateNote(noteId, editor.innerHTML, editor.textContent);
          };
          reader.readAsDataURL(blob);
          
        } catch (error) {
          console.error('[StickyNotes] Image paste failed:', error);
          showWarningToast('Failed to paste image');
        }
        
        break; // Handle only first image
      }
    }
  }

  /**
   * Start dragging a note
   */
  function startDrag(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA' || 
        e.target.classList.contains('exl-hl-note-color-chip')) {
      return;
    }

    const noteEl = e.target.closest('.exl-hl-note');
    if (!noteEl) return;

    draggedNote = noteEl;
    const noteId = noteEl.dataset.noteId;

    // Bring to front
    noteEl.style.zIndex = ++highestZIndex;
    notes[noteId].zIndex = highestZIndex;

    const rect = noteEl.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    noteEl.classList.add('exl-hl-dragging');

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);

    e.preventDefault();
  }

  /**
   * Drag note
   */
  function drag(e) {
    if (!draggedNote) return;

    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;

    // Keep within viewport bounds
    const maxX = window.innerWidth - draggedNote.offsetWidth;
    const maxY = window.innerHeight - draggedNote.offsetHeight;

    const finalX = Math.max(0, Math.min(x, maxX));
    const finalY = Math.max(48, Math.min(y, maxY)); // 48px for banner

    draggedNote.style.left = finalX + 'px';
    draggedNote.style.top = finalY + 'px';
  }

  /**
   * Stop dragging note
   */
  function stopDrag(e) {
    if (!draggedNote) return;

    draggedNote.classList.remove('exl-hl-dragging');

    const noteId = draggedNote.dataset.noteId;
    const x = parseInt(draggedNote.style.left);
    const y = parseInt(draggedNote.style.top);

    updateNotePosition(noteId, x, y);

    draggedNote = null;

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
  }

  /**
   * Start resizing a note
   * @param {MouseEvent} e - Mouse event
   * @param {string} noteId - Note ID
   */
  function startResize(e, noteId) {
    e.preventDefault();
    e.stopPropagation();

    const noteEl = document.querySelector(`[data-note-id="${noteId}"]`);
    if (!noteEl) return;

    resizingNote = noteEl;
    const rect = noteEl.getBoundingClientRect();
    
    resizeStart = {
      width: rect.width,
      height: rect.height,
      x: e.clientX,
      y: e.clientY
    };

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
  }

  /**
   * Resize note
   * @param {MouseEvent} e - Mouse event
   */
  function resize(e) {
    if (!resizingNote) return;

    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;

    const newWidth = Math.max(200, resizeStart.width + deltaX); // Min 200px
    const newHeight = Math.max(150, resizeStart.height + deltaY); // Min 150px

    resizingNote.style.width = newWidth + 'px';
    resizingNote.style.height = newHeight + 'px';
  }

  /**
   * Stop resizing note
   */
  function stopResize() {
    if (!resizingNote) return;

    const noteId = resizingNote.dataset.noteId;
    const width = parseInt(resizingNote.style.width);
    const height = parseInt(resizingNote.style.height);

    updateNoteSize(noteId, width, height);

    resizingNote = null;
    resizeStart = null;

    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
  }

  /**
   * Get all notes data (for export)
   */
  function getAllNotes() {
    return { [getStorageKey()]: notes };
  }

  /**
   * Import notes data
   */
  async function importNotes(data) {
    const key = getStorageKey();
    if (data[key]) {
      notes = data[key];
      await saveNotes();
      renderNotes();
      console.log('[StickyNotes] Imported', Object.keys(notes).length, 'notes');
    }
  }

  /**
   * Cleanup (Enhanced)
   */
  function cleanup() {
    document.querySelectorAll('.exl-hl-note').forEach(note => note.remove());
    notes = {};
    draggedNote = null;
    resizingNote = null;
    highestZIndex = 999998;
    isInitialized = false;
    visibleNoteIds.clear();
    
    // Cleanup keyboard blocker
    if (typeof NoteKeyboardBlocker !== 'undefined' && NoteKeyboardBlocker.cleanup) {
      NoteKeyboardBlocker.cleanup();
    }
    
    // Disconnect observers
    if (lazyLoadObserver) {
      lazyLoadObserver.disconnect();
      lazyLoadObserver = null;
    }
    
    // Close broadcast channel
    if (broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
    
    console.log('[StickyNotes] Cleaned up');
  }

  /**
   * Switch to a different layer (Enhanced)
   * Clears current notes from DOM and loads the new layer's notes
   */
  async function switchLayer() {
    console.log('[StickyNotes] Switching layer...');
    
    // Clear all note elements from DOM
    document.querySelectorAll('.exl-hl-note').forEach(note => note.remove());
    
    // Reset state
    draggedNote = null;
    resizingNote = null;
    visibleNoteIds.clear();
    
    // Load notes for new layer
    await loadNotes();
    
    // Check if virtual scrolling should be enabled
    const noteCount = Object.keys(notes).length;
    virtualScrollEnabled = noteCount > VIRTUAL_SCROLL_THRESHOLD;
    
    if (virtualScrollEnabled) {
      console.log('[StickyNotes] Virtual scrolling enabled for', noteCount, 'notes');
      setupVirtualScrolling();
    } else {
      renderNotes();
    }
    
    console.log('[StickyNotes] Layer switched, loaded', noteCount, 'notes');
  }

  /**
   * Reload notes for new URL (Enhanced - called when URL changes in SPA)
   * Clears existing notes from DOM and loads notes for new URL
   */
  async function reloadForNewUrl() {
    console.log('[StickyNotes] Reloading notes for new URL:', window.location.href);
    
    // Clear all note elements from DOM
    document.querySelectorAll('.exl-hl-note').forEach(note => note.remove());
    
    // Reset state
    draggedNote = null;
    resizingNote = null;
    visibleNoteIds.clear();
    
    // Clear current notes object
    notes = {};
    
    // Wait for DOM to be ready before loading and rendering
    const domReady = await waitForDOMReady();
    if (!domReady) {
      console.warn('[StickyNotes] DOM not ready after timeout, proceeding anyway');
    }
    
    // Load notes for new URL
    await loadNotes();
    
    // Check if virtual scrolling should be enabled
    const noteCount = Object.keys(notes).length;
    virtualScrollEnabled = noteCount > VIRTUAL_SCROLL_THRESHOLD;
    
    if (virtualScrollEnabled) {
      console.log('[StickyNotes] Virtual scrolling enabled for', noteCount, 'notes');
      setupVirtualScrolling();
    } else {
      renderNotes();
    }
    
    console.log('[StickyNotes] Reloaded', noteCount, 'notes for new URL');
  }

  return {
    init,
    createNote,
    deleteNote,
    getAllNotes,
    importNotes,
    cleanup,
    switchLayer,
    reloadForNewUrl,
    setDefaultColor
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StickyNotes;
}
