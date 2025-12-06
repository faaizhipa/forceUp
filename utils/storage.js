/**
 * Storage Utility
 * Uses chrome.storage.local to save notes.
 * Structure:
 * {
 *   "notes": {
 *     "url_hash_or_key": [
 *       { id: "uuid", title: "...", content: "...", createdAt: timestamp, updatedAt: timestamp }
 *     ]
 *   }
 * }
 * 
 * For simplicity, we might just key by the actual URL string, but we need to be careful about length.
 * Let's use the full URL string for now as keys in a specific "notes_map" object.
 */

const Storage = {
  async safeGet(keys) {
    try {
      const data = await chrome.storage.local.get(keys);
      if (chrome.runtime?.lastError) {
        console.warn('[Storage] get failed:', chrome.runtime.lastError);
        return {};
      }
      return data || {};
    } catch (error) {
      console.warn('[Storage] get threw:', error);
      return {};
    }
  },

  async safeSet(payload) {
    try {
      await chrome.storage.local.set(payload);
      if (chrome.runtime?.lastError) {
        console.warn('[Storage] set failed:', chrome.runtime.lastError);
      }
    } catch (error) {
      console.warn('[Storage] set threw:', error);
    }
  },

  async getNotes(url) {
    const data = await this.safeGet(['notes_map']);
    const notesMap = data.notes_map || {};
    return notesMap[url] || [];
  },

  async getAllNotes() {
    const data = await this.safeGet(['notes_map']);
    return data.notes_map || {};
  },

  async saveNote(url, note) {
    const data = await this.safeGet(['notes_map']);
    const notesMap = data.notes_map || {};
    
    if (!notesMap[url]) {
      notesMap[url] = [];
    }

    const existingIndex = notesMap[url].findIndex(n => n.id === note.id);
    if (existingIndex > -1) {
      // Update
      notesMap[url][existingIndex] = { ...notesMap[url][existingIndex], ...note, updatedAt: Date.now() };
    } else {
      // Create
      notesMap[url].push({
        id: crypto.randomUUID(),
        title: note.title || 'Untitled Note',
        content: note.content || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...note
      });
    }

    await this.safeSet({ notes_map: notesMap });
  },

  async deleteNote(url, noteId) {
    const data = await this.safeGet(['notes_map']);
    const notesMap = data.notes_map || {};

    if (notesMap[url]) {
      notesMap[url] = notesMap[url].filter(n => n.id !== noteId);
      if (notesMap[url].length === 0) {
        delete notesMap[url]; // Clean up empty entries
      }
      await this.safeSet({ notes_map: notesMap });
    }
  },

  // Bulk save for import/restore
  async setAllNotes(notesMap) {
    await this.safeSet({ notes_map: notesMap });
  }
};
