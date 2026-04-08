import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './SafehouseLocationsPage.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegionInfo {
  geoName: string
  name: string
  code: string
  population: number
  area: number       // km²
  density: number    // people / km²
  avgIncome: number  // PHP / year (PSA FIES estimate)
  vawcPer100k: number // VAWC cases per 100 k (PNP estimate)
  existingSafehouse: string | null
  group: 'Luzon' | 'Visayas' | 'Mindanao'
}

interface GeoFeature {
  type: 'Feature'
  properties: { REGION: string }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

interface GeoJSON {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

// ─── Region data ─────────────────────────────────────────────────────────────
// Population: PSA estimates (M = million). Income: PSA FIES 2021.
// VAWC rate (per 100k): 10 regions from verified PNP/PSA data supplied Apr 2026.
// Remaining 7 regions marked with † use proportional mid-range estimates (~15/100k)
// and should be replaced with official PNP regional breakdowns when available.

const REGIONS: RegionInfo[] = [
  // existingSafehouse = Lighthouse Sanctuary locations only
  { geoName: 'Metropolitan Manila',                         name: 'National Capital Region',  code: 'NCR',   population: 14_500_000, area:  636,   density: 21_204, avgIncome: 448_000, vawcPer100k: 11.4, existingSafehouse: 'Lighthouse Sanctuary · Quezon City', group: 'Luzon'    },
  { geoName: 'Ilocos Region (Region I)',                    name: 'Ilocos Region',            code: 'I',     population:  5_400_000, area: 13_012, density:    415, avgIncome: 248_000, vawcPer100k: 10.7, existingSafehouse: 'Lighthouse Sanctuary · Ilocos',      group: 'Luzon'    },
  { geoName: 'Cagayan Valley (Region II)',                  name: 'Cagayan Valley',           code: 'II',    population:  3_700_000, area: 28_228, density:    131, avgIncome: 220_000, vawcPer100k: 11.3, existingSafehouse: null,                                 group: 'Luzon'    },
  { geoName: 'Central Luzon (Region III)',                  name: 'Central Luzon',            code: 'III',   population: 12_600_000, area: 22_014, density:    573, avgIncome: 348_000, vawcPer100k: 12.0, existingSafehouse: null,                                 group: 'Luzon'    },
  { geoName: 'CALABARZON (Region IV-A)',                    name: 'CALABARZON',               code: 'IVA',   population: 16_500_000, area: 16_873, density:    978, avgIncome: 398_000, vawcPer100k: 12.0, existingSafehouse: null,                                 group: 'Luzon'    },
  { geoName: 'MIMAROPA (Region IV-B)',                      name: 'MIMAROPA',                 code: 'IVB',   population:  3_228_558, area: 29_621, density:    109, avgIncome: 195_000, vawcPer100k: 15.0, existingSafehouse: null,                                 group: 'Luzon'    },
  { geoName: 'Bicol Region (Region V)',                     name: 'Bicol Region',             code: 'V',     population:  6_082_165, area: 18_155, density:    335, avgIncome: 175_000, vawcPer100k: 16.0, existingSafehouse: null,                                 group: 'Luzon'    },
  { geoName: 'Cordillera Administrative Region (CAR)',      name: 'Cordillera (CAR)',         code: 'CAR',   population:  1_800_000, area: 19_422, density:     93, avgIncome: 248_000, vawcPer100k: 65.8, existingSafehouse: null,                                 group: 'Luzon'    },
  { geoName: 'Western Visayas (Region VI)',                 name: 'Western Visayas',          code: 'VI',    population:  8_100_000, area: 20_223, density:    401, avgIncome: 220_000, vawcPer100k: 21.6, existingSafehouse: null,                                 group: 'Visayas'  },
  { geoName: 'Central Visayas (Region VII)',                name: 'Central Visayas',          code: 'VII',   population:  8_200_000, area: 15_873, density:    517, avgIncome: 244_000, vawcPer100k: 18.0, existingSafehouse: null,                                 group: 'Visayas'  },
  { geoName: 'Eastern Visayas (Region VIII)',               name: 'Eastern Visayas',          code: 'VIII',  population:  4_547_150, area: 21_432, density:    212, avgIncome: 175_000, vawcPer100k: 17.0, existingSafehouse: null,                                 group: 'Visayas'  },
  { geoName: 'Zamboanga Peninsula (Region IX)',             name: 'Zamboanga Peninsula',      code: 'IX',    population:  3_875_576, area: 17_067, density:    227, avgIncome: 165_000, vawcPer100k: 15.0, existingSafehouse: null,                                 group: 'Mindanao' },
  { geoName: 'Northern Mindanao (Region X)',                name: 'Northern Mindanao',        code: 'X',     population:  5_022_768, area: 20_496, density:    245, avgIncome: 215_000, vawcPer100k: 17.0, existingSafehouse: null,                                 group: 'Mindanao' },
  { geoName: 'Davao Region (Region XI)',                    name: 'Davao Region',             code: 'XI',    population:  5_400_000, area: 20_357, density:    265, avgIncome: 248_000, vawcPer100k: 20.3, existingSafehouse: null,                                 group: 'Mindanao' },
  { geoName: 'SOCCSKSARGEN (Region XII)',                   name: 'SOCCSKSARGEN',             code: 'XII',   population:  4_901_486, area: 22_513, density:    218, avgIncome: 188_000, vawcPer100k: 15.0, existingSafehouse: null,                                 group: 'Mindanao' },
  { geoName: 'Caraga (Region XIII)',                        name: 'Caraga',                   code: 'XIII',  population:  2_804_788, area: 21_478, density:    131, avgIncome: 188_000, vawcPer100k: 14.0, existingSafehouse: null,                                 group: 'Mindanao' },
  { geoName: 'Autonomous Region of Muslim Mindanao (ARMM)', name: 'Bangsamoro (BARMM)',       code: 'BARMM', population:  4_900_000, area: 40_782, density:    120, avgIncome: 143_000, vawcPer100k:  4.3, existingSafehouse: null,                                 group: 'Mindanao' },
]

// ─── Map projection ───────────────────────────────────────────────────────────

const W = 420
const H = 730
const LON_MIN = 116.5
const LON_MAX = 127.5
const LAT_MIN = 4.0
const LAT_MAX = 21.8

function toX(lon: number): number {
  return ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W
}
function toY(lat: number): number {
  return ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H
}

function ringToD(ring: number[][]): string {
  if (ring.length < 2) return ''
  const pts = ring.map(([lon, lat]) => `${toX(lon).toFixed(1)},${toY(lat).toFixed(1)}`)
  return `M ${pts.join(' L ')} Z`
}

function geometryToD(geometry: GeoFeature['geometry']): string {
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as number[][][]).map(ring => ringToD(ring)).join(' ')
  }
  return (geometry.coordinates as number[][][][])
    .flatMap(poly => poly.map(ring => ringToD(ring)))
    .join(' ')
}

// ─── Color scale (log) ───────────────────────────────────────────────────────
// seafoam #d4ebd0 → tidal #5e9ea0 → deep #2c4a52

const LOG_MIN = Math.log10(93)
const LOG_MAX = Math.log10(21_204)

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function densityColor(density: number): string {
  const t = Math.max(0, Math.min(1, (Math.log10(density) - LOG_MIN) / (LOG_MAX - LOG_MIN)))
  let r: number, g: number, b: number
  if (t < 0.5) {
    const s = t * 2
    r = lerp(212, 94, s); g = lerp(235, 158, s); b = lerp(208, 160, s)
  } else {
    const s = (t - 0.5) * 2
    r = lerp(94, 44, s); g = lerp(158, 74, s); b = lerp(160, 82, s)
  }
  return `rgb(${r},${g},${b})`
}

function textOnColor(density: number): string {
  const t = (Math.log10(density) - LOG_MIN) / (LOG_MAX - LOG_MIN)
  return t > 0.55 ? '#ffffff' : '#2c4a52'
}

// ─── Other facilities (non-Lighthouse) ───────────────────────────────────────

type FacilityType = 'DSWD' | 'NGO' | 'Church' | 'Private'

interface OtherFacility {
  key: string
  name: string
  type: FacilityType
  region: string   // matches RegionInfo.code
  lon: number
  lat: number
}

const FACILITY_COLOR: Record<FacilityType, string> = {
  DSWD:    '#4a90c4',  // government blue
  NGO:     '#e07b39',  // warm orange
  Church:  '#8e5ea2',  // purple
  Private: '#3aaa7a',  // green
}

const OTHER_FACILITIES: OtherFacility[] = [
  // Region I – Regional Haven (DSWD) alongside Lighthouse
  { key: 'i-dswd',      name: 'Regional Haven (DSWD)',          type: 'DSWD',    region: 'I',     lon: 120.52, lat: 17.55 },
  // CAR – Baguio facilities
  { key: 'car-dswd',    name: 'Regional Haven, Baguio (DSWD)',  type: 'DSWD',    region: 'CAR',   lon: 120.59, lat: 16.41 },
  { key: 'car-rscc',    name: 'RSCC',                           type: 'NGO',     region: 'CAR',   lon: 120.63, lat: 16.38 },
  // NCR – high-density cluster
  { key: 'ncr-mar',     name: 'Marillac Hills (DSWD)',          type: 'DSWD',    region: 'NCR',   lon: 121.00, lat: 14.55 },
  { key: 'ncr-lv',      name: 'Laura Vicuña',                   type: 'Church',  region: 'NCR',   lon: 121.09, lat: 14.70 },
  // Region III – gap area, only DSWD
  { key: 'iii-dswd',    name: 'Regional Haven (DSWD)',          type: 'DSWD',    region: 'III',   lon: 120.69, lat: 15.12 },
  // Region IV-A – gap area
  { key: 'iva-dswd',    name: 'Regional Haven (DSWD)',          type: 'DSWD',    region: 'IVA',   lon: 121.07, lat: 14.21 },
  { key: 'iva-faith',   name: 'Faith-based NGOs',               type: 'Church',  region: 'IVA',   lon: 121.16, lat: 14.08 },
  // Region VII – NGO hub (Cebu)
  { key: 'vii-hh',      name: 'Happy Horizons',                 type: 'NGO',     region: 'VII',   lon: 123.87, lat: 10.37 },
  { key: 'vii-ef',      name: 'EverFree',                       type: 'NGO',     region: 'VII',   lon: 123.92, lat: 10.32 },
  { key: 'vii-pcs',     name: "Philippine Children's Shelter",  type: 'NGO',     region: 'VII',   lon: 123.95, lat: 10.30 },
  // Region XI – Davao
  { key: 'xi-dswd',     name: 'Regional Haven (DSWD)',          type: 'DSWD',    region: 'XI',    lon: 125.57, lat: 7.15 },
  { key: 'xi-traf',     name: 'Trafficking Specialist Center',  type: 'Private', region: 'XI',    lon: 125.63, lat: 7.10 },
  // BARMM – critical desert, only DSWD present
  { key: 'barmm-dswd',  name: 'Regional Haven (DSWD)',          type: 'DSWD',    region: 'BARMM', lon: 124.25, lat: 7.30 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  return `${(n / 1_000).toFixed(0)}k`
}

function scoreRegion(r: RegionInfo): number {
  // Already has a Lighthouse — not a candidate
  if (r.existingSafehouse) return -1

  const densityScore = Math.log10(r.density) / Math.log10(21_204)
  const vawcScore    = r.vawcPer100k / 65.8
  const needScore    = densityScore * 0.5 + vawcScore * 0.5

  // Penalize regions that already have coverage from other orgs
  // Each other facility reduces score by 0.1, capped at 0.4
  const otherCount     = OTHER_FACILITIES.filter(f => f.region === r.code).length
  const coveragePenalty = Math.min(0.4, otherCount * 0.1)

  return needScore - coveragePenalty
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SafehouseLocationsPage() {
  const [geo, setGeo]             = useState<GeoJSON | null>(null)
  const [hovered, setHovered]     = useState<RegionInfo | null>(null)
  const [selected, setSelected]   = useState<RegionInfo | null>(null)
  const [tipPos, setTipPos]       = useState({ x: 0, y: 0 })
  const mapRef                    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/data/philippines-regions.json')
      .then(r => r.json())
      .then((data: GeoJSON) => setGeo(data))
      .catch(console.error)
  }, [])

  function handleMouseMove(e: React.MouseEvent) {
    const rect = mapRef.current?.getBoundingClientRect()
    if (!rect) return
    setTipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 8 })
  }

  function handleClick(info: RegionInfo) {
    setSelected(prev => prev?.geoName === info.geoName ? null : info)
  }

  const activeRegion = selected ?? hovered

  const topCandidates = [...REGIONS]
    .filter(r => !r.existingSafehouse)
    .sort((a, b) => scoreRegion(b) - scoreRegion(a))
    .slice(0, 3)

  // Legend stops
  const LEGEND_STOPS = [93, 200, 500, 1_500, 21_204]

  return (
    <div className="sl-page">

      {/* ── Header ── */}
      <div className="sl-header">
        <Link to="/admin" className="sl-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Admin Dashboard
        </Link>
        <div>
          <h1 className="sl-title">Potential Safehouse Locations</h1>
          <p className="sl-subtitle">Philippines · Population Density &amp; Regional Analysis · 2020 Census</p>
        </div>
        <span className="sl-demo-badge">Demo Data</span>
      </div>

      {/* ── Main: map + sidebar ── */}
      <div className="sl-main">

        {/* Map */}
        <div className="sl-map-outer" ref={mapRef} onMouseMove={handleMouseMove}>
          {!geo && (
            <div className="sl-loading">
              <div className="sl-spinner" />
              Loading map…
            </div>
          )}

          {geo && (
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              className="sl-svg"
            >
              {/* Ocean */}
              <rect width={W} height={H} fill="#ddf0f7" rx="6" />

              {/* Region paths */}
              {geo.features.map(feature => {
                const geoName    = feature.properties.REGION
                const info       = REGIONS.find(r => r.geoName === geoName)
                if (!info) return null
                const d          = geometryToD(feature.geometry)
                const isSelected = selected?.geoName === geoName
                const isHovered  = hovered?.geoName === geoName
                const fill       = densityColor(info.density)
                const dimmed     = (selected || hovered) && !isSelected && !isHovered

                return (
                  <path
                    key={geoName}
                    d={d}
                    fill={fill}
                    stroke={isSelected ? '#ffffff' : isHovered ? '#ffffff' : 'rgba(255,255,255,0.55)'}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 1.8 : 0.6}
                    opacity={dimmed ? 0.55 : 1}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                    onMouseEnter={() => setHovered(info)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleClick(info)}
                  />
                )
              })}

              {/* Other charity / NGO / DSWD pins */}
              {OTHER_FACILITIES.map(f => {
                const cx = toX(f.lon)
                const cy = toY(f.lat)
                const color = FACILITY_COLOR[f.type]
                return (
                  <g key={f.key} style={{ pointerEvents: 'none' }}>
                    <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={1.2} opacity={0.88} />
                    <circle cx={cx} cy={cy} r={2} fill="white" />
                  </g>
                )
              })}

              {/* Lighthouse Sanctuary pins (confirmed locations) */}
              {[
                { code: 'NCR', cx: toX(121.05), cy: toY(14.65) },
                { code: 'I',   cx: toX(120.45), cy: toY(17.35) },
              ].map(pin => (
                <g key={pin.code} style={{ pointerEvents: 'none' }}>
                  <circle cx={pin.cx} cy={pin.cy} r={7} fill="white" stroke="#2c4a52" strokeWidth={2} />
                  <circle cx={pin.cx} cy={pin.cy} r={3.5} fill="#2c4a52" />
                </g>
              ))}
            </svg>
          )}

          {/* Floating tooltip */}
          {hovered && (() => {
            const otherHere = OTHER_FACILITIES.filter(f => f.region === hovered.code)
            return (
              <div className="sl-tooltip" style={{ left: tipPos.x, top: tipPos.y }}>
                <div className="sl-tip-name">{hovered.name}</div>
                <div className="sl-tip-group">{hovered.group}</div>
                <div className="sl-tip-rows">
                  <div className="sl-tip-row">
                    <span>Population</span>
                    <strong>{hovered.population.toLocaleString()}</strong>
                  </div>
                  <div className="sl-tip-row">
                    <span>Density</span>
                    <strong>{hovered.density.toLocaleString()} / km²</strong>
                  </div>
                  <div className="sl-tip-row">
                    <span>Avg. Family Income</span>
                    <strong>₱{hovered.avgIncome.toLocaleString()}/yr</strong>
                  </div>
                  <div className="sl-tip-row">
                    <span>VAWC Rate</span>
                    <strong>{hovered.vawcPer100k} per 100k</strong>
                  </div>
                </div>
                {hovered.existingSafehouse && (
                  <div className="sl-tip-sh">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {hovered.existingSafehouse}
                  </div>
                )}
                {otherHere.length > 0 && (
                  <div className="sl-tip-others">
                    {otherHere.map(f => (
                      <div key={f.key} className="sl-tip-other-row">
                        <span className="sl-tip-other-dot" style={{ background: FACILITY_COLOR[f.type] }} />
                        {f.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Sidebar */}
        <div className="sl-sidebar">

          {/* Legend */}
          <div className="sl-legend-card">
            <div className="sl-legend-title">Population Density</div>
            <div className="sl-legend-sub">people per km² · log scale</div>
            <div className="sl-legend-bar">
              <div
                className="sl-legend-gradient"
                style={{ background: `linear-gradient(to right, ${densityColor(93)}, ${densityColor(400)}, ${densityColor(2000)}, ${densityColor(21204)})` }}
              />
              <div className="sl-legend-labels">
                {LEGEND_STOPS.map(v => (
                  <span key={v} style={{ color: textOnColor(v) }}>
                    {v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                  </span>
                ))}
              </div>
            </div>
            <div className="sl-legend-pins">
              <div className="sl-legend-pin">
                <span className="sl-pin-dot" />
                Lighthouse Sanctuary
              </div>
              <div className="sl-legend-pin">
                <span className="sl-pin-dot" style={{ background: FACILITY_COLOR.DSWD }} />
                DSWD / Government
              </div>
              <div className="sl-legend-pin">
                <span className="sl-pin-dot" style={{ background: FACILITY_COLOR.NGO }} />
                NGO
              </div>
              <div className="sl-legend-pin">
                <span className="sl-pin-dot" style={{ background: FACILITY_COLOR.Church }} />
                Church / Faith-based
              </div>
              <div className="sl-legend-pin">
                <span className="sl-pin-dot" style={{ background: FACILITY_COLOR.Private }} />
                Private / Specialist
              </div>
            </div>
          </div>

          {/* Region info */}
          <div className="sl-info-card">
            {!activeRegion && (
              <div className="sl-info-empty">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>Hover or click a region to see details</span>
              </div>
            )}
            {activeRegion && (
              <>
                <div className="sl-info-header" style={{ background: densityColor(activeRegion.density) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="sl-info-name" style={{ color: textOnColor(activeRegion.density) }}>{activeRegion.name}</span>
                    {selected && (
                      <button className="sl-deselect" onClick={() => setSelected(null)} title="Clear selection">✕</button>
                    )}
                  </div>
                  <span className="sl-info-code" style={{ color: textOnColor(activeRegion.density), opacity: 0.75 }}>{activeRegion.code} · {activeRegion.group}</span>
                </div>
                <div className="sl-info-metrics">
                  <div className="sl-metric">
                    <span className="sl-metric-label">Population</span>
                    <span className="sl-metric-value">{fmtPop(activeRegion.population)}</span>
                  </div>
                  <div className="sl-metric">
                    <span className="sl-metric-label">Density / km²</span>
                    <span className="sl-metric-value">{activeRegion.density.toLocaleString()}</span>
                  </div>
                  <div className="sl-metric">
                    <span className="sl-metric-label">Land Area</span>
                    <span className="sl-metric-value">{activeRegion.area.toLocaleString()} km²</span>
                  </div>
                  <div className="sl-metric">
                    <span className="sl-metric-label">Avg. Family Income</span>
                    <span className="sl-metric-value">₱{(activeRegion.avgIncome / 1000).toFixed(0)}k/yr</span>
                  </div>
                  <div className="sl-metric">
                    <span className="sl-metric-label">VAWC Rate †</span>
                    <span className="sl-metric-value">{activeRegion.vawcPer100k} / 100k</span>
                  </div>
                </div>
                {activeRegion.existingSafehouse ? (
                  <div className="sl-info-served">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    {activeRegion.existingSafehouse}
                  </div>
                ) : (
                  <div className="sl-info-unserved">No safehouse in this region</div>
                )}
              </>
            )}
          </div>

          {/* Top candidates */}
          <div className="sl-cand-card">
            <div className="sl-cand-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Top Unserved Candidates
            </div>
            {topCandidates.map((r, i) => {
              const isActive = selected?.code === r.code
              return (
                <div
                  key={r.code}
                  className={`sl-cand-row sl-cand-row-btn${isActive ? ' sl-cand-row-active' : ''}`}
                  onClick={() => handleClick(r)}
                  title={`Select ${r.name} on map`}
                >
                  <span className="sl-cand-rank">#{i + 1}</span>
                  <div className="sl-cand-info">
                    <span className="sl-cand-name">{r.name}</span>
                    <span className="sl-cand-meta">
                      {fmtPop(r.population)} pop · {r.density.toLocaleString()}/km²
                    </span>
                  </div>
                  <div
                    className="sl-cand-swatch"
                    style={{ background: densityColor(r.density) }}
                  />
                </div>
              )
            })}
          </div>

          {/* Data sources note */}
          <p className="sl-data-note">
            Population: PSA estimates (10 key regions updated Apr 2026; remainder PSA 2020 Census).
            Income: PSA FIES 2021 average family income.
            † VAWC rate (per 100k): NCR, CAR, I, II, III, IV-A, VI, VII, XI, and BARMM use
            verified PNP/PSA figures. CAR (65.8) has the highest reporting rate; BARMM (4.3)
            is likely underreported. Remaining 7 regions use mid-range estimates (~14–17/100k)
            — replace with official PNP regional data when available.
            Candidate scoring normalizes VAWC to CAR's rate as the regional maximum.
          </p>

        </div>
      </div>

    </div>
  )
}
