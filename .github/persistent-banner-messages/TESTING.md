# Testing Guide for Persistent Banner Messages

## Test Environment Setup

### Prerequisites
1. Chrome browser with extension loaded in Developer Mode
2. Access to `chrome://extensions/` for debugging
3. Salesforce org (ProQuest or test instance)
4. DevTools open with Console visible

### Enable Feature
1. Open extension popup
2. Navigate to "Features" tab
3. Check "Banner Rotating Messages"
4. Navigate to "Banner Messages" tab
5. Check "Enable rotating messages on non-case pages"

---

## Manual Test Cases

### TC-1: Initial Load with Default Messages

**Objective**: Verify default messages load and display correctly

**Steps**:
1. Load extension with fresh installation
2. Open any Salesforce page
3. Observe persistent banner at top

**Expected**:
- Banner displays with message section visible
- Default message text is visible
- Counter shows "1/X" (where X = total enabled messages)
- Prev/Next buttons are present

**Validation**:
```javascript
// In console:
PersistentBanner.activeMessages.length > 0
PersistentBanner.currentMessageIndex === 0
document.querySelector('#exl-banner-message-content').textContent.length > 0
```

---

### TC-2: Add Custom Message via Popup

**Objective**: Verify users can add custom messages

**Steps**:
1. Open extension popup
2. Navigate to "Banner Messages" tab
3. Click "+ Add Message" button
4. Enter text: "Test Message 1"
5. Click "Save Settings"
6. Switch to Salesforce tab

**Expected**:
- Message appears in rotation queue
- Counter updates to reflect new total
- Message is visible when rotated to

**Validation**:
```javascript
// In console:
PersistentBanner.activeMessages.some(m => m.text === "Test Message 1")
```

---

### TC-3: Multi-line Message Rendering

**Objective**: Verify messages support line breaks (max 3 lines)

**Steps**:
1. Add custom message with text:
   ```
   Line 1
   Line 2
   Line 3
   ```
2. Save settings
3. Navigate to message in banner

**Expected**:
- Three separate lines displayed
- Each line has `message-line-triple` class
- No text overflow or truncation

**Validation**:
```javascript
// In console:
document.querySelectorAll('.message-line-triple').length === 3
```

---

### TC-4: Auto-Rotation Functionality

**Objective**: Verify messages rotate automatically at configured interval

**Steps**:
1. Ensure at least 2 messages are enabled
2. Set rotation interval to 5 seconds
3. Check "Auto-rotate messages"
4. Save settings
5. Observe banner for 15+ seconds

**Expected**:
- Messages rotate every 5 seconds
- Counter increments: "1/2" → "2/2" → "1/2" (circular)
- No console errors

**Validation**:
```javascript
// In console:
PersistentBanner.messageRotationInterval !== null
PersistentBanner.messageSettings.autoRotate === true
PersistentBanner.messageSettings.rotationInterval === 5000
```

---

### TC-5: Manual Navigation (Prev/Next Buttons)

**Objective**: Verify users can manually navigate messages

**Steps**:
1. Ensure at least 3 messages are enabled
2. Click "Next" button (►)
3. Observe counter change
4. Click "Previous" button (◀)
5. Observe counter change

**Expected**:
- Next: Counter increments (e.g., "1/3" → "2/3")
- Previous: Counter decrements (e.g., "2/3" → "1/3")
- Buttons wrap circularly (last → first, first → last)

**Validation**:
```javascript
// After clicking Next:
PersistentBanner.currentMessageIndex === 1

// After clicking Previous:
PersistentBanner.currentMessageIndex === 0
```

---

### TC-6: Disable Default Messages

**Objective**: Verify default messages can be toggled off

**Steps**:
1. Open popup → Banner Messages tab
2. Uncheck "Enable default messages"
3. Save settings
4. Observe banner

**Expected**:
- Only custom messages remain in rotation
- Counter reflects reduced count
- No default messages visible

**Validation**:
```javascript
// In console:
PersistentBanner.activeMessages.every(m => m.type === 'custom')
```

---

### TC-7: Edit Message via Context Menu

**Objective**: Verify messages can be edited in-place

**Steps**:
1. Right-click on message in banner
2. Select "Edit message" from context menu
3. Modify text in modal textarea
4. Click "Save"
5. Observe banner

**Expected**:
- Context menu appears at cursor
- Modal opens with current text pre-filled
- After save, message updates immediately
- No page reload required

**Validation**:
```javascript
// In console after save:
PersistentBanner.activeMessages.some(m => m.text === "Modified Text")
```

---

### TC-8: Remove Message via Context Menu

**Objective**: Verify messages can be deleted

**Steps**:
1. Right-click on custom message in banner
2. Select "Remove message"
3. Confirm deletion
4. Observe banner

**Expected**:
- Message removed from rotation
- Counter decrements
- Rotation continues with remaining messages

**Validation**:
```javascript
// In console:
!PersistentBanner.activeMessages.some(m => m.id === "deleted-id")
```

---

### TC-9: Hover Image Display

**Objective**: Verify hover images appear on mouse enter

**Steps**:
1. Add message with hover image (base64 or URL)
2. Save settings
3. Navigate to message with image
4. Hover mouse over message content
5. Move mouse away

**Expected**:
- Image popup appears near cursor after brief delay
- Popup positioned above cursor (or below if no space)
- Popup disappears after 200ms when mouse leaves

**Validation**:
```javascript
// While hovering:
document.querySelector('.exl-hover-image-popup') !== null

// After leaving:
setTimeout(() => {
  console.log(document.querySelector('.exl-hover-image-popup') === null);
}, 300);
```

---

### TC-10: Add Hover Image via Context Menu

**Objective**: Verify hover images can be added to existing messages

**Steps**:
1. Right-click on message without hover image
2. Select "Add hover image"
3. Upload or paste image data
4. Save
5. Hover over message

**Expected**:
- File input appears in modal
- Image preview shows after selection
- Hover popup displays image after save

---

### TC-11: Storage Sync Across Tabs

**Objective**: Verify changes propagate to all tabs

**Steps**:
1. Open Salesforce in two tabs (Tab A, Tab B)
2. In Tab A: Open popup, add custom message, save
3. Switch to Tab B (without reload)
4. Observe banner in Tab B

**Expected**:
- New message appears in Tab B automatically
- No manual refresh required
- Counter updates in both tabs

**Validation**:
```javascript
// In Tab B console (after ~1 second delay):
PersistentBanner.activeMessages.some(m => m.text === "New message from Tab A")
```

---

### TC-12: Rotation Interval Configuration

**Objective**: Verify rotation interval can be adjusted

**Test Matrix**:
| Interval (seconds) | Expected Behavior |
|--------------------|-------------------|
| 3                  | Very fast rotation |
| 10                 | Moderate rotation |
| 60                 | Slow rotation |

**Steps**:
1. Set rotation interval to 3 seconds
2. Save and observe (time 3 rotations)
3. Change to 10 seconds
4. Save and observe (time 3 rotations)

**Expected**:
- Rotation speed matches configured interval
- Timer resets after settings change

---

### TC-13: Disable Auto-Rotation

**Objective**: Verify rotation can be stopped

**Steps**:
1. Uncheck "Auto-rotate messages"
2. Save settings
3. Observe banner for 30+ seconds

**Expected**:
- Messages do NOT rotate automatically
- Manual navigation (Prev/Next) still works
- Counter remains static

**Validation**:
```javascript
// In console:
PersistentBanner.messageRotationInterval === null
```

---

### TC-14: Empty State Handling

**Objective**: Verify graceful degradation with no messages

**Steps**:
1. Disable all default messages
2. Delete all custom messages
3. Save settings
4. Observe banner

**Expected**:
- Message section displays: "No messages available"
- Counter shows: "0/0"
- Prev/Next buttons disabled
- No console errors

**Validation**:
```javascript
// In console:
PersistentBanner.activeMessages.length === 0
document.querySelector('#exl-banner-message-content').textContent === 'No messages available'
```

---

### TC-15: Message Character Limit

**Objective**: Verify 240 character limit is enforced

**Steps**:
1. Attempt to enter 300 characters in message textarea
2. Save
3. Observe truncation

**Expected**:
- Textarea maxlength attribute prevents input beyond 240
- Save button uses first 240 characters if limit bypassed
- No overflow in banner display

---

## Automated Test Scenarios

### Unit Test: `getActiveMessages()`

```javascript
describe('getActiveMessages', () => {
  it('should return only enabled messages', () => {
    const config = {
      defaultMessages: {
        enabled: true,
        items: [
          { id: '1', text: 'Msg1', enabled: true },
          { id: '2', text: 'Msg2', enabled: false }
        ]
      },
      customMessages: [
        { id: '3', text: 'Msg3', enabled: true }
      ]
    };
    
    const active = PersistentBanner.getActiveMessages(config);
    
    expect(active).toHaveLength(2);
    expect(active[0].id).toBe('1');
    expect(active[1].id).toBe('3');
  });
  
  it('should exclude messages with empty text', () => {
    const config = {
      defaultMessages: { enabled: false, items: [] },
      customMessages: [
        { id: '1', text: '', enabled: true },
        { id: '2', text: 'Valid', enabled: true }
      ]
    };
    
    const active = PersistentBanner.getActiveMessages(config);
    
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('2');
  });
});
```

---

### Unit Test: `renderMessage()`

```javascript
describe('renderMessage', () => {
  it('should render single line with correct class', () => {
    const html = PersistentBanner.renderMessage('Single line');
    
    expect(html).toContain('message-line-single');
    expect(html).toContain('Single line');
  });
  
  it('should render multiple lines with correct class', () => {
    const html = PersistentBanner.renderMessage('Line 1\nLine 2\nLine 3');
    
    expect(html).toContain('message-line-triple');
    expect((html.match(/message-line-triple/g) || []).length).toBe(3);
  });
  
  it('should limit to 3 lines maximum', () => {
    const html = PersistentBanner.renderMessage('L1\nL2\nL3\nL4\nL5');
    
    expect((html.match(/<div/g) || []).length).toBe(3);
  });
  
  it('should escape HTML special characters', () => {
    const html = PersistentBanner.renderMessage('<script>alert("xss")</script>');
    
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
```

---

### Integration Test: Storage → Display Flow

```javascript
describe('Message display flow', () => {
  beforeEach(async () => {
    // Clear storage
    await chrome.storage.sync.clear();
    
    // Set test configuration
    await chrome.storage.sync.set({
      exlibris: {
        persistentBanner: {
          messages: {
            enabled: true,
            autoRotate: true,
            rotationInterval: 5000,
            defaultMessages: { enabled: false, items: [] },
            customMessages: [
              { id: 'test-1', text: 'Test Message 1', enabled: true },
              { id: 'test-2', text: 'Test Message 2', enabled: true }
            ]
          }
        }
      }
    });
  });
  
  it('should load and display messages from storage', async () => {
    await PersistentBanner.loadMessages();
    
    expect(PersistentBanner.activeMessages).toHaveLength(2);
    expect(PersistentBanner.activeMessages[0].text).toBe('Test Message 1');
    
    PersistentBanner.updateMessageDisplay();
    
    const content = document.querySelector('#exl-banner-message-content');
    expect(content.textContent).toContain('Test Message 1');
  });
  
  it('should update display when storage changes', async () => {
    await PersistentBanner.loadMessages();
    
    // Simulate storage change
    await chrome.storage.sync.set({
      exlibris: {
        persistentBanner: {
          messages: {
            enabled: true,
            customMessages: [
              { id: 'test-3', text: 'Updated Message', enabled: true }
            ]
          }
        }
      }
    });
    
    // Trigger storage.onChanged handler
    await PersistentBanner.loadMessages();
    
    expect(PersistentBanner.activeMessages).toHaveLength(1);
    expect(PersistentBanner.activeMessages[0].text).toBe('Updated Message');
  });
});
```

---

## Performance Testing

### PT-1: Message Load Time

**Objective**: Verify loadMessages() completes quickly

**Measurement**:
```javascript
console.time('loadMessages');
await PersistentBanner.loadMessages();
console.timeEnd('loadMessages');
// Should complete in < 50ms
```

---

### PT-2: Rotation Timer Accuracy

**Objective**: Verify rotation interval is accurate

**Measurement**:
```javascript
const timings = [];
let lastTime = Date.now();

// Hook into rotateToNextMessage
const original = PersistentBanner.rotateToNextMessage.bind(PersistentBanner);
PersistentBanner.rotateToNextMessage = function() {
  const now = Date.now();
  timings.push(now - lastTime);
  lastTime = now;
  original();
};

// Wait for 5 rotations
setTimeout(() => {
  console.log('Average interval:', timings.reduce((a,b)=>a+b,0)/timings.length);
  // Should be close to configured interval (±100ms)
}, 30000);
```

---

## Edge Case Testing

### EC-1: Very Long Message Text
- Test with 240 characters (max limit)
- Verify no overflow or layout break

### EC-2: Special Characters in Text
- Test with: `<>&"'\n\t`
- Verify HTML escaping works

### EC-3: Invalid Hover Image Data
- Test with malformed base64
- Test with broken URL
- Verify graceful degradation

### EC-4: Rapid Settings Changes
- Change settings 10 times rapidly
- Verify debouncing prevents race conditions

### EC-5: Storage Quota Exceeded
- Add many large hover images
- Verify error handling when quota exceeded

---

## Regression Testing Checklist

- [ ] Messages display on non-case pages
- [ ] Messages rotate at configured interval
- [ ] Prev/Next buttons work
- [ ] Context menu appears and functions
- [ ] Edit modal saves changes
- [ ] Hover images display correctly
- [ ] Settings persist across browser restart
- [ ] Multi-tab sync works
- [ ] Empty state displays correctly
- [ ] Character limit enforced
- [ ] HTML escaping prevents XSS
- [ ] Cleanup removes timers/listeners
- [ ] No memory leaks after 100 rotations
