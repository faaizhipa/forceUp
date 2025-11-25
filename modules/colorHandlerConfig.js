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
                    'URGENT': ['New Email Received', 'New', 'Open', 'Re-opened', 'Reopened', 'Update Received', 'Completed by Resolver Group'],
                    'IMMEDIATE': ['Pending Action', 'Initial Response Sent', 'In Progress'],
                    'ONGOING': ['Assigned to Resolver Group', 'Pending Internal Response', 'Pending AM Response', 'Pending QA Review'],
                    'IDLE': ['Pending Customer Response'],
                    'MONITOR': ['Pending System Update - Defect', 'Pending System Update - Enhancement', 'Pending System Update - Other', 'Awaiting Customer Confirmation', 'Pending'],
                    'COMPLETED': ['Solution Delivered to Customer', 'Closed']
                },
                // Group colors (background and text)
                groupColors: {
                    'URGENT': { bg: 'rgb(191, 39, 75)', text: 'rgb(255, 255, 255)' },
                    'IMMEDIATE': { bg: 'rgb(210, 72, 3)', text: 'rgb(255, 255, 255)' },
                    'ONGOING': { bg: 'rgb(140, 77, 253)', text: 'rgb(255, 255, 255)' },
                    'IDLE': { bg: 'rgb(103, 103, 103)', text: 'rgb(255, 255, 255)' },
                    'MONITOR': { bg: 'rgb(251, 178, 22)', text: 'rgb(255, 255, 255)' },
                    'COMPLETED': { bg: 'rgb(45, 200, 64)', text: 'rgb(255, 255, 255)' }
                },
                // Individual status overrides (if status differs from group)
                statusOverrides: {}
            },
            handleAnchor: {
                // Email match types
                clarivateEmail: { bg: '#ffe8b5', text: 'rgb(0, 0, 0)' },
                nonClarivateEmail: { bg: '#ffdac8', text: 'rgb(0, 0, 0)' },
                endNoteSupport: { bg: null, text: null } // No highlight
            },
            handleCase: {
                // Time-based ratio thresholds
                thresholds: [
                    { ratio: 1.5, color: 'rgb(255, 220, 230)', label: 'Very Overdue (>150%)' },
                    { ratio: 1.0, color: 'rgb(255, 232, 184)', label: 'Overdue (100-150%)' },
                    { ratio: 0.75, color: 'rgb(255, 255, 153)', label: 'Approaching (75-100%)' },
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

