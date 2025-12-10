
// State
let currentTabUrl = '';
let currentNoteId = null; // If editing
let allNotesData = {}; // Cache for 'All Notes' view
let aiAvailable = false;
let suggestionDebounceTimer = null;
let googleAuthToken = null;
let quotaEnforced = true;

// DOM Elements
const notesListEl = document.getElementById('notes-list');
const allNotesListEl = document.getElementById('all-notes-list');
const editorEl = document.getElementById('editor');
const noteTitleInput = document.getElementById('note-title');
const noteContentInput = document.getElementById('note-content');
const searchInput = document.getElementById('search-notes');
const aiSuggestionBox = document.getElementById('ai-suggestion');
const suggestionTextEl = document.getElementById('suggestion-text');
const storageQuotaToggle = document.getElementById('toggle-storage-quota');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Check AI
  aiAvailable = await AI.init();
  if (!aiAvailable) {
    document.querySelector('.ai-tools').style.display = 'none';
  }

  // Check Auth
  checkAuthStatus();

  setupTabs();
  setupEventListeners();
  await initStorageQuotaToggle();
  await updateCurrentTab();
  
  // Listen for tab updates to refresh the view
  chrome.tabs.onActivated.addListener(updateCurrentTab);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      updateCurrentTab();
    }
  });

  // Listen for focus requests from other contexts (e.g., screenshots)
  chrome.runtime.onMessage.addListener((req) => {
    if (req.type === 'SIDEpanel_FOCUS') {
      focusTab(req.tab || 'captured', req.payload || null);
    }
  });
});

async function initStorageQuotaToggle() {
  if (!storageQuotaToggle) return;

  const settings = await safeSyncGet(['exlibris']);
  quotaEnforced = settings?.exlibris?.features?.storageQuotaEnforced !== false;
  storageQuotaToggle.checked = quotaEnforced;

  storageQuotaToggle.addEventListener('change', async (e) => {
    quotaEnforced = e.target.checked;
    const next = settings?.exlibris ? { ...settings.exlibris } : { features: {} };
    next.features = { ...(next.features || {}), storageQuotaEnforced: quotaEnforced };
    await safeSyncSet({ exlibris: next });
  });
}

function safeSyncGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(keys, (result) => {
        if (chrome.runtime?.lastError) {
          console.warn('[Sidepanel] sync.get failed:', chrome.runtime.lastError);
          resolve({});
          return;
        }
        resolve(result || {});
      });
    } catch (error) {
      console.warn('[Sidepanel] sync.get threw:', error);
      resolve({});
    }
  });
}

function safeSyncSet(items) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set(items, () => {
        if (chrome.runtime?.lastError) {
          console.warn('[Sidepanel] sync.set failed:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (error) {
      console.warn('[Sidepanel] sync.set threw:', error);
      resolve(false);
    }
  });
}

function setupTabs() {
  const tabs = {
    'tab-current': 'content-current',
    'tab-all': 'content-all',
    'tab-captured': 'content-captured',
    'tab-recorded': 'content-recorded',
    'tab-settings': 'content-settings'
  };

  Object.keys(tabs).forEach(tabId => {
    document.getElementById(tabId).addEventListener('click', () => {
      // Deactivate all
      document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('active');
      });

      // Activate clicked
      document.getElementById(tabId).classList.add('active');
      const contentId = tabs[tabId];
      const contentEl = document.getElementById(contentId);
      contentEl.classList.remove('hidden');
      contentEl.classList.add('active');

      if (tabId === 'tab-all') {
        renderAllNotes();
      } else if (tabId === 'tab-captured') {
        renderCaptured();
      } else if (tabId === 'tab-recorded') {
        renderRecorded();
      }
    });
  });
}

function setupEventListeners() {
  // Add Note Button
  document.getElementById('btn-add-note').addEventListener('click', () => {
    openEditor();
  });

  // Editor Actions
  document.getElementById('btn-close-editor').addEventListener('click', closeEditor);
  document.getElementById('btn-save-note').addEventListener('click', saveCurrentNote);

  // AI Actions
  document.querySelectorAll('.ai-tools button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      const content = noteContentInput.value;
      if (!content) return;

      // Show loading state?
      const originalText = e.target.innerText;
      e.target.innerText = 'Processing...';
      e.target.disabled = true;

      try {
        if (['clear', 'concise', 'simple', 'verbose'].includes(action)) {
          const newText = await AI.enhanceText(content, action);
          if (newText) noteContentInput.value = newText;
        } else if (action === 'review') {
          const review = await AI.generateReview(content);
          if (review) createDerivedNote('Flashcards Review', review);
        } else if (action === 'quiz') {
          const quiz = await AI.generateQuiz(content);
          if (quiz) createDerivedNote('Quiz', quiz);
        }
      } catch (err) {
        console.error(err);
        alert('AI processing failed.');
      } finally {
        e.target.innerText = originalText;
        e.target.disabled = false;
      }
    });
  });

  // Suggest as I type
  noteContentInput.addEventListener('input', () => {
    if (!aiAvailable) return;
    
    // Clear existing timer
    if (suggestionDebounceTimer) clearTimeout(suggestionDebounceTimer);
    
    // Hide previous suggestion
    aiSuggestionBox.classList.add('hidden');

    const text = noteContentInput.value;
    if (text.length < 20) return; // Don't annoy for short text

    suggestionDebounceTimer = setTimeout(async () => {
      const suggestion = await AI.suggestImprovement(text);
      if (suggestion) {
        suggestionTextEl.textContent = suggestion;
        aiSuggestionBox.classList.remove('hidden');
      }
    }, 2000); // 2 seconds pause
  });

  document.getElementById('btn-accept-suggestion').addEventListener('click', () => {
    // This is tricky. AI usually returns a full rewritten sentence or just a comment.
    // If it's a "better phrasing", we might want to replace. 
    // For now, let's just append or replace? 
    // The prompt in ai.js asks for "short, single-sentence suggestion".
    // It might be meta-commentary "Change X to Y".
    // A safer UX for "Accept" is hard without structured output.
    // Let's assume the user reads it and manually fixes, OR if the AI returns rewritten text, we replace.
    // Given the prompt "If there are errors... provide a short suggestion", it might be "Use 'their' instead of 'there'".
    // Automated replacement is risky. Let's make "Accept" just copy to clipboard or maybe disable "Accept" and just have "Dismiss".
    // Wait, the prompt I wrote: "rewrite... or suggest".
    // Let's keep it simple: "Dismiss" hides it. User can manually edit.
    // Or we update the prompt to be "Rewrite this sentence correctly". 
    // Let's stick to "Dismiss" only for now to be safe, or make "Accept" append it as a comment.
    
    // Actually, let's make Accept replace the content IF the suggestion looks like a full rewrite.
    // But since we can't guarantee, let's change "Accept" to "Copy to Clipboard" behavior or just remove it.
    // I will remove the "Accept" button logic from here and the HTML effectively, 
    // OR just make it copy the suggestion to clipboard.
    navigator.clipboard.writeText(suggestionTextEl.textContent);
    alert('Suggestion copied to clipboard.');
    aiSuggestionBox.classList.add('hidden');
  });

  document.getElementById('btn-dismiss-suggestion').addEventListener('click', () => {
    aiSuggestionBox.classList.add('hidden');
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    renderAllNotes(e.target.value);
  });

  // Backup & Restore
  document.getElementById('btn-auth').addEventListener('click', async () => {
    const statusEl = document.getElementById('auth-status');
    statusEl.innerText = 'Connecting to Google...';
    const token = await GoogleDrive.getAuthToken(true);
    if (token) {
      statusEl.innerText = 'Connected to Google Drive';
      statusEl.className = 'status-online';
    } else {
      const errMsg = GoogleDrive.lastAuthError?.message || 'Unable to sign in. Please try again.';
      statusEl.innerText = `Sign-in failed: ${errMsg}`;
      statusEl.className = 'status-offline';
    }
    checkAuthStatus();
  });

  document.getElementById('btn-backup-now').addEventListener('click', async () => {
    const statusEl = document.getElementById('auth-status');
    statusEl.innerText = 'Backing up...';
    try {
      const [notesData, localDbPayload] = await Promise.all([
        Storage.getAllNotes?.(),
        typeof LocalDb !== 'undefined' ? LocalDb.exportEntities() : null
      ]);

      const tasks = [];
      if (notesData) {
        tasks.push(GoogleDrive.performBackup(notesData));
      }
      if (localDbPayload) {
        tasks.push(GoogleDrive.performLocalDbBackup(localDbPayload));
      }

      if (tasks.length === 0) {
        throw new Error('Nothing to back up');
      }

      await Promise.all(tasks);
      statusEl.innerText = 'Backup complete!';
      setTimeout(checkAuthStatus, 3000);
    } catch (e) {
      statusEl.innerText = 'Backup failed: ' + e.message;
      console.error(e);
    }
  });

  document.getElementById('btn-restore').addEventListener('click', async () => {
    if (!confirm('This will merge notes from Google Drive. Continue?')) return;
    const statusEl = document.getElementById('auth-status');
    statusEl.innerText = 'Restoring...';
    try {
      const tasks = [];

      tasks.push((async () => {
        const data = await GoogleDrive.restoreBackup();
        await ExportImport.mergeData(data);
      })());

      if (typeof LocalDb !== 'undefined') {
        tasks.push(GoogleDrive.restoreLocalDbBackup({ merge: true }));
      }

      await Promise.all(tasks);
      statusEl.innerText = 'Restore complete!';
      setTimeout(checkAuthStatus, 3000);
      
      // Refresh
      if (document.getElementById('tab-all').classList.contains('active')) {
         renderAllNotes(searchInput.value);
      }
    } catch (e) {
      statusEl.innerText = 'Restore failed: ' + e.message;
      console.error(e);
    }
  });
  
  document.getElementById('backup-freq').addEventListener('change', (e) => {
    const freq = e.target.value;
    chrome.runtime.sendMessage({ type: 'SET_ALARM', frequency: freq });
  });

  // Sharing via Drive
  document.getElementById('btn-share-drive').addEventListener('click', async () => {
    const email = prompt("Enter the Google email address to share with:");
    if (!email) return;

    // Use current note content
    const title = noteTitleInput.value || 'Untitled Note';
    const content = noteContentInput.value;
    
    if (!content) {
      alert("Note is empty.");
      return;
    }

    try {
       alert("Creating Google Doc and sharing... this may take a moment.");
       const fileId = await GoogleDrive.createSharedDoc(title, content);
       await GoogleDrive.shareFile(fileId, email);
       const link = await GoogleDrive.getWebViewLink(fileId);
       
       prompt("Share successful! Here is the link:", link);
    } catch (e) {
      alert("Sharing failed: " + e.message);
      console.error(e);
    }
  });

  // Copy to Clipboard
  document.getElementById('btn-copy').addEventListener('click', () => {
    const title = noteTitleInput.value || 'Untitled Note';
    const content = noteContentInput.value || '';
    const url = editorEl.dataset.editingUrl || currentTabUrl;

    const textToCopy = `Title: ${title}\nURL: ${url}\n\n${content}`;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = document.getElementById('btn-copy').innerText;
      document.getElementById('btn-copy').innerText = 'Copied!';
      setTimeout(() => {
        document.getElementById('btn-copy').innerText = originalText;
      }, 2000);
    });
  });

  // Export Buttons
  document.getElementById('btn-export-json').addEventListener('click', () => ExportImport.exportJSON());
  document.getElementById('btn-export-md').addEventListener('click', () => ExportImport.exportMarkdown());
  document.getElementById('btn-export-txt').addEventListener('click', () => ExportImport.exportText());
  document.getElementById('btn-export-xml').addEventListener('click', () => ExportImport.exportXML());

  // Import
  const fileInput = document.getElementById('file-import');
  document.getElementById('btn-import').addEventListener('click', () => {
    if (fileInput.files.length > 0) {
      ExportImport.handleImport(fileInput.files[0]).then(success => {
        if (success) {
          // Refresh views
          if (document.getElementById('tab-all').classList.contains('active')) {
             renderAllNotes(searchInput.value);
          }
          fileInput.value = ''; // Reset
        }
      });
    } else {
      alert('Please select a file first.');
    }
  });
}

async function checkAuthStatus() {
  const statusEl = document.getElementById('auth-status');
  const token = await GoogleDrive.getAuthToken(false);
  if (token) {
    statusEl.innerText = 'Connected to Google Drive';
    statusEl.className = 'status-online';
    document.getElementById('btn-auth').style.display = 'none';
  } else {
    statusEl.innerText = 'Not Connected';
    statusEl.className = 'status-offline';
    document.getElementById('btn-auth').style.display = 'inline-block';
  }
}

async function updateCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    // Normalize URL to avoid query params if desired, or keep exact. 
    // Requirement says "persists per url", usually exact URL or ignoring fragments.
    // Let's keep exact URL for now but maybe strip hash.
    try {
      const urlObj = new URL(tab.url);
      currentTabUrl = urlObj.href; // Keep full URL including query params
      renderCurrentPageNotes();
    } catch (e) {
      console.log('Invalid URL', tab.url);
    }
  }
}

async function renderCurrentPageNotes() {
  notesListEl.innerHTML = '';
  const notes = await Storage.getNotes(currentTabUrl);
  
  if (notes.length === 0) {
    notesListEl.innerHTML = '<p style="color:#888; text-align:center;">No notes for this page.</p>';
    return;
  }

  notes.forEach(note => {
    const el = createNoteElement(note, currentTabUrl);
    notesListEl.appendChild(el);
  });
}

async function renderAllNotes(filterText = '') {
  allNotesListEl.innerHTML = '';
  allNotesData = await Storage.getAllNotes();
  
  const filter = filterText.toLowerCase();
  let hasNotes = false;

  // Iterate over all URLs
  Object.keys(allNotesData).forEach(url => {
    const notes = allNotesData[url];
    notes.forEach(note => {
      if (note.title.toLowerCase().includes(filter) || note.content.toLowerCase().includes(filter) || url.toLowerCase().includes(filter)) {
        hasNotes = true;
        const el = createNoteElement(note, url, true);
        allNotesListEl.appendChild(el);
      }
    });
  });

  if (!hasNotes) {
    allNotesListEl.innerHTML = '<p style="color:#888; text-align:center;">No matching notes found.</p>';
  }
}

function createDerivedNote(titleSuffix, content) {
  const title = (noteTitleInput.value || 'Untitled') + ' - ' + titleSuffix;
  const editingUrl = editorEl.dataset.editingUrl || currentTabUrl;
  
  const noteData = {
    title,
    content
  };

  Storage.saveNote(editingUrl, noteData).then(() => {
    alert(`Created new note: ${title}`);
    // Refresh if needed
    if (document.getElementById('tab-current').classList.contains('active')) {
      renderCurrentPageNotes();
    }
  });
}

function createNoteElement(note, url, showUrl = false) {
  const div = document.createElement('div');
  div.className = 'note-item';
  div.innerHTML = `
    <h4>${escapeHtml(note.title)}</h4>
    ${showUrl ? `<small style="display:block; color:#1a73e8; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(url)}</small>` : ''}
    <p>${escapeHtml(note.content)}</p>
    <div style="margin-top:8px; display:flex; justify-content:flex-end; gap:8px;">
       <button class="btn-delete-note" style="background:none; border:none; color:red; cursor:pointer; font-size:12px;">Delete</button>
    </div>
  `;
  
  div.addEventListener('click', (e) => {
    // If clicked delete button
    if (e.target.classList.contains('btn-delete-note')) {
      e.stopPropagation();
      if (confirm('Delete this note?')) {
        Storage.deleteNote(url, note.id).then(() => {
          if (document.getElementById('tab-current').classList.contains('active')) {
            renderCurrentPageNotes();
          } else {
            renderAllNotes(searchInput.value);
          }
        });
      }
      return;
    }
    openEditor(note, url);
  });
  return div;
}

function openEditor(note = null, url = null) {
  // If opening from "All Notes", we need to know which URL we are editing for.
  // If note is null, we assume we are adding to currentTabUrl.
  
  currentNoteId = note ? note.id : null;
  // If we are editing an existing note, we need to preserve its original URL context
  // If it's a new note, it belongs to currentTabUrl
  const editingUrl = url || currentTabUrl;
  
  // Store the editing URL on the editor element or a variable so save knows where to put it
  editorEl.dataset.editingUrl = editingUrl;

  noteTitleInput.value = note ? note.title : '';
  noteContentInput.value = note ? note.content : '';
  
  editorEl.classList.remove('hidden');
}

function closeEditor() {
  editorEl.classList.add('hidden');
  currentNoteId = null;
  
  // Hide AI suggestion if open
  document.getElementById('ai-suggestion').classList.add('hidden');
}

async function saveCurrentNote() {
  const title = noteTitleInput.value.trim();
  const content = noteContentInput.value.trim();
  const editingUrl = editorEl.dataset.editingUrl;

  if (!title && !content) {
    alert('Note cannot be empty');
    return;
  }

  const noteData = {
    id: currentNoteId, // undefined if new
    title,
    content
  };

  await Storage.saveNote(editingUrl, noteData);
  closeEditor();
  
  // Refresh views
  if (document.getElementById('tab-current').classList.contains('active')) {
    renderCurrentPageNotes();
  } else {
    renderAllNotes(searchInput.value);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============ Screenshot Panels ============

const SCREENSHOT_PAGE_SIZE = 10;
const screenshotPageState = {};
const screenshotHighlightState = {};
const recordingPageState = {};
const recordingHighlightState = {};

function activateTab(tabId, contentId) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.add('hidden');
    c.classList.remove('active');
  });

  const tabEl = document.getElementById(tabId);
  const contentEl = document.getElementById(contentId);
  if (tabEl) tabEl.classList.add('active');
  if (contentEl) {
    contentEl.classList.remove('hidden');
    contentEl.classList.add('active');
  }
}

function focusTab(name, payload) {
  const tabId = `tab-${name}`;
  const contentId = `content-${name}`;
  activateTab(tabId, contentId);
  if (name === 'captured') {
    renderCaptured(payload || {});
  } else if (name === 'recorded') {
    renderRecorded(payload || {});
  }
}

async function renderCaptured(payload = {}) {
  await renderScreenshots('captured-list', payload);
}

async function renderRecorded(payload = {}) {
  await renderRecordings('recorded-list', payload);
}

async function renderSaved(payload = {}) {
  await renderScreenshots('saved-list', payload);
}

async function renderScreenshots(containerId, payload = {}) {
  const listEl = document.getElementById(containerId);
  if (!listEl) return;
  listEl.innerHTML = 'Loading...';

  try {
    const all = await chrome.storage.local.get(null);
    const entries = Object.entries(all)
      .filter(([k]) => k.startsWith('exl_screenshots_v1_'))
      .map(([key, v]) => ({ ...v, key }))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (!entries.length) {
      listEl.innerHTML = '<p style="color:#888; text-align:center;">No screenshots yet.</p>';
      return;
    }

    const highlightId = payload.justSavedId || screenshotHighlightState[containerId];
    if (payload.justSavedId) {
      screenshotHighlightState[containerId] = payload.justSavedId;
    }

    // Choose page, ensuring highlighted item is visible
    let currentPage = payload.page || screenshotPageState[containerId] || 1;
    if (highlightId) {
      const idx = entries.findIndex(item => item.id === highlightId);
      if (idx >= 0) {
        currentPage = Math.floor(idx / SCREENSHOT_PAGE_SIZE) + 1;
      }
    }

    const totalPages = Math.max(1, Math.ceil(entries.length / SCREENSHOT_PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    screenshotPageState[containerId] = currentPage;

    const start = (currentPage - 1) * SCREENSHOT_PAGE_SIZE;
    const pagedEntries = entries.slice(start, start + SCREENSHOT_PAGE_SIZE);

    listEl.innerHTML = '';

    const paginationTop = renderScreenshotPagination(containerId, currentPage, totalPages, payload, highlightId);
    if (paginationTop) listEl.appendChild(paginationTop);

    pagedEntries.forEach(item => listEl.appendChild(renderScreenshotCard(item, { ...payload, justSavedId: highlightId })));

    const paginationBottom = renderScreenshotPagination(containerId, currentPage, totalPages, payload, highlightId);
    if (paginationBottom) listEl.appendChild(paginationBottom);
  } catch (err) {
    listEl.innerHTML = '<p style="color:#c00; text-align:center;">Failed to load screenshots.</p>';
    console.error('[Sidepanel] Failed to render screenshots', err);
  }
}

function renderScreenshotPagination(containerId, currentPage, totalPages, payload, highlightId) {
  if (totalPages <= 1) return null;

  const nav = document.createElement('div');
  nav.className = 'screenshot-pagination';

  const prev = document.createElement('button');
  prev.textContent = 'Prev';
  prev.disabled = currentPage === 1;
  prev.addEventListener('click', () => {
    renderScreenshots(containerId, { ...payload, page: currentPage - 1, justSavedId: highlightId });
  });

  const info = document.createElement('span');
  info.textContent = `Page ${currentPage} of ${totalPages}`;

  const next = document.createElement('button');
  next.textContent = 'Next';
  next.disabled = currentPage === totalPages;
  next.addEventListener('click', () => {
    renderScreenshots(containerId, { ...payload, page: currentPage + 1, justSavedId: highlightId });
  });

  nav.appendChild(prev);
  nav.appendChild(info);
  nav.appendChild(next);
  return nav;
}

function renderScreenshotCard(item, payload) {
  const card = document.createElement('div');
  card.className = 'screenshot-card';
  card.innerHTML = `
    <div class="screenshot-thumb-wrap"><img src="${item.thumbnail || item.dataUrl}" class="screenshot-thumb"></div>
    <div class="screenshot-meta">
      <div class="screenshot-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</div>
      <div class="screenshot-time">${new Date(item.timestamp).toLocaleString()}</div>
    </div>
    <div class="screenshot-actions">
      <button data-act="open">Open</button>
      <button data-act="png">PNG</button>
      <button data-act="jpg">JPEG</button>
      <button data-act="copy">Copy</button>
      <button data-act="delete">Delete</button>
    </div>`;

  card.addEventListener('click', async (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    e.stopPropagation();
    switch (act) {
      case 'open':
        chrome.tabs.create({ url: item.dataUrl });
        break;
      case 'png':
        downloadDataUrl(item.dataUrl, `${item.id || 'screenshot'}.png`);
        break;
      case 'jpg':
        downloadDataUrl(item.dataUrl.replace('image/png', 'image/jpeg'), `${item.id || 'screenshot'}.jpg`);
        break;
      case 'copy':
        await copyDataUrl(item.dataUrl);
        break;
      case 'delete':
        await deleteScreenshot(item);
        card.remove();
        break;
      default:
        break;
    }
  });

  if (payload && payload.justSavedId && payload.justSavedId === item.id) {
    card.classList.add('highlight');
  }

  return card;
}

// ============ Recordings (video) ============

async function renderRecordings(containerId, payload = {}) {
  const listEl = document.getElementById(containerId);
  if (!listEl) return;
  listEl.innerHTML = 'Loading...';

  try {
    const all = await chrome.storage.local.get(null);
    const entries = Object.entries(all)
      .filter(([k]) => k.startsWith('exl_recordings_v1_'))
      .map(([key, v]) => ({ ...v, key }))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (!entries.length) {
      listEl.innerHTML = '<p style="color:#888; text-align:center;">No recordings yet.</p>';
      return;
    }

    const highlightId = payload.justSavedId || recordingHighlightState[containerId];
    if (payload.justSavedId) {
      recordingHighlightState[containerId] = payload.justSavedId;
    }

    let currentPage = payload.page || recordingPageState[containerId] || 1;
    if (highlightId) {
      const idx = entries.findIndex(item => item.id === highlightId);
      if (idx >= 0) {
        currentPage = Math.floor(idx / SCREENSHOT_PAGE_SIZE) + 1;
      }
    }

    const totalPages = Math.max(1, Math.ceil(entries.length / SCREENSHOT_PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    recordingPageState[containerId] = currentPage;

    const start = (currentPage - 1) * SCREENSHOT_PAGE_SIZE;
    const pagedEntries = entries.slice(start, start + SCREENSHOT_PAGE_SIZE);

    listEl.innerHTML = '';

    const paginationTop = renderRecordingPagination(containerId, currentPage, totalPages, payload, highlightId);
    if (paginationTop) listEl.appendChild(paginationTop);

    pagedEntries.forEach(item => listEl.appendChild(renderRecordingCard(item, { ...payload, justSavedId: highlightId })));

    const paginationBottom = renderRecordingPagination(containerId, currentPage, totalPages, payload, highlightId);
    if (paginationBottom) listEl.appendChild(paginationBottom);
  } catch (err) {
    listEl.innerHTML = '<p style="color:#c00; text-align:center;">Failed to load recordings.</p>';
    console.error('[Sidepanel] Failed to render recordings', err);
  }
}

function renderRecordingPagination(containerId, currentPage, totalPages, payload, highlightId) {
  if (totalPages <= 1) return null;

  const nav = document.createElement('div');
  nav.className = 'screenshot-pagination';

  const prev = document.createElement('button');
  prev.textContent = 'Prev';
  prev.disabled = currentPage === 1;
  prev.addEventListener('click', () => {
    renderRecordings(containerId, { ...payload, page: currentPage - 1, justSavedId: highlightId });
  });

  const info = document.createElement('span');
  info.textContent = `Page ${currentPage} of ${totalPages}`;

  const next = document.createElement('button');
  next.textContent = 'Next';
  next.disabled = currentPage === totalPages;
  next.addEventListener('click', () => {
    renderRecordings(containerId, { ...payload, page: currentPage + 1, justSavedId: highlightId });
  });

  nav.appendChild(prev);
  nav.appendChild(info);
  nav.appendChild(next);
  return nav;
}

function renderRecordingCard(item, payload) {
  const card = document.createElement('div');
  card.className = 'screenshot-card';
  card.innerHTML = `
    <div class="screenshot-thumb-wrap"><img src="${item.poster || item.thumbnail || ''}" class="screenshot-thumb"></div>
    <div class="screenshot-meta">
      <div class="screenshot-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</div>
      <div class="screenshot-time">${new Date(item.timestamp).toLocaleString()}</div>
      <div class="screenshot-time">Duration: ${formatDuration(item.durationMs)}</div>
      <div class="screenshot-time">Size: ${formatSize(item.sizeBytes)}</div>
    </div>
    <div class="screenshot-actions">
      <button data-act="play">Play</button>
      <button data-act="download">Download</button>
      <button data-act="copy">Copy</button>
      <button data-act="delete">Delete</button>
    </div>`;

  card.addEventListener('click', async (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    e.stopPropagation();
    switch (act) {
      case 'play':
        playRecording(item);
        break;
      case 'download':
        downloadDataUrl(item.dataUrl, `${item.id || 'recording'}.webm`);
        break;
      case 'copy':
        await copyDataUrl(item.dataUrl);
        break;
      case 'delete':
        await deleteRecording(item);
        card.remove();
        break;
      default:
        break;
    }
  });

  if (payload && payload.justSavedId && payload.justSavedId === item.id) {
    card.classList.add('highlight');
  }

  return card;
}

function playRecording(item) {
  if (!item || !item.dataUrl) return;
  const url = item.dataUrl.startsWith('blob:') ? item.dataUrl : item.dataUrl;
  chrome.tabs.create({ url });
}

async function deleteRecording(item) {
  if (!item.key) return;
  await chrome.storage.local.remove(item.key);
}

function formatDuration(ms) {
  if (!ms || Number.isNaN(ms)) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '—';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

async function deleteScreenshot(item) {
  if (!item.key) return;
  await chrome.storage.local.remove(item.key);
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

async function copyDataUrl(dataUrl) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  } catch (err) {
    console.warn('[Sidepanel] Copy failed', err);
  }
}
