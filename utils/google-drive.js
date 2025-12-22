const GoogleDrive = {
  // Scopes must match manifest
  // backupFileId: cached ID to avoid searching every time
  backupFileId: null,
  lastAuthError: null,

  getIdentitySupportError() {
    // Check for either native getAuthToken (Chrome) or launchWebAuthFlow (Firefox/Edge/others)
    const nativeAuthAvailable = typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.getAuthToken === 'function';
    const webAuthAvailable = typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.launchWebAuthFlow === 'function';

    if (!nativeAuthAvailable && !webAuthAvailable) {
      return { message: 'Google Drive sign-in is not available in this browser environment.' };
    }
    return null;
  },

  /**
   * Performs authentication using the web flow (popup)
   * Required for Firefox, Edge, and other browsers where getAuthToken is limited
   */
  async authenticateWithWebFlow(interactive) {
    return new Promise((resolve) => {
      try {
        const manifest = chrome.runtime.getManifest();
        const clientId = manifest.oauth2?.client_id;
        const scopes = manifest.oauth2?.scopes || [];

        if (!clientId) {
          resolve({ token: null, error: { message: 'Missing OAuth2 Client ID in manifest' } });
          return;
        }

        const redirectUri = chrome.identity.getRedirectURL();
        console.log('[GoogleDrive] Using Redirect URI:', redirectUri);
        
        // Construct standard Google OAuth2 URL
        const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('response_type', 'token');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', scopes.join(' '));
        // Force approval prompt if interactive to ensure we get a token
        if (interactive) {
          authUrl.searchParams.set('prompt', 'consent');
        }

        chrome.identity.launchWebAuthFlow({
          url: authUrl.toString(),
          interactive: interactive
        }, (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            resolve({ token: null, error: chrome.runtime.lastError });
          } else {
            // Extract token from redirect URL hash
            const url = new URL(redirectUrl);
            const params = new URLSearchParams(url.hash.substring(1)); // Remove #
            const accessToken = params.get('access_token');

            if (accessToken) {
              resolve({ token: accessToken, error: null });
            } else {
              resolve({ token: null, error: { message: 'No access token found in redirect' } });
            }
          }
        });
      } catch (e) {
        resolve({ token: null, error: e });
      }
    });
  },

  async getAuthToken(interactive = true, attempt = 0) {
    const supportError = this.getIdentitySupportError();
    if (supportError) {
      this.lastAuthError = supportError;
      console.warn('[GoogleDrive] Identity API unavailable', supportError);
      return null;
    }

    // Try Chrome-native flow first
    let result = { token: null, error: null };

    // Edge supports getAuthToken type check but throws error at runtime
    const isEdge = navigator.userAgent.indexOf('Edg/') > -1;
    const isChromeNativeAvailable = !isEdge && typeof chrome.identity.getAuthToken === 'function';

    if (isChromeNativeAvailable) {
      result = await new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
          if (chrome.runtime.lastError || !token) {
            resolve({ token: null, error: chrome.runtime.lastError });
          } else {
            resolve({ token, error: null });
          }
        });
      });
    }

    // If native flow failed or unavailable, try web flow
    // We strictly fall back if native is missing OR if native failed but might work with web flow
    // (though usually if getAuthToken fails, we just return error. check logic below)

    // Fallback condition: 
    // 1. Native API missing (e.g. Firefox) -> Try Web Flow
    // 2. Native API present but returned error AND we haven't tried web flow yet? 
    //    Actually, getAuthToken usually handles everything in Chrome. 
    //    So we only fallback if API is missing.

    if (!result.token && !isChromeNativeAvailable) {
      console.log('[GoogleDrive] getAuthToken unavailable, falling back to launchWebAuthFlow');
      result = await this.authenticateWithWebFlow(interactive);
    }

    if (result.token) {
      this.lastAuthError = null;
      return result.token;
    }

    this.lastAuthError = result.error || { message: 'Authentication failed' };

    // If interactive and first failure, clear cached token and retry once
    // Note: Clearing cache only applies to getAuthToken. Web flow doesn't have the same cache clearing mech exposed easily
    if (interactive && attempt === 0 && isChromeNativeAvailable) {
      await this.clearCachedToken();
      return this.getAuthToken(interactive, attempt + 1);
    }

    console.error('[GoogleDrive] Auth Error:', this.lastAuthError);
    return null;
  },

  async clearCachedToken() {
    const isEdge = navigator.userAgent.indexOf('Edg/') > -1;
    const nativeAuthAvailable = !isEdge && typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.getAuthToken === 'function';

    if (!nativeAuthAvailable) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
          chrome.identity.removeCachedAuthToken({ token }, () => resolve());
        } else {
          resolve();
        }
      });
    });
  },

  async getProfileUserInfo() {
    // Just to check if we are signed in
    const token = await this.getAuthToken(false);
    if (!token) return null;

    // We can fetch user info from Google API if needed, 
    // or just return true indicating we have a token.
    return { connected: true };
  },

  // --- Drive API Helpers ---

  async findFileInAppData(token, fileName) {
    const query = `name = '${fileName}' and 'appDataFolder' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  },

  async uploadJsonToAppData(token, fileName, content, existingFileId = null) {
    const fileContent = new Blob([JSON.stringify(content)], { type: 'application/json' });

    if (existingFileId) {
      const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: fileContent
      });
      return response.ok ? existingFileId : null;
    }

    const metadata = {
      name: fileName,
      parents: ['appDataFolder']
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const data = await response.json();
    return data.id;
  },

  async downloadJsonFromAppData(token, fileId) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return response.json();
  },

  async findBackupFile(token) {
    if (this.backupFileId) return this.backupFileId;
    const fileId = await this.findFileInAppData(token, 'smart_notes_backup.json');
    if (fileId) {
      this.backupFileId = fileId;
      return fileId;
    }
    return null;
  },

  async createBackupFile(token, content) {
    const id = await this.uploadJsonToAppData(token, 'smart_notes_backup.json', content, null);
    this.backupFileId = id;
    return id;
  },

  async updateBackupFile(token, fileId, content) {
    const id = await this.uploadJsonToAppData(token, 'smart_notes_backup.json', content, fileId);
    return Boolean(id);
  },

  async performBackup(notesData) {
    const token = await this.getAuthToken(true); // Ensure we have token
    if (!token) throw new Error("Not authenticated");

    let fileId = await this.findBackupFile(token);
    if (fileId) {
      await this.updateBackupFile(token, fileId, notesData);
    } else {
      await this.createBackupFile(token, notesData);
    }
    return true;
  },

  async performLocalDbBackup(localDbPayload = null) {
    const token = await this.getAuthToken(true);
    if (!token) throw new Error("Not authenticated");

    const payload = localDbPayload || (typeof LocalDb !== 'undefined' ? await LocalDb.exportEntities() : null);
    if (!payload) throw new Error('No LocalDb data to back up');

    const fileId = await this.findFileInAppData(token, 'exl_localdb_backup.json');
    const updatedId = await this.uploadJsonToAppData(token, 'exl_localdb_backup.json', payload, fileId);
    if (!updatedId) throw new Error('Failed to upload LocalDb backup');
    return true;
  },

  async restoreLocalDbBackup({ merge = true } = {}) {
    const token = await this.getAuthToken(true);
    if (!token) throw new Error("Not authenticated");

    const fileId = await this.findFileInAppData(token, 'exl_localdb_backup.json');
    if (!fileId) throw new Error('No LocalDb backup found');

    const data = await this.downloadJsonFromAppData(token, fileId);
    if (!data) throw new Error('Failed to download LocalDb backup');

    if (typeof LocalDb === 'undefined') {
      throw new Error('LocalDb not available for import');
    }

    const imported = await LocalDb.importEntities(data, { merge });
    if (!imported) throw new Error('LocalDb import failed');
    return true;
  },

  async restoreBackup() {
    const token = await this.getAuthToken(true);
    if (!token) throw new Error("Not authenticated");

    const fileId = await this.findBackupFile(token);
    if (!fileId) throw new Error("No backup found");

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error("Failed to download backup");

    const data = await response.json();
    return data;
  },

  // --- Sharing (Visible Files) ---

  async createSharedDoc(title, content) {
    // Create a regular file in root (not appDataFolder) so user can see/share it
    const token = await this.getAuthToken(true);
    if (!token) throw new Error("Not authenticated");

    // Creating a Google Doc requires using the specific MIME type for conversion, 
    // or we can just create a text file.
    // "create... notes... share" -> A Google Doc is nicer for editing/sharing.
    // Mime type: application/vnd.google-apps.document

    const metadata = {
      name: title,
      mimeType: 'application/vnd.google-apps.document'
    };

    // Body needs to be simple text if we convert, or we upload plain text and ask Drive to convert.
    const fileContent = new Blob([content], { type: 'text/plain' });
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });

    const data = await response.json();
    return data.id; // Returns the Drive File ID
  },

  async shareFile(fileId, email) {
    const token = await this.getAuthToken(true);
    if (!token) throw new Error("Not authenticated");

    const permission = {
      type: 'user',
      role: 'reader', // or 'writer' / 'commenter'
      emailAddress: email
    };

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(permission)
    });

    return response.ok;
  },

  async getWebViewLink(fileId) {
    const token = await this.getAuthToken(true);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    return data.webViewLink;
  }
};
