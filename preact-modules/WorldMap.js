import { useEffect, useRef, useMemo, useState } from './preact-setup.js'
import * as d3 from './lib/d3.module.js'
import * as topojson from './lib/topojson-client.module.js'
import { html } from './preact-setup.js'

const TIMEZONE_COORDS = {
  // Africa
  'Africa/Abidjan': { lat: 5.3600, lng: -4.0083 },
  'Africa/Accra': { lat: 5.6037, lng: -0.1870 },
  'Africa/Addis_Ababa': { lat: 9.0320, lng: 38.7469 },
  'Africa/Algiers': { lat: 36.7538, lng: 3.0588 },
  'Africa/Cairo': { lat: 30.0444, lng: 31.2357 },
  'Africa/Casablanca': { lat: 33.5731, lng: -7.5898 },
  'Africa/Johannesburg': { lat: -26.2041, lng: 28.0473 },
  'Africa/Lagos': { lat: 6.5244, lng: 3.3792 },
  'Africa/Nairobi': { lat: -1.2921, lng: 36.8219 },
  'Africa/Tunis': { lat: 36.8065, lng: 10.1815 },

  // America
  'America/Anchorage': { lat: 61.2181, lng: -149.9003 },
  'America/Argentina/Buenos_Aires': { lat: -34.6037, lng: -58.3816 },
  'America/Bogota': { lat: 4.7110, lng: -74.0721 },
  'America/Caracas': { lat: 10.4806, lng: -66.9036 },
  'America/Chicago': { lat: 41.8781, lng: -87.6298 },
  'America/Denver': { lat: 39.7392, lng: -104.9903 },
  'America/Halifax': { lat: 44.6488, lng: -63.5752 },
  'America/Havana': { lat: 23.1136, lng: -82.3666 },
  'America/Lima': { lat: -12.0464, lng: -77.0428 },
  'America/Los_Angeles': { lat: 34.0522, lng: -118.2437 },
  'America/Mexico_City': { lat: 19.4326, lng: -99.1332 },
  'America/New_York': { lat: 40.7128, lng: -74.0060 },
  'America/Panama': { lat: 8.9824, lng: -79.5199 },
  'America/Phoenix': { lat: 33.4484, lng: -112.0740 },
  'America/Santiago': { lat: -33.4489, lng: -70.6693 },
  'America/Sao_Paulo': { lat: -23.5505, lng: -46.6333 },
  'America/Toronto': { lat: 43.6532, lng: -79.3832 },
  'America/Vancouver': { lat: 49.2827, lng: -123.1207 },

  // Asia
  'Asia/Almaty': { lat: 43.2220, lng: 76.8512 },
  'Asia/Baghdad': { lat: 33.3152, lng: 44.3661 },
  'Asia/Baku': { lat: 40.4093, lng: 49.8671 },
  'Asia/Bangkok': { lat: 13.7563, lng: 100.5018 },
  'Asia/Beirut': { lat: 33.8938, lng: 35.5018 },
  'Asia/Chennai': { lat: 13.0827, lng: 80.2707 },
  'Asia/Colombo': { lat: 6.9271, lng: 79.8612 },
  'Asia/Dhaka': { lat: 23.8103, lng: 90.4125 },
  'Asia/Dubai': { lat: 25.2048, lng: 55.2708 },
  'Asia/Ho_Chi_Minh': { lat: 10.8231, lng: 106.6297 },
  'Asia/Hong_Kong': { lat: 22.3193, lng: 114.1694 },
  'Asia/Jakarta': { lat: -6.2088, lng: 106.8456 },
  'Asia/Jerusalem': { lat: 31.7683, lng: 35.2137 },
  'Asia/Kabul': { lat: 34.5553, lng: 69.2075 },
  'Asia/Karachi': { lat: 24.8607, lng: 67.0011 },
  'Asia/Kathmandu': { lat: 27.7172, lng: 85.3240 },
  'Asia/Kolkata': { lat: 22.5726, lng: 88.3639 },
  'Asia/Kuala_Lumpur': { lat: 3.1390, lng: 101.6869 },
  'Asia/Kuwait': { lat: 29.3759, lng: 47.9774 },
  'Asia/Manila': { lat: 14.5995, lng: 120.9842 },
  'Asia/Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Asia/Riyadh': { lat: 24.7136, lng: 46.6753 },
  'Asia/Seoul': { lat: 37.5665, lng: 126.9780 },
  'Asia/Shanghai': { lat: 31.2304, lng: 121.4737 },
  'Asia/Singapore': { lat: 1.3521, lng: 103.8198 },
  'Asia/Taipei': { lat: 25.0330, lng: 121.5654 },
  'Asia/Tehran': { lat: 35.6892, lng: 51.3890 },
  'Asia/Tokyo': { lat: 35.6762, lng: 139.6503 },

  // Atlantic
  'Atlantic/Azores': { lat: 37.7412, lng: -25.6756 },
  'Atlantic/Reykjavik': { lat: 64.1466, lng: -21.9426 },

  // Australia
  'Australia/Adelaide': { lat: -34.9285, lng: 138.6007 },
  'Australia/Brisbane': { lat: -27.4698, lng: 153.0251 },
  'Australia/Darwin': { lat: -12.4634, lng: 130.8456 },
  'Australia/Melbourne': { lat: -37.8136, lng: 144.9631 },
  'Australia/Perth': { lat: -31.9505, lng: 115.8605 },
  'Australia/Sydney': { lat: -33.8688, lng: 151.2093 },

  // Europe
  'Europe/Amsterdam': { lat: 52.3676, lng: 4.9041 },
  'Europe/Athens': { lat: 37.9838, lng: 23.7275 },
  'Europe/Berlin': { lat: 52.5200, lng: 13.4050 },
  'Europe/Brussels': { lat: 50.8503, lng: 4.3517 },
  'Europe/Bucharest': { lat: 44.4268, lng: 26.1025 },
  'Europe/Budapest': { lat: 47.4979, lng: 19.0402 },
  'Europe/Copenhagen': { lat: 55.6761, lng: 12.5683 },
  'Europe/Dublin': { lat: 53.3498, lng: -6.2603 },
  'Europe/Helsinki': { lat: 60.1699, lng: 24.9384 },
  'Europe/Istanbul': { lat: 41.0082, lng: 28.9784 },
  'Europe/Kiev': { lat: 50.4501, lng: 30.5234 },
  'Europe/Lisbon': { lat: 38.7223, lng: -9.1393 },
  'Europe/London': { lat: 51.5074, lng: -0.1278 },
  'Europe/Madrid': { lat: 40.4168, lng: -3.7038 },
  'Europe/Moscow': { lat: 55.7558, lng: 37.6173 },
  'Europe/Oslo': { lat: 59.9139, lng: 10.7522 },
  'Europe/Paris': { lat: 48.8566, lng: 2.3522 },
  'Europe/Prague': { lat: 50.0755, lng: 14.4378 },
  'Europe/Rome': { lat: 41.9028, lng: 12.4964 },
  'Europe/Stockholm': { lat: 59.3293, lng: 18.0686 },
  'Europe/Vienna': { lat: 48.2082, lng: 16.3738 },
  'Europe/Warsaw': { lat: 52.2297, lng: 21.0122 },
  'Europe/Zurich': { lat: 47.3769, lng: 8.5417 },

  // Pacific
  'Pacific/Auckland': { lat: -36.8485, lng: 174.7633 },
  'Pacific/Fiji': { lat: -18.1416, lng: 178.4419 },
  'Pacific/Guam': { lat: 13.4443, lng: 144.7937 },
  'Pacific/Honolulu': { lat: 21.3069, lng: -157.8583 },
  'Pacific/Midway': { lat: 28.2072, lng: -177.3735 },
  'Pacific/Samoa': { lat: -13.8333, lng: -171.7500 },

  // UTC
  'UTC': { lat: 0, lng: 0 },
}

function getTimeBasedGradient(date) {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const timeDecimal = hours + minutes / 60

  if (timeDecimal >= 5 && timeDecimal < 7) {
    return { start: '#6a83f0', end: '#ca96fd' }
  } else if (timeDecimal >= 7 && timeDecimal < 9) {
    return { start: '#f0c06a', end: '#fd9696' }
  } else if (timeDecimal >= 9 && timeDecimal < 12) {
    return { start: '#7ec8f0', end: '#a0d4f5' }
  } else if (timeDecimal >= 12 && timeDecimal < 17) {
    return { start: '#5bb5f0', end: '#87ceeb' }
  } else if (timeDecimal >= 17 && timeDecimal < 19) {
    return { start: '#f0a06a', end: '#fd96c8' }
  } else if (timeDecimal >= 19 && timeDecimal < 21) {
    return { start: '#6a83f0', end: '#ca96fd' }
  } else {
    return { start: '#3a4a8f', end: '#6a5acd' }
  }
}

function getSolarPosition(date) {
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 0))
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000)
  
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10))
  const longitude = (12 - hour) * 15
  
  return { declination, longitude }
}

function createNightPolygons(date) {
  const { declination, longitude: solarLng } = getSolarPosition(date)
  const decRad = declination * Math.PI / 180
  
  const getStepSize = (lat) => {
    const absLat = Math.abs(lat)
    if (absLat > 80) return 0.1
    if (absLat > 60) return 0.5
    return 2.0
  }
  
  const terminatorPoints = []
  
  let lat = 90
  while (lat >= -90) {
    const latRad = lat * Math.PI / 180
    const cosHA = -Math.tan(latRad) * Math.tan(decRad)
    
    let hourAngle
    if (cosHA >= 1) hourAngle = 180
    else if (cosHA <= -1) hourAngle = 0
    else hourAngle = Math.acos(cosHA) * 180 / Math.PI
    
    const sunsetLng = solarLng - hourAngle
    terminatorPoints.push([sunsetLng, lat])
    
    if (lat === -90) break
    
    lat -= getStepSize(lat)
    if (lat < -90) lat = -90
  }
  
  lat = -90
  while (lat <= 90) {
    const latRad = lat * Math.PI / 180
    const cosHA = -Math.tan(latRad) * Math.tan(decRad)
    
    let hourAngle
    if (cosHA >= 1) hourAngle = 180
    else if (cosHA <= -1) hourAngle = 0
    else hourAngle = Math.acos(cosHA) * 180 / Math.PI
    
    const sunriseLng = solarLng + hourAngle
    terminatorPoints.push([sunriseLng, lat])
    
    if (lat === 90) break
    
    lat += getStepSize(lat)
    if (lat > 90) lat = 90
  }
  
  if (terminatorPoints.length > 0) {
    terminatorPoints.push(terminatorPoints[0])
  }
  
  const outerRing = [
    [-180, 90], [180, 90], [180, -90], [-180, -90], [-180, 90]
  ]
  
  return [[...outerRing], terminatorPoints]
}

export function WorldMap({ currentTime, pins = [], className = '' }) {
  const svgRef = useRef(null)
  const [worldData, setWorldData] = useState(null)

  const enrichedPins = useMemo(() => {
    return pins.map(pin => ({
      ...pin,
      lat: TIMEZONE_COORDS[pin.timezone]?.lat ?? pin.lat,
      lng: TIMEZONE_COORDS[pin.timezone]?.lng ?? pin.lng,
    }))
  }, [pins])

  useEffect(() => {
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(data => {
        if (data) {
          setWorldData(data)
        }
      })
      .catch(err => {
        console.error('Failed to load world map:', err)
      })
  }, [])

  useEffect(() => {
    if (!svgRef.current) return

    const width = 960
    const height = 400
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const projection = d3.geoNaturalEarth1()
      .scale(140)
      .translate([width / 2, height / 2])

    const path = d3.geoPath().projection(projection)

    const defs = svg.append('defs')
    const gradient = defs.append('linearGradient')
      .attr('id', 'bgGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '100%')
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', getTimeBasedGradient(currentTime).start)
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', getTimeBasedGradient(currentTime).end)

    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#bgGradient)')

    const graticule = d3.geoGraticule()
    svg.append('path')
      .datum(graticule())
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', 'oklch(0.25 0.03 250)')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.5)

    const nightPolygons = createNightPolygons(currentTime)

    if (worldData) {
      const countries = topojson.feature(worldData, worldData.objects.countries)
      
      svg.append('g')
        .selectAll('path')
        .data(countries.features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('fill', 'oklch(0.30 0.04 250)')
        .attr('stroke', 'oklch(0.40 0.03 250)')
        .attr('stroke-width', 0.5)
    }

    if (nightPolygons.length === 2) {
      const [outerRing, dayPolygon] = nightPolygons
      
      const nightFeature = {
        type: 'Polygon',
        coordinates: [outerRing, dayPolygon]
      }
      
      svg.append('path')
        .datum(nightFeature)
        .attr('d', path)
        .attr('fill', 'rgba(0, 0, 40, 0.65)')
        .attr('stroke', 'none')
      
      const terminatorFeature = {
        type: 'Polygon',
        coordinates: [dayPolygon]
      }
      svg.append('path')
        .datum(terminatorFeature)
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', 'oklch(0.65 0.19 145)')
        .attr('stroke-width', 2)
    }

    enrichedPins.forEach(pin => {
      const [x, y] = projection([pin.lng, pin.lat]) || [0, 0]
      
      svg.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 6)
        .attr('fill', 'oklch(0.65 0.19 145)')
        .attr('stroke', 'oklch(0.98 0 0)')
        .attr('stroke-width', 2)

      svg.append('text')
        .attr('x', x)
        .attr('y', y - 14)
        .attr('text-anchor', 'middle')
        .attr('fill', 'oklch(0.98 0 0)')
        .attr('font-size', '13px')
        .attr('font-weight', '600')
        .attr('stroke', 'oklch(0.15 0.03 250)')
        .attr('stroke-width', 4)
        .attr('paint-order', 'stroke')
        .text(pin.label)
    })

  }, [currentTime, enrichedPins, worldData])

  return html`
    <div className=${`relative rounded-lg overflow-hidden border border-border bg-card ${className}`} style=${{ height: '200px' }}>
      <svg
        ref=${svgRef}
        width="100%"
        height="200"
        viewBox="0 0 960 400"
        preserveAspectRatio="xMidYMid slice"
        className="block"
      />
    </div>
  `
}
