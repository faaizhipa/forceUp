# Case Page Data Extractor Module

## Overview
The `CasePageDataExtractor` module automatically extracts case field data whenever a user navigates to a case detail page in Salesforce. It uses the `PageIdentifier` module to monitor page changes and extracts data using the same DOM querying logic as `performPageInitialization` in `content_script_exlibris.js`.

## Features
- **Automatic Extraction**: Triggers automatically when navigating to a case page
- **PageIdentifier Integration**: Uses PageIdentifier's event system (no polling)
- **Comprehensive Field Coverage**: Extracts 20+ case fields
- **Event-Driven Architecture**: Dispatches custom events for other modules to consume
- **Manual Trigger Support**: Can be manually triggered via `extractNow()`

## Extracted Fields

### Basic Case Information
- **caseId**: Case Salesforce ID
- **caseNumber**: Case number (8-digit)
- **subject**: Case subject line
- **description**: Full case description

### Contact & Account
- **accountName**: Account Name
- **contactName**: Contact Name

### Product/Service Information
- **platformService**: Platform/Service field
- **productServiceName**: Product/Service Name

### Case Categorization
- **category**: Category
- **subCategory**: Sub-Category
- **status**: Status
- **subStatus**: Sub Status

### Customer Data
- **exLibrisAccountNumber**: Ex Libris Account Number
- **analysisNote**: Analysis Note

### Flexipage Fields (Anchored - Lookup Fields)
- **asset**: Asset (from `RecordAsset_Line_Item_cField`)
- **affectedEnvironment**: Affected Environment (from `Recordbl_Affected_Environment_cField`)
- **caseOwner**: Case Owner (from `RecordOwnerIdField`)
- **parentCase**: Parent Case (from `RecordParentIdField`)
- **parentCaseOwner**: Parent Case Owner (from `RecordParentCaseOwner_cField`)

### Flexipage Fields (Non-Anchored - Plain Text)
- **escalation**: Escalation (from `RecordEscalation_cField`)
- **caseCreatedDate**: Case Created Date (from `RecordCreatedDateField`)
- **caseClosedOn**: Case Closed On (from `RecordClosedDateField`)
- **customerExLibrisAccountNumber**: Customer Ex Libris Account Number (from `RecordEx_Libris_Account_Number_cField`)

### Metadata
- **extractedAt**: ISO timestamp of when data was extracted

## DOM Extraction Logic

### records-record-layout-item Fields
These fields are extracted using the `field-label` attribute:
```html
<records-record-layout-item field-label="Account Name">
  <div>
    <div>
      <div class="slds-form-element__control">
        <span>
          <slot>
            <force-lookup>
              <div>
                <records-hoverable-link>
                  <div>
                    <a>
                      <span>
                        <slot>
                          <span>
                            <slot>
                              <span>Account Name Value</span>
                            </slot>
                          </span>
                        </slot>
                      </span>
                    </a>
                  </div>
                </records-hoverable-link>
              </div>
            </force-lookup>
          </slot>
        </span>
      </div>
    </div>
  </div>
</records-record-layout-item>
```

### flexipage-field Elements
These fields are extracted using the `data-field-id` attribute:

#### Anchored Data (Lookup Fields)
```html
<flexipage-field data-field-id="RecordAsset_Line_Item_cField">
  <record_flexipage-record-field>
    <div>
      <div>
        <div class="slds-form-element__control">
          <span>
            <slot>
              <force-lookup>
                <div>
                  <records-hoverable-link>
                    <div>
                      <a>
                        <span>
                          <slot>
                            <span>
                              <slot>
                                <span>Asset Value</span>
                              </slot>
                            </span>
                          </slot>
                        </span>
                      </a>
                    </div>
                  </records-hoverable-link>
                </div>
              </force-lookup>
            </slot>
          </span>
        </div>
      </div>
    </div>
  </record_flexipage-record-field>
</flexipage-field>
```

#### Non-Anchored Data (Plain Text)
```html
<flexipage-field data-field-id="RecordEscalation_cField">
  <slot>
    <record_flexipage-record-field>
      <div>
        <div>
          <div class="slds-form-element__control">
            <span>
              <slot>
                <lightning-formatted-text>Escalation Value</lightning-formatted-text>
              </slot>
            </span>
          </div>
        </div>
      </div>
    </record_flexipage-record-field>
  </slot>
</flexipage-field>
```

## Usage

### Listening to Extraction Events
```javascript
// Listen for automatic extraction events
document.addEventListener('casePageDataExtracted', (event) => {
  const caseData = event.detail;
  console.log('Case data extracted:', caseData);
  
  // Use the data in your module
  console.log('Account:', caseData.accountName);
  console.log('Status:', caseData.status);
  console.log('Server:', caseData.affectedEnvironment);
});
```

### Manual Extraction
```javascript
// Manually trigger extraction
const data = await CasePageDataExtractor.extractNow();
console.log('Manually extracted data:', data);
```

### Get Last Extracted Data
```javascript
// Get the last extracted data without triggering new extraction
const lastData = CasePageDataExtractor.getLastExtractedData();
if (lastData) {
  console.log('Last extracted data:', lastData);
}
```

## Integration with Other Modules

### Example: Update PersistentBanner
```javascript
document.addEventListener('casePageDataExtracted', (event) => {
  const data = event.detail;
  
  if (typeof PersistentBanner !== 'undefined') {
    PersistentBanner.updateCurrentPage({
      type: 'case_detail',
      caseNumber: data.caseNumber,
      subject: data.subject,
      status: data.status,
      subStatus: data.subStatus
    });
  }
});
```

### Example: Populate FlexipagePanelInjector
```javascript
document.addEventListener('casePageDataExtracted', (event) => {
  const data = event.detail;
  
  if (typeof FlexipagePanelInjector !== 'undefined') {
    FlexipagePanelInjector.updateContext({
      category: data.category,
      subCategory: data.subCategory,
      analysisNote: data.analysisNote,
      server: data.affectedEnvironment
    });
  }
});
```

## Initialization

The module is automatically initialized in `content_script_exlibris.js`:

```javascript
// In ExLibrisExtension.init()
if (typeof CasePageDataExtractor !== 'undefined') {
  CasePageDataExtractor.init();
  console.log('[ExLibris Extension] CasePageDataExtractor initialized');
}
```

## Architecture

### Event Flow
1. User navigates to case page
2. PageIdentifier detects URL change
3. PageIdentifier calls `CasePageDataExtractor.handlePageChange()`
4. Module waits for page elements to load
5. Module extracts all field data
6. Module dispatches `casePageDataExtracted` event
7. Other modules listen and consume the data

### Performance
- **Wait Time**: Max 4 seconds for page load (20 attempts × 200ms)
- **Extraction**: Synchronous DOM queries (< 50ms typically)
- **Event Dispatch**: Immediate after extraction
- **Memory**: Stores only last extracted data for current case

## Debugging

Enable console logging to see extraction details:
```javascript
// Check if module is initialized
console.log('CasePageDataExtractor initialized:', CasePageDataExtractor.isInitialized);

// Check current case ID
console.log('Current case ID:', CasePageDataExtractor.currentCaseId);

// Manually trigger extraction to see results
CasePageDataExtractor.extractNow().then(data => {
  console.log('Extracted data:', data);
});
```

## Module Dependencies
- **PageIdentifier**: Required for page change monitoring
- **DOM Elements**: Requires Salesforce page structure with `records-record-layout-item` and `flexipage-field` elements

## File Location
`modules/casePageDataExtractor.js`

## Last Updated
November 4, 2025
