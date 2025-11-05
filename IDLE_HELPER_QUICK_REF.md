# Idle Helper Quick Reference

## What It Does
Triggers PageIdentifier callback after 2 seconds of page stability to ensure modules initialize even when no changes are detected.

## Key Console Messages

### When Working
```
[UrlChangeMonitor] Idle helper enabled (2000ms delay)
[UrlChangeMonitor] No significant changes detected
[UrlChangeMonitor] Starting idle helper timer (2000ms)
[UrlChangeMonitor] Idle period detected - triggering idle helper callback
PageIdentifier: Idle period detected, triggering callback for stable page
[UrlChangeMonitor] Idle helper disabled
```

### When Changes Occur
```
[UrlChangeMonitor] Changes detected: {...}
[UrlChangeMonitor] Idle helper reset
```

## API Reference

### Enable Idle Helper
```javascript
UrlChangeMonitor.enableIdleHelper(callback, delay);
```
- **callback**: Function(pageInfo) - Called when idle
- **delay**: Number (ms) - Default 2000ms

### Disable Idle Helper
```javascript
UrlChangeMonitor.disableIdleHelper();
```

### Check Idle Time
```javascript
const ms = UrlChangeMonitor.getTimeSinceLastActivity();
```

## Behavior

| Event | Idle Helper Action |
|-------|-------------------|
| Page loads | Enabled with 2s delay |
| No changes detected | Timer starts |
| Timer expires (2s) | Callback fires once, auto-disables |
| URL/CaseID changes | Resets and re-enables |
| Multiple checks | Only one timer created |

## Integration in PageIdentifier

```javascript
// In monitorPageChanges()
UrlChangeMonitor.enableIdleHelper((pageInfo) => {
  console.log('PageIdentifier: Idle period detected');
  callback(pageInfo); // Same callback as regular changes
}, 2000);
```

## Troubleshooting

### Callback Not Firing
- Check console for "Idle helper enabled"
- Verify 2 seconds have passed with no changes
- Check if already triggered (one-time use)

### Firing Too Early/Late
- Adjust delay: `enableIdleHelper(callback, 3000)` for 3 seconds
- Check `getTimeSinceLastActivity()` value

### Multiple Triggers
- Should only fire once per page load
- Check console for "Idle helper disabled"
- Verify `triggered` state is reset on navigation

## Common Patterns

### Standard Usage (PageIdentifier)
```javascript
if (hasUrlMonitor) {
  UrlChangeMonitor.init(pageInfo);
  UrlChangeMonitor.enableIdleHelper((info) => {
    callback(info);
  }, 2000);
}
```

### Custom Delay
```javascript
UrlChangeMonitor.enableIdleHelper((info) => {
  console.log('3 seconds of stability');
}, 3000);
```

### Conditional Enablement
```javascript
if (pageInfo.type === 'case_page') {
  UrlChangeMonitor.enableIdleHelper(callback);
}
```

### Manual Control
```javascript
// Enable
UrlChangeMonitor.enableIdleHelper(callback);

// Disable before trigger
UrlChangeMonitor.disableIdleHelper();

// Check time
if (UrlChangeMonitor.getTimeSinceLastActivity() > 5000) {
  console.log('Page stable for 5+ seconds');
}
```
