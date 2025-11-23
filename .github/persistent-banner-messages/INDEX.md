# Persistent Banner Messages Feature Specification

Complete documentation for the rotating messages feature in the ExLibris Chrome Extension's Persistent Banner.

## 📚 Documentation Index

### [README.md](./README.md)
**Overview and Quick Reference**
- Feature summary and capabilities
- Component architecture
- Storage schema
- Usage examples
- Related files and dependencies

**Read this first** for a high-level understanding of the feature.

---

### [API.md](./API.md)
**Technical API Reference**
- Public methods documentation
- Context menu operations
- Hover image handling
- State properties
- Event flow diagrams

**Use this** when implementing or debugging specific functionality.

---

### [DATA_FLOW.md](./DATA_FLOW.md)
**Complete Data Flow Documentation**
- Initial load sequence
- User interaction flows (add, edit, delete)
- Auto-rotation cycle
- Hover image display flow
- Storage sync across tabs
- Data structure at each stage

**Use this** to understand how data moves through the system.

---

### [TESTING.md](./TESTING.md)
**Testing Guide**
- Manual test cases (TC-1 through TC-15)
- Automated test scenarios
- Performance testing
- Edge case testing
- Regression checklist

**Use this** to validate feature functionality after changes.

---

### [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
**Common Issues and Solutions**
- Messages not appearing
- Rotation not working
- Hover images failing
- Context menu issues
- Storage sync problems
- Performance/memory issues
- Diagnostic commands

**Use this** when investigating bug reports or user issues.

---

## Quick Start for Developers

### 1. Understanding the Feature
Read in order:
1. README.md (overview)
2. DATA_FLOW.md (Flow 1: Initial Load)
3. API.md (core methods)

### 2. Making Changes
1. Locate relevant code in `modules/persistentBanner.js`
2. Review API.md for method signatures
3. Check DATA_FLOW.md for affected flows
4. Implement changes following existing patterns
5. Run tests from TESTING.md

### 3. Debugging Issues
1. Check TROUBLESHOOTING.md for common issues
2. Use diagnostic commands to inspect state
3. Review console logs (`[PersistentBanner]` prefix)
4. Verify storage contents with diagnostic scripts

---

## Feature Implementation Checklist

When adding similar features elsewhere, consider:

- [ ] Storage schema design (sync vs. local)
- [ ] Enable/disable toggle at feature level
- [ ] User configuration UI (popup.html/popup.js)
- [ ] Cross-tab sync via `chrome.storage.onChanged`
- [ ] Cleanup methods for timers/listeners/observers
- [ ] Context menu for advanced operations
- [ ] Multiline text support with escaping
- [ ] Hover interactions (images, tooltips)
- [ ] Debouncing for storage operations
- [ ] Empty state handling
- [ ] Character/size limits
- [ ] CSP-compliant rendering
- [ ] Performance testing (timers, memory)
- [ ] Comprehensive test coverage

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  popup.html + popup.js                    Banner (DOM)          │
│  ┌─────────────────────┐                 ┌──────────────────┐  │
│  │ - Enable toggle     │                 │ Message display  │  │
│  │ - Interval config   │                 │ Prev/Next nav    │  │
│  │ - Default messages  │                 │ Context menu     │  │
│  │ - Custom messages   │                 │ Hover image      │  │
│  └──────────┬──────────┘                 └────────┬─────────┘  │
│             │                                      │            │
└─────────────┼──────────────────────────────────────┼────────────┘
              │                                      │
              ↓                                      ↓
┌─────────────────────────────────────────────────────────────────┐
│                      chrome.storage.sync                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ exlibris.persistentBanner.messages                       │  │
│  │ - enabled, autoRotate, rotationInterval                  │  │
│  │ - defaultMessages { enabled, items[] }                   │  │
│  │ - customMessages []                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ↓ chrome.storage.onChanged
┌─────────────────────────────────────────────────────────────────┐
│              modules/persistentBanner.js (State)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ activeMessages: []        // Filtered enabled messages   │  │
│  │ currentMessageIndex: 0    // Current position            │  │
│  │ messageSettings: {}       // Config object               │  │
│  │ messageRotationInterval   // Timer ID                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Methods:                                                 │  │
│  │ - loadMessages()          // Load from storage           │  │
│  │ - getActiveMessages()     // Filter enabled              │  │
│  │ - startMessageRotation()  // Start timer                 │  │
│  │ - rotateToNextMessage()   // Advance index               │  │
│  │ - updateMessageDisplay()  // Render to DOM               │  │
│  │ - renderMessage()         // HTML generation             │  │
│  │ - showContextMenu()       // Right-click menu            │  │
│  │ - setupHoverImage()       // Hover interactions          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Locations

| Component | File | Lines |
|-----------|------|-------|
| State properties | `modules/persistentBanner.js` | 28-30 |
| Load messages | `modules/persistentBanner.js` | 2685-2721 |
| Get active messages | `modules/persistentBanner.js` | 2729-2766 |
| Start/stop rotation | `modules/persistentBanner.js` | 2768-2800 |
| Navigation methods | `modules/persistentBanner.js` | 2802-2833 |
| Render message | `modules/persistentBanner.js` | 2835-2873 |
| Update display | `modules/persistentBanner.js` | 2875-2900 |
| Hover image | `modules/persistentBanner.js` | 2902-2970 |
| Context menu | `modules/persistentBanner.js` | 2972-3426 |
| Popup UI | `popup.html` | 540-574 |
| Popup logic | `popup.js` | 97-576 |
| Banner HTML | `modules/persistentBanner.js` | 966-978 |
| Event handlers | `modules/persistentBanner.js` | 1046-1122 |

---

## Related Features

This feature shares patterns with:
- **Navigation History** (rotation queue, display cycle)
- **Environment Buttons** (storage sync, enable/disable toggle)
- **Flexipage Panel** (DOM injection, context menu)
- **Case Comment Extractor** (persistent banner integration)

Refer to those features for similar implementation examples.

---

## Contributing

When modifying this feature:

1. **Update documentation** if behavior changes
2. **Add tests** for new functionality (TESTING.md)
3. **Update TROUBLESHOOTING.md** for new known issues
4. **Update API.md** for new/changed methods
5. **Update DATA_FLOW.md** for new flows
6. **Log changes** in root `CHANGES.md`

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-23 | 1.0 | Initial feature specification created |

---

**Maintained by**: ExLibris Extension Team  
**Last Updated**: 2025-01-23
