/**
 * Calendar Component - Using Flatpickr
 * 
 * Simple date picker using Flatpickr library
 * Lightweight and full-featured
 * 
 * Dependencies:
 * - Preact (via preact-setup.js)
 * - Flatpickr (date picker library)
 * - lib-utils.js (cn function)
 */

import { html, useEffect, useRef } from '../preact-setup.js'
import { cn } from '../lib-utils.js'

// Import Flatpickr dynamically
let flatpickr = null
const loadFlatpickr = async () => {
  if (!flatpickr) {
    const module = await import('https://esm.sh/flatpickr@4.6.13')
    flatpickr = module.default
    
    // Load CSS
    if (!document.getElementById('flatpickr-css')) {
      const link = document.createElement('link')
      link.id = 'flatpickr-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css'
      document.head.appendChild(link)
    }
  }
  return flatpickr
}

export function Calendar({
  mode = 'single',
  selected,
  onSelect,
  className,
  showOutsideDays = true,
  disabled,
  ...props
}) {
  const inputRef = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    let instance = null

    const init = async () => {
      if (!inputRef.current) return
      
      const fp = await loadFlatpickr()
      
      // Destroy existing instance
      if (instanceRef.current) {
        instanceRef.current.destroy()
      }

      const config = {
        inline: true,
        mode: mode === 'range' ? 'range' : 'single',
        defaultDate: selected,
        onChange: (selectedDates) => {
          if (onSelect) {
            if (mode === 'range') {
              onSelect(selectedDates)
            } else {
              onSelect(selectedDates[0])
            }
          }
        },
        disable: disabled || [],
        ...props
      }

      instance = fp(inputRef.current, config)
      instanceRef.current = instance
    }

    init()

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy()
        instanceRef.current = null
      }
    }
  }, [mode, disabled, showOutsideDays])

  // Update selected date when prop changes
  useEffect(() => {
    if (instanceRef.current && selected) {
      instanceRef.current.setDate(selected, false)
    }
  }, [selected])

  return html`
    <div class=${cn('p-3', className)}>
      <input
        ref=${inputRef}
        type="text"
        class="hidden"
        data-slot="calendar"
      />
    </div>
  `
}

/**
 * Simple inline calendar using native input[type=date]
 * Fallback for when Flatpickr is not available or needed
 */
export function SimpleCalendar({
  selected,
  onSelect,
  className,
  min,
  max,
  ...props
}) {
  const handleChange = (e) => {
    const dateValue = e.target.value
    if (dateValue && onSelect) {
      onSelect(new Date(dateValue))
    }
  }

  const formatDate = (date) => {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    return d.toISOString().split('T')[0]
  }

  return html`
    <div class=${cn('p-3', className)}>
      <input
        type="date"
        value=${formatDate(selected)}
        onChange=${handleChange}
        min=${min ? formatDate(min) : undefined}
        max=${max ? formatDate(max) : undefined}
        data-slot="calendar"
        class=${cn(
          "w-full px-3 py-2 rounded-md border border-input",
          "bg-background text-foreground",
          "focus:border-ring focus:ring-2 focus:ring-ring/50",
          "outline-none"
        )}
        ...${props}
      />
    </div>
  `
}
