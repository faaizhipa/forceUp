import { useState, useMemo, useCallback, useRef, useEffect } from '../preact-setup.js';
import { html } from '../preact-setup.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';
import { Calendar } from '../ui/calendar.js';
// import { toast } from '../ui/toast.js'; // Assuming toast.js is available or shimmed
import { calculateOverlapStatus, formatTimeForDisplay, formatDateForDisplay, DEFAULT_AWAKE_START, DEFAULT_AWAKE_END, DEFAULT_BUSINESS_START, DEFAULT_BUSINESS_END, getTimezoneAbbreviation, getTimezoneOffset, COPY_FORMATS, MAX_TIMEZONES, TZDate, format, parse, setYear, setMonth, setDate, formatInTimeZone, toZonedTime, fromZonedTime } from '../lib/timezone-utils.js';

// Icons
const CopyIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32Zm-8,128H176V88a8,8,0,0,0-8-8H96V48H208Z"></path></svg>`;
const CheckIcon = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,55.51a8,8,0,0,0-11.32-11.32l-136,136L37.66,135.51a8,8,0,0,0-11.32,11.32l50.7,50.75a8.05,8.05,0,0,0,5.66,2.34H83a8,8,0,0,0,5.65-2.31Z"></path></svg>`;
const CalendarBlankIcon = ({size}) => html`<svg xmlns="http://www.w3.org/2000/svg" width=${size || 16} height=${size || 16} fill="currentColor" viewBox="0 0 256 256"><path d="M216,40H176V24a8,8,0,0,0-16,0V40H96V24a8,8,0,0,0-16,0V40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200Z"></path></svg>`;

export function MeetingScheduler({
  localZone,
  targetZone,
  favorites,
  userPreferences,
  onTimeChange,
  locationLabels = {}
}) {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    return now;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    return now;
  });
  
  const [isDragging, setIsDragging] = useState(null); // { timezone, type: 'move'|'start'|'end' }
  const dragStartRef = useRef({ x: 0, startTime: 0, endTime: 0, gridWidth: 0 });
  const gridRefs = useRef(new Map());
  
  const [editingZone, setEditingZone] = useState(null); // { timezone, type: 'start'|'end' }
  const [editValue, setEditValue] = useState('');
  
  const [selectedFormat, setSelectedFormat] = useState('simple');
  const [copied, setCopied] = useState(false);

  const zones = useMemo(() => {
    const allZones = [
      { timezone: localZone, label: locationLabels[localZone] || 'My Location', config: userPreferences },
      { timezone: targetZone, label: locationLabels[targetZone] || 'Target Zone' },
      ...favorites.map(tz => ({ 
        timezone: tz, 
        label: locationLabels[tz] || tz.split('/').pop()?.replace(/_/g, ' ') || tz 
      }))
    ];
    const seen = new Set();
    return allZones.filter(z => {
      if (seen.has(z.timezone)) return false;
      seen.add(z.timezone);
      return true;
    });
  }, [localZone, targetZone, favorites, userPreferences, locationLabels]);

  const durationMs = endDate.getTime() - startDate.getTime();
  const durationMinutes = Math.max(0, Math.floor(durationMs / 60000));
  const durationHours = Math.floor(durationMinutes / 60);
  const durationMins = durationMinutes % 60;
  const durationDisplay = durationMinutes > 0 
    ? `${durationHours > 0 ? `${durationHours}h ` : ''}${durationMins > 0 ? `${durationMins}m` : ''}`
    : 'Invalid';

  const overallStatus = calculateOverlapStatus(startDate, zones);

  const getHourBlocks = (timezone, config) => {
    const blocks = [];
    const awakeStart = config?.awakeStart ?? DEFAULT_AWAKE_START;
    const awakeEnd = config?.awakeEnd ?? DEFAULT_AWAKE_END;
    const businessStart = config?.businessStart ?? DEFAULT_BUSINESS_START;
    const businessEnd = config?.businessEnd ?? DEFAULT_BUSINESS_END;

    for (let hour = 0; hour < 24; hour++) {
      let status;
      if (hour >= businessStart && hour < businessEnd) {
        status = 'business';
      } else if ((hour >= awakeStart && hour < businessStart) || (hour >= businessEnd && hour <= awakeEnd)) {
        status = 'awake';
      } else {
        status = 'sleep';
      }
      blocks.push({ hour, status });
    }
    return blocks;
  };

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

  const handleTimeClick = (timezone, type) => {
    const date = type === 'start' ? startDate : endDate;
    const timeInZone = formatInTimeZone(date, timezone, 'HH:mm');
    setEditValue(timeInZone);
    setEditingZone({ timezone, type });
  };

  const handleTimeConfirm = () => {
    if (!editingZone) return;
    
    const referenceDate = editingZone.type === 'start' ? startDate : endDate;
    const newDate = parseTimeInTimezone(editValue, editingZone.timezone, referenceDate);
    
    if (editingZone.type === 'start') {
      setStartDate(newDate);
      if (newDate.getTime() >= endDate.getTime()) {
        setEndDate(new Date(newDate.getTime() + 60 * 60 * 1000));
      }
      if (onTimeChange) onTimeChange(newDate);
    } else {
      if (newDate.getTime() > startDate.getTime()) {
        setEndDate(newDate);
      }
    }
    
    setEditingZone(null);
    setEditValue('');
  };

  const handleHourClick = (timezone, hour) => {
    if (isDragging) return;
    
    const dateInZone = toZonedTime(startDate, timezone);
    const dateStr = format(dateInZone, 'yyyy-MM-dd');
    const parsedInZone = parse(`${dateStr} ${hour.toString().padStart(2, '0')}:00`, 'yyyy-MM-dd HH:mm', new Date());
    const newStart = fromZonedTime(parsedInZone, timezone);
    const newEnd = new Date(newStart.getTime() + durationMs);
    
    setStartDate(newStart);
    setEndDate(newEnd);
    if (onTimeChange) onTimeChange(newStart);
  };

  const handleDragStart = (e, timezone, type) => {
    e.preventDefault();
    e.stopPropagation();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const gridEl = gridRefs.current.get(timezone);
    const gridWidth = gridEl?.getBoundingClientRect().width || 300;
    
    setIsDragging({ timezone, type });
    dragStartRef.current = {
      x: clientX,
      startTime: startDate.getTime(),
      endTime: endDate.getTime(),
      gridWidth
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const gridWidth = dragStartRef.current.gridWidth;
      
      const msPerPixel = (24 * 60 * 60 * 1000) / gridWidth;
      const deltaX = clientX - dragStartRef.current.x;
      const deltaMs = deltaX * msPerPixel;
      
      const snappedDeltaMs = Math.round(deltaMs / (10 * 60 * 1000)) * (10 * 60 * 1000);
      
      if (isDragging.type === 'move') {
        const newStart = new Date(dragStartRef.current.startTime + snappedDeltaMs);
        const newEnd = new Date(dragStartRef.current.endTime + snappedDeltaMs);
        setStartDate(newStart);
        setEndDate(newEnd);
        if (onTimeChange) onTimeChange(newStart);
      } else if (isDragging.type === 'start') {
        const newStart = new Date(dragStartRef.current.startTime + snappedDeltaMs);
        if (newStart.getTime() < dragStartRef.current.endTime - 10 * 60 * 1000) {
          setStartDate(newStart);
          if (onTimeChange) onTimeChange(newStart);
        }
      } else if (isDragging.type === 'end') {
        const newEnd = new Date(dragStartRef.current.endTime + snappedDeltaMs);
        if (newEnd.getTime() > dragStartRef.current.startTime + 10 * 60 * 1000) {
          setEndDate(newEnd);
        }
      }
    };

    const handleEnd = () => {
      setIsDragging(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, onTimeChange]);

  const handleCopy = async () => {
    const currentFormat = COPY_FORMATS.find(f => f.id === selectedFormat) || COPY_FORMATS[0];
    
    const lines = zones.map(zone => {
      const label = zone.label;
      const startFormatted = currentFormat.formatter ? currentFormat.formatter(startDate, zone.timezone) : '';
      const endFormatted = currentFormat.formatter ? currentFormat.formatter(endDate, zone.timezone) : '';
      return `${label}: ${startFormatted} - ${endFormatted}`;
    });
    const text = `Meeting Time:\n${lines.join('\n')}\nDuration: ${durationDisplay}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // toast.success('Copied to clipboard');
      console.log('Copied');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { console.error(e) }
  };

  const handleDateChange = (newDate, timezone) => {
    if (!newDate) return;
    
    const currentStartInZone = toZonedTime(startDate, timezone);
    const currentEndInZone = toZonedTime(endDate, timezone);
    
    // Use setYear/Month/Date from date-fns or manually construct
    const newStartInZone = setDate(setMonth(setYear(currentStartInZone, newDate.getFullYear()), newDate.getMonth()), newDate.getDate());
    const newEndInZone = setDate(setMonth(setYear(currentEndInZone, newDate.getFullYear()), newDate.getMonth()), newDate.getDate());
    
    const wasNextDay = currentEndInZone.getDate() !== currentStartInZone.getDate();
    if (wasNextDay) {
      // newEndInZone.setDate(newEndInZone.getDate() + 1); // Mutates
      // Use addDays from date-fns ideally, but standard date setDate works if we account for rollover. 
      // But date-fns setDate returns new Date.
      // Let's just use vanilla logic since we have newEndInZone as a Date object (if converted properly).
      // Wait, setDate(date, day) returns a new Date in date-fns.
      // I'll stick to vanilla for the increment to be safe or re-import addDays.
      // Actually, let's just use standard date manipulation on the result of setDate.
      const d = new Date(newEndInZone);
      d.setDate(d.getDate() + 1);
      // return d;
      // But `newEndInZone` is const assignment from `setDate`.
    }
    
    const newStart = fromZonedTime(newStartInZone, timezone);
    const newEnd = fromZonedTime(wasNextDay ? new Date(newEndInZone.getTime() + 86400000) : newEndInZone, timezone);
    
    setStartDate(newStart);
    setEndDate(newEnd);
    if (onTimeChange) onTimeChange(newStart);
  };

  const getMeetingBlockPosition = (timezone) => {
    const tzStart = TZDate.tz(timezone, startDate);
    const tzEnd = TZDate.tz(timezone, endDate);
    
    const startHour = tzStart.getHours();
    const startMins = tzStart.getMinutes();
    const endHour = tzEnd.getHours();
    const endMins = tzEnd.getMinutes();
    
    const startPos = ((startHour * 60 + startMins) / (24 * 60)) * 100;
    const endPos = ((endHour * 60 + endMins) / (24 * 60)) * 100;
    
    const startDayStr = formatInTimeZone(startDate, timezone, 'yyyy-MM-dd');
    const endDayStr = formatInTimeZone(endDate, timezone, 'yyyy-MM-dd');
    const crossesDay = startDayStr !== endDayStr;
    
    return { startPos, endPos, crossesDay };
  };

  const renderTimeDisplay = (timezone, type) => {
    const date = type === 'start' ? startDate : endDate;
    const isEditing = editingZone?.timezone === timezone && editingZone?.type === type;
    
    if (isEditing) {
      return html`
        <${Input}
          type="time"
          value=${editValue}
          onChange=${e => setEditValue(e.target.value)}
          onBlur=${handleTimeConfirm}
          onKeyDown=${e => {
            if (e.key === 'Enter') handleTimeConfirm();
            if (e.key === 'Escape') {
              setEditingZone(null);
              setEditValue('');
            }
          }}
          autoFocus
          className="w-[90px] h-6 text-xs font-mono px-1 py-0 inline-block"
        />
      `;
    }
    
    return html`
      <button
        onClick=${() => handleTimeClick(timezone, type)}
        className="font-bold tabular-nums text-primary hover:bg-primary/20 px-1 py-0.5 rounded transition-colors cursor-pointer text-sm"
        title=${`Click to edit ${type} time in ${timezone}`}
      >
        ${formatTimeForDisplay(date, timezone, 'h:mm a')}
      </button>
    `;
  };

  return html`
    <div className="space-y-3">
      <!-- Header -->
      <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border border-primary/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style=${{
                  backgroundColor: overallStatus === 'business' ? '#4CAF50' : overallStatus === 'awake' ? '#FF9800' : '#9E9E9E'
                }}
              />
              <span className="text-xs font-medium">
                ${overallStatus === 'business' && '✓ All business hours'}
                ${overallStatus === 'awake' && '⚠ Some outside business'}
                ${overallStatus === 'sleep' && '✗ Some sleeping'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              <strong>${durationDisplay}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <${Select} value=${selectedFormat} onValueChange=${setSelectedFormat}>
              <${SelectTrigger} className="h-7 w-[130px] text-[10px]">
                <${SelectValue} />
              <//>
              <${SelectContent}>
                ${COPY_FORMATS.map(fmt => html`
                  <${SelectItem} key=${fmt.id} value=${fmt.id} className="text-[10px]">
                    ${fmt.label}
                  <//>
                `)}
              <//>
            <//>
            <${Button} onClick=${handleCopy} variant="secondary" size="sm" className="h-7 gap-1 text-xs px-3">
              ${copied ? html`<${CheckIcon} size=${14} />` : html`<${CopyIcon} size=${14} />`}
              Copy
            <//>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          💡 Click any time to edit. Click hour blocks or drag the meeting bar (10-min steps).
        </p>
      </div>

      <!-- Timezone Cards -->
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        ${zones.map((zone) => {
          const blocks = getHourBlocks(zone.timezone, zone.config);
          const abbr = getTimezoneAbbreviation(startDate, zone.timezone);
          const offset = getTimezoneOffset(startDate, zone.timezone);
          const { startPos, endPos, crossesDay } = getMeetingBlockPosition(zone.timezone);

          return html`
            <div key=${zone.timezone} className="p-2.5 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0 group/label">
                  <span className="font-semibold text-sm truncate group-hover/label:overflow-visible ...">
                    ${zone.label}
                  </span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-primary/20 text-primary font-mono shrink-0" title=${abbr}>
                    ${abbr}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono shrink-0" title=${offset}>
                    ${offset}
                  </span>
                  
                  <${Popover}>
                    <${PopoverTrigger} asChild>
                      <${Button} 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                      >
                        <${CalendarBlankIcon} size=${10} />
                        ${formatDateForDisplay(startDate, zone.timezone)}
                        ${crossesDay && html`<span className="text-amber-500"> → ${formatDateForDisplay(endDate, zone.timezone)}</span>`}
                      <//>
                    <//>
                    <${PopoverContent} className="w-auto p-0" align="start">
                      <${Calendar}
                        mode="single"
                        selected=${toZonedTime(startDate, zone.timezone)}
                        onSelect=${date => handleDateChange(date, zone.timezone)}
                        initialFocus
                      />
                    <//>
                  <//>
                </div>
                
                <div className="flex items-center gap-0.5 shrink-0">
                  ${renderTimeDisplay(zone.timezone, 'start')}
                  <span className="text-muted-foreground text-xs">–</span>
                  ${renderTimeDisplay(zone.timezone, 'end')}
                </div>
              </div>

              <!-- Interactive Hour Grid -->
              <div 
                ref=${el => { if (el) gridRefs.current.set(zone.timezone, el) }}
                className="relative h-8 rounded overflow-hidden border border-border/60 select-none"
              >
                <div className="flex h-full">
                  ${blocks.map(({ hour, status }) => html`
                    <button
                      key=${hour}
                      onClick=${() => handleHourClick(zone.timezone, hour)}
                      className="flex-1 relative border-r border-white/20 last:border-r-0 hover:brightness-125 transition-all cursor-pointer"
                      style=${{
                        backgroundColor: status === 'business'
                            ? 'rgba(76, 175, 80, 0.5)'
                            : status === 'awake'
                            ? 'rgba(255, 193, 7, 0.4)'
                            : 'rgba(150, 150, 150, 0.25)'
                      }}
                      title=${`Set start: ${hour}:00`}
                    >
                      ${hour % 4 === 0 && html`
                        <span className="absolute bottom-0 left-0 text-[11px] text-white font-bold leading-none pl-px">
                          ${hour}
                        </span>
                      `}
                    </button>
                  `)}
                </div>

                <!-- Draggable Normal -->
                ${!crossesDay && endPos > startPos && html`
                  <div 
                    className="absolute top-0 bottom-0 bg-primary/80 border-2 border-primary flex items-center justify-center cursor-move group"
                    style=${{ left: `${startPos}%`, width: `${endPos - startPos}%`, minWidth: '20px' }}
                    onMouseDown=${e => handleDragStart(e, zone.timezone, 'move')}
                    onTouchStart=${e => handleDragStart(e, zone.timezone, 'move')}
                    title="Drag to move meeting"
                  >
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 transition-colors"
                      onMouseDown=${e => { e.stopPropagation(); handleDragStart(e, zone.timezone, 'start') }}
                      onTouchStart=${e => { e.stopPropagation(); handleDragStart(e, zone.timezone, 'start') }}
                    />
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 transition-colors"
                      onMouseDown=${e => { e.stopPropagation(); handleDragStart(e, zone.timezone, 'end') }}
                      onTouchStart=${e => { e.stopPropagation(); handleDragStart(e, zone.timezone, 'end') }}
                    />
                    <span className="text-[8px] text-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      ⬌
                    </span>
                  </div>
                `}

                <!-- Draggable Cross Day -->
                ${crossesDay && html`
                   <div 
                    className="absolute top-0 bottom-0 bg-primary/80 border-l-2 border-primary cursor-move"
                    style=${{ left: `${startPos}%`, right: 0 }}
                    onMouseDown=${e => handleDragStart(e, zone.timezone, 'move')}
                    title="Meeting extends to next day"
                  >
                   <div 
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30"
                      onMouseDown=${e => { e.stopPropagation(); handleDragStart(e, zone.timezone, 'start') }}
                    />
                     <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[7px] text-white/80 font-semibold">
                       +1d
                     </span>
                  </div>
                `}
              </div>
            </div>
          `;
        })}
      </div>

      <!-- Legend -->
      <div className="pt-2 border-t border-border space-y-2">
         <div className="flex flex-wrap gap-3 text-[9px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded" style=${{ backgroundColor: 'rgba(76, 175, 80, 0.6)' }} />
            <span>Business</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded" style=${{ backgroundColor: 'rgba(255, 193, 7, 0.5)' }} />
            <span>Awake</span>
          </div>
          <div className="flex items-center gap-1">
             <div className="w-2.5 h-2.5 rounded" style=${{ backgroundColor: 'rgba(150, 150, 150, 0.4)' }} />
            <span>Sleep</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
