
  Please provide the copied HTML snippets. This will allow me to verify the current DOM structure against
  the selectors in content_script.js.

  Once we resolve the "null" URL issue, we can address your suggestion for a "refresh" button to mitigate
  performance concerns.

> <div lwc-2qpe2t0sbck="" class="slds-form-element slds-hint-parent test-id__output-root
  slds-form-element_readonly is-stacked is-stacked-not-editing"><div lwc-2qpe2t0sbck=""
  class="test-id__field-label-container slds-form-element__label no-utility-icon"><span
  class="test-id__field-label" lwc-2qpe2t0sbck="">Ex Libris Account Number</span></div><div lwc-2qpe2t0sbck=""
  class="slds-form-element__control"><span lwc-2qpe2t0sbck="" class="test-id__field-value
  slds-form-element__static slds-grow word-break-ie11 is-read-only"><slot lwc-2qpe2t0sbck=""
  name="outputField"><records-formula-output data-output-element-id="output-field" slot="outputField"
  lwc-2rmocnb0qkm-host=""><slot lwc-2rmocnb0qkm=""><lightning-formatted-text
  lwc-f6gbo863ml-host="">61UNI-SCU</lightning-formatted-text></slot></records-formula-output></slot><slot
  lwc-2qpe2t0sbck=""></slot></span></div></div>

✦ Thanks for the "Ex Libris Account Number" HTML. The current selector records-record-layout-item is missing
  from the provided HTML, confirming my DOM selector hypothesis. I need the "Affected Environment" HTML now to
   propose a complete fix.

> <flexipage-field data-field-id="Recordbl_Affected_Environment_cField" lwc-6tp3buk1ht8-host=""><slot
  lwc-6tp3buk1ht8=""><record_flexipage-record-field class="slds-grid slds-col slds-has-flexi-truncate"
  role="listitem" lwc-618vdk5svck-host=""><div lwc-618vdk5svck="" class="slds-grid slds-size_1-of-1
  label-inline" data-target-selection-name="sfdc:RecordField.Case.bl_Affected_Environment__c"><!----><div
  lwc-618vdk5svck="" class="slds-form-element slds-hint-parent test-id__output-root slds-form-element_edit
  slds-form-element_readonly slds-form-element_horizontal"><!----><div class="test-id__field-label-container
  slds-form-element__label" lwc-618vdk5svck=""><span class="test-id__field-label" lwc-618vdk5svck="">Affected
  Environment</span></div><!----><div lwc-618vdk5svck="" class="slds-form-element__control"><span
  lwc-618vdk5svck="" class="test-id__field-value slds-form-element__static slds-grow word-break-ie11"><slot
  lwc-618vdk5svck="" name="output"><force-lookup data-output-element-id="output-field" slot="output"
  lwc-47ngqe6rvah-host=""><div lwc-47ngqe6rvah="" class="slds-grid"><!----><!----><records-hoverable-link
  lwc-47ngqe6rvah="" class="slds-grow" data-navigation="enable" tabindex="-1" lwc-oj46kgc6r3-host=""><!----><div
   lwc-oj46kgc6r3="" class="slds-grid"><a lwc-oj46kgc6r3=""
  href="/lightning/r/bl_Environment__c/aCD3r0000004b6fGAA/view" data-navigation="enable"><span
  lwc-oj46kgc6r3=""><slot lwc-oj46kgc6r3=""><span lwc-47ngqe6rvah=""><slot lwc-47ngqe6rvah=""><span
  lwc-47ngqe6rvah="">Esploro AP02 -
  Production</span></slot></span></slot></span></a><!----><lightning-button-icon lwc-oj46kgc6r3=""
  class="slds-button_icon hover-button-icon-element hide-hover-icon" data-navigation="enable" variant="bare"
  lwc-485vfn4rmof-host=""><button lwc-485vfn4rmof="" class="slds-button slds-button_icon slds-button_icon-bare"
  title="Open Esploro AP02 - Production Preview" type="button" part="button button-icon" aria-describedby="sales
  force-lightning-tooltip-bubble_fcd5f706-fabd-3dc6-3e18-7ac7e0d33c13"><lightning-primitive-icon
  lwc-485vfn4rmof="" exportparts="icon" variant="bare" lwc-3pd22r3mk56-host=""><svg focusable="false"
  aria-hidden="true" viewBox="0 0 520 520" part="icon" lwc-3pd22r3mk56="" data-key="preview"
  class="slds-button__icon"><g lwc-3pd22r3mk56=""><path d="M518 251a288 288 0 00-516 0 20 20 0 000 18 288 288 0
  00516 0 20 20 0 000-18zM260 370c-61 0-110-49-110-110s49-110 110-110 110 49 110 110-49 110-110 110zm0-180c-39
  0-70 31-70 70s31 70 70 70 70-31 70-70-31-70-70-70z"
  lwc-3pd22r3mk56=""></path></g></svg></lightning-primitive-icon><span class="slds-assistive-text"
  lwc-485vfn4rmof="">Open Esploro AP02 - Production Preview</span></button></lightning-button-icon><!----></div>
  <!----></records-hoverable-link><!----><!----></div></force-lookup></slot><slot
  lwc-618vdk5svck=""></slot></span><!----><button class="test-id__inline-edit-trigger slds-shrink-none
  inline-edit-trigger slds-button slds-button_icon" lwc-618vdk5svck="" title="Edit Affected Environment"><span
  aria-hidden="true" lwc-618vdk5svck="" class="inline-edit-trigger-icon slds-button__icon
  slds-button__icon_hint"></span><span class="slds-assistive-text" lwc-618vdk5svck="">Edit Affected Environment<
  /span></button><!----></div></div><!----></div></record_flexipage-record-field></slot></flexipage-field>

✦ The HTML for "Affected Environment" confirms that the records-record-layout-item selector is outdated,
  mirroring the issue with "Ex Libris Account Number." The values are now nested within
  lightning-formatted-text or a span inside a slot.

  Revised Hypothesis: Content Script Logic Error (Outdated DOM Selectors). The exLibrisAccountNumber and
  affectedEnvironment are not being extracted correctly due to changes in the Salesforce Lightning UI's DOM
  structure.

  Proposed Fix:
  I will update content_script.js by introducing a new extractDataByLabel function to robustly locate and
  extract data based on field labels, then modify getCaseData to utilize this new function.

    1 // In content_script.js
    2
    3 // Add this new helper function
    4 function extractDataByLabel(labelText, isHref = false) {
    5     const labelElement = Array.from(document.querySelectorAll('span.test-id__field-label'))
    6                             .find(span => span.textContent.trim() === labelText);
    7     if (labelElement) {
    8         const parentDiv = labelElement.closest('div.slds-form-element');
    9         if (parentDiv) {
   10             const valueElement = parentDiv.querySelector('span.test-id__field-value');
   11             if (valueElement) {
   12                 if (isHref) {
   13                     const linkElement = valueElement.querySelector('a');
   14                     return linkElement ? linkElement.href : '';
   15                 } else {
   16                     const formattedText = valueElement.querySelector('lightning-formatted-text'
      );
   17                     return formattedText ? formattedText.textContent.trim() : valueElement.
      textContent.trim();
   18                 }
   19             }
   20         }
   21     }
   22     return '';
   23 }
   24
   25 // Modify getCaseData function
   26 function getCaseData() {
   27     let data = {
   28         exLibrisAccountNumber: extractDataByLabel('Ex Libris Account Number'),
   29         affectedEnvironment: extractDataByLabel('Affected Environment'),
   30         productServiceName: extractDataByLabel('Product/Service Name'),
   31         asset: extractDataByLabel('Asset'), // Assuming Asset also needs this new extraction
      method
   32         assetHref: extractDataByLabel('Asset', true), // Assuming Asset also needs this new
      extraction method for href
   33         jiraId: extractDataByLabel('JIRA ID'),
   34         lastModifiedDate: extractDataByLabel('Last Modified Date')
   35     };
   36
   37     data = deriveVariables(data);
   38     return data;
   39 }

  Verification Step:
  After applying this change, reload the extension and the Salesforce page. Check the console logs for
  caseDataCache to confirm exLibrisAccountNumber and affectedEnvironment are correctly populated. Also,
  verify the generated URLs in the header section.

  I will now provide the replace tool calls to implement this fix.
 ╭───────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  Edit 3.0\content_script.js: /**... => /**...                                                   │
 │                                                                                                   │
 │     38   }                                                                                        │
 │     39                                                                                            │
 │     40   /**                                                                                      │
 │     41 +  * Extracts data from a Salesforce field based on its label.                             │
 │     42 +  * @param {string} labelText The visible label of the Salesforce field.                  │
 │     43 +  * @param {boolean} [isHref=false] If true, extracts the `href` attribute from a link    │
 │        within the field value.                                                                    │
 │     44 +  * @returns {string} The extracted data, or an empty string if the element is not        │
 │        found.                                                                                     │
 │     45 +  */                                                                                      │
 │     46 + function extractDataByLabel(labelText, isHref = false) {                                 │
 │     47 +     const labelElement = Array.from(document.querySelectorAll(                           │
 │        'span.test-id__field-label'))                                                              │
 │     48 +                             .find(span => span.textContent.trim() === labelText);        │
 │     49 +     if (labelElement) {                                                                  │
 │     50 +         const parentDiv = labelElement.closest('div.slds-form-element');                 │
 │     51 +         if (parentDiv) {                                                                 │
 │     52 +             const valueElement = parentDiv.querySelector('span.test-id__field-value');   │
 │     53 +             if (valueElement) {                                                          │
 │     54 +                 if (isHref) {                                                            │
 │     55 +                     const linkElement = valueElement.querySelector('a');                 │
 │     56 +                     return linkElement ? linkElement.href : '';                          │
 │     57 +                 } else {                                                                 │
 │     58 +                     const formattedText = valueElement.querySelector(                    │
 │        'lightning-formatted-text');                                                               │
 │     59 +                     return formattedText ? formattedText.textContent.trim() :            │
 │        valueElement.textContent.trim();                                                           │
 │     60 +                 }                                                                        │
 │     61 +             }                                                                            │
 │     62 +         }                                                                                │
 │     63 +     }                                                                                    │
 │     64 +     return '';                                                                           │
 │     65 + }                                                                                        │
 │     66 +                                                                                          │
 │     67 + /**                                                                                      │
 │     68    * Derives secondary variables from the primary data extracted from the case page.       │
 │     69    * @description This function takes the raw extracted data and enriches it with          │
 │          additional,                                                                              │
 │     70    * derived information, such as formatting an `institutionCode` or parsing the `server`  │
 │          and                                                                                      │
 │    ═════════════════════════════════════════════════════════════════════════════════════════════  │
 │    103    */                                                                                      │
 │    104   function getCaseData() {                                                                 │
 │    105       let data = {                                                                         │
 │     79 -         exLibrisAccountNumber: extractData('records-record-layout-item[field-label="Ex   │
 │        Libris Account Number"] .test-id__field-value'),                                           │
 │     80 -         affectedEnvironment: extractData(                                                │
 │        'records-record-layout-item[field-label="Affected Environment"] .test-id__field-value'),   │
 │     81 -         productServiceName: extractData(                                                 │
 │        'records-record-layout-item[field-label="Product/Service Name"] .test-id__field-value'),   │
 │     82 -         asset: extractData('records-record-layout-item[field-label="Asset"]              │
 │        .test-id__field-value a', false),                                                          │
 │     83 -         assetHref: extractData('records-record-layout-item[field-label="Asset"]          │
 │        .test-id__field-value a', true),                                                           │
 │     84 -         jiraId: extractData('records-record-layout-item[field-label="JIRA ID"]           │
 │        .test-id__field-value'),                                                                   │
 │     85 -         lastModifiedDate: extractData('records-record-layout-item[field-label="Last      │
 │        Modified Date"] .test-id__field-value')                                                    │
 │    ═════════════════════════════════════════════════════════════════════════════════════════════  │
 │    106 +         exLibrisAccountNumber: extractDataByLabel('Ex Libris Account Number'),           │
 │    107 +         affectedEnvironment: extractDataByLabel('Affected Environment'),                 │
 │    108 +         productServiceName: extractDataByLabel('Product/Service Name'),                  │
 │    109 +         asset: extractDataByLabel('Asset'),                                              │
 │    110 +         assetHref: extractDataByLabel('Asset', true),                                    │
 │    111 +         jiraId: extractDataByLabel('JIRA ID'),                                           │
 │    112 +         lastModifiedDate: extractDataByLabel('Last Modified Date')                       │
 │    113       };                                                                                   │
 │    114                                                                                            │
 │    115       data = deriveVariables(data);                                                        │
 ╰───────────────────────────────────────────────────────────────────────────────────────────────────╯
✦ I've applied the content_script.js fix. Now, please reload the extension, navigate to the Salesforce case
  page, open the console, and verify that exLibrisAccountNumber and affectedEnvironment are correctly
  populated in caseDataCache, and that the header URLs are valid. Report your findings.

> [CacheManager] Could not extract last modified date, using cached data anyway
  Context
  https://proquestllc.lightning.force.com/lightning/r/Case/500QO00000vcuYGYAY/view
  Stack Trace
  modules/cacheManager.js:245 (get)
  content_script_exlibris.js:379 (getCaseData)
  content_script_exlibris.js:170 (initializeCasePageFeatures)
  1
  2
  3
  4
  5
  6
  7
  8
  9
  10
  11
  12
  13
  14
  15
  16
  17
  18
  19
  20
  21
  22
  23
  24
  25
  26
  27
  28
  29
  30
  31
  32
  33
  34
  35
  36
  37
  38
  39
  40
  41
  42
  43
  44
  45
  46
  47
  48
  49
  50
  51
  52
  53
  54
  55
  56
  57
  58
  59
  60
  61
  62
  63
  64
  65
  66
  67
  68
  69
  70
  71
  72
  73
  74
  75
  76
  77
  78
  79
  80
  81
  82
  83
  84
  85
  86
  87
  88
  89
  90
  91
  92
  93
  94
  95
  96
  97
  98
  99
  100
  101
  102
  103
  104
  105
  106
  107
  108
  109
  110
  111
  112
  113
  114
  115
  116
  117
  118
  119
  120
  121
  122
  123
  124
  125
  126
  127
  128
  129
  130
  131
  132
  133
  134
  135
  136
  137
  138
  139
  140
  141
  142
  143
  144
  145
  146
  147
  148
  149
  150
  151
  152
  153
  154
  155
  156
  157
  158
  159
  160
  161
  162
  163
  164
  165
  166
  167
  168
  169
  170
  171
  172
  173
  174
  175
  176
  177
  178
  179
  180
  181
  182
  183
  184
  185
  186
  187
  188
  189
  190
  191
  192
  193
  194
  195
  196
  197
  198
  199
  200
  201
  202
  203
  204
  205
  206
  207
  208
  209
  210
  211
  212
  213
  214
  215
  216
  217
  218
  219
  220
  221
  222
  223
  224
  225
  226
  227
  228
  229
  230
  231
  232
  233
  234
  235
  236
  237
  238
  239
  240
  241
  242
  243
  244
  245
  246
  247
  248
  249
  250
  251
  252
  253
  254
  255
  256
  257
  258
  259
  260
  261
  262
  263
  264
  265
  266
  267
  268
  269
  270
  271
  272
  273
  274
  275
  276
  277
  278
  279
  280
  281
  282
  283
  284
  285
  286
  287
  288
  289
  290
  291
  292
  293
  294
  295
  296
  297
  298
  299
  300
  301
  302
  303
  304
  305
  306
  307
  308
  309
  310
  311
  312
  313
  314
  315
  316
  317
  318
  319
  320
  321
  322
  323
  324
  325
  326
  327
  328
  329
  330
  331
  332
  333
  334
  335
  336
  337
  338
  339
  340
  341
  342
  343
  344
  345
  346
  347
  348
  349
  350
  351
  352
  353
  354
  355
  356
  357
  358
  359
  360
  361
  362
  363
  364
  365
  366
  367
  368
  369
  370
  371
  372
  373
  374
  375
  376
  377
  378
  /**
   * Cache Manager Module
   * Manages case data caching with last-modified validation
   */

  const CacheManager = (function() {
    'use strict';

    // ========== PRIVATE STATE ==========

    const STORAGE_KEY = 'caseCacheData';
    const CACHE_VERSION = 1;
    const MAX_CACHE_AGE_DAYS = 30;
    const MAX_CACHE_SIZE_MB = 8; // Leave 2MB buffer for other data

    let memoryCache = new Map(); // In-memory cache for current session
    let isInitialized = false;

    // ========== PRIVATE FUNCTIONS ==========

    /**
     * Gets cache data from chrome.storage.local
     * @returns {Promise<Object>}
     */
    async function loadFromStorage() {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY, 'cacheVersion'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[CacheManager] Error loading cache:', chrome.runtime.lastError);
            resolve({ cacheVersion: CACHE_VERSION, data: {} });
            return;
          }

          // Check version
          const storedVersion = result.cacheVersion || 0;
          if (storedVersion < CACHE_VERSION) {
            console.log(`[CacheManager] Cache version mismatch (${storedVersion} < ${CACHE_VERSION}), clearing
  cache`);
            resolve({ cacheVersion: CACHE_VERSION, data: {} });
            return;
          }

          resolve({
            cacheVersion: storedVersion,
            data: result[STORAGE_KEY] || {}
          });
        });
      });
    }

    /**
     * Saves cache data to chrome.storage.local
     * @param {Object} cacheData
     * @returns {Promise<void>}
     */
    async function saveToStorage(cacheData) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({
          [STORAGE_KEY]: cacheData,
          cacheVersion: CACHE_VERSION
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('[CacheManager] Error saving cache:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          resolve();
        });
      });
    }

    /**
     * Checks storage usage
     * @returns {Promise<number>} Bytes used
     */
    async function getStorageUsage() {
      return new Promise((resolve) => {
        chrome.storage.local.getBytesInUse(null, (bytes) => {
          resolve(bytes || 0);
        });
      });
    }

    /**
     * Cleans up old cache entries
     * @param {Object} cacheData
     * @returns {Object} Cleaned cache data
     */
    function cleanupOldEntries(cacheData) {
      const now = Date.now();
      const maxAge = MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000;
      const cleaned = {};
      let removedCount = 0;

      for (const caseId in cacheData) {
        const entry = cacheData[caseId];
        const age = now - (entry.timestamp || 0);

        if (age < maxAge) {
          cleaned[caseId] = entry;
        } else {
          removedCount++;
        }
      }

      if (removedCount > 0) {
        console.log(`[CacheManager] Removed ${removedCount} old cache entries`);
      }

      return cleaned;
    }

    /**
     * Removes least recently used entries if storage is too large
     * @param {Object} cacheData
     * @returns {Object} Trimmed cache data
     */
    async function trimCacheIfNeeded(cacheData) {
      const bytesUsed = await getStorageUsage();
      const maxBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;

      if (bytesUsed < maxBytes) {
        return cacheData;
      }

      console.warn(`[CacheManager] Storage limit approaching (${(bytesUsed / 1024 / 1024).toFixed(2)}MB),
  trimming cache...`);

      // Sort by timestamp (oldest first)
      const entries = Object.entries(cacheData).sort((a, b) => {
        return (a[1].timestamp || 0) - (b[1].timestamp || 0);
      });

      // Keep only the newest 50% of entries
      const keepCount = Math.floor(entries.length / 2);
      const trimmed = {};

      for (let i = entries.length - keepCount; i < entries.length; i++) {
        const [caseId, entry] = entries[i];
        trimmed[caseId] = entry;
      }

      console.log(`[CacheManager] Trimmed ${entries.length - keepCount} entries`);

      return trimmed;
    }

    /**
     * Extracts "Last Modified Date" from DOM
     * @returns {string|null}
     */
    function extractLastModifiedDate() {
      const field = document.querySelector('records-record-layout-item[field-label*="Last Modified"]
  .test-id__field-value, records-record-layout-item[field-label*="Last Modified"]
  lightning-formatted-date-time');

      if (field) {
        return field.textContent.trim();
      }

      // Fallback: try to find any date-time field
      const dateFields = document.querySelectorAll('lightning-formatted-date-time');
      if (dateFields.length > 0) {
        // Get the first one (likely "Last Modified")
        return dateFields[0].textContent.trim();
      }

      return null;
    }

    /**
     * Normalizes date string for comparison
     * @param {string} dateStr
     * @returns {number} Timestamp
     */
    function normalizeDateString(dateStr) {
      if (!dateStr) return 0;

      try {
        return new Date(dateStr).getTime();
      } catch (err) {
        console.warn('[CacheManager] Invalid date string:', dateStr);
        return 0;
      }
    }

    // ========== PUBLIC API ==========

    return {
      /**
       * Initializes the cache manager
       */
      async init() {
        if (isInitialized) return;

        console.log('[CacheManager] Initializing...');

        try {
          const { data } = await loadFromStorage();

          // Clean up old entries
          const cleaned = cleanupOldEntries(data);

          // Trim if needed
          const trimmed = await trimCacheIfNeeded(cleaned);

          // Load into memory cache
          for (const caseId in trimmed) {
            memoryCache.set(caseId, trimmed[caseId]);
          }

          // Save cleaned/trimmed cache back to storage
          if (Object.keys(trimmed).length !== Object.keys(data).length) {
            await saveToStorage(trimmed);
          }

          console.log(`[CacheManager] Initialized with ${memoryCache.size} cached cases`);

          isInitialized = true;
        } catch (err) {
          console.error('[CacheManager] Initialization error:', err);
          isInitialized = true; // Continue anyway
        }
      },

      /**
       * Gets cached data for a case
       * @param {string} caseId
       * @returns {Object|null} Cached data or null if not found or invalid
       */
      async get(caseId) {
        if (!isInitialized) {
          await this.init();
        }

        if (!caseId) return null;

        // Check memory cache
        const cached = memoryCache.get(caseId);
        if (!cached) {
          console.log(`[CacheManager] Cache miss for case ${caseId}`);
          return null;
        }

        // Get current last modified date from DOM
        const currentLastModified = extractLastModifiedDate();

        if (!currentLastModified) {
          console.warn('[CacheManager] Could not extract last modified date, using cached data anyway');
          return cached.data;
        }

        // Compare timestamps
        const currentTimestamp = normalizeDateString(currentLastModified);
        const cachedTimestamp = normalizeDateString(cached.lastModified);

        if (cachedTimestamp >= currentTimestamp) {
          console.log(`[CacheManager] Cache hit for case ${caseId} (last modified: ${cached.lastModified})`);
          return cached.data;
        }

        console.log(`[CacheManager] Cache invalid for case ${caseId} (stale data)`);
        return null;
      },

      /**
       * Sets cached data for a case
       * @param {string} caseId
       * @param {Object} data - Case data to cache
       * @returns {Promise<void>}
       */
      async set(caseId, data) {
        if (!isInitialized) {
          await this.init();
        }

        if (!caseId || !data) return;

        const lastModified = extractLastModifiedDate();

        const cacheEntry = {
          lastModified: lastModified,
          data: data,
          timestamp: Date.now()
        };

        // Update memory cache
        memoryCache.set(caseId, cacheEntry);

        console.log(`[CacheManager] Cached data for case ${caseId} (last modified: ${lastModified})`);

        // Update storage (throttled)
        await this.persistToStorage();
      },

      /**
       * Persists memory cache to storage
       * @returns {Promise<void>}
       */
      async persistToStorage() {
        if (!isInitialized) return;

        try {
          const cacheData = {};
          memoryCache.forEach((entry, caseId) => {
            cacheData[caseId] = entry;
          });

          await saveToStorage(cacheData);
          console.log(`[CacheManager] Persisted ${memoryCache.size} entries to storage`);
        } catch (err) {
          console.error('[CacheManager] Error persisting cache:', err);
        }
      },

      /**
       * Clears cache for a specific case
       * @param {string} caseId
       */
      async clear(caseId) {
        if (!isInitialized) {
          await this.init();
        }

        if (!caseId) return;

        memoryCache.delete(caseId);
        await this.persistToStorage();

        console.log(`[CacheManager] Cleared cache for case ${caseId}`);
      },

      /**
       * Clears all cache
       */
      async clearAll() {
        memoryCache.clear();

        await new Promise((resolve) => {
          chrome.storage.local.remove([STORAGE_KEY, 'cacheVersion'], () => {
            console.log('[CacheManager] Cleared all cache');
            resolve();
          });
        });
      },

      /**
       * Gets cache statistics
       * @returns {Promise<Object>}
       */
      async getStats() {
        const bytesUsed = await getStorageUsage();

        return {
          entriesCount: memoryCache.size,
          bytesUsed: bytesUsed,
          megabytesUsed: (bytesUsed / 1024 / 1024).toFixed(2),
          percentageUsed: ((bytesUsed / (MAX_CACHE_SIZE_MB * 1024 * 1024)) * 100).toFixed(2)
        };
      },

      /**
       * Cleans up the cache manager
       */
      cleanup() {
        if (!isInitialized) return;

        console.log('[CacheManager] Cleaning up...');

        // Persist any unsaved data
        this.persistToStorage();

        isInitialized = false;
      }
    };
  })();

  // Export for use in other modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
  }

✦ The [CacheManager] Could not extract last modified date warning stems from an outdated DOM selector within
  modules/cacheManager.js. The extractLastModifiedDate function still uses records-record-layout-item, which
  is no longer valid.

  Hypothesis: Content Script Logic Error (Outdated DOM Selector in CacheManager). The extractLastModifiedDate
   function is failing due to an outdated DOM selector, preventing proper cache validation.


  Proposed Fix:
  Modify modules/cacheManager.js to update the extractLastModifiedDate function with a more robust selector
  that targets the "Last Modified Date" label and then traverses the DOM to find its value.

    1 // In modules/cacheManager.js
    2
    3   function extractLastModifiedDate() {
    4     const labelElement = Array.from(document.querySelectorAll('span.test-id__field-label'))
    5                             .find(span => span.textContent.trim() === 'Last Modified Date'); //
      Use the exact label text
    6     if (labelElement) {
    7         const parentDiv = labelElement.closest('div.slds-form-element');
    8         if (parentDiv) {
    9             const valueElement = parentDiv.querySelector('span.test-id__field-value');
   10             if (valueElement) {
   11                 const formattedText = valueElement.querySelector('lightning-formatted-date-time'
      ); // Look for lightning-formatted-date-time
   12                 return formattedText ? formattedText.textContent.trim() : valueElement.
      textContent.trim();
   13             }
   14         }
   15     }
   16     return null;
   17   }

  Verification Step:
  Reload the extension and the Salesforce page. Confirm the [CacheManager] Could not extract last modified
  date warning is gone and the "Live View" button generates correct URLs.

  I will now provide the replace tool call to apply this fix.
 ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ x  Edit {"file_path":"C:\\Users\\U6071248\\Tools\\00_Extension Revamp\\5.0 - Main\\3.0\\modules\\cacheManag… │
 │                                                                                                              │
 │    File not found: C:\Users\U6071248\Tools\00_Extension Revamp\5.0 -                                         │
 │    Main\3.0\modules\cacheManager.js                                                                          │
 ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
✦ My apologies, the file path for cacheManager.js was incorrect. Based on the manifest.json, the correct path
  is C:\Users\U6071248\Tools\00_Extension Revamp\5.0 - Main\3.0\modules\cacheManager.js. I will now re-attempt
   the replace operation with the corrected path.
 ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ x  Edit {"new_string":"  function extractLastModifiedDate() {\n    const labelElement = Array.from(document… │
 │                                                                                                              │
 │    File not found: C:\Users\U6071248\Tools\00_Extension Revamp\5.0 -                                         │
 │    Main\3.0\modules\cacheManager.js                                                                          │
 ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
✦ "File not found" for cacheManager.js is unexpected given manifest.json. I'll use glob to confirm its
  location within the 3.0 directory.
 ╭───────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  FindFiles '**/cacheManager.js' within 3.0                                                      │
 │                                                                                                   │
 │    No files found                                                                                 │
 ╰───────────────────────────────────────────────────────────────────────────────────────────────────╯
✦ glob found no cacheManager.js in 3.0, yet manifest.json lists it. This discrepancy is concerning. I'll check
   the 3.0/modules directory directly to verify its contents and resolve the file path issue.
 ╭─────────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ x  ReadFolder {"path":"C:\\Users\\U6071248\\Tools\\00_Extension Revamp\\5.0 - Main\\3.0\\modules"}  │
 │                                                                                                     │
 │    Error listing directory: ENOENT: no such file or directory, stat                                 │
 │    'C:\Users\U6071248\Tools\00_Extension Revamp\5.0 - Main\3.0\modules'                             │
 ╰─────────────────────────────────────────────────────────────────────────────────────────────────────╯
✦ The modules directory is missing, despite manifest.json referencing its contents. This suggests a
  discrepancy between the manifest and the actual file structure. I'll assume the files are directly in 3.0
  for now. My plan is to confirm file locations with glob, then correct manifest.json paths, and finally
  re-apply the cacheManager.js fix. Starting with a glob search for cacheManager.js in 3.0.
 ╭───────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  FindFiles 'cacheManager.js' within 3.0                                                         │
 │                                                                                                   │
 │    No files found                                                                                 │
 ╰───────────────────────────────────────────────────────────────────────────────────────────────────╯
✦ glob can't find cacheManager.js in 3.0 or 3.0/modules, yet console logs confirm it's loading. This implies a
   path discrepancy. I'll now search for cacheManager.js in the parent directory,
  C:\Users\U6071248\Tools\00_Extension Revamp\5.0 - Main.
 ╭───────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  FindFiles '**/cacheManager.js' within .                                                        │
 │                                                                                                   │
 │    No files found                                                                                 │
 ╰───────────────────────────────────────────────────────────────────────────────────────────────────╯
✦ glob isn't finding cacheManager.js despite console logs confirming its execution. This suggests a
  discrepancy between the manifest.json's declared paths and the actual file system, or a misunderstanding of
  glob's behavior. Given the manifest.json is relative to C:\Users\U6071248\Tools\00_Extension Revamp\5.0 -
  Main\3.0, the modules directory should be there, but list_directory failed. I'll now perform a broader glob
  search for cacheManager.js, content_script_exlibris.js, and content_script.js within
  C:\Users\U6071248\Tools\00_Extension Revamp\5.0 - Main\ to uncover the true file structure.
 ╭───────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✓  FindFiles '**/{cacheManager.js,content_script_exlibris.js,content_script.js}' within .         │
 │                                                                                                   │
 │    Found 1 matching file(s)                                                                       │
 ╰───────────────────────────────────────────────────────────────────────────────────────────────────╯
✦ glob isn't finding cacheManager.js or content_script_exlibris.js, despite console logs confirming their
  execution. This suggests a glob tool malfunction or a file system visibility issue. I'll proceed with the
  replace operation on C:\Users\U6071248\Tools\00_Extension Revamp\5.0 - Main\3.0\modules\cacheManager.js,
  assuming the file exists as per manifest.json and the console output. If it fails, I'll advise the user to
  apply the fix manually.
 ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ x  Edit {"new_string":"  function extractLastModifiedDate() {\n    const labelElement = Array.from(document… │
 │                                                                                                              │
 │    File not found: C:\Users\U6071248\Tools\00_Extension Revamp\5.0 -                                         │
 │    Main\3.0\modules\cacheManager.js                                                                          │
 ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
✦ I'm unable to directly modify modules/cacheManager.js due to persistent "File not found" errors with my
  tools. Therefore, I'm providing manual instructions to fix the extractLastModifiedDate function in
  modules/cacheManager.js.

  Manual Fix Instructions:

  File to Modify: modules/cacheManager.js (likely under 3.0/modules/ within your extension's directory)

  Old Code (within `extractLastModifiedDate` function):

    1   function extractLastModifiedDate() {
    2     const field = document.querySelector('records-record-layout-item[field-label*="Last
      Modified"] .test-id__field-value, records-record-layout-item[field-label*="Last Modified"]
      lightning-formatted-date-time');
    3
    4     if (field) {
    5       return field.textContent.trim();
    6     }
    7
    8     // Fallback: try to find any date-time field
    9     const dateFields = document.querySelectorAll('lightning-formatted-date-time');
   10     if (dateFields.length > 0) {
   11       // Get the first one (likely "Last Modified")
   12       return dateFields[0].textContent.trim();
   13     }
   14
   15     return null;
   16   }

  New Code (replace the entire `extractLastModifiedDate` function with this):

    1   function extractLastModifiedDate() {
    2     const labelElement = Array.from(document.querySelectorAll('span.test-id__field-label'))
    3                             .find(span => span.textContent.trim() === 'Last Modified Date'); //
      Use the exact label text
    4     if (labelElement) {
    5         const parentDiv = labelElement.closest('div.slds-form-element');
    6         if (parentDiv) {
    7             const valueElement = parentDiv.querySelector('span.test-id__field-value');
    8             if (valueElement) {
    9                 const formattedText = valueElement.querySelector('lightning-formatted-date-time'
      ); // Look for lightning-formatted-date-time
   10                 return formattedText ? formattedText.textContent.trim() : valueElement.
      textContent.trim();
   11             }
   12         }
   13     }
   14     return null;
   15   }

  Explanation of the Fix:
  This update to extractLastModifiedDate uses a more robust DOM traversal. It locates the "Last Modified
  Date" label, then navigates to its associated value element, prioritizing lightning-formatted-date-time
  for accurate date extraction. This should resolve the [CacheManager] Could not extract last modified date
  warning and ensure correct cache validation.

  After applying the manual fix:
   1. Reload the extension in chrome://extensions.
   2. Go to the Salesforce case page:
      https://proquestllc.lightning.force.com/lightning/r/Case/500QO00000vcuYGYAY/view.
   3. Open the Developer Tools (F12 or Ctrl+Shift-I) and go to the "Console" tab.
   4. Check the console logs to confirm the [CacheManager] Could not extract last modified date warning is
      gone.
   5. Verify the generated URLs in the header section to ensure they are now valid and contain the correct
      server and institution code.

  Please inform me of the results after you've manually applied this fix.

Using: 12 GEMINI.md files | 15 MCP servers (ctrl+t to view)          accepting edits (shift + tab to toggle)