/**
 * Sticky Notes Module
 * Handles note creation, dragging, editing, and persistence
 * @module stickyNotes
 */

const StickyNotes = (function() {
  'use strict';

  const STORAGE_PREFIX = 'exl_notes_';
  const NOTE_COLORS = [
    { id: 'yellow', name: 'Light Yellow', rgb: 'rgb(254, 252, 232)' },
    { id: 'blue', name: 'Light Blue', rgb: 'rgb(239, 246, 255)' },
    { id: 'pink', name: 'Soft Pink', rgb: 'rgb(253, 242, 248)' },
    { id: 'green', name: 'Mint Green', rgb: 'rgb(240, 253, 244)' },
    { id: 'purple', name: 'Lavender', rgb: 'rgb(245, 243, 255)' },
    { id: 'peach', name: 'Soft Peach', rgb: 'rgb(254, 240, 236)' }
  ];

  let notes = {};
  let isInitialized = false;
  let draggedNote = null;
  let dragOffset = { x: 0, y: 0 };
  let highestZIndex = 999998;

  /**
   * Initialize sticky notes
   */
  async function init() {
    if (isInitialized) return;
    
    console.log('[StickyNotes] Initializing...');
    
    // Wait for DOM to be ready before loading and rendering
    const domReady = await waitForDOMReady();
    if (!domReady) {
      console.warn('[StickyNotes] DOM not ready after timeout, proceeding anyway');
    }
    
    await loadNotes();
    renderNotes();
    
    isInitialized = true;
    console.log('[StickyNotes] Initialized with', Object.keys(notes).length, 'notes');
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
   * Get storage key for current URL and active layer
   */
  function getStorageKey() {
    const layerId = typeof LayerManager !== 'undefined' 
      ? LayerManager.getActiveLayerId() 
      : 'default';
    return STORAGE_PREFIX + layerId + '_' + window.location.href;
  }

  /**
   * Load notes from storage
   */
  async function loadNotes() {
    return new Promise((resolve) => {
      const key = getStorageKey();
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[StickyNotes] Error loading notes:', chrome.runtime.lastError);
          notes = {};
          resolve();
          return;
        }
        
        notes = result[key] || {};
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
   * Create a new sticky note
   */
  async function createNote() {
    const noteId = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Position in center of viewport
    const x = window.innerWidth / 2 - 128; // 128 = half of note width (256px)
    const y = window.innerHeight / 2 - 96; // 96 = half of note height (192px)

    const note = {
      id: noteId,
      content: '',
      color: 'yellow',
      position: { x, y },
      timestamp: Date.now(),
      zIndex: ++highestZIndex
    };

    notes[noteId] = note;
    await saveNotes();
    
    renderNote(note);
    
    // Focus textarea
    setTimeout(() => {
      const textarea = document.querySelector(`[data-note-id="${noteId}"] textarea`);
      if (textarea) {
        textarea.focus();
      }
    }, 100);

    console.log('[StickyNotes] Created note:', noteId);
    return noteId;
  }

  /**
   * Update note content
   */
  async function updateNote(noteId, content) {
    if (notes[noteId]) {
      notes[noteId].content = content;
      notes[noteId].timestamp = Date.now();
      await saveNotes();
    }
  }

  /**
   * Update note color
   */
  async function updateNoteColor(noteId, colorId) {
    if (notes[noteId]) {
      notes[noteId].color = colorId;
      notes[noteId].timestamp = Date.now();
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
    }
  }

  /**
   * Update note position
   */
  async function updateNotePosition(noteId, x, y) {
    if (notes[noteId]) {
      notes[noteId].position = { x, y };
      notes[noteId].timestamp = Date.now();
      await saveNotes();
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
   * Render a single note
   */
  function renderNote(note) {
    // Check if already rendered
    if (document.querySelector(`[data-note-id="${note.id}"]`)) {
      return;
    }

    const noteEl = document.createElement('div');
    noteEl.className = `exl-hl-note exl-hl-note-${note.color}`;
    noteEl.dataset.noteId = note.id;
    noteEl.style.left = note.position.x + 'px';
    noteEl.style.top = note.position.y + 'px';
    noteEl.style.zIndex = note.zIndex || highestZIndex;

    // Update highest z-index
    if (note.zIndex > highestZIndex) {
      highestZIndex = note.zIndex;
    }

    // Header with color picker and delete button
    const header = document.createElement('div');
    header.className = 'exl-hl-note-header';

    const colorPicker = document.createElement('div');
    colorPicker.className = 'exl-hl-note-colors';
    
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
      });
      colorPicker.appendChild(chip);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'exl-hl-note-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete note';
    deleteBtn.addEventListener('click', () => {
      if (confirm('Delete this note?')) {
        deleteNote(note.id);
      }
    });

    header.appendChild(colorPicker);
    header.appendChild(deleteBtn);

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'exl-hl-note-textarea';
    textarea.placeholder = 'Type your note here...';
    textarea.value = note.content || '';
    textarea.addEventListener('input', (e) => {
      updateNote(note.id, e.target.value);
    });

    noteEl.appendChild(header);
    noteEl.appendChild(textarea);

    // Setup dragging
    header.addEventListener('mousedown', startDrag);

    document.body.appendChild(noteEl);
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
   * Cleanup
   */
  function cleanup() {
    document.querySelectorAll('.exl-hl-note').forEach(note => note.remove());
    notes = {};
    draggedNote = null;
    highestZIndex = 999998;
    isInitialized = false;
    console.log('[StickyNotes] Cleaned up');
  }

  /**
   * Switch to a different layer
   * Clears current notes from DOM and loads the new layer's notes
   */
  async function switchLayer() {
    console.log('[StickyNotes] Switching layer...');
    
    // Clear all note elements from DOM
    document.querySelectorAll('.exl-hl-note').forEach(note => note.remove());
    
    // Reset drag state
    draggedNote = null;
    
    // Load notes for new layer
    await loadNotes();
    
    // Render new layer's notes
    renderNotes();
    
    console.log('[StickyNotes] Layer switched, loaded', Object.keys(notes).length, 'notes');
  }

  /**
   * Reload notes for new URL (called when URL changes in SPA)
   * Clears existing notes from DOM and loads notes for new URL
   */
  async function reloadForNewUrl() {
    console.log('[StickyNotes] Reloading notes for new URL:', window.location.href);
    
    // Clear all note elements from DOM
    document.querySelectorAll('.exl-hl-note').forEach(note => note.remove());
    
    // Reset drag state
    draggedNote = null;
    
    // Clear current notes object
    notes = {};
    
    // Wait for DOM to be ready before loading and rendering
    const domReady = await waitForDOMReady();
    if (!domReady) {
      console.warn('[StickyNotes] DOM not ready after timeout, proceeding anyway');
    }
    
    // Load notes for new URL
    await loadNotes();
    
    // Render notes
    renderNotes();
    
    console.log('[StickyNotes] Reloaded', Object.keys(notes).length, 'notes for new URL');
  }

  return {
    init,
    createNote,
    deleteNote,
    getAllNotes,
    importNotes,
    cleanup,
    switchLayer,
    reloadForNewUrl
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StickyNotes;
}
