/**
 * StatusDot Component
 * Visual indicator for timezone status (business/awake/sleep)
 * 
 * Dependencies:
 * - lib-utils.js (cn function)
 */

import { html } from '../preact-setup.js'
import { cn } from '../lib-utils.js'

export function StatusDot({ status, className }) {
  const colors = {
    business: 'bg-[var(--status-business)]',
    awake: 'bg-[var(--status-awake)]',
    sleep: 'bg-[var(--status-sleep)]'
  }

  const style = {
    boxShadow: status === 'business' ? '0 0 8px var(--status-business)' : 
               status === 'awake' ? '0 0 8px var(--status-awake)' : 'none'
  }

  return html`
    <div
      class=${cn(
        'w-2.5 h-2.5 rounded-full transition-colors duration-300',
        colors[status],
        className
      )}
      style=${style}
    />
  `
}
