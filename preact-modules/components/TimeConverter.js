import { useState, useCallback } from '../preact-setup.js';
import { html } from '../preact-setup.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Button } from '../ui/button.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';
import { Calendar } from '../ui/calendar.js';
import { StatusDot } from './StatusDot.js';
import { convertTime, formatDateForDisplay, getTimezoneAbbreviation, toZonedTime, fromZonedTime, formatInTimeZone, parse, format, TZDate } from '../lib/timezone-utils.js';
import { cn } from '../lib/utils.js';

// Icons
const GearIcon = ({size}) => html`<svg xmlns="http://www.w3.org/2000/svg" width=${size || 16} height=${size || 16} fill="currentColor" viewBox="0 0 256 256"><path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32.05,32.05,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3l-2.64-23.72a8,8,0,0,0-3.93-6,107.21,107.21,0,0,0-26.25-10.88,8,8,0,0,0-7.06,1.48L130.32,40Q128.16,40,126,40t-4.32,0L103,25.08a8,8,0,0,0-7.06-1.48,107.21,107.21,0,0,0-26.25,10.88,8,8,0,0,0-3.93,6l-2.64,23.72q-1.56,1.48-3,3L36.4,69.84a8,8,0,0,0-6,3.93,107.21,107.21,0,0,0-10.88,26.25,8,8,0,0,0,1.48,7.06L36,125.68q0,2.16,0,4.32L21,148.64a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.48,1.56,3,3l2.64,23.72a8,8,0,0,0,3.93,6,107.21,107.21,0,0,0,26.25,10.88,8,8,0,0,0,7.06-1.48L121.68,216q2.16,0,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3l23.72-2.64a8,8,0,0,0,6-3.93,107.21,107.21,0,0,0,10.88-26.25,8,8,0,0,0-1.48-7.06ZM128,168a40,40,0,1,1,40-40A40.05,40.05,0,0,1,128,168Z"></path></svg>`;
const StarIcon = ({size, className}) => html`<svg xmlns="http://www.w3.org/2000/svg" width=${size || 16} height=${size || 16} fill="currentColor" class=${className} viewBox="0 0 256 256"><path d="M234.5,114.38l-45.1,39.36,13.51,58.6a16,16,0,0,1-23.84,17.34l-51.11-31-51.11,31a16,16,0,0,1-23.84-17.34L66.61,153.8,21.5,114.38a16,16,0,0,1,9.11-28.06l59.46-5.15,23.21-55.36a15.95,15.95,0,0,1,29.44,0h0L166,81.17l59.46,5.15a16,16,0,0,1,9.11,28.06Z"></path></svg>`;
const CalendarBlankIcon = ({size}) => html`<svg xmlns="http://www.w3.org/2000/svg" width=${size || 16} height=${size || 16} fill="currentColor" viewBox="0 0 256 256"><path d="M216,40H176V24a8,8,0,0,0-16,0V40H96V24a8,8,0,0,0-16,0V40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200Z"></path></svg>`;

export function TimeConverter({
  localZone,
  targetZone,
  favorites,
  onToggleFavorite,
  userPreferences
}) {
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [editingZone, setEditingZone] = useState(null);
  const [editValue, setEditValue] = useState('');

  const localConversion = convertTime(selectedTime, localZone, userPreferences);
  const targetConversion = convertTime(selectedTime, targetZone);

  const parseTimeInTimezone = useCallback((timeStr, timezone, referenceDate) => {
    try {
      const dateInZone = toZonedTime(referenceDate, timezone);
      const dateStr = format(dateInZone, 'yyyy-MM-dd');
      const fullDateTimeStr = `${dateStr} ${timeStr}`;
      const parsedInZone = parse(fullDateTimeStr, 'yyyy-MM-dd HH:mm', new Date());
      return fromZonedTime(parsedInZone, timezone);
    } catch {
      return referenceDate;
    }
  }, []);

  const handleTimeClick = (timezone) => {
    const timeInZone = formatInTimeZone(selectedTime, timezone, 'HH:mm');
    setEditValue(timeInZone);
    setEditingZone(timezone);
  };

  const handleTimeConfirm = (timezone) => {
    const newDate = parseTimeInTimezone(editValue, timezone, selectedTime);
    setSelectedTime(newDate);
    setEditingZone(null);
    setEditValue('');
  };

  const handleDateChange = (newDate, timezone) => {
    if (!newDate) return;
    
    // Simplified logic: adjust selectedTime to match the same time of day but on new Date, in the target timezone
    
    const timeStr = formatInTimeZone(selectedTime, timezone, 'HH:mm:ss');
    const dateStr = format(newDate, 'yyyy-MM-dd'); // newDate is from calendar, so it's a local date object representing the day
    const fullDateTimeStr = `${dateStr} ${timeStr}`;
    const parsed = parse(fullDateTimeStr, 'yyyy-MM-dd HH:mm:ss', new Date()); // parsed as local
    // Treat 'parsed' as being in 'timezone'
    const updated = fromZonedTime(parsed, timezone);
    
    setSelectedTime(updated);
  };

  const zones = [
    {
      label: 'My Location',
      timezone: localZone,
      conversion: localConversion,
      isHome: true,
      showConfig: true,
      isFavorite: false
    },
    {
      label: 'Target Zone',
      timezone: targetZone,
      conversion: targetConversion,
      isHome: false,
      showConfig: false,
      isFavorite: false
    },
    ...favorites.map(tz => ({
      label: tz.split('/').pop() || tz,
      timezone: tz,
      conversion: convertTime(selectedTime, tz),
      isHome: false,
      showConfig: false,
      isFavorite: true
    }))
  ];

  return html`
    <div className="space-y-4">
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        ${zones.map((zone, index) => {
          const abbr = getTimezoneAbbreviation(selectedTime, zone.timezone);
          const isEditing = editingZone === zone.timezone;
          
          return html`
            <div
              key=${zone.timezone}
              className=${`flex items-center gap-4 p-4 rounded-lg bg-card border border-border ${index === 0 ? 'bg-accent/50' : ''}`}
            >
              <${StatusDot} status=${zone.conversion.status} />
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <${Label} className="text-sm font-medium">${zone.label}<//>
                  ${zone.showConfig && html`
                    <${Button} variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <${GearIcon} size=${14} />
                    <//>
                  `}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>${zone.timezone}</span>
                  <span className="px-1 py-0.5 rounded bg-primary/20 text-primary font-mono text-xs">
                    ${abbr}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="space-y-1 text-right">
                  <!-- Clickable Time -->
                  ${isEditing ? html`
                    <${Input}
                      type="time"
                      value=${editValue}
                      onChange=${e => setEditValue(e.target.value)}
                      onBlur=${() => handleTimeConfirm(zone.timezone)}
                      onKeyDown=${e => {
                        if (e.key === 'Enter') handleTimeConfirm(zone.timezone);
                        if (e.key === 'Escape') {
                          setEditingZone(null);
                          setEditValue('');
                        }
                      }}
                      autoFocus
                      className="w-28 h-8 text-lg font-medium text-right"
                    />
                  ` : html`
                    <button
                      onClick=${() => handleTimeClick(zone.timezone)}
                      className="time-display text-2xl font-medium hover:text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors cursor-pointer"
                      title=${`Click to edit time in ${zone.timezone}`}
                    >
                      ${zone.conversion.formatted}
                    </button>
                  `}
                  
                  <!-- Date with Calendar Picker -->
                  <${Popover}>
                    <${PopoverTrigger} asChild>
                      <${Button}
                        variant="ghost" 
                        size="sm" 
                        className="h-5 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                      >
                        <${CalendarBlankIcon} size=${12} />
                        ${formatDateForDisplay(zone.conversion.date, zone.timezone)}
                      <//>
                    <//>
                    <${PopoverContent} className="w-auto p-0" align="end">
                      <${Calendar}
                        mode="single"
                        selected=${toZonedTime(selectedTime, zone.timezone)}
                        onSelect=${date => handleDateChange(date, zone.timezone)}
                        initialFocus
                      />
                    <//>
                  <//>
                </div>

                ${zone.isFavorite && html`
                  <${Button}
                    variant="ghost"
                    size="sm"
                    onClick=${() => onToggleFavorite(zone.timezone)}
                    className="h-8 w-8 p-0"
                  >
                    <${StarIcon} size=${16} className="text-status-awake" weight="fill" />
                  <//>
                `}
              </div>
            </div>
          `;
        })}
      </div>

      ${favorites.length === 0 && html`
        <div className="text-center py-8 text-muted-foreground text-sm">
          No favorite timezones yet. Add some to track them here.
        </div>
      `}
    </div>
  `;
}
