const GoogleDrive = {
  // Scopes must match manifest
  // backupFileId: cached ID to avoid searching every time
  backupFileId: null,

  async getAuthToken(interactive = true) {
    return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError || !token) {
          console.error('Auth Error:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(token);
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

  async findBackupFile(token) {
    if (this.backupFileId) return this.backupFileId;

    const query = "name = 'smart_notes_backup.json' and 'appDataFolder' in parents and trashed = false";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.files && data.files.length > 0) {
      this.backupFileId = data.files[0].id;
      return this.backupFileId;
    }
    return null;
  },

  async createBackupFile(token, content) {
    const metadata = {
      name: 'smart_notes_backup.json',
      parents: ['appDataFolder']
    };

    const fileContent = new Blob([JSON.stringify(content)], { type: 'application/json' });
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    
    const data = await response.json();
    this.backupFileId = data.id;
    return data.id;
  },

  async updateBackupFile(token, fileId, content) {
    const fileContent = new Blob([JSON.stringify(content)], { type: 'application/json' });

    // Use upload endpoint with PATCH for content
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });
    return response.ok;
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
