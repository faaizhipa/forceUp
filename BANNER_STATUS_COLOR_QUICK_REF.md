# Banner Status Color - Quick Reference

## Feature Summary
Dynamic banner background colors that change based on case status for instant visual feedback.

## Color Guide

| Status Category | RGB Color | Example Statuses |
|----------------|-----------|------------------|
| 🔴 **Red** | `rgb(178, 15, 66)` | New, New Email Received, Reopened |
| 🟠 **Orange** | `rgb(171, 46, 1)` | In Progress, Pending Action |
| 🟣 **Purple** | `rgb(100, 49, 179)` | Assigned to Resolver Group |
| 🟢 **Green** | `rgb(0, 100, 0)` | Solution Delivered to Customer |
| 🔵 **Blue** | `rgb(13, 83, 173)` | Closed, Pending Customer Response |
| 🟡 **Yellow** | `rgb(175, 96, 5)` | Pending System Update |

## How It Works

1. **Case Page Detection**: Banner checks if current page is a case page
2. **Status Extraction**: Reads case status from `currentPage.status`
3. **Color Lookup**: Matches status to predefined color mapping
4. **Gradient Application**: Creates gradient from base color to darker variant (70%)
5. **Fallback**: Non-case pages use default dark blue-gray gradient

## Visual Formula

```
Gradient = linear-gradient(135deg, BaseColor 0%, DarkerColor 100%)
DarkerColor = BaseColor × 0.7
```

## Code Locations

**Status Mapping**: `modules/persistentBanner.js` lines 41-77  
**Background Update**: `modules/persistentBanner.js` lines 1001-1064  
**Trigger**: Called in `updateBannerUI()` line 998

## Status → Color Mapping

### Red Statuses (Urgent)
- New Email Received
- Re-opened / Reopened
- Completed by Resolver Group
- New
- Update Received

### Orange Statuses (Active)
- Pending Action
- Initial Response Sent
- In Progress

### Purple Statuses (Assigned/Waiting)
- Assigned to Resolver Group
- Pending Internal Response
- Pending AM Response
- Pending QA Review

### Green Statuses (Resolved)
- Solution Delivered to Customer

### Blue Statuses (Closed/Customer)
- Closed
- Pending Customer Response

### Yellow Statuses (System)
- Pending System Update - Defect
- Pending System Update - Enhancement
- Pending System Update - Other

## Example Outputs

**New Case:**
```
Status: "New Email Received"
Background: Red gradient (178, 15, 66) → (124, 10, 46)
```

**Active Case:**
```
Status: "In Progress"
Background: Orange gradient (171, 46, 1) → (119, 32, 0)
```

**Resolved Case:**
```
Status: "Solution Delivered to Customer"
Background: Green gradient (0, 100, 0) → (0, 70, 0)
```

**Non-Case Page:**
```
Background: Default gradient #1a1a2e → #16213e
```

## Testing Quick Check

Navigate to different case pages and verify:
- ✅ Banner changes color based on status
- ✅ Color matches status category (red=urgent, green=resolved, etc.)
- ✅ Text remains readable
- ✅ Returns to default on non-case pages

## Troubleshooting

**Banner not changing color?**
→ Check console for status value and verify exact match in STATUS_COLORS

**Gradient too dark?**
→ Adjust multiplier in createStatusGradient() (currently 0.7)

**Unknown status?**
→ Add new status to STATUS_COLORS mapping

---

**Feature Status**: ✅ Active  
**Performance Impact**: Minimal (CSS gradient only)  
**Browser Support**: All modern browsers
