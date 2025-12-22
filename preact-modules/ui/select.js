/**
 * Select Component - Native <select> with Custom Styling
 * 
 * Simple, accessible select using native HTML with beautiful styling
 * No dependencies, works everywhere
 * 
 * Dependencies:
 * - Preact (via preact-setup.js)
 * - lib-utils.js (cn function)
 * - icons.js (ChevronDownIcon)
 */

import { html, useState, useRef, useEffect } from '../preact-setup.js'
import { cn } from '../lib-utils.js'
import { ChevronDownIcon } from '../icons.js'

export function Select({ value, onValueChange, children, ...props }) {
  return html`
    <div data-slot="select" ...${props}>
      ${children}
    </div>
  `
}

export function SelectGroup({ children, ...props }) {
  return html`
    <optgroup data-slot="select-group" ...${props}>
      ${children}
    </optgroup>
  `
}

export function SelectValue({ placeholder, children }) {
  return html`<span data-slot="select-value">${children || placeholder}</span>`
}

export function SelectTrigger({ 
  className, 
  size = 'default',
  value,
  onValueChange,
  children,
  ...props 
}) {
  const selectRef = useRef(null)
  const [displayValue, setDisplayValue] = useState('')

  useEffect(() => {
    if (selectRef.current) {
      const selectedOption = selectRef.current.options[selectRef.current.selectedIndex]
      setDisplayValue(selectedOption?.textContent || '')
    }
  }, [value])

  const handleChange = (e) => {
    const newValue = e.target.value
    setDisplayValue(e.target.options[e.target.selectedIndex].textContent)
    if (onValueChange) {
      onValueChange(newValue)
    }
  }

  return html`
    <div class="relative inline-block">
      <select
        ref=${selectRef}
        value=${value}
        onChange=${handleChange}
        data-slot="select-trigger"
        data-size=${size}
        class=${cn(
          "appearance-none cursor-pointer",
          "border-input data-[placeholder]:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-ring/50",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          "dark:bg-input/30 dark:hover:bg-input/50",
          "flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent",
          "px-3 py-2 pr-8 text-sm whitespace-nowrap shadow-xs",
          "transition-[color,box-shadow] outline-none",
          "focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          "data-[size=default]:h-9 data-[size=sm]:h-8",
          className
        )}
        ...${props}
      >
        ${children}
      </select>
      <div class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <${ChevronDownIcon} size=${14} class="text-muted-foreground opacity-50" />
      </div>
    </div>
  `
}

export function SelectContent({ children }) {
  // This is handled by native <select>, just pass through children
  return children
}

export function SelectItem({ value, children, className, ...props }) {
  return html`
    <option
      value=${value}
      data-slot="select-item"
      class=${cn(
        "focus:bg-accent focus:text-accent-foreground",
        "cursor-pointer py-1.5 px-2",
        className
      )}
      ...${props}
    >
      ${children}
    </option>
  `
}

export function SelectLabel({ children, className, ...props }) {
  return html`
    <option
      disabled
      data-slot="select-label"
      class=${cn("text-muted-foreground px-2 py-1.5 text-xs font-semibold", className)}
      ...${props}
    >
      ${children}
    </option>
  `
}

export function SelectSeparator({ className }) {
  // Native select doesn't support visual separators, but we can use disabled option
  return html`
    <option disabled data-slot="select-separator" class=${cn("bg-border pointer-events-none", className)}>
      ────────
    </option>
  `
}

// Simplified API for quick use
export function SimpleSelect({ 
  value, 
  onValueChange, 
  options = [], 
  placeholder = 'Select...',
  className,
  ...props 
}) {
  return html`
    <${SelectTrigger}
      value=${value}
      onValueChange=${onValueChange}
      class=${className}
      ...${props}
    >
      ${placeholder && !value && html`
        <${SelectItem} value="" disabled selected>${placeholder}<//>`
      }
      ${options.map(opt => {
        if (typeof opt === 'string') {
          return html`<${SelectItem} value=${opt}>${opt}<//>`
        }
        return html`<${SelectItem} value=${opt.value}>${opt.label || opt.value}<//>`
      })}
    <//>
  `
}
