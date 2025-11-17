I'll search through the casePageDataExtractor to identify all data extraction methods that are NOT using `data-field-id` as the primary selector. 

Read [](file:///c%3A/Users/U6071248/Tools/00_Extension%20Revamp/4.0%20-%20Dev01/3.0/modules/casePageDataExtractor.js#1-1), lines 1 to 200

Read [](file:///c%3A/Users/U6071248/Tools/00_Extension%20Revamp/4.0%20-%20Dev01/3.0/modules/casePageDataExtractor.js#200-200), lines 200 to 400

Read [](file:///c%3A/Users/U6071248/Tools/00_Extension%20Revamp/4.0%20-%20Dev01/3.0/modules/casePageDataExtractor.js#400-400), lines 400 to 627

Now let me create a comprehensive list of all the data extraction methods that are NOT using `data-field-id` as the primary selector:

Based on my analysis of casePageDataExtractor.js, here are **all the data extraction methods that do NOT use `data-field-id` as the primary selector**:

## **Methods Using Alternative Selectors:**

### **1. `getCaseNumber()` - Lines 210-237**
- **Primary Selector**: Page header text extraction
- **Method**: `slot[name="primaryField"] lightning-formatted-text`
- **Fallback**: Uses `getFlexipageField('RecordEx_Libris_Account_Number_cField', false)` but as fallback only
- **Pattern**: Regex match on header text `/^([0-9]{6,})/`

### **2. `getSubject()` - Lines 242-247**
- **Primary Selector**: Page header text extraction
- **Method**: Calls `getHeaderText()` and splits on ` - `
- **Pattern**: Text manipulation of header

### **3. `getHeaderText()` - Lines 252-256**
- **Primary Selector**: Shadow DOM slot selector
- **Method**: `slot[name="primaryField"] lightning-formatted-text, records-formula-output[slot="primaryField"] lightning-formatted-text`
- **Pattern**: Direct DOM query

### **4. `getDescription()` - Lines 261-271**
- **Primary Selector**: `records-record-layout-item` with field-label attribute
- **Method**: `records-record-layout-item[field-label*="Description"] lightning-formatted-text`
- **Fallback**: `records-record-layout-item[field-label*="Description"] .test-id__field-value`
- **Pattern**: Field label matching, NOT data-field-id

### **5. `getRecordLayoutField(label)` - Lines 314-342**
**Used by multiple fields:**
- `accountName` → Field label: "Account Name"
- `contactName` → Field label: "Contact Name"  
- `productServiceName` → Field label: "Product/Service Name"
- `category` → Field label: "Category"
- `subCategory` → Field label: "Sub-Category"
- `status` → Field label: "Status"
- `subStatus` → Field label: "Sub Status"
- `exLibrisAccountNumber` → Field label: "Ex Libris Account Number"
- `analysisNote` → Field label: "Analysis Note"

**Selector Method:**
- **Primary**: `records-record-layout-item[field-label="${label}"]`
- **Fallback**: Partial match `records-record-layout-item[field-label*="${label}"]`
- **Pattern**: Uses `field-label` attribute, NOT `data-field-id`

### **6. `getPlatformService()` - Lines 192-207**
- **Primary Selector**: Uses `getFlexipageField('RecordPQ_Product_Group_cField', false)` (data-field-id) ✅
- **Fallback Selector**: Uses `getRecordLayoutField('Product/Service Name')` (field-label) ❌
- **Pattern**: Hybrid approach - tries data-field-id first, falls back to field-label

## **Summary Table:**

| Field Name | Method | Primary Selector Type | Selector Value | data-field-id | anchored? |
|------------|--------|----------------------|----------------|----------------|-----------|
| `caseNumber` | `getCaseNumber()` | **Slot selector** | `slot[name="primaryField"]` |  |  |
| `subject` | `getSubject()` | **Slot selector** | `slot[name="primaryField"]` |  |  |
| `description` | `getDescription()` | **Field-label** | `field-label*="Description"` |  |  |
| `accountName` | `getRecordLayoutField()` | **Field-label** | `field-label="Account Name"` | RecordAsset_Line_Item_cField | true |
| `contactName` | `getRecordLayoutField()` | **Field-label** | `field-label="Contact Name"` | RecordContactIdField | true |
| `platformService` | `getPlatformService()` | **data-field-id** (fallback: field-label) | Primary: `data-field-id`, Fallback: `field-label` |  |  |
| `productServiceName` | `getRecordLayoutField()` | **Field-label** | `field-label="Product/Service Name"` | RecordPQ_Product_Group_cField | false |
| `category` | `getRecordLayoutField()` | **Field-label** | `field-label="Category"` | RecordCategory_cField | false |
| `subCategory` | `getRecordLayoutField()` | **Field-label** | `field-label="Sub-Category"` | RecordSub_Category_cField | false |
| `status` | `getRecordLayoutField()` | **Field-label** | `field-label="Status"` | RecordStatusField | false |
| `subStatus` | `getRecordLayoutField()` | **Field-label** | `field-label="Sub Status"` | RecordSub_Status_cField | false |
| `exLibrisAccountNumber` | `getRecordLayoutField()` | **Field-label** | `field-label="Ex Libris Account Number"` | RecordEx_Libris_Account_Number_cField | false |
| `analysisNote` | `getRecordLayoutField()` | **Field-label** | `field-label="Analysis Note"` | RecordAsset_Line_Item_cField | false |

## **Fields Using `data-field-id` (for comparison):**

| Field Name | Method | data-field-id Value |
|------------|--------|---------------------|
| `asset` | `getFlexipageField()` | `RecordAsset_Line_Item_cField` |
| `affectedEnvironment` | `getFlexipageField()` | `Recordbl_Affected_Environment_cField` |
| `caseOwner` | `getFlexipageField()` | `RecordOwnerIdField` |
| `parentCase` | `getFlexipageField()` | `RecordParentIdField` |
| `parentCaseOwner` | `getFlexipageField()` | `RecordParentCaseOwner_cField` |
| `escalation` | `getFlexipageField()` | `RecordEscalation_cField` |
| `caseCreatedDate` | `getFlexipageField()` | `RecordCreatedDateField` |
| `caseClosedOn` | `getFlexipageField()` | `RecordClosedDateField` |
| `customerExLibrisAccountNumber` | `getFlexipageField()` | `RecordEx_Libris_Account_Number_cField` |
| `pageStatus` | `getFlexipageField()` | `RecordStatusField` |

**Total using field-label: 13 fields**  
**Total using data-field-id: 10 fields**  
**Total using slot selector: 2 fields (caseNumber, subject)**

The console log you showed earlier indicates that **all the field-label based extractions are failing** ("Could not find layout item for label"), which is why FieldHighlighter can't find the fields either - they're using the same `field-label` selector pattern!

| Field Name | Method | Primary Selector Type | Selector Value | data-field-id | anchored? |
|------------|--------|----------------------|----------------|----------------|-----------|
| `accountName` | `getRecordLayoutField()` | **Field-label** | `field-label="Account Name"` | RecordAsset_Line_Item_cField | true |
| `contactName` | `getRecordLayoutField()` | **Field-label** | `field-label="Contact Name"` | RecordContactIdField | true |
| `productServiceName` | `getRecordLayoutField()` | **Field-label** | `field-label="Product/Service Name"` | RecordPQ_Product_Group_cField | false |
| `category` | `getRecordLayoutField()` | **Field-label** | `field-label="Category"` | RecordCategory_cField | false |
| `subCategory` | `getRecordLayoutField()` | **Field-label** | `field-label="Sub-Category"` | RecordSub_Category_cField | false |
| `status` | `getRecordLayoutField()` | **Field-label** | `field-label="Status"` | RecordStatusField | false |
| `subStatus` | `getRecordLayoutField()` | **Field-label** | `field-label="Sub Status"` | RecordSub_Status_cField | false |
| `exLibrisAccountNumber` | `getRecordLayoutField()` | **Field-label** | `field-label="Ex Libris Account Number"` | RecordEx_Libris_Account_Number_cField | false |
