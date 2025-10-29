# Timezone Storage Implementation

## Date: October 30, 2025

---

## Overview
Implemented persistent timezone storage that maps detected timezones to customer account names and institution codes, with automatic storage updates by the Case Timezone Resolver.

---

## New Module: timezoneStorage.js

### Purpose
Centralized storage for detected customer timezones with persistent caching and intelligent lookup capabilities.

### Key Features

#### 1. **Dual-Key Storage**
- Stores timezones by both account name and institution code
- Allows lookups using either identifier
- Example: "University of Sydney" and "61USY_INST" both retrieve "Australia/Sydney"

#### 2. **Storage Structure**
```javascript
{
  "university of sydney": {
    accountName: "University of Sydney",
    timezone: "Australia/Sydney",
    institutionCode: "61USY_INST",
    lastUpdated: 1730000000000,
    timestamp: "2025-10-30T12:00:00.000Z"
  },
  "61usy_inst": {
    accountName: "University of Sydney",
    timezone: "Australia/Sydney",
    institutionCode: "61USY_INST",
    lastUpdated: 1730000000000,
    timestamp: "2025-10-30T12:00:00.000Z"
  }
}
```

#### 3. **Core Methods**

**saveTimezone(accountName, timezone, institutionCode)**
- Saves timezone with normalized keys
- Creates dual entries for both account name and institution code
- Records timestamp and last update time

**getTimezone(identifier)**
- Retrieves timezone data by account name or institution code
- Falls back to partial name matching
- Returns full timezone object with metadata

**getTimezoneString(identifier)**
- Convenience method returning just the timezone string
- Returns null if not found

**hasTimezone(identifier)**
- Checks if timezone exists for given identifier
- Returns boolean

**getTimezoneWithCustomerFallback(identifier)**
- Advanced lookup that checks storage first
- Falls back to CustomerDataManager to find matching customer
- Searches by institution code and name
- Returns timezone if found in customer list mapping

#### 4. **Management Features**

**getAllTimezones()**
- Returns all stored timezone data

**deleteTimezone(identifier)**
- Removes timezone entry by identifier

**clearAll()**
- Removes all stored timezones

**getStats()**
- Returns statistics about stored timezones
- Groups by timezone
- Shows unique timezones and total entries

**exportData() / importData()**
- Backup and restore functionality
- Exports with version and timestamp

---

## Integration with CaseTimezoneResolver

### Updated Functionality

#### 1. **Initialization Enhancement**
```javascript
async init(accountName = null) {
    // Initializes TimezoneStorage
    await TimezoneStorage.init();
    
    // Checks for cached timezone on init
    if (accountName) {
        const cachedTimezone = await TimezoneStorage.getTimezoneString(accountName);
        if (cachedTimezone) {
            // Immediately uses cached timezone
            this.resolvedTimezone = cachedTimezone;
            this.updateFlexipagePanel(cachedTimezone);
        }
    }
}
```

#### 2. **Automatic Storage on Resolution**
New `saveTimezoneToStorage()` method:
- Called automatically when timezone is resolved from address
- Finds matching customer in CustomerDataManager
- Extracts institution code if available
- Saves both account name and institution code mappings

#### 3. **Multi-Level Caching**
`resolveForAccount()` now checks three levels:
1. **TimezoneStorage** - Persistent cached timezones
2. **AccountAddressExtractor cache** - Session-based address cache
3. **User hover** - Prompts user to hover over account name

#### 4. **New Method: getCachedTimezone()**
- Public method to retrieve cached timezone
- Returns string or null
- Used by other modules for timezone lookups

---

## Workflow Integration

### When User Hovers Over Account Name:
1. AccountAddressExtractor extracts address from hover panel
2. Fires `exlibris:addressExtracted` event
3. CaseTimezoneResolver receives event
4. AddressTimezoneResolver resolves timezone from address
5. **NEW**: `saveTimezoneToStorage()` called automatically
   - Matches account name to customer in CustomerDataManager
   - Extracts institution code
   - Saves to TimezoneStorage with dual keys
6. Updates UI with resolved timezone

### When Initializing Case Page:
1. CaseTimezoneResolver.init(accountName) called
2. **NEW**: Checks TimezoneStorage for cached timezone
3. If found:
   - Immediately applies cached timezone
   - Updates FlexipagePanel
   - Notifies other modules
   - No hover required!
4. If not found:
   - Waits for user to hover over account name
   - Follows normal resolution workflow

### When Manually Resolving:
1. User triggers resolveForAccount(accountName)
2. **NEW**: Checks TimezoneStorage first (fastest)
3. Falls back to AddressTimezoneResolver cache
4. Falls back to prompting user to hover

---

## Benefits

### 1. **Performance**
- Eliminates repeated timezone lookups for same customer
- Instant timezone application on subsequent visits
- Reduces API calls to timezone services

### 2. **User Experience**
- No need to hover every time for known customers
- Faster case processing for repeat customers
- Persistent across browser sessions

### 3. **Data Intelligence**
- Builds knowledge base of customer timezones
- Links account names to institution codes
- Supports partial name matching

### 4. **Reliability**
- Multiple lookup strategies (name, code, partial match)
- Fallback to customer list integration
- Timestamp tracking for data freshness

---

## Storage Key
- **Key**: `detectedTimezones`
- **Location**: Chrome Local Storage
- **Persistence**: Permanent (until manually cleared)
- **Scope**: Per browser profile

---

## Customer List Integration

### Matching Strategy
When saving timezone:
1. Searches all customers in CustomerDataManager
2. Finds customer where:
   - Exact name match (case-insensitive)
   - Name contains account name
   - Account name contains customer name
3. Extracts institution code from matched customer
4. Saves with both account name and institution code

### Lookup Strategy
When retrieving timezone:
1. Direct lookup by normalized identifier
2. Partial match in account names
3. **Fallback**: Search CustomerDataManager
   - Find customer by institution code
   - Find customer by name match
   - Return timezone if found for customer name

---

## Example Usage

### Save Timezone
```javascript
// Automatically called by CaseTimezoneResolver
await TimezoneStorage.saveTimezone(
    "University of Sydney",
    "Australia/Sydney",
    "61USY_INST"
);
```

### Retrieve Timezone
```javascript
// By account name
const tz1 = await TimezoneStorage.getTimezoneString("University of Sydney");

// By institution code
const tz2 = await TimezoneStorage.getTimezoneString("61USY_INST");

// Both return: "Australia/Sydney"
```

### Check if Exists
```javascript
const exists = await TimezoneStorage.hasTimezone("University of Surrey");
// Returns: true/false
```

### Get Statistics
```javascript
const stats = await TimezoneStorage.getStats();
// Returns: {
//   totalEntries: 42,
//   uniqueTimezones: 15,
//   timezoneGroups: {
//     "Australia/Sydney": ["University of Sydney", "..."],
//     "Europe/London": ["University of Surrey", "..."]
//   },
//   lastUpdated: 1730000000000
// }
```

---

## Manifest Changes

### Added Module
```json
"modules/timezoneStorage.js"
```

**Load Order**: After `cacheManager.js`, before `caseDataExtractor.js`
- Ensures storage is available before timezone resolution
- Loaded early in the module chain

---

## Testing Checklist

- [ ] Hover over account name → Timezone saved to storage
- [ ] Reload page → Cached timezone immediately applied
- [ ] Navigate to different case for same customer → Uses cached timezone
- [ ] Clear storage → Falls back to hover detection
- [ ] Institution code lookup works
- [ ] Account name lookup works
- [ ] Partial name matching works
- [ ] Customer list fallback works
- [ ] Export/import functionality works
- [ ] Statistics display correctly

---

## Future Enhancements

### Potential Improvements
1. **Timezone Confidence Score**: Track how many times timezone was confirmed
2. **Auto-Expiry**: Remove timezones not used for X months
3. **Bulk Import**: Import timezone mappings from CSV
4. **Timezone Override**: Allow manual correction of detected timezones
5. **Multi-Location Support**: Handle customers with multiple office locations
6. **Conflict Resolution**: Handle cases where customer has multiple addresses/timezones

### Integration Opportunities
1. Export to Salesforce custom object for team sharing
2. Sync across team members via cloud storage
3. Pre-populate from institutional data sources
4. Integration with customer onboarding data

---

## Related Files
- `modules/timezoneStorage.js` - New timezone storage module
- `modules/caseTimezoneResolver.js` - Updated with storage integration
- `manifest.json` - Added timezoneStorage.js to load order
