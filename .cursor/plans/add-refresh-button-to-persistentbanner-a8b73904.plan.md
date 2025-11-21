<!-- a8b73904-66c9-4afb-8431-8e8cdf71457a 1775408a-8812-4b4d-b932-4558c0c7b072 -->
# Add Feature Explanations, Hover Images, and Enhanced Message Management

## Overview

Enhance banner messages with feature explanations, add hover image functionality with multiple upload methods, implement right-click context menu for message management, and create modals for editing and viewing messages.

## Changes Required

### 1. Update Default Messages with Descriptions

**Files:** `modules/settingsManager.js`, `popup.js`

Add `description` field to each default message object:

- What the feature does
- How to access it  
- Which sites it applies to

**New structure:**

```javascript
{ 
  id: 'default_1', 
  text: 'Field Highlighting', 
  enabled: true,
  description: 'Highlights key case fields with color coding (red=empty required, yellow=filled). Automatically appears on case pages. Access: Popup > Features > Field Highlighting. Applies to: proquestllc.lightning.force.com'
}
```

**Update Context Menu message text:**

- Change from: `'Context Menu Formatting'`
- Change to: `'Context Menu: Format text (𝗕𝗼𝗹𝗱, 𝘐𝘵𝘢𝘭𝘪𝘤, UPPERCASE, ▪)'`

### 2. Update Settings UI to Display Descriptions

**Files:** `popup.js`, `popup.html`

Modify `renderDefaultMessages()` to show descriptions:

- Add `title` attribute for tooltip on hover
- Optionally add info icon (ℹ️) with expandable description

### 3. Add Toggle for Messages on Case Pages

**Files:** `modules/settingsManager.js`, `popup.js`, `popup.html`

Add `showOnCasePages` setting:

```javascript
persistentBanner: {
  messages: {
    enabled: true,
    showOnCasePages: false,  // NEW
    // ... existing settings
  }
}
```

### 4. Implement Collapsible Message Section on Case Pages

**Files:** `modules/persistentBanner.js`, `modules/styles/persistent-banner.css`

When `showOnCasePages` is enabled:

- Add up/down arrows (leftmost, same style as nav arrows)
- Toggle between showing case details OR messages
- Messages section max-width: 25% of banner width on PC
- Store toggle state in memory

### 5. Add Hover Image Feature

**Files:** `modules/settingsManager.js`, `popup.js`, `popup.html`, `modules/persistentBanner.js`, `modules/styles/persistent-banner.css`

**Message Data Structure:**

```javascript
{
  id: 'custom_123',
  text: 'Message text',
  enabled: true,
  hoverImage: null,  // base64 string or blob URL
  description: ''    // Optional note section
}
```

**Storage:**

- Store images as base64 in `chrome.storage.local`
- Max size: 2MB per image (warn user)
- Consider blob URLs for large images with cleanup

**Image Upload Methods:**

1. File upload: `<input type="file" accept="image/*">` with drag-and-drop
2. URL upload: Text input with validation and preview
3. Clipboard paste: Listen for paste events, extract image

**UI Locations:**

- Popup settings: Add image upload to each custom message
- Banner right-click: Context menu option "Add hover image"

**Hover Popup:**

- Show on mouse hover over message section
- Position above/below (avoid viewport edges)
- Max size: 700x700px (scale proportionally)
- Support animated GIFs
- Auto-hide on mouse leave

### 6. Right-Click Context Menu (Banner Message Section)

**Files:** `modules/persistentBanner.js`, `modules/styles/persistent-banner.css`

**When NO hover image:**

- Edit message
- Add message
- Remove message
- Add hover image

**When hover image EXISTS:**

- Edit message
- Add message
- Remove message
- View hover image
- Remove hover image

**Implementation:**

- Add `contextmenu` event listener to message section
- Create positioned context menu (match existing context menu styles)
- Handle click outside to close
- Store current message ID for context

### 7. Edit Message Modal

**Files:** `modules/persistentBanner.js`, `popup.js`, `modules/styles/persistent-banner.css`

**Features:**

- Mobile-width popup (max-width: between 700 - 400px)
- Text editing area (textarea)
- Description/note section (textarea with image paste support)
- Image paste in description (convert to base64 inline)
- Preview of hover image if attached
- Save/Cancel buttons
- Overlay background

**Image Paste in Description:**

- Listen for paste events in description textarea
- Extract image from clipboard
- Convert to base64
- Insert as data URL in text or as separate image element

### 8. View Hover Image Modal

**Files:** `modules/persistentBanner.js`, `modules/styles/persistent-banner.css`

**Features:**

- Full-screen or large modal overlay
- Display image/GIF at full size (with max constraints)
- Close button
- Support zoom/pan for large images
- Centered display

### 9. Remove Message Confirmation

**Files:** `modules/persistentBanner.js`

**Features:**

- Confirmation dialog: "Are you sure you want to remove this message?"
- Include message text in confirmation
- Yes/No buttons
- Only proceed if user confirms

### 10. Add Message Functionality

**Files:** `popup.js`, `modules/persistentBanner.js`

**Features:**

- Creates new message with placeholder: "New message - click to edit"
- Generates unique ID: `custom_${Date.now()}`
- Immediately allows editing
- Appears in message list

### 11. CSS for New Features

**File:** `modules/styles/persistent-banner.css`

Add styles for:

- Hover image popup (positioned, z-index, border, shadow)
- Context menu (positioned, styled consistently)
- Edit message modal (mobile-width, centered, overlay)
- View image modal (full-screen overlay, centered)
- Image upload UI (drag-and-drop zone, preview)
- Loading states for images
- Collapsible section arrows and states

## Implementation Details

### Default Message Descriptions

1. **Field Highlighting**: "Highlights key case fields with color coding (red=empty required, yellow=filled). Automatically appears on case pages. Access: Popup > Features > Field Highlighting. Applies to: proquestllc.lightning.force.com"

2. **Context Menu Formatting**: "Right-click context menu for text formatting. Select text and right-click in any textarea. Examples: Bold (𝗧𝗲𝘅𝘁), Italic (𝘛𝘦𝘹𝘵), UPPERCASE (TEXT), Insert symbols (▪, ►). Access: Popup > Features > Context Menu Formatting. Applies to: proquestllc.lightning.force.com"

3. **Multi-Tab Warning**: "Detects when same case is open in multiple tabs and shows warning banner. Automatically appears when duplicate tabs detected. Access: Popup > Features > Multi-Tab Warning. Applies to: proquestllc.lightning.force.com"

4. **Auto-Save Comments**: "Auto-saves comment text as you type with history tracking. Automatically saves every 2 seconds in case comment textareas. Access: Popup > Features > Auto-Save Comments. Applies to: proquestllc.lightning.force.com"

5. **Character Counter**: "Displays live character count (0/4000) near Save button with color thresholds. Automatically appears on case comment pages. Access: Popup > Features > Character Counter. Applies to: proquestllc.lightning.force.com"

6. **Dynamic Buttons**: "Injects action buttons that generate dynamic URLs for Live View, Back Office, Sandbox, SQL, JIRA, Analytics. Automatically appears in header details area on case pages. Access: Popup > Ex Libris > Menu Locations. Applies to: proquestllc.lightning.force.com"

7. **Persistent Banner**: "Fixed banner at top showing case info, customer metadata, navigation history, and quick actions. Automatically appears on all ProQuest pages. Access: Popup > Features > Persistent Banner. Applies to: proquestllc.lightning.force.com"

8. **Text Highlighter & Sticky Notes**: "Highlight text and add sticky notes on support documentation pages. Select text to highlight, click note icon to add notes. Access: Popup > Features > Text Highlighter & Sticky Notes. Applies to: support.clarivate.com, knowledge.exlibrisgroup.com, developers.exlibrisgroup.com"

## Testing Checklist

- Verify descriptions appear in settings UI (tooltip or expandable)
- Test hover image popup appears/disappears correctly
- Test all three image upload methods (file, URL, clipboard)
- Test image storage and retrieval from chrome.storage
- Test edit message modal with image paste in description
- Test view hover image modal
- Test remove message confirmation
- Test add message with default placeholder
- Test right-click context menu on banner message section
- Test context menu options change based on hover image presence
- Test collapsible message section on case pages
- Test toggle between case details and messages
- Verify images work for both default and custom messages
- Test image size limits and warnings
- Ensure backward compatibility (messages without hoverImage still work)
- Test on case pages with collapsible message section