# Automatic Timezone Detection from Account Address

## Overview

This feature automatically detects and updates the timezone when you hover over the Account Name link in a Salesforce case. It extracts the address from the hover panel (preview) and resolves the timezone using the `AddressTimezoneResolver` module.

## How It Works

### 1. **User Hovers Over Account Name**
When you hover your mouse over the Account Name link in a case, Salesforce displays a preview panel with account details including the address.

### 2. **Address Extraction**
The `AccountAddressExtractor` module:
- Observes the DOM for hover panels (`.forceHoverPanel`)
- Extracts the address field from the preview panel
- Parses address components: street, city, state, postal code, country

### 3. **Timezone Resolution**
The `CaseTimezoneResolver` module:
- Receives the extracted address
- Calls `AddressTimezoneResolver` to determine the timezone
- Updates the Flexipage panel with the resolved timezone
- Shows a success message with the detected timezone

### 4. **UI Updates**
- The "Your Timezone" field in the Flexipage panel is automatically updated
- A success message is displayed: *"Timezone auto-detected from [Account Name]: [Timezone]"*
- The timezone is cached for future use

## Architecture

```
┌─────────────────────────────────────┐
│   User hovers over Account Name    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Salesforce shows hover panel      │
│   with account details              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  AccountAddressExtractor            │
│  - Detects hover panel appeared     │
│  - Extracts address field           │
│  - Parses address components        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  CaseTimezoneResolver               │
│  - Receives extracted address       │
│  - Calls AddressTimezoneResolver    │
│  - Determines timezone              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  FlexipagePanelInjector             │
│  - Updates "Your Timezone" field    │
│  - Shows success message            │
└─────────────────────────────────────┘
```

## Module Responsibilities

### `accountAddressExtractor.js`
- **Purpose**: Extracts customer address from Salesforce hover panels
- **Key Methods**:
  - `observeHoverPanels()` - Watches for hover panels to appear
  - `extractAddressFromPanel()` - Parses address field from panel
  - `getCachedAddress()` - Returns cached address for account
- **Events**: Dispatches `exlibris:addressExtracted` event

### `caseTimezoneResolver.js`
- **Purpose**: Coordinates timezone resolution workflow
- **Key Methods**:
  - `init(accountName)` - Initialize with current case's account
  - `handleAddressExtracted()` - Process extracted addresses
  - `resolveAndUpdateTimezone()` - Resolve and update UI
  - `resolveForAccount()` - Manually trigger resolution
- **Events**: 
  - Listens for `exlibris:addressExtracted`
  - Dispatches `exlibris:timezoneResolved`

### `addressTimezoneResolver.js`
- **Purpose**: Maps addresses to IANA timezone identifiers
- **Key Methods**:
  - `resolveTimezone(address)` - Determines timezone from address
  - Uses state/country codes to map to timezone

## Usage

### Automatic Detection
1. Open a case in Salesforce
2. Hover your mouse over the **Account Name** link
3. Wait for the preview panel to appear
4. The timezone will be automatically detected and updated in the Flexipage panel

### Manual Trigger
You can also manually trigger timezone detection:

```javascript
// In browser console
CaseTimezoneResolver.resolveForAccount('University Name');
```

## Address Format Support

The module handles standard Salesforce address formats:

```
Street Address
Postal Code City
State
Country
```

Example:
```
110 21st Avenue South, Suite 700 Baker Bldg
37203-2408 Nashville
TN
United States
```

## Integration Points

### In `content_script_exlibris.js`

```javascript
// Initialize CaseTimezoneResolver for automatic timezone detection
if (typeof CaseTimezoneResolver !== 'undefined') {
  CaseTimezoneResolver.init(caseData.accountName);
  console.log('[ExLibris Extension] CaseTimezoneResolver initialized');
}
```

### In `manifest.json`

```json
"modules/addressTimezoneResolver.js",
"modules/accountAddressExtractor.js",
"modules/caseTimezoneResolver.js",
```

## Events

### Custom Events Dispatched

#### `exlibris:addressExtracted`
Fired when an address is extracted from a hover panel.

**Detail:**
```javascript
{
  accountName: "University Name",
  address: {
    street: "...",
    city: "...",
    state: "...",
    postalCode: "...",
    country: "..."
  },
  timestamp: "2025-10-28T..."
}
```

#### `exlibris:timezoneResolved`
Fired when a timezone is successfully resolved.

**Detail:**
```javascript
{
  timezone: "America/Chicago",
  accountName: "University Name",
  timestamp: "2025-10-28T..."
}
```

## Caching

Addresses are cached in memory for performance:
- Cache key: Account Name
- Cache value: Address object
- Cached addresses are reused without re-extraction

## Error Handling

- Gracefully handles missing hover panels
- Logs warnings if modules are not loaded
- Shows user-friendly error messages
- Falls back to manual timezone detection if automatic fails

## Benefits

1. **No Navigation Required** - No need to open the Account page
2. **Instant Detection** - Timezone updates as soon as you hover
3. **Non-Intrusive** - Works with existing Salesforce UI
4. **Cached** - Repeated hovers use cached data
5. **Accurate** - Uses official IANA timezone database

## Future Enhancements

Potential improvements:
1. Direct API call to Account record (requires SOQL query)
2. Geocoding API integration for more accurate timezone detection
3. Support for multiple account addresses
4. User preference to enable/disable auto-detection
5. Visual indicator when timezone is auto-detected vs manual

## Troubleshooting

### Timezone not detecting
- Ensure you hover long enough for the panel to fully load
- Check that the Address field exists in the hover panel
- Verify `AddressTimezoneResolver` module is loaded
- Check console for error messages

### Wrong timezone detected
- Verify the address data is correct in Salesforce
- Check if the state/country mapping is correct in `AddressTimezoneResolver`
- Update the timezone mapping if needed

### Panel not appearing
- Ensure Salesforce preview panels are enabled
- Check browser console for JavaScript errors
- Reload the page and try again

## Testing

To test the feature:

1. Open a case with a valid Account Name
2. Ensure the Account has a complete address
3. Hover over the Account Name link
4. Verify the timezone is detected and displayed
5. Check console logs for extraction/resolution messages

## Dependencies

- `addressTimezoneResolver.js` - Timezone mapping logic
- `flexipagePanelInjector.js` - UI updates
- Salesforce hover panels (`.forceHoverPanel`)
- MutationObserver API for DOM observation
