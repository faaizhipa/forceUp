
const GoogleDrive = {
  // Scopes must match manifest
  // backupFileId: cached ID to avoid searching every time
  backupFileId: null,
  lastAuthError: null,

  async getAuthToken(interactive = true, attempt = 0) {
    const { token, error } = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive }, (result) => {
        if (chrome.runtime.lastError || !result) {
          resolve({ token: null, error: chrome.runtime.lastError });
        } else {
          resolve({ token: result, error: null });
        }
      });
    });

    if (token) {
      this.lastAuthError = null;
      return token;
    }

    this.lastAuthError = error;

    // If interactive and first failure, clear cached token and retry once
    if (interactive && attempt === 0) {
      await this.clearCachedToken();
      return this.getAuthToken(interactive, attempt + 1);
    }

    console.error('Auth Error:', error);
    return null;
  },

  async clearCachedToken() {
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
