# DOM Selectors Registry

This document catalogs all DOM selectors used in the codebase, organized by module and page type.

## Centralized Selector Registry

| Selector | Module | Page Type | Purpose | Stability | Last Verified |
|----------|--------|-----------|---------|-----------|---------------|
| `section.tabContent.active .forcegenerated-record-layout2[style*="display: block"] div.highlights .slds-page-header__title lightning-formatted-text` | CaseDomUtils, CaseDataExtractor, CasePageDataExtractor | CASE_PAGE | Visible case header (active tab only) | Evergreen | 2025-11 |
| `slot[name="primaryField"] lightning-formatted-text` | CaseDataExtractor, CasePageDataExtractor | CASE_PAGE | Get case header (number + subject) | Stable | Current |
| `records-formula-output[slot="primaryField"] lightning-formatted-text` | CaseDataExtractor, CasePageDataExtractor | CASE_PAGE | Fallback for case header | Stable | Current |
| `records-record-layout-item[field-label*="Description"]` | CaseDataExtractor, CasePageDataExtractor | CASE_PAGE | Get description field | Stable | Current |
| `records-record-layout-item[field-label="Field Name"]` | CaseDataExtractor, CasePageDataExtractor, FieldHighlighter | CASE_PAGE | Generic field by label | Stable | Current |
| `records-record-layout-item[field-label="Field Name"] .test-id__field-value` | CaseDataExtractor, FieldHighlighter | CASE_PAGE | Field value element | Stable | Current |
| `records-record-layout-item[field-label="Field Name"] lightning-formatted-text` | CaseDataExtractor, CasePageDataExtractor | CASE_PAGE | Formatted text field value | Stable | Current |
| `records-record-layout-item[field-label*="Asset"] a` | CaseDataExtractor | CASE_PAGE | Asset link | Stable | Current |
| `flexipage-component2[data-component-id="flexipage_fieldSection6"]` | CaseDataExtractor, FieldHighlighter | CASE_PAGE | Jira section container | Stable | Current |
| `div[data-target-selection-name*="Primary_Jira"]` | CaseDataExtractor, FieldHighlighter | CASE_PAGE | Primary Jira field | Stable | Current |
| `div[data-target-selection-name*="JIRA"]` | CaseDataExtractor | CASE_PAGE | Jira field (alternate) | Stable | Current |
| `div[data-target-selection-name$="Problem_Root_Cause__c"]` | FieldHighlighter | CASE_PAGE | Root cause field | Stable | Current |
| `div[data-target-selection-name$="Jira_Status__c"]` | FieldHighlighter | CASE_PAGE | Jira status field | Stable | Current |
| `records-record-layout-item[field-label*="Last Modified"]` | CaseDataExtractor | CASE_PAGE | Last modified date field | Stable | Current |
| `records-highlights2 div.secondaryFields` | FlexipagePanelInjector, DynamicMenu | CASE_PAGE | Header secondary fields container | Stable | Current |
| `records-highlights-details-item` | FlexipagePanelInjector, DynamicMenu | CASE_PAGE | Header details item | Stable | Current |
| `flexipage-field[data-field-id="FieldId"]` | CasePageDataExtractor | CASE_PAGE | Flexipage field by ID | Stable | Current |
| `lightning-card slot[name="actions"]` | DynamicMenu | CASE_PAGE | Card actions slot | Stable | Current |
| `textarea[name="inputComment"]` | CharacterCounter | CASE_COMMENTS | Case comment textarea | Stable | Current |
| `button[name="SaveEdit"]` | CharacterCounter | CASE_COMMENTS | Save button (for positioning) | Stable | Current |
| `#oneHeader > div.slds-global-header.slds-grid.slds-grid_align-spread` | PersistentBanner | ALL | Global header for layout adjustment | Fragile | Current |
| `body > div.desktop.container.forceStyle...tabsetHeader` | PersistentBanner | ALL | Tab bar for layout adjustment | Fragile | Current |
| `div.toolbar.top.forceContentBasePreviewToolbar` | PersistentBanner | ALL | Toolbar for layout adjustment | Fragile | Current |
| `slot[name="exlibris-panel-slot"]` | CaseTimezoneResolver | CASE_PAGE | Injected panel slot | Stable | Current |
| `span#exl-detected-timezone` | CaseTimezoneResolver | CASE_PAGE | Timezone display span | Stable | Current |
| `#exl-flexipage-panel` | FlexipagePanelInjector | CASE_PAGE | Injected panel ID | Stable | Current |
| `#exl-persistent-banner` | PersistentBanner | ALL | Persistent banner ID | Stable | Current |
| `a[role="tab"]` | EventSimulator | ALL | Tab element | Stable | Current |
| `button[role="tab"]` | EventSimulator | ALL | Tab button | Stable | Current |
| `.slds-tabs_default__item a` | EventSimulator | ALL | Tab link (SLDS) | Stable | Current |
| `.forceHoverPanel` | AccountAddressExtractor | CASE_PAGE | Account hover panel | Stable | Current |
| `.primaryField.highlightsH2` | AccountAddressExtractor | CASE_PAGE | Account name in hover panel | Stable | Current |
| `.forceOutputAddressText` | AccountAddressExtractor | CASE_PAGE | Address text in hover panel | Stable | Current |
| `.case-comment-character-counter` | CharacterCounter | CASE_COMMENTS | Character counter element | Stable | Current |
| `[data-cc-extractor="true"]` | PersistentBanner | CASE_COMMENTS | Injected comment extractor buttons | Stable | Current |
| `[data-action]` | FlexipagePanelInjector, PersistentBanner | CASE_PAGE | Action buttons | Stable | Current |
| `[data-env-url]` | PersistentBanner | CASE_PAGE | Environment URL buttons | Stable | Current |
| `[data-history-url]` | PersistentBanner | ALL | Navigation history buttons | Stable | Current |
| `.exlibris-custom-menu` | DynamicMenu | CASE_PAGE | Custom menu container | Stable | Current |
| `.exl-panel` | FlexipagePanelInjector | CASE_PAGE | Panel container | Stable | Current |
| `.exl-btn` | FlexipagePanelInjector | CASE_PAGE | Panel button | Stable | Current |
| `.case-comment-preview-modal` | KeyboardShortcuts | CASE_COMMENTS | Preview modal | Stable | Current |
| `.case-comment-restore-button` | KeyboardShortcuts | CASE_COMMENTS | Restore button | Stable | Current |

## Module-Specific Selectors

### CaseDataExtractor

**Purpose**: Extract case data from Salesforce Lightning pages

**Selectors**:
```javascript
// Header (case number + subject)
'section.tabContent.active .forcegenerated-record-layout2[style*="display: block"] div.highlights .slds-page-header__title lightning-formatted-text'
'slot[name="primaryField"] lightning-formatted-text'
'records-formula-output[slot="primaryField"] lightning-formatted-text'

// Description field
'records-record-layout-item[field-label*="Description"] lightning-formatted-text'
'records-record-layout-item[field-label*="Description"] .test-id__field-value'

// Generic field lookup
'records-record-layout-item[field-label*="${label}"] .test-id__field-value'
'records-record-layout-item[field-label*="${label}"] lightning-formatted-text'
'records-record-layout-item[field-label*="${label}"] force-lookup'

// Asset link
'records-record-layout-item[field-label*="Asset"] a'

// Jira section
'flexipage-component2[data-component-id="flexipage_fieldSection6"]'
'div[data-target-selection-name*="Primary_Jira"]'
'div[data-target-selection-name*="JIRA"]'

// Last modified
'records-record-layout-item[field-label*="Last Modified"]'
'.test-id__field-value, lightning-formatted-text, lightning-formatted-date-time'
```

**Shadow DOM Considerations**:
- Uses `queryShadowDOM()` for deep traversal
- Checks `element.shadowRoot` before querying
- Falls back to direct query if shadow root not found

**Fallback Strategy**:
1. Try direct query
2. Try shadow DOM traversal
3. Try partial label match
4. Return null if all fail

### CasePageDataExtractor

**Purpose**: Automatically extract case data on page load

**Selectors**:
```javascript
// Page load detection
'records-record-layout-item'
'flexipage-field'

// Header
'section.tabContent.active .forcegenerated-record-layout2[style*="display: block"] div.highlights .slds-page-header__title lightning-formatted-text'
'slot[name="primaryField"] lightning-formatted-text'
'records-formula-output[slot="primaryField"] lightning-formatted-text'

// Record layout fields
'records-record-layout-item[field-label="${label}"]'
'records-record-layout-item[field-label*="${label}"]'

// Flexipage fields
'flexipage-field[data-field-id="${fieldId}"]'

// Value extraction paths
'lightning-formatted-text'
'force-lookup'
'records-hoverable-link a'
'span' (nested in anchor)
'div.slds-form-element__control span'
'.test-id__field-value'
```

**Shadow DOM Strategy**:
- Primary: Direct query
- Secondary: `element.shadowRoot.querySelector()`
- Tertiary: Deep recursive `queryShadowDOM()` traversal

**Anchored vs Non-Anchored Fields**:
- **Anchored** (lookup fields): Extract from `a > span` chain
- **Non-Anchored** (text fields): Extract from `lightning-formatted-text`

### CaseDomUtils

**Purpose**: Provide stable helpers for selecting the *visible* highlights panel

**Selectors**:
```javascript
'section.tabContent.active .forcegenerated-record-layout2[style*="display: block"] div.highlights'
'section.tabContent.active .forcegenerated-record-layout2[style*="display: block"] div.highlights .slds-page-header__title lightning-formatted-text'
```

**Usage Notes**:
- Always scope header lookups through `CaseDomUtils` before falling back to slot selectors.
- The `[style*="display: block"]` filter ensures hidden tabs are ignored.

### FieldHighlighter

**Purpose**: Highlight case fields based on completion status

**Selectors**:
```javascript
// Field containers
'records-record-layout-item[field-label="Category"]'
'records-record-layout-item[field-label="Sub-Category"]'
'records-record-layout-item[field-label="Description"]'
'records-record-layout-item[field-label="Status"]'

// Field inputs/values
'records-record-layout-item[field-label="Category"] .test-id__field-value'
'records-record-layout-item[field-label="Sub-Category"] .test-id__field-value'
'records-record-layout-item[field-label="Description"] .test-id__field-value'
'records-record-layout-item[field-label="Status"] .test-id__field-value'

// Field labels
'records-record-layout-item[field-label="Category"] div div span'
'records-record-layout-item[field-label="Sub-Category"] div div span'
'records-record-layout-item[field-label="Description"] div div span'
'records-record-layout-item[field-label="Status"] div div span'

// Jira section fields
'flexipage-component2[data-component-id="flexipage_fieldSection6"]'
'div[data-target-selection-name$="Problem_Root_Cause__c"]'
'div[data-target-selection-name$="Primary_Jira__c"]'
'div[data-target-selection-name$="Jira_Status__c"]'
```

**Usage Pattern**:
- Container selector for background color
- Input selector for value checking
- Label selector for text styling (currently disabled)

### FlexipagePanelInjector

**Purpose**: Inject panel into Salesforce flexipage header

**Selectors**:
```javascript
// Primary injection point
'records-highlights2 div.secondaryFields'

// Secondary injection point
'records-highlights-details-item' (then get parent slot)

// Fallback selectors
'.highlights .slds-page-header__detail-row'
'.slds-page-header'
'[data-aura-class="forceRecordLayout"]'
'one-record-home-flexipage2'
'.forcePageBlockSectionRow'

// Panel elements
'#exl-flexipage-panel'
'#exl-panel-slot1'
'#exl-panel-slot2'
'#exl-panel-status'
'#exl-slot2-message'
'#exl-slot2-body'

// Action buttons
'[data-action="${action}"]'
```

**Visibility Checking**:
- Checks `window.getComputedStyle()` for `display: none` or `visibility: hidden`
- Checks `getBoundingClientRect()` for dimensions
- Only injects into visible elements

**Injection Strategy**:
1. Find visible `div.secondaryFields` in `records-highlights2`
2. Fallback: Find `records-highlights-details-item` and get parent slot
3. Fallback: Try other header selectors
4. Wrap panel in `slot[name="exlibris-panel-slot"]` for encapsulation

### DynamicMenu

**Purpose**: Inject custom buttons into case pages

**Selectors**:
```javascript
// Card actions injection
'lightning-card slot[name="actions"]'

// Header details injection
'records-highlights2 div.secondaryFields'
'records-highlights-details-item' (then parent slot)

// Menu container
'.exlibris-custom-menu'
'.exlibris-menu-header'
'.exlibris-menu-card'
```

**Injection Points**:
- **Card Actions**: `lightning-card slot[name="actions"]`
- **Header Details**: `records-highlights2 div.secondaryFields`

**Observer Pattern**:
- Observes header container for DOM changes
- Re-injects menu if removed by Salesforce

### PersistentBanner

**Purpose**: Display persistent banner across all pages

**Selectors**:
```javascript
// Banner element
'#exl-persistent-banner'

// Banner sub-elements
'#exl-banner-page-type'
'#exl-banner-case'
'#exl-banner-subject'
'#exl-banner-status'
'#exl-banner-substatus'
'#exl-banner-product'
'#exl-banner-instcode'
'#exl-banner-custid'
'#exl-banner-instid'
'#exl-banner-server'
'#exl-banner-env-toggle'
'#exl-env-toggle-btn'
'#exl-banner-env-section'
'#exl-env-buttons-container'
'#exl-banner-history'

// Layout adjustment targets
'#oneHeader > div.slds-global-header.slds-grid.slds-grid_align-spread'
'body > div.desktop.container.forceStyle.oneOne.navexDesktopLayoutContainer.lafAppLayoutHost.forceAccess > div.viewport > section > div.workspaceManager.navexWorkspaceManager > div > div.tabsetHeader.slds-context-bar.slds-context-bar--tabs.slds-no-print'
'div.toolbar.top.fadeOut.forceContentBasePreviewToolbar.forceContentPreviewPlayerTopToolbar'
'div.toolbar.top.forceContentPreviewPlayerTopToolbar'

// Action buttons
'[data-action]'
'[data-env-url]'
'[data-history-url]'
```

**Injection Strategy**:
- Observes DOM for injection point
- Injects after global header or tab bar
- Adjusts Salesforce layout to accommodate banner

### CaseTimezoneResolver

**Purpose**: Resolve timezone from account name hover

**Selectors**:
```javascript
// Panel slot
'slot[name="exlibris-panel-slot"]'

// Account name element
'slot:first-child p' (with text "Account Name")

// Timezone display
'span#exl-detected-timezone'
```

**Element Finding Strategy**:
1. Find visible `slot[name="exlibris-panel-slot"]`
2. Get parent div
3. Find first child slot
4. Find `p` element with text "Account Name"
5. Get parent div (targetDiv)
6. Find anchor tag for account name

### CharacterCounter

**Purpose**: Display character count for case comments

**Selectors**:
```javascript
// Textarea
'textarea[name="inputComment"]'

// Counter element
'.case-comment-character-counter'

// Button row (for positioning)
'button' (near textarea, traverse up DOM tree)
```

**Positioning Strategy**:
- Finds textarea
- Traverses up DOM to find button row
- Inserts counter before first button

### AccountAddressExtractor

**Purpose**: Extract address from account hover panel

**Selectors**:
```javascript
// Hover panel
'.forceHoverPanel'

// Account name
'.primaryField.highlightsH2'
'h2.primaryField'
'.primaryFieldWrapper h2'

// Address fields
'.forceOutputAddressText'
'.slds-truncate'
```

**Extraction Strategy**:
- Observes DOM for `.forceHoverPanel` appearance
- Waits 300ms for content to render
- Extracts address lines from `.forceOutputAddressText`

### EventSimulator

**Purpose**: Simulate user events safely

**Selectors**:
```javascript
// Tabs
'a[role="tab"]'
'button[role="tab"]'
'.slds-tabs_default__item a'
'.slds-tabs--default__item a'
```

**Visibility Checking**:
- Checks `offsetParent` for display
- Checks `getBoundingClientRect()` for dimensions
- Checks `getComputedStyle()` for visibility

## Page Type Classifications

### CASE_PAGE
Case detail pages in Salesforce Lightning:
- URL pattern: `/lightning/r/Case/[ID]` or `/Case/[ID]`
- Contains: `records-record-layout-item`, `flexipage-field`
- Primary selectors: Record layout fields, flexipage fields

### CASE_COMMENTS
Case comments page:
- URL pattern: `/lightning/r/Case/[ID]/related/CaseComments/view`
- Contains: `textarea[name="inputComment"]`
- Primary selectors: Comment textarea, save buttons

### CASES_LIST
Case list page:
- URL pattern: `/lightning/o/Case/list`
- Contains: `table[aria-label*="Cases"]`
- Primary selectors: Table rows, case number links

### ALL
All Salesforce pages:
- Used for: Persistent banner, navigation monitoring
- Primary selectors: Global header, tab bar

## Shadow DOM Handling

### Strategy Pattern
Most modules use this pattern:
```javascript
// 1. Try direct query
let element = document.querySelector(selector);

// 2. Try shadow root
if (!element && parent.shadowRoot) {
  element = parent.shadowRoot.querySelector(selector);
}

// 3. Try deep traversal
if (!element) {
  element = queryShadowDOM(selector, parent);
}
```

### Deep Traversal Function
```javascript
function queryShadowDOM(selector, root = document.body) {
  // Try direct query first
  let element = root.querySelector(selector);
  if (element) return element;

  // Recursively search through shadow roots
  const traverse = (node) => {
    if (node.shadowRoot) {
      const found = node.shadowRoot.querySelector(selector);
      if (found) return found;
      
      for (const child of node.shadowRoot.children) {
        const result = traverse(child);
        if (result) return result;
      }
    }

    for (const child of node.children) {
      const result = traverse(child);
      if (result) return result;
    }

    return null;
  };

  return traverse(root);
}
```

## Selector Stability Ratings

### Stable
- Uses standard Salesforce Lightning component names
- Uses `data-*` attributes
- Uses `field-label` attributes
- Uses class names from Salesforce Design System (SLDS)

### Fragile
- Uses long, specific DOM paths
- Uses Salesforce internal class names
- Uses position-based selectors
- May break with Salesforce updates

### Experimental
- New selectors not yet verified
- Alternative approaches being tested
- May change based on testing

## Best Practices

### DO
- ✅ Use `field-label` attributes for field identification
- ✅ Use `data-*` attributes for custom elements
- ✅ Check visibility before querying
- ✅ Use fallback selectors
- ✅ Handle Shadow DOM properly
- ✅ Use partial matches (`field-label*="Label"`) when exact match fails
- ✅ Cache frequently used selectors
- ✅ Document selector purpose and stability

### DON'T
- ❌ Use long, specific DOM paths
- ❌ Rely on position-based selectors
- ❌ Use Salesforce internal class names (unless stable)
- ❌ Query without checking element existence
- ❌ Ignore Shadow DOM
- ❌ Use selectors that depend on page layout
- ❌ Hardcode selectors without fallbacks

## Common Patterns

### Field Extraction Pattern
```javascript
// 1. Try exact label match
let field = document.querySelector(`records-record-layout-item[field-label="${label}"]`);

// 2. Try partial match
if (!field) {
  field = document.querySelector(`records-record-layout-item[field-label*="${label}"]`);
}

// 3. Try shadow DOM
if (!field) {
  field = queryShadowDOM(`records-record-layout-item[field-label*="${label}"]`);
}

// 4. Extract value
if (field) {
  const value = extractValue(field);
}
```

### Injection Point Pattern
```javascript
// 1. Try primary selector
let container = document.querySelector(primarySelector);

// 2. Check visibility
if (container && isElementVisible(container)) {
  inject(container);
  return;
}

// 3. Try fallback selectors
for (const selector of fallbackSelectors) {
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    if (isElementVisible(element)) {
      inject(element);
      return;
    }
  }
}
```

### Shadow DOM Value Extraction Pattern
```javascript
// Try multiple paths
const paths = [
  () => element.querySelector('lightning-formatted-text'),
  () => element.shadowRoot?.querySelector('lightning-formatted-text'),
  () => queryShadowDOM('lightning-formatted-text', element),
  () => element.querySelector('force-lookup a'),
  () => element.querySelector('.test-id__field-value')
];

for (const getValue of paths) {
  const value = getValue();
  if (value && value.textContent) {
    return value.textContent.trim();
  }
}
```

