# Message Feature Data Flow

This document traces the complete data flow for the Persistent Banner Messages feature, from user interaction through storage to display.

## Flow 1: Initial Load (Extension Startup)

```
┌─────────────────────────────────────────────────────────────────┐
│ Extension Loads                                                 │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ content_script_exlibris.js initializes                          │
│ - Calls PersistentBanner.init()                                 │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ PersistentBanner.init()                                         │
│ - Calls createBanner()                                          │
│ - Calls loadMessages()                                          │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ loadMessages()                                                  │
│ 1. Checks if messageLoadPromise exists (debounce)               │
│ 2. Wraps in debounceOperation('loadMessages', ...)              │
│ 3. Calls chrome.storage.sync.get(['exlibris'])                 │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ chrome.storage.sync callback                                    │
│ - Extracts result.exlibris.persistentBanner.messages            │
│ - Stores in this.messageSettings                                │
│ - Calls this.getActiveMessages(messagesConfig)                  │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ getActiveMessages(messagesConfig)                               │
│ 1. Create empty active[] array                                  │
│ 2. If defaultMessages.enabled:                                  │
│    - Loop through defaultMessages.items                         │
│    - Add items where enabled !== false                          │
│ 3. Loop through customMessages array                            │
│    - Add items where enabled !== false && text exists           │
│ 4. Return active[] array                                        │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Back in loadMessages() callback                                 │
│ - Sets this.activeMessages = active[]                           │
│ - Sets this.currentMessageIndex = 0                             │
│ - Sets this.messagesReady = true                                │
│ - Resolves promise                                              │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Back in init()                                                  │
│ - Calls startMessageRotation() if autoRotate enabled            │
│ - Calls updateMessageDisplay()                                  │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ updateMessageDisplay()                                          │
│ 1. Get currentMessage = activeMessages[currentMessageIndex]     │
│ 2. Call renderMessage(currentMessage.text)                      │
│ 3. Set messageContent.innerHTML = rendered HTML                 │
│ 4. Set messageIndex.textContent = "X/Y"                         │
│ 5. Enable/disable prev/next buttons                             │
│ 6. Call setupHoverImage()                                       │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Message Displayed in Banner                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 2: User Adds Custom Message (Popup)

```
┌─────────────────────────────────────────────────────────────────┐
│ User clicks "+ Add Message" in popup.html                       │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ popup.js: addCustomMessageBtn click handler                     │
│ - Creates new message item with empty textarea                  │
│ - Generates unique ID (timestamp or UUID)                       │
│ - Appends to customMessagesList container                       │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ User enters message text in textarea                            │
│ (Optional: adds hover image via file input)                     │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ User clicks "Save Settings" button                              │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ popup.js: saveSettings() function                               │
│ 1. Calls getMessageSettingsFromUI()                             │
│ 2. Collects all message items from DOM                          │
│ 3. Builds messagesConfig object                                 │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ getMessageSettingsFromUI()                                      │
│ 1. Query customMessagesList for [data-message-id]               │
│ 2. Loop through items:                                          │
│    - Extract id, text, enabled, hoverImage, description         │
│    - Push to customMessages[] array                             │
│ 3. Return config object with:                                   │
│    - enabled, autoRotate, rotationInterval                      │
│    - defaultMessages { enabled, items }                         │
│    - customMessages []                                          │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ chrome.storage.sync.set({ exlibris: { persistentBanner: { ... }}}) │
│ - Saves entire exlibris configuration                           │
│ - Includes messages config                                      │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ chrome.storage.onChanged event fires                            │
│ (In all tabs with content script)                               │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ content_script_exlibris.js: storage.onChanged listener          │
│ - Detects change to exlibris.persistentBanner.messages          │
│ - Calls PersistentBanner.loadMessages()                         │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ loadMessages() → getActiveMessages() → updateMessageDisplay()   │
│ (Same flow as Initial Load)                                     │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Banner updates with new message visible in rotation             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 3: User Edits Message via Context Menu

```
┌─────────────────────────────────────────────────────────────────┐
│ User right-clicks on message in banner                          │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ persistentBanner.js: contextmenu event listener                 │
│ - Calls showContextMenu(event, currentMessage.id)               │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ showContextMenu(event, messageId)                               │
│ 1. Creates context menu element                                 │
│ 2. Populates menu items (Edit, Add, Remove, Image options)      │
│ 3. Positions menu at cursor location                            │
│ 4. Appends to document.body                                     │
│ 5. Attaches click handler                                       │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ User clicks "Edit message" menu item                            │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ handleContextMenuAction('edit', messageId)                      │
│ - Calls showEditModal(messageId)                                │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ showEditModal(messageId)                                        │
│ 1. Find message in activeMessages by ID                         │
│ 2. Create modal element with textarea (pre-filled)              │
│ 3. Append to document.body                                      │
│ 4. Attach save/cancel handlers                                  │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ User modifies text and clicks "Save"                            │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Modal save handler                                              │
│ 1. Get new text from textarea                                   │
│ 2. Read current config from chrome.storage.sync                 │
│ 3. Find message in config by ID                                 │
│ 4. Update message.text property                                 │
│ 5. Write updated config back to chrome.storage.sync             │
│ 6. Call loadMessages() to refresh                               │
│ 7. Close modal                                                  │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ chrome.storage.onChanged fires (same as Flow 2)                 │
│ - Reloads messages in all tabs                                  │
│ - Updates display                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 4: Auto-Rotation Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│ startMessageRotation() called (during init or settings change)  │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Check conditions:                                               │
│ - messageSettings.autoRotate === true?                          │
│ - activeMessages.length > 1?                                    │
│ If NO: return early (no rotation needed)                        │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ setInterval(() => rotateToNextMessage(), rotationInterval)      │
│ - Store interval ID in messageRotationInterval                  │
│ - Track in trackedTimers[] array                                │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
         ┌──────────┴──────────┐
         ↓                     ↓ (After rotationInterval ms)
┌─────────────────────────────────────────────────────────────────┐
│ Timer fires: rotateToNextMessage()                              │
│ 1. currentMessageIndex = (currentMessageIndex + 1) % length     │
│ 2. Call updateMessageDisplay()                                  │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ updateMessageDisplay()                                          │
│ - Renders next message in rotation                              │
│ - Updates counter (e.g., "2/5" → "3/5")                         │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
         ┌──────────┴──────────┐
         ↓                     ↓ (Repeat indefinitely)
    (Back to Timer)
```

---

## Flow 5: User Navigates Messages Manually

```
┌─────────────────────────────────────────────────────────────────┐
│ User clicks "Next" button (►)                                   │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ messageNextBtn click handler                                    │
│ - Calls rotateToNextMessage()                                   │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ rotateToNextMessage()                                           │
│ 1. currentMessageIndex = (currentMessageIndex + 1) % length     │
│ 2. Call updateMessageDisplay()                                  │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ updateMessageDisplay()                                          │
│ - Renders next message                                          │
│ - Updates counter                                               │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Banner displays next message                                    │
│ (Auto-rotation continues from new position)                     │
└─────────────────────────────────────────────────────────────────┘

Alternative: User clicks "Previous" (◀)
    ↓
rotateToPreviousMessage()
    ↓
currentMessageIndex = (currentMessageIndex - 1 + length) % length
    ↓
updateMessageDisplay()
    ↓
Banner displays previous message
```

---

## Flow 6: Hover Image Display

```
┌─────────────────────────────────────────────────────────────────┐
│ updateMessageDisplay() completes                                │
│ - Calls setupHoverImage()                                       │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ setupHoverImage()                                               │
│ 1. Check if currentMessage.hoverImage exists                    │
│ 2. If YES: attach mouseenter/mouseleave listeners               │
│ 3. Track listeners in trackedListeners[]                        │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ User hovers over message content                                │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ mouseenter handler fires                                        │
│ - Calls showHoverImagePopup(hoverImage, event)                  │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ showHoverImagePopup(imageData, event)                           │
│ 1. Call cleanupHoverImagePopup() (clear old popup)              │
│ 2. Create popup div with <img> element                          │
│ 3. Set src to imageData (base64 or URL)                         │
│ 4. Calculate position (above cursor, fallback below)            │
│ 5. Constrain to viewport bounds                                 │
│ 6. Append to document.body                                      │
│ 7. Store in hoverImagePopup property                            │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Popup visible near cursor                                       │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ User moves cursor away from message                             │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ mouseleave handler fires                                        │
│ - Sets timeout (200ms delay)                                    │
│ - Stores in hoverImageTimeout                                   │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Timeout fires: cleanupHoverImagePopup()                         │
│ 1. Clear hoverImageTimeout                                      │
│ 2. Remove hoverImagePopup element from DOM                      │
│ 3. Set hoverImagePopup = null                                   │
└───────────────────┬─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Popup removed from view                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Structure at Each Stage

### In chrome.storage.sync
```json
{
  "exlibris": {
    "persistentBanner": {
      "messages": {
        "enabled": true,
        "autoRotate": true,
        "rotationInterval": 5000,
        "defaultMessages": {
          "enabled": true,
          "items": [
            {
              "id": "default-1",
              "text": "Feature message...",
              "enabled": true,
              "hoverImage": null,
              "description": ""
            }
          ]
        },
        "customMessages": [
          {
            "id": "custom-1683234567890",
            "text": "My custom message",
            "enabled": true,
            "hoverImage": "data:image/png;base64,...",
            "description": "Optional notes"
          }
        ]
      }
    }
  }
}
```

### In PersistentBanner module (runtime)
```javascript
{
  activeMessages: [
    { id: "default-1", text: "Feature message...", type: "default", hoverImage: null, description: "" },
    { id: "custom-1683234567890", text: "My custom message", type: "custom", hoverImage: "data:...", description: "..." }
  ],
  currentMessageIndex: 0,
  messageSettings: {
    enabled: true,
    autoRotate: true,
    rotationInterval: 5000,
    defaultMessages: { enabled: true, items: [...] },
    customMessages: [...]
  },
  messagesReady: true,
  messageRotationInterval: 12345 // setInterval ID
}
```

### In Banner DOM
```html
<div class="exl-banner-messages">
  <div class="exl-banner-message-content">
    <div class="message-line message-line-single">Feature message...</div>
  </div>
  <div class="exl-banner-message-nav">
    <button id="exl-message-prev">◀</button>
    <span id="exl-message-index">1/2</span>
    <button id="exl-message-next">▶</button>
  </div>
</div>
```
