/**
 * AddressTimezoneResolver Module
 * Maps addresses to timezones using state/country-based lookup
 */

const AddressTimezoneResolver = {
    /**
     * Timezone mappings by US state
     */
    US_STATE_TIMEZONES: {
        // Eastern Time
        'CT': 'America/New_York', 'DE': 'America/New_York', 'FL': 'America/New_York',
        'GA': 'America/New_York', 'ME': 'America/New_York', 'MD': 'America/New_York',
        'MA': 'America/New_York', 'NH': 'America/New_York', 'NJ': 'America/New_York',
        'NY': 'America/New_York', 'NC': 'America/New_York', 'OH': 'America/New_York',
        'PA': 'America/New_York', 'RI': 'America/New_York', 'SC': 'America/New_York',
        'VT': 'America/New_York', 'VA': 'America/New_York', 'WV': 'America/New_York',

        // Central Time
        'AL': 'America/Chicago', 'AR': 'America/Chicago', 'IL': 'America/Chicago',
        'IN': 'America/Chicago', 'IA': 'America/Chicago', 'KS': 'America/Chicago',
        'KY': 'America/Chicago', 'LA': 'America/Chicago', 'MI': 'America/Chicago',
        'MN': 'America/Chicago', 'MS': 'America/Chicago', 'MO': 'America/Chicago',
        'NE': 'America/Chicago', 'OK': 'America/Chicago', 'SD': 'America/Chicago',
        'TN': 'America/Chicago', 'TX': 'America/Chicago', 'WI': 'America/Chicago',

        // Mountain Time
        'AZ': 'America/Phoenix', 'CO': 'America/Denver', 'ID': 'America/Denver',
        'MT': 'America/Denver', 'NM': 'America/Denver', 'ND': 'America/Denver',
        'UT': 'America/Denver', 'WY': 'America/Denver',

        // Pacific Time
        'CA': 'America/Los_Angeles', 'NV': 'America/Los_Angeles',
        'OR': 'America/Los_Angeles', 'WA': 'America/Los_Angeles',

        // Alaska & Hawaii
        'AK': 'America/Anchorage',
        'HI': 'Pacific/Honolulu'
    },

    /**
     * Timezone mappings by country (fallback)
     */
    COUNTRY_TIMEZONES: {
        'United States': 'America/New_York', // Default to Eastern
        'Canada': 'America/Toronto',
        'Mexico': 'America/Mexico_City',
        'United Kingdom': 'Europe/London',
        'UK': 'Europe/London',
        'France': 'Europe/Paris',
        'Germany': 'Europe/Berlin',
        'Spain': 'Europe/Madrid',
        'Italy': 'Europe/Rome',
        'Netherlands': 'Europe/Amsterdam',
        'Belgium': 'Europe/Brussels',
        'Switzerland': 'Europe/Zurich',
        'Austria': 'Europe/Vienna',
        'Sweden': 'Europe/Stockholm',
        'Norway': 'Europe/Oslo',
        'Denmark': 'Europe/Copenhagen',
        'Finland': 'Europe/Helsinki',
        'Poland': 'Europe/Warsaw',
        'Ireland': 'Europe/Dublin',
        'Portugal': 'Europe/Lisbon',
        'Greece': 'Europe/Athens',
        'Australia': 'Australia/Sydney',
        'New Zealand': 'Pacific/Auckland',
        'Japan': 'Asia/Tokyo',
        'China': 'Asia/Shanghai',
        'India': 'Asia/Kolkata',
        'Singapore': 'Asia/Singapore',
        'Hong Kong': 'Asia/Hong_Kong',
        'South Korea': 'Asia/Seoul',
        'Brazil': 'America/Sao_Paulo',
        'Argentina': 'America/Argentina/Buenos_Aires',
        'Chile': 'America/Santiago',
        'South Africa': 'Africa/Johannesburg'
    },

    /**
     * Resolve timezone from address
     * @param {Object} address - Address object with street, city, state, postalCode, country
     * @returns {Promise<string|null>} - IANA timezone string or null
     */
    async resolveTimezone(address) {
        if (!address) {
            console.warn('[AddressTimezoneResolver] No address provided');
            return null;
        }

        console.log('[AddressTimezoneResolver] Resolving timezone for address:', address);

        // Try US state-based lookup first
        if (address.state) {
            const stateCode = this.normalizeStateCode(address.state);
            const timezone = this.US_STATE_TIMEZONES[stateCode];
            
            if (timezone) {
                console.log(`[AddressTimezoneResolver] Resolved by state (${stateCode}):`, timezone);
                return timezone;
            }
        }

        // Fallback to country-based lookup
        if (address.country) {
            const timezone = this.COUNTRY_TIMEZONES[address.country];
            
            if (timezone) {
                console.log(`[AddressTimezoneResolver] Resolved by country (${address.country}):`, timezone);
                return timezone;
            }
        }

        // No timezone found
        console.warn('[AddressTimezoneResolver] Could not resolve timezone for address:', address);
        return null;
    },

    /**
     * Normalize state code to uppercase 2-letter format
     * @param {string} state
     * @returns {string}
     */
    normalizeStateCode(state) {
        if (!state) return '';
        
        // If already 2 characters, just uppercase
        if (state.length === 2) {
            return state.toUpperCase();
        }

        // Map full state names to codes
        const stateNameMap = {
            'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
            'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
            'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
            'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
            'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
            'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
            'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
            'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
            'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
            'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
            'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
            'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
            'wisconsin': 'WI', 'wyoming': 'WY'
        };

        const normalized = state.toLowerCase().trim();
        return stateNameMap[normalized] || state.toUpperCase();
    },

    /**
     * Get timezone by state code
     * @param {string} stateCode - 2-letter state code
     * @returns {string|null}
     */
    getTimezoneByState(stateCode) {
        const normalized = this.normalizeStateCode(stateCode);
        return this.US_STATE_TIMEZONES[normalized] || null;
    },

    /**
     * Get timezone by country
     * @param {string} country - Country name
     * @returns {string|null}
     */
    getTimezoneByCountry(country) {
        return this.COUNTRY_TIMEZONES[country] || null;
    },

    /**
     * Check if timezone is valid IANA timezone
     * @param {string} timezone
     * @returns {boolean}
     */
    isValidTimezone(timezone) {
        if (!timezone) return false;
        
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
            return true;
        } catch (error) {
            return false;
        }
    }
};
