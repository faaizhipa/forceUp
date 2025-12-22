import { useState, useEffect } from '../preact-setup.js';
import { html } from '../preact-setup.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js';
import { Alert, AlertDescription } from '../ui/alert.js';
import { WorldMap } from '../WorldMap.js';
import { TimeConverter } from './TimeConverter.js';
import { MeetingScheduler } from './MeetingScheduler.js';
import { CopyActions } from './CopyActions.js';
import { checkUpcomingDST, convertTime } from '../lib/timezone-utils.js';

// Warning Icon
const WarningIcon = ({size, className}) => html`<svg xmlns="http://www.w3.org/2000/svg" width=${size || 16} height=${size || 16} fill="currentColor" class=${className} viewBox="0 0 256 256"><path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"></path></svg>`;

export function GlobalSyncModal({
  open,
  onOpenChange,
  localZone,
  targetZone,
  favorites,
  onToggleFavorite,
  userPreferences
}) {
  const [activeTab, setActiveTab] = useState('converter');
  const [simulationTime, setSimulationTime] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!open) return;
    
    const interval = setInterval(() => {
      if (activeTab === 'converter') {
        setCurrentTime(new Date());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [open, activeTab]);

  const dstWarnings = [localZone, targetZone, ...favorites]
    .map(tz => checkUpcomingDST(tz))
    .filter(w => w !== null);

  const mapTime = activeTab === 'scheduler' ? simulationTime : currentTime;

  const allZones = [localZone, targetZone, ...favorites];
  const conversions = allZones.map(tz => convertTime(mapTime, tz, tz === localZone ? userPreferences : undefined));

  const mapPins = [
    { timezone: localZone, label: 'Local', lat: 0, lng: 0 },
    { timezone: targetZone, label: 'Target', lat: 0, lng: 0 },
    ...favorites.map(tz => ({ timezone: tz, label: tz.split('/').pop() || tz, lat: 0, lng: 0 }))
  ];

  return html`
    <${Dialog} open=${open} onOpenChange=${onOpenChange}>
      <${DialogContent} className="max-w-[800px] max-h-[650px] p-0 flex flex-col">
        <${DialogHeader} className="px-6 pt-6 pb-0">
          <${DialogTitle} className="text-2xl font-semibold">Global Sync Utility<//>
        <//>

        <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6 gap-4">
          ${dstWarnings.length > 0 && html`
            <${Alert} className="bg-status-awake/10 border-status-awake">
              <${WarningIcon} size=${16} className="text-status-awake" />
              <${AlertDescription}>
                ${dstWarnings.map(w => html`
                  <div key=${w.timezone}>
                    ${w.timezone.split('/').pop()} ${w.type === 'end' ? 'ends' : 'starts'} DST in ${w.daysUntil} day${w.daysUntil !== 1 ? 's' : ''}
                  </div>
                `)}
              <//>
            <//>
          `}

          <${WorldMap} currentTime=${mapTime} pins=${mapPins} />

          <${Tabs} value=${activeTab} onValueChange=${setActiveTab} className="flex-1 flex flex-col">
            <${TabsList} className="grid w-full grid-cols-2">
              <${TabsTrigger} value="converter">Converter<//>
              <${TabsTrigger} value="scheduler">Scheduler<//>
            <//>

            <div className="flex-1 overflow-y-auto mt-4">
              <${TabsContent} value="converter" className="mt-0 space-y-4">
                <${TimeConverter}
                  localZone=${localZone}
                  targetZone=${targetZone}
                  favorites=${favorites}
                  onToggleFavorite=${onToggleFavorite}
                  userPreferences=${userPreferences}
                />
              <//>

              <${TabsContent} value="scheduler" className="mt-0 space-y-4">
                <${MeetingScheduler}
                  localZone=${localZone}
                  targetZone=${targetZone}
                  favorites=${favorites}
                  userPreferences=${userPreferences}
                  onTimeChange=${setSimulationTime}
                />
              <//>
            </div>
          <//>

          <${CopyActions} conversions=${conversions} />
        </div>
      <//>
    <//>
  `;
}
