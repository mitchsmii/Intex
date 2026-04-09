import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/apiService'
import type { Safehouse } from '../../services/apiService'
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
  properties: Record<string, string>
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

// ─── Dominican Republic data ──────────────────────────────────────────────────

interface DRProvinceInfo {
  geoName: string      // matches NAME_1 in GADM GeoJSON (no spaces)
  name: string         // display name
  population: number
  vawcPer100k: number
  annualCases: number
  existingFacility: string | null
  facilityDesc: string | null
  householdIncomeRD: number | null   // avg monthly household income in RD$
  householdIncomeUSD: number | null  // avg monthly household income in USD
}

const DR_PROVINCES: DRProvinceInfo[] = [
  { geoName: 'DistritoNacional',       name: 'Distrito Nacional',        population: 1_065_000, vawcPer100k: 126.8, annualCases: 1350, existingFacility: 'Metropolitan Shelter (×3)',  facilityDesc: 'High Capacity — Primary reception for the capital.',        householdIncomeRD: 48_500, householdIncomeUSD: 788 },
  { geoName: 'SantoDomingo',           name: 'Santo Domingo (Province)', population: 3_150_000, vawcPer100k: 125.4, annualCases: 3950, existingFacility: 'Regional Shelter',             facilityDesc: 'Serves the largest provincial population in the DR.',       householdIncomeRD: 44_200, householdIncomeUSD: 718 },
  { geoName: 'Santiago',               name: 'Santiago',                 population: 1_120_000, vawcPer100k: 126.8, annualCases: 1420, existingFacility: 'Northern Hub (×2)',            facilityDesc: 'Primary facilities for the Cibao region.',                  householdIncomeRD: 42_800, householdIncomeUSD: 695 },
  { geoName: 'LaAltagracia',           name: 'La Altagracia',            population:   510_000, vawcPer100k: 125.5, annualCases:  640, existingFacility: 'Eastern Shelter',              facilityDesc: 'Critical for tourism-related worker protection.',            householdIncomeRD: 38_500, householdIncomeUSD: 626 },
  { geoName: 'SanCristóbal',           name: 'San Cristóbal',            population:   680_000, vawcPer100k: 122.1, annualCases:  830, existingFacility: 'Southern Shelter',             facilityDesc: 'High-traffic area near the capital.',                       householdIncomeRD: 34_200, householdIncomeUSD: 556 },
  { geoName: 'LaVega',                 name: 'La Vega',                  population:   425_000, vawcPer100k: 112.9, annualCases:  480, existingFacility: 'Interior Shelter',             facilityDesc: 'Established local government support.',                     householdIncomeRD: 31_500, householdIncomeUSD: 512 },
  { geoName: 'PuertoPlata',            name: 'Puerto Plata',             population:   355_000, vawcPer100k: 111.3, annualCases:  395, existingFacility: 'Coastal Shelter',              facilityDesc: 'Services the northern tourist corridor.',                   householdIncomeRD: 33_200, householdIncomeUSD: 540 },
  { geoName: 'Duarte',                 name: 'Duarte',                   population:   315_000, vawcPer100k: 106.3, annualCases:  335, existingFacility: 'Central Shelter',              facilityDesc: 'Strategic for the agricultural interior.',                  householdIncomeRD: 30_800, householdIncomeUSD: 501 },
  { geoName: 'SanPedrodeMacorís',      name: 'San Pedro de Macorís',     population:   320_000, vawcPer100k: 109.4, annualCases:  350, existingFacility: 'Sugar Coast Shelter',          facilityDesc: 'High industrial/migrant worker population.',                householdIncomeRD: 32_100, householdIncomeUSD: 522 },
  { geoName: 'Espaillat',              name: 'Espaillat',                population:   245_000, vawcPer100k: 106.1, annualCases:  260, existingFacility: 'Agricultural Shelter',         facilityDesc: 'Part of the Cibao support network.',                        householdIncomeRD: 29_800, householdIncomeUSD: 485 },
  { geoName: 'Azua',                   name: 'Azua',                     population:   245_000, vawcPer100k: 102.0, annualCases:  250, existingFacility: 'Southern Gateway',             facilityDesc: 'Critical for the transit corridor to the border.',          householdIncomeRD: 24_500, householdIncomeUSD: 398 },
  { geoName: 'Barahona',               name: 'Barahona',                 population:   205_000, vawcPer100k: 104.9, annualCases:  215, existingFacility: 'Deep South Shelter',           facilityDesc: 'Serves the Enriquillo region near the border.',             householdIncomeRD: 23_200, householdIncomeUSD: 377 },
  { geoName: 'SanJuan',                name: 'San Juan',                 population:   230_000, vawcPer100k: 100.0, annualCases:  230, existingFacility: 'Western Valley Shelter',       facilityDesc: 'Major support hub for the western interior.',               householdIncomeRD: 22_100, householdIncomeUSD: 359 },
  { geoName: 'Valverde',               name: 'Valverde',                 population:   180_000, vawcPer100k: 102.8, annualCases:  185, existingFacility: 'Northwest Shelter',            facilityDesc: 'Strategic for the Mao/Montecristi corridor.',               householdIncomeRD: 25_400, householdIncomeUSD: 413 },
  { geoName: 'Peravia',                name: 'Peravia',                  population:   215_000, vawcPer100k: 102.3, annualCases:  220, existingFacility: null, facilityDesc: null, householdIncomeRD: 28_400, householdIncomeUSD: 462 },
  { geoName: 'MonseñorNouel',          name: 'Monseñor Nouel',           population:   185_000, vawcPer100k: 105.4, annualCases:  195, existingFacility: null, facilityDesc: null, householdIncomeRD: 29_100, householdIncomeUSD: 473 },
  { geoName: 'SánchezRamírez',         name: 'Sánchez Ramírez',          population:   155_000, vawcPer100k: 103.2, annualCases:  160, existingFacility: null, facilityDesc: null, householdIncomeRD: 26_500, householdIncomeUSD: 431 },
  { geoName: 'MontePlata',             name: 'Monte Plata',              population:   195_000, vawcPer100k:  97.4, annualCases:  190, existingFacility: null, facilityDesc: null, householdIncomeRD: 22_800, householdIncomeUSD: 371 },
  { geoName: 'HatoMayor',              name: 'Hato Mayor',               population:   105_000, vawcPer100k: 100.0, annualCases:  105, existingFacility: null, facilityDesc: null, householdIncomeRD: 23_900, householdIncomeUSD: 389 },
  { geoName: 'ElSeybo',                name: 'El Seibo',                 population:   102_000, vawcPer100k:  93.1, annualCases:   95, existingFacility: null, facilityDesc: null, householdIncomeRD: 21_500, householdIncomeUSD: 350 },
  { geoName: 'Bahoruco',               name: 'Bahoruco',                 population:   112_000, vawcPer100k:  93.8, annualCases:  105, existingFacility: null, facilityDesc: null, householdIncomeRD: 19_800, householdIncomeUSD: 322 },
  { geoName: 'MonteCristi',            name: 'Monte Cristi',             population:   125_000, vawcPer100k:  96.0, annualCases:  120, existingFacility: null, facilityDesc: null, householdIncomeRD: 23_400, householdIncomeUSD: 380 },
  { geoName: 'Samaná',                 name: 'Samaná',                   population:   115_000, vawcPer100k:  95.7, annualCases:  110, existingFacility: null, facilityDesc: null, householdIncomeRD: 27_200, householdIncomeUSD: 442 },
  { geoName: 'Dajabón',               name: 'Dajabón',                   population:    78_000, vawcPer100k:  89.7, annualCases:   70, existingFacility: null, facilityDesc: null, householdIncomeRD: 21_800, householdIncomeUSD: 354 },
  { geoName: 'Pedernales',             name: 'Pedernales',               population:    38_000, vawcPer100k:  78.9, annualCases:   30, existingFacility: null, facilityDesc: null, householdIncomeRD: 18_500, householdIncomeUSD: 301 },
  { geoName: 'Independencia',          name: 'Independencia',            population:    62_000, vawcPer100k:  88.7, annualCases:   55, existingFacility: null, facilityDesc: null, householdIncomeRD: 19_200, householdIncomeUSD: 312 },
  { geoName: 'LaEstrelleta',           name: 'Elías Piña',               population:    65_000, vawcPer100k:  84.6, annualCases:   55, existingFacility: null, facilityDesc: null, householdIncomeRD: 17_900, householdIncomeUSD: 291 },
  { geoName: 'LaRomana',               name: 'La Romana',                population:   270_000, vawcPer100k: 108.0, annualCases:  292, existingFacility: null, facilityDesc: null, householdIncomeRD: 35_000, householdIncomeUSD: 569 },
  { geoName: 'MaríaTrinidadSánchez',   name: 'María Trinidad Sánchez',   population:   155_000, vawcPer100k:  95.0, annualCases:  147, existingFacility: null, facilityDesc: null, householdIncomeRD: 26_000, householdIncomeUSD: 423 },
  { geoName: 'SanJosédeOcoa',          name: 'San José de Ocoa',         population:    65_000, vawcPer100k:  90.0, annualCases:   59, existingFacility: null, facilityDesc: null, householdIncomeRD: 24_000, householdIncomeUSD: 390 },
  { geoName: 'SantiagoRodríguez',      name: 'Santiago Rodríguez',       population:    60_000, vawcPer100k:  88.0, annualCases:   53, existingFacility: null, facilityDesc: null, householdIncomeRD: 22_000, householdIncomeUSD: 358 },
  { geoName: 'Salcedo',                name: 'Hermanas Mirabal',         population:    95_000, vawcPer100k:  98.0, annualCases:   93, existingFacility: null, facilityDesc: null, householdIncomeRD: 27_000, householdIncomeUSD: 439 },
]

// DR map projection
const DR_W = 420
const DR_H = 295
const DR_LON_MIN = -72.0
const DR_LON_MAX = -68.2
const DR_LAT_MIN = 17.35
const DR_LAT_MAX = 20.05

function toDrX(lon: number): number {
  return ((lon - DR_LON_MIN) / (DR_LON_MAX - DR_LON_MIN)) * DR_W
}
function toDrY(lat: number): number {
  return ((DR_LAT_MAX - lat) / (DR_LAT_MAX - DR_LAT_MIN)) * DR_H
}

function drRingToD(ring: number[][]): string {
  if (ring.length < 2) return ''
  const pts = ring.map(([lon, lat]) => `${toDrX(lon).toFixed(1)},${toDrY(lat).toFixed(1)}`)
  return `M ${pts.join(' L ')} Z`
}

function drGeometryToD(geometry: GeoFeature['geometry']): string {
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as number[][][]).map(ring => drRingToD(ring)).join(' ')
  }
  return (geometry.coordinates as number[][][][])
    .flatMap(poly => poly.map(ring => drRingToD(ring)))
    .join(' ')
}

// DR color scale: map VAW rate (78–128) to seafoam → tidal → deep
const DR_VAWC_MIN = 78
const DR_VAWC_MAX = 128

function drVawcColor(rate: number): string {
  const t = Math.max(0, Math.min(1, (rate - DR_VAWC_MIN) / (DR_VAWC_MAX - DR_VAWC_MIN)))
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

function drTextOnColor(rate: number): string {
  const t = (rate - DR_VAWC_MIN) / (DR_VAWC_MAX - DR_VAWC_MIN)
  return t > 0.55 ? '#ffffff' : '#2c4a52'
}

function scoreDRProvince(p: DRProvinceInfo): number {
  if (p.existingFacility) return -1
  const vawScore = p.vawcPer100k / 126.8
  const popScore = Math.log10(p.population) / Math.log10(3_150_000)
  return vawScore * 0.6 + popScore * 0.4
}

// DR income is monthly; household size ~3.5 for DR
const DR_HH_SIZE = 3.5
function drPovertyInfo(monthlyUSD: number | null) {
  if (!monthlyUSD) return null
  const annualUSD  = monthlyUSD * 12
  const personDay  = annualUSD / DR_HH_SIZE / 365
  let label: string, bg: string, text: string
  if      (personDay < 2.15) { label = 'Extreme Poverty';    bg = '#b91c1c'; text = '#fff' }
  else if (personDay < 3.65) { label = 'Below Poverty Line'; bg = '#d97706'; text = '#fff' }
  else if (personDay < 6.85) { label = 'Near Poverty';       bg = '#f59e0b'; text = '#1a1a1a' }
  else if (personDay < 15)   { label = 'Working Class';      bg = '#16a34a'; text = '#fff' }
  else                       { label = 'Middle Income+';     bg = '#2563eb'; text = '#fff' }
  return { annualUSD, personDay, label, bg, text }
}

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

// PSA FIES 2021 assumes ~5-person household; BSP 2024 avg. rate ~56 PHP/USD
const PHP_TO_USD  = 56
const FAMILY_SIZE = 5

function povertyInfo(phpPerYear: number) {
  const usdPerYear         = Math.round(phpPerYear / PHP_TO_USD)
  const usdPersonDay       = phpPerYear / PHP_TO_USD / FAMILY_SIZE / 365

  // PSA 2021 national poverty threshold ≈ ₱169k/yr for a family of 5
  // World Bank lower-middle poverty line ≈ $3.65/person/day
  if (phpPerYear < 169_000) return { label: 'Below Poverty Line', bg: '#fee2e2', text: '#991b1b', usdPerYear, usdPersonDay }
  if (phpPerYear < 270_000) return { label: 'Near-Poverty',        bg: '#ffedd5', text: '#9a3412', usdPerYear, usdPersonDay }
  if (phpPerYear < 400_000) return { label: 'Low Income',          bg: '#fef9c3', text: '#854d0e', usdPerYear, usdPersonDay }
  return                           { label: 'Lower-Middle Income', bg: '#dcfce7', text: '#166534', usdPerYear, usdPersonDay }
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

// Philippine province / city → region code lookup
const PH_LOC_REGION: Record<string, string> = {
  // NCR
  'metro manila': 'NCR', 'quezon city': 'NCR', 'manila': 'NCR', 'makati': 'NCR',
  'pasig': 'NCR', 'taguig': 'NCR', 'caloocan': 'NCR', 'pasay': 'NCR',
  'mandaluyong': 'NCR', 'muntinlupa': 'NCR', 'las piñas': 'NCR', 'marikina': 'NCR',
  'parañaque': 'NCR', 'valenzuela': 'NCR', 'malabon': 'NCR', 'navotas': 'NCR',
  'ncr': 'NCR',
  // Region I
  'ilocos norte': 'I', 'ilocos sur': 'I', 'la union': 'I', 'pangasinan': 'I',
  'vigan': 'I', 'laoag': 'I', 'san fernando': 'I',
  // Region II
  'cagayan': 'II', 'isabela': 'II', 'nueva vizcaya': 'II', 'quirino': 'II', 'batanes': 'II',
  'tuguegarao': 'II',
  // Region III
  'aurora': 'III', 'bataan': 'III', 'bulacan': 'III', 'nueva ecija': 'III',
  'pampanga': 'III', 'tarlac': 'III', 'zambales': 'III', 'angeles': 'III',
  'olongapo': 'III', 'san jose del monte': 'III',
  // Region IV-A CALABARZON
  'cavite': 'IVA', 'laguna': 'IVA', 'batangas': 'IVA', 'rizal': 'IVA', 'quezon': 'IVA',
  'antipolo': 'IVA', 'calamba': 'IVA', 'lucena': 'IVA', 'lipa': 'IVA',
  'bacoor': 'IVA', 'dasmariñas': 'IVA', 'general trias': 'IVA', 'imus': 'IVA',
  'san pablo': 'IVA', 'santa rosa': 'IVA', 'biñan': 'IVA', 'cabuyao': 'IVA',
  'calabarzon': 'IVA', 'region iv-a': 'IVA', 'region 4a': 'IVA', 'iv-a': 'IVA',
  // Region IV-B MIMAROPA
  'oriental mindoro': 'IVB', 'occidental mindoro': 'IVB', 'marinduque': 'IVB',
  'romblon': 'IVB', 'palawan': 'IVB', 'puerto princesa': 'IVB',
  // Region V Bicol
  'albay': 'V', 'camarines norte': 'V', 'camarines sur': 'V', 'catanduanes': 'V',
  'masbate': 'V', 'sorsogon': 'V', 'legazpi': 'V', 'naga': 'V',
  // Region VI Western Visayas
  'aklan': 'VI', 'antique': 'VI', 'capiz': 'VI', 'guimaras': 'VI',
  'iloilo': 'VI', 'negros occidental': 'VI', 'bacolod': 'VI', 'roxas': 'VI',
  // Region VII Central Visayas
  'bohol': 'VII', 'cebu': 'VII', 'negros oriental': 'VII', 'siquijor': 'VII',
  'cebu city': 'VII', 'mandaue': 'VII', 'lapu-lapu': 'VII', 'tagbilaran': 'VII',
  'dumaguete': 'VII',
  // Region VIII Eastern Visayas
  'biliran': 'VIII', 'eastern samar': 'VIII', 'leyte': 'VIII',
  'northern samar': 'VIII', 'samar': 'VIII', 'southern leyte': 'VIII',
  'tacloban': 'VIII', 'ormoc': 'VIII',
  // Region IX
  'zamboanga del norte': 'IX', 'zamboanga del sur': 'IX', 'zamboanga sibugay': 'IX',
  'zamboanga city': 'IX', 'zamboanga': 'IX',
  // Region X
  'bukidnon': 'X', 'camiguin': 'X', 'lanao del norte': 'X',
  'misamis occidental': 'X', 'misamis oriental': 'X', 'cagayan de oro': 'X',
  // Region XI Davao
  'davao del norte': 'XI', 'davao del sur': 'XI', 'davao occidental': 'XI',
  'davao oriental': 'XI', 'compostela valley': 'XI', 'davao de oro': 'XI',
  'davao city': 'XI', 'davao': 'XI',
  // Region XII
  'cotabato': 'XII', 'sarangani': 'XII', 'south cotabato': 'XII',
  'sultan kudarat': 'XII', 'general santos': 'XII', 'koronadal': 'XII',
  // Region XIII Caraga
  'agusan del norte': 'XIII', 'agusan del sur': 'XIII', 'dinagat islands': 'XIII',
  'surigao del norte': 'XIII', 'surigao del sur': 'XIII', 'butuan': 'XIII',
  // CAR
  'abra': 'CAR', 'apayao': 'CAR', 'benguet': 'CAR', 'ifugao': 'CAR',
  'kalinga': 'CAR', 'mountain province': 'CAR', 'baguio': 'CAR', 'tabuk': 'CAR',
  // BARMM
  'basilan': 'BARMM', 'lanao del sur': 'BARMM', 'maguindanao': 'BARMM',
  'sulu': 'BARMM', 'tawi-tawi': 'BARMM', 'cotabato city': 'BARMM',
  'marawi': 'BARMM',
}

function matchesRegion(sh: Safehouse, info: RegionInfo): boolean {
  const candidates = [sh.region, sh.province, sh.city].filter(Boolean) as string[]
  if (candidates.length === 0) return false

  return candidates.some(f => {
    const lower = f.toLowerCase().trim()

    // Direct text match against code / name / geoName
    if ([info.code.toLowerCase(), info.name.toLowerCase(), info.geoName.toLowerCase()].some(
      t => lower.includes(t) || t.includes(lower)
    )) return true

    // Province/city lookup
    const mapped = PH_LOC_REGION[lower]
    return mapped === info.code
  })
}

export default function SafehouseLocationsPage() {
  type Country = 'PH' | 'DR'
  const [country,    setCountry]    = useState<Country>('PH')
  const [geo, setGeo]               = useState<GeoJSON | null>(null)
  const [geoDR,      setGeoDR]      = useState<GeoJSON | null>(null)
  const [safehouses, setSafehouses] = useState<Safehouse[]>([])
  const [hovered, setHovered]       = useState<RegionInfo | null>(null)
  const [selected, setSelected]     = useState<RegionInfo | null>(null)
  const [hoveredDR,  setHoveredDR]  = useState<DRProvinceInfo | null>(null)
  const [selectedDR, setSelectedDR] = useState<DRProvinceInfo | null>(null)
  const [tipPos, setTipPos]         = useState({ x: 0, y: 0 })
  const mapRef                      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/data/philippines-regions.json')
      .then(r => r.json()).then((data: GeoJSON) => setGeo(data)).catch(console.error)
    fetch('/data/dominican-republic-provinces.json')
      .then(r => r.json()).then((data: GeoJSON) => setGeoDR(data)).catch(console.error)
    api.getSafehouses().then(setSafehouses).catch(() => {})
  }, [])

  function handleMouseMove(e: React.MouseEvent) {
    const rect = mapRef.current?.getBoundingClientRect()
    if (!rect) return
    setTipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 8 })
  }

  function handleClick(info: RegionInfo) {
    setSelected(prev => prev?.geoName === info.geoName ? null : info)
  }

  function handleClickDR(info: DRProvinceInfo) {
    setSelectedDR(prev => prev?.geoName === info.geoName ? null : info)
  }

  function switchCountry(c: Country) {
    setCountry(c)
    setSelected(null)
    setSelectedDR(null)
    setHovered(null)
    setHoveredDR(null)
  }

  const activeRegion   = selected   ?? hovered
  const activeDRProv   = selectedDR ?? hoveredDR

  const topCandidates = [...REGIONS]
    .filter(r => !r.existingSafehouse)
    .sort((a, b) => scoreRegion(b) - scoreRegion(a))
    .slice(0, 3)

  const topDRCandidates = [...DR_PROVINCES]
    .filter(p => !p.existingFacility)
    .sort((a, b) => scoreDRProvince(b) - scoreDRProvince(a))
    .slice(0, 3)

  // Legend stops
  const LEGEND_STOPS = [93, 200, 500, 1_500, 21_204]
  const DR_LEGEND_STOPS = [79, 92, 102, 114, 128]

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
          <p className="sl-subtitle">
            {country === 'PH'
              ? 'Philippines · Population Density & Regional Analysis · 2020 Census'
              : 'Dominican Republic · VAW Rate Analysis · 2026 Projections'}
          </p>
        </div>
      </div>

      {/* Country toggle */}
      <div className="sl-country-toggle">
        <button
          className={`sl-country-btn${country === 'PH' ? ' sl-country-active' : ''}`}
          onClick={() => switchCountry('PH')}
        >
          🇵🇭 Philippines
        </button>
        <button
          className={`sl-country-btn${country === 'DR' ? ' sl-country-active' : ''}`}
          onClick={() => switchCountry('DR')}
        >
          🇩🇴 Dominican Republic
        </button>
      </div>

      {/* ── Main: map + sidebar ── */}
      <div className="sl-main">

        {/* Map */}
        <div className="sl-map-outer" ref={mapRef} onMouseMove={handleMouseMove}>

          {/* ── Philippines map ── */}
          {country === 'PH' && (
            <>
              {!geo && (
                <div className="sl-loading">
                  <div className="sl-spinner" />
                  Loading map…
                </div>
              )}

              {geo && (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="sl-svg"
                >
                  {/* Ocean */}
                  <rect width={W} height={H} fill="#ddf0f7" rx="6" />

                  {/* Region paths */}
                  {geo.features.map(feature => {
                    const geoName    = feature.properties['REGION']
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
                      {(() => {
                        const pov = povertyInfo(hovered.avgIncome)
                        return (
                          <div className="sl-tip-row">
                            <span>≈ USD</span>
                            <strong style={{ color: pov.text === '#991b1b' ? '#f87171' : pov.text === '#9a3412' ? '#fb923c' : pov.text === '#854d0e' ? '#fbbf24' : '#86efac' }}>
                              ${pov.usdPerYear.toLocaleString()}/yr · {pov.label}
                            </strong>
                          </div>
                        )
                      })()}
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
            </>
          )}

          {/* ── Dominican Republic map ── */}
          {country === 'DR' && (
            <>
              {!geoDR && (
                <div className="sl-loading" style={{ width: DR_W, height: DR_H }}>
                  <div className="sl-spinner" />
                  Loading map…
                </div>
              )}
              {geoDR && (
                <svg viewBox={`0 0 ${DR_W} ${DR_H}`} className="sl-svg">
                  {/* Ocean */}
                  <rect width={DR_W} height={DR_H} fill="#ddf0f7" rx="6" />
                  {/* Province paths */}
                  {geoDR.features.map(feature => {
                    const geoName  = feature.properties['NAME_1']
                    const info     = DR_PROVINCES.find(p => p.geoName === geoName)
                    if (!info) return null
                    const d         = drGeometryToD(feature.geometry)
                    const isSelected = selectedDR?.geoName === geoName
                    const isHovered  = hoveredDR?.geoName === geoName
                    const fill       = drVawcColor(info.vawcPer100k)
                    const dimmed     = (selectedDR || hoveredDR) && !isSelected && !isHovered
                    return (
                      <path
                        key={geoName}
                        d={d}
                        fill={fill}
                        stroke={isSelected || isHovered ? '#ffffff' : 'rgba(255,255,255,0.55)'}
                        strokeWidth={isSelected ? 2.5 : isHovered ? 1.8 : 0.6}
                        opacity={dimmed ? 0.55 : 1}
                        style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                        onMouseEnter={() => setHoveredDR(info)}
                        onMouseLeave={() => setHoveredDR(null)}
                        onClick={() => handleClickDR(info)}
                      />
                    )
                  })}
                </svg>
              )}
              {/* DR Tooltip */}
              {hoveredDR && (
                <div className="sl-tooltip" style={{ left: tipPos.x, top: tipPos.y }}>
                  <div className="sl-tip-name">{hoveredDR.name}</div>
                  <div className="sl-tip-group">Dominican Republic</div>
                  <div className="sl-tip-rows">
                    <div className="sl-tip-row">
                      <span>Population</span>
                      <strong>{hoveredDR.population.toLocaleString()}</strong>
                    </div>
                    <div className="sl-tip-row">
                      <span>VAW Rate</span>
                      <strong>{hoveredDR.vawcPer100k} per 100k</strong>
                    </div>
                    <div className="sl-tip-row">
                      <span>Est. Annual Cases</span>
                      <strong>~{hoveredDR.annualCases.toLocaleString()}</strong>
                    </div>
                  </div>
                  {hoveredDR.existingFacility && (
                    <div className="sl-tip-sh">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {hoveredDR.existingFacility}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>

        {/* Sidebar */}
        <div className="sl-sidebar">

          {/* Legend */}
          {country === 'PH' ? (
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
          ) : (
            <div className="sl-legend-card">
              <div className="sl-legend-title">VAW Rate</div>
              <div className="sl-legend-sub">cases per 100,000 population</div>
              <div className="sl-legend-bar">
                <div className="sl-legend-gradient"
                  style={{ background: `linear-gradient(to right, ${drVawcColor(79)}, ${drVawcColor(96)}, ${drVawcColor(108)}, ${drVawcColor(120)}, ${drVawcColor(128)})` }}
                />
                <div className="sl-legend-labels">
                  {DR_LEGEND_STOPS.map(v => <span key={v}>{v}</span>)}
                </div>
              </div>
              <div className="sl-legend-pins">
                <div className="sl-legend-pin">
                  <span className="sl-pin-dot" />
                  Existing shelter
                </div>
              </div>
            </div>
          )}

          {/* Region / Province info */}
          <div className="sl-info-card">
            {country === 'PH' && !activeRegion && (
              <div className="sl-info-empty">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>Hover or click a region to see details</span>
              </div>
            )}
            {country === 'PH' && activeRegion && (
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
                  {(() => {
                    const pov = povertyInfo(activeRegion.avgIncome)
                    return (
                      <div className="sl-metric sl-metric-income">
                        <span className="sl-metric-label">Avg. Family Income</span>
                        <span className="sl-metric-value">₱{activeRegion.avgIncome.toLocaleString()} / yr</span>
                        <span className="sl-income-usd">≈ ${pov.usdPerYear.toLocaleString()} / yr · ${pov.usdPersonDay.toFixed(2)}/person/day</span>
                        <span className="sl-income-badge" style={{ background: pov.bg, color: pov.text }}>{pov.label}</span>
                      </div>
                    )
                  })()}
                  <div className="sl-metric">
                    <span className="sl-metric-label">
                      VAWC Rate †
                      <span className="sl-vawc-help">?</span>
                    </span>
                    <span className="sl-metric-value">{activeRegion.vawcPer100k} / 100k</span>
                  </div>
                </div>
                {(() => {
                  const dbSafehouses = safehouses.filter(sh => matchesRegion(sh, activeRegion))
                  const hasLighthouse = !!activeRegion.existingSafehouse
                  if (!hasLighthouse && dbSafehouses.length === 0) {
                    return <div className="sl-info-unserved">No safehouse in this region</div>
                  }
                  return (
                    <div className="sl-info-sh-list">
                      {hasLighthouse && (
                        <div className="sl-info-served">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                          </svg>
                          {activeRegion.existingSafehouse}
                        </div>
                      )}
                      {dbSafehouses.map(sh => (
                        <div key={sh.safehouseId} className="sl-info-served">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                          </svg>
                          <span>
                            {sh.name ?? sh.safehouseCode ?? `Safehouse #${sh.safehouseId}`}
                            {sh.city && <span className="sl-info-sh-city"> · {sh.city}</span>}
                            {sh.status && sh.status.toLowerCase() !== 'active' && (
                              <span className="sl-info-sh-status"> ({sh.status})</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                {(() => {
                  const facilities = OTHER_FACILITIES.filter(f => f.region === activeRegion.code)
                  if (facilities.length === 0) return null
                  return (
                    <div className="sl-info-facilities">
                      <div className="sl-info-facilities-label">Other facilities in region</div>
                      {facilities.map(f => (
                        <div key={f.key} className="sl-info-facility-row">
                          <span className="sl-info-facility-dot" style={{ background: FACILITY_COLOR[f.type] }} />
                          <span className="sl-info-facility-name">{f.name}</span>
                          <span className="sl-info-facility-type">{f.type === 'DSWD' ? 'DSWD / Gov.' : f.type}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </>
            )}
            {country === 'DR' && activeDRProv && (
              <>
                <div className="sl-info-header" style={{ background: drVawcColor(activeDRProv.vawcPer100k) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="sl-info-name" style={{ color: drTextOnColor(activeDRProv.vawcPer100k) }}>
                      {activeDRProv.name}
                    </span>
                    {selectedDR && (
                      <button className="sl-deselect" onClick={() => setSelectedDR(null)} title="Clear selection">✕</button>
                    )}
                  </div>
                  <span className="sl-info-code" style={{ color: drTextOnColor(activeDRProv.vawcPer100k), opacity: 0.75 }}>
                    Dominican Republic
                  </span>
                </div>
                <div className="sl-info-metrics">
                  <div className="sl-metric">
                    <span className="sl-metric-label">Population</span>
                    <span className="sl-metric-value">{fmtPop(activeDRProv.population)}</span>
                  </div>
                  <div className="sl-metric">
                    <span className="sl-metric-label">VAW Rate</span>
                    <span className="sl-metric-value">{activeDRProv.vawcPer100k} / 100k</span>
                  </div>
                  <div className="sl-metric">
                    <span className="sl-metric-label">Est. Annual Cases</span>
                    <span className="sl-metric-value">~{activeDRProv.annualCases.toLocaleString()}</span>
                  </div>
                  {(() => {
                    const pov = drPovertyInfo(activeDRProv.householdIncomeUSD)
                    if (!pov) return null
                    return (
                      <div className="sl-metric sl-metric-income">
                        <span className="sl-metric-label">Avg. Household Income</span>
                        <span className="sl-metric-value">RD$ {activeDRProv.householdIncomeRD?.toLocaleString()} / mo</span>
                        <span className="sl-income-usd">≈ ${activeDRProv.householdIncomeUSD?.toLocaleString()} / mo · ${pov.personDay.toFixed(2)}/person/day</span>
                        <span className="sl-income-badge" style={{ background: pov.bg, color: pov.text }}>{pov.label}</span>
                      </div>
                    )
                  })()}
                </div>
                {activeDRProv.existingFacility ? (
                  <div className="sl-info-sh-list">
                    <div className="sl-info-served">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                      <span>
                        {activeDRProv.existingFacility}
                        {activeDRProv.facilityDesc && (
                          <span className="sl-info-sh-city"> · {activeDRProv.facilityDesc}</span>
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="sl-info-unserved">No shelter in this province</div>
                )}
              </>
            )}
            {country === 'DR' && !activeDRProv && (
              <div className="sl-info-empty">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>Hover or click a province to see details</span>
              </div>
            )}
          </div>

          {/* Top candidates */}
          {country === 'PH' && (
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
          )}
          {country === 'DR' && (
            <div className="sl-cand-card">
              <div className="sl-cand-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Top Unserved Candidates
              </div>
              {topDRCandidates.map((p, i) => {
                const isActive = selectedDR?.geoName === p.geoName
                return (
                  <div
                    key={p.geoName}
                    className={`sl-cand-row sl-cand-row-btn${isActive ? ' sl-cand-row-active' : ''}`}
                    onClick={() => handleClickDR(p)}
                    title={`Select ${p.name} on map`}
                  >
                    <span className="sl-cand-rank">#{i + 1}</span>
                    <div className="sl-cand-info">
                      <span className="sl-cand-name">{p.name}</span>
                      <span className="sl-cand-meta">
                        {fmtPop(p.population)} pop · {p.vawcPer100k}/100k VAW
                      </span>
                    </div>
                    <div className="sl-cand-swatch" style={{ background: drVawcColor(p.vawcPer100k) }} />
                  </div>
                )
              })}
            </div>
          )}

          {/* Data sources note */}
          {country === 'PH' ? (
            <p className="sl-data-note">
              Population: PSA estimates (10 key regions updated Apr 2026; remainder PSA 2020 Census).
              Income: PSA FIES 2021 average family income.
              † VAWC rate (per 100k): NCR, CAR, I, II, III, IV-A, VI, VII, XI, and BARMM use
              verified PNP/PSA figures. CAR (65.8) has the highest reporting rate; BARMM (4.3)
              is likely underreported. Remaining 7 regions use mid-range estimates (~14–17/100k)
              — replace with official PNP regional data when available.
              Candidate scoring normalizes VAWC to CAR's rate as the regional maximum.
            </p>
          ) : (
            <p className="sl-data-note">
              VAW data: 2026 projections based on Fiscalía and INTEC research.
              Existing facility list sourced from PROFAMILIA, government shelters, and NGO directories (Apr 2026).
              Candidate scoring weights VAW rate (60%) and population (40%).
            </p>
          )}

        </div>
      </div>

    </div>
  )
}
