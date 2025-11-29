/**
 * OneDrive Authentication Module
 * Handles OAuth 2.0 authentication with PKCE for Microsoft OneDrive
 * @module oneDriveAuth
 */

const OneDriveAuth = (function() {
  'use strict';

  // ========== CONSTANTS ==========
  
  // Microsoft OAuth endpoints
  const AUTH_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
  const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  // Required scopes for OneDrive access
  const SCOPES = [
    'Files.ReadWrite.AppFolder',  // Access app-specific folder only
    'offline_access'              // Get refresh tokens
  ];
  
  // Storage keys
  const STORAGE_KEYS = {
    ACCESS_TOKEN: 'exl_onedrive_access_token',
    REFRESH_TOKEN: 'exl_onedrive_refresh_token',
    TOKEN_EXPIRY: 'exl_onedrive_token_expiry',
    USER_INFO: 'exl_onedrive_user_info',
    CODE_VERIFIER: 'exl_onedrive_code_verifier'
  };
  
  // Token refresh buffer (5 minutes before expiry)
  const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000;

  // ========== STATE ==========
  
  let isInitialized = false;
  let clientId = null;
  let redirectUri = null;
  let accessToken = null;
  let tokenExpiry = null;
  let userInfo = null;
  let refreshInProgress = false;

  // ========== INITIALIZATION ==========

  /**
   * Initialize the OneDrive auth module
   * @param {Object} config - Configuration object
   * @param {string} config.clientId - Microsoft App Client ID
   * @param {string} config.redirectUri - OAuth redirect URI
   */
  async function init(config = {}) {
    if (isInitialized) return;

    console.log('[OneDriveAuth] Initializing...');

    // Load configuration from storage or use provided config
    const storedConfig = await loadConfig();
    clientId = config.clientId || storedConfig.clientId;
    redirectUri = config.redirectUri || storedConfig.redirectUri || chrome.identity.getRedirectURL();

    if (!clientId) {
      console.warn('[OneDriveAuth] No client ID configured. OneDrive integration disabled.');
      return;
    }

    // Load stored tokens
    await loadTokens();

    // Setup token refresh listener
    setupTokenRefreshListener();

    isInitialized = true;
    console.log('[OneDriveAuth] Initialized', { hasToken: !!accessToken, redirectUri });
  }

  /**
   * Load configuration from storage
   */
  async function loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['exl_onedrive_config'], (result) => {
        resolve(result.exl_onedrive_config || {});
      });
    });
  }

  /**
   * Load tokens from storage
   */
  async function loadTokens() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.TOKEN_EXPIRY,
        STORAGE_KEYS.USER_INFO
      ], async (result) => {
        // Decrypt tokens if present
        if (result[STORAGE_KEYS.ACCESS_TOKEN]) {
          accessToken = await decryptToken(result[STORAGE_KEYS.ACCESS_TOKEN]);
        }
        tokenExpiry = result[STORAGE_KEYS.TOKEN_EXPIRY] || null;
        userInfo = result[STORAGE_KEYS.USER_INFO] || null;

        // Check if token needs refresh
        if (accessToken && isTokenExpired()) {
          await refreshAccessToken();
        }

        resolve();
      });
    });
  }

  /**
   * Setup listener for token refresh
   */
  function setupTokenRefreshListener() {
    // Check token every minute
    setInterval(async () => {
      if (accessToken && isTokenNearExpiry() && !refreshInProgress) {
        console.log('[OneDriveAuth] Token near expiry, refreshing...');
        await refreshAccessToken();
      }
    }, 60000);
  }

  // ========== PKCE HELPERS ==========

  /**
   * Generate a random string for PKCE code verifier
   */
  function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
  }

  /**
   * Generate code challenge from verifier using SHA-256
   */
  async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(hash));
  }

  /**
   * Base64 URL encode
   */
  function base64UrlEncode(array) {
    return btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // ========== AUTHENTICATION ==========

  /**
   * Start OAuth login flow
   * @returns {Promise<boolean>} Success status
   */
  async function login() {
    if (!clientId) {
      console.error('[OneDriveAuth] Cannot login: no client ID configured');
      throw new Error('OneDrive not configured');
    }

    console.log('[OneDriveAuth] Starting login flow...');

    try {
      // Generate PKCE code verifier and challenge
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Store code verifier for later use
      await chrome.storage.local.set({ [STORAGE_KEYS.CODE_VERIFIER]: codeVerifier });

      // Build authorization URL
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: SCOPES.join(' '),
        response_mode: 'query',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });

      const authUrl = `${AUTH_ENDPOINT}?${params.toString()}`;

      // Use chrome.identity to handle the OAuth flow
      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        }, (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(redirectUrl);
          }
        });
      });

      // Extract authorization code from response
      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        throw new Error(`OAuth error: ${error} - ${url.searchParams.get('error_description')}`);
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      // Exchange code for tokens
      await exchangeCodeForTokens(code, codeVerifier);

      // Get user info
      await fetchUserInfo();

      console.log('[OneDriveAuth] Login successful');
      return true;

    } catch (error) {
      console.error('[OneDriveAuth] Login failed:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async function exchangeCodeForTokens(code, codeVerifier) {
    const params = new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
    }

    const tokenData = await response.json();
    await saveTokens(tokenData);
  }

  /**
   * Refresh the access token using refresh token
   */
  async function refreshAccessToken() {
    if (refreshInProgress) return false;

    refreshInProgress = true;
    console.log('[OneDriveAuth] Refreshing access token...');

    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.REFRESH_TOKEN]);
      const refreshToken = result[STORAGE_KEYS.REFRESH_TOKEN] 
        ? await decryptToken(result[STORAGE_KEYS.REFRESH_TOKEN])
        : null;

      if (!refreshToken) {
        console.warn('[OneDriveAuth] No refresh token available');
        await logout();
        return false;
      }

      const params = new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: SCOPES.join(' ')
      });

      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[OneDriveAuth] Token refresh failed:', errorData);
        
        // If refresh fails, force re-login
        if (errorData.error === 'invalid_grant') {
          await logout();
        }
        return false;
      }

      const tokenData = await response.json();
      await saveTokens(tokenData);

      console.log('[OneDriveAuth] Token refreshed successfully');
      return true;

    } catch (error) {
      console.error('[OneDriveAuth] Token refresh error:', error);
      return false;
    } finally {
      refreshInProgress = false;
    }
  }

  /**
   * Save tokens to storage (encrypted)
   */
  async function saveTokens(tokenData) {
    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in * 1000);

    const encryptedAccessToken = await encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token 
      ? await encryptToken(tokenData.refresh_token)
      : null;

    const storageData = {
      [STORAGE_KEYS.ACCESS_TOKEN]: encryptedAccessToken,
      [STORAGE_KEYS.TOKEN_EXPIRY]: tokenExpiry
    };

    if (encryptedRefreshToken) {
      storageData[STORAGE_KEYS.REFRESH_TOKEN] = encryptedRefreshToken;
    }

    await chrome.storage.local.set(storageData);
  }

  /**
   * Fetch user info from Microsoft Graph
   */
  async function fetchUserInfo() {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      userInfo = await response.json();
      await chrome.storage.local.set({ [STORAGE_KEYS.USER_INFO]: userInfo });

    } catch (error) {
      console.warn('[OneDriveAuth] Could not fetch user info:', error);
    }
  }

  /**
   * Logout - clear all tokens and user info
   */
  async function logout() {
    console.log('[OneDriveAuth] Logging out...');

    accessToken = null;
    tokenExpiry = null;
    userInfo = null;

    await chrome.storage.local.remove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.TOKEN_EXPIRY,
      STORAGE_KEYS.USER_INFO,
      STORAGE_KEYS.CODE_VERIFIER
    ]);

    console.log('[OneDriveAuth] Logged out');
  }

  // ========== TOKEN HELPERS ==========

  /**
   * Check if token is expired
   */
  function isTokenExpired() {
    if (!tokenExpiry) return true;
    return Date.now() >= tokenExpiry;
  }

  /**
   * Check if token is near expiry (within buffer)
   */
  function isTokenNearExpiry() {
    if (!tokenExpiry) return true;
    return Date.now() >= (tokenExpiry - TOKEN_REFRESH_BUFFER);
  }

  /**
   * Get current access token (refreshing if needed)
   */
  async function getAccessToken() {
    if (!accessToken) return null;

    if (isTokenExpired()) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) return null;
    }

    return accessToken;
  }

  // ========== ENCRYPTION HELPERS ==========
  // Simple encryption for tokens at rest
  // Uses a key derived from extension ID for basic protection

  /**
   * Encrypt a token for storage
   */
  async function encryptToken(token) {
    try {
      // Use subtle crypto for encryption
      const key = await getEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(token)
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      return btoa(String.fromCharCode.apply(null, combined));
    } catch (error) {
      console.warn('[OneDriveAuth] Encryption failed, storing plain:', error);
      return token;
    }
  }

  /**
   * Decrypt a token from storage
   */
  async function decryptToken(encryptedToken) {
    try {
      const key = await getEncryptionKey();
      const combined = new Uint8Array(
        atob(encryptedToken).split('').map(c => c.charCodeAt(0))
      );

      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      // If decryption fails, token might be stored in plain text (legacy)
      console.warn('[OneDriveAuth] Decryption failed, assuming plain text');
      return encryptedToken;
    }
  }

  /**
   * Get or create encryption key
   */
  async function getEncryptionKey() {
    // Use extension ID as base for key derivation
    const extensionId = chrome.runtime.id || 'exl-extension';
    const encoder = new TextEncoder();
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(extensionId),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('exl-onedrive-auth'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // ========== PUBLIC API ==========

  return {
    init,
    login,
    logout,
    getAccessToken,
    isAuthenticated: () => !!accessToken && !isTokenExpired(),
    getUserInfo: () => userInfo,
    refreshToken: refreshAccessToken
  };

})();

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OneDriveAuth;
}

