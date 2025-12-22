/**
 * General Utility Functions
 * 
 * Dependencies:
 * - clsx (conditional class names)
 * - tailwind-merge (merge Tailwind classes)
 * 
 * Localized versions in same directory
 */

import { clsx } from './clsx.js'
import { twMerge } from './tailwind-merge.js'

/**
 * Combine and merge class names with Tailwind CSS support
 * @param {...any} inputs - Class values to merge
 * @returns {string} Merged class names
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
