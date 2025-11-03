# Timezone Storage System - Implementation Guide

## Overview

The timezone storage system automatically detects, stores, and manages customer timezone data to improve extension performance and user experience. The system links timezone information to customers in the customer list and handles unknown customers gracefully.

## Architecture

### Core Modules

1. **TimezoneStorage** (`modules/timezoneStorage.js`)
   - Central storage manager for timezone data
   - Links timezones to customer list entries
   - Manages unknown customers requiring review

2. **CaseTimezoneResolver** (`modules/caseTimezoneResolver.js`) - Updated
   - Detects timezones from case addresses
   - Stores detected timezones automatically
   - Loads stored timezones for faster performance

3. **UnknownCustomerManager** (`modules/unknownCustomerManager.js`) - New
   - Detects customers not in the customer list
   - Prompts user to add unknown customers
   - Automates data collection workflow

## Data Flow

```
Case Page Load
    ↓
CaseTimezoneResolver.init() → Load timezone from storage
    ↓
    ├─→ Timezone found? → Use stored timezone ✓
    ↓
    └─→ No timezone? → User hovers over Account Name
            ↓
        Address extracted → Timezone resolved
            ↓
        TimezoneStorage.storeTimezone()
            ↓
            ├─→ Customer in list? → Store with customer data ✓
            ↓
            └─→ Customer not in list? → Add to unknown customers
                    ↓
                UnknownCustomerManager notified
                    ↓
                Prompt user to add customer
                    ↓
                User confirms? → Collect case data → Save customer
```

## Storage Structure

### Timezone Data
```javascript
{
  "INSTITUTION_CODE": {
    timezone: "America/New_York",
    source: "case_address",
    timestamp: 1698765432000,
    lastUpdated: 1698765432000,
    accountName: "Example University",
    accountCode: "EXMPL",
    institutionCode: "EXMPL_INST",
    customerName: "Example University",
    server: "na05",
    custID: "12345",
    instID: "67890",
    inCustomerList: true
  },
  "UNKNOWN_CUSTOMER": {
    timezone: "Europe/London",
    source: "case_address",
    // ... same structure ...
    inCustomerList: false
  }
}
```

### Unknown Customers
```javascript
[
  {
    id: "unknown_1698765432000",
    accountName: "New Customer",
    accountCode: "NEWCUST",
    institutionCode: null,
    timezone: "Asia/Tokyo",
    source: "case_address",
    detectedAt: 1698765432000,
    needsReview: true
  }
]
```

## Customer Matching Logic

### Lookup Priority

1. **Institution Code** (most reliable)
   - Exact match (case-insensitive)
   
2. **Account Code**
   - Matches against `institutionCode` in customer list
   
3. **Account Name**
   - Partial match (case-insensitive)
   - Handles variations in naming

### Example Matching

```javascript
// Customer List Entry
{
  name: "Southern Cross University",
  institutionCode: "61SCU_INST"
}

// Successful Matches
accountName: "Southern Cross University" ✓
accountName: "southern cross" ✓
accountCode: "61SCU_INST" ✓
institutionCode: "61SCU_INST" ✓
```

## Usage Examples

### Initialize CaseTimezoneResolver with Identifiers

```javascript
// In content_script_exlibris.js or case initialization
CaseTimezoneResolver.init({
  accountName: "Example University",
  accountCode: "EXMPL",
  institutionCode: "EXMPL_INST"
});

// Or update identifiers later
CaseTimezoneResolver.setCurrentIdentifiers({
  accountName: caseData.accountName,
  accountCode: caseData.accountCode,
  institutionCode: caseData.institutionCode
});
```

### Manual Timezone Storage

```javascript
// Store timezone for a known customer
await TimezoneStorage.storeTimezone({
  timezone: "America/New_York",
  accountName: "Example University",
  institutionCode: "EXMPL_INST",
  source: "manual"
});

// Result
{
  success: true,
  inCustomerList: true,
  customer: { /* customer data */ },
  timezone: "America/New_York"
}
```

### Retrieve Stored Timezone

```javascript
// Get timezone by any identifier
const stored = await TimezoneStorage.getTimezone({
  accountName: "Example University"
  // or accountCode, or institutionCode
});

console.log(stored.timezone); // "America/New_York"
console.log(stored.inCustomerList); // true
```

### Check Unknown Customers

```javascript
// Check if there are customers pending review
const check = await TimezoneStorage.checkUnknownCustomers();

console.log(check.count); // 3
console.log(check.hasUnknown); // true
console.log(check.customers); // Array of unknown customers
```

## Unknown Customer Workflow

### 1. Detection

When a timezone is detected for a customer NOT in the customer list:

```javascript
// Automatically triggered by CaseTimezoneResolver
const result = await TimezoneStorage.storeTimezone({
  timezone: "Asia/Tokyo",
  accountName: "New Customer Corp",
  accountCode: "NEWCUST",
  source: "case_address"
});

// result.needsReview === true
// Event dispatched: 'exlibris:unknownCustomerDetected'
```

### 2. User Prompt

UnknownCustomerManager displays a message:

```
Unknown customer detected: New Customer Corp
Would you like to add this customer to the list?

[Review Unknown Customer] button appears
```

### 3. Data Collection

User clicks button → Confirmation dialog:

```
Add "New Customer Corp" to customer list?

This will:
1. Scroll down to extract full case data
2. Collect account information
3. Generate institution code and URLs
4. Add customer to your list

Continue? [Yes] [No]
```

### 4. Automated Extraction

```javascript
// Similar to "Prepare Tools" workflow
Step 1/4: Scrolling to load case data...
Step 2/4: Extracting case data...
Step 3/4: Scrolling back to view...
Step 4/4: Processing customer data...
```

### 5. Review and Confirm

```
Add this customer to your list?

Name: New Customer Corp
Institution Code: NC_INST (generated)
Timezone: Asia/Tokyo
Server: unknown
Customer ID: unknown
Institution ID: unknown

Note: Customer/Institution IDs may need to be updated manually if unknown.

Proceed? [Yes] [No]
```

### 6. Save

```
Customer "New Customer Corp" added successfully!
Institution Code: NC_INST
```

## Institution Code Generation

For unknown customers, institution codes are auto-generated:

```javascript
// Multi-word names → First letters
"Southern Cross University" → "SCU_INST"
"New York Institute" → "NYI_INST"

// Single word → First 3-5 letters
"Harvard" → "HARVA_INST"
"MIT" → "MIT_INST"
```

## Integration Points

### Content Script (content_script_exlibris.js)

```javascript
// Initialize modules
TimezoneStorage; // Auto-loads
UnknownCustomerManager.init();

// Initialize CaseTimezoneResolver with case data
const caseData = CaseDataExtractor.extractFromPage();
CaseTimezoneResolver.init({
  accountName: caseData.accountName,
  accountCode: caseData.accountCode,
  institutionCode: caseData.institutionCode
});
```

### FlexipagePanelInjector Updates

Listen for unknown customer events:

```javascript
document.addEventListener('exlibris:pendingCustomerReviews', (event) => {
  const count = event.detail.count;
  // Show badge/indicator with count
  this.showPendingReviewsIndicator(count);
});
```

### CaseDetailExtractor

Ensure it extracts:
- `accountName`
- `accountCode` (if available)
- `institutionCode` (if available)
- Server, custID, instID (if extractable)

## API Reference

### TimezoneStorage

#### `storeTimezone(params)`
Store timezone for a customer.

**Parameters:**
```javascript
{
  timezone: string,          // Required
  accountName: string,       // Optional
  accountCode: string,       // Optional
  institutionCode: string,   // Optional
  source: string            // Optional (default: 'unknown')
}
```

**Returns:**
```javascript
{
  success: boolean,
  inCustomerList: boolean,
  needsReview: boolean,     // true if unknown customer
  customer: Object,          // if in customer list
  timezone: string,
  lookupKey: string         // if unknown customer
}
```

#### `getTimezone(identifiers)`
Retrieve stored timezone.

**Parameters:**
```javascript
{
  accountName: string,      // Optional
  accountCode: string,      // Optional
  institutionCode: string   // Optional
}
```

**Returns:**
```javascript
{
  timezone: string,
  source: string,
  timestamp: number,
  inCustomerList: boolean,
  // ... additional fields ...
}
// or null if not found
```

#### `checkUnknownCustomers()`
Check for unknown customers pending review.

**Returns:**
```javascript
{
  count: number,
  customers: Array,
  hasUnknown: boolean
}
```

#### `getStats()`
Get storage statistics.

**Returns:**
```javascript
{
  totalTimezoneRecords: number,
  knownCustomers: number,
  unknownCustomers: number,
  needsReview: boolean
}
```

### CaseTimezoneResolver

#### `init(params)`
Initialize with customer identifiers.

**Parameters:**
```javascript
{
  accountName: string,      // Optional
  accountCode: string,      // Optional
  institutionCode: string   // Optional
}
```

#### `setCurrentIdentifiers(identifiers)`
Update current case identifiers.

**Parameters:** Same as `init()`

### UnknownCustomerManager

#### `init()`
Initialize the unknown customer manager.

#### `checkPendingReviews()`
Check for pending customer reviews.

#### `getPendingReviews()`
Get array of pending customer reviews.

**Returns:** `Array<Object>`

## Events

### Dispatched Events

#### `exlibris:unknownCustomerDetected`
Fired when an unknown customer is detected.

```javascript
document.addEventListener('exlibris:unknownCustomerDetected', (event) => {
  console.log(event.detail);
  // {
  //   timezone: string,
  //   lookupKey: string,
  //   accountName: string,
  //   accountCode: string,
  //   institutionCode: string,
  //   timestamp: string (ISO)
  // }
});
```

#### `exlibris:pendingCustomerReviews`
Fired when pending reviews count changes.

```javascript
document.addEventListener('exlibris:pendingCustomerReviews', (event) => {
  console.log(event.detail.count); // number
  console.log(event.detail.customers); // Array
});
```

## Testing Scenarios

### Scenario 1: Known Customer

1. Navigate to case with known customer
2. Timezone loads from storage immediately
3. Status message: "Timezone loaded from known customer: America/New_York"

### Scenario 2: Unknown Customer

1. Navigate to case with unknown customer
2. No stored timezone → user hovers over Account Name
3. Timezone detected from address
4. Prompt appears: "Unknown customer detected..."
5. User clicks "Review Unknown Customer"
6. Data collection workflow executes
7. User confirms → Customer added
8. Future cases with this customer load timezone from storage

### Scenario 3: Update Existing Timezone

1. Timezone already stored
2. User hovers over Account Name again
3. New timezone detected (e.g., customer moved)
4. Timezone updated in storage
5. Existing keys updated automatically

## Performance Benefits

- **First Load:** Hover required (1-2 seconds)
- **Subsequent Loads:** Instant (<100ms)
- **Reduced Network:** No repeated address lookups
- **Better UX:** Immediate timezone availability

## Maintenance

### View Storage Data

```javascript
// In browser console
const data = await TimezoneStorage.getAllTimezoneData();
console.table(Object.values(data));
```

### View Statistics

```javascript
const stats = await TimezoneStorage.getStats();
console.log(stats);
// {
//   totalTimezoneRecords: 145,
//   knownCustomers: 142,
//   unknownCustomers: 3,
//   needsReview: true
// }
```

### Clear All Data (Debug Only)

```javascript
await TimezoneStorage.clearAllData();
console.log('All timezone data cleared');
```

## Future Enhancements

1. **Bulk Import**: Import timezone data from CSV
2. **Auto-Sync**: Sync with customer list updates
3. **Confidence Score**: Track timezone detection accuracy
4. **Manual Override**: Allow users to manually set/correct timezones
5. **Export**: Export timezone data for backup
6. **Analytics**: Track timezone detection success rates

## Troubleshooting

### Issue: Timezone not loading

**Check:**
1. Is `TimezoneStorage` module loaded?
2. Are identifiers set correctly?
3. Check console for errors

**Solution:**
```javascript
// Manually check storage
const stored = await TimezoneStorage.getTimezone({
  accountName: "Your Customer Name"
});
console.log(stored);
```

### Issue: Unknown customer not prompting

**Check:**
1. Is `UnknownCustomerManager.init()` called?
2. Is `FlexipagePanelInjector` available?

**Solution:**
```javascript
// Manually check unknown customers
const check = await TimezoneStorage.checkUnknownCustomers();
console.log(check);
```

### Issue: Generated institution code conflicts

**Solution:**
Manually edit the institution code before confirming customer addition. In the future, implement collision detection.

## Module Load Order

Ensure modules are loaded in this order in `manifest.json`:

```json
"modules/customerDataManager.js",
"modules/timezoneStorage.js",
"modules/caseTimezoneResolver.js",
"modules/unknownCustomerManager.js",
"modules/caseDetailExtractor.js",
"modules/flexipagePanelInjector.js"
```

## Conclusion

The timezone storage system provides:
- ✓ Automatic timezone detection and storage
- ✓ Seamless integration with customer list
- ✓ Graceful handling of unknown customers
- ✓ User-guided data collection workflow
- ✓ Performance optimization through caching
- ✓ Minimal user intervention required

The system significantly improves extension usability by reducing repetitive timezone detection and enabling faster case processing.
