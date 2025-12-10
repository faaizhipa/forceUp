/**
 * Text Formatter Module
 * Provides Unicode-based text formatting for case comments
 */

const TextFormatter = {
  // Character mapping tables
  characterMaps: {
    bold: {
      lowercase: '𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇',
      uppercase: '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭',
      digits: '𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵'
    },
    boldItalic: {
      lowercase: '𝙖𝙗𝙘𝙙𝙚𝙛𝙜𝙝𝙞𝙟𝙠𝙡𝙢𝙣𝙤𝙥𝙦𝙧𝙨𝙩𝙪𝙫𝙬𝙭𝙮𝙯',
      uppercase: '𝘼𝘽𝘾𝘿𝙀𝙁𝙂𝙃𝙄𝙅𝙆𝙇𝙈𝙉𝙊𝙋𝙌𝙍𝙎𝙏𝙐𝙑𝙒𝙓𝙔𝙕',
      digits: '0123456789' // No bold italic digits in Unicode
    },
    italic: {
      lowercase: '𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻',
      uppercase: '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡',
      digits: '0123456789' // No italic digits in Unicode
    },
    boldSerif: {
      lowercase: '𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳',
      uppercase: '𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙',
      digits: '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗'
    },
    code: {
      lowercase: '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣',
      uppercase: '𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉',
      digits: '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿'
    },
    normal: {
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      digits: '0123456789'
    }
  },

  /**
   * Converts text from any style to target style (normalizes first)
   * @param {string} text
   * @param {string} style
   * @returns {string}
   */
  convertStyle(text, style) {
    if (!style || style === 'normal') {
      return this.convertToNormal(text);
    }
    const base = this.convertToNormal(text);
    return this.convertToStyle(base, style);
  },

  // Bullet symbols
  symbols: ['▪', '∘', '▫', '►', '▻', '▸', '▹', '▿', '▾', '⋯', '⋮'],

  /**
   * Converts text to specified style
   * @param {string} text - Input text
   * @param {string} style - Style name (bold, italic, etc.)
   * @returns {string} Formatted text
   */
  convertToStyle(text, style) {
    if (!this.characterMaps[style]) return text;

    const map = this.characterMaps[style];
    const normal = this.characterMaps.normal;
    let result = '';

    // Convert text to array to properly handle multi-byte characters
    const chars = Array.from(text);
    
    for (let char of chars) {
      const lowerIndex = normal.lowercase.indexOf(char);
      const upperIndex = normal.uppercase.indexOf(char);
      const digitIndex = normal.digits.indexOf(char);

      if (lowerIndex !== -1) {
        // Get character from styled alphabet using Array.from for proper Unicode handling
        const styledChars = Array.from(map.lowercase);
        result += styledChars[lowerIndex] || char;
      } else if (upperIndex !== -1) {
        const styledChars = Array.from(map.uppercase);
        result += styledChars[upperIndex] || char;
      } else if (digitIndex !== -1) {
        const styledChars = Array.from(map.digits);
        result += styledChars[digitIndex] || char;
      } else {
        // Keep other characters unchanged
        result += char;
      }
    }

    return result;
  },

  /**
   * Converts formatted text back to normal
   * @param {string} text - Formatted text
   * @returns {string} Normal text
   */
  convertToNormal(text) {
    let result = '';
    const normal = this.characterMaps.normal;

    // Convert text to array to properly handle multi-byte characters
    const chars = Array.from(text);

    for (let char of chars) {
      let found = false;

      // Check each style map
      for (let style in this.characterMaps) {
        if (style === 'normal') continue;

        const map = this.characterMaps[style];

        // Use Array.from to properly handle Unicode characters
        const lowerChars = Array.from(map.lowercase);
        const upperChars = Array.from(map.uppercase);
        const digitChars = Array.from(map.digits);

        const lowerIndex = lowerChars.indexOf(char);
        const upperIndex = upperChars.indexOf(char);
        const digitIndex = digitChars.indexOf(char);

        if (lowerIndex !== -1) {
          result += normal.lowercase[lowerIndex];
          found = true;
          break;
        } else if (upperIndex !== -1) {
          result += normal.uppercase[upperIndex];
          found = true;
          break;
        } else if (digitIndex !== -1) {
          result += normal.digits[digitIndex];
          found = true;
          break;
        }
      }

      if (!found) {
        result += char;
      }
    }

    return result;
  },

  /**
   * Detects the current style of text
   * @param {string} text
   * @returns {string} Style name or 'normal' or 'mixed'
   */
  detectStyle(text) {
    const styles = {};
    const chars = Array.from(text);

    for (let char of chars) {
      for (let style in this.characterMaps) {
        if (style === 'normal') continue;

        const map = this.characterMaps[style];
        const lowerChars = Array.from(map.lowercase);
        const upperChars = Array.from(map.uppercase);
        const digitChars = Array.from(map.digits);
        
        if (lowerChars.includes(char) ||
            upperChars.includes(char) ||
            digitChars.includes(char)) {
          styles[style] = (styles[style] || 0) + 1;
        }
      }
    }

    if (Object.keys(styles).length === 0) return 'normal';
    if (Object.keys(styles).length > 1) return 'mixed';

    return Object.keys(styles)[0];
  },

  /**
   * Toggles case of text while preserving formatting
   * @param {string} text
   * @returns {string}
   */
  toggleCase(text) {
    // Detect current style
    const style = this.detectStyle(text);

    // Convert to normal for case manipulation
    const normalText = this.convertToNormal(text);

    // Toggle case
    let result = '';
    for (let char of normalText) {
      if (char === char.toUpperCase()) {
        result += char.toLowerCase();
      } else {
        result += char.toUpperCase();
      }
    }

    // Re-apply style if not normal
    if (style !== 'normal' && style !== 'mixed') {
      return this.convertToStyle(result, style);
    }

    return result;
  },

  /**
   * Converts to Capital Case (First Letter Of Each Word)
   * @param {string} text
   * @returns {string}
   */
  toCapitalCase(text) {
    const style = this.detectStyle(text);
    const normalText = this.convertToNormal(text);

    const words = normalText.split(/(\s+)/);
    const result = words.map(word => {
      if (word.trim() === '') return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join('');

    if (style !== 'normal' && style !== 'mixed') {
      return this.convertToStyle(result, style);
    }

    return result;
  },

  /**
   * Converts to Sentence case (First letter capitalized)
   * @param {string} text
   * @returns {string}
   */
  toSentenceCase(text) {
    const style = this.detectStyle(text);
    const normalText = this.convertToNormal(text);

    const result = normalText.charAt(0).toUpperCase() + normalText.slice(1).toLowerCase();

    if (style !== 'normal' && style !== 'mixed') {
      return this.convertToStyle(result, style);
    }

    return result;
  },

  /**
   * Converts to lowercase
   * @param {string} text
   * @returns {string}
   */
  toLowerCase(text) {
    const style = this.detectStyle(text);
    const normalText = this.convertToNormal(text);
    const result = normalText.toLowerCase();

    if (style !== 'normal' && style !== 'mixed') {
      return this.convertToStyle(result, style);
    }

    return result;
  },

  /**
   * Gets all available styles
   * @returns {Array} Array of style names
   */
  getAvailableStyles() {
    return Object.keys(this.characterMaps).filter(s => s !== 'normal');
  },

  /**
   * Gets all available symbols
   * @returns {Array} Array of symbols
   */
  getAvailableSymbols() {
    return this.symbols;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TextFormatter;
}
