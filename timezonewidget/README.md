# Global Sync Widget - Chrome Extension MV3

A modular timezone conversion and meeting scheduling widget designed for Chrome Extension Manifest V3.

## Features

- **Time Converter**: View current time across multiple timezones
- **Meeting Scheduler**: Schedule meetings with visual hour grids showing business/awake/sleep hours
- **Status Indicators**: Visual indicators for business hours, awake hours, and sleep hours
- **Copy to Clipboard**: Copy meeting times in various formats
- **Favorite Timezones**: Save frequently used timezones

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `chrome-extension` folder
4. The extension icon should appear in your toolbar

## Usage

### Required Parameters

The widget requires the following configuration:

```javascript
{
  localTimezone: 'Asia/Kuala_Lumpur',     // Required: User's local timezone (IANA identifier)
  customerTimezone: 'America/New_York',    // Required: Customer/target timezone (IANA identifier)
  favoriteTimezones: [                     // Optional: Array of additional timezone identifiers
    'Europe/London',
    'Asia/Tokyo',
    'Australia/Sydney'
  ]
}
```

### Programmatic Usage

You can integrate the widget module directly into other Chrome extensions:

```javascript
// Check if modules are loaded
if (typeof TimezoneUtils !== 'undefined' && typeof GlobalSyncWidget !== 'undefined') {
  // Initialize the widget
  GlobalSyncWidget.init(document.getElementById('my-container'), {
    localTimezone: 'Asia/Kuala_Lumpur',
    customerTimezone: 'America/New_York',
    favoriteTimezones: ['Europe/London', 'Asia/Tokyo']
  });
}

// Update configuration
GlobalSyncWidget.updateConfig({
  customerTimezone: 'Europe/Berlin'
});

// Get/set meeting times
const { start, end } = GlobalSyncWidget.getMeetingTimes();
GlobalSyncWidget.setMeetingTimes(new Date(), new Date(Date.now() + 3600000));

// Cleanup
GlobalSyncWidget.destroy();
```

### Using TimezoneUtils Directly

```javascript
// Get browser timezone
const localTz = TimezoneUtils.getBrowserTimezone();

// Format time in timezone
const formatted = TimezoneUtils.formatInTimeZone(new Date(), 'America/New_York', 'h:mm a');

// Get timezone info
const abbr = TimezoneUtils.getTimezoneAbbreviation(new Date(), 'America/New_York'); // "EST"
const offset = TimezoneUtils.getTimezoneOffset(new Date(), 'America/New_York'); // "UTC-05:00"

// Convert time
const result = TimezoneUtils.convertTime(new Date(), 'Asia/Tokyo');
// { timezone, date, formatted, hour, status }

// Get time status
const status = TimezoneUtils.getTimeStatus(14); // "business"

// Calculate overlap
const overlapStatus = TimezoneUtils.calculateOverlapStatus(new Date(), [
  { timezone: 'America/New_York' },
  { timezone: 'Asia/Tokyo' }
]);
```

## File Structure

```
chrome-extension/
├── manifest.json           # Extension manifest (MV3)
├── background.js           # Service worker (ephemeral, no persistent state)
├── content_script.js       # Content script for page injection
├── popup.html              # Extension popup UI
├── popup.js                # Popup script
├── modules/
│   ├── timezoneUtils.js    # Timezone conversion utilities
│   └── globalSyncWidget.js # Main widget module
├── icons/                  # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md               # This file
```

## Module Architecture

### TimezoneUtils

Core timezone conversion utilities using native `Intl` APIs (no external dependencies):

- `getAllTimezones()` - Get all IANA timezone identifiers
- `getBrowserTimezone()` - Get browser's timezone
- `getTimezoneAbbreviation(date, timezone)` - Get timezone abbreviation (EST, PST, etc.)
- `getTimezoneOffset(date, timezone)` - Get UTC offset string
- `formatInTimeZone(date, timezone, format)` - Format date in timezone
- `convertTime(date, timezone, config)` - Convert time with status
- `getTimeStatus(hour, ...)` - Get business/awake/sleep status
- `calculateOverlapStatus(date, zones)` - Calculate overlap for multiple zones

### GlobalSyncWidget

Main widget component:

- `init(container, config)` - Initialize widget
- `updateConfig(config)` - Update configuration
- `setSimulationTime(date)` - Set simulation time (for testing)
- `getMeetingTimes()` - Get current meeting times
- `setMeetingTimes(start, end)` - Set meeting times
- `destroy()` - Cleanup widget
- `getState()` - Get current state (debugging)

## Chrome Extension MV3 Compliance

This extension follows Manifest V3 best practices:

1. **Service Worker**: Background script is a service worker (ephemeral, no persistent state)
2. **Storage API**: Uses `chrome.storage.local` for persistent data
3. **No Remote Code**: All code is bundled locally
4. **Content Security**: No inline scripts or eval()
5. **Message Passing**: Proper async message handling with `return true`

## Development

### Adding Icons

Create PNG icons at these sizes and place in the `icons/` folder:
- `icon16.png` (16x16)
- `icon32.png` (32x32)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

### Testing

1. Load the extension in Chrome
2. Click the extension icon to open the popup
3. Use Settings to configure timezones
4. Visit any webpage and click the floating button to show the widget

## License

MIT License
