# Message Feature API Reference

## Public Methods

### `loadMessages(): Promise<void>`
Loads messages from `chrome.storage.sync` and builds the active messages list.

**Returns**: Promise that resolves when messages are loaded

**Side Effects**:
- Sets `activeMessages` array
- Sets `messageSettings` object
- Sets `messagesReady` flag
- Resets `currentMessageIndex` to 0

**Usage**:
```javascript
await PersistentBanner.loadMessages();
console.log(PersistentBanner.activeMessages); // Array of enabled messages
```

---

### `getActiveMessages(messagesConfig): Array`
Filters and combines default and custom messages based on enabled state.

**Parameters**:
- `messagesConfig` (Object): Message configuration from storage

**Returns**: Array of message objects with `{ id, text, type, hoverImage, description }`

**Logic**:
1. If `defaultMessages.enabled` is true, add enabled items from `defaultMessages.items`
2. Add all enabled items from `customMessages` array
3. Return combined array

**Usage**:
```javascript
const config = {
  defaultMessages: {
    enabled: true,
    items: [{ id: "msg-1", text: "Hello", enabled: true }]
  },
  customMessages: [{ id: "custom-1", text: "World", enabled: true }]
};
const active = PersistentBanner.getActiveMessages(config);
// Returns: [{ id: "msg-1", text: "Hello", ... }, { id: "custom-1", text: "World", ... }]
```

---

### `startMessageRotation(): void`
Starts the automatic message rotation timer.

**Conditions**:
- Requires `messageSettings.autoRotate` to be true
- Requires `activeMessages.length > 1`
- Clears any existing timer first

**Side Effects**:
- Creates interval timer stored in `messageRotationInterval`
- Tracks timer in `trackedTimers` array for cleanup

**Usage**:
```javascript
PersistentBanner.startMessageRotation();
// Messages will rotate every `messageSettings.rotationInterval` ms
```

---

### `stopMessageRotation(): void`
Stops the automatic message rotation timer.

**Side Effects**:
- Clears `messageRotationInterval` timer
- Sets `messageRotationInterval` to null

**Usage**:
```javascript
PersistentBanner.stopMessageRotation();
// Rotation stops, current message remains displayed
```

---

### `rotateToNextMessage(): void`
Advances to the next message in the rotation queue.

**Behavior**: Circular rotation (wraps from last to first)

**Side Effects**:
- Increments `currentMessageIndex` (modulo `activeMessages.length`)
- Calls `updateMessageDisplay()`

**Usage**:
```javascript
PersistentBanner.rotateToNextMessage();
// Displays next message
```

---

### `rotateToPreviousMessage(): void`
Goes back to the previous message in the rotation queue.

**Behavior**: Circular rotation (wraps from first to last)

**Side Effects**:
- Decrements `currentMessageIndex` (modulo `activeMessages.length`)
- Calls `updateMessageDisplay()`

**Usage**:
```javascript
PersistentBanner.rotateToPreviousMessage();
// Displays previous message
```

---

### `rotateToMessage(index: number): void`
Jumps to a specific message by index.

**Parameters**:
- `index` (number): Zero-based message index

**Validation**: Only jumps if `index >= 0 && index < activeMessages.length`

**Side Effects**:
- Sets `currentMessageIndex` to `index`
- Calls `updateMessageDisplay()`

**Usage**:
```javascript
PersistentBanner.rotateToMessage(2);
// Displays message at index 2 (3rd message)
```

---

### `updateMessageDisplay(): void`
Updates the banner UI with the current message.

**Side Effects**:
- Updates `messageContent` element with rendered message HTML
- Updates `messageIndex` element with "X/Y" counter
- Enables/disables prev/next buttons based on message count
- Calls `setupHoverImage()` for hover functionality

**Empty State**: Displays "No messages available" and "0/0" counter

**Usage**:
```javascript
PersistentBanner.updateMessageDisplay();
// Refreshes message display in banner
```

---

### `renderMessage(messageText: string): string`
Renders message text with multiline support (max 3 lines).

**Parameters**:
- `messageText` (string): Message text (may contain `\n` for line breaks)

**Returns**: HTML string with `<div>` elements for each line

**Security**: Escapes HTML using `textContent` (CSP-compliant)

**Line Classes**:
- Single line: `message-line message-line-single`
- Two lines: `message-line message-line-double`
- Three lines: `message-line message-line-triple`

**Usage**:
```javascript
const html = PersistentBanner.renderMessage("Line 1\nLine 2\nLine 3");
// Returns: '<div class="message-line message-line-triple">Line 1</div>...'
```

---

## Context Menu Methods

### `showContextMenu(event: MouseEvent, messageId: string): void`
Displays a context menu for message actions.

**Parameters**:
- `event` (MouseEvent): Right-click event for positioning
- `messageId` (string): ID of message to act on

**Menu Items**:
- Edit message
- Add message
- Remove message
- Add/View/Remove hover image (conditional)

**Side Effects**:
- Creates menu element and appends to body
- Stores `contextMenu` and `contextMenuMessageId`
- Registers click handlers for menu items

**Usage**:
```javascript
messageElement.addEventListener('contextmenu', (e) => {
  PersistentBanner.showContextMenu(e, 'msg-1');
});
```

---

### `handleContextMenuAction(action: string, messageId: string): Promise<void>`
Routes context menu actions to appropriate handlers.

**Parameters**:
- `action` (string): Action name ("edit", "add", "remove", "add-image", "view-image", "remove-image")
- `messageId` (string): ID of message to act on

**Actions**:
- `edit` → `showEditModal(messageId)`
- `add` → `addNewMessage()`
- `remove` → `removeMessage(messageId)`
- `add-image` → `showAddImageModal(messageId)`
- `view-image` → `showViewImageModal(messageId)`
- `remove-image` → `removeHoverImage(messageId)`

---

### `showEditModal(messageId: string): Promise<void>`
Opens modal for editing message text and description.

**Parameters**:
- `messageId` (string): ID of message to edit

**Modal Elements**:
- Text textarea (maxlength 240)
- Description textarea
- Hover image preview (if exists)
- Save/Cancel buttons

**Behavior**: Saves to `chrome.storage.sync` and calls `loadMessages()` on save

---

## Hover Image Methods

### `setupHoverImage(): void`
Attaches hover listeners to message content for image popup.

**Conditions**: Only attaches if `currentMessage.hoverImage` exists

**Listeners**:
- `mouseenter` → Shows popup after delay
- `mouseleave` → Hides popup after 200ms delay

**Side Effects**:
- Tracks listeners in `trackedListeners` array

---

### `showHoverImagePopup(imageData: string, event: MouseEvent): void`
Displays hover image popup near cursor.

**Parameters**:
- `imageData` (string): Base64 image data or URL
- `event` (MouseEvent): Mouse event for positioning

**Positioning Logic**:
1. Prefers above cursor (10px margin)
2. Falls below if not enough space
3. Constrains to viewport horizontally

**Side Effects**:
- Creates popup element and appends to body
- Stores reference in `hoverImagePopup`

---

### `cleanupHoverImagePopup(): void`
Removes hover image popup from DOM.

**Side Effects**:
- Removes `hoverImagePopup` element
- Clears `hoverImageTimeout` timer
- Sets `hoverImagePopup` to null

---

## Utility Methods

### `escapeHtml(text: string): string`
Escapes HTML special characters for safe rendering.

**Parameters**:
- `text` (string): Text to escape

**Returns**: HTML-escaped string

**Implementation**: Uses `textContent` to leverage browser escaping

**Usage**:
```javascript
const safe = PersistentBanner.escapeHtml('<script>alert("xss")</script>');
// Returns: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
```

---

## Storage Event Handlers

### `chrome.storage.onChanged` Listener
Automatically reloads messages when storage changes.

**Behavior**:
1. Detects changes to `exlibris.persistentBanner.messages`
2. Calls `loadMessages()` to rebuild `activeMessages`
3. Updates display with new message set

**Location**: Registered in `content_script_exlibris.js` or `persistentBanner.js`

---

## State Properties

### Core State
- `activeMessages: Array` - Current rotation queue (enabled messages only)
- `currentMessageIndex: number` - Index of displayed message
- `messageSettings: Object` - Configuration from storage
- `messagesReady: boolean` - Load completion flag

### UI State
- `messageRotationInterval: number|null` - Interval timer ID
- `hoverImagePopup: HTMLElement|null` - Active popup element
- `contextMenu: HTMLElement|null` - Active context menu
- `editModal: HTMLElement|null` - Active edit modal
- `viewImageModal: HTMLElement|null` - Active image viewer

### Load State
- `messageLoadPromise: Promise|null` - Deduplication promise
- `messagesFeatureEnabled: boolean` - Feature flag cache

---

## Event Flow Diagram

```
User Action (popup or context menu)
    ↓
Save to chrome.storage.sync
    ↓
chrome.storage.onChanged fires
    ↓
loadMessages() called
    ↓
getActiveMessages(config)
    ↓
activeMessages[] rebuilt
    ↓
updateMessageDisplay()
    ↓
UI updated with new messages
```

---

## Initialization Flow

```
PersistentBanner.init()
    ↓
createBanner()
    ↓
loadMessages()
    ↓
getActiveMessages(config)
    ↓
activeMessages[] populated
    ↓
startMessageRotation() (if autoRotate)
    ↓
updateMessageDisplay()
    ↓
setupHoverImage()
```

---

## Cleanup Flow

```
PersistentBanner.cleanup()
    ↓
stopMessageRotation()
    ↓
cleanupHoverImagePopup()
    ↓
cleanupContextMenu()
    ↓
cleanupModals()
    ↓
Clear trackedListeners/trackedObservers/trackedTimers
```
