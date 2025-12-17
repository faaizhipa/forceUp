/**
 * Timezone Sync Widget Wrapper
 * Provides a lightweight overlay around GlobalSyncWidget for use inside the
 * Salesforce content scripts and PersistentBanner actions.
 * 
 * Includes a Mercator world map with real-time day/night terminator.
 */
const TimezoneSyncWidget = (() => {
  'use strict';

  const OVERLAY_ID = 'exl-timezone-sync-overlay';
  const CONTAINER_ID = 'exl-timezone-sync-container';
  const MAP_CONTAINER_ID = 'exl-timezone-map-container';
  const STYLE_ID = 'exl-timezone-sync-styles';
  const MAP_UPDATE_INTERVAL_MS = 60000;

  let overlayEl = null;
  let shellEl = null;
  let containerEl = null;
  let mapContainerEl = null;
  let legendEl = null;
  let escHandler = null;
  let isVisible = false;
  let mapUpdateInterval = null;
  let currentConfig = null;
  let originalCustomerTimezone = null;
  let customerTzInput = null;
  let allTimezones = null;

  // ============================================================================
  // Day/Night Terminator Calculations
  // ============================================================================

  function getSunPosition(date) {
    const dayOfYear = getDayOfYear(date);
    const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
    const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (hours - 12) / 24);
    
    const eqTime = 229.18 * (
      0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
    );
    
    const declination = (
      0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma)
    );
    
    return { declination, eqTime };
  }

  function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function calculateTerminator(date) {
    const { declination, eqTime } = getSunPosition(date);
    const points = [];
    
    const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const solarNoon = 720 - eqTime;
    const currentSolarTime = hours * 60;
    const hourAngle = (currentSolarTime - solarNoon) / 4;
    const subSolarLng = -hourAngle;
    
    for (let lng = -180; lng <= 180; lng += 2) {
      const lngRad = (lng - subSolarLng) * Math.PI / 180;
      const lat = Math.atan(-Math.cos(lngRad) / Math.tan(declination)) * 180 / Math.PI;
      points.push({ lat, lng });
    }
    
    return points;
  }

  function getTimezoneApproxCoords(timezone) {
    const tzCoords = {
      'America/New_York': { lat: 40.7, lng: -74 },
      'America/Chicago': { lat: 41.9, lng: -87.6 },
      'America/Denver': { lat: 39.7, lng: -105 },
      'America/Los_Angeles': { lat: 34, lng: -118.2 },
      'America/Toronto': { lat: 43.7, lng: -79.4 },
      'America/Vancouver': { lat: 49.3, lng: -123.1 },
      'America/Mexico_City': { lat: 19.4, lng: -99.1 },
      'America/Sao_Paulo': { lat: -23.5, lng: -46.6 },
      'America/Buenos_Aires': { lat: -34.6, lng: -58.4 },
      'Europe/London': { lat: 51.5, lng: -0.1 },
      'Europe/Paris': { lat: 48.9, lng: 2.3 },
      'Europe/Berlin': { lat: 52.5, lng: 13.4 },
      'Europe/Rome': { lat: 41.9, lng: 12.5 },
      'Europe/Madrid': { lat: 40.4, lng: -3.7 },
      'Europe/Amsterdam': { lat: 52.4, lng: 4.9 },
      'Europe/Moscow': { lat: 55.8, lng: 37.6 },
      'Asia/Tokyo': { lat: 35.7, lng: 139.7 },
      'Asia/Shanghai': { lat: 31.2, lng: 121.5 },
      'Asia/Hong_Kong': { lat: 22.3, lng: 114.2 },
      'Asia/Singapore': { lat: 1.35, lng: 103.8 },
      'Asia/Seoul': { lat: 37.6, lng: 127 },
      'Asia/Taipei': { lat: 25, lng: 121.5 },
      'Asia/Bangkok': { lat: 13.8, lng: 100.5 },
      'Asia/Jakarta': { lat: -6.2, lng: 106.8 },
      'Asia/Manila': { lat: 14.6, lng: 121 },
      'Asia/Kuala_Lumpur': { lat: 3.1, lng: 101.7 },
      'Asia/Kolkata': { lat: 22.6, lng: 88.4 },
      'Asia/Mumbai': { lat: 19.1, lng: 72.9 },
      'Asia/Dubai': { lat: 25.3, lng: 55.3 },
      'Asia/Jerusalem': { lat: 31.8, lng: 35.2 },
      'Australia/Sydney': { lat: -33.9, lng: 151.2 },
      'Australia/Melbourne': { lat: -37.8, lng: 145 },
      'Australia/Brisbane': { lat: -27.5, lng: 153 },
      'Australia/Perth': { lat: -31.9, lng: 115.9 },
      'Pacific/Auckland': { lat: -36.8, lng: 174.8 },
      'Pacific/Honolulu': { lat: 21.3, lng: -157.8 },
      'Africa/Cairo': { lat: 30, lng: 31.2 },
      'Africa/Johannesburg': { lat: -26.2, lng: 28 },
      'Africa/Lagos': { lat: 6.5, lng: 3.4 },
      'UTC': { lat: 0, lng: 0 },
      'Etc/UTC': { lat: 0, lng: 0 }
    };

    if (tzCoords[timezone]) return tzCoords[timezone];

    const parts = timezone.split('/');
    if (parts.length >= 2) {
      const region = parts[0];
      for (const [tz, coords] of Object.entries(tzCoords)) {
        if (tz.startsWith(region + '/')) return coords;
      }
    }

    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
      });
      const fParts = formatter.formatToParts(now);
      const offsetPart = fParts.find(p => p.type === 'timeZoneName');
      if (offsetPart) {
        const match = offsetPart.value.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
        if (match) {
          const sign = match[1] === '+' ? 1 : -1;
          const hours = parseInt(match[2], 10);
          return { lat: 30, lng: sign * hours * 15 };
        }
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  // Replace lines 150-265 in modules/timezoneSyncWidget.js with:

  function createWorldMapSVG(date, config) {
    const width = 640;
    const height = 260;
    
    const lngToX = (lng) => ((lng + 180) / 360) * width;
    const latToY = (lat) => {
      const clampedLat = Math.max(-85, Math.min(85, lat));
      const latRad = clampedLat * Math.PI / 180;
      const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
      return (height / 2) - (mercN * height / (2 * Math.PI));
    };

    const terminator = calculateTerminator(date);
    let nightPath = '';
    
    const { declination } = getSunPosition(date);
    const fillFromTop = declination > 0;
    
    if (terminator.length > 0) {
      const pathPoints = terminator.map(p => `${lngToX(p.lng).toFixed(1)},${latToY(p.lat).toFixed(1)}`);
      nightPath = fillFromTop
        ? `M 0,0 L ${pathPoints.join(' L ')} L ${width},0 Z`
        : `M 0,${height} L ${pathPoints.join(' L ')} L ${width},${height} Z`;
    }

    const markers = [];
    
    if (config?.localTimezone) {
      const coords = getTimezoneApproxCoords(config.localTimezone);
      if (coords) {
        markers.push({ x: lngToX(coords.lng), y: latToY(coords.lat), label: 'You', color: '#3b82f6', tz: config.localTimezone });
      }
    }
    
    if (config?.customerTimezone) {
      const coords = getTimezoneApproxCoords(config.customerTimezone);
      if (coords) {
        markers.push({ x: lngToX(coords.lng), y: latToY(coords.lat), label: 'Customer', color: '#22c55e', tz: config.customerTimezone });
      }
    }
    
    if (config?.favoriteTimezones && Array.isArray(config.favoriteTimezones)) {
      config.favoriteTimezones.forEach((tz) => {
        if (tz && tz !== config.localTimezone && tz !== config.customerTimezone) {
          const coords = getTimezoneApproxCoords(tz);
          if (coords) {
            markers.push({ x: lngToX(coords.lng), y: latToY(coords.lat), label: 'Fav', color: '#f59e0b', tz });
          }
        }
      });
    }

    const markersSVG = markers.map((m) => `
      <g class="tz-marker" data-timezone="${m.tz}">
        <circle cx="${m.x}" cy="${m.y}" r="5" fill="${m.color}" stroke="#fff" stroke-width="1.5"/>
        <circle cx="${m.x}" cy="${m.y}" r="9" fill="none" stroke="${m.color}" stroke-width="1" opacity="0.5">
          <animate attributeName="r" values="5;12;5" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/>
        </circle>
        <text x="${m.x}" y="${m.y - 10}" text-anchor="middle" fill="#fff" font-size="9" font-weight="600">${m.label}</text>
      </g>
    `).join('');

    // More accurate continent outlines using actual geographic coordinates
    const continentStyle = 'fill="rgba(74,222,128,0.15)" stroke="rgba(74,222,128,0.4)" stroke-width="0.8"';
    
    // North America (including Alaska, Canada, USA, Mexico)
    const northAmerica = `
      <path d="M${lngToX(-168)},${latToY(65)} 
        L${lngToX(-168)},${latToY(55)} L${lngToX(-140)},${latToY(60)} L${lngToX(-130)},${latToY(55)}
        L${lngToX(-125)},${latToY(48)} L${lngToX(-123)},${latToY(38)} L${lngToX(-117)},${latToY(32)}
        L${lngToX(-105)},${latToY(30)} L${lngToX(-97)},${latToY(26)} L${lngToX(-87)},${latToY(21)}
        L${lngToX(-90)},${latToY(18)} L${lngToX(-87)},${latToY(15)} L${lngToX(-83)},${latToY(10)}
        L${lngToX(-80)},${latToY(8)} L${lngToX(-77)},${latToY(18)} L${lngToX(-81)},${latToY(25)}
        L${lngToX(-80)},${latToY(32)} L${lngToX(-75)},${latToY(35)} L${lngToX(-70)},${latToY(42)}
        L${lngToX(-67)},${latToY(45)} L${lngToX(-65)},${latToY(47)} L${lngToX(-55)},${latToY(50)}
        L${lngToX(-55)},${latToY(52)} L${lngToX(-60)},${latToY(55)} L${lngToX(-65)},${latToY(60)}
        L${lngToX(-75)},${latToY(62)} L${lngToX(-85)},${latToY(65)} L${lngToX(-95)},${latToY(68)}
        L${lngToX(-110)},${latToY(70)} L${lngToX(-130)},${latToY(72)} L${lngToX(-145)},${latToY(70)}
        L${lngToX(-160)},${latToY(68)} L${lngToX(-168)},${latToY(65)} Z" ${continentStyle}/>
    `;
    
    // South America
    const southAmerica = `
      <path d="M${lngToX(-80)},${latToY(10)} 
        L${lngToX(-77)},${latToY(5)} L${lngToX(-70)},${latToY(5)} L${lngToX(-60)},${latToY(0)}
        L${lngToX(-50)},${latToY(-2)} L${lngToX(-45)},${latToY(-5)} L${lngToX(-35)},${latToY(-7)}
        L${lngToX(-35)},${latToY(-15)} L${lngToX(-40)},${latToY(-22)} L${lngToX(-45)},${latToY(-25)}
        L${lngToX(-50)},${latToY(-30)} L${lngToX(-55)},${latToY(-35)} L${lngToX(-58)},${latToY(-40)}
        L${lngToX(-65)},${latToY(-50)} L${lngToX(-68)},${latToY(-55)} L${lngToX(-70)},${latToY(-52)}
        L${lngToX(-72)},${latToY(-45)} L${lngToX(-75)},${latToY(-40)} L${lngToX(-78)},${latToY(-35)}
        L${lngToX(-80)},${latToY(-25)} L${lngToX(-82)},${latToY(-15)} L${lngToX(-81)},${latToY(-5)}
        L${lngToX(-80)},${latToY(0)} L${lngToX(-80)},${latToY(10)} Z" ${continentStyle}/>
    `;
    
    // Europe
    const europe = `
      <path d="M${lngToX(-10)},${latToY(36)} 
        L${lngToX(-5)},${latToY(43)} L${lngToX(3)},${latToY(43)} L${lngToX(5)},${latToY(46)}
        L${lngToX(10)},${latToY(45)} L${lngToX(15)},${latToY(46)} L${lngToX(20)},${latToY(45)}
        L${lngToX(25)},${latToY(40)} L${lngToX(28)},${latToY(42)} L${lngToX(30)},${latToY(45)}
        L${lngToX(35)},${latToY(46)} L${lngToX(40)},${latToY(48)} L${lngToX(35)},${latToY(55)}
        L${lngToX(30)},${latToY(60)} L${lngToX(25)},${latToY(65)} L${lngToX(20)},${latToY(68)}
        L${lngToX(15)},${latToY(70)} L${lngToX(10)},${latToY(68)} L${lngToX(5)},${latToY(62)}
        L${lngToX(0)},${latToY(58)} L${lngToX(-5)},${latToY(55)} L${lngToX(-8)},${latToY(50)}
        L${lngToX(-10)},${latToY(45)} L${lngToX(-10)},${latToY(36)} Z" ${continentStyle}/>
    `;
    
    // Africa
    const africa = `
      <path d="M${lngToX(-17)},${latToY(15)} 
        L${lngToX(-5)},${latToY(35)} L${lngToX(10)},${latToY(37)} L${lngToX(12)},${latToY(33)}
        L${lngToX(25)},${latToY(32)} L${lngToX(35)},${latToY(30)} L${lngToX(40)},${latToY(25)}
        L${lngToX(43)},${latToY(12)} L${lngToX(50)},${latToY(10)} L${lngToX(45)},${latToY(0)}
        L${lngToX(42)},${latToY(-10)} L${lngToX(38)},${latToY(-20)} L${lngToX(32)},${latToY(-28)}
        L${lngToX(28)},${latToY(-33)} L${lngToX(20)},${latToY(-35)} L${lngToX(15)},${latToY(-28)}
        L${lngToX(12)},${latToY(-20)} L${lngToX(15)},${latToY(-10)} L${lngToX(10)},${latToY(0)}
        L${lngToX(5)},${latToY(5)} L${lngToX(-5)},${latToY(8)} L${lngToX(-10)},${latToY(10)}
        L${lngToX(-17)},${latToY(15)} Z" ${continentStyle}/>
    `;
    
    // Asia (Russia, Middle East, India, China, Southeast Asia)
    const asia = `
      <path d="M${lngToX(40)},${latToY(42)} 
        L${lngToX(50)},${latToY(45)} L${lngToX(60)},${latToY(50)} L${lngToX(70)},${latToY(55)}
        L${lngToX(80)},${latToY(60)} L${lngToX(100)},${latToY(65)} L${lngToX(120)},${latToY(70)}
        L${lngToX(140)},${latToY(68)} L${lngToX(160)},${latToY(65)} L${lngToX(170)},${latToY(62)}
        L${lngToX(175)},${latToY(58)} L${lngToX(170)},${latToY(52)} L${lngToX(145)},${latToY(45)}
        L${lngToX(140)},${latToY(42)} L${lngToX(130)},${latToY(38)} L${lngToX(122)},${latToY(32)}
        L${lngToX(120)},${latToY(25)} L${lngToX(115)},${latToY(20)} L${lngToX(110)},${latToY(15)}
        L${lngToX(105)},${latToY(10)} L${lngToX(98)},${latToY(5)} L${lngToX(100)},${latToY(0)}
        L${lngToX(105)},${latToY(-5)} L${lngToX(115)},${latToY(-8)} L${lngToX(120)},${latToY(-5)}
        L${lngToX(115)},${latToY(5)} L${lngToX(108)},${latToY(15)} L${lngToX(100)},${latToY(20)}
        L${lngToX(92)},${latToY(22)} L${lngToX(85)},${latToY(20)} L${lngToX(78)},${latToY(28)}
        L${lngToX(75)},${latToY(22)} L${lngToX(70)},${latToY(20)} L${lngToX(68)},${latToY(24)}
        L${lngToX(60)},${latToY(25)} L${lngToX(55)},${latToY(28)} L${lngToX(50)},${latToY(30)}
        L${lngToX(45)},${latToY(35)} L${lngToX(40)},${latToY(38)} L${lngToX(40)},${latToY(42)} Z" ${continentStyle}/>
    `;
    
    // Australia
    const australia = `
      <path d="M${lngToX(115)},${latToY(-20)} 
        L${lngToX(120)},${latToY(-18)} L${lngToX(130)},${latToY(-12)} L${lngToX(140)},${latToY(-12)}
        L${lngToX(145)},${latToY(-15)} L${lngToX(150)},${latToY(-22)} L${lngToX(153)},${latToY(-28)}
        L${lngToX(150)},${latToY(-35)} L${lngToX(145)},${latToY(-38)} L${lngToX(140)},${latToY(-38)}
        L${lngToX(135)},${latToY(-35)} L${lngToX(130)},${latToY(-32)} L${lngToX(125)},${latToY(-33)}
        L${lngToX(118)},${latToY(-35)} L${lngToX(115)},${latToY(-32)} L${lngToX(113)},${latToY(-25)}
        L${lngToX(115)},${latToY(-20)} Z" ${continentStyle}/>
    `;

    // Greenland
    const greenland = `
      <path d="M${lngToX(-45)},${latToY(60)} 
        L${lngToX(-35)},${latToY(62)} L${lngToX(-22)},${latToY(70)} L${lngToX(-20)},${latToY(78)}
        L${lngToX(-35)},${latToY(82)} L${lngToX(-50)},${latToY(80)} L${lngToX(-55)},${latToY(75)}
        L${lngToX(-50)},${latToY(68)} L${lngToX(-45)},${latToY(60)} Z" ${continentStyle}/>
    `;

    // Japan
    const japan = `
      <path d="M${lngToX(130)},${latToY(32)} 
        L${lngToX(135)},${latToY(35)} L${lngToX(140)},${latToY(38)} L${lngToX(142)},${latToY(42)}
        L${lngToX(145)},${latToY(45)} L${lngToX(142)},${latToY(43)} L${lngToX(138)},${latToY(38)}
        L${lngToX(135)},${latToY(33)} L${lngToX(130)},${latToY(32)} Z" ${continentStyle}/>
    `;

    // UK & Ireland
    const ukIreland = `
      <path d="M${lngToX(-10)},${latToY(52)} 
        L${lngToX(-6)},${latToY(54)} L${lngToX(-5)},${latToY(58)} L${lngToX(-3)},${latToY(58)}
        L${lngToX(0)},${latToY(55)} L${lngToX(2)},${latToY(51)} L${lngToX(-2)},${latToY(50)}
        L${lngToX(-5)},${latToY(50)} L${lngToX(-8)},${latToY(51)} L${lngToX(-10)},${latToY(52)} Z" ${continentStyle}/>
    `;

    // New Zealand
    const newZealand = `
      <path d="M${lngToX(166)},${latToY(-35)} 
        L${lngToX(172)},${latToY(-35)} L${lngToX(178)},${latToY(-38)} L${lngToX(178)},${latToY(-45)}
        L${lngToX(172)},${latToY(-46)} L${lngToX(168)},${latToY(-45)} L${lngToX(166)},${latToY(-42)}
        L${lngToX(166)},${latToY(-35)} Z" ${continentStyle}/>
    `;

    const continentsPath = northAmerica + southAmerica + europe + africa + asia + australia + greenland + japan + ukIreland + newZealand;

    const gridLines = [0, 60, 120, 180, 240, 300, 360].map(x => 
      `<line x1="${(x/360)*width}" y1="0" x2="${(x/360)*width}" y2="${height}"/>`
    ).join('') + [-60, -30, 0, 30, 60].map(lat => 
      `<line x1="0" y1="${latToY(lat)}" x2="${width}" y2="${latToY(lat)}"/>`
    ).join('');

    return `
      <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;">
        <defs>
          <linearGradient id="dayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#1a365d"/>
            <stop offset="100%" style="stop-color:#0c1929"/>
          </linearGradient>
          <linearGradient id="nightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#0a0a15"/>
            <stop offset="100%" style="stop-color:#020208"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="landGlow">
            <feGaussianBlur stdDeviation="1" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        
        <!-- Ocean background -->
        <rect width="${width}" height="${height}" fill="url(#dayGrad)"/>
        
        <!-- Night overlay -->
        <path d="${nightPath}" fill="url(#nightGrad)" opacity="0.9"/>
        
        <!-- Grid lines -->
        <g stroke="rgba(255,255,255,0.05)" stroke-width="0.5">${gridLines}</g>
        
        <!-- Equator (highlighted) -->
        <line x1="0" y1="${latToY(0)}" x2="${width}" y2="${latToY(0)}" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="4,4"/>
        
        <!-- Continents -->
        <g filter="url(#landGlow)">
          ${continentsPath}
        </g>
        
        <!-- Terminator line (twilight zone) -->
        <path d="M ${terminator.map(p => `${lngToX(p.lng).toFixed(1)},${latToY(p.lat).toFixed(1)}`).join(' L ')}" 
              fill="none" 
              stroke="rgba(255,180,80,0.5)" 
              stroke-width="2" 
              filter="url(#glow)"/>
        
        <!-- Timezone markers -->
        ${markersSVG}
        
        <!-- UTC timestamp -->
        <text x="${width - 8}" y="14" text-anchor="end" fill="rgba(255,255,255,0.5)" font-size="10" font-family="monospace">
          UTC ${date.toISOString().slice(11, 16)}
        </text>
        
        <!-- Sun indicator (sub-solar point) -->
        <circle cx="${lngToX(-((date.getUTCHours() + date.getUTCMinutes()/60 - 12) * 15))}" 
                cy="${latToY(getSunPosition(date).declination * 180 / Math.PI)}" 
                r="4" fill="#fbbf24" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite"/>
        </circle>
      </svg>
    `;
  }

  function renderMap(date) {
    if (!mapContainerEl) {
      console.warn('[TimezoneSyncWidget] mapContainerEl not found');
      return;
    }
    mapContainerEl.innerHTML = createWorldMapSVG(date, currentConfig);
  }

  function startMapUpdates() {
    stopMapUpdates();
    renderMap(new Date());
    mapUpdateInterval = setInterval(() => renderMap(new Date()), MAP_UPDATE_INTERVAL_MS);
  }

  function stopMapUpdates() {
    if (mapUpdateInterval) {
      clearInterval(mapUpdateInterval);
      mapUpdateInterval = null;
    }
  }

  // ============================================================================
  // Widget Core Functions
  // ============================================================================

  function ensureDependencies() {
    if (typeof GlobalSyncWidget === 'undefined') {
      console.error('[TimezoneSyncWidget] GlobalSyncWidget is required but not loaded');
      return false;
    }
    if (typeof TimezoneUtils === 'undefined') {
      console.error('[TimezoneSyncWidget] TimezoneUtils is required but not loaded');
      return false;
    }
    return true;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      #${OVERLAY_ID}.visible {
        display: flex;
      }
      #${OVERLAY_ID} .exl-timezone-shell {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 12px;
        min-width: 360px;
        max-width: 720px;
        box-shadow: 0 10px 35px rgba(0, 0, 0, 0.45);
      }
      #${OVERLAY_ID} .exl-timezone-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
        color: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
      }
      #${OVERLAY_ID} .exl-timezone-close {
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.08);
        color: #e2e8f0;
        border-radius: 8px;
        padding: 6px 10px;
        cursor: pointer;
        transition: background 0.15s ease;
        font-size: 12px;
      }
      #${OVERLAY_ID} .exl-timezone-close:hover {
        background: rgba(255, 255, 255, 0.16);
      }
      #${MAP_CONTAINER_ID} {
        margin-bottom: 12px;
        border-radius: 10px;
        overflow: hidden;
        background: #0a0a1a;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .exl-map-legend {
        display: flex;
        justify-content: center;
        gap: 16px;
        padding: 6px 0 12px;
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .exl-map-legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .exl-map-legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .exl-map-legend-dot.day { background: linear-gradient(135deg, #1e3a5f, #0f2744); }
      .exl-map-legend-dot.night { background: linear-gradient(135deg, #0a0a1a, #050510); }
      .exl-map-legend-dot.you { background: #3b82f6; }
      .exl-map-legend-dot.customer { background: #22c55e; }
      
      /* Customer Timezone Selector */
      .exl-tz-selector {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        margin: 0 12px;
      }
      .exl-tz-selector label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        white-space: nowrap;
      }
      .exl-tz-selector input {
        flex: 1;
        min-width: 180px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        padding: 6px 10px;
        color: #e2e8f0;
        font-size: 12px;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .exl-tz-selector input:focus {
        border-color: rgba(99, 102, 241, 0.6);
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
      }
      .exl-tz-selector input.exl-tz-input-error {
        border-color: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
      }
      .exl-tz-selector input::placeholder {
        color: rgba(255, 255, 255, 0.35);
      }
      .exl-tz-error-msg {
        font-size: 10px;
        color: #ef4444;
        margin-left: 4px;
        display: none;
      }
      .exl-tz-selector.has-error .exl-tz-error-msg {
        display: inline;
      }
    `;
    document.head.appendChild(style);
  }

  function destroyOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
      shellEl = null;
      mapContainerEl = null;
      legendEl = null;
      containerEl = null;
      customerTzInput = null;
    }
  }

  function handleCustomerTimezoneChange(event) {
    const newValue = event.target.value.trim();
    const selectorWrapper = event.target.closest('.exl-tz-selector');
    
    // Validate against known timezones
    if (!allTimezones) {
      allTimezones = TimezoneUtils.getAllTimezones();
    }
    
    const isValid = allTimezones.includes(newValue);
    
    if (isValid) {
      // Clear error state
      event.target.classList.remove('exl-tz-input-error');
      selectorWrapper.classList.remove('has-error');
      
      // Update config
      currentConfig.customerTimezone = newValue;
      
      // Update GlobalSyncWidget
      if (typeof GlobalSyncWidget !== 'undefined' && typeof GlobalSyncWidget.updateConfig === 'function') {
        GlobalSyncWidget.updateConfig({ customerTimezone: newValue });
      }
      
      // Re-render map with new marker position
      renderMap(new Date());
      
      console.log('[TimezoneSyncWidget] Customer timezone changed to:', newValue);
    } else {
      // Show error state
      event.target.classList.add('exl-tz-input-error');
      selectorWrapper.classList.add('has-error');
      console.warn('[TimezoneSyncWidget] Invalid timezone:', newValue);
    }
  }

  function buildOverlay() {
    // Always destroy and rebuild to ensure fresh DOM
    destroyOverlay();

    injectStyles();

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.setAttribute('data-exl-injected', 'true');

    shellEl = document.createElement('div');
    shellEl.className = 'exl-timezone-shell';

    // Header
    const header = document.createElement('div');
    header.className = 'exl-timezone-header';
    const title = document.createElement('div');
    title.textContent = 'Timezone Inspector';
    
    // Customer Timezone Selector
    const selectorWrapper = document.createElement('div');
    selectorWrapper.className = 'exl-tz-selector';
    
    const selectorLabel = document.createElement('label');
    selectorLabel.textContent = 'Customer:';
    selectorLabel.setAttribute('for', 'exl-tz-input');
    
    customerTzInput = document.createElement('input');
    customerTzInput.type = 'text';
    customerTzInput.id = 'exl-tz-input';
    customerTzInput.setAttribute('list', 'exl-tz-list');
    customerTzInput.placeholder = 'Select timezone...';
    customerTzInput.value = currentConfig?.customerTimezone || '';
    customerTzInput.autocomplete = 'off';
    
    const datalist = document.createElement('datalist');
    datalist.id = 'exl-tz-list';
    
    // Populate datalist with all IANA timezones (cached)
    if (!allTimezones) {
      allTimezones = TimezoneUtils.getAllTimezones();
    }
    allTimezones.forEach(tz => {
      const option = document.createElement('option');
      option.value = tz;
      datalist.appendChild(option);
    });
    
    const errorMsg = document.createElement('span');
    errorMsg.className = 'exl-tz-error-msg';
    errorMsg.textContent = 'Invalid timezone';
    
    // Handle timezone change
    customerTzInput.addEventListener('change', handleCustomerTimezoneChange);
    
    selectorWrapper.appendChild(selectorLabel);
    selectorWrapper.appendChild(customerTzInput);
    selectorWrapper.appendChild(datalist);
    selectorWrapper.appendChild(errorMsg);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'exl-timezone-close';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', hide);
    
    header.appendChild(title);
    header.appendChild(selectorWrapper);
    header.appendChild(closeBtn);
    shellEl.appendChild(header);

    // Map container (ABOVE the GlobalSyncWidget)
    mapContainerEl = document.createElement('div');
    mapContainerEl.id = MAP_CONTAINER_ID;
    shellEl.appendChild(mapContainerEl);

    // Legend
    legendEl = document.createElement('div');
    legendEl.className = 'exl-map-legend';
    legendEl.innerHTML = `
      <span class="exl-map-legend-item"><span class="exl-map-legend-dot day"></span>Day</span>
      <span class="exl-map-legend-item"><span class="exl-map-legend-dot night"></span>Night</span>
      <span class="exl-map-legend-item"><span class="exl-map-legend-dot you"></span>You</span>
      <span class="exl-map-legend-item"><span class="exl-map-legend-dot customer"></span>Customer</span>
    `;
    shellEl.appendChild(legendEl);

    // Widget container (for GlobalSyncWidget - this gets replaced by GSW)
    containerEl = document.createElement('div');
    containerEl.id = CONTAINER_ID;
    shellEl.appendChild(containerEl);

    overlayEl.appendChild(shellEl);
    document.body.appendChild(overlayEl);

    overlayEl.addEventListener('click', (event) => {
      if (event.target === overlayEl) hide();
    });

    console.log('[TimezoneSyncWidget] Overlay built with map container');
  }

  async function getUserTimezone(preferred) {
    if (preferred) return preferred;
    try {
      if (typeof UserPreferences !== 'undefined') {
        const prefs = await UserPreferences.load();
        const effective = UserPreferences.getEffectiveUserTimezone(prefs);
        if (effective) return effective;
        if (prefs?.userTimezone?.manual) return prefs.userTimezone.manual;
        if (prefs?.userTimezone?.detected) return prefs.userTimezone.detected;
      }
    } catch (error) {
      console.warn('[TimezoneSyncWidget] Failed to read user preferences:', error);
    }
    return TimezoneUtils.getBrowserTimezone();
  }

  async function getFavoriteTimezones(favorites) {
    if (favorites && Array.isArray(favorites)) return favorites.filter(Boolean);
    try {
      if (typeof UserPreferences !== 'undefined') {
        const prefs = await UserPreferences.load();
        return (prefs?.favoriteTimezones || []).filter(Boolean);
      }
    } catch (error) {
      console.warn('[TimezoneSyncWidget] Failed to read favorite timezones:', error);
    }
    return [];
  }

  async function buildConfig(options = {}) {
    const localTimezone = await getUserTimezone(options.localTimezone);
    const customerTimezone = options.customerTimezone || options.targetTimezone || null;
    const favoriteTimezones = await getFavoriteTimezones(options.favoriteTimezones);
    return { localTimezone, customerTimezone, favoriteTimezones };
  }

  async function show(options = {}) {
    if (!ensureDependencies()) return false;

    const config = await buildConfig(options);
    if (!config.customerTimezone) {
      console.warn('[TimezoneSyncWidget] Missing customer timezone');
      return false;
    }

    currentConfig = config;
    
    // Store original customer timezone for reset on close
    originalCustomerTimezone = config.customerTimezone;

    // Build fresh overlay
    buildOverlay();

    // Show overlay
    overlayEl.classList.add('visible');
    overlayEl.setAttribute('aria-hidden', 'false');

    // Render map FIRST
    startMapUpdates();

    // Initialize GlobalSyncWidget inside containerEl
    if (typeof GlobalSyncWidget.destroy === 'function') {
      GlobalSyncWidget.destroy();
    }

    const initResult = GlobalSyncWidget.init(containerEl, config);
    if (!initResult) {
      hide();
      return false;
    }

    if (!escHandler) {
      escHandler = (event) => {
        if (event.key === 'Escape') hide();
      };
      document.addEventListener('keydown', escHandler, true);
    }

    isVisible = true;
    console.log('[TimezoneSyncWidget] Shown with map, config:', config);
    return true;
  }

  function hide() {
    stopMapUpdates();

    if (typeof GlobalSyncWidget !== 'undefined' && typeof GlobalSyncWidget.destroy === 'function') {
      GlobalSyncWidget.destroy();
    }

    if (overlayEl) {
      overlayEl.classList.remove('visible');
      overlayEl.setAttribute('aria-hidden', 'true');
    }

    if (escHandler) {
      document.removeEventListener('keydown', escHandler, true);
      escHandler = null;
    }

    isVisible = false;
    
    // Reset customer timezone to original value (changes don't persist)
    if (currentConfig && originalCustomerTimezone) {
      currentConfig.customerTimezone = originalCustomerTimezone;
    }
    originalCustomerTimezone = null;
    currentConfig = null;
  }

  return {
    show,
    hide,
    isVisible: () => isVisible
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezoneSyncWidget;
}
