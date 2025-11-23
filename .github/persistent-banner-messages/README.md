# Persistent Banner Messages Feature Specification

## Overview
The **Persistent Banner Messages** feature displays rotating, user-configurable messages in the persistent banner that appears across all Salesforce pages. It allows both default (built-in) messages and custom user-defined messages with optional hover images.

## Quick Reference
- **Primary Module**: `modules/persistentBanner.js`
- **Configuration UI**: `popup.html` + `popup.js` (Banner Messages section)
- **Storage Location**: `chrome.storage.sync` under `exlibris.persistentBanner.messages`
- **Visibility**: Non-case pages (by default); optional on case pages via toggle
- **User Control**: Enable/disable, add/edit/remove messages, configure rotation interval

## Feature Components

### 1. Message Types
- **Default Messages**: Pre-defined messages showcasing extension features (toggle-only)
- **Custom Messages**: User-created messages (fully editable/deletable)

### 2. Message Properties
Each message object contains:
```javascript
{
  id: "unique-id",           // UUID or timestamp-based
  text: "Message content",   // 1-3 lines (max 240 chars)
  enabled: true|false,       // Whether message is active
  type: "default"|"custom",  // Message classification
  hoverImage: "base64...",   // Optional hover image (base64 or URL)
  description: "Notes..."    // Optional user notes
}
```

### 3. Core Functions

#### Message Loading (`loadMessages()`)
- Reads configuration from `chrome.storage.sync`
- Builds `activeMessages[]` array from enabled messages
- Sets `messagesReady` flag when complete
- Uses debouncing to prevent race conditions

#### Message Rotation
- **Auto-rotation**: Cycles through messages at configured interval (default 5s)
- **Manual navigation**: Previous/Next buttons for user control
- **Direct jump**: Click message index to select specific message
- **Pause on interaction**: Stops rotation when user hovers/clicks

#### Message Display (`updateMessageDisplay()`)
- Renders current message with line break support (max 3 lines)
- Updates message counter (e.g., "2/5")
- Handles empty state gracefully
- Applies CSP-compliant rendering (no innerHTML for user content)

### 4. User Interactions

#### Context Menu (Right-click on message)
- **Edit message**: Opens modal to modify text/description
- **Add message**: Creates new custom message
- **Remove message**: Deletes current message
- **Add/Remove/View hover image**: Manage hover image attachments

#### Hover Image Feature
- Displays image popup on mouse enter (200ms delay on leave)
- Positioned above/below message based on viewport
- Supports base64 or URL sources

#### Settings Panel (popup.html)
- Global enable/disable toggle
- Rotation interval configuration (3-60 seconds)
- Auto-rotate checkbox
- Default messages toggle
- Custom message CRUD operations

## Implementation Details

### Storage Schema
```javascript
chrome.storage.sync: {
  exlibris: {
    persistentBanner: {
      messages: {
        enabled: true,          // Master enable flag
        autoRotate: true,       // Auto-rotation flag
        rotationInterval: 5000, // Milliseconds
        defaultMessages: {
          enabled: true,
          items: [
            { id: "msg-1", text: "...", enabled: true, ... },
            ...
          ]
        },
        customMessages: [
          { id: "msg-custom-1", text: "...", enabled: true, ... },
          ...
        ]
      }
    }
  }
}
```

### State Management
Located in `modules/persistentBanner.js`:
```javascript
PersistentBanner: {
  activeMessages: [],              // Current rotation queue
  currentMessageIndex: 0,          // Active message index
  messageRotationInterval: null,   // Timer ID
  messageSettings: null,           // Settings object
  messagesReady: false,            // Load completion flag
  messageLoadPromise: null,        // Deduplication promise
  hoverImagePopup: null,           // Active popup element
  contextMenu: null,               // Active context menu
  editModal: null,                 // Active edit modal
  viewImageModal: null             // Active image viewer
}
```

### Lifecycle

#### Initialization (on banner creation)
1. `init()` → `loadMessages()` → `getActiveMessages()`
2. Builds `activeMessages[]` from enabled messages
3. Calls `startMessageRotation()` if `autoRotate` enabled
4. Calls `updateMessageDisplay()` to render first message

#### Message Updates
1. User modifies message in popup or context menu
2. Saves to `chrome.storage.sync`
3. `chrome.storage.onChanged` listener fires
4. Calls `loadMessages()` → rebuilds `activeMessages[]`
5. Updates display with new content

#### Cleanup (on navigation/unload)
1. `stopMessageRotation()` → clears interval timer
2. `cleanupHoverImagePopup()` → removes popup
3. `cleanupContextMenu()` → removes menu
4. `cleanupModals()` → removes modals

## UI Elements

### Banner Section (HTML)
```html
<div class="exl-banner-section exl-banner-messages" id="exl-banner-messages">
  <div class="exl-banner-message-content" id="exl-banner-message-content">
    <!-- Rendered message lines -->
  </div>
  <div class="exl-banner-message-nav">
    <button id="exl-message-prev">◀</button>
    <span id="exl-message-index">1/1</span>
    <button id="exl-message-next">▶</button>
  </div>
</div>
```

### Settings Panel (popup.html)
```html
<div id="bannerMessagesSettings">
  <input type="number" id="messageRotationInterval" value="5">
  <input type="checkbox" id="messageAutoRotate" checked>
  <input type="checkbox" id="defaultMessagesEnabled" checked>
  <div id="defaultMessagesList"></div>
  <button id="addCustomMessageBtn">+ Add Message</button>
  <div id="customMessagesList"></div>
</div>
```

## Related Files
- **Implementation**: `modules/persistentBanner.js` (lines 28-30, 2685-3426)
- **Configuration UI**: `popup.js` (lines 83, 97-112, 190-279, 341-576)
- **Configuration HTML**: `popup.html` (lines 201-292, 497-498, 540-574)
- **Styles**: Embedded in `modules/persistentBanner.js` (CSS in banner creation)

## Feature Flags
- `exlibris.features.bannerMessages` - Master feature toggle (default: true)
- `exlibris.persistentBanner.messages.enabled` - Messages system toggle
- `exlibris.persistentBanner.messages.autoRotate` - Auto-rotation toggle
- `exlibris.persistentBanner.messages.defaultMessages.enabled` - Default messages toggle

## Usage Examples

### Adding a Custom Message (via popup)
1. Open extension popup
2. Navigate to "Banner Messages" section
3. Click "+ Add Message"
4. Enter message text (max 240 chars, use `\n` for line breaks)
5. Optionally add hover image (base64 or URL)
6. Click "Save"

### Editing Message (via context menu)
1. Right-click on message in banner
2. Select "Edit message"
3. Modify text or description in modal
4. Click "Save"

### Configuring Rotation
1. Open extension popup
2. Set "Rotation Interval" (3-60 seconds)
3. Check/uncheck "Auto-rotate messages"
4. Changes apply immediately across all tabs

## Dependencies
- `chrome.storage.sync` API (for configuration persistence)
- `chrome.storage.onChanged` listener (for cross-tab sync)
- `DebounceUtils` module (optional, for debouncing storage operations)
- `PageContextValidator` module (optional, for validation)

## Best Practices
1. **Keep messages concise**: 1-3 lines max, ~80 chars per line
2. **Use hover images sparingly**: Large base64 images increase storage usage
3. **Test rotation timing**: Adjust interval based on message length/complexity
4. **Enable selectively**: Disable on case pages if distracting from case data
5. **Clean up unused messages**: Remove disabled messages to reduce storage bloat

## Troubleshooting

### Messages Not Appearing
- Check `exlibris.features.bannerMessages` is true
- Check `exlibris.persistentBanner.messages.enabled` is true
- Verify at least one message has `enabled: true`
- Check browser console for `[PersistentBanner]` logs

### Rotation Not Working
- Verify `autoRotate` is true
- Check rotation interval is valid (≥3000ms)
- Ensure multiple messages are enabled
- Check console for timer cleanup errors

### Hover Image Not Displaying
- Verify image source is valid base64 or URL
- Check image size (large images may fail CSP)
- Inspect console for loading errors

## Future Enhancements
- [ ] Message scheduling (show only on certain days/times)
- [ ] Conditional display (show based on page type/context)
- [ ] Message history/analytics (track views/clicks)
- [ ] Rich text formatting (bold, italic, links)
- [ ] Import/export message sets
- [ ] Message templates library
