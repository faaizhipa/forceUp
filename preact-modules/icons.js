/**
 * Inline SVG Icons
 * 
 * Simple icon system using inline SVG - zero dependencies
 * Icons are based on Heroicons/Phosphor design patterns
 * 
 * Usage:
 * ```js
 * import { CopyIcon, CheckIcon, CalendarIcon } from './icons.js'
 * 
 * html`
 *   <button>
 *     <${CopyIcon} size=${16} />
 *     Copy
 *   </button>
 * `
 * ```
 */

import { html } from './preact-setup.js'

// Default size
const DEFAULT_SIZE = 16

/**
 * Create SVG icon component
 * @param {string} path - SVG path data
 * @param {Object} defaults - Default props
 */
function createIcon(path, defaults = {}) {
  return ({ size = DEFAULT_SIZE, className = '', ...props }) => {
    return html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width=${size}
        height=${size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class=${className}
        ...${props}
      >
        <path d=${path} />
      </svg>
    `
  }
}

/**
 * Create SVG icon with multiple paths
 */
function createIconMulti(paths, defaults = {}) {
  return ({ size = DEFAULT_SIZE, className = '', ...props }) => {
    return html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width=${size}
        height=${size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class=${className}
        ...${props}
      >
        ${paths.map(p => html`<path d=${p} />`)}
      </svg>
    `
  }
}

// ============================================================================
// Icons
// ============================================================================

export const CopyIcon = createIconMulti([
  'M16 3H4v13',
  'M8 7h12v12H8z'
])

export const CheckIcon = createIcon('M20 6L9 17l-5-5')

export const XIcon = createIconMulti([
  'M18 6L6 18',
  'M6 6l12 12'
])

export const CalendarIcon = createIconMulti([
  'M3 9h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9z',
  'M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2',
  'M8 3v4',
  'M16 3v4'
])

export const ClockIcon = createIcon('M12 2v10l5 3M12 22a10 10 0 110-20 10 10 0 010 20z')

export const StarIcon = ({ size = DEFAULT_SIZE, className = '', filled = false, ...props }) => {
  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width=${size}
      height=${size}
      viewBox="0 0 24 24"
      fill=${filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class=${className}
      ...${props}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  `
}

export const GearIcon = createIcon('M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z')

export const WarningIcon = ({ size = DEFAULT_SIZE, className = '', ...props }) => {
  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width=${size}
      height=${size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class=${className}
      ...${props}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  `
}

export const ChevronDownIcon = createIcon('M6 9l6 6 6-6')

export const ChevronUpIcon = createIcon('M18 15l-6-6-6 6')

export const ChevronLeftIcon = createIcon('M15 18l-6-6 6-6')

export const ChevronRightIcon = createIcon('M9 18l6-6-6-6')

export const PlusIcon = createIconMulti([
  'M12 5v14',
  'M5 12h14'
])

export const MinusIcon = createIcon('M5 12h14')

export const SearchIcon = createIconMulti([
  'M11 19a8 8 0 100-16 8 8 0 000 16z',
  'M21 21l-4.35-4.35'
])

export const DotsIcon = ({ size = DEFAULT_SIZE, className = '', vertical = false, ...props }) => {
  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width=${size}
      height=${size}
      viewBox="0 0 24 24"
      fill="currentColor"
      class=${className}
      ...${props}
    >
      ${vertical ? html`
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      ` : html`
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      `}
    </svg>
  `
}

// Export all icons as an object for convenience
export const Icons = {
  Copy: CopyIcon,
  Check: CheckIcon,
  X: XIcon,
  Calendar: CalendarIcon,
  Clock: ClockIcon,
  Star: StarIcon,
  Gear: GearIcon,
  Warning: WarningIcon,
  ChevronDown: ChevronDownIcon,
  ChevronUp: ChevronUpIcon,
  ChevronLeft: ChevronLeftIcon,
  ChevronRight: ChevronRightIcon,
  Plus: PlusIcon,
  Minus: MinusIcon,
  Search: SearchIcon,
  Dots: DotsIcon
}
