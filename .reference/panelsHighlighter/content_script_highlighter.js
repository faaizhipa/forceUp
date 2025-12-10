(function () {
  const BACKUP_BUTTON_ID = 'penang-coe-backup-button';

  function findButtonContainer() {
    // Adjust to mirror where your dynamic menu buttons go.
    // Common SF Lightning containers:
    return (
      document.querySelector('[data-aura-class="forceActionsContainer"]') ||
      document.querySelector('[data-region-name="page-header"]') ||
      document.querySelector('header[role="banner"]')
    );
  }

  function injectBackupButton() {
    if (document.getElementById(BACKUP_BUTTON_ID)) {
      return; // already injected
    }

    const container = findButtonContainer();
    if (!container) {
      return; // header not yet rendered
    }

    const btn = document.createElement('button');
    btn.id = BACKUP_BUTTON_ID;
    btn.type = 'button';
    btn.textContent = 'Backup to Drive';
    btn.className = 'slds-button slds-button_neutral';
    btn.style.marginLeft = '8px';

    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'RUN_DRIVE_BACKUP_FROM_SF' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(
            'Backup request failed:',
            chrome.runtime.lastError.message
          );
          return;
        }
        if (!response || !response.ok) {
          console.warn(
            'Backup failed or returned error:',
            response ? response.error : 'no response'
          );
        } else {
          console.log('Backup triggered successfully from Salesforce UI.');
        }
      });
    });

    container.appendChild(btn);
  }

  function startObserver() {
    // CHECK immediately
    injectBackupButton();

    // THEN OBSERVE
    const observer = new MutationObserver(() => {
      injectBackupButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'INIT_SF_BACKUP_BUTTON') {
      try {
        startObserver();
        sendResponse({ ok: true });
      } catch (e) {
        console.error('Error starting backup button observer:', e);
        sendResponse({ ok: false, error: e.message });
      }
    }
  });

  // Initialize modules in correct order
  async function initializeModules() {
    // 1. Initialize LayerManager first (required for banner)
    if (typeof LayerManager !== 'undefined' && LayerManager.init) {
      try {
        await LayerManager.init();
        console.log('[Content Script Highlighter] LayerManager initialized');
      } catch (error) {
        console.error('[Content Script Highlighter] Error initializing LayerManager:', error);
      }
    }

    // 2. Initialize HighlighterBannerManager (depends on LayerManager)
    if (typeof HighlighterBannerManager !== 'undefined') {
      try {
        await HighlighterBannerManager.init();
        console.log('[Content Script Highlighter] HighlighterBannerManager initialized');
      } catch (error) {
        console.error('[Content Script Highlighter] Error initializing HighlighterBannerManager:', error);
      }
    } else {
      console.warn('[Content Script Highlighter] HighlighterBannerManager not available');
    }

    // 3. Initialize other highlighter modules
    if (typeof Highlighter !== 'undefined' && Highlighter.init) {
      try {
        await Highlighter.init();
        console.log('[Content Script Highlighter] Highlighter initialized');
      } catch (error) {
        console.error('[Content Script Highlighter] Error initializing Highlighter:', error);
      }
    }
    
    if (typeof StickyNotes !== 'undefined' && StickyNotes.init) {
      try {
        await StickyNotes.init();
        console.log('[Content Script Highlighter] StickyNotes initialized');
      } catch (error) {
        console.error('[Content Script Highlighter] Error initializing StickyNotes:', error);
      }
    }
    
    if (typeof HighlightsSidepanel !== 'undefined' && HighlightsSidepanel.init) {
      try {
        await HighlightsSidepanel.init();
        console.log('[Content Script Highlighter] HighlightsSidepanel initialized');
      } catch (error) {
        console.error('[Content Script Highlighter] Error initializing HighlightsSidepanel:', error);
      }
    }
  }

  // Wait for DOM to be ready before initializing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeModules);
  } else {
    initializeModules();
  }
})();