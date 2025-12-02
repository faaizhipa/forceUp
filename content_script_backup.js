/**
 * Backup Content Script for Salesforce
 * Injects a "Backup to Drive" button into the Salesforce Lightning UI
 * 
 * Uses the Check-Then-Observe pattern to handle Salesforce's dynamic DOM.
 * The button sends a message to the background service worker to trigger
 * the backup process via the DriveBackup module.
 * 
 * @module content_script_backup
 * @version 1.0.0
 */

(function() {
  'use strict';

  const BUTTON_ID = 'penang-coe-backup-button';
  
  // Selectors for Salesforce header action containers
  // These are common locations where action buttons appear in Lightning
  const CONTAINER_SELECTORS = [
    '[data-aura-class="forceActionsContainer"]',
    '[data-region-name="page-header"] .slds-page-header__row .slds-page-header__col-actions',
    'records-lwc-highlights-panel .slds-page-header__row .slds-page-header__col-actions',
    '.slds-page-header .slds-page-header__col-actions',
    'force-highlights-panel .slds-page-header__row .slds-button-group'
  ];

  let buttonInjected = false;
  let pageObserver = null;

  /**
   * Creates the "Backup to Drive" button element
   * @returns {HTMLButtonElement}
   */
  function createBackupButton() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = 'slds-button slds-button_neutral';
    button.textContent = 'Backup to Drive';
    button.title = 'Backup extension data to Google Drive';
    button.style.cssText = 'margin-left: 8px;';
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Disable button during backup
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = 'Backing up...';
      
      // Timeout to handle cases where background script doesn't respond
      const TIMEOUT_MS = 60000; // 60 second timeout for backup operation
      let responseReceived = false;
      
      const timeoutId = setTimeout(() => {
        if (!responseReceived) {
          console.warn('[BackupButton] Backup request timed out');
          button.textContent = 'Timeout!';
          setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
          }, 2000);
        }
      }, TIMEOUT_MS);
      
      try {
        console.log('[BackupButton] Sending backup request to background');
        
        chrome.runtime.sendMessage({ type: 'RUN_DRIVE_BACKUP_FROM_SF' }, (response) => {
          responseReceived = true;
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            console.error('[BackupButton] Runtime error:', chrome.runtime.lastError);
            button.textContent = 'Error!';
          } else if (response && response.ok) {
            console.log('[BackupButton] Backup successful:', response.message);
            button.textContent = 'Done!';
          } else {
            console.error('[BackupButton] Backup failed:', response?.error);
            button.textContent = 'Failed!';
          }
          
          // Reset button after delay
          setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
          }, 2000);
        });
      } catch (error) {
        responseReceived = true;
        clearTimeout(timeoutId);
        console.error('[BackupButton] Error:', error);
        button.textContent = 'Error!';
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 2000);
      }
    });
    
    return button;
  }

  /**
   * Attempts to find a suitable container and inject the button
   * @returns {boolean} True if injection was successful
   */
  function tryInjectButton() {
    // Check if button already exists
    if (document.getElementById(BUTTON_ID)) {
      console.log('[BackupButton] Button already exists');
      buttonInjected = true;
      return true;
    }

    // Try each selector to find a container
    for (const selector of CONTAINER_SELECTORS) {
      const container = document.querySelector(selector);
      if (container) {
        // Verify container is visible
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          console.log('[BackupButton] Found container:', selector);
          
          const button = createBackupButton();
          container.appendChild(button);
          
          buttonInjected = true;
          console.log('[BackupButton] Button injected successfully');
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Sets up a MutationObserver to watch for container appearance
   * Uses Check-Then-Observe pattern from repo guidelines
   */
  function observeForContainer() {
    // Clean up any existing observer
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }

    pageObserver = new MutationObserver((mutations) => {
      // Don't observe anymore if button is already injected
      if (buttonInjected || document.getElementById(BUTTON_ID)) {
        pageObserver.disconnect();
        pageObserver = null;
        return;
      }

      // Try to inject on each mutation batch
      if (tryInjectButton()) {
        // Success - disconnect observer
        pageObserver.disconnect();
        pageObserver = null;
      }
    });

    pageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[BackupButton] Observer attached, waiting for container');
  }

  /**
   * Initializes the backup button injection
   * Called when INIT_SF_BACKUP_BUTTON message is received
   */
  function initBackupButton() {
    console.log('[BackupButton] Initializing...');
    
    // Reset injection state for SPA navigation
    buttonInjected = false;

    // Try immediate injection (Check-Then-Observe pattern)
    if (tryInjectButton()) {
      console.log('[BackupButton] Immediate injection successful');
      return;
    }

    // If not found, set up observer
    observeForContainer();
  }

  /**
   * Cleans up the button and observer
   */
  function cleanup() {
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
    
    const existingButton = document.getElementById(BUTTON_ID);
    if (existingButton) {
      existingButton.remove();
    }
    
    buttonInjected = false;
  }

  // Listen for initialization message from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'INIT_SF_BACKUP_BUTTON') {
      console.log('[BackupButton] Received init message');
      
      // Clean up before re-initializing (handles SPA navigation)
      cleanup();
      
      // Initialize the button
      initBackupButton();
      
      // Respond with success
      sendResponse({ ok: true, message: 'Backup button initialization started' });
      return true;
    }
  });

  console.log('[BackupButton] Content script loaded');
})();
