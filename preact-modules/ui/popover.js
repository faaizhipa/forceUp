/**
 * Popover Component - Simple CSS-based Popover
 * 
 * Lightweight popover using CSS positioning
 * No heavy dependencies
 * 
 * Dependencies:
 * - Preact (via preact-setup.js)
 * - lib-utils.js (cn function)
 */

import { html, useState, useRef, useEffect } from '../preact-setup.js'
import { cn } from '../lib-utils.js'

export function Popover({ open: controlledOpen, onOpenChange, children }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const handleOpenChange = (newOpen) => {
    if (isControlled) {
      onOpenChange?.(newOpen)
    } else {
      setInternalOpen(newOpen)
    }
  }

  return html`
    <div data-slot="popover" data-open=${open}>
      ${typeof children === 'function' ? children({ open, setOpen: handleOpenChange }) : children}
    </div>
  `
}

export function PopoverTrigger({ asChild = false, children, ...props }) {
  const triggerRef = useRef(null)

  const handleClick = (e) => {
    e.stopPropagation()
    props.onClick?.(e)
    
    // Find parent Popover and toggle
    const popoverEl = e.target.closest('[data-slot="popover"]')
    if (popoverEl) {
      const isOpen = popoverEl.dataset.open === 'true'
      const event = new CustomEvent('popover-toggle', { 
        detail: { open: !isOpen },
        bubbles: true 
      })
      popoverEl.dispatchEvent(event)
    }
  }

  if (asChild) {
    // Clone child and add click handler
    return html`
      <div
        ref=${triggerRef}
        data-slot="popover-trigger"
        onClick=${handleClick}
        ...${props}
      >
        ${children}
      </div>
    `
  }

  return html`
    <button
      ref=${triggerRef}
      type="button"
      data-slot="popover-trigger"
      onClick=${handleClick}
      class="outline-none"
      ...${props}
    >
      ${children}
    </button>
  `
}

export function PopoverContent({ 
  className, 
  align = 'center',
  sideOffset = 4,
  children,
  ...props 
}) {
  const contentRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Position popover relative to trigger
    const updatePosition = () => {
      if (!contentRef.current) return
      
      const popover = contentRef.current.closest('[data-slot="popover"]')
      if (!popover) return
      
      const trigger = popover.querySelector('[data-slot="popover-trigger"]')
      if (!trigger) return
      
      const triggerRect = trigger.getBoundingClientRect()
      const contentRect = contentRef.current.getBoundingClientRect()
      
      let top = triggerRect.bottom + sideOffset
      let left = triggerRect.left
      
      // Adjust horizontal alignment
      if (align === 'center') {
        left = triggerRect.left + (triggerRect.width / 2) - (contentRect.width / 2)
      } else if (align === 'end') {
        left = triggerRect.right - contentRect.width
      }
      
      // Keep within viewport
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      if (left + contentRect.width > viewportWidth - 10) {
        left = viewportWidth - contentRect.width - 10
      }
      if (left < 10) {
        left = 10
      }
      
      if (top + contentRect.height > viewportHeight - 10) {
        // Position above trigger instead
        top = triggerRect.top - contentRect.height - sideOffset
      }
      
      setPosition({ top, left })
      setIsVisible(true)
    }

    const popover = contentRef.current?.closest('[data-slot="popover"]')
    if (popover?.dataset.open === 'true') {
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      
      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    } else {
      setIsVisible(false)
    }
  }, [align, sideOffset])

  // Handle popover-toggle event
  useEffect(() => {
    const handleToggle = (e) => {
      if (e.detail?.open === false) {
        setIsVisible(false)
      }
    }

    const popover = contentRef.current?.closest('[data-slot="popover"]')
    if (popover) {
      popover.addEventListener('popover-toggle', handleToggle)
      return () => popover.removeEventListener('popover-toggle', handleToggle)
    }
  }, [])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!contentRef.current) return
      
      const popover = contentRef.current.closest('[data-slot="popover"]')
      if (!popover || popover.dataset.open !== 'true') return
      
      if (!popover.contains(e.target)) {
        const event = new CustomEvent('popover-toggle', { 
          detail: { open: false },
          bubbles: true 
        })
        popover.dispatchEvent(event)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const popover = contentRef.current?.closest('[data-slot="popover"]')
  const isOpen = popover?.dataset.open === 'true'

  if (!isOpen || !isVisible) return null

  return html`
    <div
      ref=${contentRef}
      data-slot="popover-content"
      class=${cn(
        "fixed z-50 w-72 rounded-md border shadow-md outline-hidden",
        "bg-popover text-popover-foreground p-4",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      style=${{
        top: `${position.top}px`,
        left: `${position.left}px`
      }}
      ...${props}
    >
      ${children}
    </div>
  `
}

export function PopoverAnchor({ children, ...props }) {
  return html`
    <div data-slot="popover-anchor" ...${props}>
      ${children}
    </div>
  `
}

// Simple API helper
export function SimplePopover({ 
  trigger, 
  content, 
  open,
  onOpenChange,
  align = 'center',
  className
}) {
  return html`
    <${Popover} open=${open} onOpenChange=${onOpenChange}>
      <${PopoverTrigger} asChild>
        ${trigger}
      <//>
      <${PopoverContent} align=${align} class=${className}>
        ${content}
      <//>
    <//>
  `
}
