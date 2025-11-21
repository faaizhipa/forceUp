(function () {
  'use strict';

  if (window.FetchDataCache) {
    return;
  }

  const DEFAULT_FIELD_MAPPING = {
    'Id': 'caseId',
    'CaseNumber': 'caseNumber',
    'Subject': 'subject',
    'Description': 'description',
    'Account.Name': 'accountName',
    'Contact.Name': 'contactName',
    'Owner.Name': 'caseOwner',
    'Platform__c': 'platformService',
    'PQ_Product_Group__c': 'productServiceName',
    'Category__c': 'category',
    'Sub_Category__c': 'subCategory',
    'Status': 'status',
    'Sub_Status__c': 'subStatus',
    'Priority': 'priority',
    'Ex_Libris_Account_Number__c': 'exLibrisAccountNumber',
    'Analysis_Note__c': 'analysisNote',
    'Asset_Line_Item__r.Name': 'asset',
    'bl_Affected_Environment__r.Name': 'affectedEnvironment',
    'ParentId': 'parentCase',
    'ParentCaseOwner__c': 'parentCaseOwner',
    'Escalation__c': 'escalation',
    'CreatedDate': 'caseCreatedDate',
    'ClosedDate': 'caseClosedOn',
    'LastModifiedDate': 'lastModifiedDate',
    'Customer_Display__c': 'pageStatus'
  };

  const FetchDataCache = {
    cache: new Map(),
    fieldMapping: { ...DEFAULT_FIELD_MAPPING },
    isInitialized: false,

    init() {
      if (this.isInitialized) return;
      this.isInitialized = true;
      console.log('[FetchDataCache] Initialized');
    },

    getCacheKey(caseId, caseNumber) {
      if (!caseId && !caseNumber) {
        return null;
      }
      return `${caseId || ''}|${caseNumber || ''}`;
    },

    store(entry) {
      if (!entry || !entry.fields) {
        return;
      }

      const caseId = entry.caseId || entry.id || entry.fields?.Id?.value || entry.fields?.CaseID_18_Character__c?.value || null;
      const caseNumber = entry.caseNumber || entry.fields?.CaseNumber?.value || null;
      const key = this.getCacheKey(caseId, caseNumber);

      if (!key) {
        console.warn('[FetchDataCache] Cannot store API data without caseId or caseNumber');
        return;
      }

      const flatFields = this.flattenFields(entry.fields);
      const normalized = this.mapFields(flatFields, caseId, caseNumber);

      this.cache.set(key, {
        caseId: normalized.caseId || caseId,
        caseNumber: normalized.caseNumber || caseNumber,
        data: normalized,
        flatFields,
        timestamp: Date.now()
      });

      console.log('[FetchDataCache] Stored API data for key:', key);
    },

    get(caseId, caseNumber) {
      // Exact key lookup
      const exactKey = this.getCacheKey(caseId, caseNumber);
      if (exactKey && this.cache.has(exactKey)) {
        return this.cache.get(exactKey)?.data || null;
      }

      // Lookup by caseId
      if (caseId) {
        for (const value of this.cache.values()) {
          if (value.caseId === caseId) {
            return value.data;
          }
        }
      }

      // Lookup by caseNumber
      if (caseNumber) {
        for (const value of this.cache.values()) {
          if (value.caseNumber === caseNumber) {
            return value.data;
          }
        }
      }

      return null;
    },

    clear() {
      this.cache.clear();
      console.log('[FetchDataCache] Cleared cache');
    },

    getStats() {
      return {
        size: this.cache.size,
        keys: Array.from(this.cache.keys())
      };
    },

    flattenFields(fields, parentKey = '', result = {}) {
      if (!fields || typeof fields !== 'object') {
        return result;
      }

      Object.entries(fields).forEach(([key, fieldData]) => {
        if (!fieldData) {
          return;
        }

        const baseKey = parentKey ? `${parentKey}.${key}` : key;
        const hasNestedFields = fieldData.value && typeof fieldData.value === 'object' && fieldData.value.fields;

        if (hasNestedFields) {
          this.flattenFields(fieldData.value.fields, baseKey, result);
          if (fieldData.displayValue && result[baseKey] === undefined) {
            result[baseKey] = fieldData.displayValue;
          }
          return;
        }

        const value = fieldData.value !== null && fieldData.value !== undefined
          ? fieldData.value
          : fieldData.displayValue !== null && fieldData.displayValue !== undefined
            ? fieldData.displayValue
            : null;

        if (value !== null && value !== undefined) {
          result[baseKey] = typeof value === 'string' ? value.trim() : value;
        }
      });

      return result;
    },

    mapFields(flatFields, caseId, caseNumber) {
      const data = {
        caseId: caseId || flatFields.Id || null,
        caseNumber: caseNumber || flatFields.CaseNumber || null
      };

      Object.entries(this.fieldMapping).forEach(([sourceKey, targetKey]) => {
        const value = flatFields[sourceKey];
        if (value !== undefined && value !== null && value !== '') {
          data[targetKey] = value;
        }
      });

      if (!data.pageStatus && data.status) {
        data.pageStatus = data.status;
      }

      return data;
    }
  };

  FetchDataCache.init();
  window.FetchDataCache = FetchDataCache;
  window.ExLibrisExtension = window.ExLibrisExtension || {};
  window.ExLibrisExtension.fetchDataCache = FetchDataCache;
})();

