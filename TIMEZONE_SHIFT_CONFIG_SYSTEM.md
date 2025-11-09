# Timezone & Shift Configuration System

## Overview

The extension now supports a comprehensive, user-configurable timezone and shift configuration system. This allows teams to customize shift times, timezone handling, IRT expectations, and date formatting according to their specific needs.

## Default Configuration

### First-Run Defaults
When the extension loads for the first time (no cached preferences), the following defaults are used:

- **Shift Timing**: 9 PM - 6 AM MYT (Malaysia Time, UTC+8)
- **Shift Type**: Overnight shift (crosses midnight)
- **Team**: EndNote
- **IRT Expectations**: Team defaults (90 minutes for EndNote)
- **User Timezone**: Auto-detected from browser
- **Salesforce UI Timezone**: Auto-detected from Salesforce
- **Date Format**: Auto (based on user locale)
- **Time Format**: 24-hour

### Configuration Warning Banner

On first run, a prominent warning banner appears at the top of the page with:
- ⚠️ Warning icon and red gradient background
- List of current default values being used
- **Configure Now** button - Opens extension popup to preferences tab
- **Use Defaults** button - Dismisses banner and continues with defaults

## User Configuration

### Accessing Preferences

1. Click the extension icon in browser toolbar
2. Navigate to the **Preferences** tab
3. Configure your settings
4. Click **Save Preferences**
5. Refresh Salesforce page for changes to take effect

### Configuration Options

#### 1. Shift Configuration

**Shift Timezone**
- Default: Malaysia (MYT - UTC+8)
- Options: Malaysia, Singapore, Philippines, India, London, US timezones
- Purpose: Timezone in which shift hours are defined

**Shift Start Time**
- Default: 21:00 (9 PM)
- Format: HH:MM (24-hour)
- Purpose: When your working shift begins

**Shift End Time**
- Default: 06:00 (6 AM)
- Format: HH:MM (24-hour)
- Purpose: When your working shift ends

**Overnight Shift**
- Default: Checked
- Purpose: Indicates if shift crosses midnight (e.g., 9 PM - 6 AM)

#### 2. Timezone Settings

**Your Local Timezone**
- Default: Auto-detect from browser
- Purpose: Used when you manually specify times
- Options: Auto-detect or select manually

**Salesforce UI Timezone**
- Default: Auto-detect from Salesforce
- Purpose: Timezone displayed in Salesforce UI
- Options: Auto-detect or select manually

#### 3. IRT Expectations

**Use Team Defaults**
- Default: Checked
- Purpose: Use IRT values from team configuration
- Team-specific values:
  - EndNote: 90 minutes
  - WebOfScience: 90 minutes
  - ScholarOne: 90 minutes
  - Esploro: 60 minutes

**Custom IRT**
- Enabled when "Use Team Defaults" is unchecked
- Purpose: Override team defaults with custom IRT expectation
- Format: Positive integer (minutes)

#### 4. Date & Time Format

**Date Format**
- Default: Auto (based on locale)
- Options:
  - Auto
  - MM/DD/YYYY (US)
  - DD/MM/YYYY (UK/EU)
  - YYYY-MM-DD (ISO)

**Time Format**
- Default: 24-hour
- Options:
  - 24-hour (23:00)
  - 12-hour (11:00 PM)

## Technical Implementation

### Module Structure

#### 1. UserPreferences Module (`modules/userPreferences.js`)

**Purpose**: Manages storage and retrieval of user configuration preferences

**Key Functions**:
- `load()` - Loads preferences from storage
- `save(preferences)` - Saves preferences to storage
- `get()` - Gets cached preferences
- `completeSetup()` - Marks setup as complete (dismisses warning)
- `shouldShowWarning()` - Checks if warning banner should display
- `getEffectiveShiftTimezone(prefs)` - Gets active shift timezone
- `getEffectiveUserTimezone(prefs)` - Gets active user timezone
- `getShiftBoundaries(prefs, date)` - Calculates shift start/end times

**Storage Location**: `chrome.storage.local` under key `userPreferences`

#### 2. TimezoneUtils Module (`modules/timezoneUtils.js`)

**Purpose**: Replaces hardcoded MYT timezone functions with configurable timezone handling

**Key Functions**:
- `init(preferences)` - Initializes with user preferences
- `convertToShiftTimezone(date, timezone)` - Converts date to shift timezone
- `createShiftTimezoneDate(year, month, day, hours, minutes, seconds)` - Creates date in shift timezone
- `calculateWorkingMinutes(startDate, endDate, customWorkingHours)` - Calculates working minutes based on configured shift
- `calculateWorkingTimeDifferenceInMinutes(date, teamConfig)` - Working time from date to now
- `formatDate(date, includeTime)` - Formats date according to user preferences
- `isWithinShiftHours(date)` - Checks if date falls within configured shift
- `getShiftBoundaries(referenceDate)` - Gets shift start/end for a date

**Replaces Legacy Functions**:
- `convertToMYT(date)` → `convertToShiftTimezone(date)`
- `createMYTDate(...)` → `createShiftTimezoneDate(...)`
- `calculateWorkingMinutes(startDate, endDate, { start: 14, end: 23 })` → `calculateWorkingMinutes(startDate, endDate)`

#### 3. ConfigurationWarningBanner Module (`modules/configurationWarningBanner.js`)

**Purpose**: Displays first-run warning when using default values

**Key Functions**:
- `show(preferences)` - Displays warning banner
- `hide(animate)` - Hides and removes banner
- `checkAndShow()` - Checks if should show and displays if needed
- `forceShow()` - Forces banner display (for testing)

**Visual Design**:
- Red gradient background (#ff6b6b to #ee5a6f)
- Fixed position at top of page (z-index: 999999)
- Warning icon (⚠️)
- List of current defaults
- Two action buttons (Configure Now, Use Defaults)
- Slide-down animation

### Integration Points

#### Content Script Initialization

```javascript
// In content_script_exlibris.js init()

// Initialize UserPreferences
if (typeof UserPreferences !== 'undefined') {
  const userPrefs = await UserPreferences.load();
  
  // Initialize TimezoneUtils with user preferences
  if (typeof TimezoneUtils !== 'undefined') {
    await TimezoneUtils.init(userPrefs);
  }
  
  // Check if configuration warning banner should be shown
  if (typeof ConfigurationWarningBanner !== 'undefined') {
    const shouldShowWarning = await UserPreferences.shouldShowWarning();
    if (shouldShowWarning) {
      setTimeout(async () => {
        await ConfigurationWarningBanner.checkAndShow();
      }, 2000);
    }
  }
}
```

#### Popup UI

Located in `popup.html` and `popup.js`:

**HTML Elements**:
- Preferences tab added to tab navigation
- Shift configuration inputs (timezone, start time, end time, overnight checkbox)
- User timezone select
- Salesforce timezone select
- IRT configuration (team defaults checkbox, custom IRT input)
- Date/time format selects
- Save and Reset buttons

**JavaScript Handlers**:
- `populateUI(settings)` - Populates preferences tab from storage
- `getSettingsFromUI()` - Extracts preferences from UI inputs
- `savePreferencesButton` click handler - Saves preferences
- `resetPreferencesButton` click handler - Resets to defaults

### Migration from Hardcoded Values

#### Before (Hardcoded MYT)

```javascript
// Hardcoded UTC+8 offset
function convertToMYT(date) {
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const mytOffset = 8;
  const mytTime = new Date(utcTime + (mytOffset * 3600000));
  return mytTime;
}

// Hardcoded 2PM-11PM shift
function calculateWorkingMinutes(startDate, endDate, workingHours = { start: 14, end: 23 }) {
  // ... calculation with hardcoded hours
}
```

#### After (Configurable)

```javascript
// Initialize once with user preferences
await TimezoneUtils.init(userPreferences);

// Convert to configured shift timezone
const shiftTime = TimezoneUtils.convertToShiftTimezone(date);

// Calculate working minutes with configured shift hours (9PM-6AM by default)
const workingMinutes = TimezoneUtils.calculateWorkingMinutes(startDate, endDate);
```

## Usage Examples

### Example 1: Using Custom Shift Hours

**Scenario**: US East Coast team with 8 AM - 5 PM shift

1. Open Preferences tab
2. Set Shift Timezone: "Eastern Time (ET)"
3. Set Shift Start Time: 08:00
4. Set Shift End Time: 17:00
5. Uncheck "Overnight Shift"
6. Save preferences

Result: Working hours calculations now use 8 AM - 5 PM ET

### Example 2: Using Custom IRT

**Scenario**: Team needs 60-minute IRT instead of default 90

1. Open Preferences tab
2. Uncheck "Use team default IRT values"
3. Enter "60" in Custom IRT field
4. Save preferences

Result: Case highlighting uses 60-minute IRT threshold

### Example 3: Different Date Format

**Scenario**: European user prefers DD/MM/YYYY

1. Open Preferences tab
2. Set Date Format: "DD/MM/YYYY (UK/EU)"
3. Set Time Format: "24-hour (23:00)"
4. Save preferences

Result: Dates displayed as 25/12/2024 instead of 12/25/2024

## Data Structure

### Storage Schema

```javascript
{
  userPreferences: {
    version: "1.0.0",
    
    shift: {
      timezone: "Asia/Kuala_Lumpur",  // IANA timezone identifier
      startHour: 21,                   // 0-23
      startMinute: 0,                  // 0-59
      endHour: 6,                      // 0-23
      endMinute: 0,                    // 0-59
      isOvernightShift: true           // boolean
    },
    
    userTimezone: {
      auto: true,                      // boolean
      manual: null,                    // IANA timezone or null
      detected: "Asia/Kuala_Lumpur"    // Last detected timezone
    },
    
    salesforceTimezone: {
      auto: true,                      // boolean
      manual: null,                    // IANA timezone or null
      detected: null                   // Last detected SF timezone
    },
    
    irt: {
      useTeamDefaults: true,           // boolean
      customMinutes: null,             // number or null
      team: "EndNote"                  // Team name
    },
    
    formatting: {
      dateFormat: "auto",              // 'auto', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'
      timeFormat: "24h",               // '12h' or '24h'
      locale: "en-US"                  // Locale identifier
    },
    
    meta: {
      isFirstRun: false,               // boolean
      setupCompleted: true,            // boolean
      lastUpdated: "2024-01-15T10:30:00Z",  // ISO timestamp
      warningDismissed: true           // boolean
    }
  }
}
```

## Testing

### Test Scenario 1: First Run Experience

1. Clear extension storage: `chrome.storage.local.clear()`
2. Reload Salesforce page
3. **Expected**: Red warning banner appears at top
4. **Expected**: Banner shows "9 PM - 6 AM MYT" as default shift
5. Click "Configure Now"
6. **Expected**: Extension popup opens to Preferences tab
7. Change shift to 8 AM - 5 PM ET
8. Save preferences
9. Reload page
10. **Expected**: No warning banner (setup completed)

### Test Scenario 2: Overnight Shift Calculation

1. Configure shift: 9 PM - 6 AM MYT (overnight)
2. Test case opened at 10 PM MYT
3. Current time: 2 AM MYT (next day)
4. **Expected**: 4 hours of working time calculated

### Test Scenario 3: Timezone Conversion

1. Set User Timezone: "America/New_York"
2. Set Shift Timezone: "Asia/Kuala_Lumpur"
3. Enter time manually: "3:00 PM" (interpreted as Eastern Time)
4. **Expected**: Correctly converted to MYT for shift calculations

## Troubleshooting

### Warning Banner Doesn't Appear

**Check**:
1. Is `UserPreferences` module loaded in manifest.json?
2. Is `ConfigurationWarningBanner` module loaded?
3. Check browser console for initialization errors
4. Verify storage permissions in manifest.json

**Debug**:
```javascript
// In browser console
await UserPreferences.shouldShowWarning()  // Should return true on first run
await ConfigurationWarningBanner.forceShow()  // Force show banner
```

### Timezone Calculations Incorrect

**Check**:
1. Verify shift hours are configured correctly
2. Check if "Overnight Shift" checkbox matches actual shift
3. Verify shift timezone matches team location

**Debug**:
```javascript
// In browser console
const prefs = await UserPreferences.get()
console.log('Shift config:', prefs.shift)
TimezoneUtils.getShiftBoundaries()  // Shows current shift start/end
```

### Preferences Not Saving

**Check**:
1. Browser has sufficient storage quota
2. No errors in browser console when saving
3. Extension has `storage` permission in manifest.json

**Debug**:
```javascript
// Check storage
chrome.storage.local.get('userPreferences', result => console.log(result))

// Check sync storage
chrome.storage.sync.get(null, result => console.log(result))
```

## Future Enhancements

### Planned Features

1. **Multiple Shift Profiles**
   - Save multiple shift configurations
   - Quick switch between profiles
   - Example: Weekend shift vs weekday shift

2. **Team-Specific Defaults**
   - Different defaults per team
   - Automatic shift detection based on team selection

3. **Timezone Auto-Detection Improvements**
   - Detect SF timezone from case metadata
   - Historical timezone tracking

4. **Advanced IRT Configuration**
   - Priority-based IRT (High = 60 min, Normal = 90 min)
   - Customer-specific IRT expectations

5. **Holiday/Non-Working Day Support**
   - Exclude specific dates from working hours
   - Regional holiday calendars

6. **Export/Import Preferences**
   - Export configuration as JSON
   - Share configurations across team

## API Reference

### UserPreferences

```javascript
// Load preferences
const prefs = await UserPreferences.load();

// Save preferences
await UserPreferences.save(prefs);

// Get cached preferences
const cached = await UserPreferences.get();

// Complete setup (dismiss warning)
await UserPreferences.completeSetup();

// Check if warning should show
const shouldShow = await UserPreferences.shouldShowWarning();

// Get effective timezones
const shiftTz = UserPreferences.getEffectiveShiftTimezone(prefs);
const userTz = UserPreferences.getEffectiveUserTimezone(prefs);
```

### TimezoneUtils

```javascript
// Initialize
await TimezoneUtils.init(preferences);

// Convert date to shift timezone
const converted = TimezoneUtils.convertToShiftTimezone(new Date());

// Calculate working minutes
const minutes = TimezoneUtils.calculateWorkingMinutes(startDate, endDate);

// Format date
const formatted = TimezoneUtils.formatDate(new Date(), true);

// Check if within shift
const isShift = TimezoneUtils.isWithinShiftHours(new Date());

// Get shift boundaries
const { start, end } = TimezoneUtils.getShiftBoundaries();
```

### ConfigurationWarningBanner

```javascript
// Show banner
await ConfigurationWarningBanner.show(preferences);

// Hide banner
ConfigurationWarningBanner.hide();

// Check and show if needed
await ConfigurationWarningBanner.checkAndShow();

// Force show (testing)
await ConfigurationWarningBanner.forceShow();
```

---

**Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**Compatibility**: Chrome Extension Manifest V3
