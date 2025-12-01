# Banner Design Pattern Analysis

**Date:** January 2025  
**Purpose:** Analysis of PersistentBanner design patterns and adaptation plan for Highlighter banner

---

## Executive Summary

The **PersistentBanner** module demonstrates sophisticated design patterns that create a professional, consistent, and maintainable UI. This document analyzes these patterns and provides a plan to adapt them to the **Highlighter banner** for visual and functional consistency.

---

## PersistentBanner Design Patterns

### 1. Structure & Layout

#### Section-Based Architecture
```html
<div class="exl-banner-container">
  <div class="exl-banner-section exl-banner-page-info">...</div>
  <div class="exl-banner-section exl-banner-metadata">...</div>
  <div class="exl-banner-section exl-banner-actions">...</div>
</div>
```

**Key Characteristics:**
- **Sections** (`.exl-banner-section`): Modular, reusable containers
- **Visual Separation**: Borders between sections (`border-right: 1px solid rgba(255, 255, 255, 0.1)`)
- **Flexible Layout**: Horizontal flexbox with overflow handling
- **Responsive**: Sections collapse/adapt on smaller screens

#### Container Pattern
```css
.exl-banner-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  max-width: 100%;
  height: 100%;
  flex-wrap: nowrap;
  overflow-x: auto;  /* Horizontal scrolling for overflow */
  overflow-y: hidden;
}
```

**Benefits:**
- Handles overflow gracefully with horizontal scrolling
- Maintains alignment across all sections
- Prevents layout shifts

### 2. Visual Design

#### Color Scheme
```css
/* Background gradient - Dark, professional */
background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);

/* Primary button color - Salesforce blue */
background-color: #0070d2;
background-color: #005fb2; /* hover */
background-color: #00396b; /* active */

/* Text colors */
color: #ffffff;        /* Primary text */
color: #d0d0d0;        /* Secondary text */
color: #a0a0a0;        /* Labels */
```

#### Typography
```css
font-family: 'Salesforce Sans', Arial, sans-serif;
font-size: 11px;       /* Base size */
font-size: 10px;       /* Labels (uppercase) */
font-size: 13px;       /* Page type badges */
font-weight: 600;      /* Labels */
font-weight: 700;      /* Page type */
```

**Typography Hierarchy:**
1. **Labels**: 10px, uppercase, letter-spacing: 0.3px, weight: 600
2. **Content**: 11px, normal weight
3. **Highlights**: 13px, weight: 700 (for badges)

### 3. Component Patterns

#### Label Pattern
```css
.exl-banner-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #a0a0a0;
  font-weight: 600;
  white-space: nowrap;
  margin-right: 4px;
}
```

**Usage:**
- Section headers ("Current Page", "Primary Metadata", "Navigation History")
- Provides context for section content
- Consistent visual hierarchy

#### Button Pattern
```css
.exl-banner-btn {
  background-color: #0070d2;
  color: #ffffff;
  border: none;
  border-radius: 3px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  height: 26px;
  line-height: 1;
}

.exl-banner-btn:hover {
  background-color: #005fb2;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.exl-banner-btn:active {
  background-color: #00396b;
  transform: translateY(0);
}
```

**Characteristics:**
- **Fixed Height**: 26px for consistent alignment
- **Smooth Transitions**: 0.15s ease
- **Visual Feedback**: Hover and active states
- **Consistent Sizing**: Padding and font size standardized

#### Badge/Page Type Pattern
```css
.exl-banner-page-type {
  font-size: 13px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 3px;
  background-color: rgba(255, 255, 255, 0.1);
  border-left: 3px solid #0070d2;  /* Color-coded left border */
  white-space: nowrap;
}
```

**Color Coding:**
- Different colors for different page types (case, home, list, report)
- Left border indicates category
- Semi-transparent background

### 4. Interaction Patterns

#### Hover States
```css
.exl-banner-history-item:hover {
  background-color: rgba(255, 255, 255, 0.15);
  border-left-color: #0070d2;  /* Accent border */
}
```

**Pattern:**
- Subtle background color change
- Border accent on hover
- Smooth transitions

#### Collapsible Sections
```css
.exl-collapsible-header {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 3px;
  transition: background-color 0.15s ease;
}

.exl-collapsible-header:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.exl-collapsible-header .exl-toggle-icon {
  transition: transform 0.3s ease;
}

.exl-collapsible-header[aria-expanded="true"] .exl-toggle-icon {
  transform: rotate(180deg);
}
```

**Features:**
- ARIA attributes for accessibility
- Smooth icon rotation animation
- Visual feedback on hover

### 5. Layout Adjustments

#### Page Content Push-Down
```css
/* Push Salesforce global header down */
#oneHeader > div.slds-global-header.slds-grid.slds-grid_align-spread {
  margin-top: 45px;
}

/* Push tab bar down */
body > div.desktop.container...tabsetHeader.slds-context-bar... {
  top: 95px;
}
```

**Pattern:**
- Adjusts host page layout to accommodate banner
- Prevents content overlap
- Applied early to prevent layout shifts

### 6. Scrollbar Styling

```css
.exl-banner-container::-webkit-scrollbar {
  height: 4px;  /* Thin horizontal scrollbar */
}

.exl-banner-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.exl-banner-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.exl-banner-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
```

**Purpose:**
- Custom styled scrollbars for better aesthetics
- Thin, unobtrusive horizontal scrollbar
- Hover feedback

### 7. Responsive Design

```css
@media (max-width: 1400px) {
  .exl-banner-container {
    gap: 10px;
    padding: 0 10px;
  }
}

@media (max-width: 1024px) {
  .exl-banner-section {
    padding: 0 6px;
  }
}
```

**Strategy:**
- Breakpoints at 1400px and 1024px
- Reduced gaps and padding on smaller screens
- Maintains functionality while optimizing space

---

## Highlighter Banner Current State

### Current Structure
```html
<div class="exl-hl-banner">
  <div class="exl-hl-banner-left">
    <h1 class="exl-hl-banner-title">✨ Highlighter</h1>
    <button class="exl-hl-btn">🖍️ Highlight</button>
  </div>
  <div class="exl-hl-banner-right">
    <!-- Color palette, buttons, etc. -->
  </div>
</div>
```

### Current Design
- **Two-part structure**: Left/right split
- **Color system**: Uses oklch colors
- **Gradient**: Different gradient pattern
- **Typography**: Inter font family
- **Buttons**: Different styling approach

### Differences from PersistentBanner
1. ❌ No section-based architecture
2. ❌ Different color system (oklch vs hex)
3. ❌ Different button styling
4. ❌ No label pattern
5. ❌ Simpler layout structure
6. ❌ Different typography approach

---

## Adaptation Plan

### Phase 1: Restructure HTML (Priority: High)

**Goal**: Adopt section-based architecture

**Changes:**
```html
<!-- BEFORE -->
<div class="exl-hl-banner">
  <div class="exl-hl-banner-left">...</div>
  <div class="exl-hl-banner-right">...</div>
</div>

<!-- AFTER -->
<div class="exl-hl-banner">
  <div class="exl-banner-container">
    <div class="exl-banner-section exl-hl-section-title">
      <div class="exl-banner-label">Tool</div>
      <div class="exl-banner-page-type">✨ Highlighter</div>
    </div>
    
    <div class="exl-banner-section exl-hl-section-palette">
      <div class="exl-banner-label">Colors</div>
      <div class="exl-hl-palette">...</div>
    </div>
    
    <div class="exl-banner-section exl-hl-section-actions">
      <button class="exl-banner-btn">🖍️ Highlight</button>
      <button class="exl-banner-btn">📝 Add Note</button>
      <!-- etc -->
    </div>
    
    <div class="exl-banner-section exl-hl-section-layers">
      <!-- Layer dropdown -->
    </div>
  </div>
</div>
```

### Phase 2: Update CSS (Priority: High)

**Goal**: Match PersistentBanner styling patterns

**Changes:**

1. **Container Pattern**
   ```css
   .exl-hl-banner {
     /* Match persistent banner base styles */
     position: fixed;
     top: 0;
     left: 0;
     right: 0;
     height: 3rem;
     background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
     color: #ffffff;
     z-index: 999999;
     font-family: 'Salesforce Sans', Arial, sans-serif;
     font-size: 11px;
   }
   
   /* Add container inside banner */
   .exl-hl-banner .exl-banner-container {
     /* Same as persistent banner */
   }
   ```

2. **Section Styling**
   ```css
   .exl-hl-banner .exl-banner-section {
     /* Match persistent banner sections */
   }
   ```

3. **Button Styling**
   ```css
   .exl-hl-banner .exl-banner-btn {
     /* Match persistent banner buttons */
   }
   ```

4. **Label Pattern**
   ```css
   .exl-hl-banner .exl-banner-label {
     /* Match persistent banner labels */
   }
   ```

### Phase 3: Color System Harmonization (Priority: Medium)

**Options:**

**Option A**: Convert oklch to hex (for consistency)
- Pro: Exact match with persistent banner
- Con: Loses oklch benefits

**Option B**: Keep oklch but map to similar hex values
- Pro: Maintains color accuracy
- Con: Slight visual difference

**Option C**: Convert persistent banner to oklch (future enhancement)
- Pro: Modern color system
- Con: Breaking change, requires testing

**Recommendation**: Option B for now (map oklch to hex equivalents)

### Phase 4: Typography Update (Priority: Medium)

**Changes:**
- Change font-family from Inter to 'Salesforce Sans', Arial, sans-serif
- Update font sizes to match persistent banner scale
- Add label pattern with uppercase, letter-spacing

### Phase 5: Enhanced Features (Priority: Low)

**Additions:**
- Collapsible sections for advanced options
- Scrollbar styling
- Responsive breakpoints
- Animation patterns

---

## Implementation Checklist

### HTML Structure
- [ ] Replace left/right structure with section-based layout
- [ ] Add `.exl-banner-container` wrapper
- [ ] Add section divs with appropriate classes
- [ ] Add labels to sections
- [ ] Update button markup to use `.exl-banner-btn`

### CSS Updates
- [ ] Update banner base styles to match persistent banner
- [ ] Add container styles
- [ ] Add section styles with borders
- [ ] Update button styles to match persistent banner
- [ ] Add label pattern styles
- [ ] Update color palette styling
- [ ] Add scrollbar styling
- [ ] Add responsive breakpoints
- [ ] Update typography

### JavaScript Updates
- [ ] Update `createBanner()` method to use new structure
- [ ] Update element references
- [ ] Update CSS class names in selectors
- [ ] Test all interactions

### Testing
- [ ] Visual comparison with persistent banner
- [ ] Functionality testing
- [ ] Responsive testing
- [ ] Cross-browser testing
- [ ] Accessibility testing

---

## Visual Consistency Goals

### Achieved Consistency
✅ Same gradient background  
✅ Same button styling  
✅ Same typography  
✅ Same section structure  
✅ Same spacing and gaps  
✅ Same hover states  
✅ Same responsive behavior  

### Functional Differences (Intentional)
- Highlighter banner: Color palette section
- Highlighter banner: Layer management section
- Persistent banner: Case metadata sections
- Persistent banner: Navigation history

---

## Conclusion

The PersistentBanner demonstrates excellent design patterns that create:
- **Consistency**: Predictable UI across features
- **Maintainability**: Reusable CSS patterns
- **Professionalism**: Polished, enterprise-grade appearance
- **Accessibility**: Proper ARIA attributes and semantic HTML

Adapting the Highlighter banner to these patterns will:
1. Improve visual consistency across the extension
2. Reduce CSS maintenance burden (shared patterns)
3. Enhance user experience (familiar UI patterns)
4. Provide foundation for future banner components

**Next Steps**: Implement Phase 1 and Phase 2 to achieve core consistency, then iterate on Phase 3-5 as needed.

