// Service worker entry
importScripts('modules/dataMigration.js', 'utils/storage.js', 'modules/localDb.js', 'utils/google-drive.js');

// ========== CONTEXT MENU MANAGEMENT ==========

let contextMenusCreated = false;
const ALARM_NAME = 'backup_alarm';

/**
 * Creates context menus for text formatting 
 */
function createContextMenus() {
  if (contextMenusCreated) {
    console.log('[Background] Context menus already created, skipping.');
    return;
  }

  chrome.contextMenus.removeAll(() => {
    // Parent menu - show on both selection and editable fields
    chrome.contextMenus.create({
      id: 'exlibris-text-format',
      title: 'Case Comment Formatter',
      contexts: ['selection', 'editable']
    });

    // Style submenu
    chrome.contextMenus.create({
      id: 'exlibris-style',
      parentId: 'exlibris-text-format',
      title: 'Style',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-style-bold',
      parentId: 'exlibris-style',
      title: 'Bold (𝗕𝗼𝗹𝗱)',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-style-italic',
      parentId: 'exlibris-style',
      title: 'Italic (𝘐𝘵𝘢𝘭𝘪𝘤)',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-style-bolditalic',
      parentId: 'exlibris-style',
      title: 'Bold Italic (𝙄𝙩𝙖𝙡𝙞𝙘)',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-style-boldserif',
      parentId: 'exlibris-style',
      title: 'Bold Serif (𝐒𝐞𝐫𝐢𝐟)',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-style-code',
      parentId: 'exlibris-style',
      title: 'Code (𝙲𝚘𝚍𝚎)',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-style-normal',
      parentId: 'exlibris-style',
      title: 'Remove Formatting',
      contexts: ['selection']
    });

    // Case submenu
    chrome.contextMenus.create({
      id: 'exlibris-case',
      parentId: 'exlibris-text-format',
      title: 'Case',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-case-toggle',
      parentId: 'exlibris-case',
      title: 'Toggle Case',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-case-upper',
      parentId: 'exlibris-case',
      title: 'UPPERCASE',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-case-lower',
      parentId: 'exlibris-case',
      title: 'lowercase',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-case-capital',
      parentId: 'exlibris-case',
      title: 'Capital Case',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'exlibris-case-sentence',
      parentId: 'exlibris-case',
      title: 'Sentence case',
      contexts: ['selection']
    });

    // Symbols submenu
    chrome.contextMenus.create({
      id: 'exlibris-symbols',
      parentId: 'exlibris-text-format',
      title: 'Insert Symbol',
      contexts: ['selection', 'editable']
    });

    const symbols = ['▪', '∘', '▫', '►', '▻', '▸', '▹', '▿', '▾', '⋯', '⋮'];
    symbols.forEach((symbol, index) => {
      chrome.contextMenus.create({
        id: `exlibris-symbol-${symbol}`,
        parentId: 'exlibris-symbols',
        title: symbol,
        contexts: ['selection', 'editable']
      });
    });

    contextMenusCreated = true;
    console.log('[Background] Context menus created');
  });
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith('exlibris-')) {
    // Forward to content script
    chrome.tabs.sendMessage(tab.id, {
      action: 'contextMenuClick',
      info: info
    });
  }
});

// ========== MESSAGE HANDLING ==========

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'createContextMenus') {
      createContextMenus();
      sendResponse({ success: true });
      return true;
    } else if (request.action === 'switchToOtherTab') {
      // Find other tabs with the same case
      const caseId = request.caseId;
      chrome.tabs.query({ url: `*://proquestllc.lightning.force.com/*/Case/${caseId}/*` }, (tabs) => {
        if (tabs.length > 0) {
          // Switch to the first matching tab that isn't the current one
          const otherTab = tabs.find(t => t.id !== sender.tab.id);
          if (otherTab) {
            chrome.tabs.update(otherTab.id, { active: true });
            chrome.windows.update(otherTab.windowId, { focused: true });
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'No other tab found' });
          }
        } else {
          sendResponse({ success: false, error: 'No matching tabs' });
        }
      });
      return true;
    } else if (request.type === 'SET_ALARM') {
      // Update backup frequency alarm
      let minutes = 1440; // default daily
      switch (request.frequency) {
        case 'hourly': minutes = 60; break;
        case 'daily': minutes = 1440; break;
        case 'weekly': minutes = 10080; break;
      }

      chrome.alarms.clear(ALARM_NAME, () => {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: minutes });
        console.log(`[Background] Backup frequency set to ${request.frequency || 'daily'} (${minutes} mins)`);
      });
      sendResponse({ success: true });
      return true;
    } else if (request.type === 'OPEN_SIDEPANEL') {
      (async () => {
        try {
          await chrome.sidePanel.open({ windowId: sender.tab?.windowId });
          await chrome.runtime.sendMessage({ type: 'SIDEpanel_FOCUS', tab: request.tab || 'captured', payload: request.payload || null });
          sendResponse({ success: true });
        } catch (err) {
          console.warn('[Background] sidePanel.open failed', err);
          sendResponse({ success: false, error: err?.message });
        }
      })();
      return true;
    } else if (request.type === 'OPEN_TAB') {
      try {
        chrome.tabs.create({ url: request.url || 'about:blank' }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError?.message });
          } else {
            sendResponse({ success: true });
          }
        });
      } catch (err) {
        sendResponse({ success: false, error: err?.message });
      }
      return true;
    } else if (request.type === 'CAPTURE_VISIBLE_TAB') {
      const tabId = sender.tab?.id;
      const windowId = sender.tab?.windowId;

      const fallbackToVisibleTab = () => {
        chrome.tabs.captureVisibleTab(windowId || undefined, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'captureVisibleTab failed' });
            return;
          }
          sendResponse({ success: true, dataUrl });
        });
      };

      if (chrome.tabCapture && typeof chrome.tabCapture.capture === 'function' && typeof tabId === 'number') {
        try {
          chrome.tabCapture.capture({ audio: false, video: true, videoConstraints: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: tabId } } }, (stream) => {
            if (chrome.runtime.lastError || !stream) {
              // Fall back to captureVisibleTab when tabCapture is unavailable/blocked
              fallbackToVisibleTab();
              return;
            }

            const track = stream.getVideoTracks()[0];
            const imageCapture = track ? new ImageCapture(track) : null;

            if (!imageCapture || typeof imageCapture.grabFrame !== 'function') {
              try { track?.stop(); } catch (e) { /* ignore */ }
              fallbackToVisibleTab();
              return;
            }

            imageCapture.grabFrame().then((bitmap) => {
              try { track.stop(); } catch (e) { /* ignore */ }

              let canvas;
              try {
                canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
              } catch (err) {
                // OffscreenCanvas may be unavailable; fall back to visibleTab
                fallbackToVisibleTab();
                return;
              }

              const ctx = canvas.getContext('2d');
              ctx.drawImage(bitmap, 0, 0);
              canvas.convertToBlob({ type: 'image/png' }).then((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => sendResponse({ success: true, dataUrl: reader.result });
                reader.onerror = () => sendResponse({ success: false, error: 'Failed to read capture blob' });
                reader.readAsDataURL(blob);
              }).catch((err) => {
                sendResponse({ success: false, error: err?.message || 'convertToBlob failed' });
              });
            }).catch((err) => {
              try { track.stop(); } catch (e) { /* ignore */ }
              sendResponse({ success: false, error: err?.message || 'grabFrame failed' });
            });
          });
          return true;
        } catch (err) {
          // Unexpected failure in tabCapture path; fall back
          fallbackToVisibleTab();
          return true;
        }
      }

      fallbackToVisibleTab();
      return true;
    }
  });

// ========== BACKUP ALARMS ==========

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  console.log('[Background] Starting scheduled backup...');
  try {
    const token = await GoogleDrive.getAuthToken?.(false);
    if (!token) {
      console.log('[Background] Skipping backup: Not authenticated.');
      return;
    }

    const [notesData, localDbPayload] = await Promise.all([
      Storage.getAllNotes?.(),
      typeof LocalDb !== 'undefined' ? LocalDb.exportEntities() : null
    ]);

    const tasks = [];
    if (notesData) {
      tasks.push(GoogleDrive.performBackup?.(notesData));
    }
    if (localDbPayload) {
      tasks.push(GoogleDrive.performLocalDbBackup?.(localDbPayload));
    }

    if (tasks.length === 0) {
      console.log('[Background] Nothing to back up.');
      return;
    }

    await Promise.all(tasks);
    console.log('[Background] Scheduled backup complete (notes + LocalDb).');
  } catch (e) {
    console.error('[Background] Scheduled backup failed:', e);
  }
});

// ========== EXTENSION UPDATE HANDLING ==========

/**
 * Handle extension installation and updates
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated');
  // Ensure backup alarm exists (default daily)
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1440 });
  createContextMenus();
  
  // Show landing page on update (but not on first install)
  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    
    console.log(`[Background] Updated from ${previousVersion} to ${currentVersion}`);
    
    if (typeof DataMigration !== 'undefined') {
      DataMigration.createBackup?.().catch((error) => {
        console.error('[Background] Workspace backup failed:', error);
      });

      DataMigration.restoreLatestBackupIfMissing?.().then((result) => {
        if (result?.restored) {
          console.log('[Background] Workspace data restored from backup', result.backupKey);
        } else {
          console.log('[Background] Workspace restore skipped:', result?.reason || 'unknown');
        }
      }).catch((error) => {
        console.error('[Background] Workspace restore failed:', error);
      });
    }

    // Open the landing page
    chrome.tabs.create({
      url: chrome.runtime.getURL('updated.html')
    });
  }
});