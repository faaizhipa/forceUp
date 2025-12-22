/**
 * Alert Component
 * 
 * Dependencies:
 * - Preact (via preact-setup.js)
 * - class-variance-authority (variant management)
 * - lib-utils.js (cn function)
 */

import { html } from '../preact-setup.js'
import { cva } from 'https://esm.sh/class-variance-authority@0.7.0'
import { cn } from '../lib-utils.js'

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export function Alert({
  className,
  variant,
  children,
  ...props
}) {
  return html`
    <div
      data-slot="alert"
      role="alert"
      class=${cn(alertVariants({ variant }), className)}
      ...${props}
    >
      ${children}
    </div>
  `
}

export function AlertTitle({ className, children, ...props }) {
  return html`
    <div
      data-slot="alert-title"
      class=${cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      ...${props}
    >
      ${children}
    </div>
  `
}

export function AlertDescription({ className, children, ...props }) {
  return html`
    <div
      data-slot="alert-description"
      class=${cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      ...${props}
    >
      ${children}
    </div>
  `
}
