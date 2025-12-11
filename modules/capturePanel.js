/**
 * CapturePanel
 * Lightweight panel to browse screenshots and recordings outside the side panel.
 */
const CapturePanel = (function() {
  'use strict';

  const PAGE_SIZE = 10;
  let isOpen = false;
  let activeTab = 'screenshots';
  let panelEl = null;
  const state = {
    screenshotPage: 1,
    recordingPage: 1,
    highlightScreenshot: null,
    highlightRecording: null
  };

  function open(payload = {}) {
    if (payload.tab === 'recordings') {
      activeTab = 'recordings';
    } else if (payload.tab === 'screenshots') {
      activeTab = 'screenshots';
    }

    if (payload.justSavedId) {
      if (activeTab === 'recordings') {
        state.highlightRecording = payload.justSavedId;
      } else {
        state.highlightScreenshot = payload.justSavedId;
      }
    }

    if (isOpen) {
      refresh();
      return;
    }

    panelEl = renderPanel();
    document.body.appendChild(panelEl);
    requestAnimationFrame(() => panelEl.classList.add('exl-hl-open'));
    isOpen = true;
  }

  function close() {
    if (!panelEl) return;
    panelEl.classList.remove('exl-hl-open');
    setTimeout(() => {
      if (panelEl && panelEl.parentNode) {
        panelEl.parentNode.removeChild(panelEl);
      }
      panelEl = null;
      isOpen = false;
    }, 250);
  }

  function refresh() {
    if (!panelEl) return;
    const content = panelEl.querySelector('.exl-cap-content');
    if (!content) return;
    renderActiveList(content);
  }

  function renderPanel() {
    const panel = document.createElement('div');
    panel.className = 'exl-hl-collections-panel exl-hl-capture-panel';

    const header = document.createElement('div');
    header.className = 'exl-hl-panel-header';

    const title = document.createElement('h2');
    title.className = 'exl-hl-panel-title';
    title.textContent = 'Captures';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'exl-hl-panel-close';
    closeBtn.innerHTML = 'x';
    closeBtn.addEventListener('click', close);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const tabs = document.createElement('div');
    tabs.className = 'exl-cap-tabs';

    const screenshotsTab = createTabButton('Screens', 'screenshots');
    const recordingsTab = createTabButton('Recordings', 'recordings');
    tabs.appendChild(screenshotsTab);
    tabs.appendChild(recordingsTab);

    const content = document.createElement('div');
    content.className = 'exl-hl-panel-content exl-cap-content';

    panel.appendChild(header);
    panel.appendChild(tabs);
    panel.appendChild(content);

    renderActiveList(content);

    return panel;
  }

  function createTabButton(label, tab) {
    const btn = document.createElement('button');
    btn.className = 'exl-cap-tab';
    if (activeTab === tab) {
      btn.classList.add('active');
    }
    btn.textContent = label;
    btn.addEventListener('click', () => {
      activeTab = tab;
      state.highlightRecording = null;
      state.highlightScreenshot = null;
      const allTabs = panelEl?.querySelectorAll('.exl-cap-tab') || [];
      allTabs.forEach(t => t.classList.toggle('active', t === btn));
      refresh();
    });
    return btn;
  }

  async function renderActiveList(container) {
    container.innerHTML = '<div class="exl-cap-loading">Loading...</div>';
    if (activeTab === 'recordings') {
      await renderRecordings(container);
    } else {
      await renderScreenshots(container);
    }
  }

  async function renderScreenshots(container) {
    try {
      const all = await chrome.storage.local.get(null);
      const entries = Object.entries(all)
        .filter(([k]) => k.startsWith('exl_screenshots_v1_'))
        .map(([key, v]) => ({ ...v, key }))
        .sort((a, b) => b.timestamp - a.timestamp);

      if (!entries.length) {
        container.innerHTML = '<p class="exl-cap-empty">No screenshots yet.</p>';
        return;
      }

      let currentPage = state.screenshotPage || 1;
      if (state.highlightScreenshot) {
        const idx = entries.findIndex(item => item.id === state.highlightScreenshot);
        if (idx >= 0) currentPage = Math.floor(idx / PAGE_SIZE) + 1;
      }

      const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);
      state.screenshotPage = currentPage;

      const start = (currentPage - 1) * PAGE_SIZE;
      const pageEntries = entries.slice(start, start + PAGE_SIZE);

      container.innerHTML = '';
      container.appendChild(renderPagination('screenshots', currentPage, totalPages));
      pageEntries.forEach(item => container.appendChild(renderScreenshotCard(item)));
      container.appendChild(renderPagination('screenshots', currentPage, totalPages));
    } catch (err) {
      container.innerHTML = '<p class="exl-cap-error">Failed to load screenshots.</p>';
      console.error('[CapturePanel] renderScreenshots failed', err);
    }
  }

  async function renderRecordings(container) {
    try {
      const all = await chrome.storage.local.get(null);
      const entries = Object.entries(all)
        .filter(([k]) => k.startsWith('exl_recordings_v1_'))
        .map(([key, v]) => ({ ...v, key }))
        .sort((a, b) => b.timestamp - a.timestamp);

      if (!entries.length) {
        container.innerHTML = '<p class="exl-cap-empty">No recordings yet.</p>';
        return;
      }

      let currentPage = state.recordingPage || 1;
      if (state.highlightRecording) {
        const idx = entries.findIndex(item => item.id === state.highlightRecording);
        if (idx >= 0) currentPage = Math.floor(idx / PAGE_SIZE) + 1;
      }

      const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);
      state.recordingPage = currentPage;

      const start = (currentPage - 1) * PAGE_SIZE;
      const pageEntries = entries.slice(start, start + PAGE_SIZE);

      container.innerHTML = '';
      container.appendChild(renderPagination('recordings', currentPage, totalPages));
      pageEntries.forEach(item => container.appendChild(renderRecordingCard(item)));
      container.appendChild(renderPagination('recordings', currentPage, totalPages));
    } catch (err) {
      container.innerHTML = '<p class="exl-cap-error">Failed to load recordings.</p>';
      console.error('[CapturePanel] renderRecordings failed', err);
    }
  }

  function renderPagination(kind, currentPage, totalPages) {
    if (totalPages <= 1) return document.createDocumentFragment();

    const nav = document.createElement('div');
    nav.className = 'exl-cap-pagination';

    const prev = document.createElement('button');
    prev.textContent = 'Prev';
    prev.disabled = currentPage === 1;
    prev.addEventListener('click', () => {
      if (kind === 'recordings') {
        state.recordingPage = currentPage - 1;
      } else {
        state.screenshotPage = currentPage - 1;
      }
      refresh();
    });

    const info = document.createElement('span');
    info.textContent = `Page ${currentPage} of ${totalPages}`;

    const next = document.createElement('button');
    next.textContent = 'Next';
    next.disabled = currentPage === totalPages;
    next.addEventListener('click', () => {
      if (kind === 'recordings') {
        state.recordingPage = currentPage + 1;
      } else {
        state.screenshotPage = currentPage + 1;
      }
      refresh();
    });

    nav.appendChild(prev);
    nav.appendChild(info);
    nav.appendChild(next);
    return nav;
  }

  function renderScreenshotCard(item) {
    const card = document.createElement('div');
    card.className = 'screenshot-card';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'screenshot-thumb-wrap';
    const img = document.createElement('img');
    img.src = item.thumbnail || item.dataUrl;
    img.className = 'screenshot-thumb';
    thumbWrap.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'screenshot-meta';
    const url = document.createElement('div');
    url.className = 'screenshot-url';
    url.title = escapeHtml(item.url);
    url.textContent = item.url;
    const time = document.createElement('div');
    time.className = 'screenshot-time';
    time.textContent = new Date(item.timestamp).toLocaleString();
    meta.appendChild(url);
    meta.appendChild(time);

    const actions = document.createElement('div');
    actions.className = 'screenshot-actions';
    const openBtn = createActionButton('Open', async () => chrome.tabs.create({ url: item.dataUrl }));
    const pngBtn = createActionButton('PNG', () => downloadDataUrl(item.dataUrl, `${item.id || 'screenshot'}.png`));
    const jpgBtn = createActionButton('JPEG', () => downloadDataUrl(item.dataUrl.replace('image/png', 'image/jpeg'), `${item.id || 'screenshot'}.jpg`));
    const copyBtn = createActionButton('Copy', () => copyDataUrl(item.dataUrl));
    const deleteBtn = createActionButton('Delete', async () => {
      await deleteScreenshot(item);
      card.remove();
      refresh();
    });
    actions.append(openBtn, pngBtn, jpgBtn, copyBtn, deleteBtn);

    card.append(thumbWrap, meta, actions);

    if (state.highlightScreenshot && state.highlightScreenshot === item.id) {
      card.classList.add('highlight');
    }

    return card;
  }

  function renderRecordingCard(item) {
    const card = document.createElement('div');
    card.className = 'screenshot-card';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'screenshot-thumb-wrap';
    const img = document.createElement('img');
    img.src = item.poster || item.thumbnail || '';
    img.className = 'screenshot-thumb';
    thumbWrap.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'screenshot-meta';
    const url = document.createElement('div');
    url.className = 'screenshot-url';
    url.title = escapeHtml(item.url);
    url.textContent = item.url;
    const time = document.createElement('div');
    time.className = 'screenshot-time';
    time.textContent = new Date(item.timestamp).toLocaleString();
    const duration = document.createElement('div');
    duration.className = 'screenshot-time';
    duration.textContent = `Duration: ${formatDuration(item.durationMs)}`;
    const size = document.createElement('div');
    size.className = 'screenshot-time';
    size.textContent = `Size: ${formatSize(item.sizeBytes)}`;
    meta.append(url, time, duration, size);

    const actions = document.createElement('div');
    actions.className = 'screenshot-actions';
    const playBtn = createActionButton('Play', () => playRecording(item));
    const ext = item.fileExt || (item.mimeType && item.mimeType.includes('mp4') ? 'mp4' : 'webm');
    const downloadBtn = createActionButton('Download', () => downloadDataUrl(item.dataUrl, `${item.id || 'recording'}.${ext}`));
    const copyBtn = createActionButton('Copy', () => copyDataUrl(item.dataUrl));
    const deleteBtn = createActionButton('Delete', async () => {
      await deleteRecording(item);
      card.remove();
      refresh();
    });
    actions.append(playBtn, downloadBtn, copyBtn, deleteBtn);

    card.append(thumbWrap, meta, actions);

    if (state.highlightRecording && state.highlightRecording === item.id) {
      card.classList.add('highlight');
    }

    return card;
  }

  function createActionButton(label, handler) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await handler();
      } catch (err) {
        console.warn(`[CapturePanel] Action ${label} failed`, err);
      }
    });
    return btn;
  }

  function formatDuration(ms) {
    if (!ms || Number.isNaN(ms)) return 'N/A';
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function formatSize(bytes) {
    if (!bytes || Number.isNaN(bytes)) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  async function deleteRecording(item) {
    if (!item.key) return;
    await chrome.storage.local.remove(item.key);
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
      console.warn('[CapturePanel] Copy failed', err);
    }
  }

  function playRecording(item) {
    if (!item || !item.dataUrl) return;
    const url = item.dataUrl.startsWith('blob:') ? item.dataUrl : item.dataUrl;

    // Prefer background-assisted tab creation when tabs API is unavailable in content scripts
    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url });
      return;
    }

    try {
      chrome.runtime.sendMessage({ type: 'OPEN_TAB', url }, (resp) => {
        if (resp && resp.success) return;
        window.open(url, '_blank');
      });
    } catch (err) {
      window.open(url, '_blank');
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    open,
    close,
    refresh
  };
})();

// Export for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CapturePanel;
}
