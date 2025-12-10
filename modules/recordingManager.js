/**
 * RecordingManager Module
 * Tab-only WebM recording with 150MB cap and safety guards.
 * Runs on non-Salesforce domains (see manifest excludes).
 */
const RecordingManager = (function() {
  'use strict';

  const MAX_SIZE_BYTES = 150 * 1024 * 1024; // 150MB hard cap
  const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes
  const MIME_TYPE = 'video/webm;codecs=vp8,opus';

  let mediaRecorder = null;
  let recordedChunks = [];
  let captureStream = null;
  let startTime = null;
  let stopTimer = null;
  let onStatus = null;
  let isStopping = false;

  function isSalesforceDomain() {
    const host = (location.hostname || '').toLowerCase();
    return host.includes('salesforce.com') || host.includes('force.com') || host.includes('lightning.force.com');
  }

  function logInfo(msg, data) {
    if (typeof Logger !== 'undefined') {
      Logger.info(msg, data);
    } else {
      console.log(msg, data || '');
    }
  }

  function logWarn(msg, data) {
    if (typeof Logger !== 'undefined') {
      Logger.warn(msg, data);
    } else {
      console.warn(msg, data || '');
    }
  }

  function logError(msg, data) {
    if (typeof Logger !== 'undefined') {
      Logger.error(msg, data);
    } else {
      console.error(msg, data || '');
    }
  }

  async function shouldEnforceRecordingQuota() {
    try {
      const result = await chrome.storage.sync.get(['exlibris']);
      const enforce = result?.exlibris?.features?.recordingQuotaEnforced;
      return enforce !== false; // default to enforce when unset
    } catch (error) {
      logWarn('[RecordingManager] Failed to read recording quota setting', error);
      return true;
    }
  }

  function notifyStatus(status, extra = {}) {
    if (typeof onStatus === 'function') {
      onStatus({ status, ...extra });
    }
  }

  function stopIfOversize(approxBytes) {
    if (approxBytes > MAX_SIZE_BYTES && mediaRecorder && !isStopping) {
      isStopping = true;
      logWarn('[RecordingManager] Size cap reached, stopping recording');
      notifyStatus('stopping', { reason: 'size' });
      mediaRecorder.stop();
    }
  }

  function clearState() {
    recordedChunks = [];
    startTime = null;
    isStopping = false;
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    if (captureStream) {
      captureStream.getTracks().forEach(t => {
        try { t.stop(); } catch (err) { logWarn('[RecordingManager] Track stop failed', err); }
      });
      captureStream = null;
    }
    mediaRecorder = null;
  }

  async function startRecording(statusCallback) {
    if (mediaRecorder) {
      logWarn('[RecordingManager] Recording already in progress');
      return false;
    }
    if (isSalesforceDomain()) {
      logWarn('[RecordingManager] Recording blocked on Salesforce domains');
      return false;
    }

    onStatus = statusCallback || null;

    try {
      captureStream = await getCaptureStream();
      if (!captureStream) {
        logWarn('[RecordingManager] No capture stream available');
        notifyStatus('error', { error: 'Unable to start recording (stream missing).' });
        return false;
      }

      recordedChunks = [];
      startTime = Date.now();
      isStopping = false;

      mediaRecorder = new MediaRecorder(captureStream, { mimeType: MIME_TYPE });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
          const totalBytes = recordedChunks.reduce((sum, c) => sum + c.size, 0);
          stopIfOversize(totalBytes);
        }
      };

      mediaRecorder.onstop = () => {
        finalizeRecording().catch(err => logError('[RecordingManager] Finalize failed', err));
      };

      mediaRecorder.onerror = (event) => {
        logError('[RecordingManager] Recorder error', event.error);
        notifyStatus('error', { error: event.error?.message || 'Recording error' });
        clearState();
      };

      mediaRecorder.start(500); // gather data every 500ms
      stopTimer = setTimeout(() => safeStop('duration'), MAX_DURATION_MS);
      notifyStatus('recording', { startedAt: startTime, maxMs: MAX_DURATION_MS, maxBytes: MAX_SIZE_BYTES });
      logInfo('[RecordingManager] Recording started');
      window.addEventListener('beforeunload', handleBeforeUnload);
      return true;
    } catch (error) {
      logError('[RecordingManager] Failed to start recording', error);
      notifyStatus('error', { error: error.message || 'Failed to start recording' });
      clearState();
      return false;
    }
  }

  function handleBeforeUnload(event) {
    if (mediaRecorder) {
      event.preventDefault();
      event.returnValue = '';
      safeStop('navigation');
    }
  }

  function safeStop(reason = 'manual') {
    if (!mediaRecorder || isStopping) return;
    isStopping = true;
    logInfo('[RecordingManager] Stopping recording', { reason });
    notifyStatus('stopping', { reason });
    try {
      mediaRecorder.stop();
    } catch (err) {
      logWarn('[RecordingManager] Stop error', err);
    }
  }

  async function finalizeRecording() {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    const durationMs = startTime ? Date.now() - startTime : 0;
    const blob = new Blob(recordedChunks, { type: MIME_TYPE });
    const sizeBytes = blob.size;

    if (sizeBytes > MAX_SIZE_BYTES) {
      logWarn('[RecordingManager] Discarding recording over cap', { sizeBytes });
      notifyStatus('discarded', { reason: 'size', sizeBytes });
      clearState();
      return;
    }

    try {
      const dataUrl = await blobToDataUrl(blob);
      const poster = await createPoster(blob);
      const layerId = typeof LayerManager !== 'undefined' ? LayerManager.getCurrentLayerId() : 'default';
      const recordingData = {
        id: `recording_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        dataUrl,
        poster,
        timestamp: Date.now(),
        url: window.location.href,
        durationMs,
        sizeBytes,
        layerId
      };

      const enforceQuota = await shouldEnforceRecordingQuota();
      if (enforceQuota && typeof StorageQuotaManager !== 'undefined' && typeof StorageQuotaManager.canStoreRecording === 'function') {
        const estimatedBytes = typeof StorageQuotaManager.estimateSize === 'function'
          ? StorageQuotaManager.estimateSize(recordingData)
          : Math.ceil(sizeBytes * 1.4);

        const allowed = await StorageQuotaManager.canStoreRecording(estimatedBytes);
        if (!allowed) {
          logWarn('[RecordingManager] Recording dropped due to quota', { estimatedBytes });
          notifyStatus('discarded', { reason: 'quota', sizeBytes: estimatedBytes });
          clearState();
          return;
        }
      }

      await saveRecording(recordingData);

      if (typeof CapturePanel !== 'undefined' && typeof CapturePanel.open === 'function') {
        CapturePanel.open({ tab: 'recordings', justSavedId: recordingData.id, url: recordingData.url });
      } else {
        try {
          chrome.runtime.sendMessage({
            type: 'OPEN_SIDEPANEL',
            tab: 'recorded',
            payload: { justSavedId: recordingData.id, url: recordingData.url }
          });
        } catch (err) {
          logWarn('[RecordingManager] Failed to open side panel after save', err);
        }
      }

      notifyStatus('saved', { durationMs, sizeBytes });
      logInfo('[RecordingManager] Recording saved', { durationMs, sizeBytes });
    } catch (error) {
      logError('[RecordingManager] Failed to finalize recording', error);
      notifyStatus('error', { error: error.message || 'Finalize error' });
    } finally {
      clearState();
    }
  }

  /**
   * Acquire capture stream using tabCapture when available, otherwise fall back to getDisplayMedia.
   * @returns {Promise<MediaStream|null>}
   */
  async function getCaptureStream() {
    // Preferred path: chrome.tabCapture from extension context
    if (chrome?.tabCapture && typeof chrome.tabCapture.capture === 'function') {
      try {
        const stream = await chrome.tabCapture.capture({
          audio: true,
          video: true,
          videoConstraints: { mandatory: { chromeMediaSource: 'tab' } }
        });
        if (stream) {
          logInfo('[RecordingManager] Using chrome.tabCapture');
          return stream;
        }
        logWarn('[RecordingManager] tabCapture returned null stream');
      } catch (err) {
        logWarn('[RecordingManager] tabCapture failed, will try getDisplayMedia', err);
      }
    }

    // Fallback: user-mediated getDisplayMedia (will prompt for surface selection)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          preferCurrentTab: true
        },
        audio: true
      });
      if (stream) {
        logInfo('[RecordingManager] Using getDisplayMedia fallback');
        return stream;
      }
    } catch (err) {
      logError('[RecordingManager] getDisplayMedia failed', err);
    }

    return null;
  }

  async function saveRecording(recordingData) {
    const urlHash = (recordingData.url || '').substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
    const storageKey = `exl_recordings_v1_${recordingData.layerId}_${urlHash}_${recordingData.id}`;
    await chrome.storage.local.set({ [storageKey]: recordingData });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function createPoster(blob) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(blob);
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.onloadeddata = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (err) {
          URL.revokeObjectURL(url);
          resolve('');
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
    });
  }

  function getStatus() {
    return {
      isRecording: !!mediaRecorder,
      startedAt: startTime,
      elapsedMs: startTime ? Date.now() - startTime : 0,
      maxDurationMs: MAX_DURATION_MS,
      maxSizeBytes: MAX_SIZE_BYTES
    };
  }

  return {
    startRecording,
    stopRecording: () => safeStop('manual'),
    toggleRecording: (statusCb) => {
      if (mediaRecorder) {
        safeStop('manual');
        return 'stopping';
      }
      startRecording(statusCb);
      return 'starting';
    },
    getStatus
  };
})();
