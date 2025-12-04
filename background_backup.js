importScripts('utils/storage.js', 'utils/google-drive.js');

const ALARM_NAME = 'backup_alarm';

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  // Default alarm: Daily
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1440 });
  
  // Store default frequency preference if not set? 
  // We don't have easy access to DOM storage here, so we trust the alarm existence.
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log("Starting scheduled backup...");
    try {
      const token = await GoogleDrive.getAuthToken(false);
      if (token) {
        const data = await Storage.getAllNotes();
        // Skip if empty? Maybe not, to sync deletions.
        await GoogleDrive.performBackup(data);
        console.log("Scheduled backup complete.");
      } else {
        console.log("Skipping backup: Not authenticated.");
      }
    } catch (e) {
      console.error("Scheduled backup failed:", e);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SET_ALARM') {
    let minutes = 1440; // daily
    switch (request.frequency) {
      case 'hourly': minutes = 60; break;
      case 'daily': minutes = 1440; break;
      case 'weekly': minutes = 10080; break;
    }
    
    chrome.alarms.clear(ALARM_NAME, () => {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: minutes });
      console.log(`Backup frequency set to ${request.frequency} (${minutes} mins)`);
    });
  }
});