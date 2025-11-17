# Planning Guide

A web-based text highlighter and sticky notes application that allows users to select and highlight text in different colors, create draggable sticky notes for annotations, all with persistent storage.

**Experience Qualities**:
1. **Intuitive** - Highlighting text and creating notes should feel natural and immediate, like using physical highlighters and sticky notes on paper
2. **Precise** - Color selection, highlight management, and note positioning should be clear and responsive with no ambiguity
3. **Persistent** - Highlights and notes should reliably save and reappear, creating a sense of permanence and trust

**Complexity Level**: Light Application (multiple features with basic state)
  - Features include text selection, color palette interaction, highlight persistence, highlight removal, sticky note creation, note dragging, note editing, and note deletion - all centered around a cohesive annotation and highlighting experience

## Essential Features

### Sticky Top Banner
- **Functionality**: A fixed banner at the top of the viewport containing highlight controls
- **Purpose**: Provides constant access to highlighting tools without interfering with content
- **Trigger**: Renders immediately on page load
- **Progression**: Page loads → Banner appears fixed at top → User sees highlight button and color palette → Banner stays visible during scroll
- **Success criteria**: Banner remains visible and accessible at all times; does not obstruct content readability

### Color Palette Selection
- **Functionality**: Display 12 soft, pastel-like colors in an accessible grid or row
- **Purpose**: Allow users to choose their preferred highlight color before highlighting text
- **Trigger**: User clicks or hovers over color picker area
- **Progression**: User views palette → Selects a color → Visual feedback shows selected color → Selected color is used for next highlight action
- **Success criteria**: Currently selected color is clearly indicated; color changes are immediate and obvious; colors are soft and readable on white backgrounds

### Text Highlighting
- **Functionality**: Apply colored background to user-selected text ranges
- **Purpose**: Allow users to emphasize and mark important text passages
- **Trigger**: User selects text then clicks "Highlight" button
- **Progression**: User selects text with cursor → Clicks highlight button → Selected text receives colored background in chosen color → Highlight persists on page
- **Success criteria**: Highlighted text is clearly visible; highlights don't break text layout; multiple highlights can coexist

### Persistent Storage
- **Functionality**: Save all highlights with their positions, colors, and text content
- **Purpose**: Ensure highlights remain after page refresh or revisit
- **Trigger**: Automatically triggered after each highlight action
- **Progression**: User creates highlight → System saves highlight data to storage → User refreshes page → System restores all highlights from storage → Highlights reappear in correct positions
- **Success criteria**: All highlights survive page refresh; highlights appear within 100ms of page load; no data loss

### Highlight Removal
- **Functionality**: Remove individual highlights via context menu
- **Purpose**: Allow users to undo or clean up unwanted highlights
- **Trigger**: User right-clicks on a highlighted text segment
- **Progression**: User right-clicks highlighted text → Context menu appears → User clicks "Remove Highlight" → Highlight removed from display → Storage updated to remove highlight → Page reflects deletion
- **Success criteria**: Context menu appears on right-click; removal is immediate; storage updates prevent removed highlights from reappearing

### Sticky Note Creation
- **Functionality**: Create new sticky note elements on the page
- **Purpose**: Allow users to add free-form annotations and comments anywhere on the page
- **Trigger**: User clicks "Add Note" button in sticky banner
- **Progression**: User clicks "Add Note" → New note appears centered in viewport → Note is ready for typing → Position, content, and color auto-save
- **Success criteria**: Notes appear instantly; cursor focus is natural; notes don't obstruct critical content

### Sticky Note Editing
- **Functionality**: Type and edit text content within sticky notes
- **Purpose**: Allow users to write annotations, reminders, and comments
- **Trigger**: User clicks into textarea of any note
- **Progression**: User clicks textarea → Cursor appears → User types content → Content auto-saves on change → Text persists after page reload
- **Success criteria**: Textarea is responsive; auto-save is seamless; no data loss on page refresh

### Sticky Note Dragging
- **Functionality**: Click and drag notes to reposition them anywhere on the page
- **Purpose**: Allow flexible positioning of notes to avoid content obstruction
- **Trigger**: User clicks and holds on note header or body (not textarea)
- **Progression**: User clicks note → Drag begins → Note follows cursor → User releases → Position saves → Position persists on reload
- **Success criteria**: Dragging is smooth; notes stay within viewport bounds; position persists reliably

### Sticky Note Color Selection
- **Functionality**: Change note background color from a palette of 6 colors
- **Purpose**: Allow visual organization and categorization of notes
- **Trigger**: User clicks on color chip in note header
- **Progression**: User clicks color chip → Note background changes instantly → New color persists → Color visible on reload
- **Success criteria**: Color change is instant; all 6 colors are visually distinct; selection state is clear

### Sticky Note Deletion
- **Functionality**: Remove individual notes from the page
- **Purpose**: Allow users to clean up completed or unwanted notes
- **Trigger**: User clicks delete button (X icon) in note header
- **Progression**: User clicks X button → Confirmation toast appears → Note removed from display → Storage updated → Note doesn't reappear on reload
- **Success criteria**: Deletion is instant; no accidental deletions; storage cleanup is complete

### Bookmark Collection Creation
- **Functionality**: Create named collections to organize bookmarks
- **Purpose**: Allow users to categorize and group their bookmarked pages
- **Trigger**: User clicks "New Collection" button in Collections panel
- **Progression**: User opens Collections panel → Clicks "New Collection" → Enters name → Collection created → Collection appears in list
- **Success criteria**: Collections save immediately; names are editable; collections persist across sessions

### Collection Management
- **Functionality**: Rename and delete bookmark collections
- **Purpose**: Allow users to reorganize and maintain their collection structure
- **Trigger**: User right-clicks on a collection in the Collections panel
- **Progression**: User right-clicks collection → Context menu appears → User selects rename or delete → Action completes → Storage updates
- **Success criteria**: Renaming is intuitive; deletion warns if bookmarks exist; changes persist

### Page Bookmarking
- **Functionality**: Save current page to a collection with title and description
- **Purpose**: Allow users to capture and organize pages for later reference
- **Trigger**: User clicks "Bookmark" button in sticky banner
- **Progression**: User clicks Bookmark → Modal opens with current page title and URL → User selects collection → Optionally edits title/description → Saves → Bookmark added to collection
- **Success criteria**: Page title auto-populates; URL is captured; description limited to 200 characters; bookmark saves to selected collection

### Bookmark Management
- **Functionality**: View, open, and delete bookmarks within collections
- **Purpose**: Allow users to access saved pages and maintain their bookmark library
- **Trigger**: User opens Collections panel and expands a collection
- **Progression**: User opens Collections panel → Expands collection → Sees bookmark list → Can click to open in new tab or right-click to delete
- **Success criteria**: Bookmarks display title and description; clicking opens page in new tab; deletion is confirmed; URL can be copied

## Edge Case Handling

- **Overlapping Highlights**: Later highlights take visual precedence; right-click context menu allows removal of the topmost highlight
- **Text Selection Errors**: If no text is selected when highlight button is clicked, show a subtle toast notification
- **Storage Limits**: Monitor storage usage; if approaching limits, show warning or implement cleanup
- **Dynamic Content**: Focus on static content highlighting; dynamic content may lose highlight positioning
- **Cross-Session Conflicts**: URL-based storage keys prevent conflicts between different pages
- **Context Menu on Non-Highlighted Text**: Context menu only appears when right-clicking on highlighted text segments
- **Note Positioning Off-Screen**: Notes initialize in viewport center; dragging keeps notes accessible
- **Empty Notes**: Empty notes are allowed and persist; users can use them as placeholders or visual markers
- **Note Overlap**: Notes can overlap; most recently dragged note comes to front (z-index management)
- **Simultaneous Editing**: Single-user application; no conflict resolution needed for concurrent edits
- **Bookmarking Without Collections**: If user tries to bookmark without creating a collection first, show error and open Collections panel
- **Collection Deletion With Bookmarks**: Warn user before deleting a collection that contains bookmarks; confirm action
- **Duplicate Bookmarks**: Allow duplicate URLs in same or different collections; user may want to bookmark same page multiple times with different context
- **Invalid URLs**: Basic URL validation in bookmark form; accept any valid URL format
- **Long Bookmark Titles/Descriptions**: Title limited to 100 characters; description limited to 200 characters with counter display

## Design Direction

The design should feel clean, modern, and tool-focused - like a premium productivity application. It should project efficiency and precision with a minimal interface that stays out of the way until needed, using subtle shadows and smooth interactions to feel polished and professional. Sticky notes should feel tactile and familiar, reminiscent of physical sticky notes with soft colors and draggable interactions. The bookmark system should feel organized and library-like, with clear visual hierarchy showing collections and their contents.

## Color Selection

Custom palette - The 12 soft, pastel highlight colors are predefined and serve as both the palette and the highlight system.

**Highlight Color Palette** (RGB/HEX format for maximum browser compatibility):
1. Soft Peach: #FEF0EC / rgb(254, 240, 236)
2. Warm Ivory: #FFF7ED / rgb(255, 247, 237)
3. Light Yellow: #FEFCE8 / rgb(254, 252, 232)
4. Mint Green: #F0FDF4 / rgb(240, 253, 244)
5. Pale Teal: #ECFDF5 / rgb(236, 253, 245)
6. Sky Blue: #ECFEFF / rgb(236, 254, 255)
7. Light Blue: #EFF6FF / rgb(239, 246, 255)
8. Lavender: #EEF2FF / rgb(238, 242, 255)
9. Pale Purple: #F5F3FF / rgb(245, 243, 255)
10. Soft Pink: #FDF2F8 / rgb(253, 242, 248)
11. Blush: #FFF1F2 / rgb(255, 241, 242)
12. Light Gray: #F8FAFC / rgb(248, 250, 252)

**Sticky Note Color Palette** (6 colors optimized for readability and visual appeal):
1. Light Yellow: #FEFCE8 / rgb(254, 252, 232)
2. Light Blue: #EFF6FF / rgb(239, 246, 255)
3. Soft Pink: #FDF2F8 / rgb(253, 242, 248)
4. Mint Green: #F0FDF4 / rgb(240, 253, 244)
5. Lavender: #F5F3FF / rgb(245, 243, 255)
6. Soft Peach: #FEF0EC / rgb(254, 240, 236)

- **Primary Color**: Deep indigo `oklch(0.45 0.15 270)` - Communicates focus and professionalism for the banner and primary controls
- **Secondary Colors**: Soft slate gray `oklch(0.85 0.01 240)` for secondary UI elements and subtle backgrounds
- **Accent Color**: The currently selected highlight color from the 12-color palette serves as the dynamic accent
- **Foreground/Background Pairings**: 
  - Background (White `oklch(0.99 0 0)`): Dark text `oklch(0.25 0.01 240)` - Ratio 13.2:1 ✓
  - Banner (Deep Indigo `oklch(0.45 0.15 270)`): White text `oklch(0.99 0 0)` - Ratio 8.9:1 ✓
  - Card (Light Gray `oklch(0.97 0.005 240)`): Dark text `oklch(0.25 0.01 240)` - Ratio 12.8:1 ✓
  - Muted (Medium Gray `oklch(0.65 0.01 240)`): White text `oklch(0.99 0 0)` - Ratio 5.2:1 ✓

## Font Selection

Typography should feel modern and highly legible, projecting clarity and precision suitable for a tool interface - Inter for its exceptional readability at all sizes and professional character.

- **Typographic Hierarchy**:
  - H1 (Banner Title): Inter SemiBold/20px/tight letter spacing (-0.01em)
  - H2 (Section Headers): Inter Medium/16px/normal letter spacing
  - Body (Content Text): Inter Regular/15px/relaxed line height (1.6)
  - Button Labels: Inter Medium/14px/tight letter spacing (-0.005em)
  - Helper Text: Inter Regular/13px/normal

## Animations

Animations should be subtle and functional, reinforcing actions without drawing unnecessary attention - quick micro-interactions that provide satisfying feedback while maintaining the tool's professional efficiency. Sticky notes should animate naturally during drag operations and deletion.

- **Purposeful Meaning**: Smooth color transitions in the palette communicate selection state; gentle fade-ins for the banner prevent jarring page loads; highlight appearance should feel like ink soaking into paper; note dragging should feel physical with slight scale increase; note deletion should fade out smoothly
- **Hierarchy of Movement**: Color picker interactions get immediate <100ms feedback; highlight application uses a 150ms ease-out; banner entry uses 200ms for polish without delay; note dragging provides instant visual feedback with scale transform; note color changes are instant

## Component Selection

- **Components**: 
  - Button (shadcn) for the "Highlight", "Add Note", "Bookmark", and action buttons with hover/active states
  - Card (shadcn) for the sticky banner container and bookmark cards with subtle shadow
  - Badge (shadcn) for color palette chips with selection states and collection bookmark counts
  - Toast (sonner) for user feedback on errors or confirmations
  - Tooltip (shadcn) for color names on hover and button descriptions
  - ContextMenu (shadcn) for removing highlights and managing collections/bookmarks via right-click
  - Dialog (shadcn) for bookmark modal and collection rename dialogs
  - Sheet (shadcn) for Collections panel sliding in from right
  - Input (shadcn) for bookmark title, URL, and collection names
  - Textarea (shadcn) for bookmark descriptions
  - Select (shadcn) for choosing collection in bookmark modal
  - Accordion (shadcn) for expandable collections in Collections panel
  - ScrollArea (shadcn) for scrollable bookmark lists
  
- **Customizations**: 
  - Custom color palette grid component with click states
  - Custom highlight rendering system using CSS ::highlight pseudo-element
  - Custom text selection detection and range management
  - Custom draggable sticky note component with textarea and color picker
  - Custom drag-and-drop logic using native mouse events
  
- **States**: 
  - Highlight button: default, hover (lift + brightness), active (press down), disabled (when no text selected)
  - Add Note button: default, hover (lift + brightness), active (press down)
  - Color chips: default, hover (scale 1.1), selected (ring + scale 1.05), active (scale 0.95)
  - Banner: fixed position with subtle shadow, persistent across all interactions
  - Sticky notes: default, dragging (scale 1.05, cursor grabbing), hover (subtle shadow increase)
  - Note textarea: default, focus (outline ring), typing (cursor visible)
  - Note delete button: default, hover (destructive color), active (scale down)
  
- **Icon Selection**: 
  - Highlighter icon from Phosphor for the main highlight button
  - NotePencil icon from Phosphor for the add note button
  - BookmarkSimple icon from Phosphor for the bookmark button and bookmark items
  - FolderOpen icon from Phosphor for the Collections button and collection items
  - Trash/X icon from Phosphor for the context menu remove action and note deletion
  - Pencil icon from Phosphor for rename actions
  - Link icon from Phosphor for URL-related actions
  - Check icon for selection confirmation feedback
  
- **Spacing**: 
  - Banner padding: px-6 py-3
  - Color chip gaps: gap-2
  - Button internal spacing: px-4 py-2
  - Content margins to avoid banner overlap: mt-16
  - Note internal padding: p-3 for textarea, p-2 for header
  - Note dimensions: w-64 (width), h-48 (textarea height)
  
- **Mobile**: 
  - Banner remains sticky but compresses vertically (py-2)
  - Color palette wraps to 2 rows on narrow screens
  - Highlight button text shortens to icon-only below 640px
  - Add Note button text shortens to icon-only below 640px
  - Touch targets maintain 44px minimum for color selection
  - Sticky notes remain draggable with touch events on mobile devices
  - Notes scale slightly smaller on mobile viewports for better space utilization
