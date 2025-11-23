# Common Issues and Troubleshooting

## Issue: Messages Not Appearing in Banner

### Symptoms
- Banner visible but message section is empty
- Counter shows "0/0"
- No rotation happening

### Possible Causes & Solutions

#### 1. Feature Disabled
**Check**: `exlibris.features.bannerMessages` flag
```javascript
// In console:
chrome.storage.sync.get(['exlibris'], (result) => {
  console.log('bannerMessages enabled:', result.exlibris?.features?.bannerMessages);
});
```
**Solution**: Enable in popup → Features tab → Check "Banner Rotating Messages"

#### 2. Messages System Disabled
**Check**: `exlibris.persistentBanner.messages.enabled` flag
```javascript
chrome.storage.sync.get(['exlibris'], (result) => {
  console.log('messages enabled:', result.exlibris?.persistentBanner?.messages?.enabled);
});
```
**Solution**: Enable in popup → Banner Messages tab → Check "Enable rotating messages"

#### 3. All Messages Disabled
**Check**: Active messages count
```javascript
// In console:
PersistentBanner.activeMessages.length
// Should be > 0
```
**Solution**: Enable at least one default or custom message in popup

#### 4. loadMessages() Failed
**Check**: Console for errors
```javascript
// Look for:
[PersistentBanner] No message configuration found in storage
[PersistentBanner] Loaded 0 active messages
```
**Solution**: Verify storage integrity, reset to defaults if corrupted

---

## Issue: Rotation Not Working

### Symptoms
- Messages appear but don't rotate
- Counter stays at "1/X"
- Timer not incrementing

### Possible Causes & Solutions

#### 1. Auto-Rotate Disabled
**Check**: `messageSettings.autoRotate` flag
```javascript
// In console:
PersistentBanner.messageSettings?.autoRotate
// Should be true
```
**Solution**: Enable in popup → Banner Messages → Check "Auto-rotate messages"

#### 2. Only One Message
**Check**: Message count
```javascript
PersistentBanner.activeMessages.length
// Should be > 1 for rotation
```
**Solution**: Add more messages or enable additional default messages

#### 3. Timer Cleared
**Check**: Timer ID
```javascript
PersistentBanner.messageRotationInterval
// Should be a number (timer ID), not null
```
**Solution**: Reload page or call `startMessageRotation()` manually

#### 4. Page Navigation Broke Timer
**Check**: Timer status after navigation
```javascript
// After SPA navigation:
PersistentBanner.messageRotationInterval
```
**Solution**: Ensure navigation observer re-initializes rotation

---

## Issue: Hover Image Not Displaying

### Symptoms
- Message has `hoverImage` property but nothing appears on hover
- Console errors about image loading

### Possible Causes & Solutions

#### 1. Invalid Image Data
**Check**: Image source format
```javascript
const msg = PersistentBanner.activeMessages[PersistentBanner.currentMessageIndex];
console.log('Hover image:', msg.hoverImage?.substring(0, 50));
// Should start with "data:image/" or "http://" or "https://"
```
**Solution**: Re-upload image or verify URL is accessible

#### 2. CSP Blocking External Images
**Check**: Console for CSP errors
```
Refused to load the image 'http://...' because it violates the following Content Security Policy directive...
```
**Solution**: Use base64-encoded images instead of external URLs

#### 3. Image Too Large
**Check**: Base64 string length
```javascript
const msg = PersistentBanner.activeMessages[PersistentBanner.currentMessageIndex];
console.log('Image size (chars):', msg.hoverImage?.length);
// Very large values (>100000) may cause issues
```
**Solution**: Compress image or use smaller resolution

#### 4. Hover Listeners Not Attached
**Check**: Listener presence
```javascript
// In console after message display:
PersistentBanner.trackedListeners.some(l => l.event === 'mouseenter')
// Should be true
```
**Solution**: Call `setupHoverImage()` manually or reload

---

## Issue: Context Menu Not Appearing

### Symptoms
- Right-click on message does nothing
- Context menu appears briefly then disappears

### Possible Causes & Solutions

#### 1. Event Listener Not Attached
**Check**: Listener registration
```javascript
const messageContent = document.querySelector('#exl-banner-message-content');
console.log('Has contextmenu listener:', 
  PersistentBanner.trackedListeners.some(l => 
    l.element === messageContent && l.event === 'contextmenu'
  )
);
```
**Solution**: Call `wireEventHandlers()` or reload page

#### 2. Browser Context Menu Override
**Check**: Native context menu appearing instead
**Solution**: Ensure `event.preventDefault()` is called in handler

#### 3. Menu Positioned Off-Screen
**Check**: Menu position
```javascript
// After right-click:
const menu = document.querySelector('.exl-message-context-menu');
console.log('Menu position:', menu?.style.top, menu?.style.left);
```
**Solution**: Adjust positioning logic for edge cases

---

## Issue: Edits Not Saving

### Symptoms
- Edit modal opens, changes made, but message unchanged after save
- Console errors on save

### Possible Causes & Solutions

#### 1. Storage Write Failed
**Check**: Console for chrome.storage errors
```
Uncaught Error: QUOTA_BYTES_PER_ITEM quota exceeded
```
**Solution**: Remove large hover images, reduce message count

#### 2. Message ID Mismatch
**Check**: Message ID in storage vs. activeMessages
```javascript
chrome.storage.sync.get(['exlibris'], (result) => {
  const stored = result.exlibris.persistentBanner.messages.customMessages;
  const active = PersistentBanner.activeMessages;
  console.log('Stored IDs:', stored.map(m => m.id));
  console.log('Active IDs:', active.map(m => m.id));
});
```
**Solution**: Ensure IDs are unique and consistent

#### 3. loadMessages() Not Called After Save
**Check**: Message reload after save
```javascript
// After save, verify:
PersistentBanner.messagesReady === true
PersistentBanner.activeMessages.some(m => m.text === "New text")
```
**Solution**: Ensure `loadMessages()` is called in save handler

---

## Issue: Storage Sync Not Working Across Tabs

### Symptoms
- Changes in one tab don't appear in others
- Must manually reload to see updates

### Possible Causes & Solutions

#### 1. storage.onChanged Listener Not Registered
**Check**: Listener presence
```javascript
// In content script:
chrome.storage.onChanged.hasListener(handler)
```
**Solution**: Ensure listener registered in `content_script_exlibris.js`

#### 2. Different Storage Areas
**Check**: Using sync vs. local
```javascript
// Ensure consistent usage:
chrome.storage.sync.get(...)  // NOT chrome.storage.local
```
**Solution**: Always use `chrome.storage.sync` for messages

#### 3. Storage Change Ignored
**Check**: Console logs in storage.onChanged handler
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage changed:', areaName, Object.keys(changes));
});
```
**Solution**: Verify handler checks for `exlibris.persistentBanner.messages`

---

## Issue: Memory Leaks / Performance Degradation

### Symptoms
- Browser slows down after extended use
- Memory usage increases over time
- DevTools shows detached DOM nodes

### Possible Causes & Solutions

#### 1. Timers Not Cleared
**Check**: Timer tracking
```javascript
PersistentBanner.trackedTimers.length
// Should be small (1-2), not growing
```
**Solution**: Ensure `cleanup()` is called on navigation

#### 2. Event Listeners Not Removed
**Check**: Listener count
```javascript
PersistentBanner.trackedListeners.length
// Should be stable, not growing
```
**Solution**: Track and remove all listeners in `cleanup()`

#### 3. Observers Not Disconnected
**Check**: Observer status
```javascript
PersistentBanner.trackedObservers.forEach(obs => {
  console.log('Observer active:', obs.takeRecords().length);
});
```
**Solution**: Call `disconnect()` on all observers in `cleanup()`

#### 4. Popup Elements Not Removed
**Check**: Orphaned elements
```javascript
console.log('Hover popups:', document.querySelectorAll('.exl-hover-image-popup').length);
console.log('Context menus:', document.querySelectorAll('.exl-message-context-menu').length);
```
**Solution**: Call `cleanupHoverImagePopup()` and `cleanupContextMenu()`

---

## Issue: Rotation Timing Inaccurate

### Symptoms
- Messages rotate faster/slower than configured interval
- Irregular rotation pattern

### Possible Causes & Solutions

#### 1. Multiple Timers Running
**Check**: Timer count
```javascript
PersistentBanner.trackedTimers.filter(t => t.type === 'interval').length
// Should be 0 or 1, not more
```
**Solution**: Call `stopMessageRotation()` before `startMessageRotation()`

#### 2. Browser Throttling Background Tabs
**Check**: Tab visibility
```javascript
document.visibilityState
// 'visible' or 'hidden'
```
**Solution**: Expected behavior - browsers throttle inactive tabs

#### 3. Interval Not Converted to Milliseconds
**Check**: Stored vs. applied interval
```javascript
// Stored as seconds, applied as milliseconds
PersistentBanner.messageSettings.rotationInterval  // Should be in ms (e.g., 5000)
```
**Solution**: Ensure conversion in popup: `parseInt(value, 10) * 1000`

---

## Issue: XSS or Security Concerns

### Symptoms
- Worried about user-entered HTML executing
- CSP violations in console

### Mitigations in Place

#### 1. HTML Escaping
All user text is escaped using DOM methods:
```javascript
renderMessage(text) {
  const div = document.createElement('div');
  div.textContent = text;  // Automatically escapes HTML
  return div.innerHTML;
}
```

#### 2. No Dynamic Script Injection
Message display uses `textContent`, not `innerHTML` for user data:
```javascript
// Safe:
element.textContent = userMessage;

// Unsafe (not used):
element.innerHTML = userMessage;
```

#### 3. CSP Compliance
- No inline scripts
- No eval() or new Function()
- External resources validated

---

## Diagnostic Commands

### Check Full State
```javascript
console.log({
  isInitialized: PersistentBanner.isInitialized,
  messagesReady: PersistentBanner.messagesReady,
  activeMessages: PersistentBanner.activeMessages.length,
  currentIndex: PersistentBanner.currentMessageIndex,
  timerActive: PersistentBanner.messageRotationInterval !== null,
  settings: PersistentBanner.messageSettings
});
```

### Force Reload Messages
```javascript
await PersistentBanner.loadMessages();
PersistentBanner.updateMessageDisplay();
```

### Restart Rotation
```javascript
PersistentBanner.stopMessageRotation();
PersistentBanner.startMessageRotation();
```

### Clear All Messages (Reset)
```javascript
chrome.storage.sync.get(['exlibris'], (result) => {
  result.exlibris.persistentBanner.messages.customMessages = [];
  chrome.storage.sync.set({ exlibris: result.exlibris }, () => {
    PersistentBanner.loadMessages();
  });
});
```

### View Storage Contents
```javascript
chrome.storage.sync.get(['exlibris'], (result) => {
  console.log(JSON.stringify(result.exlibris.persistentBanner.messages, null, 2));
});
```

---

## When to File a Bug Report

If you've tried all troubleshooting steps and the issue persists:

1. **Collect Information**:
   - Browser version
   - Extension version
   - Console logs (filtered by `[PersistentBanner]`)
   - Storage contents (from diagnostic command)
   - Steps to reproduce

2. **Check Known Issues**:
   - Review `CHANGES.md` for recent fixes
   - Search existing GitHub issues

3. **Submit Report**:
   - Include all collected information
   - Mention which troubleshooting steps were tried
   - Provide screenshot/recording if applicable
