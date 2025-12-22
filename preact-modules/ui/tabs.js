/**
 * Tabs Component - Custom Implementation (No Radix UI)
 * 
 * Dependencies:
 * - Preact (via preact-setup.js)
 * - lib-utils.js (cn function)
 * 
 * Simplified tabs implementation using Preact state.
 */

import { html, useState, useEffect } from '../preact-setup.js'
import { cn } from '../lib-utils.js'

export function Tabs({ className, value, onValueChange, defaultValue, children, ...props }) {
  const [activeTab, setActiveTab] = useState(value || defaultValue || '')

  useEffect(() => {
    if (value !== undefined) {
      setActiveTab(value)
    }
  }, [value])

  const handleTabChange = (newValue) => {
    setActiveTab(newValue)
    onValueChange?.(newValue)
  }

  return html`
    <div
      data-slot="tabs"
      data-value=${activeTab}
      class=${cn("flex flex-col gap-2", className)}
      ...${props}
    >
      ${typeof children === 'function' 
        ? children({ activeTab, handleTabChange })
        : children}
    </div>
  `
}

export function TabsList({ className, children, ...props }) {
  return html`
    <div
      data-slot="tabs-list"
      class=${cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      ...${props}
    >
      ${children}
    </div>
  `
}

export function TabsTrigger({ className, value, children, ...props }) {
  // Get parent tabs context - passed via data attributes or props
  const handleClick = () => {
    // Dispatch custom event for parent to catch
    const event = new CustomEvent('tab-change', { 
      detail: { value },
      bubbles: true 
    })
    props.onClick?.(event)
  }

  return html`
    <button
      type="button"
      role="tab"
      data-slot="tabs-trigger"
      data-value=${value}
      onClick=${handleClick}
      class=${cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      ...${props}
    >
      ${children}
    </button>
  `
}

export function TabsContent({ className, value, children, ...props }) {
  return html`
    <div
      data-slot="tabs-content"
      data-value=${value}
      role="tabpanel"
      class=${cn("flex-1 outline-none", className)}
      ...${props}
    >
      ${children}
    </div>
  `
}

/**
 * Enhanced Tabs wrapper that manages state internally
 * Usage:
 * <TabsGroup value={activeTab} onValueChange={setActiveTab}>
 *   <TabsList>
 *     <TabsTrigger value="tab1">Tab 1</TabsTrigger>
 *     <TabsTrigger value="tab2">Tab 2</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="tab1">Content 1</TabsContent>
 *   <TabsContent value="tab2">Content 2</TabsContent>
 * </TabsGroup>
 */
export function TabsGroup({ value, onValueChange, defaultValue, className, children }) {
  const [activeTab, setActiveTab] = useState(value || defaultValue || '')

  useEffect(() => {
    if (value !== undefined && value !== activeTab) {
      setActiveTab(value)
    }
  }, [value])

  const handleTabChange = (e) => {
    if (e.detail?.value) {
      setActiveTab(e.detail.value)
      onValueChange?.(e.detail.value)
    }
  }

  return html`
    <div 
      class=${cn("flex flex-col gap-2", className)}
      onTabChange=${handleTabChange}
    >
      ${Array.isArray(children) ? children.map(child => {
        // Clone children and add active state
        if (child?.props?.['data-slot'] === 'tabs-trigger') {
          const isActive = child.props['data-value'] === activeTab
          return html`<${child.type} ...${child.props} data-state=${isActive ? 'active' : 'inactive'} />`
        }
        if (child?.props?.['data-slot'] === 'tabs-content') {
          const isActive = child.props['data-value'] === activeTab
          if (!isActive) return null
          return child
        }
        return child
      }) : children}
    </div>
  `
}
