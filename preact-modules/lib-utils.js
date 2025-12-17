/**
 * General Utility Functions
 * 
 * Dependencies:
 * - clsx (conditional class names)
 * - tailwind-merge (merge Tailwind classes)
 * 
 * Install via CDN:
 * - https://esm.sh/clsx@2
 * - https://esm.sh/tailwind-merge@2
 */

import { clsx } from 'https://esm.sh/clsx@2.0.0'
import { twMerge } from 'https://esm.sh/tailwind-merge@2.2.0'

/**
 * Combine and merge class names with Tailwind CSS support
 * @param {...any} inputs - Class values to merge
 * @returns {string} Merged class names
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
