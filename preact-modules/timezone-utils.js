/**
 * Timezone Utilities
 * 
 * Dependencies:
 * - @date-fns/tz (date-fns timezone support)
 * - date-fns (date manipulation)
 * - date-fns-tz (timezone formatting)
 * 
 * Install via CDN or local:
 * - https://esm.sh/date-fns@3
 * - https://esm.sh/@date-fns/tz@1
 * - https://esm.sh/date-fns-tz@3
 */

import { TZDate } from 'https://esm.sh/@date-fns/tz@1.2.0'
import { format, addDays, differenceInDays, isAfter } from 'https://esm.sh/date-fns@3.0.0'
import { formatInTimeZone as formatInTz } from 'https://esm.sh/date-fns-tz@3.0.0'

// Common timezone abbreviations and all IANA timezones
export const ALL_TIMEZONES = Intl.supportedValuesOf('timeZone')

export function getTimezoneAbbreviation(date, timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    })
    const parts = formatter.formatToParts(date)
    const tzPart = parts.find(p => p.type === 'timeZoneName')
    return tzPart?.value || ''
  } catch {
    return ''
  }
}

export function getTimezoneOffset(date, timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset'
    })
    const parts = formatter.formatToParts(date)
    const tzPart = parts.find(p => p.type === 'timeZoneName')
    // Extract just the offset part (e.g., "GMT-05:00" -> "UTC-05:00")
    const offset = tzPart?.value?.replace('GMT', 'UTC') || 'UTC'
    return offset
  } catch {
    return 'UTC'
  }
}

export function getFullTimezoneLabel(date, timezone) {
  const abbr = getTimezoneAbbreviation(date, timezone)
  const offset = getTimezoneOffset(date, timezone)
  // Return format like "EST (UTC-05:00)" or just offset if abbr equals offset
  if (abbr && abbr !== offset && !abbr.startsWith('GMT') && !abbr.startsWith('UTC')) {
    return `${abbr} (${offset})`
  }
  return offset
}

export const DEFAULT_AWAKE_START = 7
export const DEFAULT_AWAKE_END = 23
export const DEFAULT_BUSINESS_START = 9
export const DEFAULT_BUSINESS_END = 17

function formatInTimeZone(date, timezone, formatStr) {
  return formatInTz(date, timezone, formatStr)
}

export function getHourInTimezone(date, timezone) {
  const tzDate = TZDate.tz(timezone, date)
  return tzDate.getHours()
}

export function getTimeStatus(
  hour,
  awakeStart = DEFAULT_AWAKE_START,
  awakeEnd = DEFAULT_AWAKE_END,
  businessStart = DEFAULT_BUSINESS_START,
  businessEnd = DEFAULT_BUSINESS_END
) {
  if (hour >= businessStart && hour < businessEnd) {
    return 'business'
  }
  if ((hour >= awakeStart && hour < businessStart) || (hour >= businessEnd && hour <= awakeEnd)) {
    return 'awake'
  }
  return 'sleep'
}

export function convertTime(
  sourceDate,
  targetTimezone,
  config = {}
) {
  const tzDate = TZDate.tz(targetTimezone, sourceDate)
  const hour = tzDate.getHours()
  
  const status = getTimeStatus(
    hour,
    config?.awakeStart,
    config?.awakeEnd,
    config?.businessStart,
    config?.businessEnd
  )

  return {
    timezone: targetTimezone,
    date: tzDate,
    formatted: formatInTimeZone(sourceDate, targetTimezone, 'HH:mm'),
    status
  }
}

export function formatTimeForDisplay(date, timezone, formatStr = 'HH:mm') {
  return formatInTimeZone(date, timezone, formatStr)
}

export function formatDateForDisplay(date, timezone) {
  return formatInTimeZone(date, timezone, 'EEE, MMM d')
}

export function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function getStatusColor(status) {
  switch (status) {
    case 'business':
      return 'var(--status-business)'
    case 'awake':
      return 'var(--status-awake)'
    case 'sleep':
      return 'var(--status-sleep)'
  }
}

export function calculateOverlapStatus(
  date,
  zones
) {
  const statuses = zones.map(zone => {
    const result = convertTime(date, zone.timezone, zone.config)
    return result.status
  })

  if (statuses.includes('sleep')) {
    return 'sleep'
  }
  if (statuses.every(s => s === 'business')) {
    return 'business'
  }
  return 'awake'
}

export function checkUpcomingDST(timezone, withinDays = 9) {
  const now = new Date()
  
  for (let i = 0; i <= withinDays; i++) {
    const checkDate = addDays(now, i)
    const nextDay = addDays(checkDate, 1)
    
    const offset1 = new Date(formatInTimeZone(checkDate, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX")).getTimezoneOffset()
    const offset2 = new Date(formatInTimeZone(nextDay, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX")).getTimezoneOffset()
    
    if (offset1 !== offset2) {
      return {
        timezone,
        date: nextDay,
        daysUntil: i + 1,
        type: offset2 < offset1 ? 'start' : 'end'
      }
    }
  }
  
  return null
}

export const COPY_FORMATS = [
  {
    id: 'strict_date_time',
    label: 'Strict DateTime',
    pattern: "yyyy-MM-dd'T'HH:mm:ss.SSSSSSZ",
    example: '2025-12-03T14:30:00.000000+0800',
    formatter: (date, timezone) => {
      const base = formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm:ss")
      const offset = formatInTimeZone(date, timezone, 'xx')
      return `${base}.000000${offset}`
    }
  },
  {
    id: 'basic_date_time',
    label: 'Basic DateTime',
    pattern: "yyyyMMdd'T'HHmmss.SSSZ",
    example: '20251203T143000.000+0800',
    formatter: (date, timezone) => {
      return formatInTimeZone(date, timezone, "yyyyMMdd'T'HHmmss.SSS") + formatInTimeZone(date, timezone, 'xx')
    }
  },
  {
    id: 'basic_date_time_no_millis',
    label: 'Basic (No Millis)',
    pattern: "yyyyMMdd'T'HHmmssZ",
    example: '20251203T143000+0800',
    formatter: (date, timezone) => {
      return formatInTimeZone(date, timezone, "yyyyMMdd'T'HHmmss") + formatInTimeZone(date, timezone, 'xx')
    }
  },
  {
    id: 'iso',
    label: 'ISO 8601',
    pattern: "yyyy-MM-dd'T'HH:mm:ssXXX",
    example: '2025-12-03T14:30:00+08:00',
    formatter: (date, timezone) => {
      return formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX")
    }
  },
  {
    id: 'human',
    label: 'Human Readable',
    pattern: 'MMM d, h:mm a zzz',
    example: 'Dec 3, 2:30 PM SGT',
    formatter: (date, timezone) => {
      return formatInTimeZone(date, timezone, 'MMM d, h:mm a zzz')
    }
  },
  {
    id: 'simple',
    label: 'Simple Time',
    pattern: 'HH:mm TZ',
    example: '14:30 SGT',
    formatter: (date, timezone) => {
      const abbr = timezone.split('/').pop()?.substring(0, 3).toUpperCase() || 'UTC'
      return `${formatInTimeZone(date, timezone, 'HH:mm')} ${abbr}`
    }
  }
]

export function getSunPosition(date) {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60
  
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10))
  const longitude = (hour - 12) * 15
  
  return {
    lat: declination,
    lng: longitude
  }
}

export function isNightAtLocation(date, lat, lng) {
  const sunPos = getSunPosition(date)
  const hourAngle = lng - sunPos.lng
  const cosH = Math.sin(lat * Math.PI / 180) * Math.sin(sunPos.lat * Math.PI / 180) +
                Math.cos(lat * Math.PI / 180) * Math.cos(sunPos.lat * Math.PI / 180) * Math.cos(hourAngle * Math.PI / 180)
  
  return cosH < 0
}
