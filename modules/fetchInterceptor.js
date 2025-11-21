(function () {
  'use strict';

  if (window.__ExLibrisFetchInterceptorInstalled__) {
    return;
  }

  window.__ExLibrisFetchInterceptorInstalled__ = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    try {
      const request = args[0];
      const requestUrl = request instanceof Request ? request.url : String(request);

      if (shouldProcessRequest(requestUrl)) {
        processResponseClone(response.clone());
      }
    } catch (error) {
      console.error('[FetchInterceptor] Error while processing fetch response:', error);
    }

    return response;
  };

  function shouldProcessRequest(url) {
    if (!url) return false;
    return url.includes('aura.RecordUi.getRecordWithFields');
  }

  function processResponseClone(responseClone) {
    responseClone.text()
      .then((body) => {
        try {
          const payload = JSON.parse(body);
          if (!payload || !Array.isArray(payload.actions)) {
            return;
          }

          payload.actions.forEach((action) => {
            if (!action || action.state !== 'SUCCESS') {
              return;
            }

            const returnValue = action.returnValue;
            if (!returnValue || returnValue.apiName !== 'Case' || !returnValue.fields) {
              return;
            }

            const fields = returnValue.fields;
            const caseId = returnValue.id || fields?.Id?.value || fields?.CaseID_18_Character__c?.value || null;
            const caseNumber = fields?.CaseNumber?.value || null;

            if (!caseId && !caseNumber) {
              console.warn('[FetchInterceptor] Unable to determine case identifiers from API response');
              return;
            }

            if (window.FetchDataCache && typeof window.FetchDataCache.store === 'function') {
              window.FetchDataCache.store({
                caseId,
                caseNumber,
                id: returnValue.id,
                fields
              });
            }

            const normalizedData = window.FetchDataCache?.get(caseId, caseNumber) || null;

            document.dispatchEvent(new CustomEvent('apiCaseDataCaptured', {
              detail: {
                caseId,
                caseNumber,
                data: normalizedData
              },
              bubbles: false,
              composed: false
            }));
          });
        } catch (error) {
          console.error('[FetchInterceptor] Error parsing response:', error);
        }
      })
      .catch((error) => {
        console.error('[FetchInterceptor] Failed to read cloned response:', error);
      });
  }

  console.log('[FetchInterceptor] Installed fetch interceptor');
})();

