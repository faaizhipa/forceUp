/**
 * Integration Example
 * Shows how to use GlobalSyncWidget and TimezoneUtils modules
 * in another Chrome Extension
 * 
 * @example
 * // In your manifest.json, include the modules:
 * {
 *   "content_scripts": [{
 *     "matches": ["<all_urls>"],
 *     "js": [
 *       "path/to/timezoneUtils.js",
 *       "path/to/globalSyncWidget.js",
 *       "your_content_script.js"
 *     ]
 *   }]
 * }
 */

// ============================================================================
// Example 1: Basic Widget Integration
// ============================================================================

/**
 * Initialize the widget with required parameters
 * @param {string} localTimezone - User's local timezone (IANA identifier)
 * @param {string} customerTimezone - Customer timezone (IANA identifier)
 * @param {string[]} [favoriteTimezones] - Optional array of favorite timezones
 */
function initTimezoneWidget(localTimezone, customerTimezone, favoriteTimezones) {
  // Check if dependencies are loaded
  if (typeof TimezoneUtils === 'undefined') {
    console.error('TimezoneUtils module is not loaded');
    return false;
  }
  
  if (typeof GlobalSyncWidget === 'undefined') {
    console.error('GlobalSyncWidget module is not loaded');
    return false;
  }

  // Create a container element
  const container = document.createElement('div');
  container.id = 'my-timezone-widget';
  document.body.appendChild(container);

  // Initialize the widget
  const success = GlobalSyncWidget.init(container, {
    localTimezone: localTimezone,           // Required
    customerTimezone: customerTimezone,     // Required
    favoriteTimezones: favoriteTimezones || [] // Optional
  });

  return success;
}

// Usage:
// initTimezoneWidget('Asia/Kuala_Lumpur', 'America/New_York', ['Europe/London']);


// ============================================================================
// Example 2: Using TimezoneUtils Standalone
// ============================================================================

function displayTimezoneInfo() {
  if (typeof TimezoneUtils === 'undefined') {
    console.error('TimezoneUtils module is not loaded');
    return;
  }

  const now = new Date();
  const timezone = 'America/New_York';

  // Get various timezone information
  const info = {
    abbreviation: TimezoneUtils.getTimezoneAbbreviation(now, timezone),
    offset: TimezoneUtils.getTimezoneOffset(now, timezone),
    fullLabel: TimezoneUtils.getFullTimezoneLabel(now, timezone),
    currentHour: TimezoneUtils.getHourInTimezone(now, timezone),
    formattedTime: TimezoneUtils.formatTimeForDisplay(now, timezone),
    formattedDate: TimezoneUtils.formatDateForDisplay(now, timezone),
    status: TimezoneUtils.getTimeStatus(TimezoneUtils.getHourInTimezone(now, timezone))
  };

  console.log('Timezone Info:', info);
  // {
  //   abbreviation: "EST",
  //   offset: "UTC-05:00",
  //   fullLabel: "EST (UTC-05:00)",
  //   currentHour: 14,
  //   formattedTime: "14:30",
  //   formattedDate: "Wed, Dec 3",
  //   status: "business"
  // }

  return info;
}


// ============================================================================
// Example 3: Converting Time Between Timezones
// ============================================================================

function convertMeetingTime(meetingTime, fromTimezone, toTimezone) {
  if (typeof TimezoneUtils === 'undefined') {
    console.error('TimezoneUtils module is not loaded');
    return null;
  }

  const result = TimezoneUtils.convertTime(meetingTime, toTimezone);
  
  return {
    timezone: toTimezone,
    time: result.formatted,
    hour: result.hour,
    status: result.status, // 'business', 'awake', or 'sleep'
    statusColor: TimezoneUtils.getStatusColor(result.status)
  };
}

// Usage:
// const meeting = new Date('2024-12-03T09:00:00');
// const converted = convertMeetingTime(meeting, 'America/New_York', 'Asia/Tokyo');
// console.log(converted); // { timezone: 'Asia/Tokyo', time: '23:00', hour: 23, status: 'awake', ... }


// ============================================================================
// Example 4: Finding Best Meeting Time
// ============================================================================

function findBestMeetingTime(participants) {
  if (typeof TimezoneUtils === 'undefined') {
    console.error('TimezoneUtils module is not loaded');
    return null;
  }

  // participants = [{ timezone: 'America/New_York' }, { timezone: 'Asia/Tokyo' }, ...]
  
  const now = new Date();
  const bestSlots = [];

  // Check each hour of the day
  for (let hour = 0; hour < 24; hour++) {
    const testTime = new Date(now);
    testTime.setHours(hour, 0, 0, 0);

    const overallStatus = TimezoneUtils.calculateOverlapStatus(testTime, participants);
    
    if (overallStatus === 'business') {
      bestSlots.push({
        hour,
        status: 'business',
        label: 'Ideal - All in business hours'
      });
    } else if (overallStatus === 'awake') {
      bestSlots.push({
        hour,
        status: 'awake',
        label: 'Good - All awake'
      });
    }
  }

  return bestSlots;
}

// Usage:
// const participants = [
//   { timezone: 'America/New_York' },
//   { timezone: 'Asia/Kuala_Lumpur' },
//   { timezone: 'Europe/London' }
// ];
// const bestTimes = findBestMeetingTime(participants);


// ============================================================================
// Example 5: Formatting for Different Use Cases
// ============================================================================

function formatMeetingForEmail(meetingTime, timezones) {
  if (typeof TimezoneUtils === 'undefined') {
    console.error('TimezoneUtils module is not loaded');
    return '';
  }

  const lines = [];
  
  lines.push('📅 Meeting Time:\n');
  
  timezones.forEach(tz => {
    const formatted = TimezoneUtils.formatInTimeZone(meetingTime, tz, 'EEEE, MMMM d, yyyy');
    const time = TimezoneUtils.formatInTimeZone(meetingTime, tz, 'h:mm a');
    const abbr = TimezoneUtils.getTimezoneAbbreviation(meetingTime, tz);
    
    lines.push(`• ${tz.split('/').pop().replace(/_/g, ' ')}: ${formatted} at ${time} ${abbr}`);
  });

  return lines.join('\n');
}

// Usage:
// const meetingTime = new Date('2024-12-03T14:00:00Z');
// const emailText = formatMeetingForEmail(meetingTime, [
//   'America/New_York',
//   'Europe/London',
//   'Asia/Tokyo'
// ]);


// ============================================================================
// Example 6: Widget Event Handling
// ============================================================================

function setupWidgetWithCallbacks(container, config) {
  if (typeof GlobalSyncWidget === 'undefined') {
    console.error('GlobalSyncWidget module is not loaded');
    return false;
  }

  // Initialize widget
  GlobalSyncWidget.init(container, config);

  // Periodically check meeting times (widget doesn't have events yet)
  let lastMeetingStart = null;
  
  setInterval(() => {
    const { start, end } = GlobalSyncWidget.getMeetingTimes();
    
    if (start && (!lastMeetingStart || start.getTime() !== lastMeetingStart.getTime())) {
      lastMeetingStart = start;
      console.log('Meeting time changed:', { start, end });
      
      // Your callback logic here
      onMeetingTimeChanged(start, end);
    }
  }, 1000);

  return true;
}

function onMeetingTimeChanged(start, end) {
  console.log('New meeting scheduled:', {
    start: start.toISOString(),
    end: end.toISOString(),
    duration: (end - start) / 60000 + ' minutes'
  });
}


// ============================================================================
// Example 7: DST Warning
// ============================================================================

function checkDSTWarnings(timezones) {
  if (typeof TimezoneUtils === 'undefined') {
    console.error('TimezoneUtils module is not loaded');
    return [];
  }

  const warnings = [];

  timezones.forEach(tz => {
    const dstInfo = TimezoneUtils.checkUpcomingDST(tz, 14);
    
    if (dstInfo) {
      warnings.push({
        timezone: tz,
        date: dstInfo.date,
        daysUntil: dstInfo.daysUntil,
        message: `DST change in ${tz} in ${dstInfo.daysUntil} days (${dstInfo.fromOffset} → ${dstInfo.toOffset})`
      });
    }
  });

  return warnings;
}

// Usage:
// const warnings = checkDSTWarnings(['America/New_York', 'Europe/London']);
// warnings.forEach(w => console.warn(w.message));


// ============================================================================
// Module Check Helper
// ============================================================================

function checkModulesLoaded() {
  const status = {
    TimezoneUtils: typeof TimezoneUtils !== 'undefined',
    GlobalSyncWidget: typeof GlobalSyncWidget !== 'undefined'
  };

  if (!status.TimezoneUtils) {
    console.error('[Integration] TimezoneUtils module is not loaded. Ensure timezoneUtils.js is included before this script.');
  }

  if (!status.GlobalSyncWidget) {
    console.error('[Integration] GlobalSyncWidget module is not loaded. Ensure globalSyncWidget.js is included before this script.');
  }

  return status.TimezoneUtils && status.GlobalSyncWidget;
}

// Run check on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkModulesLoaded);
  } else {
    checkModulesLoaded();
  }
}
