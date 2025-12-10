/**
 * Color Handler Configuration Module
 * Manages customizable colors for handleStatus, handleAnchor, and handleCase features
 * Stores configurations in chrome.storage.sync for cross-device sync
 */

const ColorHandlerConfig = {
    STORAGE_KEY: 'exl_colorHandlerConfig',
    
    /**
     * Get default color configuration
     * @returns {Object} Default color configuration object
     */
    getDefaultConfig() {
        return {
            handleStatus: {
                // Status-to-group mapping
                statusGroups: {
                    'URGENT': ['New Email Received', 'New', 'Open', 'Under Review', 'Re-opened', 'Reopened', 'Update Received', 'Completed by Resolver Group'],
                    'IMMEDIATE': ['Pending Action', 'Internal Input', 'In Progress'],
                    'ONGOING': ['Assigned to Resolver Group', 'Pending Internal Response', 'Pending AM Response', 'Pending QA Review'],
                    'IDLE': ['Pending Customer Response', 'Initial Response Sent'],
                    'MONITOR': ['Pending', 'Pending System Update - Defect', 'Pending System Update - Enhancement', 'Pending System Update - Other', 'Awaiting Customer Confirmation', 'Development'],
                    'COMPLETED': ['Solution Delivered to Customer', 'Closed']
                },
                // Group colors (background and text)
                groupColors: {
                    'URGENT':    { bg: 'hsla(344, 89%, 40%, 1.00)', text: 'rgb(255, 255, 255)' },
                    'IMMEDIATE': { bg: 'rgb(249, 100, 49)', text: 'rgb(255, 255, 255)' },
                    'ONGOING':   { bg: 'rgb(13, 83, 173)', text: 'rgb(255, 255, 255)' },
                    'IDLE':      { bg: 'rgb(15, 104, 162)', text: 'rgb(255, 255, 255)' },
                    'MONITOR':   { bg: 'rgb(171, 10, 131)', text: 'rgb(255, 255, 255)' },
                    'COMPLETED': { bg: 'rgb(0, 100, 0)', text: 'rgb(255, 255, 255)' }
                },
                groupColorsLight: {
                    // Lighter companions for buttons/borders so the banner stays dark while controls stay legible
                    'URGENT':    { bg: 'rgb(221, 5, 60)', text: 'rgb(255, 255, 255)' },
                    'IMMEDIATE': { bg: 'rgb(255, 187, 6)', text: 'rgb(64, 34, 0)' },
                    'ONGOING':   { bg: 'rgb(22, 110, 226)', text: 'rgb(255, 255, 255)' },
                    'IDLE':      { bg: 'rgb(60, 203, 255)', text: 'rgba(31, 1, 39, 1)' },
                    'MONITOR':   { bg: 'rgb(212, 37, 171)', text: 'rgb(255, 255, 255)' },
                    'COMPLETED': { bg: 'rgb(5, 139, 14)', text: 'rgb(255, 255, 255)' }
                },
                // Individual status overrides (if status differs from group)
                statusOverrides: {}
            },
            handleAnchor: {
                // Email match types
                clarivateEmail: { bg: '#ffd66b', text: 'rgb(0, 0, 0)' },
                nonClarivateEmail: { bg: '#ffa7c3', text: 'rgb(0, 0, 0)' },
                endNoteSupport: { bg: null, text: null } // No highlight
            },
            handleCase: {
                // Time-based ratio thresholds
                thresholds: [
                    { ratio: 1.5, color: 'rgb(255, 167, 184)', label: 'Very Overdue (>150%)' },
                    { ratio: 1.0, color: 'rgb(255, 182, 143)', label: 'Overdue (100-150%)' },
                    { ratio: 0.75, color: 'rgb(255, 214, 107)', label: 'Approaching (75-100%)' },
                    { ratio: 0.5, color: 'rgb(209, 247, 196)', label: 'Good (50-75%)' },
                    { ratio: 0, color: 'rgb(194, 244, 233)', label: 'Plenty of Time (<50%)' }
                ]
            }
        };
    },
    
    /**
     * Load color configuration from storage
     * @returns {Promise<Object>} Color configuration object
     */
    async loadConfig() {
        return new Promise((resolve) => {
            chrome.storage.sync.get([this.STORAGE_KEY], (result) => {
                const savedConfig = result[this.STORAGE_KEY];
                if (savedConfig) {
                    // Merge with defaults to ensure all keys exist
                    const defaultConfig = this.getDefaultConfig();
                    const mergedConfig = this.mergeConfig(defaultConfig, savedConfig);
                    resolve(mergedConfig);
                } else {
                    resolve(this.getDefaultConfig());
                }
            });
        });
    },
    
    /**
     * Save color configuration to storage
     * @param {Object} config - Color configuration object
     * @returns {Promise<void>}
     */
    async saveConfig(config) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set({ [this.STORAGE_KEY]: config }, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    },
    
    /**
     * Merge saved config with defaults, ensuring all keys exist
     * @param {Object} defaultConfig - Default configuration
     * @param {Object} savedConfig - Saved configuration
     * @returns {Object} Merged configuration
     */
    mergeConfig(defaultConfig, savedConfig) {
        const merged = JSON.parse(JSON.stringify(defaultConfig));
        
        // Merge handleStatus
        if (savedConfig.handleStatus) {
            if (savedConfig.handleStatus.statusGroups) {
                Object.assign(merged.handleStatus.statusGroups, savedConfig.handleStatus.statusGroups);
            }
            if (savedConfig.handleStatus.groupColors) {
                Object.assign(merged.handleStatus.groupColors, savedConfig.handleStatus.groupColors);
            }
            if (savedConfig.handleStatus.groupColorsLight) {
                if (!merged.handleStatus.groupColorsLight) {
                    merged.handleStatus.groupColorsLight = {};
                }
                Object.assign(merged.handleStatus.groupColorsLight, savedConfig.handleStatus.groupColorsLight);
            }
            if (savedConfig.handleStatus.statusOverrides) {
                merged.handleStatus.statusOverrides = savedConfig.handleStatus.statusOverrides;
            }
        }
        
        // Merge handleAnchor
        if (savedConfig.handleAnchor) {
            Object.assign(merged.handleAnchor, savedConfig.handleAnchor);
        }
        
        // Merge handleCase
        if (savedConfig.handleCase && savedConfig.handleCase.thresholds) {
            merged.handleCase.thresholds = savedConfig.handleCase.thresholds;
        }
        
        return merged;
    },
    
    /**
     * Get status group for a given status text
     * @param {Object} config - Color configuration
     * @param {string} statusText - Status text to look up
     * @returns {string|null} Group name or null if not found
     */
    getStatusGroup(config, statusText) {
        const statusGroups = config.handleStatus.statusGroups;
        for (const [groupName, statuses] of Object.entries(statusGroups)) {
            if (statuses.includes(statusText)) {
                return groupName;
            }
        }
        return null;
    },
    
    /**
     * Get colors for a status (either from override or group)
     * @param {Object} config - Color configuration
     * @param {string} statusText - Status text
     * @returns {Object|null} Color object with bg and text properties
     */
    getStatusColors(config, statusText) {
        // Check for status override first
        if (config.handleStatus.statusOverrides[statusText]) {
            return config.handleStatus.statusOverrides[statusText];
        }
        
        // Get group for status
        const group = this.getStatusGroup(config, statusText);
        if (group && config.handleStatus.groupColors[group]) {
            return config.handleStatus.groupColors[group];
        }
        
        return null;
    },
    
    /**
     * Reset configuration to defaults
     * @returns {Promise<void>}
     */
    async resetToDefaults() {
        const defaultConfig = this.getDefaultConfig();
        return this.saveConfig(defaultConfig);
    }
};

