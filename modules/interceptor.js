(function () {
  // 1. Initialize the Global Object if it doesn't exist
  if (!window.exLibrisFetchedCaseData) {
    window.exLibrisFetchedCaseData = {
      currentPage: null, // The most recently loaded Case
      prevPage: null, // The Case loaded immediately before the current one
      cache: {}, // Lookup object for ALL fetched cases

      // Helper method to retrieve from cache
      getCase: function (identifier) {
        return this.cache[identifier] || null;
      },
    };
    console.log(
      "FETCH INTERCEPTOR: Global storage 'exLibrisFetchedCaseData' initialized."
    );
  }

  // 2. Monkey Patch the XHR
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener("load", function () {
      // Filter: Only Salesforce Aura requests
      if (this._url && this._url.includes("/aura")) {
        try {
          const response = JSON.parse(this.responseText);
          processAuraResponse(response);
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
    return originalSend.apply(this, arguments);
  };

  console.log("FETCH INTERCEPTOR: LISTENING");

  // 3. Process the Response and Update State
  function processAuraResponse(json) {
    if (!json.actions) return;

    json.actions.forEach((action) => {
      if (action.state === "SUCCESS" && action.returnValue) {
        const val = action.returnValue;

        // Ensure we are looking at a Case record
        if (val.apiName === "Case" && val.fields) {
          // A. Parse the raw Salesforce data into a clean object
          const parsedCase = parseSalesforceCase(val.fields);

          // B. Update the Global Variable
          updateGlobalState(parsedCase);

          console.log(
            "FETCH INTERCEPTOR: Processed Case ",
            parsedCase.CaseNumber
          );
        }
      }
    });
  }

  // 4. Helper: Extract fields (add/remove fields here as needed)
  function parseSalesforceCase(fields) {
    return {
      Id: fields.Id?.value,
      CaseNumber: fields.CaseNumber?.value,
      Subject: fields.Subject?.value,
      Description: fields.Description?.value,
      Status: fields.Status?.value,
      Priority: fields.Priority?.value,
      AccountName: fields.Account?.displayValue,
      ContactName: fields.Contact?.displayValue,
      OwnerName: fields.Owner?.displayValue,
      CreatedDate: fields.CreatedDate?.value,

      // --- Added based on your specific log data ---
      Asset: fields.Asset_Line_Item__r?.displayValue, // "University of the Sunshine Coast-Esploro Advanced"
      Category: fields.Category__c?.value, // "Research Repository"
      SupportTeam: fields.Current_Support_Team__c?.displayValue, // "Esploro Support Team"
      Environment: fields.bl_Affected_Environment__r?.displayValue, // "Esploro AP02 - Production"
      ContactEmail: fields.SuppliedEmail?.value, // "libsys@usc.edu.au"
      AccountCode: fields.Ex_Libris_Account_Number__c?.value, // "61USC"

      _raw: fields,
    };
    console.log("FETCH PARSED ", newCaseData);
  }

  // 5. Logic: Handle Current, Previous, and Cache

  const store = window.exLibrisFetchedCaseData;

  function updateGlobalState(newCaseData) {
    if (store) {
      // Validation: Ensure valid ID exists
      if (!newCaseData.Id) return;

      // A. Handle History (Shift Current -> Prev)
      // Only shift if the new case is different from the current case
      if (store.currentPage && store.currentPage.Id !== newCaseData.Id) {
        store.prevPage = store.currentPage;
      }

      //6. Store for pending content script
      if (
        window.ExLibrisExtension.isInitialized === false &&
        window._pendingFectchedCaseData === undefined
      ) {
        window._pendingFectchedCaseData = {
          data: newCaseData,
          timestamp: Date.now(),
        };
      } else if (window._pendingFectchedCaseData !== undefined) {
        window._pendingFectchedCaseData.data = newCaseData;
        window._pendingFectchedCaseData.timestamp = Date.now();
      }

      // B. Set New Current Page
      store.currentPage = newCaseData;

      // C. Update Cache (Double Entry)
      // 1. Cache by 18-char ID (e.g., 500QO00001003yIYAQ)
      store.cache[newCaseData.Id] = newCaseData;

      // 2. Cache by Case Number (e.g., 08258453)
      if (newCaseData.CaseNumber) {
        store.cache[newCaseData.CaseNumber] = newCaseData;
      }

      console.log("Updated exLibrisFetchedCaseData:", store);

      // Dispatch a custom event so content scripts know data updated
      window.dispatchEvent(
        new CustomEvent("EXLIBRIS_DATA_UPDATED", { detail: newCaseData })
      );

      console.log("FETCH INTERCEPTOR: GOT YOUR CASE ", newCaseData.CaseNumber);
      console.log(
        "FETCH INTERCEPTOR: Salesforce Interceptor & Global Cache Ready."
      );
    }
  }
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Interceptor;
}