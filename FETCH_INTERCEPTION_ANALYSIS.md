# Fetch Interception Analysis: Alternative to DOM-Based Case Data Extraction

**Date:** 2025-01-23  
**Purpose:** Research and validation of intercepting Salesforce API fetch calls as an alternative/replacement for DOM-based case data extraction

---

## Executive Summary

**Verdict:** ✅ **VIABLE and RECOMMENDED as a complementary approach**, but **NOT a complete replacement** for DOM extraction.

**Key Findings:**
- ✅ Technically feasible in Manifest V3
- ✅ More reliable than DOM scraping
- ✅ Faster data access (no waiting for DOM)
- ⚠️ Requires careful implementation to avoid performance issues
- ⚠️ May miss some fields not in API response
- ⚠️ API structure may change (though less likely than DOM)

**Recommendation:** Implement as **primary data source** with DOM extraction as **fallback/validation**.

---

## Technical Feasibility

### ✅ Manifest V3 Compatibility

**Status:** Fully compatible with Manifest V3

The approach uses content script monkey-patching, which is:
- ✅ Allowed in Manifest V3
- ✅ No special permissions required (beyond existing content script permissions)
- ✅ Works in isolated world (safe from page script interference)
- ✅ No user warnings (unlike `chrome.debugger`)

### Implementation Requirements

1. **Manifest Changes:**
   ```json
   {
     "content_scripts": [{
       "js": ["fetchInterceptor.js"],
       "matches": ["https://proquestllc.lightning.force.com/*"],
       "run_at": "document_start"  // CRITICAL: Must run before page scripts
     }]
   }
   ```

2. **No Additional Permissions:**
   - No `webRequest` permission needed
   - No `host_permissions` beyond existing content script matches
   - Works with current permission set

---

## Comparison: Fetch Interception vs. DOM Extraction

### Current DOM Extraction Approach

**How it works:**
- Queries DOM using selectors (SLDS classes, field labels)
- Traverses Shadow DOM recursively
- Extracts text content from rendered elements
- Waits for elements to load (retry loops, MutationObserver)
- Handles lazy-loaded content

**Challenges:**
- ❌ Fragile selectors (DOM structure changes)
- ❌ Slow (waits for DOM, multiple queries)
- ❌ Shadow DOM complexity
- ❌ Lazy loading delays
- ❌ Translation/localization issues
- ❌ May miss fields not visible on current tab

**Current Implementation:**
- `CaseDataExtractor.extractCaseData()` - Basic field extraction
- `CasePageDataExtractor.extractAllCaseData()` - Comprehensive extraction
- `CaseDetailExtractor.extractCaseDetails()` - XML/TSV export

### Fetch Interception Approach

**How it works:**
- Monkey-patches `window.fetch` before page scripts run
- Intercepts Salesforce API calls (`aura.RecordUi.getRecordWithFields`)
- Extracts data from JSON response
- No DOM dependency

**Advantages:**
- ✅ **More reliable** - API structure more stable than DOM
- ✅ **Faster** - No waiting for DOM rendering
- ✅ **Complete data** - Gets all fields in one response
- ✅ **No selector fragility** - Direct API access
- ✅ **No Shadow DOM issues** - Pure JSON parsing
- ✅ **Works immediately** - Data available as soon as API responds

**Challenges:**
- ⚠️ **API structure changes** - Salesforce may change response format
- ⚠️ **Performance overhead** - Intercepts ALL fetch calls (needs filtering)
- ⚠️ **Response cloning** - Must clone response (memory overhead)
- ⚠️ **May miss custom fields** - If not requested in API call
- ⚠️ **Multiple API calls** - May need to intercept multiple endpoints

---

## Detailed Analysis

### 1. Salesforce API Endpoints

**Primary Endpoint:**
```
aura.RecordUi.getRecordWithFields
```

**URL Pattern:**
```
https://proquestllc.lightning.force.com/aura?r=...&aura.RecordUi.getRecordWithFields=...
```

**Response Structure:**
```json
{
  "actions": [{
    "id": "...",
    "state": "SUCCESS",
    "returnValue": {
      "apiName": "Case",
      "fields": {
        "CaseNumber": { "value": "00001026" },
        "Subject": { "value": "API key available for Esploro" },
        "Description": { "value": "..." },
        "Account": {
          "value": {
            "apiName": "Account",
            "fields": {
              "Name": { "value": "University of Example" }
            }
          }
        },
        "Contact": {
          "value": {
            "apiName": "Contact",
            "fields": {
              "Name": { "value": "John Doe" }
            }
          }
        }
      }
    }
  }]
}
```

### 2. Implementation Pattern

**Best Practice Pattern (from example):**

```javascript
// fetchInterceptor.js
const { fetch: originalFetch } = window;

window.fetch = async (...args) => {
  const requestUrl = args[0] instanceof Request ? args[0].url : args[0].toString();
  const response = await originalFetch(...args);
  
  // Level 1: URL filter (cheap)
  if (requestUrl.includes('aura.RecordUi.getRecordWithFields')) {
    // Level 2: Response body filter (expensive)
    const responseClone = response.clone();
    
    responseClone.text().then(body => {
      handleCaseResponse(body);
    }).catch(err => {
      console.error('[FetchInterceptor] Error:', err);
    });
  }
  
  return response;
};

function handleCaseResponse(responseBodyText) {
  try {
    const data = JSON.parse(responseBodyText);
    const fields = data?.actions?.[0]?.returnValue?.fields;
    
    // Level 2 filter: Verify it's case data
    if (fields && fields.CaseNumber && fields.Subject) {
      const extractedData = extractNonNullValues(fields);
      
      // Send to background or store in global state
      chrome.runtime.sendMessage({
        type: 'CASE_DATA_CAPTURED',
        payload: {
          caseId: extractCaseIdFromUrl(),
          caseNumber: fields.CaseNumber.value,
          data: extractedData,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (e) {
    console.error('[FetchInterceptor] Parse error:', e);
  }
}

// Recursive flattener (from example)
function extractNonNullValues(fields, parentKey = '', results = {}) {
  for (const key in fields) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
    
    const fieldData = fields[key];
    const value = fieldData.value;
    const fullKey = parentKey + key;
    
    if (value !== null) {
      // Nested record (Account, Contact)
      if (typeof value === 'object' && value.apiName && value.fields) {
        extractNonNullValues(value.fields, fullKey + '.', results);
      }
      // Simple value
      else if (typeof value !== 'object') {
        results[fullKey] = value;
      }
    }
  }
  return results;
}
```

### 3. Performance Considerations

**Performance Impact:**

1. **URL Filtering (Level 1):**
   - ✅ Extremely fast (string includes check)
   - ✅ Filters out 99%+ of requests
   - ✅ Minimal overhead

2. **Response Cloning (Level 2):**
   - ⚠️ Memory overhead (clones response)
   - ⚠️ Only for matching URLs (already filtered)
   - ⚠️ Async processing (doesn't block page)

3. **JSON Parsing:**
   - ⚠️ CPU overhead for large responses
   - ⚠️ Only for verified case data responses
   - ✅ One-time cost per case page load

**Optimization Strategies:**

```javascript
// Debounce rapid-fire requests
let lastProcessedUrl = null;
let debounceTimer = null;

window.fetch = async (...args) => {
  const requestUrl = args[0] instanceof Request ? args[0].url : args[0].toString();
  const response = await originalFetch(...args);
  
  if (requestUrl.includes('aura.RecordUi.getRecordWithFields')) {
    // Debounce: Only process if URL changed or after delay
    if (requestUrl !== lastProcessedUrl) {
      lastProcessedUrl = requestUrl;
      
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        processResponse(response.clone(), requestUrl);
      }, 100); // 100ms debounce
    }
  }
  
  return response;
};
```

### 4. Data Completeness

**Fields Available via API:**
- ✅ All standard Case fields
- ✅ Related records (Account, Contact)
- ✅ Lookup fields (with resolved values)
- ✅ Formula fields (calculated values)
- ✅ Custom fields (if included in request)

**Fields That May Be Missing:**
- ⚠️ Fields not requested in API call
- ⚠️ Fields from other tabs (Communication, Files)
- ⚠️ Fields from related lists
- ⚠️ Fields from custom components

**Solution: Hybrid Approach**
- Use API for primary data
- Use DOM extraction for:
  - Fields not in API response
  - Related list data
  - Custom component data
  - Validation/verification

---

## Implementation Plan

### Phase 1: Basic Interception (MVP)

**Goal:** Intercept and extract basic case data

**Steps:**
1. Create `modules/fetchInterceptor.js`
2. Update `manifest.json` to load at `document_start`
3. Implement URL filtering
4. Extract core fields (CaseNumber, Subject, Description)
5. Store in global state or send to background

**Files to Create/Modify:**
- `modules/fetchInterceptor.js` (new)
- `manifest.json` (add to content_scripts)

### Phase 2: Complete Field Extraction

**Goal:** Extract all fields using recursive flattener

**Steps:**
1. Implement recursive field extraction
2. Handle nested records (Account, Contact)
3. Map to existing data structure
4. Integrate with `CaseDataExtractor` interface

### Phase 3: Integration with Existing System

**Goal:** Replace DOM extraction as primary source

**Steps:**
1. Update `CasePageDataExtractor` to use fetch data
2. Keep DOM extraction as fallback
3. Add validation (compare API vs DOM)
4. Update cache to use API data

### Phase 4: Optimization

**Goal:** Performance and reliability improvements

**Steps:**
1. Add debouncing for rapid requests
2. Cache API responses
3. Handle multiple API calls
4. Add error recovery

---

## Recommended Architecture

### Hybrid Approach (Best of Both Worlds)

```
┌─────────────────────────────────────────┐
│         Fetch Interceptor               │
│  (Primary Data Source)                  │
│  - Intercepts API calls                 │
│  - Extracts structured data             │
│  - Fast, reliable                       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Data Normalization Layer           │
│  - Maps API data to standard format     │
│  - Validates data completeness          │
│  - Merges with DOM data if needed      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      CaseDataExtractor (Unified)       │
│  - Single interface for all modules     │
│  - API data (primary)                   │
│  - DOM data (fallback/supplement)       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Cache Manager                      │
│  - Stores validated data               │
│  - Uses API data signature              │
└─────────────────────────────────────────┘
```

### Code Structure

```javascript
// modules/fetchInterceptor.js
const FetchInterceptor = {
  capturedData: null,
  isInitialized: false,
  
  init() {
    if (this.isInitialized) return;
    
    // Monkey-patch fetch
    this.patchFetch();
    this.isInitialized = true;
  },
  
  patchFetch() {
    const { fetch: originalFetch } = window;
    const self = this;
    
    window.fetch = async (...args) => {
      const requestUrl = args[0] instanceof Request ? args[0].url : args[0].toString();
      const response = await originalFetch(...args);
      
      // Filter for case data API
      if (requestUrl.includes('aura.RecordUi.getRecordWithFields')) {
        self.handleCaseApiResponse(response.clone());
      }
      
      return response;
    };
  },
  
  async handleCaseApiResponse(responseClone) {
    try {
      const body = await responseClone.text();
      const data = JSON.parse(body);
      const fields = data?.actions?.[0]?.returnValue?.fields;
      
      if (fields && fields.CaseNumber) {
        const extractedData = this.extractFields(fields);
        
        // Store in global state
        if (window.ExLibrisExtension) {
          window.ExLibrisExtension.apiCaseData = extractedData;
          window.ExLibrisExtension.apiCaseDataTimestamp = Date.now();
        }
        
        // Dispatch event for other modules
        document.dispatchEvent(new CustomEvent('caseDataFromApi', {
          detail: extractedData
        }));
      }
    } catch (error) {
      console.error('[FetchInterceptor] Error:', error);
    }
  },
  
  extractFields(fields, parentKey = '', results = {}) {
    // Recursive extraction (from example)
    // ... implementation
  }
};

// Update CaseDataExtractor to use API data first
const CaseDataExtractor = {
  extractCaseData() {
    // Priority 1: Use API data if available
    if (window.ExLibrisExtension?.apiCaseData) {
      const apiData = window.ExLibrisExtension.apiCaseData;
      // Check if data is fresh (within last 5 seconds)
      const age = Date.now() - (window.ExLibrisExtension.apiCaseDataTimestamp || 0);
      if (age < 5000) {
        return this.normalizeApiData(apiData);
      }
    }
    
    // Priority 2: Fallback to DOM extraction
    return this.extractCaseDataFromDOM();
  },
  
  normalizeApiData(apiData) {
    // Map API field names to standard format
    return {
      caseId: this.getCaseIdFromUrl(),
      caseNumber: apiData.CaseNumber || null,
      subject: apiData.Subject || null,
      description: apiData.Description || null,
      accountName: apiData['Account.Name'] || null,
      contactName: apiData['Contact.Name'] || null,
      // ... map all fields
    };
  }
};
```

---

## Pros and Cons Summary

### ✅ Advantages

1. **Reliability**
   - API structure more stable than DOM
   - No selector fragility
   - No Shadow DOM complexity

2. **Performance**
   - Faster (no DOM waiting)
   - Complete data in one response
   - No multiple DOM queries

3. **Completeness**
   - Gets all requested fields
   - Includes related records
   - Formula fields pre-calculated

4. **Maintainability**
   - Less code (no complex selectors)
   - Easier to debug (JSON structure)
   - Clear data flow

### ⚠️ Disadvantages

1. **API Dependency**
   - Relies on Salesforce API structure
   - May change (though less likely than DOM)
   - Need to handle API errors

2. **Performance Overhead**
   - Intercepts all fetch calls (needs filtering)
   - Response cloning (memory)
   - JSON parsing (CPU)

3. **Incomplete Data**
   - May miss fields not in API request
   - Related list data not included
   - Custom component data not included

4. **Implementation Complexity**
   - Need to patch fetch early
   - Handle response cloning
   - Manage async processing

---

## Recommendations

### ✅ Primary Recommendation: Hybrid Approach

**Use fetch interception as primary source, DOM extraction as fallback:**

1. **Fetch Interceptor (Primary)**
   - Intercept API calls
   - Extract structured data
   - Store in global state
   - Dispatch events

2. **DOM Extraction (Fallback/Validation)**
   - Use when API data unavailable
   - Validate API data against DOM
   - Extract fields not in API
   - Handle related lists

3. **Unified Interface**
   - Single `CaseDataExtractor.extractCaseData()` method
   - Automatically chooses best source
   - Merges data when needed

### Implementation Priority

1. **High Priority:**
   - Implement basic fetch interception
   - Extract core fields (CaseNumber, Subject, Description)
   - Integrate with existing `CaseDataExtractor`

2. **Medium Priority:**
   - Complete field extraction
   - Handle nested records
   - Add validation layer

3. **Low Priority:**
   - Performance optimization
   - Advanced error handling
   - Multiple API endpoint support

### Migration Strategy

1. **Phase 1:** Add fetch interceptor alongside DOM extraction
2. **Phase 2:** Use API data when available, fallback to DOM
3. **Phase 3:** Validate API data against DOM (logging only)
4. **Phase 4:** Make API primary, DOM fallback only
5. **Phase 5:** Remove DOM extraction if API proves reliable

---

## Risk Assessment

### Low Risk ✅
- Technical feasibility
- Manifest V3 compatibility
- Performance impact (with proper filtering)

### Medium Risk ⚠️
- API structure changes
- Missing fields in API response
- Response cloning overhead

### Mitigation Strategies

1. **API Structure Changes:**
   - Monitor for changes
   - Version detection
   - Fallback to DOM

2. **Missing Fields:**
   - Hybrid approach
   - DOM extraction for missing fields
   - Validation layer

3. **Performance:**
   - Aggressive URL filtering
   - Debouncing
   - Response size limits

---

## Conclusion

**Fetch interception is a viable and recommended approach** that should be implemented as the **primary data source** with DOM extraction as a **fallback and validation mechanism**.

**Key Benefits:**
- More reliable than DOM scraping
- Faster data access
- Complete structured data
- Easier to maintain

**Implementation:**
- Start with basic interception
- Gradually migrate to primary source
- Keep DOM extraction as fallback
- Monitor and validate

**Next Steps:**
1. Create `modules/fetchInterceptor.js`
2. Update `manifest.json` to load at `document_start`
3. Implement basic field extraction
4. Integrate with existing `CaseDataExtractor`
5. Test and validate against DOM extraction

---

## References

- [Chrome Extension Manifest V3 - Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Salesforce Lightning Aura Framework](https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/intro_framework.htm)
- Example code provided by user (fetch interception pattern)

---

**Document Status:** Ready for Implementation  
**Last Updated:** 2025-01-23

