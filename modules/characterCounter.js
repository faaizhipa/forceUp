/**
 * Character Counter Module
 * Displays character count for case comment textarea
 */

const CharacterCounter = {
  maxLength: 4000, // Salesforce case comment limit

  /**
   * Initializes character counter
   */
  init() {
    this.addCounter();
  },

  /**
   * Gets the textarea element
   * @returns {HTMLTextAreaElement|null}
   */
  getTextarea() {
    return document.querySelector('textarea[name="inputComment"]');
  },

  /**
   * Finds the button row where counter should be placed
   * @returns {HTMLElement|null}
   */
  findButtonRow() {
    const textarea = this.getTextarea();
    if (!textarea) return null;

    // Look for a button near the textarea
    let current = textarea.parentElement;
    while (current && current !== document.body) {
      const buttons = current.querySelectorAll('button');
      if (buttons.length > 0) {
        return buttons[0].parentElement;
      }
      current = current.parentElement;
    }

    return null;
  },

  /**
   * Creates counter element
   * @returns {HTMLElement}
   */
  createCounter() {
    const counter = document.createElement('div');
    counter.className = 'case-comment-character-counter';
    counter.style.cssText = `
      display: inline-block;
      font-size: 12px;
      color: #666;
      padding: 6px 12px;
      margin-right: auto;
    `;

    counter.innerHTML = `
      <span class="counter-current">0</span> / <span class="counter-max">${this.maxLength}</span>
    `;

    return counter;
  },

  /**
   * Updates counter display
   * @param {HTMLElement} counter
   * @param {number} length
   */
  updateCounter(counter, length) {
    const currentSpan = counter.querySelector('.counter-current');
    currentSpan.textContent = length;

    // Change color based on usage
    if (length > this.maxLength) {
      counter.style.color = 'rgb(191, 39, 75)'; // Red
      counter.style.fontWeight = 'bold';
    } else if (length > this.maxLength * 0.9) {
      counter.style.color = 'rgb(247, 114, 56)'; // Orange
      counter.style.fontWeight = 'bold';
    } else if (length > this.maxLength * 0.75) {
      counter.style.color = 'rgb(251, 178, 22)'; // Yellow
      counter.style.fontWeight = 'normal';
    } else {
      counter.style.color = '#666'; // Gray
      counter.style.fontWeight = 'normal';
    }
  },

  /**
   * Adds counter to UI
   */
  addCounter() {
    const textarea = this.getTextarea();
    if (!textarea) {
      // Retry after delay
      setTimeout(() => this.addCounter(), 1000);
      return;
    }

    // Check if counter already exists
    if (document.querySelector('.case-comment-character-counter')) {
      return;
    }

    const buttonRow = this.findButtonRow();
    if (!buttonRow) {
      console.warn('[CharacterCounter] Could not find button row');
      return;
    }

    // Create counter
    const counter = this.createCounter();

    // Add counter to left of button row
    if (buttonRow.style.display !== 'flex') {
      buttonRow.style.display = 'flex';
      buttonRow.style.alignItems = 'center';
      buttonRow.style.gap = '8px';
    }

    buttonRow.insertBefore(counter, buttonRow.firstChild);

    // Initial count
    this.updateCounter(counter, textarea.value.length);

    // Throttle counter updates to avoid excessive DOM updates during fast typing
    const throttledUpdate = DebounceUtils.throttle((length) => {
      this.updateCounter(counter, length);
    }, 100); // Update at most every 100ms

    // Listen for changes
    textarea.addEventListener('input', () => {
      throttledUpdate(textarea.value.length);
    });

    console.log('[CharacterCounter] Counter added');
  },

  /**
   * Removes counter
   */
  remove() {
    const counter = document.querySelector('.case-comment-character-counter');
    if (counter) {
      counter.remove();
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CharacterCounter;
}
