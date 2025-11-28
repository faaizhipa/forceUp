# Implementation Guide

**Last Updated:** 2025-01-23  
**Purpose:** Detailed implementation guidance for each feature, module integration patterns, configuration options, and future enhancement roadmap

---

## Table of Contents

1. [Module Integration Patterns](#module-integration-patterns)
2. [Feature Implementation Details](#feature-implementation-details)
3. [Configuration Options](#configuration-options)
4. [Future Enhancements](#future-enhancements)
5. [Migration Guides](#migration-guides)

---

## Module Integration Patterns

### Initialization Pattern

All modules follow a consistent initialization pattern:

```javascript
const MyModule = {
  isInitialized: false,
  
  async init() {
    if (this.isInitialized) {
      console.log('[MyModule] Already initialized');
      return;
    }
    
    // Initialization logic
    await this.setup();
    
    this.isInitialized = true;
    console.log('[MyModule] Initialized');
  },
  
  cleanup() {
    // Cleanup logic (observers, timers, listeners)
    this.isInitialized = false;
  }
};
```

### Dependency Checking Pattern

Modules check for optional dependencies before use:

```javascript
if (typeof DependencyModule !== 'undefined') {
  await DependencyModule.init();
} else {
  console.warn('[MyModule] DependencyModule not available');
}
```

### Event-Based Communication Pattern

Modules communicate via custom events:

```javascript
// Module A dispatches event
document.dispatchEvent(new CustomEvent('dataExtracted', {
  detail: { caseId, data },
  bubbles: true,
  composed: true
}));

// Module B listens
document.addEventListener('dataExtracted', (event) => {
  const { caseId, data } = event.detail;
  // Process data
});
```

### Page Type Detection Pattern

Features initialize based on page type:

```javascript
// In content_script_exlibris.js
if (pageInfo.type === PageIdentifier.pageTypes.CASE_PAGE) {
  await this.initializeCasePageFeatures();
} else if (pageInfo.type === PageIdentifier.pageTypes.CASE_COMMENTS) {
  await this.initializeCaseCommentsFeatures();
}
```

---

## Feature Implementation Details

### 1. Field Highlighting

**Module:** `modules/fieldHighlighter.js`

#### Implementation Steps

1. **Module Initialization:**
   ```javascript
   await FieldHighlighter.init();
   ```

2. **Field Detection:**
   - Uses `records-record-layout-item[field-label="FieldName"]` selectors
   - Checks for input elements within layout items
   - Handles both regular DOM and Shadow DOM

3. **Highlighting Logic:**
   ```javascript
   // Check if field is empty
   const isEmpty = !input.value || input.value.trim() === '';
   
   // Apply color based on state
   if (isEmpty) {
     container.style.backgroundColor = 'rgb(191, 39, 75)'; // Red
   } else {
     container.style.backgroundColor = 'rgb(255, 255, 153)'; // Yellow
   }
   ```

4. **Debouncing:**
   - Uses `DebounceUtils.debounce()` for MutationObserver callbacks
   - Prevents excessive DOM queries during rapid changes

5. **Cleanup:**
   - Disconnects MutationObserver on navigation
   - Removes applied styles
   - Clears cached elements

#### Configuration

- **Enable/Disable:** `SettingsManager.get().exlibris.features.fieldHighlighting`
- **Target Fields:** Defined in `fieldHighlighter.js` constants
- **Colors:** Configurable in module (RGB values)

#### Dependencies

- `pageIdentifier.js` - Page type detection
- `debounceUtils.js` - Debouncing utilities
- `caseDataExtractor.js` - Field data (optional)

---

### 2. Dynamic Menu Buttons

**Module:** `modules/dynamicMenu.js`

#### Implementation Steps

1. **Button Group Generation:**
   ```javascript
   // URLBuilder generates button groups
   const buttonGroups = URLBuilder.buildAllButtons(caseData);
   ```

2. **Injection Points:**
   - **Card Actions:** `lightning-card slot[name="actions"]`
   - **Header Details:** `flexipage-component2[data-component-id*="header"]`

3. **Menu Container Creation:**
   ```javascript
   const menuContainer = document.createElement('div');
   menuContainer.className = 'exlibris-custom-menu';
   menuContainer.setAttribute('data-exlibris-injected', 'true');
   ```

4. **Button Creation:**
   ```javascript
   const button = document.createElement('button');
   button.className = 'slds-button slds-button_brand';
   button.textContent = buttonConfig.label;
   button.onclick = () => window.open(buttonConfig.url, '_blank');
   ```

5. **Idempotent Injection:**
   - Checks for existing menu before injecting
   - Uses `data-exlibris-injected` attribute
   - Removes old menu before creating new one

#### Configuration

- **Menu Locations:** `SettingsManager.get().exlibris.ui.menuLocations`
  - `cardActions: boolean`
  - `headerDetails: boolean`
- **Button Label Style:** `SettingsManager.get().exlibris.ui.buttonLabelStyle`
  - Options: `'formal'`, `'casual'`, `'abbreviated'`

#### Dependencies

- `urlBuilder.js` - URL generation
- `caseDataExtractor.js` - Case data
- `customerDataManager.js` - Customer information

---

### 3. Case Comment Memory

**Module:** `modules/caseCommentMemory.js`

#### Implementation Steps

1. **Auto-Save Setup:**
   ```javascript
   // Find comment textarea
   const textarea = document.querySelector('textarea[name="inputComment"]');
   
   // Attach input listener with throttling
   textarea.addEventListener('input', DebounceUtils.throttle(() => {
     this.saveComment(caseId, textarea.value);
   }, 2000));
   ```

2. **Storage Structure:**
   ```javascript
   {
     caseId: {
       current: "comment text",
       history: [
         { text: "version 1", timestamp: 1234567890 },
         { text: "version 2", timestamp: 1234567891 }
       ],
       lastSaved: 1234567891
     }
   }
   ```

3. **Restore UI:**
   - Injects restore button near textarea
   - Dropdown shows history with timestamps
   - Preview on hover

4. **Multi-Tab Sync:**
   - Uses `MultiTabSync` to detect other tabs
   - Shows warning if same case edited elsewhere
   - Provides link to switch tabs

#### Configuration

- **Enable/Disable:** `SettingsManager.get().exlibris.features.caseCommentMemory`
- **Throttle Interval:** 2000ms (configurable)
- **History Limit:** 10 versions (configurable)
- **Storage Key:** `caseCommentMemory` in `chrome.storage.local`

#### Dependencies

- `pageIdentifier.js` - Page detection
- `debounceUtils.js` - Throttling
- `multiTabSync.js` - Tab sync detection

---

### 4. Persistent Banner

**Module:** `modules/persistentBanner.js`

#### Implementation Steps

1. **Banner Injection:**
   ```javascript
   // Create banner element
   const banner = document.createElement('div');
   banner.id = 'exl-persistent-banner';
   banner.className = 'exl-persistent-banner';
   document.body.insertBefore(banner, document.body.firstChild);
   ```

2. **Data Reception:**
   ```javascript
   // Listen for case data events
   document.addEventListener('casePageDataExtracted', async (event) => {
     const data = event.detail;
     
     // Validate data before displaying
     const validation = PageContextValidator.validatePageContextBeforeDisplay(
       data.caseId, 
       data.caseNumber
     );
     
     if (validation.valid) {
       this.updateBannerUI(data);
     }
   });
   ```

3. **Status-Based Styling:**
   ```javascript
   // Apply gradient based on status
   const gradients = {
     'Closed': 'linear-gradient(135deg, rgb(26, 26, 46) 0%, rgb(22, 33, 62) 100%)',
     'New': 'linear-gradient(135deg, rgb(46, 62, 26) 0%, rgb(33, 62, 22) 100%)',
     'In Progress': 'linear-gradient(135deg, rgb(62, 62, 26) 0%, rgb(62, 62, 22) 100%)'
   };
   ```

4. **Periodic Validation:**
   ```javascript
   // Check every 2 seconds if displayed data is still valid
   setInterval(async () => {
     const validation = PageContextValidator.validatePageContextBeforeDisplay(
       this.displayedCaseId,
       this.displayedCaseNumber,
       false // Don't wait for title update
     );
     
     if (!validation.valid && validation.currentContext?.caseId !== this.displayedCaseId) {
       this.clearCaseData();
     }
   }, 2000);
   ```

#### Configuration

- **Enable/Disable:** `SettingsManager.get().exlibris.features.persistentBanner`
- **Validation Interval:** 2000ms (configurable)
- **Fallback Timeout:** 3000ms (triggers manual extraction)

#### Dependencies

- `casePageDataExtractor.js` - Case data extraction
- `pageContextValidator.js` - Data validation
- `navigationObserver.js` - Navigation detection

---

### 5. Case Data Extraction & Caching

**Module:** `modules/casePageDataExtractor.js`, `modules/cacheManager.js`

#### Implementation Steps

1. **Data Extraction:**
   ```javascript
   // Wait for page elements
   await this.waitForPageLoad();
   
   // Extract all case data
   const data = await this.extractAllCaseData();
   ```

2. **Data Validation:**
   ```javascript
   // Validate extracted data matches current page
   const validation = PageContextValidator.validatePageContextBeforeDisplay(
     data.caseId,
     data.caseNumber
   );
   
   // Handle async validation (waits for title update if needed)
   if (validation instanceof Promise) {
     validation = await validation;
   }
   ```

3. **Interim storage:**
  ```javascript
  // CacheManager retired — wait for CaseContextWatcher, then broadcast fresh data
  const context = await CaseContextWatcher.getStableContext();
  if (!context?.caseId) return null;
  
  const payload = {
    ...data,
    caseId: context.caseId,
    caseNumber: context.caseNumber
  };
  
  document.dispatchEvent(new CustomEvent('casePageDataExtracted', { detail: payload }));
  ```

4. **Upcoming CaseDataStore:**
  ```javascript
  // Placeholder API (ships after CaseDataStore lands)
  CaseDataStore.setCurrentData(payload, 'CasePageDataExtractor');
  const latest = CaseDataStore.getCurrentData();
  ```

#### Configuration

- **Interim behavior:** No local cache; each navigation triggers a fresh extraction.
- **Future store:** `CaseDataStore` will keep a single in-memory snapshot per visible case.
- **Signature components (planned):** Status, Sub-Status, Category, Sub-Category, Analysis Note.

#### Dependencies

- `pageContextValidator.js` - Validation
- `customerDataManager.js` - Customer lookup
- `pageIdentifier.js` - Page detection

---

## Configuration Options

### Settings Structure

```javascript
{
  savedSelection: 'EndNote', // Team selection
  exlibris: {
    features: {
      fieldHighlighting: true,
      contextMenu: true,
      multiTabSync: true,
      caseCommentMemory: true,
      characterCounter: true,
      dynamicMenu: true,
      persistentBanner: true,
      highlighterEnabled: true
    },
    ui: {
      buttonLabelStyle: 'casual', // 'formal', 'casual', 'abbreviated'
      timezone: null, // null = auto-detect
      menuLocations: {
        cardActions: false,
        headerDetails: true
      }
    },
    shortcuts: {
      enabled: true
    }
  },
  userPreferences: {
    shift: {
      timezone: 'Asia/Kuala_Lumpur',
      startHour: 21,
      startMinute: 0,
      endHour: 6,
      endMinute: 0,
      isOvernightShift: true
    },
    irt: {
      useTeamDefaults: true,
      customMinutes: null,
      team: 'EndNote'
    }
  }
}
```

### Team Configuration

Teams are configured in `content_script.js`:

```javascript
const teamConfigs = {
  'EndNote': {
    email: 'endnote.support@clarivate.com',
    keywords: [...],
    responseTimeTarget: 90,
    workingHours: { start: 14, end: 23 }
  },
  'Pivot-RP': {
    email: 'pivot.support@exlibrisgroup.com',
    keywords: ['pivot', 'pivot-rp'],
    responseTimeTarget: 90,
    workingHours: { start: 20, end: 5, isOvernightShift: true }
  }
  // ... more teams
};
```

---

## Future Enhancements

### Planned Features

1. **Fetch Interception**
   - Intercept Salesforce API calls for faster data extraction
   - Primary data source with DOM extraction as fallback
   - See `FETCH_INTERCEPTION_ANALYSIS.md` for details

2. **Side Panel**
   - Collapsible side panel with notepad and code editor
   - Case-specific notes with image support
   - Tabbed interface

3. **SQL Expression Generator**
   - Expandable section in header card
   - Entity dropdown (Researcher, Asset, etc.)
   - Pre-defined SQL query templates
   - Auto-fill placeholders from case data

4. **Enhanced Context Menu**
   - Complete Unicode character replacement
   - Advanced case toggling options
   - Symbol insertion submenu

5. **Wiki Scraping**
   - Auto-scrape customer list from Wiki page
   - Toggle between default and scraped lists
   - Manual refresh capability

### Enhancement Priorities

**High Priority:**
- Fetch interception implementation
- Enhanced error handling and logging
- Performance optimization

**Medium Priority:**
- Side panel implementation
- SQL generator
- Enhanced context menu

**Low Priority:**
- Wiki scraping
- Additional UI components
- Advanced analytics

---

## Migration Guides

### Adding a New Feature Module

1. **Create Module File:**
   ```javascript
   // modules/myNewFeature.js
   const MyNewFeature = {
     isInitialized: false,
     
     async init() {
       // Initialization
     },
     
     cleanup() {
       // Cleanup
     }
   };
   ```

2. **Add to manifest.json:**
   ```json
   {
     "js": [
       // ... existing modules
       "modules/myNewFeature.js",
       "content_script_exlibris.js"
     ]
   }
   ```

3. **Integrate in Controller:**
   ```javascript
   // In content_script_exlibris.js
   if (typeof MyNewFeature !== 'undefined') {
     await MyNewFeature.init();
   }
   ```

4. **Add Settings Toggle:**
   - Add checkbox in `popup.html`
   - Add setting in `popup.js`
   - Check setting in controller

5. **Document:**
   - Add to `FEATURE_SUMMARY.md`
   - Add to `FUNCTIONS.md`
   - Add to `SELECTORS.md` (if uses DOM selectors)
   - Update `DEPENDENCIES.md`

### Updating Existing Features

1. **Follow Best Practices:**
   - See `BEST_PRACTICES.md` for patterns
   - See `PROJECT_RULES.md` for rules

2. **Update Documentation:**
   - Update relevant documentation files
   - Add entry to `CHANGES.md`

3. **Test:**
   - Test on live Salesforce pages
   - Verify SPA navigation handling
   - Check cleanup on navigation

---

## Module Integration Examples

### Example 1: Adding Data Extraction to Feature

```javascript
// In your feature module
async init() {
  // Wait for case data
  document.addEventListener('casePageDataExtracted', (event) => {
    const data = event.detail;
    // Use data in your feature
    this.processCaseData(data);
  });
  
  // Trigger extraction if not already done
  if (typeof CasePageDataExtractor !== 'undefined') {
    const caseId = PageContextValidator.getCaseIdFromUrl();
    if (caseId) {
      CasePageDataExtractor.extractNow(caseId);
    }
  }
}
```

### Example 2: Using Settings

```javascript
// Get settings
const settings = SettingsManager.get();

// Check feature enabled
if (settings.exlibris?.features?.myFeature !== false) {
  // Feature is enabled (default true)
  await this.init();
}

// Get UI preference
const buttonStyle = settings.exlibris?.ui?.buttonLabelStyle || 'casual';
```

### Example 3: Page Type Detection

```javascript
// Wait for page identification
if (typeof PageIdentifier !== 'undefined') {
  PageIdentifier.onPageChange((pageInfo) => {
    if (pageInfo.type === PageIdentifier.pageTypes.CASE_PAGE) {
      // Initialize for case page
      this.init();
    } else {
      // Cleanup for other pages
      this.cleanup();
    }
  });
}
```

---

## Related Documentation

- **[FEATURE_SUMMARY.md](FEATURE_SUMMARY.md)** - Quick feature reference
- **[FUNCTIONS.md](FUNCTIONS.md)** - Complete function reference
- **[SELECTORS.md](SELECTORS.md)** - DOM selector reference
- **[DEPENDENCIES.md](DEPENDENCIES.md)** - Module dependencies
- **[BEST_PRACTICES.md](BEST_PRACTICES.md)** - Coding patterns
- **[PROJECT_RULES.md](PROJECT_RULES.md)** - Development rules

