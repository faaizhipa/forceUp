# Release Notes - v7.5.6 (Proposed)

## 🚀 Key Highlights

- **Cross-Browser Google Drive Support**: Google Drive authentication now works seamlessly on Edge, Firefox, and other Chromium browsers (using a standard OAuth2 popup fallback), not just Chrome.
- **Store Compliance**: Added a dedicated `privacy-policy.html` to meet Web Store and Edge Add-on requirements.
- **Clarivate Domain Banner Control**: New option to toggle the persistent banner specifically for Clarivate domains.
- **Highlighter Improvements**: Added a "Manage" button to the highlighter banner for easier access to notes.

## 📋 Detailed Changes

### Documentation & Compliance

- **Privacy Policy**: Added `privacy-policy.html` detailing data usage, Google Drive permissions, and local storage retention.
- **Codebase Analysis**: Deep-dive analysis of architecture and patterns (`CODEBASE_INSIGHTS.md`).

### Features & Improvements

- **Google Drive Auth**: Refactored `google-drive.js` to handle non-Chrome environments gracefully.
- **Banner Settings**: Added checkbox in Popup to enable/disable persistent banner on Clarivate domains.
- **Case Comment Extractor**: Fixed "No comments found" bugs by improved DOM detection and async handling.
- **Highlighter**: Added direct access to the "Manage Highlights" panel from the banner.

## 🐛 Bug Fixes

- Fixed async timing issues in `persistentBanner.js` preventing comment extraction.
- Enhanced stability of comment table detection in Salesforce Lightning.

---

_Generated on 2025-12-17_

---

## 🔒 Privacy Policy

### 1. Data Collection and Usage

We do **NOT** sell, trade, or transfer your personal data to third parties.

#### Google Drive Integration

The Extension integrates with Google Drive to back up your preferences and notes. This integration is optional and user-initiated.

- **Scopes Used:**
  - `drive.appdata`: Used to store configuration and backup files in a hidden application data folder within your Google Drive. This data is not visible to other apps.
  - `drive.file`: Used to create or edit specific files (like exported notes or documents) that you explicitly choose to save or share.
- **Usage:** Authorization tokens are used solely to communicate with the Google Drive API for the purpose of saving/loading your extension data.

#### Local Storage

We use `chrome.storage.local` to store your settings, cached data (such as timezone info), and user preferences directly on your device. This data never leaves your browser unless you choose to use the Cloud Backup (Google Drive) feature.

### 2. Permissions

The Extension requests the following permissions to function:

- **tabs & activeTab:** To interact with the current page (Salesforce or Documentation sites) to perform productivity tasks like text formatting or data extraction.
- **storage:** To save your preferences locally.
- **identity:** To authenticate with Google Drive (if you use backup features).
- **clipboardWrite:** To allow you to copy formatted text or links to your clipboard.
- **sidePanel:** To display tools and notes alongside your main content.
- **tabCapture:** To support screenshot functionality within the extension.

### 3. Third-Party Services

The Extension operates primarily as a standalone client-side tool. It does not send data to any proprietary servers. Google Drive API interaction occurs directly between your browser and Google servers.

### 4. Data Retention

Data stored in `chrome.storage.local` remains on your machine until you uninstall the extension or clear your browsing data. Data stored in your Google Drive (App Data folder) is retained according to your Google account policies.
