# Cache and Global State Integration Plan

## Overview

This plan addresses how caching best practices integrate with global variables, validation strategies for case identifiers, and extraction patterns for data integrity in SPA environments.

## 1. Cache and Global Variable Integration Strategy

### 1.1 When to Use Global Variables vs Cache

#### Use Global Variables For:
- **Current Page State** (immediate, session-only)
  - Current case ID being viewed
  - Current page type
  - Navigation state
  - UI state (panels open, selections made)
  
- **Temporary Processing State**
  - Data being extracted (before validation)
  - Extraction in progress flags
  - Module initialization state

- **Fast Access Requirements**
  - Data needed immediately without async operations
  - Data that changes frequently (every navigation)
  - Data that doesn't need persistence

#### Use Cache For:
- **Validated, Complete Data** (persistent, cross-session)
  - Fully extracted and validated case data
  - Data that has passed integrity checks
  - Data that should persist across page refreshes
  - Data that requires signature validation

### 1.2 Integration Pattern: Global State → Cache Pipeline

```javascript
// ✅ GOOD: Two-tier system
window.ExLibrisExtension = {
  // Tier 1: Global State (immediate, session-only)
  currentCaseId: null,
  currentPage: null,
  isExtracting: false,
  
  // Tier 2: Validated Data (persistent cache)
  caseToolkit: {
    caseData: null,  // From cache or extraction
    metadata: null,
    prepared: false
  }
};

// Flow:
// 1. Global state updated immediately on navigation
// 2. Cache checked for validated data
// 3. If cache miss, extract → validate → cache → update global
```

### 1.3 When NOT to Use Global Variables with Cache

**Don't Use Global Variables When:**
- Data needs to persist across browser sessions
- Data requires signature validation
- Multiple tabs need synchronized state
- Data integrity must be guaranteed

**Use Cache Instead When:**
- Data has been validated and normalized
- Data needs to survive page refreshes
- Data should be shared across extension contexts
- Data requires version/signature tracking

## 2. Case ID and Case Number Validation Strategy

### 2.1 Dual Identifier Validation

**Principle:** Both case ID and case number must be validated and match the data set.

```javascript
/**
 * Validates that case ID, case number, and data are consistent
 */
function validateCaseIdentifiers(caseId, caseNumber, data) {
  const errors = [];
  
  // 1. Validate case ID format
  if (!caseId || !/^[a-zA-Z0-9]{15,18}$/.test(caseId)) {
    errors.push('Invalid case ID format');
  }
  
  // 2. Validate case number format (typically 8 digits)
  if (!caseNumber || !/^\d{6,10}$/.test(caseNumber)) {
    errors.push('Invalid case number format');
  }
  
  // 3. Validate data contains matching identifiers
  if (data.caseId && data.caseId !== caseId) {
    errors.push(`Data case ID mismatch: ${data.caseId} !== ${caseId}`);
  }
  
  if (data.caseNumber && data.caseNumber !== caseNumber) {
    errors.push(`Data case number mismatch: ${data.caseNumber} !== ${caseNumber}`);
  }
  
  // 4. Validate identifiers match current page
  const currentCaseId = extractCaseIdFromUrl();
  const currentCaseNumber = extractCaseNumberFromPage();
  
  if (caseId !== currentCaseId) {
    errors.push(`Case ID mismatch with current page: ${caseId} !== ${currentCaseId}`);
  }
  
  if (caseNumber !== currentCaseNumber) {
    errors.push(`Case number mismatch with current page: ${caseNumber} !== ${currentCaseNumber}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 2.2 Verification Strategy: Multi-Source Validation

**Principle:** Verify identifiers from multiple sources to ensure data integrity.

```javascript
/**
 * Verifies case identifiers from multiple sources
 */
function verifyCaseIdentifiers(data) {
  const verifications = {
    urlCaseId: extractCaseIdFromUrl(),
    urlCaseNumber: extractCaseNumberFromUrl(), // If available in URL
    domCaseId: extractCaseIdFromDOM(),
    domCaseNumber: extractCaseNumberFromDOM(),
    dataCaseId: data.caseId,
    dataCaseNumber: data.caseNumber
  };
  
  // Build consensus
  const caseIdConsensus = [
    verifications.urlCaseId,
    verifications.domCaseId,
    verifications.dataCaseId
  ].filter(Boolean);
  
  const caseNumberConsensus = [
    verifications.urlCaseNumber,
    verifications.domCaseNumber,
    verifications.dataCaseNumber
  ].filter(Boolean);
  
  // Check if all sources agree
  const caseIdMatches = new Set(caseIdConsensus).size === 1;
  const caseNumberMatches = new Set(caseNumberConsensus).size === 1;
  
  if (!caseIdMatches) {
    console.warn('[Validation] Case ID mismatch across sources:', caseIdConsensus);
    return { valid: false, reason: 'Case ID mismatch' };
  }
  
  if (!caseNumberMatches) {
    console.warn('[Validation] Case number mismatch across sources:', caseNumberConsensus);
    return { valid: false, reason: 'Case number mismatch' };
  }
  
  return {
    valid: true,
    caseId: caseIdConsensus[0],
    caseNumber: caseNumberConsensus[0],
    confidence: 'high' // All sources agree
  };
}
```

### 2.3 Data-Identifier Binding Verification

**Principle:** Ensure the data set truly belongs to the claimed identifiers.

```javascript
/**
 * Verifies that data set matches the identifiers it claims
 */
function verifyDataIdentifierBinding(caseId, caseNumber, data) {
  // 1. Check data contains identifiers
  if (!data.caseId || !data.caseNumber) {
    return { valid: false, reason: 'Data missing identifiers' };
  }
  
  // 2. Check identifiers match
  if (data.caseId !== caseId) {
    return { valid: false, reason: 'Data case ID mismatch' };
  }
  
  if (data.caseNumber !== caseNumber) {
    return { valid: false, reason: 'Data case number mismatch' };
  }
  
  // 3. Verify data consistency (check immutable fields)
  const signatureFields = [
    data.status,
    data.category,
    data.subCategory,
    data.analysisNote
  ].filter(Boolean);
  
  if (signatureFields.length === 0) {
    return { valid: false, reason: 'Data missing signature fields' };
  }
  
  // 4. Cross-reference with DOM (if still on same page)
  const currentCaseId = extractCaseIdFromUrl();
  if (currentCaseId === caseId) {
    const domSignature = buildSignatureFromDOM();
    const dataSignature = buildSignatureFromData(data);
    
    if (domSignature !== dataSignature) {
      return { 
        valid: false, 
        reason: 'Data signature mismatch with current page',
        domSignature,
        dataSignature
      };
    }
  }
  
  return { valid: true };
}
```

## 3. Cache Entry Acceptance Criteria

### 3.1 Pre-Cache Validation Checklist

**A cache entry should ONLY be accepted if ALL of the following are true:**

1. ✅ **Case ID Validation**
   - Format is valid (15-18 alphanumeric characters)
   - Matches current page case ID
   - Matches data.caseId (if present)

2. ✅ **Case Number Validation**
   - Format is valid (6-10 digits)
   - Matches current page case number
   - Matches data.caseNumber (if present)

3. ✅ **Data Integrity**
   - Contains minimum required fields (caseNumber OR subject OR status)
   - Data.caseId matches provided caseId
   - Data.caseNumber matches provided caseNumber

4. ✅ **Page State Validation**
   - Still on the same case page (not navigated away)
   - DOM state matches data signature
   - No concurrent extraction in progress

5. ✅ **Identifier Consensus**
   - URL, DOM, and data all agree on case ID
   - URL, DOM, and data all agree on case number
   - No conflicting identifiers

### 3.2 Cache Acceptance Function

```javascript
/**
 * Determines if a cache entry/request should be accepted
 */
async function shouldAcceptCacheEntry(caseId, caseNumber, data) {
  // Step 1: Basic format validation
  if (!isValidCaseIdFormat(caseId)) {
    console.warn('[Cache] Invalid case ID format:', caseId);
    return { accept: false, reason: 'Invalid case ID format' };
  }
  
  if (!isValidCaseNumberFormat(caseNumber)) {
    console.warn('[Cache] Invalid case number format:', caseNumber);
    return { accept: false, reason: 'Invalid case number format' };
  }
  
  // Step 2: Verify identifiers from multiple sources
  const verification = verifyCaseIdentifiers(data);
  if (!verification.valid) {
    console.warn('[Cache] Identifier verification failed:', verification.reason);
    return { accept: false, reason: verification.reason };
  }
  
  // Step 3: Validate data-identifier binding
  const bindingCheck = verifyDataIdentifierBinding(caseId, caseNumber, data);
  if (!bindingCheck.valid) {
    console.warn('[Cache] Data-identifier binding failed:', bindingCheck.reason);
    return { accept: false, reason: bindingCheck.reason };
  }
  
  // Step 4: Check page state (still on same case)
  const currentCaseId = extractCaseIdFromUrl();
  if (currentCaseId !== caseId) {
    console.warn('[Cache] Navigated away from case:', caseId);
    return { accept: false, reason: 'Navigation detected' };
  }
  
  // Step 5: Check for concurrent operations
  if (extractionLocks.has(caseId)) {
    console.warn('[Cache] Extraction in progress for case:', caseId);
    return { accept: false, reason: 'Concurrent extraction' };
  }
  
  // All checks passed
  return { accept: true, caseId, caseNumber };
}
```

## 4. Case Data Extraction Best Practices

### 4.1 Extraction Responsibility Model

**Question:** Should extraction modules handle caching, or should other modules?

**Answer:** **Separation of Concerns**

- **Extraction Modules** (CaseDataExtractor, CasePageDataExtractor)
  - ✅ Extract data from DOM
  - ✅ Normalize extracted data
  - ✅ Include case ID and case number in extracted data
  - ❌ Should NOT handle caching directly
  - ❌ Should NOT validate cache entries

- **CaseContextWatcher + CaseDataStore**
  - ✅ Validate identifiers (head-derived)
  - ✅ Keep a single in-memory payload per tab
  - ✅ Notify subscribers (banner, panel, controller)
  - ❌ No chrome.storage writes
  - ❌ No multi-case caching

- **Controller/Orchestrator** (content_script_exlibris.js)
  - ✅ Coordinate extraction and caching
  - ✅ Update global state
  - ✅ Handle navigation events
  - ✅ Manage extraction locks

### 4.2 Extraction Pattern: Extract → Validate → Cache

```javascript
/**
 * Recommended extraction and caching flow
 */
async function extractAndStoreCaseData(caseId) {
  // Step 1: Wait for head confirmation
  const context = await CaseContextWatcher.getStableContext({ requireCase: true });
  if (!context || context.caseId !== caseId) {
    console.warn('[Extraction] Context mismatch, aborting');
    return null;
  }

  window.ExLibrisExtension.currentCaseId = caseId;
  window.ExLibrisExtension.isExtracting = true;
  
  try {
    // Step 2: Extract data (extraction module responsibility)
    const rawData = await CaseDataExtractor.getData({ force: true });
    
    // Step 3: Verify identifiers against watcher context
    const verification = verifyCaseIdentifiers({
      ...rawData,
      caseId: context.caseId,
      caseNumber: rawData.caseNumber || context.caseNumber
    });
    
    if (!verification.valid) {
      console.error('[Extraction] Identifier verification failed:', verification.reason);
      return null;
    }
    
    // Step 4: Normalize payload
    const normalizedData = {
      ...rawData,
      caseId: verification.caseId,
      caseNumber: verification.caseNumber,
      extractedAt: Date.now()
    };
    
    // Step 5: Store in CaseDataStore (single-entry, in-memory)
    await CaseDataStore.setCurrentData(normalizedData, 'extractAndStoreCaseData');
    
    // Step 6: Update in-memory toolkit for backwards compatibility
    window.ExLibrisExtension.caseToolkit.caseData = normalizedData;
    window.ExLibrisExtension.caseToolkit.prepared = false;
    
    return normalizedData;
    
  } catch (error) {
    console.error('[Extraction] Error during extraction:', error);
    return null;
  } finally {
    window.ExLibrisExtension.isExtracting = false;
  }
}
```

### 4.3 Extraction Module Requirements

**Extraction modules MUST:**

1. **Include Identifiers in Extracted Data**
   ```javascript
   extractCaseData() {
     return {
       caseId: this.getCaseIdFromUrl(),      // MUST include
       caseNumber: this.getCaseNumber(),      // MUST include
       // ... other fields
     };
   }
   ```

2. **Extract from Multiple Sources (with fallbacks)**
   ```javascript
   getCaseNumber() {
     // Try multiple sources
     const fromHeader = this.getCaseNumberFromHeader();
     const fromDOM = this.getCaseNumberFromDOM();
     const fromTitle = this.getCaseNumberFromTitle();
     
     // Return first valid value
     return fromHeader || fromDOM || fromTitle || null;
   }
   ```

3. **Normalize Data Format**
   ```javascript
   normalizeCaseNumber(caseNumber) {
     if (!caseNumber) return null;
     // Remove whitespace, ensure format
     return caseNumber.trim().replace(/\D/g, '');
   }
   ```

4. **Handle Extraction Errors Gracefully**
   ```javascript
   async getData() {
     try {
       const data = this.extractCaseData();
       if (!data.caseId || !data.caseNumber) {
         throw new Error('Missing required identifiers');
       }
       return await this.processData(data);
     } catch (error) {
       console.error('[Extractor] Extraction failed:', error);
       return null; // Don't return partial data
     }
   }
   ```

### 4.4 What Extraction Modules Should NOT Do

**Extraction modules should NOT:**

- ❌ Bypass `CaseContextWatcher` (never trust DOM before it resolves)
- ❌ Write directly to `chrome.storage`
- ❌ Maintain their own caches
- ❌ Manage UI/global state (beyond returning data)
- ❌ Assume persistence across cases (CaseDataStore is per-tab/per-case)

## 5. Complete Integration Pattern

### 5.1 Global State + Cache Integration

```javascript
/**
 * Complete pattern: Global state + CaseDataStore integration
 */
const ExLibrisExtension = {
  currentCaseId: null,
  currentCaseNumber: null,
  currentPage: null,
  isExtracting: false,
  
  caseToolkit: {
    caseData: null,
    metadata: null,
    prepared: false
  },
  
  async getCaseData(caseId, options = {}) {
    const { forceRefresh = false } = options;
    
    // Step 1: Wait for CaseContextWatcher
    const context = await CaseContextWatcher.getStableContext({ requireCase: true });
    if (!context || context.caseId !== caseId) {
      throw new Error('Case context mismatch');
    }
    
    this.currentCaseId = context.caseId;
    this.currentCaseNumber = context.caseNumber;
    
    // Step 2: Reuse CaseDataStore if possible
    if (!forceRefresh) {
      const stored = CaseDataStore.getCurrentData();
      if (stored && stored.caseId === caseId) {
        this.caseToolkit.caseData = stored;
        return stored;
      }
    }
    
    // Step 3: Extract fresh data
    this.isExtracting = true;
    try {
      const rawData = await CaseDataExtractor.getData({ force: true });
      const verification = verifyCaseIdentifiers({
        ...rawData,
        caseId: context.caseId,
        caseNumber: rawData.caseNumber || context.caseNumber
      });
      
      if (!verification.valid) {
        throw new Error(`Identifier verification failed: ${verification.reason}`);
      }
      
      const normalized = {
        ...rawData,
        caseId: verification.caseId,
        caseNumber: verification.caseNumber,
        extractedAt: Date.now()
      };
      
      await CaseDataStore.setCurrentData(normalized, 'getCaseData');
      this.caseToolkit.caseData = normalized;
      return normalized;
    } finally {
      this.isExtracting = false;
    }
  }
};
```

## 6. Implementation Checklist

### Phase 1: Validation Infrastructure
- [ ] Implement `validateCaseIdentifiers()` function
- [ ] Implement `verifyCaseIdentifiers()` function
- [ ] Implement `verifyDataIdentifierBinding()` function
- [ ] Implement `shouldAcceptCacheEntry()` function

### Phase 2: Extraction Module Updates
- [ ] Ensure all extractors include caseId and caseNumber
- [ ] Add multi-source extraction with fallbacks
- [ ] Add data normalization
- [ ] Remove direct cache calls from extractors

### Phase 3: Cache Manager Updates
- [ ] Add identifier validation to `set()` method
- [ ] Add case number validation
- [ ] Add data-identifier binding verification
- [ ] Update `get()` to validate case number

### Phase 4: Global State Integration
- [ ] Update global state structure
- [ ] Implement two-tier system (global + cache)
- [ ] Add navigation state checking
- [ ] Implement extraction locking

### Phase 5: Controller Updates
- [ ] Update `getCaseData()` to use new pattern
- [ ] Add identifier verification step
- [ ] Add cache validation step
- [ ] Update global state on cache hits

## 7. Key Takeaways

1. **Global Variables**: Use for immediate, session-only state
2. **Cache**: Use for validated, persistent data
3. **Dual Validation**: Always validate both case ID and case number
4. **Multi-Source Verification**: Verify identifiers from URL, DOM, and data
5. **Separation of Concerns**: Extractors extract, CaseContextWatcher/CaseDataStore guard state, controller orchestrates
6. **Identifier Consensus**: All sources must agree before caching
7. **Data Binding**: Verify data truly belongs to claimed identifiers
8. **Navigation Awareness**: Always check if still on correct page

