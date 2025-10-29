/**
 * Style Utilities Module
 * 
 * Provides utilities for applying styles and visual enhancements
 * to DOM elements, including row highlighting and status badges.
 */

/**
 * Highlights a table row with the specified background color.
 * @param {HTMLElement} row The table row element (`<tr>`) to be highlighted.
 * @param {string} color The CSS color string (e.g., 'red', 'rgb(255, 220, 230)') to apply as the background.
 */
export function highlightRow(row, color) {
    row.style.backgroundColor = color;
}

/**
 * Generates a CSS style string for creating colored status badges.
 * @param {string} color The background color for the badge.
 * @returns {string} A CSS style string used for inline styling.
 */
export function generateStatusStyle(color) {
    return `background-color: ${color}; border-radius: 6px; padding: 3px 6px; color: white; font-weight: 500;`;
}

/**
 * Applies field highlighting based on content status.
 * @param {HTMLElement} element The element to highlight.
 * @param {boolean} isEmpty Whether the field is empty.
 */
export function highlightField(element, isEmpty = false) {
    const color = isEmpty ? "rgb(191,39,75)" : "rgb(251,178,22)";
    element.style.backgroundColor = color;
    element.style.color = "white";
    element.style.padding = "2px 4px";
    element.style.borderRadius = "3px";
}

/**
 * Creates a styled button element with consistent styling.
 * @param {string} text Button text.
 * @param {string} [variant='primary'] Button variant ('primary', 'secondary', 'danger').
 * @returns {HTMLButtonElement} Styled button element.
 */
export function createStyledButton(text, variant = 'primary') {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = `slds-button slds-button_${variant}`;
    
    // Add consistent styling
    Object.assign(button.style, {
        margin: '2px',
        fontSize: '12px',
        padding: '4px 8px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: '500'
    });

    // Variant-specific colors
    const colors = {
        primary: { background: '#0176d3', color: 'white' },
        secondary: { background: '#f3f3f3', color: '#080707' },
        danger: { background: '#c23934', color: 'white' }
    };

    const variantColors = colors[variant] || colors.primary;
    Object.assign(button.style, variantColors);

    // Hover effects
    button.addEventListener('mouseenter', () => {
        button.style.opacity = '0.8';
    });
    
    button.addEventListener('mouseleave', () => {
        button.style.opacity = '1';
    });

    return button;
}

/**
 * Creates a container for grouping related buttons.
 * @param {HTMLElement[]} buttons Array of button elements to group.
 * @returns {HTMLDivElement} Container with grouped buttons.
 */
export function createButtonGroup(buttons) {
    const container = document.createElement('div');
    container.className = 'button-group';
    container.style.display = 'flex';
    container.style.gap = '4px';
    container.style.flexWrap = 'wrap';
    container.style.alignItems = 'center';

    buttons.forEach(button => container.appendChild(button));
    return container;
}