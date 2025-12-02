// ========== DRIVE BACKUP MODULE IMPORT ==========
// Import the DriveBackup module for Google Drive AppData backup functionality
import DriveBackup from './modules/driveBackup.js';

// ========== CONTEXT MENU MANAGEMENT ==========

let contextMenusCreated = false;

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
      title: 'Ex Libris Format',
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
    } else if (request.type === 'RUN_DRIVE_BACKUP_FROM_SF' || request.type === 'RUN_DRIVE_BACKUP_FROM_POPUP') {
      // Handle Drive backup requests from Salesforce content script or popup
      (async () => {
        try {
          console.log('[Background] Running Drive backup from:', request.type);
          
          const result = await DriveBackup.backupNow({ interactive: true });
          
          if (result.ok) {
            // Show success notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/ExtLogoV3.png',
              title: 'Backup Complete',
              message: result.message || 'Your data has been backed up to Google Drive.',
              priority: 1
            });
            sendResponse({ ok: true, message: result.message });
          } else {
            // Show failure notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/ExtLogoV3.png',
              title: 'Backup Failed',
              message: result.error || 'Failed to backup data to Google Drive.',
              priority: 2
            });
            sendResponse({ ok: false, error: result.error });
          }
        } catch (error) {
          console.error('[Background] Drive backup error:', error);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/ExtLogoV3.png',
            title: 'Backup Failed',
            message: error.message || 'An unexpected error occurred.',
            priority: 2
          });
          sendResponse({ ok: false, error: error.message });
        }
      })();
      return true; // Indicates async response
    } else if (request.type === 'RUN_DRIVE_RESTORE') {
      // Handle Drive restore requests from popup
      (async () => {
        try {
          console.log('[Background] Running Drive restore');
          
          const result = await DriveBackup.restoreNow({ interactive: true });
          
          if (result.ok) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/ExtLogoV3.png',
              title: 'Restore Complete',
              message: result.message || 'Your data has been restored from Google Drive.',
              priority: 1
            });
            sendResponse({ ok: true, message: result.message });
          } else {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/ExtLogoV3.png',
              title: 'Restore Failed',
              message: result.error || 'Failed to restore data from Google Drive.',
              priority: 2
            });
            sendResponse({ ok: false, error: result.error });
          }
        } catch (error) {
          console.error('[Background] Drive restore error:', error);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/ExtLogoV3.png',
            title: 'Restore Failed',
            message: error.message || 'An unexpected error occurred.',
            priority: 2
          });
          sendResponse({ ok: false, error: error.message });
        }
      })();
      return true; // Indicates async response
    }
  });

// ========== EXTENSION UPDATE HANDLING ==========

/**
 * Handle extension installation and updates
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated');
  createContextMenus();
  
  // Show landing page on update (but not on first install)
  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    
    console.log(`[Background] Updated from ${previousVersion} to ${currentVersion}`);
    
    // Open the landing page
    chrome.tabs.create({
      url: chrome.runtime.getURL('updated.html')
    });
  }
});