/**
 * TimezoneDetector Module
 * Reports locale and timezone using Intl API
 */

const TimezoneDetector = {
    cachedResult: null,

    /**
     * Detect current locale and timezone
     * @returns {Object} { locale, timeZone, numberingSystem, calendar }
     */
    detect() {
        // Return cached result if available
        if (this.cachedResult) {
            return this.cachedResult;
        }

        try {
            const options = Intl.DateTimeFormat().resolvedOptions();
            
            this.cachedResult = {
                locale: options.locale || navigator.language || 'en-US',
                timeZone: options.timeZone || 'UTC',
                numberingSystem: options.numberingSystem || 'latn',
                calendar: options.calendar || 'gregory'
            };

            console.log('[EXL] TimezoneDetector: Detected', this.cachedResult);
            return this.cachedResult;
        } catch (err) {
            console.error('[EXL] TimezoneDetector: Error detecting timezone', err);
            
            // Fallback
            return {
                locale: navigator.language || 'en-US',
                timeZone: 'UTC',
                numberingSystem: 'latn',
                calendar: 'gregory',
                error: err.message
            };
        }
    },

    /**
     * Get formatted timezone string
     * @returns {string} Formatted timezone (e.g., "America/New_York (EST)")
     */
    getFormattedTimezone() {
        const info = this.detect();
        
        try {
            const date = new Date();
            const formatter = new Intl.DateTimeFormat(info.locale, {
                timeZone: info.timeZone,
                timeZoneName: 'short'
            });
            
            const parts = formatter.formatToParts(date);
            const tzPart = parts.find(p => p.type === 'timeZoneName');
            const abbreviation = tzPart ? tzPart.value : '';
            
            return `${info.timeZone} (${abbreviation})`;
        } catch (err) {
            return info.timeZone;
        }
    },

    /**
     * Get current time in detected timezone
     * @returns {string} Formatted time string
     */
    getCurrentTime() {
        const info = this.detect();
        
        try {
            const formatter = new Intl.DateTimeFormat(info.locale, {
                timeZone: info.timeZone,
                dateStyle: 'medium',
                timeStyle: 'medium'
            });
            
            return formatter.format(new Date());
        } catch (err) {
            return new Date().toString();
        }
    },

    /**
     * Clear cache (for testing)
     */
    clearCache() {
        this.cachedResult = null;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimezoneDetector;
}
