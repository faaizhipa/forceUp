/**
 * Dialog Component - Custom Implementation (No Radix UI)
 * 
 * Dependencies:
 * - Preact (via preact-setup.js)
 * - lib-utils.js (cn function)
 * 
 * This is a simplified dialog implementation that doesn't require Radix UI.
 * Uses native HTML dialog element with Preact state management.
 */

import { html, useEffect, useRef } from '../preact-setup.js'
import { cn } from '../lib-utils.js'

export function Dialog({ open, onOpenChange, children }) {
  return html`
    <div data-slot="dialog">
      ${children}
    </div>
  `
}

export function DialogTrigger({ children, ...props }) {
  return html`
    <div data-slot="dialog-trigger" ...${props}>
      ${children}
    </div>
  `
}

export function DialogPortal({ children }) {
  return html`<div data-slot="dialog-portal">${children}</div>`
}

export function DialogClose({ children, className, ...props }) {
  return html`
    <button
      data-slot="dialog-close"
      class=${cn("outline-none", className)}
      ...${props}
    >
      ${children}
    </button>
  `
}

export function DialogOverlay({ className, onClick }) {
  return html`
    <div
      data-slot="dialog-overlay"
      class=${cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      onClick=${onClick}
    />
  `
}

export function DialogContent({ className, children, open, onOpenChange }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onOpenChange?.(false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  useEffect(() => {
    // Prevent body scroll when dialog is open
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onOpenChange?.(false)
    }
  }

  // X icon SVG
  const XIcon = html`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `

  return html`
    <${DialogPortal}>
      <${DialogOverlay} onClick=${handleOverlayClick} />
      <div
        ref=${dialogRef}
        data-slot="dialog-content"
        class=${cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
      >
        ${children}
        <button
          onClick=${() => onOpenChange?.(false)}
          class="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          ${XIcon}
          <span class="sr-only">Close</span>
        </button>
      </div>
    <//>
  `
}

export function DialogHeader({ className, children, ...props }) {
  return html`
    <div
      data-slot="dialog-header"
      class=${cn("flex flex-col gap-2 text-center sm:text-left", className)}
      ...${props}
    >
      ${children}
    </div>
  `
}

export function DialogFooter({ className, children, ...props }) {
  return html`
    <div
      data-slot="dialog-footer"
      class=${cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      ...${props}
    >
      ${children}
    </div>
  `
}

export function DialogTitle({ className, children, ...props }) {
  return html`
    <h2
      data-slot="dialog-title"
      class=${cn("text-lg leading-none font-semibold", className)}
      ...${props}
    >
      ${children}
    </h2>
  `
}

export function DialogDescription({ className, children, ...props }) {
  return html`
    <p
      data-slot="dialog-description"
      class=${cn("text-muted-foreground text-sm", className)}
      ...${props}
    >
      ${children}
    </p>
  `
}
